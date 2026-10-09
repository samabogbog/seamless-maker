/* Presets contain settings only; no document references, artwork or executable code. */
(function (root) {
    var fields = ["sizeMode", "width", "height", "mode", "layout", "columns", "rows", "rowShift", "rowCycles", "columnShift", "horizontalX", "horizontalY"];
    function validate(value) {
        if (!value || value.format !== "seamless-maker-pattern" || value.version !== 1) {
            throw new Error("Choose a Seamless Maker pattern preset (version 1).");
        }
        if (!Object.prototype.hasOwnProperty.call(SeamlessRepeat.units, value.units)) { throw new Error("Preset has invalid dimension units."); }
        var input = value.settings, s = {}, i, key;
        if (!input || typeof input !== "object") { throw new Error("Preset is missing pattern settings."); }
        for (i = 0; i < fields.length; i += 1) {
            key = fields[i]; s[key] = input[key];
            if (i !== 0 && key !== "mode" && key !== "layout" && (typeof s[key] !== "number" || !isFinite(s[key]))) {
                throw new Error("Preset has an invalid " + key + " value.");
            }
        }
        // Validate dormant lattice controls too, so switching modes remains predictable.
        if (Math.floor(s.rowShift) !== s.rowShift || Math.abs(s.rowShift) > 10000 ||
            Math.floor(s.columnShift) !== s.columnShift || Math.abs(s.columnShift) > 10000 ||
            Math.floor(s.rowCycles) !== s.rowCycles || s.rowCycles < 1 || s.rowCycles > 10000) {
            throw new Error("Preset has invalid tilt counts or row cycles.");
        }
        s.scale = 100; s.rotation = 0; s.offsetX = 0; s.offsetY = 0;
        SeamlessRepeat.validate(s);
        var background = value.preview && value.preview.background;
        if (background !== "white" && background !== "transparent") { throw new Error("Preset has an invalid preview background."); }
        return { format: "seamless-maker-pattern", version: 1, units: value.units, settings: s, preview: { background: background } };
    }
    root.SeamlessPreset = {
        validate: validate,
        parse: function (text) {
            if (typeof text !== "string" || text.length > 65536) { throw new Error("Preset must be a JSON file smaller than 64 KB."); }
            var value;
            try { value = JSON.parse(text.replace(/^\uFEFF/, "")); } catch (error) { throw new Error("The preset file is not valid JSON."); }
            return validate(value);
        },
        stringify: function (value) { return JSON.stringify(validate(value), null, 2) + "\n"; }
    };
}(this));
