const React = require('react');
const h = React.createElement;
const STORAGE_KEY = 'dshcordis.offpeak.enabled.v1';
return {
  inject: ['slots', 'conversation', 'connection'],
  apply(ctx) {
    const slots = ctx.get('slots');
    const blocks = ctx.get('conversation')?.blocks;
    let enabled = false;
    try { enabled = localStorage.getItem(STORAGE_KEY) === 'true'; } catch { /* Session-only switch. */ }
    let state = { enabled, schedule: null, received: 0, loading: false };
    let request;
    let requestGeneration = 0;
    let disposed = false;
    let timer;
    let nextPoll = 0;
    const listeners = new Set();
    const gates = new Set();
    function publish(patch = {}) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); }
    function releaseAll() { gates.forEach(gate => gate.update(false)); }
    function cancel() { requestGeneration++; request?.abort(); request = undefined; }
    async function poll() {
      if (request || disposed || !enabled || !listeners.size || document.hidden) return;
      const ticket = ++requestGeneration;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 4000);
      publish({ loading: state.schedule === null });
      try {
        const result = await ctx.get('connection').rpc.call('/dshcordis-offpeak', 'query', {}, controller.signal);
        if (ticket !== requestGeneration || disposed) return;
        if (!result.ok || !validSchedule(result.value)) throw Error('Invalid schedule');
        const received = performance.now();
        nextPoll = received + Math.min(5000, result.value.peak ? Math.max(100, result.value.waitMs) : 5000);
        publish({ schedule: result.value, received, loading: false });
      } catch {
        if (ticket !== requestGeneration || disposed) return;
        releaseAll();
        nextPoll = performance.now() + 5000;
        publish({ schedule: null, received: 0, loading: false });
      } finally { clearTimeout(timeout); if (request === controller) request = undefined; }
    }
    function tick() {
      if (state.schedule && performance.now() - state.received > 10000) {
        releaseAll(); publish({ schedule: null, loading: false });
      } else publish();
      if (enabled && performance.now() >= nextPoll) void poll();
    }
    function subscribe(fn) {
      listeners.add(fn);
      if (listeners.size === 1) { timer = setInterval(tick, 1000); nextPoll = 0; void poll(); }
      return () => { listeners.delete(fn); if (!listeners.size) { clearInterval(timer); cancel(); state = { ...state, schedule: null }; } };
    }
    function toggle(value, persist = true) {
      enabled = value;
      cancel(); releaseAll();
      if (persist) try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* Session-only switch. */ }
      publish({ enabled, schedule: null, received: 0, loading: value });
      nextPoll = 0;
      if (enabled) void poll();
    }
    ctx.effect(() => {
      const storage = e => { if (e.key === STORAGE_KEY || e.key === null) toggle(e.newValue === 'true', false); };
      const visibility = () => { cancel(); releaseAll(); publish({ schedule: null, received: 0 }); nextPoll = 0; if (!document.hidden) void poll(); };
      window.addEventListener('storage', storage);
      document.addEventListener('visibilitychange', visibility);
      return () => {
        disposed = true; cancel(); clearInterval(timer); gates.forEach(gate => gate.dispose()); gates.clear(); listeners.clear();
        window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visibility);
      };
    }, 'offpeak: lifetime');
    function Calendar() {
      const today = getSchedule();
      const [month, setMonth] = React.useState(today.date.slice(0, 7));
      const [year, number] = month.split('-').map(Number);
      const first = new Date(Date.UTC(year, number - 1, 1));
      const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
      const padding = (first.getUTCDay() + 6) % 7;
      const cells = Array.from({ length: Math.ceil((padding + count) / 7) * 7 }, (_, index) => {
        const day = index - padding + 1;
        if (day < 1 || day > count) return h('td', { key: index });
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const schedule = getSchedule(Date.parse(`${date}T12:00:00+08:00`));
        const allDay = schedule.todayOffpeak === '全天';
        return h('td', { key: index, title: `${date}：${schedule.todayOffpeak}`, 'aria-current': date === today.date ? 'date' : undefined, style: { padding: '10px 4px', border: '1px solid var(--dsw-alias-border-l2)', textAlign: 'center', background: date === today.date ? 'var(--dsw-alias-bg-l1)' : undefined } },
          h('div', null, day), h('small', { style: { color: allDay ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-secondary)' } }, allDay ? '全天空闲' : '分时空闲'));
      });
      const shift = delta => setMonth(new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7));
      const button = { font: 'inherit', color: 'inherit', background: 'var(--dsw-alias-bg-base)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' };
      return h('section', { style: { maxWidth: 680, fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)' } },
        h('h3', null, '空闲时段发送'), h('p', null, '开启后会在空闲时段发送信息，省钱。时间均为北京时间。'),
        h('p', null, `今日（${today.date}）空闲时段：${today.todayOffpeak}`),
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' } },
          h('button', { type: 'button', style: button, onClick: () => shift(-1), 'aria-label': '上个月' }, '‹ 上月'), h('strong', { 'aria-live': 'polite' }, month), h('button', { type: 'button', style: button, onClick: () => shift(1), 'aria-label': '下个月' }, '下月 ›')),
        h('table', { style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }, 'aria-label': `${month} 空闲时段日历` },
          h('thead', null, h('tr', null, ...['一', '二', '三', '四', '五', '六', '日'].map(day => h('th', { key: day, scope: 'col' }, day)))),
          h('tbody', null, ...Array.from({ length: cells.length / 7 }, (_, index) => h('tr', { key: index }, ...cells.slice(index * 7, index * 7 + 7))))),
        h('p', null, '全天空闲：节假日和休息日。分时空闲：00:00–09:00、12:00–14:00、18:00–24:00；调休工作日按分时执行。'),
        calendarDay(first).approximate && h('p', { role: 'status' }, '此年份未收录官方节假日，暂按周一至周五工作日近似显示。'),
        h('p', null, '开启后若处于高峰时段，会暂停编辑，到空闲时段自动提交当前非空草稿。关闭开关取消等待并恢复编辑。实际费用以服务商计费为准。'));
    }
    function Offpeak({ sessionId, useInput, useSession, inputActions }) {
      const input = useInput(value => value);
      const session = useSession(value => value);
      const shared = React.useSyncExternalStore(subscribe, () => state);
      const [status, setStatus] = React.useState('off');
      const latest = React.useRef(null);
      latest.current = { input, session, inputActions };
      const gateRef = React.useRef(null);
      React.useLayoutEffect(() => {
        if (!blocks || typeof blocks.set !== 'function' || typeof blocks.storeFor !== 'function' || typeof latest.current.inputActions?.submit !== 'function') { setStatus('unsupported'); return; }
        const gate = createSendGate(blocks, sessionId, () => latest.current.inputActions.submit());
        gateRef.current = gate;
        gates.add(gate);
        return () => { gate.dispose(); gates.delete(gate); gateRef.current = null; };
      }, [sessionId]);
      React.useLayoutEffect(() => {
        const gate = gateRef.current;
        if (!gate) return;
        const view = { input, running: session?.running, removed: session?.removed, offline: session?.subagent?.address?.mode === 'continuable' && session.subagent.parentAvailable !== true };
        setStatus(gate.update(shared.enabled, shared.schedule, !document.hidden && performance.now() - shared.received <= 10000, view));
      }, [shared, input, session]);
      const waitMs = Math.max(0, (shared.schedule?.waitMs || 0) - (performance.now() - shared.received));
      const minutes = Math.ceil(waitMs / 60000);
      const countdown = `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分后发送`;
      const labels = { off: '空闲发送', waiting: countdown, idle: '当前为空闲时段', unavailable: '状态不可用，未拦发送', unsupported: '无法拦发送', 'other-block': '会话已有其他限制', busy: '会话忙，请手动发送', sent: '已提交发送' };
      const label = !shared.enabled ? labels.off : shared.loading ? '读取中…' : labels[status];
      const token = !shared.enabled ? 'label-tertiary' : shared.loading ? 'state-warn-primary' : status === 'waiting' || status === 'idle' || status === 'sent' ? 'state-success-primary' : 'state-error-primary';
      const today = getSchedule();
      return h('button', {
        type: 'button', role: 'switch', 'aria-checked': shared.enabled, 'aria-label': `空闲时段发送：${label}`,
        title: `今日空闲时段（北京时间 ${today.date}）：${today.todayOffpeak}。\n${label}。等待时暂停编辑；关闭开关即可修改草稿。${today.approximate ? '按工作日近似判断。' : ''}`,
        onClick: () => toggle(!enabled),
        style: { font: 'inherit', fontSize: 12, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: '4px 8px', background: 'var(--dsw-alias-bg-base)', color: `var(--dsw-alias-${token}, var(--dsw-alias-label-primary))`, cursor: 'pointer' },
      }, `${shared.enabled ? '◉' : '○'} ${label}${shared.schedule?.approximate ? ' · 按工作日近似判断' : ''}`);
    }
    slots.inject('conversation.input.right', () => slots.register({ name: 'conversation.input.right', id: 'dshcordis-offpeak', order: 100 }, Offpeak));
    slots.inject('settings.plugins.tab', () => slots.register({ name: 'settings.plugins.tab', id: 'dshcordis-offpeak', label: '空闲时段日历', order: 110 }, Calendar));
  },
};
