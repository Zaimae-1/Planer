export const timeZone = 'Asia/Jakarta';
const keyFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone });
export const dateKey = (date = new Date()) => keyFormatter.format(date).padStart(10, '0');
export const fromKey = (key) => new Date(`${key}T12:00:00Z`);
export function utcDate(year, month, day = 1) {
  const date = new Date('2000-01-01T12:00:00Z');
  date.setUTCFullYear(year, month, day);
  return date;
}
export const formatDate = (date, options) =>
  new Intl.DateTimeFormat('id-ID', { timeZone, ...options }).format(date);
