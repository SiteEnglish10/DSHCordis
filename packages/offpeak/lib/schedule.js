import { calendarDay } from './calendar.js';

const OFFSET = 8 * 60 * 60 * 1000;

// Epoch in, epoch out. Never depends on the machine's configured timezone.
export function getSchedule(now = Date.now()) {
  if (!Number.isFinite(now)) throw new TypeError('now must be epoch milliseconds');
  const beijing = new Date(now + OFFSET);
  const day = calendarDay(beijing);
  const minute = beijing.getUTCHours() * 60 + beijing.getUTCMinutes();
  const peak = day.working && ((minute >= 540 && minute < 720) || (minute >= 840 && minute < 1080));
  let nextOffpeakAt = null;
  if (peak) {
    const end = new Date(beijing);
    end.setUTCHours(minute < 720 ? 12 : 18, 0, 0, 0);
    nextOffpeakAt = end.getTime() - OFFSET;
  }
  return {
    version: 1,
    now,
    timezone: 'Asia/Shanghai',
    date: beijing.toISOString().slice(0, 10),
    todayOffpeak: day.working ? '00:00–09:00、12:00–14:00、18:00–24:00' : '全天',
    peak,
    approximate: day.approximate,
    nextOffpeakAt,
    waitMs: nextOffpeakAt === null ? 0 : nextOffpeakAt - now,
  };
}
