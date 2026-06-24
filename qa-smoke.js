const { chromium } = require("playwright");

const BASE_URL = process.env.QA_BASE_URL || "http://127.0.0.1:4173";

(async () => {
  await resetState();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  await page.addInitScript(() => {
    try {
      Object.defineProperty(Crypto.prototype, "randomUUID", { value: undefined, configurable: true });
    } catch {}
    try {
      Object.defineProperty(window, "structuredClone", { value: undefined, configurable: true });
    } catch {}
  });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await expectVisible(page, "text=Unser Haushalt");
  await expectVisible(page, "text=Zu kaufen");
  await page.screenshot({ path: "qa-mobile-home.png", fullPage: true });
  await page.locator("#shopFilterButton").click();
  await page.screenshot({ path: "qa-mobile-filter.png", fullPage: true });
  await expectShopLogosLoaded(page);
  await page.locator("#shopFilterButton").click();

  await page.locator(".nav-add").click();
  await page.getByLabel("Was fehlt?").fill("Kaffee");
  await page.getByLabel("Menge").fill("2");
  await page.getByLabel("Einheit").fill("Packungen");
  await expectShopChoice(page, "Hornbach");
  await expectShopChoice(page, "Apotheke");
  await page.locator('input[name="shops"][value="DM"]').check({ force: true });
  await page.locator('input[name="shops"][value="Rewe"]').check({ force: true });
  await page.locator("#itemPhotos").setInputFiles({
    name: "kaffee.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lF9YwQAAAABJRU5ErkJggg==", "base64"),
  });
  await page.locator(".photo-preview img").waitFor({ state: "visible", timeout: 5000 });
  await page.screenshot({ path: "qa-mobile-add.png", fullPage: true });
  await expectShopLogosLoaded(page);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expectVisible(page, "text=Kaffee");
  await page.getByLabel("Kaffee löschen").click();
  await expectVisible(page, "text=Zum Löschen nochmal tippen");
  await expectVisible(page, "text=Kaffee");
  await page.locator("#shopFilterButton").click();
  await page.locator('#shopFilterMenu [data-shop-filter="Lidl"]').click();
  await page.locator('#shopFilterMenu [data-shop-filter="Aldi"]').click();
  await page.locator("#shopFilterButton").click();
  await expectVisible(page, "text=Bananen");
  await page.locator("#shopFilterButton").click();
  await page.locator('#shopFilterMenu [data-clear-shop-filter]').click();
  await page.locator('#shopFilterMenu [data-shop-filter="DM"]').click();
  await page.locator('#shopFilterMenu [data-shop-filter="Rewe"]').click();
  await page.locator("#shopFilterButton").click();
  await page.getByText("2 Läden").waitFor({ state: "visible", timeout: 5000 });
  await expectVisible(page, "text=Kaffee");
  await page.locator("#shopFilterButton").click();
  await page.locator('#shopFilterMenu [data-clear-shop-filter]').click();
  await page.locator("#shopFilterButton").click();

  await page.getByLabel("Kaffee als gekauft markieren").click();
  const completingCoffee = page.locator(".item-row.is-completing").filter({ hasText: "Kaffee" });
  await completingCoffee.waitFor({ state: "visible", timeout: 5000 });
  await page.getByLabel("Kaffee wird als gekauft markiert").waitFor({ state: "visible", timeout: 5000 });
  await completingCoffee.waitFor({ state: "hidden", timeout: 5000 });
  await page.locator('[data-shopping-tab="purchased"]').click();
  await expectVisible(page, "text=Kaffee");

  await page.getByRole("button", { name: "Bestand", exact: true }).click();
  await page.getByRole("heading", { name: "Bestand", exact: true }).waitFor({ state: "visible", timeout: 5000 });
  await page.getByPlaceholder("Bestand durchsuchen").fill("Milch");
  await page.locator('[data-screen="inventory"].active').getByText("Milch").first().waitFor({ state: "visible", timeout: 5000 });
  await page.screenshot({ path: "qa-mobile-inventory.png", fullPage: true });

  await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
  await page.getByRole("heading", { name: "Einstellungen", exact: true }).waitFor({ state: "visible", timeout: 5000 });
  await expectVisible(page, "text=SQLite");
  await expectVisible(page, "text=Exportieren");
  await page.locator(".toast.show").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  await page.screenshot({ path: "qa-mobile-settings.png", fullPage: true });

  const persisted = await fetchJson(`${BASE_URL}/api/state`);
  if (!persisted.shoppingItems.some((item) => item.name === "Kaffee" && item.status === "purchased" && item.photos?.length && item.shops?.includes("DM") && item.shops?.includes("Rewe"))) {
    throw new Error("Kaffee purchase with photo and shop tags was not persisted to server state");
  }
  const privateDataResponse = await fetch(`${BASE_URL}/data/household-manager.sqlite`);
  if (privateDataResponse.status !== 404) {
    throw new Error("Runtime SQLite data is publicly reachable");
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  await browser.close();
})();

