package services

import (
	"context"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

type ThemeState struct {
	app *application.App
}

func ThemeService() *ThemeState {
	return &ThemeState{}
}

func (t *ThemeState) GetTheme() string {
	if t.app.Env.IsDarkMode() {
		return "dark"
	}
	return "light"
}

func (t *ThemeState) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	t.app = application.Get()
	t.app.Event.OnApplicationEvent(events.Common.ThemeChanged, func(e *application.ApplicationEvent) {
		theme := "light"
		if e.Context().IsDarkMode() {
			theme = "dark"
		}
		t.app.Event.Emit("app:themeChanged", map[string]interface{}{
			"theme": theme,
		})
	})
	return nil
}

func (t *ThemeState) ServiceShutdown() error {
	return nil
}
