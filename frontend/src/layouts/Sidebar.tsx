import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, PanelLeftOpen, PanelLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "cn";
import { Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebarStore, SidebarFooter } from "@wareon/sidebar";
import { useSidebarStore as useAppMenuStore } from "@stores/sidebar";

const MENU_LABEL_KEYS: Record<string, string> = {
    Dashboard: "nav.dashboard",
    Settings: "nav.settings",
    "Keyboard Shortcurts": "nav.keyboardShortcuts",
    Genel: "nav.general",
    Seçim: "nav.selection",
};

export default function AppSidebar() {
    const { t } = useTranslation();
    const tl = (label: string) => t(MENU_LABEL_KEYS[label] ?? label);
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const menu = useAppMenuStore((s) => s.menu);
    const sidebarOpen = useSidebarStore((s) => s.open);
    const manualOpen = useSidebarStore((s) => s.manualOpen);
    const setManualOpen = useSidebarStore((s) => s.setManualOpen);
    const toggleOpen = useSidebarStore((s) => s.toggleOpen);
    const menuRef = React.useRef<HTMLUListElement>(null);
    const activeRef = React.useRef<HTMLDivElement | null>(null);
    const [pill, setPill] = React.useState({ y: 0, h: 0, visible: false });
    const [swapping, setSwapping] = React.useState(false);

    const [drop, setDrop] = React.useState<{ id: string; top: number; left: number } | null>(null);
    const dropRef = React.useRef<HTMLDivElement | null>(null);
    const btnRefs = React.useRef(new Map<string, HTMLButtonElement>());

    const toggleDrop = (itemId: string) => {
        const el = btnRefs.current.get(itemId);
        if (!el) return;
        const r = el.getBoundingClientRect();
        setDrop((d) =>
            d?.id === itemId
                ? null
                : { id: itemId, top: Math.min(r.top, window.innerHeight - 220), left: r.right + 10 },
        );
    };

    React.useEffect(() => {
        setDrop(null);
    }, [pathname, sidebarOpen]);

    React.useEffect(() => {
        if (!drop) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (dropRef.current?.contains(t)) return;
            if (btnRefs.current.get(drop.id)?.contains(t)) return;
            setDrop(null);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setDrop(null);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [drop]);

    const isRouteActiveRow = (m: { href?: string; children?: Array<{ href?: string }> }) =>
        m.href === pathname || Boolean(m.children?.some((c) => c.href === pathname));
    const pillTargetId =
        menu.find(isRouteActiveRow)?.id ??
        menu.find(
            (m) =>
                Boolean(m.children?.length) &&
                sidebarOpen &&
                Boolean(manualOpen[m.id] ?? m.children?.some((c) => c.href === pathname)),
        )?.id ??
        null;
    const measure = React.useCallback(() => {
        const el = activeRef.current;
        const next = { y: el ? el.offsetTop : 0, h: el ? el.offsetHeight : 0, visible: Boolean(el) };
        setPill((p) => (p.visible === next.visible && p.y === next.y && p.h === next.h ? p : next));
    }, []);
    const closeOthers = (exceptId: string) => {
        let closed = false;
        menu.forEach((m) => {
            if (m.id === exceptId || !m.children?.length) return;
            if (manualOpen[m.id] ?? m.children.some((c) => c.href === pathname)) {
                setManualOpen(m.id, false);
                closed = true;
            }
        });
        return closed;
    };

    React.useEffect(() => {
        if (!sidebarOpen) return;
        menu.forEach((item) => {
            if (item.children?.some((c) => c.href === pathname)) {
                setManualOpen(item.id, undefined);
            }
        });
    }, [pathname, sidebarOpen, menu, setManualOpen]);
    React.useLayoutEffect(() => {
        measure();
        const ul = menuRef.current;
        if (!ul || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(measure);
        ro.observe(ul);
        return () => ro.disconnect();
    }, [measure, pathname, menu, manualOpen, sidebarOpen]);
    return (
        <Sidebar>
            <SidebarHeader className="font-bold">ScreenShotOn</SidebarHeader>
            <SidebarContent>
                <SidebarMenu ref={menuRef} className="relative">
                    <motion.span
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0 rounded-2xl bg-primary"
                        initial={false}
                        animate={{ y: pill.y, height: pill.h, opacity: pill.visible ? 1 : 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    />
                    {menu.map((item) => {
                        const Icon = item.icon;
                        const children = item.children ?? [];
                        const hasSub = children.length > 0;
                        const childActive = hasSub && children.some((c) => c.href === pathname);
                        const isActive = item.href === pathname || childActive;
                        const subOpen = sidebarOpen && (manualOpen[item.id] ?? childActive);
                        const isPillTarget = item.id === pillTargetId;

                        return (
                            <SidebarMenuItem key={item.id}>
                                <div ref={isPillTarget ? activeRef : undefined} className="relative">
                                    <SidebarMenuButton
                                        ref={(el) => {
                                            if (el) btnRefs.current.set(item.id, el);
                                            else btnRefs.current.delete(item.id);
                                        }}
                                        isActive={isActive}
                                        className={cn(
                                            "relative transition-all! duration-300! hover:bg-primary hover:text-sdbr-active! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60",
                                            isPillTarget && "text-sdbr-active",
                                            subOpen && !isPillTarget && "bg-primary text-white!",
                                            !isPillTarget && !subOpen && "text-sdbr-disabled",
                                        )}
                                        icon={<Icon />}
                                        label={tl(item.label)}
                                        onClick={
                                            hasSub
                                                ? () => {
                                                      if (!sidebarOpen) {
                                                          toggleDrop(item.id);
                                                          return;
                                                      }
                                                      if (subOpen) {
                                                          setSwapping(false);
                                                      } else {
                                                          setSwapping(closeOthers(item.id));
                                                      }
                                                      setManualOpen(item.id, !subOpen);
                                                  }
                                                : () => {
                                                      setSwapping(closeOthers(""));
                                                      item.href && navigate(item.href);
                                                  }
                                        }
                                        aria-expanded={hasSub ? (sidebarOpen ? subOpen : drop?.id === item.id) : undefined}
                                        trailing={hasSub ? <ChevronRight className={cn("size-4 transition-transform duration-300", subOpen && "rotate-90")} /> : undefined}
                                    />
                                </div>

                                {hasSub && (
                                    <AnimatePresence initial={false}>
                                        {subOpen && (
                                            <motion.div
                                                key="sub"
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{
                                                    height: "auto",
                                                    opacity: 1,
                                                    transition: {
                                                        duration: 0.28,
                                                        ease: [0.22, 1, 0.36, 1],
                                                        delay: swapping ? 0.3 : 0,
                                                        opacity: { duration: 0.2, delay: swapping ? 0.3 : 0 },
                                                    },
                                                }}
                                                exit={{
                                                    height: 0,
                                                    opacity: 0,
                                                    transition: {
                                                        duration: 0.2,
                                                        ease: [0.22, 1, 0.36, 1],
                                                        delay: swapping ? 0.3 : 0,
                                                        opacity: { duration: 0.08, delay: swapping ? 0.26 : 0 },
                                                    },
                                                }}
                                                className="overflow-hidden"
                                            >
                                                <SidebarMenu className="mb-3 ml-9 flex flex-col gap-0.5">
                                                    {children.map((sub, i) => {
                                                        const subActive = sub.href === pathname;
                                                        return (
                                                            <motion.li
                                                                key={sub.href}
                                                                className="relative"
                                                                initial={{ opacity: 0, y: 6 }}
                                                                animate={{
                                                                    opacity: 1,
                                                                    y: 0,
                                                                    transition: {
                                                                        duration: 0.24,
                                                                        delay: (swapping ? 0.32 : 0.02) + i * 0.035,
                                                                        ease: [0.22, 1, 0.36, 1],
                                                                    },
                                                                }}
                                                                exit={{ opacity: 0, transition: { duration: 0.08, delay: swapping ? 0.26 : 0 } }}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => sub.href && navigate(sub.href)}
                                                                    aria-current={subActive ? "page" : undefined}
                                                                    className="group relative flex w-full items-center rounded-lg px-3 py-2 text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60"
                                                                >
                                                                    <span
                                                                        className={cn(
                                                                            "truncate text-[13px] font-medium transition-all duration-300 group-hover:translate-x-0.5",
                                                                            subActive ? "text-primary" : "text-sdbr-disabled group-hover:text-foreground",
                                                                        )}
                                                                    >
                                                                        {tl(sub.label)}
                                                                    </span>
                                                                </button>
                                                            </motion.li>
                                                        );
                                                    })}
                                                </SidebarMenu>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                )}
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="flex items-center">
                <button type="button" onClick={toggleOpen} className="-right-3 top-17 z-10 grid place-items-center rounded-full text-foreground shadow-lg transition-colors">
                    <AnimatePresence mode="wait" initial={false}>
                        {sidebarOpen ? (
                            <motion.span key="open" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.01 }}>
                                <PanelLeft className="size-5" />
                            </motion.span>
                        ) : (
                            <motion.span key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.01 }}>
                                <PanelLeftOpen className="size-5" />
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </SidebarFooter>

            {drop &&
                createPortal(
                    (() => {
                        const parent = menu.find((m) => m.id === drop.id);
                        if (!parent?.children?.length) return null;
                        return (
                            <AnimatePresence>
                                <motion.div
                                    ref={dropRef}
                                    key="sidebar-drop"
                                    initial={{ opacity: 0, x: -8, scale: 0.97 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: -8, scale: 0.97 }}
                                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                    className="ml-0.5 fixed z-50 w-auto origin-left overflow-hidden rounded-l-none rounded-2xl border-l-0 border border-window-b bg-dl/85 p-1.5  backdrop-blur-xl"
                                    style={{ top: drop.top, left: drop.left }}
                                    role="menu"
                                >
                                    <div className="flex flex-col gap-1.5">
                                        {parent.children.map((sub) => {
                                            const subActive = sub.href === pathname;
                                            const SubIcon = sub.icon;
                                            return (
                                                <button
                                                    key={sub.href}
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                        setDrop(null);
                                                        sub.href && navigate(sub.href);
                                                    }}
                                                    className={cn(
                                                        "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150",
                                                        subActive ? "bg-primary/8" : "hover:bg-window-b/50",
                                                    )}
                                                >
                                                    {SubIcon ? (
                                                        <span
                                                            className={cn(
                                                                "grid size-7 shrink-0 place-items-center rounded-lg transition-colors duration-150",
                                                                subActive
                                                                    ? "bg-primary/15 text-primary"
                                                                    : "bg-window-b/50 text-sdbr-disabled group-hover:bg-primary/10 group-hover:text-primary",
                                                            )}
                                                        >
                                                            <SubIcon className="size-3.5" />
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className={cn(
                                                                "size-1.5 shrink-0 rounded-full transition-colors",
                                                                subActive ? "bg-primary" : "bg-sdbr-disabled/40 group-hover:bg-primary/60",
                                                            )}
                                                        />
                                                    )}
                                                    <span
                                                        className={cn(
                                                            "truncate text-[12.5px] font-medium transition-colors",
                                                            subActive ? "text-primary" : "text-foreground/80 group-hover:text-foreground",
                                                        )}
                                                    >
                                                        {tl(sub.label)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        );
                    })(),
                    document.body,
                )}

        </Sidebar>
    );
}
