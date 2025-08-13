let categories = JSON.parse(localStorage.getItem("categories")) || [];
let scores = JSON.parse(localStorage.getItem("scores")) || {};
let statusPoints = JSON.parse(localStorage.getItem("statusPoints")) || {}; // ステータス用ポイント（別管理）
let weeklyMissions = JSON.parse(localStorage.getItem("weeklyMissions")) || {}; // {カテゴリ: {target: 数値, progress: 数値, lastCheck: タイムスタンプ}}
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

function sortCategories() {
  categories.sort();
  save();
  render();
}

function updateScore(cat, delta) {
  scores[cat] = Math.max(0, (scores[cat] || 0) + delta);
  recalcLevel();
  save();
  render();
}

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

  save();
  render();
}

function enableEdit(labelElement, oldName) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = oldName;
  input.style.width = "50%";
  input.style.fontSize = "16px";

  // Enterキーで確定
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const newName = input.value.trim();
      if (!newName) return alert("名前が空です");
      if (categories.includes(newName)) return alert("すでに存在しています");

      const idx = categories.indexOf(oldName);
      if (idx !== -1) categories[idx] = newName;

      scores[newName] = scores[oldName];
      delete scores[oldName];

      if (pastScores[oldName] !== undefined) {
        pastScores[newName] = pastScores[oldName];
        delete pastScores[oldName];
      }

      save();
      render();
    }
  });

  // ラベルを input に置き換え
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

    // ラベル
    const label = document.createElement("span");
    label.textContent = `${cat}: ${scores[cat] || 0} pt`;
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

    // ミッション入力欄
    if (!weeklyMissions[cat]) {
      weeklyMissions[cat] = { target: "", cleared: null };
    }
    // ミッション表示ラベル
    const missionLabel = document.createElement("span");
    missionLabel.textContent = `🎯 ${weeklyMissions[cat].target || "ミッション未設定"}`;
    missionLabel.style.marginLeft = "10px";
    missionLabel.style.cursor = "pointer";
    missionLabel.style.width = "150px";
    missionLabel.title = "クリックして編集";

    missionLabel.onclick = () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = weeklyMissions[cat].target || "";
      input.style.width = "150px";
      input.onblur = () => {
        weeklyMissions[cat].target = input.value.trim();
        save();
        render(); // 再描画でラベルに戻す
      };
      input.onkeydown = (e) => {
        if (e.key === "Enter") input.blur();
      };
      missionLabel.replaceWith(input);
      input.focus();
    };


    // クリアチェックボックス
    const missionCheck = document.createElement("input");
    missionCheck.type = "checkbox";
    missionCheck.checked = weeklyMissions[cat].cleared === true;
    missionCheck.style.marginLeft = "5px";
    missionCheck.addEventListener("change", (e) => {
      weeklyMissions[cat].cleared = e.target.checked;
      save();
    });

    // 要素追加
    div.append(label, buttonGroup, missionInput, missionCheck);
    list.appendChild(div);
  }

  updateChart();
}


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
  // 例として、カテゴリポイントをそのままステータスに割り当てる
  // カテゴリ名ごとにステータス名を変えたり、合算や係数かけるのも可能
  //const statusPoints = {};
  //for (let cat of categories) {
    // 例えばカテゴリ名が「体力」ならポイントを体力ステータスに
    //statusPoints[cat] = scores[cat] || 0;
  //}
  return statusPoints;
}

function checkLevelUp() {
  const minScore = Math.min(...categories.map(cat => scores[cat] || 0));
  if (minScore > level) {
    // レベルアップ
    level = minScore;
    alert(`レベルが${level}になった！`);
    saveGameStats();
  }
}

function checkWeekRollover() {
  const currentWeek = getCurrentWeek();
  if (lastWeek && lastWeek !== currentWeek.toString()) {
    for (let cat of categories) {
      const mission = weeklyMissions[cat];
      if (!mission) continue;
      // クリア情報がtrueなら＋3、それ以外は -5
      if (mission.cleared === true) {
        statusPoints[cat] = (statusPoints[cat] || 0) + 3;
      } else {
        statusPoints[cat] = Math.max(0, (statusPoints[cat] || 0) - 5);
      }
      // ミッション状態リセット
      weeklyMissions[cat].cleared = null;
      weeklyMissions[cat].lastCheckWeek = currentWeek;
    }
    alert("週が変わったのでミッション結果を反映しました！");
    save();
    checkLevelUp();
  }
  lastWeek = currentWeek.toString();
  localStorage.setItem("lastUpdatedWeek", lastWeek);
}


function recalcLevel() {
  if (categories.length === 0) return;

  const minScore = Math.min(...categories.map(c => scores[c] || 0));
  if (minScore > playerLevel) {
    // レベルアップ
    playerLevel = minScore;
    alert(`レベル${playerLevel}にアップ！`);
  } 
  save();
}

function renderStatus() {
  const statusArea = document.getElementById("statusList");
  statusArea.innerHTML = `<div>レベル: ${playerLevel}</div>`;

  for (let cat of categories) {
    const div = document.createElement("div");
    div.innerHTML = `${cat}: ${statusPoints[cat] || 0} pt`;
    statusArea.appendChild(div);
  }
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


//レベルアップはすべてのカテゴリのポイントの中で最低なものに合わせる、レベルアップ時には自由に割り振れるステータスポイントを付与、