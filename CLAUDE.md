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

**Faz 1 — Omurga**
- [x] Ana veri CRUD (ürün/hammadde/kalıp/hat/cari/depo/neden kodları) + Excel içe aktarım
- [x] Ürün kartı: liste filtreleri (tür/aile/grup kodu/malzeme/varyant), görsel (Storage `product-images`), çift tık → `/ana-veri/urunler/[id]`: genel bilgi, stok, boyut (çap/et/SDR), teknik veri (reçete/kalıptan; düzenleme `save_bom` + kalıp güncelleme), hammadde, 12 ay hareket grafiği, varyantlar (+ toplamlar), otomatik standart maliyet (`lib/product-cost.ts`). Türler + Ticari mal/Hizmet; aile = `category` (boru, baglanti_parcasi=Fitting, metal…), sabitler `lib/product-meta.ts`
- Grup kodu (`products.group_code`, tanımlar `product_groups` — şimdilik boş, gerçek liste kullanıcıdan gelecek): PE'de koddan (D.110.090.**03**), PP'de elle. Varyant = aynı `variant_code` (genel stok kodu); PP kuralı ilk harf renk + "." sonrası firma eki (V1A012020.HENQ → 1A012020)
- Tüm DataTable'larda Excel gibi sütun genişliği (sürükle / çift tık sığdır, localStorage) — `components/shared/use-column-widths.ts`
- [x] Reçete / BOM + versiyonlama (`save_bom`: kullanılmış reçete düzenlenince yeni versiyon)
- [x] Stok defteri append-only (UPDATE/DELETE tetikleyiciyle yasak), iptal = ters kayıt, fiş iptali
- [x] `v_stock` / `v_stock_lot` + kritik/min rozetleri; regrind/hurda grade = ayrı ürün kartı (material_grade), tipine göre regrind/hurda deposu, stok sayfasında grade özeti

**Faz 2 — MRP çekirdeği**
- [x] Siparişler + net ihtiyaç (`/siparisler/ihtiyac`, hesap `lib/mrp.ts`): mamul üretim ihtiyacı, iş emri açılmalı, hammadde/ticari mal net eksik — tek seviye reçete, birim ağırlık reçeteden
- [x] İş emri + vardiya bazlı üretim girişi (`record_production_entry`): fire/duruş neden kodu zorunlu, gerçek çevrim, sadece duruşlu vardiya
- [x] Üretim → stok + lot (vardiya başına) + kalıp atış sayacı, atomik
- [x] Üretim modülü: üst sekmeler Üretim Analizi | İş Emirleri (`app/(app)/uretim/layout.tsx`). Analiz `/uretim/analiz` tek pano, Boru / Fitting düğmeleri (Fitting şimdilik boş, sonra tasarlanacak). Boru panosu referans görsellere göre (z1–z3, proje kökünde, git dışı): KPI'lar, kapasite, hammadde/fire/duruş pasta grafikleri, vardiya karşılaştırması, fire+OEE trendi, iş emri bazlı fire/overweight (durum renkli), makine/operatör tabloları, kontrol öncelikleri, PDF/Excel. Hesap `lib/production-analytics.ts`, `v_production_analytics`. Ayrı OEE ve fire sayfaları kaldırıldı (panoya yönlendirir). Grafik renkleri: kategorik `--cat-1..8`, durum `--success/--warning/--danger`

**Faz 3 — Maliyet + Kalite**
- [x] Maliyet: gerçek tüketimden hammadde, fire geri kazanımı, genel gider, plan/gerçekleşen (fiyatlar güncel kart fiyatı)
- [x] Kalite kontrol + NCR (`create_ncr`/`close_ncr`): reddedilen kontrolden NCR, karantina transferi, kök neden/düzeltici zorunlu, serbest bırak/imha; lot izlenebilirliğe bağlı. Karantina deposu ana veride tanımlanmalı

**Faz 4 — Sağlamlaştırma**
- [x] İzlenebilirlik `/depo/izlenebilirlik`: lot → iş emri/vardiya/tüketilen hammadde; vardiya girişinde reçine lotu seçilirse kesin (`p_raw_lots`, `v_stock_lot`), seçilmezse "olası lotlar"; hammadde lotundan üretilen lotlar (geri çağırma)
- [x] Dashboard: bu ayın fire kartı (`getScrapSummary`, `lib/scrap-report.ts`) → üretim analizine bağlanır
- [x] Eksik veri listesi `/ana-veri/eksik-veri` (`lib/data-quality.ts`): hesapları etkileyen reçete/ürün/kalıp/makine/hammadde/depo/kur boşlukları, önem + etkilediği hesap + düzeltme yeri
- Büyük sorgular `lib/supabase/read-all.ts` (`readAll`/`inChunks`) ile okunur — PostgREST 1.000 satır sınırı
- [x] RLS gözden geçirme: rol bazlı politikalar (`lib/permissions.ts` ile aynı), arayüzde rol bazlı gizleme
- [x] Yönetim: kullanıcı rol/aktiflik (son aktif yönetici DB'de korunur), parametreler (maliyet, kur, vardiya süresi), Excel yedeği (22 tablo)
- [x] Kapasite (Yönetim sekmeleri): makine kapasitesi tarihli (`line_capacities`, yeni dönem eskisini otomatik bitirir, çakışma DB'de engellenir), referans kapasite grup×çap×SDR×yıl (`reference_capacities`, analizde onaylı en güncel yıl), takvim (`cost_parameters.weekly_off_days` + `calendar_holidays`); ürün kartında `material_group`/`diameter_mm`/`sdr`. `day_shift_start`/`night_shift_start` şemada var, henüz kullanılmıyor
- [x] Mobil: 375 px'te sayfa taşması yok (13 sayfa ölçüldü), sekmeler kaydırılabilir, tablo sayfalaması dar ekrana uygun, iş emri butonları mobilde no altında

**Alınan kararlar (kalıcı):**
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
