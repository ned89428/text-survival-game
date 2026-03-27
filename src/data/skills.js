// src/data/skills.js

export const SKILLS = [
    // === 戰士 (Warrior) ===
    {
        id: "s_bash",
        name: "強力重擊",
        job: "通用",
        type: "physical",
        costType: "mp",
        cost: 8,
        dmgScale: 1.5, 
        speedMod: -5, // <--- 新增：速度懲罰，容易後手
        desc: "消耗 8 MP，造成 150% 傷害 (速度 -5)。"
    },

    // === 弓箭手 (Archer) ===
    {
        id: "s_double_shot",
        name: "二連矢",
        job: "通用",
        type: "physical",
        costType: "mp",
        cost: 10,
        dmgScale: 0.8, 
        hits: 2,       
        speedMod: 2, // <--- 新增：速度加成
        desc: "消耗 10 MP，射兩箭各造成 80% 傷害 (速度 +2)。"
    },

    // === 盜賊 (Rogue) ===
    {
        id: "s_backstab",
        name: "背刺",
        job: "通用",
        type: "physical",
        costType: "mp",
        cost: 12,
        dmgScale: 1.2,
        critBonus: 50, 
        speedMod: 5, // <--- 新增：極快
        desc: "消耗 12 MP，高爆擊背後攻擊 (速度 +5)。"
    },

    // === 法師 (Mage) ===
    {
        id: "s_fireball",
        name: "火球術",
        job: "通用",
        type: "magic", 
        costType: "mp",
        cost: 15,
        dmgScale: 1.5, 
        speedMod: 0, // 普通速度
        desc: "消耗 15 MP，造成 150% 無視防禦傷害。"
    },
    {
        id: "s_ice_storm",
        name: "冰風暴",
        job: "通用",
        type: "magic",
        costType: "mp",
        cost: 20,
        dmgScale: 2.0,
        speedMod: -2, // 比火球術慢
        desc: "消耗 20 MP，造成 200% 無視防禦傷害 (速度 -2)。"
    },

    // === ✨ Gemini Code Assist 新增：技能書技能 ===
    {
        id: "s_high_speed_shot",
        name: "高速射擊",
        job: "通用", // 任何職業都能學
        type: "physical",
        costType: "mp",
        cost: 18,
        dmgScale: 1.1,
        speedMod: 3,
        effects: [{ target: 'actionGauge', value: 30 }], // 使用後，返還 30 點行動值
        desc: "消耗 18 MP，造成 110% 傷害並提升自身 30 行動值。"
    },
    {
        id: "s_shield_bash",
        name: "盾牌猛擊",
        job: "通用",
        type: "physical",
        costType: "mp",
        cost: 12,
        dmgScale: 0.9,
        speedMod: -2,
        // 新效果：50% 機率減少敵人 50 點行動值，打斷其節奏
        effects: [{ target: 'enemy', type: 'actionGauge', value: -50, chance: 0.5 }],
        desc: "消耗 12 MP，造成 90% 傷害並有 50% 機率擊退敵人 50 行動值。"
    },
    {
        id: "s_meditate",
        name: "冥想",
        job: "通用",
        type: "buff", // 非傷害性技能
        costType: "mp",
        cost: 0, // 不消耗 MP
        dmgScale: 0, // 不造成傷害
        speedMod: -10, // 需要長時間詠唱，風險高
        effects: [{ target: 'player', type: 'mp_regen', value: 50 }], // 恢復 50 MP
        desc: "消耗 1 回合，集中精神恢復 50 MP (速度 -10)。"
    },

    // === ✨ Gemini Code Assist 新增：荒野秘術師技能 ===
    {
        id: "s_sunder_armor",
        name: "破甲斬",
        job: "通用",
        type: "physical",
        costType: "mp",
        cost: 20,
        dmgScale: 1.8,
        speedMod: -3,
        // 新效果：100% 機率降低敵人 20% 防禦，持續 3 回合
        effects: [{ target: 'enemy', type: 'debuff', stat: 'def', value: -0.2, duration: 3, chance: 1.0 }],
        desc: "消耗 20 MP，造成 180% 傷害並擊碎敵人護甲，使其防禦降低 20%。"
    },
    {
        id: "s_shadow_step",
        name: "影襲",
        job: "通用",
        type: "physical",
        costType: "mp",
        cost: 22,
        dmgScale: 1.4,
        speedMod: 6,
        // 新效果：使用後，賦予自身「閃避提升」狀態，持續 2 回合
        effects: [{ target: 'player', type: 'buff', stat: 'dodge', value: 50, duration: 2 }],
        desc: "消耗 22 MP，發動一次迅捷的攻擊，並在 2 回合內大幅提升自身閃避。"
    },
];