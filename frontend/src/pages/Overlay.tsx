import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Events } from "@wailsio/runtime";
import { Copy, X, Download, RotateCcw, Move, Crop } from "lucide-react";
import { CloseOverlay, ExtractRegion, ExtractRegionToFile, GetLastCaptureDataURL, GetSettings } from "@wails/wareon/services/screenshotservice";
import { normalizeRect, clampRectToViewport, calculateResizedRect, ResizeHandleType, RectBox } from "../utils/canvasMath";

const MIN_SELECTION = 20;

interface OverlayKeys {
    copy: string;
    save: string;
    cancel: string;
}

const DEFAULT_KEYS: OverlayKeys = { copy: "Ctrl+C", save: "Ctrl+S", cancel: "Escape" };

const KEY_ALIAS: Record<string, string> = {
    prtsc: "printscreen", esc: "escape", return: "enter",
    del: "delete", ins: "insert", pgup: "pageup", pgdn: "pagedown",
};

const canonKey = (k: string) => {
    const t = k.trim().toLowerCase();
    return KEY_ALIAS[t] ?? t;
};

function comboMatches(e: KeyboardEvent, combo: string): boolean {
    const parts = combo.split("+").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return false;
    const key = canonKey(parts.pop()!);
    const has = (names: string[]) => parts.some((p) => names.includes(p.toLowerCase()));
    if (
        e.ctrlKey !== has(["ctrl", "control"]) ||
        e.altKey !== has(["alt"]) ||
        e.shiftKey !== has(["shift"]) ||
        e.metaKey !== has(["win", "windows", "super", "meta"])
    ) {
        return false;
    }
    return canonKey(e.key === " " ? "Space" : e.key) === key;
}

interface ToastConfig {
    message: string;
    duration: number;
}

