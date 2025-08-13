let categories = JSON.parse(localStorage.getItem("categories")) || [];
let scores = JSON.parse(localStorage.getItem("scores")) || {};
let pastScores = JSON.parse(localStorage.getItem("pastScores")) || {};
let lastWeek = localStorage.getItem("lastUpdatedWeek");
let playerLevel = parseInt(localStorage.getItem("playerLevel") || "0");
let freePoints = parseInt(localStorage.getItem("freePoints") || "0");

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
  localStorage.setItem("playerLevel", playerLevel);
  localStorage.setItem("freePoints", freePoints);
}

function addCategory() {
  const input = document.getElementById("categoryInput");
  const name = input.value.trim();
  if (!name) return alert("カテゴリ名を入力してください");
  if (categories.includes(name)) return alert("すでに存在します");

  categories.push(name);
  scores[name] = 0;
  input.value = "";
  save();
  render();
}

function deleteCategories() {
  const toDelete = prompt("削除するカテゴリ名を空白区切りで入力(複数可):");
  if (!toDelete) return;
  const targets = toDelete.split(" ").map((s) => s.trim());
  categories = categories.filter((c) => !targets.includes(c));
  for (let t of targets) delete scores[t];
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
    div.className = "category-row";
div.draggable = true;
div.dataset.cat = cat; // 識別用

div.addEventListener("dragstart", (e) => {
  e.dataTransfer.setData("text/plain", cat);
});

div.addEventListener("dragover", (e) => {
  e.preventDefault(); // ドロップ許可
});

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

    div.className = "score-row";
    div.className = "score-row"; // ← ここでflexレイアウトを適用

    const label = document.createElement("span");
    label.textContent = `${cat}: ${scores[cat] || 0} pt`;
    label.style.width = "50%";
    label.style.cursor = "pointer";
    label.onclick = () => enableEdit(label, cat);

    const minus = document.createElement("button");
    minus.textContent = "－";
    minus.className = "zoom-safe-button";
    minus.onclick = () => updateScore(cat, -1);

    const plus = document.createElement("button");
    plus.textContent = "＋";
    plus.className = "zoom-safe-button";
    plus.onclick = () => updateScore(cat, 1);

    // ボタンをまとめるコンテナ
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "score-buttons";
    buttonGroup.append(minus, plus);

    // 全体に追加
    div.append(label, buttonGroup);
    list.appendChild(div);
  }

  updateChart();
}

function goToGame() {
  document.getElementById("recordArea").style.display = "none";
  document.getElementById("gameArea").style.display = "block";
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
  const status = {};
  for (let cat of categories) {
    // 例えばカテゴリ名が「体力」ならポイントを体力ステータスに
    status[cat] = scores[cat] || 0;
  }
  return status;
}

function checkLevelUp() {
  const minScore = Math.min(...categories.map(cat => scores[cat] || 0));
  if (minScore > level) {
    // レベルアップ
    const gained = (minScore - level) * 2; // 1レベルごとに2ポイント付与
    freePoints += gained;
    level = minScore;
    alert(`レベルが${level}になった！自由ポイントを${gained}pt獲得！`);
    saveGameStats();
  }
}

function saveGameStats() {
  localStorage.setItem("level", level);
  localStorage.setItem("freePoints", freePoints);
}

function checkWeekRollover() {
  const currentWeek = getCurrentWeek();
  if (lastWeek && lastWeek !== currentWeek.toString()) {
    // ペナルティ判定
    for (let cat of categories) {
      const last = pastScores[cat] || 0;
      const now = scores[cat] || 0;
      if (now <= last) {
        scores[cat] = Math.max(0, now - 1); // 減点
      }
    }

    pastScores = { ...scores };
    localStorage.setItem("pastScores", JSON.stringify(pastScores));
    alert("週が変わったので、増えていないカテゴリはペナルティを受けました！");

    save();
    checkLevelUp(); // ペナルティ後にレベルアップ判定
  }
  localStorage.setItem("lastUpdatedWeek", currentWeek.toString());
}

function recalcLevel() {
  if (categories.length === 0) return;

  const minScore = Math.min(...categories.map(c => scores[c] || 0));
  if (minScore > playerLevel) {
    // レベルアップ
    const diff = minScore - playerLevel;
    freePoints += diff; // レベル差分だけ自由ポイント付与
    playerLevel = minScore;
    alert(`レベル${playerLevel}にアップ！ 自由ポイント+${diff}`);
  } else if (minScore < playerLevel) {
    // ペナルティ（例：自由ポイント減らす）
    const diff = playerLevel - minScore;
    freePoints = Math.max(0, freePoints - diff);
    playerLevel = minScore;
    alert(`レベルが${playerLevel}に下がりました… 自由ポイント-${diff}`);
  }
  save();
}

function renderStatus() {
  const statusArea = document.getElementById("statusList");
  const status = calculateStatus();
  statusArea.innerHTML = `
    <div>レベル: ${playerLevel}</div>
    <div>自由ポイント: ${freePoints}</div>
  `;

  if (categories.length === 0) {
    statusArea.textContent = "カテゴリがありません。記録画面で追加してください。";
    return;
  }

  for (const [key, val] of Object.entries(status)) {
    const div = document.createElement("div");
    div.textContent = `${key}: ${val}`;
    if (freePoints > 0) {
      const plusBtn = document.createElement("button");
      plusBtn.textContent = "+";
      plusBtn.onclick = () => {
        scores[key] = (scores[key] || 0) + 1;
        freePoints--;
        save();
        localStorage.setItem("freePoints", freePoints);
        renderStatus();
      };
      div.appendChild(plusBtn);
    }
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