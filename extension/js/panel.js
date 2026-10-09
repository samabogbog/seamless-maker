(function () {
    var ids = ["sourceThumb", "sourceName", "sourceMeta", "useSymbol", "tileView", "repeatView", "zoomFit", "zoom50", "zoom100", "background", "previewStage", "preview", "emptyPreview", "tileDimensions", "instanceCount", "sizeMode", "units", "width", "height", "mode", "layout", "columns", "rows", "refresh", "status", "create", "latticeControls", "tiltRows", "rowCyclesField", "rowShift", "rowCycles", "columnShift", "horizontalX", "horizontalY", "verticalX", "verticalY", "latticeInfo"];
    var el = {}, i, state = { source: null, prepared: null, image: null, layout: null, revision: 0, timer: null, busy: false, repeat: false, unit: "mm", artboard: null, zoom: "fit", panX: 0, panY: 0, viewport: null, drag: null };
    ids.push("importPreset", "exportPreset", "bgToggle");
    ids.push("tabMaker", "tabMatcher", "makerPane", "matcherPane", "matchSizeMode", "matchWidth", "matchHeight", "matchMode", "matchUnits", "matchHx", "matchHy", "matchVx", "matchVy", "btnFindMatches", "matcherStatus", "matcherResultCount", "matcherResults");
    for (i = 0; i < ids.length; i += 1) { el[ids[i]] = document.getElementById(ids[i]); }
    function status(message, kind) { el.status.textContent = message; el.status.title = message; el.status.className = kind || ""; }
    function decimal(n) { return String(Math.round(n * 10000) / 10000); }
    function number(id) {
        var text = el[id].value;
        if (!text || !text.replace(/\s/g, "")) { throw new Error("Enter a value for " + id + "."); }
        var n = Number(text); if (!isFinite(n)) { throw new Error("Enter a valid number for " + id + "."); } return n;
    }
    function read() {
        var unit = SeamlessRepeat.units[el.units.value];
        var s = { sizeMode: el.sizeMode.value, width: number("width") * unit, height: number("height") * unit,
            columns: number("columns"), rows: number("rows"), mode: el.mode.value, layout: el.layout.value,
            scale: 100, rotation: 0, offsetX: 0, offsetY: 0 };
        if (s.sizeMode === "artboard" && state.artboard) { s.width = state.artboard.width; s.height = state.artboard.height; }
        if (s.layout === "lattice") {
            s.columnShift = number("columnShift");
            if (s.mode === "all") { s.rowShift = number("rowShift"); s.rowCycles = number("rowCycles"); }
            else { s.horizontalX = number("horizontalX") * unit; s.horizontalY = number("horizontalY") * unit; }
        }
        SeamlessRepeat.validate(s); return s;
    }
    function vectorFields(s) {
        if (s.layout !== "lattice") { return; }
        var basis = SeamlessRepeat.vectors(s), unit = SeamlessRepeat.units[el.units.value];
        if (s.mode === "all") {
            el.horizontalX.value = decimal(basis.horizontal.x / unit); el.horizontalY.value = decimal(basis.horizontal.y / unit);
        }
        el.verticalX.value = decimal(basis.vertical.x / unit); el.verticalY.value = decimal(basis.vertical.y / unit);
        function signed(n) { return (n > 0 ? "+" : "") + n; }
        var match = basis.verticalMatch;
        var message = "Top → Bottom: Col " + signed(match.columns) + ", Row " + signed(match.rows);
        if (basis.horizontalMatch) {
            match = basis.horizontalMatch;
            message += " · Left → Right: Col " + signed(match.columns) + ", Row " + signed(match.rows);
        }
        el.latticeInfo.textContent = message;
        el.latticeInfo.title = message;
    }
    function enabled() {
        el.create.disabled = state.busy || !state.prepared || !state.image || !state.layout || state.layout.exceeded || !state.layout.count;
        el.useSymbol.disabled = state.busy; el.refresh.disabled = state.busy;
        el.importPreset.disabled = el.exportPreset.disabled = state.busy;
        var controls = document.querySelectorAll(".controls input, .controls select");
        for (var j = 0; j < controls.length; j += 1) { controls[j].disabled = state.busy; }
        el.width.disabled = el.height.disabled = state.busy || el.sizeMode.value === "artboard";
        var lattice = el.layout.value === "lattice", manual = lattice && el.mode.value === "vertical";
        el.latticeControls.style.display = lattice ? "block" : "none";
        el.tiltRows.style.display = manual ? "none" : "";
        el.rowCyclesField.style.display = manual ? "none" : "";
        el.horizontalX.disabled = el.horizontalY.disabled = state.busy || !manual;
        el.verticalX.disabled = el.verticalY.disabled = true;
        el.rowShift.disabled = el.rowCycles.disabled = state.busy || !lattice || manual;
        el.columnShift.disabled = state.busy || !lattice;
        el.columns.disabled = state.busy || manual;
    }
    function boardFields(b) {
        state.artboard = b;
        if (el.sizeMode.value === "artboard") {
            var unit = SeamlessRepeat.units[el.units.value];
            el.width.value = decimal(b.width / unit); el.height.value = decimal(b.height / unit);
        }
        try { vectorFields(read()); } catch (ignoredIncomplete) {}
        syncMatcherInputs();
    }
    function invalidate() {
        state.revision += 1; state.prepared = null; state.layout = null;
        el.instanceCount.textContent = "— instances"; enabled();
    }
    function render() {
        var canvas = el.preview, width = el.previewStage.clientWidth, height = el.previewStage.clientHeight;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
        var ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
        if (!state.prepared || !state.image || !state.layout || state.layout.exceeded) {
            state.viewport = null; state.drag = null; el.previewStage.style.cursor = "default";
            el.emptyPreview.style.display = "-webkit-flex"; el.emptyPreview.style.display = "flex"; return;
        }
        el.emptyPreview.style.display = "none";
        var s = state.prepared.settings, img = state.prepared.image;
        var cols = state.repeat && s.mode === "all" ? 3 : 1, rows = state.repeat ? 3 : 1;
        var scale = state.zoom === "fit" ? Math.min((width - 22) / (s.width * cols), (height - 22) / (s.height * rows)) : state.zoom;
        var tw = s.width * scale, th = s.height * scale;
        var maxX = Math.max(0, (tw * cols - width) / 2), maxY = Math.max(0, (th * rows - height) / 2);
        state.panX = Math.max(-maxX, Math.min(maxX, state.panX)); state.panY = Math.max(-maxY, Math.min(maxY, state.panY));
        state.viewport = { maxX: maxX, maxY: maxY };
        el.previewStage.style.cursor = maxX || maxY ? (state.drag ? "grabbing" : "grab") : "default";
        var left = (width - tw * cols) / 2 + state.panX, top = (height - th * rows) / 2 + state.panY;
        var r, c, p, n;
        if (state.zoom !== "fit") {
            // Clip directly in the viewport: never allocate a huge tile canvas at 100%.
            var iw = (img.width + 2 * img.padding) * scale, ih = (img.height + 2 * img.padding) * scale;
            for (r = 0; r < rows; r += 1) { for (c = 0; c < cols; c += 1) {
                var tx = left + c * tw, ty = top + r * th;
                if (tx >= width || ty >= height || tx + tw <= 0 || ty + th <= 0) { continue; }
                ctx.save(); ctx.beginPath(); ctx.rect(tx, ty, tw, th); ctx.clip();
                for (n = 0; n < state.layout.points.length; n += 1) {
                    p = state.layout.points[n];
                    var px = tx + (p.x - img.width / 2 - img.padding) * scale, py = ty + (p.y - img.height / 2 - img.padding) * scale;
                    if (px < width && py < height && px + iw > 0 && py + ih > 0) { ctx.drawImage(state.image, px, py, iw, ih); }
                }
                ctx.restore();
            } }
        } else {
        // One clipped tile is rasterized once, then reused for the surrounding tiles.
        var tile = document.createElement("canvas");
        tile.width = Math.max(1, Math.ceil(tw * dpr)); tile.height = Math.max(1, Math.ceil(th * dpr));
        var tctx = tile.getContext("2d"), sx = tile.width / s.width, sy = tile.height / s.height;
        for (n = 0; n < state.layout.points.length; n += 1) {
            p = state.layout.points[n];
            tctx.drawImage(state.image, (p.x - img.width / 2 - img.padding) * sx, (p.y - img.height / 2 - img.padding) * sy,
                (img.width + 2 * img.padding) * sx, (img.height + 2 * img.padding) * sy);
        }
        for (r = 0; r < rows; r += 1) { for (c = 0; c < cols; c += 1) { ctx.drawImage(tile, left + c * tw, top + r * th, tw, th); } }
        }
        ctx.strokeStyle = "rgba(45,53,63,0.55)"; ctx.lineWidth = 1;
        ctx.strokeRect(left + (cols === 3 ? tw : 0), top + (rows === 3 ? th : 0), tw, th);
    }
    function preview(force) {
        if (!state.source || state.busy) { return; }
        var revision = state.revision, settings;
        try { settings = read(); vectorFields(settings); } catch (error) { status(error.message, "error"); render(); return; }
        status("Updating preview…");
        SeamlessBridge.call({ action: "prepare", sourceToken: state.source.sourceToken, settings: settings, refresh: !!force }, function (error, data) {
            if (revision !== state.revision) { return; }
            if (error) { state.prepared = null; state.layout = null; status(error.message, "error"); enabled(); render(); return; }
            boardFields(data.artboard);
            vectorFields(data.settings);
            var layout;
            try { layout = SeamlessRepeat.plan(data.settings, data.image); } catch (e) { status(e.message, "error"); return; }
            if (layout.exceeded !== data.exceeded || (!layout.exceeded && layout.count !== data.count)) { status("Preview calculation mismatch. Reload the panel.", "error"); return; }
            if (layout.exceeded) {
                state.layout = layout; state.prepared = null;
                el.instanceCount.textContent = "> 10,000 instances";
                status("Too many instances. Reduce Steps / Row Cycles or increase spacing (limit: 10,000).", "error"); enabled(); render(); return;
            }
            var image = new Image();
            image.onload = function () {
                if (revision !== state.revision) { return; }
                state.image = image; state.prepared = data; state.layout = layout;
                el.sourceThumb.innerHTML = "";
                var thumb = document.createElement("img"); thumb.src = data.image.uri; thumb.alt = "Selected symbol"; el.sourceThumb.appendChild(thumb);
                el.instanceCount.textContent = layout.count.toLocaleString("en-US") + " instances";
                var unit = SeamlessRepeat.units[el.units.value];
                el.tileDimensions.textContent = decimal(data.settings.width / unit) + " × " + decimal(data.settings.height / unit) + " " + el.units.value;
                if (!layout.count) { status("No symbols intersect the tile. Adjust spacing or tile size.", "warning"); }
                else if (layout.warning) { status("Over 2,000 instances. Creating this repeat may take a while.", "warning"); }
                else { status(data.settings.mode === "vertical" ? "Ready. Only top and bottom edges repeat." : "Ready. All four edges repeat seamlessly."); }
                enabled(); render();
            };
            image.onerror = function () { if (revision === state.revision) { status("Cannot load the symbol image. Click Refresh to retry.", "error"); state.prepared = null; enabled(); } };
            image.src = data.image.uri;
        });
    }
    function schedule() {
        invalidate(); clearTimeout(state.timer);
        if (!state.source) { status("Use Selected Symbol to load a symbol."); return; }
        state.timer = setTimeout(function () { preview(false); }, 150);
    }
    el.useSymbol.onclick = function () {
        clearTimeout(state.timer); invalidate(); state.busy = true; enabled(); status("Loading selected symbol…");
        SeamlessBridge.call({ action: "capture" }, function (error, data) {
            state.busy = false;
            if (error) { state.source = null; el.sourceName.textContent = "No symbol selected"; status(error.message, "error"); enabled(); render(); return; }
            state.source = data; state.panX = state.panY = 0; boardFields(data.artboard); el.sourceName.textContent = data.name || "Unnamed Symbol";
            el.sourceMeta.textContent = "Linked symbol · Original preserved"; enabled(); preview(true);
        });
    };
    el.refresh.onclick = function () {
        clearTimeout(state.timer); invalidate();
        if (state.source) { preview(true); } else {
            SeamlessBridge.call({ action: "inspect" }, function (error, data) { if (error) { status(error.message, "error"); } else { boardFields(data.artboard); status("Select a symbol, then click Use Selected Symbol."); } });
        }
    };
    el.create.onclick = function () {
        if (el.create.disabled) { return; }
        var prepared = state.prepared; state.busy = true; enabled(); status("Creating " + state.layout.count + " linked instances…");
        SeamlessBridge.call({ action: "create", sourceToken: state.source.sourceToken, previewToken: prepared.previewToken, settings: prepared.settings }, function (error, data) {
            state.busy = false;
            if (error) { invalidate(); status(error.message, "error"); }
            else { status("Created " + data.count.toLocaleString("en-US") + " instances in Seamless Repeat."); }
            enabled();
        });
    };
    el.units.onchange = function () {
        var from = SeamlessRepeat.units[state.unit], to = SeamlessRepeat.units[el.units.value];
        var dimensions = ["width", "height", "horizontalX", "horizontalY"];
        for (var j = 0; j < dimensions.length; j += 1) {
            var field = el[dimensions[j]]; if (field.value !== "" && isFinite(Number(field.value))) { field.value = decimal(Number(field.value) * from / to); }
        }
        state.unit = el.units.value; if (state.artboard) { boardFields(state.artboard); } schedule();
    };
    el.sizeMode.onchange = function () { if (state.artboard) { boardFields(state.artboard); } enabled(); schedule(); };
    var inputs = ["width", "height", "columns", "rows", "rowShift", "rowCycles", "columnShift", "horizontalX", "horizontalY"];
    for (i = 0; i < inputs.length; i += 1) { el[inputs[i]].oninput = schedule; }
    el.mode.onchange = el.layout.onchange = schedule;
    function view(repeat) {
        state.repeat = repeat; state.panX = state.panY = 0; state.drag = null; el.tileView.className = repeat ? "" : "active"; el.repeatView.className = repeat ? "active" : "";
        el.tileView.setAttribute("aria-pressed", String(!repeat)); el.repeatView.setAttribute("aria-pressed", String(repeat)); render();
    }
    el.tileView.onclick = function () { view(false); }; el.repeatView.onclick = function () { view(true); };
    function zoom(level) {
        state.zoom = level; state.panX = state.panY = 0; state.drag = null;
        var buttons = [el.zoomFit, el.zoom50, el.zoom100], levels = ["fit", 0.5, 1], j;
        for (j = 0; j < buttons.length; j += 1) { buttons[j].className = levels[j] === level ? "active" : ""; buttons[j].setAttribute("aria-pressed", String(levels[j] === level)); }
        render();
    }
    el.zoomFit.onclick = function () { zoom("fit"); }; el.zoom50.onclick = function () { zoom(0.5); }; el.zoom100.onclick = function () { zoom(1); };
    el.previewStage.onmousedown = function (event) {
        if (event.button !== 0 || !state.viewport || !(state.viewport.maxX || state.viewport.maxY)) { return; }
        state.drag = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
        el.previewStage.style.cursor = "grabbing"; event.preventDefault();
    };
    window.addEventListener("mousemove", function (event) {
        if (!state.drag) { return; }
        state.panX = state.drag.panX + event.clientX - state.drag.x; state.panY = state.drag.panY + event.clientY - state.drag.y; render();
    });
    function stopDrag() { if (state.drag) { state.drag = null; render(); } }
    window.addEventListener("mouseup", stopDrag); window.addEventListener("blur", stopDrag);
    el.background.onchange = function () {
        el.previewStage.className = "preview-stage" + (el.background.value === "transparent" ? " checker" : "");
        if (el.bgToggle) {
            el.bgToggle.className = "preview-tool-btn" + (el.background.value === "transparent" ? " active" : "");
            el.bgToggle.setAttribute("aria-pressed", String(el.background.value === "transparent"));
        }
    };
    if (el.bgToggle) {
        el.bgToggle.onclick = function () {
            el.background.value = (el.background.value === "white" ? "transparent" : "white");
            el.background.onchange();
        };
    }
    function presetFileSystem() {
        if (!window.cep || !window.cep.fs) { throw new Error("Open Seamless Maker in Illustrator to import or export presets."); }
        return window.cep.fs;
    }
    function fileResult(result, message) {
        if (!result || result.err) { throw new Error(message + " (file error " + (result ? result.err : "unknown") + ")."); }
        return result.data;
    }
    el.exportPreset.onclick = function () {
        if (state.busy) { return; }
        try {
            var settings = read(), unit = SeamlessRepeat.units[el.units.value];
            settings.rowShift = number("rowShift"); settings.columnShift = number("columnShift"); settings.rowCycles = number("rowCycles");
            settings.horizontalX = number("horizontalX") * unit; settings.horizontalY = number("horizontalY") * unit;
            var text = SeamlessPreset.stringify({ format: "seamless-maker-pattern", version: 1, units: el.units.value,
                settings: settings, preview: { background: el.background.value } });
            var fs = presetFileSystem(), path = fileResult(fs.showSaveDialogEx("Export Pattern Preset", "", ["json"], "pattern-preset.json"), "Cannot open Save dialog");
            if (!path) { return; }
            if (!/\.json$/i.test(path)) { path += ".json"; }
            fileResult(fs.writeFile(path, text), "Cannot save preset");
            status("Pattern preset exported.");
        } catch (error) { status(error.message, "error"); }
    };
    el.importPreset.onclick = function () {
        if (state.busy) { return; }
        try {
            var fs = presetFileSystem(), paths = fileResult(fs.showOpenDialog(false, false, "Import Pattern Preset", "", ["json"]), "Cannot open Import dialog");
            if (!paths || !paths.length) { return; }
            var preset = SeamlessPreset.parse(fileResult(fs.readFile(paths[0]), "Cannot read preset"));
            // Validate the entire file before changing any control or preview snapshot.
            var s = preset.settings, unit = SeamlessRepeat.units[preset.units], j;
            el.units.value = state.unit = preset.units;
            var direct = ["sizeMode", "mode", "layout", "columns", "rows", "rowShift", "rowCycles", "columnShift"];
            for (j = 0; j < direct.length; j += 1) { el[direct[j]].value = String(s[direct[j]]); }
            var dimensions = ["width", "height", "horizontalX", "horizontalY"];
            for (j = 0; j < dimensions.length; j += 1) { el[dimensions[j]].value = decimal(s[dimensions[j]] / unit); }
            el.background.value = preset.preview.background; el.background.onchange();
            if (state.artboard) { boardFields(state.artboard); }
            state.panX = state.panY = 0; state.drag = null; schedule(); render();
            if (!state.source) { status("Preset imported. Select a symbol, then click Use Selected Symbol."); }
        } catch (error) { status(error.message, "error"); }
    };
    window.onresize = render;
    window.addEventListener("beforeunload", function () { SeamlessBridge.call({ action: "release" }, function () {}); });
    el.background.value = "white"; el.background.onchange();
    enabled(); render();
    function matcherStatus(message, kind) {
        if (!el.matcherStatus) { return; }
        el.matcherStatus.textContent = message;
        el.matcherStatus.title = message;
        el.matcherStatus.className = kind || "";
    }
    function syncMatcherInputs() {
        if (!el.matchSizeMode) { return; }
        if (el.matchSizeMode.value === "sync") {
            el.matchUnits.value = el.units.value;
            if (el.sizeMode.value === "artboard" && state.artboard) {
                var unit = SeamlessRepeat.units[el.units.value];
                el.matchWidth.value = decimal(state.artboard.width / unit);
                el.matchHeight.value = decimal(state.artboard.height / unit);
            } else {
                el.matchWidth.value = el.width.value;
                el.matchHeight.value = el.height.value;
            }
        }
        el.matchWidth.disabled = el.matchHeight.disabled = (el.matchSizeMode.value === "sync");
    }
    function switchTab(tab) {
        var isMaker = tab === "maker";
        if (el.tabMaker && el.tabMatcher) {
            el.tabMaker.className = isMaker ? "active" : "";
            el.tabMaker.setAttribute("aria-pressed", String(isMaker));
            el.tabMatcher.className = isMaker ? "" : "active";
            el.tabMatcher.setAttribute("aria-pressed", String(!isMaker));
        }
        if (el.makerPane) { el.makerPane.style.display = isMaker ? "" : "none"; }
        if (el.matcherPane) { el.matcherPane.style.display = isMaker ? "none" : ""; }
        if (!isMaker) { syncMatcherInputs(); }
    }
    if (el.tabMaker) { el.tabMaker.onclick = function () { switchTab("maker"); }; }
    if (el.tabMatcher) { el.tabMatcher.onclick = function () { switchTab("matcher"); }; }
    if (el.matchSizeMode) { el.matchSizeMode.onchange = syncMatcherInputs; }
    if (el.matchUnits) {
        el.matchUnits.onchange = function () {
            var from = SeamlessRepeat.units[state.unit];
            var to = SeamlessRepeat.units[el.matchUnits.value];
            if (el.matchSizeMode.value === "custom") {
                if (el.matchWidth.value && isFinite(Number(el.matchWidth.value))) { el.matchWidth.value = decimal(Number(el.matchWidth.value) * from / to); }
                if (el.matchHeight.value && isFinite(Number(el.matchHeight.value))) { el.matchHeight.value = decimal(Number(el.matchHeight.value) * from / to); }
            } else {
                syncMatcherInputs();
            }
        };
    }
    function applyCandidate(cand) {
        if (el.units.value !== el.matchUnits.value) {
            el.units.value = el.matchUnits.value;
            state.unit = el.units.value;
        }
        if (el.matchSizeMode.value === "custom") {
            el.sizeMode.value = "custom";
            el.width.value = el.matchWidth.value;
            el.height.value = el.matchHeight.value;
        }
        el.mode.value = cand.mode;
        el.layout.value = cand.layout;
        el.columns.value = String(cand.columns);
        el.rows.value = String(cand.rows);

        if (cand.layout === "lattice") {
            el.columnShift.value = String(cand.columnShift);
            if (cand.mode === "all") {
                el.rowShift.value = String(cand.rowShift);
                el.rowCycles.value = String(cand.rowCycles);
            } else {
                var unit = SeamlessRepeat.units[el.units.value];
                el.horizontalX.value = decimal(cand.horizontalX / unit);
                el.horizontalY.value = decimal(cand.horizontalY / unit);
            }
        }

        switchTab("maker");
        status("Applied candidate #" + cand.rank + " (" + cand.matchPct + "% match). Updating preview…");
        enabled();
        schedule();
    }
    function renderMatcherResults(candidates) {
        el.matcherResults.textContent = "";
        el.matcherResultCount.textContent = candidates.length + " found";
        if (!candidates || !candidates.length) {
            var empty = document.createElement("div");
            empty.className = "empty-results";
            empty.textContent = "No matching configurations found. Try adjusting target coordinates.";
            el.matcherResults.appendChild(empty);
            matcherStatus("No configurations found within limits.", "error");
            return;
        }
        matcherStatus("Found " + candidates.length + " closest configurations. Click Apply to use.", "success");

        var unitStr = " " + el.matchUnits.value;
        for (var k = 0; k < candidates.length; k += 1) {
            (function (cand) {
                var card = document.createElement("div");
                card.className = "candidate-card";

                var badgeClass = cand.matchPct >= 98 ? "high" : (cand.matchPct >= 90 ? "medium" : "fair");
                var layoutName = cand.layout === "grid" ? "Grid" : (cand.layout === "stagger" ? "Stagger" : "Lattice");

                var stepsDetail = "H:" + cand.columns + " V:" + cand.rows;
                if (cand.layout === "lattice") {
                    if (cand.mode === "all") {
                        stepsDetail += " (R:" + cand.rowShift + " C:" + cand.columnShift + " U:" + cand.rowCycles + ")";
                    } else {
                        stepsDetail += " (C:" + cand.columnShift + ")";
                    }
                }

                var header = document.createElement("div");
                header.className = "candidate-header";

                var rankWrap = document.createElement("div");
                rankWrap.className = "candidate-rank-wrap";

                var rankSpan = document.createElement("span");
                rankSpan.className = "candidate-rank";
                rankSpan.textContent = "#" + cand.rank;
                rankWrap.appendChild(rankSpan);

                var matchSpan = document.createElement("span");
                matchSpan.className = "match-badge " + badgeClass;
                matchSpan.textContent = cand.matchPct + "%";
                rankWrap.appendChild(matchSpan);

                var layoutSpan = document.createElement("span");
                layoutSpan.className = "candidate-layout-info";
                layoutSpan.textContent = layoutName + " · " + stepsDetail;
                rankWrap.appendChild(layoutSpan);

                header.appendChild(rankWrap);

                var actions = document.createElement("div");
                actions.className = "candidate-actions";

                var instSpan = document.createElement("span");
                instSpan.className = "candidate-instances";
                instSpan.textContent = "~" + cand.instances.toLocaleString("en-US");
                actions.appendChild(instSpan);

                var applyBtn = document.createElement("button");
                applyBtn.className = "btn-apply";
                applyBtn.type = "button";
                applyBtn.textContent = "Apply";
                applyBtn.onclick = function () {
                    applyCandidate(cand);
                };
                actions.appendChild(applyBtn);

                header.appendChild(actions);
                card.appendChild(header);

                var coords = document.createElement("div");
                coords.className = "candidate-coords";

                var diffHxStr = (cand.display.diffHx >= 0 ? "+" : "") + decimal(cand.display.diffHx);
                var diffHyStr = (cand.display.diffHy >= 0 ? "+" : "") + decimal(cand.display.diffHy);
                var diffVxStr = (cand.display.diffVx >= 0 ? "+" : "") + decimal(cand.display.diffVx);
                var diffVyStr = (cand.display.diffVy >= 0 ? "+" : "") + decimal(cand.display.diffVy);

                var hLabel = document.createElement("span"); hLabel.className = "coord-label"; hLabel.textContent = "H: ";
                var hVal = document.createElement("span"); hVal.className = "coord-val"; hVal.textContent = decimal(cand.display.horizontalX) + ", " + decimal(cand.display.horizontalY) + unitStr;
                var hDiff = document.createElement("span"); hDiff.className = "dim-diff"; hDiff.textContent = " (Δ " + diffHxStr + ", " + diffHyStr + ")";

                var sep = document.createElement("span"); sep.className = "coord-sep"; sep.textContent = "·";

                var vLabel = document.createElement("span"); vLabel.className = "coord-label"; vLabel.textContent = "V: ";
                var vVal = document.createElement("span"); vVal.className = "coord-val"; vVal.textContent = decimal(cand.display.verticalX) + ", " + decimal(cand.display.verticalY) + unitStr;
                var vDiff = document.createElement("span"); vDiff.className = "dim-diff"; vDiff.textContent = " (Δ " + diffVxStr + ", " + diffVyStr + ")";

                coords.appendChild(hLabel);
                coords.appendChild(hVal);
                coords.appendChild(hDiff);
                coords.appendChild(sep);
                coords.appendChild(vLabel);
                coords.appendChild(vVal);
                coords.appendChild(vDiff);

                card.appendChild(coords);
                card.applyButton = applyBtn;
                el.matcherResults.appendChild(card);
            }(candidates[k]));
        }
    }
    if (el.btnFindMatches) {
        el.btnFindMatches.onclick = function () {
            try {
                syncMatcherInputs();
                var unit = SeamlessRepeat.units[el.matchUnits.value];
                var w = Number(el.matchWidth.value) * unit;
                var h = Number(el.matchHeight.value) * unit;

                var hxText = el.matchHx.value;
                var hyText = el.matchHy.value;
                var vxText = el.matchVx.value;
                var vyText = el.matchVy.value;

                if (!hxText || !hxText.replace(/\s/g, "")) { throw new Error("Enter Horizontal X."); }
                if (!hyText || !hyText.replace(/\s/g, "")) { throw new Error("Enter Horizontal Y."); }
                if (!vxText || !vxText.replace(/\s/g, "")) { throw new Error("Enter Vertical X."); }
                if (!vyText || !vyText.replace(/\s/g, "")) { throw new Error("Enter Vertical Y."); }

                var hx = Number(hxText) * unit;
                var hy = Number(hyText) * unit;
                var vx = Number(vxText) * unit;
                var vy = Number(vyText) * unit;

                if (!isFinite(w) || w <= 0 || !isFinite(h) || h <= 0) {
                    throw new Error("Tile width and height must be positive numbers.");
                }
                if (!isFinite(hx) || !isFinite(hy) || (hx === 0 && hy === 0)) {
                    throw new Error("Horizontal vector (X, Y) must be non-zero.");
                }
                if (!isFinite(vx) || !isFinite(vy) || (vx === 0 && vy === 0)) {
                    throw new Error("Vertical vector (X, Y) must be non-zero.");
                }

                var solver = (typeof SeamlessMatcher !== "undefined" && SeamlessMatcher.solve) ? SeamlessMatcher : (window.SeamlessMatcher || (typeof root !== "undefined" && root.SeamlessMatcher));
                if (!solver || !solver.solve) {
                    throw new Error("Matcher solver module is not loaded.");
                }

                var candidates = solver.solve({
                    width: w,
                    height: h,
                    targetHx: hx,
                    targetHy: hy,
                    targetVx: vx,
                    targetVy: vy,
                    mode: el.matchMode.value,
                    unitScale: unit,
                    maxCandidates: 5
                });

                renderMatcherResults(candidates);
            } catch (err) {
                matcherStatus(err.message, "error");
            }
        };
    }
    syncMatcherInputs();
    switchTab("maker");
    SeamlessBridge.call({ action: "inspect" }, function (error, data) { if (error) { status(error.message, "error"); } else { boardFields(data.artboard); } });
}());
