// src/data/items.js

// 1. 裝備的基底 (Templates)
// 程式會從這裡挑選適合等級的基底，然後隨機加上品質前綴
export const EQUIP_TEMPLATES = [ // 確保所有裝備都有 basePrice
    // === 武器 (Weapons) ===
    { id: "w_dagger", name: "生鏽短刀", type: "weapon", emoji: "🔪", baseAtk: 3, minLvl: 1, usable: true, basePrice: 40 },
    { id: "w_sword", name: "鐵劍", type: "weapon", emoji: "⚔️", baseAtk: 6, minLvl: 3, usable: true, basePrice: 170 },
    { id: "w_axe", name: "雙刃斧", type: "weapon", emoji: "🪓", baseAtk: 10, minLvl: 5, usable: true, basePrice: 420 },
    { id: "w_spear", name: "騎士長槍", type: "weapon", emoji: "🔱", baseAtk: 15, minLvl: 8, usable: true, basePrice: 700 },
    { id: "w_obsidian_sword", name: "黑曜石劍", type: "weapon", emoji: "🗡️", baseAtk: 22, minLvl: 12, usable: true, basePrice: 1200 },
    { id: "w_warhammer", name: "雷神戰鎚", type: "weapon", emoji: "🔨", baseAtk: 30, str: 5, minLvl: 15, usable: true, basePrice: 2500 },

    { id: "w_wand", name: "學徒法杖", type: "weapon", emoji: "🪄", baseAtk: 2, magicAtk: 5, minLvl: 1, usable: true, basePrice: 60 }, // 法師用
    { id: "w_staff", name: "紅寶石法杖", type: "weapon", emoji: "🔥", baseAtk: 5, magicAtk: 15, minLvl: 5, usable: true, basePrice: 500 },

    // === 頭盔 (Head) ===
    { id: "h_cap", name: "皮帽", type: "head", emoji: "🧢", baseDef: 1, minLvl: 1, usable: true, basePrice: 45 },
    { id: "h_helm", name: "鐵盔", type: "head", emoji: "🪖", baseDef: 3, minLvl: 4, usable: true, basePrice: 350 },
    { id: "h_crown", name: "貴族頭冠", type: "head", emoji: "👑", baseDef: 2, int: 3, minLvl: 6, usable: true, basePrice: 600 }, // 加智力
    { id: "h_dragon_helm", name: "龍鱗頭盔", type: "head", emoji: "🐲", baseDef: 7, con: 3, minLvl: 14, usable: true, basePrice: 1800 },

    // === 身體 (Body) ===
    { id: "b_shirt", name: "布衣", type: "body", emoji: "👕", baseDef: 2, minLvl: 1, usable: true, basePrice: 55 },
    { id: "b_leather", name: "皮甲", type: "body", emoji: "🧥", baseDef: 4, hp: 20, minLvl: 3, usable: true, basePrice: 200 },
    { id: "b_plate", name: "鋼鐵鎧甲", type: "body", emoji: "🛡️", baseDef: 8, hp: 50, minLvl: 7, usable: true, basePrice: 800 },
    { id: "b_robe", name: "法師長袍", type: "body", emoji: "👘", baseDef: 3, mp: 20, int: 5, minLvl: 3, usable: true, basePrice: 300 },
    { id: "b_dragonscale_mail", name: "龍皮甲", type: "body", emoji: "🐉", baseDef: 15, hp: 100, minLvl: 16, usable: true, basePrice: 3000 },

    // === 飾品 (Accessory) ===
    { id: "a_ring", name: "銅戒指", type: "accessory", emoji: "💍", str: 1, minLvl: 1, usable: true, basePrice: 80 },
    { id: "a_amulet", name: "護身符", type: "accessory", emoji: "🧿", con: 2, minLvl: 2, usable: true, basePrice: 150 },
    { id: "a_gem", name: "魔力寶石", type: "accessory", emoji: "💎", int: 3, minLvl: 4, usable: true, basePrice: 400 },
    { id: "a_compass", name: "探險家羅盤", type: "accessory", emoji: "🧭", exitFindBonus: 5, minLvl: 5, usable: true, basePrice: 500 },

    // === ✨ 新增：鞋子 (Shoes) ===
    { id: "s_boots", name: "皮靴", type: "shoes", emoji: "👢", baseDef: 1, agi: 1, minLvl: 1, usable: true, basePrice: 70 },
    { id: "s_greaves", name: "鐵製脛甲", type: "shoes", emoji: "🥾", baseDef: 2, con: 1, minLvl: 4, usable: true, basePrice: 320 },

    // === ✨ 新增：背包 (Backpack) ===
    { id: "p_small_pouch", name: "小皮袋", type: "backpack", emoji: "👝", slots: 1, minLvl: 1, usable: true, basePrice: 100 },
    { id: "p_hiking_pack", name: "登山包", type: "backpack", emoji: "🎒", hp: 30, con: 1, slots: 2, minLvl: 5, usable: true, basePrice: 450 }
];

