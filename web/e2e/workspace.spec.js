import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const titleInput = (page) => page.locator("main input:not([type=file])");
async function setup(page) {
  if ((await (await page.request.get("/api/auth/needs-setup")).json()).needsSetup)
    await page.request.post("/api/auth/setup", { data: { name: "tester", password: "test-password" } });
  await page.request.post("/api/auth/login", { data: { name: "tester", password: "test-password" } });
  const p = await (await page.request.post("/api/projects", { data: { title: `Workspace ${Date.now()}` } })).json();
  const create = async (input) => (await page.request.post(`/api/projects/${p.slug}/nodes`, { data: { pillar: "gameloop", ...input } })).json();
  const first = await create({ title: "Ausweichrolle", body: "25 Ausdauer pro Einsatz", progress: "needs_work" });
  const second = await create({ title: "Waldwächter", body: "Langsamer Gegner", progress: "complete", status: "side" });
  await page.addInitScript(() => localStorage.setItem("gs_lang", "de"));
  await page.goto("/");
  await page.evaluate(({ slug, id }) => { localStorage.setItem("gs_route", JSON.stringify({ name: "project", slug })); localStorage.setItem(`gs_sel_${slug}`, id); }, { slug: p.slug, id: first.id });
  await page.reload();
  await expect(titleInput(page)).toHaveValue(first.title);
  return { ...p, first, second, create };
}

test("search, progress filters, link completion and backlinks work together", async ({ page }) => {
  const p = await setup(page);
  await page.keyboard.press("Control+k");
  const search = page.getByRole("searchbox", { name: "Ideen durchsuchen …" });
  await expect(search).toBeFocused();
  await search.fill("Ausdauer");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Jeder Fortschritt" }).selectOption("complete");
  await expect(page.getByText("Keine passenden Ideen.")).toBeVisible();
  await search.press("Escape");
  await page.locator("main textarea").fill("Siehe [[Wald");
  await page.getByRole("option", { name: "Waldwächter" }).click();
  await expect(page.locator("main textarea")).toHaveValue(`Siehe [[${p.second.id}]]`);
  await page.getByRole("button", { name: "Vorschau", exact: true }).click();
  await page.locator("main .node-link").click();
  await expect(titleInput(page)).toHaveValue(p.second.title);
  await page.getByRole("button", { name: "Ausweichrolle", exact: true }).click();
  await expect(titleInput(page)).toHaveValue(p.first.title);
});

test("trash restores descendants and undo returns the entire deletion", async ({ page }) => {
  const p = await setup(page), child = await p.create({ title: "Unteridee", parent: p.first.id });
  await page.reload();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "🗑 Löschen", exact: true }).click();
  await expect(page.locator(".tree-row").filter({ hasText: child.title })).toHaveCount(0);
  await page.locator(".notice").getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator(".tree-row").filter({ hasText: child.title })).toBeVisible();
  await page.getByRole("button", { name: "🗑 Löschen", exact: true }).click();
  await page.getByRole("button", { name: "Papierkorb", exact: true }).click();
  await expect(page.locator("main")).toContainText("2 Ideen");
  await page.locator("main").getByRole("button", { name: "Wiederherstellen", exact: true }).click();
  await expect(titleInput(page)).toHaveValue(p.first.title);
  await expect(page.locator(".tree-row").filter({ hasText: child.title })).toBeVisible();
  await page.getByRole("button", { name: "Aktionen", exact: true }).click();
  await expect(page.locator("main .action-card").first()).toContainText("Wiederhergestellt");
});

