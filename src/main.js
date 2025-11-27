import * as UI from './ui.js';
import * as Game from './logic.js';

// 初始化介面
UI.updateStatus();
UI.updateInventory();
UI.addLog("歡迎來到文字生存傳說。", "log-system");

// ===========================================================
// 掛載函式到 window
// ===========================================================

// 1. 系統與存檔
window.confirmName = Game.confirmName;
window.chooseJob = Game.chooseJob;
window.restartGame = Game.restartGame;
window.hardReset = Game.hardReset;
window.confirmDefeat = Game.confirmDefeat; // 戰敗確認

// 2. 屬性與背包操作
window.addAttr = Game.addAttr;
window.toggleInventory = Game.toggleInventory;
window.useItem = Game.useItem;
window.sellOneItem = Game.sellOneItem;
window.dropItem = Game.dropItem;
window.equipItem = Game.equipItem;
window.unequipItem = Game.unequipItem;

// ✨ 補上這兩行，倉庫才能運作！ ✨
window.moveToStash = Game.moveToStash;
window.takeFromStash = Game.takeFromStash;

// 3. 探索行動
window.exploreNearby = Game.exploreNearby;
window.exploreDungeon = Game.exploreDungeon;
window.exploreExpedition = Game.exploreExpedition;
window.rest = Game.rest;

// 4. 戰鬥相關
window.handleCombat = Game.handleCombat;
window.attack = Game.attack;
window.runAway = Game.runAway;

// 5. 商人相關
window.buyItem = Game.buyItem;
window.sellAllMaterials = Game.sellAllMaterials;
window.closeMerchant = Game.closeMerchant;

console.log("遊戲模組載入完成。正在檢查存檔...");

// 自動讀檔
Game.checkSaveAndStart();