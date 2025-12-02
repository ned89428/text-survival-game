export const ENEMIES = [
    // === Lv 1-3: 新手區 (Nearby) ===
    {
        id: "mushroom",
        name: "走路菇",
        emoji: "🍄",
        minLvl: 1,
        baseHp: 20, baseAtk: 4, baseDef: 0,
        exp: 8,
        baseStr: 2, baseAgi: 2, baseCon: 3, baseTec: 1, baseSpeed: 6, // 非常弱
        dropRate: 0.1,
        zone: "nearby"
    },
    {
        id: "slime",
        name: "史萊姆",
        emoji: "🟢",  // <--- 新增這個
        minLvl: 1,
        baseHp: 30, baseAtk: 5, baseDef: 0,
        exp: 10,
        // 新增基礎屬性
        baseStr: 3, baseAgi: 1, baseCon: 5, baseTec: 1, baseSpeed: 8,
        dropRate: 0.1,
        zone: "nearby"
    },
    {
        id: "rat",
        name: "巨大老鼠",
        emoji: "🐀",
        minLvl: 1,
        baseHp: 25, baseAtk: 8, baseDef: 0,
        exp: 12,
        baseStr: 4, baseAgi: 4, baseCon: 2, baseTec: 3, baseSpeed: 12,
        dropRate: 0.1,
        zone: "nearby"
    },
    {
        id: "wolf",
        name: "荒野狼",
        emoji: "🐺",
        minLvl: 3,
        baseHp: 50, baseAtk: 12, baseDef: 2,
        exp: 20,
        baseStr: 6, baseAgi: 8, baseCon: 4, baseTec: 5, baseSpeed: 15,
        dropRate: 0.2,
        zone: "nearby"
    },
    {
        id: "spider",
        name: "巨大蜘蛛",
        emoji: "🕷️",
        minLvl: 2,
        baseHp: 40, baseAtk: 10, baseDef: 1,
        exp: 15,
        baseStr: 5, baseAgi: 10, baseCon: 3, baseTec: 4, baseSpeed: 14,
        dropRate: 0.15,
        zone: "nearby"
    },
    {
        id: "goblin_scout",
        name: "哥布林斥侯",
        emoji: "👺",
        minLvl: 4, // 較高 minLvl，適合在深層出現
        baseHp: 60, baseAtk: 16, baseDef: 2,
        exp: 30,
        baseStr: 7, baseAgi: 10, baseCon: 5, baseTec: 8, baseSpeed: 16,
        dropRate: 0.25,
        zone: "nearby" // 雖然是哥布林，但出現在附近區域的深處
    },
    {
        id: "boar",
        name: "狂暴野豬",
        emoji: "🐗",
        minLvl: 3,
        baseHp: 70, baseAtk: 14, baseDef: 4,
        exp: 25,
        baseStr: 10, baseAgi: 4, baseCon: 8, baseTec: 2, baseSpeed: 10,
        dropRate: 0.18,
        zone: "nearby"
    },
    // === 新增：附近區域 BOSS ===
    {
        id: "boss_giant_bear",
        name: "森林巨熊",
        emoji: "🐻",
        minLvl: 10,
        baseHp: 600, baseAtk: 45, baseDef: 20,
        exp: 400,
        baseStr: 30, baseAgi: 5, baseCon: 35, baseTec: 10, baseSpeed: 9, // 速度慢，但血厚攻高
        dropRate: 1.0, // Boss 必定掉落
        zone: "nearby",
        isBoss: true, // 標記為 BOSS
        killChance: 0.05 // 戰敗時有 5% 機率直接死亡
    },

    // === Lv 4-7: 地下城 (Dungeon) ===
    {
        id: "dungeon_rat",
        name: "地城巨鼠",
        emoji: "🐀",
        minLvl: 4, // 地下城的入門怪
        baseHp: 70, baseAtk: 14, baseDef: 1,
        exp: 30,
        baseStr: 6, baseAgi: 9, baseCon: 4, baseTec: 5, baseSpeed: 14,
        dropRate: 0.2,
        zone: "dungeon"
    },
    {
        id: "goblin",
        name: "哥布林",
        emoji: "👺",
        minLvl: 4,
        baseHp: 80, baseAtk: 15, baseDef: 3,
        exp: 35,
        baseStr: 8, baseAgi: 6, baseCon: 6, baseTec: 6, baseSpeed: 10,
        dropRate: 0.3,
        zone: "dungeon"
    },
    {
        id: "skeleton",
        name: "骷髏兵",
        emoji: "💀",
        minLvl: 5,
        baseHp: 60, baseAtk: 20, baseDef: 1,
        exp: 40,
        baseStr: 12, baseAgi: 3, baseCon: 3, baseTec: 8, baseSpeed: 9,
        dropRate: 0.3,
        zone: "dungeon"
    },
    {
        id: "bat",
        name: "吸血蝙蝠",
        emoji: "🦇",
        minLvl: 6,
        baseHp: 50, baseAtk: 18, baseDef: 0,
        exp: 45,
        baseStr: 5, baseAgi: 15, baseCon: 2, baseTec: 5, baseSpeed: 20,
        dropRate: 0.2,
        zone: "dungeon"
    },
    {
        id: "zombie",
        name: "殭屍",
        emoji: "🧟‍♂️",
        minLvl: 5,
        baseHp: 120, baseAtk: 18, baseDef: 2,
        exp: 50,
        baseStr: 12, baseAgi: 2, baseCon: 12, baseTec: 1, baseSpeed: 7, // 速度慢，但血厚
        dropRate: 0.25,
        zone: "dungeon"
    },
    {
        id: "gargoyle",
        name: "石像鬼",
        emoji: "🗿",
        minLvl: 7,
        baseHp: 100, baseAtk: 25, baseDef: 15,
        exp: 80,
        baseStr: 15, baseAgi: 8, baseCon: 10, baseTec: 10, baseSpeed: 12, // 防禦高
        dropRate: 0.4,
        zone: "dungeon"
    },
    {
        id: "ogre",
        name: "食人魔",
        emoji: "👹",
        minLvl: 8, // 地下城深層的精英怪
        baseHp: 250, baseAtk: 30, baseDef: 8,
        exp: 120,
        baseStr: 20, baseAgi: 4, baseCon: 18, baseTec: 5, baseSpeed: 8, // 典型的笨重力量型
        dropRate: 0.5,
        zone: "dungeon"
    },
    // === 新增：地下城 BOSS ===
    {
        id: "boss_goblin_king",
        name: "哥布林王",
        emoji: "👑",
        minLvl: 8,
        baseHp: 400, baseAtk: 35, baseDef: 15,
        exp: 250,
        baseStr: 22, baseAgi: 8, baseCon: 20, baseTec: 15, baseSpeed: 12,
        dropRate: 1.0, // Boss 必定掉落
        zone: "dungeon",
        isBoss: true, // ✨ 標記為 BOSS
        killChance: 0.1 // ✨ 戰敗時有 10% 機率直接死亡
    },


    // === Lv 8+: 遠征 (Expedition) ===
    {
        id: "harpy",
        name: "鷹身女妖",
        emoji: "🐦",
        minLvl: 9,
        baseHp: 280, baseAtk: 40, baseDef: 5,
        exp: 250,
        baseStr: 15, baseAgi: 28, baseCon: 15, baseTec: 20, baseSpeed: 25, // 極高閃避和速度
        dropRate: 0.6,
        zone: "expedition"
    },
    {
        id: "orc",
        name: "半獸人戰士",
        emoji: "🧟",
        minLvl: 8,
        baseHp: 200, baseAtk: 30, baseDef: 10,
        exp: 100,
        baseStr: 20, baseAgi: 5, baseCon: 15, baseTec: 8, baseSpeed: 11,
        dropRate: 0.5,
        zone: "expedition"
    },
    {
        id: "dragon",
        name: "幼龍",
        emoji: "🐉",
        minLvl: 10,
        baseHp: 500, baseAtk: 60, baseDef: 20,
        exp: 500,
        baseStr: 35, baseAgi: 15, baseCon: 25, baseTec: 20, baseSpeed: 18,
        dropRate: 1.0,
        zone: "expedition"
    },
    {
        id: "griffin",
        name: "獅鷲",
        emoji: "🦅",
        minLvl: 9,
        baseHp: 350, baseAtk: 50, baseDef: 15,
        exp: 300,
        baseStr: 25, baseAgi: 25, baseCon: 20, baseTec: 22, baseSpeed: 22, // 速度極快
        dropRate: 0.8,
        zone: "expedition"
    },
    {
        id: "golem",
        name: "魔像守衛",
        emoji: "🤖",
        minLvl: 12,
        baseHp: 800, baseAtk: 70, baseDef: 40,
        exp: 800,
        baseStr: 40, baseAgi: 2, baseCon: 50, baseTec: 10, baseSpeed: 6, // 極端血牛與坦克
        dropRate: 0.9,
        zone: "expedition"
    },

    // === 新增：通用區域 (Common) ===
    // 這些怪物可能在任何地方出現
    {
        id: "mimic",
        name: "寶箱怪",
        emoji: "📦",
        minLvl: 6,
        baseHp: 150, baseAtk: 20, baseDef: 10,
        exp: 100,
        baseStr: 15, baseAgi: 1, baseCon: 10, baseTec: 15, baseSpeed: 5, // 偽裝者，速度慢但有點硬
        dropRate: 0.9, // 偽裝成寶箱，掉寶率高
        zone: "common"
    },
    {
        id: "ghost",
        name: "遊蕩的鬼魂",
        emoji: "👻",
        minLvl: 2,
        baseHp: 55, baseAtk: 12, baseDef: 0, // ✨ 核心削弱：攻擊力大幅降低
        exp: 30,
        baseStr: 2, baseAgi: 14, baseCon: 4, baseTec: 10, baseSpeed: 18, // ✨ 補償：速度和敏捷微幅提升，更難命中
        dropRate: 0.2,
        zone: "common"
    }
];