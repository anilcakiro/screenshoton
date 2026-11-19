package services

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"syscall"
	"time"
	"unsafe"
)

var (
	procCloseClipboard          = user32.NewProc("CloseClipboard")
	procEmptyClipboard          = user32.NewProc("EmptyClipboard")
	procOpenClipboard           = user32.NewProc("OpenClipboard")
	procRegisterClipboardFormat = user32.NewProc("RegisterClipboardFormatW")
	procSetClipboardData        = user32.NewProc("SetClipboardData")

	procGlobalAlloc  = kernel32.NewProc("GlobalAlloc")
	procGlobalFree   = kernel32.NewProc("GlobalFree")
	procGlobalLock   = kernel32.NewProc("GlobalLock")
	procGlobalUnlock = kernel32.NewProc("GlobalUnlock")
)

var kernel32 = syscall.NewLazyDLL("kernel32.dll")

const (
	cfDIB        = 8
	gmemMoveable = 0x2
	biRGB        = 0
	dibHeaderLen = 40
)

func imageToDIB(img *image.RGBA) []byte {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()

	hdr := make([]byte, dibHeaderLen)
	putLE := func(off int, v uint32) {
		hdr[off] = byte(v)
		hdr[off+1] = byte(v >> 8)
		hdr[off+2] = byte(v >> 16)
		hdr[off+3] = byte(v >> 24)
	}
	putLE(0, dibHeaderLen)
	putLE(4, uint32(w))
	putLE(8, uint32(h))
	hdr[12] = 1
	putLE(14, 32)
	putLE(16, biRGB)
	putLE(20, uint32(w*h)*4)

	row := w * 4
	pix := make([]byte, h*row)
	for y := 0; y < h; y++ {
		srcY := h - 1 - y
		src := img.Pix[srcY*img.Stride:]
		dst := pix[y*row:]
		for x := 0; x < w; x++ {
			si, di := x*4, x*4
			dst[di] = src[si+2]
			dst[di+1] = src[si+1]
			dst[di+2] = src[si]
			dst[di+3] = src[si+3]
		}
	}

	out := make([]byte, 0, len(hdr)+len(pix))
	out = append(out, hdr...)
	return append(out, pix...)
}

func copyToCanvasClipboard(format uint, data []byte) error {
	h, _, err := procGlobalAlloc.Call(gmemMoveable, uintptr(len(data)))
	if h == 0 {
		return fmt.Errorf("GlobalAlloc failed: %v", err)
	}
	p, _, err := procGlobalLock.Call(h)
	if p == 0 {
		procGlobalFree.Call(h)
		return fmt.Errorf("GlobalLock failed: %v", err)
	}
	dst := unsafe.Slice((*byte)(unsafe.Pointer(p)), len(data))
	copy(dst, data)
	procGlobalUnlock.Call(h)

	r, _, err := procSetClipboardData.Call(uintptr(format), h)
	if r == 0 {
		procGlobalFree.Call(h)
		return fmt.Errorf("SetClipboardData(CF=%d) failed: %v", format, err)
	}
	return nil
}

var pngClipboardFormat uint

func pngClipboardFormatId() uint {
	if pngClipboardFormat != 0 {
		return pngClipboardFormat
	}
	ptr, _ := syscall.UTF16PtrFromString("PNG")
	id, _, _ := procRegisterClipboardFormat.Call(uintptr(unsafe.Pointer(ptr)))
	pngClipboardFormat = uint(id)
	return pngClipboardFormat
}

func CopyImageToClipboard(img *image.RGBA) error {
	var opened bool
	for i := 0; i < 5; i++ {
		r, _, _ := procOpenClipboard.Call(0)
		if r != 0 {
			opened = true
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if !opened {
		return fmt.Errorf("OpenClipboard failed: panoyu başka bir işlem kullanıyor")
	}
	defer procCloseClipboard.Call()

	r, _, err := procEmptyClipboard.Call()
	if r == 0 {
		return fmt.Errorf("EmptyClipboard failed: %v", err)
	}

	if err := copyToCanvasClipboard(cfDIB, imageToDIB(img)); err != nil {
		return err
	}

	if id := pngClipboardFormatId(); id != 0 {
		var buf bytes.Buffer
		if err := png.Encode(&buf, img); err == nil {
			_ = copyToCanvasClipboard(id, buf.Bytes())
		}
	}
	return nil
}
