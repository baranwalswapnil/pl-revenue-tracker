import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const revenueDir = path.join(__dirname, "Revenue");

async function startDev() {
  console.log("Starting Vite dev server...");
  const server = await createServer({
    root: path.join(revenueDir, "app"),
    server: {
      port: 5173,
      host: "0.0.0.0",
    },
  });

  await server.listen();
  server.printUrls();
}

startDev().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
