// Source: State Council holiday notices. See docs/calendar-sources.md.
const schedules = {
  2024: {
    holidays: ['01-01', '02-10:02-17', '04-04:04-06', '05-01:05-05', '06-10', '09-15:09-17', '10-01:10-07'],
    workdays: ['02-04', '02-18', '04-07', '04-28', '05-11', '09-14', '09-29', '10-12'],
  },
  2025: {
    holidays: ['01-01', '01-28:02-04', '04-04:04-06', '05-01:05-05', '05-31:06-02', '10-01:10-08'],
    workdays: ['01-26', '02-08', '04-27', '09-28', '10-11'],
  },
  2026: {
    holidays: ['01-01:01-03', '02-15:02-23', '04-04:04-06', '05-01:05-05', '06-19:06-21', '09-25:09-27', '10-01:10-07'],
    workdays: ['01-04', '02-14', '02-28', '05-09', '09-20', '10-10'],
  },
};

export function calendarDay(date) {
  const year = date.getUTCFullYear();
  const day = date.toISOString().slice(5, 10);
  const schedule = schedules[year];
  const weekend = [0, 6].includes(date.getUTCDay());
  if (!schedule) return { working: !weekend, approximate: true };
  if (schedule.workdays.includes(day)) return { working: true, approximate: false };
  const holiday = schedule.holidays.some(range => {
    const [start, end = start] = range.split(':');
    return day >= start && day <= end;
  });
  return { working: !weekend && !holiday, approximate: false };
}
