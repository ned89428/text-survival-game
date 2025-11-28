import { player, gameState, stats, inventory, stash, COOLDOWNS, resetGameData } from './state.js';
import * as UI from './ui.js';
import { ENEMIES } from './data/enemies.js';
import { EVENTS } from './data/events.js'; // ✨ 1. 導入新的事件資料
import { EQUIP_TEMPLATES, ITEM_PREFIXES, CONSUMABLES } from './data/items.js';
import { SKILLS } from './data/skills.js'; 

// ================== 核心工具 ==================
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ================== 存檔系統 ==================
function autoSave() {
    if (!player.alive && player.day > 1) { }
    const data = { 
        player, inventory, stash, 
        gameState: { ...gameState, isProcessingTurn: false }, // 只重置處理鎖，保留戰鬥狀態
        stats 
    };
    localStorage.setItem('LegendSurvival_Save', JSON.stringify(data));
}

export function checkSaveAndStart() {
    const json = localStorage.getItem('LegendSurvival_Save');
    if (!json) {
        document.getElementById("overlay").style.display = "flex";
        document.getElementById("namePanel").style.display = "block";
        return;
    }
    try {
        const data = JSON.parse(json);
        Object.assign(player, data.player);
        
        inventory.length = 0;
        data.inventory.forEach(item => { if (!item.count) item.count = 1; inventory.push(item); });

        // ✨ 修正：正確讀取倉庫存檔 (包含物品與金錢)
        stash.items = [];
        stash.gold = 0;
        if (data.stash) {
            if (data.stash.items) {
                data.stash.items.forEach(item => { if (!item.count) item.count = 1; stash.items.push(item); });
            }
            stash.gold = data.stash.gold || 0;
        }

        Object.assign(gameState, data.gameState);
        Object.assign(stats, data.stats);
        
        if (!gameState.logs) gameState.logs = [];
        
        gameState.isProcessingTurn = false;
        gameState.canAct = true;
        gameState.cooldownTimerId = null;

        // 商人防呆
        if (gameState.mode === 'merchant' && (!gameState.merchantGoods || gameState.merchantGoods.length === 0)) {
            gameState.mode = 'town';
            gameState.merchantActive = false;
        }
        // 戰鬥防呆
        if (gameState.mode === 'battle' && !gameState.enemy) {
            gameState.mode = 'town';
            gameState.inBattle = false;
        }
        // 正常模式防呆
        if (gameState.mode === 'town') {
            gameState.inBattle = false;
            gameState.enemy = null;
            gameState.merchantActive = false;
        }

        if (!player.alive) { handlePlayerDeath("歷史紀錄 (已死亡)", true); return; }
        
        UI.updateStatus(); UI.updateInventory(); UI.updateStash();
        document.getElementById("overlay").style.display = "none";
        UI.addLog(`歡迎回來，${player.name}。繼續你的第 ${player.day} 天冒險。`, "log-system");
        
        // 🚀 修正：只呼叫 renderMainScreen，它會自己判斷要不要顯示按鈕
        UI.renderMainScreen();
        
    } catch (e) { console.error("存檔損壞", e); document.getElementById("overlay").style.display = "flex"; }
}

export function hardReset() {
    if (confirm("確定要刪除所有進度並重新開始嗎？")) {
        localStorage.removeItem('LegendSurvival_Save');
        location.reload();
    }
}

// ================== 基礎與經驗 ==================
export function addAttr(type) {
    if (player.attrPoints <= 0) return;
    if (type === "str") player.str++; if (type === "agi") player.agi++;
    if (type === "con") player.con++; if (type === "int") player.int++;
    player.attrPoints--; UI.updateStatus(); autoSave();
}

export function advanceDay() { 
    player.day++; 
    UI.updateStatus();
    // Boss 事件範例 (目前先註解掉或保留皆可，看你是否想測試)
    // if (player.day === 10) { queueBossBattle("boss_orc", "🛑 遠處傳來沉重的腳步聲...半獸人隊長找上門了！"); } 
    // else if (player.day === 20) { queueBossBattle("boss_dragon", "🛑 天空變暗，巨大的陰影籠罩大地...遠古巨龍降臨！"); }
    autoSave();
}

function queueBossBattle(bossId, warningMsg) {
    UI.addLog(warningMsg, "log-critical");
    const checkAndStart = () => {
        if (gameState.inBattle || gameState.isProcessingTurn || gameState.mode === 'merchant') {
            setTimeout(checkAndStart, 1500);
        } else { startBossBattle(bossId); }
    };
    setTimeout(checkAndStart, 2000);
}

export function addExp(amount) {
    player.exp += amount;
    while (player.exp >= player.expToLevel) { player.exp -= player.expToLevel; levelUp(); }
    UI.updateStatus();
}
function levelUp() {
    player.level++; player.attrPoints += 5; player.hp = player.maxHP; player.mp = player.maxMP;
    UI.addLog(`⬆️ 你升級了！現在是 Lv ${player.level}。`, "log-system");

    // === 新增：升級時自動學習技能 ===
    SKILLS.forEach(skill => {
        // 檢查 職業符合、等級達到、且尚未學過
        if (skill.job === player.job && player.level >= skill.minLvl && !player.learnedSkills.includes(skill.id)) {
            player.learnedSkills.push(skill.id);
            // 預設自動裝備到前幾個技能欄 (如果需要)
            if (player.equippedSkills.length < 4) { // 假設最多裝備4個技能
                player.equippedSkills.push(skill.id);
            }
            UI.addLog(`💡 你學會了新技能：${skill.name}！`, "log-system");
        }
    });
    autoSave();
}
export function toggleInventory() { }


