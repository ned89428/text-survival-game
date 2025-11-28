// src/state.js

// 1. 玩家資料
export let player = {
    name: "", job: "", day: 1, level: 1, exp: 0, expToLevel: 100, attrPoints: 0,
    str: 0, agi: 0, con: 0, int: 0,
    equipment: { head: null, body: null, weapon: null, accessory: null },
    learnedSkills: [], equippedSkills: [],
    hp: 100, maxHP: 100, mp: 10, maxMP: 10,
    hunger: 100, hungerMax: 100,
    atk: 5, magicAtk: 0, def: 0, dodge: 5, hitRate: 90, speed: 5, critChance: 5,
    gold: 0, state: "正常", alive: true
};

// 2. 遊戲全域狀態
export let gameState = {
    mode: "town",       // 核心模式：town (城鎮), explore (探索), battle (戰鬥), merchant (商人)
    currentZone: null,
    depth: 0,
    logs: [],             // 統一 Log
    enemy: null,
    inBattle: false,
    isProcessingTurn: false, // 戰鬥鎖定
    canAct: true,
    cooldownTimerId: null,
    merchantActive: false,
    merchantGoods: []
};

// 3. 統計數據
export let stats = { kills: 0, exploredNearby: 0, exploredDungeon: 0, exploredExpedition: 0 };

// 4. 背包與倉庫
export let inventory = [];
export let stash = {
    items: [], // 原本的倉庫物品陣列
    gold: 0    // ✨ 新增：倉庫金錢
};

// 5. 冷卻時間設定
export const COOLDOWNS = { NEARBY: 0, DUNGEON: 0, EXPEDITION: 0, REST: 0 };

// 工具：狀態加成計算
function applyStateBonuses() {
    if (player.state === "祝福") { player.atk += 5; player.magicAtk += 5; player.critChance += 5; } 
    else if (player.state === "詛咒") { player.atk = Math.max(1, player.atk - 5); player.def = Math.max(0, player.def - 2); } 
    else if (player.state === "疲勞") { player.speed -= 5; player.dodge -= 10; player.hitRate -= 10; }
}

// 核心：數值計算公式
export function recalcDerivedStats() {
    let effStr = player.str; let effAgi = player.agi; let effCon = player.con; let effInt = player.int;
    let bonusAtk = 0; let bonusDef = 0; let bonusMagic = 0; let bonusHP = 0;

    Object.values(player.equipment).forEach(item => {
        if (item) {
            effStr += (item.stats.str || 0); effAgi += (item.stats.agi || 0);
            effCon += (item.stats.con || 0); effInt += (item.stats.int || 0);
            bonusAtk += (item.stats.atk || 0); bonusDef += (item.stats.def || 0);
            bonusMagic += (item.stats.magicAtk || 0); bonusHP += (item.stats.hp || 0);
        }
    });

    let hpMod = 10; let mpMod = 5; let defMod = 0.5; 
    if (player.job === "戰士") { hpMod = 14; defMod = 1.0; player.atk = 5 + effStr * 2.5 + effAgi * 0.2; player.magicAtk = effInt * 0.5; } 
    else if (player.job === "弓箭手") { hpMod = 10; player.atk = 5 + effAgi * 2.2 + effStr * 0.5; player.magicAtk = effInt * 0.8; }
    else if (player.job === "盜賊") { hpMod = 9; player.atk = 5 + effStr * 1.2 + effAgi * 1.5; player.magicAtk = effInt * 0.8; }
    else if (player.job === "法師") { hpMod = 8; mpMod = 5; player.atk = 2 + effStr * 0.5; player.magicAtk = 5 + effInt * 2.5; } // ✨ 修正：將法師的 mpMod 從 15 降為 5
    else { player.atk = 5 + effStr * 2; player.magicAtk = effInt * 1; }

    player.atk += bonusAtk; player.magicAtk += bonusMagic;
    player.maxHP = 50 + (effCon * hpMod) + (player.level * 5) + bonusHP;
    player.maxMP = 20 + (effInt * mpMod) + (player.level * 2);
    player.hungerMax = 100 + effCon * 5;
    player.def = (effCon * defMod) + bonusDef;
    let rawDodge = effAgi * 0.5; player.dodge = Math.min(60, rawDodge); player.hitRate = 80 + (effAgi * 0.5); 
    player.critChance = 5 + (effInt * 0.2) + (effAgi * 0.1); player.speed = 10 + effAgi * 1;

    applyStateBonuses();
    player.hp = Math.min(player.hp, player.maxHP); player.mp = Math.min(player.mp || 0, player.maxMP);
    player.hunger = Math.min(player.hunger, player.hungerMax);
}

// ==========================================
// 重置遊戲資料
// ==========================================
export function resetGameData() {
    if (gameState.cooldownTimerId) { clearInterval(gameState.cooldownTimerId); gameState.cooldownTimerId = null; }
    player.name = ""; player.job = ""; player.day = 1; player.level = 1; player.exp = 0; player.expToLevel = 100; player.attrPoints = 0;
    player.str = 0; player.agi = 0; player.con = 0; player.int = 0;
    
    player.equipment = { head: null, body: null, weapon: null, accessory: null };
    player.learnedSkills = []; player.equippedSkills = [];
    player.hp = 100; player.maxHP = 100; player.mp = 10; player.maxMP = 10;
    player.hunger = 100; player.hungerMax = 100;
    player.atk = 5; player.magicAtk = 0; player.def = 0; player.dodge = 0; player.hitRate = 80; player.speed = 5; player.critChance = 5;
    player.gold = 0; player.state = "正常"; player.alive = true;

    gameState.mode = "town"; // ✨ 重置為 town 模式
    gameState.currentZone = null; // ✨ 重置目前區域
    gameState.depth = 0; // ✨ 重置深度
    gameState.logs = []; 
    gameState.enemy = null; 
    gameState.inBattle = false; 
    gameState.isProcessingTurn = false; gameState.canAct = true; gameState.merchantActive = false; gameState.merchantGoods = [];
    
    inventory.length = 0;
    stash.items = []; // ✨ 重置倉庫物品
    stash.gold = 0;   // ✨ 重置倉庫金錢
    
    stats.kills = 0; stats.exploredNearby = 0; stats.exploredDungeon = 0; stats.exploredExpedition = 0;
}