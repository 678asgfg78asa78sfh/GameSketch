import authRoutes from "./auth.routes.js";
import projectRoutes from "./projects.routes.js";
import nodeRoutes from "./nodes.routes.js";
import assetRoutes from "./assets.routes.js";
import canvasRoutes from "./canvas.routes.js";
import aiRoutes from "./ai.routes.js";
import settingsRoutes from "./settings.routes.js";
import chatRoutes from "./chat.routes.js";
import pairRoutes from "./pair.routes.js";
import categoryRoutes from "./categories.routes.js";
import templateRoutes from "./templates.routes.js";

export async function registerRoutes(app) {
  await app.register(authRoutes);
  await app.register(projectRoutes);
  await app.register(nodeRoutes);
  await app.register(assetRoutes);
  await app.register(canvasRoutes);
  await app.register(aiRoutes);
  await app.register(settingsRoutes);
  await app.register(chatRoutes);
  await app.register(pairRoutes);
  await app.register(categoryRoutes);
  await app.register(templateRoutes);
}
