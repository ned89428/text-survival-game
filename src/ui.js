import { player, gameState, inventory, recalcDerivedStats } from './state.js';

// 狀態條 Helper
function createBar(label, emoji, current, max, colorClass) {
    const pct = max > 0 ? (current / max * 100) : 0;
    return `
        <div class="stat-bar-wrap">
            <span class="small-label">${emoji} ${label}：${Math.floor(current)}/${Math.floor(max)}</span>
            <div class="bar">
                <div class="bar-inner ${colorClass}" style="width:${pct}%;"></div>
            </div>
        </div>
    `;
}

// ==========================================
// 裝備欄顯示邏輯
// ==========================================
function renderEquipmentPanel() {
    const slots = {
        head: "頭盔 🪖",
        body: "衣服 🧥",
        weapon: "武器 ⚔️",
        accessory: "寶物 💍"
    };

    let html = `<div class="equip-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #444;">`;
    
    for (const [key, label] of Object.entries(slots)) {
        const item = player.equipment[key];
        
        const content = item 
            ? `<div style="color:#f1c40f; font-weight:bold;">${item.emoji} ${item.name}</div>
               <div style="font-size:12px; opacity:0.8; margin: 2px 0;">${getStatsString(item.stats)}</div>
               <button style="font-size:12px; padding:2px 8px; margin-top:4px;" onclick="unequipItem('${key}')">卸下</button>`
            : `<div style="opacity:0.3; padding: 10px 0;">${label}</div>`;
            
        html += `<div style="background:#2a2a2a; padding:8px; border-radius:6px; border:1px solid #444; text-align:center; min-height: 80px; display:flex; flex-direction:column; justify-content:center;">${content}</div>`;
    }
    html += `</div>`;
    return html;
}

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
    if(stats.magicAtk) arr.push(`魔攻+${stats.magicAtk}`);
    return arr.join(" ");
}

// ==========================================
// 主畫面更新 (已移除金錢)
// ==========================================
export function updateStatus() {
    recalcDerivedStats(); 
    document.getElementById("statusBox").innerHTML = `
        <div><b>姓名：</b>${player.name}</div>
        <div><b>職業：</b>${player.job}</div>
        <div>等級：Lv ${player.level}</div>
        <div>天數：Day ${player.day}</div>
        <div>狀態：${player.state}</div>
        <hr>
        ${createBar("HP", "❤️", player.hp, player.maxHP, "red-bar")}
        ${createBar("MP", "💧", player.mp, player.maxMP, "blue-bar")}
        ${createBar("飢餓", "🍗", player.hunger, player.hungerMax, "yellow-bar")}
        ${createBar("體力", "⚡", player.energy, player.energyMax, "green-bar")}
        
        <div class="small-label">物理攻擊：${Math.floor(player.atk)}</div>
        <div class="small-label">魔法攻擊：${Math.floor(player.magicAtk)}</div>
        <div class="small-label">物理防禦：${Math.floor(player.def)}</div>
        <div class="small-label">命中率：${player.hitRate.toFixed(1)}%</div>
        <div class="small-label">閃避率：${player.dodge.toFixed(1)}%</div>
        <hr>
        <div class="small-label">屬性（剩餘點數：${player.attrPoints}）</div>
        <div class="attr-line">STR 力量：${player.str} ${player.attrPoints > 0 ? `<button onclick="addAttr('str')">+</button>` : ""}</div>
        <div class="attr-line">AGI 敏捷：${player.agi} ${player.attrPoints > 0 ? `<button onclick="addAttr('agi')">+</button>` : ""}</div>
        <div class="attr-line">CON 體質：${player.con} ${player.attrPoints > 0 ? `<button onclick="addAttr('con')">+</button>` : ""}</div>
        <div class="attr-line">INT 智慧：${player.int} ${player.attrPoints > 0 ? `<button onclick="addAttr('int')">+</button>` : ""}</div>
    `;
}

// ==========================================
// Log 系統
// ==========================================

export function addLog(text, type) {
    const area = document.getElementById("logContent");
    const div = document.createElement("div");
    div.className = "log-line" + (type ? " " + type : "");
    div.textContent = text;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
}

export function addBattleLog(text, colorClass = "") {
    if (!gameState.battleLog) gameState.battleLog = [];

    gameState.battleLog.push({ text, color: colorClass });
    
    if (gameState.battleLog.length > 6) {
        gameState.battleLog.shift();
    }
    
    addLog(text, colorClass); 

    if (gameState.inBattle || gameState.enemy) {
        renderBattleView();
    }
}

export function writeEvent(text) {
    if (!gameState.inBattle) {
        document.getElementById("eventBox").innerHTML = text;
        addLog(text.replace(/<[^>]*>/g, ""), ""); 
    } else {
        addLog(text.replace(/<[^>]*>/g, ""), ""); 
    }
}

