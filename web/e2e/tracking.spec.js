import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function setup(page) {
  if ((await (await page.request.get("/api/auth/needs-setup")).json()).needsSetup)
    await page.request.post("/api/auth/setup", { data: { name: "tester", password: "test-password" } });
  await page.request.post("/api/auth/login", { data: { name: "tester", password: "test-password" } });
  const project = await (await page.request.post("/api/projects", { data: { title: `Tracker ${Date.now()}` } })).json();
  const create = async (data) => (await page.request.post(`/api/projects/${project.slug}/nodes`, { data: { pillar: "gameloop", ...data } })).json();
  const first = await create({ title: "Ausweichrolle", body: "## Spielregel\n25 Ausdauer pro Einsatz" });
  const second = await create({ title: "Spätere Idee", status: "future" });
  await page.addInitScript(({ slug, id }) => {
    localStorage.setItem("gs_lang", "de");
    localStorage.setItem("gs_route", JSON.stringify({ name: "project", slug }));
    if (!localStorage.getItem(`gs_sel_${slug}`)) localStorage.setItem(`gs_sel_${slug}`, id);
  }, { slug: project.slug, id: first.id });
  await page.goto("/");
  await expect(page.locator("main input").first()).toHaveValue(first.title);
  return { ...project, first, second, create };
}
const tracker = (page) => page.getByRole("region", { name: "Mini-Tracker" });
const overall = (page) => page.locator(".project-progress progress");
async function add(page, title, kind = "task") {
  await tracker(page).getByRole("textbox", { name: "Neuer Schritt …" }).fill(title);
  await tracker(page).getByRole("combobox", { name: "Art des Schritts" }).selectOption(kind);
  await tracker(page).getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(tracker(page).getByRole("checkbox", { name: title, exact: false })).toBeVisible();
}