// ================== 物品與倉庫系統 (完整補上) ==================
export function addToInventory(newItem) {
    let amountToAdd = newItem.count || 1;

    // 1. For stackable items, try to add to existing stacks first.
    if (newItem.stackable) {
        // Find the definition of the item to get its maxStack.
        // This is a bit inefficient to do every time, but robust.
        let itemDef = CONSUMABLES.find(c => c.id === newItem.id);
        
        // Handle materials which are not in CONSUMABLES but are stackable.
        if (!itemDef && newItem.id === 'mat_common') {
            itemDef = { maxStack: 20 }; // Default stack for common materials.
        }
        
        const maxStack = itemDef ? itemDef.maxStack : 1; // Default to 1 if no definition found.

        // First pass: Fill up existing, non-full stacks.
        for (const existingItem of inventory) {
            if (amountToAdd <= 0) break; // Stop if we've added all items.
            if (existingItem.id === newItem.id && existingItem.count < maxStack) {
                const spaceLeft = maxStack - existingItem.count;
                const canAdd = Math.min(amountToAdd, spaceLeft);
                
                existingItem.count += canAdd;
                amountToAdd -= canAdd;
            }
        }

        // Second pass: Use new slots if there are remaining items.
        while (amountToAdd > 0) {
            if (inventory.length >= player.inventoryMaxSlots) {
                UI.addLog("🎒 背包已滿！無法再放入更多物品。", "log-system");
                return; // Inventory is full.
            }

            const amountForNewStack = Math.min(amountToAdd, maxStack);
            
            // Create a new item stack.
            inventory.push({
                ...newItem,
                count: amountForNewStack
            });
            
            amountToAdd -= amountForNewStack;
        }

    } else { // 2. For non-stackable items (like equipment).
        if (inventory.length >= player.inventoryMaxSlots) {
            UI.addLog("🎒 背包已滿！無法放入新物品。", "log-system");
            return; // Inventory is full.
        }
        // Non-stackable items always take a new slot.
        inventory.push({ ...newItem, count: 1 });
    }
}

// ✨ 補上遺失的 moveToStash ✨
export function moveToStash(index) {
    // ✨ 修正：在城鎮商人介面也可以存取倉庫
    if (gameState.inBattle || (gameState.mode !== 'town' && gameState.mode !== 'merchant')) {
        UI.addLog("現在無法存取倉庫！", "log-system");
        return;
    }
    const item = inventory[index];
    if (!item) return;

    // 處理物品堆疊
    if (item.stackable) {
        const existing = stash.items.find(i => i.id === item.id);
        if (existing) {
            if (!existing.count) existing.count = 1;
            existing.count++;
            if (item.count > 1) item.count--;
            else inventory.splice(index, 1);
        } else {
            if (item.count > 1) {
                item.count--;
                stash.items.push({ ...item, count: 1 });
            } else {
                inventory.splice(index, 1);
                stash.items.push(item);
            }
        }
    } else {
        // 不可堆疊 (如裝備) 直接移動
        inventory.splice(index, 1);
        stash.items.push(item);
    }

    UI.updateInventory();
    UI.updateStash();
    autoSave();
}

// ✨ 補上遺失的 takeFromStash ✨
export function takeFromStash(index) {
    // ✨ 修正：在城鎮商人介面也可以存取倉庫
    if (gameState.inBattle || (gameState.mode !== 'town' && gameState.mode !== 'merchant')) {
        UI.addLog("現在無法存取倉庫！", "log-system");
        return;
    }
    const item = stash.items[index];
    if (!item) return;

    // 取出一個放入背包
    addToInventory({ ...item, count: 1 });

    // 倉庫扣除
    if (item.count > 1) {
        item.count--;
    } else {
        stash.items.splice(index, 1);
    }

    UI.updateInventory();
    UI.updateStash();
    autoSave();
}

// ✨ 新增：存入金錢
export function depositGold() {
    const amountStr = prompt("要存入多少金錢？ (可輸入 all)", "");
    if (amountStr === null) return; // 玩家取消

    let amount = (amountStr.toLowerCase() === 'all') ? player.gold : parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > player.gold) { UI.addLog("你沒有那麼多錢！", "log-system"); return; }

    player.gold -= amount;
    stash.gold += amount;
    UI.addLog(`你將 ${amount} G 存入了倉庫。`, "log-system");
    UI.updateInventory();
    UI.updateStash();
    autoSave();
}

// ✨ 新增：取出金錢
export function withdrawGold() {
    const amountStr = prompt("要取出多少金錢？ (可輸入 all)", "");
    if (amountStr === null) return;

    let amount = (amountStr.toLowerCase() === 'all') ? stash.gold : parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > stash.gold) { UI.addLog("倉庫裡沒有那麼多錢！", "log-system"); return; }

    stash.gold -= amount;
    player.gold += amount;
    UI.addLog(`你從倉庫取出了 ${amount} G。`, "log-system");
    UI.updateInventory();
    UI.updateStash();
    autoSave();
}

function generateRandomEquipment(level) { const minL = 1; const maxL = level + 2; let candidates = EQUIP_TEMPLATES.filter(e => e.minLvl <= maxL); if (candidates.length === 0) candidates = [EQUIP_TEMPLATES[0]]; const template = candidates[Math.floor(Math.random() * candidates.length)]; let quality = ITEM_PREFIXES[1]; const roll = Math.random(); if (roll < 0.2) quality = ITEM_PREFIXES[0]; else if (roll < 0.7) quality = ITEM_PREFIXES[1]; else if (roll < 0.85) quality = ITEM_PREFIXES[2]; else if (roll < 0.95) quality = ITEM_PREFIXES[3]; else if (roll < 0.99) quality = ITEM_PREFIXES[4]; else quality = ITEM_PREFIXES[5]; let stats = {}; if(template.baseAtk) stats.atk = Math.floor(template.baseAtk * quality.mod); if(template.baseDef) stats.def = Math.floor(template.baseDef * quality.mod); if(template.magicAtk) stats.magicAtk = Math.floor(template.magicAtk * quality.mod); if(template.str) stats.str = Math.ceil(template.str * quality.mod); if(template.int) stats.int = Math.ceil(template.int * quality.mod); if(template.agi) stats.agi = Math.ceil(template.agi * quality.mod); if(template.con) stats.con = Math.ceil(template.con * quality.mod); if(template.hp) stats.hp = Math.floor(template.hp * quality.mod); if(template.mp) stats.mp = Math.floor(template.mp * quality.mod); const sellPrice = Math.max(1, Math.floor((template.minLvl * 10 + 5) * quality.mod)); const buyPrice = sellPrice * 3; return { name: quality.name + template.name, emoji: template.emoji, type: "equip", slot: template.type, stats: stats, sellPrice: sellPrice, price: buyPrice, usable: false, stackable: false }; }

