package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type AppSettings struct {
	AutoSavePNG       bool   `json:"autoSavePNG"`
	Theme             string `json:"theme"`
	Hotkey            string `json:"hotkey"`
	OverlayCopy       string `json:"overlayCopy"`
	OverlaySave       string `json:"overlaySave"`
	OverlayCancel     string `json:"overlayCancel"`
	AfterSelect       string `json:"afterSelect"`
	SaveDir           string `json:"saveDir"`
	ShowCopiedHistory bool   `json:"showCopiedHistory"`
	StartWithWindows  bool   `json:"startWithWindows"`
	PrewarmOverlay    bool   `json:"prewarmOverlay"`
}

const (
	defaultHotkey        = "PrintScreen"
	defaultOverlayCopy   = "Ctrl+C"
	defaultOverlaySave   = "Ctrl+S"
	defaultOverlayCancel = "Escape"
	defaultAfterSelect   = "manual"
)

var settingsMu sync.Mutex

func normalizeSettings(s AppSettings) AppSettings {
	switch s.Theme {
	case "light", "dark":
	default:
		s.Theme = "system"
	}
	if s.Hotkey == "" {
		s.Hotkey = defaultHotkey
	}
	if s.OverlayCopy == "" {
		s.OverlayCopy = defaultOverlayCopy
	}
	if s.OverlaySave == "" {
		s.OverlaySave = defaultOverlaySave
	}
	if s.OverlayCancel == "" {
		s.OverlayCancel = defaultOverlayCancel
	}
	switch s.AfterSelect {
	case "manual", "copy", "save":
	default:
		s.AfterSelect = defaultAfterSelect
	}
	s.SaveDir = strings.TrimSpace(s.SaveDir)
	return s
}

func parseHotkeyCombo(combo string) (mods uint32, vk uint32, err error) {
	parts := strings.Split(combo, "+")
	keyName := strings.TrimSpace(parts[len(parts)-1])
	for _, p := range parts[:len(parts)-1] {
		switch strings.ToLower(strings.TrimSpace(p)) {
		case "ctrl", "control":
			mods |= 0x0002
		case "alt":
			mods |= 0x0001
		case "shift":
			mods |= 0x0004
		case "win", "windows", "super", "meta":
			mods |= 0x0008
		default:
			return 0, 0, fmt.Errorf("bilinmeyen modifier: %s", p)
		}
	}
	vk, ok := hotkeyVK(strings.ToLower(keyName))
	if !ok {
		return 0, 0, fmt.Errorf("bilinmeyen tuş: %s", keyName)
	}
	return mods, vk, nil
}

