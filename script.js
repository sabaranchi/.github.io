let categories = JSON.parse(localStorage.getItem("categories")) || [];
let scores = JSON.parse(localStorage.getItem("scores")) || {};
let statusPoints = JSON.parse(localStorage.getItem("statusPoints")) || {}; // ステータス用ポイント（別管理）
let weeklyMissions = JSON.parse(localStorage.getItem("weeklyMissions")) || {}; // {カテゴリ: {target: 数値, progress: 数値, lastCheck: タイムスタンプ}}
let missionPoints = JSON.parse(localStorage.getItem("missionPoints")) || {}; // ミッションなどで得られるポイント（スコアとは別）
if (!weeklyMissions) {
  weeklyMissions = {};
}
categories.forEach(cat => {
  if (!weeklyMissions[cat]) {
    weeklyMissions[cat] = { target: "", cleared: null };
  }
});
let pastScores = JSON.parse(localStorage.getItem("pastScores")) || {};
let lastWeek = localStorage.getItem("lastUpdatedWeek");
let playerLevel = parseInt(localStorage.getItem("playerLevel") || "0");
// RPGステータス名リスト
const statusNames = ["ATK", "DEF", "HP", "MP", "SPD"];
// カテゴリとステータスを紐付け{カテゴリ名: ステータス名}
let categoryToStatus = JSON.parse(localStorage.getItem("categoryToStatus")) || {};
let categoryTargets = {};
// 例: { ATK: "体力", DEF: "防御力", HP: "体力", MP: "魔力", SPD: "敏捷" }
let statMapping = JSON.parse(localStorage.getItem("statMapping")) || {}; 

let enemyQueue = [];  // 敵の順番
let currentEnemyIndex = 0;
let enemy = null;
let enemyHP = 0;
let playerHP = 0;

function getCurrentWeek() {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
}

function checkWeekRollover() {
  const currentWeek = getCurrentWeek();
  if (lastWeek && lastWeek !== currentWeek.toString()) {
    pastScores = { ...scores };
    localStorage.setItem("pastScores", JSON.stringify(pastScores));
    alert("週が変わったので、過去スコアを更新しました！");
  }
  localStorage.setItem("lastUpdatedWeek", currentWeek.toString());
}

checkWeekRollover();

function save() {
  localStorage.setItem("categories", JSON.stringify(categories));
  localStorage.setItem("scores", JSON.stringify(scores));
  localStorage.setItem("statusPoints", JSON.stringify(statusPoints));
  localStorage.setItem("weeklyMissions", JSON.stringify(weeklyMissions));
  localStorage.setItem("playerLevel", playerLevel);
  localStorage.setItem("categoryToStatus", JSON.stringify(categoryToStatus)); // ← 追加
}


function addCategory() {
  const input = document.getElementById("categoryInput");
  const name = input.value.trim();
  if (!name) return alert("カテゴリ名を入力してください");
  if (categories.includes(name)) return alert("すでに存在します");

  categories.push(name);
  scores[name] = 0;
  statusPoints[name] = 0; // ステータス初期化
  weeklyMissions[name] = { target: "", cleared: null, lastCheckWeek: getCurrentWeek() }; // ミッション初期化

  input.value = "";
  save();
  render();
}

function deleteCategories() {
  const toDelete = prompt("削除するカテゴリ名を空白区切りで入力(複数可):");
  if (!toDelete) return;
  const targets = toDelete.split(" ").map((s) => s.trim());
  categories = categories.filter((c) => !targets.includes(c));
  for (let t of targets) {
    delete scores[t];
    delete statusPoints[t];
    delete weeklyMissions[t];
  }
  save();
  render();
}

function updateScore(cat, delta) {
  scores[cat] = Math.max(0, (scores[cat] || 0) + delta);
  recalcLevel();
  renderStatus();  // ステータス再描画
  save();
  render();
}

