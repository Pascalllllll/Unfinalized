import * as THREE from 'three';
import { LiveChain, SyntheticChain } from './chain.js';
import { Course, PALETTE, CORE_R } from './course.js';
import { Player } from './player.js';
import { sfx } from './audio.js';
import { wallet, short } from './wallet.js';
import { BOARD } from './config.js';
import { boardReady, loadBoard, submitRun } from './board.js';
import { loadLocal, saveLocal, lastName, rememberName } from './local-board.js';
import { THEMES, currentTheme, setTheme, onSystemThemeChange } from './theme.js';

const START_BEHIND = 9;
const CONFIRMATIONS = 12;
const WINDOW = 15;

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-US');
const isTouch = matchMedia('(pointer: coarse)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (isTouch) {
  document.body.classList.add('touch');
  $('touch-note').hidden = false;
}

// Scene
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.bone);
scene.fog = new THREE.Fog(PALETTE.bone, 20, 75);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);

const hemi = new THREE.HemisphereLight(PALETTE.sky, PALETTE.ground, PALETTE.hemi);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sun, PALETTE.sunI);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// The 12-confirmation line: a flat sheet of ink that rises under the tower.
const inkSea = new THREE.Mesh(
  new THREE.CircleGeometry(220, 72),
  new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.3, metalness: 0.1 }),
);
inkSea.rotation.x = -Math.PI / 2;
scene.add(inkSea);

const course = new Course(scene);
const player = new Player(scene, sfx);
player.group.visible = false;

// Theme: light with gold by day, dark with purple at night.
function applyTheme(name, remember) {
  setTheme(name, remember);
  Object.assign(PALETTE, THEMES[name]);
  scene.background.set(PALETTE.bone);
  scene.fog.color.set(PALETTE.bone);
  hemi.color.set(PALETTE.sky);
  hemi.groundColor.set(PALETTE.ground);
  hemi.intensity = PALETTE.hemi;
  sun.color.set(PALETTE.sun);
  sun.intensity = PALETTE.sunI;
  inkSea.material.color.set(PALETTE.sea);
  course.applyTheme();
  player.applyTheme();
  for (const id of ['theme', 'theme-load', 'theme-hud']) {
    const btn = $(id);
    (btn.querySelector('.lbl') || btn).textContent = name === 'dark' ? 'Day mode' : 'Night mode';
    btn.setAttribute('aria-pressed', String(name === 'dark'));
  }
}
function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
}
applyTheme(currentTheme(), false);
onSystemThemeChange((name) => applyTheme(name, false));

let chain = null;
let state = 'loading';
let floorY = -10;
let floorTarget = -10;
let yaw = 0;
let pitch = 0.32;
const camTarget = new THREE.Vector3(0, 0, 0);
const run = { start: 0, time: 0, startBlock: 0, current: 0, touched: new Set(), lastTx: null, caught: null };

// Chain feed

function onBlock(block) {
  course.addBlock(block);
  updateFloorTarget();
  if (state === 'loading') return;
  sfx.block();
  const full = block.gasLimit ? Math.round((block.gasUsed / block.gasLimit) * 100) : 0;
  const tag = block.synthetic ? `S${fmt(block.number)}` : `#${fmt(block.number)}`;
  toast(`Block ${tag} landed: ${block.txs.length} txs, ${full}% full`);
  if (state === 'title') updateStartLabel();
}

function updateFloorTarget() {
  if (!chain) return;
  const rec = course.byNumber.get(chain.head - CONFIRMATIONS);
  const y = rec ? rec.topY - 0.4 : course.lowestY() - 6;
  floorTarget = Math.max(floorTarget, y);
}

