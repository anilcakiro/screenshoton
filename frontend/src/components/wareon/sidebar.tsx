"use client";

import * as React from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { create } from "zustand";
import { cn } from "cn";

type SidebarStoreState = {
    open: boolean;
    setOpen: (open: boolean) => void;
    toggleOpen: () => void;
    manualOpen: Record<string, boolean | undefined>;
    setManualOpen: (key: string, value: boolean | undefined) => void;
};

const useSidebarStore = create<SidebarStoreState>()((set) => ({
    open: true,
    setOpen: (open) => set({ open }),
    toggleOpen: () => set((s) => ({ open: !s.open })),
    manualOpen: {},
    setManualOpen: (key, value) =>
        set((s) => {
            const manualOpen = { ...s.manualOpen };
            if (value === undefined) delete manualOpen[key];
            else manualOpen[key] = value;
            return { manualOpen };
        }),
}));

function SidebarProvider({ children, defaultOpen = true, className }: { children: React.ReactNode; defaultOpen?: boolean; className?: string }) {
    const setOpen = useSidebarStore((s) => s.setOpen);

    React.useEffect(() => {
        setOpen(defaultOpen);
    }, [defaultOpen, setOpen]);

    return (
        <MotionConfig reducedMotion="never">
            <div className={cn("flex h-screen w-full overflow-hidden", className)}>{children}</div>
        </MotionConfig>
    );
}

function Sidebar({ className, children }: React.ComponentProps<"div">) {
    const open = useSidebarStore((s) => s.open);

    return (
        <div className={cn("relative flex h-full shrink-0", className)}>
            <motion.aside initial={false} animate={{ width: open ? 220 : 70 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="flex h-full flex-col overflow-hidden">
                {children}
            </motion.aside>
        </div>
    );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("flex shrink-0 items-center gap-3 border-b border-window-b p-5", className)} {...props} />;
}

function SidebarContent({ className, ...props }: React.ComponentProps<"nav">) {
    return <nav className={cn("flex-1 overflow-hidden p-3 border-r border-window-b", className)} {...props} />;
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("border-t border-r border-window-b p-5 bg-transparent", className)} {...props} />;
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
    return <ul className={cn("flex flex-col gap-1", className)} {...props} />;
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
    return <li className={cn("", className)} {...props} />;
}

const SidebarMenuButton = React.forwardRef<
    HTMLButtonElement,
    React.ComponentProps<"button"> & {
        icon?: React.ReactNode;
        label?: React.ReactNode;
        trailing?: React.ReactNode;
        isActive?: boolean;
    }
>(({ className, icon, label, trailing, isActive, ...props }, ref) => {
    const open = useSidebarStore((s) => s.open);

    return (
        <button
            ref={ref}
            type="button"
            data-active={isActive ? "true" : undefined}
            className={cn("flex p-3 w-full! items-center rounded-2xl px-3 text-sm transition-colors hover:bg-muted hover:text-foreground", isActive ? "bg-accent text-foreground" : "text-muted-foreground", className)}
            {...props}
        >
            {icon != null && (
                <motion.span animate={{ x: open ? 0 : 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="flex size-5 shrink-0 items-center justify-center">
                    {icon}
                </motion.span>
            )}

            <AnimatePresence initial={false} mode="popLayout">
                {open && label != null && (
                    <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.16 }} className="ml-3 whitespace-nowrap font-medium">
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>

            {open && trailing != null && <span className="ml-auto flex items-center">{trailing}</span>}
        </button>
    );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

export { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebarStore };
