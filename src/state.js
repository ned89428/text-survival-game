// src/state.js

// 1. 玩家資料
export let player = {
    name: "", job: "", day: 1, level: 1, exp: 0, expToLevel: 100, attrPoints: 0,
    inventoryMaxSlots: 8, // 背包容量
    str: 0, agi: 0, con: 0, int: 0, tec: 0, // 新增 tec
    equipment: { head: null, body: null, weapon: null, accessory: null, backpack: null, shoes: null },
    trainedAttrs: { str: 0, agi: 0, con: 0, int: 0, tec: 0 }, // ✨ 新增：追蹤後天訓練次數
    defeatedBosses: [], // ✨ 新增：追蹤已擊敗的 BOSS ID
    learnedSkills: [], equippedSkills: [],
    hp: 100, maxHP: 100, mp: 20, maxMP: 20, actionGauge: 0, // 新增玩家行動條
    hunger: 100, hungerMax: 100,
    atk: 5, magicAtk: 0, def: 0, dodge: 0, hitRate: 80, speed: 10, critChance: 5, critDamage: 150,
    gold: 0, state: "正常", alive: true, statusDuration: 0, // ✨ 新增：狀態持續時間
    // ✨ 新增：探索相關衍生屬性
    exitFindBonus: 0,
    lootFindBonus: 0,
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
    cooldownTimerId: null, // 探索冷卻
    battleLoopId: null,      // ATB 戰鬥迴圈 ID
    isPlayerTurn: false,     // 標記是否輪到玩家行動
    lastActor: null,         // ✨ 新增：追蹤上一個行動者 ('player' 或 'enemy')
    merchantActive: false, // 是否在商人介面
    pendingBossId: null,     // ✨ 新增：用於 BOSS 遭遇確認
    canSafelyRetreat: false, // ✨ 新增：能否安全撤離
    // ✨ 新增：旅行系統狀態
    travelDestination: null,
    travelTimeRemaining: 0,
    travelTimerId: null,
    merchantGoods: [],
    pendingExp: 0            // ✨ 修改：現在只用來儲存探索中暫存的「擊殺經驗」
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
    // ✨ 核心改造：為「重傷」狀態賦予實際懲罰效果
    else if (player.state === "重傷") {
        player.atk *= 0.7;      // 攻擊力降低 30%
        player.def *= 0.7;      // 防禦力降低 30%
        player.hitRate -= 15;   // 命中率降低 15
        player.dodge -= 15;     // 閃避值降低 15
    }
}

// 核心：數值計算公式
export function recalcDerivedStats(refill = false) { 
    // === 1. 彙總基礎屬性與裝備加成 ===
    let totalStr = player.str;
    let totalAgi = player.agi;
    let totalCon = player.con;
    let totalInt = player.int;
    let totalTec = player.tec; // ... 其他屬性初始化
    let bonusAtk = 0, bonusDef = 0, bonusMagic = 0, bonusHP = 0, bonusMP = 0, bonusSlots = 0;

    Object.values(player.equipment).forEach(item => {
        if (item) {
            totalStr += (item.stats.str || 0);
            totalAgi += (item.stats.agi || 0);
            totalCon += (item.stats.con || 0);
            totalInt += (item.stats.int || 0);
            totalTec += (item.stats.tec || 0); // 裝備 tec
            bonusAtk += (item.stats.atk || 0); bonusDef += (item.stats.def || 0);
            bonusMagic += (item.stats.magicAtk || 0); bonusHP += (item.stats.hp || 0);
            bonusMP += (item.stats.mp || 0);
            bonusSlots += (item.stats.slots || 0); // ✨ 核心：累加裝備提供的欄位

            // ✨ 核心改造：累加探索屬性
            player.exitFindBonus += (item.stats.exitFindBonus || 0);
            player.lootFindBonus += (item.stats.lootFindBonus || 0);
        }
    });
    // ✨ 核心改造：從裝備基底也累加探索屬性
    player.exitFindBonus += (player.equipment.accessory?.exitFindBonus || 0);


    // === 1.5. 計算背包容量 ===
    const baseSlots = 8; // 玩家的基礎背包容量
    player.inventoryMaxSlots = baseSlots + bonusSlots;

    // === 2. 定義職業的屬性成長係數 ===
    // (根據新公式，職業影響已被移除，統一計算)

    // === 3. 計算二級屬性 (公式透明化) ===
    // 最大 HP: Base = 100 + (Lv * 10), MaxHP = Base * (1 + CON / 40) + 裝備HP
    const baseHp = 100 + (player.level * 10);
    player.maxHP = Math.floor(baseHp * (1 + totalCon / 40) + bonusHP);
    // 最大 MP: Base = 20 + (Lv * 2), MaxMP = Base * (1 + INT / 30) + 裝備MP
    const baseMp = 20 + (player.level * 2);
    player.maxMP = baseMp * (1 + totalInt / 30) + bonusMP;
    // 物理攻擊: Base = 5 + (STR * 1.5), ATK = Base * (1 + STR / 100) + 裝備ATK
    const baseAtk = 5 + (totalStr * 1.5);
    player.atk = baseAtk * (1 + totalStr / 100) + bonusAtk;
    // 魔法攻擊: Base = INT * 2, MATK = Base * (1 + INT / 80) + 裝備MATK
    const baseMagicAtk = totalInt * 2;
    player.magicAtk = baseMagicAtk * (1 + totalInt / 80) + bonusMagic;
    // 物理防禦 (RawDef): (CON * 1.0) + 裝備Def
    player.def = (totalCon * 1.0) + bonusDef;
    // 命中值: 80 + (Lv * 2) + (TEC * 2)
    player.hitRate = 80 + (player.level * 2) + (totalTec * 2);
    // 閃避值: (Lv * 1) + (AGI * 2)
    player.dodge = (player.level * 1) + (totalAgi * 2);
    // 速度: 10 + (AGI / (AGI + 100)) * 50
    player.speed = 10 + (totalAgi / (totalAgi + 100)) * 50;
    // 暴擊率: 5 + (TEC / (TEC + 200)) * 90
    player.critChance = 5 + (totalTec / (totalTec + 200)) * 90;
    // 暴擊傷害: 150 + (STR * 0.5)
    player.critDamage = 150 + (totalStr * 0.5);

    // === 4. 處理特殊狀態加成 (例如：祝福、詛咒) ===
    applyStateBonuses();
    
    // === 5. 最後校正，確保目前值不超過最大值 ===
    if (refill) {
        // 如果需要補滿，直接設定為最大值
        player.hp = player.maxHP;
        player.mp = player.maxMP;
    } else {
        // 否則，只確保當前值不超過最大值
        player.hp = Math.min(player.hp, player.maxHP); player.mp = Math.min(player.mp || 0, player.maxMP);
    }
    player.hunger = Math.min(player.hunger, player.hungerMax);
}