async function boot(synthetic) {
  state = 'loading';
  $('error-actions').hidden = true;
  $('start-actions').hidden = false;
  $('start').disabled = true;
  const first = synthetic ? 'Building a synthetic chain…' : 'Reading Ethereum mainnet…';
  setStatus(first);
  showLoading(first);
  course.clear();
  floorTarget = floorY = -10;
  const c = synthetic ? new SyntheticChain() : new LiveChain();
  c.on('block', (b) => { if (chain === c) onBlock(b); });
  chain = c;
  try {
    await c.start(WINDOW, (done, total) => {
      const text = synthetic ? `Generated ${done} of ${total} blocks` : `Fetched ${done} of ${total} blocks from mainnet`;
      setStatus(text);
      showLoading(text, done / total);
    });
  } catch (err) {
    chain = null;
    state = 'error';
    hideLoading();
    setStatus(`Couldn't reach a public Ethereum RPC (${err.message || 'network error'}). Check your connection, or play on generated blocks instead.`, true);
    $('start-actions').hidden = true;
    $('error-actions').hidden = false;
    focusTitle('retry');
    return;
  }
  updateFloorTarget();
  floorY = floorTarget;
  state = 'title';
  setStatus(synthetic
    ? 'Synthetic chain: these stones are generated, not real transactions. Block numbers start with S.'
    : `Live from mainnet. Head is block #${fmt(chain.head)}.`);
  updateStartLabel();
  $('start').disabled = false;
  hideLoading();
  focusTitle('start');
}

// Focus a title button without scrolling the menu down to it; the menu
// always opens at the top.
function focusTitle(id) {
  $(id).focus({ preventScroll: true });
  $('title').scrollTop = 0;
}

// Loading screen. With no fraction the bar slides back and forth.
let loadingTimer = 0;
function showLoading(text, fraction) {
  clearTimeout(loadingTimer);
  const el = $('loading'), bar = $('loading-bar');
  el.hidden = false;
  el.classList.remove('done');
  el.setAttribute('aria-busy', 'true');
  document.body.classList.add('loading');
  $('loading-step').textContent = text;
  const known = fraction !== undefined;
  bar.classList.toggle('indeterminate', !known);
  $('loading-fill').style.width = known ? `${Math.round(fraction * 100)}%` : '';
  if (known) bar.setAttribute('aria-valuenow', Math.round(fraction * 100));
  else bar.removeAttribute('aria-valuenow');
}

function hideLoading() {
  const el = $('loading');
  el.classList.add('done');
  el.setAttribute('aria-busy', 'false');
  document.body.classList.remove('loading');
  loadingTimer = setTimeout(() => { el.hidden = true; }, reducedMotion ? 0 : 300);
}

function setStatus(text, error = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('error', error);
}

function updateStartLabel() {
  $('start').textContent = `Start ${START_BEHIND} blocks behind the head`;
  if (state === 'title' && chain && !chain.synthetic) setStatus(`Live from mainnet. Head is block #${fmt(chain.head)}.`);
}

// Run lifecycle

function spawn() {
  const rec = course.byNumber.get(chain.head - START_BEHIND)
    || course.records[Math.max(0, course.records.length - 1 - START_BEHIND)];
  const s = rec.slab;
  player.reset(s.cx, rec.topY, s.cz, Math.atan2(s.tx, s.tz));
  yaw = Math.atan2(-s.tx, -s.tz);
  pitch = 0.32;
  camTarget.set(s.cx, rec.topY + 1.3, s.cz);
  run.start = performance.now();
  run.time = 0;
  run.startBlock = rec.number;
  run.current = rec.number;
  run.touched.clear();
  run.lastTx = null;
  $('where').textContent = blockName(rec.block);
  $('where-detail').textContent = blockDetail(rec.block);
}

