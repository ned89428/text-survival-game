import { player, gameState, inventory, recalcDerivedStats } from './state.js';
import { SKILLS } from './data/skills.js';

// Helper
function createBar(label, emoji, current, max, colorClass) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max * 100))) : 0;
    return `<div class="stat-bar-wrap"><span class="small-label">${emoji} ${label}：${Math.floor(current)}/${Math.floor(max)}</span><div class="bar"><div class="bar-inner ${colorClass}" style="width:${pct}%;"></div></div></div>`;
}

// Log System
export function addLog(text, colorClass = "") {
    if (!gameState.logs) gameState.logs = [];
    gameState.logs.push({ text, color: colorClass });
    if (gameState.logs.length > 30) gameState.logs.shift();
    renderMainScreen();
}
export function writeEvent(text) { addLog(text.replace(/<[^>]*>/g, ""), ""); }
export function addBattleLog(text, color) { addLog(text, color); }

// Main Render
export function renderMainScreen() {
    const box = document.getElementById("eventBox");
    if (!box) return; 
    
    // Log
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

    // Top & Actions
    let topSection = "";
    let actionButtons = ""; 

    if (gameState.mode === "battle") {
        const enemy = gameState.enemy || { name: "???", hp: 0, maxHp: 0, emoji: "❓" };
        topSection = `<div class="battle-box"><div class="battle-enemy-icon" style="font-size: 80px; margin: 5px 0; line-height: 1;">${enemy.emoji}</div><div class="battle-title">${enemy.name} ${enemy.lvl ? `(Lv.${enemy.lvl})` : ""}</div>${enemy.maxHp > 0 ? `<div class="battle-stats">HP：${enemy.hp}/${enemy.maxHp} | 攻：${enemy.atk}</div>` : ""}</div>`;
        
        let skillBtns = `<button onclick="handleCombat('attack')" style="border:1px solid #f1c40f;">⚔ 普攻</button>`;
        if (player.equippedSkills) {
            player.equippedSkills.forEach(skillId => {
                const skillData = SKILLS.find(s => s.id === skillId);
                if (skillData) {
                    const disabled = player.mp < skillData.cost ? "disabled" : "";
                    const costInfo = `${skillData.cost} ${skillData.costType === 'mp' ? 'MP' : '體'}`;
                    skillBtns += `<button onclick="handleCombat('skill', '${skillId}')" ${disabled}>${skillData.name}<br><small style="font-size:10px">(${costInfo})</small></button>`;
                }
            });
        }
        actionButtons = `<div style="margin-top:10px; display:grid; grid-template-columns: 1fr 1fr; gap:5px;">${skillBtns}</div><div style="margin-top:5px;"><button onclick="handleCombat('run')" style="width:100%; background:#555;">🏃‍♂️ 逃跑</button></div>`;
        
        const act = document.getElementById("actions");
        if(act) act.style.display = "none";

    } else if (gameState.mode === "merchant") {
        topSection = `<div style="text-align:center; margin-bottom:10px;"><div style="font-size: 60px;">🤠</div><h3>流浪商人</h3><p>「看看有什麼需要的？」</p></div>`;
        let goodsHtml = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">`;
        gameState.merchantGoods.forEach((g, i) => {
            goodsHtml += `<button onclick="buyItem(${i})" style="font-size:14px;">${g.emoji} ${g.name}<br><span style="color:#f1c40f">${g.price} G</span></button>`;
        });
        goodsHtml += `</div>`;
        actionButtons = `${goodsHtml}<div style="margin-top:10px; text-align:center;"><button onclick="sellAllMaterials()">出售所有素材</button><button onclick="closeMerchant()">離開商人</button></div>`;
        const act = document.getElementById("actions");
        if(act) act.style.display = "none";

    } else {
        // Normal Mode
        const icon = gameState.enemy ? gameState.enemy.emoji : "⛺"; 
        const title = gameState.enemy ? gameState.enemy.name : "探索中...";
        topSection = `<div style="text-align:center; margin-bottom:10px; opacity: 0.8;"><div style="font-size: 60px;">${icon}</div><div style="font-size: 18px; font-weight:bold;">${title}</div></div>`;
        
        const actionsDiv = document.getElementById("actions");
        if (actionsDiv) {
            actionsDiv.style.display = "block";
            // 這裡強制確保按鈕存在，避免因為切換模式而消失
            if (actionsDiv.innerHTML.trim() === "") {
                actionsDiv.innerHTML = `
                    <button onclick="exploreNearby()">附近搜索（10s）</button>
                    <button onclick="exploreDungeon()">地下城（20s）</button>
                    <button onclick="exploreExpedition()">遠征（45s）</button>
                    <button onclick="rest()">休息（10s）</button>
                `;
            }
        }
    }

    box.innerHTML = `${topSection}${logSection}${actionButtons}`;
    const logDiv = box.querySelector(".mini-log");
    if(logDiv) logDiv.scrollTop = logDiv.scrollHeight;
}

