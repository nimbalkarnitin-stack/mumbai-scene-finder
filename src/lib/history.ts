/**
 * Lightweight, anonymous personalisation signal kept on this device only.
 * Stores nothing but mood / area / category slugs from recent searches and saves.
 */
const KEY = "vybz.history";
const LEGACY_KEY = "sceneai.history";
const MAX = 12;

export interface HistorySignal {
  moods?: string[] | undefined;
  areas?: string[] | undefined;
  categories?: string[] | undefined;
}

interface Store {
  moods: string[];
  areas: string[];
  categories: string[];
}

const empty: Store = { moods: [], areas: [], categories: [] };

function read(): Store {
  if (typeof window === "undefined") return empty;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY) ?? "null") as Partial<Store> | null;
    if (!raw) return empty;
    return {
      moods: Array.isArray(raw.moods) ? raw.moods.slice(0, MAX) : [],
      areas: Array.isArray(raw.areas) ? raw.areas.slice(0, MAX) : [],
      categories: Array.isArray(raw.categories) ? raw.categories.slice(0, MAX) : [],
    };
  } catch {
    return empty;
  }
}

function push(list: string[], value: string) {
  return [value, ...list.filter((v) => v !== value)].slice(0, MAX);
}

/** Record slugs the user has just shown interest in. Silently ignores empties. */
export function recordHistory(patch: { mood?: string | null; area?: string | null; category?: string | null }) {
  if (typeof window === "undefined") return;
  const cur = read();
  const next: Store = {
    moods: patch.mood ? push(cur.moods, patch.mood) : cur.moods,
    areas: patch.area ? push(cur.areas, patch.area) : cur.areas,
    categories: patch.category ? push(cur.categories, patch.category) : cur.categories,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Read the signal in the shape the recommendation scorer expects. */
export function getHistorySignal(): HistorySignal | undefined {
  const s = read();
  if (!s.moods.length && !s.areas.length && !s.categories.length) return undefined;
  const out: HistorySignal = {};
  if (s.moods.length) out.moods = s.moods.slice(0, 6);
  if (s.areas.length) out.areas = s.areas.slice(0, 6);
  if (s.categories.length) out.categories = s.categories.slice(0, 6);
  return out;
}
