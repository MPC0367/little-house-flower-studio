# Little House Flower: Studio and back end

This repo holds the **Studio** (the staff app) and the **back-end source**. The customer website is a separate repo.

- Studio: https://mpc0367.github.io/little-house-flower-studio/ (GitHub Pages publishes `docs/` on `main`)
- Website: https://mpc0367.github.io/Little-House-Flower/ (repo https://github.com/MPC0367/Little-House-Flower)

They were one repo until 14 October 2026; the history before that is in the website repo.

This is a client demonstration with synthetic data. The Studio opens without a password. Its `/api/` requests go through `docs/pages-sw.js` to the hosted demo back end, the same one the website uses. Do not use it for real customer data.

## What is here

- `hosted-backend/`: the source of the hosted demo back end and of the website and Studio files (`hosted-backend/public/`). Its build, migration and deployment steps are in `hosted-backend/README.md`. Runtime secrets and database contents are not in the repo.
- `local-preview/`: the earlier local application, kept for development.
- `docs/`: the published Studio. **Generated**; do not edit by hand.
- `scripts/build-studio-pages.mjs`: writes `docs/` from `hosted-backend/public/studio/` and `shared/`, with the paths set for `/little-house-flower-studio/`. The Studio's photographs are not copied: it uses the website's `/Little-House-Flower/img/` and `/media/`, which are on the same origin.
- `scripts/build-storefront.mjs`: writes `hosted-backend/public/storefront.js` (the website's one script) from the ordered source files listed in `scripts/storefront-sources.json`. Edit the sources, never `storefront.js`.
- `hosted-backend/public/shared/opening-film.js`: the opening film's rules, used by the website (`logo-intro.js`) and the Studio (`studio/opening.js`). The opening is the supplied film and nothing else: never a still picture, never on screen longer than the film; if the film cannot start within 2 s the page opens without it.
- `scripts/serve-pages.mjs`: a local stand-in for github.io with the website (`../site`) and the Studio (`docs/`) on one origin (preview `lhf-pages`, http://127.0.0.1:5590/Little-House-Flower/). It relays nothing to the hosted back end.
- `tests/opening-film.mjs`: the opening on the website and the Studio in four browsers, including a device that refuses video, a late or missing film and a background tab; run it against `serve-pages.mjs`.
- `scripts/pages/`: the Studio's loader and API bridge, from which the build makes `docs/pages-access.js` and `docs/pages-sw.js`.
- `scripts/build-github-pages.mjs`: writes the **website** files into the website repo (by default `../site`, the folder beside this one). It leaves the Studio out and writes the forwarding page at the website's old `/studio/` address.
- `tests/github-pages-smoke.mjs`: the browser check written for the combined site. Its Studio steps still use the old address and need updating.

## Rebuilding

```
node scripts/build-storefront.mjs        # the website's storefront.js, from its sources
node scripts/build-studio-pages.mjs      # the Studio, into docs/
node scripts/build-github-pages.mjs      # the website, into ../site
```

Raise `release` in both build scripts (and `VERSION` in the website's own `pages-access.js`) when files change, so browsers fetch the new ones.

Publish only with the owner's authorization: deploy the back end first, then push this repo (Studio) and the website repo. Never commit a password, environment file, customer export or database.
