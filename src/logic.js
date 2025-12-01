import { player, gameState, stats, inventory, stash, COOLDOWNS, resetGameData } from './state.js';
import * as UI from './ui.js';
import { ENEMIES } from './data/enemies.js';
import { EVENTS } from './data/events.js'; // ✨ 1. 導入新的事件資料
import { EQUIP_TEMPLATES, ITEM_PREFIXES, CONSUMABLES } from './data/items.js';
import { MERCHANTS } from './data/merchants.js';
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

function gainExp(amount) {
    if (amount <= 0) return;
    UI.addLog(`--- 經驗結算：共獲得 ${amount} EXP ---`, "log-system");
    player.exp += amount;
    checkLevelUp();
    UI.updateStatus();
}

function checkLevelUp() {
    // 使用 while 迴圈處理一次獲得大量經驗值時的連續升級
    while (player.exp >= player.expToLevel) {
        player.exp -= player.expToLevel;
        player.level++;
        player.hp = player.maxHP;
        player.mp = player.maxMP;
        player.hungerMax += 10;
        player.hunger = player.hungerMax;
        UI.addLog(`⬆️ 你升級了！現在是 Lv ${player.level}。`, "log-system");

        // 升級時自動學習技能
        SKILLS.forEach(skill => {
            if (skill.job === player.job && player.level >= skill.minLvl && !player.learnedSkills.includes(skill.id)) {
                player.learnedSkills.push(skill.id);
                if (player.equippedSkills.length < 4) {
                    player.equippedSkills.push(skill.id);
                }
                UI.addLog(`💡 你學會了新技能：${skill.name}！`, "log-system");
            }
        });
    }
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

function generateRandomEquipment(level) { const minL = 1; const maxL = level + 2; let candidates = EQUIP_TEMPLATES.filter(e => e.minLvl <= maxL); if (candidates.length === 0) candidates = [EQUIP_TEMPLATES[0]]; const template = candidates[Math.floor(Math.random() * candidates.length)]; let quality = ITEM_PREFIXES[1]; const roll = Math.random(); if (roll < 0.2) quality = ITEM_PREFIXES[0]; else if (roll < 0.7) quality = ITEM_PREFIXES[1]; else if (roll < 0.85) quality = ITEM_PREFIXES[2]; else if (roll < 0.95) quality = ITEM_PREFIXES[3]; else if (roll < 0.99) quality = ITEM_PREFIXES[4]; else quality = ITEM_PREFIXES[5]; let stats = {}; if(template.baseAtk) stats.atk = Math.floor(template.baseAtk * quality.mod); if(template.baseDef) stats.def = Math.floor(template.baseDef * quality.mod); if(template.magicAtk) stats.magicAtk = Math.floor(template.magicAtk * quality.mod); if(template.str) stats.str = Math.ceil(template.str * quality.mod); if(template.int) stats.int = Math.ceil(template.int * quality.mod); if(template.agi) stats.agi = Math.ceil(template.agi * quality.mod); if(template.con) stats.con = Math.ceil(template.con * quality.mod); if(template.hp) stats.hp = Math.floor(template.hp * quality.mod); if(template.mp) stats.mp = Math.floor(template.mp * quality.mod); if(template.slots) stats.slots = template.slots; const buyPrice = Math.max(1, Math.floor((template.basePrice || 50) * quality.mod)); const sellPrice = Math.floor(buyPrice / 2); return { name: quality.name + template.name, emoji: template.emoji, type: "equip", slot: template.type, stats: stats, sellPrice: sellPrice, price: buyPrice, usable: true, stackable: false }; }

// ✨ 新增：通用的權重隨機物品選擇器
function getWeightedRandomItem(items) {
    const validItems = items.filter(item => item && item.chance > 0);
    if (validItems.length === 0) return null;

    const totalWeight = validItems.reduce((sum, item) => sum + (item.chance || 0), 0);
    if (totalWeight <= 0) return validItems[Math.floor(Math.random() * validItems.length)];

    let random = Math.random() * totalWeight;
    for (const item of validItems) {
        random -= item.chance;
        if (random <= 0) {
            return item;
        }
    }
    return validItems[validItems.length - 1];
}

function lootRandomItem(type) {
    let newItem = null;

    if (type === "food") {
        const foodItems = CONSUMABLES.filter(c => c.id.includes("food_"));
        const chosenItem = getWeightedRandomItem(foodItems);
        if (chosenItem) newItem = { ...chosenItem, sellPrice: Math.floor(chosenItem.price / 2) };
    } else if (type === "treasure") {
        if (Math.random() < 0.6) {
            const chosenItem = getWeightedRandomItem(CONSUMABLES);
            if (chosenItem) newItem = { ...chosenItem, sellPrice: Math.floor(chosenItem.price / 2) };
        } else {
            newItem = { id: "mat_common", name: "普通素材", emoji: "🧩", type: "material", usable: false, sellPrice: 10, stackable: true };
        }
    } else if (type === "material") {
        newItem = { id: "mat_common", name: "普通素材", emoji: "🧩", type: "material", usable: false, sellPrice: 5, stackable: true };
    }
    
    if (!newItem) return;

    // ✨ 核心改造：檢查背包空間
    if (canBeAddedToInventory(newItem)) {
        addToInventory(newItem);
        UI.addLog(`🎁 你找到了 ${newItem.name}，已放入背包。`, "log-system");
        UI.updateInventory();
    } else {
        // 背包已滿，進入替換模式
        gameState.pendingLoot = newItem;
        gameState.mode = 'loot-swap';
        UI.addLog(`🎒 背包已滿！你發現了 ${newItem.name}，要替換嗎？`, "log-system");
        UI.renderMainScreen();
    }
    autoSave();
}

// ✨ 新增：處理拾取替換的函式
export function swapWithLoot(inventoryIndex) {
    if (gameState.mode !== 'loot-swap' || !gameState.pendingLoot) return;

    const newItem = gameState.pendingLoot;
    const oldItem = inventory[inventoryIndex];

    inventory[inventoryIndex] = newItem; // 替換

    UI.addLog(`你丟棄了 ${oldItem.name}，換成了 ${newItem.name}。`, "log-system");

    // 清理狀態
    gameState.pendingLoot = null;
    gameState.mode = gameState.currentZone ? 'explore' : 'town'; // 回到之前的模式
    UI.renderMainScreen();
    autoSave();
}

// ✨ 新增：處理放棄拾取的函式
export function discardPendingLoot() {
    if (gameState.mode !== 'loot-swap' || !gameState.pendingLoot) return;

    const discardedItem = gameState.pendingLoot;
    UI.addLog(`你決定將 ${discardedItem.name} 留在原地。`, "log-system");

    // 清理狀態
    gameState.pendingLoot = null;
    gameState.mode = gameState.currentZone ? 'explore' : 'town';
    UI.renderMainScreen();
    autoSave();
}

export function equipItem(index) {
    const itemToEquip = inventory[index];
    if (!itemToEquip || itemToEquip.type !== "equip") return;

    // ✨ 核心修正：在裝備前預先檢查背包空間是否會溢出
    if (itemToEquip.slot) {
        const currentlyEquipped = player.equipment[itemToEquip.slot];
        if (currentlyEquipped) { // 只有在替換裝備時才需要檢查
            const currentSlotsBonus = currentlyEquipped.stats.slots || 0;
            const newSlotsBonus = itemToEquip.stats.slots || 0;
            const futureMaxSlots = player.inventoryMaxSlots - currentSlotsBonus + newSlotsBonus;
            // 因為是交換，物品總數不變，所以直接用 inventory.length 判斷
            if (inventory.length > futureMaxSlots) {
                UI.addLog("🎒 更換後背包空間不足，無法裝備！", "log-system");
                return;
            }
        }
    }

    const slot = itemToEquip.slot;
    const currentlyEquippedItem = player.equipment[slot];

    // 核心修正：執行交換邏輯
    // 1. 將新裝備穿到身上
    player.equipment[slot] = itemToEquip;

    // 2. 如果原本該部位有裝備，則將舊裝備放回新裝備原來在背包的位置
    if (currentlyEquippedItem) {
        inventory[index] = currentlyEquippedItem;
    } else {
        // 3. 如果原本該部位是空的，才從背包中移除新裝備
        inventory.splice(index, 1);
    }

    UI.addLog(`你裝備了 ${itemToEquip.name}。`); UI.updateStatus(); UI.updateInventory(); autoSave(); }
export function unequipItem(slot) { 
    const item = player.equipment[slot]; 
    if (!item) return;

    // ✨ 核心修正：檢查卸下後背包是否會溢出
    const itemSlots = item.stats.slots || 0;
    // 預測卸下後的狀態：目前物品數量 + 1 (卸下的裝備) vs. 未來最大欄位 (目前最大欄位 - 裝備提供欄位)
    const futureItemCount = inventory.length + 1;
    const futureMaxSlots = player.inventoryMaxSlots - itemSlots;
    if (futureItemCount > futureMaxSlots) {
        UI.addLog("🎒 背包空間不足，無法卸下此裝備！", "log-system");
        return;
    }

    player.equipment[slot] = null; 
    addToInventory(item); 
    UI.addLog(`你卸下了 ${item.name}。`); 
    UI.updateStatus(); 
    UI.updateInventory(); 
    autoSave(); 
}

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


// ================== 商人系統 (重構) ==================

// Helper function to create a proper equipment object from a template
function createEquipFromTemplate(template, price) {
    if (!template) return null;
    const stats = {};
    if (template.baseAtk) stats.atk = template.baseAtk;
    if (template.baseDef) stats.def = template.baseDef;
    if (template.magicAtk) stats.magicAtk = template.magicAtk;
    if (template.str) stats.str = template.str;
    if (template.int) stats.int = template.int;
    if (template.agi) stats.agi = template.agi;
    if (template.con) stats.con = template.con;
    if (template.hp) stats.hp = template.hp;
    if (template.mp) stats.mp = template.mp;
    if (template.slots) stats.slots = template.slots; // ✨ 確保商人販售的背包也有欄位加成

    return {
        name: template.name,
        emoji: template.emoji,
        type: 'equip',
        slot: template.type,
        stats: stats,
        price: price, // Use the price from merchant data
        sellPrice: Math.floor(price / 2),
        usable: true,
        stackable: false,
        minLvl: template.minLvl
    };
};

function populateMerchantGoods(merchantType) {
    const merchantData = MERCHANTS[merchantType];
    if (!merchantData) return [];

    let goods = [];

    // --- 從固定列表或等級過濾的列表中產生商品 ---
    const inventorySource = merchantData.inventory || merchantData.inventoryPool;
    if (inventorySource) {
        const availableItems = inventorySource.filter(itemDef => 
            !itemDef.availableAtLevel || player.level >= itemDef.availableAtLevel
        );

        availableItems.forEach(itemDef => {
            let item = null;
            if (itemDef.type === 'consumable') {
                const template = CONSUMABLES.find(c => c.id === itemDef.itemId);
                if (template) {
                    item = { ...template };
                    // 允許商人的資料覆蓋預設價格，否則使用消耗品自己的價格
                    item.price = itemDef.price || template.price;
                }
            } else if (itemDef.type === 'equipment') {
                const template = EQUIP_TEMPLATES.find(e => e.id === itemDef.itemId);
                if (template) {
                    // 使用覆蓋價格，否則使用範本的基礎價格
                    const finalPrice = itemDef.price || template.basePrice;
                    item = createEquipFromTemplate(template, finalPrice);
                }
            }
            if(item) goods.push(item);
        });
    }

    // --- 產生隨機裝備 ---
    if (merchantData.randomEquipment) {
        const rules = merchantData.randomEquipment;
        for (let i = 0; i < rules.count; i++) {
            const level = player.level + (rules.levelBonus || 0);
            const randomEquip = generateRandomEquipment(level);
            goods.push(randomEquip);
        }
    }
    
    return goods.filter(g => g); // 最後過濾掉可能產生的 null
}

function maybeMerchant(from) {
    if (gameState.inBattle || gameState.merchantActive) return false;
    // 增加遇到流浪商人的機率
    let chance = from === "nearby" ? 0.08 : from === "dungeon" ? 0.15 : 0.1;
    if (Math.random() < chance) {
        openMerchant('WANDERING'); // 指定開啟流浪商人
        return true;
    }
    return false;
}

function renderMerchantUI(message = "") {
    if(message) UI.addLog(message, "log-system");
    UI.renderMainScreen();
}

// 通用的開啟商人介面函式
function openMerchant(merchantType) {
    const merchantData = MERCHANTS[merchantType];
    if (!merchantData) return;
    
    gameState.merchantActive = true;
    gameState.mode = "merchant";
    gameState.isTownMerchant = (merchantType === 'TOWN'); // 只有城鎮商人才標記
    gameState.merchantName = merchantData.name; // ✨ 設定商人名稱
    
    gameState.merchantGoods = populateMerchantGoods(merchantType);
    
    UI.addLog(`你來到了 ${merchantData.name}。`);
    renderMerchantUI();
}

// 城鎮商人專用函式 (為了讓 UI 按鈕可以呼叫)
export function openTownMerchant() {
    openMerchant('TOWN');
}

// ✨ 新增：檢查物品是否能加入背包的輔助函式
function canBeAddedToInventory(item) {
    // 檢查是否有空格
    if (inventory.length < player.inventoryMaxSlots) {
        return true;
    }
    // 如果背包已滿，只檢查可堆疊物品是否還有空間
    if (item.stackable) {
        const itemDef = CONSUMABLES.find(c => c.id === item.id) || (item.id === 'mat_common' ? { maxStack: 20 } : null);
        const maxStack = itemDef ? itemDef.maxStack : 1;
        
        // 尋找現有的、未滿的堆疊
        for (const existingItem of inventory) {
            if (existingItem.id === item.id && existingItem.count < maxStack) {
                return true;
            }
        }
    }
    // 非堆疊物品或沒有可堆疊空間
    return false;
}

export function buyItem(index) {
    const item = gameState.merchantGoods[index];
    if (!item || typeof item.price !== 'number') return;
    
    // ✨ 核心修正：購買前先檢查背包空間
    if (!canBeAddedToInventory(item)) {
        UI.addLog("🎒 背包已滿！無法購買此物品。", "log-system");
        renderMerchantUI(); // 刷新商人介面以顯示訊息
        return;
    }

    if (player.gold < item.price) { 
        UI.addLog(`金錢不足，你需要 ${item.price} G`, "log-system"); 
        return; 
    }

    player.gold -= item.price; 
    addToInventory({ ...item });
    UI.updateStatus(); 
    UI.updateInventory(); 
    UI.addLog(`購買了 ${item.name}`, "log-system");
    renderMerchantUI(`感謝購買！已獲得 ${item.name}。`); 
    autoSave();
}

export function sellAllMaterials() {
    let total = 0;
    for(let i = inventory.length - 1; i >= 0; i--){
        if (inventory[i].type === "material" && inventory[i].sellPrice) {
            total += inventory[i].sellPrice * (inventory[i].count || 1);
            inventory.splice(i, 1);
        }
    }
    if (total > 0) { player.gold += total; UI.updateStatus(); UI.updateInventory(); UI.addLog(`出售所有素材獲得 ${total} G`, "log-system"); autoSave(); } 
    else { UI.addLog("沒有素材可賣", "log-system"); }
}

export function closeMerchant() {
    gameState.merchantActive = false; 
    gameState.merchantGoods = []; 
    gameState.isTownMerchant = false;
    gameState.merchantName = null; // ✨ 清除商人名稱
    gameState.mode = gameState.currentZone ? "explore" : "town";
    UI.addLog("結束交易"); 
    UI.updateInventory(); 
    UI.renderMainScreen();
}

// ================== 訓練場系統 (新增) ==================

// 為了讓 UI 按鈕可以呼叫
export function openTrainingGround() {
    gameState.mode = "training";
    UI.addLog("你來到了訓練場。");
    UI.renderMainScreen();
}

export function closeTrainingGround() {
    gameState.mode = "town";
    UI.addLog("你離開了訓練場。");
    UI.renderMainScreen();
}

export function trainAttribute(attribute) {
    if (gameState.mode !== 'training') return;
    
    // 根據要求，價格暫時為 0
    const cost = 0;

    if (player.gold < cost) {
        UI.addLog(`金錢不足，你需要 ${cost} G。`, "log-system");
        return;
    }

    player.gold -= cost;
    player[attribute]++; // 直接增加對應屬性
    UI.addLog(`訓練成功！你的 ${attribute.toUpperCase()} 提升了。`, "log-system");

    // ✨ 核心修正：如果訓練的是體質或智慧，則在更新狀態時直接補滿
    const shouldRefill = (attribute === 'con' || attribute === 'int');
    UI.updateStatus(shouldRefill);

    UI.renderMainScreen(); // 重新渲染以更新價格
    autoSave();
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
    gameState.pendingExp = 0; // ✨ 核心：出發時重置暫存經驗
    
    // ✨ 核心改造：根據區域設定初始撤離狀態
    if (zoneId === 'nearby') {
        gameState.canSafelyRetreat = true; // 附近可隨時安全撤離
    } else {
        gameState.canSafelyRetreat = false; // 地下城和遠征需要找到出口
    }

    UI.addLog(`你出發前往 ${zoneName} 進行探索。(經驗值將在撤離時結算)`, "log-system");
    UI.renderMainScreen();
    advanceDay(); // 每次出發都算一天
    autoSave();
}

export function advanceExploration(explorationType = 'default') {
    // ✨ 核心改造：使用新的「對數增長」混合公式，並設定 8 點為消耗極值
    const baseCost = 2; // 基礎消耗
    const depthBonus = Math.floor(Math.log2(Math.max(1, gameState.depth))); // 深度加成
    const finalCost = Math.min(10, baseCost + depthBonus); // ✨ 核心改造：消耗上限改為 10
    if (gameState.mode !== 'explore' || !canDoExplore(finalCost)) return; // 檢查並扣除飢餓
    
    // ✨ 核心修正：一旦選擇繼續探索，就失去了之前找到的出口
    if (gameState.currentZone !== 'nearby') {
        gameState.canSafelyRetreat = false;
    }

    gameState.depth++;
    stats.exploredNearby++; // 暫時先統一加到一個統計
    triggerEvent(explorationType);
    autoSave();
}

// ✨ 核心修正：將返回城鎮的清理工作抽離成獨立函式
function returnToTownCleanup() {
    gameState.mode = "town";
    gameState.currentZone = null;
    gameState.canSafelyRetreat = false;
    gameState.depth = 0;
    gameState.pendingExp = 0; // 結算完畢，歸零

    // ✨ 新增：回到城鎮時，完全恢復 HP 和 MP
    player.hp = player.maxHP;
    player.mp = player.maxMP;

    UI.addLog("你回到了城鎮。HP與MP已完全恢復。", "log-system");
    UI.updateStatus(); // 更新狀態以顯示恢復後的血魔
    UI.renderMainScreen();
    autoSave();
}

export function retreatToTown() {
    // ✨ 核心改造：安全撤離，套用新經驗公式
    const killExp = gameState.pendingExp;
    const depthExp = gameState.depth * 10;
    const materialValue = inventory.reduce((sum, item) => {
        const value = item.sellPrice || Math.floor((item.price || 0) / 2);
        return sum + (value * (item.count || 1));
    }, 0);
    const materialExp = Math.floor(materialValue * 0.2);
    const totalBaseExp = killExp + depthExp + materialExp;

    if (totalBaseExp > 0) {
        const multiplier = 1.2; // ✅ 安全撤離獎勵
        const finalExp = Math.floor(totalBaseExp * multiplier);
        UI.addLog(`✅ 安全撤離結算：(殺怪 ${killExp} + 探索 ${depthExp} + 物資 ${materialExp}) * ${multiplier} (獎勵) = ${finalExp} EXP`, "log-system");
        gainExp(finalExp);
    }

    returnToTownCleanup(); // ✨ 呼叫新的清理函式
}

// ✨ 新增：強制撤離函式 (帶懲罰)
export function forceRetreat() {
    if (gameState.mode !== 'explore') return;
    
    // ✨ 核心改造 1：加入確認提示
    const confirmationMessage = "你確定要強制撤離嗎？\n\n這將會導致：\n- 隨機損失部分金錢與物品。\n- 最終獲得的經驗值會大幅減少。\n- 有 10% ~ 30% 的機率失敗並遭遇敵人！";
    if (!confirm(confirmationMessage)) {
        UI.addLog("你決定再堅持一下...", "log-system");
        return;
    }

    UI.addLog("你決定不顧一切地強制撤離...", "log-critical");

    // ✨ 核心改造 2：新增撤離失敗機制
    const failureChance = 0.1 + Math.random() * 0.2; // 10% to 30%
    if (Math.random() < failureChance) {
        UI.addLog("🚫 撤離失敗！你在慌亂中驚動了附近的敵人！", "log-critical");
        // 撤離失敗直接進入戰鬥，不執行後續的懲罰
        startBattle(gameState.currentZone, gameState.depth, true); // 傳入 isAmbush 標記
        return;
    }

    // --- 如果撤離成功，則執行懲罰 ---

    // ✨ 改造：金錢損失改為 30% ~ 50% 的隨機浮動
    const goldLossPercent = 0.3 + Math.random() * 0.2; // 0.3 to 0.5
    const lostGold = Math.floor(player.gold * goldLossPercent);
    player.gold -= lostGold;
    UI.addLog(`💸 慌亂中，你遺失了 ${lostGold} G。`, "log-system");

    // ✨ 改造：每個物品欄位都有 50% ~ 60% 的獨立機率遺失
    // ✨ 核心改造 3：懲罰細化到堆疊內的每個物品
    let lostItemsLog = {}; // 使用物件來統計丟失的物品
    for (let i = inventory.length - 1; i >= 0; i--) {
        const item = inventory[i];
        const originalCount = item.count || 1;
        let itemsLostInStack = 0;

        // 遍歷堆疊中的每一個物品
        for (let j = 0; j < originalCount; j++) {
            const dropChance = 0.5 + Math.random() * 0.1; // 50% to 60% chance for each individual item
            if (Math.random() < dropChance) {
                itemsLostInStack++;
            }
        }

        if (itemsLostInStack > 0) {
            // 記錄到日誌物件中
            if (!lostItemsLog[item.name]) lostItemsLog[item.name] = 0;
            lostItemsLog[item.name] += itemsLostInStack;

            // 更新背包中的物品數量
            item.count -= itemsLostInStack;
            if (item.count <= 0) {
                inventory.splice(i, 1); // 如果數量歸零，則從背包移除
            }
        }
    }
    const lostItemsLogArray = Object.entries(lostItemsLog).map(([name, count]) => `${name} x${count}`);
    if (lostItemsLogArray.length > 0) { UI.addLog(`🎒 為了逃跑，你丟棄了：${lostItemsLogArray.join("、 ")}。`, "log-system"); }

    const killExp = gameState.pendingExp;
    const depthExp = gameState.depth * 10;
    const materialValue = inventory.reduce((sum, item) => { // 計算剩餘物品價值
        const value = item.sellPrice || Math.floor((item.price || 0) / 2);
        return sum + (value * (item.count || 1));
    }, 0);
    const materialExp = Math.floor(materialValue * 0.2);
    const totalBaseExp = killExp + depthExp + materialExp;

    if (totalBaseExp > 0) {
        const multiplier = 0.4 + Math.random() * 0.3; // 🏳️ 強制撤離懲罰 (0.4 ~ 0.7)
        const finalExp = Math.floor(totalBaseExp * multiplier);
        UI.addLog(`🏳️ 強制撤離結算：(殺怪 ${killExp} + 探索 ${depthExp} + 物資 ${materialExp}) * ${multiplier.toFixed(2)} (懲罰) = ${finalExp} EXP`, "log-critical");
        gainExp(finalExp);
    }

    // 10% 機率完美撤退 (範例)
    if (Math.random() < 0.1) {
        UI.addLog("✨ 奇蹟發生了！你在混亂中毫髮無傷地逃脫了！(免除懲罰)", "log-system");
        // (如果在這裡免除懲罰，需要把上面扣錢扣物的邏輯包在 else 裡)
    }

    returnToTownCleanup(); // ✨ 核心修正：最後呼叫新的清理函式來重置狀態
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
        ...template, // 複製範本所有屬性
        lvl: finalLvl,
        hp: Math.floor(template.baseHp * (1 + (finalLvl - template.minLvl) * 0.2)),
        maxHp: Math.floor(template.baseHp * (1 + (finalLvl - template.minLvl) * 0.2)),
        atk: Math.floor(template.baseAtk * (1 + (finalLvl - template.minLvl) * 0.15)),
        def: Math.floor(template.baseDef + (finalLvl - template.minLvl) * 1),
        // 新增：計算衍生屬性
        hitRate: 80 + (finalLvl * 1) + ((template.baseTec || 0) * 1.5),
        dodge: (finalLvl * 0.8) + ((template.baseAgi || 0) * 1.5),
        critChance: 5 + ((template.baseTec || 0) * 0.2),
        critDamage: 150 + ((template.baseStr || 0) * 0.3),
        speed: (template.baseSpeed || 10) + ((template.baseAgi || 0) * 0.1),
        isBoss: true 
    };
    gameState.enemy.actionGauge = 0; // 初始化敵人行動條

    // 確保 killChance 存在
    if (gameState.enemy.killChance === undefined) {
        gameState.enemy.killChance = 1.0;
    }

    // 確保 dropRate 存在
    if (gameState.enemy.dropRate === undefined) {
        gameState.enemy.dropRate = 1.0;
    }

    UI.addBattleLog(`⚠️ 警告：${gameState.enemy.name} 出現了！`, "log-critical");
    UI.renderMainScreen();
    startInstantBattle(); // 啟動「瞬間 ATB」戰鬥
}

