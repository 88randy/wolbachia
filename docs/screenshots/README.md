# Synthetic browser screenshots

`W05-notifications-light.png` and `W05-notifications-dark.png` show synthetic
W5 inbox/preferences fixtures from `web/e2e/w-08.spec.ts`. The journey covers
light/dark, es-MX/en, keyboard focus/return, axe, +30% text and 320 CSS pixels.
These images do not establish live producer or email-delivery acceptance.

The `w160-*` images show W30, W31 and W33 using service-free synthetic R7
fixtures from `web/e2e/w-19-api.ts`. Light/es-MX and dark/en are representative
views; `web/e2e/w-19.spec.ts` checks all four theme/language combinations.
These images demonstrate UI layout, not live API or production acceptance.

The `w30-w34-*` images show scanner-first W34 reception with the synthetic
fixture in `web/e2e/lab-reception.spec.ts`. The same journey checks light/dark,
es-MX/en, 320/1280 CSS pixels, expanded boolean field facts and no-paddle form,
keyboard focus, axe and +30% text. No physical scanner or live Lab API is implied.
