// Host-only: secrets are resolved here and never returned over RPC.
export async function readApiBalance(ctx, fetcher = fetch, signal) {
  const unavailable = status => ({ status, source: 'api', rows: [] });
  try {
    const environment = ctx.get('launchEnvironment');
    const env = name => environment ? environment.get(name)?.value : process.env[name];
    const providers = ctx.get('llm')?.listConfigurableProviders?.() || [];
    const provider = providers.find(item => item.provider === 'deepseek-official');
    let config = {};
    if (provider) {
      const descriptor = ctx.get('settings')?.describe({ redactSecrets: true }).find(item => item.ns === provider.settingsNs);
      if (!descriptor) return unavailable('unsupported');
      config = descriptor.value;
      for (const key of provider.settingsPath) config = config?.[key];
      if (!config || provider.error) return unavailable('unsupported');
    }
    const base = new URL(config.baseURL || env('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com');
    // Never send a gateway's key to another provider, and never follow redirects.
    if (base.origin !== 'https://api.deepseek.com' || base.username || base.password) return unavailable('unsupported');
    const ref = config.apiKeyEnv || 'DEEPSEEK_API_KEY';
    if (typeof ref !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref)) return unavailable('unsupported');
    const credentials = ctx.get('credentials');
    const key = credentials ? (await credentials.resolve(ref))?.value : env(ref);
    if (typeof key !== 'string' || !key.trim()) return unavailable('no-key');
    const response = await fetcher('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      redirect: 'error', signal,
    });
    if ([401, 403].includes(response.status)) return unavailable('invalid-key');
    if (!response.ok) return unavailable('failed');
    const data = await response.json();
    if (!Array.isArray(data.balance_infos)) return unavailable('failed');
    const amount = value => {
      if (typeof value !== 'string' || value.length > 100 || !/^-?\d+(\.\d+)?$/.test(value)) throw Error('Invalid amount');
      return value;
    };
    const rows = data.balance_infos.map(wallet => {
      if (!['CNY', 'USD'].includes(wallet.currency)) throw Error('Invalid currency');
      return { currency: wallet.currency, total: amount(wallet.total_balance), bonus: amount(wallet.granted_balance), recharge: amount(wallet.topped_up_balance) };
    });
    return { status: 'ready', source: 'api', rows, updatedAt: Date.now(), topUpUrl: 'https://platform.deepseek.com/top_up' };
  } catch { return unavailable('failed'); }
}