export function triggerShake() {
    const box = document.getElementById("eventBox");
    box.classList.remove("shake");
    void box.offsetWidth; box.classList.add("shake");
}

// Inventory & Status
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

function renderEquipmentPanel() {
    const slots = { head: "頭盔 🪖", body: "衣服 🧥", weapon: "武器 ⚔️", accessory: "寶物 💍" };
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
        <div class="small-label">速度：${player.speed.toFixed(1)}</div>
        <hr>
        <div class="small-label">屬性（剩餘點數：${player.attrPoints}）</div>
        <div class="attr-line">STR 力量：${player.str} ${player.attrPoints > 0 ? `<button onclick="addAttr('str')">+</button>` : ""}</div>
        <div class="attr-line">AGI 敏捷：${player.agi} ${player.attrPoints > 0 ? `<button onclick="addAttr('agi')">+</button>` : ""}</div>
        <div class="attr-line">CON 體質：${player.con} ${player.attrPoints > 0 ? `<button onclick="addAttr('con')">+</button>` : ""}</div>
        <div class="attr-line">INT 智慧：${player.int} ${player.attrPoints > 0 ? `<button onclick="addAttr('int')">+</button>` : ""}</div>
    `;
}

export function updateInventory() {
    const box = document.getElementById("inventoryBox");
    const equipHtml = renderEquipmentPanel();
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
        let actionBtn = item.type === "equip" ? `<button onclick="equipItem(${i})">裝備</button>` : (item.usable ? `<button onclick="useItem(${i})">使用</button>` : "");
        let sellBtn = (gameState.merchantActive && item.sellPrice) ? `<button onclick="sellOneItem(${i})">賣出 (${item.sellPrice}G)</button>` : "";
        let statsDesc = "";
        if (item.type === "equip") statsDesc = `<div style="font-size:12px; color:#a29bfe; margin-top:2px;">${getStatsString(item.stats)}</div>`;
        else if (item.type === "heal") statsDesc = `<div style="font-size:12px; color:#00b894; margin-top:2px;">恢復 HP ${item.value}</div>`;
        else if (item.type === "mana") statsDesc = `<div style="font-size:12px; color:#0984e3; margin-top:2px;">恢復 MP ${item.value}</div>`;
        else if (item.type === "food") statsDesc = `<div style="font-size:12px; color:#e17055; margin-top:2px;">恢復飢餓 ${item.value}</div>`;
        else if (item.type === "material") statsDesc = `<div style="font-size:12px; color:#b2bec3; margin-top:2px;">用於交易或製作</div>`;

        itemsDiv.innerHTML += `
            <div class="inv-item">
                <div style="flex:1"><div>${item.emoji} ${item.name}</div>${statsDesc}</div>
                <div style="display:flex; align-items:center;">${actionBtn}${sellBtn}<button onclick="dropItem(${i})">丟棄</button></div>
            </div>
        `;
    });
}

// 簡化版：只負責顯示容器，內容由 renderMainScreen 負責
export function showMainActions() {
    const act = document.getElementById("actions");
    if (act) {
        act.style.display = "block";
        // 這裡不用再塞 HTML 了，renderMainScreen 會做
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