function startBattle(zone, difficulty = 1, isAmbush = false) {
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

    // 根據新公式，重新計算敵人數值
    gameState.enemy = {
        ...template, // 複製範本所有屬性
        lvl: finalLvl,
        hp: Math.floor(template.baseHp * (1 + (finalLvl - template.minLvl) * 0.2) * diffMod),
        maxHp: Math.floor(template.baseHp * (1 + (finalLvl - template.minLvl) * 0.2) * diffMod),
        atk: Math.floor(template.baseAtk * (1 + (finalLvl - template.minLvl) * 0.15) * diffMod),
        def: Math.floor(template.baseDef + (finalLvl - template.minLvl) * 1),
        exp: Math.floor(template.exp * (1 + (finalLvl - template.minLvl) * 0.1)),
        // 新增：計算衍生屬性
        hitRate: 80 + (finalLvl * 1) + ((template.baseTec || 0) * 1.5),
        dodge: (finalLvl * 0.8) + ((template.baseAgi || 0) * 1.5),
        critChance: 5 + ((template.baseTec || 0) * 0.2),
        critDamage: 150 + ((template.baseStr || 0) * 0.3),
        speed: (template.baseSpeed || 10) + ((template.baseAgi || 0) * 0.1),
    };
    gameState.enemy.actionGauge = 0; // 初始化敵人行動條

    // 確保 killChance 存在
    if (gameState.enemy.killChance === undefined) {
        gameState.enemy.killChance = 0.1;
    }

    if (isAmbush) {
        UI.addBattleLog(`撤退失敗，遭遇伏擊：${gameState.enemy.name} (Lv.${gameState.enemy.lvl})`, "log-critical");
    } else {
        UI.addBattleLog(`遭遇敵人：${gameState.enemy.name} (Lv.${gameState.enemy.lvl})`, "log-battle");
    }
    UI.renderMainScreen();
    startInstantBattle(); // 啟動「瞬間 ATB」戰鬥
}

