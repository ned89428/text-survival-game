import { player, gameState, inventory, stash, recalcDerivedStats } from './state.js';
import { SKILLS } from './data/skills.js';
let trainingMessageTimer = null;

// Helper
function createBar(label, emoji, current, max, colorClass) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max * 100))) : 0;
    return `<div class="stat-bar-wrap"><span class="small-label">${emoji} ${label}：${Math.floor(current)}/${Math.floor(max)}</span><div class="bar"><div class="bar-inner ${colorClass}" style="width:${pct}%;"></div></div></div>`;
}

// Log System
export function addLog(text, colorClass = "") {
    if (!gameState.logs) gameState.logs = [];
    gameState.logs.push({ text, color: colorClass }); // 將日誌加入陣列
    if (gameState.logs.length > 30) gameState.logs.shift(); // 維持日誌數量上限
    renderMainScreen();
}

// ✨ 新增：只更新日誌，不重繪整個畫面的函式
export function addLogWithoutRender(text, colorClass = "") {
    if (!gameState.logs) gameState.logs = [];
    gameState.logs.push({ text, color: colorClass });
    if (gameState.logs.length > 30) gameState.logs.shift();

    // 只重新渲染日誌區塊
    const logDiv = document.querySelector(".mini-log");
    if (logDiv) {
        let style = "";
        if (colorClass === "log-critical") style = "color:#ff7675";
        else if (colorClass === "log-battle") style = "color:#f1c40f";
        else if (colorClass === "log-system") style = "color:#74b9ff";
        logDiv.innerHTML += `<div style="${style}">${text}</div>`;
        logDiv.scrollTop = logDiv.scrollHeight; // 自動滾動到底部
    }
}

export function writeEvent(text) { addLog(text.replace(/<[^>]*>/g, ""), ""); }
export function addBattleLog(text, color) { addLog(text, color); }

