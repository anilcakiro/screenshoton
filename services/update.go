package services

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/updater"
)

const (
	AppVersion = "1.0.3"
	UpdateRepo = "anilcakiro/screenshoton"
)

type UpdateInfo struct {
	Current         string `json:"current"`
	Latest          string `json:"latest"`
	UpdateAvailable bool   `json:"updateAvailable"`
	ReleaseURL      string `json:"releaseUrl"`
	Notes           string `json:"notes,omitempty"`
	Error           string `json:"error,omitempty"`
}

func (s *ScreenshotService) GetVersion() string {
	return AppVersion
}

func (s *ScreenshotService) CheckForUpdate() UpdateInfo {
	info := UpdateInfo{Current: AppVersion}
	if s.app == nil {
		info.Error = "updater hazır değil"
		return info
	}

	rel, err := s.app.Updater.Check(context.Background())
	if err != nil {
		info.Error = err.Error()
		return info
	}
	if rel == nil {
		return info
	}

	info.Latest = rel.Version
	info.UpdateAvailable = true
	info.Notes = rel.Notes
	if u, ok := rel.Metadata["github.release.htmlURL"].(string); ok {
		info.ReleaseURL = u
	}
	if info.ReleaseURL == "" {
		info.ReleaseURL = fmt.Sprintf("https://github.com/%s/releases", UpdateRepo)
	}
	return info
}

func (s *ScreenshotService) DownloadUpdate() error {
	if s.app == nil {
		return fmt.Errorf("updater hazır değil")
	}
	return s.app.Updater.DownloadAndInstall(context.Background())
}

func (s *ScreenshotService) InstallUpdate() error {
	if s.app == nil {
		return fmt.Errorf("updater hazır değil")
	}
	return s.app.Updater.Restart(context.Background())
}

func (s *ScreenshotService) watchUpdaterProgress() {
	if s.app == nil {
		return
	}
	s.app.Event.On(updater.EventDownloadProgress, func(e *application.CustomEvent) {
		if p, ok := e.Data.(updater.Progress); ok && p.Total > 0 {
			s.app.Event.Emit("update:progress", int(p.Written*100/p.Total))
		}
	})
}
