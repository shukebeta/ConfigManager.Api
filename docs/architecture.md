# Architecture

## Overview

ConfigManager stores application configuration in Redis and propagates changes in real time over pub/sub. Three components collaborate:

```
┌───────────────────┐   read/write     ┌──────────────┐    ┌──────────────────────┐
│ ConfigManager.Web │ ───────────────▶ │ ConfigManager│ ◀──│ ConfigManager.Provider│
│ (Vue UI)          │                  │ .Api (Node)  │    │ (.NET app, via NuGet) │
└───────────────────┘                  └──────┬───────┘    └──────────────────────┘
                                              │ ioredis
                                              ▼
                                       ┌──────────────┐
                                       │    Redis     │  keys: <project>:<namespace>:<setting>
                                       └──────────────┘
```

The Api is the only writer. Web and Provider subscribe to Redis pub/sub channels (keyed by the config key) to receive live updates.

## Key / data model

Every configuration value is a Redis string keyed by `<project>:<namespace>:<setting>`:

| Segment    | Meaning                            | Example        |
|------------|------------------------------------|----------------|
| `project`  | Consuming application / tenant     | `newwords.api` |
| `namespace`| Logical group (multi-level)        | `config:nlog`  |
| `setting`  | Leaf setting                       | `minlevel`     |

Full example: `newwords.api:config:nlog:minlevel` → `"Debug"`.

- **Project registry** — on every write the Api does `SADD config:projects <project>`, so `GET /projects` is O(1). `POST /projects/migrate` backfills this set from existing keys.
- **Type inference** — values are stored as strings; the Api infers the type on read (`integer`, `float`, `boolean`, `loglevel`, `array`, `object`, `string`, `null`) and returns both raw `value` and `parsedValue`.
- **Real-time** — writes pipeline `SET` + `PUBLISH` atomically; deletes `PUBLISH` the sentinel `__DELETED__`.
- **Conflict detection** — rejects a key that collides with an existing parent (`parent_exists`) or that would shadow existing children (`children_exist`).

## Api surface

Mounted in `src/index.js`:

- `GET /health`
- `GET /projects` — registered projects.
- `GET /projects/:project/configs` — all configs for a project, grouped by namespace, with inferred types.
- `POST /projects/migrate` — backfill `config:projects` from existing keys.
- `GET /redis/:key` — read one value.
- `POST /redis/:key` — create (atomic set + publish + register project; guards: key-exists + naming-conflict).
- `PUT /redis/:key` — update.
- `DELETE /redis/:key` — delete + publish `__DELETED__`.
- `DELETE /redis/:key/children` — delete all keys under a namespace (preserves the parent key).

## Provider boundary

`ConfigManager.Provider` is **not** part of this monorepo. It remains a standalone OSS repo consumed via NuGet, keeping the OSS ↔ possibly-commercial boundary as a repo boundary (future commercialization of Api/Web needs no license/history untangling).
