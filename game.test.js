import { describe, expect, it } from "vitest";
import {
  ITEMS,
  MODE,
  TILE,
  advanceChapter,
  applyAction,
  applyCombatAction,
  buyItem,
  createGame,
  equipItem,
  getLegalActions,
  getOutcome,
  getShopItems,
  memberStats,
  rng,
  summarize,
  tileLabel,
  tryMapMove,
  usePotion,
} from "./game.js";

describe("createGame", () => {
  it("is deterministic for the same seed", () => {
    expect(createGame({ seed: 42 })).toEqual(createGame({ seed: 42 }));
  });

  it("starts on chapter 1 map mode", () => {
    const game = createGame({ seed: 7 });
    expect(game.chapter).toBe(1);
    expect(game.mode).toBe(MODE.MAP);
    expect(getOutcome(game)).toBe("playing");
  });

  it("creates a three-member party with jobs", () => {
    const game = createGame();
    expect(game.party).toHaveLength(3);
    expect(game.party.map((member) => member.job)).toEqual(["warrior", "mage", "healer"]);
  });
});

describe("rng", () => {
  it("is deterministic", () => {
    const a = rng(99);
    const b = rng(99);
    for (let i = 0; i < 8; i += 1) expect(a()).toBe(b());
  });
});

describe("map movement", () => {
  it("blocks water tiles", () => {
    const game = createGame({ seed: 1 });
    game.map.player = { x: 0, y: 1 };
    const result = tryMapMove(game, -1, 0);
    expect(result.blocked).toBe(true);
  });

  it("moves on walkable tiles", () => {
    const game = createGame({ seed: 1 });
    const before = { ...game.map.player };
    const result = tryMapMove(game, 1, 0);
    expect(result.state.map.player.x).toBe(before.x + 1);
    expect(result.moved || result.town || result.locked).toBeTruthy();
  });

  it("opens shop on town tiles", () => {
    const game = createGame({ seed: 1 });
    game.map.player = { x: 1, y: 1 };
    const result = tryMapMove(game, 0, 0);
    expect(result.state.mode).toBe(MODE.SHOP);
  });

  it("locks gate until boss is cleared", () => {
    const game = createGame({ seed: 1 });
    game.map.player = { x: 5, y: 4 };
    game.flags.bossCleared = false;
    const result = tryMapMove(game, 0, 0);
    expect(result.locked).toBe(true);
  });
});

describe("combat", () => {
  it("starts combat on dungeon tile", () => {
    const game = createGame({ seed: 1 });
    game.map.player = { x: 4, y: 3 };
    const result = tryMapMove(game, 0, 0);
    expect(result.state.mode).toBe(MODE.COMBAT);
    expect(result.state.combat.enemies[0].hp).toBeGreaterThan(0);
  });

  it("attack reduces enemy hp", () => {
    let game = createGame({ seed: 3 });
    game = applyAction(game, "right");
    game.mode = MODE.COMBAT;
    game.combat = { enemies: [{ name: "測試", hp: 20, maxHp: 20, atk: 2, def: 0, alive: true }], log: [] };
    const after = applyCombatAction(game, "attack");
    expect(after.combat.enemies[0].hp).toBeLessThan(20);
  });

  it("skill consumes mage mp", () => {
    const game = createGame({ seed: 1 });
    game.mode = MODE.COMBAT;
    game.combat = { enemies: [{ name: "測試", hp: 30, maxHp: 30, atk: 2, def: 0, alive: true }], log: [] };
    const mage = game.party.find((member) => member.job === "mage");
    const mpBefore = mage.mp;
    const after = applyCombatAction(game, "skill");
    expect(after.party.find((member) => member.job === "mage").mp).toBe(mpBefore - 4);
  });

  it("heal restores party hp", () => {
    const game = createGame({ seed: 1 });
    game.mode = MODE.COMBAT;
    game.combat = { enemies: [{ name: "測試", hp: 30, maxHp: 30, atk: 1, def: 0, alive: true }], log: [] };
    game.party.forEach((member) => {
      member.hp = Math.max(1, member.hp - 8);
    });
    const hpBefore = game.party.map((member) => member.hp);
    const after = applyCombatAction(game, "heal");
    const hpAfter = after.party.map((member) => member.hp);
    expect(hpAfter.some((hp, index) => hp > hpBefore[index])).toBe(true);
  });

  it("ends combat when enemy hp reaches zero", () => {
    let game = createGame({ seed: 1 });
    game.mode = MODE.COMBAT;
    game.combat = {
      enemies: [{ name: "弱敵", hp: 1, maxHp: 1, atk: 0, def: 0, alive: true, gold: 5, score: 5 }],
      log: [],
    };
    game = applyCombatAction(game, "attack");
    expect(game.mode).toBe(MODE.MAP);
    expect(game.combat).toBeNull();
  });

  it("marks defeat when all party members fall", () => {
    let game = createGame({ seed: 1 });
    game.mode = MODE.COMBAT;
    game.combat = { enemies: [{ name: "強敵", hp: 200, maxHp: 200, atk: 99, def: 0, alive: true }], log: [] };
    game.party.forEach((member) => {
      member.hp = 1;
    });
    for (let round = 0; round < 6 && getOutcome(game) === "playing"; round += 1) {
      game = applyCombatAction(game, "attack");
    }
    expect(getOutcome(game)).toBe("lost");
  });
});

