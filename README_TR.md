# ScreenshotOn

Windows için hızlı ve hafif ekran görüntüsü aracı. İstediğiniz alanı seçin, panoya kopyalayın veya PNG olarak kaydedin ve yakalama geçmişinize göz atın — hepsi tek bir kısayolla.

[🇺🇸 English](README.md)

![Platform](https://img.shields.io/badge/platform-Windows-0078D4)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8)
![Wails](https://img.shields.io/badge/Wails-v3-1E90FF)
![React](https://img.shields.io/badge/React-19-61DAFB)

## Özellikler

- **Bölge yakalama** — Serbest seçim, büyüteç ve canlı boyut göstergesi sunan tam ekran arayüz
- **Kayıpsız PNG** — Yeniden sıkıştırma olmadan doğrudan panoya kopyalama ve dosya aktarımı
- **Geçmiş galerisi** — Küçük resimler, büyük önizleme, tarihe göre gruplama ve hızlı yeniden kopyalama
- **Genel kısayollar** — Tamamı özelleştirilebilir ve kalıcı klavye kısayolları
- **Sistem uyumlu arayüz** — Açık, koyu veya Windows temasıyla senkronize görünüm; Türkçe ve İngilizce dil desteği
- **Otomatik başlatma ve güncelleme** — İsteğe bağlı sistem başlangıcında çalışma ve GitHub Releases üzerinden uygulama içi güncelleme

## Teknoloji Yığını

- **Backend:** Go, [Wails v3](https://v3.wails.io)
- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Paketleme:** NSIS Kurulumu (kullanıcı bazlı, yönetici izni gerekmez)

## Başlangıç

### Gereksinimler

- [Go](https://go.dev/dl/) 1.26+
- [Node.js](https://nodejs.org/) 20+
- [Wails3 CLI](https://v3.wails.io/getting-started/installation) (`wails3`)
- [NSIS](https://nsis.sourceforge.io) *(isteğe bağlı, kurulum paketi oluşturmak için)*

### Komutlar

```sh
# Geliştirme modunda çalıştır
wails3 dev

# Uygulamayı derle (çıktı: bin/screenshoton.exe)
wails3 build

# Kullanıcı bazlı kurulum paketini oluştur
wails3 package INSTALL_SCOPE=user
