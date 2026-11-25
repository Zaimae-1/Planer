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

export function holidays(key) {
  const year = key.slice(0, 4);
  const day = key.slice(5);
  return [
    [national[year]?.[day], 'Libur nasional', 'red'],
    [leave[year]?.[day], 'Cuti bersama', 'orange'],
    [commemorations[day], 'Peringatan nasional', 'violet'],
    [observances[day], 'Peringatan internasional', 'violet'],
  ].filter(([name]) => name);
}
