// src/state.js

// 玩家資料
export let player = {
    name: "",
    job: "",
    day: 1,
    level: 1,
    exp: 0,
    expToLevel: 100,
    attrPoints: 0,

    // 基礎屬性
    str: 0, agi: 0, con: 0, int: 0,

    // 裝備欄位
    equipment: {
        head: null,
        body: null,
        weapon: null,
        accessory: null
    },

    // 衍生屬性
    hp: 100, maxHP: 100,
    mp: 10,  maxMP: 10,
    hunger: 100, hungerMax: 100,
    energy: 100, energyMax: 100,

    // 戰鬥屬性
    atk: 5, magicAtk: 0, def: 0, 
    dodge: 5, hitRate: 90, speed: 5, critChance: 5,

    gold: 0,
    state: "正常",
    alive: true
};

// 遊戲全域變數
export let gameState = {
    mode: "normal",     // normal, battle, merchant
    logs: [],           // 統一的 Log 紀錄
    enemy: null,
    inBattle: false,
    canAct: true,
    cooldownTimerId: null,
    merchantActive: false,
    merchantGoods: []
};

// 統計數據
export let stats = {
    kills: 0,
    exploredNearby: 0,
    exploredDungeon: 0,
    exploredExpedition: 0
};

// 背包
export let inventory = [];

// 冷卻時間設定 (目前維持測試用 0，若要恢復正常遊戲請改回數值)
// 建議值: NEARBY: 10, DUNGEON: 20, EXPEDITION: 45, REST: 10
export const COOLDOWNS = {
    NEARBY: 0,      
    DUNGEON: 0,     
    EXPEDITION: 0,  
    REST: 0         
};

// 狀態加成計算
function applyStateBonuses() {
    if (player.state === "祝福") {
        player.atk += 5;
        player.magicAtk += 5;
        player.critChance += 5;
    } else if (player.state === "詛咒") {
        player.atk = Math.max(1, player.atk - 5);
        player.def = Math.max(0, player.def - 2);
    } else if (player.state === "疲勞") {
        player.speed -= 5;
        player.dodge -= 10;
        player.hitRate -= 10;
    }
}

// ==========================================
// 核心：重新計算衍生屬性 (含裝備加成)
// ==========================================
export function recalcDerivedStats() {
    // 1. 計算「有效屬性」 (基礎點數 + 裝備加成)
    let effStr = player.str;
    let effAgi = player.agi;
    let effCon = player.con;
    let effInt = player.int;
    
    // 裝備提供的額外攻防 (直接加在面板)
    let bonusAtk = 0;
    let bonusDef = 0;
    let bonusMagic = 0;
    let bonusHP = 0;

    // 遍歷所有裝備欄位，把數值加總
    Object.values(player.equipment).forEach(item => {
        if (item) {
            effStr += (item.stats.str || 0);
            effAgi += (item.stats.agi || 0);
            effCon += (item.stats.con || 0);
            effInt += (item.stats.int || 0);
            
            bonusAtk += (item.stats.atk || 0);
            bonusDef += (item.stats.def || 0);
            bonusMagic += (item.stats.magicAtk || 0);
            bonusHP += (item.stats.hp || 0);
        }
    });

    // 2. 定義職業係數
    let hpMod = 10;   
    let mpMod = 5;    
    let defMod = 0.5; 

    if (player.job === "戰士") {
        hpMod = 14; defMod = 1.0;
        player.atk = 5 + effStr * 2.5 + effAgi * 0.2;
        player.magicAtk = effInt * 0.5; 
    } 
    else if (player.job === "弓箭手") {
        hpMod = 10;
        player.atk = 5 + effAgi * 2.2 + effStr * 0.5;
        player.magicAtk = effInt * 0.8;
    }
    else if (player.job === "盜賊") {
        hpMod = 9;
        player.atk = 5 + effStr * 1.2 + effAgi * 1.5;
        player.magicAtk = effInt * 0.8;
    }
    else if (player.job === "法師") {
        hpMod = 8; mpMod = 15;
        player.atk = 2 + effStr * 0.5; 
        player.magicAtk = 5 + effInt * 2.5; 
    }
    else {
        player.atk = 5 + effStr * 2;
        player.magicAtk = effInt * 1;
    }

    // 3. 加上裝備的額外面板數值
    player.atk += bonusAtk;
    player.magicAtk += bonusMagic;
    
    // 4. 計算生存與其他屬性
    player.maxHP = 50 + (effCon * hpMod) + (player.level * 5) + bonusHP;
    player.maxMP = 10 + (effInt * mpMod) + (player.level * 2);
    
    player.hungerMax = 100 + effCon * 5;
    player.energyMax = 100 + effCon * 5;

    player.def = (effCon * defMod) + bonusDef;

    // 閃避與命中
    let rawDodge = effAgi * 0.5; 
    player.dodge = Math.min(60, rawDodge); 
    player.hitRate = 80 + (effAgi * 0.5); 
    player.critChance = 5 + (effInt * 0.2) + (effAgi * 0.1);
    player.speed = 10 + effAgi * 1;

    applyStateBonuses();

    player.hp = Math.min(player.hp, player.maxHP);
    player.mp = Math.min(player.mp || 0, player.maxMP);
    player.energy = Math.min(player.energy, player.energyMax);
    player.hunger = Math.min(player.hunger, player.hungerMax);
}

// 重置遊戲資料
export function resetGameData() {
    player.name = ""; player.job = ""; player.day = 1;
    player.level = 1; player.exp = 0; player.expToLevel = 100;
    player.attrPoints = 0;
    player.str = 0; player.agi = 0; player.con = 0; player.int = 0;
    
    // 清空裝備
    player.equipment = { head: null, body: null, weapon: null, accessory: null };

    player.hp = 100; player.maxHP = 100;
    player.mp = 10;  player.maxMP = 10;
    player.hunger = 100; player.hungerMax = 100;
    player.energy = 100; player.energyMax = 100;
    
    player.atk = 5; player.magicAtk = 0; player.def = 0; 
    player.dodge = 0; player.hitRate = 80;
    player.speed = 5; player.critChance = 5;
    
    player.gold = 0; player.state = "正常"; player.alive = true;

    // 重置 GameState (包含新的 mode 和 logs)
    gameState.mode = "normal";
    gameState.logs = [];
    gameState.enemy = null;
    gameState.inBattle = false;
    gameState.lastBattleText = "";
    gameState.canAct = true;
    gameState.merchantActive = false;
    gameState.merchantGoods = [];
    
    inventory.length = 0;
    stats.kills = 0; stats.exploredNearby = 0; 
    stats.exploredDungeon = 0; stats.exploredExpedition = 0;
}