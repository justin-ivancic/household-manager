from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("HOUSEHOLD_DATA_DIR", ROOT / "data"))
DB_PATH = DATA_DIR / "household-manager.sqlite"
STATE_ID = "default"
MAX_BODY_BYTES = 12 * 1024 * 1024
STATE_LOCK = threading.Lock()
DELETED_ITEMS_KEY = "deletedItems"
COLLECTIONS = ("shoppingItems", "inventoryItems")
STATIC_PATHS = {
    "/": "index.html",
    "/index.html": "index.html",
    "/styles.css": "styles.css",
    "/app.js": "app.js",
}
SHOP_LOGO_FILES = ("dm.svg", "rewe.svg", "edeka.svg", "lidl.svg", "aldi.svg", "rossmann.svg", "hornbach.svg", "apotheke.svg")
STATIC_PATHS.update({f"/assets/shop-logos/{file_name}": f"assets/shop-logos/{file_name}" for file_name in SHOP_LOGO_FILES})


SEED_STATE = {
    "shoppingItems": [
        {"name": "Toilettenpapier", "quantity": "", "unit": "", "categoryId": "haushalt", "status": "open", "shops": ["Rewe"]},
        {"name": "Bananen", "quantity": "6", "unit": "Stück", "categoryId": "obst", "status": "open", "shops": ["Lidl", "Aldi"]},
        {"name": "Duschgel", "quantity": "", "unit": "", "categoryId": "bad", "status": "open", "shops": ["DM", "Rossmann"]},
        {"name": "Zahnbürsten", "quantity": "2", "unit": "Stück", "categoryId": "hygiene", "status": "open", "shops": ["DM"]},
        {"name": "Kiwis", "quantity": "", "unit": "", "categoryId": "obst", "status": "open", "shops": ["Edeka"]},
    ],
    "inventoryItems": [
        {"name": "Milch", "quantity": 6, "unit": "Packungen", "categoryId": "milchprodukte", "location": "Küche", "minimumQuantity": 3},
        {"name": "Eier", "quantity": 30, "unit": "Stück", "categoryId": "vorrat", "location": "Küche", "minimumQuantity": 12},
        {"name": "Marmelade", "quantity": 3, "unit": "Gläser", "categoryId": "lebensmittel", "location": "Speisekammer", "minimumQuantity": 1},
        {"name": "Hähnchen", "quantity": 2, "unit": "kg", "categoryId": "fleisch", "location": "Gefrierschrank", "minimumQuantity": 1},
        {"name": "Tomaten", "quantity": 12, "unit": "Dosen", "categoryId": "vorrat", "location": "Keller", "minimumQuantity": 4},
        {"name": "Duschgel", "quantity": 1, "unit": "Flasche", "categoryId": "bad", "location": "Bad", "minimumQuantity": 2},
    ],
    "events": [],
}


def connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_state (
            id TEXT PRIMARY KEY,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    return conn


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def timestamp(value: object) -> datetime:
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def parse_decimal(value: object, fallback: float = 0) -> float:
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return fallback


def normalize_text(value: object) -> str:
    return str(value or "").casefold().strip()


def deleted_items_template() -> dict:
    return {collection: {} for collection in COLLECTIONS}


def normalize_deleted_items(value: object) -> dict:
    normalized = deleted_items_template()
    if not isinstance(value, dict):
        return normalized
    for collection in COLLECTIONS:
        entries = value.get(collection, {})
        if not isinstance(entries, dict):
            continue
        for item_id, record in entries.items():
            if not item_id:
                continue
            if isinstance(record, dict):
                deleted_at = str(record.get("deletedAt") or now_iso())
                item = normalize_item(record.get("item"), collection) if record.get("item") else None
                normalized[collection][str(item_id)] = {"deletedAt": deleted_at, "item": item}
            else:
                normalized[collection][str(item_id)] = {"deletedAt": str(record), "item": None}
    return normalized


def normalize_event(event: object) -> dict | None:
    if not isinstance(event, dict):
        return None
    created_at = str(event.get("createdAt") or now_iso())
    normalized = {
        "id": str(event.get("id") or uuid.uuid4()),
        "type": str(event.get("type") or "event"),
        "label": str(event.get("label") or ""),
        "createdAt": created_at,
    }
    for key in ("itemId", "itemType"):
        if event.get(key):
            normalized[key] = str(event.get(key))
    return normalized


def normalize_item(item: object, collection: str) -> dict | None:
    if not isinstance(item, dict):
        return None
    current_time = now_iso()
    item_id = str(item.get("id") or uuid.uuid4())
    normalized = {
        "id": item_id,
        "name": str(item.get("name") or "Unbenannt"),
        "quantity": item.get("quantity", ""),
        "unit": str(item.get("unit") or ""),
        "categoryId": str(item.get("categoryId") or "sonstiges"),
        "note": str(item.get("note") or ""),
        "photos": item.get("photos") if isinstance(item.get("photos"), list) else [],
        "createdAt": str(item.get("createdAt") or current_time),
        "updatedAt": str(item.get("updatedAt") or current_time),
    }
    if collection == "shoppingItems":
        shops = item.get("shops")
        normalized.update(
            {
                "shops": shops if isinstance(shops, list) else [],
                "status": str(item.get("status") or "open"),
                "purchasedAt": item.get("purchasedAt") or None,
            }
        )
    else:
        normalized.update(
            {
                "location": str(item.get("location") or ""),
                "minimumQuantity": item.get("minimumQuantity", 0),
            }
        )
    return normalized


def normalize_state(state: object, include_deleted_items: bool = True) -> dict:
    if not isinstance(state, dict):
        state = {}
    deleted_items = normalize_deleted_items(state.get(DELETED_ITEMS_KEY))
    normalized = {}
    for collection in COLLECTIONS:
        if not isinstance(state.get(collection), list):
            raise ValueError(f"{collection} must be a list")
        by_id: dict[str, dict] = {}
        for item in state.get(collection, []):
            normalized_item = normalize_item(item, collection)
            if not normalized_item:
                continue
            item_id = normalized_item["id"]
            deleted_record = deleted_items[collection].get(item_id)
            deleted_at = deleted_record.get("deletedAt") if isinstance(deleted_record, dict) else deleted_record
            if deleted_at and timestamp(deleted_at) >= timestamp(normalized_item.get("updatedAt")):
                continue
            existing = by_id.get(item_id)
            if not existing or timestamp(normalized_item.get("updatedAt")) >= timestamp(existing.get("updatedAt")):
                by_id[item_id] = normalized_item
        normalized[collection] = list(by_id.values())

    events = [event for event in (normalize_event(entry) for entry in state.get("events", [])) if event]
    normalized["events"] = sorted(unique_events(events), key=lambda event: timestamp(event.get("createdAt")), reverse=True)[:120]
    if include_deleted_items:
        normalized[DELETED_ITEMS_KEY] = deleted_items
    return normalized


def public_state(state: dict) -> dict:
    payload = deepcopy(state)
    return payload


def unique_events(events: list[dict]) -> list[dict]:
    by_id = {}
    for event in events:
        event_id = event.get("id")
        if event_id and event_id not in by_id:
            by_id[event_id] = event
    return list(by_id.values())


def save_state(conn: sqlite3.Connection, state: dict) -> None:
    conn.execute(
        """
        INSERT INTO app_state (id, state_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          state_json = excluded.state_json,
          updated_at = CURRENT_TIMESTAMP
        """,
        (STATE_ID, json.dumps(state, ensure_ascii=False)),
    )


def load_state(conn: sqlite3.Connection) -> dict:
    row = conn.execute("SELECT state_json FROM app_state WHERE id = ?", (STATE_ID,)).fetchone()
    raw_state = json.loads(row[0]) if row else deepcopy(SEED_STATE)
    normalized = normalize_state(raw_state)
    if normalized != raw_state or not row:
        save_state(conn, normalized)
    return normalized


def read_state() -> dict:
    with STATE_LOCK:
        with connection() as conn:
            return public_state(load_state(conn))


def write_state(state: dict) -> dict:
    normalized = normalize_state(state, include_deleted_items=False)
    normalized[DELETED_ITEMS_KEY] = deleted_items_template()
    with STATE_LOCK:
        with connection() as conn:
            save_state(conn, normalized)
    return public_state(normalized)


def merge_legacy_state(state: dict) -> dict:
    normalized = normalize_state(state, include_deleted_items=False)
    with STATE_LOCK:
        with connection() as conn:
            current_state = load_state(conn)
            for collection in COLLECTIONS:
                for item in normalized[collection]:
                    upsert_item(current_state, collection, item)
            for event in normalized.get("events", []):
                add_event(current_state, event)
            current_state = normalize_state(current_state)
            save_state(conn, current_state)
            return public_state(current_state)


def upsert_item(state: dict, collection: str, item: object) -> None:
    normalized_item = normalize_item(item, collection)
    if not normalized_item:
        raise ValueError("item must be an object")
    item_id = normalized_item["id"]
    if state[DELETED_ITEMS_KEY][collection].get(item_id):
        return
    items = state[collection]
    for index, existing in enumerate(items):
        if existing.get("id") != item_id:
            continue
        if timestamp(existing.get("updatedAt")) > timestamp(normalized_item.get("updatedAt")):
            return
        items[index] = normalized_item
        return
    items.insert(0, normalized_item)


def delete_item(state: dict, collection: str, item_id: object, deleted_at: object | None = None) -> None:
    if not item_id:
        raise ValueError("id is required")
    item_id = str(item_id)
    deletion_time = str(deleted_at or now_iso())
    existing_item = find_item(state[collection], item_id)
    if existing_item and timestamp(existing_item.get("updatedAt")) > timestamp(deletion_time):
        return
    state[collection] = [item for item in state[collection] if item.get("id") != item_id]
    deleted_items = state[DELETED_ITEMS_KEY][collection]
    existing_deleted_at = deleted_items.get(item_id)
    existing_deleted_at_value = existing_deleted_at.get("deletedAt") if isinstance(existing_deleted_at, dict) else existing_deleted_at
    if not existing_deleted_at_value or timestamp(deletion_time) >= timestamp(existing_deleted_at_value):
        deleted_items[item_id] = {"deletedAt": deletion_time, "item": deepcopy(existing_item) if existing_item else None}


def restore_item(state: dict, collection: str, item: object) -> None:
    normalized_item = normalize_item(item, collection)
    if not normalized_item:
        raise ValueError("item must be an object")
    state[DELETED_ITEMS_KEY][collection].pop(normalized_item["id"], None)
    upsert_item(state, collection, normalized_item)


def restore_item_by_id(state: dict, collection: str, item_id: object) -> None:
    if not item_id:
        raise ValueError("id is required")
    item_id = str(item_id)
    record = state[DELETED_ITEMS_KEY][collection].get(item_id)
    item = record.get("item") if isinstance(record, dict) else None
    if item:
        restore_item(state, collection, item)


def add_event(state: dict, event: object) -> None:
    normalized_event = normalize_event(event)
    if not normalized_event:
        raise ValueError("event must be an object")
    state["events"] = sorted(unique_events([normalized_event, *state["events"]]), key=lambda entry: timestamp(entry.get("createdAt")), reverse=True)[:120]


def find_item(items: list[dict], item_id: object) -> dict | None:
    item_id = str(item_id or "")
    return next((item for item in items if item.get("id") == item_id), None)


def purchase_shopping_item(state: dict, item_id: object, purchased_at: object | None = None) -> None:
    entry = find_item(state["shoppingItems"], item_id)
    if not entry or state[DELETED_ITEMS_KEY]["shoppingItems"].get(str(item_id)):
        return
    if entry.get("status") != "open":
        return
    purchase_time = str(purchased_at or now_iso())
    entry["status"] = "purchased"
    entry["purchasedAt"] = purchase_time
    entry["updatedAt"] = purchase_time
    increase_matching_inventory(state, entry)


def reopen_shopping_item(state: dict, item_id: object, updated_at: object | None = None) -> None:
    entry = find_item(state["shoppingItems"], item_id)
    if not entry or state[DELETED_ITEMS_KEY]["shoppingItems"].get(str(item_id)):
        return
    update_time = str(updated_at or now_iso())
    if timestamp(entry.get("updatedAt")) > timestamp(update_time):
        return
    entry["status"] = "open"
    entry["purchasedAt"] = None
    entry["updatedAt"] = update_time


def adjust_inventory_item(state: dict, item_id: object, delta: object, updated_at: object | None = None) -> None:
    entry = find_item(state["inventoryItems"], item_id)
    if not entry or state[DELETED_ITEMS_KEY]["inventoryItems"].get(str(item_id)):
        return
    step = 0.5 if str(entry.get("unit") or "").lower() in {"kg", "liter", "l"} else 1
    entry["quantity"] = max(0, parse_decimal(entry.get("quantity"), 0) + parse_decimal(delta, 0) * step)
    entry["updatedAt"] = str(updated_at or now_iso())


def increase_matching_inventory(state: dict, shopping_entry: dict) -> None:
    amount = parse_decimal(shopping_entry.get("quantity"), 0)
    if amount <= 0:
        return
    shopping_name = normalize_text(shopping_entry.get("name"))
    for entry in state["inventoryItems"]:
        if state[DELETED_ITEMS_KEY]["inventoryItems"].get(entry.get("id")):
            continue
        if normalize_text(entry.get("name")) != shopping_name:
            continue
        entry["quantity"] = parse_decimal(entry.get("quantity"), 0) + amount
        entry["updatedAt"] = str(shopping_entry.get("updatedAt") or now_iso())
        return


def apply_operation(state: dict, operation: object) -> None:
    if not isinstance(operation, dict):
        raise ValueError("operation must be an object")
    operation_type = operation.get("type")
    if operation_type == "upsertShopping":
        upsert_item(state, "shoppingItems", operation.get("item"))
    elif operation_type == "deleteShopping":
        delete_item(state, "shoppingItems", operation.get("id"), operation.get("deletedAt"))
    elif operation_type == "restoreShopping":
        restore_item(state, "shoppingItems", operation.get("item"))
    elif operation_type == "restoreShoppingById":
        restore_item_by_id(state, "shoppingItems", operation.get("id"))
    elif operation_type == "purchaseShopping":
        purchase_shopping_item(state, operation.get("id"), operation.get("purchasedAt"))
    elif operation_type == "reopenShopping":
        reopen_shopping_item(state, operation.get("id"), operation.get("updatedAt"))
    elif operation_type == "upsertInventory":
        upsert_item(state, "inventoryItems", operation.get("item"))
    elif operation_type == "deleteInventory":
        delete_item(state, "inventoryItems", operation.get("id"), operation.get("deletedAt"))
    elif operation_type == "restoreInventory":
        restore_item(state, "inventoryItems", operation.get("item"))
    elif operation_type == "restoreInventoryById":
        restore_item_by_id(state, "inventoryItems", operation.get("id"))
    elif operation_type == "adjustInventory":
        adjust_inventory_item(state, operation.get("id"), operation.get("delta"), operation.get("updatedAt"))
    elif operation_type == "addEvent":
        add_event(state, operation.get("event"))
    else:
        raise ValueError(f"unknown operation type: {operation_type}")


def apply_mutations(payload: dict) -> dict:
    operations = payload.get("operations") if isinstance(payload, dict) else None
    if not isinstance(operations, list):
        raise ValueError("operations must be a list")
    with STATE_LOCK:
        with connection() as conn:
            state = load_state(conn)
            for operation in operations:
                apply_operation(state, operation)
            state = normalize_state(state)
            save_state(conn, state)
            return public_state(state)


class HouseholdHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/api/state":
            self.send_json(read_state())
            return
        if path not in STATIC_PATHS:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path not in {"/api/state", "/api/mutations"}:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > MAX_BODY_BYTES:
                self.send_json({"error": "payload too large"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                return
            body = self.rfile.read(length).decode("utf-8")
            payload = json.loads(body)
            if path == "/api/mutations":
                self.send_json(apply_mutations(payload))
                return
            query = self.path.split("?", 1)[1] if "?" in self.path else ""
            if "replace=1" in query:
                self.send_json(write_state(payload))
            else:
                self.send_json(merge_legacy_state(payload))
            return
        except (json.JSONDecodeError, ValueError) as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self) -> None:
        path = self.path.split("?", 1)[0]
        if path in {"/", "/index.html", "/styles.css", "/app.js", "/api/state", "/api/mutations"}:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def translate_path(self, path: str) -> str:
        static_path = STATIC_PATHS.get(path.split("?", 1)[0], "index.html")
        return str(ROOT / static_path)


def main() -> None:
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), HouseholdHandler)
    print(f"household-manager listening on http://0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
