> Historical implementation note. For the uploaded application and current checks, start with [README](../README.md) and [GitHub review notes](GITHUB-REVIEW.md). References to raw assets, baseline snapshots and machine QA reports are retained for context; those files are excluded from this source package. Later features, including the supplied video intro without a Skip button, supersede earlier descriptions.

# Local performance evidence — 14 October 2026

These are **controlled local lab measurements**, not Lighthouse scores or field Core Web Vitals. The ordered storefront bundle and gzip delivery materially improve the first second-pass implementation. The updated storefront still has slower cold LCP than the original baseline under the final equal-compression profile; do not describe it as meeting the 2.5-second field target.

## Final measured delivery profile

- Same Apple M4 Pro / 24GB RAM Mac, macOS ARM64, Node26.8.1; headless **Chromium153.0.8010.12** from Playwright. Chromium provides the CDP throttling and LCP/LayoutShift interfaces. Functional regression uses **Playwright WebKit**. Neither is physical Safari/iPhone testing.
- Three alternating baseline/updated cold-load pairs at1440×900 and three at390×844:12navigations. Fresh context, cache disabled, device scale factor1, English, motion preference `no-preference`, first visit. No scrolling or input.
-150ms latency;200,000bytes/s download (1.6Mbps);75,000bytes/s upload;4×CPU slowdown. Observe until the load event plus1,800ms.
- LCP/FCP/long-task entries are real PerformanceObserver output. CLS is the largest session-window sum (1-second gaps / maximum5-second window), excluding recent-input shifts. CDP `Network.loadingFinished` supplies transferred bytes.
- Baseline: untouched `baseline/index.html`, SHA256 `787e6c57b4bc06cf979d93b2058f93d7dd19e27c976bda470d342c3d99062598`, at5393 with original shop assets and disabled `/sheet.json`. **Both final variants use the same `sendStaticFile` gzip level6 helper for eligible text.** The updated code serves one ordered storefront bundle; customizer and admin remain separate modules.
- Updated data isolated at5373/5374/8987, never the user's5173/5174 fixtures. All external non-GET/HEAD/OPTIONS requests blocked and logged. Across all12navigations: **zero attempted external writes and zero uncaught page errors**. Only local origins and `fonts.googleapis.com`/`fonts.gstatic.com` were observed.
- Final measurement began00:35:12 Asia/Bangkok14October2026. All fonts loaded, hero images decoded and overlays removed by the observation endpoint. External font delivery and machine activity remain sources of variability.
- Parallel changes continued: later hero staging, contrast and booking-only fixes are outside this captured profile. These are concrete delivery measurements, not a frozen release certification. Do not attribute individual timing changes to a single cause without an isolated experiment.

## Final medians of three runs

| Viewport | Version | FCP | LCP | CLS | Load event | Transferred bytes | Resource entries |
|---|---|---:|---:|---:|---:|---:|---:|
|1440×900|Original baseline|0.460s|3.932s|0.001733|4.266s|736,968|11|
|1440×900|Updated bundled|0.660s|4.280s|0.013785|4.827s|800,923|19|
|390×844|Original baseline|0.448s|3.024s|0.000214|3.365s|560,621|8|
|390×844|Updated bundled|0.672s|3.408s|0.000966|3.892s|622,842|16|

Compared with the equal-gzip original baseline, updated LCP is348ms slower on desktop and384ms slower on mobile. Updated transfers approximately64KB/62KB more and8more resource entries. CLS is0.013785 desktop and0.000966 mobile; both are below0.1 in these local samples. This does not certify field p75.

Median aggregate long-task time: baseline/updated desktop187/246ms; mobile165/229ms. Each group has one median long task. **These are not INP measurements.**

## Final individual LCP / CLS measurements

| Viewport | Run | Baseline LCP | Updated LCP | Baseline CLS | Updated CLS |
|---|---:|---:|---:|---:|---:|
|Desktop|1|3.952s|4.280s|0.001733|0.013785|
|Desktop|2|3.916s|4.244s|0.001733|0.013785|
|Desktop|3|3.932s|4.292s|0.001733|0.013785|
|Mobile|1|3.024s|3.408s|0.000214|0.000966|
|Mobile|2|3.052s|3.424s|0.000214|0.000966|
|Mobile|3|3.020s|3.392s|0.000214|0.000966|

## Initial diagnostic before bundling and gzip

The earlier00:29:30 profile used uncompressed HTTP for both variants, identical throttling and3pairs per viewport. Its measurements were:

| Viewport | Version | FCP | LCP | CLS | Transferred bytes | Resources |
|---|---|---:|---:|---:|---:|---:|
|1440×900|Original uncompressed|0.744s|3.500s|0.001733|1,140,861|11|
|1440×900|Updated separate scripts|2.416s|6.228s|0.000171|1,280,894|51|
|390×844|Original uncompressed|0.740s|5.088s|0.000214|964,489|8|
|390×844|Updated separate scripts|2.424s|5.656s|0.000359|1,102,788|48|

The bundled update has32fewer resource entries and roughly480KB less transfer than the separate-script update. Cold LCP improves from6.228s to4.280s desktop and5.656s to3.408s mobile in these measurements. These before/after delivery improvements combine bundling, compression, loader integration and concurrent source refinements; they are not a causal estimate of bundling alone. Baseline LCP itself changed with compression and scheduling, so use the final equal-compression pairs when comparing versions.

## Practical limits and next measurement

After final hero staging, perform a final home/route/intro smoke check. Any later performance optimization should target an observed waterfall or long task, keeping the four real photographs, source fidelity and editable modules. Measure first-visit and cached/reduced-motion paths separately before claiming their speed.

The PDF's LCP≤2.5s, INP≤200ms and CLS≤0.1 are **field p75 targets**. A localhost build has no visitor field distribution or production caching/CDN behavior. No field-performance score, full accessibility certificate or universal speed claim is made.
