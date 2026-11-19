import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wails from "@wailsio/runtime/plugins/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
    base: "./",
    server: {
        host: "127.0.0.1",
        port: Number(process.env.WAILS_VITE_PORT) || 9245,
        strictPort: true,
    },
    plugins: [react(), tailwindcss(), wails("./bindings")],
    resolve: {
        alias: {
            "@wareon": path.resolve(import.meta.dirname, "./src/components/wareon"),
            "@layouts": path.resolve(import.meta.dirname, "./src/layouts"),
            "@stores": path.resolve(import.meta.dirname, "./src/stores"),
            "@pages": path.resolve(import.meta.dirname, "./src/pages"),
            "@i18n": path.resolve(import.meta.dirname, "./src/i18n"),
            "@assets": path.resolve(import.meta.dirname, "./src/assets"),
            "@wails": path.resolve(import.meta.dirname, "./bindings"),
        },
    },
});
