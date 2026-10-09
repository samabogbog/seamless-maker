/* Run using Illustrator File > Scripts > Other Script. Only temporary documents are modified. */
(function () {
    var root = File($.fileName).parent.parent;
    var previous = app.documents.length ? app.activeDocument : null;
    var fixture = null, report = [], passed = 0;
    function check(condition, message) {
        if (!condition) { throw new Error(message); }
        passed += 1; report.push("PASS: " + message);
    }
    function call(request) {
        var response = SeamlessJSON.parse(SeamlessMaker.dispatch(SeamlessJSON.stringify(request)));
        if (!response.ok) { throw new Error(response.error); } return response.data;
    }
    try {
        $.evalFile(File(root + "/extension/host/main.jsx"));
        report.push("Illustrator " + app.version + " | " + $.os);
        var spaces = [DocumentColorSpace.RGB, DocumentColorSpace.CMYK], sp, mode, layout;
        for (sp = 0; sp < spaces.length; sp += 1) {
            fixture = app.documents.add(spaces[sp], 160, 120);
            fixture.artboards.add([200, 120, 360, 0]); fixture.artboards.setActiveArtboardIndex(1);
            var art = fixture.groupItems.add();
            var rectangle = art.pathItems.rectangle(85, 40, 34, 22);
            var gradient = fixture.gradients.add(); gradient.type = GradientType.LINEAR;
            var red = new RGBColor(); red.red = 230; red.green = 74; red.blue = 65;
            var blue = new RGBColor(); blue.red = 50; blue.green = 100; blue.blue = 230;
            gradient.gradientStops[0].color = red; gradient.gradientStops[1].color = blue;
            var gradientColor = new GradientColor(); gradientColor.gradient = gradient;
            rectangle.fillColor = gradientColor; rectangle.stroked = true; rectangle.strokeWidth = 2; rectangle.strokeColor = blue;
            var oval = art.pathItems.ellipse(92, 51, 20, 20); oval.fillColor = red; oval.stroked = false; oval.opacity = 60;
            var definition = fixture.symbols.add(art); definition.name = "Seamless Test " + sp;
            art.remove();
            var source = fixture.symbolItems.add(definition); source.rotate(17); source.opacity = 85;
            fixture.selection = null; source.selected = true;
            var bounds = source.visibleBounds, before = [bounds[0], bounds[1], bounds[2], bounds[3]];
            var captured = call({ action: "capture" });
            var settings = { sizeMode: "custom", width: 100, height: 80, columns: 3, rows: 3, mode: "all", layout: "stagger", scale: 130, rotation: 31, offsetX: -19, offsetY: 7,
                rowShift: 1, rowCycles: 2, columnShift: -2, horizontalX: 30, horizontalY: 9 };
            for (layout = 0; layout < 2; layout += 1) {
            settings.layout = layout ? "lattice" : "stagger";
            for (mode = 0; mode < 2; mode += 1) {
                settings.mode = mode ? "vertical" : "all";
                var layersBefore = fixture.layers.length, docsBefore = app.documents.length;
                var prepared = call({ action: "prepare", sourceToken: captured.sourceToken, settings: settings, refresh: true });
                check(app.documents.length === docsBefore && app.activeDocument === fixture, "Preview opens no document and original remains active");
                check(fixture.layers.length === layersBefore, "Preview adds no layer to source document");
                check(prepared.image.width > 0 && prepared.image.height > 0 && prepared.image.uri.indexOf("file:///") === 0, "Preview PNG and measured footprint available");
                var created = call({ action: "create", sourceToken: captured.sourceToken, previewToken: prepared.previewToken, settings: prepared.settings });
                var output = fixture.layers[0], group = output.groupItems[0];
                check(group.clipped && group.name === "Seamless Repeat", "Output clipping group created");
                check(group.symbolItems.length === created.count && created.count === prepared.count, "Preview/output counts match");
                var expected = SeamlessRepeat.plan(prepared.settings, prepared.image).points, i, b;
                for (i = 0; i < group.symbolItems.length; i += 1) {
                    var item = group.symbolItems[group.symbolItems.length - i - 1]; b = item.visibleBounds;
                    check(item.symbol === definition, "Copy retains symbol linkage");
                    check(Math.abs((b[0] + b[2]) / 2 - (200 + expected[i].x)) < 0.02 && Math.abs((b[1] + b[3]) / 2 - (120 - expected[i].y)) < 0.02, "Copy position matches preview");
                }
                var mask = group.pathItems[0], clip = mask.geometricBounds;
                check(mask.clipping && Math.abs(clip[0] - 200) < 0.01 && Math.abs(clip[1] - 120) < 0.01 && Math.abs(clip[2] - 300) < 0.01 && Math.abs(clip[3] - 40) < 0.01, "Custom clip dimensions and active artboard origin exact");
                check(SeamlessJSON.stringify([source.visibleBounds[0], source.visibleBounds[1], source.visibleBounds[2], source.visibleBounds[3]]) === SeamlessJSON.stringify(before), "Original symbol bounds unchanged");
                output.remove();
            }
            }
            call({ action: "release" }); fixture.close(SaveOptions.DONOTSAVECHANGES); fixture = null;
        }
        report.push("SUCCESS: " + passed + " checks passed.");
    } catch (e) { report.push("FAILED: " + String(e.message || e) + " (line " + e.line + ")"); }
    finally {
        if (fixture) { try { fixture.close(SaveOptions.DONOTSAVECHANGES); } catch (ignored) {} }
        if (previous) { try { app.activeDocument = previous; } catch (ignoredActivate) {} }
        try { if ($.global.SeamlessMaker) { SeamlessMaker.dispatch('{"action":"release"}'); } } catch (ignoredRelease) {}
    }
    var outputFolder = Folder(root + "/artifacts"); if (!outputFolder.exists) { outputFolder.create(); }
    var log = File(outputFolder + "/illustrator-smoke-" + app.version + ".txt");
    log.encoding = "UTF-8"; log.open("w"); log.write(report.join("\n")); log.close();
    $.global.SeamlessSmokeResult = report.join("\n");
    if (!$.global.SeamlessSmokeQuiet) { alert(report[report.length - 1] + "\nReport: " + log.fsName); }
}());