// ✨ 新增：通用的權重隨機物品選擇器
function getWeightedRandomItem(items) {
    const validItems = items.filter(item => item && item.chance > 0);
    if (validItems.length === 0) return null;

    const totalWeight = validItems.reduce((sum, item) => sum + (item.chance || 0), 0);
    if (totalWeight <= 0) return validItems[Math.floor(Math.random() * validItems.length)]; // 如果權重都是0，就隨機選一個

    let random = Math.random() * totalWeight;
    for (const item of validItems) {
        random -= item.chance;
        if (random <= 0) {
            return item;
        }
    }
    return validItems[validItems.length - 1]; // 備用，防止浮點數誤差
}

function lootRandomItem(type) {
    if (type === "food") { 
        const foodItems = CONSUMABLES.filter(c => c.id.includes("food_"));
        const chosenItem = getWeightedRandomItem(foodItems);
        if (chosenItem) {
            const item = { ...chosenItem };
            item.sellPrice = Math.floor(item.price / 2);
            addToInventory(item);
            UI.addLog(`🍱 你找到 ${item.name}，已放入背包。`, "log-system");
        }
    } else if (type === "treasure") {
        if (Math.random() < 0.6) { // 60% 機率獲得消耗品
            const chosenItem = getWeightedRandomItem(CONSUMABLES);
            if (chosenItem) {
                const item = { ...chosenItem };
                item.sellPrice = Math.floor(item.price / 2);
                addToInventory(item);
                UI.addLog(`✨ 你找到 ${item.name}！`, "log-system");
            }
        } else { // 40% 機率獲得素材
            const mat = { id: "mat_common", name: "普通素材", emoji: "🧩", type: "material", usable: false, sellPrice: 10, stackable: true };
            addToInventory(mat);
            UI.addLog("🧩 你撿到一些普通素材。", "log-system");
        }
    } else if (type === "material") {
        const mat = { id: "mat_common", name: "普通素材", emoji: "🧩", type: "material", usable: false, sellPrice: 5, stackable: true };
        addToInventory(mat);
        UI.addLog("🧩 你撿到一些普通素材。", "log-system");
    }
    UI.updateInventory();
    autoSave();
}
export function equipItem(index) { const item = inventory[index]; if (!item || item.type !== "equip") return; const slot = item.slot; const currentEquip = player.equipment[slot]; if (currentEquip) addToInventory(currentEquip); player.equipment[slot] = item; inventory.splice(index, 1); UI.addLog(`你裝備了 ${item.name}。`); UI.updateStatus(); UI.updateInventory(); autoSave(); }
export function unequipItem(slot) { const item = player.equipment[slot]; if (!item) return; player.equipment[slot] = null; addToInventory(item); UI.addLog(`你卸下了 ${item.name}。`); UI.updateStatus(); UI.updateInventory(); autoSave(); }
export function useItem(i) { 
    const item = inventory[i]; 
    if (!item || !item.usable) return;

    if (item.type === "equip") { 
        equipItem(i); 
        return; 
    } 

    if (item.type === "consumable" && item.effects) {
        let effectApplied = false;
        let logMessages = [];

        for (const effect of item.effects) {
            const { target, value } = effect;
            
            // ✨ 修正：正確對應最大值屬性名稱
            let maxTargetProp;
            if (target === 'hp') maxTargetProp = 'maxHP';
            else if (target === 'mp') maxTargetProp = 'maxMP';
            else if (target === 'hunger') maxTargetProp = 'hungerMax';
            
            const targetMax = player[maxTargetProp];

            // 如果找不到對應的最大值，或目前值已滿，則跳過
            if (targetMax === undefined || player[target] >= targetMax) {
                // 如果是單一效果且已滿，則提示並中止
                if (item.effects.length === 1) {
                    const targetName = { hp: "HP", mp: "MP", hunger: "飢餓" }[target] || target;
                    UI.addLog(`${targetName} 已經滿了。`, "log-system");
                    return;
                }
                continue;
            }
            
            player[target] = Math.min(targetMax, player[target] + value);
            const targetName = { hp: "HP", mp: "MP", hunger: "飢餓" }[target] || target;
            logMessages.push(`恢復 ${value} ${targetName}`);
            effectApplied = true;
        }

        if (effectApplied) {
            UI.addLog(`你使用了 ${item.name}：${logMessages.join("，")}。`, "log-system");
            if (item.count > 1) item.count--; else inventory.splice(i, 1);
            UI.updateStatus(); UI.updateInventory(); autoSave();
        }
    }
}
export function sellOneItem(i) { 
    if (!gameState.merchantActive) { UI.addLog("需在商人處才能出售。"); return; } 
    const item = inventory[i]; 
    // ✨ 修正：如果沒有賣價，則自動取買價的一半
    const sellValue = item.sellPrice || Math.floor(item.price / 2);
    if (!sellValue || sellValue <= 0) { UI.addLog(`${item.name} 無法出售。`, "log-system"); return; }

    player.gold += sellValue; 
    UI.addLog(`賣出 ${item.name} (+${sellValue} G)`, "log-system"); 
    if(item.count > 1) item.count--; else inventory.splice(i, 1); UI.updateStatus(); UI.updateInventory(); renderMerchantUI(); autoSave(); 
}
export function dropItem(i) { const item = inventory[i]; UI.addLog(`丟棄了 ${item.name}`, "log-system"); if(item.count > 1) item.count--; else inventory.splice(i, 1); UI.updateInventory(); autoSave(); }


// ================== 商人系統 ==================

function maybeMerchant(from) {
    if (gameState.inBattle || gameState.merchantActive) return false;
    let chance = from === "nearby" ? 0.05 : from === "dungeon" ? 0.1 : 0.08;
    if (Math.random() < chance) { openMerchant(); return true; }
    return false;
}

function renderMerchantUI(message = "") {
    if(message) UI.addLog(message, "log-system");
    UI.renderMainScreen();
}

