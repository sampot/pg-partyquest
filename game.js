/**
 * 結社遠征錄 — 世界地圖、職業裝備、三章主線。
 * 純規則邏輯；UI 與音效在 app.js / audio.js。
 */

export const TILE = {
  GRASS: 0,
  PATH: 1,
  TOWN: 2,
  FOREST: 3,
  DUNGEON: 4,
  BOSS: 5,
  GATE: 6,
  WATER: 7,
};

export const MODE = {
  MAP: "map",
  COMBAT: "combat",
  SHOP: "shop",
  EQUIP: "equip",
};

export const ITEMS = {
  "wood-sword": { id: "wood-sword", name: "木劍", slot: "weapon", atk: 1, def: 0, price: 0, jobs: ["warrior"] },
  "steel-sword": { id: "steel-sword", name: "鋼劍", slot: "weapon", atk: 4, def: 0, price: 45, jobs: ["warrior"] },
  "star-rod": { id: "star-rod", name: "星杖", slot: "weapon", atk: 3, def: 0, price: 50, jobs: ["mage"], mpBonus: 4 },
  "holy-bell": { id: "holy-bell", name: "聖鈴", slot: "weapon", atk: 2, def: 0, price: 48, jobs: ["healer"], healBonus: 4 },
  "cloth": { id: "cloth", name: "布甲", slot: "armor", atk: 0, def: 1, price: 20, jobs: ["warrior", "mage", "healer"] },
  "chain": { id: "chain", name: "鏈甲", slot: "armor", atk: 0, def: 3, price: 55, jobs: ["warrior", "healer"] },
  "mythril": { id: "mythril", name: "秘銀甲", slot: "armor", atk: 0, def: 5, price: 90, jobs: ["warrior", "mage", "healer"] },
  "potion": { id: "potion", name: "紅藥水", slot: "item", heal: 18, price: 12, jobs: ["warrior", "mage", "healer"] },
};

export const SHOP_BY_CHAPTER = {
  1: ["steel-sword", "star-rod", "holy-bell", "cloth", "potion"],
  2: ["steel-sword", "star-rod", "holy-bell", "chain", "mythril", "potion"],
  3: ["steel-sword", "star-rod", "holy-bell", "chain", "mythril", "potion"],
};

const CHAPTER_META = {
  1: { title: "青之森", boss: "苔泥王", intro: "結社接到委託：調查青之森深處的異變。" },
  2: { title: "灰岩橋", boss: "橋守幽靈", intro: "穿過灰岩橋，王城方向的關隘被幽靈佔據。" },
  3: { title: "王城塔", boss: "深淵領主", intro: "最終遠征：登上王城塔，終結遠征錄的源頭。" },
};

const ENCOUNTERS = {
  slime: { name: "苔泥怪", hp: 14, atk: 3, def: 0, gold: 8, score: 12 },
  wolf: { name: "灰狼", hp: 18, atk: 4, def: 1, gold: 10, score: 16 },
  ghost: { name: "迷途幽靈", hp: 16, atk: 5, def: 0, gold: 12, score: 18 },
  guard: { name: "塔樓守衛", hp: 24, atk: 6, def: 2, gold: 16, score: 24 },
  boss1: { name: "苔泥王", hp: 42, atk: 5, def: 1, gold: 40, score: 80, boss: true },
  boss2: { name: "橋守幽靈", hp: 52, atk: 7, def: 2, gold: 55, score: 100, boss: true },
  boss3: { name: "深淵領主", hp: 72, atk: 9, def: 3, gold: 90, score: 200, boss: true },
};

const CHAPTER_MAPS = {
  1: {
    w: 7,
    h: 5,
    start: { x: 1, y: 3 },
    grid: [
      [7, 7, 7, 7, 7, 7, 7],
      [7, 2, 1, 1, 3, 1, 7],
      [7, 0, 0, 3, 1, 0, 7],
      [7, 0, 0, 1, 4, 0, 7],
      [7, 0, 0, 1, 5, 6, 7],
    ],
  },
  2: {
    w: 8,
    h: 5,
    start: { x: 1, y: 2 },
    grid: [
      [7, 7, 7, 7, 7, 7, 7, 7],
      [7, 2, 1, 3, 3, 1, 4, 7],
      [7, 0, 0, 1, 1, 0, 0, 7],
      [7, 0, 3, 1, 0, 3, 0, 7],
      [7, 0, 0, 1, 5, 6, 0, 7],
    ],
  },
  3: {
    w: 9,
    h: 6,
    start: { x: 1, y: 4 },
    grid: [
      [7, 7, 7, 7, 7, 7, 7, 7, 7],
      [7, 2, 1, 1, 3, 3, 1, 4, 7],
      [7, 0, 0, 1, 0, 0, 1, 0, 7],
      [7, 0, 3, 1, 0, 3, 1, 0, 7],
      [7, 0, 0, 1, 1, 1, 0, 0, 7],
      [7, 0, 0, 0, 5, 6, 0, 0, 7],
    ],
  },
};

