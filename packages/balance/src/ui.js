const React = require('react');
const h = React.createElement;
const money = (currency, amount) => `${currency === 'CNY' ? '¥' : '$'}${amount}`;

return {
  inject: ['slots', 'remote', 'connection'],
  apply(ctx) {
    const slots = ctx.get('slots');
    const frequencyKey = 'dshcordis.balance.frequency.v1';
    const loadFrequency = () => { try { return normalizeFrequency(JSON.parse(localStorage.getItem(frequencyKey))); } catch { return normalizeFrequency(); } };
    let frequency = loadFrequency();
    const frequencyListeners = new Set();
    const activity = new Map();
    let lastRefresh = -Infinity;
    let mode = 'auto';
    const reader = createBalanceReader(() => ctx.get('remote.account'), () => ({
      version: '0.2.0-rc.2',
      locale: ctx.get('locale')?.getSnapshot().active || 'zh-CN',
      timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
    }), Date.now, async () => {
      const result = await ctx.get('connection').rpc.call('/dshcordis-balance', 'api', {}, AbortSignal.timeout(15000));
      return result.ok ? result.value : { status: 'failed', source: 'api', rows: [] };
    }, () => mode);
    let disposed = false;
    const listeners = new Set();
    let state = { status: 'loading', rows: [] };
    let timer;
    let generation = 0;
    async function refresh(force) {
      lastRefresh = Date.now();
      const ticket = ++generation;
      const result = await reader.read(force);
      if (disposed || ticket !== generation) return;
      state = result;
      listeners.forEach(fn => fn());
    }
    function tick() {
      if (listeners.size && balanceRefreshDue(lastRefresh, Date.now(), [...activity.values()].some(Boolean), frequency)) void refresh(true);
    }
    function changeFrequency(value) {
      frequency = normalizeFrequency(value);
      frequencyListeners.forEach(fn => fn());
      tick();
    }
    function subscribe(fn) {
      listeners.add(fn);
      if (listeners.size === 1) {
        void refresh(false);
        timer = setInterval(tick, 1000);
      }
      return () => { listeners.delete(fn); if (!listeners.size) clearInterval(timer); };
    }
    ctx.effect(() => () => { disposed = true; generation++; clearInterval(timer); reader.invalidate(); listeners.clear(); }, 'balance: lifetime');
    ctx.effect(() => {
      const storage = e => { if (e.key === frequencyKey || e.key === null) changeFrequency(loadFrequency()); };
      window.addEventListener('storage', storage);
      return () => { window.removeEventListener('storage', storage); frequencyListeners.clear(); activity.clear(); };
    }, 'balance: frequency settings');
    function FrequencySettings() {
      const config = React.useSyncExternalStore(fn => { frequencyListeners.add(fn); return () => frequencyListeners.delete(fn); }, () => frequency);
      const [error, setError] = React.useState('');
      function save(key, value) {
        const next = { ...config, [key]: Number(value) };
        try { localStorage.setItem(frequencyKey, JSON.stringify(next)); setError(''); changeFrequency(next); }
        catch { setError('保存失败，请检查浏览器存储权限。'); }
      }
      return h('section', { className: 'dcb-settings' }, h('style', null, STYLE),
        h('h3', null, '余额查询'),
        h('p', null, '在底边栏显示余额。任一会话的 Agent 工作时使用工作频率，否则使用非工作频率。'),
        ...[['activeSeconds', 'Agent 工作时', [10, 30, 60, 120, 300]], ['idleSeconds', 'Agent 非工作时', [60, 300, 600, 1800, 3600]]].map(([key, label, options]) =>
          h('label', { key, className: 'dcb-setting' }, label, h('select', { value: config[key], onChange: e => save(key, e.target.value) }, ...options.map(n => h('option', { key: n, value: n }, n < 60 ? `${n} 秒` : `${n / 60} 分钟`))))),
        h('p', null, '默认：工作时 30 秒，非工作时 5 分钟；工作时可选 10 秒。设置立即生效，保存在当前浏览器，同源窗口同步。'),
        error && h('p', { role: 'alert' }, error));
    }
    function Balance({ useSessions }) {
      const running = useSessions(anyAgentRunning);
      const owner = React.useRef({});
      React.useLayoutEffect(() => { activity.set(owner.current, running); tick(); return () => { activity.delete(owner.current); }; }, [running]);
      const snapshot = React.useSyncExternalStore(subscribe, () => state);
      const [open, setOpen] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const trigger = React.useRef(null);
      const panel = React.useRef(null);
      const dialogId = React.useId();
      const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
      React.useLayoutEffect(() => {
        if (!open || !panel.current || !trigger.current) return;
        const element = panel.current;
        // Native top layer avoids composer overflow/stacking without a body portal.
        if (typeof element.showPopover === 'function') element.showPopover();
        else element.removeAttribute('popover');
        const place = () => {
          if (!trigger.current) return;
          const anchor = trigger.current.getBoundingClientRect();
          const position = popoverPosition(anchor, { width: window.innerWidth, height: window.innerHeight }, element.scrollHeight + 2);
          for (const [key, value] of Object.entries(position)) element.style[key] = value + 'px';
        };
        place();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
        observer?.observe(element);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        element.querySelector('button')?.focus({ preventScroll: true });
        return () => {
          observer?.disconnect();
          window.removeEventListener('resize', place);
          window.removeEventListener('scroll', place, true);
          if (typeof element.hidePopover === 'function' && element.matches(':popover-open')) element.hidePopover();
        };
      }, [open]);
      React.useEffect(() => {
        if (!open) return;
        const pointer = e => { if (!panel.current?.contains(e.target) && !trigger.current?.contains(e.target)) setOpen(false); };
        const key = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
        document.addEventListener('pointerdown', pointer);
        document.addEventListener('keydown', key);
        return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key); };
      }, [open]);
      const label = snapshot.status === 'ready' ? (snapshot.rows.map(row => money(row.currency, row.total)).join(' / ') || '暂无余额数据') : { loading: '…', 'signed-out': '未登录', 'no-key': '未配置 API Key', 'invalid-key': 'API Key 无效', unsupported: '不支持', failed: '不可用' }[snapshot.status];
      const icon = h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('rect', { x: 3, y: 5, width: 18, height: 15, rx: 3 }), h('path', { d: 'M3 8h18M16 12h5v5h-5a2.5 2.5 0 0 1 0-5Z' }));
      function changeMode(value) {
        mode = value; reader.invalidate(); state = { status: 'loading', rows: [] }; listeners.forEach(fn => fn()); void refresh(true);
      }
      return h('span', { className: 'dcb-root' },
        h('style', null, STYLE),
        h('button', { ref: trigger, type: 'button', className: 'dcb-trigger', onClick: () => setOpen(!open), 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': dialogId }, icon, h('span', null, '余额 ' + label)),
        open && h('div', { ref: panel, id: dialogId, popover: 'manual', role: 'dialog', 'aria-label': '账户余额', className: 'dcb-panel' },
          h('div', { className: 'dcb-heading' }, h('span', null, '账户余额'), h('button', { type: 'button', className: 'dcb-close', onClick: close, 'aria-label': '关闭余额详情' }, '×')),
          h('div', { className: 'dcb-source' }, snapshot.source ? (snapshot.source === 'api' ? 'DeepSeek API Key' : 'DeepSeek 登录账户') : '自动模式优先使用 API Key'),
          h('div', { className: 'dcb-modes', role: 'group', 'aria-label': '余额来源' },
            ...[['auto', '自动'], ['api', 'API Key'], ['account', '登录账户']].map(([value, text]) => h('button', { key: value, type: 'button', className: 'dcb-mode', 'aria-pressed': mode === value, onClick: () => changeMode(value) }, text))),
          snapshot.status !== 'ready' && h('p', { className: 'dcb-status', role: 'status' }, label + (snapshot.status === 'failed' ? '，请重试查询；更新插件后需完全重启 DSH。' : '')),
          ...snapshot.rows.map(row => h('div', { key: row.currency, className: 'dcb-wallet' },
            h('div', { className: 'dcb-row' }, h('span', null, row.currency + ' 总余额'), h('span', { className: 'dcb-total' }, money(row.currency, row.total))),
            h('div', { className: 'dcb-row' }, h('span', { className: 'dcb-row-label' }, '赠送余额'), h('span', { className: 'dcb-amount' }, money(row.currency, row.bonus))),
            h('div', { className: 'dcb-row' }, h('span', { className: 'dcb-row-label' }, '充值余额'), h('span', { className: 'dcb-amount' }, money(row.currency, row.recharge))))),
          snapshot.updatedAt && h('div', { className: 'dcb-time' }, '更新于 ' + new Date(snapshot.updatedAt).toLocaleTimeString()),
          h('div', { className: 'dcb-actions' },
            h('button', { type: 'button', className: 'dcb-action', disabled: busy, onClick: async () => { setBusy(true); try { await refresh(true); } finally { setBusy(false); } } }, busy ? '查询中…' : '查询用量'),
            snapshot.topUpUrl && h('a', { href: snapshot.topUpUrl, target: '_blank', rel: 'noopener noreferrer', className: 'dcb-action' }, '充值 ↗'))));
    }
    slots.inject('conversation.composer.dock', () => slots.register({ name: 'conversation.composer.dock', id: 'dshcordis-balance', order: 100 }, Balance));
    slots.inject('settings.plugins.tab', () => slots.register({ name: 'settings.plugins.tab', id: 'dshcordis-balance', label: '余额查询', order: 100 }, FrequencySettings));
  },
};
