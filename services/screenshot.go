package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/draw"
	"image/png"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"

	"github.com/kbinani/screenshot"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type ScreenshotService struct {
	lastCapture  *image.RGBA
	dataURLCache atomic.Value
	everShown    atomic.Bool

	overlayPaintPending atomic.Bool

	overlayBeenShown atomic.Bool
	paintHideOK      atomic.Bool

	showOnFreshPaint atomic.Bool

	sessionSeq atomic.Uint64

	pendingCloseHide atomic.Pointer[time.Timer]

	settings AppSettings

	hotkeyCh chan string

	app        *application.App
	overlayWin *application.WebviewWindow
}

func NewScreenShotService() *ScreenshotService {
	return &ScreenshotService{hotkeyCh: make(chan string, 1)}
}

var (
	user32         = syscall.NewLazyDLL("user32.dll")
	procFindWindow = user32.NewProc("FindWindowW")
	procShowWindow = user32.NewProc("ShowWindow")
)

func setTaskbarVisible(visible bool) {
	ptr, _ := syscall.UTF16PtrFromString("Shell_TrayWnd")
	hwnd, _, _ := procFindWindow.Call(uintptr(unsafe.Pointer(ptr)), 0)
	if hwnd != 0 {
		mode := uintptr(0)
		if visible {
			mode = uintptr(4)
		}
		procShowWindow.Call(hwnd, mode)
	}
}

func (s *ScreenshotService) GetLastCaptureDataURL() (string, error) {
	if cached, ok := s.dataURLCache.Load().(string); ok && cached != "" {
		return cached, nil
	}
	if s.lastCapture == nil {
		return "", nil
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, s.lastCapture); err != nil {
		return "", err
	}
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
	s.dataURLCache.Store(dataURL)
	return dataURL, nil
}

func (s *ScreenshotService) cropLastCapture(x, y, w, h int) (*image.RGBA, error) {
	if s.lastCapture == nil {
		return nil, errors.New("no capture in memory")
	}

	bounds := s.lastCapture.Bounds()
	x = max(bounds.Min.X, min(x, bounds.Max.X))
	y = max(bounds.Min.Y, min(y, bounds.Max.Y))
	w = min(w, bounds.Max.X-x)
	h = min(h, bounds.Max.Y-y)

	if w <= 0 || h <= 0 {
		return nil, errors.New("empty region")
	}

	sub := s.lastCapture.SubImage(image.Rect(x, y, x+w, y+h))
	rgba, ok := sub.(*image.RGBA)
	if !ok {
		rgba = image.NewRGBA(sub.Bounds())
		draw.Draw(rgba, rgba.Bounds(), sub, sub.Bounds().Min, draw.Src)
	}
	return rgba, nil
}

func (s *ScreenshotService) ExtractRegion(x, y, w, h int) (string, error) {
	rgba, err := s.cropLastCapture(x, y, w, h)
	if err != nil {
		return "", err
	}

	if err := CopyImageToClipboard(rgba); err != nil {
		return "", err
	}
	if s.copiedHistoryEnabled() {
		if _, _, herr := saveHistoryPNG("clip", rgba); herr != nil {
			log.Printf("history clip kaydedilemedi: %v", herr)
		} else if s.app != nil {
			s.app.Event.Emit("history:changed")
		}
	}
	if s.autoSavePNG() {
		if p, serr := writeLosslessPNG(rgba, s.saveDir()); serr != nil {
			log.Printf("otomatik PNG kaydı başarısız: %v", serr)
		} else {
			log.Printf("otomatik PNG kaydedildi: %s", p)
		}
	}
	b := rgba.Bounds()
	log.Printf("Region copied to clipboard: %dx%d (%d,%d)", b.Dx(), b.Dy(), b.Min.X, b.Min.Y)
	return "", nil
}

func (s *ScreenshotService) saveDir() string {
	settingsMu.Lock()
	d := strings.TrimSpace(s.settings.SaveDir)
	settingsMu.Unlock()
	if d != "" {
		if err := os.MkdirAll(d, 0o755); err == nil {
			return d
		}
	}
	return defaultSaveDir()
}

