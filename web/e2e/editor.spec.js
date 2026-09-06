import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openProject(page) {
  const needs = await page.request.get("/api/auth/needs-setup");
  if ((await needs.json()).needsSetup)
    await page.request.post("/api/auth/setup", { data: { name: "tester", password: "test-password" } });
  await page.request.post("/api/auth/login", { data: { name: "tester", password: "test-password" } });
  const project = await (await page.request.post("/api/projects", { data: { title: "Browser check" } })).json();
  const create = async (title, body) => (await page.request.post(`/api/projects/${project.slug}/nodes`, {
    data: { pillar: "gameloop", title, body },
  })).json();
  const first = await create("Erste Idee", "Erster Entwurf");
  const second = await create("Zweite Idee", "Zweiter Entwurf");
  await page.addInitScript(({ slug, id }) => {
    localStorage.setItem("gs_lang", "de");
    localStorage.setItem("gs_route", JSON.stringify({ name: "project", slug }));
    localStorage.setItem(`gs_sel_${slug}`, id);
  }, { slug: project.slug, id: first.id });
  await page.goto("/");
  await expect(page.locator("main input:not([type=file])")).toHaveValue(first.title);
  return { slug: project.slug, first, second };
}

test("autosave keeps rapid title/body changes and saves when switching nodes", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { slug, first, second } = await openProject(page);
  await page.locator("main input:not([type=file])").fill("Neuer Titel");
  await page.locator("main textarea").fill("Neuer Text");
  await page.locator(".tree-row").filter({ hasText: second.title }).click();
  await expect(page.locator("main input:not([type=file])")).toHaveValue(second.title);
  await expect.poll(async () => {
    const p = await (await page.request.get(`/api/projects/${slug}`)).json();
    const n = p.nodes.find((node) => node.id === first.id);
    return { title: n.title, body: n.body };
  }).toEqual({ title: "Neuer Titel", body: "Neuer Text" });
  await expect(page.locator("main textarea")).toHaveValue(second.body);
  await page.reload();
  await expect(page.locator("main input:not([type=file])")).toHaveValue("Neuer Titel");
  await expect(page.locator("main textarea")).toHaveValue("Neuer Text");
  expect(errors).toEqual([]);
});

