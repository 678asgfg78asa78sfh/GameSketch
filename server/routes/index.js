import authRoutes from "./auth.routes.js";
import projectRoutes from "./projects.routes.js";
import nodeRoutes from "./nodes.routes.js";
import assetRoutes from "./assets.routes.js";
import canvasRoutes from "./canvas.routes.js";
import aiRoutes from "./ai.routes.js";

export async function registerRoutes(app) {
  await app.register(authRoutes);
  await app.register(projectRoutes);
  await app.register(nodeRoutes);
  await app.register(assetRoutes);
  await app.register(canvasRoutes);
  await app.register(aiRoutes);
}
