import { readApiBalance } from './api.js';
export const name = 'dshcordis-balance';
export const inject = ['connection', 'webServer'];
export function apply(ctx) {
  const controllers = new Set();
  ctx.effect(() => () => { controllers.forEach(controller => controller.abort()); controllers.clear(); }, 'balance: API requests');
  // Explicit owner avoids the rpc getter's shadow context in Cordis 4.0.4.
  ctx.get('connection').register(ctx, '/dshcordis-balance', async endpoint => {
    if (endpoint !== 'api') return { ok: false, error: { code: 'not-found', message: 'Unknown endpoint' } };
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 12000);
    try { return { ok: true, value: await readApiBalance(ctx, fetch, controller.signal) }; }
    finally { clearTimeout(timer); controllers.delete(controller); }
  });
}
