# ScreenshotOn

Windows için hızlı ve hafif ekran görüntüsü aracı. Herhangi bir bölgeyi seçin, panoya kopyalayın veya PNG olarak kaydedin — tümü tek bir genel kısayoldan.

[🇬🇧 English](README.md)

![Platform](https://img.shields.io/badge/platform-Windows-0078D4)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8)
![Wails](https://img.shields.io/badge/Wails-v3-1E90FF)
![React](https://img.shields.io/badge/React-19-61DAFB)

## Özellikler

- **Bölge yakalama** — serbest seçim, büyüteç ve canlı boyut gösterimi olan tam ekran overlay
- **Kayıpsız PNG** — pano kopyası ve dosya aktarımı yeniden sıkıştırma artefaktı olmadan
- **Yapılandırılabilir eylemler** — seçim sonrası davranış: manuel, kopyala veya kaydet
- **Geçmiş galerisi** — küçük resimler, lightbox önizleme, tarih grupları, silme ve yeniden kopyalama
- **Genel kısayollar** — her kısayol yeniden atanabilir ve kalıcı
- **Sistem temasına uyum** — açık, koyu veya Windows'u takip et
- **Türkçe & İngilizce** — otomatik dil algılama, manuel seçim desteği
- **Windows ile başlat** — isteğe bağlı oturum açılışında çalıştırma
- **Kendi kendine güncelleme** — GitHub Releases üzerinden kontrol ve uygulama içi kurulum

## Teknoloji

| Katman    | Teknoloji                          |
| --------- | ---------------------------------- |
| Backend   | Go, [Wails v3](https://v3.wails.io) |
| Frontend  | React 19, TypeScript, Tailwind CSS |
| Paket     | Wails NSIS installer (kullanıcı bazlı, UAC yok) |
| Güncelleme | GitHub Releases + Wails updater   |

## Başlarken

### Gereksinimler

- [Go](https://go.dev/dl/) 1.26+
- [Node.js](https://nodejs.org/) 20+
- [Wails3 CLI](https://v3.wails.io/getting-started/installation) (`wails3`)
- [NSIS](https://nsis.sourceforge.io) — sadece installer paketi için gerekli

### Geliştirme

```sh
wails3 dev
```

### Build

```sh
wails3 build
```

`bin/screenshoton.exe` üretir. `frontend/bindings/` altındaki frontend binding'leri Wails tarafından otomatik üretilir — düzenlemeyin veya commit'lemeyin.

### Installer

```sh
wails3 package INSTALL_SCOPE=user
```

`bin/ScreenshotOn-amd64-installer.exe` üretir; `%LocalAppData%` altına yönetici izni olmadan kurulur.

## Proje yapısı

```
├── main.go               # Uygulama giriş noktası, pencere, updater bağlantısı
├── services/             # Go backend servisleri (yakalama, ayarlar, geçmiş, kısayollar, güncelleme)
├── frontend/             # React + TypeScript arayüzü
│   └── src/
│       ├── pages/        # Home, Overlay, Settings, Selection, KeyboardShortcuts
│       ├── layouts/      # Uygulama kabuğu ve kenar çubuğu
│       ├── stores/       # Zustand state
│       └── i18n/         # tr.json / en.json çevirileri
├── build/                # İkonlar, Windows metadata, NSIS şablonları, Taskfile'lar
└── Taskfile.yml          # Wails build görevleri
```

## Sürümler & güncellemeler

Her release şu asset'leri içermelidir:

| Asset                              | Amaç                                      |
| ---------------------------------- | ----------------------------------------- |
| `screenshoton_windows_amd64.exe`   | Düz binary — uygulama içi updater bunu kullanır |
| `SHA256SUMS`                       | Güncelleme doğrulaması için checksum dosyası |
| `ScreenshotOn-amd64-installer.exe` | NSIS installer — ilk kurulum için          |

Checksum dosyasını build sonrası oluşturun:

```sh
# Windows (PowerShell)
Get-FileHash .\screenshoton_windows_amd64.exe -Algorithm SHA256
# veya sha256sum ile:
sha256sum screenshoton_windows_amd64.exe > SHA256SUMS
```

Tag'lemeden önce `services/update.go` içindeki `AppVersion`'ı yükseltin; updater karşılaştırmayı buna göre yapar.

## Lisans

Bu proje **source-available** özel lisans altındadır. Yazılımı kişisel ve ticari amaçlarla kullanabilir, inceleyebilir, indirebilir ve build alabilirsiniz; ancak yazılımın, binary'lerinin, installer'larının veya değiştirilmiş sürümlerinin **satışı, yeniden dağıtımı ve yayınlanması yasaktır**.

Tam metin için [LICENSE](LICENSE) dosyasına bakın. Lisans soruları için: https://wareon.dev
