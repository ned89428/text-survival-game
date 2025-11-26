import { player, gameState, stats, inventory, COOLDOWNS, resetGameData } from './state.js';
import * as UI from './ui.js';
import { ENEMIES } from './data/enemies.js';
import { EQUIP_TEMPLATES, ITEM_PREFIXES, CONSUMABLES } from './data/items.js';
import { SKILLS } from './data/skills.js'; // 引入技能

// ... (存檔、基礎系統、冷卻、探索邏輯 保持不變，省略以節省篇幅，請確保上方這些 import 是新的) ...
// 請將下方這些函式覆蓋您原本的 logic.js 內容，或是複製全部。
// 為了避免遺漏，這裡提供完整 logic.js 內容。

// ================== 存檔系統 ==================
function autoSave() {
    if (!player.alive && player.day > 1) { }
    const data = { player, inventory, gameState: { ...gameState, inBattle: false, enemy: null, battleLog: [] }, stats };
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
        data.inventory.forEach(item => inventory.push(item));
        Object.assign(gameState, data.gameState);
        Object.assign(stats, data.stats);
        
        gameState.mode = "normal";
        gameState.inBattle = false;
        gameState.canAct = true;
        gameState.cooldownTimerId = null;
        gameState.enemy = null;

        if (!player.alive) { gameOver("歷史紀錄 (已死亡)"); return; }
        UI.updateStatus(); UI.updateInventory();
        document.getElementById("overlay").style.display = "none";
        UI.writeEvent(`歡迎回來，${player.name}。繼續你的第 ${player.day} 天冒險。`);
        UI.showMainActions();
    } catch (e) { console.error(e); document.getElementById("overlay").style.display = "flex"; }
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
        t--; if (t <= 0) { clearInterval(gameState.cooldownTimerId); gameState.cooldownTimerId = null; gameState.canAct = true; if (!gameState.merchantActive) UI.renderMainScreen(); } else { UI.updateCooldownButtons(t); }
    }, 1000);
}

function canDoExplore(costHunger, costEnergy) {
    if (!player.alive || !gameState.canAct || gameState.inBattle || gameState.merchantActive) return false;
    if (gameState.battleLog.length > 0 && !gameState.inBattle) gameState.battleLog = [];
    let failed = false;
    if (player.hunger <= 0) { player.hp -= 15; UI.addBattleLog("⚠️ 肚子餓扁了還強行探索... HP -15", "log-critical"); failed = true; } else { player.hunger = Math.max(0, player.hunger - costHunger); }
    if (player.energy <= 0) { player.hp -= 10; UI.addBattleLog("⚠️ 累得要死還強行探索... HP -10", "log-critical"); failed = true; } else { player.energy = Math.max(0, player.energy - costEnergy); }
    if (failed) {
        gameState.enemy = { name: "身體極限", emoji: "😫", hp: player.hp, maxHp: player.maxHP, atk: 0 };
        UI.renderMainScreen();
        if (player.hp <= 0) { gameOver("在飢餓與過勞中倒下"); return false; }
    }
    if (player.state === "中毒") {
        player.hp -= 5; UI.addBattleLog("中毒發作，你損失 5 HP。", "log-battle");
        if (player.hp <= 0) { gameOver("中毒而亡"); return false; }
    }
    UI.updateStatus(); return true;
}

export function exploreNearby() { if (!canDoExplore(5, 5)) return; stats.exploredNearby++; UI.addLog("🔍 你在附近小心搜索……"); startCooldown(COOLDOWNS.NEARBY); setTimeout(() => { if (player.alive) { resolveNearby(); advanceDay(); } }, COOLDOWNS.NEARBY * 1000); }
export function exploreDungeon() { if (!canDoExplore(10, 15)) return; stats.exploredDungeon++; UI.addLog("🕳️ 你走入陰暗的地下城……"); startCooldown(COOLDOWNS.DUNGEON); setTimeout(() => { if (player.alive) { resolveDungeon(); advanceDay(); } }, COOLDOWNS.DUNGEON * 1000); }
export function exploreExpedition() { if (!canDoExplore(25, 30)) return; stats.exploredExpedition++; UI.addLog("🏕️ 你踏上長時間遠征……"); startCooldown(COOLDOWNS.EXPEDITION); setTimeout(() => { if (player.alive) { resolveExpedition(); advanceDay(); } }, COOLDOWNS.EXPEDITION * 1000); }

