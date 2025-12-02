// src/data/events.js
/* eslint-disable no-unused-vars */
export const EVENTS = [
    // === ✨ 新增：保底用的氛圍事件 ===
    {
        id: "e_eerie_silence",
        name: "詭異的寂靜",
        desc: "周圍突然變得異常安靜，讓你感到一絲不安。",
        type: "neutral", // 中性/氛圍事件
        chance: 0, // 權重為 0，正常情況下不會被抽到
        zones: ["nearby", "dungeon", "expedition"],
        effects: [] // 沒有實際效果
    },

    // === ✨ 新增：共通選擇事件 (淺層) ===
    {
        id: "e_suspicious_crate",
        name: "可疑的木箱",
        desc: "你發現一個被草草掩蓋的木箱。你可以試著暴力破解它，但可能會發出巨大聲響。",
        type: "choice", // 選擇事件
        chance: 10,
        zones: ["nearby", "dungeon"],
        maxDepth: 15, // 只在淺層出現
        choices: [
            { text: "暴力破解", action: "break_crate" },
            { text: "小心繞過", action: "ignore" }
        ],
        outcomes: {
            break_crate_success: { chance: 70, message: "你成功砸開了木箱！", lootType: "treasure" },
            break_crate_failure: { chance: 30, message: "噪音引來了附近的敵人！", type: "combat" }
        }
    },


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

    // === 附近 (Nearby) 專屬事件 ===
    {
        id: "e_find_berries",
        name: "發現漿果",
        desc: "你在灌木叢中找到了一些可以吃的漿果。",
        type: "boon",
        chance: 15,
        zones: ["nearby"],
        maxDepth: 10, // 只在極淺層出現
        effects: [
            { target: "hunger", value: 15, message: "恢復了 15 點飢餓。" }
        ]
    },
    {
        id: "e_hidden_path",
        name: "隱蔽的小徑",
        desc: "你撥開藤蔓，發現一條似乎能更快深入的捷徑。",
        type: "boon",
        chance: 5,
        zones: ["nearby"],
        effects: [{ target: "depth", value: 2, message: "你跳過了 2 層深度！" }]
    },

    // === 地下城 (Dungeon) 專屬事件 ===
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
    },
    {
        id: "e_ghostly_whisper",
        name: "鬼魅的低語",
        desc: "一陣冰冷的低語在你耳邊響起，讓你靈魂為之戰慄。",
        type: "trap",
        chance: 8,
        zones: ["dungeon"],
        minDepth: 8, // 只在深層出現
        effects: [{ target: "state", value: "詛咒", message: "你被詛咒了！(攻防下降)" }]
    },
    {
        id: "e_alchemists_note",
        name: "鍊金術士的筆記",
        desc: "你在一個廢棄的背包裡找到一本鍊金術士的筆記，上面記載著藥水的知識。",
        type: "boon",
        chance: 5,
        zones: ["dungeon"],
        effects: [
            // 未來可以實作：永久提升藥水效果
            { target: "exp", value: 100, message: "你從中領悟到一些知識，獲得 100 EXP。" }
        ]
    },

    // === ✨ 新增：可能導致重傷的事件 ===
    {
        id: "e_bad_fall",
        name: "嚴重扭傷",
        desc: "你在濕滑的地面上重重摔倒，感覺筋骨都錯位了。",
        type: "trap",
        chance: 5,
        zones: ["dungeon", "expedition"], // 只在較危險的區域發生
        effects: [
            { target: "state", value: "重傷", message: "你陷入了重傷狀態！(探索3次後解除)" }
        ]
    },
    // === 遠征 (Expedition) 專屬事件 ===
    {
        id: "e_ancient_fountain",
        name: "古代泉水",
        desc: "你發現一眼清澈的古代泉水，喝下後感到精神一振。",
        type: "boon",
        chance: 8,
        zones: ["expedition"],
        effects: [
            { target: "mp", value: 50, message: "恢復了 50 點MP。" }
        ]
    },
    {
        id: "e_dragon_scales",
        name: "脫落的龍鱗",
        desc: "你在地上撿到一片閃閃發光的巨大鱗片，似乎是某種強大生物留下的。",
        type: "loot",
        lootType: "material", // 歸類為素材
        chance: 10,
        zones: ["expedition"],
        minDepth: 5, // 只在遠征的深處
    },
    {
        id: "e_hidden_cache",
        name: "隱藏的儲藏物",
        desc: "在一個鬆動的石塊後面，你找到前人留下的少量物資。",
        type: "loot",
        lootType: "treasure", // 這裡也歸類為寶藏，讓 lootRandomItem 處理
        chance: 10,
        zones: ["dungeon", "expedition"],
        effects: []
    }
];