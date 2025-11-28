// src/state.js

// 1. 玩家資料
export let player = {
    name: "", job: "", day: 1, level: 1, exp: 0, expToLevel: 100, attrPoints: 0,
    inventoryMaxSlots: 6, // 背包容量
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
    merchantActive: false, // 是否在商人介面
    canSafelyRetreat: false, // ✨ 新增：能否安全撤離
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
    // === 1. 彙總基礎屬性與裝備加成 ===
    let totalStr = player.str;
    let totalAgi = player.agi;
    let totalCon = player.con;
    let totalInt = player.int;
    let bonusAtk = 0, bonusDef = 0, bonusMagic = 0, bonusHP = 0, bonusMP = 0;

    Object.values(player.equipment).forEach(item => {
        if (item) {
            totalStr += (item.stats.str || 0);
            totalAgi += (item.stats.agi || 0);
            totalCon += (item.stats.con || 0);
            totalInt += (item.stats.int || 0);
            bonusAtk += (item.stats.atk || 0); bonusDef += (item.stats.def || 0);
            bonusMagic += (item.stats.magicAtk || 0); bonusHP += (item.stats.hp || 0);
            bonusMP += (item.stats.mp || 0);
        }
    });

    // === 2. 定義職業的屬性成長係數 ===
    let hpPerCon = 10, mpPerInt = 5, atkPerStr = 2, atkPerAgi = 0.5, magicAtkPerInt = 2, defPerCon = 0.5;
    
    if (player.job === "戰士") {
        hpPerCon = 15; atkPerStr = 2.5; defPerCon = 1.0;
    } else if (player.job === "弓箭手") {
        atkPerStr = 0.8; atkPerAgi = 2.2;
    } else if (player.job === "盜賊") {
        atkPerStr = 1.2; atkPerAgi = 1.8;
    } else if (player.job === "法師") {
        hpPerCon = 8; mpPerInt = 8; magicAtkPerInt = 3.0;
    }

    // === 3. 計算二級屬性 (公式透明化) ===
    // 生命 = 基礎50 + 等級加成 + (體質 * 每點體質給的血量) + 裝備額外血量
    player.maxHP = 50 + (player.level * 5) + (totalCon * hpPerCon) + bonusHP;
    // 魔力 = 基礎20 + 等級加成 + (智慧 * 每點智慧給的魔力) + 裝備額外魔力
    player.maxMP = 20 + (player.level * 2) + (totalInt * mpPerInt) + bonusMP;
    // 飢餓 = 基礎100 + 體質微量加成
    player.hungerMax = 100 + totalCon * 5;
    // 攻擊 = 基礎5 + (力量 * 係數) + (敏捷 * 係數) + 裝備額外攻擊
    player.atk = 5 + (totalStr * atkPerStr) + (totalAgi * atkPerAgi) + bonusAtk;
    // 魔攻 = 基礎0 + (智慧 * 係數) + 裝備額外魔攻
    player.magicAtk = (totalInt * magicAtkPerInt) + bonusMagic;
    // 防禦 = (體質 * 係數) + 裝備額外防禦
    player.def = (totalCon * defPerCon) + bonusDef;
    // 速度 = 基礎10 + 敏捷加成
    player.speed = 10 + totalAgi * 1.2;
    // 命中 = 基礎85 + 敏捷加成
    player.hitRate = 85 + totalAgi * 0.5;
    // 閃避 = 敏捷加成 (上限 60%)
    player.dodge = Math.min(60, totalAgi * 0.8);
    // 暴擊 = 基礎5% + 智慧/敏捷微量加成
    player.critChance = 5 + (totalInt * 0.2) + (totalAgi * 0.1);

    // === 4. 處理特殊狀態加成 (例如：祝福、詛咒) ===
    applyStateBonuses();
    
    // === 5. 最後校正，確保目前值不超過最大值 ===
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
    gameState.canSafelyRetreat = false; // ✨ 重置安全撤離狀態
    gameState.inBattle = false; 
    gameState.isProcessingTurn = false; gameState.canAct = true; gameState.merchantActive = false; gameState.merchantGoods = [];
    
    inventory.length = 0;
    stash.items = []; // ✨ 重置倉庫物品
    stash.gold = 0;   // ✨ 重置倉庫金錢
    
    stats.kills = 0; stats.exploredNearby = 0; stats.exploredDungeon = 0; stats.exploredExpedition = 0;
}