function startRun() {
  sfx.unlock();
  document.activeElement?.blur();
  spawn();
  player.group.visible = true;
  state = 'playing';
  $('title').hidden = true;
  $('pause').hidden = true;
  $('end').hidden = true;
  $('hud').hidden = false;
  $('touch').hidden = !isTouch;
  lockPointer();
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  const lt = $('last-tx');
  if (run.lastTx && !chain.synthetic) {
    lt.hidden = false;
    lt.innerHTML = '';
    const a = document.createElement('a');
    a.href = `https://etherscan.io/tx/${run.lastTx.hash}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = `See the last transaction you stood on (${short(run.lastTx.hash)}) on Etherscan`;
    lt.append(a);
  } else {
    lt.hidden = true;
  }
  $('pause-hint').hidden = true;
  $('pause').hidden = false;
  $('resume').focus();
}

function resume() {
  document.activeElement?.blur();
  $('pause').hidden = true;
  state = 'playing';
  lockPointer();
}

function toTitle() {
  state = 'title';
  player.group.visible = false;
  if (document.pointerLockElement) document.exitPointerLock();
  $('pause').hidden = true;
  $('end').hidden = true;
  $('hud').hidden = true;
  $('touch').hidden = true;
  $('title').hidden = false;
  updateStartLabel();
  focusTitle('start');
}

function endRun(won) {
  state = won ? 'won' : 'dead';
  if (document.pointerLockElement) document.exitPointerLock();
  const secs = run.time.toFixed(1);
  const tag = (n) => (chain.synthetic ? `S${fmt(n)}` : `#${fmt(n)}`);
  if (won) {
    sfx.win();
    player.cheer(60);
    $('end-h').textContent = 'You caught the head.';
    $('end-body').textContent = `Block ${tag(run.current)}, ${secs} seconds after starting on ${tag(run.startBlock)}. You stood on ${run.touched.size} transactions on the way up.`;
    setupSubmitArea();
  } else {
    sfx.lose();
    const behind = chain.head - run.current;
    $('end-h').textContent = 'Confirmed.';
    $('end-body').textContent = `Twelve confirmations reached you on block ${tag(run.current)}, ${behind} ${behind === 1 ? 'block' : 'blocks'} short of the head, after ${secs} seconds.`;
    $('submit-area').hidden = true;
  }
  $('touch').hidden = true;
  $('end').hidden = false;
  if (!$('name-form').hidden) $('name-input').focus();
  else $('again').focus();
}

function setupSubmitArea() {
  const area = $('submit-area'), btn = $('submit'), note = $('submit-note');
  area.hidden = false;
  btn.disabled = false;
  btn.hidden = true;
  $('name-form').hidden = true;
  if (!boardReady()) {
    $('name-form').hidden = false;
    $('name-save').disabled = false;
    $('name-input').disabled = false;
    $('name-input').value = lastName();
    note.textContent = `Your time, ${run.time.toFixed(1)} seconds, is saved with your name on the leaderboard in this browser.`;
    return;
  }
  if (chain.synthetic) {
    note.textContent = 'Runs on the synthetic chain can\'t go on the leaderboard: those blocks don\'t exist on mainnet.';
    return;
  }
  if (!wallet.available()) {
    note.textContent = 'Submitting needs a browser wallet (MetaMask, Rabby, Frame). You don\'t have one installed here.';
    return;
  }
  btn.hidden = false;
  btn.textContent = wallet.address ? `Put this run on the leaderboard as ${short(wallet.address)}` : 'Connect a wallet and put this run on the leaderboard';
  note.textContent = `This sends one transaction on ${BOARD.chainName}${BOARD.testnet ? ', a test network. Gas is paid in test ETH, which faucets give out free' : ''}. It has to land within 15 minutes of catching the head. The contract can't check that you really climbed; it records what your wallet claims.`;
}

async function submitToBoard() {
  const btn = $('submit'), note = $('submit-note');
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Waiting for your wallet…';
  try {
    if (!wallet.address) await connectWallet();
    const b = run.caught;
    const hash = await submitRun(wallet.address, {
      caughtBlock: b.number,
      caughtHash: b.hash,
      caughtAt: b.time,
      timeMs: Math.round(run.time * 1000),
      stones: Math.min(65535, run.touched.size),
    });
    btn.hidden = true;
    note.textContent = '';
    note.append('On the board. ');
    const a = document.createElement('a');
    a.href = `${BOARD.explorer}/tx/${hash}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'See the transaction';
    note.append(a);
    refreshBoard();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = prev;
    note.textContent = err && err.code === 4001
      ? 'You rejected the request in your wallet. Nothing was sent.'
      : (err && err.message) || 'Submitting failed.';
  }
}

function saveName(e) {
  e.preventDefault();
  const name = $('name-input').value.trim().replace(/\s+/g, ' ');
  if (!name) return;
  rememberName(name);
  const b = run.caught;
  const rank = saveLocal({
    name,
    timeMs: Math.round(run.time * 1000),
    block: b ? `${chain.synthetic ? 'S' : '#'}${fmt(b.number)}` : '',
    stones: run.touched.size,
    at: Date.now(),
  });
  $('name-input').disabled = true;
  $('name-save').disabled = true;
  $('submit-note').textContent = rank < 0
    ? 'This browser blocked saving, so the run wasn\'t recorded.'
    : `Saved. ${name} is number ${rank + 1} on the leaderboard.`;
  refreshBoard();
  $('again').focus();
}

// Leaderboard on the title sheet

function showLocalBoard() {
  const status = $('board-status'), table = $('board-table');
  $('board-refresh').hidden = true;
  $('board-who').textContent = 'Name';
  status.classList.remove('error');
  const rows = loadLocal().slice(0, 10);
  const body = $('board-rows');
  body.textContent = '';
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    [String(i + 1), r.name, `${(r.timeMs / 1000).toFixed(1)}s`, r.block].forEach((text) => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    });
    body.append(tr);
  });
  table.hidden = rows.length === 0;
  status.textContent = rows.length
    ? 'Fastest climbs saved in this browser.'
    : 'No runs yet. Catch the head and put your name first.';
}

let boardLoading = false;
async function refreshBoard() {
  const status = $('board-status'), table = $('board-table'), refresh = $('board-refresh');
  if (!boardReady()) {
    showLocalBoard();
    return;
  }
  if (boardLoading) return;
  boardLoading = true;
  refresh.hidden = false;
  refresh.disabled = true;
  status.textContent = `Reading the board from ${BOARD.chainName}…`;
  status.classList.remove('error');
  try {
    const { total, rows } = await loadBoard(10);
    const body = $('board-rows');
    body.textContent = '';
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (wallet.address && r.who === wallet.address) tr.className = 'me';
      const cells = [String(i + 1), short(r.who) + (tr.className ? ' (you)' : ''), `${(r.timeMs / 1000).toFixed(1)}s`, `#${fmt(Number(r.caughtBlock))}`];
      cells.forEach((text) => {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      });
      body.append(tr);
    });
    table.hidden = rows.length === 0;
    status.textContent = rows.length
      ? `${total} ${total === 1 ? 'wallet has' : 'wallets have'} a run on the board. Times are what each wallet claimed.`
      : 'No runs yet. Catch the head and yours is the first.';
  } catch (err) {
    table.hidden = true;
    const why = ((err && (err.shortMessage || err.message)) || 'network error').replace(/\.$/, '');
    status.textContent = `Couldn't read the board (${why}). Press Refresh to try again.`;
    status.classList.add('error');
  } finally {
    boardLoading = false;
    refresh.disabled = false;
  }
}

