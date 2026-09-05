import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

// Browser tests always use a fresh data directory, never the user's data/.
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-e2e-"));
process.env.NODE_ENV = "test";
// A deterministic local provider exercises the real proposal API without paid AI calls.
const provider = createServer(async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const system = input.messages?.[0]?.content || "", prompt = input.messages?.at(-1)?.content || "";
  const id = system.match(/id=([A-Za-z0-9_-]+)/)?.[1];
  const result = system.includes("List the gaps") || system.includes("Find concrete gaps")
    ? { gaps: ["Ausdauerkosten fehlen."] }
    : { reply: `Vorschlag für: ${prompt.slice(0, 90)}`, actions: id ? [{ type: "update_node", id, body: "KI-Vorschlag: 25 Ausdauer pro Rolle." }, { type: "create_node", pillar: "scope", title: "Balance prüfen", body: "Drei Rollen im Playtest prüfen." }] : [] };
  if (prompt.includes("Langsame Antwort")) await new Promise((resolve) => setTimeout(resolve, 1800));
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }));
});
await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
const { loadConfig, saveConfig } = await import("../server/config.js");
const config = loadConfig();
config.ai = { provider: "openai", openai: { baseUrl: `http://127.0.0.1:${provider.address().port}`, model: "test", apiKey: "" } };
saveConfig(config);
const { buildServer } = await import("../server/index.js");
const app = await buildServer();
await app.listen({ port: 4339, host: "127.0.0.1" });
