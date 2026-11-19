import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { Events } from "@wailsio/runtime";
import { CalendarDays, Check, ChevronRight, Clipboard, Copy, Image as ImageIcon, ImageOff, LayoutGrid, Trash2, X } from "lucide-react";
import { useHistoryStore } from "@stores/history";
import type { HistoryItem } from "@wails/wareon/services/models";

const formatBytes = (n: number) =>
    n >= 1024 * 1024
        ? `${(n / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(n / 1024))} KB`;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const dayLabel = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
    if (diff <= 0) return i18n.t("home.today");
    if (diff === 1) return i18n.t("home.yesterday");
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(i18n.language, {
        day: "numeric",
        month: "long",
        ...(sameYear ? {} : { year: "numeric" }),
    });
};

const formatTime = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? ""
        : d.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
};

const KindBadge = ({ kind }: { kind: string }) =>
    kind === "clip" ? (
        <Clipboard className="size-3" />
    ) : (
        <ImageIcon className="size-3" />
    );

function HistoryCard({
    item,
    index,
    thumb,
    copied,
    animate = false,
    onOpen,
    onCopy,
    onRemove,
}: {
    item: HistoryItem;
    index: number;
    thumb?: string;
    copied: boolean;
    animate?: boolean;
    onOpen: () => void;
    onCopy: () => void;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div
            className={`group relative aspect-video overflow-hidden rounded-2xl border border-window-b bg-window-b/30 transition-shadow duration-300 hover:shadow-[0_16px_40px_rgba(0,0,0,0.16)] ${
                animate ? "animate-in fade-in zoom-in-95 duration-500" : ""
            }`}
        >
            <button onClick={onOpen} className="absolute inset-0 cursor-zoom-in">
                {thumb ? (
                    <img
                        src={thumb}
                        alt={item.name}
                        draggable={false}
                        className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.07]"
                    />
                ) : (
                    <div className="h-full w-full animate-pulse bg-window-b" />
                )}
            </button>

            <span className="absolute left-2.5 top-2.5 rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white/90 backdrop-blur-sm">
                #{String(index).padStart(3, "0")}
            </span>
            <span
                title={item.kind === "clip" ? t("home.kindClip") : t("home.kindFile")}
                className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-md bg-black/50 text-white/90 backdrop-blur-sm"
            >
                <KindBadge kind={item.kind} />
            </span>

            <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-linear-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0 text-white">
                        <p className="text-[11px] font-medium tabular-nums leading-tight">
                            {item.width}×{item.height}
                            <span className="mx-1.5 text-white/40">·</span>
                            {formatBytes(item.bytes)}
                        </p>
                        <p className="mt-0.5 text-[10px] tabular-nums leading-tight text-white/55">
                            {dayLabel(item.modifiedAt)} · {formatTime(item.modifiedAt)}
                        </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                        <button
                            onClick={onCopy}
                            title={t("home.copyTooltip")}
                            className="grid size-8 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-md transition-all hover:bg-primary hover:scale-105 active:scale-95"
                        >
                            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                        </button>
                        <button
                            onClick={onRemove}
                            title={t("common.delete")}
                            className="grid size-8 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-md transition-all hover:bg-red-500 hover:scale-105 active:scale-95"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Home() {
    const { t } = useTranslation();
    const { items, thumbs, loading, fetchHistory, copyItem, removeItem, clearAll, openImage } =
        useHistoryStore();
    const [viewer, setViewer] = useState<{ url: string; item: HistoryItem } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);
    const [viewMode, setViewMode] = useState<"dated" | "plain">("dated");
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    useEffect(() => {
        void fetchHistory();
        const off = Events.On("history:changed", () => void fetchHistory());
        return () => {
            if (typeof off === "function") off();
        };
    }, [fetchHistory]);

    const seenPaths = useRef<Set<string> | null>(null);
    const [freshPaths, setFreshPaths] = useState<Set<string>>(new Set());
    useEffect(() => {
        if (!items) return;
        if (seenPaths.current === null) {
            seenPaths.current = new Set(items.map((i) => i.path));
            return;
        }
        const added = items.filter((i) => !seenPaths.current!.has(i.path));
        if (added.length) {
            setFreshPaths(new Set(added.map((i) => i.path)));
            for (const i of added) seenPaths.current.add(i.path);
        }
    }, [items]);

    useEffect(() => {
        if (!viewer) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setViewer(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [viewer]);

    const open = async (item: HistoryItem) => {
        try {
            const url = await openImage(item.path);
            setViewer({ url, item });
        } catch (e) {
            console.error("openImage failed:", e);
        }
    };

    const copy = async (path: string) => {
        await copyItem(path);
        setCopied(path);
        setTimeout(() => setCopied((p) => (p === path ? null : p)), 1500);
    };

    const isEmpty = items !== null && items.length === 0;
    const isLoading = items === null || (loading && items.length === 0);

    const groups = useMemo(() => {
        if (!items?.length) return [];
        const map = new Map<string, HistoryItem[]>();
        for (const it of items) {
            const label = dayLabel(it.modifiedAt) || i18n.t("home.older");
            const arr = map.get(label) ?? [];
            arr.push(it);
            map.set(label, arr);
        }
        return [...map.entries()];
    }, [items]);

    const stats = useMemo(() => {
        if (!items?.length) return null;
        return { count: items.length };
    }, [items]);

    const indexOf = useMemo(() => {
        const m = new Map<string, number>();
        items?.forEach((it, i) => m.set(it.path, i + 1));
        return m;
    }, [items]);

    return (
        <section className="min-h-0 flex-1 overflow-y-auto scrollbar-thin [scrollbar-color:var(--window-b)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-window-b [&::-webkit-scrollbar-thumb]:transition-colors hover:[&::-webkit-scrollbar-thumb]:bg-sdbr-disabled/50">
            <div className="mx-auto max-w-6xl p-5">
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{t("home.title")}</h1>
                        <p className="mt-1 text-xs text-sdbr-disabled">
                            {stats ? t("home.images", { count: stats.count }) : t("home.subtitle")}
                        </p>
                    </div>
                    {items && items.length > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="flex rounded-lg border border-window-b bg-dl p-0.5">
                                <button
                                    onClick={() => setViewMode("dated")}
                                    title={t("home.viewDate")}
                                    className={`grid size-7 place-items-center rounded-md transition-colors ${
                                        viewMode === "dated"
                                            ? "bg-primary text-white"
                                            : "text-sdbr-disabled hover:text-foreground"
                                    }`}
                                >
                                    <CalendarDays className="size-3.5" />
                                </button>
                                <button
                                    onClick={() => setViewMode("plain")}
                                    title={t("home.viewPlain")}
                                    className={`grid size-7 place-items-center rounded-md transition-colors ${
                                        viewMode === "plain"
                                            ? "bg-primary text-white"
                                            : "text-sdbr-disabled hover:text-foreground"
                                    }`}
                                >
                                    <LayoutGrid className="size-3.5" />
                                </button>
                            </div>
                            {confirmClear ? (
                            <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2">
                                <span className="text-xs text-sdbr-disabled">{t("home.sureDelete")}</span>
                                <button
                                    onClick={() => {
                                        void clearAll();
                                        setConfirmClear(false);
                                    }}
                                    className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                                >
                                    {t("home.yesDelete")}
                                </button>
                                <button
                                    onClick={() => setConfirmClear(false)}
                                    className="rounded-md px-2 py-1.5 text-xs text-sdbr-disabled transition-colors hover:bg-window-b"
                                >
                                    {t("common.cancel")}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmClear(true)}
                                className="flex items-center gap-1.5 rounded-lg border border-window-b px-3 py-2 text-xs font-medium text-sdbr-disabled transition-all hover:border-red-500/40 hover:text-red-500"
                            >
                                <Trash2 className="size-3.5" />
                                {t("home.clearAll")}
                            </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-6" key={viewMode}>
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {isLoading ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="aspect-video animate-pulse rounded-2xl border border-window-b bg-window-b/50"
                                />
                            ))}
                        </div>
                    ) : isEmpty ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-window-b py-28 text-center">
                            <div className="grid size-14 place-items-center rounded-2xl bg-window-b">
                                <ImageOff className="size-6 text-sdbr-disabled" />
                            </div>
                            <p className="mt-4 text-sm font-medium">{t("home.emptyTitle")}</p>
                            <p className="mt-1.5 max-w-64 text-xs leading-relaxed text-sdbr-disabled">
                                {t("home.emptyHintPre")}{" "}
                                {t("home.emptyHintPost")}
                            </p>
                        </div>
                    ) : viewMode === "plain" ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                            {(items ?? []).map((item) => (
                                <HistoryCard
                                    key={item.path}
                                    item={item}
                                    index={indexOf.get(item.path) ?? 0}
                                    thumb={thumbs[item.path]}
                                    copied={copied === item.path}
                                    animate={freshPaths.has(item.path)}
                                    onOpen={() => void open(item)}
                                    onCopy={() => void copy(item.path)}
                                    onRemove={() => void removeItem(item.path)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-7">
                            {groups.map(([label, groupItems]) => (
                                <div key={label}>
                                    <button
                                        onClick={() =>
                                            setCollapsed((c) => ({ ...c, [label]: !c[label] }))
                                        }
                                        className="mb-3 flex w-full items-center gap-3"
                                    >
                                        <ChevronRight
                                            className={`size-3.5 shrink-0 text-sdbr-disabled transition-transform duration-200 ${
                                                collapsed[label] ? "" : "rotate-90"
                                            }`}
                                        />
                                        <span className="h-px flex-1 bg-window-b" />
                                        <span className="flex items-center gap-2 text-xs font-medium text-sdbr-disabled">
                                            {label}
                                            <span className="rounded-full bg-window-b px-2 py-0.5 text-[10px] font-medium tabular-nums">
                                                {groupItems.length}
                                            </span>
                                        </span>
                                        <span className="h-px flex-1 bg-window-b" />
                                    </button>
                                    <div
                                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                            collapsed[label]
                                                ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                                                : "grid-rows-[1fr] opacity-100"
                                        }`}
                                    >
                                        <div className="min-h-0 overflow-hidden">
                                            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 pb-1">
                                                {groupItems.map((item) => (
                                                    <HistoryCard
                                                        key={item.path}
                                                        item={item}
                                                        index={indexOf.get(item.path) ?? 0}
                                                        thumb={thumbs[item.path]}
                                                        copied={copied === item.path}
                                                        animate={freshPaths.has(item.path)}
                                                        onOpen={() => void open(item)}
                                                        onCopy={() => void copy(item.path)}
                                                        onRemove={() => void removeItem(item.path)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {viewer && (
                <div
                    className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setViewer(null)}
                >
                    <div
                        className="flex items-center justify-between gap-3 px-5 py-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex min-w-0 items-center gap-3 text-white">
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10">
                                <KindBadge kind={viewer.item.kind} />
                            </span>
                            <div className="min-w-0 leading-tight">
                                <p className="truncate text-xs font-medium tabular-nums">
                                    {viewer.item.width}×{viewer.item.height}
                                    <span className="mx-1.5 text-white/40">·</span>
                                    {formatBytes(viewer.item.bytes)}
                                </p>
                                <p className="text-[10px] tabular-nums text-white/50">
                                    {dayLabel(viewer.item.modifiedAt)} · {formatTime(viewer.item.modifiedAt)}
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            <button
                                onClick={() => void copy(viewer.item.path)}
                                title={t("home.copyTooltip")}
                                className="grid size-9 place-items-center rounded-xl bg-white/10 text-white transition-all hover:bg-primary hover:scale-105 active:scale-95"
                            >
                                {copied === viewer.item.path ? (
                                    <Check className="size-4" />
                                ) : (
                                    <Copy className="size-4" />
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    void removeItem(viewer.item.path);
                                    setViewer(null);
                                }}
                                title={t("common.delete")}
                                className="grid size-9 place-items-center rounded-xl bg-white/10 text-white transition-all hover:bg-red-500 hover:scale-105 active:scale-95"
                            >
                                <Trash2 className="size-4" />
                            </button>
                            <button
                                onClick={() => setViewer(null)}
                                title={t("home.closeEsc")}
                                className="grid size-9 place-items-center rounded-xl bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-105 active:scale-95"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 items-center justify-center p-6 pt-0">
                        <img
                            src={viewer.url}
                            alt={viewer.item.name}
                            className="max-h-[75vh] max-w-[85vw] rounded-xl object-contain shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </section>
    );
}
