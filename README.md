# ScreenshotOn

Fast, lightweight screenshot tool for Windows. Select any region, copy it to the clipboard or save it as PNG, and browse your capture history — all from a global hotkey.

[🇹🇷 Türkçe](README.tr.md)

![Platform](https://img.shields.io/badge/platform-Windows-0078D4)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8)
![Wails](https://img.shields.io/badge/Wails-v3-1E90FF)
![React](https://img.shields.io/badge/React-19-61DAFB)

## Features

- **Region capture** — Fullscreen overlay with free-form selection, zoom loupe, and live dimensions
- **Lossless PNG** — Direct clipboard copy and file export without recompression
- **History gallery** — Thumbnails, lightbox preview, date grouping, and quick re-copy
- **Global hotkeys** — Fully remappable shortcuts with persistent settings
- **System-aware UI** — Light, dark, or Windows-synced theme with Turkish & English support
- **Auto-start & Updates** — Optional launch at sign-in and in-app updates via GitHub Releases

## Tech Stack

- **Backend:** Go, [Wails v3](https://v3.wails.io)
- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Packaging:** NSIS Installer (per-user, no UAC required)

## Getting Started

### Prerequisites

- [Go](https://go.dev/dl/) 1.26+
- [Node.js](https://nodejs.org/) 20+
- [Wails3 CLI](https://v3.wails.io/getting-started/installation) (`wails3`)
- [NSIS](https://nsis.sourceforge.io) *(optional, for building the installer)*

### Commands

```sh
# Run in development mode
wails3 dev

# Build binary (outputs to bin/)
wails3 build

# Build per-user installer
wails3 package INSTALL_SCOPE=user