function resolveNearby() { if (gameState.enemy && gameState.enemy.name === "身體極限") gameState.enemy = null; if (maybeMerchant("nearby")) return; const r = Math.random(); addExp(10); if (r < 0.4) startBattle("nearby", 1); else if (r < 0.8) lootRandomItem("food"); else lootRandomItem("material"); }
function resolveDungeon() { if (gameState.enemy && gameState.enemy.name === "身體極限") gameState.enemy = null; if (maybeMerchant("dungeon")) return; const r = Math.random(); addExp(20); if (r < 0.8) startBattle("dungeon", 2); else lootRandomItem("treasure"); }
function resolveExpedition() { if (gameState.enemy && gameState.enemy.name === "身體極限") gameState.enemy = null; if (maybeMerchant("expedition")) return; const r = Math.random(); addExp(40); if (r < 0.2) startBattle("expedition", 3); else if (r < 0.6) lootRandomItem("treasure"); else lootRandomItem("food"); }

// ... (物品生成 generateRandomEquipment, lootRandomItem, equipItem, unequipItem, useItem, sellOneItem, dropItem 保持不變，請複製之前的) ...
// 為了節省長度，這裡省略物品部分的代碼，請務必保留原有的物品相關函式！
// 如果您沒有備份，請告訴我，我再貼一次完整的物品部分。
// (這裡假設您保留了物品相關函式，直接進入戰鬥系統更新)

// === 補回物品函式以防萬一 ===
function generateRandomEquipment(level) { const minL = 1; const maxL = level + 2; let candidates = EQUIP_TEMPLATES.filter(e => e.minLvl <= maxL); if (candidates.length === 0) candidates = [EQUIP_TEMPLATES[0]]; const template = candidates[Math.floor(Math.random() * candidates.length)]; let quality = ITEM_PREFIXES[1]; const roll = Math.random(); if (roll < 0.2) quality = ITEM_PREFIXES[0]; else if (roll < 0.7) quality = ITEM_PREFIXES[1]; else if (roll < 0.85) quality = ITEM_PREFIXES[2]; else if (roll < 0.95) quality = ITEM_PREFIXES[3]; else if (roll < 0.99) quality = ITEM_PREFIXES[4]; else quality = ITEM_PREFIXES[5]; let stats = {}; if(template.baseAtk) stats.atk = Math.floor(template.baseAtk * quality.mod); if(template.baseDef) stats.def = Math.floor(template.baseDef * quality.mod); if(template.magicAtk) stats.magicAtk = Math.floor(template.magicAtk * quality.mod); if(template.str) stats.str = Math.ceil(template.str * quality.mod); if(template.int) stats.int = Math.ceil(template.int * quality.mod); if(template.agi) stats.agi = Math.ceil(template.agi * quality.mod); if(template.con) stats.con = Math.ceil(template.con * quality.mod); if(template.hp) stats.hp = Math.floor(template.hp * quality.mod); if(template.mp) stats.mp = Math.floor(template.mp * quality.mod); const sellPrice = Math.max(1, Math.floor((template.minLvl * 10 + 5) * quality.mod)); const buyPrice = sellPrice * 3; return { name: quality.name + template.name, emoji: template.emoji, type: "equip", slot: template.type, stats: stats, sellPrice: sellPrice, price: buyPrice, usable: false }; }
function lootRandomItem(type) { if (type === "food") { const item = { ...CONSUMABLES[0] }; item.sellPrice = 5; inventory.push(item); UI.writeEvent(`🍱 你找到 ${item.name}，已放入背包。`); } else if (type === "treasure") { if (Math.random() < 0.5) { const potion = { ...CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)] }; if(potion.type === "food") potion.type = "heal"; potion.sellPrice = Math.floor(potion.price / 2); inventory.push(potion); UI.writeEvent(`✨ 你找到 ${potion.name}！`); } else { const mat = { name: "普通素材", emoji: "🧩", type: "material", usable: false, sellPrice: 10 }; inventory.push(mat); UI.writeEvent("🧩 你撿到一些普通素材。"); } } else if (type === "material") { const mat = { name: "普通素材", emoji: "🧩", type: "material", usable: false, sellPrice: 5 }; inventory.push(mat); UI.writeEvent("🧩 你撿到一些普通素材。"); } UI.updateInventory(); autoSave(); }
export function equipItem(index) { const item = inventory[index]; if (!item || item.type !== "equip") return; const slot = item.slot; const currentEquip = player.equipment[slot]; if (currentEquip) inventory.push(currentEquip); player.equipment[slot] = item; inventory.splice(index, 1); UI.writeEvent(`你裝備了 ${item.name}。`); UI.updateStatus(); UI.updateInventory(); autoSave(); }
export function unequipItem(slot) { const item = player.equipment[slot]; if (!item) return; player.equipment[slot] = null; inventory.push(item); UI.writeEvent(`你卸下了 ${item.name}。`); UI.updateStatus(); UI.updateInventory(); autoSave(); }
export function useItem(i) { const item = inventory[i]; if (item.type === "equip") { equipItem(i); return; } if (item.type === "heal") { player.hp = Math.min(player.maxHP, player.hp + item.value); UI.writeEvent(`🧪 你使用了 ${item.name}，恢復 ${item.value} HP！`); } else if (item.type === "food") { player.hunger = Math.min(player.hungerMax, player.hunger + item.value); UI.writeEvent(`🍱 你吃掉了 ${item.name}，飢餓恢復 ${item.value}！`); } else if (item.type === "mana") { player.mp = Math.min(player.maxMP, player.mp + item.value); UI.writeEvent(`🧪 你使用了 ${item.name}，恢復 ${item.value} MP！`); } if (item.type !== "equip") { inventory.splice(i, 1); UI.updateStatus(); UI.updateInventory(); autoSave(); } }
export function sellOneItem(i) { if (!gameState.merchantActive) { UI.writeEvent("沒有商人在這裡，無法出售物品。"); return; } const item = inventory[i]; if (!item.sellPrice) return; player.gold += item.sellPrice; UI.addLog(`賣出 ${item.name}，獲得 ${item.sellPrice} G。`, "log-system"); inventory.splice(i, 1); UI.updateStatus(); UI.updateInventory(); renderMerchantUI(`你賣掉了 ${item.name} (+${item.sellPrice} G)`); autoSave(); }
export function dropItem(i) { UI.addLog(`丟棄了 ${inventory[i].name}`, "log-system"); inventory.splice(i, 1); UI.updateInventory(); autoSave(); }

