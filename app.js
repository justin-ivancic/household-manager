const STORAGE_KEY = "household-manager:v1";
const STATE_URL = "/api/state";
const MUTATION_URL = "/api/mutations";

const categories = [
  { id: "obst", name: "Obst", icon: "🍌", color: "#159757" },
  { id: "gemuese", name: "Gemüse", icon: "🥦", color: "#159757" },
  { id: "milchprodukte", name: "Milchprodukte", icon: "🥛", color: "#2b63b7" },
  { id: "fleisch", name: "Fleisch", icon: "🥩", color: "#c2413c" },
  { id: "fisch", name: "Fisch", icon: "🐟", color: "#2b63b7" },
  { id: "getraenke", name: "Getränke", icon: "🧃", color: "#2b63b7" },
  { id: "tiefkuehl", name: "Tiefkühlkost", icon: "❄️", color: "#2b63b7" },
  { id: "lebensmittel", name: "Lebensmittel", icon: "🍓", color: "#c2413c" },
  { id: "vorrat", name: "Vorrat", icon: "🥫", color: "#7c5ce7" },
  { id: "haushalt", name: "Haushalt", icon: "🧻", color: "#159757" },
  { id: "bad", name: "Bad", icon: "🧴", color: "#7c5ce7" },
  { id: "hygiene", name: "Hygiene", icon: "🪥", color: "#7c5ce7" },
  { id: "drogerie", name: "Drogerie", icon: "🧼", color: "#7c5ce7" },
  { id: "haustier", name: "Haustier", icon: "🐾", color: "#c77710" },
  { id: "sonstiges", name: "Sonstiges", icon: "📦", color: "#6b7280" },
];

const shops = ["DM", "Rewe", "Edeka", "Lidl", "Aldi", "Rossmann", "Hornbach", "Apotheke"];
const PURCHASE_CONFIRM_DELAY = 620;
const TAP_MOVE_LIMIT = 12;
const TAP_MAX_DURATION = 650;
const SYNTHETIC_CLICK_BLOCK_MS = 700;
const shopLogoFiles = {
  DM: "dm.svg",
  Rewe: "rewe.svg",
  Edeka: "edeka.svg",
  Lidl: "lidl.svg",
  Aldi: "aldi.svg",
  Rossmann: "rossmann.svg",
  Hornbach: "hornbach.svg",
  Apotheke: "apotheke.svg",
};

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // Some mobile browsers expose crypto differently on non-local HTTP.
    }
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function cloneData(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

const seedState = {
  shoppingItems: [
    item("Toilettenpapier", "", "", "haushalt", ["Rewe"]),
    item("Bananen", "6", "Stück", "obst", ["Lidl", "Aldi"]),
    item("Duschgel", "", "", "bad", ["DM", "Rossmann"]),
    item("Zahnbürsten", "2", "Stück", "hygiene", ["DM"]),
    item("Kiwis", "", "", "obst", ["Edeka"]),
    purchased("Milch", "6", "Packungen", "milchprodukte", -1, ["Rewe"]),
    purchased("Brot", "1", "Laib", "vorrat", -2, ["Edeka"]),
    purchased("Eier", "30", "Stück", "vorrat", -2, ["Aldi"]),
  ],
  inventoryItems: [
    inventory("Milch", 6, "Packungen", "milchprodukte", "Küche", 3),
    inventory("Eier", 30, "Stück", "vorrat", "Küche", 12),
    inventory("Marmelade", 3, "Gläser", "lebensmittel", "Speisekammer", 1),
    inventory("Hähnchen", 2, "kg", "fleisch", "Gefrierschrank", 1),
    inventory("Tomaten", 12, "Dosen", "vorrat", "Keller", 4),
    inventory("Duschgel", 1, "Flasche", "bad", "Bad", 2),
  ],
  events: [],
  deletedItems: { shoppingItems: {}, inventoryItems: {} },
};

let state = cloneData(seedState);
let activeScreen = "home";
let shoppingTab = "open";
let activeCategory = "all";
let activeShopFilters = [];
let editContext = null;
let detailContext = null;
let photoContext = null;
let photoTouchStartX = null;
const pendingPurchaseIds = new Set();
let lastPointerTapAt = 0;
let syntheticTapTarget = null;
let syntheticTapAt = 0;
let tapCandidate = null;
let scrollClickBlockUntil = 0;
let nativeClickBlockUntil = 0;
let latestSyncRequestId = 0;
let activeSyncRequests = 0;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  openCount: $("#openCount"),
  inventoryCount: $("#inventoryCount"),
  openBadge: $("#openBadge"),
  purchasedBadge: $("#purchasedBadge"),
  shopFilterButton: $("#shopFilterButton"),
  shopFilterLabel: $("#shopFilterLabel"),
  shopFilterMenu: $("#shopFilterMenu"),
  shoppingList: $("#shoppingList"),
  recentPurchased: $("#recentPurchased"),
  inventorySearch: $("#inventorySearch"),
  categoryFilters: $("#categoryFilters"),
  inventoryList: $("#inventoryList"),
  historyList: $("#historyList"),
  settingsCategories: $("#settingsCategories"),
  itemSheet: $("#itemSheet"),
  itemForm: $("#itemForm"),
  sheetTitle: $("#sheetTitle"),
  itemName: $("#itemName"),
  itemQuantity: $("#itemQuantity"),
  itemUnit: $("#itemUnit"),
  itemCategory: $("#itemCategory"),
  itemLocation: $("#itemLocation"),
  itemMinimum: $("#itemMinimum"),
  itemNote: $("#itemNote"),
  shopChecks: $("#shopChecks"),
  itemPhotos: $("#itemPhotos"),
  photoFileSummary: $("#photoFileSummary"),
  photoPreview: $("#photoPreview"),
  detailOverlay: $("#detailOverlay"),
  detailTitle: $("#detailTitle"),
  detailContent: $("#detailContent"),
  detailEditButton: $("#detailEditButton"),
  photoOverlay: $("#photoOverlay"),
  photoTitle: $("#photoTitle"),
  photoCounter: $("#photoCounter"),
  photoStage: $("#photoStage"),
  photoPrev: $("#photoPrev"),
  photoNext: $("#photoNext"),
  searchOverlay: $("#searchOverlay"),
  globalSearch: $("#globalSearch"),
  searchResults: $("#searchResults"),
  toast: $("#toast"),
};

boot();

async function boot() {
  els.itemCategory.innerHTML = categories.map((category) => `<option value="${category.id}">${category.icon} ${category.name}</option>`).join("");
  els.shopChecks.innerHTML = shops.map((shop) => `
    <label class="shop-check">
      <input type="checkbox" name="shops" value="${shop}" />
      <span>
        ${shopLogo(shop)}
        <strong>${shop}</strong>
        ${iconSvg("check")}
      </span>
    </label>
  `).join("");
  bindEvents();
  state = await loadState();
  state = normalizeState(state);
  storeLocalState();
  render();
  window.setInterval(refreshFromServer, 8000);
}

