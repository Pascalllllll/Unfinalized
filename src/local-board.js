// Name-based leaderboard kept in this browser. Used when no on-chain board
// is configured in src/config.js.
const KEY = 'unfinalized-board';
const NAME_KEY = 'unfinalized-name';
const MAX = 50;

export function loadLocal() {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

export function saveLocal(entry) {
  const rows = loadLocal();
  rows.push(entry);
  rows.sort((a, b) => a.timeMs - b.timeMs || a.at - b.at);
  const kept = rows.slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(kept)); } catch { return -1; }
  return kept.indexOf(entry);
}

export function lastName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}

export function rememberName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch {}
}
