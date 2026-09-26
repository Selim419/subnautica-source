# Subnautica Dalış Omurgası — Tasarım Spesifikasyonu

**Tarih:** 2026-09-25
**Kapsam:** Faz 1 (dalış omurgası) ayrıntılı · Faz 2 ve Faz 3 yol haritası
**Durum:** Onaylandı — uygulama planı bekliyor

---

## 1. Bağlam

### 1.1 Mevcut durum

Kaynak: `subnautica-github-pages/app` — React 19 + Vite 6.
Yayın: `Selim419/Selim419.github.io` (kök) ve `Selim419/subnautica-derinlik-gunlugu` (alt yol).
İki site de aynı içeriği gösterir, ikisi de canlıdır.

Kullanıcının isteği: siteyi anime.js, three.js ve motion.dev kullanarak hayranlar için
daha çekici hâle getirmek. Kütüphaneler zaten kuruludur; kullanım derinleştirilmelidir.

### 1.2 Doğrulanmış bulgular

| # | Bulgu | Kanıt |
|---|---|---|
| F1 | Kaynak reposunun **remote'u yok** — tüm React kaynağı yalnızca yerelde, yedek ve geçmiş yok | `git remote -v` → boş |
| F2 | Vite `outDir` çıktıyı `docs/` içine yazıyor, `base` `/subnautica-derinlik-gunlugu/` olarak sabit — kök site için **yanlış** | `vite.config.js:6,9` |
| F3 | Bu yüzden build çıktısı **dört ayrı klasöre elle kopyalanmış** | `subnautica-pages-project-build`, `subnautica-pages-root-build`, `subnautica-github-pages/docs`, `selim419-github-io-deploy` |
| F4 | GitHub Actions **yok** — Pages doğrudan dalı sunuyor | `selim419-github-io-deploy/.github` yok |
| F5 | Sitede **hiç web fontu yok**. Gövde `Arial`, başlıklar `Impact` | `style.css` `:root{--display:Impact,'Arial Narrow',Arial}` |
| F6 | `style.css`: 21 776 karakter, 906 bildirim, 290 sınıf, tek dosyada, 5 renk değişkeni | ölçüldü |
| F7 | Erişilebilirlik temeli **iyi**: 4 adet `:focus-visible` kuralı, `prefers-reduced-motion` sorgusu, 4 kırılma noktası | `style.css` |
| F8 | Sahne `IntersectionObserver` + `visibilitychange` ile zaten durduruluyor — doğru davranış, korunmalı | `OceanScene.jsx:80,85` |
| F9 | Kaynak dosyalar doğru UTF-8; Türkçe karakterler bozuk değil | `app/index.html:7-8` |
| F10 | Yalnızca 3 `.webp` görsel var, kartlar arasında döngüsel kullanılıyor | `app/public/` |
| F11 | `gh` CLI girişsiz, `credential.helper` boş, token yok → **push kullanıcı tarafından yapılacak** | doğrulandı |
| F12 | `style.css` içinde 81 hex literal, **70 benzersiz hex değer**; bunların yalnızca **4'ü** token olarak tanımlı, **66'sı** doğrudan kural içine gömülü. `--cyan` bile kullanılmadan `#0c5e66`, `#24939a` yazılmış | taramayla ölçüldü |
| F13 | Token tabanlı boşluk ölçeği yok; ölçüler doğrudan px olarak yazılmış (`padding:128px`, `145px`, `64px`) | taramayla ölçüldü |

### 1.3 Kapsam dışı

**Dokunulmaz:** `wikiData.js` (kayıtlar, kaynak bağlantıları), mevcut biyom
metinlerinin **sözcükleri** (D13 yalnız *yeni* kayıt ekler, üç mevcut kaydı
olduğu gibi taşır), `.manifesto` ve `.final-cta` (D14), `ocean-hero.webp` ve
`lost-river.webp` (D17).

**Kapsam içi değişiklikler:** `.dive` sekme bölümünün omurgaya dönüşmesi (D12),
hero'nun `.webp` + kendi sahne örneği + `.hero-rail`'inin kaldırılması (D15,
D16), `kelp-forest.webp`'nin silinmesi (D17), üç yeni biyom kaydı (D13).

Faz 2 (harita, crafting, upgrade ağacı) ve Faz 3 (cilalama) ayrı spesifikasyonlardır.

---

## 2. Hedef

Ziyaretçi sayfayı kaydırdıkça **gerçek bir dalış yapar**: derinlik artar, atmosfer değişir,
her bölümde bir biyom açılır. Bu sırada site kendini oyunun bir aracı gibi hissettirir —
ölçüm cihazı kesinliği (enstrüman) ve okyanus canlılığı (biyom) aynı anda.

**Başarı ölçütü:**
1. Sayfa yüklendiğinde ziyaretçi 3 saniye içinde "bu bir Subnautica deneyimi" diyor.
2. Derinlik göstergesi ile görsel sahne **her karede** aynı sayıyı gösteriyor.
3. WebGL kapalıyken site boş görünmüyor, dalış okunabilir kalıyor.
4. Tek `git push` iki siteyi de güncelliyor.

---

