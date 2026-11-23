package main

import (
	"embed"
	"os"
	"slices"

	"log"

	"wareon/services"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/updater"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/github"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/windows/icon.ico
var icon []byte

func main() {
	shotSvc := services.NewScreenShotService()
	shotSvc.PreloadSettings()

	var window *application.WebviewWindow
	app := application.New(application.Options{
		Name: "ScreenshotOn",
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "dev.wareon.screenshoton",
			OnSecondInstanceLaunch: func(application.SecondInstanceData) {
				if window != nil {
					window.Show()
					window.Focus()
				}
			},
		},
		Services: []application.Service{
			application.NewService(services.ThemeService()),
			application.NewService(shotSvc),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	if gh, err := github.New(github.Config{
		Repository:    services.UpdateRepo,
		ChecksumAsset: "SHA256SUMS",
	}); err == nil {
		if err := app.Updater.Init(updater.Config{
			CurrentVersion: services.AppVersion,
			Providers:      []updater.Provider{gh},
			Window:         updater.WindowNone,
		}); err != nil {
			log.Printf("updater init: %v", err)
		}
	} else {
		log.Printf("updater provider: %v", err)
	}

	startHidden := slices.Contains(os.Args[1:], "--tray")
	window = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:             "Dashboard",
		Width:             1000,
		Height:            618,
		BackgroundColour:  application.NewRGB(6, 7, 15),
		URL:               "/",
		Hidden:            startHidden,
		Frameless:         true,
		BackgroundType:    application.BackgroundTypeTransparent,
		DisableResize:     true,
		IgnoreMouseEvents: false,
		Windows: application.WindowsWindow{
			DisableFramelessWindowDecorations: true,
			WebView2CompositionHosting:        true,
		},
	})

	systray := app.SystemTray.New()
	systray.SetIcon(icon)
	window.OnWindowEvent(events.Common.WindowHide, func(*application.WindowEvent) {
		systray.Show()
	})
	window.OnWindowEvent(events.Common.WindowShow, func(*application.WindowEvent) {
		systray.Hide()
	})
	systray.OnClick(func() {
		if window.IsVisible() {
			window.Hide()
		} else {
			window.Show()
			window.Focus()
		}
	})

	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
