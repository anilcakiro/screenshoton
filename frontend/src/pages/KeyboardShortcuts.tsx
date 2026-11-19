import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
    ArrowRight,
    Camera,
    Check,
    CircleAlert,
    Copy,
    Download,
    Lock,
    Pencil,
    Search,
    SearchX,
    X,
} from "lucide-react";
import { GetSettings, SaveSettings } from "@wails/wareon/services/screenshotservice";
import type { AppSettings } from "@wails/wareon/services/models";

type EditableField = "hotkey" | "overlayCopy" | "overlaySave" | "overlayCancel";
type KbdSize = "sm" | "md" | "lg";

type RowDef = {
    icon: ElementType;
    titleKey: string;
    descKey: string;
    combo: string;
    field?: EditableField;
};

const DISPLAY_NAMES: Record<string, string> = {
    PrintScreen: "PrtSc",
    Escape: "Esc",
    " ": "Space",
};

const MOD_KEYS = ["Control", "Shift", "Alt", "Meta"];
const MOD_LABELS = ["Ctrl", "Alt", "Shift", "Win"];

const heldModifiers = (pressed: Set<string>) =>
    [
        pressed.has("Control") ? "Ctrl" : null,
        pressed.has("Alt") ? "Alt" : null,
        pressed.has("Shift") ? "Shift" : null,
        pressed.has("Meta") ? "Win" : null,
    ].filter((m): m is string => Boolean(m));


const Kbd = ({
    children,
    active,
    size = "md",
}: {
    children: ReactNode;
    active?: boolean;
    size?: KbdSize;
}) => {
    const dims =
        size === "lg"
            ? "h-9 min-w-9 rounded-lg px-3 text-[12.5px] font-semibold"
            : size === "sm"
              ? "h-6 min-w-6 rounded-md px-1.5 text-[10px] font-medium"
              : "h-7 min-w-7 rounded-md px-2 text-[11px] font-medium";
    const skin = active ? "keycap-active" : "keycap";
    return (
        <kbd className={`inline-flex items-center justify-center font-mono tracking-tight ${dims} ${skin}`}>
            {children}
        </kbd>
    );
};

const Plus = ({ size = "md" }: { size?: KbdSize }) => (
    <span
        aria-hidden
        className={`select-none font-mono text-sdbr-disabled/40 ${
            size === "lg" ? "px-1.5 text-xs" : size === "sm" ? "px-1 text-[9px]" : "px-1 text-[10px]"
        }`}
    >
        +
    </span>
);

const ComboChips = ({
    combo,
    active,
    size = "md",
    align = "end",
}: {
    combo: string;
    active?: boolean;
    size?: KbdSize;
    align?: "start" | "end";
}) => {
    const parts = combo
        .split("+")
        .map((s) => s.trim())
        .filter(Boolean);
    return (
        <span
            className={`inline-flex flex-wrap items-center gap-y-1.5 ${
                align === "start" ? "justify-start" : "justify-end"
            }`}
        >
            {parts.map((p, i) => (
                <span key={i} className="inline-flex items-center">
                    {i > 0 && <Plus size={size} />}
                    <Kbd active={active} size={size}>
                        {DISPLAY_NAMES[p] ?? p}
                    </Kbd>
                </span>
            ))}
        </span>
    );
};

const ListeningBars = ({ className = "" }: { className?: string }) => (
    <span aria-hidden className={`inline-flex shrink-0 items-end gap-1 ${className}`}>
        {[10, 16, 12, 8].map((h, i) => (
            <i
                key={i}
                className="w-1 animate-pulse rounded-full bg-sdbr-disabled/60"
                style={{ height: h, animationDelay: `${i * 150}ms` }}
            />
        ))}
    </span>
);


