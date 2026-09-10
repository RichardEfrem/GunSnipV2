import type { ShippingZone } from '@gunsnip/shared';

/**
 * Indonesian administrative reference data for the dependent province → city → district
 * selects in checkout (FR-CO-03), and the flat shipping zone each province falls in (A4).
 *
 * All 38 provinces, with cities for every one and districts for the metros that actually
 * generate orders. Districts everywhere would be tens of thousands of rows for a select
 * almost nobody opens; the schema takes them wherever the operator later adds them.
 */

export interface CitySeed {
  name: string;
  postalCode?: string;
  districts?: readonly string[];
}

export interface ProvinceSeed {
  name: string;
  zone: ShippingZone;
  cities: readonly CitySeed[];
}

export const PROVINCES: readonly ProvinceSeed[] = [
  // ---- Java: where most orders land, so the deepest data.
  {
    name: 'DKI Jakarta',
    zone: 'JABODETABEK',
    cities: [
      { name: 'Jakarta Pusat', postalCode: '10110', districts: ['Gambir', 'Menteng', 'Tanah Abang', 'Senen', 'Cempaka Putih'] },
      { name: 'Jakarta Selatan', postalCode: '12110', districts: ['Kebayoran Baru', 'Kebayoran Lama', 'Setiabudi', 'Tebet', 'Pasar Minggu', 'Cilandak'] },
      { name: 'Jakarta Barat', postalCode: '11220', districts: ['Grogol Petamburan', 'Kebon Jeruk', 'Palmerah', 'Tambora', 'Cengkareng'] },
      { name: 'Jakarta Timur', postalCode: '13110', districts: ['Matraman', 'Jatinegara', 'Duren Sawit', 'Cakung', 'Pulo Gadung'] },
      { name: 'Jakarta Utara', postalCode: '14230', districts: ['Kelapa Gading', 'Tanjung Priok', 'Penjaringan', 'Pademangan'] },
    ],
  },
  {
    name: 'Jawa Barat',
    zone: 'JAVA',
    cities: [
      { name: 'Bandung', postalCode: '40111', districts: ['Coblong', 'Sukajadi', 'Cidadap', 'Bandung Wetan', 'Lengkong', 'Buahbatu'] },
      { name: 'Bekasi', postalCode: '17111', districts: ['Bekasi Selatan', 'Bekasi Timur', 'Bekasi Barat', 'Medan Satria'] },
      { name: 'Bogor', postalCode: '16111', districts: ['Bogor Tengah', 'Bogor Utara', 'Bogor Selatan', 'Tanah Sareal'] },
      { name: 'Depok', postalCode: '16411', districts: ['Beji', 'Pancoran Mas', 'Cimanggis', 'Sukmajaya'] },
      { name: 'Cirebon', postalCode: '45111' },
      { name: 'Sukabumi', postalCode: '43111' },
    ],
  },
  {
    name: 'Banten',
    zone: 'JAVA',
    cities: [
      { name: 'Tangerang', postalCode: '15111', districts: ['Cipondoh', 'Karawaci', 'Ciledug', 'Batuceper'] },
      { name: 'Tangerang Selatan', postalCode: '15310', districts: ['Serpong', 'Pondok Aren', 'Ciputat', 'Pamulang'] },
      { name: 'Serang', postalCode: '42111' },
      { name: 'Cilegon', postalCode: '42411' },
    ],
  },
  {
    name: 'Jawa Tengah',
    zone: 'JAVA',
    cities: [
      { name: 'Semarang', postalCode: '50111', districts: ['Semarang Tengah', 'Banyumanik', 'Tembalang', 'Candisari'] },
      { name: 'Surakarta', postalCode: '57111', districts: ['Laweyan', 'Banjarsari', 'Jebres', 'Serengan'] },
      { name: 'Magelang', postalCode: '56111' },
      { name: 'Pekalongan', postalCode: '51111' },
      { name: 'Purwokerto', postalCode: '53111' },
    ],
  },
  {
    name: 'DI Yogyakarta',
    zone: 'JAVA',
    cities: [
      { name: 'Yogyakarta', postalCode: '55111', districts: ['Gondokusuman', 'Umbulharjo', 'Mergangsan', 'Jetis', 'Kotagede'] },
      { name: 'Sleman', postalCode: '55511', districts: ['Depok', 'Mlati', 'Ngaglik', 'Gamping'] },
      { name: 'Bantul', postalCode: '55711' },
    ],
  },
  {
    name: 'Jawa Timur',
    zone: 'JAVA',
    cities: [
      { name: 'Surabaya', postalCode: '60111', districts: ['Gubeng', 'Wonokromo', 'Tegalsari', 'Sukolilo', 'Rungkut', 'Mulyorejo'] },
      { name: 'Malang', postalCode: '65111', districts: ['Klojen', 'Lowokwaru', 'Blimbing', 'Sukun'] },
      { name: 'Sidoarjo', postalCode: '61211' },
      { name: 'Kediri', postalCode: '64111' },
      { name: 'Jember', postalCode: '68111' },
    ],
  },

  // ---- Bali and Nusa Tenggara
  {
    name: 'Bali',
    zone: 'BALI_NUSA',
    cities: [
      { name: 'Denpasar', postalCode: '80111', districts: ['Denpasar Barat', 'Denpasar Timur', 'Denpasar Selatan', 'Denpasar Utara'] },
      { name: 'Badung', postalCode: '80351' },
      { name: 'Gianyar', postalCode: '80511' },
      { name: 'Singaraja', postalCode: '81111' },
    ],
  },
  { name: 'Nusa Tenggara Barat', zone: 'BALI_NUSA', cities: [{ name: 'Mataram', postalCode: '83111' }, { name: 'Bima', postalCode: '84111' }, { name: 'Sumbawa Besar', postalCode: '84311' }] },
  { name: 'Nusa Tenggara Timur', zone: 'BALI_NUSA', cities: [{ name: 'Kupang', postalCode: '85111' }, { name: 'Ende', postalCode: '86311' }, { name: 'Maumere', postalCode: '86111' }] },

  // ---- Sumatra
  { name: 'Aceh', zone: 'SUMATRA', cities: [{ name: 'Banda Aceh', postalCode: '23111' }, { name: 'Lhokseumawe', postalCode: '24351' }, { name: 'Langsa', postalCode: '24411' }] },
  {
    name: 'Sumatera Utara',
    zone: 'SUMATRA',
    cities: [
      { name: 'Medan', postalCode: '20111', districts: ['Medan Kota', 'Medan Baru', 'Medan Petisah', 'Medan Selayang'] },
      { name: 'Binjai', postalCode: '20711' },
      { name: 'Pematangsiantar', postalCode: '21111' },
    ],
  },
  { name: 'Sumatera Barat', zone: 'SUMATRA', cities: [{ name: 'Padang', postalCode: '25111' }, { name: 'Bukittinggi', postalCode: '26111' }, { name: 'Payakumbuh', postalCode: '26211' }] },
  { name: 'Riau', zone: 'SUMATRA', cities: [{ name: 'Pekanbaru', postalCode: '28111' }, { name: 'Dumai', postalCode: '28811' }] },
  { name: 'Kepulauan Riau', zone: 'SUMATRA', cities: [{ name: 'Batam', postalCode: '29411' }, { name: 'Tanjung Pinang', postalCode: '29111' }] },
  { name: 'Jambi', zone: 'SUMATRA', cities: [{ name: 'Jambi', postalCode: '36111' }, { name: 'Sungai Penuh', postalCode: '37111' }] },
  { name: 'Sumatera Selatan', zone: 'SUMATRA', cities: [{ name: 'Palembang', postalCode: '30111' }, { name: 'Lubuklinggau', postalCode: '31611' }, { name: 'Prabumulih', postalCode: '31111' }] },
  { name: 'Kepulauan Bangka Belitung', zone: 'SUMATRA', cities: [{ name: 'Pangkal Pinang', postalCode: '33111' }, { name: 'Tanjung Pandan', postalCode: '33411' }] },
  { name: 'Bengkulu', zone: 'SUMATRA', cities: [{ name: 'Bengkulu', postalCode: '38111' }, { name: 'Curup', postalCode: '39119' }] },
  { name: 'Lampung', zone: 'SUMATRA', cities: [{ name: 'Bandar Lampung', postalCode: '35111' }, { name: 'Metro', postalCode: '34111' }] },

  // ---- Kalimantan
  { name: 'Kalimantan Barat', zone: 'KALIMANTAN', cities: [{ name: 'Pontianak', postalCode: '78111' }, { name: 'Singkawang', postalCode: '79111' }] },
  { name: 'Kalimantan Tengah', zone: 'KALIMANTAN', cities: [{ name: 'Palangka Raya', postalCode: '73111' }, { name: 'Sampit', postalCode: '74322' }] },
  { name: 'Kalimantan Selatan', zone: 'KALIMANTAN', cities: [{ name: 'Banjarmasin', postalCode: '70111' }, { name: 'Banjarbaru', postalCode: '70711' }] },
  { name: 'Kalimantan Timur', zone: 'KALIMANTAN', cities: [{ name: 'Samarinda', postalCode: '75111' }, { name: 'Balikpapan', postalCode: '76111' }, { name: 'Bontang', postalCode: '75311' }] },
  { name: 'Kalimantan Utara', zone: 'KALIMANTAN', cities: [{ name: 'Tarakan', postalCode: '77111' }, { name: 'Tanjung Selor', postalCode: '77212' }] },

  // ---- Sulawesi
  { name: 'Sulawesi Utara', zone: 'SULAWESI', cities: [{ name: 'Manado', postalCode: '95111' }, { name: 'Bitung', postalCode: '95511' }, { name: 'Tomohon', postalCode: '95411' }] },
  { name: 'Gorontalo', zone: 'SULAWESI', cities: [{ name: 'Gorontalo', postalCode: '96111' }, { name: 'Limboto', postalCode: '96211' }] },
  { name: 'Sulawesi Tengah', zone: 'SULAWESI', cities: [{ name: 'Palu', postalCode: '94111' }, { name: 'Luwuk', postalCode: '94711' }] },
  { name: 'Sulawesi Barat', zone: 'SULAWESI', cities: [{ name: 'Mamuju', postalCode: '91511' }, { name: 'Majene', postalCode: '91411' }] },
  {
    name: 'Sulawesi Selatan',
    zone: 'SULAWESI',
    cities: [
      { name: 'Makassar', postalCode: '90111', districts: ['Panakkukang', 'Rappocini', 'Tamalate', 'Biringkanaya'] },
      { name: 'Parepare', postalCode: '91111' },
      { name: 'Palopo', postalCode: '91911' },
    ],
  },
  { name: 'Sulawesi Tenggara', zone: 'SULAWESI', cities: [{ name: 'Kendari', postalCode: '93111' }, { name: 'Baubau', postalCode: '93711' }] },

  // ---- Maluku and Papua
  { name: 'Maluku', zone: 'MALUKU_PAPUA', cities: [{ name: 'Ambon', postalCode: '97111' }, { name: 'Tual', postalCode: '97611' }] },
  { name: 'Maluku Utara', zone: 'MALUKU_PAPUA', cities: [{ name: 'Ternate', postalCode: '97711' }, { name: 'Tidore', postalCode: '97815' }, { name: 'Sofifi', postalCode: '97852' }] },
  { name: 'Papua', zone: 'MALUKU_PAPUA', cities: [{ name: 'Jayapura', postalCode: '99111' }, { name: 'Sentani', postalCode: '99352' }] },
  { name: 'Papua Barat', zone: 'MALUKU_PAPUA', cities: [{ name: 'Manokwari', postalCode: '98311' }, { name: 'Fakfak', postalCode: '98611' }] },
  { name: 'Papua Barat Daya', zone: 'MALUKU_PAPUA', cities: [{ name: 'Sorong', postalCode: '98411' }, { name: 'Raja Ampat', postalCode: '98482' }] },
  { name: 'Papua Tengah', zone: 'MALUKU_PAPUA', cities: [{ name: 'Nabire', postalCode: '98811' }, { name: 'Timika', postalCode: '99910' }] },
  { name: 'Papua Pegunungan', zone: 'MALUKU_PAPUA', cities: [{ name: 'Wamena', postalCode: '99511' }, { name: 'Tolikara', postalCode: '99562' }] },
  { name: 'Papua Selatan', zone: 'MALUKU_PAPUA', cities: [{ name: 'Merauke', postalCode: '99611' }, { name: 'Tanah Merah', postalCode: '99663' }] },
];