function bindEvents() {
  document.addEventListener("click", suppressDuplicateTouchClick, true);
  document.addEventListener("pointerdown", startTapTracking);
  document.addEventListener("pointermove", updateTapTracking);
  document.addEventListener("pointercancel", cancelTapTracking);
  document.addEventListener("touchstart", startTapTracking, { passive: true });
  document.addEventListener("touchmove", updateTapTracking, { passive: true });
  document.addEventListener("pointerup", activateTouchControl);
  document.addEventListener("touchend", activateTouchControl);
  document.addEventListener("keydown", handleKeyboard);

  document.addEventListener("click", (event) => {
    const target = eventTargetElement(event.target);
    if (!target) return;

    const photoTrigger = target.closest("[data-open-photos]");
    if (photoTrigger) {
      openPhotoViewer(photoTrigger.dataset.photoType, photoTrigger.dataset.photoId, Number(photoTrigger.dataset.photoIndex || 0));
      return;
    }

    if (target.closest("[data-close-photo-viewer]")) {
      closePhotoViewer();
      return;
    }

    if (target.closest("[data-photo-prev]")) {
      showPhoto((photoContext?.index ?? 0) - 1);
      return;
    }

    if (target.closest("[data-photo-next]")) {
      showPhoto((photoContext?.index ?? 0) + 1);
      return;
    }

    if (target.closest("[data-close-detail]")) {
      closeDetail();
      return;
    }

    if (target.closest("[data-edit-detail]")) {
      editFromDetail();
      return;
    }

    if (target.closest("#shopFilterButton")) {
      toggleShopFilterMenu();
      return;
    }

    const shopFilterOption = target.closest("[data-shop-filter]");
    if (shopFilterOption) {
      toggleShopFilter(shopFilterOption.dataset.shopFilter);
      renderShopping();
      return;
    }

    if (target.closest("[data-clear-shop-filter]")) {
      activeShopFilters = [];
      renderShopping();
      return;
    }

    if (!target.closest(".shop-filter-shell")) {
      closeShopFilterMenu();
    }

    const nav = target.closest("[data-nav]");
    if (nav) {
      setScreen(nav.dataset.nav);
      return;
    }

    const add = target.closest("[data-open-add]");
    if (add) {
      openSheet({ type: add.dataset.openAdd });
      return;
    }

    if (target.closest("[data-close-sheet]")) {
      closeSheet();
      return;
    }

    if (target.closest("[data-close-overlay]")) {
      closeSearch();
      return;
    }

    const detailRow = target.closest("[data-open-detail]");
    if (detailRow && !isScrollClickBlocked() && !target.closest("button, input, label, select, textarea, a")) {
      openDetail(detailRow.dataset.detailType, detailRow.dataset.detailId);
      return;
    }

    const restoreHistory = target.closest("[data-restore-history]");
    if (restoreHistory) {
      restoreFromHistory(restoreHistory.dataset.restoreType, restoreHistory.dataset.restoreId);
    }
  });

  $$(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      shoppingTab = button.dataset.shoppingTab;
      renderShopping();
    });
  });

  $("#searchToggle").addEventListener("click", openSearch);
  els.inventorySearch.addEventListener("input", renderInventory);
  els.globalSearch.addEventListener("input", renderSearch);
  els.itemForm.addEventListener("submit", saveItemFromSheet);
  els.itemPhotos.addEventListener("change", previewSelectedPhotos);
  els.photoStage.addEventListener("touchstart", startPhotoSwipe, { passive: true });
  els.photoStage.addEventListener("touchend", endPhotoSwipe);
  $("#exportData").addEventListener("click", exportData);
  $("#importData").addEventListener("change", importData);
}

function startTapTracking(event) {
  const point = tapPoint(event);
  if (!point) return;
  tapCandidate = { x: point.x, y: point.y, startedAt: Date.now(), moved: false };
}

function updateTapTracking(event) {
  if (!tapCandidate) return;
  const point = tapPoint(event);
  if (!point) return;
  const moved = Math.hypot(point.x - tapCandidate.x, point.y - tapCandidate.y);
  if (moved > TAP_MOVE_LIMIT) {
    tapCandidate.moved = true;
    scrollClickBlockUntil = Date.now() + 450;
  }
}

function cancelTapTracking() {
  tapCandidate = null;
}

function activateTouchControl(event) {
  if (event.type === "pointerup") {
    if (event.pointerType === "mouse") return;
    lastPointerTapAt = Date.now();
  } else if (Date.now() - lastPointerTapAt < 450) {
    return;
  }

  if (tapCandidate?.moved || (tapCandidate && Date.now() - tapCandidate.startedAt > TAP_MAX_DURATION)) {
    tapCandidate = null;
    scrollClickBlockUntil = Date.now() + 450;
    return;
  }
  tapCandidate = null;

  const control = touchControlFromEvent(event);
  if (!control || control.disabled) return;

  syntheticTapTarget = control;
  syntheticTapAt = Date.now();
  nativeClickBlockUntil = syntheticTapAt + SYNTHETIC_CLICK_BLOCK_MS;
  control.click();
}

