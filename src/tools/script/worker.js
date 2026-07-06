function normalizeHostname(hostname) {
    return hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}
function hostnameMatches(hostname, entry) {
    const h = normalizeHostname(hostname);
    const e = normalizeHostname(entry);
    return h == e || h.endsWith("." + e);
}
onmessage = async (e) => {
    var output = [];
    var urlList = e.data[0];
    var patternList = e.data[1];
    var all_history = e.data[2];
    var from = e.data[3];
    var to = e.data[4];
    all_history.forEach(v => {
        if (v.lastVisitTime < from || to < v.lastVisitTime)
            return;
        if (urlList.some(u => hostnameMatches(new URL(v.url).hostname, u)) || patternList.filter(f => {
            switch (f.type) {
                case "string":
                    return v.title.indexOf(`${f.pattern}`) != -1;
                case "regex":
                    return v.title.match(f.pattern) != null;
                default:
                    return false;
            }
        }).length > 0) {
            output.push(v);
        }
    });
    postMessage({
        total: all_history.length,
        output: output
    });
};