// ================== 戰鬥系統 (核心大更新：速度判定) ==================

function startBattle(zone, difficulty = 1) {
    gameState.mode = "battle";
    gameState.inBattle = true;
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
        // 怪物速度：基礎 10 + 等級 (比玩家略快一點，除非玩家有點敏捷)
        speed: 10 + finalLvl 
    };

    UI.addBattleLog(`遭遇敵人：${gameState.enemy.name} (Lv.${gameState.enemy.lvl})`, "log-battle");
    UI.renderMainScreen();
}

// 戰鬥入口函式 (處理按鈕點擊)
export function handleCombat(action, skillId = null) {
    if (!gameState.inBattle || !player.alive) return;

    if (action === 'run') {
        runAway();
        return;
    }

    // 決定本次動作參數
    let playerSpeed = player.speed;
    let speedMod = 0;
    let cost = 0;
    let costType = null;

    if (action === 'skill' && skillId) {
        const skill = SKILLS.find(s => s.id === skillId);
        if (!skill) return;
        // 檢查 MP
        if (player.mp < skill.cost) {
            UI.addBattleLog("MP 不足！無法施放技能。", "log-system");
            return;
        }
        cost = skill.cost;
        speedMod = skill.speedMod || 0;
    }

    // 1. 計算速度與順序
    let finalPlayerSpeed = playerSpeed + speedMod;
    let enemySpeed = gameState.enemy.speed;
    
    // 隨機波動 (讓速度接近時會有變數)
    finalPlayerSpeed += Math.random() * 2;
    enemySpeed += Math.random() * 2;

    const playerGoesFirst = finalPlayerSpeed >= enemySpeed;

    // 2. 執行回合
    // 這裡使用 async/await 或簡單的順序呼叫
    // 為求簡單，直接依序執行，若中間死亡則中斷
    
    if (playerGoesFirst) {
        UI.addBattleLog(`⚡ 你動作較快！(速 ${Math.floor(finalPlayerSpeed)} vs ${Math.floor(enemySpeed)})`, "log-system");
        doPlayerMove(action, skillId);
        if (gameState.enemy && gameState.enemy.hp > 0) {
            setTimeout(() => doEnemyMove(), 600); // 稍微延遲一點，讓戰鬥不那麼快
        }
    } else {
        UI.addBattleLog(`🐢 敵人動作較快！(速 ${Math.floor(finalPlayerSpeed)} vs ${Math.floor(enemySpeed)})`, "log-system");
        doEnemyMove();
        if (player.hp > 0) {
            setTimeout(() => doPlayerMove(action, skillId), 600);
        }
    }
}

