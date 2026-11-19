import { GetTheme } from "@wails/wareon/services/themestate";
import { GetSettings } from "@wails/wareon/services/screenshotservice";
import { create } from "zustand";
import { Events } from "@wailsio/runtime";

type Theme = "light" | "dark";
export type ThemeMode = "system" | "light" | "dark";

type UiState = {
    theme: Theme;
    mode: ThemeMode;
    initialized: boolean;
    fetchTheme: () => Promise<void>;
    initListener: () => () => void;
    setTheme: (m: ThemeMode) => Promise<void>;
};

function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
}

async function resolveTheme(mode: ThemeMode, fallback: Theme): Promise<Theme> {
    if (mode !== "system") return mode;
    try {
        return ((await GetTheme()) as Theme) ?? fallback;
    } catch {
        return fallback;
    }
}

export const useUiStore = create<UiState>((set, get) => ({
    theme: "light",
    mode: "system",
    initialized: false,

    fetchTheme: async () => {
        if (get().initialized) return;
        const sys = ((await GetTheme()) as Theme) ?? "light";
        let mode: ThemeMode = "system";
        try {
            const st = await GetSettings();
            const raw = st?.theme;
            if (raw === "system" || raw === "light" || raw === "dark") mode = raw;
        } catch {}
        const theme = await resolveTheme(mode, sys);
        set({ theme, mode, initialized: true });
        applyTheme(theme);
    },
    initListener: () => {
        const unsubs = [
            Events.On("app:themeChanged", (event: any) => {
                const sys = event?.data?.theme as Theme | undefined;
                if (!sys) return;
                const mode = get().mode;
                const theme: Theme = mode === "system" ? sys : mode;
                set({ theme });
                applyTheme(theme);
            }),
            Events.On("app:settings-changed", (event: any) => {
                const raw = event?.data?.settings?.theme;
                if (raw !== "system" && raw !== "light" && raw !== "dark") return;
                const m: ThemeMode = raw;
                void resolveTheme(m, get().theme).then((theme) => {
                    set({ mode: m, theme });
                    applyTheme(theme);
                });
            }),
        ];
        return () => {
            for (const u of unsubs) (u as { (): void })?.();
        };
    },
    setTheme: async (m) => {
        const theme = await resolveTheme(m, get().theme);
        set({ mode: m, theme });
        applyTheme(theme);
    },
}));
