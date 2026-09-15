import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, "../../assets"),
  server: {
    port: 5183,
  },
});
