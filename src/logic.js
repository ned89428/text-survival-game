import { player, gameState, stats, inventory, COOLDOWNS, resetGameData } from './state.js';
import * as UI from './ui.js';
import { ENEMIES } from './data/enemies.js';
import { EQUIP_TEMPLATES, ITEM_PREFIXES, CONSUMABLES } from './data/items.js';
import { SKILLS } from './data/skills.js'; 

// ================== 存檔系統 ==================
function autoSave() {
    if (!player.alive && player.day > 1) { }
    // 存檔時確保資料結構正確
    const data = { 
        player, 
        inventory, 
        gameState: { ...gameState, inBattle: false, enemy: null, isProcessingTurn: false, logs: gameState.logs }, 
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
        
        // 恢復背包 (確保舊存檔兼容性)
        inventory.length = 0;
        data.inventory.forEach(item => {
            // 如果舊存檔沒有 count，補上 1
            if (!item.count) item.count = 1;
            inventory.push(item);
        });

        Object.assign(gameState, data.gameState);
        Object.assign(stats, data.stats);
        
        // 強制初始化狀態，避免卡死
        if (!gameState.logs) gameState.logs = [];
        gameState.mode = "normal";
        gameState.inBattle = false;
        gameState.isProcessingTurn = false;
        gameState.canAct = true;
        gameState.enemy = null;

        if (!player.alive) { gameOver("歷史紀錄 (已死亡)"); return; }
        
        UI.updateStatus(); 
        UI.updateInventory();
        document.getElementById("overlay").style.display = "none";
        UI.addLog(`歡迎回來，${player.name}。繼續你的第 ${player.day} 天冒險。`, "log-system");
        // 強制刷新主畫面與按鈕
        UI.renderMainScreen();
        UI.showMainActions();
    } catch (e) { 
        console.error("存檔損壞", e); 
        document.getElementById("overlay").style.display = "flex"; 
    }
}

export function hardReset() {
    if (confirm("確定要刪除所有進度並重新開始嗎？")) {
        localStorage.removeItem('LegendSurvival_Save');
        location.reload();
    }
}

// ================== 基礎與探索 ==================
export function addAttr(type) {
    if (player.attrPoints <= 0) return;
    if (type === "str") player.str++; if (type === "agi") player.agi++;
    if (type === "con") player.con++; if (type === "int") player.int++;
    player.attrPoints--; UI.updateStatus(); autoSave();
}
export function advanceDay() { player.day++; UI.updateStatus(); autoSave(); }
export function addExp(amount) {
    player.exp += amount;
    while (player.exp >= player.expToLevel) { player.exp -= player.expToLevel; levelUp(); }
    UI.updateStatus();
}
function levelUp() {
    player.level++; player.attrPoints += 5; player.hp = player.maxHP; player.mp = player.maxMP;
    UI.addLog(`⬆️ 你升級了！現在是 Lv ${player.level}。`, "log-system"); autoSave();
}
export function toggleInventory() { }

function startCooldown(seconds) {
    if (seconds <= 0) { gameState.canAct = true; UI.renderMainScreen(); return; }
    gameState.canAct = false;
    if (gameState.cooldownTimerId) clearInterval(gameState.cooldownTimerId);
    let t = seconds; UI.updateCooldownButtons(t);
    gameState.cooldownTimerId = setInterval(() => {
        t--; 
        if (t <= 0) { 
            clearInterval(gameState.cooldownTimerId); 
            gameState.cooldownTimerId = null; 
            gameState.canAct = true; 
            // 冷卻結束，如果是正常探索模式，刷新畫面讓按鈕亮起
            if (!gameState.merchantActive && !gameState.inBattle) UI.renderMainScreen(); 
        } else { 
            UI.updateCooldownButtons(t); 
        }
    }, 1000);
}

