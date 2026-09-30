# CLAUDE.md — ÜRETİM ERP / MRP

> Proje kod adı: **ÜRETİM ERP** (dilediğin isimle değiştir).
> Bu dosya Claude Code'un her oturumda okuyacağı "beyin" dosyasıdır.
> Kısa ve güncel tutulur; tamamlanan işler zamanla "Hafıza / Durum" bölümünden temizlenir.
> Detaylı modül dokümanları gerekirse `/docs/*.md` altına ayrılır, bu dosya şişirilmez.

---

## 1. Genel Bakış

Bir **plastik imalat fabrikası** için **kolay kullanılan ama profesyonel ve güvenli** bir
ERP/MRP web uygulaması. Üretim iki tiptir: **ekstrüzyon** (boru vb.) ve **enjeksiyon** (fitting/parça).
Kapsam: **üretim takibi, depo/stok, maliyet, reçete (BOM), sipariş ve kalite**.
**Muhasebe bu sistemin dışındadır ve entegre edilmez.** Arayüz ve tüm kullanıcı metinleri **Türkçe**.

Plastik sektörüne özgü gereksinimler baştan tasarıma dahildir: karışım reçeteleri
(polimer + masterbatch + katkı + **regrind** oranları), **kalıp** yönetimi (göz sayısı, çevrim
süresi, atış sayacı), **hurda/regrind** takibi (grade bazlı, geri kazanım değeriyle), çevrim
süresi / **OEE**, ve reçine lotundan mamule **parti izlenebilirliği** (soyağacı).

---

## 2. Teknoloji Yığını (versiyonlar önemli)

| Katman | Seçim |
|---|---|
| Framework | **Next.js 16** (App Router) + **TypeScript** (strict) |
| Stil | **Tailwind CSS v4** |
| UI Kütüphanesi | **shadcn/ui** (Radix primitives) + **Lucide** ikonlar |
| Backend / DB | **Supabase** — PostgreSQL + Auth + Row Level Security + Storage |
| Durum yönetimi | **Zustand** |
| Form + doğrulama | **React Hook Form** + **Zod** |
| Tablolar | **TanStack Table** (veri yoğun listeler için) |
| Dağıtım | **Vercel** |

---

## 3. Proje Kuralları

### ✅ Yapılacaklar
- **Fonksiyonel bileşenler** ve arrow function kullan (modern React).
- **TypeScript strict mode** — tip güvenliğinden ödün verme.
- **Tailwind utility sınıfları** ile stil ver.
- Tüm form doğrulamalarında **Zod** kullan; `zod` yerine `@/lib/zod` içe aktar (Türkçe hata mesajları).
- Varsayılan **Server Component**; etkileşim gerekiyorsa Client Component (`"use client"`).
- Her tabloya **Supabase RLS** (satır düzeyi güvenlik) uygula.
- **Stok yalnızca hareket kaydıyla değişir** (append-only ledger; bkz. Bölüm 6). Stok alanı elle güncellenmez.
- Sayı/para formatı: **nokta = binlik, virgül = ondalık** (örn. `12.500,75`). Ortak `formatTR()` / `parseTR()` yardımcıları kullan.
- Tüm kullanıcı metinleri **Türkçe**; butonlar ne yaptığını söyler ("Kaydet", "Üretim gir").

