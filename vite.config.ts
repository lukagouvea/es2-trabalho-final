import { defineConfig, loadEnv } from "vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    root: "web",
    envDir: process.cwd(),
    build: { outDir: "../dist", emptyOutDir: true },
    server: {
      port: Number(env.FRONTEND_PORT || 5173),
      strictPort: true,
      proxy: { "/api": `http://127.0.0.1:${env.API_PORT || env.PORT || 3001}` },
    },
  };
});
