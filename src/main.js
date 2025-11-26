import * as UI from './ui.js';
import * as Game from './logic.js';

// 初始化介面
UI.updateStatus();
UI.updateInventory();
UI.addLog("歡迎來到文字生存傳說。", "log-system");

// 掛載函式
window.confirmName = Game.confirmName;
window.chooseJob = Game.chooseJob;
window.restartGame = Game.restartGame;

window.addAttr = Game.addAttr;
window.toggleInventory = Game.toggleInventory;
window.useItem = Game.useItem;
window.sellOneItem = Game.sellOneItem;
window.dropItem = Game.dropItem;

window.equipItem = Game.equipItem;
window.unequipItem = Game.unequipItem;

window.exploreNearby = Game.exploreNearby;
window.exploreDungeon = Game.exploreDungeon;
window.exploreExpedition = Game.exploreExpedition;
window.rest = Game.rest;

window.attack = Game.attack;
window.runAway = Game.runAway;

window.buyItem = Game.buyItem;
window.sellAllMaterials = Game.sellAllMaterials;
window.closeMerchant = Game.closeMerchant;

// 新增：硬重置
window.hardReset = Game.hardReset;

console.log("遊戲模組載入完成。正在檢查存檔...");

// 嘗試自動讀檔
// 如果有存檔，會直接進入遊戲；沒有則停留在創角畫面
Game.checkSaveAndStart();