func defaultSaveDir() string {
	if home, err := os.UserHomeDir(); err == nil {
		dir := filepath.Join(home, "Pictures", "ScreenshotOn")
		if err := os.MkdirAll(dir, 0o755); err == nil {
			return dir
		}
	}
	if dl, err := downloadsDir(); err == nil {
		return dl
	}
	return os.TempDir()
}

func writeLosslessPNG(rgba *image.RGBA, dir string) (string, error) {
	name := fmt.Sprintf("screenshoton-kirpma-%dx%d-%s.png",
		rgba.Bounds().Dx(), rgba.Bounds().Dy(), time.Now().Format("20060102-150405"))
	path := filepath.Join(dir, name)
	f, err := os.Create(path)
	if err != nil {
		return "", fmt.Errorf("dosya oluşturulamadı: %w", err)
	}
	defer f.Close()
	if err := png.Encode(f, rgba); err != nil {
		return "", fmt.Errorf("PNG kodlanamadı: %w", err)
	}
	return path, nil
}

func (s *ScreenshotService) ExtractRegionToFile(x, y, w, h int) (string, error) {
	rgba, err := s.cropLastCapture(x, y, w, h)
	if err != nil {
		return "", err
	}

	path, err := writeLosslessPNG(rgba, s.saveDir())
	if err != nil {
		return "", err
	}

	if _, _, herr := saveHistoryPNG("file", rgba); herr != nil {
		log.Printf("history file kaydedilemedi: %v", herr)
	} else if s.app != nil {
		s.app.Event.Emit("history:changed")
	}
	log.Printf("Region saved lossless: %s", path)
	return path, nil
}

func downloadsDir() (string, error) {
	if home, err := os.UserHomeDir(); err == nil {
		dl := filepath.Join(home, "Downloads")
		if info, err := os.Stat(dl); err == nil && info.IsDir() {
			return dl, nil
		}
		return os.TempDir(), nil
	}
	return os.TempDir(), nil
}

func (s *ScreenshotService) ServiceShutdown() {
	setTaskbarVisible(true)
	s.stopAltTabBlocker()
}

func cleanupTempShots() {
	for _, pattern := range []string{"snip-*.png", "shot-*.png"} {
		if matches, err := filepath.Glob(filepath.Join(os.TempDir(), pattern)); err == nil {
			for _, p := range matches {
				if err := os.Remove(p); err != nil {
					log.Printf("temp cleanup failed for %s: %v", p, err)
				}
			}
		}
	}
}

func (s *ScreenshotService) CaptureFullScreen() (string, error) {
	bounds := screenshot.GetDisplayBounds(0)
	img, err := screenshot.CaptureRect(bounds)
	if err != nil {
		return "", err
	}

	f, err := os.CreateTemp("", "shot-*.png")
	if err != nil {
		return "", err
	}

	defer f.Close()

	if err := png.Encode(f, img); err != nil {
		return "", err
	}
	log.Printf("ScreenShot Saved: %s", f.Name())
	return f.Name(), nil
}

func (t *ScreenshotService) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	t.app = application.Get()
	t.watchUpdaterProgress()
	t.applyLoadSettings()
	cleanupTempShots()
	if t.overlayWin == nil {
		bounds := screenshot.GetDisplayBounds(0)
		scale := 1.0
		if scr := t.app.Screen.GetPrimary(); scr != nil && scr.ScaleFactor > 0 {
			scale = float64(scr.ScaleFactor)
		}
		t.ensureOverlayWindow(bounds, scale)
	}
	t.app.Event.On("overlay:background-ready", func(_ *application.CustomEvent) {
		if t.everShown.CompareAndSwap(false, true) {
			log.Printf("overlay:background-ready → ilk gösterim")
			t.showOverlayNow(t.sessionSeq.Load())
		}
	})
	t.app.Event.On("overlay:painted", func(_ *application.CustomEvent) {
		if t.showOnFreshPaint.CompareAndSwap(true, false) {
			log.Printf("overlay:painted → taze kareyle gösterim")
			t.showOverlayNow(t.sessionSeq.Load())
			return
		}
		if t.paintHideOK.Load() &&
			t.paintHideOK.CompareAndSwap(true, false) &&
			t.overlayPaintPending.CompareAndSwap(true, false) &&
			t.overlayWin != nil && t.overlayWin.IsVisible() {
			setTaskbarVisible(false)
		}
	})
	go t.startGlobalHotkey()

	go t.startAltTabBlocker()
	return nil
}

