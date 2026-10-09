# Validation

## Automated checks

The Node test suite checks:

- Shared calculation against an independent brute-force repeat lattice: Grid/Staggered Rows, odd/even rows, one step, negative offsets and oversized symbols.
- Tilted Lattice versus Rotary calc2/calc4, independent positive/negative row and column tilt, integer cycle counts, the supplied col1,row3 → col3,row11 compensation, fixed Top–Bottom spacing, and All Sides period closure.
- Opposite-edge contributor positions **and stacking order**, including symbols larger than a tile.
- Border-copy culling, positive finite input validation, warning and hard allocation limits.
- Strict legacy JSON parsing/serialization and escaped, serialized CEP dispatch calls.
- Host behavior in a simulated Illustrator object model: temporary-document cleanup, image caching/refresh, symbol linkage, exact clipping rectangle, transform-aware centers, stale state rejection and failure rollback.
- Panel behavior in a simulated DOM: image loading, Create readiness, unit conversion, debouncing/stale responses, limits, errors, and 3 × 3 / 1 × 3 preview layouts.

Mocks do not establish that Illustrator's own APIs or CEP UI behave correctly on a particular version.

## Host compatibility status

| Environment | Status |
| --- | --- |
| Node.js 24.16.0 on Windows | 46 automated tests passed for 1.1.3 |
| Illustrator CC 2014 / CEP 5 | ES3 host source and CEP 5 manifest target; actual host validation pending |
| Illustrator 2023 / 27.5.0 | COM read-only handshake succeeded; full scripting smoke test and UI validation remain pending due execution-access restrictions |
| Illustrator 2026 | Installation detected; actual host validation pending |
| CEP browser UI | Visual browser automation could not start: Windows returned Access denied; visual validation pending |

No Illustrator version is claimed to be certified by the automated mocks. The historical development ZIP is unsigned. A separate 1.1.3 signed Windows ZIP/ZXP now targets Illustrator 26.x–27.x / CEP 11; Adobe signature and timestamp verification passed, while host acceptance remains pending. See DISTRIBUTION.md. The 1.0.1 fix was copied into the user's existing Seamless Maker extension directory; its installed bridge file matches the source. Adobe security settings were not changed.

The user confirmed that 1.0.2 works in their Illustrator. Version 1.1.0's tilted layout has passed calculation, simulated panel, and simulated host preview/create checks. Actual Illustrator validation of the new controls and tilted output remains pending; the user's confirmation of the earlier release does not establish that the new layout has been tested in the host.

The user subsequently confirmed 1.1.0 works completely. Version 1.1.1 changes panel layout and manifest size constraints. Its calculation and simulated panel/host checks pass; screenshot verification could not launch because Windows returned Access denied for the isolated headless browser. One-page fit and floating/docked sizing still require actual CEP visual validation.

For 1.1.2, simulated panel checks verify exact Fit/50%/100% geometry, drag clamping on both axes, ending drag on release/blur, Tile/Repeat Preview behavior, absence of removed controls, neutral transform values in Create, no host requests during zoom/pan, and no large tile canvas allocations during fixed zoom. Actual CEP mouse interaction and visual validation remain pending.

For 1.1.3, mock checks verify background-only document creation, no preview redraw/activation, original artboards/layers/selection/source bounds unchanged, matching RGB/CMYK presets, immediate closure of rejected presets, partial PNG cleanup on export failure, and actionable failure without visible fallback when background APIs/presets are unsupported. Hidden document APIs and absence of UI flicker still require actual host validation.

For 1.0.2, the SymbolItem mock no longer invents a public `matrix` property. Regression checks cover missing/throwing matrix accessors through preparation and creation, and underlying source-read diagnostics. A new Illustrator property-inspection attempt was blocked with `Access is denied`; actual host UI validation remains pending.

For 1.0.1, regression tests also cover missing-host bootstrap, CEP file-URI paths containing spaces, loading an obsolete host version, missing-host-file errors, persistent host-session reuse, and the actual host module initializing/creating with an unavailable `$.fileName`. The user-reported `SeamlessMaker is undefined` is reproduced in a simulated CEP/ExtendScript bridge and resolved by the bootstrap. Desktop-control attempts were blocked at runtime startup with `Access is denied`; actual Illustrator UI retesting remains pending. The COM version/documents handshake succeeded, but subsequent full-script execution attempts could not launch or connect in the restricted execution environment; no actual host smoke-test pass is claimed.

## Run actual Illustrator smoke checks

From the **source checkout or extracted ZIP**, use **File > Scripts > Other Script** and select `tests/illustrator-smoke.jsx`. No installed extension or CEP development mode is needed for this standalone host test. It creates RGB and CMYK temporary documents, a gradient/transparency/stroke symbol, and a second artboard; then checks transformed output for both repeat modes in Staggered Rows and Tilted Lattice. It closes only its own test documents without saving and reactivates the previously active document. It does not modify existing user documents.

The test displays its result and writes `artifacts/illustrator-smoke-<version>.txt`. Review that report before changing the compatibility status. This standalone test reloads the host namespace, so close Seamless Maker before running it and reopen the panel afterwards.

