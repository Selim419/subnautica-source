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
npm run test:base              # taban yolu kontrolü, 8 test
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

1. Kaynak repoyu `main`'e push'lar.
2. Her iki Pages reposundaki `.deploy-source` dosyasına yeni commit SHA'sını yazar ve
   push'lar.
3. Her Pages reposundaki `Deploy … site` iş akışı kendi `main` push'una tepki verir,
   `.deploy-source`'ta adı geçen commit'i checkout eder, **kendi** taban yoluyla
   derler, taban yolunu doğrular ve `actions/deploy-pages` ile yayınlar.

```powershell
node scripts/release.mjs --dry-run   # ne yapılacağını gösterir, hiçbir şey değiştirmez
node scripts/release.mjs --force     # pin zaten doğruysa da yeniden yayınlar
```

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
app/src/dive/     scroll'a bağlı dalış, derinlik rejimleri   (Plan 2)
app/src/scene/    prosedürel okyanus sahnesi (Three.js)     (Plan 2)
app/src/design/   renk, tipografi ve ölçü token'ları        (Plan 2)
app/scripts/      derleme ve taban yolu doğrulama
scripts/release.mjs  iki siteyi tek komutla yayınlar
docs/superpowers/ tasarım ve plan belgeleri
```
