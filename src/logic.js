import { player, gameState, stats, inventory, stash, COOLDOWNS, resetGameData } from './state.js';
import * as UI from './ui.js';
import { ENEMIES } from './data/enemies.js';
import { EQUIP_TEMPLATES, ITEM_PREFIXES, CONSUMABLES } from './data/items.js';
import { SKILLS } from './data/skills.js'; 

// ================== 核心工具 ==================
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ================== 存檔系統 ==================
function autoSave() {
    if (!player.alive && player.day > 1) { }
    const data = { 
        player, inventory, stash, 
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
        
        inventory.length = 0;
        data.inventory.forEach(item => { if (!item.count) item.count = 1; inventory.push(item); });

        stash.length = 0;
        if (data.stash) data.stash.forEach(item => { if (!item.count) item.count = 1; stash.push(item); });

        Object.assign(gameState, data.gameState);
        Object.assign(stats, data.stats);
        
        if (!gameState.logs) gameState.logs = [];
        
        gameState.isProcessingTurn = false;
        gameState.canAct = true;
        gameState.cooldownTimerId = null;

        // 商人防呆
        if (gameState.mode === 'merchant' && (!gameState.merchantGoods || gameState.merchantGoods.length === 0)) {
            gameState.mode = 'normal';
            gameState.merchantActive = false;
        }
        // 戰鬥防呆
        if (gameState.mode === 'battle' && !gameState.enemy) {
            gameState.mode = 'normal';
            gameState.inBattle = false;
        }
        // 正常模式防呆
        if (gameState.mode === 'normal') {
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
    UI.addLog(`⬆️ 你升級了！現在是 Lv ${player.level}。`, "log-system"); autoSave();
}
export function toggleInventory() { }


// ================== 物品與倉庫系統 (完整補上) ==================
export function addToInventory(newItem) {
    if (newItem.stackable) {
        const existingItem = inventory.find(i => i.id === newItem.id);
        if (existingItem) {
            if (!existingItem.count) existingItem.count = 1;
            existingItem.count++;
            return;
        }
    }
    newItem.count = 1;
    inventory.push(newItem);
}

// ✨ 補上遺失的 moveToStash ✨
export function moveToStash(index) {
    if (gameState.mode !== "normal" || gameState.inBattle) {
        UI.addLog("現在無法存取倉庫！", "log-system");
        return;
    }
    const item = inventory[index];
    if (!item) return;

    // 處理堆疊
    if (item.stackable) {
        const existing = stash.find(i => i.id === item.id);
        if (existing) {
            if (!existing.count) existing.count = 1;
            existing.count++;
            if (item.count > 1) item.count--;
            else inventory.splice(index, 1);
        } else {
            if (item.count > 1) {
                item.count--;
                stash.push({ ...item, count: 1 });
            } else {
                inventory.splice(index, 1);
                stash.push(item);
            }
        }
    } else {
        // 不可堆疊 (如裝備) 直接移動
        inventory.splice(index, 1);
        stash.push(item);
    }

    UI.updateInventory();
    UI.updateStash();
    autoSave();
}

// ✨ 補上遺失的 takeFromStash ✨
export function takeFromStash(index) {
    if (gameState.mode !== "normal" || gameState.inBattle) {
        UI.addLog("現在無法存取倉庫！", "log-system");
        return;
    }
    const item = stash[index];
    if (!item) return;

    // 取出一個放入背包
    addToInventory({ ...item, count: 1 });

    // 倉庫扣除
    if (item.count > 1) {
        item.count--;
    } else {
        stash.splice(index, 1);
    }

    UI.updateInventory();
    UI.updateStash();
    autoSave();
}

function generateRandomEquipment(level) { const minL = 1; const maxL = level + 2; let candidates = EQUIP_TEMPLATES.filter(e => e.minLvl <= maxL); if (candidates.length === 0) candidates = [EQUIP_TEMPLATES[0]]; const template = candidates[Math.floor(Math.random() * candidates.length)]; let quality = ITEM_PREFIXES[1]; const roll = Math.random(); if (roll < 0.2) quality = ITEM_PREFIXES[0]; else if (roll < 0.7) quality = ITEM_PREFIXES[1]; else if (roll < 0.85) quality = ITEM_PREFIXES[2]; else if (roll < 0.95) quality = ITEM_PREFIXES[3]; else if (roll < 0.99) quality = ITEM_PREFIXES[4]; else quality = ITEM_PREFIXES[5]; let stats = {}; if(template.baseAtk) stats.atk = Math.floor(template.baseAtk * quality.mod); if(template.baseDef) stats.def = Math.floor(template.baseDef * quality.mod); if(template.magicAtk) stats.magicAtk = Math.floor(template.magicAtk * quality.mod); if(template.str) stats.str = Math.ceil(template.str * quality.mod); if(template.int) stats.int = Math.ceil(template.int * quality.mod); if(template.agi) stats.agi = Math.ceil(template.agi * quality.mod); if(template.con) stats.con = Math.ceil(template.con * quality.mod); if(template.hp) stats.hp = Math.floor(template.hp * quality.mod); if(template.mp) stats.mp = Math.floor(template.mp * quality.mod); const sellPrice = Math.max(1, Math.floor((template.minLvl * 10 + 5) * quality.mod)); const buyPrice = sellPrice * 3; return { name: quality.name + template.name, emoji: template.emoji, type: "equip", slot: template.type, stats: stats, sellPrice: sellPrice, price: buyPrice, usable: false, stackable: false }; }
function lootRandomItem(type) { if (type === "food") { const item = { ...CONSUMABLES[0] }; item.sellPrice = 5; addToInventory(item); UI.addLog(`🍱 你找到 ${item.name}，已放入背包。`, "log-system"); } else if (type === "treasure") { if (Math.random() < 0.5) { const potion = { ...CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)] }; if(potion.type === "food") potion.type = "heal"; potion.sellPrice = Math.floor(potion.price / 2); addToInventory(potion); UI.addLog(`✨ 你找到 ${potion.name}！`, "log-system"); } else { const mat = { id: "mat_common", name: "普通素材", emoji: "🧩", type: "material", usable: false, sellPrice: 10, stackable: true }; addToInventory(mat); UI.addLog("🧩 你撿到一些普通素材。", "log-system"); } } else if (type === "material") { const mat = { id: "mat_common", name: "普通素材", emoji: "🧩", type: "material", usable: false, sellPrice: 5, stackable: true }; addToInventory(mat); UI.addLog("🧩 你撿到一些普通素材。", "log-system"); } UI.updateInventory(); autoSave(); }
export function equipItem(index) { const item = inventory[index]; if (!item || item.type !== "equip") return; const slot = item.slot; const currentEquip = player.equipment[slot]; if (currentEquip) addToInventory(currentEquip); player.equipment[slot] = item; inventory.splice(index, 1); UI.addLog(`你裝備了 ${item.name}。`); UI.updateStatus(); UI.updateInventory(); autoSave(); }
export function unequipItem(slot) { const item = player.equipment[slot]; if (!item) return; player.equipment[slot] = null; addToInventory(item); UI.addLog(`你卸下了 ${item.name}。`); UI.updateStatus(); UI.updateInventory(); autoSave(); }
export function useItem(i) { 
    const item = inventory[i]; 
    if (item.type === "equip") { equipItem(i); return; } 
    let used = false; 
    if (item.type === "heal") { if (player.hp >= player.maxHP) { UI.addLog("HP 已經滿了。", "log-system"); return; } player.hp = Math.min(player.maxHP, player.hp + item.value); UI.addLog(`🧪 使用 ${item.name}，恢復 ${item.value} HP！`); used = true; } else if (item.type === "food") { if (player.hunger >= player.hungerMax) { UI.addLog("還不餓。", "log-system"); return; } player.hunger = Math.min(player.hungerMax, player.hunger + item.value); UI.addLog(`🍱 吃掉 ${item.name}，恢復 ${item.value} 飢餓！`); used = true; } else if (item.type === "mana") { if (player.mp >= player.maxMP) { UI.addLog("MP 已經滿了。", "log-system"); return; } player.mp = Math.min(player.maxMP, player.mp + item.value); UI.addLog(`🧪 使用 ${item.name}，恢復 ${item.value} MP！`); used = true; } 
    if (used && item.type !== "equip") { if(item.count > 1) item.count--; else inventory.splice(i, 1); UI.updateStatus(); UI.updateInventory(); autoSave(); } 
}
export function sellOneItem(i) { if (!gameState.merchantActive) { UI.addLog("需在商人處才能出售。"); return; } const item = inventory[i]; if (!item.sellPrice) return; player.gold += item.sellPrice; UI.addLog(`賣出 ${item.name} (+${item.sellPrice} G)`, "log-system"); if(item.count > 1) item.count--; else inventory.splice(i, 1); UI.updateStatus(); UI.updateInventory(); renderMerchantUI(`你賣掉了 ${item.name} (+${item.sellPrice} G)`); autoSave(); }
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

