// Exact decimal arithmetic: amounts never pass through a floating point Number.
export function normalizeFrequency(value) {
  const seconds = (n, fallback, min, max) => Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  return { activeSeconds: seconds(value?.activeSeconds, 30, 10, 3600), idleSeconds: seconds(value?.idleSeconds, 300, 60, 86400) };
}

export function balanceRefreshDue(last, now, running, config) {
  return now - last >= (running ? config.activeSeconds : config.idleSeconds) * 1000;
}

export function anyAgentRunning(snapshot) {
  return Object.values(snapshot?.byId || {}).some(session => session.running === true);
}

export function sumAmounts(values) {
  const parts = values.map(value => {
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
    if (!match) throw new TypeError('Invalid wallet amount');
    return { sign: match[1] ? -1n : 1n, whole: match[2], fraction: match[3] || '' };
  });
  const scale = Math.max(2, ...parts.map(p => p.fraction.length));
  const sum = parts.reduce((n, p) => n + p.sign * BigInt(p.whole + p.fraction.padEnd(scale, '0')), 0n);
  const digits = (sum < 0n ? -sum : sum).toString().padStart(scale + 1, '0');
  return `${sum < 0n ? '-' : ''}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function balanceRows(value) {
  if (value === null) return { status: 'signed-out', rows: [] };
  if (value?.status !== 'ready') return { status: 'failed', rows: [] };
  if (!Array.isArray(value.value) || !Array.isArray(value.bonusWallets)) throw new TypeError('Unsupported wallet format');
  const currencies = new Set([...value.value, ...value.bonusWallets].map(w => w.currency));
  const rows = [...currencies].sort().map(currency => {
    if (!['CNY', 'USD'].includes(currency)) throw new TypeError('Unsupported currency');
    const recharge = sumAmounts(value.value.filter(w => w.currency === currency).map(w => w.balance));
    const bonus = sumAmounts(value.bonusWallets.filter(w => w.currency === currency).map(w => w.balance));
    return { currency, recharge, bonus, total: sumAmounts([recharge, bonus]) };
  });
  return { status: 'ready', rows };
}

export function safeTopUpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'platform.deepseek.com' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function popoverPosition(anchor, viewport, height) {
  const margin = 12;
  const width = Math.min(292, Math.max(0, viewport.width - margin * 2));
  const above = Math.max(0, anchor.top - 6 - margin);
  const below = Math.max(0, viewport.height - anchor.bottom - 6 - margin);
  const useAbove = height <= above || above >= below;
  const maxHeight = Math.min(viewport.height - margin * 2, useAbove ? above : below);
  const fittedHeight = Math.min(height, Math.max(0, maxHeight));
  return { width, maxHeight: Math.max(0, maxHeight), left: Math.max(margin, Math.min(anchor.left, viewport.width - width - margin)), top: useAbove ? Math.max(margin, anchor.top - 6 - fittedHeight) : anchor.bottom + 6 };
}

export function createBalanceReader(resolveAccount, metadata, now = Date.now, readApi, source = () => 'account') {
  let cached;
  let pending;
  let revision = 0;
  return {
    invalidate() { revision++; cached = undefined; pending = undefined; },
    read(force = false) {
      if (pending) return pending;
      if (!force && cached && now() - cached.updatedAt < 10000) return Promise.resolve(cached);
      const generation = revision;
      const task = (async () => {
        try {
          const mode = source();
          let api;
          if (mode !== 'account' && readApi) {
            api = await readApi();
            if (mode === 'api' || !['no-key', 'unsupported'].includes(api.status)) return api;
          }
          const account = resolveAccount();
          if (!account || typeof account.getBalance !== 'function' || typeof account.getState !== 'function') return api || { status: 'unsupported', rows: [] };
          const state = await account.getState();
          if (!state.ok) throw new Error('Account state unavailable');
          if (state.value.status !== 'credential-stored') return api || { status: 'signed-out', rows: [] };
          const response = await account.getBalance(metadata());
          if (!response.ok) throw new Error('Account balance unavailable');
          return { ...balanceRows(response.value), source: 'account', topUpUrl: safeTopUpUrl(state.value.links?.topUpUrl), updatedAt: now() };
        } catch { return { status: 'failed', rows: [] }; }
      })().then(value => {
        if (generation === revision) cached = value.status === 'ready' ? value : undefined;
        return value;
      }).finally(() => { if (pending === task) pending = undefined; });
      pending = task;
      return task;
    },
  };
}
