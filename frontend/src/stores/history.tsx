import { create } from "zustand";
import { ListHistory, ReadHistoryThumb, ReadHistoryImage, ReCopyHistoryImage, DeleteHistoryImage } from "@wails/wareon/services/screenshotservice";
import type { HistoryItem } from "@wails/wareon/services/models";

type HistoryState = {
    items: HistoryItem[] | null;
    thumbs: Record<string, string>;
    loading: boolean;
    fetchHistory: () => Promise<void>;
    fetchThumb: (item: HistoryItem) => Promise<void>;
    copyItem: (path: string) => Promise<void>;
    removeItem: (path: string) => Promise<void>;
    clearAll: () => Promise<void>;
    openImage: (path: string) => Promise<string>;
};

export const useHistoryStore = create<HistoryState>((set, get) => ({
    items: null,
    thumbs: {},
    loading: false,

    fetchHistory: async () => {
        set({ loading: true });
        try {
            const items = (await ListHistory()) ?? [];
            set({ items, loading: false });
            for (const it of items.slice(0, 60)) void get().fetchThumb(it);
        } catch (e) {
            console.error("ListHistory failed:", e);
            set({ loading: false });
        }
    },

    fetchThumb: async (item) => {
        const { thumbs } = get();
        if (thumbs[item.path]) return;
        try {
            const url = await ReadHistoryThumb(item.path);
            set((s) => ({ thumbs: { ...s.thumbs, [item.path]: url } }));
        } catch (e) {
            console.error("ReadHistoryThumb failed:", e);
        }
    },

    copyItem: async (path) => {
        await ReCopyHistoryImage(path);
    },

    removeItem: async (path) => {
        await DeleteHistoryImage(path);
        set((s) => ({
            items: (s.items ?? []).filter((i) => i.path !== path),
            thumbs: Object.fromEntries(Object.entries(s.thumbs).filter(([k]) => k !== path)),
        }));
    },

    clearAll: async () => {
        const { items } = get();
        if (!items?.length) return;
        await Promise.all(items.map((i) => DeleteHistoryImage(i.path).catch(() => {})));
        set({ items: [], thumbs: {} });
    },

    openImage: async (path) => ReadHistoryImage(path),
}));
