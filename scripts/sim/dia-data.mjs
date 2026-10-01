// DIA "İş Emirleri" sayfalarını okur (boru + fitting üretim raporu Excel'leri).
// Sayılar "1,234.567" / "96.10%", tarihler "08.01.2026 08:00" (Türkiye saati) biçiminde gelir.
import XLSX from "xlsx";

const num = (s) => (s === "" || s == null ? null : Number(String(s).replace(/,/g, "").replace("%", "")));
/** "08.01.2026 08:00" (TR) → Date (UTC+3) */
const trDateTime = (s) => {
  const m = String(s).match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+)/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - 3, +m[5])) : null;
};

function sheetRows(file, sheet) {
  const ws = XLSX.readFile(file).Sheets[sheet];
  if (!ws) throw new Error(`${file}: "${sheet}" sayfası yok`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  const head = rows[3];
  return rows.slice(4).filter((r) => r[0]).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

/** Tek tip iş emri kaydı */
export function readDiaWorkOrders(pipeFile, fittingFile) {
  const pipes = sheetRows(pipeFile, "İş Emirleri").map((r) => ({
    type: "extrusion",
    no: r["Üretim Emri"],
    start: trDateTime(r["Başlangıç"]),
    end: trDateTime(r["Bitiş"]),
    machine: r["Makine"],
    shift: r["Vardiya"],
    productCode: r["Ürün kodu"],
    productName: r["Ürün adı"],
    material: r["Hammadde türü"],
    produced: num(r["Üretim (M)"]),
    goodKg: num(r["Sağlam (KG)"]),
    usedKg: num(r["Tüketim (KG)"]),
    scrapKg: num(r["Fire (KG)"]),
    downtimeMin: num(r["Duruş (DK)"]),
    grossMin: num(r["Brüt süre (DK)"]),
    netMin: num(r["Net süre (DK)"]),
    lineSpeedMPerMin: num(r["Hat hızı (M/DK)"]),
    overweightPct: num(r["Fazla ağırlık (OW %)"]),
    oePct: num(r["OE (%)"]),
  }));
  const fittings = sheetRows(fittingFile, "İş Emirleri").map((r) => ({
    type: "injection",
    no: r["Üretim Emri"],
    start: trDateTime(r["Başlangıç"]),
    end: trDateTime(r["Bitiş"]),
    machine: r["Makine"],
    shift: r["Vardiya"],
    productCode: r["Ürün kodu"],
    productName: r["Ürün adı"],
    material: r["Hammadde türü"],
    produced: num(r["Üretim (Adet)"]),
    goodKg: num(r["Sağlam (KG)"]),
    usedKg: num(r["Tüketim (KG)"]),
    scrapKg: num(r["Fire (KG)"]),
    downtimeMin: num(r["Duruş (DK)"]),
    grossMin: num(r["Brüt süre (DK)"]),
    netMin: num(r["Net süre (DK)"]),
    moldType: r["Kalıp türü"],
    stdCycleSecPerPart: num(r["Standart çevrim (SN)"]),
    runnerKg: num(r["Yolluk (KG)"]) ?? 0,
    oePct: num(r["OE (%)"]),
  }));
  return [...pipes, ...fittings];
}