func hotkeyVK(name string) (uint32, bool) {
	named := map[string]uint32{
		"escape": 0x1B, "esc": 0x1B, "enter": 0x0D, "return": 0x0D,
		"space": 0x20, "tab": 0x09, "backspace": 0x08,
		"delete": 0x2E, "del": 0x2E, "insert": 0x2D, "ins": 0x2D,
		"home": 0x24, "end": 0x23,
		"pageup": 0x21, "pgup": 0x21, "pagedown": 0x22, "pgdn": 0x22,
		"up": 0x26, "down": 0x28, "left": 0x25, "right": 0x27,
		"printscreen": 0x2C, "prtsc": 0x2C, "snapshot": 0x2C,
		"scrolllock": 0x91, "pause": 0x13, "break": 0x13,
		"capslock": 0x14, "numlock": 0x90, "apps": 0x5D,
		"volumeup": 0xAF, "volumedown": 0xAE, "volumemute": 0xAD,
		"medianext": 0xB0, "mediaprev": 0xB1, "mediastop": 0xB2,
		"medianexttrack": 0xB0, "mediaprevioustrack": 0xB1,
	}
	if vk, ok := named[name]; ok {
		return vk, true
	}
	if len(name) == 1 {
		c := name[0]
		if c >= 'a' && c <= 'z' {
			return uint32(c - 'a' + 'A'), true
		}
		if c >= '0' && c <= '9' {
			return uint32(c), true
		}
	}
	if len(name) == 2 && name[0] == 'f' && name[1] >= '1' && name[1] <= '9' {
		return uint32(0x6F + name[1] - '0'), true
	}
	if len(name) == 3 && name[0] == 'f' && name[1] == '1' && name[2] >= '0' && name[2] <= '2' {
		return uint32(0x79 + name[2] - '0'), true
	}
	return 0, false
}
func settingsPath() (string, error) {
	cfg, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(cfg, "ScreenshotOn", "settings.json"), nil
}
func loadSettings() AppSettings {
	s := AppSettings{
		AutoSavePNG:       false,
		Theme:             "system",
		ShowCopiedHistory: true,
	}
	path, err := settingsPath()
	if err != nil {
		return s
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return s
	}
	if err := json.Unmarshal(data, &s); err != nil {
		return AppSettings{Theme: "system"}
	}
	return normalizeSettings(s)
}
func saveSettingsToDisk(s AppSettings) error {
	path, err := settingsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
func (s *ScreenshotService) GetSettings() AppSettings {
	settingsMu.Lock()
	defer settingsMu.Unlock()
	return s.settings
}
func (s *ScreenshotService) SaveSettings(next AppSettings) error {
	next = normalizeSettings(next)
	if _, _, err := parseHotkeyCombo(next.Hotkey); err != nil {
		return fmt.Errorf("geçersiz kısayol: %w", err)
	}
	settingsMu.Lock()
	prev := s.settings
	s.settings = next
	cur := s.settings
	settingsMu.Unlock()

	if err := saveSettingsToDisk(cur); err != nil {
		settingsMu.Lock()
		s.settings = prev
		settingsMu.Unlock()
		return fmt.Errorf("ayarlar kaydedilemedi: %w", err)
	}

	if s.app != nil {
		s.app.Event.Emit("app:settings-changed", map[string]any{
			"settings": cur,
		})
	}
	if prev.Hotkey != cur.Hotkey && s.hotkeyCh != nil {
		select {
		case s.hotkeyCh <- cur.Hotkey:
		default:
		}
	}
	s.applyStartupSetting(cur.StartWithWindows)
	if !prev.PrewarmOverlay && cur.PrewarmOverlay {
		go func() {
			time.Sleep(2 * time.Second)
			s.maybePrewarmOverlay()
		}()
	}
	return nil
}
func (s *ScreenshotService) PreloadSettings() {
	s.applyLoadSettings()
}
func (s *ScreenshotService) applyLoadSettings() {
	settingsMu.Lock()
	s.settings = loadSettings()
	settingsMu.Unlock()
	cur := s.GetSettings()
	s.applyStartupSetting(cur.StartWithWindows)
	log.Printf("settings loaded: autoSave=%v theme=%s saveDir=%q afterSelect=%s",
		cur.AutoSavePNG, cur.Theme, cur.SaveDir, cur.AfterSelect)
}
func (s *ScreenshotService) GetSaveDir() string {
	return s.saveDir()
}
func (s *ScreenshotService) copiedHistoryEnabled() bool {
	settingsMu.Lock()
	defer settingsMu.Unlock()
	return s.settings.ShowCopiedHistory
}
func (s *ScreenshotService) autoSavePNG() bool {
	settingsMu.Lock()
	defer settingsMu.Unlock()
	return s.settings.AutoSavePNG
}
func (s *ScreenshotService) applyStartupSetting(enabled bool) {
	if s.app == nil || s.app.Autostart == nil {
		return
	}
	if enabled {
		if err := s.app.Autostart.Enable(); err != nil {
			log.Printf("autostart enable: %v", err)
		}
		return
	}
	if err := s.app.Autostart.Disable(); err != nil {
		log.Printf("autostart disable: %v", err)
	}
}
