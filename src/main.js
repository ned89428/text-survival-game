import * as UI from './ui.js';
import * as Game from './logic.js';

// 初始化介面
UI.updateStatus();
UI.updateInventory();
UI.addLog("歡迎來到文字生存傳說。", "log-system");

// ===========================================================
// 掛載函式到 window (讓 HTML 按鈕找得到這些功能)
// ===========================================================

// 1. 系統與存檔
window.confirmName = Game.confirmName;
window.chooseJob = Game.chooseJob;
window.restartGame = Game.restartGame;
window.hardReset = Game.hardReset;

// 2. 屬性與背包操作
window.addAttr = Game.addAttr;
window.toggleInventory = Game.toggleInventory;
window.useItem = Game.useItem;
window.sellOneItem = Game.sellOneItem;
window.dropItem = Game.dropItem;
window.equipItem = Game.equipItem;
window.unequipItem = Game.unequipItem;

// 3. 探索行動 (這裡就是你失效的那排按鈕)
window.exploreNearby = Game.exploreNearby;
window.exploreDungeon = Game.exploreDungeon;
window.exploreExpedition = Game.exploreExpedition;
window.rest = Game.rest;

// 4. 戰鬥相關 (新版)
window.handleCombat = Game.handleCombat; // 戰鬥主控
window.attack = Game.attack;             // (備用，防舊代碼報錯)
window.runAway = Game.runAway;           // (備用)

// 5. 商人相關
window.buyItem = Game.buyItem;
window.sellAllMaterials = Game.sellAllMaterials;
window.closeMerchant = Game.closeMerchant;

console.log("遊戲模組載入完成。正在檢查存檔...");

// 自動讀檔
Game.checkSaveAndStart();