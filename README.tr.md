https://github.com/user-attachments/assets/786a94a4-5b5e-4c4d-bfc2-7d341b138c13

# ScreenshotOn

Windows için hafif, hızlı ve bir ekran görüntüsü aracı.

Tek bir genel kısayol ile ekranın herhangi bir bölgesini yakalayın; kayıpsız PNG olarak panoya kopyalayın veya kaydedin, isteğe bağlı olarak çizim araçlarıyla işaretleyin.

[🇬🇧 English](README.md)

![Platform](https://img.shields.io/badge/platform-Windows-0078D4)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8)
![Wails](https://img.shields.io/badge/Wails-v3-1E90FF)
![React](https://img.shields.io/badge/React-19-61DAFB)

---

## Yetenekler

### Yakalama
- Tam ekran overlay üzerinde serbest biçimli bölge seçimi
- Canlı boyut göstergesi ve 8 yönlü yeniden boyutlandırma
- DPI ölçeklemesi yüksek ortamlarda tutarlı davranış
- Kayıpsız PNG çıktısı — önizleme ve dışa aktarımda kalite kaybı yok

### Çizim ve Anotasyon
- Beş araç: kalem, ok, dikdörtgen, elips ve otomatik numaralı pin
- Yedi renk, geri alma ve toplu temizleme
- Anotasyonlar seçim bölgesiyle birlikte panoya veya dosyaya aktarılır

### Geçmiş
- Yakalamalar otomatik olarak geçmişe eklenir
- Küçük resim görünümü, tarih bazlı gruplama ve lightbox önizleme
- Tek tek veya toplu silme, geçmişten yeniden kopyalama

### Paylaşım
- Tek tıkla panoya kopyalama veya PNG olarak kaydetme
- Seçim sonrası davranış otomatik tetiklenebilir

### Platform
- Windows ile otomatik başlatma
- Sistem tepsisi entegrasyonu
- Uygulama içinden doğrulamalı güncelleme

---

## Ayarlanabilir Özellikler

| Ayar | Açıklama |
|---|---|
| Genel kısayol | Varsayılan `PrintScreen` — overlay'i açar; tüm kısayollar yeniden atanabilir |
| Overlay kısayolları | Kopyala, kaydet ve iptal tuşları özelleştirilebilir |
| Seçim sonrası davranış | Manuel, otomatik kopyala veya otomatik kaydet |
| Kayıt klasörü | Yerel dizin seçici ile değiştirilebilir (varsayılan: `Pictures\ScreenshotOn`) |
| Tema | Açık, koyu veya Windows sistem temasını takip etme |
| Dil | Türkçe veya İngilizce — PC diline göre otomatik algılama |
| Windows ile başlat | Oturum açılışında otomatik çalıştırma |
| Overlay'i önceden hazırla | Açılıştan ~10 sn sonra overlay penceresini gizlice belleğe alır; ilk ekran görüntüsü neredeyse anında açılır.<br>• **Kapalı** (varsayılan): overlay ilk kullanımda oluşturulur, RAM harcamaz<br>• **Açık**: ~200 MB ek RAM karşılığında anında açılış |

---

## Sistem Gereksinimleri

- Windows 10/11 (x64)
- Microsoft Edge WebView2 Runtime (Windows 11'de yerleşik)

## Kurulum

1. [GitHub Releases](https://github.com/anilcakiro/screenshoton/releases/latest) sayfasından `ScreenshotOn-Setup.exe` dosyasını indirin.
2. Yürütülebilir dosyayı çalıştırın — kurulum `%LocalAppData%\Programs\Wareon\ScreenshotOn` altına yapılır, yönetici izni gerekmez.
3. `PrintScreen` tuşuna basarak overlay'i başlatın, bölgeyi seçin ve kopyalayın.

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

`bin/ScreenshotOn-Setup.exe` üretir; `%LocalAppData%` altına yönetici izni olmadan kurulur.

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

| Asset                                   | Amaç                                      |
| --------------------------------------- | ----------------------------------------- |
| `ScreenshotOn-Setup.exe`                | NSIS installer — ilk kurulum için          |
| `ScreenshotOn-Update-windows-amd64.exe` | Düz binary — uygulama içi updater bunu kullanır |
| `SHA256SUMS`                            | Güncelleme doğrulaması için checksum dosyası |

Üç asset'in hepsini tek komutla üretin:

```sh
wails3 task windows:release SIGN_THUMBPRINT=<sertifika-thumbprint>
```

Bu komut production build'i çalıştırır, NSIS installer'ı paketler, binary'yi `ScreenshotOn-Update-windows-amd64.exe` olarak kopyalar, iki exe'yi de imzalar ve `SHA256SUMS` dosyasını üretir — hepsi `bin/` içinde. Authenticode imzasını atlamak için `SIGN_THUMBPRINT` parametresini vermeyin.

Alternatif olarak checksum'u build sonrası elle üretebilirsiniz:

```sh
# Windows (PowerShell)
Get-FileHash .\ScreenshotOn-Update-windows-amd64.exe -Algorithm SHA256
# veya sha256sum ile:
sha256sum ScreenshotOn-Update-windows-amd64.exe > SHA256SUMS
```

Tag'lemeden önce `services/update.go` içindeki `AppVersion`'ı yükseltin; updater karşılaştırmayı buna göre yapar.