function openMerchant() {
    gameState.merchantActive = true;
    gameState.mode = "merchant";
    const p1 = { ...CONSUMABLES[1] }; const p2 = { ...CONSUMABLES[3] }; const p3 = { ...CONSUMABLES[0] }; 
    const equip = generateRandomEquipment(player.level + 1);
    gameState.merchantGoods = [p1, p2, p3, equip];
    UI.addLog("遇到了流浪商人");
}

// ✨ 新增：開啟城鎮商人介面
export function openTownMerchant() {
    gameState.merchantActive = true;
    gameState.mode = "merchant";
    gameState.isTownMerchant = true; // ✨ 標記為城鎮商人
    
    // ✨ 建立一個基礎商品列表
    let goods = [
        { ...CONSUMABLES.find(c => c.id === 'food_ration') },
        { ...CONSUMABLES.find(c => c.id === 'potion_heal_s') },
        { ...CONSUMABLES.find(c => c.id === 'potion_mana_s') },
        { ...EQUIP_TEMPLATES.find(e => e.id === 'w_dagger'), price: 45 },  // 生鏽短刀
        { ...EQUIP_TEMPLATES.find(e => e.id === 'b_shirt'), price: 60 },   // 布衣
    ];

    // ✨ 根據玩家等級解鎖更多商品
    if (player.level >= 3) {
        goods.push({ ...CONSUMABLES.find(c => c.id === 'food_ration_large') });
        goods.push({ ...EQUIP_TEMPLATES.find(e => e.id === 'w_sword'), price: 180 }); // 鐵劍
        goods.push({ ...EQUIP_TEMPLATES.find(e => e.id === 'b_leather'), price: 220 }); // 皮甲
    }
    if (player.level >= 5) {
        goods.push({ ...CONSUMABLES.find(c => c.id === 'potion_heal_m') });
        goods.push({ ...CONSUMABLES.find(c => c.id === 'potion_mana_m') });
        goods.push({ ...EQUIP_TEMPLATES.find(e => e.id === 'w_axe'), price: 450 }); // 雙刃斧
    }

    gameState.merchantGoods = goods;
    UI.addLog("你來到了城鎮的商店。");
    renderMerchantUI(); // 確保 UI 刷新
}

export function buyItem(index) {
    const item = gameState.merchantGoods[index];
    if (!item || typeof item.price !== 'number') return;
    if (player.gold < item.price) { UI.addLog(`金錢不足，你需要 ${item.price} G`, "log-system"); return; }
    player.gold -= item.price; 
    addToInventory({ ...item });
    UI.updateStatus(); UI.updateInventory(); UI.addLog(`購買了 ${item.name}`, "log-system");
    renderMerchantUI(`感謝購買！已獲得 ${item.name}。`); autoSave();
}

export function sellAllMaterials() {
    let total = 0;
    for(let i = inventory.length - 1; i >= 0; i--){
        if (inventory[i].type === "material" && inventory[i].sellPrice) {
            total += inventory[i].sellPrice; inventory.splice(i, 1);
        }
    }
    if (total > 0) { player.gold += total; UI.updateStatus(); UI.updateInventory(); UI.addLog(`出售素材獲得 ${total} G`, "log-system"); autoSave(); } 
    else { UI.addLog("沒有素材可賣", "log-system"); }
}

export function closeMerchant() { // 👈 確保這裡有 export
    gameState.merchantActive = false; 
    gameState.merchantGoods = []; 
    gameState.isTownMerchant = false; // ✨ 清除城鎮商人標記
    gameState.mode = gameState.currentZone ? "explore" : "town"; // ✨ 修正：如果正在探索，則回到探索模式
    UI.addLog("結束交易"); 
    UI.updateInventory(); 
    UI.renderMainScreen(); // ✨ 修正：呼叫主渲染函式來更新畫面與按鈕
}

// ================== 探索與戰鬥系統 ==================
function startCooldown(seconds) {
    if (seconds <= 0) { gameState.canAct = true; UI.renderMainScreen(); return; }
    gameState.canAct = false;
    if (gameState.cooldownTimerId) clearInterval(gameState.cooldownTimerId);
    let t = seconds; UI.updateCooldownButtons(t);
    gameState.cooldownTimerId = setInterval(() => {
        t--; if (t <= 0) { clearInterval(gameState.cooldownTimerId); gameState.cooldownTimerId = null; gameState.canAct = true; if (!gameState.merchantActive) UI.renderMainScreen(); } else { UI.updateCooldownButtons(t); }
    }, 1000);
}

function canDoExplore(costHunger) {
    if (!player.alive || !gameState.canAct || gameState.inBattle || gameState.merchantActive) return false;
    
    let failed = false;
    if (player.hunger <= 0) { player.hp -= 15; UI.addLog("⚠️ 肚子餓扁了還強行探索... HP -15", "log-critical"); failed = true; } else { player.hunger = Math.max(0, player.hunger - costHunger); }
    
    if (failed) {
        gameState.enemy = { name: "身體極限", emoji: "😫", hp: player.hp, maxHp: player.maxHP, atk: 0 };
        UI.renderMainScreen();
        if (player.hp <= 0) { handlePlayerDeath("在飢餓與過勞中倒下"); return false; }
    }
    if (player.state === "中毒") {
        player.hp -= 5; UI.addLog("中毒發作，你損失 5 HP。", "log-battle");
        if (player.hp <= 0) { handlePlayerDeath("中毒而亡"); return false; }
    }
    UI.updateStatus(); return true;
}

// ✨ 3. 新增：事件效果處理器
function handleEventEffect(event) {
    UI.addLog(`➡️ ${event.desc}`, "log-system");
    if (!event.effects || event.effects.length === 0) return;

    event.effects.forEach(effect => {
        if (effect.target === 'hp') {
            player.hp = Math.max(0, Math.min(player.maxHP, player.hp + effect.value));
        } else if (effect.target === 'mp') {
            player.mp = Math.max(0, Math.min(player.maxMP, player.mp + effect.value));
        } else if (effect.target === 'hunger') {
            player.hunger = Math.max(0, Math.min(player.hungerMax, player.hunger + effect.value));
        } else if (effect.target === 'state') {
            player.state = effect.value;
        }
        // 未來可以擴充更多效果，如獲得物品、金錢等

        if (effect.message) {
            UI.addLog(effect.message, "log-system");
        }
    });
    UI.updateStatus();
}