describe("equipment and shop", () => {
  it("lists chapter shop inventory", () => {
    expect(getShopItems(createGame({ seed: 1 })).length).toBeGreaterThan(3);
  });

  it("buys potions and deducts gold", () => {
    let game = createGame({ seed: 1 });
    game.mode = MODE.SHOP;
    game.gold = 100;
    const before = game.inventory.potion;
    const result = buyItem(game, "potion");
    expect(result.ok).toBe(true);
    expect(result.state.gold).toBe(100 - ITEMS.potion.price);
    expect(result.state.inventory.potion).toBe(before + 1);
  });

  it("refuses purchases without enough gold", () => {
    const game = createGame({ seed: 1 });
    game.mode = MODE.SHOP;
    game.gold = 0;
    const result = buyItem(game, "steel-sword");
    expect(result.ok).toBe(false);
  });

  it("equips job-restricted gear", () => {
    let game = createGame({ seed: 1 });
    game.owned.push("steel-sword");
    const result = equipItem(game, "rin", "steel-sword");
    expect(result.ok).toBe(true);
    expect(result.state.party[0].weapon).toBe("steel-sword");
    expect(memberStats(result.state.party[0]).atk).toBeGreaterThan(memberStats(createGame().party[0]).atk);
  });

  it("rejects wrong job equipment", () => {
    const game = createGame({ seed: 1 });
    game.owned.push("star-rod");
    const result = equipItem(game, "rin", "star-rod");
    expect(result.ok).toBe(false);
  });
});

describe("items and potions", () => {
  it("uses potion on injured ally", () => {
    const game = createGame({ seed: 1 });
    game.party[0].hp = 5;
    const result = usePotion(game);
    expect(result.ok).toBe(true);
    expect(result.state.party[0].hp).toBeGreaterThan(5);
  });

  it("refuses potion when everyone is healthy", () => {
    const game = createGame({ seed: 1 });
    const result = usePotion(game);
    expect(result.ok).toBe(false);
  });
});

describe("chapter flow", () => {
  it("advances chapter and resets boss flag", () => {
    const game = createGame({ seed: 1 });
    game.flags.bossCleared = true;
    const next = advanceChapter(game);
    expect(next.chapter).toBe(2);
    expect(next.flags.bossCleared).toBe(false);
    expect(next.mode).toBe(MODE.MAP);
  });

  it("wins after chapter 3 gate with boss cleared", () => {
    const game = createGame({ seed: 1, chapter: 3 });
    game.flags.bossCleared = true;
    game.map.player = { x: 4, y: 5 };
    const result = tryMapMove(game, 1, 0);
    expect(result.won).toBe(true);
    expect(getOutcome(result.state)).toBe("won");
  });
});

describe("applyAction safety", () => {
  it("ignores unknown actions", () => {
    const game = createGame({ seed: 1 });
    expect(applyAction(game, "invalid")).toEqual(game);
  });

  it("applies actions immutably", () => {
    const before = createGame({ seed: 9 });
    const snapshot = structuredClone(before);
    applyAction(before, "equip");
    expect(before).toEqual(snapshot);
  });

  it("exposes legal actions per mode", () => {
    const mapGame = createGame({ seed: 1 });
    expect(getLegalActions(mapGame)).toContain("equip");
    mapGame.mode = MODE.COMBAT;
    mapGame.combat = { enemies: [{ name: "敵", hp: 10, maxHp: 10, atk: 2, def: 0, alive: true }], log: [] };
    expect(getLegalActions(mapGame)).toContain("attack");
  });

  it("summarizes useful runtime data", () => {
    const summary = summarize(createGame({ seed: 2 }));
    expect(summary.chapter).toBe(1);
    expect(summary.partyHp).toHaveLength(3);
  });

  it("labels map tiles", () => {
    expect(tileLabel(TILE.TOWN)).toBe("補給鎮");
    expect(tileLabel(TILE.BOSS)).toBe("首領");
  });
});
