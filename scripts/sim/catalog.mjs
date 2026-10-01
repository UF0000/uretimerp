// Simülasyonun ürettiği / sattığı ürünler ve kullandığı hammaddeler (test veritabanındaki kodlar).

/** Hammaddeler: tedarikçi, fiyat (₺/kg), en az sipariş, min stok */
export const RAWS = [
  { code: "PP.000.N.003.27", supplier: "Anadolu Polimer A.Ş. (sim)", price: 62, moq: 1000, minStock: 1500 },
  { code: "MAS.PP.BL.70023.27", supplier: "Renkli Masterbatch Ltd. (sim)", price: 180, moq: 100, minStock: 50 },
  { code: "PP.GRA.GN.000.27", supplier: "Anadolu Polimer A.Ş. (sim)", price: 70, moq: 1000, minStock: 1000 },
  { code: "PE.080.BK.001.27", supplier: "Ege Petrokimya Ticaret (sim)", price: 55, moq: 1000, minStock: 1500 },
  { code: "MAS.PE.BK.223912.27", supplier: "Renkli Masterbatch Ltd. (sim)", price: 150, moq: 100, minStock: 50 },
  { code: "PE.100.BK.003.27", supplier: "Ege Petrokimya Ticaret (sim)", price: 58, moq: 1000, minStock: 1000 },
];

export const CUSTOMERS = ["Akdeniz Yapı Market (sim)", "Ege Tesisat Ltd. (sim)", "Marmara İnşaat A.Ş. (sim)", "Karadeniz Su Sistemleri (sim)", "İç Anadolu Hırdavat (sim)"];

/**
 * Ürünler. Ekstrüzyon: kg/m çap + et kalınlığından (et = ürün kartı ya da çap / SDR),
 * hedef hız = hat kg/saat ÷ kg/m. Enjeksiyon: göz/çevrim/ağırlık ürüne bağlı kalıptan.
 * order = [en az, en çok, yuvarlama] sipariş miktarı.
 */
export const PRODUCTS = [
  // PP-R boru (mavi), PP ekstrüder
  { code: "A1A0420L4", type: "extrusion", line: "PP", raws: [["PP.000.N.003.27", 98], ["MAS.PP.BL.70023.27", 2]], scrap: "FİRE.PP.03", density: 0.905, kgPerHour: 170, order: [400, 3000, 100] },
  { code: "A1A0425L4", type: "extrusion", line: "PP", raws: [["PP.000.N.003.27", 98], ["MAS.PP.BL.70023.27", 2]], scrap: "FİRE.PP.03", density: 0.905, kgPerHour: 180, order: [400, 2400, 100] },
  { code: "A1A0432L4", type: "extrusion", line: "PP", raws: [["PP.000.N.003.27", 98], ["MAS.PP.BL.70023.27", 2]], scrap: "FİRE.PP.03", density: 0.905, kgPerHour: 190, order: [200, 1600, 100] },
  // HDPE boru (siyah), PE ekstrüder; EN 1519 et kalınlıkları
  { code: "D.050.000.01", type: "extrusion", line: "PE", raws: [["PE.080.BK.001.27", 97], ["MAS.PE.BK.223912.27", 3]], scrap: "FİRE.PE.01", density: 0.955, kgPerHour: 220, wall: 3.0, order: [300, 2000, 100] },
  { code: "D.063.000.01", type: "extrusion", line: "PE", raws: [["PE.080.BK.001.27", 97], ["MAS.PE.BK.223912.27", 3]], scrap: "FİRE.PE.01", density: 0.955, kgPerHour: 230, wall: 3.0, order: [300, 2000, 100] },
  { code: "D.110.000.01", type: "extrusion", line: "PE", raws: [["PE.080.BK.001.27", 97], ["MAS.PE.BK.223912.27", 3]], scrap: "FİRE.PE.01", density: 0.955, kgPerHour: 260, wall: 4.2, order: [200, 1200, 100] },
  // PP-R fitting (yeşil), ENJ 160
  { code: "V1C012020", type: "injection", line: "ENJ160", raws: [["PP.GRA.GN.000.27", 100]], scrap: "FİRE.PP.01", order: [2000, 12000, 500] },
  { code: "V1C052020", type: "injection", line: "ENJ160", raws: [["PP.GRA.GN.000.27", 100]], scrap: "FİRE.PP.01", order: [2000, 10000, 500] },
  { code: "V1C032020", type: "injection", line: "ENJ160", raws: [["PP.GRA.GN.000.27", 100]], scrap: "FİRE.PP.01", order: [2000, 10000, 500] },
  // HDPE fitting (siyah), ENJ 260 / 480
  { code: "D.063.ENJ.21", type: "injection", line: "ENJ 260", raws: [["PE.100.BK.003.27", 100]], scrap: "FİRE.PE.01", order: [200, 1500, 50] },
  { code: "D.110.000.04", type: "injection", line: "ENJ 260", raws: [["PE.100.BK.003.27", 100]], scrap: "FİRE.PE.01", order: [100, 800, 50] },
  { code: "D.125.063.07", type: "injection", line: "ENJ 480", raws: [["PE.100.BK.003.27", 100]], scrap: "FİRE.PE.01", order: [50, 400, 10] },
];

export const QUARANTINE_WAREHOUSE = "Karantina";
export const FINISHED_WAREHOUSE = "Mamül";
export const RAW_WAREHOUSE = "Hammadde";
