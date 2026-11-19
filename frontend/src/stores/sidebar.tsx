import { create } from 'zustand'
import { Brush, LayoutDashboard } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const DEFAULT_MENU: SidebarMenuItem[] = [

    {
        id: 'home',
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: '/'
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: LayoutDashboard,
        children: [
            { id: "general", label: "Genel", href: "/settings" },
            { id: "selection", label: "Seçim", href: "/settings/selection" },
            { id: "keyboardShort", label: "Keyboard Shortcurts", href: "/settings/shortcuts" }
        ],
    },
]

export type SidebarMetaVariant = 'orange' | 'blue' | 'pink' | 'purple' | 'green' | 'gray'

export interface SidebarMeta {
    label: string
    variant: SidebarMetaVariant
}

export interface SidebarSubItem {
    id: string
    label: string
    icon?: LucideIcon,
    description?: string
    href?: string
    meta?: string
    metaVariant?: SidebarMetaVariant
}

export interface SidebarMenuItem {
    id: string
    label: string
    icon: LucideIcon
    description?: string
    children?: SidebarSubItem[]
    badge?: string
    href?: string
    meta?: SidebarMeta
    sectionStart?: boolean
}

export interface SidebarCatalogItem {
    label: string
    description: string
    icon: LucideIcon
    href: string
}



const DEFAULT_EDITOR: SidebarCatalogItem = {
    label: 'Tuval Düzenleyicisi',
    description: 'Görüntüyü aç & düzenle',
    icon: Brush,
    href: '/editor',
}

interface SidebarStore {
    menu: SidebarMenuItem[]
    editor: SidebarCatalogItem
    openItems: Record<string, boolean>
    toggleItem: (id: string) => void
    setItemOpen: (id: string, open: boolean) => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
    menu: DEFAULT_MENU,
    editor: DEFAULT_EDITOR,
    openItems: { galeri: true, araclar: false },
    toggleItem: (id) => set((s) => ({ openItems: { ...s.openItems, [id]: !s.openItems[id] } })),
    setItemOpen: (id, open) => set((s) => ({ openItems: { ...s.openItems, [id]: open } })),
}))
