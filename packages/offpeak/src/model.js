export function validSchedule(value) {
  return value?.version === 1 && typeof value.peak === 'boolean' && typeof value.approximate === 'boolean'
    && Number.isFinite(value.now) && Number.isFinite(value.waitMs) && value.waitMs >= 0
    && (value.peak ? Number.isFinite(value.nextOffpeakAt) && value.nextOffpeakAt > value.now && value.waitMs === value.nextOffpeakAt - value.now : value.nextOffpeakAt === null && value.waitMs === 0);
}

// Own exactly one block. Never remove a newer block installed by another plugin.
export function createSendGate(blocks, sessionId, submit) {
  const own = { reason: '空闲时段发送：等待期间暂停编辑，关闭开关即可修改草稿' };
  let armed = false;
  let disposed = false;
  const current = () => blocks.storeFor(sessionId).getSnapshot();
  function release() {
    armed = false;
    if (current() === own) blocks.set(sessionId, undefined);
  }
  return {
    dispose() { disposed = true; try { release(); } catch { /* Registry already removed. */ } },
    update(enabled, schedule, fresh, view) {
      if (disposed) return 'off';
      try {
        if (!enabled) { release(); return 'off'; }
        if (!fresh || !validSchedule(schedule)) { release(); return 'unavailable'; }
        if (!view || view.removed || view.offline) { release(); return 'unavailable'; }
        if (schedule.peak) {
          if (current() !== undefined && current() !== own) { armed = false; return 'other-block'; }
          blocks.set(sessionId, own);
          if (current() !== own) { armed = false; return 'unsupported'; }
          armed = true;
          return 'waiting';
        }
        const shouldSend = armed && current() === own;
        release();
        if (!shouldSend) return 'idle';
        if (view.running || !['plain', 'claimed'].includes(view.input?.phase)) return 'busy';
        if (!view.input.draft?.trim() && !view.input.attachmentIds?.length) return 'idle';
        submit();
        return 'sent';
      } catch {
        try { release(); } catch { /* A replaced registry must never crash the slot. */ }
        return 'unsupported';
      }
    },
  };
}
