package main

import (
	"embed"

	"log"
	"time"

	"wareon/services"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/updater"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/github"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/windows/icon.ico
var icon []byte

func init() {
	application.RegisterEvent[string]("time")
}

func main() {
	shotSvc := services.NewScreenShotService()
	shotSvc.PreloadSettings()

	app := application.New(application.Options{
		Name:        "ScreenshotOn",
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

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "Window 1",
		Width:  1000,
		Height: 618,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(6, 7, 15),
		URL:              "/",
		Frameless:        true,
		BackgroundType:   application.BackgroundTypeTransparent,
		DisableResize:    true,
		IgnoreMouseEvents: false,
		Windows: application.WindowsWindow{
			DisableFramelessWindowDecorations: true,
			WebView2CompositionHosting: true,
		},
	})

	systray := app.SystemTray.New()
	systray.SetIcon(icon)
	systray.OnClick(func() {
		if window.IsVisible() {
			window.Hide()
		} else {
			window.Show()
			window.Focus()
		}
	})

	go func() {
		for {
			now := time.Now().Format(time.RFC1123)
			app.Event.Emit("time", now)
			time.Sleep(time.Second)
		}
	}()
	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
