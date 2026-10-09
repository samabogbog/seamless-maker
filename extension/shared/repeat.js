/* ES3: this exact module runs in both CEP and Illustrator ExtendScript. */
(function (root) {
    var MAX = 10000;
    function number(value, label) {
        if (typeof value !== "number" || !isFinite(value)) { throw new Error(label + " must be a finite number."); }
        return value;
    }
    function positive(value, label) {
        number(value, label);
        if (value <= 0) { throw new Error(label + " must be greater than zero."); }
        return value;
    }
    function integer(value, label) {
        positive(value, label);
        if (Math.floor(value) !== value) { throw new Error(label + " must be a whole number."); }
        return value;
    }
    function signedInteger(value, label) {
        number(value, label);
        if (Math.floor(value) !== value || Math.abs(value) > 10000) { throw new Error(label + " must be a whole number between -10,000 and 10,000."); }
        return value;
    }
    function validate(s) {
        positive(s.width, "Width"); positive(s.height, "Height");
        integer(s.columns, "Horizontal Steps"); integer(s.rows, "Vertical Steps");
        positive(s.scale, "Scale"); number(s.rotation, "Rotation");
        number(s.offsetX, "Offset X"); number(s.offsetY, "Offset Y");
        if (s.mode !== "all" && s.mode !== "vertical") { throw new Error("Choose a repeat mode."); }
        if (s.layout !== "grid" && s.layout !== "stagger" && s.layout !== "lattice") { throw new Error("Choose a layout."); }
        if (s.sizeMode !== "artboard" && s.sizeMode !== "custom") { throw new Error("Choose a tile size mode."); }
        if (s.layout === "lattice") {
            signedInteger(s.columnShift, "Column Tilt");
            if (s.mode === "all") {
                signedInteger(s.rowShift, "Row Tilt"); integer(s.rowCycles, "Row Cycles");
            } else {
                number(s.horizontalX, "Horizontal X"); number(s.horizontalY, "Horizontal Y");
                if (Math.abs(s.horizontalX) < 0.000001) { throw new Error("Horizontal X must be nonzero to define distinct columns."); }
            }
        }
        return s;
    }
    function mod(x, period) { return ((x % period) + period) % period; }
    function range(center, half, period, padding) {
        return [Math.ceil((-padding - half - center) / period), Math.floor((period + padding + half - center) / period)];
    }
    function legacyPlan(s, footprint) {
        validate(s);
        positive(footprint.width, "Symbol width"); positive(footprint.height, "Symbol height");
        var points = [], count = 0, c, r, x, y, xr, yr, nx, ny, k, j;
        var halfW = footprint.width / 2, halfH = footprint.height / 2;
        var dx = s.width / s.columns, dy = s.height / s.rows;
        if (s.columns * s.rows > MAX) { return { points: [], count: s.columns * s.rows, exceeded: true, warning: true }; }
        for (r = 0; r < s.rows; r += 1) {
            for (c = 0; c < s.columns; c += 1) {
                x = (c + 0.5 + (s.layout === "stagger" && r % 2 ? 0.5 : 0)) * dx + s.offsetX;
                y = mod((r + 0.5) * dy + s.offsetY, s.height);
                yr = range(y, halfH, s.height, 1);
                if (s.mode === "all") {
                    x = mod(x, s.width); xr = range(x, halfW, s.width, 1);
                } else {
                    xr = x + halfW >= -1 && x - halfW <= s.width + 1 ? [0, 0] : [0, -1];
                }
                nx = Math.max(0, xr[1] - xr[0] + 1); ny = Math.max(0, yr[1] - yr[0] + 1);
                count += nx * ny;
                // Count analytically before allocating: even enormous symbols remain safe.
                if (!isFinite(count) || count > MAX) { return { points: [], count: count, exceeded: true, warning: true }; }
                for (j = yr[0]; j <= yr[1]; j += 1) {
                    for (k = xr[0]; k <= xr[1]; k += 1) {
                        points.push({ x: x + k * s.width, y: y + j * s.height });
                    }
                }
            }
        }
        return { points: points, count: count, exceeded: false, warning: count > 2000 };
    }
    function vectors(s) {
        validate(s);
        var cycles = s.mode === "all" ? s.rowCycles : 1;
        var hx = s.mode === "all" ? s.width / s.columns : s.horizontalX;
        var hy = s.mode === "all" ? s.height * s.rowShift / (cycles * s.columns) : s.horizontalY;
        var vx = hx * s.columnShift / s.rows;
        var vy = (s.height / cycles + hy * s.columnShift) / s.rows;
        if (!isFinite(hx + hy + vx + vy)) { throw new Error("Lattice vectors exceed the numeric range. Reduce tilt or spacing."); }
        return { horizontal: { x: hx, y: hy }, vertical: { x: vx, y: vy },
            verticalMatch: { columns: -cycles * s.columnShift || 0, rows: cycles * s.rows },
            horizontalMatch: s.mode === "all" ? { columns: s.columns + s.rowShift * s.columnShift, rows: -s.rowShift * s.rows || 0 } : null };
    }
    function latticePlan(s, footprint) {
        validate(s); positive(footprint.width, "Symbol width"); positive(footprint.height, "Symbol height");
        var basis = vectors(s), h = basis.horizontal, v = basis.vertical;
        function exceeded(count) { return { points: [], count: count, exceeded: true, warning: true, lattice: basis }; }
        if (s.mode === "all" && s.columns * s.rows * s.rowCycles > MAX) { return exceeded(s.columns * s.rows * s.rowCycles); }
        // Use the known determinant instead of subtracting almost-equal tilt products.
        var determinant = h.x * s.height / ((s.mode === "all" ? s.rowCycles : 1) * s.rows);
        if (!isFinite(determinant) || determinant === 0) { throw new Error("Lattice vectors cannot be parallel."); }
        var ox = (h.x + v.x) / 2 + s.offsetX, oy = (h.y + v.y) / 2 + s.offsetY;
        if (s.mode === "all") { ox = mod(ox, s.width); oy = mod(oy, s.height); }
        else {
            var phase = Math.floor(ox / h.x);
            ox -= phase * h.x; oy = mod(oy - phase * h.y, s.height);
        }
        var left = -footprint.width / 2 - 1, right = s.width + footprint.width / 2 + 1;
        var top = -footprint.height / 2 - 1, bottom = s.height + footprint.height / 2 + 1;
        var rmin = Infinity, rmax = -Infinity, xs = [left, right], ys = [top, bottom], i, j, r, c;
        for (i = 0; i < 2; i += 1) { for (j = 0; j < 2; j += 1) {
            var rr = (h.x * (ys[j] - oy) - h.y * (xs[i] - ox)) / determinant;
            rmin = Math.min(rmin, rr); rmax = Math.max(rmax, rr);
        } }
        var epsilon = 0.00000001;
        rmin = Math.ceil(rmin - epsilon); rmax = Math.floor(rmax + epsilon);
        // Reject pathological skinny scans before looping, even when output would be sparse.
        if (!isFinite(rmin + rmax) || rmax - rmin > MAX * 2 || Math.abs(rmin) > 1e12 || Math.abs(rmax) > 1e12) {
            throw new Error("Tilt or spacing is too extreme. Reduce Row Tilt / Column Tilt or Horizontal Y.");
        }
        var points = [], count = 0;
        for (r = rmin; r <= rmax; r += 1) {
            var bx = ox + r * v.x, by = oy + r * v.y;
            var ca = (left - bx) / h.x, cb = (right - bx) / h.x;
            var cmin = Math.min(ca, cb), cmax = Math.max(ca, cb);
            if (Math.abs(h.y) > 1e-12) {
                ca = (top - by) / h.y; cb = (bottom - by) / h.y;
                cmin = Math.max(cmin, Math.min(ca, cb)); cmax = Math.min(cmax, Math.max(ca, cb));
            } else if (by < top - epsilon || by > bottom + epsilon) { continue; }
            cmin = Math.ceil(cmin - epsilon); cmax = Math.floor(cmax + epsilon);
            if (cmin > cmax) { continue; }
            if (!isFinite(cmin + cmax) || Math.abs(cmin) > 1e12 || Math.abs(cmax) > 1e12) { throw new Error("Lattice indices exceed the numeric range."); }
            count += cmax - cmin + 1;
            if (count > MAX) { return exceeded(count); }
            for (c = cmin; c <= cmax; c += 1) {
                points.push({ x: bx + c * h.x, y: by + c * h.y, column: c || 0, row: r || 0 });
            }
        }
        return { points: points, count: count, exceeded: false, warning: count > 2000, lattice: basis };
    }
    function plan(s, footprint) { return s.layout === "lattice" ? latticePlan(s, footprint) : legacyPlan(s, footprint); }
    var api = { validate: validate, plan: plan, vectors: vectors, mod: mod, maxInstances: MAX,
        units: { pt: 1, mm: 72 / 25.4, cm: 72 / 2.54, "in": 72 } };
    root.SeamlessRepeat = api;
    if (typeof module !== "undefined" && module.exports) { module.exports = api; }
}(typeof $ !== "undefined" && $.global ? $.global : this));
