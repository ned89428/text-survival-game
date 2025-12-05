import * as UI from './ui.js';
import * as Game from './logic.js';

console.log("正在載入 Main.js...");

// ✨ 更新：設定遊戲標題
const newTitle = "Take It Alive";
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
    window.restartGame = Game.restartGame;
    window.hardReset = Game.hardReset;
    window.confirmDefeat = Game.confirmDefeat;
    window.confirmName = Game.confirmName; // ✨ 確保 confirmName 被掛載
    window.allocatePoint = Game.allocatePoint; // ✨ 掛載增加點數函式
    window.removePoint = Game.removePoint;   // ✨ 掛載移除點數函式
    window.confirmAttributes = Game.confirmAttributes; // ✨ 掛載確認屬性函式
    window.randomlyAllocatePoints = Game.randomlyAllocatePoints; // ✨ 掛載隨機分配函式
    window.chooseInitialSkill = Game.chooseInitialSkill; // ✨ 掛載初始技能選擇函式

    // 2. 屬性與背包操作
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
    window.swapWithLoot = Game.swapWithLoot; // ✨ 掛載替換函式
    window.discardPendingLoot = Game.discardPendingLoot; // ✨ 掛載丟棄函式

    // 3. 探索行動
    window.startExpedition = Game.startExpedition;
    window.advanceExploration = Game.advanceExploration;
    window.retreatToTown = Game.retreatToTown;
    window.forceRetreat = Game.forceRetreat; // ✨ 掛載強制撤離函式
    window.handleChoiceEvent = Game.handleChoiceEvent; // ✨ 掛載選擇事件處理函式

    // 4. 戰鬥相關
    window.handleCombat = Game.handleCombat;
    window.attemptToRun = Game.attemptToRun; // ✨ 掛載新的逃跑函式
    window.startBossBattle = Game.startBossBattle; // ✨ 核心修正：掛載正確的 BOSS 戰函式
    window.avoidBoss = Game.avoidBoss;             // ✨ 核心修正：掛載正確的迴避函式

    // 5. 商人相關 (請特別注意這裡)
    window.buyItem = Game.buyItem;
    window.openTownMerchant = Game.openTownMerchant;
    window.sellAllMaterials = Game.sellAllMaterials;
    window.closeMerchant = Game.closeMerchant;

    // 6. 訓練場相關 (新增)
    window.openTrainingGround = Game.openTrainingGround;
    window.closeTrainingGround = Game.closeTrainingGround;
    window.trainAttribute = Game.trainAttribute;

    // 7. 食堂相關 (新增)
    window.openCanteen = Game.openCanteen;
    window.closeCanteen = Game.closeCanteen;
    window.eatAtCanteen = Game.eatAtCanteen;

    console.log("所有函式掛載完成！檢查商人函式: ", window.closeMerchant);

} catch (e) {
    console.error("掛載函式時發生錯誤:", e);
}

// 自動讀檔
Game.checkSaveAndStart();