### ⛔ Yasaklar
- **Inline style yok** (`style="..."` kullanma).
- **`any` tipi yok** (TypeScript'in amacını bozma).
- **Production kodunda `console.log` yok.**
- **Barrel export yok** (`index.ts` ile toplu re-export — döngüsel bağımlılık riski).
- **Sabit (hard-coded) renk yok** — tüm renkler tasarım token'larından gelir (tema sonradan değişebilsin).
- **Stok alanına doğrudan yazma yok** — sadece hareket ekle.
- **Repoya sır (API key, token, şifre) commit'leme** — `.env.local` + Vercel env kullan.

---

## 4. Mimari & Klasör Yapısı

```
app/
  (auth)/login/              # Giriş
  (app)/
    dashboard/               # Panel
  (workspace)/calisma/       # Sekmeli çalışma alanı (sayfalar sekme içinde açılır)
    ana-veri/                # Ürün, hammadde, cari, depo
    recete/                  # BOM / reçete
    depo/                    # Stok, hareketler, sayım, izlenebilirlik
    siparis/                 # Siparişler + net ihtiyaç (MRP)
    uretim/                  # İş emri + üretim girişi
    maliyet/                 # Maliyet raporları
    kalite/                  # Kalite kontrol + NCR
    yonetim/                 # Kullanıcı/rol, loglar, dışa aktarım
components/
  ui/                        # shadcn/ui bileşenleri
  shared/                    # Tablo, form, modal, badge, boş-durum, sayfa başlığı
lib/
  supabase/                  # client, server, middleware
  format.ts                  # formatTR() / parseTR() (nokta/virgül kuralı)
  stock.ts                   # getStock(), addStockMovement()  ← tek stok değiştirme yolu
  auth.ts                    # oturum + requirePermission (sunucu)
  permissions.ts             # rol → yetki matrisi (sunucu + tarayıcı)
stores/                      # Zustand store'ları
supabase/
  migrations/                # SQL şema + RLS politikaları
```

---

## 5. Hafıza / Durum (Memory / Status)

> Son güncelleme: 2026-09-29 — `[~]` = kısmen var, eksiği yanında yazılı.

**Faz 0 — İskelet**
- [x] Next.js + TS + Tailwind + shadcn kurulumu, klasör yapısı
- [x] Tasarım token'ları + ortak layout (yan menü + üst bar)
- [x] `format.ts` (nokta/virgül) ve `stock.ts` (getStock/addStockMovement) yardımcıları
- [x] Supabase bağlantısı, Auth + proxy; profil yoksa/pasifse uygulamaya giriş yok
- [x] DB tipleri `lib/supabase/database.types.ts` (`npm run db:types`), migration CI

- [x] **Sekmeli çalışma alanı** `/calisma` (`components/shared/workspace.tsx`): yan menü yok, tam ekran; tek üst çubuk (logo = ana sayfa, sekmeler, +, `UserMenu`); girişte ana sayfa (menü simgeleri ortada, `Launcher`); her sekme bir sayfayı iframe'de açık tutar (form durumu korunur), "+" → menü kartları, sekmeler sessionStorage'da; sekmeye sağ tık (`components/ui/context-menu.tsx`): yenile, çoğalt, sabitle (solda, kapatılamaz, localStorage `uretim-erp:sabit-sekmeler` ile girişte de açılır), kapat / diğerlerini / sağdakileri kapat; sürükleyerek sıra. Sayfalar `(app)` yerleşiminde yalnızca içerik + `EmbedBridge` (adres/başlık bildirir, başka bölüme giden bağlantı ve Ctrl+tık yeni sekme, sekmeye dönünce `router.refresh`). Doğrudan açılan sayfa `proxy` (Sec-Fetch-Dest: document) ile `/calisma?ac=…`'ya yönlenir

**Faz 1 — Omurga**
- [x] Ana veri CRUD (ürün/hammadde/kalıp/hat/cari/depo/neden kodları) + Excel içe aktarım
- [x] Ürün kartı: liste filtreleri (tür/aile/grup kodu/malzeme/varyant), görsel (Storage `product-images`), çift tık → `/ana-veri/urunler/[id]`: genel bilgi, stok, boyut (çap/et/SDR), teknik veri (reçete/kalıptan; düzenleme `save_bom` + kalıp güncelleme), hammadde, 12 ay hareket grafiği, varyantlar (+ toplamlar), otomatik standart maliyet (`lib/product-cost.ts`). Türler + Ticari mal/Hizmet; aile = `category` (boru, baglanti_parcasi=Fitting, metal…), sabitler `lib/product-meta.ts`
- Grup kodu (`products.group_code`, adlar `product_groups`, Ana Veri → Grup Kodları sekmesi; 01–27 "Stok Kodları.xlsx" KIRILIM sayfasından, 24 PP boru / 25 PP fittings / 26 multilayer): koddan otomatik (`groupCodeFromCode`, migration `20260930100000`): PE/sifonik son iki hane (D.110.090.**03**, D.040.ENJ.**21**), `.27` hammadde → 27, [renk]1A PP boru → 24, [renk]1C/1B PP fitting → 25; fire kodları grupsuz; multilayer (26) kodu henüz yok. Varyant = aynı `variant_code` (genel stok kodu); PP kuralı ilk harf renk + ilk "." sonrası ek atılır, son rakamdan sonra ek kalmaz (V1A012020.HENQ → 1A012020, V1A0320L4.UR.R → 1A0320L4; `20260930160000`); grup 24/25 genel kodu ve grup 01/24 aile = boru, boşsa DB tetikleyicisi `products_autofill` doldurur (`20260930150000`)
- Ekstrüzyon hızı ekranda **m/dk**, veritabanında `bom_extrusion.target_m_per_hour` (m/saat; OEE bu birimle) — dönüşüm `lib/speed.ts` (eski m/dk girişleri `20260929170000` ile ×60 çevrildi)
- Ürün listesi kaydırmalı (DataTable `scrollable`: sabit başlık, 100'er satır); satır seçip **toplu özellik güncelle** (ata / temizle, alan listesi `lib/product-bulk.ts`, `bulkUpdateProducts`; DataTable `selectionActions`, seçim id'ye bağlı). Grup 25 aile = Fitting (tetikleyici); filtreler çoklu seçim (`components/shared/multi-select.tsx`, `inSelection`); silme = pasif, "Silinen ürünler" görünümünden geri alınır (`restoreProducts`)
- Ürün kartı ek bölümleri: stok ve rezervasyon (kullanılabilir = kullanılabilir depolar − açık sipariş kalanı; karantina/hurda/regrind hariç), depo/lot, tahmini tükenme (90 gün ort. satış, hammaddede tüketim), üretim performansı (12 ay, `measure()`), kalite geçmişi, gerçekleşen maliyet (`getCompletedWorkOrdersForCosting(productId)`) — `app/actions/product-detail/insights.ts`; paketleme 3 kademe: iç poşet (`bag_type`/`bag_qty`) → kutu/paket (`package_type`/`package_qty`) → palet başına kutu (`pallet_qty`); standart kutular (süzgeç/küçük/orta/büyük) + palet dizilimi `lib/packaging.ts`; boruda paket miktarı metre (boru adedi = metre ÷ boy). Excel'den aktarım `20260929230000_product_bag_packaging.sql` (sifonik, PP boru ana koda göre tüm varyantlar, PP fitting; sorunlu satırlar boş bırakıldı), pipe_length_m, barcode, teknik dokümanlar (`product_documents`, özel bucket `product-documents`, imzalı indirme), tedarikçiler (`product_suppliers` + `supplier_prices`, fiyat eklerken kart fiyatı güncellenebilir) — `extras.ts`
- **Kalıp bakımı**: kalıp kartında `maintenance_interval_shots`; bakımdan beri atış = `total_shots − shots_at_last_maintenance` (%80 yaklaşıyor, %100 gecikti; `lib/mold-maintenance.ts` = `v_mold_maintenance`). Bakım kaydı `mold_maintenances` (operatör/admin ekler, admin siler), tetikleyici sayaç sıfır noktası + son bakım tarihini günceller; kalıp listesinde Bakım sütunu + anahtar düğmesi (`mold-maintenance-dialog.tsx`), panelde Kalıp Bakımı kartı
- Kalıp reçetede/iş emrinde elle seçilmez: kalıp kartındaki ürün bağından otomatik (`saveBom` boşsa ürüne bağlı aktif kalıbı atar); atış sayacı buna işlenir
- Depo stok listesi: çoklu depo seçimi, tür/aile/grup kodu/stok durumu filtresi, grup kodu sütunu, birim bazında toplam
- Arama her yerde `lib/search.ts` ile: kelime kelime (sıra önemsiz), Türkçe karakter/büyük-küçük harf ve 7,4/7.4 farkı yok; DataTable satırdaki tüm alanlarda arar (`searchKey` sadece kutuyu açar)
- DataTable varsayılanı kaydırmalı liste (`scrollable`); sayfalı gerekirse `scrollable={false}`
- Tüm DataTable'larda Excel gibi sütun genişliği (sürükle / çift tık sığdır, localStorage) — `components/shared/use-column-widths.ts`
- [x] Reçete / BOM + versiyonlama (`save_bom`: kullanılmış reçete düzenlenince yeni versiyon)
- [x] Stok defteri append-only (UPDATE/DELETE tetikleyiciyle yasak), iptal = ters kayıt, fiş iptali
- [x] `v_stock` / `v_stock_lot` + kritik/min rozetleri; regrind/hurda grade = ayrı ürün kartı (material_grade), tipine göre regrind/hurda deposu, stok sayfasında grade özeti

**Faz 2 — MRP çekirdeği**
- [x] Siparişler + net ihtiyaç (`/siparisler/ihtiyac`, hesap `lib/mrp.ts`): mamul üretim ihtiyacı, iş emri açılmalı, hammadde/ticari mal net eksik — tek seviye reçete, birim ağırlık reçeteden
- [x] **Satın alma önerisi** (net ihtiyaç sayfası, `purchase-suggestions.tsx`, `lib/purchase.ts`, `getPurchaseData`): MRP eksikleri + minimum altı hammadde/ticari mal; miktar = net eksik (+ ops. min stok) / min − stok, en az sipariş miktarına yuvarlanır; ana tedarikçi + güncel fiyat + teslim süresi; reçetesiz mamul "Reçete yok" (varsayılan hariç); düzenlenebilir miktar, Excel (tedarikçi başına sayfa). "Taslak sipariş oluştur" tedarikçi başına taslak açar
- [x] **Satın alma siparişi** `/siparisler/satin-alma` (`app/actions/purchase.ts`, migration `20261001090000`): taslak → sipariş verildi → teslim → kapandı / iptal; no `SA-YYYY-0001` (tetikleyici). Teslim alma `receive_purchase_order` RPC: `in_purchase` giriş fişi + hareket (`source_type='purchase'`, `source_id` = sipariş satırı, lot girilmezse sipariş no), hepsi gelince kapanır. Teslim alınan/kalan `v_purchase_order_items` hareketlerden (fiş iptali ters kayıtla düşer; view'a PostgREST ilişkisi yok, ayrı sorgula). Taslak yönetici düzenler/siler, teslim depo/yönetici; form tedarikçi fiyatını ve para birimini getirir
- [x] **Sevkiyat / irsaliye** `/siparisler/sevkiyat` (`app/actions/shipments.ts`, migration `20261001100000`): sipariş listesinde "Sevk et" → depo, lot, plaka, şoför, adres; `create_shipment` RPC stok (lot) yeterliliğini kontrol eder, `out_sale` fişi + hareket (`source_type='sale'`, `source_id` = sipariş satırı); tetikleyici `order_item_delivery_sync` `delivered_qty` ve sipariş durumunu (hepsi gidince done) günceller; `cancel_shipment` fişi ters kayıtla iptal eder. Yazdırılabilir A4 sevk irsaliyesi (`IRS-YYYY-0001`; yasal e-İrsaliye değil)
- [x] İş emri + vardiya bazlı üretim girişi (`record_production_entry`): fire/duruş neden kodu zorunlu, gerçek çevrim, sadece duruşlu vardiya
- [x] Üretim → stok + lot (vardiya başına) + kalıp atış sayacı, atomik
- [x] Kapatılan iş emri yeniden açılabilir: yalnızca admin, `reopen_work_order` (işlem içi `app.reopen_work_order` bayrağıyla guard'ı geçer; reopened_at/by/note/count). Kapalı iş emrinde giriş penceresi salt okunur; düzeltmeden sonra pencereden tekrar kapatılır
- [x] Üretim girişi v2 (`save_production_entry` / `cancel_production_entry`, pencere `production-entry-modal.tsx`): tarih + saat aralığı (planlı süre = aralık; bitiş < başlangıç → ertesi gün; vardiya başlangıç saatinden), operatör listeden (`operators`, Ana Veri → Operatörler), çoklu fire (`production_entry_scraps`) ve duruş (`production_entry_downtimes`) satırları, gerçekleşen çevrim/hız otomatik, kullanılan hammadde otomatik = üretim × birim ağırlık + fire (elle yazılınca durur, değnek otomatiğe döndürür), giriş bazında fire/OEE/overweight/kapasite (`lib/entry-metrics.ts`, görünümlerle aynı formül). Düzeltme = eski giriş ters kayıtla iptal + yeni giriş (tek işlem); iptal edilen girişler (`cancelled_at`) görünümlerde ve okuyuculardan hariç. Dağılımlar çoklu nedenden (`reasonParts`, `lib/supabase/entry-reasons.ts`). Enjeksiyon nominal tüketim = adet × (parça g + yolluk g / göz) / 1000 (overweight yolluğu saymaz); reçetede 0/boş parça/yolluk/göz/çevrim kalıp kartına düşer (`firstPositive`, görünümlerde `nullif(...,0)`)
- [x] Üretim modülü: üst sekmeler Üretim Analizi | İş Emirleri (`app/(app)/uretim/layout.tsx`). Analiz `/uretim/analiz` tek pano, Boru / Fitting düğmeleri. Fitting panosu (e1–e5 görselleri) `components/injection-dashboard.tsx`: 12 KPI (yolluk = `v_production_analytics.runner_kg`, brüt/net süre, çevrim perf. = ideal/gerçek), hammadde bazında fire, ürün ve iş emri bazlı çevrim performansı (±10 uygun / 10–25 izle / >25 kritik), kalıp çalışma tipine göre (`molds.operation_mode` otomatik/yarı otomatik, KALIP İNFO'dan), ürün kırılımı filtreleri (genel kod, koddan renk `colorFromCode`). Ortak KPI/kart parçaları `components/dashboard-ui.tsx`. Boru panosu referans görsellere göre (z1–z3, proje kökünde, git dışı): KPI'lar, kapasite, hammadde/fire/duruş pasta grafikleri, vardiya karşılaştırması, fire+OEE trendi, iş emri bazlı fire/overweight (durum renkli), makine/operatör tabloları, kontrol öncelikleri, PDF/Excel. Hesap `lib/production-analytics.ts`, `v_production_analytics`. Ayrı OEE ve fire sayfaları kaldırıldı (panoya yönlendirir). Grafik renkleri: kategorik `--cat-1..8`, durum `--success/--warning/--danger`

**Faz 3 — Maliyet + Kalite**
- [x] Maliyet: gerçek tüketimden hammadde, fire geri kazanımı, genel gider, plan/gerçekleşen (fiyatlar güncel kart fiyatı)
- [x] Kalite kontrol + NCR (`create_ncr`/`close_ncr`): reddedilen kontrolden NCR, karantina transferi, kök neden/düzeltici zorunlu, serbest bırak/imha; lot izlenebilirliğe bağlı. Karantina deposu ana veride tanımlanmalı

**Faz 4 — Sağlamlaştırma**
- [x] İzlenebilirlik `/depo/izlenebilirlik`: lot → iş emri/vardiya/tüketilen hammadde; vardiya girişinde reçine lotu seçilirse kesin (`p_raw_lots`, `v_stock_lot`), seçilmezse "olası lotlar"; hammadde lotundan üretilen lotlar (geri çağırma)
- [x] **Bildirimler** (üst çubukta zil, `notification-bell.tsx`, `getNotifications`): kritik/min altı stok (kullanılabilir depolar), bakımı gelen kalıp, açık NCR, teslim tarihi geçen sipariş; saklanmaz, anlık hesap (5 dk + pencereye dönünce); görülenler localStorage, tıklayınca ilgili sayfa yeni sekmede. Paneldeki Kritik Stoklar kartı aynı hesaptan
- [x] Dashboard: bu ayın fire kartı (`getScrapSummary`, `lib/scrap-report.ts`) → üretim analizine bağlanır
- [x] Eksik veri listesi `/ana-veri/eksik-veri` (`lib/data-quality.ts`): hesapları etkileyen reçete/ürün/kalıp/makine/hammadde/depo/kur boşlukları, önem + etkilediği hesap + düzeltme yeri
- Büyük sorgular `lib/supabase/read-all.ts` (`readAll`/`inChunks`) ile okunur — PostgREST 1.000 satır sınırı
- [x] RLS gözden geçirme: rol bazlı politikalar (`lib/permissions.ts` ile aynı), arayüzde rol bazlı gizleme
- [x] **İşlem geçmişi** (Yönetim → İşlem Geçmişi, `activity-panel.tsx`, `getActivityLog`): `activity_log` tetikleyici `audit_row()` ile 32 tabloda ekle/değiştir/sil/pasif/geri al otomatik (kullanıcı `auth.uid()`, değişen alanlar eski→yeni, `txid` ile toplu işlem tek satır); değiştirilemez, yalnız admin okur; alan/tablo adları `lib/audit.ts`. Yeni tabloya da trigger eklenmeli
- [x] Yönetim: kullanıcı rol/aktiflik (son aktif yönetici DB'de korunur), parametreler (maliyet, kur, vardiya süresi), Excel yedeği (22 tablo)
- [x] Kapasite (Yönetim sekmeleri): makine kapasitesi tarihli (`line_capacities`, yeni dönem eskisini otomatik bitirir, çakışma DB'de engellenir), referans kapasite grup×çap×SDR×yıl (`reference_capacities`, analizde onaylılar içinde en yüksek kapasite = rehber (`20260930120000`; diğer yıllar Yönetim'de gizli, silinmez), liste PE çapa göre, PP SDR 6 → 7,4 → 11 ve çapa göre (`lib/capacity-sort.ts`)), takvim (`cost_parameters.weekly_off_days` + `calendar_holidays`); ürün kartında `material_group`/`diameter_mm`/`sdr`. `day_shift_start`/`night_shift_start` şemada var, henüz kullanılmıyor
- [x] Mobil: 375 px'te sayfa taşması yok (13 sayfa ölçüldü), sekmeler kaydırılabilir, tablo sayfalaması dar ekrana uygun, iş emri butonları mobilde no altında

**Bekleyen temizlik:** Ürün kartı test verisi (`20260929150000_test_products.sql`): V9TEST01, A9TEST01.HENQ, D.990.063.99, TEST-HAM-PPR, TEST-MTL-01, KLP-TEST-01, TEST-RCT-* reçeteleri; stok hareketleri `note = 'TEST VERİSİ'`. Ayrıca `20260929190000_test_extras.sql`: cariler "TEST Tedarikçi A.Ş." / "TEST Müşteri Ltd.", sipariş TEST-SIP-001, test tedarikçi fiyatları. Kullanıcı isteyince: hareketleri ters kayıtla sıfırla, ürün/kalıp/reçeteyi pasife al.

**Alınan kararlar (kalıcı):**
- **OEE fabrika tanımı:** (vardiya/planlı süre − duruş) ÷ vardiya süresi (11 sa / 12 sa = %91,7). Klasik K×P×Q kullanılmaz; hız performansı (ideal/gerçek süre) ve kalite ayrı gösterge (`measure()` ve `entryMetrics()`).
- Sektör: **plastik imalat** (ekstrüzyon + enjeksiyon).
- Stok yalnızca append-only `stock_movements` ile değişir.
- Reçete versiyonlanır; eski üretimlerin maliyeti geçmiş versiyonla hesaplanır.
- Fire/duruş neden kodları sabit değil; Yönetim > Neden kodları'ndan düzenlenir.
- Regrind/hurda grade bazlı ve ayrı depoda; soyağacıyla izlenir.
- Muhasebe kapsam dışı.
- Tema rengi kullanıcı tarafından sonradan belirlenecek (`--brand`).
- **Şema değişikliği yalnızca migration ile:** `supabase/migrations/<YYYYMMDDHHMMSS>_ad.sql`
  yazılır, `main`'e push edilince GitHub Actions (`supabase-migrations.yml`) canlıya uygular.
  Supabase panelinden elle tablo/politika değiştirilmez. Şema değişince `npm run db:types`.
- Repo: github.com/UF0000/uretimerp (private). Secret'lar GitHub Actions'ta; `.env.local` repoya girmez.
