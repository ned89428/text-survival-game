// src/data/skills.js

export const SKILLS = [
    // === 戰士 (Warrior) ===
    {
        id: "s_bash",
        name: "強力重擊",
        job: "戰士",
        minLvl: 1,
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
        job: "弓箭手",
        minLvl: 1,
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
        job: "盜賊",
        minLvl: 1,
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
        job: "法師",
        minLvl: 1,
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
        job: "法師",
        minLvl: 5,
        type: "magic",
        costType: "mp",
        cost: 20,
        dmgScale: 2.0,
        speedMod: -2, // 比火球術慢
        desc: "消耗 20 MP，造成 200% 無視防禦傷害 (速度 -2)。"
    }
];