export function rng(seed) {
  let value = seed | 0;
  return function random() {
    value = (value + 0x6d2b79f5) | 0;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function clone(value) {
  const next = structuredClone(value);
  return next;
}

function roll(state) {
  return rng(state.seed + state.turn * 997 + state.chapter * 1337)();
}

function createMember(id, name, job, stats) {
  return {
    id,
    name,
    job,
    hp: stats.hp,
    maxHp: stats.maxHp,
    mp: stats.mp,
    maxMp: stats.maxMp,
    baseAtk: stats.atk,
    baseDef: stats.def,
    weapon: stats.weapon,
    armor: stats.armor,
    guarding: false,
    alive: true,
  };
}

function defaultParty() {
  return [
    createMember("rin", "凜", "warrior", { hp: 34, maxHp: 34, mp: 6, maxMp: 6, atk: 6, def: 2, weapon: "wood-sword", armor: null }),
    createMember("mira", "米菈", "mage", { hp: 22, maxHp: 22, mp: 16, maxMp: 16, atk: 4, def: 1, weapon: null, armor: null }),
    createMember("poko", "波可", "healer", { hp: 26, maxHp: 26, mp: 14, maxMp: 14, atk: 3, def: 1, weapon: null, armor: null }),
  ];
}

function chapterMap(chapter) {
  const layout = CHAPTER_MAPS[chapter];
  return {
    w: layout.w,
    h: layout.h,
    grid: layout.grid.map((row) => row.slice()),
    player: { ...layout.start },
    bossCleared: false,
  };
}

export function memberStats(member) {
  const weapon = member.weapon ? ITEMS[member.weapon] : null;
  const armor = member.armor ? ITEMS[member.armor] : null;
  return {
    atk: member.baseAtk + (weapon?.atk ?? 0),
    def: member.baseDef + (armor?.def ?? 0),
    maxMp: member.maxMp + (weapon?.mpBonus ?? 0),
    healBonus: (weapon?.healBonus ?? 0) + (member.job === "healer" ? 4 : 0),
  };
}

export function createGame({ seed = 1, chapter = 1 } = {}) {
  const meta = CHAPTER_META[chapter];
  return {
    seed: Number(seed) || 1,
    chapter,
    chapterTitle: meta.title,
    mode: MODE.MAP,
    outcome: "playing",
    message: meta.intro,
    log: [{ kind: "story", text: meta.intro }],
    turn: 0,
    score: 0,
    gold: 30,
    inventory: { potion: 2 },
    owned: ["wood-sword"],
    map: chapterMap(chapter),
    party: defaultParty(),
    combat: null,
    flags: { bossCleared: false },
  };
}

export function getOutcome(state) {
  return state.outcome;
}

export function summarize(state) {
  return {
    chapter: state.chapter,
    mode: state.mode,
    score: state.score,
    gold: state.gold,
    outcome: state.outcome,
    message: state.message,
    bossCleared: state.flags.bossCleared,
    partyHp: state.party.map((member) => member.hp),
  };
}

function pushLog(state, kind, text) {
  state.log.unshift({ kind, text });
  state.log.length = Math.min(state.log.length, 8);
}

function livingParty(state) {
  return state.party.filter((member) => member.alive && member.hp > 0);
}

function tileAt(state, x, y) {
  if (x < 0 || y < 0 || x >= state.map.w || y >= state.map.h) return TILE.WATER;
  return state.map.grid[y][x];
}

function walkable(tile) {
  return tile !== TILE.WATER;
}

function encounterPool(chapter, boss = false) {
  if (boss) return chapter === 1 ? "boss1" : chapter === 2 ? "boss2" : "boss3";
  if (chapter === 1) return "slime";
  if (chapter === 2) return "wolf";
  return "guard";
}

function spawnEncounter(state, key) {
  const template = ENCOUNTERS[key];
  return {
    key,
    name: template.name,
    hp: template.hp,
    maxHp: template.hp,
    atk: template.atk,
    def: template.def,
    gold: template.gold,
    score: template.score,
    boss: Boolean(template.boss),
    alive: true,
  };
}

function startCombat(state, encounterKey) {
  const enemy = spawnEncounter(state, encounterKey);
  state.mode = MODE.COMBAT;
  state.combat = {
    enemies: [enemy],
    log: [`遭遇 ${enemy.name}！`],
    guarding: false,
  };
  state.party.forEach((member) => {
    member.guarding = false;
  });
  state.message = `戰鬥開始：${enemy.name}`;
  pushLog(state, "combat", state.message);
}

function endCombatVictory(state) {
  const enemy = state.combat.enemies[0];
  state.gold += enemy.gold;
  state.score += enemy.score;
  if (enemy.boss) {
    state.flags.bossCleared = true;
    state.map.bossCleared = true;
    pushLog(state, "story", `${enemy.name} 被擊敗！前往關隘继续前进。`);
  }
  state.mode = MODE.MAP;
  state.combat = null;
  state.message = "戰鬥勝利，整理裝備後再出發。";
}

function checkDefeat(state) {
  if (livingParty(state).length === 0) {
    state.outcome = "lost";
    state.message = "結社全員倒下，遠征失敗。";
    pushLog(state, "fail", state.message);
    return true;
  }
  return false;
}

function enemyTurn(state) {
  const enemy = state.combat.enemies.find((entry) => entry.alive);
  if (!enemy) return;
  const targets = livingParty(state);
  if (!targets.length) return;
  const target = targets[Math.floor(roll(state) * targets.length)];
  const stats = memberStats(target);
  let damage = Math.max(1, enemy.atk - stats.def);
  if (target.guarding) damage = Math.max(1, Math.floor(damage * 0.5));
  target.hp -= damage;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
  }
  state.combat.log.unshift(`${enemy.name} 攻擊 ${target.name}，造成 ${damage} 傷害。`);
  state.combat.log.length = 6;
  pushLog(state, "combat", `${enemy.name} 反擊 ${target.name} -${damage}`);
}

export function tryMapMove(state, dx, dy) {
  const next = clone(state);
  if (next.mode !== MODE.MAP || next.outcome !== "playing") return { state: next, blocked: true };

  const x = next.map.player.x + dx;
  const y = next.map.player.y + dy;
  const tile = tileAt(next, x, y);
  if (!walkable(tile)) return { state: next, blocked: true };

  next.map.player = { x, y };
  next.turn += 1;

  if (tile === TILE.TOWN) {
    next.mode = MODE.SHOP;
    next.message = "抵達補給鎮，可購買裝備與藥水。";
    pushLog(next, "town", next.message);
    return { state: next, town: true };
  }

  if (tile === TILE.FOREST && roll(next) < 0.45) {
    const key = next.chapter === 1 ? "slime" : next.chapter === 2 ? (roll(next) < 0.5 ? "wolf" : "ghost") : (roll(next) < 0.5 ? "ghost" : "guard");
    startCombat(next, key);
    return { state: next, encounter: true };
  }

  if (tile === TILE.DUNGEON) {
    const key = next.chapter === 1 ? "slime" : next.chapter === 2 ? "ghost" : "guard";
    startCombat(next, key);
    return { state: next, encounter: true };
  }

  if (tile === TILE.BOSS) {
    if (!next.flags.bossCleared) {
      startCombat(next, encounterPool(next.chapter, true));
      return { state: next, boss: true };
    }
    next.message = "首領已倒下，這裡只剩餘燼。";
    return { state: next, moved: true };
  }

  if (tile === TILE.GATE) {
    if (!next.flags.bossCleared) {
      next.message = "關隘緊閉——先擊敗本章首領。";
      pushLog(next, "locked", next.message);
      return { state: next, locked: true };
    }
    if (next.chapter >= 3) {
      next.outcome = "won";
      next.score += 300;
      next.message = "深淵領主倒下，結社遠征成功！";
      pushLog(next, "win", next.message);
      return { state: next, won: true };
    }
    const advanced = advanceChapter(next);
    return { state: advanced, chapter: true };
  }

  next.message = "結社在地图上前进。";
  return { state: next, moved: true };
}

export function advanceChapter(state) {
  const next = clone(state);
  const newChapter = next.chapter + 1;
  const meta = CHAPTER_META[newChapter];
  next.chapter = newChapter;
  next.chapterTitle = meta.title;
  next.mode = MODE.MAP;
  next.map = chapterMap(newChapter);
  next.flags = { bossCleared: false };
  next.score += 120;
  next.message = meta.intro;
  pushLog(next, "story", `第 ${newChapter} 章 · ${meta.title}`);
  pushLog(next, "story", meta.intro);
  next.party.forEach((member) => {
    if (!member.alive) {
      member.alive = true;
      member.hp = Math.floor(member.maxHp * 0.5);
    } else {
      member.hp = Math.min(member.maxHp, member.hp + 6);
      member.mp = Math.min(memberStats(member).maxMp, member.mp + 4);
    }
    member.guarding = false;
  });
  return next;
}

export function getLegalActions(state) {
  if (state.outcome !== "playing") return ["restart"];
  if (state.mode === MODE.MAP) return ["up", "down", "left", "right", "equip", "use-potion"];
  if (state.mode === MODE.SHOP) return ["buy", "leave-shop", "equip"];
  if (state.mode === MODE.EQUIP) return ["equip-item", "unequip", "close-equip"];
  if (state.mode === MODE.COMBAT) {
    const actions = ["attack", "guard"];
    const mage = state.party.find((member) => member.job === "mage" && member.alive && member.hp > 0);
    const healer = state.party.find((member) => member.job === "healer" && member.alive && member.hp > 0);
    if (mage && mage.mp >= 4) actions.push("skill");
    if (healer && healer.mp >= 3) actions.push("heal");
    return actions;
  }
  return [];
}

export function getShopItems(state) {
  return SHOP_BY_CHAPTER[state.chapter].map((id) => ITEMS[id]);
}

export function buyItem(state, itemId) {
  const next = clone(state);
  const item = ITEMS[itemId];
  if (!item || next.mode !== MODE.SHOP) return { state: next, ok: false };
  if (next.gold < item.price) {
    next.message = "古幣不足。";
    return { state: next, ok: false };
  }
  next.gold -= item.price;
  if (item.slot === "item") {
    next.inventory.potion = (next.inventory.potion || 0) + 1;
  } else {
    if (!next.owned.includes(itemId)) next.owned.push(itemId);
  }
  next.message = `購入 ${item.name}。`;
  pushLog(next, "shop", next.message);
  return { state: next, ok: true };
}

export function equipItem(state, memberId, itemId) {
  const next = clone(state);
  const item = ITEMS[itemId];
  const member = next.party.find((entry) => entry.id === memberId);
  if (!item || !member || !next.owned.includes(itemId)) return { state: next, ok: false };
  if (!item.jobs.includes(member.job)) return { state: next, ok: false };
  if (item.slot === "weapon") member.weapon = itemId;
  if (item.slot === "armor") member.armor = itemId;
  next.message = `${member.name} 裝備 ${item.name}。`;
  pushLog(next, "equip", next.message);
  return { state: next, ok: true };
}

export function usePotion(state) {
  const next = clone(state);
  if ((next.inventory.potion || 0) <= 0) {
    next.message = "紅藥水用完了。";
    return { state: next, ok: false };
  }
  const target = next.party.find((member) => member.alive && member.hp < member.maxHp);
  if (!target) {
    next.message = "沒有人需要治療。";
    return { state: next, ok: false };
  }
  next.inventory.potion -= 1;
  target.hp = Math.min(target.maxHp, target.hp + ITEMS.potion.heal);
  next.message = `${target.name} 喝下紅藥水。`;
  pushLog(next, "heal", next.message);
  return { state: next, ok: true };
}

function warriorStrike(state) {
  const warrior = state.party.find((member) => member.job === "warrior" && member.alive && member.hp > 0);
  const enemy = state.combat.enemies[0];
  if (!warrior || !enemy.alive) return 0;
  const stats = memberStats(warrior);
  const damage = Math.max(1, stats.atk + 2 - enemy.def);
  enemy.hp -= damage;
  state.combat.log.unshift(`${warrior.name} 突擊 ${enemy.name} -${damage}`);
  return damage;
}

function mageBlast(state) {
  const mage = state.party.find((member) => member.job === "mage" && member.alive && member.hp > 0);
  const enemy = state.combat.enemies[0];
  if (!mage || mage.mp < 4 || !enemy.alive) return 0;
  mage.mp -= 4;
  const stats = memberStats(mage);
  const damage = Math.max(2, stats.atk + 6 - enemy.def);
  enemy.hp -= damage;
  state.combat.log.unshift(`${mage.name} 火球術 ${enemy.name} -${damage}`);
  return damage;
}

function healerPray(state) {
  const healer = state.party.find((member) => member.job === "healer" && member.alive && member.hp > 0);
  if (!healer || healer.mp < 3) return 0;
  healer.mp -= 3;
  const stats = memberStats(healer);
  let healed = 0;
  for (const member of livingParty(state)) {
    const before = member.hp;
    member.hp = Math.min(member.maxHp, member.hp + 8 + stats.healBonus);
    healed += member.hp - before;
  }
  state.combat.log.unshift(`${healer.name} 治療結社 +${healed}`);
  return healed;
}

export function applyCombatAction(state, action) {
  const next = clone(state);
  if (next.mode !== MODE.COMBAT || next.outcome !== "playing") return next;
  if (!getLegalActions(next).includes(action)) return next;

  const enemy = next.combat.enemies[0];
  next.party.forEach((member) => {
    member.guarding = false;
  });

  if (action === "attack") {
    warriorStrike(next);
  } else if (action === "skill") {
    mageBlast(next);
  } else if (action === "heal") {
    healerPray(next);
  } else if (action === "guard") {
    next.party.forEach((member) => {
      if (member.alive && member.hp > 0) member.guarding = true;
    });
    next.combat.log.unshift("結社組成防陣。");
  }

  if (enemy.hp <= 0) {
    enemy.alive = false;
    endCombatVictory(next);
    return next;
  }

  enemyTurn(next);
  next.turn += 1;
  if (checkDefeat(next)) return next;
  next.message = `${enemy.name} 剩 ${Math.max(0, enemy.hp)} 生命。`;
  return next;
}

export function applyAction(state, action, payload = {}) {
  if (action === "restart") return createGame({ seed: Date.now() });

  if (state.outcome !== "playing" && action !== "restart") return state;

  if (state.mode === MODE.MAP) {
    if (action === "up") return tryMapMove(state, 0, -1).state;
    if (action === "down") return tryMapMove(state, 0, 1).state;
    if (action === "left") return tryMapMove(state, -1, 0).state;
    if (action === "right") return tryMapMove(state, 1, 0).state;
    if (action === "equip") {
      const next = clone(state);
      next.mode = MODE.EQUIP;
      next.returnMode = MODE.MAP;
      next.message = "調整職業裝備。";
      return next;
    }
    if (action === "use-potion") return usePotion(state).state;
  }

  if (state.mode === MODE.SHOP) {
    if (action === "leave-shop") {
      const next = clone(state);
      next.mode = MODE.MAP;
      next.message = "離開補給鎮。";
      return next;
    }
    if (action === "equip") {
      const next = clone(state);
      next.mode = MODE.EQUIP;
      next.returnMode = MODE.SHOP;
      return next;
    }
    if (action === "buy" && payload.itemId) return buyItem(state, payload.itemId).state;
  }

  if (state.mode === MODE.EQUIP) {
    if (action === "close-equip") {
      const next = clone(state);
      next.mode = next.returnMode === MODE.SHOP ? MODE.SHOP : MODE.MAP;
      next.message = "裝備調整完成。";
      return next;
    }
    if (action === "equip-item" && payload.memberId && payload.itemId) {
      return equipItem(state, payload.memberId, payload.itemId).state;
    }
  }

  if (state.mode === MODE.COMBAT) {
    return applyCombatAction(state, action);
  }

  return state;
}

export function tileLabel(tile) {
  return {
    [TILE.GRASS]: "草原",
    [TILE.PATH]: "道路",
    [TILE.TOWN]: "補給鎮",
    [TILE.FOREST]: "密林",
    [TILE.DUNGEON]: "遺跡",
    [TILE.BOSS]: "首領",
    [TILE.GATE]: "關隘",
    [TILE.WATER]: "水域",
  }[tile] ?? "?";
}

export function chapterMeta(chapter) {
  return CHAPTER_META[chapter];
}
