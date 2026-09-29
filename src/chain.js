// Block feed. LiveChain reads Ethereum mainnet over public JSON-RPC,
// SyntheticChain fakes the same shape when no endpoint answers.

const RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
  'https://1rpc.io/eth',
];

const hexToNum = (h) => parseInt(h, 16);

let preferred = 0;

async function rpc(method, params) {
  let lastErr;
  for (let i = 0; i < RPCS.length; i++) {
    const idx = (preferred + i) % RPCS.length;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(RPCS[idx], {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || 'RPC error');
      preferred = idx;
      return json.result;
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export function normalizeBlock(raw) {
  return {
    number: hexToNum(raw.number),
    hash: raw.hash,
    time: hexToNum(raw.timestamp),
    gasUsed: hexToNum(raw.gasUsed),
    gasLimit: hexToNum(raw.gasLimit),
    baseFee: raw.baseFeePerGas ? hexToNum(raw.baseFeePerGas) / 1e9 : 0,
    synthetic: false,
    txs: (raw.transactions || []).map((t) => ({
      hash: t.hash,
      from: (t.from || '').toLowerCase(),
      to: t.to ? t.to.toLowerCase() : null,
      eth: Number(BigInt(t.value || '0x0')) / 1e18,
      type: hexToNum(t.type || '0x0'),
      call: !!t.input && t.input !== '0x',
    })),
  };
}

class Emitter {
  constructor() { this.handlers = {}; }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, data) { (this.handlers[ev] || []).forEach((fn) => fn(data)); }
}

export class LiveChain extends Emitter {
  constructor() {
    super();
    this.head = 0;
    this.synthetic = false;
    this.lastHeard = 0;
    this.busy = false;
  }

  async fetchBlock(n) {
    const raw = await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), true]);
    if (!raw) throw new Error(`block ${n} not served yet`);
    return normalizeBlock(raw);
  }

  async start(count, onProgress) {
    const head = hexToNum(await rpc('eth_blockNumber', []));
    const numbers = [];
    for (let n = head - count + 1; n <= head; n++) numbers.push(n);

    // Emit in order as soon as each block's lower neighbours are in, so the
    // tower visibly grows while the rest download.
    this.head = head;
    const out = new Map();
    let done = 0;
    let next = numbers[0];
    const queue = numbers.slice();
    const worker = async () => {
      while (queue.length) {
        const n = queue.shift();
        out.set(n, await this.fetchBlock(n));
        onProgress?.(++done, numbers.length);
        while (out.has(next)) this.emit('block', out.get(next++));
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);
    this.lastHeard = performance.now();
    this.timer = setInterval(() => this.poll(), 4000);
  }

  async poll() {
    if (this.busy) return;
    this.busy = true;
    try {
      const latest = hexToNum(await rpc('eth_blockNumber', []));
      this.lastHeard = performance.now();
      // Never try to replay a long outage; jump to the last few.
      let n = Math.max(this.head + 1, latest - 4);
      for (; n <= latest; n++) {
        const block = await this.fetchBlock(n);
        this.head = n;
        this.emit('block', block);
      }
    } catch {
      // stalled() reports this; the next poll retries.
    } finally {
      this.busy = false;
    }
  }

  stalled() {
    return performance.now() - this.lastHeard > 20000;
  }
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SyntheticChain extends Emitter {
  constructor() {
    super();
    this.head = 0;
    this.synthetic = true;
    this.rand = mulberry32(Date.now() & 0xffffffff);
  }

  hex(len) {
    let s = '0x';
    for (let i = 0; i < len; i++) s += Math.floor(this.rand() * 16).toString(16);
    return s;
  }

  make(number) {
    const r = this.rand;
    const quiet = r() < 0.1;
    const count = quiet ? Math.floor(r() * 20) : 80 + Math.floor(r() * 240);
    const txs = [];
    for (let i = 0; i < count; i++) {
      const roll = r();
      txs.push({
        hash: this.hex(64),
        from: this.hex(40),
        to: roll < 0.008 ? null : this.hex(40),
        eth: roll > 0.7 ? -Math.log(1 - r()) * 0.4 : 0,
        type: roll > 0.008 && roll < 0.023 ? 3 : 2,
        call: roll >= 0.023 && roll <= 0.7,
      });
    }
    const gasLimit = 36_000_000;
    return {
      number, hash: this.hex(64), time: Math.floor(Date.now() / 1000),
      gasLimit, gasUsed: Math.floor(gasLimit * Math.min(1, count / 330)),
      baseFee: 0.3 + r() * 2, synthetic: true, txs,
    };
  }

  async start(count, onProgress) {
    for (let n = 1; n <= count; n++) {
      this.emit('block', this.make(n));
      onProgress?.(n, count);
    }
    this.head = count;
    this.timer = setInterval(() => {
      this.head += 1;
      this.emit('block', this.make(this.head));
    }, 12000);
  }

  stalled() { return false; }
}
