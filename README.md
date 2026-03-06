# Lily Graph Explorer

An interactive force-directed knowledge graph visualization built with D3.js v7, powered by cortex data.

**Live site:** [lily-cortex.surge.sh](https://lily-cortex.surge.sh)

## Features

- **Force-directed graph** — 300 nodes with physics-based layout
- **Interactive** — zoom, pan, drag nodes, click for details
- **Search** — real-time sidebar search with highlighting
- **Fit-to-view** — auto-zoom to fit all nodes after simulation settles
- **Node wobble** — subtle ambient animation
- **Twitch-style chat** — floating chat stream overlay
- **Tabbed UI** — Graph, How It Works, and Suggest tabs
- **Responsive** — works on desktop and mobile

## How it works

1. `build-lily-graph.py` reads a cortex export JSON file (834 nodes, 30k+ edges)
2. Filters to the top 300 most important nodes
3. Embeds the graph data + D3.js visualization into a single self-contained HTML file
4. Deployed to [lily-cortex.surge.sh](https://lily-cortex.surge.sh) via Surge

## Building

```bash
# You need a cortex-fresh-export.json in this directory
python build-lily-graph.py
# Output: lily-cortex-fixed.html
```

## Stack

- **D3.js v7** — force simulation, zoom, drag
- **Python 3** — build script (data processing + HTML generation)
- **Surge** — static hosting

## License

MIT
