import * as THREE from 'three';

export const PALETTE = {
  bone: 0xe8e3d8,
  stone: 0xd9d3c6,
  call: 0xa9a295,
  blob: 0x857e72,
  ink: 0x1b1a17,
  accent: 0xe4521b,
};

export const CORE_R = 3.2;
const RING_R = 8.4;
const SLAB_W = 4.4;
const SLAB_D = 3.4;
const SLAB_H = 0.7;
const STONE_H = 0.45;

const lerp = (a, b, t) => a + (b - a) * t;

function byteAt(hash, i) {
  return parseInt(hash.slice(2 + i * 2, 4 + i * 2), 16) || 0;
}

function kindOf(tx) {
  if (tx.to === null) return 'spring';
  if (tx.type === 3) return 'blob';
  return tx.call ? 'call' : 'transfer';
}

// Picks which transactions become stones. Roughly sqrt(n)/2 of them, evenly
// through the block, but deployments, blobs and the player's own txs always
// make the cut because they are the interesting ones.
function pickTxs(block, wallet) {
  const n = block.txs.length;
  if (!n) return [];
  const k = Math.max(2, Math.min(7, Math.round(Math.sqrt(n) / 2)));
  const picks = [];
  for (let i = 0; i < k; i++) picks.push(Math.floor(((i + 0.5) * n) / k));

  const special = [];
  const firstCreate = block.txs.findIndex((t) => t.to === null);
  const firstBlob = block.txs.findIndex((t) => t.type === 3);
  if (firstCreate >= 0) special.push(firstCreate);
  if (firstBlob >= 0) special.push(firstBlob);
  if (wallet) {
    block.txs.forEach((t, i) => { if (t.from === wallet && special.length < k) special.push(i); });
  }
  // Swap each special tx in for the nearest regular pick.
  for (const s of special) {
    if (picks.includes(s)) continue;
    let best = -1;
    picks.forEach((p, i) => {
      if (special.includes(p)) return;
      if (best < 0 || Math.abs(p - s) < Math.abs(picks[best] - s)) best = i;
    });
    if (best >= 0) picks[best] = s;
  }
  return [...new Set(picks)].sort((a, b) => a - b).map((i) => block.txs[i]);
}

