import * as THREE from 'three';
import { CORE_R, PALETTE } from './course.js';

const R = 0.35;          // body radius
const H = 1.7;           // body height
const RUN = 7.2;
const JUMP_V = 9.2;
const SPRING_V = 15.5;
const DASH_V = 15;
const G_UP = 26;
const G_DOWN = 36;

function toLocal(b, x, z) {
  const dx = x - b.cx, dz = z - b.cz;
  return [dx * b.tx + dz * b.tz, dx * b.rx + dz * b.rz];
}

export class Player {
  constructor(scene, sfx) {
    this.sfx = sfx;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.grounded = false;
    this.ground = null;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.jumping = false;
    this.launched = false;
    this.dashReady = true;
    this.dashT = 0;
    this.facing = 0;
    this.squash = 1;
    this.squashV = 0;

    this.scene = scene;
    this.fx = [];

    // Jelly shader hooks: uLag bends the top of the slime against its
    // acceleration, uJig ripples the surface after a landing.
    this.uni = {
      uLag: { value: new THREE.Vector3() },
      uJig: { value: 0.2 },
      uT: { value: 0 },
      uH: { value: SLIME_H },
    };
    const slime = new THREE.MeshPhysicalMaterial({
      color: PALETTE.slime,
      emissive: PALETTE.slimeGlow,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.9,
    });
    slime.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uni);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uLag; uniform float uJig, uT, uH;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float lw = clamp(position.y / uH, 0.0, 1.0);
          transformed.xz *= 1.0 + sin(uT * 14.0 - position.y * 16.0) * 0.06 * uJig * lw;
          transformed.xz += uLag.xz * lw * lw;
          transformed.y += uLag.y * lw;`);
    };
    this.mats = {
      slime,
      drop: new THREE.MeshStandardMaterial({ color: PALETTE.slime, emissive: PALETTE.slimeGlow, roughness: 0.2 }),
      eye: new THREE.MeshStandardMaterial({ color: PALETTE.slimeEye, roughness: 0.25 }),
      cheek: new THREE.MeshStandardMaterial({ color: PALETTE.slimeCheek, roughness: 0.9, transparent: true, opacity: 0.8 }),
      shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      gloss: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    };
    const m = this.mats;
    const ball = (r, material, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      return mesh;
    };

    // A small gumdrop of jelly, face on +z. The physics hitbox is unchanged;
    // this is only what you see.
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.hop = new THREE.Group();
    this.body.add(this.hop);
    this.slimeGeo = slimeGeometry();
    this.jelly = new THREE.Mesh(this.slimeGeo, slime);
    this.jelly.castShadow = true;
    this.hop.add(this.jelly);

    this.face = new THREE.Group();
    const gloss = ball(0.07, m.gloss, -0.17, 0.46, 0.24, 1.3, 0.7, 0.5);
    gloss.rotation.z = 0.6;
    this.face.add(gloss);
    this.eyes = [];
    this.happyEyes = [];
    const arc = new THREE.TorusGeometry(0.045, 0.014, 8, 16, Math.PI);
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.13, 0.3, 0.415);
      eye.rotation.y = side * 0.3;
      eye.add(
        ball(0.06, m.eye, 0, 0, 0, 0.8, 1.3, 0.45),
        ball(0.022, m.shine, side * -0.018, 0.03, 0.025),
      );
      this.face.add(eye);
      this.eyes.push(eye);
      const happy = new THREE.Mesh(arc, m.eye);
      happy.position.set(side * 0.13, 0.29, 0.435);
      happy.rotation.y = side * 0.3;
      happy.visible = false;
      this.face.add(happy);
      this.happyEyes.push(happy);
      this.face.add(ball(0.05, m.cheek, side * 0.25, 0.22, 0.395, 1.3, 0.7, 0.4));
    }
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 16, Math.PI), m.eye);
    this.smile.position.set(0, 0.22, 0.47);
    this.smile.rotation.z = Math.PI;
    this.gasp = new THREE.Mesh(new THREE.CircleGeometry(0.028, 16), m.eye);
    this.gasp.position.set(0, 0.21, 0.475);
    this.gasp.visible = false;
    this.face.add(this.smile, this.gasp);
    this.hop.add(this.face);

    this.group.add(this.body);
    scene.add(this.group);

    this.anim = {
      t: 0, run: 0, phase: 0, blink: 2.5, blinkT: 0, happy: 0,
      lag: new THREE.Vector3(), lagV: new THREE.Vector3(), prevVel: new THREE.Vector3(),
      jig: 0.2, ghostT: 0,
    };
  }

  applyTheme() {
    const m = this.mats;
    m.slime.color.set(PALETTE.slime);
    m.slime.emissive.set(PALETTE.slimeGlow);
    m.drop.color.set(PALETTE.slime);
    m.drop.emissive.set(PALETTE.slimeGlow);
    m.eye.color.set(PALETTE.slimeEye);
    m.cheek.color.set(PALETTE.slimeCheek);
  }

  // Plays the ^ ^ face for a moment.
  cheer(seconds = 0.6) {
    this.anim.happy = Math.max(this.anim.happy, seconds);
  }

  reset(x, y, z, facing) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.grounded = false;
    this.ground = null;
    this.dashReady = true;
    this.dashT = 0;
    this.facing = facing;
    this.launched = false;
    this.anim.happy = 0;
    this.anim.lag.set(0, 0, 0);
    this.anim.lagV.set(0, 0, 0);
    for (const f of this.fx) this.dropFx(f);
    this.fx = [];
    this.sync(0);
  }

  update(dt, input, camYaw, course) {
    // Ride sliding stones.
    if (this.grounded && this.ground && this.ground.slide) {
      this.pos.x += this.ground.dx;
      this.pos.z += this.ground.dz;
    }

    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = fx * input.forward + rx * input.strafe;
    let wz = fz * input.forward + rz * input.strafe;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }

    if (this.dashT > 0) {
      this.dashT -= dt;
    } else {
      const moving = wl > 0.05;
      const accel = this.grounded ? (moving ? 60 : 50) : (moving ? 30 : 14);
      const dvx = wx * RUN - this.vel.x, dvz = wz * RUN - this.vel.z;
      const dl = Math.hypot(dvx, dvz), max = accel * dt;
      const k = dl > max ? max / dl : 1;
      this.vel.x += dvx * k;
      this.vel.z += dvz * k;
    }

    this.coyote = this.grounded ? 0.1 : this.coyote - dt;
    this.jumpBuf = input.jumpPressed ? 0.13 : this.jumpBuf - dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vel.y = JUMP_V;
      this.jumpBuf = 0;
      this.coyote = 0;
      this.grounded = false;
      this.jumping = true;
      this.squashV = 8;
      this.anim.jig = 0.6;
      this.sfx.jump();
    }
    // Let go of jump early for a short hop.
    if (this.jumping && !input.jumpHeld && this.vel.y > 3.5) {
      this.vel.y = 3.5;
      this.jumping = false;
    }

    if (input.dashPressed && this.dashReady && this.dashT <= 0) {
      let dx = wx, dz = wz;
      if (wl < 0.05) { dx = Math.sin(this.facing); dz = Math.cos(this.facing); }
      const n = Math.hypot(dx, dz) || 1;
      this.vel.x = (dx / n) * DASH_V;
      this.vel.z = (dz / n) * DASH_V;
      this.vel.y = Math.max(this.vel.y, 2);
      this.dashT = 0.2;
      this.dashReady = false;
      this.jumping = false;
      this.cheer(0.3);
      this.burst(8, 0.35);
      this.sfx.dash();
    }

    const g = this.dashT > 0 ? G_UP * 0.3 : this.vel.y > 0 ? G_UP : G_DOWN;
    this.vel.y = Math.max(-40, this.vel.y - g * dt);

    const fallSpeed = -this.vel.y;
    const steps = Math.max(1, Math.ceil((Math.hypot(this.vel.x, this.vel.z) + Math.abs(this.vel.y)) * dt / 0.2));
    let landed = null;
    for (let i = 0; i < steps; i++) {
      landed = this.collide(course, dt / steps) || landed;
    }

    const wasGrounded = this.grounded;
    this.grounded = !!landed;
    this.ground = landed;
    this.landedOn = null;
    if (landed) {
      if (!this.dashReady && this.dashT <= 0) this.dashReady = true;
      this.jumping = false;
      this.launched = false;
      if (!wasGrounded) {
        this.landedOn = landed;
        this.squashV = -Math.min(11, fallSpeed * 0.5);
        this.anim.jig = Math.min(1, 0.3 + fallSpeed / 20);
        if (fallSpeed > 9) this.burst(Math.min(10, Math.round(fallSpeed / 2.5)), 0);
        if (fallSpeed > 12) this.cheer(0.45);
        if (landed.kind !== 'spring') this.sfx.land(Math.min(1, fallSpeed / 25));
      }
      if (landed.kind === 'spring') {
        this.vel.y = SPRING_V;
        this.grounded = false;
        this.launched = true;
        this.dashReady = true;
        this.squashV = 10;
        this.anim.jig = 1;
        this.cheer(0.9);
        this.sfx.spring();
      }
    }

    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.5) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 14);
    }
    this.sync(dt);
  }

  collide(course, dt) {
    const p = this.pos, v = this.vel;
    let landed = null;

    const prevY = p.y;
    p.y += v.y * dt;
    for (const b of course.boxes) {
      if (Math.abs(b.cy - p.y) > 5) continue;
      const top = b.cy + b.hh, bot = b.cy - b.hh;
      const [lx, lz] = toLocal(b, p.x, p.z);
      const qx = Math.max(-b.hw, Math.min(b.hw, lx)), qz = Math.max(-b.hd, Math.min(b.hd, lz));
      if (Math.hypot(lx - qx, lz - qz) >= R * 0.6) continue;
      if (v.y <= 0 && prevY >= top - 0.05 && p.y < top) {
        p.y = top; v.y = 0; landed = b;
      } else if (v.y > 0 && prevY + H <= bot + 0.05 && p.y + H > bot) {
        p.y = bot - H; v.y = 0; this.jumping = false;
      }
    }

    p.x += v.x * dt;
    p.z += v.z * dt;
    for (const b of course.boxes) {
      const top = b.cy + b.hh, bot = b.cy - b.hh;
      if (!(p.y < top - 0.001 && p.y + H > bot)) continue;
      const [lx, lz] = toLocal(b, p.x, p.z);
      const qx = Math.max(-b.hw, Math.min(b.hw, lx)), qz = Math.max(-b.hd, Math.min(b.hd, lz));
      let ex = lx - qx, ez = lz - qz;
      const d = Math.hypot(ex, ez);
      if (d >= R) continue;
      // Low ledge: step onto it instead of stopping dead.
      if (top - p.y <= 0.4 && v.y <= 0.5) {
        p.y = top; v.y = 0; landed = b;
        continue;
      }
      let px, pz;
      if (d > 1e-5) {
        px = (ex / d) * (R - d); pz = (ez / d) * (R - d);
      } else {
        const ox = b.hw - Math.abs(lx), oz = b.hd - Math.abs(lz);
        if (ox < oz) { px = Math.sign(lx || 1) * (ox + R); pz = 0; }
        else { px = 0; pz = Math.sign(lz || 1) * (oz + R); }
      }
      const wxp = b.tx * px + b.rx * pz, wzp = b.tz * px + b.rz * pz;
      p.x += wxp; p.z += wzp;
      const n = Math.hypot(wxp, wzp) || 1;
      const vn = (v.x * wxp + v.z * wzp) / n;
      if (vn < 0) { v.x -= (wxp / n) * vn; v.z -= (wzp / n) * vn; }
    }

    const cd = Math.hypot(p.x, p.z);
    if (cd < CORE_R + R) {
      const k = (CORE_R + R) / (cd || 1);
      p.x *= k; p.z *= k;
    }
    return landed;
  }

  sync(dt) {
    // Jelly squash and stretch: a loosely damped spring, so it wobbles a
    // couple of times after every jump and landing.
    this.squashV += (1 - this.squash) * 230 * dt - this.squashV * 7 * dt;
    this.squash += this.squashV * dt;
    this.squash = Math.max(0.5, Math.min(1.6, this.squash));
    const air = !this.grounded;
    const vy = air ? Math.min(0.18, Math.abs(this.vel.y) * 0.012) : 0;
    const dash = this.dashT > 0 ? 1 : 0;
    const sy = this.squash * (1 + vy) * (1 - dash * 0.25);
    const sxz = 1 / Math.sqrt(this.squash * (1 + vy));
    this.body.scale.set(sxz * (1 - dash * 0.15), sy, sxz * (1 + dash * 0.55));
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
    this.animate(dt);
  }

  animate(dt) {
    const a = this.anim;
    a.t += dt;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    a.run += ((this.grounded ? Math.min(1, speed / 6) : 0) - a.run) * Math.min(1, dt * 10);

    // Slimes hop to get around: bounce and squish in time with the stride.
    a.phase += dt * (5 + speed * 1.6);
    const hop = Math.abs(Math.sin(a.phase));
    this.hop.position.y = hop * 0.14 * a.run;
    const hs = 1 + (hop - 0.5) * 0.16 * a.run + Math.sin(a.t * 3) * 0.02;
    this.hop.scale.set(1 / Math.sqrt(hs), hs, 1 / Math.sqrt(hs));

    // The top of the jelly lags behind changes in speed (in local space).
    if (dt > 0) {
      const ax = (this.vel.x - a.prevVel.x) / dt, az = (this.vel.z - a.prevVel.z) / dt;
      const ay = (this.vel.y - a.prevVel.y) / dt;
      const f = this.facing, fx = Math.sin(f), fz = Math.cos(f);
      const fwd = ax * fx + az * fz, side = ax * fz - az * fx;
      const clamp = (v, k) => Math.max(-k, Math.min(k, v));
      const tx = clamp(-side * 0.006, 0.22), tz = clamp(-fwd * 0.006, 0.22), ty = clamp(-ay * 0.002, 0.08);
      a.lagV.x += ((tx - a.lag.x) * 160 - a.lagV.x * 9) * dt;
      a.lagV.z += ((tz - a.lag.z) * 160 - a.lagV.z * 9) * dt;
      a.lagV.y += ((ty - a.lag.y) * 160 - a.lagV.y * 9) * dt;
      a.lag.addScaledVector(a.lagV, dt);
    }
    a.prevVel.copy(this.vel);
    this.uni.uLag.value.copy(a.lag);
    this.face.position.set(a.lag.x * 0.18, a.lag.y * 0.4, a.lag.z * 0.18);

    a.jig += (0.12 - a.jig) * Math.min(1, dt * 2.5);
    this.uni.uJig.value = a.jig;
    this.uni.uT.value = a.t;

    // Face: blinks every few seconds, ^ ^ when happy, a little "o" when falling fast.
    a.happy = Math.max(0, a.happy - dt);
    a.blink -= dt;
    if (a.blink <= 0) { a.blinkT = 0.13; a.blink = 2 + Math.random() * 3.5; }
    a.blinkT = Math.max(0, a.blinkT - dt);
    const happy = a.happy > 0;
    const falling = !this.grounded && this.vel.y < -14;
    const open = a.blinkT > 0 ? 0.1 : falling ? 1.25 : 1;
    this.eyes.forEach((e, i) => {
      e.visible = !happy;
      e.scale.set(falling ? 1.1 : 1, open, 1);
      this.happyEyes[i].visible = happy;
    });
    this.smile.visible = !falling;
    this.gasp.visible = falling;
    this.smile.scale.setScalar(happy ? 1.4 : 1);

    // Dash afterimages: jelly-colored ghosts left along the path.
    if (this.dashT > 0) {
      a.ghostT -= dt;
      if (a.ghostT <= 0) { a.ghostT = 0.03; this.ghost(); }
    } else {
      a.ghostT = 0;
    }
    this.updateFx(dt);
  }

  ghost() {
    const mat = new THREE.MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.45, depthWrite: false });
    const mesh = new THREE.Mesh(this.slimeGeo, mat);
    mesh.position.copy(this.group.position);
    mesh.rotation.y = this.facing;
    mesh.scale.copy(this.body.scale);
    this.scene.add(mesh);
    this.fx.push({ mesh, kind: 'ghost', life: 0.28, max: 0.28 });
  }

  // Little jelly droplets. up > 0 throws them backwards (dash); 0 splats
  // them outwards (landing).
  burst(n, up) {
    const back = -this.facing;
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(dropGeometry(), this.mats.drop);
      const ang = up ? back + Math.PI + (Math.random() - 0.5) * 1.4 : (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = up ? 2.5 + Math.random() * 2 : 2 + Math.random() * 2.5;
      mesh.position.set(this.pos.x, this.pos.y + 0.15 + (up ? 0.2 : 0), this.pos.z);
      mesh.scale.setScalar(0.6 + Math.random() * 0.7);
      this.scene.add(mesh);
      this.fx.push({
        mesh, kind: 'drop', life: 0.5, max: 0.5, s: mesh.scale.x,
        vel: new THREE.Vector3(Math.sin(ang) * sp, 2.5 + Math.random() * 2.5, Math.cos(ang) * sp),
      });
    }
  }

  updateFx(dt) {
    for (const f of this.fx) {
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      if (f.kind === 'ghost') {
        f.mesh.material.opacity = 0.45 * k;
        f.mesh.scale.multiplyScalar(1 + dt * 0.6);
      } else {
        f.vel.y -= 22 * dt;
        f.mesh.position.addScaledVector(f.vel, dt);
        f.mesh.scale.setScalar(f.s * k);
      }
    }
    const alive = [];
    for (const f of this.fx) {
      if (f.life > 0) alive.push(f);
      else this.dropFx(f);
    }
    this.fx = alive;
  }

  dropFx(f) {
    this.scene.remove(f.mesh);
    if (f.kind === 'ghost') f.mesh.material.dispose();
  }
}

const SLIME_H = 0.74;

// A gumdrop: wide soft base, rounded shoulders, a little peak on top.
function slimeGeometry() {
  const pts = [
    [0, 0], [0.34, 0.005], [0.45, 0.07], [0.47, 0.18], [0.43, 0.32],
    [0.33, 0.46], [0.2, 0.57], [0.09, 0.65], [0.03, 0.71], [0, SLIME_H],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const curve = new THREE.SplineCurve(pts).getPoints(40);
  curve[0].x = 0;
  curve[curve.length - 1].x = 0;
  const g = new THREE.LatheGeometry(curve, 48);
  // The lathe seam sits at +z; turn it to the back, away from the face.
  g.rotateY(Math.PI);
  return g;
}

let dropGeo = null;
function dropGeometry() {
  return (dropGeo ||= new THREE.SphereGeometry(0.06, 10, 8));
}