// 2. 品質詞綴 (決定基礎數值倍率)
// 這是讓裝備數值膨脹的關鍵
export const ITEM_PREFIXES = [
    { id: 'worn', name: "破舊的", mod: 0.6, chance: 20, enchantChance: 0.01 },   // 1% 機率附魔
    { id: 'common', name: "普通的", mod: 1.0, chance: 50, enchantChance: 0.05 },   // 5% 機率附魔
    { id: 'sturdy', name: "堅固的", mod: 1.3, chance: 15, enchantChance: 0.20 },  // 20% 機率附魔
    { id: 'fine', name: "精良的", mod: 1.6, chance: 10, enchantChance: 0.50 },   // 50% 機率附魔
    { id: 'epic', name: "史詩的", mod: 2.2, chance: 4, enchantChance: 0.85 },  // 85% 機率附魔
    { id: 'legendary', name: "傳說的", mod: 3.5, chance: 1, enchantChance: 1.0 }    // 100% 機率附魔
];

// 3. ✨ 新增：魔法詞綴 (提供額外屬性)
export const ITEM_ENCHANTMENTS = [
    // 攻擊型
    { id: 'flame', name: "火焰的", stats: { magicAtk: 5 }, chance: 10 },
    { id: 'frost', name: "冰霜的", stats: { mp: 15 }, chance: 10 },
    { id: 'power', name: "力量的", stats: { str: 2 }, chance: 15 },
    // 防禦型
    { id: 'protection', name: "守護的", stats: { def: 3 }, chance: 15 },
    { id: 'health', name: "活力的", stats: { hp: 30 }, chance: 15 },
    // 功能型
    { id: 'swiftness', name: "靈巧的", stats: { agi: 2 }, chance: 15 },
    { id: 'precision', name: "精準的", stats: { tec: 2 }, chance: 15 },
    { id: 'wisdom', name: "智慧的", stats: { int: 2 }, chance: 5 },
    // ✨ 新增：探索型詞綴
    { id: 'prospecting', name: "探勘的", stats: { exitFindBonus: 10 }, chance: 8 }, // 增加找到出口機率
    { id: 'lucky', name: "幸運的", stats: { lootFindBonus: 15 }, chance: 8 }, // 增加找到物品機率
    { id: 'thief', name: "盜賊的", stats: { agi: 1, exitFindBonus: 5 }, chance: 5 }, // 複合屬性

];

