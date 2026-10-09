/* Illustrator CC 2014+: all host code intentionally uses ES3. */
(function () {
    var base = $.global.SeamlessMakerExtensionPath ? Folder($.global.SeamlessMakerExtensionPath) : File($.fileName).parent.parent;
    function loadShared(name) {
        var sharedFile = File(base + "/shared/" + name);
        if (!sharedFile.exists) { throw new Error("Missing shared module: " + sharedFile.fsName); }
        $.evalFile(sharedFile);
    }
    loadShared("repeat.js"); loadShared("json.js");
    if (!$.global.SeamlessRepeat || !$.global.SeamlessJSON) { throw new Error("Shared host modules did not initialize."); }
    var session = null, serial = 0, files = [];
    var tempRoot = Folder(Folder.temp + "/SeamlessMaker");
    if (!tempRoot.exists) { tempRoot.create(); }
    var runId = String(new Date().getTime()) + "-" + String(Math.floor(Math.random() * 1000000));
    function active() {
        if (!app.documents.length) { throw new Error("Open an Illustrator document first."); }
        return app.activeDocument;
    }
    function board(doc) {
        var index = doc.artboards.getActiveArtboardIndex(), r = doc.artboards[index].artboardRect;
        return { index: index, rect: [r[0], r[1], r[2], r[3]], width: r[2] - r[0], height: r[1] - r[3] };
    }
    function fingerprint(item) {
        var b = item.visibleBounds;
        var stamp = { name: item.symbol.name, bounds: [b[0], b[1], b[2], b[3]],
            opacity: item.opacity, blend: String(item.blendingMode) };
        // SymbolItem does not expose the matrix property offered by PlacedItem/RasterItem.
        // Some host variants may provide it; it must never be required for a valid symbol.
        try {
            var m = item.matrix;
            if (m) { stamp.matrix = [m.mValueA, m.mValueB, m.mValueC, m.mValueD, m.mValueTX, m.mValueTY]; }
        } catch (unsupportedMatrix) {}
        return SeamlessJSON.stringify(stamp);
    }
    function validSession(token) {
        var doc = active();
        if (!session || session.id !== token) { throw new Error("Use Selected Symbol to load a symbol first."); }
        if (doc !== session.doc) { throw new Error("The active document changed. Use Selected Symbol again."); }
        try { if (session.item.typename !== "SymbolItem" || session.item.hidden) { throw new Error("Invalid or hidden source"); } fingerprint(session.item); }
        catch (e) { throw new Error("Cannot read the source symbol: " + String(e.message || e) + ". Use Selected Symbol again."); }
        return doc;
    }
    function settingsFor(doc, input) {
        var s = {}, k, b = board(doc);
        for (k in input) { if (Object.prototype.hasOwnProperty.call(input, k)) { s[k] = input[k]; } }
        if (s.sizeMode === "artboard") { s.width = b.width; s.height = b.height; }
        SeamlessRepeat.validate(s);
        // Older Illustrator coordinates have a limited canvas. Fail before creating anything.
        if (s.width > 16383 || s.height > 16383) { throw new Error("Tile dimensions must not exceed 16,383 pt for legacy Illustrator compatibility."); }
        return s;
    }
    function transform(item, s) {
        item.resize(s.scale, s.scale, true, true, true, true, s.scale, Transformation.CENTER);
        item.rotate(s.rotation, true, true, true, true, Transformation.CENTER);
    }
    function dimensions(item) {
        var b = item.visibleBounds;
        var result = { width: b[2] - b[0], height: b[1] - b[3] };
        if (result.width <= 0 || result.height <= 0 || !isFinite(result.width + result.height)) { throw new Error("The symbol has no measurable visible area."); }
        return result;
    }
    function cleanupFiles() {
        var i;
        for (i = 0; i < files.length; i += 1) { try { files[i].remove(); } catch (ignored) {} }
        files = [];
    }
    function raster(doc, source, s) {
        var previewLayer = null, png = null, success = false, step = "read source bounds";
        var oldLayer = doc.activeLayer, oldSelection = doc.selection, occupied = null, i;
        var wasSaved = doc.saved;
        try {
            var originalSize = dimensions(source);
            if (Math.max(originalSize.width, originalSize.height) * s.scale / 100 > 16383) {
                throw new Error("Scaled symbol exceeds the legacy canvas limit. Reduce Scale.");
            }
            // Commit preceding edits before starting our reversible preview transaction.
            // Never redraw while the isolated layer is present.
            app.redraw();
            // Fast occupied region: combine artboard extents, top-level layer items, and source symbol.
            // Avoids scanning doc.pageItems recursively, which causes severe freezing on documents with many objects/layers.
            if (doc.artboards && doc.artboards.length) {
                var abCount = doc.artboards.length;
                for (i = 0; i < abCount; i += 1) {
                    var ab = doc.artboards[i].artboardRect;
                    if (ab) {
                        if (!occupied) { occupied = [ab[0], ab[1], ab[2], ab[3]]; }
                        else {
                            occupied[0] = Math.min(occupied[0], ab[0]); occupied[1] = Math.max(occupied[1], ab[1]);
                            occupied[2] = Math.max(occupied[2], ab[2]); occupied[3] = Math.min(occupied[3], ab[3]);
                        }
                    }
                }
            }
            if (doc.layers && doc.layers.length) {
                var layerCount = doc.layers.length;
                for (var l = 0; l < layerCount; l += 1) {
                    var lyr = doc.layers[l];
                    var layerItems = lyr.pageItems || lyr.items;
                    if (layerItems) {
                        var itemCount = layerItems.length;
                        var scanLimit = itemCount > 150 ? 150 : itemCount;
                        for (i = 0; i < scanLimit; i += 1) {
                            try {
                                var existing = layerItems[i].visibleBounds;
                                if (existing) {
                                    if (!occupied) { occupied = [existing[0], existing[1], existing[2], existing[3]]; }
                                    else {
                                        occupied[0] = Math.min(occupied[0], existing[0]); occupied[1] = Math.max(occupied[1], existing[1]);
                                        occupied[2] = Math.max(occupied[2], existing[2]); occupied[3] = Math.min(occupied[3], existing[3]);
                                    }
                                }
                            } catch (ignoredItemBounds) {}
                        }
                    }
                }
            }
            var srcBounds = source.visibleBounds;
            if (srcBounds) {
                if (!occupied) { occupied = [srcBounds[0], srcBounds[1], srcBounds[2], srcBounds[3]]; }
                else {
                    occupied[0] = Math.min(occupied[0], srcBounds[0]); occupied[1] = Math.max(occupied[1], srcBounds[1]);
                    occupied[2] = Math.max(occupied[2], srcBounds[2]); occupied[3] = Math.min(occupied[3], srcBounds[3]);
                }
            }
            step = "create isolated preview layer";
            previewLayer = doc.layers.add(); previewLayer.name = "Seamless Preview (temporary)";
            step = "duplicate preview symbol";
            var clone = source.duplicate(previewLayer, ElementPlacement.PLACEATEND);
            // Preserve all instance transforms and appearance, then apply relative controls.
            clone.hidden = false; clone.locked = false;
            step = "measure and transform preview symbol";
            transform(clone, s);
            var size = dimensions(clone), b = clone.visibleBounds;
            if (Math.max(size.width, size.height) > 16383) { throw new Error("Rotated symbol exceeds the legacy canvas limit. Reduce Scale."); }
            var pad = Math.min(1, (16383 - Math.max(size.width, size.height)) / 2);
            step = "place preview outside existing artwork";
            occupied = occupied || source.visibleBounds;
            var gap = 2 + 2 * pad, candidates = [
                [occupied[2] + gap - b[0], 0], [occupied[0] - gap - b[2], 0],
                [0, occupied[1] + gap - b[3]], [0, occupied[3] - gap - b[1]]
            ], chosen = null, best = Infinity;
            for (i = 0; i < candidates.length; i += 1) {
                var delta = candidates[i], extent = Math.max(Math.abs(b[0] + delta[0]), Math.abs(b[2] + delta[0]),
                    Math.abs(b[1] + delta[1]), Math.abs(b[3] + delta[1]));
                if (extent < best) { best = extent; chosen = delta; }
            }
            clone.translate(chosen[0], chosen[1]); b = clone.visibleBounds;
            // Verify translation was not clamped by Illustrator's canvas boundaries.
            if (!(b[0] - pad > occupied[2] || b[2] + pad < occupied[0] ||
                b[3] - pad > occupied[1] || b[1] + pad < occupied[3])) {
                throw new Error("No empty canvas space is available for the preview. Reduce the symbol size.");
            }
            var capture = new ImageCaptureOptions();
            capture.antiAliasing = true; capture.transparency = true; capture.matte = false;
            // imageCapture requires at least 72 PPI. Preserve effects at their actual size.
            capture.resolution = Math.max(72, Math.min(144, 2048 * 72 / Math.max(size.width + 2 * pad, size.height + 2 * pad)));
            png = File(tempRoot + "/" + runId + "-" + (++serial) + ".png");
            step = "export preview PNG";
            doc.imageCapture(png, [b[0] - pad, b[1] + pad, b[2] + pad, b[3] - pad], capture);
            if (!png.exists) { throw new Error("Illustrator could not export the symbol preview."); }
            files.push(png); success = true;
            var path = png.fsName.replace(/\\/g, "/");
            return { width: size.width, height: size.height, padding: pad,
                uri: "file:///" + encodeURI(path).replace(/#/g, "%23").replace(/\?/g, "%3F") };
        } catch (error) {
            var detail = String(error.message || error);
            var wrapped = new Error("Preview: " + step + ": " + detail);
            throw wrapped;
        } finally {
            if (previewLayer) {
                try { previewLayer.remove(); } catch (ignoredLayerRemove) {}
                if (oldLayer) { try { if (doc.activeLayer !== oldLayer) { doc.activeLayer = oldLayer; } } catch (ignoredActiveLayer) {} }
                try {
                    var selection = doc.selection, sameSelection = (selection ? selection.length : 0) === (oldSelection ? oldSelection.length : 0);
                    if (sameSelection && oldSelection) {
                        for (i = 0; i < oldSelection.length; i += 1) { if (selection[i] !== oldSelection[i]) { sameSelection = false; break; } }
                    }
                    if (!sameSelection) { doc.selection = oldSelection; }
                } catch (ignoredSelection) {}
                try { if (doc.saved !== wasSaved) { doc.saved = wasSaved; } } catch (ignoredSaved) {}
                try { app.redraw(); } catch (ignoredRedraw) {}
            }
            if (!success && png) { try { png.remove(); } catch (ignoredFile) {} }
        }
    }
    function capture() {
        var doc = active(), selection = doc.selection;
        if (!selection || selection.length !== 1 || selection[0].typename !== "SymbolItem") {
            throw new Error("Select exactly one symbol instance, then click Use Selected Symbol.");
        }
        if (selection[0].hidden) { throw new Error("Select a visible symbol instance."); }
        cleanupFiles();
        session = { id: runId + ":" + (++serial), doc: doc, item: selection[0], image: null, prepared: null };
        return { sourceToken: session.id, name: session.item.symbol.name, artboard: board(doc) };
    }
    function prepare(args) {
        var doc = validSession(args.sourceToken), s = settingsFor(doc, args.settings), stamp = fingerprint(session.item);
        var imageKey = stamp + ":" + s.scale + ":" + s.rotation;
        if (args.refresh || !session.image || session.image.key !== imageKey) {
            var next = raster(doc, session.item, s);
            // Keep the last two images so CEP can finish an in-flight image load.
            while (files.length > 2) { try { files.shift().remove(); } catch (ignored) {} }
            session.image = { key: imageKey, data: next };
        }
        var layout = SeamlessRepeat.plan(s, session.image.data);
        var token = session.id + ":" + (++serial), b = board(doc);
        session.prepared = { token: token, settings: SeamlessJSON.stringify(s), stamp: stamp, board: SeamlessJSON.stringify(b), footprint: session.image.data };
        return { previewToken: token, settings: s, artboard: b, image: session.image.data,
            count: layout.count, exceeded: layout.exceeded, warning: layout.warning };
    }
    function create(args) {
        var doc = validSession(args.sourceToken), s = settingsFor(doc, args.settings), p = session.prepared;
        if (!p || p.token !== args.previewToken || p.settings !== SeamlessJSON.stringify(s) ||
            p.stamp !== fingerprint(session.item) || p.board !== SeamlessJSON.stringify(board(doc))) {
            throw new Error("The document or settings changed. Refresh the preview before creating.");
        }
        var layout = SeamlessRepeat.plan(s, p.footprint);
        if (layout.exceeded) { throw new Error("The repeat exceeds the 10,000-instance limit. Reduce Steps or Scale."); }
        if (!layout.count) { throw new Error("No symbols intersect the tile. Adjust Offset X or Scale."); }
        var layer = null, group = null, oldLayer = doc.activeLayer;
        var oldSelection = doc.selection, complete = false;
        try {
            layer = doc.layers.add(); layer.name = "Seamless Repeat";
            group = layer.groupItems.add(); group.name = "Seamless Repeat";
            var template = session.item.duplicate(group, ElementPlacement.PLACEATEND);
            template.locked = false; template.hidden = false; transform(template, s);
            var measured = dimensions(template);
            if (Math.abs(measured.width - p.footprint.width) > 0.01 || Math.abs(measured.height - p.footprint.height) > 0.01) {
                throw new Error("Symbol appearance changed. Use Selected Symbol again to refresh it.");
            }
            var rect = board(doc).rect, i, item, bounds;
            for (i = 0; i < layout.points.length; i += 1) {
                item = i === 0 ? template : template.duplicate(group, ElementPlacement.PLACEATBEGINNING);
                bounds = item.visibleBounds;
                item.translate(rect[0] + layout.points[i].x - (bounds[0] + bounds[2]) / 2,
                    rect[1] - layout.points[i].y - (bounds[1] + bounds[3]) / 2);
            }
            var mask = group.pathItems.rectangle(rect[1], rect[0], s.width, s.height);
            mask.name = "Tile Clip"; mask.stroked = false; mask.filled = false;
            mask.move(group, ElementPlacement.PLACEATBEGINNING); mask.clipping = true; group.clipped = true;
            doc.selection = null; group.selected = true; app.redraw();
            complete = true;
            return { count: layout.count, width: s.width, height: s.height, name: group.name };
        } finally {
            if (!complete) {
                if (layer) { try { layer.remove(); } catch (ignoredLayer) {} }
                try { doc.activeLayer = oldLayer; doc.selection = oldSelection; } catch (ignoredRestore) {}
            }
        }
    }
    $.global.SeamlessMaker = {
        version: "1.1.8",
        dispatch: function (payload) {
            var previousCoordinates, originalDocument = null;
            try {
                if (app.documents.length) { originalDocument = app.activeDocument; }
                previousCoordinates = app.coordinateSystem;
                app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
                var request = SeamlessJSON.parse(payload), data;
                if (request.action === "inspect") { data = { artboard: board(active()), version: app.version }; }
                else if (request.action === "capture") { data = capture(); }
                else if (request.action === "prepare") { data = prepare(request); }
                else if (request.action === "create") { data = create(request); }
                else if (request.action === "release") { cleanupFiles(); session = null; data = {}; }
                else { throw new Error("Unknown Seamless Maker action."); }
                return SeamlessJSON.stringify({ ok: true, data: data });
            } catch (error) { return SeamlessJSON.stringify({ ok: false, error: String(error.message || error), line: error.line || null }); }
            finally {
                if (originalDocument) { try { app.activeDocument = originalDocument; } catch (ignoredDocumentRestore) {} }
                if (previousCoordinates !== undefined) { try { app.coordinateSystem = previousCoordinates; } catch (ignoredCoordinateRestore) {} }
            }
        }
    };
}());



