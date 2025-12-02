// src/data/merchants.js

/**
 * 這是所有商人資料的中央儲存庫。
 *
 * 結構說明:
 * - itemId: 對應到 items.js 或 consumables 中的物品 ID。
 * - type: 'consumable' 或 'equipment'，讓邏輯知道要去哪個資料來源查找物品範本。
 * - price: (可選) 如果想覆蓋物品的預設價格，可以在這裡指定。
 * - availableAtLevel: (可選) 該商品在玩家達到指定等級後才會出現。
 */

export const MERCHANTS = {
    // 城鎮中的主要商店
    TOWN: {
        name: "城鎮商店",
        inventory: [
            // 消耗品 (價格來自 items.js)
            { itemId: 'food_ration', type: 'consumable', availableAtLevel: 1 },
            { itemId: 'potion_heal_s', type: 'consumable', availableAtLevel: 1 },
            { itemId: 'potion_mana_s', type: 'consumable', availableAtLevel: 1 },
            { itemId: 'food_ration_large', type: 'consumable', availableAtLevel: 3 },
            { itemId: 'potion_heal_m', type: 'consumable', availableAtLevel: 5 },
            { itemId: 'potion_mana_m', type: 'consumable', availableAtLevel: 5 },
            // 裝備 (價格預設來自 items.js 的 basePrice)
            { itemId: 'w_dagger', type: 'equipment', availableAtLevel: 1 },
            { itemId: 'b_shirt', type: 'equipment', availableAtLevel: 1 },
            { itemId: 'h_cap', type: 'equipment', availableAtLevel: 1 },
            { itemId: 'b_leather', type: 'equipment', availableAtLevel: 3 },
            { itemId: 'w_axe', type: 'equipment', availableAtLevel: 5 },
            { itemId: 'h_helm', type: 'equipment', availableAtLevel: 5 },
            // 這個商品有特定的覆蓋價格 (比 basePrice 貴)
            { itemId: 'w_sword', type: 'equipment', price: 190, availableAtLevel: 3 },
        ]
    },

    // 隨機遇到的流浪商人
    WANDERING: {
        name: "流浪商人",
        // 流浪商人會從一個商品池中隨機挑選幾樣來賣，再加上隨機裝備
        inventoryPool: [
            { itemId: 'food_ration_large', type: 'consumable' },
            { itemId: 'potion_heal_m', type: 'consumable' },
            { itemId: 'potion_mana_m', type: 'consumable' },
            // 流浪商人賣的護身符比較貴
            { itemId: 'a_amulet', type: 'equipment', price: 250 },
        ],
        // 流浪商人販賣的隨機裝備規則
        randomEquipment: {
            count: 1, // 隨機產生 1 件
            levelBonus: 1 // 裝備等級 = 玩家等級 + 1
        }
    },

    // 預留的稀有商人，目前遊戲中還不會遇到
    RARE: {
        name: "稀有商人",
        inventoryPool: [
            // 可能販賣一些高級藥水或稀有材料
            { itemId: 'potion_heal_m', type: 'consumable', stock: 5 },
            { itemId: 'potion_mana_m', type: 'consumable', stock: 5 },
        ],
        randomEquipment: {
            count: 2, // 販賣 2 件隨機裝備
            levelBonus: 3, // 裝備等級較高
            // 未來可以加上品質要求，例如 mod > 1.5
        }
    }
};