## Visual acceptance in Illustrator

1. Load a standalone colored Symbol with a gradient, transparency, stroke and pre-existing rotation. Confirm its colors appear, the original remains intact, and no preview objects/layers appear in the working document.
   Watch Use Selected Symbol and Refresh: no temporary document tab/window should appear and the view should not flicker. Confirm existing artboards, layers, visibility, selection and unsaved state are unchanged by preview. Test RGB/CMYK documents with localized startup presets; record which background factory is available on each host.
2. At requested panel size 400 × 620, inspect the four-column numeric layout, Row Tilt / Column Tilt / Row Cycles order, readable English labels, keyboard focus, visible Create/status, and no horizontal or vertical scrolling with every layout/mode. Test long compensation readouts and error messages (full text available on hover). Verify equal min/max constraints in a floating panel; record any host-controlled resizing when docked with other panels.
3. Test Grid and Staggered Rows with 1, 3 and 4 rows. Test Custom dimensions in all four units and selected instances scaled/rotated directly in Illustrator.
   For Tilted Lattice, test signed Row Tilt and Column Tilt, Row Cycles 1/2/3, and the displayed compensation. In Top–Bottom, verify fixed Horizontal X/Y remain unchanged when Width changes; in All Sides verify these fields are read-only and follow the tile dimensions. Test the documented +2 column/+8 row matching example.
4. Create All Sides, then duplicate the resulting **whole clipped group** by exactly the tile width and height into a 3 × 3 array. Inspect all borders and corners at high zoom. Repeat with a symbol wider/taller than the tile and with overlapping translucent artwork.
5. Compare the generated artwork to Tile/Repeat Preview. For Top–Bottom, test vertical borders only and confirm horizontal edges clip normally.
   Test Fit / 50% / 100%, dragging oversized previews to all edges, mouse release outside the preview, and window focus loss during a drag. Verify small previews remain centered, no empty overscroll beyond the image, zoom/view changes recenter, zoom does not affect Create or request new host images, and large tiles do not allocate full-size canvases at 100%.
6. Verify clipping rectangle dimensions, original source bounds and that editing the Symbol definition updates every generated instance. Check multiple artboards and RGB/CMYK documents.
7. Change the active document, artboard or source instance after preparing. Create must refuse stale state until refreshed/reloaded. Delete the source and confirm an actionable error.
8. Verify over-2,000 warning, over-10,000 block, and offset positions with zero visible copies. Check Illustrator remains responsive at reasonable counts; creation is synchronous and may take time near the limit.
9. Close/reopen the panel; restart Illustrator; test install/uninstall under the current user's account without admin privileges. Signed-package distribution requires separate signing/installation validation.


## 1.1.4 preview compatibility fix

47 automated tests pass. Regression reproduces hidden-document no-document errors and silent missing PNGs, confirms compatibility preview and Create, original selection/bounds/layers preserved, matching CMYK, and temporary document/image cleanup. Only recognized hidden API incompatibilities trigger a visible scratch document; unrelated export errors remain errors. Actual Illustrator UI retest is pending. The prior 1.1.3 no-visible-document guarantee does not apply to the 1.1.4 compatibility path. The source document is never used as a scratch workspace.


## 1.1.5 real-host diagnosis

On Illustrator 26.5.0 / Windows, 1.1.4 reproduced no-document failures after NoUI closure at source artboard access. Both the retained source reference and active document were invalid despite documents.length remaining one. 1.1.5 creates an ordinary scratch document from the start. Actual capture/prepare with the user's New Symbol succeeds, exports PNG, retains the original document/artboard, and returns 16 instances. Full real-host smoke and panel acceptance are recorded below when complete.


Real Illustrator 26.5.0 smoke test: SUCCESS, 492 checks passed on 2026-09-30. RGB/CMYK, transformed symbols, Staggered Rows/Tilted Lattice, both repeat modes, exact clipping, position/order/count/linkage, source bounds and preview cleanup were checked. Report: artifacts/illustrator-smoke-26.5.0.txt. Illustrator 27.x remains pending.


## 1.1.6 in-document preview

45 automated tests pass. Illustrator 26.5.0 real-host tests pass: 492 preview/Create checks plus 16 saved-state, Undo/Redo, isolation, selection, active-layer and hidden/locked-layer checks across RGB/CMYK. Reports: artifacts/illustrator-smoke-26.5.0.txt and artifacts/preview-state-report.txt. The isolation fixture places a blue background over the red source; exported PNG contains only the red source with transparent padding. No preview document is created. Existing Redo branches can be cleared by the reversible temporary-copy transaction. Illustrator 27.x and final panel visual acceptance remain pending.

## 1.1.7 presets and white preview

51 automated tests pass, including JSON export/import roundtrip, physical units and dimensions, tilted Top-Bottom settings through preview/Create, import before source selection, Active Artboard semantics, malformed/unsupported presets with atomic application, cancelled dialogs, native file API error reporting, stale preview invalidation and white/transparent backgrounds. CEP file dialogs follow Adobe CEP native fs APIs. Native dialog interaction and visual acceptance in the restarted Illustrator panel remain pending. Host preview code is unchanged except its version number.