async function connectWallet() {
  const btn = $('connect');
  btn.disabled = true;
  btn.textContent = 'Waiting for your wallet…';
  try {
    const addr = await wallet.connect();
    course.setWallet(addr);
    btn.textContent = `Connected ${short(addr)}`;
    $('wallet-note').textContent = 'Transactions you send while playing show up as stones with gold edges (purple at night) when their block lands.';
    refreshBoard();
    return addr;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Connect wallet';
    $('wallet-note').textContent = err && err.code === 4001
      ? 'Connection rejected. The game works fine without a wallet.'
      : `Wallet connection failed: ${(err && err.message) || 'unknown error'}.`;
    throw err;
  }
}

// HUD

const KIND_NAMES = { transfer: 'ETH transfer', call: 'Contract call', spring: 'Contract deployment', blob: 'Blob transaction' };

function blockName(b) {
  return `Block ${b.synthetic ? 'S' : '#'}${fmt(b.number)}`;
}
function blockDetail(b) {
  const full = b.gasLimit ? Math.round((b.gasUsed / b.gasLimit) * 100) : 0;
  return `${b.txs.length} txs · ${full}% full · ${b.baseFee.toFixed(2)} gwei base fee`;
}
function ethText(eth) {
  if (eth === 0) return '';
  if (eth < 0.0001) return ', under 0.0001 ETH';
  return `, ${eth < 1 ? eth.toFixed(4) : fmt(Math.round(eth * 100) / 100)} ETH`;
}

function onLanded(box) {
  if (box.kind === 'slab') {
    $('where').textContent = blockName(box.rec.block);
    $('where-detail').textContent = blockDetail(box.rec.block);
  } else {
    const tx = box.tx_data;
    run.touched.add(tx.hash);
    run.lastTx = tx;
    $('where').textContent = KIND_NAMES[box.kind] + (box.kind === 'transfer' ? ethText(tx.eth) : '') + (box.mine ? ' (yours)' : '');
    $('where-detail').textContent = `${short(tx.hash)} from ${short(tx.from)} · in ${box.rec.block.synthetic ? 'S' : '#'}${fmt(box.rec.number)}`;
  }
}

let hudCache = {};
function setText(id, text) {
  if (hudCache[id] === text) return;
  hudCache[id] = text;
  $(id).textContent = text;
}

