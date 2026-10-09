(function (root) {
    var queue = [], running = false, hostVersion = "1.1.8";
    function literal(value) {
        return JSON.stringify(value).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    function extensionPath() {
        if (!root.__adobe_cep__.getSystemPath) { return ""; }
        var path = root.__adobe_cep__.getSystemPath("extension");
        // CEP hosts return either a native path or a file URI (CSInterface normally normalizes it).
        if (/^file:/i.test(path)) {
            path = decodeURI(path).replace(/^file:\/\/\//i, "").replace(/^file:\/\//i, "");
        }
        path = path.replace(/\\/g, "/");
        if (/^\/[a-z]:\//i.test(path)) { path = path.slice(1); }
        return path;
    }
    function hostCode(request, path) {
        return "(function () { try { " +
            "if (!$.global.SeamlessMaker || $.global.SeamlessMaker.version !== " + literal(hostVersion) + ") { " +
            "var extensionRoot = " + literal(path) + "; " +
            "if (!extensionRoot) { throw new Error('CEP did not provide the extension folder. Reinstall Seamless Maker.'); } " +
            "$.global.SeamlessMakerExtensionPath = extensionRoot; " +
            "var hostFile = File(extensionRoot + '/host/main.jsx'); " +
            "if (!hostFile.exists) { throw new Error('Missing host script: ' + hostFile.fsName); } " +
            "$.evalFile(hostFile); } " +
            "if (!$.global.SeamlessMaker || !$.global.SeamlessMaker.dispatch) { throw new Error('Host script did not initialize.'); } " +
            "return $.global.SeamlessMaker.dispatch(" + literal(JSON.stringify(request)) + "); " +
            "} catch (e) { return '{\"ok\":false,\"errorEncoded\":\"' + " +
            "encodeURIComponent('Host initialization failed: ' + String(e.message || e) + (e.line ? ' (line ' + e.line + ')' : '')) + '\"}'; } }())";
    }
    function pump() {
        if (running || !queue.length) { return; }
        var job = queue.shift(); running = true;
        if (!root.__adobe_cep__ || !root.__adobe_cep__.evalScript) {
            running = false; job.callback(new Error("Open this panel in Illustrator via Window > Extensions > Seamless Maker.")); pump(); return;
        }
        var code;
        try { code = hostCode(job.request, extensionPath()); }
        catch (pathError) { running = false; job.callback(pathError); pump(); return; }
        root.__adobe_cep__.evalScript(code, function (raw) {
            var response, error = null;
            try {
                response = JSON.parse(raw);
                if (!response.ok) { error = new Error(response.errorEncoded ? decodeURIComponent(response.errorEncoded) : (response.error || "Illustrator returned an error.")); }
            } catch (e) { error = new Error("Cannot connect to the Illustrator script. Close and reopen the panel. " + String(raw).slice(0, 120)); }
            running = false;
            try { job.callback(error, response && response.data); } finally { pump(); }
        });
    }
    root.SeamlessBridge = { call: function (request, callback) { queue.push({ request: request, callback: callback }); pump(); } };
}(window));