## 3. Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| D1 | Yeni ve temiz kaynak repo (`Selim419/subnautica-source`) | Mevcut `subnautica-derinlik-gunlugu` build çıktısıyla karışmasın; ad sonra değiştirilebilir |
| D2 | Görseller **tamamen prosedürel** (shader/geometri) | Telif sorunu yok, dosya boyutu küçük, her cihazda akıcı, dış varlığa bağımlılık yok |
| D3 | İçerik derinliği = **yapısal veri** (harita + crafting + upgrade ağacı) | Faz 2. Metin çoğaltma değil, araç |
| D4 | Dalış **scroll'a bağlı**; tam ekran dalış oyunu yok | Mobil dostu, mevcut sayfa ritmine uyar, ayrı uygulama maliyeti yok |
| D5 | Görsel dil **C — Hibrt** | Oyunun kendi karakteri: biyolojik doku + teknik PDA |
| D6 | Scroll mantığı **5 atmosfer rejimi + 6 biyom anı** | Atmosfer az ve ucuz; biyom fan için anlamlı; Faz 2 haritası bu sınırlara oturur |
| D7 | Yazı tipi **IBM Plex harfleri, self-host** (`Selim Sans` / `Selim Sans Condensed` / `Selim Mono` olarak teslim edilir) | Türkçe latin-ext kapsamlı; `--display`'daki `Impact` tasarım dilini öldürüyor |
| D8 | `TextRoll` kodu bizim dosyamıza alınır, Skiper atfı kaldırılır | Artık onların kodu kullanılmıyor; kazanılan şey iyi bir fikir |
| D9 | CI yeşil değilse deploy olmaz | Şu an elle kopyalama var; kırık build canlı siteyi kırar |

**Uygulama öncesi netleştirilen kararlar** (Faz 1'de tasarım sistemi bittikten,
omurga kurulmadan önce):

| # | Karar | Gerekçe |
|---|---|---|
| D10 | **Yaklaşım A — sahne sorumluluğu tam alır.** Tek sabit tam ekran perde, içerik metni üzerine akar | Alternatif B'de rejim geçişi hem CSS hem shader tarafında iki kez kodlanır — §4.1'in önlemeye çalıştığı çakışmanın kendisi. Alternatif C Three.js'e hiçbir iş vermez, "daha etkileyici" hedefine ulaşmaz |
| D11 | **6 bölüm = 6 biyom.** Ampul Zonu ve Kükürt Deposu ayrı bölüm | §5'in "son ikisi `biolum` rejimini paylaşır" maddesi korunur: bölüm 5–6 aynı rejimde kalır, yalnız vurgu rengi değişir. Bölüm sayısının5 olduğu yazımı yanlıştı |
| D12 | **Mevcut `.dive` sekme bölümü omurgaya dönüştürülür** — silinmez, yutulmaz, akar | Aynı biyomi iki yerde göstermek DOM şişirir ve tekrar hissi yaratır. Mevcut `.dive-card`'ın tarama halkası ve ilerleme çubuğu DepthGauge'e taşınır |
| D13 | **6 yeni biyom kaydı yazılır** (Mantar Ormanı, Ampul Zonu, Kükürt Deposu) | Mevcut 3 kayıt omurganın yarısını boş bırakırdı. Ton mevcut üçüyle aynı: ölçü aleti kesinliği + biyom canlılığı |
| D14 | **Sayfa iskeleti:** `.hero` → 6 dalış bölümü → `.manifesto` → `.final-cta` | Manifesto nefes alma rolünü kaybetmemeli; omurğa yalnız dalıştır |
| D15 | **Hero dahil tek `OceanCanvas`.** Sahne sayfanın tepesinden omurganın sonuna kadar aynı `position: fixed` katmanda; hero'nun kendi `<OceanScene />` örneği ve `.hero-image` `.webp`'si kaldırılır | İki WebGL bağlamı demek: iki renderer, iki dispose, spec §4.3'ün "yaşam döngüsü tek sahibi" kuralını ihlal. Ayrıca D2 "tamamen prosedürel" — hero'nun fotoğrafı bu istisnayı doğurmuyor. Hero, omurganın 0 m'si: `daylight` rejimi zaten onun atmosferi |
| D16 | **`.hero-rail` (`01 / 03` + `DERİNLİK 000 M`) emekli, yerine `DepthGauge`.** Cetvel sayfanın tepesinde 000 M'den başlar | Aynı anda iki derinlik göstergesi olmaz; cetvel `z 2`'de fixed olduğu için hero'nun kendi göstergesiyle üst üste biner |
| D17 | **`kelp-forest.webp` (222.6 KB) silinir.** Artık tek kullanıcısı emekli `.dive-card`'dı | `ocean-hero.webp` (hero) ve `lost-river.webp` (final-cta) D14 gereği **kalmaya devam eder** — bunlar kapsam dışı |

### 3.1 Reddedilen seçenekler

- **Oyunun kendi asset'leri** — yeniden dağıtım ve lisans riski, dosya boyutu.
- **Serbest lisanslı gerçek fotoğraf** — atmosfer tutarsızlığı, "tek evren" hissi kırılır.
- **Tam ekran dalış oyunu** — mobilde karmaşık, ayrı uygulama maliyeti.
- **Tek büyük yeniden yazım** — 5 alt sistemin hatası aynı anda çıkar, ayrıştırılamaz.

---

## 4. Mimari

### 4.1 Temel kural

Derinliği **yorumlayan** tek yer `regimes.js` + `useDiveDepth`'dir. Sahne motoru
derinliği hesaplamaz, yorumlamaz, adıyla çağırmaz — yalnızca kendisine verilen
atmosfer parametrelerini uygular. Bu yüzden rejim değişikliği shader kodunu değil
sadece veriyi değiştirir.

### 4.2 Dosya yapısı

