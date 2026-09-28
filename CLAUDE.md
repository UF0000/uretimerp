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
- Tüm form doğrulamalarında **Zod** kullan.
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
  auth.ts                    # rol kontrolü
stores/                      # Zustand store'ları
supabase/
  migrations/                # SQL şema + RLS politikaları
```

---

## 5. Hafıza / Durum (Memory / Status)

> Son güncelleme: 2026-07-03

**Faz 0 — İskelet**
- [x] Next.js + TS + Tailwind + shadcn kurulumu, klasör yapısı
- [x] Tasarım token'ları + ortak layout (yan menü + üst bar)
- [x] `format.ts` (nokta/virgül) ve `stock.ts` (getStock/addStockMovement) yardımcıları
- [ ] Supabase bağlantısı, `.env.local`, Auth + middleware (kullanıcı Supabase projesi oluşturacak)

**Faz 1 — Omurga**
- [ ] Ana veri (ürün/hammadde/kalıp/hat/cari/depo/neden kodları) CRUD
- [ ] Reçete / BOM + versiyonlama (ekstrüzyon + enjeksiyon formları, regrind/runner/sprue)
- [ ] Stok hareket defteri + `v_stock` + kritik/min rozetleri (regrind/hurda grade ayrı)

**Faz 2 — MRP çekirdeği**
- [ ] Siparişler + net ihtiyaç hesabı
- [ ] İş emri + vardiya bazlı üretim girişi (fire/duruş neden kodları, gerçek çevrim)
- [ ] Üretim → otomatik stok hareketleri + lot üretimi + kalıp atış sayacı/OEE

**Faz 3 — Maliyet + Kalite**
- [ ] Reçeteden maliyet + fire/regrind geri kazanım + planlanan/gerçekleşen rapor
- [ ] Kalite kontrol (ISO 4435/EN 1852) + lot bağlama + NCR

**Faz 4 — Sağlamlaştırma**
- [ ] Dashboard + izlenebilirlik/fire raporları
- [ ] Dışa aktarım/yedek, RLS gözden geçirme, mobil cila

**Alınan kararlar (kalıcı):**
- Sektör: **plastik imalat** (ekstrüzyon + enjeksiyon).
- Stok yalnızca append-only `stock_movements` ile değişir.
- Reçete versiyonlanır; eski üretimlerin maliyeti geçmiş versiyonla hesaplanır.
- Fire/duruş neden kodları sabit değil; Yönetim > Neden kodları'ndan düzenlenir.
- Regrind/hurda grade bazlı ve ayrı depoda; soyağacıyla izlenir.
- Muhasebe kapsam dışı.
- Tema rengi kullanıcı tarafından sonradan belirlenecek (`--brand`).
