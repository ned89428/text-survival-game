// src/data/events.js

export const EVENTS = [
    // === 通用事件 (所有區域都可能發生) ===
    {
        id: "e_trip_over",
        name: "不慎絆倒",
        desc: "你被一根樹根絆倒，摔了一跤。",
        type: "trap", // 陷阱/負面事件
        chance: 10,
        zones: ["nearby", "dungeon", "expedition"],
        effects: [
            { target: "hp", value: -5, message: "損失了 5 點HP。" }
        ]
    },
    {
        id: "e_eerie_silence",
        name: "詭異的寂靜",
        desc: "周圍突然變得異常安靜，讓你感到一絲不安。",
        type: "neutral", // 中性/氛圍事件
        chance: 20,
        zones: ["nearby", "dungeon", "expedition"],
        effects: [] // 沒有實際效果
    },

    // === 附近 (Nearby) 專屬事件 ===
    {
        id: "e_find_berries",
        name: "發現漿果",
        desc: "你在灌木叢中找到了一些可以吃的漿果。",
        type: "boon", // 增益/正面事件
        chance: 15,
        zones: ["nearby"],
        effects: [
            { target: "hunger", value: 15, message: "恢復了 15 點飢餓。" }
        ]
    },

    // === 地下城 (Dungeon) 專屬事件 ===
    {
        id: "e_rusty_key",
        name: "生鏽的鑰匙",
        desc: "你在一個骷髏旁找到一把生鏽的鑰匙，它似乎能打開什麼...",
        type: "item", // 物品事件
        chance: 10,
        zones: ["dungeon"],
        effects: [
            // 未來可以擴充，例如給予一個 "key" 物品
        ]
    },
    {
        id: "e_dungeon_trap",
        name: "壓力板陷阱",
        desc: "你踩到了一塊鬆動的石板，牆壁射出了毒箭！",
        type: "trap",
        chance: 10,
        zones: ["dungeon"],
        effects: [
            { target: "hp", value: -20, message: "中毒了！損失 20 點HP。" },
            { target: "state", value: "中毒", message: "你陷入了中毒狀態。" }
        ]
    }
];