function triggerEvent(explorationType) {
    const zone = gameState.currentZone;
    const depth = gameState.depth;
    UI.addLog(`你繼續深入... (第 ${depth} 層)`);

    // ✨ 2. 全面重構 triggerEvent 邏輯
    const possibleEvents = [
        // 基礎事件
        { id: 'base_combat', name: '遭遇敵人', type: 'combat', chance: 50, zones: ['nearby', 'dungeon', 'expedition'] },
        { id: 'base_loot_food', name: '找到食物', type: 'loot', lootType: 'food', chance: 20, zones: ['nearby', 'expedition'] },
        { id: 'base_loot_material', name: '找到素材', type: 'loot', lootType: 'material', chance: 30, zones: ['nearby'] },
        { id: 'base_loot_treasure', name: '發現寶藏', type: 'loot', lootType: 'treasure', chance: 25, zones: ['dungeon', 'expedition'] },
        { id: 'base_merchant', name: '遇到商人', type: 'merchant', chance: 5, zones: ['nearby', 'dungeon', 'expedition'] },
        { id: 'base_find_exit', name: '發現出口', type: 'exit', chance: 5, zones: ['dungeon', 'expedition'], condition: () => !gameState.canSafelyRetreat },
        // 從 events.js 導入的自定義事件
        ...EVENTS
    ];

    // 篩選出當前區域可發生的事件
    let validEvents = possibleEvents.filter(e => e.zones.includes(zone) && (!e.condition || e.condition()));

    // ✨ 根據探索類型，動態調整事件權重
    validEvents = validEvents.map(event => {
        const newEvent = { ...event };
        if (explorationType === 'cautious') { // 小心探索
            if (newEvent.type === 'combat') newEvent.chance *= 0.5; // 戰鬥機率減半
            if (newEvent.lootType === 'material') newEvent.chance *= 1.5; // 素材機率提升
        } else if (explorationType === 'deep') { // 深入探索
            if (newEvent.type === 'combat') newEvent.chance *= 1.5; // 戰鬥機率提升
            if (newEvent.lootType === 'treasure') newEvent.chance *= 2.0; // 寶藏機率加倍
        } else if (explorationType === 'search_exit') { // 尋找出口
            if (newEvent.type === 'exit') newEvent.chance *= 5; // 出口機率 x5
        }
        return newEvent;
    });

    const chosenEvent = getWeightedRandomItem(validEvents);

    if (!chosenEvent) { UI.addLog("什麼也沒發生...", "log-system"); return; }

    // 根據事件類型執行動作
    if (chosenEvent.type === 'combat') startBattle(zone, depth);
    else if (chosenEvent.type === 'loot') lootRandomItem(chosenEvent.lootType);
    else if (chosenEvent.type === 'merchant') maybeMerchant(zone);
    else if (chosenEvent.type === 'exit') {
        gameState.canSafelyRetreat = true;
        UI.addLog("✨ 你發現了一個隱蔽的出口或傳送陣！現在可以安全撤離了。", "log-system");
    } else {
        // 處理來自 events.js 的自定義事件
        handleEventEffect(chosenEvent);
    }
}

export function startExpedition(zoneId) {
    if (!canDoExplore(1)) return; // 出發時只檢查，不扣太多
    const zoneName = { nearby: "附近", dungeon: "地下城", expedition: "遠征" }[zoneId] || "未知區域";
    
    gameState.mode = "explore";
    gameState.currentZone = zoneId;
    gameState.depth = 1;
    
    // ✨ 核心改造：根據區域設定初始撤離狀態
    if (zoneId === 'nearby') {
        gameState.canSafelyRetreat = true; // 附近可隨時安全撤離
    } else {
        gameState.canSafelyRetreat = false; // 地下城和遠征需要找到出口
    }

    UI.addLog(`你出發前往 ${zoneName} 進行探索。`, "log-system");
    UI.renderMainScreen();
    advanceDay(); // 每次出發都算一天
    autoSave();
}

export function advanceExploration(explorationType = 'default') {
    if (gameState.mode !== 'explore' || !canDoExplore(5 + gameState.depth)) return; // 越深越餓
    
    gameState.depth++;
    stats.exploredNearby++; // 暫時先統一加到一個統計
    triggerEvent(explorationType);
    autoSave();
}

export function retreatToTown() {
    gameState.mode = "town";
    gameState.currentZone = null;
    gameState.canSafelyRetreat = false;
    gameState.depth = 0;

    // ✨ 新增：回到城鎮時，完全恢復 HP 和 MP
    player.hp = player.maxHP;
    player.mp = player.maxMP;

    UI.addLog("你安全地回到了城鎮。HP與MP已完全恢復。", "log-system");
    UI.updateStatus(); // 更新狀態以顯示恢復後的血魔
    UI.renderMainScreen();
    autoSave();
}

// ✨ 新增：強制撤離函式 (帶懲罰)
export function forceRetreat() {
    if (gameState.mode !== 'explore') return;

    UI.addLog("你決定不顧一切地強制撤離...", "log-critical");

    // 懲罰計算
    // ✨ 改造：金錢損失改為 30% ~ 50% 的隨機浮動
    const goldLossPercent = 0.3 + Math.random() * 0.2; // 0.3 to 0.5
    const lostGold = Math.floor(player.gold * goldLossPercent);
    player.gold -= lostGold;
    UI.addLog(`💸 慌亂中，你遺失了 ${lostGold} G。`, "log-system");

    // ✨ 改造：每個物品欄位都有 50% ~ 60% 的獨立機率遺失
    let lostItemsLog = [];
    for (let i = inventory.length - 1; i >= 0; i--) {
        const dropChance = 0.5 + Math.random() * 0.1; // 50% to 60% chance
        if (Math.random() < dropChance) {
            const lostItem = inventory.splice(i, 1)[0];
            lostItemsLog.push(`${lostItem.name} x${lostItem.count || 1}`);
        }
    }

    if (lostItemsLog.length > 0) {
        UI.addLog(`🎒 為了逃跑，你丟棄了：${lostItemsLog.reverse().join("、 ")}。`, "log-system");
    }

    // 10% 機率完美撤退 (範例)
    if (Math.random() < 0.1) {
        UI.addLog("✨ 奇蹟發生了！你在混亂中毫髮無傷地逃脫了！(免除懲罰)", "log-system");
        // (如果在這裡免除懲罰，需要把上面扣錢扣物的邏輯包在 else 裡)
    }

    retreatToTown(); // 最後呼叫安全回城函式來重置狀態
}

