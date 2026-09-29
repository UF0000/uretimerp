/**
 * Eksik veri kontrolü: hesaplamaları (üretim girişi, OEE, overweight, kapasite,
 * referans hız, maliyet, MRP, kalite) etkileyen ana veri boşlukları.
 * Saf fonksiyon; veri app/actions/data-quality içinde toplanır.
 */

export type IssueArea = "Reçete" | "Ürün" | "Kalıp" | "Makine" | "Hammadde" | "Depo" | "Parametre";
/** blocker: işlem/hesap hiç yapılamaz · warning: hesap eksik veya yanlış çıkar */
export type IssueSeverity = "blocker" | "warning";

export interface DataIssue {
  key: string;
  area: IssueArea;
  severity: IssueSeverity;
  subject: string;
  detail?: string;
  problem: string;
  effect: string;
  href: string;
  fixHint: string;
}

export interface DqBom {
  id: string;
  code: string;
  productId: string;
  productCode: string;
  productName: string;
  productionType: "extrusion" | "injection";
  materialGroup: string | null;
  diameterMm: number | null;
  sdr: number | null;
  itemCount: number;
  componentIds: string[];
  extrusion: { lineId: string | null; kgPerMeter: number | null; targetMPerHour: number | null } | null;
  injection: {
    moldId: string | null;
    cavityCount: number | null;
    cycleTimeSec: number | null;
    productWeightG: number | null;
  } | null;
}

export interface DqInput {
  boms: DqBom[];
  molds: Map<string, { code: string; name: string; active: boolean; cavityCount: number; cycleTimeSec: number; productWeightG: number | null }>;
  lines: { id: string; code: string; name: string; lineType: string | null; hasCurrentCapacity: boolean }[];
  components: Map<string, { code: string; name: string; type: string; unitCost: number | null; currency: string | null }>;
  references: { materialGroup: string; diameterMm: number; sdr: number | null }[];
  warehouseTypes: Set<string>;
  rates: { usd: number; eur: number };
}

const positive = (v: number | null | undefined) => v !== null && v !== undefined && v > 0;

/** İçe aktarımda çevrim süresi bulunamazsa 10 sn yazılır; gerçek değer olup olmadığı kontrol edilmeli. */
const IMPORT_DEFAULT_CYCLE_SEC = 10;

export function findDataIssues(input: DqInput): DataIssue[] {
  const issues: DataIssue[] = [];
  const add = (i: DataIssue) => issues.push(i);

  for (const b of input.boms) {
    const subject = `${b.productCode} — ${b.productName}`;
    const detail = `Reçete ${b.code}`;
    const href = `/recete/${b.id}`;

    if (b.itemCount === 0) {
      add({ key: `bom-items-${b.id}`, area: "Reçete", severity: "blocker", subject, detail, problem: "Reçetede hammadde yok", effect: "Üretim girişinde tüketim, maliyet ve MRP hammadde ihtiyacı", href, fixHint: "Reçeteye hammadde ekleyin" });
    }

    if (b.productionType === "extrusion" && b.extrusion) {
      const e = b.extrusion;
      if (!positive(e.kgPerMeter)) {
        add({ key: `bom-kgm-${b.id}`, area: "Reçete", severity: "blocker", subject, detail, problem: "Metre ağırlığı (kg/m) yok", effect: "Overweight, nominal kg, MRP hammadde ihtiyacı", href, fixHint: "Reçetede kg/m girin" });
      }
      if (!positive(e.targetMPerHour)) {
        add({ key: `bom-speed-${b.id}`, area: "Reçete", severity: "warning", subject, detail, problem: "Hedef hız (m/dk) yok", effect: "OEE performansı ve OEE", href, fixHint: "Reçetede hedef hız girin" });
      }
      if (!e.lineId) {
        add({ key: `bom-line-${b.id}`, area: "Reçete", severity: "warning", subject, detail, problem: "Reçetede makine (hat) seçili değil", effect: "İş emrinde hat seçilmezse makine kapasitesi ve hat bazlı analiz", href, fixHint: "Reçetede hat seçin" });
      }
      // SDR zorunlu değil: v_production_analytics'teki gibi referansta ya da üründe SDR boşsa çapa göre eşleşir
      const missingDims = [!b.materialGroup && "malzeme grubu", !positive(b.diameterMm) && "çap"].filter(Boolean);
      if (missingDims.length) {
        add({ key: `prod-dims-${b.productId}`, area: "Ürün", severity: "warning", subject, problem: `Ürün kartında ${missingDims.join(", ")} yok`, effect: "Referansa göre hız (referans kapasite eşleşmesi)", href: "/ana-veri", fixHint: "Ana Veri → ürünü düzenleyin" });
      } else {
        const matched = input.references.some(
          (r) => r.materialGroup === b.materialGroup && r.diameterMm === b.diameterMm && (r.sdr === null || b.sdr === null || r.sdr === b.sdr),
        );
        if (!matched) {
          add({ key: `prod-ref-${b.productId}`, area: "Ürün", severity: "warning", subject, detail: `${b.materialGroup} · Ø${b.diameterMm}${b.sdr ? ` · SDR ${b.sdr}` : ""}`, problem: "Uyan onaylı referans kapasite yok", effect: "Referansa göre hız", href: "/yonetim", fixHint: "Yönetim → Referans Kapasite'ye ekleyin" });
        }
      }
    }

    if (b.productionType === "injection" && b.injection) {
      const i = b.injection;
      const mold = i.moldId ? input.molds.get(i.moldId) : undefined;
      if (!mold) {
        add({ key: `bom-mold-${b.id}`, area: "Reçete", severity: "warning", subject, detail, problem: "Reçetede kalıp seçili değil", effect: "Kalıp atış sayacı; çevrim/göz reçetede yoksa OEE", href, fixHint: "Reçetede kalıp seçin" });
      }
      const cycle = positive(i.cycleTimeSec) ? i.cycleTimeSec : mold?.cycleTimeSec;
      if (!positive(cycle)) {
        add({ key: `bom-cycle-${b.id}`, area: "Reçete", severity: "blocker", subject, detail, problem: "Çevrim süresi yok (reçetede de kalıpta da)", effect: "Üretim verisinde ideal süre, OEE performansı", href, fixHint: "Reçetede veya kalıpta çevrim süresi girin" });
      }
      const weight = positive(i.productWeightG) ? i.productWeightG : mold?.productWeightG;
      if (!positive(weight)) {
        add({ key: `bom-weight-${b.id}`, area: "Reçete", severity: "blocker", subject, detail, problem: "Parça ağırlığı (g) yok", effect: "Overweight, nominal kg, atış sayısı, MRP hammadde ihtiyacı", href, fixHint: "Reçetede parça ağırlığı girin" });
      }
    }

    for (const cid of b.componentIds) {
      const c = input.components.get(cid);
      if (!c) continue;
      if (!positive(c.unitCost)) {
        add({ key: `cost-${cid}`, area: "Hammadde", severity: "warning", subject: `${c.code} — ${c.name}`, problem: "Birim fiyat yok", effect: "Üretim maliyeti (hammadde bedeli 0 sayılır)", href: "/ana-veri", fixHint: "Ana Veri → birim fiyat girin" });
      }
    }
  }

  // ── Kalıplar: içe aktarımdan kalan varsayılan çevrim süresi ──
  for (const [id, m] of input.molds) {
    if (!m.active) continue;
    if (m.cycleTimeSec === IMPORT_DEFAULT_CYCLE_SEC) {
      add({ key: `mold-cycle-${id}`, area: "Kalıp", severity: "warning", subject: `${m.code} — ${m.name}`, problem: "Çevrim süresi 10 sn (içe aktarımda varsayılan olabilir)", effect: "OEE performansı, ideal süre", href: "/ana-veri", fixHint: "Ana Veri → Kalıp & Hatlar'da doğrulayın" });
    }
    if (!positive(m.productWeightG)) {
      add({ key: `mold-weight-${id}`, area: "Kalıp", severity: "warning", subject: `${m.code} — ${m.name}`, problem: "Parça ağırlığı yok", effect: "Reçetede de yoksa overweight ve atış hesabı", href: "/ana-veri", fixHint: "Ana Veri → Kalıp & Hatlar" });
    }
  }

  // ── Makineler ──
  for (const l of input.lines) {
    const subject = `${l.code} — ${l.name}`;
    if (!l.lineType) {
      add({ key: `line-type-${l.id}`, area: "Makine", severity: "blocker", subject, problem: "Makine türü (ekstrüder/enjeksiyon) yok", effect: "Üretim analizi panosunda görünmez", href: "/ana-veri", fixHint: "Ana Veri → Kalıp & Hatlar" });
    } else if (!l.hasCurrentCapacity) {
      add({ key: `line-cap-${l.id}`, area: "Makine", severity: "warning", subject, problem: "Bugün geçerli kapasite yok", effect: "NŞA kapasite, kapasite verimi, beklenen üretim", href: "/yonetim", fixHint: "Yönetim → Makine Kapasitesi" });
    }
  }

  // ── Depolar ──
  const needWarehouse: [string, string, string][] = [
    ["quarantine", "Karantina deposu yok", "NCR'de karantina transferi"],
    ["regrind", "Regrind deposu yok", "Üretim girişinde regrind'e ayrılan fire"],
    ["scrap", "Hurda deposu yok", "Üretim girişinde hurdaya ayrılan fire"],
  ];
  for (const [type, problem, effect] of needWarehouse) {
    if (!input.warehouseTypes.has(type)) {
      add({ key: `wh-${type}`, area: "Depo", severity: "blocker", subject: "Depolar", problem, effect, href: "/ana-veri", fixHint: "Ana Veri → Depolar" });
    }
  }

  // ── Kurlar: dövizli fiyatlı malzeme varken kur 1 ──
  const currencies = new Set([...input.components.values()].filter((c) => positive(c.unitCost)).map((c) => c.currency));
  for (const [cur, rate] of [["USD", input.rates.usd], ["EUR", input.rates.eur]] as const) {
    if (currencies.has(cur) && rate <= 1) {
      add({ key: `rate-${cur}`, area: "Parametre", severity: "warning", subject: `${cur} kuru`, problem: `${cur} fiyatlı malzeme var ama kur ${rate}`, effect: "Üretim maliyeti", href: "/yonetim", fixHint: "Yönetim → Parametreler" });
    }
  }

  // Aynı hammadde birden çok reçetede geçebilir: anahtara göre tekilleştir
  const unique = [...new Map(issues.map((i) => [i.key, i])).values()];
  return unique.sort((a, b) => (a.severity === b.severity ? a.area.localeCompare(b.area, "tr") || a.subject.localeCompare(b.subject, "tr") : a.severity === "blocker" ? -1 : 1));
}