// ==========================================
// 重置遊戲資料
// ==========================================
export function resetGameData() {
    if (gameState.cooldownTimerId) { clearInterval(gameState.cooldownTimerId); gameState.cooldownTimerId = null; }
    player.name = ""; player.job = ""; player.day = 1; player.level = 1; player.exp = 0; player.expToLevel = 100;
    player.str = 0; player.agi = 0; player.con = 0; player.int = 0; player.tec = 0;
    player.defeatedBosses = []; // ✨ 重置 BOSS 擊殺記錄
    player.trainedAttrs = { str: 0, agi: 0, con: 0, int: 0, tec: 0 }; // ✨ 重置訓練次數
    
    player.equipment = { head: null, body: null, weapon: null, accessory: null, backpack: null, shoes: null };
    player.learnedSkills = []; player.equippedSkills = [];
    player.actionGauge = 0; // 重置行動條
    player.hp = 100; player.maxHP = 100; player.mp = 20; player.maxMP = 20;
    player.hunger = 100; player.hungerMax = 100;
    player.atk = 5; player.magicAtk = 0; player.def = 0; player.dodge = 0; player.hitRate = 80; player.speed = 10; player.critChance = 5; player.critDamage = 150;
    player.gold = 0; player.state = "正常"; player.alive = true; player.statusDuration = 0; // ✨ 重置狀態持續時間

    gameState.mode = "town"; // ✨ 重置為 town 模式
    gameState.currentZone = null; // ✨ 重置目前區域
    gameState.depth = 0; // ✨ 重置深度
    gameState.logs = []; 
    gameState.enemy = null; 
    gameState.pendingBossId = null; // ✨ 重置待處理的 BOSS
    // ✨ 重置旅行狀態
    if (gameState.travelTimerId) clearInterval(gameState.travelTimerId);
    gameState.travelDestination = null;
    gameState.travelTimeRemaining = 0;
    gameState.pendingExp = 0; // ✨ 重置暫存經驗
    gameState.canSafelyRetreat = false; gameState.isPlayerTurn = false; gameState.lastActor = null;
    gameState.inBattle = false; 
    gameState.isProcessingTurn = false; gameState.canAct = true; gameState.merchantActive = false; gameState.merchantGoods = [];
    
    inventory.length = 0;
    stash.items = []; // ✨ 重置倉庫物品
    stash.gold = 0;   // ✨ 重置倉庫金錢
    
    stats.kills = 0; stats.exploredNearby = 0; stats.exploredDungeon = 0; stats.exploredExpedition = 0;
}