func (s *ScreenshotService) showOverlayNow(seq uint64) {
	if s.overlayWin == nil {
		return
	}

	altTabActive.Store(true)
	s.overlayWin.Show()
	s.overlayWin.Focus()
	s.everShown.Store(true)

	s.overlayPaintPending.Store(true)
	subsequent := s.overlayBeenShown.Swap(true)
	time.AfterFunc(300*time.Millisecond, func() {
		if s.sessionSeq.Load() != seq {
			return
		}
		if s.overlayPaintPending.CompareAndSwap(true, false) && s.overlayWin.IsVisible() {
			setTaskbarVisible(false)
		}
	})
	if subsequent {
		s.paintHideOK.Store(true)
	}
}

func (s *ScreenshotService) TriggerCapture() {

	if s.overlayWin != nil && s.overlayWin.IsVisible() {
		return
	}

	if t := s.pendingCloseHide.Load(); t != nil {
		t.Stop()
		s.pendingCloseHide.Store(nil)
	}
	seq := s.sessionSeq.Add(1)

	start := time.Now()
	bounds := screenshot.GetDisplayBounds(0)
	img, err := screenshot.CaptureRect(bounds)
	if err != nil {
		log.Printf("Capture Failed: %v", err)
		return
	}
	s.lastCapture = img

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		log.Printf("sync PNG encode failed: %v", err)
	} else {
		s.dataURLCache.Store("data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()))
	}

	reuse := s.everShown.Load()
	if reuse {
		s.showOnFreshPaint.Store(true)
		time.AfterFunc(250*time.Millisecond, func() {
			if s.sessionSeq.Load() != seq {
				return
			}
			if s.showOnFreshPaint.CompareAndSwap(true, false) && s.everShown.Load() {
				log.Printf("fresh-paint timeout: painted gelmedi, mevcut kareyle gösteriliyor")
				s.showOverlayNow(seq)
			}
		})
	}

	scale := 1.0
	if scr := s.app.Screen.GetPrimary(); scr != nil && scr.ScaleFactor > 0 {
		scale = float64(scr.ScaleFactor)
	}

	s.ensureOverlayWindow(bounds, scale)
	if s.overlayWin == nil {
		return
	}

	if !reuse {
		time.AfterFunc(900*time.Millisecond, func() {
			if s.sessionSeq.Load() != seq {
				return
			}
			if s.everShown.CompareAndSwap(false, true) {
				log.Printf("first-show fallback timeout: background-ready gelmedi, zorla gösteriliyor")
				s.showOverlayNow(seq)
			}
		})
	}

	log.Printf("overlay capture in %v (bounds %v, scale %.2f)", time.Since(start), bounds, scale)
}

func (s *ScreenshotService) ensureOverlayWindow(bounds image.Rectangle, scale float64) {
	if s.overlayWin != nil {
		s.overlayWin.SetPosition(bounds.Min.X, bounds.Min.Y)
		s.overlayWin.SetSize(
			int(float64(bounds.Dx())/scale+0.5),
			int(float64(bounds.Dy())/scale+0.5),
		)
		s.overlayWin.SetAlwaysOnTop(true)
		s.app.Event.Emit("overlay:new-capture")
		return
	}

	s.overlayWin = s.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "Overlay",
		URL:    "/#/overlay",
		X:      bounds.Min.X,
		Y:      bounds.Min.Y,
		Width:  int(float64(bounds.Dx())/scale + 0.5),
		Height: int(float64(bounds.Dy())/scale + 0.5),

		Frameless:        true,
		AlwaysOnTop:      true,
		DisableResize:    true,
		Hidden:           true,
		BackgroundType:   application.BackgroundTypeTransparent,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),
		Windows: application.WindowsWindow{
			DisableFramelessWindowDecorations: true,
			HiddenOnTaskbar:                   true,
		},
	})

	s.overlayWin.SetPosition(bounds.Min.X, bounds.Min.Y)
	s.overlayWin.SetAlwaysOnTop(true)
}

