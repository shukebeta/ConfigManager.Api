# ConfigManager

A Redis-backed configuration management system with real-time updates, multi-project isolation, and a .NET provider for seamless application integration.

## Repository layout (monorepo)

| Path | Component | Stack |
|------|-----------|-------|
| [`ConfigManager.Api/`](ConfigManager.Api/) | REST API — the sole writer to Redis | Node.js, ioredis, Express |
| [`ConfigManager.Web/`](ConfigManager.Web/) | Web UI for browsing/editing configs | Vue 3, Vite, TypeScript |
| `ConfigManager.Provider` | .NET configuration provider — **separate OSS repo**, consumed via NuGet | .NET |

Config keys use the format `<project>:<namespace>:<setting>` (e.g. `newwords.api:config:nlog:minlevel`). The Api stores values in Redis and publishes changes over pub/sub so subscribers (Web, Provider) update in real time.

See [`docs/architecture.md`](docs/architecture.md) for the data model and [`CLAUDE.md`](CLAUDE.md) for an agent-grounded system overview.

## Develop

Each component is independent — install and run from its own directory:

```bash
# Api (needs Redis on :6379)
cd ConfigManager.Api && npm install && npm run dev   # http://localhost:3001

# Web
cd ConfigManager.Web && npm install && npm run dev   # http://localhost:5173
```

## CI

Path-filtered: `ConfigManager.Api/**` triggers [`ci-api.yml`](.github/workflows/ci-api.yml) (Redis service + jest), `ConfigManager.Web/**` triggers [`ci-web.yml`](.github/workflows/ci-web.yml) (vitest). Neither fires on the other's paths.