export default function Overlay() {
    const { t } = useTranslation();
    const [bg, setBg] = useState<string | null>(null);
    const [bgReady, setBgReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [selectedRect, setSelectedRect] = useState<RectBox | null>(null);

    const [activeHandle, setActiveHandle] = useState<ResizeHandleType | null>(null);
    const [dragStartPoint, setDragStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [rectBeforeDrag, setRectBeforeDrag] = useState<RectBox | null>(null);

    const [, setIsCopied] = useState(false);
    const [toast, setToast] = useState<ToastConfig | null>(null);
    const [keys, setKeys] = useState<OverlayKeys>(DEFAULT_KEYS);
    const [afterSelect, setAfterSelect] = useState<string>("manual");

    const readySent = useRef(false);
    const toastTimer = useRef<number | null>(null);

    const showToast = useCallback((message: string, duration = 2200) => {
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        setToast({ message, duration });
        toastTimer.current = window.setTimeout(() => {
            setToast(null);
            toastTimer.current = null;
        }, duration);
    }, []);

    const resetTransientState = useCallback(() => {
        setSelectedRect(null);
        setStartPos(null);
        setIsDrawing(false);
        setActiveHandle(null);
        setDragStartPoint(null);
        setRectBeforeDrag(null);
        setToast(null);
    }, []);

    const closeOverlay = useCallback(async () => {
        resetTransientState();
        await CloseOverlay();
    }, [resetTransientState]);

    const clearOverlay = useCallback(() => {
        resetTransientState();
        setBg(null);
        setBgReady(false);
    }, [resetTransientState]);

    const cssToPhysical = (v: number) => Math.round(v * (window.devicePixelRatio || 1));

    const loadBackground = useCallback(async () => {
        try {
            resetTransientState();
            setBg(await GetLastCaptureDataURL());
            setError(null);
        } catch (e: any) {
            const msg = String(e?.message ?? e);
            if (!msg.includes("no capture in memory")) {
                console.error("GetLastCaptureDataURL failed:", e);
                setError(e?.message || "Arka plan yüklenemedi");
            }
        }
    }, [resetTransientState]);

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        const prevRootBg = root.style.background;
        const prevBodyBg = body.style.background;
        root.style.background = "transparent";
        body.style.background = "transparent";

        loadBackground();
        const off = Events.On("overlay:new-capture", () => loadBackground());
        const offClosed = Events.On("overlay:closed", () => clearOverlay());

        void GetSettings()
            .then((s) => {
                if (s) {
                    setKeys({
                        copy: s.overlayCopy || DEFAULT_KEYS.copy,
                        save: s.overlaySave || DEFAULT_KEYS.save,
                        cancel: s.overlayCancel || DEFAULT_KEYS.cancel,
                    });
                    setAfterSelect(s.afterSelect || "manual");
                }
            })
            .catch(() => {});
        const offSettings = Events.On("app:settings-changed", (ev: any) => {
            const st = ev?.data?.settings;
            if (st) {
                setKeys({
                    copy: st.overlayCopy || DEFAULT_KEYS.copy,
                    save: st.overlaySave || DEFAULT_KEYS.save,
                    cancel: st.overlayCancel || DEFAULT_KEYS.cancel,
                });
                setAfterSelect(st.afterSelect || "manual");
            }
        });

        return () => {
            if (typeof off === "function") off();
            if (typeof offClosed === "function") offClosed();
            if (typeof offSettings === "function") offSettings();
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
            root.style.background = prevRootBg;
            body.style.background = prevBodyBg;
        };
    }, [loadBackground, clearOverlay]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (comboMatches(e, keys.cancel)) {
                closeOverlay();
                return;
            }
            if (selectedRect && comboMatches(e, keys.copy)) {
                e.preventDefault();
                copyToClipboard(selectedRect);
                closeOverlay();
                return;
            }
            if (selectedRect && comboMatches(e, keys.save)) {
                e.preventDefault();
                void downloadCropped(selectedRect);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedRect, closeOverlay, keys]);

    const copyToClipboard = async (rect: RectBox) => {
        try {
            await ExtractRegion(cssToPhysical(rect.x), cssToPhysical(rect.y), cssToPhysical(rect.width), cssToPhysical(rect.height));
            setIsCopied(true);
            showToast(t("overlay.copied"));
            setTimeout(() => setIsCopied(false), 1800);
        } catch (e: any) {
            console.error("Clipboard copy failed:", e);
            showToast(t("overlay.copyFailed"), 2600);
        }
    };

    const downloadCropped = async (rect: RectBox) => {
        try {
            const path = await ExtractRegionToFile(cssToPhysical(rect.x), cssToPhysical(rect.y), cssToPhysical(rect.width), cssToPhysical(rect.height));
            const fileName = path.split(/[\\/]/).pop() || path;
            showToast(t("overlay.downloaded", { file: fileName }), 3400);
        } catch (e: any) {
            console.error("Download error:", e);
            showToast(t("overlay.downloadFailed") + ": " + (e?.message || "bilinmeyen"), 2600);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (activeHandle || !bgReady) return;
        setIsDrawing(true);
        setStartPos({ x: e.clientX, y: e.clientY });
        setSelectedRect(null);
    };

    const latestPos = useRef({ x: 0, y: 0 });
    const rafPending = useRef(false);
    const rafId = useRef<number | null>(null);

    const applyPointer = (pos: { x: number; y: number }) => {
        const resizing = Boolean(activeHandle && dragStartPoint && rectBeforeDrag);
        const drawing = Boolean(isDrawing && startPos);

        if (!resizing && !drawing && selectedRect) return;

        if (!resizing && !drawing) setMousePos(pos);

        if (resizing) {
            const dx = pos.x - dragStartPoint!.x;
            const dy = pos.y - dragStartPoint!.y;
            const updated = clampRectToViewport(calculateResizedRect(rectBeforeDrag!, activeHandle!, dx, dy, MIN_SELECTION));
            setSelectedRect(updated);
            return;
        }

        if (drawing && startPos) {
            const rect = clampRectToViewport(normalizeRect(startPos.x, startPos.y, pos.x, pos.y));
            setSelectedRect(rect);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        latestPos.current = { x: e.clientX, y: e.clientY };
        if (rafPending.current) return;
        rafPending.current = true;
        rafId.current = window.requestAnimationFrame(() => {
            rafPending.current = false;
            rafId.current = null;
            applyPointer(latestPos.current);
        });
    };

    const handleMouseUp = () => {
        if (rafId.current !== null) {
            window.cancelAnimationFrame(rafId.current);
            rafPending.current = false;
            rafId.current = null;
        }
        const upPos = latestPos.current;

        if (activeHandle) {
            setActiveHandle(null);
            setDragStartPoint(null);
            setRectBeforeDrag(null);
            return;
        }

        if (isDrawing && startPos) {
            const rect = clampRectToViewport(normalizeRect(startPos.x, startPos.y, upPos.x, upPos.y));
            if (rect.width > MIN_SELECTION && rect.height > MIN_SELECTION) {
                if (afterSelect === "copy") {
                    void copyToClipboard(rect);
                    void closeOverlay();
                } else if (afterSelect === "save") {
                    void downloadCropped(rect);
                    void closeOverlay();
                } else {
                    setSelectedRect(rect);
                }
            } else {
                setSelectedRect(null);
            }
        }
        setIsDrawing(false);
        setStartPos(null);
    };

    const startHandleResize = (e: React.MouseEvent, handle: ResizeHandleType) => {
        e.stopPropagation();
        if (!selectedRect) return;
        setActiveHandle(handle);
        setDragStartPoint({ x: e.clientX, y: e.clientY });
        setRectBeforeDrag({ ...selectedRect });
    };

    const resetSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedRect(null);
        setStartPos(null);
        setIsDrawing(false);
    };

    const handleImgLoad = () => {
        if (!readySent.current) {
            readySent.current = true;
            Events.Emit("overlay:background-ready");
        }
        Events.Emit("overlay:painted");
        setBgReady(true);
    };

    return (
        <div onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} className="fixed inset-0 z-50 select-none cursor-crosshair overflow-hidden">
            {bg ? <img src={bg} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} onLoad={handleImgLoad} className="overlay-img pointer-events-none absolute inset-0 h-full w-full" /> : null}

            {error && <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-3 font-mono text-sm text-red-200 shadow-2xl">⚠️ {error}</div>}

            {!selectedRect && bgReady && <div className="absolute inset-0 bg-black/40" />}

            {bgReady && !selectedRect && !isDrawing && (
                <div
                    className="absolute pointer-events-none p-2 rounded-xl bg-[#141418] border border-[#ff4f00] shadow-2xl flex flex-col gap-1 text-[11px] font-mono text-neutral-200 z-50"
                    style={{
                        left: `${Math.max(16, Math.min(window.innerWidth - 180, mousePos.x + 20))}px`,
                        top: `${Math.max(16, Math.min(window.innerHeight - 100, mousePos.y + 20))}px`,
                    }}
                >
                    <div className="flex items-center gap-1.5 font-bold text-[#ff4f00]">
                        <Crop className="w-3.5 h-3.5" />
                        <span>{t("overlay.selection")}</span>
                    </div>
                    <div>
                        X: {mousePos.x}px · Y: {mousePos.y}px
                    </div>
                    <div className="text-[10px] text-neutral-400">{t("overlay.dragHint")}</div>
                </div>
            )}

            {selectedRect && (
                <div
                    className="absolute border-2 border-[#ff4f00]"
                    style={{
                        left: `${selectedRect.x}px`,
                        top: `${selectedRect.y}px`,
                        width: `${selectedRect.width}px`,
                        height: `${selectedRect.height}px`,
                        boxShadow: isDrawing
                            ? "0 0 0 100vmax rgba(0,0,0,0.6)"
                            : "0 0 0 100vmax rgba(0,0,0,0.6), 0 0 25px rgba(255,79,0,0.35)",
                    }}
                >
                    <div onMouseDown={(e) => startHandleResize(e, "move")} className="absolute inset-4 cursor-move flex items-center justify-center group">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-[#141418]/90 border border-[#ff4f00]/60 text-[#ff4f00] flex items-center gap-1 text-[10px] font-mono shadow-lg">
                            <Move className="w-3 h-3" />
                            <span>{t("overlay.move")}</span>
                        </div>
                    </div>

                    <div
                        onMouseDown={(e) => startHandleResize(e, "nw")}
                        className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-[#ff4f00] rounded-sm shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                    />
                    <div
                        onMouseDown={(e) => startHandleResize(e, "n")}
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-2 border-[#ff4f00] rounded-sm shadow-md cursor-ns-resize hover:scale-125 transition-transform"
                    />
                    <div
                        onMouseDown={(e) => startHandleResize(e, "ne")}
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-[#ff4f00] rounded-sm shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                    />
                    <div
                        onMouseDown={(e) => startHandleResize(e, "e")}
                        className="absolute top-1/2 -translate-y-1/2 -right-1 w-2.5 h-2.5 bg-white border-2 border-[#ff4f00] rounded-sm shadow-md cursor-ew-resize hover:scale-125 transition-transform"
                    />
                    <div
                        onMouseDown={(e) => startHandleResize(e, "se")}
                        className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-[#ff4f00] rounded-sm shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                    />
                    <div
                        onMouseDown={(e) => startHandleResize(e, "s")}
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-2 border-[#ff4f00] rounded-sm shadow-md cursor-ns-resize hover:scale-125 transition-transform"
                    />
                    <div
                        onMouseDown={(e) => startHandleResize(e, "sw")}
                        className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-[#ff4f00] rounded-sm shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                    />
                    <div
                        onMouseDown={(e) => startHandleResize(e, "w")}
                        className="absolute top-1/2 -translate-y-1/2 -left-1 w-2.5 h-2.5 bg-white border-2 border-[#ff4f00] rounded-sm shadow-md cursor-ew-resize hover:scale-125 transition-transform"
                    />

                    {(() => {
                        const BADGE_H = 36,
                            TOOLBAR_H = 52,
                            GAP = 24,
                            GAP2 = 6,
                            MARGIN = 8;
                        const innerW = window.innerWidth,
                            innerH = window.innerHeight;
                        const boxBottom = selectedRect.y + selectedRect.height;
                        const isFullish = selectedRect.width >= innerW - 4 && selectedRect.height >= innerH - 4;

                        const badgeBelowY = boxBottom + GAP;
                        const toolbarBelowY = badgeBelowY + BADGE_H + GAP2;
                        const belowOK = !isFullish && toolbarBelowY + TOOLBAR_H <= innerH - MARGIN;

                        const badgeAboveY = selectedRect.y - GAP2 - BADGE_H;
                        const toolbarAboveY = badgeAboveY - GAP2 - TOOLBAR_H;
                        const aboveOK = toolbarAboveY >= MARGIN;

                        let toolbarY: number;
                        let badgeY: number;
                        if (isFullish) {
                            toolbarY = innerH - MARGIN - TOOLBAR_H;
                            badgeY = toolbarY - GAP2 - BADGE_H;
                        } else if (belowOK) {
                            toolbarY = toolbarBelowY;
                            badgeY = badgeBelowY;
                        } else if (aboveOK) {
                            toolbarY = toolbarAboveY;
                            badgeY = badgeAboveY;
                        } else {
                            toolbarY = Math.max(MARGIN, selectedRect.y + 12);
                            badgeY = toolbarY + TOOLBAR_H + GAP2;
                        }

                        const TOOLBAR_W = 340;
                        const clampX = (left: number, width: number) => Math.max(16, Math.min(left, innerW - width - 16));
                        const toolbarX = clampX(selectedRect.x + selectedRect.width / 2 - TOOLBAR_W / 2, TOOLBAR_W);
                        const badgeX = isFullish ? clampX(innerW / 2 - 110, 220) : clampX(selectedRect.x, 220);

                        return (
                            <>
                                <div
                                    className={`absolute px-2.5 py-1 rounded-xl bg-[#0e0e13]/90 border border-white/12 text-[11px] font-mono text-neutral-200 flex items-center gap-2 pointer-events-none z-40 whitespace-nowrap ${
                                        isDrawing ? "" : "backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
                                    }`}
                                    style={{
                                        top: `${badgeY - selectedRect.y}px`,
                                        left: `${badgeX - selectedRect.x}px`,
                                    }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff4f00] shadow-[0_0_8px_#ff4f00]" />
                                    <span className="font-semibold text-white tracking-wide">
                                        {Math.round(selectedRect.width)} × {Math.round(selectedRect.height)}
                                        <span className="text-[10px] text-neutral-400 ml-0.5">px</span>
                                    </span>
                                </div>

                                {!isDrawing && (
                                    <div
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className="absolute flex items-center gap-2 p-1.5 rounded-2xl bg-[#0e0e13]/95 backdrop-blur-2xl border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_1px_1px_rgba(255,255,255,0.06)] z-50 select-none whitespace-nowrap ring-1 ring-black/40"
                                        style={{
                                            top: `${toolbarY - selectedRect.y}px`,
                                            left: `${toolbarX - selectedRect.x}px`,
                                        }}
                                    >
                                        <button
                                            onClick={() => {
                                                copyToClipboard(selectedRect);
                                                CloseOverlay();
                                            }}
                                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#ff4f00] via-[#ff5f1a] to-[#ff3d00] hover:brightness-110 active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-[0_4px_16px_rgba(255,79,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] cursor-pointer"
                                            title={t("overlay.copyTitle", { key: keys.copy })}
                                        >
                                             <Copy className="w-3.5 h-3.5" />
                                            <span>{t("overlay.copy")}</span>
                                        </button>

                                        <button
                                            onClick={() => downloadCropped(selectedRect)}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 hover:border-white/15 text-neutral-300 hover:text-white text-xs font-medium transition-all cursor-pointer active:scale-[0.98]"
                                            title={t("overlay.downloadTitle")}
                                        >
                                            <Download className="w-3.5 h-3.5 text-neutral-400" />
                                            <span className="hidden sm:inline">{t("overlay.download")}</span>
                                        </button>

                                        <button
                                            onClick={resetSelection}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 text-neutral-400 hover:text-neutral-200 text-xs font-medium transition-all cursor-pointer"
                                            title={t("overlay.reselectTitle")}
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">{t("overlay.reselect")}</span>
                                        </button>

                                        <button
                                            onClick={() => closeOverlay()}
                                            className="flex items-center gap-1 p-1.5 px-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 hover:text-rose-300 border border-white/8 hover:border-rose-500/30 text-neutral-400 transition-all cursor-pointer"
                                            title={t("overlay.cancelTitle", { key: keys.cancel })}
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {toast && (
                <div className="pointer-events-none absolute bottom-8 left-1/2 z-60 -translate-x-1/2 rounded-xl border border-orange-500/60 bg-[#141418]/95 px-5 py-3 font-mono text-sm font-bold text-orange-400 shadow-2xl">
                    {toast.message}
                </div>
            )}
        </div>
    );
}