function canDoExplore(costHunger, costEnergy) {
    if (!player.alive || !gameState.canAct || gameState.inBattle || gameState.merchantActive) return false;
    
    let failed = false;
    // 顯示警告但不清空 Log，讓玩家看到發生什麼事
    
    if (player.hunger <= 0) { 
        player.hp -= 15; 
        UI.addLog("⚠️ 肚子餓扁了還強行探索... HP -15", "log-critical"); 
        failed = true; 
    } else { 
        player.hunger = Math.max(0, player.hunger - costHunger); 
    }

    if (player.energy <= 0) { 
        player.hp -= 10; 
        UI.addLog("⚠️ 累得要死還強行探索... HP -10", "log-critical"); 
        failed = true; 
    } else { 
        player.energy = Math.max(0, player.energy - costEnergy); 
    }
    
    if (failed) {
        // 暫時顯示警告狀態
        gameState.enemy = { name: "身體極限", emoji: "😫", hp: player.hp, maxHp: player.maxHP, atk: 0 };
        UI.renderMainScreen();
        if (player.hp <= 0) { gameOver("在飢餓與過勞中倒下"); return false; }
    }

    if (player.state === "中毒") {
        player.hp -= 5; UI.addLog("中毒發作，你損失 5 HP。", "log-battle");
        if (player.hp <= 0) { gameOver("中毒而亡"); return false; }
    }
    UI.updateStatus(); return true;
}

export function exploreNearby() { if (!canDoExplore(5, 5)) return; stats.exploredNearby++; UI.addLog("🔍 你在附近小心搜索……"); startCooldown(COOLDOWNS.NEARBY); setTimeout(() => { if (player.alive) { resolveNearby(); advanceDay(); } }, COOLDOWNS.NEARBY * 1000); }
export function exploreDungeon() { if (!canDoExplore(10, 15)) return; stats.exploredDungeon++; UI.addLog("🕳️ 你走入陰暗的地下城……"); startCooldown(COOLDOWNS.DUNGEON); setTimeout(() => { if (player.alive) { resolveDungeon(); advanceDay(); } }, COOLDOWNS.DUNGEON * 1000); }
export function exploreExpedition() { if (!canDoExplore(25, 30)) return; stats.exploredExpedition++; UI.addLog("🏕️ 你踏上長時間遠征……"); startCooldown(COOLDOWNS.EXPEDITION); setTimeout(() => { if (player.alive) { resolveExpedition(); advanceDay(); } }, COOLDOWNS.EXPEDITION * 1000); }

function resolveNearby() { 
    if (gameState.enemy && gameState.enemy.name === "身體極限") gameState.enemy = null; // 清除警告圖示
    if (maybeMerchant("nearby")) return; 
    const r = Math.random(); 
    addExp(10); 
    if (r < 0.4) startBattle("nearby", 1); 
    else if (r < 0.8) lootRandomItem("food"); 
    else lootRandomItem("material"); 
}
function resolveDungeon() { 
    if (gameState.enemy && gameState.enemy.name === "身體極限") gameState.enemy = null;
    if (maybeMerchant("dungeon")) return; 
    const r = Math.random(); 
    addExp(20); 
    if (r < 0.8) startBattle("dungeon", 2); 
    else lootRandomItem("treasure"); 
}
function resolveExpedition() { 
    if (gameState.enemy && gameState.enemy.name === "身體極限") gameState.enemy = null;
    if (maybeMerchant("expedition")) return; 
    const r = Math.random(); 
    addExp(40); 
    if (r < 0.2) startBattle("expedition", 3); 
    else if (r < 0.6) lootRandomItem("treasure"); 
    else lootRandomItem("food"); 
}

// ================== 物品與裝備系統 (含堆疊邏輯) ==================

// 核心：加入背包 (處理堆疊)
export function addToInventory(newItem) {
    if (newItem.stackable) {
        const existingItem = inventory.find(i => i.id === newItem.id);
        if (existingItem) {
            if (!existingItem.count) existingItem.count = 1;
            existingItem.count++;
            // 這裡可以選擇是否顯示 Log，避免洗頻
            // UI.addLog(`獲得 ${newItem.name} (持有: ${existingItem.count})`, "log-system");
            return;
        }
    }
    // 新物品或不可堆疊
    newItem.count = 1;
    inventory.push(newItem);
}

