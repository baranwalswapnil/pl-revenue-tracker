import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const revenueDir = path.join(__dirname, "Revenue");

// Dynamically resolve vite build API
let viteBuild;
try {
  const vite = await import("vite");
  viteBuild = vite.build;
} catch {
  const vite = await import("./Revenue/node_modules/vite/dist/node/index.js");
  viteBuild = vite.build;
}

console.log("Building Vite application with JavaScript API...");

try {
  await viteBuild({
    root: path.join(revenueDir, "app"),
    base: "/",
    build: {
      outDir: path.join(__dirname, "dist"),
      emptyOutDir: true,
    },
  });

  // Also ensure Revenue/dist is populated
  const revDist = path.join(revenueDir, "dist");
  if (!fs.existsSync(revDist)) {
    fs.cpSync(path.join(__dirname, "dist"), revDist, { recursive: true });
  }

  console.log("Build successfully completed and outputted to dist/!");
} catch (e) {
  console.error("Build failed:", e);
  process.exit(1);
}
