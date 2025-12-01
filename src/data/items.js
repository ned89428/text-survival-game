// src/data/items.js

// 1. 裝備的基底 (Templates)
// 程式會從這裡挑選適合等級的基底，然後隨機加上品質前綴
export const EQUIP_TEMPLATES = [
    // === 武器 (Weapons) ===
    { id: "w_dagger", name: "生鏽短刀", type: "weapon", emoji: "🔪", baseAtk: 3, minLvl: 1, usable: true, basePrice: 40 },
    { id: "w_sword", name: "鐵劍", type: "weapon", emoji: "⚔️", baseAtk: 6, minLvl: 3, usable: true, basePrice: 170 },
    { id: "w_axe", name: "雙刃斧", type: "weapon", emoji: "🪓", baseAtk: 10, minLvl: 5, usable: true, basePrice: 420 },
    { id: "w_spear", name: "騎士長槍", type: "weapon", emoji: "🔱", baseAtk: 15, minLvl: 8, usable: true, basePrice: 700 },
    { id: "w_wand", name: "學徒法杖", type: "weapon", emoji: "🪄", baseAtk: 2, magicAtk: 5, minLvl: 1, usable: true, basePrice: 60 }, // 法師用
    { id: "w_staff", name: "紅寶石法杖", type: "weapon", emoji: "🔥", baseAtk: 5, magicAtk: 15, minLvl: 5, usable: true, basePrice: 500 },

    // === 頭盔 (Head) ===
    { id: "h_cap", name: "皮帽", type: "head", emoji: "🧢", baseDef: 1, minLvl: 1, usable: true, basePrice: 45 },
    { id: "h_helm", name: "鐵盔", type: "head", emoji: "🪖", baseDef: 3, minLvl: 4, usable: true, basePrice: 350 },
    { id: "h_crown", name: "貴族頭冠", type: "head", emoji: "👑", baseDef: 2, int: 3, minLvl: 6, usable: true, basePrice: 600 }, // 加智力

    // === 身體 (Body) ===
    { id: "b_shirt", name: "布衣", type: "body", emoji: "👕", baseDef: 2, minLvl: 1, usable: true, basePrice: 55 },
    { id: "b_leather", name: "皮甲", type: "body", emoji: "🧥", baseDef: 4, hp: 20, minLvl: 3, usable: true, basePrice: 200 },
    { id: "b_plate", name: "鋼鐵鎧甲", type: "body", emoji: "🛡️", baseDef: 8, hp: 50, minLvl: 7, usable: true, basePrice: 800 },
    { id: "b_robe", name: "法師長袍", type: "body", emoji: "👘", baseDef: 3, mp: 20, int: 5, minLvl: 3, usable: true, basePrice: 300 },

    // === 飾品 (Accessory) ===
    { id: "a_ring", name: "銅戒指", type: "accessory", emoji: "💍", str: 1, minLvl: 1, usable: true, basePrice: 80 },
    { id: "a_amulet", name: "護身符", type: "accessory", emoji: "🧿", con: 2, minLvl: 2, usable: true, basePrice: 150 },
    { id: "a_gem", name: "魔力寶石", type: "accessory", emoji: "💎", int: 3, minLvl: 4, usable: true, basePrice: 400 },

    // === ✨ 新增：鞋子 (Shoes) ===
    { id: "s_boots", name: "皮靴", type: "shoes", emoji: "👢", baseDef: 1, agi: 1, minLvl: 1, usable: true, basePrice: 70 },
    { id: "s_greaves", name: "鐵製脛甲", type: "shoes", emoji: "🥾", baseDef: 2, con: 1, minLvl: 4, usable: true, basePrice: 320 },

    // === ✨ 新增：背包 (Backpack) ===
    { id: "p_small_pouch", name: "小皮袋", type: "backpack", emoji: "👝", slots: 1, minLvl: 1, usable: true, basePrice: 100 },
    { id: "p_hiking_pack", name: "登山包", type: "backpack", emoji: "🎒", hp: 30, con: 1, slots: 2, minLvl: 5, usable: true, basePrice: 450 }
];

// 2. 品質前綴 (Prefixes)
// 這是讓裝備數值膨脹的關鍵
export const ITEM_PREFIXES = [
    { name: "破舊的", mod: 0.6, chance: 0.2 },   // 爛裝
    { name: "普通的", mod: 1.0, chance: 0.5 },   // 普裝
    { name: "堅固的", mod: 1.3, chance: 0.15 },  // 好裝
    { name: "精良的", mod: 1.6, chance: 0.1 },   // 強裝
    { name: "史詩的", mod: 2.2, chance: 0.04 },  // 神裝
    { name: "傳說的", mod: 3.5, chance: 0.01 }   // 超神裝
];

// 3. 消耗品 (Consumables)
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
    }
];