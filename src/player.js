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

    const ink = new THREE.MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.55 });
    const bone = new THREE.MeshStandardMaterial({ color: PALETTE.bone, roughness: 0.8 });
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(R, H - 2 * R, 6, 16), ink);
    capsule.position.y = H / 2;
    capsule.castShadow = true;
    // A pale visor so you can read which way the runner faces.
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.12), bone);
    visor.position.set(0, H - 0.42, R - 0.02);
    this.body.add(capsule, visor);
    this.group.add(this.body);
    scene.add(this.group);
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
      this.squashV = 5;
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
        this.squashV = -Math.min(8, fallSpeed * 0.35);
        if (landed.kind !== 'spring') this.sfx.land(Math.min(1, fallSpeed / 25));
      }
      if (landed.kind === 'spring') {
        this.vel.y = SPRING_V;
        this.grounded = false;
        this.launched = true;
        this.dashReady = true;
        this.squashV = 7;
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
    // Squash on landing, stretch on take-off, so every contact reads clearly.
    this.squashV += (1 - this.squash) * 180 * dt - this.squashV * 14 * dt;
    this.squash += this.squashV * dt;
    this.squash = Math.max(0.6, Math.min(1.4, this.squash));
    this.body.scale.set(1 / Math.sqrt(this.squash), this.squash, 1 / Math.sqrt(this.squash));
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
  }
}
