import { t } from './i18n.js';

const national = {
  '2026': {
    '01-01': 'Tahun Baru Masehi', '01-16': 'Isra Mikraj Nabi Muhammad', '02-17': 'Tahun Baru Imlek',
    '03-19': 'Hari Suci Nyepi', '03-21': 'Idulfitri', '03-22': 'Idulfitri',
    '04-03': 'Wafat Yesus Kristus', '04-05': 'Paskah', '05-01': 'Hari Buruh Internasional',
    '05-14': 'Kenaikan Yesus Kristus', '05-27': 'Iduladha', '05-31': 'Hari Raya Waisak',
    '06-01': 'Hari Lahir Pancasila', '06-16': 'Tahun Baru Islam',
    '08-17': 'Hari Kemerdekaan RI', '08-25': 'Maulid Nabi Muhammad', '12-25': 'Hari Natal',
  },
  '2027': {
    '01-01': 'Tahun Baru Masehi', '01-05': 'Isra Mikraj Nabi Muhammad', '02-06': 'Tahun Baru Imlek',
    '03-08': 'Hari Suci Nyepi', '03-10': 'Idulfitri', '03-11': 'Idulfitri', '03-26': 'Wafat Yesus Kristus', '03-28': 'Paskah',
    '05-01': 'Hari Buruh Internasional', '05-06': 'Kenaikan Yesus Kristus', '05-17': 'Iduladha',
    '05-20': 'Hari Raya Waisak', '06-01': 'Hari Lahir Pancasila', '06-06': 'Tahun Baru Islam',
    '08-15': 'Maulid Nabi Muhammad', '08-17': 'Hari Kemerdekaan RI', '12-25': 'Hari Natal', '12-26': 'Isra Mikraj Nabi Muhammad',
  },
};
const leave = {
  '2026': {
    '02-16': 'Imlek', '03-18': 'Nyepi', '03-20': 'Idulfitri', '03-23': 'Idulfitri', '03-24': 'Idulfitri',
    '05-15': 'Kenaikan Yesus Kristus', '05-28': 'Iduladha', '12-24': 'Natal',
  },
  '2027': {
    '02-05': 'Imlek', '03-09': 'Idulfitri', '03-12': 'Idulfitri', '03-15': 'Idulfitri', '03-25': 'Wafat Yesus Kristus',
    '05-18': 'Iduladha', '05-19': 'Waisak', '12-24': 'Natal',
  },
};
const observances = {
  '02-21': 'Hari Bahasa Ibu Internasional', '03-08': 'Hari Perempuan Internasional', '03-22': 'Hari Air Sedunia',
  '04-07': 'Hari Kesehatan Sedunia', '04-22': 'Hari Bumi', '05-03': 'Hari Kebebasan Pers Sedunia',
  '06-05': 'Hari Lingkungan Hidup Sedunia', '06-08': 'Hari Laut Sedunia', '07-30': 'Hari Persahabatan Internasional',
  '08-12': 'Hari Pemuda Internasional', '09-21': 'Hari Perdamaian Internasional', '10-05': 'Hari Guru Sedunia',
  '10-24': 'Hari Perserikatan Bangsa-Bangsa', '11-16': 'Hari Toleransi Internasional', '11-20': 'Hari Anak Sedunia',
  '11-25': 'Hari Penghapusan Kekerasan terhadap Perempuan', '12-03': 'Hari Disabilitas Internasional',
  '12-10': 'Hari Hak Asasi Manusia',
};
const commemorations = {
  '04-21': 'Hari Kartini', '05-02': 'Hari Pendidikan Nasional', '05-20': 'Hari Kebangkitan Nasional',
  '10-28': 'Hari Sumpah Pemuda', '11-10': 'Hari Pahlawan', '11-25': 'Hari Guru Nasional', '12-22': 'Hari Ibu',
};

const englishNames = {
  'Tahun Baru Masehi': 'New Year’s Day',
  'Isra Mikraj Nabi Muhammad': 'Isra and Mi’raj',
  'Tahun Baru Imlek': 'Chinese New Year',
  Imlek: 'Chinese New Year',
  'Hari Suci Nyepi': 'Nyepi',
  Idulfitri: 'Eid al-Fitr',
  'Wafat Yesus Kristus': 'Good Friday',
  Paskah: 'Easter Sunday',
  'Hari Buruh Internasional': 'International Workers’ Day',
  'Kenaikan Yesus Kristus': 'Ascension Day',
  Iduladha: 'Eid al-Adha',
  'Hari Raya Waisak': 'Vesak',
  Waisak: 'Vesak',
  'Hari Lahir Pancasila': 'Pancasila Day',
  'Tahun Baru Islam': 'Islamic New Year',
  'Hari Kemerdekaan RI': 'Indonesian Independence Day',
  'Maulid Nabi Muhammad': 'Prophet Muhammad’s Birthday',
  'Hari Natal': 'Christmas Day',
  Natal: 'Christmas',
  'Hari Bahasa Ibu Internasional': 'International Mother Language Day',
  'Hari Perempuan Internasional': 'International Women’s Day',
  'Hari Air Sedunia': 'World Water Day',
  'Hari Kesehatan Sedunia': 'World Health Day',
  'Hari Bumi': 'Earth Day',
  'Hari Kebebasan Pers Sedunia': 'World Press Freedom Day',
  'Hari Lingkungan Hidup Sedunia': 'World Environment Day',
  'Hari Laut Sedunia': 'World Oceans Day',
  'Hari Persahabatan Internasional': 'International Day of Friendship',
  'Hari Pemuda Internasional': 'International Youth Day',
  'Hari Perdamaian Internasional': 'International Day of Peace',
  'Hari Guru Sedunia': 'World Teachers’ Day',
  'Hari Perserikatan Bangsa-Bangsa': 'United Nations Day',
  'Hari Toleransi Internasional': 'International Day for Tolerance',
  'Hari Anak Sedunia': 'World Children’s Day',
  'Hari Penghapusan Kekerasan terhadap Perempuan': 'International Day for the Elimination of Violence against Women',
  'Hari Disabilitas Internasional': 'International Day of Persons with Disabilities',
  'Hari Hak Asasi Manusia': 'Human Rights Day',
  'Hari Kartini': 'Kartini Day',
  'Hari Pendidikan Nasional': 'National Education Day',
  'Hari Kebangkitan Nasional': 'National Awakening Day',
  'Hari Sumpah Pemuda': 'Youth Pledge Day',
  'Hari Pahlawan': 'Heroes’ Day',
  'Hari Guru Nasional': 'National Teachers’ Day',
  'Hari Ibu': 'Mother’s Day',
};

export function holidays(key) {
  const year = key.slice(0, 4);
  const day = key.slice(5);
  return [
    [national[year]?.[day], t('Libur nasional', 'Public holiday'), 'red'],
    [leave[year]?.[day], t('Cuti bersama', 'Joint leave'), 'orange'],
    [commemorations[day], t('Peringatan nasional', 'National observance'), 'violet'],
    [observances[day], t('Peringatan internasional', 'International observance'), 'violet'],
  ].filter(([name]) => name).map(([name, kind, color]) => [t(name, englishNames[name] || name), kind, color]);
}