function labelTexture(block) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#e1dbcf';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#1b1a17';
  g.textBaseline = 'alphabetic';
  const prefix = block.synthetic ? 'S' : '#';
  const label = prefix + block.number.toLocaleString('en-US');
  let size = 96;
  do {
    g.font = `700 ${size}px Inter, system-ui, sans-serif`;
    size -= 4;
  } while (g.measureText(label).width > 456 && size > 40);
  g.fillText(label, 28, 170);
  g.fillRect(28, 206, 456, 3);
  g.font = '500 34px Inter, system-ui, sans-serif';
  const full = block.gasLimit ? Math.round((block.gasUsed / block.gasLimit) * 100) : 0;
  g.fillText(`${block.txs.length} txs`, 28, 262);
  g.fillText(`${full}% full`, 28, 312);
  g.fillText(`${block.baseFee.toFixed(2)} gwei`, 260, 262);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class Course {
  constructor(scene) {
    this.scene = scene;
    this.records = [];
    this.byNumber = new Map();
    this.boxes = [];
    this.theta = 0;
    this.y = 0;
    this.prevHalf = SLAB_W / 2;
    this.wallet = null;
    this.headRec = null;

    const mat = (color, rough = 0.92) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    this.mats = {
      transfer: mat(PALETTE.stone),
      call: mat(PALETTE.call),
      blob: mat(PALETTE.blob),
      springBase: mat(PALETTE.ink, 0.6),
      springTop: mat(PALETTE.accent, 0.7),
      slabSide: mat(0xcfc8bb),
      accent: mat(PALETTE.accent, 0.7),
      core: mat(0xdcd6ca, 1),
    };
    this.lineMat = new THREE.LineBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.55 });
    this.mineLineMat = new THREE.LineBasicMaterial({ color: PALETTE.accent });
    this.ringMat = new THREE.LineBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.7 });

    const ringPts = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * (CORE_R + 0.01), 0, Math.sin(a) * (CORE_R + 0.01)));
    }
    this.ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);

    // The goal marker: a thin orange line standing up from the newest block.
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 120, 8),
      new THREE.MeshBasicMaterial({ color: PALETTE.accent, fog: false }),
    );
    this.beacon.visible = false;
    scene.add(this.beacon);
  }

  makeBox(rec, { theta, radius, topY, w, h, d, kind, tx, mats }) {
    const tx_ = -Math.sin(theta), tz = Math.cos(theta);
    const cx = Math.cos(theta) * radius, cz = Math.sin(theta) * radius;
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.position.set(cx, topY - h / 2, cz);
    mesh.rotation.y = -theta - Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mine = tx && this.wallet && tx.from === this.wallet;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), mine ? this.mineLineMat : this.lineMat);
    mesh.add(edges);
    this.scene.add(mesh);
    rec.objects.push(mesh);

    const box = {
      cx, cy: topY - h / 2, cz, hw: w / 2, hh: h / 2, hd: d / 2,
      tx: tx_, tz, rx: Math.cos(theta), rz: Math.sin(theta),
      kind, tx_data: tx, rec, mesh, mine,
      baseX: cx, baseZ: cz, dx: 0, dz: 0, slide: 0, phase: 0,
    };
    rec.boxes.push(box);
    this.boxes.push(box);
    return box;
  }

  addBlock(block) {
    const rec = { number: block.number, block, objects: [], boxes: [], textures: [], slab: null, topY: 0 };
    const full = block.gasLimit ? block.gasUsed / block.gasLimit : 0.5;
    const yStart = this.y;
    let springBoost = 0;

    for (const tx of pickTxs(block, this.wallet)) {
      const kind = kindOf(tx);
      let w = 1.3, d = 1.4;
      if (kind === 'transfer') { w = 1.3 + Math.min(1.4, Math.log10(1 + tx.eth * 20) * 0.55); d = 1.8; }
      if (kind === 'spring') { w = 1.5; d = 1.5; }
      if (kind === 'blob') { w = 1.4; d = 1.4; }
      const slide = kind === 'blob' ? 1.1 : 0;
      // Full blocks pack stones tight, quiet blocks stretch the gaps.
      const gap = lerp(1.0, 2.5, 1 - full) + (byteAt(tx.hash, 0) / 255 - 0.5) * 0.8;
      const rise = (kind === 'spring' ? 0.2 : 0.35 + (byteAt(tx.hash, 1) / 255) * 0.7) + springBoost;
      springBoost = kind === 'spring' ? 2.6 : 0;
      const radius = RING_R + (byteAt(tx.hash, 2) / 255 - 0.5) * 2.4;

      this.theta += (this.prevHalf + gap + w / 2 + slide) / radius;
      this.y += rise;
      this.prevHalf = w / 2 + slide;

      let mats = this.mats[kind];
      if (kind === 'spring') {
        const m = this.mats.springBase, t = this.mats.springTop;
        mats = [m, m, t, m, m, m];
      }
      const box = this.makeBox(rec, { theta: this.theta, radius, topY: this.y, w, h: STONE_H, d, kind, tx, mats });
      if (slide) {
        box.slide = slide;
        box.phase = (byteAt(tx.hash, 3) / 255) * Math.PI * 2;
      }
    }

    // The block itself: a wide landing with its number on top.
    const gap = block.txs.length ? 1.6 : lerp(2.0, 2.6, byteAt(block.hash, 0) / 255);
    this.theta += (this.prevHalf + gap + SLAB_W / 2) / RING_R;
    this.y += 0.6 + springBoost;
    this.prevHalf = SLAB_W / 2;
    const tex = labelTexture(block);
    rec.textures.push(tex);
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    rec.topMat = top;
    const side = this.mats.slabSide;
    rec.slab = this.makeBox(rec, {
      theta: this.theta, radius: RING_R, topY: this.y, w: SLAB_W, h: SLAB_H, d: SLAB_D,
      kind: 'slab', tx: null, mats: [side, side, top, side, side, side],
    });
    rec.topY = this.y;

    // One stretch of the central column per block, with a ruled line at its top.
    const segH = Math.max(0.2, this.y - yStart);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(CORE_R, CORE_R, segH, 48, 1, true), this.mats.core);
    core.position.y = yStart + segH / 2;
    core.receiveShadow = true;
    const ring = new THREE.LineLoop(this.ringGeo, this.ringMat);
    ring.position.y = segH / 2;
    core.add(ring);
    this.scene.add(core);
    rec.objects.push(core);

    this.records.push(rec);
    this.byNumber.set(block.number, rec);
    this.markHead(rec);
    return rec;
  }

  markHead(rec) {
    if (this.headRec) {
      const s = this.mats.slabSide;
      this.headRec.slab.mesh.material = [s, s, this.headRec.topMat, s, s, s];
    }
    const a = this.mats.accent;
    rec.slab.mesh.material = [a, a, rec.topMat, a, a, a];
    this.headRec = rec;
    this.beacon.visible = true;
    this.beacon.position.set(rec.slab.cx, rec.topY + 60.2, rec.slab.cz);
  }

  setWallet(addr) {
    this.wallet = addr;
    for (const b of this.boxes) {
      const mine = !!(addr && b.tx_data && b.tx_data.from === addr);
      b.mine = mine;
      b.mesh.children[0].material = mine ? this.mineLineMat : this.lineMat;
    }
  }

  clear() {
    this.removeBelow(Infinity, 0);
    this.theta = 0;
    this.y = 0;
    this.prevHalf = SLAB_W / 2;
    this.headRec = null;
    this.beacon.visible = false;
  }

  removeBelow(y, keep = 1) {
    while (this.records.length > keep && this.records[0].topY < y) {
      const rec = this.records.shift();
      this.byNumber.delete(rec.number);
      for (const obj of rec.objects) {
        this.scene.remove(obj);
        obj.geometry.dispose();
        obj.children.forEach((c) => { if (c.geometry !== this.ringGeo) c.geometry.dispose(); });
      }
      rec.textures.forEach((t) => t.dispose());
      rec.topMat.dispose();
      const gone = new Set(rec.boxes);
      this.boxes = this.boxes.filter((b) => !gone.has(b));
    }
  }

  // Moves blob stones and records how far each moved this frame, so the
  // player can ride them.
  update(time) {
    for (const b of this.boxes) {
      if (!b.slide) continue;
      const off = Math.sin(time * 1.3 + b.phase) * b.slide;
      const nx = b.baseX + b.tx * off, nz = b.baseZ + b.tz * off;
      b.dx = nx - b.cx; b.dz = nz - b.cz;
      b.cx = nx; b.cz = nz;
      b.mesh.position.x = nx; b.mesh.position.z = nz;
    }
  }

  lowestY() {
    return this.records.length ? this.records[0].topY : 0;
  }
}
