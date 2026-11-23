package services

import (
	"strings"
	"syscall"
	"unsafe"
)

var (
	procGetForegroundWindow        = user32.NewProc("GetForegroundWindow")
	procGetWindowThreadProcessID   = user32.NewProc("GetWindowThreadProcessId")
	procOpenProcess                = kernel32.NewProc("OpenProcess")
	procQueryFullProcessImageNameW = kernel32.NewProc("QueryFullProcessImageNameW")
	procCloseHandle                = kernel32.NewProc("CloseHandle")
	procKeybdEvent                 = user32.NewProc("keybd_event")
)

const (
	processQueryLimitedInformation = 0x1000
	keyEventFKeyUp                 = 0x0002
	vkEscape                       = 0x1B
)

// shellSurfaceProcesses are the Windows shell hosts that own the Start menu,
// taskbar search and notification/quick-settings flyouts.
var shellSurfaceProcesses = []string{
	"startmenuexperiencehost.exe",
	"searchhost.exe",
	"shellexperiencehost.exe",
}

func foregroundProcessName() string {
	hwnd, _, _ := procGetForegroundWindow.Call()
	if hwnd == 0 {
		return ""
	}
	var pid uint32
	procGetWindowThreadProcessID.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	if pid == 0 {
		return ""
	}
	h, _, _ := procOpenProcess.Call(processQueryLimitedInformation, 0, uintptr(pid))
	if h == 0 {
		return ""
	}
	defer procCloseHandle.Call(h)

	buf := make([]uint16, 512)
	size := uint32(len(buf))
	ret, _, _ := procQueryFullProcessImageNameW.Call(
		h, 0, uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)),
	)
	if ret == 0 {
		return ""
	}
	return strings.ToLower(syscall.UTF16ToString(buf[:size]))
}

func isShellSurfaceForeground() bool {
	name := foregroundProcessName()
	for _, p := range shellSurfaceProcesses {
		if strings.HasSuffix(name, "\\"+p) || name == p {
			return true
		}
	}
	return false
}

// dismissShellSurfaces sends ESC only when a shell flyout (Start menu, search,
// quick settings) currently owns the foreground, so the overlay can take over
// the topmost band. Harmless no-op otherwise.
func dismissShellSurfaces() {
	if !isShellSurfaceForeground() {
		return
	}
	procKeybdEvent.Call(vkEscape, 0, 0, 0)
	procKeybdEvent.Call(vkEscape, 0, keyEventFKeyUp, 0)
}
