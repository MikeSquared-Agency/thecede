```
  |    |                            |
  __|  __ \    _ \   __|   _ \   _` |   _ \
  |   | | |   __/  (     __/  (   |   __/
 \__|_| |_| \___| \___| \___| \__,_| \___|
```

# thecede

Real-time graph explorer for [Cortex](https://github.com/MikeSquared-Agency/cortex) — the embedded graph memory engine for AI agents.

Watch your agent's knowledge graph grow live: nodes appear, edges auto-link, trust scores shift — all streamed over SSE straight from Cortex.

## Features

- **Live graph canvas** — D3 force-directed layout with real-time node/edge animation
- **Activity stream** — SSE-powered feed of every mutation as it happens
- **Built-in terminal** — query nodes, search, inspect edges without leaving the browser
- **Graph search** — vector + keyword hybrid search with kind filters
- **Node detail panel** — full metadata, body, tags, trust score, connected edges
- **WebMCP support** — exposes Cortex tools to in-browser agents via `navigator.modelContext`

## Quick start

### Prerequisites

- **Node.js ≥ 18.17** (check with `node -v`)
- **A running Cortex server** — [install guide](https://github.com/MikeSquared-Agency/cortex#run)

### 1. Clone & install

```bash
git clone https://github.com/MikeSquared-Agency/thecede.git
cd thecede
npm install
```

### 2. Configure

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CORTEX_URL` | `http://localhost:9091` | URL the **browser** uses to reach Cortex (SSE + direct calls) |
| `CORTEX_BACKEND_URL` | _(falls back to above)_ | URL the **Next.js server** uses to proxy REST calls (useful inside Docker) |

### 3. Run

```bash
npm run dev          # development (http://localhost:3000)
npm run build        # production build
npm start            # serve production build
```

## Docker

```bash
# Build
docker build -t thecede \
  --build-arg NEXT_PUBLIC_CORTEX_URL=http://YOUR_CORTEX_HOST:9091 .

# Run
docker run -p 3000:3000 \
  -e CORTEX_BACKEND_URL=http://cortex:9091 \
  thecede
```

Or with `docker compose` alongside Cortex:

```yaml
services:
  cortex:
    image: ghcr.io/MikeSquared-Agency/cortex:latest
    ports: ["9091:9091"]

  thecede:
    build:
      context: .
      args:
        NEXT_PUBLIC_CORTEX_URL: http://localhost:9091
    ports: ["3000:3000"]
    environment:
      CORTEX_BACKEND_URL: http://cortex:9091
    depends_on: [cortex]
```

## For agents

Point your agent at the Cortex server directly (not thecede). thecede is a **read-only observer** — it watches the same graph your agent writes to.

**Setup for your agent:**

1. Start Cortex: `cortex serve`
2. Start thecede: `npm start` (or Docker)
3. Give your agent the Cortex URL (`http://localhost:9091`)
4. Open thecede in your browser (`http://localhost:3000`) and watch

The graph updates in real-time via SSE — no polling, no refresh needed.

### WebMCP (experimental)

If the browser supports `navigator.modelContext` (Chrome with the WebMCP flag), thecede registers Cortex tools so in-browser agents can read/write the graph directly through the UI.

## Architecture

```
┌─────────────┐     SSE stream      ┌──────────────┐
│   Browser    │◄───────────────────►│    Cortex    │
│  (thecede)   │    REST (proxy)     │   :9091      │
│   :3000      ├────────────────────►│              │
└─────────────┘                      └──────────────┘
       │                                    ▲
       │  Next.js API route                 │
       │  /api/cortex/*  ──────────────────►│
       │  (server-side proxy)
```

- **SSE** connects directly from browser → Cortex (requires CORS)
- **REST** goes through the Next.js API proxy to avoid mixed-content issues
- Cortex must have CORS enabled for the browser's origin

## Tech stack

Next.js 16 · React 19 · TypeScript · D3.js · Zustand · Tailwind CSS 4 · shadcn/ui

## License

MIT
