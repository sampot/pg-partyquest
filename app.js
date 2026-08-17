import { GameAudio } from "./audio.js";
import {
  ITEMS,
  MODE,
  TILE,
  applyAction,
  createGame,
  getLegalActions,
  getOutcome,
  getShopItems,
  memberStats,
  summarize,
  tileLabel,
  tryMapMove,
} from "./game.js";
import { loadProgress, saveProgress } from "./persist.js";

const TILE_SIZE = 44;
const COLORS = {
  [TILE.GRASS]: "#3d6b4f",
  [TILE.PATH]: "#8b7355",
  [TILE.TOWN]: "#c9a45c",
  [TILE.FOREST]: "#2f5d3a",
  [TILE.DUNGEON]: "#5a4a72",
  [TILE.BOSS]: "#8f2d4b",
  [TILE.GATE]: "#67c5e8",
  [TILE.WATER]: "#1b3344",
};

const ACTION_LABELS = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  attack: "全員突擊",
  skill: "火球術",
  heal: "治療術",
  guard: "防陣",
  equip: "裝備",
  "use-potion": "藥水",
  "leave-shop": "離開",
  buy: "購買",
  restart: "再開一局",
};

const ui = {
  lobby: document.getElementById("lobby"),
  game: document.getElementById("game"),
  start: document.getElementById("start"),
  sound: document.getElementById("sound"),
  best: document.getElementById("best"),
  hud: document.getElementById("hud"),
  chapter: document.getElementById("chapter"),
  gold: document.getElementById("gold"),
  score: document.getElementById("score"),
  canvas: document.getElementById("map"),
  party: document.getElementById("party"),
  msg: document.getElementById("msg"),
  log: document.getElementById("log"),
  actions: document.getElementById("actions"),
  shop: document.getElementById("shop"),
  equipPanel: document.getElementById("equip-panel"),
  combat: document.getElementById("combat"),
  enemyName: document.getElementById("enemy-name"),
  enemyHp: document.getElementById("enemy-hp"),
  toast: document.getElementById("toast"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayText: document.getElementById("overlay-text"),
  overlayRestart: document.getElementById("overlay-restart"),
  directions: {
    up: document.getElementById("d-up"),
    down: document.getElementById("d-down"),
    left: document.getElementById("d-left"),
    right: document.getElementById("d-right"),
  },
};

const ctx = ui.canvas.getContext("2d");
const audio = new GameAudio();
let state = createGame({ seed: Date.now() });
let progress = {};
let toastTimer = 0;
let audioReady = false;
let repeatTimer = 0;
let repeatInterval = 0;

function showToast(text) {
  ui.toast.hidden = false;
  ui.toast.textContent = text;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    ui.toast.hidden = true;
  }, 3200);
}

async function wakeAudio() {
  await audio.unlock();
  if (!audioReady && audio.enabled) {
    audioReady = true;
    audio.playBgm();
  }
}

function resizeCanvas() {
  if (!state?.map) return;
  const cols = state.map.w;
  const rows = state.map.h;
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;
  ui.canvas.width = width;
  ui.canvas.height = height;
  ui.canvas.style.width = "100%";
  ui.canvas.style.maxWidth = `${width}px`;
  ui.canvas.style.aspectRatio = `${cols} / ${rows}`;
}

function drawMap() {
  if (!state?.map) return;
  const { w, h, grid, player } = state.map;
  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const tile = grid[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      ctx.fillStyle = COLORS[tile] ?? "#333";
      ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      ctx.fillStyle = "rgb(255 255 255 / 18%)";
      if (tile === TILE.TOWN) ctx.fillText("鎮", px + 16, py + 28);
      if (tile === TILE.FOREST) ctx.fillText("林", px + 16, py + 28);
      if (tile === TILE.DUNGEON) ctx.fillText("遺", px + 16, py + 28);
      if (tile === TILE.BOSS) ctx.fillText("首", px + 16, py + 28);
      if (tile === TILE.GATE) ctx.fillText("關", px + 16, py + 28);
    }
  }
  const px = player.x * TILE_SIZE;
  const py = player.y * TILE_SIZE;
  ctx.fillStyle = "#ff9fb7";
  ctx.beginPath();
  ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function renderParty() {
  ui.party.replaceChildren();
  for (const member of state.party) {
    const card = document.createElement("article");
    card.className = "member";
    const stats = memberStats(member);
    card.innerHTML = `
      <strong>${member.name}</strong>
      <span>${member.job === "warrior" ? "劍士" : member.job === "mage" ? "術師" : "療師"}</span>
      <span class="hp">${member.hp}/${member.maxHp} ♥</span>
      <span class="mp">${member.mp}/${stats.maxMp} ✦</span>
      <span class="gear">${member.weapon ? ITEMS[member.weapon].name : "無武器"} · ${member.armor ? ITEMS[member.armor].name : "無防具"}</span>
    `;
    if (!member.alive || member.hp <= 0) card.dataset.down = "true";
    ui.party.append(card);
  }
}