/*prompt用
function renameCategory(oldName) {
  const newName = prompt(`「${oldName}」の新しい名前を入力:`);
  if (!newName) return;
  const trimmed = newName.trim();
  if (!trimmed) return alert("名前が空です");
  if (categories.includes(trimmed)) return alert("すでに存在しています");

  const idx = categories.indexOf(oldName);
  if (idx !== -1) categories[idx] = trimmed;

  scores[trimmed] = scores[oldName];
  delete scores[oldName];

  if (pastScores[oldName] !== undefined) {
    pastScores[trimmed] = pastScores[oldName];
    delete pastScores[oldName];
  }

  newName.onclick = () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = weeklyMissions[cat].target || "";
    input.className = "mission-label";
    input.style.width = "100px";
    input.onblur = () => {
      weeklyMissions[cat] = weeklyMissions[cat] || {};
      weeklyMissions[cat].target = input.value;
      save();
      render(); // 再描画で戻す
    };
    newName.replaceWith(input);
    input.focus();
  };
  save();
  render();
}
*/

function enableEdit(labelElement, oldName) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = oldName;
  input.style.width = "50%";
  input.style.fontSize = "16px";

  const confirmEdit = () => {
    const newName = input.value.trim();
    if (!newName || newName === oldName) return render();
    if (categories.includes(newName)) return alert("すでに存在しています");

    const idx = categories.indexOf(oldName);
    if (idx !== -1) categories[idx] = newName;

    scores[newName] = scores[oldName];
    delete scores[oldName];

    if (pastScores[oldName] !== undefined) {
      pastScores[newName] = pastScores[oldName];
      delete pastScores[oldName];
    }

    if (statusPoints?.[oldName] !== undefined) {
      statusPoints[newName] = statusPoints[oldName];
      delete statusPoints[oldName];
    }

    if (weeklyMissions?.[oldName] !== undefined) {
      weeklyMissions[newName] = weeklyMissions[oldName];
      delete weeklyMissions[oldName];
    }

    save();
    render(); // ← ラベルに戻す
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmEdit();
    if (e.key === "Escape") render(); // キャンセル
  });

  input.addEventListener("blur", confirmEdit); // ← これが重要！

  labelElement.replaceWith(input);
  input.focus();
}

function render() {
  const list = document.getElementById("categoryList");
  list.innerHTML = "";

  for (let cat of categories) {
    const div = document.createElement("div");
    div.className = "score-row";
    div.draggable = true;
    div.dataset.cat = cat;

    // ドラッグイベント
    div.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", cat);
    });
    div.addEventListener("dragover", (e) => e.preventDefault());
    div.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedCat = e.dataTransfer.getData("text/plain");
      const targetCat = e.currentTarget.dataset.cat;
      const fromIndex = categories.indexOf(draggedCat);
      const toIndex = categories.indexOf(targetCat);
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        const moved = categories.splice(fromIndex, 1)[0];
        categories.splice(toIndex, 0, moved);
        save();
        render();
      }
    });

    // --- ここを修正 ---
    const targetPt = (categoryTargets && categoryTargets[cat]) || 10;

    // ラベル
    const label = document.createElement("span");
    label.textContent = `${cat}: ${scores[cat] || 0} / ${targetPt} pt`;
    label.style.width = "30%";
    label.style.cursor = "pointer";
    label.onclick = () => enableEdit(label, cat);

    // スコア操作ボタン
    const minus = document.createElement("button");
    minus.textContent = "－";
    minus.className = "zoom-safe-button";
    minus.onclick = () => updateScore(cat, -1);

    const plus = document.createElement("button");
    plus.textContent = "＋";
    plus.className = "zoom-safe-button";
    plus.onclick = () => updateScore(cat, 1);

    const buttonGroup = document.createElement("div");
    buttonGroup.className = "score-buttons";
    buttonGroup.append(minus, plus);

    // 目標ポイント入力欄
    const targetInput = document.createElement("input");
    targetInput.type = "number";
    targetInput.min = 1;
    targetInput.value = targetPt;
    targetInput.style.width = "60px";
    targetInput.onchange = () => {
      categoryTargets = categoryTargets || {}; // 念のため初期化
      categoryTargets[cat] = Number(targetInput.value);
      save();
      render();
    };

    // ミッション入力欄
    if (!weeklyMissions[cat]) {
      weeklyMissions[cat] = { target: "", cleared: null };
    }
    // ミッション表示ラベル
    const missionLabel = document.createElement("span");
    missionLabel.textContent = `${weeklyMissions[cat].target || "ミッション未設定"}`;
    missionLabel.className = "mission-label";
    missionLabel.onclick = () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = weeklyMissions[cat].target || "";
      input.className = "mission-label";
      input.style.width = "100px";
      input.onblur = () => {
        weeklyMissions[cat] = weeklyMissions[cat] || {};
        weeklyMissions[cat].target = input.value;
        save();
        render(); // 再描画でラベルに戻す
      };
      missionLabel.replaceWith(input);
      input.focus();
    };


    // クリアチェックボックス
    const missionCheck = document.createElement("input");
    missionCheck.type = "checkbox";
    missionCheck.className = "mission-check";
    missionCheck.checked = weeklyMissions[cat]?.cleared || false;
    missionCheck.addEventListener("change", (e) => {
      weeklyMissions[cat] = weeklyMissions[cat] || {};
      weeklyMissions[cat].cleared = e.target.checked;
      save();
    });

    // 要素追加
    div.append(label, buttonGroup,targetInput, missionLabel, missionCheck);
    list.appendChild(div);
  }

  updateChart();
}