function generateRandomEquipment(level) { 
    const minL = 1; const maxL = level + 2; 
    let candidates = EQUIP_TEMPLATES.filter(e => e.minLvl <= maxL); 
    if (candidates.length === 0) candidates = [EQUIP_TEMPLATES[0]]; 
    const template = candidates[Math.floor(Math.random() * candidates.length)]; 
    
    let quality = ITEM_PREFIXES[1]; 
    const roll = Math.random(); 
    if (roll < 0.2) quality = ITEM_PREFIXES[0]; 
    else if (roll < 0.7) quality = ITEM_PREFIXES[1]; 
    else if (roll < 0.85) quality = ITEM_PREFIXES[2]; 
    else if (roll < 0.95) quality = ITEM_PREFIXES[3]; 
    else if (roll < 0.99) quality = ITEM_PREFIXES[4]; 
    else quality = ITEM_PREFIXES[5]; 

    let stats = {}; 
    if(template.baseAtk) stats.atk = Math.floor(template.baseAtk * quality.mod); 
    if(template.baseDef) stats.def = Math.floor(template.baseDef * quality.mod); 
    if(template.magicAtk) stats.magicAtk = Math.floor(template.magicAtk * quality.mod); 
    if(template.str) stats.str = Math.ceil(template.str * quality.mod); 
    if(template.int) stats.int = Math.ceil(template.int * quality.mod); 
    if(template.agi) stats.agi = Math.ceil(template.agi * quality.mod); 
    if(template.con) stats.con = Math.ceil(template.con * quality.mod); 
    if(template.hp) stats.hp = Math.floor(template.hp * quality.mod); 
    if(template.mp) stats.mp = Math.floor(template.mp * quality.mod); 

    const sellPrice = Math.max(1, Math.floor((template.minLvl * 10 + 5) * quality.mod)); 
    const buyPrice = sellPrice * 3; 

    return { 
        name: quality.name + template.name, 
        emoji: template.emoji, 
        type: "equip", 
        slot: template.type, 
        stats: stats, 
        sellPrice: sellPrice, 
        price: buyPrice, 
        usable: false,
        stackable: false // 裝備不堆疊
    }; 
}

function lootRandomItem(type) { 
    if (type === "food") { 
        const item = { ...CONSUMABLES[0] }; 
        item.sellPrice = 5; 
        addToInventory(item); // 使用新函式
        UI.addLog(`🍱 你找到 ${item.name}，已放入背包。`, "log-system"); 
    } 
    else if (type === "treasure") { 
        if (Math.random() < 0.5) { 
            const potion = { ...CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)] }; 
            if(potion.type === "food") potion.type = "heal"; 
            potion.sellPrice = Math.floor(potion.price / 2); 
            addToInventory(potion); // 使用新函式
            UI.addLog(`✨ 你找到 ${potion.name}！`, "log-system"); 
        } else { 
            const mat = { id: "mat_common", name: "普通素材", emoji: "🧩", type: "material", usable: false, sellPrice: 10, stackable: true }; 
            addToInventory(mat); // 使用新函式
            UI.addLog("🧩 你撿到一些普通素材。", "log-system"); 
        } 
    } 
    else if (type === "material") { 
        const mat = { id: "mat_common", name: "普通素材", emoji: "🧩", type: "material", usable: false, sellPrice: 5, stackable: true }; 
        addToInventory(mat); // 使用新函式
        UI.addLog("🧩 你撿到一些普通素材。", "log-system"); 
    } 
    UI.updateInventory(); 
    autoSave(); 
}

export function equipItem(index) { 
    const item = inventory[index]; 
    if (!item || item.type !== "equip") return; 
    const slot = item.slot; 
    const currentEquip = player.equipment[slot]; 
    
    if (currentEquip) addToInventory(currentEquip); // 卸下的裝備放回背包
    
    player.equipment[slot] = item; 
    // 裝備不可堆疊，直接移除
    inventory.splice(index, 1); 
    
    UI.addLog(`你裝備了 ${item.name}。`); 
    UI.updateStatus(); 
    UI.updateInventory(); 
    autoSave(); 
}