test("failed autosave shows an error and retry retains both edited fields", async ({ page }) => {
  const { slug, first } = await openProject(page);
  let fail = true;
  await page.route(`**/api/projects/${slug}/nodes/${first.id}`, (route) => {
    if (route.request().method() === "PATCH" && fail)
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Test: Speichern nicht erreichbar" }) });
    return route.continue();
  });
  await page.locator("main input:not([type=file])").fill("Titel nach Fehler");
  await page.locator("main textarea").fill("Text nach Fehler");
  await expect(page.getByRole("alert")).toContainText("Test: Speichern nicht erreichbar");
  fail = false;
  await page.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(page.getByText("✓ gespeichert", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("main input:not([type=file])")).toHaveValue("Titel nach Fehler");
  await expect(page.locator("main textarea")).toHaveValue("Text nach Fehler");
});

test("history restore refreshes the editor and the revision list", async ({ page }) => {
  await openProject(page);
  await page.locator("main input:not([type=file])").fill("Überarbeitete Idee");
  await page.locator("main textarea").fill("Überarbeiteter Text");
  await page.getByRole("button", { name: "Verlauf", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "↺ Wiederherstellen", exact: true }).last().click();
  await expect(page.getByText('node: restore "Überarbeitete Idee"', { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(page.locator("main input:not([type=file])")).toHaveValue("Erste Idee");
  await expect(page.locator("main textarea")).toHaveValue("Erster Entwurf");
});

test("maximize uses the full editor width and Escape restores the tree", async ({ page }) => {
  await openProject(page);
  const before = await page.locator("main").boundingBox();
  await page.getByTitle("Maximieren (volle Breite)").click();
  await expect(page.locator("aside")).toBeHidden();
  const after = await page.locator("main").boundingBox();
  expect(after.width).toBeGreaterThan(before.width + 300);
  await page.keyboard.press("Escape");
  await expect(page.locator("aside")).toBeVisible();
  await page.getByTitle("Maximieren (volle Breite)").click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "🗑 Löschen", exact: true }).click();
  await expect(page.locator("aside")).toBeVisible();
});

test("nested ideas display their saved order", async ({ page }) => {
  const { slug, first } = await openProject(page);
  for (const [title, order] of [["Kind A", 20], ["Kind B", 10]]) {
    await page.request.post(`/api/projects/${slug}/nodes`, {
      data: { pillar: first.pillar, parent: first.id, title, order },
    });
  }
  await page.reload();
  await expect(page.locator(".tree-row").filter({ hasText: /Kind [AB]/ })).toHaveText([/Kind B/, /Kind A/]);
});

test("login, project creation, Markdown preview and attachment upload work through the UI", async ({ page }) => {
  const needs = await (await page.request.get("/api/auth/needs-setup")).json();
  if (needs.needsSetup)
    await page.request.post("/api/auth/setup", { data: { name: "tester", password: "test-password" } });
  await page.goto("/");
  await page.getByPlaceholder("Name", { exact: true }).fill("tester");
  await page.getByPlaceholder("Passwort", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Rein", exact: true }).click();
  await page.getByPlaceholder("Neues Projekt benennen…").fill("UI Projekt");
  await page.getByRole("button", { name: "＋ Neues Projekt", exact: true }).click();
  await page.getByTitle("Idee zu „Gameloop“").click();
  await expect(page.locator("main input:not([type=file])")).toBeVisible();
  await page.locator("main textarea").fill("# Spielidee\n\n**Fett** und normal.");
  await page.getByRole("button", { name: "Vorschau", exact: true }).click();
  await expect(page.locator("main .md h1")).toHaveText("Spielidee");
  await expect(page.locator("main .md strong")).toHaveText("Fett");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(["Skizzenreferenz"], "referenz.txt", { type: "text/plain" }));
    return data;
  });
  await page.getByText("📎 Dateien hierher ziehen — Skizzen, Refs, was auch immer", { exact: true })
    .dispatchEvent("drop", { dataTransfer: transfer });
  const attachment = page.getByRole("link", { name: /referenz\.txt/ });
  await expect(attachment).toBeVisible();
  expect(await (await page.request.get(await attachment.getAttribute("href"))).text()).toBe("Skizzenreferenz");
});

test("canvas loads, draws, persists and exports text without external requests", async ({ page }, testInfo) => {
  const { slug, first } = await openProject(page);
  const errors = [];
  const external = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1") {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  const canvas = page.locator(".excalidraw__canvas.interactive");
  await expect(canvas).toBeVisible();
  await page.locator("label").filter({ has: page.getByRole("radio", { name: "Rectangle", exact: true }) }).click();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 350, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 530, box.y + 300, { steps: 5 });
  await page.mouse.up();
  await page.locator("label").filter({ has: page.getByRole("radio", { name: "Text", exact: true }) }).click();
  await page.mouse.click(box.x + 600, box.y + 350);
  await page.locator("textarea.excalidraw-wysiwyg").fill("Offline Skizze");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect.poll(async () => {
    const scene = await (await page.request.get(`/api/projects/${slug}/canvases/${first.id}`)).json();
    return scene.elements.filter((element) => !element.isDeleted).length;
  }).toBe(2);
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: "Gesamtdokument", exact: true }).click();
  await expect(page.locator(".reader-node svg")).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "HTML mit Bildern", exact: true }).click();
  const download = await downloading, path = testInfo.outputPath("drawing.html"); await download.saveAs(path);
  const html = await readFile(path, "utf8");
  expect(html).toContain("<svg"); expect(html).toContain("Offline Skizze");
  await page.screenshot({ path: testInfo.outputPath("document.png"), fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