```
app/src/
  design/
    tokens.css          ← tek doğruluk kaynağı: palet, tipografi, ölçü
    type.css            ← font-face, tipografi kademeleri
    layout.css          ← ızgara, bölüm ritmi, kırılma noktaları
    readTokens.js       ← CSS değişkenlerini bir kez okur, JS'e geçirir
  dive/
    regimes.js          ← SAF VERİ: derinlik aralığı → atmosfer parametreleri
    biomes.js           ← SAF VERİ: 6 biyom kaydı (D13) — ad, EN ad, derinlik
                          aralığı, satır, metin, vurgu, wiki id, regime id
    useDiveDepth.js     ← scroll 0..1 → { metres, regime, index, progress, frameRef }
    DiveScroll.jsx      ← scroll uzunluğunu tanımlar, sahneyi sabitler (D10)
    DepthGauge.jsx      ← dikey cetvel + metre göstergesi
  scene/
    buildScene.js       ← sahne kurulumunun tek giriş noktası
    OceanCanvas.jsx     ← three yaşam döngüsünün tek sahibi
    shaders/
      water.js          ← su yüzeyi / caustic
      rays.js           ← ışık huzmeleri (god rays)
      kelp.js           ← prosedürel yosun
      particulate.js    ← partikül alanı
  components/
    WordCycle.jsx       ← TextRoll'un bizim sürümümüz
  HomeView.jsx
  WikiView.jsx
  wikiData.js           ← Faz 1'de dokunulmaz
  main.jsx
```

### 4.3 Modül sınırları

| Modül | Sorumluluk | Bağımlılık |
|---|---|---|
| `regimes.js` | Derinlik → atmosfer eşlemesi | **Yok.** Three.js, React, CSS import etmez. Saf veri. |
| `biomes.js` | 6 biyomun metadatası (D13) | **Yok.** `regimes.js`'i yalnız `regime` anahtarıyla eşler, içeriği yorumlamaz. Saf veri. |
| `useDiveDepth.js` | Scroll → metre + rejim | `regimes.js` |
| `DepthGauge.jsx` | Göstergenin çizimi | `useDiveDepth` dönüşündeki `frameRef` (salt okuma) |
| `OceanCanvas.jsx` | Kurma, dispose, duraklatma | `regimes.js`, `buildScene.js` |
| `buildScene.js` | Sahne grafini kurma | `shaders/*`, `regimes.js` |
| `shaders/*` | `{ uniforms, vertexShader, fragmentShader }` | **Yok.** Dış dünya tanımaz. |
| `readTokens.js` | CSS değişkenlerini okuma | `tokens.css` (çalışma zamanı) |

**Gerekçe:** `regimes.js` ve `shaders/*` dışarıya bağımlılık olmadan birim testi yazılabilir.
`OceanCanvas` tek yerde `dispose()` çağırır — yeni efekt eklendiğinde sızıntı yaratma riski tek noktaya düşer.

### 4.4 Veri akışı

```
scroll konumu
    ↓
useDiveDepth ──→ { progress, metres, regime, index, frameRef }
    ├─→ DepthGauge   : frameRef.current her karede okunur, DOM'a yazılır.
    │                  React state'i GÜNCELLENMEZ → yeniden render yok.
    └─→ OceanCanvas  : frameRef.current uniform'lara yazılır.
                       Rejim değiştiğinde tek seferlik state güncellemesi.
```

**`useDiveDepth`'in sözleşmesi:** Kanca her render'da **aynı referansı** döndürür
(`useRef` içinde tutulan `{ metres, regime, index, progress }` nesnesi). `progress`
0..1 arasına clamp edilir ve kaydırma yönü ne olursa olsun **monoton artar**.
Bu sayede cetvel ve sahne aynı karede aynı sayıyı okur — §2'deki 2. başarı ölçütünün
teknik garantisi budur.

`buildScene.js` rejim değişiminde tüm sahneyi yeniden kurmaz; yalnızca
`regimes.js`'ten gelen hedef değerlere **geçiş yapar** (uniform lerp, 600 ms).

### 4.5 Kompozisyon (D10, D15, D16)

Sahne tek bir tam ekran `canvas`'tır, `position: fixed` ile durur ve **hero dahil**
sayfanın tepesinden son dalış bölümünün sonuna kadar hiç kaymaz. İçerik (metin)
z-index üstünde onun üzerinden akar. Bu katmanlar:

```
  z 2   DepthGauge          fixed, sol kenar, aria-hidden. 000 M'den başlar (D16)
  z 1   hero + 6 bölüm      belge akışında; bölümler scrim'li, hero yalnız vignette
  z 0   OceanCanvas         fixed, tam ekran, sayfanın tepesinde (D15)
  z -1  CSS gradyan yedeği   three yüklenmeden ve WebGL yokken görünen katman
```

**Hero, omurganın 0 m'sidir.** `three` `React.lazy` ayrı chunk olduğu için ilk
boyamada henüz yoktur; o ana kadar `z -1`'deki `daylight` CSS gradyanı görünür,
canvas geldiğinde üzerine çıkar. Hem ilk boya hem WebGL kapatılmış hâli aynı
katman çözer — §8.3'ün "CSS gradyanına düşer" kuralı bu yüzden özel bir yedek
yazmadan çalışır. Hero'nun `.hero-image` `.webp`'si ve kendi `<OceanScene />`
örneği bu yüzden kaldırılır (D15).

