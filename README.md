# ScreenshotOn

Fast, lightweight screenshot tool for Windows. Select any region, copy it to the clipboard or save it as PNG, and browse your capture history — all from a global hotkey.

![Platform](https://img.shields.io/badge/platform-Windows-0078D4)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8)
![Wails](https://img.shields.io/badge/Wails-v3-1E90FF)
![React](https://img.shields.io/badge/React-19-61DAFB)

## Features

- **Region capture** — fullscreen overlay with free-form selection, zoom loupe, and live dimensions
- **Lossless Picture** — clipboard copy and file export without recompression artifacts
- **Configurable actions** — choose what happens after selection: manual, copy, or save
- **History gallery** — thumbnails, lightbox preview, date grouping, delete, and re-copy
- **Global hotkeys** — every shortcut is remappable and persisted
- **Turkish & English** — automatic locale detection with manual override

## Getting started

### Prerequisites

- [Go](https://go.dev/dl/) 1.26+
- [Node.js](https://nodejs.org/) 20+
- [Wails3 CLI](https://v3.wails.io/getting-started/installation) (`wails3`)
- [NSIS](https://nsis.sourceforge.io) — only needed for installer packaging

### Installer

```sh
wails3 package
```

## Project structure

```
├── main.go               # App entry point, window, updater wiring
├── services/             # Go backend services (capture, settings, history, hotkeys, updates)
├── frontend/             # React + TypeScript frontend
│   └── src/
│       ├── pages/        # Home, Overlay, Settings, Selection, KeyboardShortcuts
│       ├── layouts/      # App shell and sidebar
│       ├── stores/       # Zustand state
│       └── i18n/         # tr.json / en.json translations
├── build/                # Icons, Windows metadata, NSIS templates, Taskfiles
└── Taskfile.yml          # Wails build tasks
```
