/**
 * Ekstrüzyon hızı: ekranda m/dakika, veritabanında (bom_extrusion.target_m_per_hour) m/saat.
 * OEE ideal süresi saat bazında hesaplandığı için saklama birimi değişmez.
 */
export const mPerMinToHour = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 60 * 10000) / 10000);
export const mPerHourToMin = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round((v / 60) * 10000) / 10000);
