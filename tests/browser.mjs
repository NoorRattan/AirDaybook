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
  const script = new URL("/__airdaybook-test/axe.js", origin).href;
  await page.route(script, (route) => route.fulfill({ path: require.resolve("axe-core"), contentType: "text/javascript" }));
  try {
    await page.addScriptTag({ url: script });
  } finally {
    await page.unroute(script);
  }
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
  assert.equal(home.headers()["cross-origin-opener-policy"], "same-origin");
  assert.equal(home.headers()["cross-origin-resource-policy"], "same-origin");
  assert.match(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content"), /script-src 'self' 'sha256-/);
  assert.equal(await page.evaluate(() => {
    const script = document.createElement("script");
    script.text = "window.airdaybookUnlistedScript = true;";
    document.head.append(script);
    return window.airdaybookUnlistedScript;
  }), undefined);
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
  await dialog.getByLabel("City or station name").fill("Test station");
  await dialog.getByLabel("Geographic scope").selectOption("station");
  await dialog.getByLabel("Source name").fill("Test source");
  const observedAt = new Date(Date.now() - 15 * 60_000).toISOString().slice(0, 16);
  await dialog.getByLabel("Observation time", { exact: true }).fill(observedAt);
  await dialog.getByLabel(/UTC offset/).fill("+00:00");
  await dialog.getByLabel("Reported value").fill("501");
  await dialog.getByRole("button", { name: "Save reading" }).click();
  await dialog.getByRole("alert").getByText("Indian AQI must be between 0 and 500.").waitFor();
  assert.equal(await dialog.getByLabel("Reported value").getAttribute("aria-invalid"), "true");
  await dialog.getByLabel("Reported value").fill("220");
  await dialog.getByRole("button", { name: "Save reading" }).click();
  await page.getByText("Reading added.").waitFor();
  const changeReading = page.getByRole("button", { name: "Change reading" });
  await changeReading.click();
  assert.equal(await dialog.getByLabel("Geographic scope").inputValue(), "station");
  assert.equal(await dialog.getByLabel("Observation time", { exact: true }).inputValue(), observedAt);
  assert.equal(await dialog.getByLabel(/UTC offset/).inputValue(), "+00:00");
  await dialog.getByLabel("Source name").fill("Unsaved source");
  await page.keyboard.press("Escape");
  assert(await changeReading.evaluate((element) => element === document.activeElement));
  await changeReading.click();
  assert.equal(await dialog.getByLabel("Source name").inputValue(), "Test source");
  await page.keyboard.press("Escape");

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
  for (const [label, walking] of [["Current route", "6"], ["Alternative route", "4"]]) {
    const leg = page.getByRole("group", { name: label });
    await leg.getByLabel("Walking (min)").fill(walking);
    await leg.getByLabel("All waiting (min)").fill("0");
  }
  await page.getByLabel(/one-way metro distance/i).fill("12");
  await page.getByRole("checkbox", { name: /average motorized road trip/ }).check();
  await page.getByRole("button", { name: "Save and compare" }).click();
  await page.getByText("0.29–0.39 kg", { exact: true }).waitFor();
  await page.getByText("The alternative means 2 min less walking and waiting outdoors.").waitFor();
  await page.getByRole("checkbox", { name: /average motorized road trip/ }).uncheck();
  await page.getByText(/You’re viewing saved results/).waitFor();
  await page.getByText("0.29–0.39 kg", { exact: true }).waitFor();
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
  await plannerLink(page, "Travel").click();
  assert.equal(await page.getByRole("group", { name: "Alternative route" }).getByRole("combobox", { name: "Main mode" }).inputValue(), "metro");
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
  await graphics.getByText(/dated city or station reading/).waitFor();
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
  await schedule.getByText("Delhi · 382 AQI", { exact: true }).waitFor();
  await journal.getByRole("link", { name: "Open My Plan" }).click();
  await journal.getByText("Delhi · 382 AQI", { exact: true }).waitFor();

  await schedule.getByRole("textbox", { name: "Commitment", exact: true }).fill("Pickup");
  await schedule.getByLabel("Fixed time").fill("15:00");
  await schedule.getByRole("button", { name: "Save plan", exact: true }).click();
  await schedule.getByText("Plan updated.").waitFor();
  await journal.locator(".plan-commitment").getByText("Pickup", { exact: true }).waitFor();
  await schedule.getByRole("link", { name: "Today", exact: true }).click();
  await schedule.waitForURL(`${origin}/`);
  await schedule.reload();
  await schedule.getByText(/Example from the archive/).waitFor();
  await schedule.getByRole("link", { name: "Open My Plan" }).click();
  await schedule.getByText("Delhi · 382 AQI", { exact: true }).waitFor();
  assert.equal(await schedule.getByRole("textbox", { name: "Commitment", exact: true }).inputValue(), "Pickup");
  await journal.getByRole("button", { name: "Clear saved data" }).click();
  await journal.getByRole("button", { name: "Clear reading and plan" }).click();
  await schedule.getByText("No reading selected", { exact: true }).waitFor();
  await schedule.waitForFunction(() => document.querySelector('input[name="commitment"]')?.value === "");
  assert(await schedule.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await tabs.close();

  const mockAi = await browser.newPage({ serviceWorkers: "block", forcedColors: "active" });
  observe(mockAi);
  let checks = 0;
  let submissions = 0;
  await mockAi.route("**/api/v1/revisions", async (route) => {
    if (route.request().method() === "GET") {
      if (++checks === 1) await route.fulfill({ status: 502, contentType: "text/html", body: "<p>Unavailable</p>" });
      else await route.fulfill({ json: { available: true } });
      return;
    }
    const { revisionId, ...submitted } = route.request().postDataJSON();
    assert.deepEqual(Object.keys(submitted).sort(), ["assistant", "preferences", "text"]);
    if (++submissions === 1) {
      await route.fulfill({ status: 429, headers: { "Retry-After": "120" }, contentType: "text/html", body: "<p>Rate limited</p>" });
    } else {
      await route.fulfill({ json: { revisionId, outcome: "apply", changes: { hasPurifier: true } } });
    }
  });
  await mockAi.goto(`${origin}/plan`);
  await mockAi.getByLabel("Commitment", { exact: true }).fill("Fixed pickup");
  await mockAi.getByLabel("Fixed time").fill("15:00");
  await mockAi.getByRole("button", { name: "Save plan" }).click();
  await plannerLink(mockAi, "Preferences").click();
  await mockAi.getByRole("button", { name: "Retry AI availability" }).click();
  const whatChanged = mockAi.getByRole("textbox", { name: "What changed?" });
  const suggest = mockAi.getByRole("button", { name: "Suggest preference changes" });
  await whatChanged.fill("a".repeat(501));
  await mockAi.getByText("501 / 500 characters").waitFor();
  assert(await suggest.isDisabled());
  await whatChanged.fill("We have an air purifier now.");
  await suggest.click();
  await mockAi.getByRole("status").getByText(/Try again in about 2 min/).waitFor();
  await suggest.click();
  await mockAi.getByRole("heading", { name: "Review the proposed changes" }).waitFor();
  await accessibility(mockAi, "AI proposal in forced colors");
  assert.equal(await mockAi.getByRole("combobox", { name: "Air purifier available" }).inputValue(), "null");
  await mockAi.getByRole("button", { name: "Apply changes" }).click();
  await mockAi.getByRole("heading", { name: "Use the purifier in the room you spend time in" }).waitFor();
  assert.equal(await mockAi.getByLabel("Fixed time").inputValue(), "15:00");
  await mockAi.close();

  const bilingual = await browser.newPage({ viewport: { width: 320, height: 750 }, serviceWorkers: "block", reducedMotion: "reduce" });
  observe(bilingual);
  await bilingual.route("**/api/v1/aqi?city=noida", (route) => route.fulfill({ json: {
    schemaVersion: 1, location: { label: "Noida", scope: "city" },
    source: { label: "CAMS global model via Open-Meteo", url: "https://open-meteo.com/en/docs/air-quality-api" },
    observedAt: new Date(Date.now() - 60_000).toISOString(),
    metric: { kind: "pm25", unit: "ug_m3", value: 82, averagingMinutes: null },
  } }));
  await bilingual.goto(origin);
  await bilingual.locator(".city-lookup > summary").click();
  await bilingual.locator(".city-lookup select[name=city]").selectOption("noida");
  await bilingual.getByRole("button", { name: "Load city estimate" }).click();
  await bilingual.getByText("City model estimate", { exact: true }).waitFor();
  await bilingual.getByRole("button", { name: "हिन्दी" }).click();
  await bilingual.getByRole("heading", { name: "हवा की गुणवत्ता और आपका दिन" }).waitFor();
  assert.equal(await bilingual.locator("html").getAttribute("lang"), "hi");
  await bilingual.reload();
  await bilingual.getByRole("heading", { name: "हवा की गुणवत्ता और आपका दिन" }).waitFor();
  await bilingual.getByText("शहर का मॉडल अनुमान", { exact: true }).waitFor();
  await bilingual.waitForFunction(() => document.querySelector(".reading-actions button")?.disabled === false);
  await accessibility(bilingual, "Hindi at 320 px");
  assert(await bilingual.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await bilingual.getByRole("button", { name: "English" }).click();
  await bilingual.getByRole("button", { name: "Try historical replay" }).click();
  await bilingual.getByRole("link", { name: "Open My Plan" }).click();
  await plannerLink(bilingual, "Daily routine").click();
  await bilingual.getByLabel("Activity", { exact: true }).fill("Evening walk");
  await bilingual.getByLabel("Start time").fill("18:00");
  await bilingual.getByLabel("Minutes", { exact: true }).fill("30");
  await bilingual.getByLabel("Outdoors", { exact: true }).check();
  await bilingual.getByRole("button", { name: "Add to routine" }).click();
  await bilingual.getByText("18:00 · Evening walk").waitFor();
  await plannerLink(bilingual, "Preferences").click();
  await bilingual.getByRole("combobox", { name: "Activity can move indoors" }).selectOption("true");
  await bilingual.getByText(/Move indoors/).waitFor();
  await bilingual.getByLabel("Open wood, coal or charcoal heating inside").check();
  await bilingual.getByRole("heading", { name: "Avoid open solid-fuel fires indoors" }).waitFor();
  await bilingual.getByLabel("Open wood, coal or charcoal heating inside").uncheck();
  await plannerLink(bilingual, "Indoor air").click();
  await bilingual.getByLabel("Room area (m²)").fill("20");
  await bilingual.getByLabel("Ceiling height (m)").fill("2.5");
  await bilingual.getByText("250 m³/h", { exact: true }).waitFor();
  await bilingual.close();

  const missing = await browser.newPage();
  const notFound = await missing.goto(`${origin}/unknown-page`);
  assert.equal(notFound.status(), 404);
  await missing.getByRole("heading", { name: "Page not found" }).waitFor();
  await missing.getByRole("link", { name: "Open Today" }).click();
  await missing.getByRole("heading", { name: "Air quality and your day" }).waitFor();
  await missing.close();

  assert.deepEqual(errors, []);
  console.log("Browser checks passed for manual readings, keyboard focus, opened-panel axe scans, Metro estimates, Hindi clipboard, offline editing, cross-tab saves and clearing, AI fallback and confirmation, 404 recovery, and 3D fallbacks.");
} finally {
  await browser.close();
}