test("templates, duplicate, reordering and saved tree collapse", async ({ page }) => {
  const p = await setup(page);
  await page.getByRole("button", { name: "Idee aus Vorlage" }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: "Vorlage", exact: true }).selectOption("enemy");
  await page.getByRole("dialog").getByRole("combobox", { name: "Übergeordnete Idee", exact: true }).selectOption(p.first.id);
  await page.getByRole("dialog").getByRole("button", { name: "Erstellen", exact: true }).click();
  await expect(page.locator("main textarea")).toContainText("## Rolle im Spiel");
  await page.getByRole("button", { name: "Duplizieren", exact: true }).click();
  await expect(titleInput(page)).toHaveValue("Waldwächter (Kopie)");
  await page.getByTitle("Nach oben", { exact: true }).click();
  await expect(page.locator(".tree-row").filter({ hasText: "Waldwächter" })).toHaveText([/Kopie/, /Waldwächter/, /Waldwächter/]);
  await page.getByRole("button", { name: "Unterideen ein-/ausklappen" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Unterideen ein-/ausklappen" })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Verschieben", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Übergeordnete Idee", exact: true }).selectOption("");
  await dialog.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption("content");
  await dialog.getByRole("button", { name: "Verschieben", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const moved = (await (await page.request.get(`/api/projects/${p.slug}`)).json()).nodes.find((n) => n.title === "Waldwächter (Kopie)");
  expect(moved.parent).toBe(null); expect(moved.pillar).toBe("content");
});

test("project rename, archive, copy and backup import preserve project contents", async ({ page }, testInfo) => {
  const p = await setup(page);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Backup herunterladen", exact: true }).click();
  const backup = await downloadEvent, path = testInfo.outputPath("project.gamesketch"); await backup.saveAs(path);
  await page.getByRole("button", { name: "← Projekte", exact: true }).click();
  const card = page.locator(".project-card").filter({ hasText: p.title });
  await card.getByRole("button", { name: "Umbenennen", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Projektname").fill("Neuer Projektname");
  await page.getByRole("dialog").getByRole("button", { name: "Speichern", exact: true }).click();
  const renamed = page.locator(".project-card").filter({ hasText: "Neuer Projektname" });
  await renamed.getByRole("button", { name: "Archivieren", exact: true }).click();
  await expect(renamed).toHaveCount(0);
  await page.getByRole("button", { name: "Archiv", exact: true }).click();
  await expect(renamed).toBeVisible();
  await renamed.getByRole("button", { name: "Aus Archiv holen", exact: true }).click();
  await page.getByRole("button", { name: "Aktive Projekte", exact: true }).click();
  await renamed.getByRole("button", { name: "Duplizieren", exact: true }).click();
  await expect(page.locator(".project-card").filter({ hasText: "Neuer Projektname (Kopie)" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.locator(".project-header")).toContainText(p.title);
  const importedSlug = await page.evaluate(() => JSON.parse(localStorage.getItem("gs_route")).slug);
  expect(importedSlug).not.toBe(p.slug);
  const imported = await (await page.request.get(`/api/projects/${importedSlug}`)).json();
  expect(imported.nodes.map((n) => n.body).sort()).toEqual([p.first.body, p.second.body].sort());
});

test("document export embeds images and preserves navigable cross references", async ({ page }, testInfo) => {
  const p = await setup(page);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  await page.locator('main input[type="file"]').setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: png });
  await expect(page.locator("main .attachment-card img")).toBeVisible();
  await page.locator("main textarea").fill(`## Regeln\nSiehe [[${p.second.id}]]`);
  await page.getByRole("button", { name: "Gesamtdokument", exact: true }).click();
  await expect(page.locator(".reader-node")).toHaveCount(2);
  await expect(page.locator(".reader-node .node-link")).toHaveText(p.second.title);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "HTML mit Bildern", exact: true }).click();
  const download = await downloadEvent, path = testInfo.outputPath("document.html"); await download.saveAs(path);
  const html = await readFile(path, "utf8");
  expect(html).toContain("data:image/png;base64,");
  expect(html).toContain(`href="#node-${p.second.id}"`);
  expect(html).not.toContain(`/api/projects/${p.slug}/assets/`);
  await page.addInitScript(() => { window.print = () => { window.__printedDocument = { title: document.title, embeddedImages: document.querySelectorAll('img[src^="data:"]').length }; }; });
  await page.getByRole("button", { name: "Drucken / PDF", exact: true }).click();
  await expect.poll(async () => {
    for (const frame of page.frames()) { const result = await frame.evaluate(() => window.__printedDocument); if (result) return result; }
    return null;
  }).toEqual({ title: p.title, embeddedImages: 1 });
  await page.getByRole("button", { name: "Ideen", exact: true }).click();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /^Anhang entfernen:/ }).click();
  await expect(page.locator("main .attachment-card")).toHaveCount(0);
  await page.locator(".notice").getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator("main .attachment-card img")).toBeVisible();
});

test("copilot previews all changes and one undo restores the response", async ({ page }) => {
  const p = await setup(page);
  await page.getByRole("button", { name: "Copilot", exact: true }).click();
  const chat = page.getByRole("region", { name: "Copilot", exact: true });
  await chat.locator("form input").fill("Überarbeite die Rolle");
  await chat.locator("form").getByRole("button").click();
  await expect(chat.getByText("Änderungsvorschau", { exact: true })).toBeVisible();
  let current = await (await page.request.get(`/api/projects/${p.slug}`)).json();
  expect(current.nodes).toHaveLength(2); expect(current.nodes.find((n) => n.id === p.first.id).body).toBe(p.first.body);
  await chat.locator("summary").first().click();
  await expect(chat.getByText(p.first.body, { exact: true })).toBeVisible();
  await chat.getByRole("button", { name: "Änderungen übernehmen", exact: true }).click();
  await expect(page.locator("main textarea")).toHaveValue("KI-Vorschlag: 25 Ausdauer pro Rolle.");
  await expect(page.locator(".tree-row").filter({ hasText: "Balance prüfen" })).toBeVisible();
  await chat.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator("main textarea")).toHaveValue(p.first.body);
  await expect(page.locator(".tree-row").filter({ hasText: "Balance prüfen" })).toHaveCount(0);
});

