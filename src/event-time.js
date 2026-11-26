import { t } from './i18n.js';

export const clockPattern = '(?:0?[1-9]|1[0-2])[.:,][0-5][0-9]';

export function toClock(time) {
  if (!time) return { clock: '', period: 'AM' };
  const [hour, minute] = time.split(':');
  return {
    clock: `${Number(hour) % 12 || 12}.${minute}`,
    period: Number(hour) < 12 ? 'AM' : 'PM',
  };
}

export function toEventTime(clock, period) {
  if (!clock) return '';
  const [hour, minute] = clock.split(/[.:,]/);
  const hour24 = Number(hour) % 12 + (period === 'PM' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${minute}`;
}

export function formatEventTime(time) {
  if (!time) return t('Tanpa jam', 'No time set');
  const { clock, period } = toClock(time);
  return `${clock} ${period} WIB`;
}
export function eventActivities(event) {
  if (event.activities?.length) return event.activities;
  return event.time ? [{ title: event.title, time: event.time }] : [];
}

export function agendaStart(event) {
  return eventActivities(event).reduce((earliest, { time }) =>
    time && (!earliest || time < earliest) ? time : earliest, '');
}