async function resetState() {
  await fetch(`${BASE_URL}/api/state?replace=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(seedState()),
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

async function expectShopLogosLoaded(page) {
  await page.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll(".shop-logo img"));
    return images.length >= 8 && images.every((image) => image.complete && image.naturalWidth > 0);
  }, null, { timeout: 5000 });
  const brokenLogos = await page.locator(".shop-logo img").evaluateAll((images) => images
    .filter((image) => !image.complete || image.naturalWidth === 0)
    .map((image) => image.getAttribute("src")));
  if (brokenLogos.length) {
    throw new Error(`Broken shop logos: ${brokenLogos.join(", ")}`);
  }
}

async function expectShopChoice(page, shop) {
  const input = page.locator(`input[name="shops"][value="${shop}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  const logo = page.locator(`.shop-check:has(input[name="shops"][value="${shop}"]) .shop-logo img`);
  await logo.waitFor({ state: "visible", timeout: 5000 });
}

async function expectVisible(page, selector) {
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 5000 });
}

function seedState() {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  return {
    shoppingItems: [
      shopping("s1", "Toilettenpapier", "", "", "haushalt", "open", now, ["Rewe"]),
      shopping("s2", "Bananen", "6", "Stück", "obst", "open", now, ["Lidl", "Aldi"]),
      shopping("s3", "Duschgel", "", "", "bad", "open", now, ["DM", "Rossmann"]),
      shopping("s4", "Zahnbürsten", "2", "Stück", "hygiene", "open", now, ["DM"]),
      shopping("s5", "Kiwis", "", "", "obst", "open", now, ["Edeka"]),
      shopping("s6", "Milch", "6", "Packungen", "milchprodukte", "purchased", yesterday, ["Rewe"]),
      shopping("s7", "Brot", "1", "Laib", "vorrat", "purchased", yesterday, ["Edeka"]),
      shopping("s8", "Eier", "30", "Stück", "vorrat", "purchased", yesterday, ["Aldi"]),
    ],
    inventoryItems: [
      inventory("i1", "Milch", 6, "Packungen", "milchprodukte", "Küche", 3),
      inventory("i2", "Eier", 30, "Stück", "vorrat", "Küche", 12),
      inventory("i3", "Marmelade", 3, "Gläser", "lebensmittel", "Speisekammer", 1),
      inventory("i4", "Hähnchen", 2, "kg", "fleisch", "Gefrierschrank", 1),
      inventory("i5", "Tomaten", 12, "Dosen", "vorrat", "Keller", 4),
      inventory("i6", "Duschgel", 1, "Flasche", "bad", "Bad", 2),
    ],
    events: [],
  };
}

function shopping(id, name, quantity, unit, categoryId, status, timestamp, shops = []) {
  return {
    id,
    name,
    quantity,
    unit,
    categoryId,
    note: "",
    shops,
    photos: [],
    status,
    createdAt: timestamp,
    purchasedAt: status === "purchased" ? timestamp : null,
    updatedAt: timestamp,
  };
}

function inventory(id, name, quantity, unit, categoryId, location, minimumQuantity) {
  const now = new Date().toISOString();
  return {
    id,
    name,
    quantity,
    unit,
    categoryId,
    location,
    minimumQuantity,
    note: "",
    photos: [],
    createdAt: now,
    updatedAt: now,
  };
}