test("an in-flight chat response stays in its original project across navigation", async ({ page }) => {
  const p = await setup(page);
  await page.getByRole("button", { name: "Copilot", exact: true }).click();
  const chat = page.getByRole("region", { name: "Copilot", exact: true });
  await chat.locator("form input").fill("Langsame Antwort für Projekt A");
  await chat.locator("form").getByRole("button").click();
  await page.getByRole("button", { name: "← Projekte", exact: true }).click();
  await page.getByPlaceholder("Neues Projekt benennen…").fill("Projekt B Gespräch");
  await page.getByRole("button", { name: "＋ Neues Projekt", exact: true }).click();
  await expect(chat.getByText("Langsame Antwort für Projekt A", { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Object.entries(localStorage).some(([key, value]) => key.includes("gs_chat_v2") && value.includes("Vorschlag für: Langsame Antwort")))).toBe(true);
  await expect(chat.getByText("Änderungsvorschau", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "← Projekte", exact: true }).click();
  // With more test projects the target card may sit behind the floating chat.
  await chat.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.locator(".project-card").filter({ hasText: p.title }).locator(":scope > button").click();
  await page.getByRole("button", { name: "Copilot", exact: true }).click();
  await expect(chat.getByText("Änderungsvorschau", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Copilot", exact: true }).click();
  await expect(chat.getByText("Änderungsvorschau", { exact: true })).toBeVisible();
});

test("a failed save blocks navigation and a local draft survives reloading", async ({ page }) => {
  const p = await setup(page);
  await page.route(`**/api/projects/${p.slug}/nodes/${p.first.id}`, (route) => route.request().method() === "PATCH" ? route.fulfill({ status: 503, json: { error: "Offline-Test" } }) : route.continue());
  await page.locator("main textarea").fill("Mein ungespeicherter Entwurf");
  await page.locator(".tree-row").filter({ hasText: p.second.title }).click();
  await expect(titleInput(page)).toHaveValue(p.first.title);
  page.on("dialog", (d) => d.accept());
  await page.reload();
  await expect(page.getByText("Ein ungespeicherter lokaler Entwurf ist vorhanden.")).toBeVisible();
  await page.unroute(`**/api/projects/${p.slug}/nodes/${p.first.id}`);
  await page.getByRole("button", { name: "Entwurf laden", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByText("✓ gespeichert", { exact: true })).toBeVisible();
  await expect(page.locator("main textarea")).toHaveValue("Mein ungespeicherter Entwurf");
});

test("copilot rejects stale changes and the assist tab also requires review", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Copilot", exact: true }).click();
  const chat = page.getByRole("region", { name: "Copilot" });
  await chat.locator("form input").fill("Entwirf eine Änderung");
  await chat.locator("form").getByRole("button").click();
  await expect(chat.getByText("Änderungsvorschau", { exact: true })).toBeVisible();
  await page.locator("main textarea").fill("Neuere eigene Änderung");
  await chat.getByRole("button", { name: "Änderungen übernehmen", exact: true }).click();
  await expect(chat.getByRole("alert")).toContainText("inzwischen geändert");
  await expect(page.locator("main textarea")).toHaveValue("Neuere eigene Änderung");
  await chat.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Assist", exact: true }).click();
  await page.getByRole("button", { name: /Lücken/ }).click();
  await expect(page.getByText("Ausdauerkosten fehlen.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Fix it/ }).click();
  await expect(page.locator("main .proposal-card")).toBeVisible();
  await page.locator("main").getByRole("button", { name: "Änderungen übernehmen", exact: true }).click();
  await expect(page.locator("main").getByText("Änderungen übernommen", { exact: true })).toBeVisible();
});

test("example content and small-screen layout remain usable", async ({ page }, testInfo) => {
  await setup(page);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "← Projekte", exact: true }).click();
  await page.getByRole("button", { name: "Beispielprojekt öffnen", exact: true }).click();
  await expect(page.locator("main textarea")).toContainText("## Abnahme");
  await page.screenshot({ path: testInfo.outputPath("desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Copilot", exact: true }).click();
  const chat = await page.locator(".chat-widget").boundingBox();
  expect(chat.x).toBeGreaterThanOrEqual(0); expect(chat.x + chat.width).toBeLessThanOrEqual(390);
  expect(chat.y + chat.height).toBeLessThanOrEqual(844);
  await page.locator(".chat-widget").getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Idee aus Vorlage", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("mobile-dialog.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("successful text saves stay visible if the following project refresh fails", async ({ page }) => {
  const p = await setup(page);
  let unavailable = true;
  await page.route(`**/api/projects/${p.slug}`, (route) => unavailable && route.request().method() === "GET"
    ? route.fulfill({ status: 503, json: { error: "Refresh unavailable" } }) : route.continue());
  await titleInput(page).fill("Saved title despite refresh failure");
  await page.locator("main textarea").fill("Saved body despite refresh failure");
  await expect(page.getByRole("alert")).toContainText("Refresh unavailable");
  await expect(page.getByText("✓ gespeichert", { exact: true })).toBeVisible();
  await expect(titleInput(page)).toHaveValue("Saved title despite refresh failure");
  await expect(page.locator("main textarea")).toHaveValue("Saved body despite refresh failure");
  unavailable = false;
  await page.getByRole("button", { name: "Erneut versuchen", exact: true }).click();
  await expect(page.locator(".tree-row").filter({ hasText: "Saved title despite refresh failure" })).toBeVisible();
  await page.reload();
  await expect(page.locator("main textarea")).toHaveValue("Saved body despite refresh failure");
});