**Metin okunabilirliği opak panelle değil, yönlü scrim ile çözülür.** Her bölüm
kendi `.dive-section` kutusuna `linear-gradient` bir köşeden alır (metnin durduğu
taraf, koyu → şeffaf, ~28vh geçiş). Panel yok: okyanus hiçbir bölümde tamamen
kapanmaz, D10'un gerekçesi budur. Kabul: gövde metni zeminin *o anki* rengine
karşı ≥ 4.5:1 — bunu `visual-check.mjs` ölçüyor, göz kararı değil.

**Biyom yapısı sahnenin içindedir** (D10): yosun gövdeleri `kelp.js`, mantar
ağaçları ve mercan `water.js`/`kelp.js` geometrisi, biyolüminesan noktalar
`particulate.js`. Bölümlerde yalnız metin ve DepthGauge kalır. Sonuç: `biomes.js`
tek bir `image` alanı taşımaz — mevcut `.dive-card` görsellerinin işini sahne
üstlenir (D2).

**Ölçek:** `--dive-length: 900vh` = hero 100vh + 6 × 133.3vh.

---

## 5. Derinlik rejimleri

Scroll toplam uzunluğu `--dive-length: 900vh` (hero 100vh + 6 bölüm × ~133vh).
Bölüm sayısı biyom sayısına eşittir (D11), rejim sayısına değil.

| # | Derinlik | Rejim | Biyom anı | Atmosfer |
|---|---|---|---|---|
| 1 | 0–80 m | `daylight` | Sığ Resifler | Gündüz; ışık huzmeleri belirgin, su açık turkuaz |
| 2 | 80–200 m | `twilight` | Yosun Ormanı | Alacakaranlık; huzmeler sönüyor, kelp giriyor |
| 3 | 200–525 m | `midnight` | Mantar Ormanı | Mavi-siyah; biyolüminesan noktalar beliriyor |
| 4 | 525–1065 m | `deep` | Kayıp Nehir | Derin karanlık; sis artıyor, uzaklık çöktü |
| 5 | 1065–1400 m | `biolum` | Ampul Zonu | Siyah; amber-mor ışık, belirgin biyo-koridorlar |
| 6 | 1400 m+ | `biolum` | Kükürt Deposu | Aynı atmosfer; altın-lav vurgusu ve lav ışığı |

**Not:** Bölüm 5 ve 6 aynı `biolum` rejimini paylaşır. Rejim geçişi olmaz —
yalnız `--zone-accent` amber-mor → altın-lav olur ve sahnedeki biyom geometrisi
değişir. Bunu `regimes.js` değil, `biomes.js`'in `accent` alanı taşır. Bu, 6 ayrı
atmosfer kodlamaktan bilinçli olarak ucuzdur ve Bölüm 2'de onaylanan mockup ile
birebir tutar.

`regimes.js` her rejim için şunları tanımlar: `water` rengi, `fogDensity`,
`lightIntensity`, `lightColor`, `raysOpacity`, `particleDensity`,
`biolumIntensity`, `accent`. **5 satır** — `biolum` bir kez tanımlıdır.

---

## 6. Tasarım sistemi

### 6.1 Yazı tipi

| Rol | Aile | Kesim |
|---|---|---|
| Başlık | Selim Sans Condensed | 500 / 600 |
| Teknik etiket, cetvel | Selim Mono | 400 / 500 |
| Gövde | Selim Sans | 400 / 600 |

- `app/public/fonts/*.woff2` — **12 dosya**: 6 ağırlık × 2 alt küme (`latin` + **latin-ext**).
  Her dosya adında ağırlık **ve** alt küme vardır; ağırlıksız bir dosya yoktur.
- `@font-face` + `font-display: swap`; yalnızca iki kritik kesim `preload` edilir
  (`selim-sans-condensed-600-latin-ext.woff2`, `selim-mono-500-latin-ext.woff2`).
- Üçüncü taraf isteği yok. **Gerçek toplam ~221 KB** (221.836 bayt), tahmini ~90 KB değil.
- **`Impact` ve `Arial` tamamen kaldırılır.**
- **`600-italic` kesimi yüklenmez.** Başlıklarda italik yasaktır; vurgu ağırlık ve
  accent rengiyle taşınır. Hero'ın üçüncü satırı (`YERİN ALTINDA.`) romandır ve
  `--amber` ile öne çıkar — onaylanan mockup'taki görsel fark bu sayede korunur, ancak
  italik kesimi pakette bulunmaz, yani dosya boyutu da düşer. İtalik yalnızca gövde
  metninde, koşan paragraf içinde vurgu için kullanılabilir.

**Yaklaşık 221 KB neden kabul ediliyor:** Site metni Türkçe olduğu için tarayıcı, kullandığı
her kesim için **hem `latin` hem `latin-ext` dosyasını** çeker. `ı İ ğ ğ` (U+0130-0131,
U+011E-011F) ve `ş Ş` (U+015E-015F) U+0100'ün üzerindedir, yalnızca `latin-ext` içindedir;
`ç ö ü` ise `latin` içindedir. `unicode-range` İngilizce bir sitede kazandığından çok daha az
kazandırır — aktarılan ağırlık diskteki toplama yakındır. Bu kabul edilmiştir: gerekçesi
dilin kendisidir, ihmal değil.

**Kaynak ve lisans:** IBM Plex, SIL Open Font License 1.1 ile dağıtılır. Dosyalar
IBM'in resmi dağıtımından alınır ve `app/public/fonts/OFL.txt` lisans metniyle birlikte
depoya konur. OFL, lisans metnini pakette bulundurmayı zorunlu kılar — bu adım atlanırsa
yayın lisans ihlali olur.