export function unequipItem(slot) { 
    const item = player.equipment[slot]; 
    if (!item) return; 
    player.equipment[slot] = null; 
    addToInventory(item); // 放回背包
    UI.addLog(`你卸下了 ${item.name}。`); 
    UI.updateStatus(); 
    UI.updateInventory(); 
    autoSave(); 
}

export function useItem(i) { 
    const item = inventory[i]; 
    if (item.type === "equip") { equipItem(i); return; } 
    
    let used = false;
    if (item.type === "heal") { 
        if (player.hp >= player.maxHP) { UI.addLog("HP 已經滿了。", "log-system"); return; }
        player.hp = Math.min(player.maxHP, player.hp + item.value); 
        UI.addLog(`🧪 使用 ${item.name}，恢復 ${item.value} HP！`); 
        used = true;
    } else if (item.type === "food") { 
        if (player.hunger >= player.hungerMax) { UI.addLog("還不餓。", "log-system"); return; }
        player.hunger = Math.min(player.hungerMax, player.hunger + item.value); 
        UI.addLog(`🍱 吃掉 ${item.name}，恢復 ${item.value} 飢餓！`); 
        used = true;
    } else if (item.type === "mana") { 
        if (player.mp >= player.maxMP) { UI.addLog("MP 已經滿了。", "log-system"); return; }
        player.mp = Math.min(player.maxMP, player.mp + item.value); 
        UI.addLog(`🧪 使用 ${item.name}，恢復 ${item.value} MP！`); 
        used = true;
    } 
    
    if (used && item.type !== "equip") { 
        // 堆疊消耗
        if (item.count > 1) {
            item.count--;
        } else {
            inventory.splice(i, 1); 
        }
        UI.updateStatus(); 
        UI.updateInventory(); 
        autoSave(); 
    } 
}

export function sellOneItem(i) { 
    if (!gameState.merchantActive) { UI.addLog("需在商人處才能出售。"); return; } 
    const item = inventory[i]; 
    if (!item.sellPrice) return; 
    
    player.gold += item.sellPrice; 
    UI.addLog(`賣出 ${item.name} (+${item.sellPrice} G)`, "log-system"); 
    
    // 堆疊出售
    if (item.count > 1) {
        item.count--;
    } else {
        inventory.splice(i, 1); 
    }
    
    UI.updateStatus(); 
    UI.updateInventory(); 
    renderMerchantUI(`你賣掉了 ${item.name} (+${item.sellPrice} G)`); 
    autoSave(); 
}

export function dropItem(i) { 
    const item = inventory[i];
    UI.addLog(`丟棄了 ${item.name}`, "log-system"); 
    
    // 堆疊丟棄
    if (item.count > 1) {
        item.count--;
    } else {
        inventory.splice(i, 1); 
    }
    
    UI.updateInventory(); 
    autoSave(); 
}

// ================== 戰鬥系統 ==================
function startBattle(zone, difficulty = 1) {
    gameState.mode = "battle";
    gameState.inBattle = true;
    gameState.isProcessingTurn = false;

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
        speed: 10 + finalLvl 
    };

    UI.addLog(`遭遇敵人：${gameState.enemy.name} (Lv.${gameState.enemy.lvl})`, "log-battle");
    // renderMainScreen 會在 addLog 裡自動呼叫
}

export function handleCombat(action, skillId = null) {
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
    UI.renderMainScreen(); // 刷新讓按鈕反灰

    let finalPlayerSpeed = playerSpeed + speedMod + Math.random() * 2;
    let enemySpeed = gameState.enemy.speed + Math.random() * 2;
    const playerGoesFirst = finalPlayerSpeed >= enemySpeed;

    if (playerGoesFirst) {
        UI.addLog(`⚡ 你動作較快！`, "log-system");
        doPlayerMove(action, skillId);
        if (gameState.enemy && gameState.enemy.hp > 0) {
            setTimeout(() => { 
                doEnemyMove(); 
                gameState.isProcessingTurn = false; 
                UI.renderMainScreen();
            }, 600);
        } else { 
            // 敵人死，不用解鎖，會直接 winBattle 重置
        }
    } else {
        UI.addLog(`🐢 敵人動作較快！`, "log-system");
        doEnemyMove();
        if (player.hp > 0) {
            setTimeout(() => { 
                doPlayerMove(action, skillId); 
                gameState.isProcessingTurn = false; 
                UI.renderMainScreen();
            }, 600);
        } else { 
            // 玩家死，不用解鎖，會直接 gameOver
        }
    }
}

