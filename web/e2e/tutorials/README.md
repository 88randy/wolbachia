# How-to tutorials: clips and recorder

The "How does it work?" button (`src/tutorials/`) opens a modal with an animated step diagram
and one short video per step. This folder regenerates the videos.

## Add a tutorial to a module

1. Add its id to `src/tutorials/tutorial-routes.ts` and map the route(s) it belongs to.
2. Describe its steps in `src/tutorials/definitions/<module>.ts` (steps, `next` links, `isDecision`,
   `hasClip: false` for steps with nothing to record) and register the file in `definitions/index.ts`.
3. Add the copy in `packages/i18n` (area `tutorials`, es-MX and en): `tutorials.<id>.title` and
   `tutorials.<id>.<step>.label` / `.caption` for every step. Captions are short, plain Spanish.
4. Add a clip script per step in `e2e/tutorials/<module>.steps.ts` (keys `<tutorial>/<step>`) and a
   `<module>.rec.ts` like `inventory.rec.ts`.
5. Run the recorder.

The button appears by itself in the page header (`PageHeader`) on every mapped route.

## Regenerate the clips

Needs the app running (web `http://127.0.0.1:5173`, API 8000), `ffmpeg` on PATH and the demo
credentials file (never committed):

```
TUTORIALS_CREDENTIALS_FILE=<path to demo-credentials.local.md> \
  npm run tutorials:record -- inventory            # one module (inventory | modules)
  npm run tutorials:record -- -g "moveTransfer"    # one tutorial
```

Use `TUTORIALS_BASE_URL` to point to another web address. Output: `public/tutorials/<module>/<tutorial>/<step>.webm`
plus a `.webp` poster. Re-run after any UI change of the screens a tutorial shows. Captions are NOT in
the video (they come from i18n), so changing copy needs no re-recording.

How it works: per step, a fresh browser context signs in on an unrecorded page, then a second page
opens the start route and the script runs with a visible fake cursor and slow typing. The raw video is
shrunk with ffmpeg (VP9, 1280 px, 15 s at most, no audio).

## Data safety

Only demo data. Records the scripts type are named `TUT-...`. **No inventory script saves
anything**: each stops before the final button (the step "save" only points at it). If a future
script must save, set `mutates: true` and list it here.