const menuBtn = document.getElementById("menuBtn");
const gameMenu = document.getElementById("gameMenu");
const assignCategoryArea = document.getElementById("assignCategoryArea");
const closeMenuBtn = document.getElementById("closeMenuBtn");

menuBtn.onclick = () => {
  menuBtn.style.display = "none"; // メニューボタン非表示
  gameMenu.style.display = "block";
};

closeMenuBtn.onclick = () => {
  gameMenu.style.display = "none";
  assignCategoryArea.style.display = "none"; // 割り当て画面も同時に非表示
  menuBtn.style.display = "inline-block"; // メニュー再表示
};

//カテゴリ割り当て
document.getElementById("assignCategoryBtn").onclick = renderAssignCategories;

async function askMissionClearStatus() {
  for (let cat of categories) {
    const mission = weeklyMissions[cat];
    if (!mission || !mission.target) continue;
    if (mission.cleared !== null) continue; // すでに回答済み

    const answer = prompt(`【${cat}】のミッション\n「${mission.target}」\nクリアしましたか？\n(はい: y / いいえ: n)`);
    if (answer === null || answer.toLowerCase() !== 'y') {
      mission.cleared = false;
    } else {
      mission.cleared = true;
    }
    save();
  }
}

async function goToGame() {
  document.getElementById("recordArea").style.display = "none";
  document.getElementById("gameArea").style.display = "block";
  await askMissionClearStatus();
  renderStatus();
}

function goToRecord() {
  document.getElementById("gameArea").style.display = "none";
  document.getElementById("recordArea").style.display = "block";
}

// カテゴリのポイントをもとにステータスを計算
function calculateStatus() {
  const result = {};
  for (const stat of statusNames) {
    const cat = statusPoints[stat];
    if (!cat || !categories.includes(cat)) {
      statusPoints[stat] = 0; // 未割り当ては0
    } else {
      // 各カテゴリのスコア + ミッションポイントを合計してステータスにする
      const score = scores[cat] || 0;
      const mp = missionPoints[cat] || 0;
      result[stat] = score + mp;
    }
  }
  return result;
}