function renderLog() {
  ui.log.replaceChildren();
  for (const entry of state.log.slice(0, 4)) {
    const item = document.createElement("li");
    item.dataset.kind = entry.kind;
    item.textContent = entry.text;
    ui.log.append(item);
  }
}

function renderShop() {
  ui.shop.hidden = state.mode !== MODE.SHOP;
  ui.shop.replaceChildren();
  if (state.mode !== MODE.SHOP) return;
  const title = document.createElement("p");
  title.className = "panel-title";
  title.textContent = "補給鎮商店";
  ui.shop.append(title);
  for (const item of getShopItems(state)) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "shop-row";
    row.textContent = `${item.name} · ${item.price} 古幣`;
    row.disabled = state.gold < item.price;
    row.onclick = () => dispatch("buy", { itemId: item.id }, "coin");
    ui.shop.append(row);
  }
}

function renderEquip() {
  ui.equipPanel.hidden = state.mode !== MODE.EQUIP;
  ui.equipPanel.replaceChildren();
  if (state.mode !== MODE.EQUIP) return;
  const title = document.createElement("p");
  title.className = "panel-title";
  title.textContent = "職業裝備";
  ui.equipPanel.append(title);
  for (const member of state.party) {
    const block = document.createElement("div");
    block.className = "equip-block";
    block.innerHTML = `<strong>${member.name}</strong>`;
    for (const itemId of state.owned) {
      const item = ITEMS[itemId];
      if (!item || item.slot === "item") continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.name;
      btn.disabled = !item.jobs.includes(member.job);
      btn.onclick = () => dispatch("equip-item", { memberId: member.id, itemId }, "click");
      block.append(btn);
    }
    ui.equipPanel.append(block);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "primary";
  close.textContent = "完成";
  close.onclick = () => dispatch("close-equip", {}, "click");
  ui.equipPanel.append(close);
}

function renderCombat() {
  const active = state.mode === MODE.COMBAT && state.combat;
  ui.combat.hidden = !active;
  if (!active) return;
  const enemy = state.combat.enemies[0];
  ui.enemyName.textContent = enemy.name;
  ui.enemyHp.textContent = `${Math.max(0, enemy.hp)} / ${enemy.maxHp}`;
}

function renderActions() {
  ui.actions.replaceChildren();
  const actions = getLegalActions(state);
  for (const action of actions) {
    if (["up", "down", "left", "right"].includes(action)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = ACTION_LABELS[action] ?? action;
    if (action === "restart") button.className = "primary";
    button.onclick = () => {
      if (action === "buy") return;
      dispatch(action, {}, actionSound(action));
    };
    ui.actions.append(button);
  }
}

function actionSound(action) {
  if (action === "attack") return "sword";
  if (action === "skill") return "spell";
  if (action === "heal") return "heal";
  if (action === "buy") return "coin";
  if (action === "restart") return "door";
  return "click";
}

function renderOverlay() {
  const outcome = getOutcome(state);
  const ended = outcome === "won" || outcome === "lost";
  ui.overlay.hidden = !ended;
  ui.overlay.inert = !ended;
  if (!ended) return;
  if (outcome === "won") {
    ui.overlayTitle.textContent = "遠征成功！";
    ui.overlayText.textContent = `第三章通關，得分 ${state.score}，剩餘古幣 ${state.gold}。`;
    audio.play("win");
    audio.stopBgm();
  } else {
    ui.overlayTitle.textContent = "遠征失敗";
    ui.overlayText.textContent = `結社在第 ${state.chapter} 章倒下，得分 ${state.score}。`;
    audio.stopBgm();
  }
}

function renderHud() {
  ui.chapter.textContent = `第 ${state.chapter} 章 · ${state.chapterTitle}`;
  ui.gold.textContent = String(state.gold);
  ui.score.textContent = String(state.score);
  ui.hud.dataset.mode = state.mode;
  ui.msg.textContent = state.message;
}

function render() {
  resizeCanvas();
  drawMap();
  renderHud();
  renderParty();
  renderLog();
  renderShop();
  renderEquip();
  renderCombat();
  renderActions();
  renderOverlay();
}

async function persist() {
  const outcome = getOutcome(state);
  progress = {
    ...progress,
    best: Math.max(progress.best || 0, state.score),
    last: summarize(state),
  };
  ui.best.textContent = String(progress.best || 0);
  if (outcome !== "playing") {
    const result = await saveProgress(progress);
    if (!result.ok) showToast("戰績同步失敗（仍可繼續玩）");
  }
}

function dispatch(action, payload = {}, sfx = "click") {
  wakeAudio();
  if (["up", "down", "left", "right"].includes(action)) {
    const before = summarize(state);
    const result = tryMapMove(state, action === "left" ? -1 : action === "right" ? 1 : 0, action === "up" ? -1 : action === "down" ? 1 : 0);
    state = result.state;
    if (result.blocked) audio.play("click");
    else if (result.encounter || result.boss) audio.play("hit");
    else if (result.chapter) audio.play("door");
    else if (result.won) audio.play("win");
    else if (result.moved) audio.play("step");
    else audio.play("click");
    if (result.locked) showToast(state.message);
  } else {
    state = applyAction(state, action, payload);
    audio.play(sfx);
  }
  render();
  void persist();
}

function stopRepeat() {
  window.clearTimeout(repeatTimer);
  window.clearInterval(repeatInterval);
}

function bindDirection(button, action) {
  const start = (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    dispatch(action);
    stopRepeat();
    repeatTimer = window.setTimeout(() => {
      repeatInterval = window.setInterval(() => dispatch(action), 160);
    }, 280);
  };
  const stop = () => stopRepeat();
  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
  button.addEventListener("lostpointercapture", stop);
}

function bindSwipe() {
  let start = null;
  ui.canvas.addEventListener("pointerdown", (event) => {
    start = { x: event.clientX, y: event.clientY };
    ui.canvas.setPointerCapture?.(event.pointerId);
  });
  const finish = (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (state.mode !== MODE.MAP) return;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) dispatch(dx > 0 ? "right" : "left");
    else dispatch(dy > 0 ? "down" : "up");
  };
  ui.canvas.addEventListener("pointerup", finish);
  ui.canvas.addEventListener("pointercancel", () => {
    start = null;
  });
}

function bindKeyboard() {
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    const moves = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
    };
    if (moves[key] && state.mode === MODE.MAP) {
      event.preventDefault();
      dispatch(moves[key]);
    }
  });
}