// ==========================================
// 戰鬥畫面渲染
// ==========================================
export function renderBattleView() {
    if (!gameState.enemy && (!gameState.battleLog || gameState.battleLog.length === 0)) return;

    const box = document.getElementById("eventBox");
    const enemy = gameState.enemy || { name: "狀態", hp: 0, maxHp: 0, atk: 0, emoji: "⚠️" }; 

    let logHtml = "";
    if (gameState.battleLog && gameState.battleLog.length > 0) {
        gameState.battleLog.forEach(log => {
            let style = "";
            if (log.color === "log-critical") style = "color:#ff7675";
            else if (log.color === "log-battle") style = "color:#f1c40f";
            else if (log.color === "log-system") style = "color:#74b9ff";
            
            logHtml += `<div style="${style}">${log.text}</div>`;
        });
    } else {
        logHtml = `<div style="opacity:0.5">等待行動...</div>`;
    }

    let buttonsHtml = "";
    if (gameState.inBattle) {
        buttonsHtml = `
            <div style="margin-top:12px;">
                <button onclick="attack()">戰鬥 (普攻)</button>
                <button onclick="runAway()">逃跑</button>
            </div>
        `;
    }

    box.innerHTML = `
        <div class="battle-box">
            <div class="battle-enemy-icon" style="font-size: 80px; margin: 5px 0; line-height: 1;">
                ${enemy.emoji}
            </div>
            
            <div class="battle-title">${enemy.name} ${enemy.lvl ? `(Lv.${enemy.lvl})` : ""}</div>
            ${enemy.maxHp > 0 ? `<div class="battle-stats">HP：${enemy.hp}/${enemy.maxHp} | 攻：${enemy.atk}</div>` : ""}
            
            <div class="mini-log">
                ${logHtml}
            </div>
            
            ${buttonsHtml}
        </div>
    `;
    
    const logDiv = box.querySelector(".mini-log");
    if(logDiv) logDiv.scrollTop = logDiv.scrollHeight;
}

export function triggerShake() {
    const box = document.getElementById("eventBox");
    box.classList.remove("shake");
    void box.offsetWidth; 
    box.classList.add("shake");
}

// ==========================================
// 按鈕與背包
// ==========================================

export function showMainActions() {
    if (!player.alive || gameState.inBattle || !gameState.canAct || gameState.merchantActive) return;
    document.getElementById("actions").innerHTML = `
        <button onclick="exploreNearby()">附近搜索（10s）</button>
        <button onclick="exploreDungeon()">地下城（20s）</button>
        <button onclick="exploreExpedition()">遠征（45s）</button>
        <button onclick="rest()">休息（10s）</button>
    `;
    document.getElementById("actions").style.display = "block";
}

export function updateCooldownButtons(t) {
    if(document.getElementById("actions").style.display !== "none") {
       document.getElementById("actions").innerHTML = `
        <button disabled>附近搜索 (${t}s)</button>
        <button disabled>地下城 (${t}s)</button>
        <button disabled>遠征 (${t}s)</button>
        <button disabled>休息 (${t}s)</button>
       `;
    }
}

// 背包介面 (更新：加入金錢顯示)
export function updateInventory() {
    const box = document.getElementById("inventoryBox");
    const equipHtml = renderEquipmentPanel();

    // === 修改這裡：標題區加入金錢顯示 (Flexbox 排版) ===
    box.innerHTML = `
        <div class="inv-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>🎒 背包（${inventory.length}）</span>
            <span style="font-size: 16px; color: #f1c40f; font-weight: bold; margin-right: 10px;">💰 ${player.gold} G</span>
        </div>
        ${equipHtml}
        <div class="inv-items" id="inv-items" style="display:block;"></div>
    `;
    
    const itemsDiv = document.getElementById("inv-items");
    if (inventory.length === 0) {
        itemsDiv.innerHTML = `<div style="opacity:0.7; padding:10px;">（背包是空的）</div>`;
        return;
    }
    
    inventory.forEach((item, i) => {
        let actionBtn = "";
        if (item.type === "equip") {
            actionBtn = `<button onclick="equipItem(${i})">裝備</button>`;
        } else if (item.usable) {
            actionBtn = `<button onclick="useItem(${i})">使用</button>`;
        }

        let sellBtn = "";
        if (gameState.merchantActive && item.sellPrice) {
            sellBtn = `<button onclick="sellOneItem(${i})">賣出 (${item.sellPrice}G)</button>`;
        }

        let statsDesc = "";
        if (item.type === "equip") {
            statsDesc = `<div style="font-size:12px; color:#a29bfe; margin-top:2px;">${getStatsString(item.stats)}</div>`;
        } else if (item.type === "heal") {
            statsDesc = `<div style="font-size:12px; color:#00b894; margin-top:2px;">恢復 HP ${item.value}</div>`;
        } else if (item.type === "mana") {
            statsDesc = `<div style="font-size:12px; color:#0984e3; margin-top:2px;">恢復 MP ${item.value}</div>`;
        } else if (item.type === "food") {
            statsDesc = `<div style="font-size:12px; color:#e17055; margin-top:2px;">恢復飢餓 ${item.value}</div>`;
        } else if (item.type === "material") {
            statsDesc = `<div style="font-size:12px; color:#b2bec3; margin-top:2px;">用於交易或製作</div>`;
        }

        itemsDiv.innerHTML += `
            <div class="inv-item">
                <div style="flex:1">
                    <div>${item.emoji} ${item.name}</div>
                    ${statsDesc}
                </div>
                <div style="display:flex; align-items:center;">
                    ${actionBtn}
                    ${sellBtn}
                    <button onclick="dropItem(${i})">丟棄</button>
                </div>
            </div>
        `;
    });
}