// 執行玩家動作
function doPlayerMove(action, skillId) {
    if (!gameState.inBattle || !player.alive) return;
    const enemy = gameState.enemy;

    // 命中判定
    let enemyDodge = (enemy.dodge || 0) + (enemy.lvl * 0.5);
    let hitChance = player.hitRate - enemyDodge;

    // 扣除消耗
    if (action === 'skill' && skillId) {
        const skill = SKILLS.find(s => s.id === skillId);
        player.mp -= skill.cost;
        UI.updateStatus(); // 更新 MP 條
    }

    if (Math.random() * 100 > hitChance) {
        UI.addBattleLog(`你的攻擊未命中！`, "log-battle");
        UI.triggerShake();
        return;
    }

    let dmg = 0;
    let isMagic = (player.job === "法師");
    let msg = "";
    let skill = null;

    if (action === 'skill' && skillId) {
        skill = SKILLS.find(s => s.id === skillId);
        if (skill.type === "magic") isMagic = true;
    }

    // 計算基礎傷害
    let baseDmg = isMagic ? player.magicAtk : player.atk;
    
    // 技能倍率
    let multiplier = 1.0;
    if (skill) multiplier = skill.dmgScale;

    // 防禦抵免
    if (isMagic) {
        dmg = baseDmg * multiplier; // 魔法無視防禦 (簡單版)
    } else {
        dmg = Math.max(1, baseDmg * multiplier - enemy.def);
    }

    // 暴擊
    let crit = false;
    let critChance = player.critChance + (skill ? (skill.critBonus || 0) : 0);
    if (Math.random() * 100 < critChance) {
        dmg = Math.floor(dmg * 1.5);
        crit = true;
    }
    
    dmg = Math.floor(dmg * (0.9 + Math.random() * 0.2));
    enemy.hp -= dmg;
    if (enemy.hp < 0) enemy.hp = 0;

    let actionName = skill ? skill.name : "攻擊";
    msg = `你對 ${enemy.name} 使用 ${actionName} 造成 ${dmg} 傷害。(${enemy.name} 剩 ${enemy.hp} HP)`;
    if (crit) msg = "💥 暴擊！" + msg;
    
    UI.addBattleLog(msg, crit ? "log-critical" : "log-battle");
    UI.triggerShake();

    if (enemy.hp <= 0) {
        // 延遲一下顯示勝利，體驗更好
        setTimeout(() => winBattle(), 300);
    }
}

// 執行敵人動作
function doEnemyMove() {
    if (!gameState.inBattle || !player.alive || !gameState.enemy || gameState.enemy.hp <= 0) return;
    const enemy = gameState.enemy;

    if (Math.random() * 100 < player.dodge) {
        UI.addBattleLog(`你閃避了 ${enemy.name} 的攻擊！`, "log-battle");
    } else {
        let dmg = Math.max(1, enemy.atk - player.def);
        dmg = Math.floor(dmg * (0.8 + Math.random() * 0.4));
        
        player.hp -= dmg;
        let displayHp = Math.max(0, Math.floor(player.hp));
        UI.addBattleLog(`${enemy.name} 對你造成 ${dmg} 傷害。(${player.name} 剩 ${displayHp} HP)`, "log-battle");
        UI.triggerShake();
    }

    UI.updateStatus();
    if (player.hp <= 0) {
        player.hp = 0;
        setTimeout(() => gameOver("戰鬥中陣亡"), 300);
    }
}

export function runAway() {
    if (!gameState.inBattle || !player.alive) return;
    let escapeChance = 50 + (player.speed * 2); 
    if (Math.random() * 100 < escapeChance) {
        gameState.inBattle = false;
        gameState.mode = "normal"; 
        UI.addLog("🏃‍♂️ 你成功脫離了戰鬥。", "log-battle");
        autoSave();
    } else {
        UI.addBattleLog("🚫 逃跑失敗！被敵人抓住了！", "log-critical");
        // 逃跑失敗，直接挨打
        setTimeout(() => doEnemyMove(), 500);
    }
}