func (s *ScreenshotService) CloseOverlay() {
	if s.overlayWin == nil {
		return
	}

	altTabActive.Store(false)
	altPhysicallyHeld.Store(false)

	setTaskbarVisible(true)

	if t := s.pendingCloseHide.Load(); t != nil {
		t.Stop()
	}
	seq := s.sessionSeq.Load()
	s.pendingCloseHide.Store(time.AfterFunc(40*time.Millisecond, func() {
		if s.sessionSeq.Load() != seq {
			return
		}
		s.app.Event.Emit("overlay:closed")
		time.AfterFunc(30*time.Millisecond, func() {
			if s.sessionSeq.Load() != seq {
				return
			}
			s.overlayWin.Hide()
		})
	}))
}

func parseNameDims(name string) (int, int) {
	n := strings.LastIndex(name, "-")
	if n < 0 {
		return 0, 0
	}
	dims := strings.TrimSuffix(name[n+1:], ".png")
	parts := strings.SplitN(dims, "x", 2)
	if len(parts) != 2 {
		return 0, 0
	}
	w, _ := strconv.Atoi(parts[0])
	h, _ := strconv.Atoi(parts[1])
	return w, h
}

func (s *ScreenshotService) ListHistory() ([]HistoryItem, error) {
	dir, err := historyDir()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	items := make([]HistoryItem, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.EqualFold(filepath.Ext(e.Name()), ".png") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		name := e.Name()
		w, h := parseNameDims(name)
		kind := "file"
		if strings.Contains(name, "-clip-") {
			kind = "clip"
		}
		items = append(items, HistoryItem{
			Name:       name,
			Path:       filepath.Join(dir, name),
			Kind:       kind,
			Width:      w,
			Height:     h,
			Bytes:      info.Size(),
			ModifiedAt: info.ModTime().Format(time.RFC3339),
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Name > items[j].Name })
	return items, nil
}

func (s *ScreenshotService) ReadHistoryImage(path string) (string, error) {
	dir, err := historyDir()
	if err != nil {
		return "", err
	}
	if dir != filepath.Dir(filepath.Clean(path)) || !strings.EqualFold(filepath.Ext(path), ".png") {
		return "", fmt.Errorf("geçersiz yol")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data), nil
}

func (s *ScreenshotService) ReadHistoryThumb(path string) (string, error) {
	dir, err := historyDir()
	if err != nil {
		return "", err
	}
	if dir != filepath.Dir(filepath.Clean(path)) || !strings.EqualFold(filepath.Ext(path), ".png") {
		return "", fmt.Errorf("geçersiz yol")
	}
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	src, err := png.Decode(f)
	if err != nil {
		return "", err
	}
	sb := src.Bounds()
	const targetW = 320
	if sb.Dx() <= targetW {
		return pngDataURL(src)
	}
	return thumbnailDataURL(src, targetW)
}

func (s *ScreenshotService) ReCopyHistoryImage(path string) error {
	dir, err := historyDir()
	if err != nil {
		return err
	}
	if dir != filepath.Dir(filepath.Clean(path)) || !strings.EqualFold(filepath.Ext(path), ".png") {
		return fmt.Errorf("geçersiz yol")
	}
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		return err
	}
	rgba, ok := img.(*image.RGBA)
	if !ok {
		rgba = image.NewRGBA(img.Bounds())
		draw.Draw(rgba, rgba.Bounds(), img, img.Bounds().Min, draw.Src)
	}
	return CopyImageToClipboard(rgba)
}

func (s *ScreenshotService) DeleteHistoryImage(path string) error {
	dir, err := historyDir()
	if err != nil {
		return err
	}
	if dir != filepath.Dir(filepath.Clean(path)) || !strings.EqualFold(filepath.Ext(path), ".png") {
		return fmt.Errorf("geçersiz yol")
	}
	return os.Remove(path)
}

func (s *ScreenshotService) GetHistoryDir() (string, error) {
	return historyDir()
}
