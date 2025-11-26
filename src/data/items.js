// src/data/items.js

// 1. 裝備的基底 (Templates)
// 程式會從這裡挑選適合等級的基底，然後隨機加上品質前綴
export const EQUIP_TEMPLATES = [
    // === 武器 (Weapons) ===
    { id: "w_dagger", name: "生鏽短刀", type: "weapon", emoji: "🔪", baseAtk: 3, minLvl: 1 },
    { id: "w_sword", name: "鐵劍", type: "weapon", emoji: "⚔️", baseAtk: 6, minLvl: 3 },
    { id: "w_axe", name: "雙刃斧", type: "weapon", emoji: "🪓", baseAtk: 10, minLvl: 5 },
    { id: "w_spear", name: "騎士長槍", type: "weapon", emoji: "🔱", baseAtk: 15, minLvl: 8 },
    { id: "w_wand", name: "學徒法杖", type: "weapon", emoji: "🪄", baseAtk: 2, magicAtk: 5, minLvl: 1 }, // 法師用
    { id: "w_staff", name: "紅寶石法杖", type: "weapon", emoji: "🔥", baseAtk: 5, magicAtk: 15, minLvl: 5 },

    // === 頭盔 (Head) ===
    { id: "h_cap", name: "皮帽", type: "head", emoji: "🧢", baseDef: 1, minLvl: 1 },
    { id: "h_helm", name: "鐵盔", type: "head", emoji: "🪖", baseDef: 3, minLvl: 4 },
    { id: "h_crown", name: "貴族頭冠", type: "head", emoji: "👑", baseDef: 2, int: 3, minLvl: 6 }, // 加智力

    // === 身體 (Body) ===
    { id: "b_shirt", name: "布衣", type: "body", emoji: "👕", baseDef: 2, minLvl: 1 },
    { id: "b_leather", name: "皮甲", type: "body", emoji: "🧥", baseDef: 4, hp: 20, minLvl: 3 },
    { id: "b_plate", name: "鋼鐵鎧甲", type: "body", emoji: "🛡️", baseDef: 8, hp: 50, minLvl: 7 },
    { id: "b_robe", name: "法師長袍", type: "body", emoji: "👘", baseDef: 3, mp: 20, int: 5, minLvl: 3 },

    // === 飾品 (Accessory) ===
    { id: "a_ring", name: "銅戒指", type: "accessory", emoji: "💍", str: 1, minLvl: 1 },
    { id: "a_amulet", name: "護身符", type: "accessory", emoji: "🧿", con: 2, minLvl: 2 },
    { id: "a_gem", name: "魔力寶石", type: "accessory", emoji: "💎", int: 3, minLvl: 4 }
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
// 修正：必須加上 usable: true，UI 才會顯示「使用」按鈕
export const CONSUMABLES = [
    { id: "c_food_1", name: "乾糧包", type: "food", emoji: "🍞", value: 30, price: 20, usable: true },
    { id: "c_heal_1", name: "輕型治療藥水", type: "heal", emoji: "🧴", value: 30, price: 25, usable: true },
    { id: "c_heal_2", name: "高級治療藥水", type: "heal", emoji: "💉", value: 80, price: 60, usable: true },
    { id: "c_mana_1", name: "法力藥水", type: "mana", emoji: "🧪", value: 20, price: 30, usable: true }
];