import { useSyncExternalStore } from 'react';
import { timeZone } from '../shared/dates.js';

let language = localStorage.getItem('planer-language') === 'en' ? 'en' : 'id';
const listeners = new Set();
document.documentElement.lang = language;

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguage() {
  return useSyncExternalStore(subscribe, () => language);
}

export function setLanguage(value) {
  if (value !== 'id' && value !== 'en') return;
  if (language === value) return;
  language = value;
  localStorage.setItem('planer-language', value);
  document.documentElement.lang = value;
  listeners.forEach((listener) => listener());
}

export function t(indonesian, english) {
  return language === 'en' ? english : indonesian;
}

export function formatDate(date, options) {
  return new Intl.DateTimeFormat(t('id-ID', 'en-GB'), { timeZone, ...options }).format(date);
}