// 👇👇👇 你原本可能漏掉或沒 export 這個 👇👇👇
export function closeMerchant() {
    gameState.merchantActive = false; 
    gameState.merchantGoods = []; 
    gameState.mode = "normal"; // 切回正常模式
    UI.addLog("結束交易"); 
    UI.updateInventory(); 
    UI.showMainActions(); // 顯示下方按鈕
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

function canDoExplore(costHunger, costEnergy) {
    if (!player.alive || !gameState.canAct || gameState.inBattle || gameState.merchantActive) return false;
    
    let failed = false;
    if (player.hunger <= 0) { player.hp -= 15; UI.addLog("⚠️ 肚子餓扁了還強行探索... HP -15", "log-critical"); failed = true; } else { player.hunger = Math.max(0, player.hunger - costHunger); }
    if (player.energy <= 0) { player.hp -= 10; UI.addLog("⚠️ 累得要死還強行探索... HP -10", "log-critical"); failed = true; } else { player.energy = Math.max(0, player.energy - costEnergy); }
    
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

export function exploreNearby() { if (!canDoExplore(5, 5)) return; stats.exploredNearby++; UI.addLog("🔍 你在附近小心搜索……"); startCooldown(COOLDOWNS.NEARBY); setTimeout(() => { if (player.alive) { resolveNearby(); advanceDay(); } }, COOLDOWNS.NEARBY * 1000); }
export function exploreDungeon() { if (!canDoExplore(10, 15)) return; stats.exploredDungeon++; UI.addLog("🕳️ 你走入陰暗的地下城……"); startCooldown(COOLDOWNS.DUNGEON); setTimeout(() => { if (player.alive) { resolveDungeon(); advanceDay(); } }, COOLDOWNS.DUNGEON * 1000); }
export function exploreExpedition() { if (!canDoExplore(25, 30)) return; stats.exploredExpedition++; UI.addLog("🏕️ 你踏上長時間遠征……"); startCooldown(COOLDOWNS.EXPEDITION); setTimeout(() => { if (player.alive) { resolveExpedition(); advanceDay(); } }, COOLDOWNS.EXPEDITION * 1000); }

function resolveNearby() { if (gameState.enemy && gameState.enemy.name === "身體極限") gameState.enemy = null; if (maybeMerchant("nearby")) return; const r = Math.random(); addExp(10); if (r < 0.4) startBattle("nearby", 1); else if (r < 0.8) lootRandomItem("food"); else lootRandomItem("material"); }
function resolveDungeon() { if (gameState.enemy && gameState.enemy.name === "身體極限") gameState.enemy = null; if (maybeMerchant("dungeon")) return; const r = Math.random(); addExp(20); if (r < 0.8) startBattle("dungeon", 2); else lootRandomItem("treasure"); }
function resolveExpedition() { if (gameState.enemy && gameState.enemy.name === "身體極限") gameState.enemy = null; if (maybeMerchant("expedition")) return; const r = Math.random(); addExp(40); if (r < 0.2) startBattle("expedition", 3); else if (r < 0.6) lootRandomItem("treasure"); else lootRandomItem("food"); }

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
        gameState.inBattle = false; gameState.mode = "normal"; 
        gameState.enemy = null; 
        UI.addLog("🏃‍♂️ 你成功脫離了戰鬥。", "log-battle");
        gameState.isProcessingTurn = false; 
        UI.renderMainScreen(); 
        UI.showMainActions();
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
            inventory.push(newItem); 
            UI.addLog(`🎁 掉落裝備：${newItem.name}`, "log-system");
        } else { lootRandomItem("treasure"); }
        UI.updateInventory();
    }
    UI.updateStatus(); UI.showMainActions(); UI.renderMainScreen(); autoSave();
}