test("preferred view saves edits, survives reload and supports optional tasks, milestones and manual completion", async ({ page }, testInfo) => {
  const p = await setup(page);
  await page.locator("main textarea").fill("Aktuell gespeicherte Spielregel");
  await page.getByRole("checkbox", { name: "Ansicht als Standard" }).check();
  await expect(page.locator("main h1")).toHaveText(p.first.title);
  await expect(page.locator("main textarea")).toHaveCount(0);
  await expect(page.locator("main .md")).toHaveText("Aktuell gespeicherte Spielregel");
  await tracker(page).getByRole("button", { name: "Fortschritt aktivieren" }).click();
  await add(page, "Ausdauerkosten festlegen");
  await add(page, "Playtest bestehen", "milestone");
  await tracker(page).getByRole("checkbox", { name: "Ausdauerkosten festlegen" }).check();
  await expect(tracker(page).locator("progress")).toHaveAttribute("value", "50");
  await expect(overall(page)).toHaveAttribute("value", "50");
  await expect(page.locator(".project-progress")).toContainText("0 von 1 verfolgten Ideen fertig");
  await expect(page.locator(".tree-row").filter({ hasText: p.first.title }).locator("progress")).toHaveAttribute("value", "50");
  await page.screenshot({ path: testInfo.outputPath("tracker-view.png"), fullPage: true });
  await tracker(page).getByRole("button", { name: "✓ Abschließen", exact: true }).click();
  await expect(tracker(page).locator("progress")).toHaveAttribute("value", "100");
  await expect(tracker(page).getByRole("checkbox", { name: /Playtest bestehen/ })).not.toBeChecked();
  await expect(tracker(page).getByRole("checkbox", { name: /Playtest bestehen/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Ansicht als Standard" })).toBeChecked();
  await expect(page.locator("main h1")).toHaveText(p.first.title);
  await tracker(page).getByRole("button", { name: "Wieder öffnen", exact: true }).click();
  await expect(tracker(page).locator("progress")).toHaveAttribute("value", "50");
  await tracker(page).getByRole("checkbox", { name: /Playtest bestehen/ }).check();
  await expect(overall(page)).toHaveAttribute("value", "100");
  await add(page, "Neuer Balancing-Schritt");
  await expect(tracker(page).locator("progress")).toHaveAttribute("value", "67");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(tracker(page).getByRole("checkbox", { name: "Neuer Balancing-Schritt" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator(".project-grid").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const trackerBox = await tracker(page).boundingBox();
  expect(trackerBox.x + trackerBox.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("tracker-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await tracker(page).getByRole("button", { name: "Tracking ausblenden" }).click();
  await expect(overall(page)).toHaveCount(0);
  await tracker(page).getByRole("button", { name: "Fortschritt aktivieren" }).click();
  await expect(tracker(page).locator("progress")).toHaveAttribute("value", "67");
  await page.locator(".tree-row").filter({ hasText: p.second.title }).click();
  await expect(page.locator("main h1")).toHaveText(p.second.title);
  await page.getByRole("checkbox", { name: "Ansicht als Standard" }).uncheck();
  await expect(page.locator("main input").first()).toHaveValue(p.second.title);
});

test("continue creates a nested independent version, keeps the original and supports undo, exports and search", async ({ page }, testInfo) => {
  const p = await setup(page);
  await page.getByRole("checkbox", { name: "Ansicht als Standard" }).check();
  await tracker(page).getByRole("button", { name: "Fortschritt aktivieren" }).click();
  await add(page, "Freigabe", "milestone");
  await tracker(page).getByRole("button", { name: "✓ Abschließen", exact: true }).click();
  const original = (await (await page.request.get(`/api/projects/${p.slug}`)).json()).nodes.find((n) => n.id === p.first.id);
  await tracker(page).getByRole("button", { name: "Weiterentwickeln", exact: true }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Neue Version anlegen", exact: true }).click();
  await expect(page.locator("main h1")).toHaveText("Ausweichrolle · v2");
  await expect(tracker(page).getByRole("checkbox", { name: /Freigabe/ })).not.toBeChecked();
  await expect(tracker(page).locator("progress")).toHaveAttribute("value", "0");
  await expect(overall(page)).toHaveAttribute("value", "0");
  await expect(page.locator(".project-progress")).toContainText("0 von 1 verfolgten Ideen fertig");
  let nodes = (await (await page.request.get(`/api/projects/${p.slug}`)).json()).nodes;
  const v2 = nodes.find((n) => n.continued_from === p.first.id);
  expect(v2.parent).toBe(p.first.id); expect(v2.body).toBe(p.first.body);
  expect(nodes.find((n) => n.id === p.first.id)).toEqual(original);
  await expect(page.locator(".tree-row").filter({ hasText: "Ausweichrolle · v2" })).toBeVisible();
  await page.locator(".notice").getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator(".tree-row").filter({ hasText: "Ausweichrolle · v2" })).toHaveCount(0);
  await expect(overall(page)).toHaveAttribute("value", "100");
  await page.locator(".tree-row").filter({ hasText: p.first.title }).click();
  await tracker(page).getByRole("button", { name: "Weiterentwickeln", exact: true }).click();
  await page.getByRole("button", { name: "Neue Version anlegen", exact: true }).click();
  await expect(page.locator("main h1")).toHaveText("Ausweichrolle · v2");
  await expect(tracker(page).getByRole("checkbox")).toHaveCount(0);
  await add(page, "Controller prüfen");
  await page.getByRole("searchbox").fill("Controller");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.getByRole("searchbox").press("Escape");
  await page.getByRole("button", { name: "Gesamtdokument", exact: true }).click();
  await expect(page.locator(".tracking-summary")).toContainText([/Freigabe/, /Controller prüfen/]);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "HTML mit Bildern", exact: true }).click();
  const download = await downloadEvent, file = testInfo.outputPath("tracking.html"); await download.saveAs(file);
  const html = await readFile(file, "utf8");
  expect(html).toContain("Controller prüfen"); expect(html).toContain("Mini-Tracker: 0%");
  expect(html).toContain("Vorheriger Stand");
});

test("failed task requests keep input and actual percentages; rename and remove can be undone", async ({ page }) => {
  const p = await setup(page);
  await page.getByRole("checkbox", { name: "Ansicht als Standard" }).check();
  await tracker(page).getByRole("button", { name: "Fortschritt aktivieren" }).click();
  const url = `**/api/projects/${p.slug}/nodes/${p.first.id}/tracking`;
  await page.route(url, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary save failure" }) }));
  await tracker(page).getByRole("textbox", { name: "Neuer Schritt …" }).fill("Nicht verlieren");
  await tracker(page).getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Temporary save failure");
  await expect(tracker(page).getByRole("textbox", { name: "Neuer Schritt …" })).toHaveValue("Nicht verlieren");
  await expect(tracker(page).getByRole("checkbox")).toHaveCount(0);
  await page.unroute(url);
  await tracker(page).getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(tracker(page).getByRole("checkbox", { name: "Nicht verlieren" })).toBeVisible();
  await page.route(url, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Checkbox save failure" }) }));
  await tracker(page).getByRole("checkbox", { name: "Nicht verlieren" }).click();
  await expect(page.getByRole("alert")).toContainText("Checkbox save failure");
  await expect(tracker(page).getByRole("checkbox", { name: "Nicht verlieren" })).not.toBeChecked();
  await expect(tracker(page).locator("progress")).toHaveAttribute("value", "0");
  await page.unroute(url);
  await tracker(page).getByRole("button", { name: "Schritt umbenennen: Nicht verlieren" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("Umbenannt");
  await page.getByRole("dialog").getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(tracker(page).getByRole("checkbox", { name: "Umbenannt" })).toBeVisible();
  await tracker(page).getByRole("button", { name: "Schritt entfernen: Umbenannt" }).click();
  await expect(tracker(page).getByRole("checkbox")).toHaveCount(0);
  await page.locator(".notice").getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(tracker(page).getByRole("checkbox", { name: "Umbenannt" })).toBeVisible();
});

test("failed autosave keeps edit mode and the preferred view unchanged", async ({ page }) => {
  const p = await setup(page);
  const url = `**/api/projects/${p.slug}/nodes/${p.first.id}`;
  await page.route(url, (route) => route.request().method() === "PATCH"
    ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Save blocked" }) }) : route.continue());
  await page.locator("main textarea").fill("Dieser Entwurf bleibt erhalten");
  await page.getByRole("checkbox", { name: "Ansicht als Standard" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Save blocked");
  await expect(page.getByRole("checkbox", { name: "Ansicht als Standard" })).not.toBeChecked();
  await expect(page.locator("main textarea")).toHaveValue("Dieser Entwurf bleibt erhalten");
  expect(await page.evaluate(() => localStorage.getItem("gs_primary_view_tester"))).toBe(null);
  await page.unroute(url);
  await page.getByRole("checkbox", { name: "Ansicht als Standard" }).check();
  await expect(page.locator("main .md")).toHaveText("Dieser Entwurf bleibt erhalten");
});