function doPlayerMove(action, skillId) {
    if (!gameState.inBattle || !player.alive) return;
    const enemy = gameState.enemy;
    let enemyDodge = (enemy.dodge || 0) + (enemy.lvl * 0.5);
    let hitChance = player.hitRate - enemyDodge;

    if (action === 'skill' && skillId) {
        const skill = SKILLS.find(s => s.id === skillId);
        player.mp -= skill.cost; UI.updateStatus(); 
    }

    if (Math.random() * 100 > hitChance) {
        UI.addLog(`你的攻擊未命中！`, "log-battle"); UI.triggerShake(); return;
    }

    let dmg = 0; let isMagic = (player.job === "法師"); let skill = null;
    if (action === 'skill' && skillId) {
        skill = SKILLS.find(s => s.id === skillId); if (skill && skill.type === "magic") isMagic = true;
    }
    let baseDmg = isMagic ? player.magicAtk : player.atk;
    let multiplier = skill ? skill.dmgScale : 1.0;
    if (isMagic) dmg = baseDmg * multiplier; else dmg = Math.max(1, baseDmg * multiplier - enemy.def);

    let crit = false; let critChance = player.critChance + (skill ? (skill.critBonus || 0) : 0);
    if (Math.random() * 100 < critChance) { dmg = Math.floor(dmg * 1.5); crit = true; }
    dmg = Math.floor(dmg * (0.9 + Math.random() * 0.2));
    
    enemy.hp -= dmg; if (enemy.hp < 0) enemy.hp = 0;

    let actionName = skill ? skill.name : "攻擊";
    let msg = `你對 ${enemy.name} 使用 ${actionName} 造成 ${dmg} 傷害。(${enemy.name} 剩 ${enemy.hp} HP)`;
    if (crit) msg = "💥 暴擊！" + msg;
    UI.addLog(msg, crit ? "log-critical" : "log-battle"); UI.triggerShake();

    if (enemy.hp <= 0) { setTimeout(() => winBattle(), 300); }
}

function doEnemyMove() {
    if (!gameState.inBattle || !player.alive || !gameState.enemy || gameState.enemy.hp <= 0) return;
    const enemy = gameState.enemy;
    if (Math.random() * 100 < player.dodge) {
        UI.addLog(`你閃避了 ${enemy.name} 的攻擊！`, "log-battle");
    } else {
        let dmg = Math.max(1, enemy.atk - player.def);
        dmg = Math.floor(dmg * (0.8 + Math.random() * 0.4));
        player.hp -= dmg;
        let displayHp = Math.max(0, Math.floor(player.hp));
        UI.addLog(`${enemy.name} 對你造成 ${dmg} 傷害。(${player.name} 剩 ${displayHp} HP)`, "log-battle");
        UI.triggerShake();
    }
    if (player.hp <= 0) { player.hp = 0; setTimeout(() => gameOver("戰鬥中陣亡"), 300); }
    UI.updateStatus();
}

// src/logic.js 的 runAway 函式

export function runAway() {
    if (!gameState.inBattle || !player.alive || gameState.isProcessingTurn) return;
    
    // 鎖定介面
    gameState.isProcessingTurn = true;
    UI.renderMainScreen();

    let escapeChance = 50 + (player.speed * 2); 
    
    if (Math.random() * 100 < escapeChance) {
        // === 逃跑成功 ===
        gameState.inBattle = false; 
        gameState.mode = "normal"; 
        
        // 🚨 關鍵修正：必須清空敵人，否則頭像會卡在畫面上
        gameState.enemy = null;

        UI.addLog("🏃‍♂️ 你成功脫離了戰鬥。", "log-battle");
        gameState.isProcessingTurn = false; 
        
        // 刷新畫面 (這時候因為 enemy 是 null，就會顯示 "探索中" 的帳篷圖示)
        UI.renderMainScreen(); 
        UI.showMainActions(); // 確保按鈕回來
        autoSave();
    } else {
        // === 逃跑失敗 ===
        UI.addLog("🚫 逃跑失敗！被敵人抓住了！", "log-critical");
        setTimeout(() => { 
            doEnemyMove(); 
            gameState.isProcessingTurn = false; 
            UI.renderMainScreen();
        }, 500);
    }
}

