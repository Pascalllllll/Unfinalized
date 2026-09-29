// Reads and writes the on-chain leaderboard. viem is loaded only when the
// board is first used, so the game itself never waits on it.
import { BOARD } from './config.js';
import { abi, bytecode } from './board-artifact.js';

let viemPromise;
const viem = () => (viemPromise ||= import('https://cdn.jsdelivr.net/npm/viem@2.57.0/+esm'));

export const boardReady = () => /^0x[0-9a-fA-F]{40}$/.test(BOARD.address);

async function client() {
  const v = await viem();
  return v.createPublicClient({ transport: v.http(BOARD.rpc) });
}

export async function loadBoard(limit = 10) {
  const c = await client();
  const count = await c.readContract({ address: BOARD.address, abi, functionName: 'runnerCount' });
  const rows = [];
  for (let off = 0n; off < count; off += 200n) {
    const [who, bests] = await c.readContract({ address: BOARD.address, abi, functionName: 'page', args: [off, 200n] });
    who.forEach((w, i) => rows.push({ who: w.toLowerCase(), ...bests[i] }));
  }
  rows.sort((a, b) => a.timeMs - b.timeMs || Number(a.submittedAt - b.submittedAt));
  return { total: Number(count), rows: rows.slice(0, limit) };
}

export async function ensureChain() {
  const hex = '0x' + BOARD.chainId.toString(16);
  const current = await window.ethereum.request({ method: 'eth_chainId' });
  if (parseInt(current, 16) === BOARD.chainId) return;
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (err) {
    const unknownChain = err.code === 4902 || err?.data?.originalError?.code === 4902;
    if (!unknownChain) throw err;
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: hex, chainName: BOARD.chainName, rpcUrls: [BOARD.rpc], nativeCurrency: BOARD.currency, blockExplorerUrls: [BOARD.explorer] }],
    });
  }
}

const REASONS = {
  NotASlotTime: 'That block\'s timestamp isn\'t a mainnet slot time, so the board refused it.',
  TooOld: 'Runs have to reach the board within 15 minutes of catching the head. This one is too old.',
  FromTheFuture: 'The block\'s timestamp is ahead of the board\'s clock. Wait a minute and try again.',
  TooFast: 'Under 15 seconds isn\'t a possible climb, so the board refused it.',
  AlreadyClaimed: 'This wallet already submitted a run that caught this block.',
};

function explain(v, err) {
  const withData = err.walk?.((e) => typeof e.data === 'string' && e.data.startsWith('0x'));
  if (withData) {
    try {
      const { errorName } = v.decodeErrorResult({ abi, data: withData.data });
      if (REASONS[errorName]) return REASONS[errorName];
    } catch { /* not one of ours */ }
  }
  return err.shortMessage || err.message || 'The board refused this run.';
}

// Sends through the wallet with plain eth_sendTransaction, which every
// EIP-1193 wallet supports; the wallet estimates gas itself.
async function send(from, params) {
  await ensureChain();
  const hash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from, ...params }] });
  const receipt = await (await client()).waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== 'success') throw new Error('The transaction reverted.');
  return { hash, receipt };
}

export async function submitRun(from, run) {
  const v = await viem();
  const data = v.encodeFunctionData({
    abi,
    functionName: 'submit',
    args: [BigInt(run.caughtBlock), run.caughtHash, BigInt(run.caughtAt), run.timeMs, run.stones],
  });
  // Dry run first, so a rule the contract enforces comes back as a sentence
  // instead of a wallet gas-estimation error.
  try {
    await (await client()).call({ account: from, to: BOARD.address, data });
  } catch (err) {
    throw new Error(explain(v, err));
  }
  return (await send(from, { to: BOARD.address, data })).hash;
}

export async function deployBoard(from) {
  const { hash, receipt } = await send(from, { data: bytecode });
  return { hash, address: receipt.contractAddress };
}