function updateHud() {
  const behind = Math.max(0, chain.head - run.current);
  setText('behind', String(behind));
  setText('behind-label', behind === 1 ? 'block behind the head' : 'blocks behind the head');
  const margin = run.current - (chain.head - CONFIRMATIONS);
  setText('line-info', margin <= 0 ? 'The line is at your block' : `Line: ${margin} ${margin === 1 ? 'block' : 'blocks'} below you`);
  $('line-info').classList.toggle('warn', margin <= 2);
  const t = run.time;
  setText('clock', `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`);
  setText('dash', player.dashReady ? 'Dash ready' : 'Dash spent');
  $('dash').classList.toggle('spent', !player.dashReady);
  const stalled = chain.stalled();
  setText('feed', chain.synthetic ? 'Synthetic chain' : stalled ? 'Feed stalled, retrying' : 'Live mainnet');
  $('feed').classList.toggle('warn', stalled);
}

let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// Input

const keys = new Set();
const edge = { jump: false, dash: false };
const touchState = { x: 0, y: 0, jump: false };

addEventListener('keydown', (e) => {
  const typing = e.target.closest?.('input, textarea');
  if (e.code === 'KeyM' && !typing) toggleMute();
  if (e.code === 'KeyN' && !typing) toggleTheme();
  if (state === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) { resume(); return; }
  if ((state === 'won' || state === 'dead') && e.code === 'Escape') { toTitle(); return; }
  if (state !== 'playing') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!e.repeat) {
    if (e.code === 'Space') edge.jump = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') edge.dash = true;
  }
  // P always pauses; Esc does too when the pointer isn't locked (with a lock,
  // the browser eats Esc and pointerlockchange pauses instead).
  if (e.code === 'KeyP' || (e.code === 'Escape' && !document.pointerLockElement)) {
    if (document.pointerLockElement) document.exitPointerLock();
    pause();
    return;
  }
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function readInput() {
  const k = (c) => (keys.has(c) ? 1 : 0);
  const input = {
    forward: k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown') + touchState.y,
    strafe: k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft') + touchState.x,
    jumpPressed: edge.jump,
    jumpHeld: keys.has('Space') || touchState.jump,
    dashPressed: edge.dash,
  };
  input.forward = Math.max(-1, Math.min(1, input.forward));
  input.strafe = Math.max(-1, Math.min(1, input.strafe));
  edge.jump = false;
  edge.dash = false;
  return input;
}

function lockPointer() {
  if (isTouch) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => { $('pause-hint').hidden = false; });
  } catch {
    $('pause-hint').hidden = false;
  }
}

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing') pause();
});

canvas.addEventListener('click', () => {
  if (state === 'playing' && !document.pointerLockElement) lockPointer();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2 && state === 'playing') edge.dash = true;
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * 0.0025;
  pitch = Math.max(-0.25, Math.min(1.2, pitch + e.movementY * 0.0022));
});

// Touch: left side is a stick, right side drags the camera.
(function touchControls() {
  const zone = $('stick-zone'), stick = $('stick'), knob = $('knob');
  let stickId = null, lookId = null, lx = 0, ly = 0;
  zone.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  const endStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    touchState.x = touchState.y = 0;
    knob.style.transform = '';
  };
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);
  function moveStick(e) {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2, d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchState.x = dx / max;
    touchState.y = -dy / max;
  }

  const look = $('look-zone');
  look.addEventListener('pointerdown', (e) => {
    lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
    look.setPointerCapture(e.pointerId);
  });
  look.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    yaw -= (e.clientX - lx) * 0.006;
    pitch = Math.max(-0.25, Math.min(1.2, pitch + (e.clientY - ly) * 0.005));
    lx = e.clientX; ly = e.clientY;
  });
  const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
  look.addEventListener('pointerup', endLook);
  look.addEventListener('pointercancel', endLook);

  const jump = $('t-jump');
  jump.addEventListener('pointerdown', (e) => { e.preventDefault(); edge.jump = true; touchState.jump = true; });
  const up = () => { touchState.jump = false; };
  jump.addEventListener('pointerup', up);
  jump.addEventListener('pointercancel', up);
  jump.addEventListener('pointerleave', up);
  $('t-dash').addEventListener('pointerdown', (e) => { e.preventDefault(); edge.dash = true; });
})();

function toggleMute() {
  const m = sfx.toggle();
  $('mute').querySelector('.lbl').textContent = m ? 'Sound off' : 'Sound on';
  $('mute').setAttribute('aria-pressed', String(m));
}

