import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpCircle, Languages, Monitor, Moon, Power, RefreshCw, Sun, Zap } from "lucide-react";
import { Events } from "@wailsio/runtime";
import { CheckForUpdate, DownloadUpdate, GetSettings, GetVersion, InstallUpdate, SaveSettings } from "@wails/wareon/services/screenshotservice";
import type { AppSettings, UpdateInfo } from "@wails/wareon/services/models";
import { cn } from "cn";

type ThemeChoice = "system" | "light" | "dark";

const THEME_OPTIONS: Array<{ value: ThemeChoice; labelKey: string; icon: typeof Sun }> = [
    { value: "system", labelKey: "settings.themeSystem", icon: Monitor },
    { value: "light", labelKey: "settings.themeLight", icon: Sun },
    { value: "dark", labelKey: "settings.themeDark", icon: Moon },
];

export default function Settings() {
    const { t, i18n } = useTranslation();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [version, setVersion] = useState("");
    const [update, setUpdate] = useState<UpdateInfo | null>(null);
    const [checking, setChecking] = useState(false);
    const [installing, setInstalling] = useState<number | null>(null);

    useEffect(() => {
        void GetSettings()
            .then((s) => s && setSettings(s))
            .catch(() => { });
        void GetVersion()
            .then((v) => setVersion(v))
            .catch(() => { });
        return Events.On("update:progress", (ev: any) => {
            const p = ev?.data;
            if (typeof p === "number") setInstalling(p);
        });
    }, []);

    const installUpdate = async () => {
        if (!update?.updateAvailable) return;
        setInstalling(0);
        setError(null);
        try {
            await DownloadUpdate();
            await InstallUpdate();
        } catch (err: any) {
            setInstalling(null);
            setError(err?.message || t("settings.updateFailed"));
        }
    };

    const checkUpdate = async () => {
        setChecking(true);
        setUpdate(null);
        try {
            setUpdate(await CheckForUpdate());
        } catch {
            setUpdate({ current: version, latest: "", updateAvailable: false, releaseUrl: "", error: t("settings.updateFailed") });
        } finally {
            setChecking(false);
        }
    };

    const persist = async (patch: Partial<AppSettings>) => {
        if (!settings) return;
        const next = { ...settings, ...patch };
        try {
            await SaveSettings(next);
            setSettings(next);
            setError(null);
        } catch (err: any) {
            setError(err?.message || t("common.saveFailed"));
        }
    };

    return (
        <section className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--window-b)_transparent] scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-window-b [&::-webkit-scrollbar-track]:bg-transparent">
            <div className="mx-auto max-w-3xl px-6 pb-14">
                <div className="pt-7">
                    <h1 className="text-[22px] font-bold leading-none tracking-tight">{t("settings.title")}</h1>
                    <p className="mt-2 text-xs leading-snug text-sdbr-disabled">
                        {t("settings.subtitle")}
                    </p>
                </div>

                {error && (
                    <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/5 px-3.5 py-2.5 text-[11px] text-red-500">
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError(null)} className="text-red-500/70 hover:text-red-500">✕</button>
                    </div>
                )}

                <div className="mt-5 overflow-hidden rounded-2xl border border-window-b bg-card">
                    <div className="divide-y divide-window-b/60">
                        <div className="px-4 py-4 sm:px-5">
                            <div className="flex items-center gap-3">
                                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-window-b/55 text-foreground/65">
                                    <Languages className="size-4" strokeWidth={1.9} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-semibold tracking-[-0.01em]">{t("settings.language")}</p>
                                    <p className="mt-0.5 text-[11px] leading-snug text-sdbr-disabled">
                                        {t("settings.languageDesc")}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3.5 grid grid-cols-2 gap-2">
                                {(["tr", "en"] as const).map((lng) => {
                                    const active = i18n.language?.startsWith(lng);
                                    return (
                                        <button
                                            key={lng}
                                            type="button"
                                            onClick={() => void i18n.changeLanguage(lng)}
                                            className={cn(
                                                "rounded-xl border px-3 py-2.5 text-[12px] font-semibold transition-all duration-200",
                                                active
                                                    ? "border-transparent bg-primary/[0.07] text-primary"
                                                    : "border-window-b bg-dl/50 text-foreground/80 hover:bg-window-b/40",
                                            )}
                                        >
                                            {lng === "tr" ? "Türkçe" : "English"}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="px-4 py-4 sm:px-5">
                            <div className="flex items-center gap-3">
                                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-window-b/55 text-foreground/65">
                                    <Sun className="size-4" strokeWidth={1.9} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-semibold tracking-[-0.01em]">{t("settings.theme")}</p>
                                    <p className="mt-0.5 text-[11px] leading-snug text-sdbr-disabled">
                                        {t("settings.themeDesc")}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3.5 grid grid-cols-3 gap-2">
                                {THEME_OPTIONS.map((opt) => {
                                    const active = (settings?.theme || "system") === opt.value;
                                    const OptIcon = opt.icon;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => void persist({ theme: opt.value })}
                                            className={cn(
                                                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-semibold transition-all duration-200",
                                                active
                                                    ? "border-transparent bg-primary/[0.07] text-primary"
                                                    : "border-window-b bg-dl/50 text-foreground/80 hover:bg-window-b/40",
                                            )}
                                        >
                                            <OptIcon className="size-3.5" strokeWidth={2} />
                                            {t(opt.labelKey)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-window-b/55 text-foreground/65">
                                <Power className="size-4" strokeWidth={1.9} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold tracking-[-0.01em]">{t("settings.startWithWindows")}</p>
                                <p className="mt-0.5 text-[11px] leading-snug text-sdbr-disabled">
                                    {t("settings.startWithWindowsDesc")}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={settings?.startWithWindows ?? false}
                                onClick={() => void persist({ startWithWindows: !(settings?.startWithWindows ?? false) })}
                                className={cn(
                                    "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                                    settings?.startWithWindows ? "bg-primary" : "bg-foreground/15",
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200",
                                        settings?.startWithWindows ? "left-[22px]" : "left-0.5",
                                    )}
                                />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-window-b/55 text-foreground/65">
                                <Zap className="size-4" strokeWidth={1.9} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold tracking-[-0.01em]">{t("settings.prewarmOverlay")}</p>
                                <p className="mt-0.5 text-[11px] leading-snug text-sdbr-disabled">
                                    {t("settings.prewarmOverlayDesc")}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={settings?.prewarmOverlay ?? false}
                                onClick={() => void persist({ prewarmOverlay: !(settings?.prewarmOverlay ?? false) })}
                                className={cn(
                                    "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                                    settings?.prewarmOverlay ? "bg-primary" : "bg-foreground/15",
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200",
                                        settings?.prewarmOverlay ? "left-[22px]" : "left-0.5",
                                    )}
                                />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-window-b/55 text-foreground/65">
                                <ArrowUpCircle className="size-4" strokeWidth={1.9} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold tracking-[-0.01em]">{t("settings.updates")}</p>
                                <p className="mt-0.5 text-[11px] leading-snug text-sdbr-disabled">
                                    {update?.updateAvailable
                                        ? t("settings.updateAvailable", { version: update.latest })
                                        : update?.latest
                                            ? t("settings.upToDate", { version: update.latest })
                                            : update?.error
                                                ? update.error
                                                : version
                                                    ? t("settings.currentVersion", { version })
                                                    : "…"}
                                </p>
                            </div>
                            {installing !== null ? (
                                <span className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-window-b/60 px-3.5 text-[11.5px] font-medium text-foreground/80">
                                    <RefreshCw className="size-3.5 animate-spin" />
                                    %{installing}
                                </span>
                            ) : update?.updateAvailable ? (
                                <button
                                    type="button"
                                    onClick={() => void installUpdate()}
                                    className="h-8 shrink-0 rounded-lg bg-primary px-3.5 text-[11.5px] font-medium text-white transition-colors hover:bg-primary/90"
                                >
                                    {t("settings.updateInstall")}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void checkUpdate()}
                                    disabled={checking}
                                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[11.5px] font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                                >
                                    <RefreshCw className={cn("size-3.5", checking && "animate-spin")} />
                                    {checking ? t("settings.updateChecking") : t("settings.updateCheck")}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
