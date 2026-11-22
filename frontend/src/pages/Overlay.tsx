import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Events } from "@wailsio/runtime";
import { Copy, X, Download, RotateCcw, Move, Crop, Pencil, ArrowUpRight, Square, Circle, Undo2, Eraser, ListOrdered } from "lucide-react";
import { CloseOverlay, ExtractRegion, ExtractRegionToFile, GetLastCaptureDataURL, GetLastCapturePNG, GetSettings, CopyAnnotatedPNG, SaveAnnotatedPNG } from "@wails/wareon/services/screenshotservice";
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

type DrawTool = "pen" | "arrow" | "rect" | "ellipse" | "pin";

interface Pt {
    x: number;
    y: number;
}

interface Annotation {
    id: number;
    tool: DrawTool;
    color: string;
    size: number;
    points: Pt[];
    num?: number;
}

const DRAW_COLORS = ["#ffd60a", "#ffffff", "#000000", "#ff4f00", "#ff453a", "#0a84ff", "#30d158"];
const TOOL_SIZE: Record<DrawTool, number> = { pen: 3, arrow: 3, rect: 3, ellipse: 3, pin: 10 };

function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size: number): string {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.max(10, size * 4);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const nx = -dy, ny = dx;
    const wing = len * 0.45;
    return `${x2},${y2} ${x2 - dx * len + nx * wing},${y2 - dy * len + ny * wing} ${x2 - dx * len - nx * wing},${y2 - dy * len - ny * wing}`;
}

function badgeRadius(a: Annotation): number {
    return Math.min(14, Math.max(8, a.size * 1.8));
}

function AnnotationBadgeSvg({ a, index }: { a: Annotation; index: number }) {
    const p = a.points[0];
    if (!p) return null;
    const r = badgeRadius(a);
    return (
        <g>
            <circle cx={p.x} cy={p.y} r={r} fill="#141418" stroke={a.color} strokeWidth={1.5} />
            <text x={p.x} y={p.y} fill="#ffffff" fontSize={r * 1.15} fontFamily="monospace" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                {a.num ?? index}
            </text>
        </g>
    );
}

const AnnotationSvg = React.memo(function AnnotationSvg({ a, index }: { a: Annotation; index: number }) {
    const strokeProps = {
        stroke: a.color,
        strokeWidth: a.size,
        fill: "none",
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    };
    switch (a.tool) {
        case "pen":
            return <polyline points={a.points.map((p) => `${p.x},${p.y}`).join(" ")} {...strokeProps} />;
        case "arrow": {
            const [p0, p1] = a.points;
            if (!p1) return null;
            return (
                <g {...strokeProps}>
                    <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} />
                    <polygon points={arrowHeadPoints(p0.x, p0.y, p1.x, p1.y, a.size)} fill={a.color} stroke="none" />
                </g>
            );
        }
        case "rect": {
            const [p0, p1] = a.points;
            if (!p1) return null;
            return <rect x={Math.min(p0.x, p1.x)} y={Math.min(p0.y, p1.y)} width={Math.abs(p1.x - p0.x)} height={Math.abs(p1.y - p0.y)} {...strokeProps} />;
        }
        case "ellipse": {
            const [p0, p1] = a.points;
            if (!p1) return null;
            return <ellipse cx={(p0.x + p1.x) / 2} cy={(p0.y + p1.y) / 2} rx={Math.abs(p1.x - p0.x) / 2} ry={Math.abs(p1.y - p0.y) / 2} {...strokeProps} />;
        }
        case "pin":
            return <AnnotationBadgeSvg a={a} index={index} />;
    }
});

function drawAnnotationBadge(ctx: CanvasRenderingContext2D, a: Annotation, index: number) {
    const p = a.points[0];
    if (!p) return;
    const r = badgeRadius(a);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#141418";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = a.color;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${r * 1.15}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(a.num ?? index), p.x, p.y + r * 0.08);
}

