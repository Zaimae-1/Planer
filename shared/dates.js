export const timeZone = 'Asia/Jakarta';
const keyFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone });
export const dateKey = (date = new Date()) => keyFormatter.format(date);
export const fromKey = (key) => new Date(`${key}T12:00:00Z`);
export const utcDate = (year, month, day = 1) => new Date(Date.UTC(year, month, day, 12));
export const formatDate = (date, options) =>
  new Intl.DateTimeFormat('id-ID', { timeZone, ...options }).format(date);

export const categories = {
  rapat: 'Rapat',
  kegiatan: 'Kegiatan',
  tenggat: 'Tenggat',
};