function winBattle() {
    const enemy = gameState.enemy;
    // 確保敵人真的死了才結算 (防止多重觸發)
    if (!enemy || !gameState.inBattle) return;

    gameState.inBattle = false;
    gameState.mode = "normal";
    gameState.enemy = null;

    UI.addLog(`🎉 擊敗了 ${enemy.name}！`, "log-battle");
    addExp(enemy.exp || 10);
    stats.kills++;
    const goldGain = 5 + Math.floor(Math.random() * 11) + (enemy.lvl * 2);
    player.gold += goldGain;
    UI.addLog(`獲得 ${goldGain} G`, "log-system");
    
    const baseDrop = enemy.dropRate || 0.1;
    const dropChance = baseDrop + (player.int * 0.01);
    
    if (Math.random() < dropChance) {
        if (Math.random() < 0.8) {
            const newItem = generateRandomEquipment(enemy.lvl);
            inventory.push(newItem);
            UI.addLog(`🎁 掉落裝備：${newItem.name}`, "log-system");
        } else {
            lootRandomItem("treasure");
        }
        UI.updateInventory();
    }
    UI.updateStatus();
    UI.showMainActions(); // 確保按鈕回來
    autoSave();
}

// ... (Merchant 與 System Functions 保持不變，請使用上一個版本的內容) ...
// 為了確保 main.js 能掛載到 handleCombat，記得匯出它。
// (下方這區塊請保留原本的代碼，或是從上一個回復複製)

export function rest() {
    if (!gameState.canAct || !player.alive || gameState.inBattle || gameState.merchantActive) return;
    UI.writeEvent("😴 你決定稍作休息……");
    startCooldown(COOLDOWNS.REST);
    setTimeout(() => {
        if (!player.alive) return;
        player.hunger = Math.max(0, player.hunger - 10);
        const r = Math.random();
        if (r < 0.2) {
            startBattle("nearby", 1);
            UI.addBattleLog("休息時遭到偷襲！", "log-battle");
        } else if (r < 0.3) {
            const dmg = 15; player.hp -= dmg; player.state = "中毒";
            UI.writeEvent(`中毒！受到 ${dmg} 傷害。`);
            if (player.hp <= 0) gameOver("休息時遭毒害");
            UI.updateStatus();
        } else {
            const healHP = 20 + player.con * 2; const healMP = 10 + player.int * 2; const healEnergy = 25 + player.con * 2;
            player.hp = Math.min(player.maxHP, player.hp + healHP);
            player.mp = Math.min(player.maxMP, player.mp + healMP);
            player.energy = Math.min(player.energyMax, player.energy + healEnergy);
            addExp(5);
            UI.writeEvent(`休息後恢復了體力與傷口。`);
        }
        advanceDay();
        UI.updateStatus();
        autoSave();
    }, COOLDOWNS.REST * 1000);
}

function maybeMerchant(from) {
    if (gameState.inBattle || gameState.merchantActive) return false;
    let chance = from === "nearby" ? 0.05 : from === "dungeon" ? 0.1 : 0.08;
    if (Math.random() < chance) { openMerchant(); return true; }
    return false;
}

function renderMerchantUI(message = "") {
    let html = "<b>流浪商人</b><br>他攤開貨物：<br><br>";
    gameState.merchantGoods.forEach((g, idx) => {
        html += `${idx+1}. ${g.emoji} ${g.name} - ${g.price}G<br>`;
    });
    if (message) html += `<div style="margin-top:10px; color:#f1c40f;">${message}</div>`;
    document.getElementById("eventBox").innerHTML = html;
    let btns = "";
    gameState.merchantGoods.forEach((g, i) => {
        btns += `<button onclick="buyItem(${i})">購買 ${g.name} (${g.price}G)</button>`;
    });
    document.getElementById("actions").innerHTML = `${btns}<button onclick="sellAllMaterials()">出售素材</button><button onclick="closeMerchant()">離開商人</button>`;
    UI.updateInventory();
}

function openMerchant() {
    gameState.merchantActive = true;
    const p1 = { ...CONSUMABLES[1] }; const p2 = { ...CONSUMABLES[3] }; const p3 = { ...CONSUMABLES[0] }; 
    const equip = generateRandomEquipment(player.level + 1);
    gameState.merchantGoods = [p1, p2, p3, equip];
    renderMerchantUI("歡迎光臨，看看有什麼需要的？");
}

export function buyItem(index) {
    const item = gameState.merchantGoods[index];
    if (!item || typeof item.price !== 'number') return;
    if (player.gold < item.price) { renderMerchantUI(`金錢不足，你需要 ${item.price} G。`); return; }
    player.gold -= item.price;
    inventory.push({ ...item });
    UI.updateStatus(); UI.updateInventory(); UI.addLog(`購買了 ${item.name}`, "log-system");
    renderMerchantUI(`感謝購買！已獲得 ${item.name}。`);
    autoSave();
}

