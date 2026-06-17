import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { registerRoutes } from "./routes/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;

export async function buildServer() {
  const app = Fastify({ logger: false });

  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

  app.get("/api/health", async () => ({ ok: true }));

  await registerRoutes(app);

  // Serve built frontend in production; in dev, Vite serves the UI separately.
  const dist = join(__dirname, "..", "web", "dist");
  if (existsSync(dist)) {
    await app.register(fastifyStatic, {
      root: dist,
      cacheControl: false, // we set Cache-Control ourselves below (else static overrides it)
      setHeaders(res, p) {
        // Hashed assets are immutable -> cache hard. index.html must never be cached,
        // otherwise reloads keep serving an old bundle after an update.
        if (/[\\/]assets[\\/]/.test(p)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else res.setHeader("Cache-Control", "no-cache");
      },
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api")) return reply.code(404).send({ error: "not found" });
      reply.header("Cache-Control", "no-cache");
      return reply.sendFile("index.html"); // SPA fallback
    });
  }
  return app;
}

if (process.env.NODE_ENV !== "test") {
  buildServer()
    .then((app) => app.listen({ port: PORT, host: "127.0.0.1" }))
    .then(() => console.log(`GameSketch on http://127.0.0.1:${PORT}`))
    .catch((e) => { console.error(e); process.exit(1); });
}
