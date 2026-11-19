package services

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"time"
)

type HistoryItem struct {
	Name       string `json:"name"`
	Path       string `json:"path"`
	Kind       string `json:"kind"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	Bytes      int64  `json:"bytes"`
	ModifiedAt string `json:"modifiedAt"`
}

func historyDir() (string, error) {
	if base, err := os.UserCacheDir(); err == nil {
		dir := filepath.Join(base, "ScreenshotOn", "history")
		if err := os.MkdirAll(dir, 0o755); err == nil {
			return dir, nil
		}
	}
	dir := filepath.Join(os.TempDir(), "screenshoton-history")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func saveHistoryPNG(kind string, img *image.RGBA) (string, string, error) {
	dir, err := historyDir()
	if err != nil {
		return "", "", err
	}
	b := img.Bounds()
	name := fmt.Sprintf("%s-%s-%dx%d.png", time.Now().Format("20060102-150405"), kind, b.Dx(), b.Dy())
	path := filepath.Join(dir, name)
	f, err := os.Create(path)
	if err != nil {
		return "", "", err
	}
	if err := png.Encode(f, img); err != nil {
		f.Close()
		return "", "", err
	}
	f.Close()
	return name, path, nil
}

func pngDataURL(img image.Image) (string, error) {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

func thumbnailDataURL(src image.Image, targetW int) (string, error) {
	sb := src.Bounds()
	w, h := sb.Dx(), sb.Dy()
	width := targetW
	height := int(float64(h)*float64(width)/float64(w) + 0.5)
	if width < 1 {
		width = 1
	}
	if height < 1 {
		height = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	for ty := 0; ty < height; ty++ {
		sy := sb.Min.Y + ty*h/height
		for tx := 0; tx < width; tx++ {
			dst.Set(tx, ty, src.At(sb.Min.X+tx*w/width, sy))
		}
	}
	return pngDataURL(dst)
}