function startBossBattle(bossId) {
    gameState.mode = "battle";
    gameState.inBattle = true;
    gameState.isProcessingTurn = false;
    gameState.battleLog = []; 

    const template = ENEMIES.find(e => e.id === bossId);
    if (!template) return;

    const finalLvl = Math.max(template.minLvl, player.level);

    gameState.enemy = {
        id: template.id,
        name: template.name,
        emoji: template.emoji,
        lvl: finalLvl,
        hp: Math.floor(template.baseHp * (1 + (finalLvl - template.minLvl) * 0.2)),
        maxHp: Math.floor(template.baseHp * (1 + (finalLvl - template.minLvl) * 0.2)),
        atk: Math.floor(template.baseAtk * (1 + (finalLvl - template.minLvl) * 0.15)),
        def: Math.floor(template.baseDef + (finalLvl - template.minLvl) * 1),
        exp: template.exp,
        dropRate: 1.0,
        dodge: 0,
        speed: template.speed || 10,
        killChance: template.killChance !== undefined ? template.killChance : 1.0,
        isBoss: true 
    };

    UI.addBattleLog(`⚠️ 警告：${gameState.enemy.name} 出現了！`, "log-critical");
    UI.renderMainScreen();
}

function startBattle(zone, difficulty = 1) {
    gameState.mode = "battle";
    gameState.inBattle = true;
    gameState.isProcessingTurn = false;
    gameState.battleLog = [];

    const minTarget = Math.max(1, player.level - 2);
    const maxTarget = player.level + 2;
    let candidates = ENEMIES.filter(e => e.zone === zone && e.minLvl <= maxTarget);
    if (candidates.length === 0) { candidates = ENEMIES.filter(e => e.zone === zone); if (candidates.length === 0) candidates = [ENEMIES[0]]; }
    const template = candidates[Math.floor(Math.random() * candidates.length)];
    const diffMod = 1 + (difficulty * 0.2); 
    const finalLvl = Math.max(template.minLvl, player.level);

    gameState.enemy = {
        name: template.name,
        emoji: template.emoji || "👾",
        lvl: finalLvl,
        hp: Math.floor(template.baseHp * (1 + (finalLvl - template.minLvl) * 0.2) * diffMod),
        maxHp: Math.floor(template.baseHp * (1 + (finalLvl - template.minLvl) * 0.2) * diffMod),
        atk: Math.floor(template.baseAtk * (1 + (finalLvl - template.minLvl) * 0.15) * diffMod),
        def: Math.floor(template.baseDef + (finalLvl - template.minLvl) * 1),
        exp: Math.floor(template.exp * (1 + (finalLvl - template.minLvl) * 0.1)),
        dropRate: template.dropRate || 0.1,
        dodge: template.dodge || 0,
        speed: 10 + finalLvl,
        killChance: template.killChance !== undefined ? template.killChance : 0.1 
    };

    UI.addBattleLog(`遭遇敵人：${gameState.enemy.name} (Lv.${gameState.enemy.lvl})`, "log-battle");
    UI.renderMainScreen();
}

export async function handleCombat(action, skillId = null) {
    if (!gameState.inBattle || !player.alive || gameState.isProcessingTurn) return;
    if (action === 'run') { runAway(); return; }

    let playerSpeed = player.speed;
    let speedMod = 0;
    let cost = 0;

    if (action === 'skill' && skillId) {
        const skill = SKILLS.find(s => s.id === skillId);
        if (!skill) return;
        if (player.mp < skill.cost) { UI.addLog("MP 不足！無法施放技能。", "log-system"); return; }
        cost = skill.cost; speedMod = skill.speedMod || 0;
    }

    gameState.isProcessingTurn = true; 
    UI.renderMainScreen(); 

    let finalPlayerSpeed = playerSpeed + speedMod + Math.random() * 2;
    let enemySpeed = gameState.enemy.speed + Math.random() * 2;
    const playerGoesFirst = finalPlayerSpeed >= enemySpeed;

    if (playerGoesFirst) {
        UI.addLog(`⚡ 你動作較快！`, "log-system");
        const enemyDied = await doPlayerMove(action, skillId);
        if (!enemyDied && gameState.inBattle) {
            await wait(600);
            await doEnemyMove();
        }
    } else {
        UI.addLog(`🐢 敵人動作較快！`, "log-system");
        const playerDied = await doEnemyMove();
        if (!playerDied && gameState.inBattle) {
            await wait(600);
            await doPlayerMove(action, skillId);
        }
    }

    if (gameState.inBattle && player.alive && gameState.enemy) {
        gameState.isProcessingTurn = false;
        UI.renderMainScreen();
    }
}

