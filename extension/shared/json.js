/* Small strict JSON codec for ExtendScript engines without native JSON. No eval. */
(function (root) {
    function stringify(v) {
        var t = typeof v, a = [], k, i;
        if (v === null) { return "null"; }
        if (t === "string") {
            return '"' + v.replace(/["\\\u0000-\u001f\u2028\u2029]/g, function (c) {
                var code = c.charCodeAt(0).toString(16);
                return "\\u" + ("0000" + code).slice(-4);
            }) + '"';
        }
        if (t === "number") { return isFinite(v) ? String(v) : "null"; }
        if (t === "boolean") { return String(v); }
        if (v instanceof Array) {
            for (i = 0; i < v.length; i += 1) { a.push(stringify(v[i]) || "null"); }
            return "[" + a.join(",") + "]";
        }
        if (t === "object") {
            for (k in v) { if (Object.prototype.hasOwnProperty.call(v, k) && typeof v[k] !== "undefined") { a.push(stringify(k) + ":" + stringify(v[k])); } }
            return "{" + a.join(",") + "}";
        }
        return undefined;
    }
    function parse(input) {
        var s = String(input), p = 0;
        function fail() { throw new Error("Invalid JSON at position " + p + "."); }
        function ws() { while (/\s/.test(s.charAt(p)) && p < s.length) { p += 1; } }
        function str() {
            var result = "", c, h, escapes = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
            p += 1;
            while (p < s.length) {
                c = s.charAt(p); p += 1;
                if (c === '"') { return result; }
                if (c === "\\") {
                    c = s.charAt(p); p += 1;
                    if (c === "u") {
                        h = s.substr(p, 4); if (!/^[0-9a-fA-F]{4}$/.test(h)) { fail(); }
                        result += String.fromCharCode(parseInt(h, 16)); p += 4;
                    } else if (Object.prototype.hasOwnProperty.call(escapes, c)) { result += escapes[c]; } else { fail(); }
                } else { if (c.charCodeAt(0) < 32) { fail(); } result += c; }
            }
            fail();
        }
        function value(depth) {
            if (depth > 40) { fail(); }
            ws(); var c = s.charAt(p), out, key, m;
            if (c === '"') { return str(); }
            if (c === "{" || c === "[") {
                var obj = c === "{", end = obj ? "}" : "]";
                out = obj ? {} : []; p += 1; ws();
                if (s.charAt(p) === end) { p += 1; return out; }
                while (p < s.length) {
                    if (obj) {
                        ws(); if (s.charAt(p) !== '"') { fail(); } key = str();
                        if (key === "__proto__" || key === "constructor" || key === "prototype") { fail(); }
                        ws(); if (s.charAt(p) !== ":") { fail(); } p += 1; out[key] = value(depth + 1);
                    } else { out.push(value(depth + 1)); }
                    ws(); c = s.charAt(p); p += 1;
                    if (c === end) { return out; } if (c !== ",") { fail(); }
                }
                fail();
            }
            m = /^(true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(s.slice(p));
            if (!m) { fail(); } p += m[0].length;
            if (m[0] === "true") { return true; } if (m[0] === "false") { return false; } if (m[0] === "null") { return null; }
            out = Number(m[0]); if (!isFinite(out)) { fail(); } return out;
        }
        var result = value(0); ws(); if (p !== s.length) { fail(); } return result;
    }
    root.SeamlessJSON = { parse: parse, stringify: stringify };
    if (typeof module !== "undefined" && module.exports) { module.exports = root.SeamlessJSON; }
}(typeof $ !== "undefined" && $.global ? $.global : this));
