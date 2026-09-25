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

### 1.3 Kapsam dışı

Faz 1 içeriğin **metinlerine, kaynak bağlantılarına ve görsellerine dokunmaz.**
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
| D7 | Yazı tipi **IBM Plex ailesi, self-host** | Türkçe latin-ext kapsamlı; `--display`'daki `Impact` tasarım dilini öldürüyor |
| D8 | `TextRoll` kodu bizim dosyamıza alınır, Skiper atfı kaldırılır | Artık onların kodu kullanılmıyor; kazanılan şey iyi bir fikir |
| D9 | CI yeşil değilse deploy olmaz | Şu an elle kopyalama var; kırık build canlı siteyi kırar |

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
    useDiveDepth.js     ← scroll 0..1 → { metres, regime, index, progress }
    DiveScroll.jsx      ← scroll uzunluğunu tanımlar, sahneyi sabitler
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

---

## 5. Derinlik rejimleri

Scroll toplam uzunluğu `--dive-length: 900vh` (hero 100vh + 5 bölüm × ~160vh).

| Derinlik | Rejim | Biyom anı | Atmosfer |
|---|---|---|---|
| 0–80 m | `daylight` | Sığ Resifler | Gündüz; ışık huzmeleri belirgin, su açık turkuaz |
| 80–200 m | `twilight` | Yosun Ormanı | Alacakaranlık; huzmeler sönüyor, kelp giriyor |
| 200–525 m | `midnight` | Mantar Ormanı | Mavi-siyah; biyolüminesan noktalar beliriyor |
| 525–1065 m | `deep` | Kayıp Nehir | Derin karanlık; sis artıyor, uzaklık çöktü |
| 1065–1400 m | `biolum` | Ampul Zonu | Siyah; amber-mor ışık, belirgin biyo-koridorlar |
| 1400 m+ | `biolum` | Kükürt Deposu | Aynı atmosfer; altın-lav vurgusu ve lav ışığı |

**Not:** Son iki biyom anı `biolum` rejimini paylaşır. Görsel fark atmosferden değil,
vurgu renginden ve sahne yerleşiminden gelir — bu, 6 ayrı atmosfer kodlamaktan bilinçli
olarak ucuzdur ve Bölüm 2'de onaylanan mockup ile birebir tutarlıdır.

`regimes.js` her rejim için şunları tanımlar: `water` rengi, `fogDensity`, `lightIntensity`,
`lightColor`, `raysOpacity`, `particleDensity`, `biolumIntensity`, `accent`.

---

## 6. Tasarım sistemi

### 6.1 Yazı tipi

| Rol | Aile | Kesim |
|---|---|---|
| Başlık | IBM Plex Sans Condensed | 500 / 600 / 600-italic |
| Teknik etiket, cetvel | IBM Plex Mono | 400 / 500 |
| Gövde | IBM Plex Sans | 400 / 600 |

- `app/public/fonts/*.woff2` — latin + **latin-ext** altkümesi (Türkçe `ı ğ ş İ ç ö ü`).
- `@font-face` + `font-display: swap`; yalnızca iki kritik kesim `preload` edilir.
- Üçüncü taraf isteği yok. Tahmini ~90 KB.
- **`Impact` ve `Arial` tamamen kaldırılır.**

**Kaynak ve lisans:** IBM Plex, SIL Open Font License 1.1 ile dağıtılır. Dosyalar
IBM'in resmi dağıtımından alınır ve `app/public/fonts/OFL.txt` lisans metniyle birlikte
depoya konur. OFL, lisans metnini pakette bulundurmayı zorunlu kılar — bu adım atlanırsa
yayın lisans ihlali olur.

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
  1400+ üstü sınır, indeks sürekliliği, metrenin monoton artması
- `useDiveDepth.test.js` — `0..1` clamp, sıfır ve bir uçları, metre doğruluğu

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
| `app/src/OceanScene.jsx` | `scene/OceanCanvas.jsx` + `buildScene.js` yerine geçiyor |
| `app/src/skiper58.jsx` | `components/WordCycle.jsx` yerine geçiyor (D8) |
| `app/src/style.css` | `design/*.css` + bileşen bloklarına bölünüyor |
| `docs/assets/`, `docs/index.html`, `docs/*.webp` | `docs/` artık build çıktısı değil (7.2) |

### 10.3 Değişen

| Dosya | Değişiklik |
|---|---|
| `app/vite.config.js` | `outDir: 'dist'`, `base: process.env.PAGES_BASE ?? '/'` |
| `app/index.html` | font `preload`, `<noscript>`, güncellenmiş `theme-color` |
| `app/src/main.jsx` | yeni token'lar, `DiveScroll` montajı |
| `app/src/HomeView.jsx` | `DiveScroll` + `DepthGauge`; **içerik metinleri değişmez** |
| `app/src/WikiView.jsx` | token uyumu, arka plan gradyanları; **kayıtlar değişmez** |
| `app/package.json` | `test` script'i, `vitest` devDependency |
| `.gitignore` | `.superpowers/`, `app/dist/` |
| `README.md` | yeni boru hattı ve komutlar |

---

## 11. Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Plex'e geçince başlıklar taşar / ritim bozulur | Orta | Tipografi ölçeği tarayıcıda yeniden ölçülür; `Impact`'ten daha geniş olduğu için display boyutları gözden geçirilir |
| Mobilde düşük FPS | Orta | Partikül bütçesi düşük; `IntersectionObserver` durdurma; gerekirse otomatik sadeleşme |
| Aynı commit iki siteyi birden bozar | Yüksek | CI yeşil gate; `release.mjs` o SHA'nın `CI` koşusu `success` olmadan pin yazmaz. Deploy sırası garanti edilmez ve iki siteyi birden güncellemek gerekmez |
| Yeni repo adı beğenilmez | Düşük | Ad tek satır değişiklik; build çıktısına dokunmaz |
| 3 `.webp` kartlarda döngüsel kalıyor | Düşük | Faz 1'de dokunulmaz; arka planlar CSS gradyanına geçer |
| Shader yazmak uzun sürer | Orta | `regimes.js` saf veri olduğu için önce atmosfer çalışır, efektler sonra eklenir |

---

## 12. Yol haritası

### Faz 1 — Dalış omurgası (bu spesifikasyon)
1. Yayın boru hattı: yeni repo, `outDir: dist`, `ci.yml` + `deploy.yml`
2. Tasarım sistemi: token'lar, IBM Plex, `style.css` bölünmesi
3. `regimes.js` + `useDiveDepth` + testleri
4. Sahne motoru: `buildScene`, `particulate`, `rays`, `kelp`, `water`
5. `DiveScroll` + `DepthGauge`
6. `WordCycle`, `HomeView`/`WikiView` uyumu

### Faz 2 — Arşiv (ayrı spec)
Biyom haritası, crafting reçete tablosu, araç yükseltme ağacı. Veri modeli Faz 1'deki
`regimes.js` sınırlarına oturur — bu yüzden Faz 1 önce gelir.

### Faz 3 — Cilalama (ayrı spec)
OG/paylaşım meta etiketleri, `404.html`, `sitemap.xml`, `robots.txt`.
(Bu turda paylaşılabilirlik bilinçli olarak ertelendi.)
