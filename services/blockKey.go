//go:build windows

package services

import (
	"log"
	"runtime"
	"sync/atomic"
	"syscall"
	"unsafe"
)

const (
	altWHKeyboardLL = 13
	altHCAction     = 0
	altVKTab        = 0x09
	altVKEscape     = 0x1B
	altVKMenu       = 0x12
	altLLKHFUp      = 0x80
	altWMQuit       = 0x0012
)

var altTabActive atomic.Bool
var altPhysicallyHeld atomic.Bool

var (
	altTabHookHandle atomic.Uintptr
	altTabThreadID   atomic.Uint32
)

var (
	procSetWHExW       = user32.NewProc("SetWindowsHookExW")
	procUnhookWHExW    = user32.NewProc("UnhookWindowsHookExW")
	procCallNextHookEx = user32.NewProc("CallNextHookEx")
	procGetMsgAlt      = user32.NewProc("GetMessageW")
	procPostThreadMsg  = user32.NewProc("PostThreadMessageW")
	procGetThreadID    = syscall.NewLazyDLL("kernel32.dll").NewProc("GetCurrentThreadId")
)

type altKBD struct {
	vkCode   uint32
	scanCode uint32
	flags    uint32
	time     uint32
	extra    uintptr
}
type altMsg struct {
	hwnd    uintptr
	message uint32
	wParam  uintptr
	lParam  uintptr
	time    uint32
	pt      struct{ x, y int32 }
}

func altLowLevelHook(nCode int32, wParam uintptr, lParam uintptr) uintptr {
	if nCode == altHCAction && altTabActive.Load() {
		k := (*altKBD)(unsafe.Pointer(lParam))
		isKeyUp := k.flags&altLLKHFUp != 0

		if k.vkCode == altVKMenu {
			if isKeyUp {
				altPhysicallyHeld.Store(false)
			} else {
				altPhysicallyHeld.Store(true)
			}
			return 1
		}
		if (k.vkCode == altVKTab || k.vkCode == altVKEscape) && altPhysicallyHeld.Load() {
			return 1
		}
	}
	next, _, _ := procCallNextHookEx.Call(0, uintptr(nCode), wParam, lParam)
	return next
}

var altLowLevelHookCB = syscall.NewCallback(altLowLevelHook)

func (t *ScreenshotService) startAltTabBlocker() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	tid, _, _ := procGetThreadID.Call()
	altTabThreadID.Store(uint32(tid))

	hook, _, err := procSetWHExW.Call(
		altWHKeyboardLL,
		altLowLevelHookCB,
		0,
		0,
	)
	if hook == 0 {
		log.Printf("AltTab blok hook kurulamadı: %v", err)
		return
	}
	altTabHookHandle.Store(hook)
	log.Printf("AltTab blok hook kuruldu (tid=%d)", tid)

	var m altMsg
	for {
		got, _, _ := procGetMsgAlt.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(got) <= 0 {
			break
		}
	}
	procUnhookWHExW.Call(hook)
	altTabHookHandle.Store(0)
	log.Printf("AltTab blok hook kaldırıldı")
}
func (t *ScreenshotService) stopAltTabBlocker() {
	altTabActive.Store(false)
	altPhysicallyHeld.Store(false)
	if id := altTabThreadID.Load(); id != 0 {
		procPostThreadMsg.Call(uintptr(id), altWMQuit, 0, 0)
	}
}
