import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAgendaMessage } from './assistant-agenda.js';

const today = '2026-11-27';
const parse = (message, draft) => parseAgendaMessage(message, { today, draft });

test('uses the current year and accepts the Indonesian date shorthand', () => {
  assert.deepEqual(parse('aku ada acara muncak Merbabu tnggl 28 des ini').fields, {
    title: 'Muncak Merbabu', date: '2026-12-28', priority: 'none', notes: '', activities: [],
  });
  assert.equal(parse('buat agenda rapat 8 Januari').fields.date, '2027-01-08');
  assert.equal(parse('buat agenda rapat 8 Januari ini').fields.date, '2026-01-08');
  assert.equal(parse('Schedule a hike on Dec 28 this year').fields.date, '2026-12-28');
});

test('converts itinerary times to the calendar format', () => {
  const result = parse('aku tnggl 22 des nanti ada acara ke Surabaya, jam 9 otw, jam 2.30 PM check-in');
  assert.equal(result.fields.title, 'Ke Surabaya');
  assert.deepEqual(result.fields.activities, [{ title: 'otw', time: '09:00' }, { title: 'check-in', time: '14:30' }]);
  assert.equal(parse('buat agenda jaga 30 des jam 12 AM').fields.activities[0].time, '00:00');
});

test('returns clarifications for ambiguous or invalid input instead of writing an agenda', () => {
  assert.equal(parse('catat rapat 31 Februari').kind, 'invalid-date');
  assert.equal(parse('catat rapat 30 Des jam 9.2').kind, 'invalid-time');
  assert.equal(parse('buat agenda 28 Des dan 29 Des').kind, 'multiple-dates');
  assert.deepEqual(parse('apakah ada agenda besok'), { kind: 'list', date: '2026-11-28' });
  assert.equal(parse('jangan buat rapat 30 Des').kind, 'help');
});

test('completes a draft when the follow-up supplies the date or title', () => {
  const missingDate = parse('aku mau muncak Merbabu');
  assert.equal(missingDate.kind, 'missing-date');
  assert.equal(parse('28 des', missingDate).fields.title, 'Muncak Merbabu');
  const missingTitle = parse('28 des');
  assert.equal(missingTitle.kind, 'missing-title');
  assert.equal(parse('Piknik', missingTitle).fields.title, 'Piknik');
});