async function doPlayerMove(action, skillId) {
    if (!gameState.inBattle || !player.alive) return false;
    const enemy = gameState.enemy;

    let enemyDodge = (enemy.dodge || 0) + (enemy.lvl * 0.5);
    let hitChance = (player.hitRate + 10) - enemyDodge;

    if (action === 'skill' && skillId) {
        const skill = SKILLS.find(s => s.id === skillId);
        player.mp -= skill.cost; UI.updateStatus(); 
    }

    if (Math.random() * 100 > hitChance) {
        UI.addLog(`❌ 你的攻擊未命中！`, "log-battle"); 
        UI.triggerShake(); 
        return false;
    }

    let skill = null;
    if (action === 'skill' && skillId) {
        skill = SKILLS.find(s => s.id === skillId);
    }

    let hits = (skill && skill.hits) ? skill.hits : 1;
    
    for (let i = 0; i < hits; i++) {
        if (enemy.hp <= 0) break;

        let isMagic = false;
        if (skill && skill.type === "magic") isMagic = true;
        else if (player.job === "法師" && !skill) isMagic = true;

        let baseDmg = isMagic ? player.magicAtk : player.atk;
        let multiplier = skill ? skill.dmgScale : 1.0;
        let dmg = 0;

        if (isMagic) dmg = baseDmg * multiplier; 
        else dmg = Math.max(1, (baseDmg * multiplier) - enemy.def);

        let crit = false; 
        let critChance = player.critChance + (skill ? (skill.critBonus || 0) : 0);
        if (Math.random() * 100 < critChance) { 
            dmg = Math.floor(dmg * 1.5); 
            crit = true; 
        }
        dmg = Math.floor(dmg * (0.9 + Math.random() * 0.2));
        if (dmg < 1) dmg = 1;
        
        enemy.hp -= dmg; 
        if (enemy.hp < 0) enemy.hp = 0;

        let actionName = skill ? skill.name : "攻擊";
        let msg = `🗡️ ${actionName} 命中！造成 ${dmg} 傷害。`;
        if (crit) msg = `💥 暴擊！${actionName} 造成 ${dmg} 傷害！`;
        
        UI.addBattleLog(msg, crit ? "log-critical" : "log-battle"); 
        UI.triggerShake();

        if (i < hits - 1) await wait(300);
    }

    UI.addBattleLog(`(${enemy.name} 剩餘 ${enemy.hp} HP)`, "log-system");

    if (enemy.hp <= 0) { 
        await wait(300);
        winBattle(); 
        return true; 
    }
    return false; 
}

async function doEnemyMove() {
    if (!gameState.inBattle || !player.alive || !gameState.enemy || gameState.enemy.hp <= 0) return false;
    const enemy = gameState.enemy;

    if (Math.random() * 100 < player.dodge) {
        UI.addLog(`💨 你閃避了 ${enemy.name} 的攻擊！`, "log-battle");
    } else {
        let dmg = Math.max(1, enemy.atk - player.def);
        dmg = Math.floor(dmg * (0.8 + Math.random() * 0.4));
        player.hp -= dmg;
        let displayHp = Math.max(0, Math.floor(player.hp));
        UI.addLog(`${enemy.name} 對你造成 ${dmg} 傷害。(${player.name} 剩 ${displayHp} HP)`, "log-battle");
        UI.triggerShake();
    }
    UI.updateStatus();

    if (player.hp <= 0) {
        player.hp = 0;
        await wait(300);
        handlePlayerDeath("戰鬥中陣亡");
        return true; 
    }
    return false; 
}

export async function runAway() {
    if (!gameState.inBattle || !player.alive || gameState.isProcessingTurn) return;
    
    if (gameState.enemy && gameState.enemy.isBoss) {
        UI.addLog("🚫 這是 Boss 戰，無法逃跑！", "log-critical");
        return;
    }

    gameState.isProcessingTurn = true;
    UI.renderMainScreen();

    let escapeChance = 50 + (player.speed * 2); 
    if (Math.random() * 100 < escapeChance) {
        // ✨ 修正：逃跑成功後，應該回到探索模式，而不是直接回城
        gameState.inBattle = false; 
        gameState.mode = gameState.currentZone ? "explore" : "town"; // 如果有 zone 記錄，就回到 explore
        gameState.enemy = null; 
        UI.addLog("🏃‍♂️ 你成功脫離了戰鬥。", "log-battle");
        gameState.isProcessingTurn = false; 
        UI.renderMainScreen(); 
        autoSave();
    } else {
        UI.addLog("🚫 逃跑失敗！被敵人抓住了！", "log-critical");
        await wait(600);
        await doEnemyMove();
        gameState.isProcessingTurn = false; 
        UI.renderMainScreen();
    }
}

function winBattle() {
    const enemy = gameState.enemy;
    if (!enemy || !gameState.inBattle) return;

    if (enemy.id === "boss_dragon") { gameClear(); return; }

    // ✨ 修正：戰鬥勝利後，應該回到探索模式或城鎮模式
    gameState.inBattle = false; 
    gameState.mode = gameState.currentZone ? "explore" : "town"; gameState.enemy = null; gameState.isProcessingTurn = false;
    UI.addLog(`🎉 擊敗了 ${enemy.name}！`, "log-battle");
    addExp(enemy.exp || 10); stats.kills++;
    const goldGain = 5 + Math.floor(Math.random() * 11) + (enemy.lvl * 2);
    player.gold += goldGain; UI.addLog(`獲得 ${goldGain} G`, "log-system");
    
    const baseDrop = enemy.dropRate || 0.1;
    const dropChance = baseDrop + (player.int * 0.01);
    if (Math.random() < dropChance) {
        if (Math.random() < 0.8) {
            const newItem = generateRandomEquipment(enemy.lvl); 
            inventory.push(newItem); 
            UI.addLog(`🎁 掉落裝備：${newItem.name}`, "log-system");
        } else { lootRandomItem("treasure"); }
        UI.updateInventory();
    }
    UI.updateStatus(); UI.renderMainScreen(); autoSave();
}

function gameClear() {
    gameState.inBattle = false; gameState.mode = "town"; gameState.enemy = null; gameState.isProcessingTurn = false;
    document.getElementById("eventBox").innerHTML = `<div style="text-align:center; padding: 20px;"><div style="font-size: 80px;">🏆</div><h2 style="color: #f1c40f;">恭喜通關！</h2><p>你擊敗了遠古巨龍，成為了傳說中的英雄。</p><p>總天數：${player.day} 天</p><p>等級：Lv ${player.level}</p><div style="margin-top:30px; border:1px solid #444; padding:10px; border-radius:8px; background:#222;"><p style="color:#aaa; font-size:14px;">開發者筆記：<br>感謝遊玩！<br>你可以在這裡繼續冒險，或是按下方按鈕重新開始。</p></div></div>`;
    UI.addLog("🏆 恭喜！你完成了遊戲目標！", "log-system");
    UI.showMainActions();
    autoSave();
}