// 4. 消耗品 (Consumables)
export const CONSUMABLES = [
    { 
        id: "food_ration", name: "乾糧包", emoji: "🍱", type: "consumable", usable: true, price: 15, stackable: true, maxStack: 10,
        effects: [
            { target: "hunger", value: 30 },
        ],
        desc: "恢復 30 飢餓。",
        chance: 80 // ✨ 新增：出現權重 (數字越大越常見)
    },

        { 
        id: "food_ration_large", name: "大乾糧包", emoji: "🍱", type: "consumable", usable: true, price: 30, stackable: true, maxStack: 10,
        effects: [
            { target: "hunger", value: 60 },
        ],
        desc: "恢復 60 飢餓。",
        chance: 20 // ✨ 新增：出現權重 (數字越小越稀有)
    },
    { 
        id: "potion_heal_s", name: "小回復藥水", emoji: "🧪", type: "consumable", usable: true, price: 50, stackable: true, maxStack: 5,
        effects: [
            { target: "hp", value: 50 }
        ],
        desc: "恢復 50 HP。",
        chance: 30
    },
    { 
        id: "potion_heal_m", name: "回復藥水", emoji: "🧪", type: "consumable", usable: true, price: 120, stackable: true, maxStack: 5,
        effects: [
            { target: "hp", value: 150 }
        ],
        desc: "恢復 150 HP。",
        chance: 10
    },
    { 
        id: "potion_mana_s", name: "小魔力藥水", emoji: "💧", type: "consumable", usable: true, price: 60, stackable: true, maxStack: 5,
        effects: [
            { target: "mp", value: 30 }
        ],
        desc: "恢復 30 MP。",
        chance: 30
    },
    { 
        id: "potion_mana_m", name: "魔力藥水", emoji: "💧", type: "consumable", usable: true, price: 150, stackable: true, maxStack: 5,
        effects: [
            { target: "mp", value: 100 }
        ],
        desc: "恢復 100 MP。",
        chance: 10
    },
    // === ✨ Gemini Code Assist 新增：技能書 ===
    {
        id: "book_high_speed_shot",
        name: "技能書：高速射擊",
        emoji: "📖",
        type: "consumable",
        usable: true,
        price: 1200, // 技能書應該很珍貴
        stackable: false, // 技能書通常是唯一的
        skillId: "s_high_speed_shot", // 對應到 skills.js 中的技能 ID
        requirements: { agi: 20 }, // 學習此技能需要 20 點敏捷
        desc: "學習技能「高速射擊」。(需要 20 敏捷)"
    },
    {
        id: "book_bash",
        name: "技能書：強力重擊",
        emoji: "📖", type: "consumable", usable: true, price: 200, stackable: false,
        skillId: "s_bash",
        requirements: { str: 15 },
        desc: "學習技能「強力重擊」。(需要 15 力量)"
    },
    {
        id: "book_double_shot",
        name: "技能書：二連矢",
        emoji: "📖", type: "consumable", usable: true, price: 200, stackable: false,
        skillId: "s_double_shot",
        requirements: { agi: 15, tec: 10 },
        desc: "學習技能「二連矢」。(需要 15 敏捷, 10 技巧)"
    },
    {
        id: "book_backstab",
        name: "技能書：背刺",
        emoji: "📖", type: "consumable", usable: true, price: 200, stackable: false,
        skillId: "s_backstab",
        requirements: { agi: 20, tec: 15 },
        desc: "學習技能「背刺」。(需要 20 敏捷, 15 技巧)"
    },
    {
        id: "book_fireball",
        name: "技能書：火球術",
        emoji: "📖", type: "consumable", usable: true, price: 200, stackable: false,
        skillId: "s_fireball",
        requirements: { int: 15 },
        desc: "學習技能「火球術」。(需要 15 智慧)"
    },
    {
        id: "book_ice_storm",
        name: "技能書：冰風暴",
        emoji: "📖", type: "consumable", usable: true, price: 2200, stackable: false,
        skillId: "s_ice_storm",
        requirements: { int: 25 },
        desc: "學習技能「冰風暴」。(需要 25 智慧)"
    },
    // === ✨ Gemini Code Assist 新增：荒野秘術師技能書 ===
    {
        id: "book_sunder_armor",
        name: "秘笈：破甲斬",
        emoji: "📜", type: "consumable", usable: true, price: 3500, stackable: false,
        skillId: "s_sunder_armor",
        requirements: { str: 25, con: 15 },
        desc: "學習稀有技能「破甲斬」。(需要 25 力量, 15 體質)"
    },
    {
        id: "book_shadow_step",
        name: "秘笈：影襲",
        emoji: "📜", type: "consumable", usable: true, price: 4200, stackable: false,
        skillId: "s_shadow_step",
        requirements: { agi: 30, tec: 20 },
        desc: "學習稀有技能「影襲」。(需要 30 敏捷, 20 技巧)"
    },
    {
        id: "book_mana_shield",
        name: "秘笈：法力護盾",
        emoji: "📜", type: "consumable", usable: true, price: 3800, stackable: false,
        skillId: "s_mana_shield",
        requirements: { int: 30 },
        desc: "學習稀有技能「法力護盾」。(需要 30 智慧)"
    }
];