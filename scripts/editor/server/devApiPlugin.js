import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The editor's only persistence: plain JSON files on disk, read/written
// through a tiny Vite dev-server middleware instead of a real backend.
// Nothing here touches boot.js or the game's own .js data modules --
// those stay hand-authored and untouched; this plugin only serves
// scripts/data/maps and scripts/data/entities.
const dataDirs = {
  maps: path.resolve(__dirname, "../../data/maps"),
  entities: path.resolve(__dirname, "../../data/entities"),
  templates: path.resolve(__dirname, "../../data/templates"),
};

// Read-only passthrough so cell/sky textures can be previewed without
// duplicating the game's asset files into the editor project.
const assetsDir = path.resolve(__dirname, "../../../assets");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// Document names become filenames on disk -- keep them to a safe,
// unambiguous character set rather than trying to sanitize path
// traversal after the fact.
function isSafeName(name) {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

const CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function editorApiPlugin() {
  return {
    name: "editor-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const parts = url.pathname.split("/").filter(Boolean);

        if (req.method === "GET" && parts[0] === "game-assets") {
          const relPath = parts.slice(1).join("/");
          const filePath = path.resolve(assetsDir, relPath);
          if (!filePath.startsWith(assetsDir) || !fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          if (CONTENT_TYPES[ext]) res.setHeader("Content-Type", CONTENT_TYPES[ext]);
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        const docType = parts[1];
        if (parts[0] === "api" && dataDirs[docType]) {
          const dir = dataDirs[docType];
          const rawName = parts[2] ? decodeURIComponent(parts[2]) : null;

          if (req.method === "GET" && !rawName) {
            ensureDir(dir);
            const files = fs
              .readdirSync(dir)
              .filter((f) => f.endsWith(".json"))
              .map((f) => f.replace(/\.json$/, ""))
              .sort();
            sendJson(res, 200, files);
            return;
          }

          if (rawName && !isSafeName(rawName)) {
            sendJson(res, 400, { error: "Invalid document name" });
            return;
          }

          if (req.method === "GET" && rawName) {
            const filePath = path.join(dir, `${rawName}.json`);
            if (!fs.existsSync(filePath)) {
              sendJson(res, 404, { error: "Not found" });
              return;
            }
            sendJson(res, 200, JSON.parse(fs.readFileSync(filePath, "utf-8")));
            return;
          }

          if (req.method === "PUT" && rawName) {
            ensureDir(dir);
            const body = await readBody(req);
            const data = JSON.parse(body);
            const filePath = path.join(dir, `${rawName}.json`);
            fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
            sendJson(res, 200, { ok: true });
            return;
          }
        }

        next();
      });
    },
  };
}