// Main Render
export function renderMainScreen() {
    const box = document.getElementById("eventBox");
    if (!box) return; 
    
    // 1. Log
    let logHtml = "";
    if (gameState.logs && gameState.logs.length > 0) {
        gameState.logs.forEach(log => {
            let style = "";
            if (log.color === "log-critical") style = "color:#ff7675";
            else if (log.color === "log-battle") style = "color:#f1c40f";
            else if (log.color === "log-system") style = "color:#74b9ff";
            logHtml += `<div style="${style}">${log.text}</div>`;
        });
    } else { logHtml = `<div style="opacity:0.5">日誌是空的...</div>`; }
    const logSection = `<div class="mini-log">${logHtml}</div>`;

    // 2. Top Section & Buttons
    let topSection = "";
    let actionButtons = ""; 
    const actionsDiv = document.getElementById("actions");
    if (actionsDiv) actionsDiv.style.display = "none"; // 預設隱藏，由下面邏輯決定是否開啟

    if (gameState.mode === "battle") {
        const enemy = gameState.enemy || { name: "???", hp: 0, maxHp: 0, emoji: "❓" };
        // ATB 系統下，按鈕鎖定由 isPlayerTurn 決定
        const globalLock = !gameState.isPlayerTurn ? "disabled" : "";
        // 移除 ATB 進度條的顯示
        topSection = `<div class="battle-box"><div class="battle-enemy-icon" style="font-size: 80px; margin: 5px 0; line-height: 1;">${enemy.emoji}</div><div class="battle-title">${enemy.name} ${enemy.lvl ? `(Lv.${enemy.lvl})` : ""}</div>${enemy.maxHp > 0 ? `<div class="battle-stats">HP：${enemy.hp}/${enemy.maxHp} | 攻：${enemy.atk}</div>` : ""}</div>`;
        
        let skillBtns = `<button onclick="handleCombat('attack')" style="border:1px solid #f1c40f;" ${globalLock}>⚔ 普攻</button>`;
        if (player.equippedSkills) {
            player.equippedSkills.forEach(skillId => {
                const skillData = SKILLS.find(s => s.id === skillId);
                if (skillData) {
                    const disabled = (player.mp < skillData.cost || !gameState.isPlayerTurn) ? "disabled" : "";
                    const costInfo = `${skillData.cost} ${skillData.costType === 'mp' ? 'MP' : '體'}`;
                    skillBtns += `<button onclick="handleCombat('skill', '${skillId}')" ${disabled}>${skillData.name}<br><small style="font-size:10px">(${costInfo})</small></button>`;
                }
            });
        }
        actionButtons = `<div style="margin-top:10px; display:grid; grid-template-columns: 1fr 1fr; gap:5px;">${skillBtns}</div><div style="margin-top:5px;"><button onclick="attemptToRun()" style="width:100%; background:#555;" ${globalLock}>🏃‍♂️ 逃跑</button></div>`;
        
        // 戰鬥中隱藏倉庫
        const stashBox = document.getElementById("stashBox");
        if(stashBox) stashBox.style.display = "none";

    } else if (gameState.mode === "merchant") {
        const merchantName = gameState.merchantName || '商人';
        topSection = `<div style="text-align:center; margin-bottom:10px;"><div style="font-size: 60px;">🤠</div><h3>${merchantName}</h3><p>「看看有什麼需要的？」</p></div>`;
        let goodsHtml = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">`;
        gameState.merchantGoods.forEach((g, i) => {
            goodsHtml += `<button onclick="buyItem(${i})" style="font-size:14px;">${g.emoji} ${g.name}<br><span style="color:#f1c40f">${g.price} G</span></button>`;
        });
        goodsHtml += `</div>`;
        actionButtons = `${goodsHtml}<div style="margin-top:10px; text-align:center;"><button onclick="sellAllMaterials()">出售所有素材</button><button onclick="closeMerchant()">離開商人</button></div>`;
        
        // 商人模式隱藏倉庫
    } else if (gameState.mode === 'loot-swap') {
    } else if (gameState.mode === 'boss-encounter') {
        const bossTemplate = ENEMIES.find(e => e.id === gameState.pendingBossId);
        if (bossTemplate) {
            topSection = `
                <div style="text-align:center; margin-bottom:10px; border: 2px solid #c0392b; padding: 15px; border-radius: 8px;">
                    <div style="font-size: 80px; line-height: 1;">${bossTemplate.emoji}</div>
                    <h3 style="color: #ff7675; margin: 5px 0;">遭遇強敵：${bossTemplate.name}！</h3>
                    <p>一股強大的壓迫感襲來，這不是普通的敵人。要現在挑戰它嗎？</p>
                    <p style="font-size: 12px; color: #aaa;">（戰敗將有 ${bossTemplate.killChance * 100}% 的機率直接死亡）</p>
                </div>`;
            actionButtons = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                    <button onclick="confirmBossBattle()" style="background:#c0392b;">⚔️ 決一死戰</button>
                    <button onclick="avoidBossBattle()" style="background:#2c3e50;">🤫 小心繞過</button>
                </div>`;
        }
        const newItem = gameState.pendingLoot;
        if (newItem) {
            const statsDesc = newItem.type === "equip" ? `<div style="font-size:12px; color:#a29bfe; margin-top:2px;">${getStatsString(newItem.stats)}</div>` : (newItem.desc ? `<div style="font-size:12px; color:#b2bec3; margin-top:2px;">${newItem.desc}</div>` : "");
            topSection = `
                <div style="text-align:center; margin-bottom:10px;">
                    <div style="font-size: 24px; color: #f1c40f;">🎒 背包已滿！</div>
                    <p>你發現了新物品，要替換掉一個舊的嗎？</p>
                    <div class="inv-item" style="background: #222; justify-content: center;">
                       <div style="text-align:left;">
                           <div>${newItem.emoji} ${newItem.name}</div>
                           ${statsDesc}
                       </div>
                    </div>
                </div>`;
            actionButtons = `<div style="margin-top:10px; text-align:center;"><button onclick="discardPendingLoot()" style="background:#c0392b;">丟棄新物品</button></div>`;
        }
        // 背包部分將由 updateInventory() 渲染，它會顯示「替換」按鈕
    } else if (gameState.mode === 'training') {
        // 3. 新增訓練場介面
        topSection = `<div style="text-align:center; margin-bottom:10px;"><div style="font-size: 60px;">💪</div><h3>訓練場</h3><p>「想變強嗎？來這裡就對了。」</p><div id="trainingMessage" class="training-message"></div></div>`;
        let trainingButtons = `<div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px;">`;
        
        // ✨ 核心改造：為每個屬性按鈕動態計算並顯示價格
        // ✨ 核心改造：價格計算基於 player.trainedAttrs (已購買次數)
        const getCost = (attr) => Math.floor(50 + Math.pow((player.trainedAttrs[attr] || 0), 2) * 0.5);

        trainingButtons += `<button onclick="trainAttribute('str')">力量訓練<br><span style="color:#f1c40f">價格: ${getCost('str')} G</span></button>`;
        trainingButtons += `<button onclick="trainAttribute('agi')">敏捷訓練<br><span style="color:#f1c40f">價格: ${getCost('agi')} G</span></button>`;
        trainingButtons += `<button onclick="trainAttribute('tec')">技巧訓練<br><span style="color:#f1c40f">價格: ${getCost('tec')} G</span></button>`;
        trainingButtons += `<button onclick="trainAttribute('con')">體質訓練<br><span style="color:#f1c40f">價格: ${getCost('con')} G</span></button>`;
        trainingButtons += `<button onclick="trainAttribute('int')">智慧訓練<br><span style="color:#f1c40f">價格: ${getCost('int')} G</span></button>`;
        trainingButtons += `</div>`;
        actionButtons = `${trainingButtons}<div style="margin-top:10px; text-align:center;"><button onclick="closeTrainingGround()">離開訓練場</button></div>`;
    } else if (gameState.mode === 'traveling') {
        // ✨ 新增：旅行模式介面
        const zoneName = { nearby: "附近", dungeon: "地下城", expedition: "遠征" }[gameState.travelDestination] || "未知地點";
        const time = gameState.travelTimeRemaining;
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        topSection = `
            <div style="text-align:center; margin-bottom:10px; padding: 20px;">
                <div style="font-size: 60px;">🚶‍♂️...</div>
                <h3 style="font-size: 18px;">正在前往 <span style="color:#f1c40f;">${zoneName}</span></h3>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin-top: 15px;">${timeString}</p>
            </div>`;
        actionButtons = `<div style="text-align:center; opacity:0.7; font-size: 14px;">旅行途中，無法進行其他行動。</div>`;
    } else {
        // === 城鎮 / 探索模式 ===
        const isExploring = gameState.mode === 'explore'; // 判斷是否在探索中
        const icon = isExploring ? '🥾' : '⛺'; // ✨ 探索模式使用靴子圖示
        const title = isExploring ? `探索中... (${gameState.currentZone})` : "城鎮";
        const subTitle = isExploring ? `深度: ${gameState.depth}` : "選擇你的行動";
        topSection = `<div style="text-align:center; margin-bottom:10px; opacity: 0.8;"><div style="font-size: 60px;">${icon}</div><div style="font-size: 18px; font-weight:bold;">${title}</div><div style="font-size: 14px; color: #ccc;">${subTitle}</div></div>`;
        
        if (actionsDiv) {
            actionsDiv.style.display = "block";
            if (isExploring) {
                showExplorationActions();
            } else {
                showTownActions();
            }
        }
    }

    box.innerHTML = `${topSection}${logSection}${actionButtons}`;
    const logDiv = box.querySelector(".mini-log");
    if(logDiv) logDiv.scrollTop = logDiv.scrollHeight;
    
    // 3. 渲染背包與倉庫
    updateInventory(); 
    updateStash();

    // ✨ 核心改造：動態同步左右兩側欄位的高度
    // 使用 requestAnimationFrame 確保在瀏覽器完成繪製後再計算高度
    requestAnimationFrame(() => {
        const eventBox = document.getElementById('eventBox');
        const statusBox = document.getElementById('statusBox');
        const inventoryBox = document.getElementById('inventoryBox');
        if (eventBox && statusBox && inventoryBox) {
            // ✨ 核心修正：在訓練場、戰鬥、旅行模式下，不同步高度，避免佈局跳動
            if (gameState.mode !== 'training' && gameState.mode !== 'battle' && gameState.mode !== 'traveling') {
                inventoryBox.style.height = `${eventBox.offsetHeight}px`;
            }
        }
    });
}

export function triggerShake() {
    const box = document.getElementById("eventBox");
    box.classList.remove("shake");
    void box.offsetWidth; box.classList.add("shake");
}

export function showTrainingMessage(message) {
    const msgDiv = document.getElementById('trainingMessage');
    if (msgDiv) {
        msgDiv.innerText = message;
        msgDiv.style.opacity = 1;

        if (trainingMessageTimer) {
            clearTimeout(trainingMessageTimer);
        }
        trainingMessageTimer = setTimeout(() => {
            msgDiv.style.opacity = 0;
        }, 1500);
    }
}

// Inventory & Stash Helpers
function getStatsString(stats) {
    if (!stats) return "";
    let arr = [];
    if(stats.atk) arr.push(`攻+${stats.atk}`);
    if(stats.def) arr.push(`防+${stats.def}`);
    if(stats.str) arr.push(`力+${stats.str}`);
    if(stats.int) arr.push(`智+${stats.int}`);
    if(stats.agi) arr.push(`敏+${stats.agi}`);
    if(stats.hp) arr.push(`血+${stats.hp}`);
    if(stats.mp) arr.push(`魔+${stats.mp}`);
    if(stats.tec) arr.push(`技+${stats.tec}`); // 顯示 tec
    if(stats.magicAtk) arr.push(`魔攻+${stats.magicAtk}`);
    if(stats.slots) arr.push(`背包+${stats.slots}`); // ✨ 核心：顯示背包欄位加成
    return arr.join(" ");
}

function renderEquipmentPanel() {
    // ✨ 核心改造：調整裝備欄位順序以符合新的排版要求
    const slots = { 
        head: "頭盔 👑", 
        body: "衣服 🧥", 
        shoes: "鞋子 👢", 
        weapon: "武器 ⚔️", 
        backpack: "背包 🎒", 
        accessory: "寶物 💍" };
    let html = `<div class="equip-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #444;">`;
    for (const [key, label] of Object.entries(slots)) {
        const item = player.equipment[key];
        const content = item 
            ? `<div style="color:#f1c40f; font-weight:bold;">${item.emoji} ${item.name}</div><div style="font-size:12px; opacity:0.8; margin: 2px 0;">${getStatsString(item.stats)}</div><button style="font-size:12px; padding:2px 8px; margin-top:4px;" onclick="unequipItem('${key}')">卸下</button>`
            : `<div style="opacity:0.3; padding: 10px 0;">${label}</div>`;
        html += `<div style="background:#2a2a2a; padding:8px; border-radius:6px; border:1px solid #444; text-align:center; min-height: 80px; display:flex; flex-direction:column; justify-content:center;">${content}</div>`;
    }
    html += `</div>`;
    return html;
}

export function updateStatus(refill = false) {
    recalcDerivedStats(refill); 
    // TopBar
    const topBar = document.getElementById("topBar");
    if (topBar) {
        topBar.innerHTML = `
            <div class="top-item"><span class="top-label">姓名：</span> ${player.name}</div>
            <div class="top-item"><span class="top-label">職業：</span> ${player.job} <small>(Lv.${player.level})</small></div>
            <div class="top-item"><span class="top-label">📅 天數：</span> Day ${player.day}</div>
            <div class="top-item"><span class="top-label">🚩 狀態：</span> ${player.state}</div>
        `;
    }
    // StatusBox
    const statusBox = document.getElementById("statusBox");
    if (statusBox) {
        statusBox.innerHTML = `
            <div style="margin-bottom:15px; font-size:14px; color:#aaa;">狀態數值</div>
            ${createBar("HP", "❤️", player.hp, player.maxHP, "red-bar")}
            ${createBar("MP", "💧", player.mp, player.maxMP, "blue-bar")}
            ${createBar("飢餓", "🍗", player.hunger, player.hungerMax, "yellow-bar")}
            ${ (gameState.mode === 'explore' && gameState.pendingExp > 0) 
                ? `<div class="small-label" style="color:#2ecc71; margin-top:8px;">🧭 暫存經驗：${gameState.pendingExp}</div>` 
                : ''
            }
            <div style="border-top:1px solid #444; margin: 10px 0;"></div>
                <div class="small-label">物理攻擊：${Math.floor(player.atk)}</div>
                <div class="small-label">魔法攻擊：${Math.floor(player.magicAtk)}</div>
                <div class="small-label">物理防禦：${Math.floor(player.def)}</div>
                <div class="small-label">命中值：${player.hitRate.toFixed(1)}</div>
                <div class="small-label">閃避值：${player.dodge.toFixed(1)}</div>
                <div class="small-label">速度：${player.speed.toFixed(1)}</div>
                <div class="small-label">暴擊率：${player.critChance.toFixed(1)}%</div>
                <div class="small-label">暴擊傷害：${player.critDamage.toFixed(1)}%</div>
            </div>
            <div style="margin-top:15px; border-top:1px solid #444; padding-top:10px;">
                <div class="attr-line">STR 力量：${player.str}</div>
                <div class="attr-line">AGI 敏捷：${player.agi}</div>
                <div class="attr-line">TEC 技巧：${player.tec}</div>
                <div class="attr-line">CON 體質：${player.con}</div>
                <div class="attr-line">INT 智慧：${player.int}</div>
            </div>
        `;
    }
}

export function updateInventory() {
    const box = document.getElementById("inventoryBox");
    const equipHtml = renderEquipmentPanel();
    box.innerHTML = `
        <div class="inv-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>🎒 背包（${inventory.length}/${player.inventoryMaxSlots}）</span>
            <span style="font-size: 16px; color: #f1c40f; font-weight: bold; margin-right: 10px;">💰 ${player.gold} G</span>
        </div>
        ${equipHtml}
        <div class="inv-items" id="inv-items" style="display:block;"></div>
    `;
    const itemsDiv = document.getElementById("inv-items");
    if (inventory.length === 0) {
        itemsDiv.innerHTML = `<div style="opacity:0.7; padding:10px;">（背包是空的）</div>`;
    } else {
        inventory.forEach((item, i) => {
            let actionButtonsHtml = '';

            // ✨ 核心改造：根據遊戲模式決定按鈕
            if (gameState.mode === 'loot-swap') {
                actionButtonsHtml = `<button onclick="swapWithLoot(${i})" style="background:#27ae60">替換</button>`;
            } else {
                let useBtn = item.type === "equip" ? `<button onclick="equipItem(${i})">裝備</button>` : (item.usable ? `<button onclick="useItem(${i})">使用</button>` : "");
                
                const sellValue = item.sellPrice || Math.floor((item.price || 0) / 2);
                let sellBtn = (gameState.merchantActive && sellValue > 0) ? `<button onclick="sellOneItem(${i})">賣出 1個 (${sellValue}G)</button>` : "";

                let storeBtn = (gameState.mode === 'town' || gameState.isTownMerchant) && !gameState.inBattle 
                    ? `<button onclick="moveToStash(${i})" style="color:#f39c12; border-color:#f39c12;">存入</button>` 
                    : "";
                
                let dropBtn = `<button onclick="dropItem(${i})">丟棄 1個</button>`;
                actionButtonsHtml = `${useBtn}${sellBtn}${storeBtn}${dropBtn}`;
            }

            let statsDesc = "";
            // ✨ 核心改造：將描述文字改為 span，並加上一些間距
            if (item.type === "equip") statsDesc = `<span style="font-size:12px; color:#a29bfe; margin-left: 8px;">${getStatsString(item.stats)}</span>`;
            else if (item.desc) statsDesc = `<span style="font-size:12px; color:#b2bec3; margin-left: 8px;">${item.desc}</span>`;

            let countDisplay = (item.count && item.count > 1) ? `<span style="font-weight:bold; color:#fff; margin-left:5px;">x${item.count}</span>` : "";

            // ✨ 核心改造：強制讓物品資訊和按鈕分為上下兩行
            itemsDiv.innerHTML += `
                <div class="inv-item" style="flex-direction: column; align-items: flex-start;">
                    <div class="inv-item-info" style="margin-bottom: 8px;">
                        <span>${item.emoji} ${item.name} ${countDisplay}</span>${statsDesc}
                    </div>
                    <div class="inv-item-actions">${actionButtonsHtml}</div>
                </div>
            `;
        });
    }
}

export function updateStash() {
    const box = document.getElementById("stashBox");
    if (!box) return;
    
    // ✨ 修正：只有在戰鬥中、探索中、或遇到流浪商人才隱藏倉庫
    if (gameState.inBattle || gameState.mode === 'explore' || (gameState.merchantActive && !gameState.isTownMerchant)) {
        box.style.display = 'none'; 
        return; 
    }
    box.style.display = 'block';

    // ✨ 更新：顯示倉庫金錢與存取按鈕
    box.innerHTML = `
        <div class="inv-title" style="margin-bottom:10px; color:#3498db;">📦 倉庫（${stash.items.length}）</div>
        <div class="stash-gold-section">
            <span style="font-size: 16px; color: #f1c40f; font-weight: bold;">💰 ${stash.gold} G</span>
            <div>
                <button onclick="depositGold()">存入</button>
                <button onclick="withdrawGold()">取出</button>
            </div>
        </div>
        <div class="inv-items" style="display:block;"></div>`;
    const itemsDiv = box.querySelector(".inv-items");
    
    if (stash.items.length === 0) { itemsDiv.innerHTML = `<div style="opacity:0.7; padding:10px;">（物品是空的）</div>`; }

    stash.items.forEach((item, i) => {
        let statsDesc = item.type === "equip" ? `<div style="font-size:12px; color:#a29bfe; margin-top:2px;">${getStatsString(item.stats)}</div>` : "";
        let countDisplay = (item.count && item.count > 1) ? `<span style="font-weight:bold; color:#fff; margin-left:5px;">x${item.count}</span>` : "";
        itemsDiv.innerHTML += `
            <div class="inv-item" style="background:#2c3e50; border-color:#34495e;">
                <div style="flex:1"><div>${item.emoji} ${item.name} ${countDisplay}</div>${statsDesc}</div>
                <div style="display:flex; align-items:center;"><button onclick="takeFromStash(${i})" style="color:#3498db; border-color:#3498db;">取出 1個</button></div>
            </div>
        `;
    });
}

export function showTownActions() {
    const act = document.getElementById("actions");
    if (act) {
        // ✨ 核心改造 1：修復損壞的解鎖條件判斷
        const isDungeonUnlocked = player.defeatedBosses.includes('boss_giant_bear');
        const isExpeditionUnlocked = player.defeatedBosses.includes('boss_goblin_king');

        const dungeonButton = isDungeonUnlocked
            ? `<button onclick="startExpedition('dungeon')">🕳️ 探索地下城 (挑戰)</button>`
            : `<button disabled title="擊敗附近區域的頭目以解鎖">🕳️ 探索地下城 (未解鎖)</button>`;

        const expeditionButton = isExpeditionUnlocked
            ? `<button onclick="startExpedition('expedition')">🗺️ 踏上遠征 (危險)</button>`
            : `<button disabled title="擊敗地下城頭目以解鎖">🗺️ 踏上遠征 (未解鎖)</button>`;

        // ✨ 核心改造 2：修復損壞的 HTML 結構
        act.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-bottom: 10px;">
                <button onclick="startExpedition('nearby')">🌲 前往附近 (蒐集)</button>
                ${dungeonButton}
                ${expeditionButton}
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                <button onclick="openTownMerchant()" style="background:#2980b9;">🏪 拜訪商店</button>
                <button onclick="openTrainingGround()" style="background:#8e44ad;">💪 前往訓練場</button>
            </div>`;
        act.style.display = "block";
    }
}

export function showExplorationActions() {
    const act = document.getElementById("actions");
    if (act) {
        // ✨ 更新：探索模式的按鈕
        if (gameState.currentZone === 'dungeon' || gameState.currentZone === 'expedition') {
            // ✨ Roguelike 選擇模式
            let retreatButton = gameState.canSafelyRetreat
                ? `<button onclick="retreatToTown()" style="background:#27ae60; width:100%;">✅ 安全撤離</button>`
                : `<button onclick="forceRetreat()" style="background:#c0392b; width:100%;">🏃‍♂️ 強制撤離 (危險)</button>`;

            act.innerHTML = `
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                    <button onclick="advanceExploration('cautious')">🧐 小心探索</button>
                    <button onclick="advanceExploration('deep')">🔥 深入探索</button>
                    <button onclick="advanceExploration('search_exit')">🧭 尋找出口</button>
                </div>
                ${retreatButton}`;
        } else {
            // 原始模式 (for 'nearby')
            const retreatButton = `<button onclick="retreatToTown()" style="background:#27ae60;">✅ 安全撤離</button>`;
            act.innerHTML = `<button onclick="advanceExploration('default')">🚶‍♂️ 繼續前進</button>${retreatButton}`;
        }
        act.style.display = "block";
    }
}

export function updateCooldownButtons(t) {
    const act = document.getElementById("actions");
    if(act && act.style.display !== "none") {
       act.innerHTML = `
        <button disabled>附近搜索 (${t}s)</button>
        <button disabled>地下城 (${t}s)</button>
        <button disabled>遠征 (${t}s)</button>
        <button disabled>休息 (${t}s)</button>
       `;
    }
}