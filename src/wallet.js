// Optional EIP-1193 wallet: highlights your own transactions and submits
// finished runs to the leaderboard contract.

export const wallet = {
  address: null,

  available() {
    return typeof window.ethereum !== 'undefined';
  },

  async connect() {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts.length) throw new Error('No account shared');
    this.address = accounts[0].toLowerCase();
    return this.address;
  },
};

export const short = (h) => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : '');
