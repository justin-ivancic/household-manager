# household-manager

Mobile-first Haushalts-App für gemeinsame Einkaufslisten und Vorratsübersicht.

## Lokal starten

```bash
PORT=4173 HOUSEHOLD_DATA_DIR=./data python3 server.py
```

Dann im Browser öffnen:

```text
http://127.0.0.1:4173
```

## Docker

```bash
docker compose up --build
```

Die App läuft dann unter:

```text
http://localhost:8080
```

Die SQLite-Datenbank liegt im Docker-Volume `household-data`.

## QA

Mit laufendem Server:

```bash
QA_BASE_URL=http://127.0.0.1:4173 NODE_PATH=/Users/agent/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/agent/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node qa-smoke.js
```

Der Smoke-Test prüft mobile Kernflows inklusive Hinzufügen, Foto-Upload, Kaufen, Bestandssuche, Einstellungen und serverseitige Persistenz.
