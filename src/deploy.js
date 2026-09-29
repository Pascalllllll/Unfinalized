import { BOARD } from './config.js';
import { boardReady, deployBoard } from './board.js';
import { wallet, short } from './wallet.js';

const $ = (id) => document.getElementById(id);
const status = (text, error = false) => {
  $('deploy-status').textContent = text;
  $('deploy-status').classList.toggle('error', error);
};

$('chain-name').textContent = BOARD.chainName;
document.querySelectorAll('.chain-name').forEach((el) => { el.textContent = BOARD.chainName; });
$('deploy').textContent = `Deploy to ${BOARD.chainName}`;

if (boardReady()) {
  $('existing').hidden = false;
  $('existing').textContent = `This copy already points at ${BOARD.address}. Deploying again makes a new, empty board; the old one stays on chain.`;
}

if (!wallet.available()) {
  $('deploy').hidden = true;
  status('No browser wallet found. Install one (MetaMask, Rabby, Frame), then reload this page.', true);
}

$('deploy').addEventListener('click', async () => {
  const btn = $('deploy');
  btn.disabled = true;
  try {
    status('Waiting for your wallet…');
    const from = wallet.address || (await wallet.connect());
    status(`Deploying from ${short(from)}. Approve it in your wallet, then wait for it to land.`);
    const { hash, address } = await deployBoard(from);
    status('');
    const line = `  address: '${address}',`;
    $('snippet').textContent = line;
    $('result').hidden = false;
    const a = document.createElement('a');
    a.href = `${BOARD.explorer}/tx/${hash}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'See the deployment';
    $('deploy-status').append(`Deployed at ${address}. `, a);
    $('copy').focus();
  } catch (err) {
    btn.disabled = false;
    status(err && err.code === 4001
      ? 'You rejected it in your wallet. Nothing was deployed.'
      : `Deploy failed: ${(err && (err.shortMessage || err.message)) || 'unknown error'}.`, true);
  }
});

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('snippet').textContent.trim());
    $('copy').textContent = 'Copied';
  } catch {
    $('copy').textContent = 'Select the line and copy it';
  }
  setTimeout(() => { $('copy').textContent = 'Copy the line'; }, 2000);
});
