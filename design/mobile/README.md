# Mobile design (Ronda 1) — exported from Claude Design

Source of truth for visuals is the Claude Design canvas "Wolbachia · App Repartidor" (claude.ai). This folder is a snapshot so the code can follow it.

## How to use it
- `screens/*.png`: one image per board (each phone frame = 360 × 800 dp). Read the PNG of the screen you are implementing.
- `source/codequim.css`: **design tokens** (`:root` variables: colors, font sizes, radii) and component classes. `packages/tokens` must be derived from these values; do not invent new ones.
- `source/*.dc.html`: exact markup, copy and states of each board. Use it to get texts, order of elements and states. It is reference HTML, not production code (React Native rebuilds it with native components).
- `source/R*.dc.html` + `Proto.dc.html`: interactive prototypes of the 7 test routes (only run inside Claude Design; read them for flow logic: `renderVals()` lists the screen order).
- `source/canvas.json`: index of boards and titles.

## Board → screens → issues
| Board | Screens | Epic / issue |
|---|---|---|
| Main | Design system: tokens, object states, components | #6 (mobile bootstrap), packages/tokens |
| S01-Acceso | P1–P2 login, unlock | #7 |
| S02-Inicio, S03-Moto, S04-Insumos | P3–P8 open shift | #8 |
| S05-Dia | P9–P10 day view, map | #8 |
| S06-Escaner | P11, P12, P21 scanner, supply, invalid code | #9 |
| S07-Colocar | P13 place ovitrap | #9 |
| S08-Revisar | P14 check ovitrap (pending: Yes/No eggs step, issue #14) | #9, #14 |
| S09-Ovitrampa | P15–P17 replace, relocate, remove | #9 |
| S10-Liberar | P18–P20 release, blocked release, sample | #10 |
| S11-Fijos | P22–P25 fuel, incident, emergency, community | #11 |
| S12-Cierre | P26–P27 close shift | #8 |
| S13-Sistema | P28–P32 inbox, history, trainings, settings, speed lock | #6, #11 |
| S14-Globales | Global states (no signal, GPS, battery, storage, clock, update, session) | #6 |
| S15-Ingles | English samples P9, P14, P26 | i18n |
| S16-Accesibilidad | Dark mode, 130 % text | #6 |

## Known gaps
- P14 does not yet include the "Has eggs? Yes/No" step (issue #14). Follow the issue, not the PNG, for that step.
- Logo: placeholder; real Codequim logo file pending.
- Font: Inter (to bundle in the app). PNGs were rendered with a fallback font, so spacing can differ slightly.
