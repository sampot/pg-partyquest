const KEY = "pg-partyquest:progress";

export async function loadProgress() {
  await window.PG.ready;
  try {
    const raw = await window.PG.kv.get(KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveProgress(data) {
  await window.PG.ready;
  try {
    await window.PG.kv.put(KEY, JSON.stringify(data));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
