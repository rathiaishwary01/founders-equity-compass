import { defineConfig, type PluginOption } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command }) => {
  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
    react(),
  ];

  if (command === "build") {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    // Cloudflare adapter must be inserted before TanStack Start for SSR builds
    plugins.splice(2, 0, cloudflare({ viteEnvironment: { name: "ssr" } }));
  }

  return {
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins,
  };
});
