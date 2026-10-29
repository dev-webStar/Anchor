import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// NITRO_PRESET picks the hosting target at build time:
//   node-server (default) · vercel · netlify · render-com · railway
export default defineConfig(({ mode }) => {
  // Make .env values available to server code as process.env.* (never to the browser).
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return {
    resolve: { tsconfigPaths: true },
    plugins: [tailwindcss(), tanstackStart(), nitro({ preset: process.env.NITRO_PRESET ?? "node-server" }), viteReact()],
  };
});
