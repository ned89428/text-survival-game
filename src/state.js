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

    str: 0, agi: 0, con: 0, int: 0,

    equipment: {
        head: null,
        body: null,
        weapon: null,
        accessory: null
    },

    hp: 100, maxHP: 100,
    mp: 10,  maxMP: 10,
    hunger: 100, hungerMax: 100,
    energy: 100, energyMax: 100,

    atk: 5, magicAtk: 0, def: 0, 
    dodge: 5, hitRate: 90, speed: 5, critChance: 5,

    gold: 0,
    state: "正常",
    alive: true
};

// 遊戲全域變數
export let gameState = {
    mode: "normal",     
    logs: [],           
    enemy: null,
    inBattle: false,
    canAct: true,
    cooldownTimerId: null,
    merchantActive: false,
    merchantGoods: []
};

export let stats = {
    kills: 0,
    exploredNearby: 0,
    exploredDungeon: 0,
    exploredExpedition: 0
};

export let inventory = [];

export const COOLDOWNS = {
    NEARBY: 0,      
    DUNGEON: 0,     
    EXPEDITION: 0,  
    REST: 0         
};

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

export function recalcDerivedStats() {
    let effStr = player.str;
    let effAgi = player.agi;
    let effCon = player.con;
    let effInt = player.int;
    
    let bonusAtk = 0;
    let bonusDef = 0;
    let bonusMagic = 0;
    let bonusHP = 0;

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

    player.atk += bonusAtk;
    player.magicAtk += bonusMagic;
    
    player.maxHP = 50 + (effCon * hpMod) + (player.level * 5) + bonusHP;
    player.maxMP = 20 + (effInt * mpMod) + (player.level * 2);
    
    player.hungerMax = 100 + effCon * 5;
    player.energyMax = 100 + effCon * 5;

    player.def = (effCon * defMod) + bonusDef;

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

// ==========================================
// 重置遊戲資料 (關鍵修正)
// ==========================================
export function resetGameData() {
    // 1. 🚨 關鍵：如果舊遊戲有計時器在跑，強制停止它！
    if (gameState.cooldownTimerId) {
        clearInterval(gameState.cooldownTimerId);
        gameState.cooldownTimerId = null;
    }

    // 2. 重置玩家
    player.name = ""; player.job = ""; player.day = 1;
    player.level = 1; player.exp = 0; player.expToLevel = 100;
    player.attrPoints = 0;
    player.str = 0; player.agi = 0; player.con = 0; player.int = 0;
    
    player.equipment = { head: null, body: null, weapon: null, accessory: null };
    // 技能也要清空
    player.learnedSkills = [];
    player.equippedSkills = [];

    player.hp = 100; player.maxHP = 100;
    player.mp = 10;  player.maxMP = 10;
    player.hunger = 100; player.hungerMax = 100;
    player.energy = 100; player.energyMax = 100;
    
    player.atk = 5; player.magicAtk = 0; player.def = 0; 
    player.dodge = 0; player.hitRate = 80;
    player.speed = 5; player.critChance = 5;
    
    player.gold = 0; player.state = "正常"; player.alive = true;

    // 3. 重置遊戲狀態
    gameState.mode = "normal";
    gameState.logs = [];
    gameState.enemy = null;
    gameState.inBattle = false;
    gameState.lastBattleText = "";
    gameState.canAct = true; // 確保重置後可以行動
    gameState.merchantActive = false;
    gameState.merchantGoods = [];
    
    inventory.length = 0;
    stats.kills = 0; stats.exploredNearby = 0; 
    stats.exploredDungeon = 0; stats.exploredExpedition = 0;
}