// ================== 瞬間 ATB 戰鬥系統核心 ==================

function startInstantBattle() {
    // 初始化玩家和敵人的行動條
    player.actionGauge = 0;
    if (gameState.enemy) gameState.enemy.actionGauge = 0;
    gameState.isPlayerTurn = false;
    gameState.lastActor = null; // ✨ 戰鬥開始時，清除上回合行動記錄
    
    // 戰鬥開始，直接決定誰先行動
    processNextTurn();
}

async function processNextTurn() {
    if (!gameState.inBattle || !player.alive || !gameState.enemy || gameState.enemy.hp <= 0) {
        return;
    }

    // 核心邏輯：計算誰先達到 100 行動值
    // 避免除以零的錯誤
    const playerSpeed = Math.max(1, player.speed);
    const enemySpeed = Math.max(1, gameState.enemy.speed);

    // 計算還需要多少 "tick" 才能滿 100
    const playerTicksNeeded = (100 - player.actionGauge) / playerSpeed;
    const enemyTicksNeeded = (100 - gameState.enemy.actionGauge) / enemySpeed;

    if (playerTicksNeeded <= enemyTicksNeeded) {
        // 輪到玩家行動
        // 推進時間，讓敵人的行動條也增加
        // ✨ 新增：檢查是否為玩家連擊
        if (gameState.lastActor === 'player') {
            UI.addLog("⚡️ 你的速度壓制了對手，獲得了連擊機會！", "log-system");
        }

        // 核心修正：推進雙方時間，而不是只補滿一方
        player.actionGauge += playerTicksNeeded * playerSpeed; // 玩家行動條剛好達到 100+
        gameState.enemy.actionGauge += playerTicksNeeded * enemySpeed; // 敵人行動條也同步推進

        gameState.isPlayerTurn = true;
        UI.renderMainScreen(); // 更新UI，解鎖按鈕
    } else {
        // 輪到敵人行動
        // 推進時間，讓玩家的行動條也增加
        // ✨ 新增：檢查是否為敵人連擊 (讓戰鬥更刺激)
        if (gameState.lastActor === 'enemy') {
            UI.addLog("🐢 敵人動作迅猛，對你發動了連續攻擊！", "log-critical");
        }

        // 核心修正：推進雙方時間
        player.actionGauge += enemyTicksNeeded * playerSpeed;
        gameState.enemy.actionGauge += enemyTicksNeeded * enemySpeed; // 敵人行動條剛好達到 100+

        gameState.isProcessingTurn = true;
        UI.renderMainScreen(); // 先更新一次畫面，顯示敵人行動前的狀態
        await wait(400); // 給一個短暫的延遲，讓玩家能反應
        const playerDied = await doEnemyMove();
        gameState.isProcessingTurn = false;

        // 如果玩家沒死，敵人行動完後，立刻計算下一回合
        if (!playerDied) {
            processNextTurn();
        }
    }
}

