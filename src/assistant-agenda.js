import { dateKey, utcDate } from '../shared/dates.js';

const monthNames = [
  'januari january jan', 'februari february feb', 'maret march mar', 'april apr', 'mei may', 'juni june jun',
  'juli july jul', 'agustus august agu ags aug', 'september sep sept', 'oktober october okt oct',
  'november nov', 'desember december des dec',
];
const months = new Map(monthNames.flatMap((names, index) => names.split(' ').map((name) => [name, index])));
const datePattern = new RegExp([
  '\\b(\\d{4})-(\\d{2})-(\\d{2})\\b',
  `\\b(\\d{1,2})\\s+(${[...months.keys()].join('|')})\\b(?:\\s+(\\d{4}))?(?:\\s+(tahun ini|ini|this year))?`,
  `\\b(${[...months.keys()].join('|')})\\s+(\\d{1,2})\\b(?:,?\\s+(\\d{4}))?(?:\\s+(this year))?`,
  '\\b(hari ini|besok|lusa|today|tomorrow|day after tomorrow)\\b',
].join('|'), 'gi');
const timePattern = /\b(?:jam|pukul|at)\s+(\d{1,2})(?:[.:](\d{2}))?(?:\s*(am|pm|pagi|siang|sore|malam)\b)?(?![\d.:])/gi;
const createCommand = /^(?:(?:tolong|please|bisa(?:kah)?|boleh(?:kah)?)\s+)?(?:buat(?:kan|in)?|tambah(?:kan|in)?|catat(?:kan)?|jadwalkan|masukin|create|add|schedule)\b\s*(?:(?:agenda|jadwal|event|acara)\b\s*)?(?:(?:untuk|buat|for)\b\s*)?/i;
const statementPrefix = /^(?:(?:aku|saya|gue|gw|i)\s+(?:mau\s+|ada\s+|akan\s+|punya\s+|have\s+|want to\s+)(?:(?:acara|agenda|jadwal|an event)\b\s*)?|(?:ada\s+acara|agenda|acara)\b\s*)/i;
const dateConnector = /\b(?:pada\s+tanggal|tanggal|tggl|tnggl|tngal|tgl|pada|on)\.?\s*$/i;
const readIntent = /^(?:apa(?:kah)?|kapan|berapa|bagaimana|gimana|kenapa|cek|lihat|tampilkan|show|list|what|when|do i have|how)\b|\b(?:agenda|jadwal)\s+apa\b/i;
const otherAction = /^(?:tolong\s+|please\s+)?(?:jangan|hapus|ubah|edit|batal(?:kan)?|pindah(?:kan)?|delete|update|cancel|move|don't)\b/i;

function requestedDate(match, today) {
  const [, isoYear, isoMonth, isoDay, dayFirst, monthFirst, monthYear, thisYear, englishMonth, englishDay, englishYear, englishThisYear, relative] = match;
  const [currentYear, currentMonth, currentDay] = today.split('-').map(Number);
  if (relative) {
    const word = relative.toLowerCase();
    const offset = ['lusa', 'day after tomorrow'].includes(word) ? 2 : ['besok', 'tomorrow'].includes(word) ? 1 : 0;
    return dateKey(utcDate(currentYear, currentMonth - 1, currentDay + offset));
  }
  const specifiedYear = isoYear || monthYear || englishYear;
  const day = Number(isoDay || dayFirst || englishDay);
  const month = isoMonth ? Number(isoMonth) - 1 : months.get((monthFirst || englishMonth).toLowerCase());
  function validKey(year) {
    if (year < 1 || year > 9999 || month < 0 || month > 11 || day < 1) return '';
    const date = utcDate(year, month, day);
    return date.getUTCMonth() === month ? dateKey(date) : '';
  }
  const key = validKey(specifiedYear ? Number(specifiedYear) : currentYear);
  if (key && !specifiedYear && !thisYear && !englishThisYear && key < today) return validKey(currentYear + 1);
  return key;
}

function cleanLabel(value) {
  return value
    .replace(/^[\s,.:;–-]+|[\s,.:;!?–-]+$/g, '')
    .replace(/\b(?:lalu|terus|kemudian|dan|nanti|then|and)\s*$/i, '')
    .trim();
}

function agendaTitle(value) {
  let title = cleanLabel(value);
  const filler = /^(?:ini|nanti|aku|saya|gue|gw)\b\s*/i;
  while (createCommand.test(title) || statementPrefix.test(title) || filler.test(title)) {
    title = title.replace(createCommand, '').replace(statementPrefix, '').replace(filler, '');
  }
  title = cleanLabel(title.replace(dateConnector, ''));
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function readTime(match) {
  const [, hour, minute = '00', period = ''] = match;
  let value = Number(hour);
  const part = period.toLowerCase();
  if (value > 23 || Number(minute) > 59 || (['am', 'pm'].includes(part) && (value < 1 || value > 12))) return null;
  if (part === 'am' && value === 12) value = 0;
  if (['pm', 'siang', 'sore', 'malam'].includes(part) && value < 12) value += 12;
  return `${String(value).padStart(2, '0')}:${minute}`;
}

export function parseAgendaMessage(message, { today = dateKey(), draft = {} } = {}) {
  const text = message.normalize('NFC').trim();
  const dates = [...text.matchAll(datePattern)];
  const creating = createCommand.test(text);
  const question = !creating && (readIntent.test(text) || text.endsWith('?'));
  if (otherAction.test(text)) return { kind: 'help' };
  if (dates.length > 1) return { kind: 'multiple-dates' };
  const date = dates.length ? requestedDate(dates[0], today) : draft.date;
  if (dates.length && !date) return { kind: 'invalid-date' };
  if (question) return /\b(?:agenda|jadwal|calendar|schedule|events?)\b/i.test(text)
    ? { kind: 'list', date: dates.length ? date : null } : { kind: 'help' };
  if (!date && !creating && !statementPrefix.test(text) && !draft.title) return { kind: 'help' };

  const withoutDate = dates.length
    ? text.slice(0, dates[0].index).replace(dateConnector, '') + ' ' + text.slice(dates[0].index + dates[0][0].length)
    : text;
  const times = [...withoutDate.matchAll(timePattern)];
  const labels = times.map((time, index) => cleanLabel(withoutDate.slice(time.index + time[0].length, times[index + 1]?.index)));
  const title = agendaTitle(withoutDate.slice(0, times[0]?.index)) || draft.title || agendaTitle(labels[0] || '');
  if (!title) return date ? { kind: 'missing-title', date } : { kind: 'help' };
  const activities = times.map((time, index) => ({ title: labels[index] || title, time: readTime(time) }));
  const mentionedTimes = [...withoutDate.matchAll(/\b(?:jam|pukul|at)\s+\d/gi)];
  if (mentionedTimes.length !== activities.length || activities.some(({ time }) => time === null)) return { kind: 'invalid-time', title, date };
  if (title.length > 100 || activities.length > 24 || activities.some((item) => item.title.length > 100)) return { kind: 'too-long' };
  if (!date) return { kind: 'missing-date', title, activities };
  return { kind: 'agenda', fields: { title, date, priority: 'none', notes: '', activities: times.length ? activities : draft.activities || [] } };
}
