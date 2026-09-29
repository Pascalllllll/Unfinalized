// Day is ivory stone with gold; night is violet dusk with purple. The page
// colors live in style.css under the same data-theme attribute.

export const THEMES = {
  light: {
    bone: 0xf4efe3,
    stone: 0xe6dcc6,
    call: 0xc4b797,
    blob: 0x9f8d69,
    slabSide: 0xdacdb0,
    core: 0xe9e1cf,
    ink: 0x2a2418,
    accent: 0xc99a1e,
    // The runner: a gold jelly slime by day, a violet one at night.
    slime: 0xffcc33,
    slimeGlow: 0x5c3800,
    slimeEye: 0x2a2418,
    slimeCheek: 0xff8f86,
    sea: 0x2a2418,
    line: 0x2a2418,
    lineOpacity: 0.55,
    sky: 0xfff8e8,
    ground: 0x9a8a6a,
    hemi: 2.2,
    sun: 0xfff4d6,
    sunI: 1.8,
    label: '#ece3cf',
    labelInk: '#2a2418',
  },
  dark: {
    bone: 0x17131f,
    stone: 0x4a4163,
    call: 0x352e4a,
    blob: 0x5d4b8c,
    slabSide: 0x3b3452,
    core: 0x2a2439,
    ink: 0x07060b,
    accent: 0xa77bff,
    slime: 0xa77bff,
    slimeGlow: 0x2a1060,
    slimeEye: 0x140f1f,
    slimeCheek: 0xff9fd2,
    sea: 0x07060b,
    line: 0xd9d0f0,
    lineOpacity: 0.35,
    sky: 0xb7a6e6,
    ground: 0x1c1629,
    hemi: 2.3,
    sun: 0xe0d6ff,
    sunI: 1.6,
    label: '#2b2540',
    labelInk: '#ece7f7',
  },
};

const KEY = 'unfinalized-theme';
const night = matchMedia('(prefers-color-scheme: dark)');

function saved() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function currentTheme() {
  const s = saved();
  return s === 'light' || s === 'dark' ? s : night.matches ? 'dark' : 'light';
}

export function setTheme(name, remember = true) {
  if (remember) try { localStorage.setItem(KEY, name); } catch {}
  document.documentElement.dataset.theme = name;
}

// Follows the system setting until the player picks one themselves.
export function onSystemThemeChange(fn) {
  night.addEventListener('change', () => { if (!saved()) fn(currentTheme()); });
}
