import { getSchedule } from './schedule.js';

export const name = 'dshcordis-offpeak';
export const inject = ['connection', 'webServer'];

export function apply(ctx) {
  // Explicit owner avoids the rpc getter's shadow context in Cordis 4.0.4.
  ctx.get('connection').register(ctx, '/dshcordis-offpeak', async endpoint => {
    if (endpoint === 'query') return { ok: true, value: getSchedule() };
    return { ok: false, error: { code: 'not-found', message: `Unknown endpoint: ${endpoint}` } };
  });
}