function winBattle() {
    const enemy = gameState.enemy;
    if (!enemy || !gameState.inBattle) return;
    gameState.inBattle = false; gameState.mode = "normal"; gameState.enemy = null; gameState.isProcessingTurn = false;
    UI.addLog(`🎉 擊敗了 ${enemy.name}！`, "log-battle");
    addExp(enemy.exp || 10); stats.kills++;
    const goldGain = 5 + Math.floor(Math.random() * 11) + (enemy.lvl * 2);
    player.gold += goldGain; UI.addLog(`獲得 ${goldGain} G`, "log-system");
    
    const baseDrop = enemy.dropRate || 0.1;
    const dropChance = baseDrop + (player.int * 0.01);
    if (Math.random() < dropChance) {
        if (Math.random() < 0.8) {
            const newItem = generateRandomEquipment(enemy.lvl); 
            // 裝備不堆疊，直接 push
            inventory.push(newItem); 
            UI.addLog(`🎁 掉落裝備：${newItem.name}`, "log-system");
        } else { 
            lootRandomItem("treasure"); 
        }
        UI.updateInventory();
    }
    UI.updateStatus(); UI.showMainActions(); autoSave();
}

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

export function buyItem(index) {
    const item = gameState.merchantGoods[index];
    if (!item || typeof item.price !== 'number') return;
    if (player.gold < item.price) { UI.addLog(`金錢不足，你需要 ${item.price} G`, "log-system"); return; }
    player.gold -= item.price; 
    
    // 使用堆疊邏輯加入背包
    addToInventory({ ...item });
    
    UI.updateStatus(); UI.updateInventory(); UI.addLog(`購買了 ${item.name}`, "log-system");
    renderMerchantUI(`感謝購買！已獲得 ${item.name}。`); autoSave();
}

export function sellAllMaterials() {
    let total = 0;
    for(let i = inventory.length - 1; i >= 0; i--){
        if (inventory[i].type === "material" && inventory[i].sellPrice) {
            // 賣出所有堆疊
            const count = inventory[i].count || 1;
            total += inventory[i].sellPrice * count; 
            inventory.splice(i, 1);
        }
    }
    if (total > 0) { player.gold += total; UI.updateStatus(); UI.updateInventory(); UI.addLog(`出售素材獲得 ${total} G`, "log-system"); autoSave(); } 
    else { UI.addLog("沒有素材可賣", "log-system"); }
}

export function closeMerchant() {
    gameState.merchantActive = false; gameState.merchantGoods = []; gameState.mode = "normal";
    UI.addLog("結束交易"); UI.updateInventory(); UI.showMainActions();
}

// ================== 休息系統 (更新：飢餓懲罰 + 刷新畫面) ==================
export function rest() {
    if (!gameState.canAct || !player.alive || gameState.inBattle || gameState.merchantActive) return;
    
    // 檢查飢餓
    let hungerCost = 20;
    let isStarving = player.hunger < hungerCost;

    UI.addLog("😴 你決定稍作休息……");
    startCooldown(COOLDOWNS.REST);
    
    setTimeout(() => {
        if (!player.alive) return;
        
        // 1. 處理飢餓與隨機事件
        if (isStarving) {
            player.hunger = 0;
            player.hp -= 10;
            UI.addLog("⚠️ 肚子太餓了，睡得不好... (HP -10)", "log-critical");
        } else {
            player.hunger -= hungerCost;
        }

        const r = Math.random();
        if (r < 0.2) {
            startBattle("nearby", 1);
            UI.addLog("休息時遭到偷襲！", "log-battle");
        } else if (r < 0.3) {
            const dmg = 15; player.hp -= dmg; player.state = "中毒";
            UI.addLog(`中毒！受到 ${dmg} 傷害`, "log-critical");
            if (player.hp <= 0) gameOver("休息時遭毒害");
            UI.updateStatus();
        } else {
            let healHP = 20 + player.con * 2; 
            let healMP = 10 + player.int * 2; 
            let healEnergy = 25 + player.con * 2;

            if (isStarving) {
                healHP = Math.floor(healHP / 2);
                healMP = Math.floor(healMP / 2);
                healEnergy = Math.floor(healEnergy / 2);
            }

            player.hp = Math.min(player.maxHP, player.hp + healHP);
            player.mp = Math.min(player.maxMP, player.mp + healMP);
            player.energy = Math.min(player.energyMax, player.energy + healEnergy);
            
            addExp(5);
            UI.addLog(`休息後恢復了體力與傷口`);
        }
        
        advanceDay();
        UI.updateStatus();
        
        // ★★★ 關鍵修正：強制刷新主畫面，確保圖示變回探索 ★★★
        if (!gameState.inBattle) UI.renderMainScreen();
        
        autoSave();
    }, COOLDOWNS.REST * 1000);
}