**Aile adları neden "IBM Plex" değil:** IBM Plex, OFL 1.1 ile **Rezerve Font Adı** ("Plex")
dağıtılır. Madde 3, Değiştirilmiş Sürüm'ün (alt küme bir Değiştirilmiş Sürüm'dür) bu adı
kullanmasını yasaklar. Alt kümeler bu yüzden `Selim Sans` / `Selim Sans Condensed` /
`Selim Mono` olarak teslim edilir; telif (name ID 0) ve marka (name ID 7) bildirimleri
OFL'in zorunlu tuttuğu için olduğu gibi bırakılmıştır. Gerekçe `app/public/fonts/README.md`
dosyasındadır. Bu yüzden CSS'te `IBM Plex …` değil `Selim …` adları bildirilmelidir.

**Alt küme seçimi:** `latin-ext` olmadan `ı` ve `İ` Türkçe metinlerde yanlış glife
düşer. Yalnızca `latin` altkümesi indirilirse Türkçe site bozulur — her iki alt küme
indirilecek.

**Risk:** `Impact` dar ve çok geniş; Plex Condensed farklı ölçülen genişlikte. Başlık
boyutları yeniden ölçülmeli — özellikle `.record-body h2` (`clamp(3.5rem, 7vw, 5.7rem)`).
Bu, tipografi ölçeği yazıldıktan sonra tarayıcıda doğrulanacak.

### 6.2 Renk — üç katman

1. **Çıplak palet** (`:root`) — `--abyss #01080c`, `--deep #04202a`, `--water #0d5f74`,
   `--kelp #a9d96b`, `--glow #5fe0c8`, `--amber #ffb454`, `--coral #ff7a59`
2. **Anlamsal** — `[data-regime="twilight"]` gibi her rejim kendi `--water`, `--ink`,
   `--glow` değerini override eder
3. **Ölçü** — 4 px tabanlı boşluk ölçeği; 6 tipografi kademesi;
   hareket süreleri `120 / 240 / 420 / 800 ms`

`readTokens.js` yalnızca **1. katmanı** okur (2. katman CSS'te uygulanır ve JS'e
taşınmaz); shader uniform'ları çıplak paletten beslenir, rejim geçişinde lerp edilir.

### 6.3 Dosya bölünmesi

`style.css` (21 776 karakter) → `tokens.css` + `type.css` + `layout.css` + bileşen
blokları. Yeni bileşen eklerken hangi değişkenin kullanılacağına karar vermek gerekmez.

### 6.4 Tasarım kapıları

Aşağıdaki yedi kural Faz 1'in **kabul kriteridir**; "iyi görünüyor" yeterli bir gerekçe
değildir. Altıncı madde hariç hepsi bir denetim listesidir, tartışmaya açık değildir.

1. **Kilitli token'lar.** Her renk ve her `font-family` bildirimi adlandırılmış bir
   token'a başvurur (`var(--color-amber)`, `font-family: var(--font-display)`). Satır
   içi hex, `oklch()` veya `rgb()` ve token'ı atlayan bir `font-family: "Font Adı"`
   bildirimi kabul edilmez. Gerekli ama token'da olmayan bir değer önce token
   bloğuna yeni bir isimle eklenir, sonra referanslanır.
   *Bu, F12'nin karşılığıdır — 81 literal, 70 benzersiz hex. Plan 2A'da `tokens.css`
   dışında **0** kaldı (41 adlandırılmış token), `measure` kapılarıyla doğrulandı.*
2. **Dürüst içerik.** Kullanıcı vermediği hiçbir sayı uydurulamaz. "3 biyom keşfedildi",
   "50.000+ hayran", "%47 artış" gibi ifadeler yapılmaz. Dalış deneyimi bir sayaç
   göstermeye zorlanırsa, gerçek değer `localStorage`'da tutulmuyorsa gösterilmez.
3. **Sahte chrome yasak.** Elle çizilmiş tarayıcı çubuğu, telefon çerçevesi, sahte kod
   penceresi veya sahte IDE chrome'u üretilmez. Kullanıcının ortamı zaten gerçek
   chrome'u sağlıyor. Zorunlu değil.
4. **Başlıklarda italik yasak.** Vurgu ağırlık, accent rengi veya çizilmiş alt çizgiyle
   taşınır. İtalik yalnızca koşan gövde paragrafı içinde kullanılabilir. (§6.1)
5. **Mobil doğrulama.** §8.2'deki dört genişliğin hepsi doğrulanır.
6. **Yayın öncesi öz-eleştiri.** Her çıktı altı eksende 1–5 puanlanır: felsefe,
   hiyerarşi, uygulama, özgüllük, ölçülülük, çeşitlilik. **3'ün altı herhangi bir
   eksende revizyon turunu tetikler.** Altı skor çıktının üstüne damgalanır ve
   hangi    eksende neden revize edildiği not edilir.
7. **Metin kontrastı ölçülür.** §4.5'teki scrim, okyanusun *o anki* rengine karşı
   gövde metnini ≥ 4.5:1, büyük metni ≥ 3:1'de tutmalı — çünkü metin artık panelin
   içinde değil, sahnenin üstünde. Ölçüm gözle değil `visual-check.mjs contrast`
   ile yapılır; her bir zorunlu genişlikte ve her rejim sınırında (metin o rejimdeyken)
   örnek alınır. Bir tek örnek düşerse kapı düşer. §8.2'deki `--amber` ≥ 7:1
   kontrolü bu maddeye dahildir.