function suppressDuplicateTouchClick(event) {
  if (!event.isTrusted) return;
  if (Date.now() < nativeClickBlockUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (!syntheticTapTarget) return;
  if (Date.now() - syntheticTapAt > SYNTHETIC_CLICK_BLOCK_MS) {
    syntheticTapTarget = null;
    return;
  }

  const target = eventTargetElement(event.target);
  if (!target) return;
  if (target === syntheticTapTarget || syntheticTapTarget.contains(target) || target.contains(syntheticTapTarget)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    syntheticTapTarget = null;
  }
}

function touchControlFromEvent(event) {
  const target = eventTargetElement(event.target);
  if (!target) return null;
  const control = target.closest("button");
  if (!control || control.closest("[hidden]")) return null;
  return control;
}

function tapPoint(event) {
  const touch = event.changedTouches?.[0] || event.touches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  if (typeof event.clientX === "number") return { x: event.clientX, y: event.clientY };
  return null;
}

function isScrollClickBlocked() {
  return Date.now() < scrollClickBlockUntil;
}

function eventTargetElement(target) {
  if (target instanceof Element) return target;
  return target?.parentElement || null;
}

function handleKeyboard(event) {
  const target = eventTargetElement(event.target);
  if (!target) return;
  if (event.key === "Escape") {
    if (!els.photoOverlay.hidden) closePhotoViewer();
    else if (!els.detailOverlay.hidden) closeDetail();
    return;
  }
  if (!["Enter", " "].includes(event.key) || target.closest("button, input, label, select, textarea, a")) return;
  const detailRow = target.closest("[data-open-detail]");
  if (!detailRow) return;
  event.preventDefault();
  openDetail(detailRow.dataset.detailType, detailRow.dataset.detailId);
}

async function loadState() {
  try {
    const response = await fetch(STATE_URL);
    if (response.ok) return await response.json();
  } catch {
    // Static file fallback for development without the Python/SQLite server.
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return cloneData(seedState);
    const parsed = JSON.parse(stored);
    return {
      shoppingItems: Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : [],
      inventoryItems: Array.isArray(parsed.inventoryItems) ? parsed.inventoryItems : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      deletedItems: parsed.deletedItems || {},
    };
  } catch {
    return cloneData(seedState);
  }
}

function normalizeState(input) {
  const now = new Date().toISOString();
  return {
    shoppingItems: (input.shoppingItems || []).map((entry) => ({
      id: entry.id || createId(),
      name: entry.name || "Unbenannt",
      quantity: entry.quantity ?? "",
      unit: entry.unit || "",
      categoryId: entry.categoryId || "sonstiges",
      note: entry.note || "",
      shops: normalizeShops(entry.shops),
      photos: Array.isArray(entry.photos) ? entry.photos : [],
      status: entry.status || "open",
      createdAt: entry.createdAt || now,
      purchasedAt: entry.purchasedAt || null,
      updatedAt: entry.updatedAt || now,
    })),
    inventoryItems: (input.inventoryItems || []).map((entry) => ({
      id: entry.id || createId(),
      name: entry.name || "Unbenannt",
      quantity: entry.quantity ?? 0,
      unit: entry.unit || "",
      categoryId: entry.categoryId || "sonstiges",
      location: entry.location || "",
      minimumQuantity: entry.minimumQuantity ?? 0,
      note: entry.note || "",
      photos: Array.isArray(entry.photos) ? entry.photos : [],
      createdAt: entry.createdAt || now,
      updatedAt: entry.updatedAt || now,
    })),
    events: Array.isArray(input.events) ? input.events : [],
    deletedItems: normalizeDeletedItems(input.deletedItems),
  };
}

function normalizeDeletedItems(input) {
  const normalized = { shoppingItems: {}, inventoryItems: {} };
  if (!input || typeof input !== "object") return normalized;
  for (const collection of Object.keys(normalized)) {
    const entries = input[collection];
    if (!entries || typeof entries !== "object") continue;
    Object.entries(entries).forEach(([id, record]) => {
      if (!id) return;
      if (record && typeof record === "object") {
        normalized[collection][id] = {
          deletedAt: record.deletedAt || "",
          item: record.item || null,
        };
      } else {
        normalized[collection][id] = { deletedAt: String(record || ""), item: null };
      }
    });
  }
  return normalized;
}

function storeLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function replaceServerState(nextState) {
  state = normalizeState(nextState);
  storeLocalState();
  try {
    const response = await fetch(`${STATE_URL}?replace=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!response.ok) return false;
    state = normalizeState(await response.json());
    storeLocalState();
    render();
    return true;
  } catch {
    return false;
  }
}

async function commitMutations(operations) {
  const safeOperations = operations.filter((operation) => operation && (operation.type !== "addEvent" || operation.event));
  if (!safeOperations.length) {
    storeLocalState();
    return false;
  }

  storeLocalState();
  const requestId = ++latestSyncRequestId;
  activeSyncRequests += 1;
  try {
    const response = await fetch(MUTATION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations: safeOperations }),
    });
    if (!response.ok) return false;
    const nextState = normalizeState(await response.json());
    if (requestId === latestSyncRequestId) {
      state = nextState;
      storeLocalState();
      render();
    }
    return true;
  } catch {
    return false;
  } finally {
    activeSyncRequests = Math.max(0, activeSyncRequests - 1);
  }
}

async function refreshFromServer() {
  if (!els.itemSheet.hidden || !els.searchOverlay.hidden || !els.detailOverlay.hidden || !els.photoOverlay.hidden || pendingPurchaseIds.size || activeSyncRequests) return;
  try {
    const response = await fetch(STATE_URL);
    if (!response.ok) return;
    const nextState = normalizeState(await response.json());
    if (JSON.stringify(nextState) === JSON.stringify(state)) return;
    state = nextState;
    storeLocalState();
    render();
  } catch {
    // The static fallback remains intentionally quiet.
  }
}

function item(name, quantity = "", unit = "", categoryId = "sonstiges", preferredShops = []) {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name,
    quantity,
    unit,
    categoryId,
    note: "",
    shops: normalizeShops(preferredShops),
    photos: [],
    status: "open",
    createdAt: now,
    purchasedAt: null,
    updatedAt: now,
  };
}

function purchased(name, quantity = "", unit = "", categoryId = "sonstiges", daysAgo = 0, preferredShops = []) {
  const created = new Date(Date.now() + daysAgo * 86400000);
  const purchasedAt = new Date(created.getTime() + 3600000).toISOString();
  return {
    ...item(name, quantity, unit, categoryId, preferredShops),
    status: "purchased",
    createdAt: created.toISOString(),
    purchasedAt,
    updatedAt: purchasedAt,
  };
}

function inventory(name, quantity, unit, categoryId, location = "", minimumQuantity = 0) {
  const now = new Date().toISOString();
  return {
    id: createId(),
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

function render() {
  const openItems = state.shoppingItems.filter((entry) => entry.status === "open");
  const purchasedItems = state.shoppingItems.filter((entry) => entry.status === "purchased");
  els.openCount.textContent = openItems.length;
  els.inventoryCount.textContent = state.inventoryItems.length;
  els.openBadge.textContent = openItems.length;
  els.purchasedBadge.textContent = purchasedItems.length;
  renderShopping();
  renderRecent();
  renderInventory();
  renderHistory();
  renderSettings();
}

function renderShopping() {
  $$(".segment").forEach((button) => button.classList.toggle("active", button.dataset.shoppingTab === shoppingTab));
  renderShopFilterMenu();
  const status = shoppingTab === "open" ? "open" : "purchased";
  const items = state.shoppingItems
    .filter((entry) => entry.status === status)
    .filter(matchesShopFilter)
    .sort((a, b) => new Date(status === "open" ? b.createdAt : b.purchasedAt) - new Date(status === "open" ? a.createdAt : a.purchasedAt));

  if (!items.length) {
    els.shoppingList.innerHTML = emptyState(
      activeShopFilters.length === 0 ? (status === "open" ? "Nichts offen" : "Noch nichts gekauft") : "Nichts für diese Läden",
      activeShopFilters.length === 0
        ? (status === "open" ? "Wenn etwas fehlt, füge es mit dem Plus hinzu." : "Abgehakte Einkäufe erscheinen hier.")
        : "Wähle einen anderen Laden oder zeige wieder alle Einträge."
    );
    return;
  }

  els.shoppingList.innerHTML = items.map((entry) => shoppingRow(entry)).join("");
  els.shoppingList.querySelectorAll("[data-purchase]").forEach((button) => button.addEventListener("click", () => markPurchased(button.dataset.purchase)));
  els.shoppingList.querySelectorAll("[data-reopen]").forEach((button) => button.addEventListener("click", () => reopenItem(button.dataset.reopen)));
  els.shoppingList.querySelectorAll("[data-edit-shopping]").forEach((button) => button.addEventListener("click", () => openSheet({ type: "shopping", id: button.dataset.editShopping })));
  els.shoppingList.querySelectorAll("[data-delete-shopping]").forEach((button) => button.addEventListener("click", () => deleteShopping(button.dataset.deleteShopping)));
}

function renderShopFilterMenu() {
  els.shopFilterLabel.textContent = shopFilterLabel();
  els.shopFilterButton.classList.toggle("active", activeShopFilters.length > 0);
  els.shopFilterMenu.innerHTML = `
    <div class="shop-filter-menu-title">
      ${iconSvg("store")}
      <span>Nach Laden filtern</span>
    </div>
    <button class="shop-filter-option clear ${activeShopFilters.length === 0 ? "active" : ""}" data-clear-shop-filter type="button">${iconSvg("layers")}<span>Alle anzeigen</span><small>${state.shoppingItems.filter((entry) => entry.status === shoppingTabStatus()).length}</small>${iconSvg("check")}</button>
    ${shops.map((shop) => {
    const count = state.shoppingItems.filter((entry) => entry.status === shoppingTabStatus() && entry.shops.includes(shop)).length;
    return `<button class="shop-filter-option ${activeShopFilters.includes(shop) ? "active" : ""}" data-shop-filter="${shop}" type="button">${shopLogo(shop)}<span>${shop}</span><small>${count}</small>${iconSvg("check")}</button>`;
  }).join("")}
  `;
}

function matchesShopFilter(entry) {
  return activeShopFilters.length === 0 || activeShopFilters.some((shop) => entry.shops.includes(shop));
}

function shopFilterLabel() {
  if (activeShopFilters.length === 0) return "Alle Läden";
  if (activeShopFilters.length === 1) return activeShopFilters[0];
  return `${activeShopFilters.length} Läden`;
}

function toggleShopFilter(shop) {
  activeShopFilters = activeShopFilters.includes(shop)
    ? activeShopFilters.filter((entry) => entry !== shop)
    : [...activeShopFilters, shop];
}

function toggleShopFilterMenu() {
  const willOpen = els.shopFilterMenu.hidden;
  els.shopFilterMenu.hidden = !willOpen;
  els.shopFilterButton.setAttribute("aria-expanded", String(willOpen));
}

function closeShopFilterMenu() {
  els.shopFilterMenu.hidden = true;
  els.shopFilterButton.setAttribute("aria-expanded", "false");
}

function shoppingTabStatus() {
  return shoppingTab === "open" ? "open" : "purchased";
}

function shoppingRow(entry) {
  const category = getCategory(entry.categoryId);
  const meta = [category.name, quantityText(entry), entry.purchasedAt ? relativeDate(entry.purchasedAt) : ""].filter(Boolean).join(" · ");
  const isOpen = entry.status === "open";
  const isCompleting = pendingPurchaseIds.has(entry.id);
  const disabled = isCompleting ? " disabled" : "";
  return `
    <article class="item-row${isCompleting ? " is-completing" : ""}" data-shopping-item="${entry.id}" data-open-detail data-detail-type="shopping" data-detail-id="${escapeHtml(entry.id)}" role="button" tabindex="0" aria-label="${escapeHtml(`${entry.name} Details öffnen`)}">
      ${
        isOpen
          ? `<button class="check-button${isCompleting ? " is-completing" : ""}" data-purchase="${entry.id}" aria-label="${escapeHtml(isCompleting ? `${entry.name} wird als gekauft markiert` : `${entry.name} als gekauft markieren`)}"${disabled}><svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10" /></svg></button>`
          : `<button class="done-dot" data-reopen="${entry.id}" aria-label="${escapeHtml(entry.name)} erneut öffnen"><svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10" /></svg></button>`
      }
      ${productThumbnail(entry, category, "shopping")}
      <div class="item-main">
        <strong>${escapeHtml(entry.name)}</strong>
        <small>${escapeHtml(meta)}</small>
        ${shopBadges(entry.shops)}
        ${itemSignals(entry)}
      </div>
      <div class="row-actions">
        <button class="tiny-button" data-edit-shopping="${entry.id}" aria-label="${escapeHtml(entry.name)} bearbeiten"${disabled}>✎</button>
        <button class="tiny-button danger" data-delete-shopping="${entry.id}" aria-label="${escapeHtml(entry.name)} löschen"${disabled}>×</button>
      </div>
    </article>
  `;
}

function renderRecent() {
  const recent = state.shoppingItems
    .filter((entry) => entry.status === "purchased")
    .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt))
    .slice(0, 3);
  els.recentPurchased.innerHTML = recent.length
    ? recent.map((entry) => compactPurchasedRow(entry)).join("")
    : emptyState("Noch keine Käufe", "Gekaufte Produkte erscheinen hier.");
}

function compactPurchasedRow(entry) {
  const category = getCategory(entry.categoryId);
  return `
    <article class="item-row compact" data-open-detail data-detail-type="shopping" data-detail-id="${escapeHtml(entry.id)}" role="button" tabindex="0" aria-label="${escapeHtml(`${entry.name} Details öffnen`)}">
      <span class="done-dot"><svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10" /></svg></span>
      ${productThumbnail(entry, category, "shopping")}
      <div class="item-main">
        <strong>${escapeHtml(entry.name)}</strong>
        <small>${escapeHtml([category.name, quantityText(entry)].filter(Boolean).join(" · "))}</small>
        ${shopBadges(entry.shops)}
        ${itemSignals(entry)}
      </div>
      <small>${escapeHtml(relativeDate(entry.purchasedAt))}</small>
    </article>
  `;
}

function renderInventory() {
  renderCategoryFilters();
  const query = normalize(els.inventorySearch.value);
  const items = state.inventoryItems
    .filter((entry) => activeCategory === "all" || entry.categoryId === activeCategory)
    .filter((entry) => !query || normalize([entry.name, entry.unit, entry.location, getCategory(entry.categoryId).name].join(" ")).includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  els.inventoryList.innerHTML = items.length ? items.map((entry) => inventoryRow(entry)).join("") : emptyState("Kein Bestand gefunden", "Passe Suche oder Kategorie an.");
  els.inventoryList.querySelectorAll("[data-adjust]").forEach((button) => {
    button.addEventListener("click", () => adjustInventory(button.dataset.adjust, Number(button.dataset.delta)));
  });
  els.inventoryList.querySelectorAll("[data-edit-inventory]").forEach((button) => openEditOn(button, "inventory"));
  els.inventoryList.querySelectorAll("[data-delete-inventory]").forEach((button) => button.addEventListener("click", () => deleteInventory(button.dataset.deleteInventory)));
  els.inventoryList.querySelectorAll("[data-inventory-to-shopping]").forEach((button) => {
    button.addEventListener("click", () => addInventoryToShopping(button.dataset.inventoryToShopping));
  });
}

function renderCategoryFilters() {
  const chips = [{ id: "all", name: "Alle", icon: "" }, ...categories];
  els.categoryFilters.innerHTML = chips
    .map((category) => `<button class="chip ${activeCategory === category.id ? "active" : ""}" data-category="${category.id}" type="button">${category.icon ? `${category.icon} ` : ""}${category.name}</button>`)
    .join("");
  els.categoryFilters.querySelectorAll("[data-category]").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.category;
      renderInventory();
    });
  });
}

function inventoryRow(entry) {
  const category = getCategory(entry.categoryId);
  const low = Number(entry.minimumQuantity) > 0 && Number(entry.quantity) <= Number(entry.minimumQuantity);
  const meta = [category.name, entry.location].filter(Boolean).join(" · ");
  return `
    <article class="item-row inventory-row" data-open-detail data-detail-type="inventory" data-detail-id="${escapeHtml(entry.id)}" role="button" tabindex="0" aria-label="${escapeHtml(`${entry.name} Details öffnen`)}">
      ${productThumbnail(entry, category, "inventory")}
      <div class="item-main">
        <strong>${escapeHtml(entry.name)}</strong>
        <small>${escapeHtml(`${formatNumber(entry.quantity)} ${entry.unit || ""}`.trim())}${meta ? ` · ${escapeHtml(meta)}` : ""}</small>
        ${low ? `<span class="warning-pill">Niedriger Bestand</span>` : ""}
        ${itemSignals(entry)}
      </div>
      <div class="row-actions">
        <button class="tiny-button" data-adjust="${entry.id}" data-delta="-1" aria-label="${escapeHtml(entry.name)} verringern">−</button>
        <button class="tiny-button" data-adjust="${entry.id}" data-delta="1" aria-label="${escapeHtml(entry.name)} erhöhen">+</button>
        <button class="tiny-button" data-inventory-to-shopping="${entry.id}" aria-label="${escapeHtml(entry.name)} zur Einkaufsliste">＋</button>
        <button class="tiny-button" data-edit-inventory="${entry.id}" aria-label="${escapeHtml(entry.name)} bearbeiten">✎</button>
        <button class="tiny-button danger" data-delete-inventory="${entry.id}" aria-label="${escapeHtml(entry.name)} löschen">×</button>
      </div>
    </article>
  `;
}

function renderHistory() {
  const events = [
    ...state.events,
    ...state.shoppingItems.filter((entry) => entry.purchasedAt).map((entry) => ({
      id: `legacy-${entry.id}`,
      type: "shopping_item.purchased",
      label: `${entry.name} gekauft`,
      createdAt: entry.purchasedAt,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  els.historyList.innerHTML = events.length
    ? events.slice(0, 80).map(historyRow).join("")
    : emptyState("Noch keine Historie", "Änderungen erscheinen hier automatisch.");
}

function historyRow(event) {
  const restorable = restorableEvent(event);
  return `
    <article class="item-row history-row">
      <span class="done-dot"><svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10" /></svg></span>
      <div class="item-main">
        <strong>${escapeHtml(event.label)}</strong>
        <small>${escapeHtml(relativeDate(event.createdAt))}</small>
      </div>
      ${restorable ? `<button class="secondary-button history-restore" data-restore-history data-restore-type="${escapeHtml(restorable.type)}" data-restore-id="${escapeHtml(restorable.id)}" type="button">Wiederherstellen</button>` : ""}
    </article>`;
}

function restorableEvent(event) {
  if (!event?.type?.endsWith(".deleted") || !event.itemId || !event.itemType) return null;
  const record = deletedRecord(event.itemType, event.itemId);
  if (!record?.item) return null;
  return { type: event.itemType, id: event.itemId };
}

function renderSettings() {
  els.settingsCategories.innerHTML = categories.map((category) => `<span class="chip">${category.icon} ${category.name}</span>`).join("");
}

function renderSearch() {
  const query = normalize(els.globalSearch.value);
  if (!query) {
    els.searchResults.innerHTML = emptyState("Suchbegriff eingeben", "Einkäufe, Bestand und Historie werden gemeinsam durchsucht.");
    return;
  }
  const shopping = state.shoppingItems
    .filter((entry) => normalize([entry.name, getCategory(entry.categoryId).name, quantityText(entry), entry.shops.join(" ")].join(" ")).includes(query))
    .map((entry) => ({ kind: entry.status === "open" ? "Offen" : "Gekauft", title: entry.name, meta: [getCategory(entry.categoryId).name, quantityText(entry), entry.shops.join(", ")].filter(Boolean).join(" · ") }));
  const inventoryItems = state.inventoryItems
    .filter((entry) => normalize([entry.name, entry.location, getCategory(entry.categoryId).name].join(" ")).includes(query))
    .map((entry) => ({ kind: "Bestand", title: entry.name, meta: `${formatNumber(entry.quantity)} ${entry.unit || ""}`.trim() }));
  const results = [...shopping, ...inventoryItems].slice(0, 30);
  els.searchResults.innerHTML = results.length
    ? results.map((result) => `
      <article class="item-row">
        <span class="product-icon">${result.kind === "Bestand" ? "📦" : "🛒"}</span>
        <div class="item-main">
          <strong>${escapeHtml(result.title)}</strong>
          <small>${escapeHtml(`${result.kind}${result.meta ? ` · ${result.meta}` : ""}`)}</small>
        </div>
      </article>`).join("")
    : emptyState("Nichts gefunden", "Versuche einen anderen Begriff.");
}

function openEditOn(button, type) {
  button.addEventListener("click", () => openSheet({ type, id: button.dataset.editInventory }));
}

function setScreen(screen) {
  activeScreen = screen;
  $$(".screen").forEach((panel) => panel.classList.toggle("active", panel.dataset.screen === screen));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.nav === screen));
  if (screen === "inventory") setTimeout(() => els.inventorySearch.focus({ preventScroll: true }), 80);
}

function openSheet({ type, id = null }) {
  editContext = { type, id };
  const isInventory = type === "inventory";
  const entry = id
    ? isInventory
      ? state.inventoryItems.find((itemEntry) => itemEntry.id === id)
      : state.shoppingItems.find((itemEntry) => itemEntry.id === id)
    : null;

  els.sheetTitle.textContent = entry ? "Bearbeiten" : isInventory ? "Bestand hinzufügen" : "Zur Einkaufsliste";
  $$(".inventory-only").forEach((field) => {
    field.hidden = !isInventory;
  });
  $$(".shopping-only").forEach((field) => {
    field.hidden = isInventory;
  });
  els.itemName.value = entry?.name || "";
  els.itemQuantity.value = entry?.quantity ?? "";
  els.itemUnit.value = entry?.unit || "";
  els.itemCategory.value = entry?.categoryId || "sonstiges";
  els.itemLocation.value = entry?.location || "";
  els.itemMinimum.value = entry?.minimumQuantity ?? "";
  els.itemNote.value = entry?.note || "";
  setSelectedShops(entry?.shops || []);
  els.itemPhotos.value = "";
  els.photoFileSummary.textContent = entry?.photos?.length ? `${entry.photos.length} gespeicherte Fotos` : "Bis zu 6 Bilder";
  renderPhotoPreview(entry?.photos || []);
  els.itemSheet.hidden = false;
  setTimeout(() => els.itemName.focus(), 80);
}

function closeSheet() {
  els.itemSheet.hidden = true;
  editContext = null;
  els.itemForm.reset();
  setSelectedShops([]);
  els.photoFileSummary.textContent = "Bis zu 6 Bilder";
  renderPhotoPreview([]);
}

function openDetail(type, id) {
  const entry = findEntry(type, id);
  if (!entry) {
    refreshFromServer();
    return;
  }
  detailContext = { type, id };
  els.detailTitle.textContent = entry.name;
  els.detailContent.innerHTML = itemDetailHtml(type, entry);
  els.detailOverlay.hidden = false;
}

function closeDetail() {
  els.detailOverlay.hidden = true;
  detailContext = null;
  els.detailTitle.textContent = "Details";
  els.detailContent.innerHTML = "";
}

function editFromDetail() {
  if (!detailContext) return;
  const context = { ...detailContext };
  closeDetail();
  openSheet(context);
}

function itemDetailHtml(type, entry) {
  const category = getCategory(entry.categoryId);
  const note = String(entry.note || "").trim();
  return `
    <div class="detail-hero">
      ${productThumbnail(entry, category, type, "detail-hero-icon")}
      <div>
        <strong>${escapeHtml(entry.name)}</strong>
        <span>${escapeHtml(type === "inventory" ? "Bestand" : entry.status === "purchased" ? "Gekauft" : "Einkaufsliste")}</span>
      </div>
    </div>
    ${detailPhotoGallery(type, entry)}
    <dl class="detail-grid">
      ${detailRows(type, entry, category).map(([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value || "Keine Angabe")}</dd>
        </div>
      `).join("")}
    </dl>
    <section class="detail-note">
      <h3>Notiz</h3>
      <p>${escapeHtml(note || "Keine Notiz hinterlegt.")}</p>
    </section>
  `;
}

function detailRows(type, entry, category) {
  if (type === "inventory") {
    return [
      ["Kategorie", category.name],
      ["Bestand", `${formatNumber(entry.quantity)} ${entry.unit || ""}`.trim()],
      ["Lagerort", entry.location],
      ["Mindestbestand", entry.minimumQuantity ? formatNumber(entry.minimumQuantity) : ""],
      ["Aktualisiert", relativeDate(entry.updatedAt)],
    ];
  }
  return [
    ["Kategorie", category.name],
    ["Menge", quantityText(entry)],
    ["Läden", normalizeShops(entry.shops).join(", ")],
    ["Status", entry.status === "purchased" ? "Gekauft" : "Offen"],
    ["Aktualisiert", relativeDate(entry.updatedAt)],
  ];
}

function detailPhotoGallery(type, entry) {
  const photos = entry.photos || [];
  if (!photos.length) {
    return `<section class="detail-photos empty"><h3>Fotos</h3><p>Keine Fotos hinterlegt.</p></section>`;
  }
  return `
    <section class="detail-photos">
      <div class="detail-section-header">
        <h3>Fotos</h3>
        <span>${photos.length}</span>
      </div>
      <div class="detail-photo-grid">
        ${photos.map((photo, index) => `
          <button class="detail-photo" data-open-photos data-photo-type="${escapeHtml(type)}" data-photo-id="${escapeHtml(entry.id)}" data-photo-index="${index}" type="button" aria-label="${escapeHtml(`${entry.name} Foto ${index + 1} öffnen`)}">
            <img src="${escapeHtml(photo)}" alt="" />
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function openPhotoViewer(type, id, index = 0) {
  const entry = findEntry(type, id);
  const photos = entry?.photos || [];
  if (!entry || !photos.length) return;
  photoContext = {
    type,
    id,
    title: entry.name,
    photos,
    index: Math.min(Math.max(0, index), photos.length - 1),
  };
  els.photoOverlay.hidden = false;
  showPhoto(photoContext.index);
}

function showPhoto(index) {
  if (!photoContext || !photoContext.photos.length) return;
  const count = photoContext.photos.length;
  photoContext.index = ((index % count) + count) % count;
  const photo = photoContext.photos[photoContext.index];
  els.photoTitle.textContent = photoContext.title;
  els.photoCounter.textContent = `${photoContext.index + 1} / ${count}`;
  els.photoStage.innerHTML = `<img src="${escapeHtml(photo)}" alt="${escapeHtml(`${photoContext.title} Foto ${photoContext.index + 1}`)}" />`;
  els.photoPrev.disabled = count <= 1;
  els.photoNext.disabled = count <= 1;
}

function closePhotoViewer() {
  els.photoOverlay.hidden = true;
  photoContext = null;
  photoTouchStartX = null;
  els.photoStage.innerHTML = "";
  els.photoCounter.textContent = "";
}

function startPhotoSwipe(event) {
  photoTouchStartX = event.changedTouches?.[0]?.clientX ?? null;
}

function endPhotoSwipe(event) {
  if (photoTouchStartX === null || !photoContext) return;
  const endX = event.changedTouches?.[0]?.clientX ?? photoTouchStartX;
  const delta = endX - photoTouchStartX;
  photoTouchStartX = null;
  if (Math.abs(delta) < 42) return;
  showPhoto(photoContext.index + (delta < 0 ? 1 : -1));
}

function findEntry(type, id) {
  const collection = type === "inventory" ? state.inventoryItems : state.shoppingItems;
  return collection.find((entry) => entry.id === id);
}

async function saveItemFromSheet(event) {
  event.preventDefault();
  if (!editContext) return;
  const name = els.itemName.value.trim();
  if (!name) return;
  const existing = editContext.id
    ? editContext.type === "inventory"
      ? state.inventoryItems.find((entry) => entry.id === editContext.id)
      : state.shoppingItems.find((entry) => entry.id === editContext.id)
    : null;
  const uploadedPhotos = await readSelectedPhotos();
  const photos = uploadedPhotos.length ? uploadedPhotos : existing?.photos || [];
  const mutations = [];
  if (editContext.id && !existing) {
    closeSheet();
    await refreshFromServer();
    showToast("Eintrag wurde bereits geändert");
    return;
  }

  if (editContext.type === "inventory") {
    const payload = {
      name,
      quantity: parseDecimal(els.itemQuantity.value, 0),
      unit: els.itemUnit.value.trim(),
      categoryId: els.itemCategory.value,
      location: els.itemLocation.value.trim(),
      minimumQuantity: parseDecimal(els.itemMinimum.value, 0),
      note: els.itemNote.value.trim(),
      photos,
      updatedAt: new Date().toISOString(),
    };
    let nextEntry;
    let eventEntry;
    if (editContext.id) {
      nextEntry = { ...existing, ...payload };
      state.inventoryItems = state.inventoryItems.map((entry) => (entry.id === editContext.id ? nextEntry : entry));
      eventEntry = logEvent("inventory_item.updated", `${name} im Bestand aktualisiert`);
    } else {
      nextEntry = { id: createId(), createdAt: new Date().toISOString(), ...payload };
      state.inventoryItems.unshift(nextEntry);
      eventEntry = logEvent("inventory_item.created", `${name} zum Bestand hinzugefügt`);
    }
    mutations.push({ type: "upsertInventory", item: nextEntry }, { type: "addEvent", event: eventEntry });
  } else {
    const payload = {
      name,
      quantity: els.itemQuantity.value.trim(),
      unit: els.itemUnit.value.trim(),
      categoryId: els.itemCategory.value,
      note: els.itemNote.value.trim(),
      shops: selectedShops(),
      photos,
      updatedAt: new Date().toISOString(),
    };
    let nextEntry;
    let eventEntry;
    if (editContext.id) {
      nextEntry = { ...existing, ...payload };
      state.shoppingItems = state.shoppingItems.map((entry) => (entry.id === editContext.id ? nextEntry : entry));
      eventEntry = logEvent("shopping_item.updated", `${name} aktualisiert`);
    } else {
      nextEntry = { id: createId(), status: "open", createdAt: new Date().toISOString(), purchasedAt: null, ...payload };
      state.shoppingItems.unshift(nextEntry);
      eventEntry = logEvent("shopping_item.created", `${name} zur Einkaufsliste hinzugefügt`);
    }
    mutations.push({ type: "upsertShopping", item: nextEntry }, { type: "addEvent", event: eventEntry });
  }

  closeSheet();
  render();
  commitMutations(mutations);
  showToast("Gespeichert");
}

function markPurchased(id) {
  const entry = state.shoppingItems.find((itemEntry) => itemEntry.id === id);
  if (!entry || entry.status !== "open" || pendingPurchaseIds.has(id)) return;
  pendingPurchaseIds.add(id);
  renderShopping();
  window.setTimeout(() => completePurchase(id), PURCHASE_CONFIRM_DELAY);
}

function completePurchase(id) {
  pendingPurchaseIds.delete(id);
  const now = new Date().toISOString();
  const entry = state.shoppingItems.find((itemEntry) => itemEntry.id === id);
  if (!entry || entry.status !== "open") {
    render();
    return;
  }
  entry.status = "purchased";
  entry.purchasedAt = now;
  entry.updatedAt = now;
  const adjustmentEvent = increaseMatchingInventory(entry);
  const purchaseEvent = logEvent("shopping_item.purchased", `${entry.name} gekauft`);
  render();
  commitMutations([
    { type: "purchaseShopping", id, purchasedAt: now },
    { type: "addEvent", event: adjustmentEvent },
    { type: "addEvent", event: purchaseEvent },
  ]);
  showToast(`${entry.name} als gekauft markiert`);
}

function reopenItem(id) {
  const entry = state.shoppingItems.find((itemEntry) => itemEntry.id === id);
  if (!entry) return;
  const now = new Date().toISOString();
  entry.status = "open";
  entry.purchasedAt = null;
  entry.updatedAt = now;
  const event = logEvent("shopping_item.reopened", `${entry.name} erneut geöffnet`);
  render();
  commitMutations([{ type: "reopenShopping", id, updatedAt: now }, { type: "addEvent", event }]);
  showToast("Wieder geöffnet");
}

function deleteShopping(id) {
  const entry = state.shoppingItems.find((itemEntry) => itemEntry.id === id);
  const deletedEntry = entry ? cloneData(entry) : null;
  const deletedAt = new Date().toISOString();
  state.shoppingItems = state.shoppingItems.filter((itemEntry) => itemEntry.id !== id);
  const event = entry ? logEvent("shopping_item.deleted", `${entry.name} gelöscht`, { itemId: id, itemType: "shopping" }) : null;
  render();
  commitMutations([{ type: "deleteShopping", id, deletedAt }, { type: "addEvent", event }]);
  if (deletedEntry) {
    showToast(`${deletedEntry.name} gelöscht`, {
      label: "Rückgängig",
      action: () => restoreDeletedItem("shopping", deletedEntry),
    });
  }
}

function deleteInventory(id) {
  const entry = state.inventoryItems.find((itemEntry) => itemEntry.id === id);
  const deletedEntry = entry ? cloneData(entry) : null;
  const deletedAt = new Date().toISOString();
  state.inventoryItems = state.inventoryItems.filter((itemEntry) => itemEntry.id !== id);
  const event = entry ? logEvent("inventory_item.deleted", `${entry.name} aus Bestand gelöscht`, { itemId: id, itemType: "inventory" }) : null;
  render();
  commitMutations([{ type: "deleteInventory", id, deletedAt }, { type: "addEvent", event }]);
  if (deletedEntry) {
    showToast(`${deletedEntry.name} gelöscht`, {
      label: "Rückgängig",
      action: () => restoreDeletedItem("inventory", deletedEntry),
    });
  }
}

function restoreDeletedItem(type, entry) {
  const restoredEntry = { ...entry, updatedAt: new Date().toISOString() };
  const isInventory = type === "inventory";
  const collection = isInventory ? state.inventoryItems : state.shoppingItems;
  const deletedCollection = isInventory ? "inventoryItems" : "shoppingItems";
  if (!collection.some((itemEntry) => itemEntry.id === restoredEntry.id)) {
    collection.unshift(restoredEntry);
  }
  if (state.deletedItems?.[deletedCollection]) {
    delete state.deletedItems[deletedCollection][restoredEntry.id];
  }
  const event = logEvent(
    isInventory ? "inventory_item.restored" : "shopping_item.restored",
    `${restoredEntry.name} wiederhergestellt`
  );
  render();
  commitMutations([
    { type: isInventory ? "restoreInventory" : "restoreShopping", item: restoredEntry },
    { type: "addEvent", event },
  ]);
  showToast("Wiederhergestellt");
}

function restoreFromHistory(type, id) {
  const record = deletedRecord(type, id);
  if (!record?.item) {
    showToast("Nicht mehr wiederherstellbar");
    return;
  }
  restoreDeletedItem(type, record.item);
}

function deletedRecord(type, id) {
  const collection = type === "inventory" ? "inventoryItems" : "shoppingItems";
  return state.deletedItems?.[collection]?.[id] || null;
}

function adjustInventory(id, delta) {
  const entry = state.inventoryItems.find((itemEntry) => itemEntry.id === id);
  if (!entry) return;
  const updatedAt = new Date().toISOString();
  const step = ["kg", "liter", "l"].includes(String(entry.unit).toLowerCase()) ? 0.5 : 1;
  entry.quantity = Math.max(0, Number(entry.quantity || 0) + delta * step);
  entry.updatedAt = updatedAt;
  const event = logEvent("inventory_item.adjusted", `${entry.name} Bestand auf ${formatNumber(entry.quantity)} ${entry.unit || ""}`.trim());
  render();
  commitMutations([{ type: "adjustInventory", id, delta, updatedAt }, { type: "addEvent", event }]);
}

function addInventoryToShopping(id) {
  const entry = state.inventoryItems.find((itemEntry) => itemEntry.id === id);
  if (!entry) return;
  const now = new Date().toISOString();
  const shoppingEntry = {
    id: createId(),
    name: entry.name,
    quantity: entry.minimumQuantity || "",
    unit: entry.unit || "",
    categoryId: entry.categoryId,
    note: entry.location ? `Lagerort: ${entry.location}` : "",
    shops: [],
    photos: entry.photos || [],
    status: "open",
    createdAt: now,
    purchasedAt: null,
    updatedAt: now,
  };
  state.shoppingItems.unshift(shoppingEntry);
  const event = logEvent("shopping_item.created", `${entry.name} aus Bestand zur Einkaufsliste hinzugefügt`);
  render();
  commitMutations([{ type: "upsertShopping", item: shoppingEntry }, { type: "addEvent", event }]);
  showToast("Zur Einkaufsliste hinzugefügt");
}

function increaseMatchingInventory(entry) {
  const match = state.inventoryItems.find((inventoryEntry) => normalize(inventoryEntry.name) === normalize(entry.name));
  if (!match || !entry.quantity) return;
  const amount = parseDecimal(entry.quantity, 0);
  if (!amount) return;
  match.quantity = Number(match.quantity || 0) + amount;
  match.updatedAt = new Date().toISOString();
  return logEvent("inventory_item.adjusted", `${match.name} automatisch auf ${formatNumber(match.quantity)} ${match.unit || ""}`.trim());
}

function openSearch() {
  els.searchOverlay.hidden = false;
  els.globalSearch.value = "";
  renderSearch();
  setTimeout(() => els.globalSearch.focus(), 80);
}

function closeSearch() {
  els.searchOverlay.hidden = true;
}

function exportData() {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `household-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed.shoppingItems) || !Array.isArray(parsed.inventoryItems)) throw new Error("Invalid backup");
      const importedState = normalizeState({
        shoppingItems: parsed.shoppingItems,
        inventoryItems: parsed.inventoryItems,
        events: Array.isArray(parsed.events) ? parsed.events : [],
      });
      state = importedState;
      render();
      await replaceServerState(importedState);
      showToast("Import abgeschlossen");
    } catch {
      showToast("Import fehlgeschlagen");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function logEvent(type, label, meta = {}) {
  const event = {
    id: createId(),
    type,
    label,
    createdAt: new Date().toISOString(),
    ...meta,
  };
  state.events.unshift(event);
  state.events = state.events.slice(0, 120);
  return event;
}

function getCategory(id) {
  return categories.find((category) => category.id === id) || categories.at(-1);
}

function normalizeShops(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((shop) => shops.includes(shop));
}

function selectedShops() {
  return $$('input[name="shops"]:checked').map((input) => input.value);
}

function setSelectedShops(value) {
  const selected = new Set(normalizeShops(value));
  $$('input[name="shops"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function shopBadges(value) {
  const selected = normalizeShops(value);
  if (!selected.length) return "";
  return `<div class="shop-badges">${selected.map((shop) => `<span>${escapeHtml(shop)}</span>`).join("")}</div>`;
}

function shopLogo(shop) {
  const file = shopLogoFiles[shop];
  const key = normalize(shop) || "shop";
  if (!file) return "";
  return `<span class="shop-logo shop-logo-${escapeHtml(key)}" aria-hidden="true"><img src="./assets/shop-logos/${escapeHtml(file)}" alt="" /></span>`;
}

function iconSvg(name) {
  const icons = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>',
    store: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 7 2-4h16l2 4" /><path d="M3 7h18" /><path d="M5 7v14h14V7" /><path d="M9 21v-7h6v7" /></svg>',
    layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 5-9 5-9-5z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg>',
  };
  return icons[name] || "";
}

function productThumbnail(entry, category, type, extraClass = "") {
  const photo = entry.photos?.[0];
  if (photo) {
    const count = entry.photos.length;
    return `
      <button class="product-icon photo-thumb ${escapeHtml(extraClass)}" data-open-photos data-photo-type="${escapeHtml(type)}" data-photo-id="${escapeHtml(entry.id)}" data-photo-index="0" type="button" aria-label="${escapeHtml(`${entry.name} Foto öffnen`)}">
        <img src="${escapeHtml(photo)}" alt="" />
        ${count > 1 ? `<span class="photo-count">${count}</span>` : ""}
      </button>
    `;
  }
  return `<span class="product-icon ${escapeHtml(extraClass)}" aria-hidden="true">${category.icon}</span>`;
}

function itemSignals(entry) {
  const signals = [];
  const photoCount = entry.photos?.length || 0;
  if (photoCount) signals.push(`${photoCount} Foto${photoCount === 1 ? "" : "s"}`);
  if (String(entry.note || "").trim()) signals.push("Notiz");
  if (!signals.length) return "";
  return `<div class="item-signals">${signals.map((signal) => `<span>${escapeHtml(signal)}</span>`).join("")}</div>`;
}

async function previewSelectedPhotos() {
  const photos = await readSelectedPhotos();
  els.photoFileSummary.textContent = photos.length ? `${photos.length} ausgewählt` : "Bis zu 6 Bilder";
  renderPhotoPreview(photos);
}

function renderPhotoPreview(photos) {
  els.photoPreview.innerHTML = photos.length
    ? photos.map((photo) => `<img src="${escapeHtml(photo)}" alt="Produktfoto Vorschau" />`).join("")
    : `<span>Keine Fotos ausgewählt</span>`;
}

async function readSelectedPhotos() {
  const files = [...(els.itemPhotos.files || [])].filter((file) => file.type.startsWith("image/")).slice(0, 6);
  return Promise.all(files.map((file) => resizeImage(file)));
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.onerror = reject;
      image.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function quantityText(entry) {
  return [entry.quantity, entry.unit].filter(Boolean).join(" ");
}

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function parseDecimal(value, fallback) {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function relativeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowStart - dateStart) / 86400000);
  if (diffDays === 0) return `Heute, ${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return "Gestern";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function emptyState(title, text) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(text)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, action = null) {
  els.toast.innerHTML = action
    ? `<span>${escapeHtml(message)}</span><button type="button">${escapeHtml(action.label || "Rückgängig")}</button>`
    : `<span>${escapeHtml(message)}</span>`;
  if (action) {
    els.toast.querySelector("button").addEventListener("click", () => {
      window.clearTimeout(showToast.timeout);
      els.toast.classList.remove("show");
      action.action();
    });
  }
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}
