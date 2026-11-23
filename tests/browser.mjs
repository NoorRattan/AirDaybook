import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const origin = process.env.AIRDAYBOOK_TEST_ORIGIN ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const timeout = 15000;
const errors = [];

function observe(page) {
  page.setDefaultTimeout(timeout);
  page.on("pageerror", (error) => errors.push(error.message));
}

async function accessibility(page, name) {
  await page.addScriptTag({ path: require.resolve("axe-core") });
  const failures = await page.evaluate(async () => (await window.axe.run({
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
  })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })));
  assert.deepEqual(failures, [], `${name} accessibility`);
}

const plannerLink = (page, text) => page.getByRole("navigation", { name: "Planning tools" }).getByRole("link", { name: text, exact: true });
const sceneButton = (page) => page.getByRole("button", { name: "Explore 3D", exact: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await context.newPage();
  observe(page);
  const home = await page.goto(origin);
  assert.match(home.headers()["content-security-policy"], /connect-src 'self'/);
  assert.equal(home.headers()["cross-origin-resource-policy"], "same-origin");
  const capability = await context.request.get(`${origin}/api/v1/revisions`);
  assert.equal(capability.status(), 200);
  assert.match(capability.headers()["cache-control"], /no-store/);
  const availability = await capability.json();
  assert.deepEqual(Object.keys(availability), ["available"]);
  assert.equal(typeof availability.available, "boolean");
  await page.getByRole("heading", { name: "No current reading" }).waitFor();
  const entry = page.getByRole("button", { name: "Enter a reading" });
  await entry.waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector(".reading-actions button")?.disabled);
  await accessibility(page, "Today");
  await entry.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Enter a reading" });
  await dialog.waitFor();
  assert(await page.evaluate(() => Boolean(document.activeElement.closest("dialog"))));
  await accessibility(page, "Open reading dialog");
  await page.keyboard.press("Escape");
  assert(await entry.evaluate((element) => element === document.activeElement));

  await page.getByRole("button", { name: "Try historical replay" }).click();
  await page.getByText(/Example from the archive/).waitFor();
  const invalidSource = {
    schemaVersion: 1, location: { scope: "station", label: "Test station" },
    observedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    source: { label: "Invalid test", url: "javascript:void(0)" },
    metric: { kind: "aqi", scale: "india_naqi", basis: "overall", value: 220, averagingMinutes: 60 },
  };
  await page.locator('input[type="file"]').setInputFiles({ name: "test.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(invalidSource)) });
  await page.getByRole("alert").getByText(/HTTPS source link/).waitFor();
  await page.getByText(/Example from the archive/).waitFor();
  await page.getByRole("link", { name: "Open My Plan" }).click();
  await page.getByRole("heading", { name: "What you can change" }).waitFor();
  await page.waitForFunction(() => document.querySelector('input[name="time"]')?.value === "15:00");
  await page.getByLabel("Current wait (min)").fill("15");
  await page.getByLabel("Revised wait (min)").fill("5");
  await page.getByRole("status").filter({ hasText: "10 min less outside" }).waitFor();
  await page.getByRole("button", { name: "Save plan", exact: true }).press("Enter");
  await page.getByText("Plan updated.").waitFor();
  await accessibility(page, "My Plan");

  await plannerLink(page, "Preferences").press("Enter");
  await page.waitForFunction(() => document.activeElement === document.querySelector("#preferences summary"));
  if (!availability.available) await page.getByText(/AI suggestions are unavailable/).waitFor();
  await page.getByRole("combobox", { name: "Air purifier available" }).selectOption("true");
  await page.getByRole("heading", { name: "Use the purifier in the room you spend time in" }).waitFor();
  await page.getByRole("combobox", { name: "Metro available" }).selectOption("true");
  await page.getByText("Compare Metro with your road trip", { exact: true }).waitFor();
  await page.getByRole("combobox", { name: "Activity can move indoors" }).selectOption("true");
  await page.getByText("Move a flexible activity indoors", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Fixed time").inputValue(), "15:00");
  await accessibility(page, "Open preferences");

  await plannerLink(page, "Travel").click();
  await page.getByRole("group", { name: "Current route" }).getByRole("combobox", { name: "Main mode" }).selectOption("road");
  await page.getByRole("group", { name: "Alternative route" }).getByRole("combobox", { name: "Main mode" }).selectOption("metro");
  await page.getByLabel(/one-way metro distance/i).fill("12");
  await page.getByRole("checkbox", { name: /average motorized road trip/ }).check();
  await page.getByRole("button", { name: "Save and compare" }).click();
  await page.getByText("0.29–0.39 kg", { exact: true }).waitFor();
  await page.getByRole("checkbox", { name: /average motorized road trip/ }).uncheck();
  await page.getByRole("button", { name: "Save and compare" }).click();
  await page.getByText(/select the average road baseline/).waitFor();
  assert.equal(await page.getByText("0.29–0.39 kg", { exact: true }).count(), 0);
  await accessibility(page, "Open route comparison");

  await plannerLink(page, "Group note").click();
  await page.getByRole("combobox", { name: "Note language" }).selectOption("hi");
  await page.getByRole("button", { name: "Copy note" }).click();
  await page.getByText("Community note copied.").waitFor();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(shared, /ऐतिहासिक रिकॉर्ड/);
  assert.doesNotMatch(shared, /School pickup|15:00/);
  await accessibility(page, "Open group note");
  await page.getByText("Available offline", { exact: true }).waitFor();
  await context.setOffline(true);
  await page.reload();
  await page.getByText("10 min less outside", { exact: true }).waitFor();
  await page.getByRole("combobox", { name: "Note language" }).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await sceneButton(page).click();
  await page.getByText(/illustration works offline/).waitFor();
  await page.getByRole("button", { name: "Street", exact: true }).press("Enter");
  assert.equal(await page.locator(".plate-window").getAttribute("data-view"), "street");
  await context.close();

  const graphics = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 950, height: 800 } });
  observe(graphics);
  await graphics.goto(origin);
  assert.equal(await graphics.locator("canvas").count(), 0);
  const frame = graphics.locator(".plate-window");
  const previousSize = await frame.boundingBox();
  await sceneButton(graphics).click();
  await graphics.locator(".plate-scene.is-ready canvas").waitFor();
  await graphics.getByRole("button", { name: "Resume scene motion" }).waitFor();
  assert.deepEqual(await frame.boundingBox(), previousSize);
  await graphics.getByRole("button", { name: "Skyline", exact: true }).press("Enter");
  assert.equal(await graphics.getByRole("button", { name: "Skyline", exact: true }).getAttribute("aria-pressed"), "true");
  await graphics.locator("canvas").dispatchEvent("webglcontextlost");
  await graphics.getByText(/Explore the illustration instead/).waitFor();
  assert.equal(await frame.getAttribute("data-view"), "sky");
  await graphics.getByRole("button", { name: "Show still", exact: true }).click();
  assert.equal(await graphics.locator("canvas").count(), 0);
  await graphics.close();

  const unsupported = await browser.newPage();
  observe(unsupported);
  await unsupported.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind === "webgl2" ? null : getContext.call(this, kind, ...args);
    };
  });
  await unsupported.goto(origin);
  await sceneButton(unsupported).click();
  await unsupported.getByText(/Explore the illustration instead/).waitFor();
  await unsupported.getByRole("button", { name: "Rooftop", exact: true }).waitFor();
  assert.equal(await unsupported.locator("canvas").count(), 0);
  await unsupported.close();

  const tabs = await browser.newContext({ viewport: { width: 320, height: 750 } });
  const journal = await tabs.newPage();
  const schedule = await tabs.newPage();
  observe(journal);
  observe(schedule);
  await Promise.all([journal.goto(origin), schedule.goto(`${origin}/plan`)]);
  await schedule.waitForFunction(() => !document.querySelector('input[name="commitment"]')?.disabled);
  await journal.getByRole("button", { name: "Try historical replay" }).click();
  await journal.getByRole("link", { name: "Open My Plan" }).click();
  await journal.getByText("Delhi · 382 AQI", { exact: true }).waitFor();

  await schedule.getByRole("textbox", { name: "Commitment", exact: true }).fill("Pickup");
  await schedule.getByLabel("Fixed time").fill("15:00");
  await schedule.getByRole("button", { name: "Save plan", exact: true }).click();
  await schedule.getByText("Plan updated.").waitFor();
  await schedule.getByRole("link", { name: "Today", exact: true }).click();
  await schedule.waitForURL(`${origin}/`);
  await schedule.reload();
  await schedule.getByText(/Example from the archive/).waitFor();
  await schedule.getByRole("link", { name: "Open My Plan" }).click();
  await schedule.getByText("Delhi · 382 AQI", { exact: true }).waitFor();
  assert.equal(await schedule.getByRole("textbox", { name: "Commitment", exact: true }).inputValue(), "Pickup");
  assert(await schedule.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await tabs.close();

  assert.deepEqual(errors, []);
  console.log("Browser checks passed for safe input, keyboard focus, opened-panel axe checks, local action updates, Metro estimates, Hindi clipboard, offline editing, shared-tab data and 3D fallbacks.");
} finally {
  await browser.close();
}