**Bu kapıların kapsamadığı ve kapsam dışı bıraktıklarımız:** makrostructure veya tema
seçimi. Onaylanan yön (C — hibrt) üç mockup turundan sonra kesinleşti; bu faz
o kararı yeniden açmaz, yalnızca uygular.

---

## 7. Yayın boru hattı

### 7.1 Depolar

| Depo | Rol |
|---|---|
| `Selim419/subnautica-source` (yeni) | Kaynak kod + `docs/superpowers/` |
| `Selim419/Selim419.github.io` | Kök site — Actions artifact'i |
| `Selim419/subnautica-derinlik-gunlugu` | Alt yol — Actions artifact'i |

### 7.2 Çıktı

`vite.config.js` → `build.outDir: 'dist'` (varsayılan), `emptyOutDir: true`.
Kaynak repodaki `docs/` build çıktısı **silinir**; `docs/` yalnızca dokümantasyon içindir.

`base` ortam değişkeninden gelir:
```js
base: process.env.PAGES_BASE ?? '/'
```

### 7.3 İş akışları

**Kaynak repo — `ci.yml`** (iş akışı adı tam olarak `CI`): `npm ci` → `npm run test:base` →
iki taban yolu için ayrı ayrı `npm run build` → her biri için `node scripts/verify-base.mjs`
ile taban yolu doğrula → `dist/index.html` var mı diye kontrol et.

**Pages repoları — `deploy.yml`:** Her Pages reposu **kendi `main` push'una** tepki
verir. `.deploy-source` dosyasını okur, içindeki SHA'yı doğrular (dosya boşsa veya
içindeki değer tam 40 karakterlik bir hex SHA değilse iş akışı kırmızıya düşer),
kaynak repoyu o SHA ile checkout eder, `npm run test:base` çalıştırır, **kendi**
taban yoluyla build eder ve `actions/deploy-pages` ile yayınlar. Artifact aktarımı
ve üçüncü taraf action yoktur; kaynak repoyu okumak için `actions/checkout`
yeterlidir.