// Buttons
$('start').addEventListener('click', startRun);
$('connect').addEventListener('click', () => connectWallet().catch(() => {}));
$('retry').addEventListener('click', () => boot(false));
$('synthetic').addEventListener('click', () => boot(true));
$('resume').addEventListener('click', resume);
$('restart').addEventListener('click', startRun);
$('quit').addEventListener('click', toTitle);
$('again').addEventListener('click', startRun);
$('to-tower').addEventListener('click', toTitle);
$('pause-btn').addEventListener('click', pause);
$('mute').addEventListener('click', toggleMute);
$('theme').addEventListener('click', toggleTheme);
$('theme-load').addEventListener('click', toggleTheme);
$('name-form').addEventListener('submit', saveName);
$('theme-hud').addEventListener('click', toggleTheme);
$('submit').addEventListener('click', submitToBoard);
$('board-refresh').addEventListener('click', refreshBoard);

if (!wallet.available()) {
  $('connect').hidden = true;
  $('wallet-note').textContent = 'No browser wallet detected. You don\'t need one to play; it only lets you put finished runs on the leaderboard.';
}

// Loop

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 75 : 62;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const tmp = new THREE.Vector3();
let last = performance.now();

function updateCamera(dt, t) {
  const inRun = state === 'playing' || state === 'paused' || state === 'won' || state === 'dead';
  const k = 1 - Math.exp(-dt * (inRun ? 12 : 2));
  if (inRun) {
    tmp.set(player.pos.x, player.pos.y + 1.3, player.pos.z);
    camTarget.lerp(tmp, k);
    let dist = 7.5;
    const ox = Math.sin(yaw) * Math.cos(pitch), oy = Math.sin(pitch), oz = Math.cos(yaw) * Math.cos(pitch);
    // Pull the camera in when the central column would block the view.
    const a = ox * ox + oz * oz, b = 2 * (camTarget.x * ox + camTarget.z * oz);
    const c = camTarget.x ** 2 + camTarget.z ** 2 - (CORE_R + 0.5) ** 2;
    const disc = b * b - 4 * a * c;
    if (a > 1e-6 && disc > 0) {
      const s = (-b - Math.sqrt(disc)) / (2 * a);
      if (s > 0 && s < dist) dist = Math.max(2, s - 0.4);
    }
    camera.position.set(camTarget.x + ox * dist, camTarget.y + oy * dist, camTarget.z + oz * dist);
    camera.lookAt(camTarget);
  } else {
    const top = course.headRec ? course.headRec.topY : 0;
    tmp.set(0, top - 5, 0);
    camTarget.lerp(tmp, k);
    const ang = reducedMotion ? 0.9 : t * 0.05;
    const r = innerWidth < 640 ? 34 : 28;
    camera.position.set(Math.cos(ang) * r + (innerWidth < 640 ? 0 : -8), camTarget.y + 3, Math.sin(ang) * r);
    camera.lookAt(camTarget.x + (innerWidth < 640 ? 0 : -6), camTarget.y + (innerWidth < 640 ? -6 : 0), camTarget.z);
  }
}

function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  course.update(t);
  floorY += (floorTarget - floorY) * Math.min(1, dt * 1.2);
  inkSea.position.y = floorY;

  if (state === 'playing') {
    run.time = (now - run.start) / 1000;
    player.update(dt, readInput(), yaw, course);
    if (player.landedOn) onLanded(player.landedOn);
    if (player.ground) run.current = player.ground.rec.number;
    if (player.ground && player.ground.kind === 'slab' && player.ground.rec.number >= chain.head) {
      run.caught = player.ground.rec.block;
      endRun(true);
    }
    else if (player.pos.y < floorY) endRun(false);
    if (state === 'playing') updateHud();
  } else {
    edge.jump = edge.dash = false;
  }

  updateCamera(dt, t);
  course.removeBelow(floorY - 30);

  const focus = state === 'title' || state === 'loading' || state === 'error' ? camTarget : player.pos;
  sun.position.set(focus.x + 6, focus.y + 24, focus.z + 4);
  sun.target.position.copy(focus);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Canvas labels need the serif loaded before the first slab is drawn.
refreshBoard();

showLoading('Carving the block numbers…');
Promise.all([document.fonts.load('700 92px Inter'), document.fonts.load('500 34px Inter')])
  .catch(() => {})
  .finally(() => boot(false));
