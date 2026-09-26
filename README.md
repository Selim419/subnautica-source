# Subnautica · Derinlik Günlüğü

Türkçe, hayran yapımı Subnautica tanıtım ve wiki örneği. Resmî Subnautica sitesi değildir.

React, Vite, Motion, Anime.js ve Three.js. Tıklanabilir bölüm, arayüz ve içerik
kaynakları için `docs/superpowers/specs/` altındaki tasarım belgesine bak.

## Canlı

- <https://selim419.github.io/>
- <https://selim419.github.io/subnautica-derinlik-gunlugu/>

## Yerelde geliştirme

```powershell
cd app
npm ci
npm run dev
```

## Derleme

```powershell
cd app
npm run test:base              # taban yolu kontrolü, 10 test
npm run build:root             # base = /
npm run build:subpath          # base = /subnautica-derinlik-gunlugu/
```

Çıktı `app/dist/` altına yazılır. `PAGES_BASE` ortam değişkeninden okunur; iki site
tek kaynaktan aynı kodu farklı taban yoluyla üretir.

**Taban yolu elle kopyalanmaz.** `verify-base` derlenmiş `index.html`'in gerçekten
beklenen taban yolunu referans verdiğini kanıtlar ve yanlışsa derlemeyi kırmızıya
düşürür. Sadece kök site için derlenmiş bir çıktı, alt yol kontrolünden geçmez.

## Yayınlama

```powershell
node scripts/release.mjs
```

Tek komut her iki siteyi de günceller:

1. Üç repoyu da kontrol eder: temiz, `main` üzerinde ve `origin` beklenen repo.
   Bu kontrol ilk mutasyondan **önce** yapılır; aksi hâlde yarım kalmış bir
   sürüm bırakırdı.
2. Kaynak repoyu `main`'e push'lar.
3. O commit'e ait `CI` koşusunu bekler. **Sonucu `success` değilse pin yazmaz** ve
   durur. Koşu hiç görünmezse ya da bekleme zamanı dolarsa da pin yazılmaz —
   bilinmeyen CI durumu yeşil sayılmaz.
4. Her iki Pages reposundaki `.deploy-source` dosyasına yeni commit SHA'sını yazar ve
   push'lar.
5. Her Pages reposundaki `Deploy … site` iş akışı kendi `main` push'una tepki verir,
   `.deploy-source`'ta adı geçen commit'i checkout eder, **kendi** taban yoluyla
   derler, taban yolunu doğrular ve `actions/deploy-pages` ile yayınlar.

```powershell
node scripts/release.mjs --dry-run   # ne yapılacağını gösterir, hiçbir şey değiştirmez
node scripts/release.mjs --force     # pin zaten doğruysa da yeniden yayınlar
```

Pages klonlarının yolu varsayılan olarak bu makinenin düzenidir; başka bir yolda
olacaksa `--root-dir` / `--subpath-dir` ya da `PAGES_ROOT_DIR` /
`PAGES_SUBPATH_DIR` ile verilir. Hedefin `origin`'i beklenen repo değilse ya da
`main` üzerinde değilse komut **gürültüyle değil, hatayla** durur.

`release.mjs` üç repodan biri kirliyse **durur**. Bu kontrol bilinçlidir: commit
edilmemiş bir iş akışı dosyası, `.deploy-source` doğru ilerlerken hiçbir şey
yayınlamadan başarılı görünebilir.

### İki Pages deposu neden ayrı?

`selim419.github.io` kök siteyi, `subnautica-derinlik-gunlugu` alt yolu sunar. İkisi
aynı kaynaktan beslenir ama farklı taban yolu gerektirir, dolayısıyla ayrı derlenir.
Hiçbirinde build çıktısı tutulmaz.

### Bu boru hattında secret yok

Ne PAT, ne API anahtarı, ne Actions secret. `Deploy … site` iş akışları
`pages: write` ve `id-token: write` iznini kendi `GITHUB_TOKEN`'larıyla alır.

Bir `repository_dispatch` + fine-grained PAT tasarımı denendi ve **terk edildi**:
token'ın `contents=write` izni çalıştırılamadı ve 90 günde bir yenilenmesi
gerekecekti. Kalan tek kimlik bilgisi SSH anahtarıdır ve o sadece yerel klon içindir.

## Depolar

| Depo | Rol |
| --- | --- |
| `Selim419/subnautica-source` | Kaynak kod, CI ve dokümantasyon |
| `Selim419/Selim419.github.io` | Kök site — yalnızca iş akışı ve `.deploy-source` |
| `Selim419/subnautica-derinlik-gunlugu` | Alt yol — yalnızca iş akışı ve `.deploy-source` |

## Yapı

```
app/index.html                  yükleme sırası, yazı tipleri ön yüklemesi
app/src/main.jsx                rota okuma, kabuk, stil sırası
app/src/HomeView.jsx            ana sayfa
app/src/WikiView.jsx            veri tabanı ve kayıt paneli
app/src/OceanScene.jsx          prosedürel okyanus sahnesi (Three.js)
app/src/wikiData.js             kayıt içeriği
app/src/skiper58.jsx            üst gezinme, TextRoll etkisi
app/src/design/tokens.css       1. katman: renk, ölçü, aralık, kırılım token'ları
app/src/design/type.css         2. katman: @font-face, yazı tipi ve punto token'ları
app/src/design/layout.css       3. katman: sıfırlama, kabuk, ölçüler
app/src/design/chrome.css       gezinme, düğmeler, alt bilgi
app/src/design/hero.css         giriş bölümü ve şerit
app/src/design/dive.css         dalış bölümü, manifesto, kapanış
app/src/design/wiki.css         veri tabanı sayfası
app/src/design/readTokens.js    Three.js materyalleri için token okuyucu
app/scripts/build-with-base.mjs taban yoluna göre derleme
app/scripts/verify-base.mjs     derlenmiş index.html taban yolu doğrulaması
app/scripts/visual-check.mjs   CDP ölçüm aracı (taşma, satır kayması, kırpılan metin)
app/scripts/page-probe.js       sayfa içinde çalışan ölçüm betiği
scripts/release.mjs             iki siteyi tek komutla yayınlar
docs/superpowers/                tasarım ve plan belgeleri
```

`app/src/design/` üç katmanlıdır ve bu sırayla yüklenir: `tokens.css` ve `type.css`
tüketilen özel özellikleri tanımlar, `layout.css` ve bileşen katmanları onları
kullanır. `main.jsx` bu yedi içe aktarımı sırayla yapar; tek bir `style.css` yoktur.

Dalış omurgası ve kaydırmaya bağlı sahne Plan 2'nin konusu. Bugün ikisi de yok:
prosedürel sahne `app/src/OceanScene.jsx` içinde tek dosya olarak yaşıyor ve dalış
omurgası için henüz kaynak dosya yazılmadı.