function suspendInput() {
  stopRepeat();
}

function bindLifecycle() {
  const suspend = () => {
    suspendInput();
    audio.suspend();
  };
  const resume = () => {
    audio.resume();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") suspend();
    else resume();
  });
  window.addEventListener("pagehide", suspend);
}

async function init() {
  progress = await loadProgress();
  ui.best.textContent = String(progress.best || 0);
  audio.preloadAll();

  ui.start.addEventListener("click", async () => {
    await wakeAudio();
    state = createGame({ seed: Date.now() });
    ui.lobby.hidden = true;
    ui.game.hidden = false;
    render();
  });

  ui.sound.addEventListener("click", async (event) => {
    const on = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", String(on));
    event.currentTarget.textContent = on ? "♫ 音效" : "♫ 靜音";
    audio.setEnabled(on);
    if (on) await wakeAudio();
  });

  ui.overlayRestart.addEventListener("click", () => {
    wakeAudio();
    state = createGame({ seed: Date.now() });
    render();
  });

  bindDirection(ui.directions.up, "up");
  bindDirection(ui.directions.down, "down");
  bindDirection(ui.directions.left, "left");
  bindDirection(ui.directions.right, "right");
  bindSwipe();
  bindKeyboard();
  bindLifecycle();
}

init().catch((error) => {
  console.error("[pg-partyquest]", error);
  showToast("遊戲暫時無法啟動，請重新整理。");
});