export async function handleCombat(action, skillId = null) {
    // ATB 系統下，只有輪到玩家才能行動
    if (!gameState.inBattle || !player.alive || !gameState.isPlayerTurn) return;

    // 檢查 MP 是否足夠
    if (action === 'skill' && skillId) {
        const skill = SKILLS.find(s => s.id === skillId);
        if (!skill) return;
        if (player.mp < skill.cost) { UI.addLog("MP 不足！無法施放技能。", "log-system"); return; }
    }

    // 鎖定玩家回合，執行動作
    gameState.isPlayerTurn = false;
    gameState.isProcessingTurn = true; // 標記為正在處理，防止敵人同時行動

    // 執行玩家動作，並等待其完成
    const enemyDied = await doPlayerMove(action, skillId);

    player.actionGauge -= 100; // 核心修正：行動後只扣除100，保留溢出值
    gameState.lastActor = 'player'; // ✨ 記錄本次行動者為玩家

    gameState.isProcessingTurn = false; // 解除處理鎖

    // 如果敵人沒死，玩家行動完後，立刻計算下一回合
    if (!enemyDied) {
        processNextTurn();
    }
}

async function doPlayerMove(action, skillId) {
    if (!gameState.inBattle || !player.alive) return false;
    const enemy = gameState.enemy;

    // 消耗 MP
    if (action === 'skill' && skillId) {
        const skill = SKILLS.find(s => s.id === skillId);
        player.mp -= skill.cost; UI.updateStatus(); 
    }

    let skill = null;
    if (action === 'skill' && skillId) {
        skill = SKILLS.find(s => s.id === skillId);
    }

    // 命中公式: 命中 / (命中 + 閃避 * 0.8)
    const hitChance = player.hitRate / (player.hitRate + (enemy.dodge || 0) * 0.8);

    let hits = (skill && skill.hits) ? skill.hits : 1;
    
    for (let i = 0; i < hits; i++) {
        if (enemy.hp <= 0) break;

        if (Math.random() > hitChance) {
            UI.addLog(`❌ 你的攻擊被 ${enemy.name} 閃過了！`, "log-battle");
            if (i < hits - 1) await wait(300);
            continue; // 本次攻擊未命中，繼續下一次攻擊 (如果是多段攻擊)
        }

        // 傷害計算
        let isMagic = false;
        if (skill && skill.type === "magic") isMagic = true;

        
       
        let baseDmg = isMagic ? player.magicAtk : player.atk; // 面板攻擊
        let multiplier = skill ? skill.dmgScale : 1.0;
        let dmg = 0;

        
        if (isMagic) {
            // 魔法傷害 = 面板魔攻 * 技能倍率 (無視防禦)
            dmg = baseDmg * multiplier;
        } else {
            // 物理傷害 = 面板攻擊 * (1 - Def%)
            const enemyDef = enemy.def || 0;
            const defPercent = enemyDef / (enemyDef + 150 + (enemy.lvl || 1) * 5); // 百分比減傷
            dmg = (baseDmg * multiplier) * (1 - defPercent);
        }

        // 暴擊判定
        let crit = false; 
        let critChance = player.critChance + (skill ? (skill.critBonus || 0) : 0);
        if (Math.random() * 100 < critChance) { 
            dmg *= (player.critDamage / 100); // 傷害 * (暴傷 / 100)
            crit = true; 
        }

        
        // 傷害浮動 (0.9 ~ 1.1)
        dmg *= (0.9 + Math.random() * 0.2);
        dmg = Math.floor(dmg);
        if (dmg < 1) dmg = 1;
        
        enemy.hp -= dmg; 
        if (enemy.hp < 0) enemy.hp = 0;

        
        let actionName = skill ? skill.name : "攻擊";
        let msg = crit ? `💥 暴擊！${actionName} 造成 ${dmg} 傷害！` : `🗡️ ${actionName} 命中！造成 ${dmg} 傷害。`;
        

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
    
    // 敵人行動後，扣除行動條
    enemy.actionGauge -= 100; // 核心修正：行動後只扣除100，保留溢出值
    gameState.lastActor = 'enemy'; // ✨ 記錄本次行動者為敵人

    // 命中公式
    const hitChance = (enemy.hitRate || 80) / ((enemy.hitRate || 80) + player.dodge * 0.8);

    if (Math.random() > hitChance) {
        UI.addLog(`💨 你閃避了 ${enemy.name} 的攻擊！`, "log-battle");
    } else {
        // 物理傷害 = 面板攻擊 * (1 - Def%)
        const defPercent = player.def / (player.def + 150 + player.level * 5);
        let dmg = (enemy.atk || 5) * (1 - defPercent);

        // 暴擊判定
        let crit = false;
        if (Math.random() * 100 < (enemy.critChance || 5)) {
            dmg *= ((enemy.critDamage || 150) / 100);
            crit = true;
        }

        // 傷害浮動
        dmg *= (0.9 + Math.random() * 0.2);
        dmg = Math.floor(dmg);
        if (dmg < 1) dmg = 1;

        player.hp -= dmg;
        let displayHp = Math.max(0, Math.floor(player.hp));

        let msg = crit ? `💥 ${enemy.name} 對你造成了致命一擊！損失 ${dmg} HP。` : `${enemy.name} 對你造成 ${dmg} 傷害。`;
        UI.addLog(`${msg} (${player.name} 剩 ${displayHp} HP)`, "log-battle");

        UI.triggerShake();
    }
    UI.updateStatus();

    // 檢查玩家是否死亡
    if (player.hp <= 0) {
        player.hp = 0;
        await wait(300);
        handlePlayerDeath("戰鬥中陣亡");
        return true; 
    }
    return false; 
}

export async function attemptToRun() {
    // ✨ 核心修正：這是一個獨立於 handleCombat 的新函式
    if (!gameState.inBattle || !player.alive || !gameState.isPlayerTurn) return;
    
    if (gameState.enemy && gameState.enemy.isBoss) {
        UI.addLog("🚫 這是 Boss 戰，無法逃跑！", "log-critical");
        return; // Boss 戰逃跑失敗，但不消耗回合
    }

    // 鎖定玩家回合，開始處理逃跑
    gameState.isPlayerTurn = false;
    gameState.isProcessingTurn = true;

    // 判斷是否成功
    // ✨ 核心改造：逃跑成功率現在取決於玩家與敵人的「速度差」
    const enemySpeed = gameState.enemy.speed || 10; // 確保敵人有基礎速度
    const speedDifference = player.speed - enemySpeed;
    let escapeChance = 50 + (speedDifference * 1.5); // 每點速度差影響 1.5% 成功率

    // 確保成功率被限制在 10% 到 95% 之間，避免絕對成功或失敗
    const finalChance = Math.max(10, Math.min(escapeChance, 95));
    if (Math.random() * 100 < finalChance) {
        // 逃跑成功
        gameState.inBattle = false; 
        gameState.mode = gameState.currentZone ? "explore" : "town";
        gameState.enemy = null; 
        UI.addLog("🏃‍♂️ 你成功脫離了戰鬥。", "log-battle");
        UI.renderMainScreen(); 
        autoSave();
        gameState.isProcessingTurn = false; // 解鎖
    } else {
        // 逃跑失敗，立刻輪到敵人攻擊
        UI.addLog("🚫 逃跑失敗！被敵人抓住了！", "log-critical");
        await wait(600);

        // 消耗玩家行動值，並記錄行動者
        player.actionGauge -= 100;
        gameState.lastActor = 'player';

        // 直接觸發敵人回合
        const playerDied = await doEnemyMove();
        gameState.isProcessingTurn = false; // 解鎖

        // 如果玩家沒死，則在敵人行動後，重新計算下一回合
        if (!playerDied) {
            processNextTurn();
        }
    }
}

function winBattle() {
    const enemy = gameState.enemy;
    if (!enemy || !gameState.inBattle) return;

    if (enemy.id === "boss_dragon") { gameClear(); return; }
    
    // ✨ 修正：戰鬥勝利後，應該回到探索模式或城鎮模式
    gameState.inBattle = false; // 修正：移除多餘的 "Zone ? "explore" : "town";"
    gameState.mode = gameState.currentZone ? "explore" : "town"; 
    gameState.enemy = null; gameState.isProcessingTurn = false;
    UI.addLog(`🎉 擊敗了 ${enemy.name}！`, "log-battle");

    // ✨ 核心：計算怪物經驗並加入暫存池
    const baseExp = enemy.exp || 10;
    const calculatedExp = Math.floor(baseExp * (1 + (enemy.lvl - enemy.minLvl) * 0.15));
    gameState.pendingExp += calculatedExp;
    UI.addLog(`[暫存經驗 +${calculatedExp}]`, "log-system");

    stats.kills++;
    const goldGain = 5 + Math.floor(Math.random() * 11) + (enemy.lvl * 2);
    player.gold += goldGain; UI.addLog(`獲得 ${goldGain} G`, "log-system");

    const baseDrop = enemy.dropRate || 0.1;
    const dropChance = baseDrop + (player.int * 0.01);
    if (Math.random() < dropChance) {
        if (Math.random() < 0.8) {
            const newItem = generateRandomEquipment(enemy.lvl); 
            inventory.push(newItem); 
        } else { lootRandomItem("treasure"); }
        UI.updateInventory();
    }
    UI.updateStatus(); UI.renderMainScreen(); autoSave();
} // 修正：移除多餘的 "ate.inBattle = false; gameState.mode = "town"; gameState.enemy = null; gameState.isProcessingTurn = false;"


function gameClear() {
    gameState.inBattle = false; gameState.mode = "town"; gameState.enemy = null; gameState.isProcessingTurn = false;
    document.getElementById("eventBox").innerHTML = `<div style="text-align:center; padding: 20px;"><div style="font-size: 80px;">🏆</div><h2 style="color: #f1c40f;">恭喜通關！</h2><p>你擊敗了遠古巨龍，成為了傳說中的英雄。</p><p>總天數：${player.day} 天</p><p>等級：Lv ${player.level}</p><div style="margin-top:30px; border:1px solid #444; padding:10px; border-radius:8px; background:#222;"><p style="color:#aaa; font-size:14px;">開發者筆記：<br>感謝遊玩！<br>你可以在這裡繼續冒險，或是按下方按鈕重新開始。</p></div></div>`;
    UI.addLog("🏆 恭喜！你完成了遊戲目標！", "log-system");
    UI.showMainActions();
    autoSave();
}

// ================== 核心修正：死亡處理函式 ==================
function handlePlayerDeath(reason, forceTrueDeath = false) {
    // 玩家死亡，戰鬥自然結束
    player.alive = false;
    player.hp = 0;
    UI.updateStatus();

    // ✨ 核心改造：根據死亡原因決定致死率
    let killChance = 0; // 預設為 0
    const isCombatDeath = (gameState.enemy !== null);

    if (gameState.enemy && gameState.enemy.killChance !== undefined) {
        // 如果是戰鬥死亡，且敵人有指定致死率 (例如 Boss)，則使用該值
        killChance = gameState.enemy.killChance;
    } else if (isCombatDeath) {
        // 如果是普通戰鬥死亡，致死率為 1% ~ 3%
        killChance = 0.01 + Math.random() * 0.02;
    } else {
        // 如果是飢餓、中毒等非戰鬥死亡，致死率為 0 (必定重傷撤退)
        killChance = 0;
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
        let lostInventoryItems = [];
        if (inventory.length > 0) {
            inventory.forEach(i => lostInventoryItems.push(i.name));
        }

        // ✨ 核心改造：增加裝備噴落機制
        let lostEquipItems = [];
        const equipLossChance = 0.3; // 每件裝備有 30% 的機率噴掉
        for (const slot in player.equipment) {
            const item = player.equipment[slot];
            if (item && Math.random() < equipLossChance) {
                lostEquipItems.push(item.name);
                player.equipment[slot] = null; // 從裝備欄移除
            }
        }

        // ✨ 改造：金錢損失改為 60% ~ 80% 的隨機浮動
        const goldLossPercent = 0.6 + Math.random() * 0.2; // 0.6 to 0.8
        let lostGold = Math.floor(player.gold * goldLossPercent);

        let summaryHtml = `<p>死因：${reason}</p>`;
        summaryHtml += `<p style="color:#f1c40f">💸 損失金錢：${lostGold} G</p>`;
        
        const allLostItems = [...lostInventoryItems, ...lostEquipItems];
        if (allLostItems.length > 0) {
            summaryHtml += `<p style="color:#e74c3c">🎒 遺失物品：${allLostItems.join(", ")}</p>`;
        } else {
            summaryHtml += `<p>🎒 背包本來就是空的。</p>`;
        }
        
        defeatSummary.innerHTML = summaryHtml;

        // ✨ 核心改造：重傷撤退，在清空背包前計算經驗
        const killExp = gameState.pendingExp;
        const depthExp = gameState.depth * 10;
        // 物資經驗為 0，因為所有東西都丟光了
        const materialExp = 0;
        const totalBaseExp = killExp + depthExp + materialExp;

        if (totalBaseExp > 0) {
            const multiplier = 0.2 + Math.random() * 0.1; // 💀 重傷懲罰 (0.2 ~ 0.3)
            const finalExp = Math.floor(totalBaseExp * multiplier);
            UI.addLog(`💀 重傷懲罰結算：(殺怪 ${killExp} + 探索 ${depthExp} + 物資 ${materialExp}) * ${multiplier.toFixed(2)} (重罰) = ${finalExp} EXP`, "log-critical");
            gainExp(finalExp);
        }


        inventory.length = 0;
        player.gold -= lostGold;
        player.hp = 1; 
        player.state = "重傷";
        
        gameState.inBattle = false;
        gameState.mode = "town";
        gameState.enemy = null;
        gameState.pendingExp = 0; // ✨ 核心修正：無論是否結算成功，都要在此歸零
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
    player.equipment = { head: null, body: null, weapon: null, accessory: null, backpack: null, shoes: null }; 
    player.learnedSkills = []; 
    player.equippedSkills = []; 

    // 2. 根據職業設定初始值
    if (jobKey === "warrior") { 
        player.job = "戰士"; 
        player.str = 5; 
        player.con = 4;
        player.tec = 1;
        player.learnedSkills.push("s_bash"); 
        player.equippedSkills.push("s_bash"); 
    } else if (jobKey === "archer") { 
        player.job = "弓箭手"; 
        player.agi = 5; 
        player.str = 2; 
        player.tec = 3;
        player.learnedSkills.push("s_double_shot"); 
        player.equippedSkills.push("s_double_shot"); 
    } else if (jobKey === "rogue") { 
        player.job = "盜賊"; 
        player.str = 3; 
        player.agi = 4; 
        player.tec = 3;
        player.learnedSkills.push("s_backstab"); 
        player.equippedSkills.push("s_backstab"); 
    } else if (jobKey === "mage") { 
        player.job = "法師"; 
        player.int = 8; 
        player.con = 1; 
        player.tec = 1;
        player.learnedSkills.push("s_fireball"); 
        player.equippedSkills.push("s_fireball"); 
    } 
    
    // 3. 設定初始金錢與物品
    player.gold = 1000; 
    stash.items = [];
    stash.gold = 0;
    stash.items.push({ ...CONSUMABLES[0], count: 3 });

    // 4. 更新 UI 並開始遊戲 (核心修正：調整執行順序)
    UI.updateInventory(); 
    UI.updateStash();
    UI.updateStatus(true); // ✨ 傳入 true，讓 recalcDerivedStats 直接補滿血魔

    document.getElementById("overlay").style.display = "none"; 
    UI.addLog(`冒險者 ${player.name} (${player.job}) 開始了旅程`, "log-system"); 
    UI.addLog(`獲得新手資助：100 G 與 3 個乾糧包 (已存入倉庫)`, "log-system");
    gameState.mode = "town"; gameState.canAct = true; UI.renderMainScreen(); autoSave();
}
export function restartGame() { resetGameData(); UI.updateInventory(); UI.updateStatus(); document.getElementById("eventBox").innerText = "請先輸入名字與選擇職業。"; document.getElementById("actions").innerHTML = ""; document.getElementById("deathPanel").style.display = "none"; document.getElementById("defeatPanel").style.display = "none"; document.getElementById("namePanel").style.display = "block"; document.getElementById("jobPanel").style.display = "none"; document.getElementById("overlay").style.display = "flex"; }