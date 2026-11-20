import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@wareon/sidebar";
import AppSidebar from "@layouts/Sidebar";
import { useUiStore } from "@stores/ui";
import { useEffect, type CSSProperties } from "react";
import { X, Minus } from "lucide-react";
import { Application, Window } from "@wailsio/runtime";

export default function App() {
    const { fetchTheme, initListener } = useUiStore();

    useEffect(() => {
        void fetchTheme();
        const unsub = initListener();
        return () => unsub();
    }, [fetchTheme, initListener]);
    return (
        <SidebarProvider className="bg-background rounded-2xl border border-window-b">
            <AppSidebar />
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
                <header className="flex h-16.5 max-h-16.25! shrink-0 items-center justify-end gap-1 border-b border-window-b bg-background px-3">
                    <div
                        className="min-w-0 flex-1 self-stretch"
                        style={{ "--wails-non-client-region": "caption" } as CSSProperties}
                    />
                    <button
                        onClick={() => void Window.Hide()}
                        className="grid size-8 place-items-center rounded-lg bg-transparent text-foreground/50 transition-all duration-300 hover:bg-minus-button/80 hover:text-foreground active:scale-95"
                    >
                        <Minus className="size-4.5" />
                    </button>
                    <button onClick={() => void Application.Quit()} className="grid size-8 place-items-center rounded-lg bg-transparent text-foreground/50 transition-all duration-300 hover:bg-close-button/80 hover:text-dl active:scale-95">
                        <X className="size-4.5" />
                    </button>
                </header>
                <Outlet />
            </main>
        </SidebarProvider>
    );
}