function checkWeekRollover() {
  const currentWeek = getCurrentWeek();
  if (lastWeek && lastWeek !== currentWeek.toString()) {
    for (let cat of categories) {
      const mission = weeklyMissions[cat];
      if (!mission) continue;

      // ミッション結果でステータスポイントに加算/減算
      if (mission.cleared === true) {
        missionPoints[cat] = (missionPoints[cat] || 0) + 3;
      } else {
        missionPoints[cat] = Math.max(0, (missionPoints[cat] || 0) - 5);
      }
     
      // ミッション状態リセット
      weeklyMissions[cat].cleared = null;
      weeklyMissions[cat].lastCheckWeek = currentWeek;
    }
    alert("週が変わったのでミッション結果を反映しました！");
    save();
    recalcLevel();
  }
  lastWeek = currentWeek.toString();
  localStorage.setItem("lastUpdatedWeek", lastWeek);
}

function renderAssignCategories() {
  assignCategoryArea.style.display = "block"; // ここを必ず表示
  assignCategoryArea.innerHTML = ""; // 前の内容をクリア

  for (let stat of statusNames) {
    const div = document.createElement("div");
    div.className = "assign-row";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.marginBottom = "5px";

    const label = document.createElement("span");
    label.textContent = stat + ": ";
    label.style.width = "50px";

    const select = document.createElement("select");
    select.style.flex = "1";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "未割り当て";
    select.appendChild(defaultOption);

    for (let cat of categories) {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
      // 既に割り当て済みなら選択状態に
      if (categoryToStatus[cat] === stat) {
        option.selected = true;
      }
    }

    select.onchange = () => {
      const selectedCat = select.value;
      // ステータス → カテゴリ
      statusPoints[stat] = selectedCat || null;

      // カテゴリ → ステータス
      // まず、以前そのステータスに割り当てられていたカテゴリがあれば削除
      for (let cat in categoryToStatus) {
        if (categoryToStatus[cat] === stat) delete categoryToStatus[cat];
      }

      if (selectedCat) {
        categoryToStatus[selectedCat] = stat;
      }

      save();
      renderStatus();
      recalcLevel();

      if (gameInitialized) setupEnemies();
    };

/*
    select.onchange = () => {
      statusPoints[stat] = select.value; // ステータス → カテゴリ
      categoryToStatus[select.value] = stat; // カテゴリ → ステータス
      save(); // 必要なら localStorage に保存
      renderStatus(); // ステータス更新
      recalcLevel();// レベルも再計算
      // 割り当てが変わったら、敵のベースポイントも更新
      // ゲーム中の場合は次の敵から反映
      if (gameInitialized) {
        setupEnemies(); // 既存の敵は再生成して初期化
      }
    };
*/
      

    div.append(label, select);
    assignCategoryArea.appendChild(div);
  }
}

//レベル計算
function recalcLevel() {
  if (categories.length === 0) return;

  // 割り当て済みカテゴリだけを使う
  const relevantScores = categories
    .filter(cat => categoryToStatus[cat])
    .map(cat => scores[cat] || 0);

  if (relevantScores.length === 0) return;

  const minScore = Math.min(...relevantScores);

  if (minScore > playerLevel) {
    playerLevel = minScore;
    alert(`レベル${playerLevel}にアップ！`);
  } else if (minScore < playerLevel) {
    playerLevel = minScore;
    alert(`レベルが${playerLevel}に下がりました…`);
  }
  save();
}


function renderStatus() {
  const statusArea = document.getElementById("statusList");
  const status = calculateStatus();
  statusArea.innerHTML = `<div>レベル: ${playerLevel}</div>`;

  for (const stat of statusNames) {
    const div = document.createElement("div");
    div.textContent = `${stat}: ${status[stat]} pt`;
    statusArea.appendChild(div);
  }
}

let gameInitialized = false;

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startGameBtn");
  console.log("startGame pressed");
  if (!startBtn) { console.error("startGameBtn が見つかりません"); return; }
  startBtn.onclick = () => startGame();
});

// 目標ポイントを収集（記録画面の入力値を反映）
function gatherCategoryTargets() {
  categoryTargets = {};
  const rows = document.querySelectorAll("#recordArea .score-row");
  rows.forEach(row => {
    const cat = row.dataset.cat;
    const input = row.querySelector("input[type='number']");
    if (!cat || !input) return;
    const value = Number(input.value) || 10;
    categoryTargets[cat] = value;
  });
}

function startGame() {
  gatherCategoryTargets(); // 目標ポイントを集める

  // ステータス割り当てがあるかチェック
  const assigned = Object.values(categoryToStatus).filter(v => v);
  console.log(categoryToStatus);
  if (assigned.length === 0) {
    alert("ステータスにカテゴリが割り当てられていません！");
    renderAssignCategories();
    return;
  }

  setupEnemies(); // 敵生成

  document.getElementById("gameArea").style.display = "block";
  document.getElementById("recordArea").style.display = "none";
  document.getElementById("battleArea").style.display = "block";

  document.getElementById("startGameBtn").disabled = true;
}


function setupEnemies() {
  /*
  enemyQueue = [];
  const baseStats = {};

  // カテゴリ → ステータス
  for (const cat in categoryToStatus) {
    if (!cat || !categories.includes(cat)) continue;
    const stat = categoryToStatus[cat];
    const targetPt = categoryTargets[cat] || 10;
    baseStats[stat] = targetPt;
  }

  if (Object.keys(baseStats).length === 0) {
    alert("ステータスが未設定です！");
    renderAssignCategories();
    return;
  }

  // スコアチェック：目標ポイントを超えたカテゴリ数
  const clearedCount = Object.keys(categoryToStatus).filter(cat => {
    const score = scores[cat] || 0;
    const target = categoryTargets[cat] || 10;
    return score >= target;
  }).length;

  const totalEnemies = 15; // 例: スライム・中ボス・ボスを含む総数
  for (let i = 1; i <= totalEnemies; i++) {
    let enemyName = `スライム${i}`;
    let isBoss = false;

    // 中ボスや最終ボス判定
    if (i % 5 === 0) {
      if (clearedCount >= 3 && i === totalEnemies) {
        enemyName = "ドラゴンボス";
        isBoss = true;
      } else {
        enemyName = `ゴブリン中ボス${i/5}`;
        isBoss = true;
      }
    }

    // 段階的にステータスを上げる
    const factor = 1 + i * 0.1; // iが大きくなるほど強くなる
    const enemyStats = {};
    for (const stat in baseStats) {
      enemyStats[stat] = Math.floor(baseStats[stat] * factor);
    }

    enemyQueue.push(createEnemy(enemyName, enemyStats, i, isBoss));
  }

  currentEnemyIndex = 0;
  startNextEnemy();
  */
  currentEnemyIndex = 0; // 倒した敵の数を初期化
  startNextEnemy();       // 最初の敵を生成
}


function createEnemy(name, stats, index, isBoss = false) {
  return {
    name: name,
    HP: stats.HP,
    maxHP: stats.HP,
    ATK: stats.ATK,
    DEF: stats.DEF,
    SPD: stats.SPD,  // 追加
    isBoss: isBoss
  };
}


function logBattle(msg) {
  const logDiv = document.getElementById("battleLog");
  logDiv.innerHTML += msg + "<br>";
  logDiv.scrollTop = logDiv.scrollHeight;
}

