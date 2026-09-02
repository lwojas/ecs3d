import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { editorApiPlugin } from "./server/devApiPlugin.js";

// No custom `server.fs.allow` here on purpose -- the editor no longer
// imports anything from outside its own project root (maps, entities and
// templates are all read/written as JSON through editorApiPlugin, never
// imported as JS modules), so Vite's default allowlist (the project
// root only) is exactly right. Widening it previously let a crafted
// request path escape the project root entirely -- see devApiPlugin.js's
// comment on dataDirs for why file access stays scoped that way instead.
export default defineConfig({
  plugins: [react(), editorApiPlugin()],
  server: {
    port: 5183,
  },
});