function gameClear() {
    gameState.inBattle = false; gameState.mode = "normal"; gameState.enemy = null; gameState.isProcessingTurn = false;
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
        let lostGold = Math.floor(player.gold / 2);
        
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
        gameState.mode = "normal";
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
    UI.addLog(`🤕 你在城鎮中醒來，雖然失去了物品，但至少還活著。`, "log-system");
    
    UI.updateStatus();
    UI.updateInventory();
    UI.updateStash();
    UI.renderMainScreen();
    UI.showMainActions();
    autoSave();
}

// src/logic.js 的 rest 函式 (安全休息版)

export function rest() {
    if (!gameState.canAct || !player.alive || gameState.inBattle || gameState.merchantActive) return;
    
    // 檢查飢餓
    let hungerCost = 20;
    let isStarving = player.hunger < hungerCost;

    UI.addLog("😴 你回到安全的旅店休息……");
    startCooldown(COOLDOWNS.REST);
    
    setTimeout(() => {
        if (!player.alive) return;
        
        try {
            let hpChange = 0;

            // 1. 飢餓判定 (餓肚子會扣血，但不致死，因為後面會補回來)
            if (isStarving) {
                player.hunger = 0; 
                hpChange -= 10; 
                UI.addLog("⚠️ 肚子太餓了，睡得不好... (HP -10)", "log-critical");
            } else { 
                player.hunger -= hungerCost; 
            }

            // 2. 移除偷襲事件 (城鎮休息是絕對安全的)
            // (原本這裡有的 startBattle 代碼已刪除)

            // 3. 計算恢復量
            // 基礎恢復量
            let healHP = 20 + player.con * 2; 
            let healMP = 10 + player.int * 2; 
            let healEnergy = 25 + player.con * 2;

            // 如果飢餓，恢復效果減半
            if (isStarving) { 
                healHP = Math.floor(healHP / 2); 
                healMP = Math.floor(healMP / 2); 
                healEnergy = Math.floor(healEnergy / 2); 
            }

            // 4. 結算 HP (先扣飢餓傷，再補血，確保淨值是正的)
            // 例如：飢餓(-10) + 補血(+20) = 實際 +10，這樣就不會死了
            hpChange += healHP;

            player.hp = Math.min(player.maxHP, player.hp + hpChange);
            player.mp = Math.min(player.maxMP, player.mp + healMP);
            player.energy = Math.min(player.energyMax, player.energy + healEnergy);

            // 5. ✨ 關鍵修正：解除負面狀態 ✨
            if (player.state === "中毒" || player.state === "重傷") {
                player.state = "正常";
                UI.addLog("✨ 經過休息，你的身體狀況恢復了正常。", "log-system");
            }

            addExp(5);
            UI.addLog(`休息後恢復了體力與傷口`);
            
            // 推進天數
            advanceDay();
            UI.updateStatus();
            
            // 刷新畫面
            if (!gameState.inBattle) UI.renderMainScreen();
            
            autoSave();

        } catch (e) {
            console.error("休息邏輯錯誤", e);
            UI.addLog(`❌ 休息時發生錯誤: ${e.message}`, "log-critical");
        }
    }, COOLDOWNS.REST * 1000);
}