// ... System ...
function gameOver(reason) { player.alive = false; player.hp = 0; UI.updateStatus(); UI.writeEvent("💀 你死亡了……"); UI.addLog(`死因：${reason}`, "log-critical"); document.getElementById("actions").innerHTML = ""; const deathSummary = document.getElementById("deathSummary"); let bagList = inventory.map(i => `${i.emoji}${i.name} x${i.count || 1}`).join("、") || "（無物品）"; deathSummary.innerHTML = `<p>存活天數：${player.day} | 原因：${reason}</p><p>等級：Lv ${player.level} | 擊殺數：${stats.kills}</p><p>背包：${bagList}</p>`; document.getElementById("overlay").style.display = "flex"; document.getElementById("deathPanel").style.display = "block"; document.getElementById("namePanel").style.display = "none"; document.getElementById("jobPanel").style.display = "none"; autoSave(); }
export function confirmName() { const input = document.getElementById("nameInput"); player.name = input.value.trim() || "無名冒險者"; document.getElementById("namePanel").style.display = "none"; document.getElementById("jobPanel").style.display = "block"; }
export function chooseJob(jobKey) { player.str = 0; player.agi = 0; player.con = 0; player.int = 0; player.equipment = { head: null, body: null, weapon: null, accessory: null }; player.learnedSkills = []; player.equippedSkills = []; if (jobKey === "warrior") { player.job = "戰士"; player.str = 5; player.con = 5; player.learnedSkills.push("s_bash"); player.equippedSkills.push("s_bash"); } else if (jobKey === "archer") { player.job = "弓箭手"; player.agi = 6; player.str = 2; player.int = 2; player.learnedSkills.push("s_double_shot"); player.equippedSkills.push("s_double_shot"); } else if (jobKey === "rogue") { player.job = "盜賊"; player.str = 3; player.agi = 5; player.int = 2; player.learnedSkills.push("s_backstab"); player.equippedSkills.push("s_backstab"); } else if (jobKey === "mage") { player.job = "法師"; player.int = 8; player.con = 1; player.agi = 1; player.learnedSkills.push("s_fireball"); player.equippedSkills.push("s_fireball"); } UI.updateInventory(); player.hp = player.maxHP; player.mp = player.maxMP; UI.updateStatus(); player.hp = player.maxHP; player.mp = player.maxMP; UI.updateStatus(); document.getElementById("overlay").style.display = "none"; UI.addLog(`冒險者 ${player.name} (${player.job}) 開始了旅程`, "log-system"); gameState.mode = "normal"; gameState.canAct = true; UI.renderMainScreen(); UI.showMainActions(); autoSave(); }
export function restartGame() { resetGameData(); UI.updateInventory(); UI.updateStatus(); document.getElementById("eventBox").innerText = "請先輸入名字與選擇職業。"; document.getElementById("actions").innerHTML = ""; document.getElementById("deathPanel").style.display = "none"; document.getElementById("namePanel").style.display = "block"; document.getElementById("jobPanel").style.display = "none"; document.getElementById("overlay").style.display = "flex"; }