> **Düzeltilmiş tasarım (Faz 1'de değişti).** Bu bölüm başlangıçta `workflow_run`
> tetikleyicisi ve `head_sha` ile checkout öngörüyordu ve deploy'un
> `conclusion == 'success'` olmasını şart koşuyordu. `workflow_run` çözülmedi:
> tetikleyici `workflow_run`'ı tetikleyen iş akışının adını ve ayrıca bir
> workflow dosyası referansı ister, `conclusion`'ı filtrelemek için
> `workflows: [CI]` + `types: [completed]` gerekir ve `head_branch` bir branch
> adı verir, SHA değil. Alternatif olarak `repository_dispatch` + fine-grained
> PAT denendi ve **terk edildi**: PAT'ın `contents=write` izni çalıştırılamadı
> ve 90 günde bir yenilenmesi gerekecekti. Pipeline'da secret istemiyoruz.
>
> Yayınlanan tasarım: Pages repoları kendi push'larına tepki verir, `.deploy-source`
> ile adı geçen commit'i build eder. **CI yeşil gate'i artık tetikleyicinin değil
> `release.mjs`'in sorumluluğundadır** (D9): kaynak push edildikten sonra, hiçbir
> pin yazılmadan önce, o SHA'daki `CI` koşusunun `success` ile bitmesi beklenir.
> Bilinmeyen CI durumu (koşu yok, hâlâ kuyrukta, zaman aşımı) yeşil sayılmaz ve
> pin yazılmaz. Ayrıca savunma olarak her iki `deploy.yml` de yayınlamadan önce
> `npm run test:base` çalıştırır ve kendi taban yolunu doğrular; iki iş akışı
> birbiriyle karışırsa (`build:root` ↔ `build:subpath`) bir "Guard against a
> swapped base" adımı kırmızıya düşer.

İki site arasında deploy **sırası garanti edilmez** — iki ayrı repo, iki ayrı workflow.
Gerçek garanti şudur: **CI yeşil değilse hiçbiri deploy olmaz** (D9). Aynı commit'ten iki
site birden bozulmaz.

> Not: `npm run test:base` yalnızca taban yolu doğrulamasını kapsar ve `node --test` ile
> çalışır, ek bağımlılık getirmez. Vitest ve modül testleri dalış omurgasıyla birlikte
> gelir; o noktada `ci.yml`'e tam `npm test` adımı eklenir.

### 7.4 Manuel adım

Actions moduna geçiş için **kullanıcı** şunu yapacak:
`Settings → Pages → Source: GitHub Actions` — her iki Pages reposunda.
Bu işlem arayüzden yapılır, otomasyonla yapılamaz.

### 7.5 Git

Tüm commit'ler kaynak repoda yapılır ve `node scripts/release.mjs` tarafından
`origin/main`'e push edilir (F11: kimlik bilgisi yalnızca yerel SSH klonunda, o
zaman push'u kullanıcı değil script yapar). Script sırasıyla: üç repoyu da
temiz/`main`/doğru `origin` için kontrol eder → kaynağı push'lar → o SHA'daki
`CI` koşusunun `success` ile bitmesini bekler → iki Pages reposundaki
`.deploy-source` pin'ini yazar ve push'lar. Actions, push sonrası otomatik
tamamlar.

---

## 8. Teknik sınırlar

### 8.1 Performans

| Ölçüt | Değer |
|---|---|
| Partikül | mobil 140 / masaüstü 380 |
| Pixel ratio | mobil ≤1.25 / masaüstü ≤1.5, `antialias: false` |
| Render | görünmezken veya sekme gizliyken durur (F8 korunur) |
| Bundle | `three` `React.lazy` ayrı chunk — ana bundle'da yok |
| JS bütçesi | gzip ≤ 180 KB |
| İlk yük | ≤ 700 KB |

**Kritik kural:** Derinlik okuması React state'i ile değil, doğrudan uniform ve DOM
yazımı ile yapılır. Her karede yeniden render 60 fps'i öldürür. Rejim değişimi tek
seferlik, nadir bir state güncellemesidir.

### 8.2 Erişilebilirlik

F7'deki mevcut temel **korunur**, yeniden yazılmaz.

- `prefers-reduced-motion`: sahne hiç kurulmaz; scroll'a bağlı geçişler anlık durum
  değişimine döner; dalış normal belge akışına geri döner.
- Derinlik cetveli dekoratif → `aria-hidden`. Kayıtlar normal `<button>`.
- Kontrast: gövde metni koyu zeminde ≥ 4.5:1, `--amber` ≥ 7:1 (doğrulanacak).
- Modal focus trap + Escape korunur.

**Dört zorunlu genişlik.** Mevcut kırılma noktaları (1160 / 850 / 600) 320 px'i
kapsamıyor ve 375 ile 414 arasındaki davranışı ayırt etmiyor. Çıktı şu dört
genişlikte hatasız olmalı:

| Genişlik | Neden |
|---|---|
| 320 px | En dar telefon. Yatay kaydırma olmamalı. |
| 375 px | iPhone SE/13 mini. En yaygın dar hedef. |
| 414 px | Android ortası. |
| 768 px | Tablet dikey. Derinlik cetveli burada gizlenmeli. |

Kabul ölçütleri:

- Yatay kaydırma yok; `html` ve `body` üzerinde `overflow-x: clip` (`hidden` değil —
  `hidden` `position: sticky`'yi bozar, dalış bölümü buna dayanıyor).
- Tıklanabilir hiçbir metin iki satıra taşmaz: butonlar, nav bağlantıları, alt bilgi
  bağlantıları, breadcrumb'lar, CTA'lar.
- Görsel taşıyan grid track'leri `minmax(0, 1fr)`, çıplak `1fr` değil.
- Uzun kelimelerde başlıklar `overflow-wrap: anywhere; min-width: 0` ile sarar.
- Bölüm başlıkları mobilde tek sütuna iner.

### 8.3 Hata durumları

| Hata | Davranış |
|---|---|
| WebGL yok / `WebGLRenderer` fırlatır | Sahne kurulmaz, sayfa **CSS gradyanına** düşer |
| Shader derleme hatası | Konsol uyarısı + aynı CSS yedeği |
| Font yüklenemez | `font-display: swap` → sistem stack |
| JS çalışmaz | `<noscript>` mesajı |

**Kural:** 3B çökse bile dalış okunabilir kalır. D2 (prosedürel görsel) bunu mümkün
kılan asıl neden — hiçbir dış görsele bağımlılık olmadığı için yedek katman her zaman mevcut.

---

## 9. Test ve doğrulama

### 9.1 Otomatik

Vitest ile **yalnızca saf modüller**:

- `regimes.test.js` — derinlik → rejim sınır değerleri (0, 80, 200, 525, 1065, 1400),
  1400+ üstü sınır, indeks sürekliliği, metrenin monoton artması, **rejim sayısı 5**
- `biomes.test.js` — 6 kayıt; her biri geçerli bir `regime` anahtarına bağlı; derinlik
  aralıkları bitişik ve artan (bölüm *n* sonu = bölüm *n+1* başı); `wiki` alanı
  **boş değilse** `wikiData.js` içinde karşılık buluyor, **boşsa** bölümde kayda
  giden bağlantı hiç basılmıyor. `wikiData.js` dokunulmaz olduğu için yeni üç
  biyomun (Mantar Ormanı, Ampul Zonu, Kükürt Deposu) `wiki` alanı `null`'dır —
  var olmayan bir kayda bağlantı vermek §6.4/2'yi (dürüst içerik) ihlal ederdi
- `useDiveDepth.test.js` — `0..1` clamp, sıfır ve bir uçları, metre doğruluğu,
  **yukarı ve aşağı kaydırmada aynı `progress`**

`visual-check.mjs` kapıları (Vitest dışı, mevcut harness'a eklenir):

- `measure` — 4 zorunlu genişlik + 1440; `overflow:false`, `bodyOverflowX:"clip"`,
  kırık metin 0
- `contrast` — §6.4/7; her genişlik × rejim sınırında gövde kontrastı ≥ 4.5:1

React bileşenlerine test kütüphanesi **eklenmez** — bu projede orantısız maliyet,
görsel doğrulama daha gerçek bir kontrol.

### 9.2 CI

`npm run build` sonrası `base` yolu `grep` ile doğrulanır. Bu, F2'deki hatanın
kendisini yakalayan kontroldür.

### 9.3 Manuel

- Chrome, Firefox, Safari
- 375 px, 768 px, 1440 px genişlik
- `prefers-reduced-motion: reduce` açıkken
- WebGL kapatıldığında (yedeğin çalıştığının kanıtı)

---

## 10. Dosya envanteri

### 10.1 Eklenen

```
app/src/design/tokens.css
app/src/design/type.css
app/src/design/layout.css
app/src/design/readTokens.js
app/src/dive/regimes.js
app/src/dive/biomes.js
app/src/dive/useDiveDepth.js
app/src/dive/DiveScroll.jsx
app/src/dive/DepthGauge.jsx
app/src/scene/buildScene.js
app/src/scene/OceanCanvas.jsx
app/src/scene/shaders/water.js
app/src/scene/shaders/rays.js
app/src/scene/shaders/kelp.js
app/src/scene/shaders/particulate.js
app/src/components/WordCycle.jsx
app/src/dive/regimes.test.js
app/src/dive/biomes.test.js
app/src/dive/useDiveDepth.test.js
app/public/fonts/*.woff2
app/public/fonts/OFL.txt
app/vitest.config.js
.github/workflows/ci.yml                    (kaynak repo)
.github/workflows/deploy.yml                (her iki Pages reposu)
docs/superpowers/specs/2026-09-25-subnautica-dive-spine-design.md
```

### 10.2 Silinen

| Dosya | Neden |
|---|---|
| `app/src/OceanScene.jsx` | `scene/OceanCanvas.jsx` + `buildScene.js` yerine geçiyor; hero artık aynı örneği paylaşır (D15) |
| `app/public/kelp-forest.webp` | Emekli `.dive-card`'ın tek kullanıcısıydı; biyom görselini sahne üstleniyor (D17) |
| `app/src/skiper58.jsx` | `components/WordCycle.jsx` yerine geçiyor (D8) |
| `app/src/style.css` | `design/*.css` + bileşen bloklarına bölünüyor |
| `docs/assets/`, `docs/index.html`, `docs/*.webp` | `docs/` artık build çıktısı değil (7.2) |

### 10.3 Değişen

| Dosya | Değişiklik |
|---|---|
| `app/vite.config.js` | `outDir: 'dist'`, `base: process.env.PAGES_BASE ?? '/'` |
| `app/index.html` | font `preload`, `<noscript>`, güncellenmiş `theme-color` |
| `app/src/main.jsx` | yeni token'lar, `DiveScroll` montajı |
| `app/src/HomeView.jsx` | `.dive` (sekme + kart) → `<DiveScroll>` + 6 `<section>` (D12); `diveZones` → `dive/biomes.js`; hero `.hero-image` + `<OceanScene />` + `.hero-rail` kaldırılır (D15, D16); manifesto ve final-cta **değişmez** (D14) |
| `app/src/WikiView.jsx` | token uyumu, arka plan gradyanları; **kayıtlar değişmez** |
| `app/src/design/dive.css` | sekme blokları → 6 `.dive-section` + scrim (D12) |
| `app/src/design/hero.css` | `.hero-image`/`.hero-rail` kaldırıldı (D15, D16); `.hero-vignette` korunur |
| `app/package.json` | `test` script'i, `vitest` devDependency |
| `.gitignore` | `.superpowers/`, `app/dist/` |
| `README.md` | yeni boru hattı ve komutlar |

---

## 11. Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Plex'e geçince başlıklar taşar / ritim bozulur | ~~Orta~~ **Kapandı** | Plan 2A'da ölçüldü: 5 genişlikte `overflow:false`, kırık metin 0. `Impact` emekli |
| Mobilde düşük FPS | Orta | Partikül bütçesi düşük; `IntersectionObserver` durdurma; gerekirse otomatik sadeleşme |
| Aynı commit iki siteyi birden bozar | Yüksek | CI yeşil gate; `release.mjs` o SHA'nın `CI` koşusu `success` olmadan pin yazmaz. Deploy sırası garanti edilmez ve iki siteyi birden güncellemek gerekmez |
| Yeni repo adı beğenilmez | Düşük | Ad tek satır değişiklik; build çıktısına dokunmaz |
| ~~3 `.webp` kartlarda döngüsel kalıyor~~ **Kapandı** | Düşük | Kart yok (D12); `kelp-forest.webp` siliniyor (D17). `ocean-hero` ve `lost-river` D14 gereği duruyor |
| Shader yazmak uzun sürer | Orta | `regimes.js` saf veri olduğu için önce atmosfer çalışır, efektler sonra eklenir |
| **Tek canvas hero dahil olduğu için ilk boyamada görünmez** (D15) | Orta | `z -1` gradyan hem three yüklenene kadar hem WebGL kapalıyken aynı işi görür; canvas geldiğinde opak olur |
| **Scrim'siz metin kontrastı sahneye bağlı** | Yüksek | Kontrast `visual-check.mjs` ile ölçülür (≥4.5:1); scrim agresifliği ölçümle ayarlanır, göz kararı değil |

---

## 12. Yol haritası

### Faz 1 — Dalış omurgası (bu spesifikasyon)
1. Yayın boru hattı: yeni repo, `outDir: dist`, `ci.yml` + `deploy.yml`
2. Tasarım sistemi: token'lar, IBM Plex, `style.css` bölünmesi
3. `regimes.js` + `biomes.js` (6 kayıt, D13) + `useDiveDepth` + testleri
4. Sahne motoru: `buildScene`, `particulate`, `rays`, `kelp`, `water`
5. `DiveScroll` + `DepthGauge`
6. `WordCycle`, `HomeView`/`WikiView` uyumu

### Faz 2 — Arşiv (ayrı spec)
Biyom haritası, crafting reçete tablosu, araç yükseltme ağacı. Veri modeli Faz 1'deki
`regimes.js` sınırlarına oturur — bu yüzden Faz 1 önce gelir.

### Faz 3 — Cilalama (ayrı spec)
OG/paylaşım meta etiketleri, `404.html`, `sitemap.xml`, `robots.txt`.
(Bu turda paylaşılabilirlik bilinçli olarak ertelendi.)
