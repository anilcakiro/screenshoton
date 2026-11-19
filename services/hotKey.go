//go:build windows

package services

import (
	"log"
	"runtime"
	"syscall"
	"time"
	"unsafe"
)

const (
	WM_HOTKEY     = 0x0312
	hotKeyID      = 1
	modNoRepeat   = 0x4000
	pmRemove      = 0x0001
)

var (
	procRegisterHotKey   = user32.NewProc("RegisterHotKey")
	procUnregisterHotKey = user32.NewProc("UnregisterHotKey")
	procPeekMessageW     = user32.NewProc("PeekMessageW")
)

type msg struct {
	hwnd    uintptr
	message uint32
	wParam  uintptr
	lParam  uintptr
	time    uint32
	pt      struct{ x, y int32 }
}

func (t *ScreenshotService) applyHotkey(combo string) {
	mods, vk, err := parseHotkeyCombo(combo)
	if err != nil {
		log.Printf("hotkey parse hatası (%q): %v", combo, err)
		return
	}
	procUnregisterHotKey.Call(0, hotKeyID)
	ret, _, _ := procRegisterHotKey.Call(
		0,
		hotKeyID,
		uintptr(mods)|modNoRepeat,
		uintptr(vk),
	)
	if ret == 0 {
		log.Printf("RegisterHotKey FAILED (%s): %v", combo, syscall.GetLastError())
		return
	}
	log.Printf("global hotkey: %s kayıtlı (id=%d)", combo, hotKeyID)
}

func (t *ScreenshotService) startGlobalHotkey() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	t.applyHotkey(t.GetSettings().Hotkey)

	var m msg
	for {
		select {
		case combo := <-t.hotkeyCh:
			t.applyHotkey(combo)
		default:
		}

		for {
			got, _, _ := procPeekMessageW.Call(
				uintptr(unsafe.Pointer(&m)),
				0, 0, 0, pmRemove,
			)
			if got == 0 {
				break
			}
			if m.message == WM_HOTKEY && m.wParam == hotKeyID {
				go t.TriggerCapture()
			}
		}
		time.Sleep(25 * time.Millisecond)
	}
}
