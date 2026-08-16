/** pg-partyquest — 結社遠征錄 (傳統 RPG) */

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function mulberry32(a) {
  return function() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function deep(o) { return JSON.parse(JSON.stringify(o)); }


export function createGame({ seed = 1 } = {}) {
  return { seed, turn: 0, score: 0, level: 1, meter: 0, resources: 10, flags: {}, log: ["結社遠征：前進／戰鬥／補給"], outcome: "playing", msg: "結社遠征：前進／戰鬥／補給" };
}
export function getLegalActions(s) {
  if (s.outcome !== "playing") return [];
  return ["march","fight","camp","loot"];
}
export function applyAction(state, action) {
  const s = deep(state);
  if (s.outcome !== "playing") return s;
  const rnd = mulberry32(s.seed + s.turn * 19);
  s.turn++;
  
  s.flags.hp = s.flags.hp ?? 40;
  s.flags.chapter = s.flags.chapter ?? 1;
  if (action === "march") { s.meter += 8; s.msg = "行軍"; }
  else if (action === "camp") { s.flags.hp = clamp(s.flags.hp+10,0,50); s.msg = "紮營"; }
  else if (action === "loot") { s.resources += 3; s.score += 10; s.msg = "搜刮寶箱"; }
  else {
    const dmg = 5 + s.flags.chapter * 2;
    if (rnd() < 0.65) { s.meter += 20; s.score += 30; s.msg = "戰鬥勝利"; }
    else { s.flags.hp -= dmg; s.msg = "苦戰受傷"; }
  }
  if (s.flags.hp <= 0) { s.outcome = "lost"; s.msg = "全隊倒下"; }
  if (s.meter >= 33 && s.flags.chapter === 1) { s.flags.chapter = 2; s.msg = "第二章開始"; }
  if (s.meter >= 66 && s.flags.chapter === 2) { s.flags.chapter = 3; s.msg = "最終章"; }
  if (s.meter >= 100) { s.level = 5; }

  if (s.resources < 0) s.resources = 0;
  if (s.outcome === "playing" && s.level >= 5 && s.meter >= 100) {
    s.outcome = "won";
    s.msg = "目標達成！";
  }
  if (s.outcome === "playing" && (s.resources <= 0 && s.meter < 20 && s.turn > 8)) {
    s.outcome = "lost";
    s.msg = "資源崩盤";
  }
  return s;
}
export function summarize(s) {
  return { turn: s.turn, level: s.level, meter: s.meter, score: s.score, resources: s.resources, msg: s.msg, outcome: s.outcome, flags: s.flags };
}
export function getOutcome(s) { return s.outcome; }