/**
 * Flat courier rates (A4, FR-CO-04). Same-day exists only where a courier actually offers it,
 * which is why the table is a list rather than a zone × tier grid — an empty cell would have
 * to mean "unavailable" and a price of 0 would be a bug waiting to happen.
 */
export const SHIPPING_RATES: readonly {
  zone: ShippingZone;
  tier: 'REGULAR' | 'EXPRESS' | 'SAME_DAY';
  priceIdr: number;
  minDays: number;
  maxDays: number;
}[] = [
  { zone: 'JABODETABEK', tier: 'REGULAR', priceIdr: 15000, minDays: 1, maxDays: 2 },
  { zone: 'JABODETABEK', tier: 'EXPRESS', priceIdr: 30000, minDays: 1, maxDays: 1 },
  { zone: 'JABODETABEK', tier: 'SAME_DAY', priceIdr: 55000, minDays: 0, maxDays: 0 },
  { zone: 'JAVA', tier: 'REGULAR', priceIdr: 22000, minDays: 2, maxDays: 3 },
  { zone: 'JAVA', tier: 'EXPRESS', priceIdr: 45000, minDays: 1, maxDays: 2 },
  { zone: 'BALI_NUSA', tier: 'REGULAR', priceIdr: 35000, minDays: 3, maxDays: 5 },
  { zone: 'BALI_NUSA', tier: 'EXPRESS', priceIdr: 68000, minDays: 2, maxDays: 3 },
  { zone: 'SUMATRA', tier: 'REGULAR', priceIdr: 38000, minDays: 3, maxDays: 6 },
  { zone: 'SUMATRA', tier: 'EXPRESS', priceIdr: 72000, minDays: 2, maxDays: 3 },
  { zone: 'KALIMANTAN', tier: 'REGULAR', priceIdr: 45000, minDays: 4, maxDays: 7 },
  { zone: 'KALIMANTAN', tier: 'EXPRESS', priceIdr: 85000, minDays: 2, maxDays: 4 },
  { zone: 'SULAWESI', tier: 'REGULAR', priceIdr: 48000, minDays: 4, maxDays: 7 },
  { zone: 'SULAWESI', tier: 'EXPRESS', priceIdr: 90000, minDays: 3, maxDays: 4 },
  { zone: 'MALUKU_PAPUA', tier: 'REGULAR', priceIdr: 75000, minDays: 6, maxDays: 12 },
  { zone: 'MALUKU_PAPUA', tier: 'EXPRESS', priceIdr: 140000, minDays: 4, maxDays: 7 },
];