export function sellAllMaterials() {
    let total = 0;
    for(let i = inventory.length - 1; i >= 0; i--){
        if (inventory[i].type === "material" && inventory[i].sellPrice) {
            total += inventory[i].sellPrice; inventory.splice(i, 1);
        }
    }
    if (total > 0) { player.gold += total; UI.updateStatus(); UI.updateInventory(); renderMerchantUI(`收購了你的素材，這是 ${total} G。`); autoSave(); } 
    else { renderMerchantUI("你身上沒有素材可以賣。"); }
}

export function closeMerchant() {
    gameState.merchantActive = false; gameState.merchantGoods = []; 
    UI.writeEvent("你結束了交易，繼續踏上旅程。"); UI.showMainActions(); UI.updateInventory();
}

function gameOver(reason) {
    player.alive = false; player.hp = 0;
    UI.updateStatus();
    UI.writeEvent("💀 你死亡了……（永久死亡）");
    UI.addLog(`死因：${reason}`, "log-critical");
    document.getElementById("actions").innerHTML = "";
    const deathSummary = document.getElementById("deathSummary");
    let bagList = inventory.map(i => `${i.emoji}${i.name}`).join("、") || "（無物品）";
    deathSummary.innerHTML = `<p>存活天數：${player.day} | 原因：${reason}</p><p>等級：Lv ${player.level} | 擊殺數：${stats.kills}</p><p>背包：${bagList}</p>`;
    document.getElementById("overlay").style.display = "flex";
    document.getElementById("deathPanel").style.display = "block";
    document.getElementById("namePanel").style.display = "none";
    document.getElementById("jobPanel").style.display = "none";
    autoSave();
}

export function confirmName() {
    const input = document.getElementById("nameInput");
    player.name = input.value.trim() || "無名冒險者";
    document.getElementById("namePanel").style.display = "none";
    document.getElementById("jobPanel").style.display = "block";
}

export function chooseJob(jobKey) {
    // 1. 初始化屬性
    player.str = 0; player.agi = 0; player.con = 0; player.int = 0;
    player.equipment = { head: null, body: null, weapon: null, accessory: null };
    
    // 2. 初始化技能
    player.learnedSkills = []; 
    player.equippedSkills = [];

    // 3. 設定職業數值與技能
    if (jobKey === "warrior") { 
        player.job = "戰士"; player.str = 5; player.con = 5; 
        player.learnedSkills.push("s_bash"); player.equippedSkills.push("s_bash"); 
    } 
    else if (jobKey === "archer") { 
        player.job = "弓箭手"; player.agi = 6; player.str = 2; player.int = 2; 
        player.learnedSkills.push("s_double_shot"); player.equippedSkills.push("s_double_shot"); 
    } 
    else if (jobKey === "rogue") { 
        player.job = "盜賊"; player.str = 3; player.agi = 5; player.int = 2; 
        player.learnedSkills.push("s_backstab"); player.equippedSkills.push("s_backstab"); 
    } 
    else if (jobKey === "mage") { 
        player.job = "法師"; player.int = 8; player.con = 1; player.agi = 1; 
        player.learnedSkills.push("s_fireball"); player.equippedSkills.push("s_fireball"); 
    }
    
    // 4. 補滿狀態
    UI.updateInventory();
    player.hp = player.maxHP; player.mp = player.maxMP;
    UI.updateStatus(); // 第一次更新 (算出 MaxHP)
    player.hp = player.maxHP; player.mp = player.maxMP;
    UI.updateStatus(); // 第二次更新 (補滿血)

    // 5. 隱藏創角視窗
    document.getElementById("overlay").style.display = "none";
    UI.addLog(`冒險者 ${player.name} (${player.job}) 開始了旅程`, "log-system");

    gameState.mode = "normal";
    gameState.canAct = true;
    UI.renderMainScreen(); // 畫出主畫面
    UI.showMainActions();  // 強制畫出下方按鈕
    
    autoSave();
}

export function restartGame() {
    resetGameData();
    UI.updateInventory();
    UI.updateStatus();
    document.getElementById("eventBox").innerText = "請先輸入名字與選擇職業。";
    document.getElementById("actions").innerHTML = "";
    document.getElementById("deathPanel").style.display = "none";
    document.getElementById("namePanel").style.display = "block";
    document.getElementById("jobPanel").style.display = "none";
    document.getElementById("overlay").style.display = "flex";
}