// ================== 核心修正：死亡處理函式 ==================
function handlePlayerDeath(reason, forceTrueDeath = false) {
    player.alive = false;
    player.hp = 0;
    UI.updateStatus();

    let killChance = 0.1;
    if (gameState.enemy && gameState.enemy.killChance !== undefined) {
        killChance = gameState.enemy.killChance;
    }

    let isTrueDeath = forceTrueDeath || (Math.random() < killChance);

    if (isTrueDeath) {
        UI.writeEvent("💀 你死亡了……");
        UI.addLog(`死因：${reason} (判定為永久死亡)`, "log-critical");
        document.getElementById("actions").innerHTML = "";
        
        const deathSummary = document.getElementById("deathSummary");
        let bagList = inventory.map(i => `${i.emoji}${i.name} x${i.count || 1}`).join("、") || "（無物品）";
        deathSummary.innerHTML = `<p>存活天數：${player.day} | 原因：${reason}</p><p>等級：Lv ${player.level} | 擊殺數：${stats.kills}</p><p>背包：${bagList}</p>`;
        
        document.getElementById("overlay").style.display = "flex";
        document.getElementById("deathPanel").style.display = "block";
        document.getElementById("defeatPanel").style.display = "none";
        document.getElementById("namePanel").style.display = "none";
        document.getElementById("jobPanel").style.display = "none";
        autoSave();
    } else {
        const defeatSummary = document.getElementById("defeatSummary");
        let lostItems = [];
        if (inventory.length > 0) {
            inventory.forEach(i => lostItems.push(i.name));
        }
        // ✨ 改造：金錢損失改為 60% ~ 80% 的隨機浮動
        const goldLossPercent = 0.6 + Math.random() * 0.2; // 0.6 to 0.8
        let lostGold = Math.floor(player.gold * goldLossPercent);
        
        let summaryHtml = `<p>死因：${reason}</p>`;
        summaryHtml += `<p style="color:#f1c40f">💸 損失金錢：${lostGold} G</p>`;
        if (lostItems.length > 0) {
            summaryHtml += `<p style="color:#e74c3c">🎒 遺失物品：${lostItems.join(", ")}</p>`;
        } else {
            summaryHtml += `<p>🎒 背包本來就是空的。</p>`;
        }
        
        defeatSummary.innerHTML = summaryHtml;

        inventory.length = 0;
        player.gold -= lostGold;
        player.hp = 1; 
        player.state = "重傷";
        
        gameState.inBattle = false;
        gameState.mode = "town";
        gameState.enemy = null;
        gameState.isProcessingTurn = false;

        document.getElementById("overlay").style.display = "flex";
        document.getElementById("defeatPanel").style.display = "block";
        document.getElementById("deathPanel").style.display = "none";
        document.getElementById("namePanel").style.display = "none";
        document.getElementById("jobPanel").style.display = "none";
        
        autoSave();
    }
}

export function confirmDefeat() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("defeatPanel").style.display = "none";
    
    player.alive = true;
    // ✨ 新增：在城鎮醒來時，完全恢復 HP 和 MP
    player.hp = player.maxHP;
    player.mp = player.maxMP;

    UI.addLog(`🤕 你在城鎮中醒來，雖然失去了物品，但至少還活著。`, "log-system");
    
    UI.updateStatus();
    UI.updateInventory();
    UI.updateStash();
    UI.renderMainScreen();
    autoSave();
}

export function confirmName() { const input = document.getElementById("nameInput"); player.name = input.value.trim() || "無名冒險者"; document.getElementById("namePanel").style.display = "none"; document.getElementById("jobPanel").style.display = "block"; }
export function chooseJob(jobKey) { 
    // 1. 重置玩家屬性與裝備
    player.str = 0; player.agi = 0; player.con = 0; player.int = 0; 
    player.equipment = { head: null, body: null, weapon: null, accessory: null }; 
    player.learnedSkills = []; 
    player.equippedSkills = []; 

    // 2. 根據職業設定初始值
    if (jobKey === "warrior") { 
        player.job = "戰士"; 
        player.str = 5; 
        player.con = 5; 
        player.learnedSkills.push("s_bash"); 
        player.equippedSkills.push("s_bash"); 
    } else if (jobKey === "archer") { 
        player.job = "弓箭手"; 
        player.agi = 6; 
        player.str = 2; 
        player.int = 2; 
        player.learnedSkills.push("s_double_shot"); 
        player.equippedSkills.push("s_double_shot"); 
    } else if (jobKey === "rogue") { 
        player.job = "盜賊"; 
        player.str = 3; 
        player.agi = 5; 
        player.int = 2; 
        player.learnedSkills.push("s_backstab"); 
        player.equippedSkills.push("s_backstab"); 
    } else if (jobKey === "mage") { 
        player.job = "法師"; 
        player.int = 8; 
        player.con = 1; 
        player.agi = 1; 
        player.learnedSkills.push("s_fireball"); 
        player.equippedSkills.push("s_fireball"); 
    } 
    
    // 3. 設定初始金錢與物品
    player.gold = 100; 
    stash.items = [];
    stash.gold = 0;
    stash.items.push({ ...CONSUMABLES[0], count: 3 });

    // 4. 更新 UI 並開始遊戲
    UI.updateInventory(); UI.updateStash();
    player.hp = player.maxHP; player.mp = player.maxMP; UI.updateStatus(); document.getElementById("overlay").style.display = "none"; UI.addLog(`冒險者 ${player.name} (${player.job}) 開始了旅程`, "log-system"); 
    UI.addLog(`獲得新手資助：100 G 與 3 個乾糧包 (已存入倉庫)`, "log-system");
    gameState.mode = "town"; gameState.canAct = true; UI.renderMainScreen(); autoSave(); 
}
export function restartGame() { resetGameData(); UI.updateInventory(); UI.updateStatus(); document.getElementById("eventBox").innerText = "請先輸入名字與選擇職業。"; document.getElementById("actions").innerHTML = ""; document.getElementById("deathPanel").style.display = "none"; document.getElementById("defeatPanel").style.display = "none"; document.getElementById("namePanel").style.display = "block"; document.getElementById("jobPanel").style.display = "none"; document.getElementById("overlay").style.display = "flex"; }