const ShortcutRow = ({
    row,
    recording,
    flash,
    liveCombo,
    pendingCombo,
    held,
    conflict,
    onStart,
    onCancel,
    onClear,
    onSave,
}: {
    row: RowDef;
    recording: boolean;
    flash: boolean;
    liveCombo: string;
    pendingCombo: string;
    held: string[];
    conflict: string | null;
    onStart: () => void;
    onCancel: () => void;
    onClear: () => void;
    onSave: () => void;
}) => {
    const { t } = useTranslation();
    const title = t(row.titleKey);
    const editable = Boolean(row.field);
    const interactive = editable && !recording;
    const Icon = row.icon;

    const commit = () => {
        if (pendingCombo) onSave();
    };

    return (
        <div>
            <div
                role={editable ? "button" : undefined}
                aria-label={editable ? t("shortcuts.changeAria", { title }) : title}
                aria-expanded={editable ? recording : undefined}
                tabIndex={editable ? 0 : undefined}
                onClick={interactive ? onStart : undefined}
                onKeyDown={
                    editable
                        ? (e) => {
                              if (interactive && (e.key === "Enter" || e.key === " ")) {
                                  e.preventDefault();
                                  onStart();
                              }
                          }
                        : undefined
                }
                
                className={`group flex w-full  outline-0 flex-wrap items-center gap-x-3.5 gap-y-2.5 px-4 py-3.5 text-left transition-colors duration-200 ${
                    recording ? "bg-card" : "bg-card hover:bg-card"
                } ${editable && !recording ? "cursor-pointer" : ""} ${
                    editable
                        ? "focus-visible:bg-primary/4 focus-visible:outline-none "
                        : ""
                }`}
            >
                <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl transition-colors duration-200 ${
                        recording
                            ? "bg-primary/10 text-primary"
                            : "bg-window-b/55 text-foreground/65 group-hover:bg-primary/10 group-hover:text-primary"
                    }`}
                >
                    <Icon className="size-4" strokeWidth={1.9} />
                </span>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold tracking-[-0.01em]">{title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-sdbr-disabled">{t(row.descKey)}</p>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-2.5">
                    <span className={recording ? "opacity-45 transition-opacity" : "transition-opacity"}>
                        <ComboChips combo={row.combo} />
                    </span>

                    {recording ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-sdbr-disabled">
                            <i className="size-1.5 rounded-full bg-primary/70" />
                            <span className="hidden sm:inline">{t("shortcuts.listening")}</span>
                        </span>
                    ) : flash ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-primary">
                            <Check className="size-3.5" strokeWidth={3} />
                            <span className="hidden sm:inline">{t("common.saved")}</span>
                        </span>
                    ) : editable ? (
                        <Pencil className="size-3.5 text-sdbr-disabled/50 transition-colors group-hover:text-primary" />
                    ) : (
                        <Lock className="size-3.5 text-sdbr-disabled/35" />
                    )}
                </div>
            </div>

            {recording && (
                <div className=" border-window-b/70 bg-card px-4 pb-4 pt-3 sm:px-5">
                    <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <div className="flex min-h-16 flex-1 flex-col justify-center gap-1.5 rounded-2xl border border-window-b bg-dl/60 px-4 py-2.5">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sdbr-disabled/70">
                                {t("shortcuts.current")}
                            </span>
                            <ComboChips combo={row.combo} size="sm" align="start" />
                        </div>

                        <span aria-hidden className="hidden shrink-0 items-center px-1 text-sdbr-disabled/40 sm:flex">
                            <ArrowRight className="size-4" strokeWidth={2} />
                        </span>

                        <div
                            className={`flex min-h-16 flex-[1.4] flex-col justify-center gap-1.5 rounded-2xl border px-4 py-2.5 transition-colors duration-200 ${
                                liveCombo
                                    ? "border-primary/30 bg-dl"
                                    : "border-dashed border-window-b bg-dl/50"
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sdbr-disabled/70">
                                    {t("shortcuts.newShortcut")}
                                </span>
                                {pendingCombo && (
                                    <button
                                        type="button"
                                        onClick={onClear}
                                        title={t("common.clear")}
                                        className="ml-auto grid size-4.5 place-items-center rounded-full text-sdbr-disabled transition-colors hover:bg-window-b/60 hover:text-foreground"
                                    >
                                        <X className="size-2.5" />
                                    </button>
                                )}
                            </div>
                            {liveCombo ? (
                                <ComboChips combo={liveCombo} active align="start" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    <ListeningBars />
                                    <span className="text-[11.5px] font-medium text-sdbr-disabled">{t("shortcuts.waitingKeys")}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2.5">
                        <div className="flex items-center gap-1.5">
                            <span className="mr-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-sdbr-disabled/70">
                                {t("shortcuts.modifiers")}
                            </span>
                            {MOD_LABELS.map((m) => (
                                <Kbd key={m} active={held.includes(m)} size="sm">
                                    {m}
                                </Kbd>
                            ))}
                        </div>

                        <span className="flex items-center gap-1.5 text-[10px] text-sdbr-disabled/80">
                            {pendingCombo ? (
                                <>
                                    {t("shortcuts.confirmPrefix")}
                                    <Kbd size="sm">Enter</Kbd>
                                </>
                            ) : (
                                t("shortcuts.pressHint")
                            )}
                        </span>

                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="h-9 rounded-xl px-3.5 text-[11.5px] font-medium text-sdbr-disabled transition-colors hover:bg-window-b/60 hover:text-foreground"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={commit}
                                disabled={!pendingCombo}
                                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-[11.5px] font-medium transition-colors ${
                                    pendingCombo
                                        ? "bg-primary text-white hover:bg-primary/90"
                                        : "cursor-not-allowed bg-window-b/55 text-sdbr-disabled/50"
                                }`}
                            >
                                <Check className="size-3.5" strokeWidth={2.5} />
                                {conflict ? t("shortcuts.saveAnyway") : t("common.save")}
                            </button>
                        </div>
                    </div>

                    {conflict && (
                        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/6 px-3 py-2 text-[10.5px] leading-snug text-amber-600 dark:text-amber-400">
                            <CircleAlert className="mt-px size-3.5 shrink-0" />
                            <span>
                                <Trans
                                    i18nKey="shortcuts.conflict"
                                    values={{ label: conflict }}
                                    components={{ 1: <b /> }}
                                />
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


export default function KeyboardShortcuts() {
    const { t, i18n } = useTranslation();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [recording, setRecording] = useState<EditableField | null>(null);
    const [flash, setFlash] = useState<EditableField | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [liveCombo, setLiveCombo] = useState("");
    const [pendingCombo, setPendingCombo] = useState("");
    const [held, setHeld] = useState<string[]>([]);
    const pressedRef = useRef<Set<string>>(new Set());
    const lastComboRef = useRef("");
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        void GetSettings()
            .then((s) => s && setSettings(s))
            .catch(() => {});
    }, []);

    const saveCombo = async (field: EditableField, combo: string) => {
        if (!settings) return;
        try {
            const next = { ...settings, [field]: combo };
            await SaveSettings(next);
            setSettings(next);
            setRecording(null);
            setError(null);
            setFlash(field);
            window.setTimeout(() => setFlash((f) => (f === field ? null : f)), 1500);
        } catch (err: any) {
            setRecording(null);
            setError(err?.message || t("shortcuts.saveFailed"));
        }
    };

    useEffect(() => {
        if (!recording && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    }, [recording]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (recording || e.key !== "/") return;
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
            e.preventDefault();
            searchRef.current?.focus();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [recording]);

    useEffect(() => {
        if (!recording) {
            pressedRef.current.clear();
            lastComboRef.current = "";
            setLiveCombo("");
            setPendingCombo("");
            setHeld([]);
            return;
        }

        const canon = (k: string) => (k === " " ? "Space" : k.length === 1 ? k.toUpperCase() : k);

        const buildCombo = (pressed: Set<string>) => {
            const parts: string[] = [];
            if (pressed.has("Control")) parts.push("Ctrl");
            if (pressed.has("Alt")) parts.push("Alt");
            if (pressed.has("Shift")) parts.push("Shift");
            if (pressed.has("Meta")) parts.push("Win");
            const keys = [...pressed].filter((k) => !MOD_KEYS.includes(k));
            if (keys.length) parts.push(canon(keys[keys.length - 1]));
            return parts.join("+");
        };

        const onKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "Escape") {
                setRecording(null);
                return;
            }
            if (pendingCombo && e.key === "Enter") {
                const combo = pendingCombo;
                setPendingCombo("");
                void saveCombo(recording, combo);
                return;
            }
            if (pendingCombo) setPendingCombo("");
            pressedRef.current.add(e.key);
            setHeld(heldModifiers(pressedRef.current));
            const combo = buildCombo(pressedRef.current);
            setLiveCombo(combo);
            if (!MOD_KEYS.includes(e.key)) lastComboRef.current = combo;
        };

        const onKeyUp = (e: KeyboardEvent) => {
            pressedRef.current.delete(e.key);
            setHeld(heldModifiers(pressedRef.current));
            if (pressedRef.current.size === 0) {
                const combo = lastComboRef.current;
                lastComboRef.current = "";
                if (combo) {
                    setPendingCombo(combo);
                } else {
                    setLiveCombo("");
                }
            } else {
                setLiveCombo(lastComboRef.current || buildCombo(pressedRef.current));
            }
        };

        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("keyup", onKeyUp, true);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("keyup", onKeyUp, true);
        };
    }, [recording, settings, pendingCombo]);

    const rows = useMemo<RowDef[]>(() => {
        const comboOf = (field: EditableField, fallback: string) => settings?.[field] || fallback;
        return [
            {
                icon: Camera,
                titleKey: "shortcuts.globalCapture",
                descKey: "shortcuts.globalCaptureDesc",
                combo: comboOf("hotkey", "PrintScreen"),
                field: "hotkey",
            },
            {
                icon: Copy,
                titleKey: "shortcuts.copyClipboard",
                descKey: "shortcuts.copyClipboardDesc",
                combo: comboOf("overlayCopy", "Ctrl+C"),
                field: "overlayCopy",
            },
            {
                icon: Download,
                titleKey: "shortcuts.saveFile",
                descKey: "shortcuts.saveFileDesc",
                combo: comboOf("overlaySave", "Ctrl+S"),
                field: "overlaySave",
            },
            {
                icon: X,
                titleKey: "shortcuts.cancel",
                descKey: "shortcuts.cancelDesc",
                combo: comboOf("overlayCancel", "Escape"),
                field: "overlayCancel",
            },
        ];
    }, [settings, i18n.language]);

    const q = query.trim().toLowerCase();
    const textMatches = (...texts: string[]) => !q || texts.some((t) => t.toLowerCase().includes(q));

    const shown = useMemo(
        () =>
            rows.filter((r) =>
                textMatches(t(r.titleKey), t(r.descKey), r.combo),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [rows, q, i18n.language],
    );

    const startRecord = (field: EditableField) => {
        if (recording) return;
        setError(null);
        setRecording(field);
    };

    const savePending = () => {
        if (!recording || !pendingCombo) return;
        const combo = pendingCombo;
        setPendingCombo("");
        void saveCombo(recording, combo);
    };

    const conflict = useMemo(() => {
        if (!pendingCombo || !recording || !settings) return null;
        const norm = (v?: string) => (v ?? "").replace(/\s/g, "").toLowerCase();
        const others: Array<[EditableField, string]> = [
            ["hotkey", "shortcuts.globalCapture"],
            ["overlayCopy", "shortcuts.copyClipboard"],
            ["overlaySave", "shortcuts.saveFile"],
            ["overlayCancel", "shortcuts.cancel"],
        ];
        const hit = others.find(([field, label]) => field !== recording && norm(settings[field]) === norm(pendingCombo));
        return hit ? t(hit[1]) : null;
    }, [pendingCombo, recording, settings, t]);

    return (
        <section className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--window-b)_transparent] scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-window-b [&::-webkit-scrollbar-track]:bg-transparent">
            <div className="mx-auto max-w-3xl px-6 pb-14">
                <div className="flex flex-col gap-4 pt-7 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-[22px] font-bold leading-none tracking-tight">{t("shortcuts.title")}</h1>
                        <p className="mt-2 text-xs leading-snug text-sdbr-disabled">
                            {t("shortcuts.subtitle", { count: rows.length })}
                        </p>
                    </div>
                    <div className="relative w-full shrink-0 sm:w-52">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-sdbr-disabled" />
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("shortcuts.searchPlaceholder")}
                            className="h-9 w-full rounded-xl border border-window-b bg-dl pl-8 pr-9 text-[11.5px] text-foreground outline-none transition-all placeholder:text-sdbr-disabled/60 focus:border-primary/45 focus:ring-2 focus:ring-primary/10"
                        />
                        {query ? (
                            <button
                                onClick={() => setQuery("")}
                                title={t("shortcuts.clearSearch")}
                                className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-sdbr-disabled transition-colors hover:text-foreground"
                            >
                                <X className="size-3" />
                            </button>
                        ) : (
                            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-window-b bg-window-b/60 px-1 py-px font-mono text-[9px] text-sdbr-disabled/70">
                                /
                            </kbd>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/5 px-3.5 py-2.5 text-[11px] text-red-500">
                        <CircleAlert className="size-4 shrink-0" />
                        <span className="flex-1">{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="grid size-5 place-items-center rounded-full text-red-500/70 transition-colors hover:text-red-500"
                            title={t("common.close")}
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                )}

                {shown.length > 0 ? (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-window-b bg-dl">
                        <div className="divide-y divide-window-b/60">
                            {shown.map((row) => (
                                <ShortcutRow
                                    key={row.field ?? row.titleKey}
                                    row={row}
                                    recording={!!row.field && recording === row.field}
                                    flash={!!row.field && flash === row.field}
                                    liveCombo={liveCombo}
                                    pendingCombo={pendingCombo}
                                    held={held}
                                    conflict={recording === row.field ? conflict : null}
                                    onStart={() => row.field && startRecord(row.field)}
                                    onCancel={() => setRecording(null)}
                                    onClear={() => {
                                        setPendingCombo("");
                                        setLiveCombo("");
                                    }}
                                    onSave={savePending}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-window-b bg-dl/40 py-16 text-center">
                        <span className="grid size-11 place-items-center rounded-2xl bg-window-b/60">
                            <SearchX className="size-5 text-sdbr-disabled" />
                        </span>
                        <p className="mt-3.5 text-[12.5px] font-medium">{t("shortcuts.noResults", { query })}</p>
                        <p className="mt-1 text-[11px] text-sdbr-disabled">
                            {t("shortcuts.noResultsHint")}
                        </p>
                        <button
                            onClick={() => setQuery("")}
                            className="mt-4 rounded-lg border border-window-b bg-dl px-3 py-1.5 text-[11px] font-medium text-sdbr-disabled transition-colors hover:text-foreground"
                        >
                            {t("shortcuts.clearSearch")}
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
