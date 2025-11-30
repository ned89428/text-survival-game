export const ENEMIES = [
    // === Lv 1-3: 新手區 (Nearby) ===
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

    // === Lv 4-7: 地下城 (Dungeon) ===
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

    // === Lv 8+: 遠征 (Expedition) ===
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
    }
];