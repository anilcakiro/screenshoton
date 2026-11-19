import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, FolderOpen, History, MousePointerClick, RotateCcw, Save } from "lucide-react";
import { Dialogs } from "@wailsio/runtime";
import { GetSaveDir, GetSettings, SaveSettings } from "@wails/wareon/services/screenshotservice";
import type { AppSettings } from "@wails/wareon/services/models";
import { cn } from "cn";

type AfterSelect = "manual" | "copy" | "save";

const AFTER_OPTIONS: Array<{ value: AfterSelect; labelKey: string; descKey: string }> = [
    { value: "manual", labelKey: "settings.afterSelectManual", descKey: "settings.afterSelectManualDesc" },
    { value: "copy", labelKey: "settings.afterSelectCopy", descKey: "settings.afterSelectCopyDesc" },
    { value: "save", labelKey: "settings.afterSelectSave", descKey: "settings.afterSelectSaveDesc" },
];

export default function Selection() {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [resolvedDir, setResolvedDir] = useState("");
    const [flash, setFlash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refreshDir = () => {
        void GetSaveDir()
            .then((d) => d && setResolvedDir(d))
            .catch(() => { });
    };

    useEffect(() => {
        void GetSettings()
            .then((s) => s && setSettings(s))
            .catch(() => { });
        refreshDir();
    }, []);

    const persist = async (patch: Partial<AppSettings>, flashKey: string) => {
        if (!settings) return;
        const next = { ...settings, ...patch };
        try {
            await SaveSettings(next);
            setSettings(next);
            if ("saveDir" in patch) refreshDir();
            setError(null);
            setFlash(flashKey);
            window.setTimeout(() => setFlash((f) => (f === flashKey ? null : f)), 1500);
        } catch (err: any) {
            setError(err?.message || t("common.saveFailed"));
        }
    };

    const afterSelect: AfterSelect =
        settings?.afterSelect === "copy" || settings?.afterSelect === "save" ? settings.afterSelect : "manual";

    return (
        <section className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--window-b)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-window-b [&::-webkit-scrollbar-track]:bg-transparent">
            <div className="mx-auto max-w-3xl px-6 pb-14">
                <div className="pt-7">
                    <h1 className="text-[22px] font-bold leading-none tracking-[-0.025em]">{t("selection.title")}</h1>
                    <p className="mt-2 text-xs leading-snug text-sdbr-disabled">
                        {t("selection.subtitle")}
                    </p>
                </div>

                {error && (
                    <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.05] px-3.5 py-2.5 text-[11px] text-red-500">
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError(null)} className="text-red-500/70 hover:text-red-500">✕</button>
                    </div>
                )}

                <div className="mt-5 overflow-hidden rounded-2xl border border-window-b bg-card">
                    <div className="divide-y divide-window-b/60">
                        <div className="px-4 py-4 sm:px-5">
                            <div className="flex items-center gap-3">
                                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-window-b/55 text-foreground/65">
                                    <MousePointerClick className="size-4" strokeWidth={1.9} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-semibold tracking-[-0.01em]">{t("settings.afterSelect")}</p>

                                </div>
                            </div>

                            <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                {AFTER_OPTIONS.map((opt) => {
                                    const active = afterSelect === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => void persist({ afterSelect: opt.value }, "afterSelect")}
                                            className={cn(
                                                "group flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-all duration-200",
                                                active
                                                    ? "border-transparent bg-primary/[0.07]"
                                                    : "border-window-b bg-dl/50 hover:border-window-b hover:bg-window-b/40",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "text-[12px] font-semibold",
                                                    active ? "text-primary" : "text-foreground/80",
                                                )}
                                            >
                                                {t(opt.labelKey)}
                                            </span>
                                            <span className="text-[10.5px] leading-snug text-sdbr-disabled">
                                                {t(opt.descKey)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-window-b/55 text-foreground/65">
                                <Save className="size-4" strokeWidth={1.9} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold tracking-[-0.01em]">{t("settings.autoSavePNG")}</p>
                                <p className="mt-0.5 text-[11px] leading-snug text-sdbr-disabled">
                                    {t("settings.autoSavePNGDesc")}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={settings?.autoSavePNG ?? false}
                                onClick={() => void persist({ autoSavePNG: !(settings?.autoSavePNG ?? false) }, "autoSavePNG")}
                                className={cn(
                                    "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                                    settings?.autoSavePNG ? "bg-primary" : "bg-foreground/15",
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200",
                                        settings?.autoSavePNG ? "left-[22px]" : "left-0.5",
                                    )}
                                />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-window-b/55 text-foreground/65">
                                <History className="size-4" strokeWidth={1.9} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold tracking-[-0.01em]">{t("settings.showCopiedHistory")}</p>
                                <p className="mt-0.5 text-[11px] leading-snug text-sdbr-disabled">
                                    {t("settings.showCopiedHistoryDesc")}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={settings?.showCopiedHistory ?? true}
                                onClick={() => void persist({ showCopiedHistory: !(settings?.showCopiedHistory ?? true) }, "showCopiedHistory")}
                                className={cn(
                                    "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                                    (settings?.showCopiedHistory ?? true) ? "bg-primary" : "bg-foreground/15",
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200",
                                        (settings?.showCopiedHistory ?? true) ? "left-[22px]" : "left-0.5",
                                    )}
                                />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-window-b/55 text-foreground/65">
                                <FolderOpen className="size-4" strokeWidth={1.9} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold tracking-[-0.01em]">{t("settings.saveDir")}</p>
                                <p className="mt-0.5 truncate font-mono text-[10.5px] leading-snug text-sdbr-disabled" title={resolvedDir}>
                                    {resolvedDir || "…"}
                                </p>
                            </div>
                            {flash === "saveDir" && (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-primary">
                                    <Check className="size-3.5" strokeWidth={3} />
                                    <span className="hidden sm:inline">{t("common.saved")}</span>
                                </span>
                            )}
                            <div className="flex shrink-0 items-center gap-1.5">
                                {settings?.saveDir && (
                                    <button
                                        type="button"
                                        onClick={() => void persist({ saveDir: "" }, "saveDir")}
                                        title={t("common.reset")}
                                        className="grid size-8 place-items-center rounded-lg text-sdbr-disabled transition-colors hover:bg-window-b/60 hover:text-foreground"
                                    >
                                        <RotateCcw className="size-3.5" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const dir = await Dialogs.OpenFile({
                                                CanChooseDirectories: true,
                                                CanChooseFiles: false,
                                                Title: t("settings.saveDirPick"),
                                            });
                                            const picked = Array.isArray(dir) ? dir[0] : dir;
                                            if (picked) void persist({ saveDir: picked }, "saveDir");
                                        } catch { }
                                    }}
                                    className="h-8 rounded-lg bg-primary px-3.5 text-[11.5px] font-medium text-white transition-colors hover:bg-primary/90"
                                >
                                    {t("common.browse")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
