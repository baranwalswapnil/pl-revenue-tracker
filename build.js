import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { build } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const revenueDir = path.join(__dirname, "Revenue");

console.log("Building Vite application for Vercel...");

try {
  await build({
    root: path.join(revenueDir, "app"),
    base: "/",
    build: {
      outDir: path.join(__dirname, "dist"),
      emptyOutDir: true,
    },
  });

  const revDist = path.join(revenueDir, "dist");
  if (!fs.existsSync(revDist)) {
    fs.cpSync(path.join(__dirname, "dist"), revDist, { recursive: true });
  }

  console.log("Vite build successfully completed and outputted to dist/!");
} catch (e) {
  console.error("Build failed:", e);
  process.exit(1);
}
