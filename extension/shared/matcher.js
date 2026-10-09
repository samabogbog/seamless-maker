/* ES3: Pattern Matcher (Reverse Solver) for Seamless Maker.
   Runs in both Node.js test runner and browser CEP environment. */
(function (root) {
    function number(value, label) {
        if (typeof value !== "number" || !isFinite(value)) { throw new Error(label + " must be a finite number."); }
        return value;
    }
    function positive(value, label) {
        number(value, label);
        if (value <= 0) { throw new Error(label + " must be greater than zero."); }
        return value;
    }

    function solve(options) {
        if (!options || typeof options !== "object") { throw new Error("Options object is required."); }
        var width = positive(options.width, "Tile width");
        var height = positive(options.height, "Tile height");

        // Support 4 vector coordinates: Horizontal (X, Y) and Vertical (X, Y)
        var targetHx = number(options.targetHx, "Horizontal X");
        var targetHy = number(options.targetHy, "Horizontal Y");
        var targetVx = number(options.targetVx, "Vertical X");
        var targetVy = number(options.targetVy, "Vertical Y");

        var targetLenH = Math.sqrt(targetHx * targetHx + targetHy * targetHy);
        var targetLenV = Math.sqrt(targetVx * targetVx + targetVy * targetVy);

        if (targetLenH < 0.000001) { throw new Error("Horizontal vector must have non-zero length."); }
        if (targetLenV < 0.000001) { throw new Error("Vertical vector must have non-zero length."); }

        var mode = options.mode === "vertical" ? "vertical" : "all";
        var maxCandidates = options.maxCandidates && options.maxCandidates > 0 ? options.maxCandidates : 5;
        var unitScale = options.unitScale && options.unitScale > 0 ? options.unitScale : 1;

        var candidates = [];
        var seen = {};

        function addCandidate(layout, cols, rows, rShift, cShift, rCycles, hx, hy, vx, vy) {
            if (cols < 1 || rows < 1 || !isFinite(hx + hy + vx + vy) || vy <= 0) { return; }
            var instances = layout === "lattice" && mode === "all" ? cols * rows * rCycles : cols * rows;
            if (instances > 10000) { return; }

            // Deduplication key
            var key = layout + ":" + cols + ":" + rows + ":" + rShift + ":" + cShift + ":" + rCycles + ":" + Math.round(hx * 100) + ":" + Math.round(hy * 100);
            if (seen[key]) { return; }
            seen[key] = true;

            // Euclidean distance error for both vectors relative to target length
            var dhx = hx - targetHx;
            var dhy = hy - targetHy;
            var errH = Math.sqrt(dhx * dhx + dhy * dhy) / targetLenH;

            var dvx = vx - targetVx;
            var dvy = vy - targetVy;
            var errV = Math.sqrt(dvx * dvx + dvy * dvy) / targetLenV;

            var totalErr = Math.sqrt((errH * errH + errV * errV) / 2);
            var matchPct = Math.max(0, Math.round((1 - totalErr) * 1000) / 10);

            // Complexity penalty for tie-breaking: Grid < Stagger < Lattice
            var complexity = 0;
            if (layout === "stagger") { complexity = 1; }
            else if (layout === "lattice") { complexity = 2 + Math.abs(rShift) + Math.abs(cShift) + (rCycles - 1); }

            candidates.push({
                layout: layout,
                mode: mode,
                columns: cols,
                rows: rows,
                rowShift: rShift,
                columnShift: cShift,
                rowCycles: rCycles,
                horizontalX: hx,
                horizontalY: hy,
                verticalX: vx,
                verticalY: vy,
                diffHx: dhx,
                diffHy: dhy,
                diffVx: dvx,
                diffVy: dvy,
                matchPct: matchPct,
                totalErr: totalErr,
                instances: instances,
                complexity: complexity
            });
        }

        var baseCols = Math.max(1, Math.round(width / (Math.abs(targetHx) > 0.001 ? Math.abs(targetHx) : targetLenH)));
        var det = Math.abs(targetHx * targetVy - targetHy * targetVx);
        var baseRows;
        if (det > 0.001) {
            var estCells = Math.max(1, Math.round((width * height) / det));
            baseRows = Math.max(1, Math.round(estCells / baseCols));
        } else {
            baseRows = Math.max(1, Math.round(height / (Math.abs(targetVy) > 0.001 ? Math.abs(targetVy) : targetLenV)));
        }

        var colMin = Math.max(1, baseCols - 5);
        var colMax = Math.min(300, baseCols + 5);
        var rowMin = Math.max(1, baseRows - 5);
        var rowMax = Math.min(300, baseRows + 5);

        var c, r, q, a, u;

        // 1. Grid search
        for (r = rowMin; r <= rowMax; r += 1) {
            for (c = colMin; c <= colMax; c += 1) {
                addCandidate("grid", c, r, 0, 0, 1, width / c, 0, 0, height / r);
            }
        }

        // 2. Staggered Rows search
        for (r = rowMin; r <= rowMax; r += 1) {
            for (c = colMin; c <= colMax; c += 1) {
                var shx = width / c;
                addCandidate("stagger", c, r, 0, 0, 1, shx, 0, 0.5 * shx, height / r);
            }
        }

        // 3. Tilted Lattice search
        if (mode === "all") {
            for (c = colMin; c <= colMax; c += 1) {
                var lhx = width / c;
                for (u = 1; u <= 3; u += 1) {
                    var qEst = Math.round((targetHy * u * c) / height);
                    for (q = qEst - 3; q <= qEst + 3; q += 1) {
                        if (Math.abs(q) > 10000) { continue; }
                        var lhy = (height * q) / (u * c);

                        var denom = (lhx * targetVy - lhy * targetVx) / lhx;
                        var rEst;
                        if (denom > 0.001) {
                            rEst = Math.max(1, Math.round((height / u) / denom));
                        } else if (Math.abs(targetVy) > 0.001) {
                            rEst = Math.max(1, Math.round((height / u) / Math.abs(targetVy)));
                        } else {
                            rEst = baseRows;
                        }

                        var rStart = Math.max(1, rEst - 3);
                        var rEnd = Math.min(300, rEst + 3);

                        for (r = rStart; r <= rEnd; r += 1) {
                            var aEst = Math.round((r * targetVx) / lhx);
                            for (a = aEst - 2; a <= aEst + 2; a += 1) {
                                if (Math.abs(a) > 10000) { continue; }
                                if (q === 0 && a === 0 && u === 1) { continue; } // Already handled by Grid
                                var lvx = (lhx * a) / r;
                                var lvy = (height / u + lhy * a) / r;
                                addCandidate("lattice", c, r, q, a, u, lhx, lhy, lvx, lvy);
                            }
                        }
                    }
                }
            }
        } else {
            // Top–Bottom mode: Horizontal X and Y are fixed to user inputs
            var tbHx = Math.abs(targetHx) > 0.000001 ? targetHx : 1;
            var tbHy = targetHy;
            for (r = rowMin; r <= rowMax; r += 1) {
                var tbAEst = Math.round((r * targetVx) / tbHx);
                for (a = tbAEst - 3; a <= tbAEst + 3; a += 1) {
                    if (Math.abs(a) > 10000) { continue; }
                    var tbVx = (tbHx * a) / r;
                    var tbVy = (height + tbHy * a) / r;
                    addCandidate("lattice", baseCols, r, 0, a, 1, tbHx, tbHy, tbVx, tbVy);
                }
            }
        }

        // Sort: highest matchPct first; if matchPct within 0.05%, prefer lower complexity, then lower totalErr
        candidates.sort(function (o1, o2) {
            var dPct = o2.matchPct - o1.matchPct;
            if (Math.abs(dPct) > 0.05) { return dPct; }
            if (o1.complexity !== o2.complexity) { return o1.complexity - o2.complexity; }
            return o1.totalErr - o2.totalErr;
        });

        // Pick top N candidates with distinct spacing/layout
        var results = [];
        var resultCount = 0;
        for (var i = 0; i < candidates.length && resultCount < maxCandidates; i += 1) {
            var cand = candidates[i];
            cand.rank = resultCount + 1;
            // Also supply values in display units
            cand.display = {
                horizontalX: cand.horizontalX / unitScale,
                horizontalY: cand.horizontalY / unitScale,
                verticalX: cand.verticalX / unitScale,
                verticalY: cand.verticalY / unitScale,
                diffHx: cand.diffHx / unitScale,
                diffHy: cand.diffHy / unitScale,
                diffVx: cand.diffVx / unitScale,
                diffVy: cand.diffVy / unitScale
            };
            results.push(cand);
            resultCount += 1;
        }

        return results;
    }

    var api = { solve: solve };
    root.SeamlessMatcher = api;
    if (typeof module !== "undefined" && module.exports) { module.exports = api; }
}(typeof $ !== "undefined" && $.global ? $.global : this));