function startNextEnemy() {
  const i = currentEnemyIndex + 1; // 倒した敵数に応じた段階
  const totalStages = 10;          // ボスに到達するまでの段階数
  const stageFactor = Math.min(i / totalStages, 1); // 0→1で段階的上昇

  // スコアチェック：目標ポイントを超えたカテゴリ数
  const clearedCount = Object.keys(categoryToStatus).filter(cat => {
    const score = scores[cat] || 0;
    const target = categoryTargets[cat] || 10;
    return score >= target;
  }).length;

  // 敵の名前とボス判定
  let enemyName = `スライム${i}`;
  let isBoss = false;
  if (i % 5 === 0) {
    if (clearedCount >= 3 && i > 10) { // 条件に応じて最終ボス出現
      enemyName = "ドラゴンボス";
      isBoss = true;
    } else {
      enemyName = `ゴブリン中ボス${i/5}`;
      isBoss = true;
    }
  }

    // カテゴリからステータス割り当て
  const baseStats = {};
  for (const cat in categoryToStatus) {
    const stat = categoryToStatus[cat];
    const targetPt = categoryTargets[cat] || 10;
    baseStats[stat] = targetPt;
  }

  if (Object.keys(baseStats).length === 0) {
    alert("ステータスが未設定です！");
    renderAssignCategories();
    return;
  }

  // 段階的強化：stageFactorを使って目標値に到達する
  const enemyStats = {};
  for (const stat in baseStats) {
    const minVal = 1;           // 初期モンスターは最低1から
    const maxVal = baseStats[stat]; // ボスステータスが目標
    enemyStats[stat] = Math.floor(minVal + (maxVal - minVal) * stageFactor);
  }

  enemy = createEnemy(enemyName, enemyStats, i, isBoss);
  enemyHP = enemy.HP;
  playerHP = calculateStatus().HP; // プレイヤーHP満タンで開始
  logBattle(`${enemy.name}が現れた！ (HP:${enemy.HP} ATK:${enemy.ATK} DEF:${enemy.DEF} SPD:${enemy.SPD})`);

  document.getElementById("attackBtn").disabled = false;
  currentEnemyIndex++;
}


let gold = 0;

function attack() {
  const status = calculateStatus();

  // 先攻はSPDが高い方
  const playerSPD = status.SPD || 5;
  let playerFirst = playerSPD >= enemy.SPD;

  function playerAttack() {
    let damage = Math.max(1, status.ATK - enemy.DEF);
    enemyHP -= damage;
    logBattle(`あなたの攻撃！${damage}のダメージ！ 残り敵HP: ${enemyHP}`);
  }

  function enemyAttack() {
    let damage = Math.max(1, enemy.ATK - status.DEF);
    playerHP -= damage;
    logBattle(`${enemy.name}の攻撃！${damage}のダメージ！ 残りあなたのHP: ${playerHP}`);
  }

  if (playerFirst) {
    playerAttack();
    if (enemyHP > 0) enemyAttack();
  } else {
    enemyAttack();
    if (playerHP > 0) playerAttack();
  }

  if (enemyHP <= 0) {
    const reward = enemy.isBoss ? 50 : 10;
    gold += reward;
    logBattle(`${enemy.name}を倒した！ゴールド +${reward} (所持: ${gold})`);
    startNextEnemy(); // 次の敵を生成
    return;
  }

  if (playerHP <= 0) {
    logBattle("あなたは倒れてしまった…");
    document.getElementById("attackBtn").disabled = true;
  }
}


// アイテム購入
function buyPotion() {
  if (gold < 10) { alert("ゴールドが足りない！"); return; }
  gold -= 10;
  playerHP = calculateStatus().HP;
  alert("HP回復！");
}


let chart;

function updateChart() {
  const ctx = document.getElementById("radarChart").getContext("2d");
  const labels = categories;
  const values = labels.map((l) => scores[l] || 0);
  const pastValues = labels.map((l) => pastScores[l] || 0);

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "今週",
          data: values,
          backgroundColor: "rgba(0, 128, 255, 0.2)",
          borderColor: "blue",
        },
        {
          label: "先週",
          data: pastValues,
          backgroundColor: "rgba(128, 128, 128, 0.1)",
          borderColor: "gray",
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          suggestedMax: 10,
        },
      },
    },
  });
}

render();


/*
カテゴリを割り当ててゲーム開始ボタンを押してるのにステータスが未設定です！とでる
攻撃を押しても何も起きない
敵のレベル、ステータスが表示されない
ゲームを初期化を押した後に、カテゴリを追加すると反映されない（記録画面に戻ったら、gameareaで最初開いてなかったものは閉じてほしい）
目標ポイントで、ステータスに割り当てたカテゴリを、


*/