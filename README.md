# MallMap Navigator

MallMap Navigator is a React + TypeScript + Vite demo web app for exploring a fictional two-floor mall, searching items, visualizing a walkable navigation graph, generating shortest walking routes, and stepping through a minimum spanning tree (MST) computation.

## Run locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually http://localhost:5173).

### Arch Linux quick start

```bash
# 1. Tools: Node.js + npm + git
sudo pacman -Syu --needed nodejs npm git

# 2. Voices for text-to-speech (browsers on Linux talk through speech-dispatcher)
sudo pacman -S --needed speech-dispatcher espeak-ng

# 3. Get the code and run it
git clone https://github.com/sohampilot/My-Store-map.git
cd My-Store-map
npm install
npm run dev
```

Then open http://localhost:5173. To test on a phone on the same Wi-Fi, run `npm run dev -- --host`
and open the "Network" URL Vite prints (allow port 5173 in your firewall if you use one).

For a production build: `npm run build && npm run preview` (serves `dist/` on http://localhost:4173).

### No sound from the voice guide (Linux)

Browsers on Linux have no built-in voices; they talk through **speech-dispatcher**. The app shows a
"Sound check" in **Settings → Voice guidance** with the number of voices it found and what went wrong.

1. Check system volume / output device (`pavucontrol`).
2. Install the engine: `sudo pacman -S --needed speech-dispatcher espeak-ng`
3. Test outside the browser: `spd-say "hello"`. If silent, run `spd-conf` and pick `espeak-ng` as
   the default module (or set `DefaultModule espeak-ng` in `~/.config/speech-dispatcher/speechd.conf`).
4. **Firefox** works out of the box (`media.webspeech.synth.enabled` must be `true` in `about:config`).
   **Chromium / Chrome / Brave** need a flag on Linux. Fully quit the browser and start it with
   `--enable-speech-dispatcher`, or make it permanent:
   ```bash
   echo "--enable-speech-dispatcher" >> ~/.config/chromium-flags.conf   # Chromium
   echo "--enable-speech-dispatcher" >> ~/.config/brave-flags.conf      # Brave
   echo "--enable-speech-dispatcher" >> ~/.config/chrome-flags.conf     # google-chrome (AUR)
   ```
5. Fully restart the browser and press **Settings → Test voice**.

## Scripts

- `npm run dev` – start development server
- `npm run build` – typecheck and production build
- `npm run preview` – preview production build
- `npm run test` – run Vitest tests
- `npm run typecheck` – TypeScript check
- `npm run lint` – oxlint

## Features

- Interactive SVG mall map with floor selector, pan/zoom/reset
- 8 stores, multiple sections, facilities, entrances, stairs, elevator
- Search across 40+ sample items by name/category/keyword/store
- Full location output: `Floor → Store → Section → Aisle/Shelf`
- Route mode with Dijkstra shortest path and accessible-route filtering
- Google-Maps-style turn-by-turn directions (turn left/right, bear left/right, enter/leave store,
  take the elevator or stairs up/down, arrival with aisle) with distances and walking-time estimate
- Voice guidance (text-to-speech) using the browser's built-in Web Speech API – free, no API key:
  - Start / pause / resume guidance, Back, Next, Repeat, Read all, listen to any single step
  - "Simulate walk" moves a "you are here" marker along the route, speaks each turn as it is reached
    and gives "In 10 meters, turn left…" warnings; the map follows you between floors
  - Voice, speaking rate and volume settings (saved in the browser), optional auto-announce
- Multi-stop trips (Trip tab): add up to 12 items, pick a start, and watch a minimum spanning tree being
  built step by step over the real walking distances between the start and every stop (Kruskal on the
  all-pairs shortest-path distances). The tree is walked from the start (nearest branch first) to get a
  visiting order, optionally shortened with 2-opt, then turned into one continuous voice-guided route
  ("Stop 2 of 4 … Pick up Laptop (Aisle 2) and Mouse (Aisle 3). Next, …"). Items in the same section are
  grouped into one stop; unreachable stops are reported; optional return to the start.
- Compact single-screen layout: tabs (Find · Trip · Directions · Explore), full-height map, and a
  Settings drawer for route options, voice, simulated walk, map, theme and the demo data editor
- Map: drag to pan, scroll to zoom, walkway graph, start/destination pins, route arrows,
  "route continues on Floor N" shortcut, live MST step playback on the map
- MST mode with Kruskal + union-find, deterministic tie-breaking, and step playback
- Connected-components handling (minimum spanning forest when disconnected)
- Local demo edit mode (items, stores, sections, nodes/edges, edge weights)
- localStorage persistence + reset/import/export JSON with validation
- Light/dark theme and accessible non-visual location list

## Architecture overview

- `src/algorithms/`: pure graph algorithms (`kruskal`, `dijkstra`, `unionFind`), `directions` (turn-by-turn text)
  and `multiStop` (trip planner: all-pairs distances, stop MST, tree order, 2-opt, stitched route)
- `src/models/`: typed data model
- `src/data/`: fictional sample dataset JSON
- `src/services/`: replaceable `DataService` + `LocalDataService`
- `src/hooks/`: app data loading/persistence (`useMallData`), text-to-speech (`useSpeech`) and guidance (`useGuidance`)
- `src/components/`: map, `NavigationPanel` (directions + voice controls) and supporting UI
- `src/utils/validation.ts`: import/edit validation
- `src/tests/`: Vitest algorithm and data-validation tests

## MST vs shortest-path mode

- **MST mode**: graph-structure visualization connecting all navigation nodes using minimum total edge weight. It does **not** represent user route guidance.
- **Trip MST** (Trip tab): an MST over the start and your chosen stops, where each link's weight is the
  shortest walking distance between them. It is used to pick a visiting order; the walking route itself
  always follows real corridors.
- **Route mode**: shortest walkable path from a selected start node to an item location using Dijkstra, optionally accessibility-filtered.

## Demo limitations

- Fictional mall and sample data only.
- Local demo edit mode is intentionally simple and stored in browser localStorage.
- No backend, external maps, paid services, or API keys.
- There is no indoor positioning (GPS does not work inside malls), so guidance is step-by-step or simulated.
- Voice quality depends on the voices installed on the device/browser.
