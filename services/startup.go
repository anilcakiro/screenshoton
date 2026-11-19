package services

import (
	"log"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const (
	runKeyPath    = `Software\Microsoft\Windows\CurrentVersion\Run`
	runValueName  = "ScreenshotOn"
	legacyRunName = "ScreenShotOn"
)

func applyStartupSetting(enabled bool) {
	key, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.SET_VALUE|registry.QUERY_VALUE)
	if err != nil {
		log.Printf("startup registry açılamadı: %v", err)
		return
	}
	defer key.Close()

	_ = key.DeleteValue(legacyRunName)
	if enabled {
		exe, err := os.Executable()
		if err != nil {
			log.Printf("startup exe yolu alınamadı: %v", err)
			return
		}
		if err := key.SetStringValue(runValueName, `"`+filepath.Clean(exe)+`"`); err != nil {
			log.Printf("startup kaydı yazılamadı: %v", err)
		}
		return
	}
	_ = key.DeleteValue(runValueName)
}