function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation) {
    ctx.strokeStyle = a.color;
    ctx.fillStyle = a.color;
    ctx.lineWidth = a.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    switch (a.tool) {
        case "pen":
            if (a.points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(a.points[0].x, a.points[0].y);
            for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x, a.points[i].y);
            ctx.stroke();
            return;
        case "arrow": {
            const [p0, p1] = a.points;
            if (!p1) return;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.fillStyle = a.color;
            const hp = arrowHeadPoints(p0.x, p0.y, p1.x, p1.y, a.size).split(" ").map((s) => s.split(",").map(Number));
            ctx.moveTo(hp[0][0], hp[0][1]);
            ctx.lineTo(hp[1][0], hp[1][1]);
            ctx.lineTo(hp[2][0], hp[2][1]);
            ctx.closePath();
            ctx.fill();
            return;
        }
        case "rect": {
            const [p0, p1] = a.points;
            if (!p1) return;
            ctx.strokeRect(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y));
            return;
        }
        case "ellipse": {
            const [p0, p1] = a.points;
            if (!p1) return;
            ctx.beginPath();
            ctx.ellipse((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, Math.abs(p1.x - p0.x) / 2, Math.abs(p1.y - p0.y) / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
            return;
        }
        case "pin":
            return;
    }
}

interface ChromeBodyProps {
    tool: DrawTool | null;
    drawColor: string;
    strokeCount: number;
    keys: OverlayKeys;
    t: TFunction;
    onCopy: () => void;
    onDownload: () => void;
    onReselect: (e: React.MouseEvent) => void;
    onClose: () => void;
    onTool: (id: DrawTool) => void;
    onColor: (c: string) => void;
    onUndo: () => void;
    onClear: () => void;
}

const ChromeBody = React.memo(function ChromeBody({
    tool,
    drawColor,
    strokeCount,
    keys,
    t,
    onCopy,
    onDownload,
    onReselect,
    onClose,
    onTool,
    onColor,
    onUndo,
    onClear,
}: ChromeBodyProps) {
    return (
        <>
            {([
                { id: "pen", Icon: Pencil, label: t("overlay.toolPen") },
                { id: "arrow", Icon: ArrowUpRight, label: t("overlay.toolArrow") },
                { id: "rect", Icon: Square, label: t("overlay.toolRect") },
                { id: "ellipse", Icon: Circle, label: t("overlay.toolEllipse") },
                { id: "pin", Icon: ListOrdered, label: t("overlay.toolPin") },
            ] as { id: DrawTool; Icon: any; label: string }[]).map(({ id, Icon, label }) => (
                <button
                    key={id}
                    onClick={() => onTool(id)}
                    className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                        tool === id
                            ? "bg-[#ff4f00]/20 border-[#ff4f00]/60 text-[#ff4f00] shadow-[0_0_12px_rgba(255,79,0,0.25)]"
                            : "bg-white/[0.04] border-white/8 text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.09]"
                    }`}
                    title={label}
                >
                    <Icon className="w-3.5 h-3.5" />
                </button>
            ))}

            <div className="w-px h-5 bg-white/10 mx-0.5" />

            {DRAW_COLORS.map((c) => (
                <button
                    key={c}
                    onClick={() => onColor(c)}
                    className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer active:scale-90 ${
                        drawColor === c ? "border-white scale-110 shadow-[0_0_6px_rgba(255,255,255,0.4)]" : "border-white/20 hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                />
            ))}

            <div className="w-px h-5 bg-white/10 mx-0.5" />

            <button
                onClick={onUndo}
                disabled={strokeCount === 0}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] border border-white/8 text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.09] transition-all cursor-pointer active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                title={t("overlay.undoDraw")}
            >
                <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={onClear}
                disabled={strokeCount === 0}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] border border-white/8 text-neutral-400 hover:text-rose-300 hover:bg-rose-500/15 transition-all cursor-pointer active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                title={t("overlay.clearDraw")}
            >
                <Eraser className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-5 bg-white/10 mx-0.5" />

            <button
                onClick={onCopy}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#ff4f00] via-[#ff5f1a] to-[#ff3d00] hover:brightness-110 active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-[0_4px_16px_rgba(255,79,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] cursor-pointer"
                title={t("overlay.copyTitle", { key: keys.copy })}
            >
                <Copy className="w-3.5 h-3.5" />
                <span>{t("overlay.copy")}</span>
            </button>

            <button
                onClick={onDownload}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 hover:border-white/15 text-neutral-300 hover:text-white text-xs font-medium transition-all cursor-pointer active:scale-[0.98]"
                title={t("overlay.downloadTitle")}
            >
                <Download className="w-3.5 h-3.5 text-neutral-400" />
                <span className="hidden sm:inline">{t("overlay.download")}</span>
            </button>

            <button
                onClick={onReselect}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 text-neutral-400 hover:text-neutral-200 text-xs font-medium transition-all cursor-pointer"
                title={t("overlay.reselectTitle")}
            >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("overlay.reselect")}</span>
            </button>

            <button
                onClick={onClose}
                className="flex items-center gap-1 p-1.5 px-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 hover:text-rose-300 border border-white/8 hover:border-rose-500/30 text-neutral-400 transition-all cursor-pointer"
                title={t("overlay.cancelTitle", { key: keys.cancel })}
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </>
    );
});

interface SelectionChromeProps {
    rect: RectBox;
    isDrawing: boolean;
    tool: DrawTool | null;
    drawColor: string;
    strokeCount: number;
    keys: OverlayKeys;
    t: TFunction;
    onCopy: () => void;
    onDownload: () => void;
    onReselect: (e: React.MouseEvent) => void;
    onClose: () => void;
    onTool: (id: DrawTool) => void;
    onColor: (c: string) => void;
    onUndo: () => void;
    onClear: () => void;
}

const SelectionChrome = React.memo(function SelectionChrome({
    rect,
    isDrawing,
    tool,
    drawColor,
    strokeCount,
    keys,
    t,
    onCopy,
    onDownload,
    onReselect,
    onClose,
    onTool,
    onColor,
    onUndo,
    onClear,
}: SelectionChromeProps) {
    const BADGE_H = 36,
        TOOLBAR_H = 52,
        GAP = 24,
        GAP2 = 6,
        MARGIN = 8;
    const innerW = window.innerWidth,
        innerH = window.innerHeight;
    const boxBottom = rect.y + rect.height;
    const isFullish = rect.width >= innerW - 4 && rect.height >= innerH - 4;

    const badgeBelowY = boxBottom + GAP;
    const toolbarBelowY = badgeBelowY + BADGE_H + GAP2;
    const belowOK = !isFullish && toolbarBelowY + TOOLBAR_H <= innerH - MARGIN;

    const badgeAboveY = rect.y - GAP2 - BADGE_H;
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
        toolbarY = Math.max(MARGIN, rect.y + 12);
        badgeY = toolbarY + TOOLBAR_H + GAP2;
    }

    const TOOLBAR_W = 580;
    const clampX = (left: number, width: number) => Math.max(16, Math.min(left, innerW - width - 16));
    const toolbarX = clampX(rect.x + rect.width / 2 - TOOLBAR_W / 2, TOOLBAR_W);
    const badgeX = isFullish ? clampX(innerW / 2 - 110, 220) : clampX(rect.x, 220);

    return (
        <>
            <div
                className={`absolute px-2.5 py-1 rounded-xl bg-[#0e0e13]/90 border border-white/12 text-[11px] font-mono text-neutral-200 flex items-center gap-2 pointer-events-none z-40 whitespace-nowrap ${
                    isDrawing ? "" : "shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
                }`}
                style={{
                    top: 0,
                    left: 0,
                    transform: `translate(${badgeX - rect.x}px, ${badgeY - rect.y}px)`,
                }}
            >
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff4f00] shadow-[0_0_8px_#ff4f00]" />
                <span className="font-semibold text-white tracking-wide">
                    {Math.round(rect.width)} × {Math.round(rect.height)}
                    <span className="text-[10px] text-neutral-400 ml-0.5">px</span>
                </span>
            </div>

            {!isDrawing && (
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute flex items-center gap-2 p-1.5 rounded-2xl bg-[#0e0e13]/95 border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_1px_1px_rgba(255,255,255,0.06)] z-50 select-none whitespace-nowrap ring-1 ring-black/40"
                    style={{
                        top: 0,
                        left: 0,
                        transform: `translate(${toolbarX - rect.x}px, ${toolbarY - rect.y}px)`,
                    }}
                >
                    <ChromeBody
                        tool={tool}
                        drawColor={drawColor}
                        strokeCount={strokeCount}
                        keys={keys}
                        t={t}
                        onCopy={onCopy}
                        onDownload={onDownload}
                        onReselect={onReselect}
                        onClose={onClose}
                        onTool={onTool}
                        onColor={onColor}
                        onUndo={onUndo}
                        onClear={onClear}
                    />
                </div>
            )}
        </>
    );
});

const MousePosBadge = React.memo(function MousePosBadge({ t }: { t: TFunction }) {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
        window.addEventListener("mousemove", onMove, { passive: true });
        return () => window.removeEventListener("mousemove", onMove);
    }, []);
    return (
        <div
            className="absolute pointer-events-none p-2 rounded-xl bg-[#141418] border border-[#ff4f00] shadow-2xl flex flex-col gap-1 text-[11px] font-mono text-neutral-200 z-50"
            style={{
                left: `${Math.max(16, Math.min(window.innerWidth - 180, pos.x + 20))}px`,
                top: `${Math.max(16, Math.min(window.innerHeight - 100, pos.y + 20))}px`,
            }}
        >
            <div className="flex items-center gap-1.5 font-bold text-[#ff4f00]">
                <Crop className="w-3.5 h-3.5" />
                <span>{t("overlay.selection")}</span>
            </div>
            <div>
                X: {pos.x}px · Y: {pos.y}px
            </div>
            <div className="text-[10px] text-neutral-400">{t("overlay.dragHint")}</div>
        </div>
    );
});

export default function Overlay() {
    const { t } = useTranslation();
    const [bg, setBg] = useState<string | null>(null);
    const [bgReady, setBgReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
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

    const [tool, setTool] = useState<DrawTool | null>(null);
    const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
    const [strokes, setStrokes] = useState<Annotation[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Annotation | null>(null);
    const strokeId = useRef(0);
    const strokesRef = useRef<Annotation[]>([]);

    useEffect(() => {
        strokesRef.current = strokes;
    }, [strokes]);

    const selectedRectRef = useRef<RectBox | null>(null);
    useEffect(() => {
        selectedRectRef.current = selectedRect;
    }, [selectedRect]);

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
        setTool(null);
        setStrokes([]);
        setCurrentStroke(null);
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

    const cssToPhysical = useCallback((v: number) => Math.round(v * (window.devicePixelRatio || 1)), []);

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

    const renderAnnotatedPNG = useCallback(async (rect: RectBox): Promise<string | null> => {
        const current = strokesRef.current;
        if (!bg || current.length === 0) return null;
        const scale = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(rect.width * scale));
        canvas.height = Math.max(1, Math.round(rect.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        const pngUrl = await GetLastCapturePNG();
        if (!pngUrl) return null;
        const img = new Image();
        await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej(new Error("bg decode"));
            img.src = pngUrl;
        });
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.drawImage(img, rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale, 0, 0, rect.width, rect.height);
        current.forEach((a, i) => {
            drawAnnotation(ctx, a);
            if (a.tool === "pin") drawAnnotationBadge(ctx, a, i + 1);
        });
        return canvas.toDataURL("image/png");
    }, [bg]);

    const copyToClipboard = useCallback(async (rect: RectBox) => {
        try {
            const annotated = await renderAnnotatedPNG(rect);
            if (annotated) {
                await CopyAnnotatedPNG(annotated);
            } else {
                await ExtractRegion(cssToPhysical(rect.x), cssToPhysical(rect.y), cssToPhysical(rect.width), cssToPhysical(rect.height));
            }
            setIsCopied(true);
            showToast(t("overlay.copied"));
            setTimeout(() => setIsCopied(false), 1800);
        } catch (e: any) {
            console.error("Clipboard copy failed:", e);
            showToast(t("overlay.copyFailed"), 2600);
        }
    }, [renderAnnotatedPNG, cssToPhysical, showToast, t]);

    const downloadCropped = useCallback(async (rect: RectBox) => {
        try {
            const annotated = await renderAnnotatedPNG(rect);
            const path = annotated
                ? await SaveAnnotatedPNG(annotated)
                : await ExtractRegionToFile(cssToPhysical(rect.x), cssToPhysical(rect.y), cssToPhysical(rect.width), cssToPhysical(rect.height));
            const fileName = path.split(/[\\/]/).pop() || path;
            showToast(t("overlay.downloaded", { file: fileName }), 3400);
        } catch (e: any) {
            console.error("Download error:", e);
            showToast(t("overlay.downloadFailed") + ": " + (e?.message || "bilinmeyen"), 2600);
        }
    }, [renderAnnotatedPNG, cssToPhysical, showToast, t]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (activeHandle || !bgReady) return;

        if (selectedRect && tool) {
            const rx = e.clientX - selectedRect.x;
            const ry = e.clientY - selectedRect.y;
            const inside = rx >= 0 && ry >= 0 && rx <= selectedRect.width && ry <= selectedRect.height;
            if (!inside) return;
            if (tool === "pin") {
                const nextNum = Math.max(0, ...strokes.filter((s) => s.tool === "pin").map((s) => s.num ?? 0)) + 1;
                setStrokes((prev) => [
                    ...prev,
                    {
                        id: ++strokeId.current,
                        tool: "pin",
                        color: drawColor,
                        size: TOOL_SIZE.pin,
                        points: [{ x: rx, y: ry }],
                        num: nextNum,
                    },
                ]);
                return;
            }
            setCurrentStroke({
                id: ++strokeId.current,
                tool,
                color: drawColor,
                size: TOOL_SIZE[tool],
                points: [{ x: Math.max(0, rx), y: Math.max(0, ry) }],
            });
            return;
        }

        setIsDrawing(true);
        setStartPos({ x: e.clientX, y: e.clientY });
        setSelectedRect(null);
        setStrokes([]);
    };

    const latestPos = useRef({ x: 0, y: 0 });
    const rafPending = useRef(false);
    const rafId = useRef<number | null>(null);

    const applyPointer = (pos: { x: number; y: number }) => {
        if (currentStroke && selectedRect) {
            const rel = {
                x: Math.max(0, Math.min(pos.x - selectedRect.x, selectedRect.width)),
                y: Math.max(0, Math.min(pos.y - selectedRect.y, selectedRect.height)),
            };
            setCurrentStroke((cs) => {
                if (!cs) return cs;
                if (cs.tool === "pen") {
                    const last = cs.points[cs.points.length - 1];
                    if (last && Math.hypot(rel.x - last.x, rel.y - last.y) < 1.5) return cs;
                    return { ...cs, points: [...cs.points, rel] };
                }
                return { ...cs, points: [cs.points[0], rel] };
            });
            return;
        }

        const resizing = Boolean(activeHandle && dragStartPoint && rectBeforeDrag);
        const drawing = Boolean(isDrawing && startPos);

        if (!resizing && !drawing && selectedRect) return;

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
        if (!isDrawing && !activeHandle && !currentStroke) return;
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

        if (currentStroke && selectedRect) {
            const cs = currentStroke;
            const rel = {
                x: Math.max(0, Math.min(upPos.x - selectedRect.x, selectedRect.width)),
                y: Math.max(0, Math.min(upPos.y - selectedRect.y, selectedRect.height)),
            };
            let points = cs.points;
            if (cs.tool === "pen") {
                points = [...points, rel];
            } else if (points.length >= 2) {
                points = [points[0], rel];
            }
            const valid =
                cs.tool === "pen"
                    ? points.length > 2
                    : points.length === 2 && Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) > 4;
            if (valid) {
                setStrokes((prev) => [...prev, { ...cs, points }]);
            }
            setCurrentStroke(null);
            return;
        }

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
        if (tool) return;
        e.stopPropagation();
        if (!selectedRect) return;
        setActiveHandle(handle);
        setDragStartPoint({ x: e.clientX, y: e.clientY });
        setRectBeforeDrag({ ...selectedRect });
    };

    const resetSelection = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedRect(null);
        setStartPos(null);
        setIsDrawing(false);
        setStrokes([]);
        setTool(null);
        setCurrentStroke(null);
    }, []);

    const handleToolSelect = useCallback((id: DrawTool) => {
        setTool((cur) => (cur === id ? null : id));
    }, []);

    const handleUndo = useCallback(() => {
        setStrokes((prev) => prev.slice(0, -1));
        setCurrentStroke(null);
    }, []);

    const handleClear = useCallback(() => {
        setStrokes([]);
        setCurrentStroke(null);
    }, []);

    const handleCopyBtn = useCallback(() => {
        const r = selectedRectRef.current;
        if (!r) return;
        void copyToClipboard(r);
        void CloseOverlay();
    }, [copyToClipboard]);

    const handleDownloadBtn = useCallback(() => {
        const r = selectedRectRef.current;
        if (!r) return;
        void downloadCropped(r);
    }, [downloadCropped]);

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

            {bgReady && !selectedRect && !isDrawing && <MousePosBadge t={t} />}

            {selectedRect && (
                <>
                <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                    <path
                        fillRule="evenodd"
                        fill="rgba(0,0,0,0.6)"
                        d={`M0 0H${window.innerWidth}V${window.innerHeight}H0Z M${selectedRect.x} ${selectedRect.y}h${selectedRect.width}v${selectedRect.height}h${-selectedRect.width}Z`}
                    />
                </svg>
                <div
                    className="absolute border-2 border-[#ff4f00]"
                    style={{
                        left: `${selectedRect.x}px`,
                        top: `${selectedRect.y}px`,
                        width: `${selectedRect.width}px`,
                        height: `${selectedRect.height}px`,
                        boxShadow: "0 0 25px rgba(255,79,0,0.35)",
                    }}
                >
                    <div onMouseDown={(e) => startHandleResize(e, "move")} className="absolute inset-4 flex items-center justify-center group" style={{ cursor: tool ? "crosshair" : "move" }}>
                        {!tool && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-[#141418]/90 border border-[#ff4f00]/60 text-[#ff4f00] flex items-center gap-1 text-[10px] font-mono shadow-lg">
                                <Move className="w-3 h-3" />
                                <span>{t("overlay.move")}</span>
                            </div>
                        )}
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

                    <svg className="absolute inset-0 pointer-events-none z-30 overflow-hidden" width={selectedRect.width} height={selectedRect.height}>
                        {strokes.map((a, i) => (
                            <AnnotationSvg key={a.id} a={a} index={i + 1} />
                        ))}
                        {currentStroke && <AnnotationSvg a={currentStroke} index={strokes.length + 1} />}
                    </svg>

                    <SelectionChrome
                        rect={selectedRect}
                        isDrawing={isDrawing}
                        tool={tool}
                        drawColor={drawColor}
                        strokeCount={strokes.length}
                        keys={keys}
                        t={t}
                        onCopy={handleCopyBtn}
                        onDownload={handleDownloadBtn}
                        onReselect={resetSelection}
                        onClose={closeOverlay}
                        onTool={handleToolSelect}
                        onColor={setDrawColor}
                        onUndo={handleUndo}
                        onClear={handleClear}
                    />
                </div>
                </>
            )}

            {toast && (
                <div className="pointer-events-none absolute bottom-8 left-1/2 z-60 -translate-x-1/2 rounded-xl border border-orange-500/60 bg-[#141418]/95 px-5 py-3 font-mono text-sm font-bold text-orange-400 shadow-2xl">
                    {toast.message}
                </div>
            )}
        </div>
    );
}