export function confirmName() { const input = document.getElementById("nameInput"); player.name = input.value.trim() || "無名冒險者"; document.getElementById("namePanel").style.display = "none"; document.getElementById("jobPanel").style.display = "block"; }
export function chooseJob(jobKey) { player.str = 0; player.agi = 0; player.con = 0; player.int = 0; player.equipment = { head: null, body: null, weapon: null, accessory: null }; player.learnedSkills = []; player.equippedSkills = []; if (jobKey === "warrior") { player.job = "戰士"; player.str = 5; player.con = 5; player.learnedSkills.push("s_bash"); player.equippedSkills.push("s_bash"); } else if (jobKey === "archer") { player.job = "弓箭手"; player.agi = 6; player.str = 2; player.int = 2; player.learnedSkills.push("s_double_shot"); player.equippedSkills.push("s_double_shot"); } else if (jobKey === "rogue") { player.job = "盜賊"; player.str = 3; player.agi = 5; player.int = 2; player.learnedSkills.push("s_backstab"); player.equippedSkills.push("s_backstab"); } else if (jobKey === "mage") { player.job = "法師"; player.int = 8; player.con = 1; player.agi = 1; player.learnedSkills.push("s_fireball"); player.equippedSkills.push("s_fireball"); } 
    player.gold = 100; stash.length = 0; stash.push({ ...CONSUMABLES[0], count: 3 });
    UI.updateInventory(); UI.updateStash();
    player.hp = player.maxHP; player.mp = player.maxMP; UI.updateStatus(); player.hp = player.maxHP; player.mp = player.maxMP; UI.updateStatus(); document.getElementById("overlay").style.display = "none"; UI.addLog(`冒險者 ${player.name} (${player.job}) 開始了旅程`, "log-system"); 
    UI.addLog(`獲得新手資助：100 G 與 3 個乾糧包 (已存入倉庫)`, "log-system");
    gameState.mode = "normal"; gameState.canAct = true; UI.renderMainScreen(); UI.showMainActions(); autoSave(); 
}
export function restartGame() { resetGameData(); UI.updateInventory(); UI.updateStatus(); document.getElementById("eventBox").innerText = "請先輸入名字與選擇職業。"; document.getElementById("actions").innerHTML = ""; document.getElementById("deathPanel").style.display = "none"; document.getElementById("defeatPanel").style.display = "none"; document.getElementById("namePanel").style.display = "block"; document.getElementById("jobPanel").style.display = "none"; document.getElementById("overlay").style.display = "flex"; }