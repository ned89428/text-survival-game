import * as UI from './ui.js';
import * as Game from './logic.js';

console.log("正在載入 Main.js...");

// ✨ 更新：設定遊戲標題
const newTitle = "薪水小偷的冒險日誌";
document.title = newTitle; // 設定瀏覽器分頁標題
const titleElement = document.getElementById("title");
if (titleElement) titleElement.innerText = newTitle; // 設定頁面內可見標題

UI.updateStatus();
UI.updateInventory();
UI.addLog(`歡迎來到${newTitle}。`, "log-system");

// ===========================================================
// 掛載函式到 window
// ===========================================================

try {
    // 1. 系統與存檔 (將 confirmName 移到外面，確保初始畫面能用)
    window.chooseJob = Game.chooseJob;
    window.restartGame = Game.restartGame;
    window.hardReset = Game.hardReset;
    window.confirmDefeat = Game.confirmDefeat;
    window.confirmName = Game.confirmName; // ✨ 確保 confirmName 被掛載

    // 2. 屬性與背包操作
    window.addAttr = Game.addAttr;
    window.toggleInventory = UI.toggleInventory || Game.toggleInventory; // 相容檢查
    window.useItem = Game.useItem;
    window.sellOneItem = Game.sellOneItem;
    window.dropItem = Game.dropItem;
    window.equipItem = Game.equipItem;
    window.unequipItem = Game.unequipItem;
    window.moveToStash = Game.moveToStash;
    window.takeFromStash = Game.takeFromStash;
    window.depositGold = Game.depositGold;
    window.withdrawGold = Game.withdrawGold;

    // 3. 探索行動
    window.startExpedition = Game.startExpedition;
    window.advanceExploration = Game.advanceExploration;
    window.retreatToTown = Game.retreatToTown;
    window.forceRetreat = Game.forceRetreat; // ✨ 掛載強制撤離函式

    // 4. 戰鬥相關
    window.handleCombat = Game.handleCombat;
    window.runAway = Game.runAway;

    // 5. 商人相關 (請特別注意這裡)
    window.buyItem = Game.buyItem;
    window.openTownMerchant = Game.openTownMerchant;
    window.sellAllMaterials = Game.sellAllMaterials;
    window.closeMerchant = Game.closeMerchant;

    console.log("所有函式掛載完成！檢查商人函式: ", window.closeMerchant);

} catch (e) {
    console.error("掛載函式時發生錯誤:", e);
}

// 自動讀檔
Game.checkSaveAndStart();