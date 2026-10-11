function storage() { return browser.storage.sync; }
;
// Lists are split across multiple keys because storage.sync caps each key
// at 8KB; chunking raises the practical limit to the 100KB total quota.
const CHUNK_BUDGET = 6000;
async function listGet(key) {
    const meta = await storage().get(key + "_chunks");
    const count = meta[key + "_chunks"];
    if (count == undefined) {
        const legacy = await storage().get(key);
        return legacy[key] || [];
    }
    const keys = [];
    for (let i = 0; i < count; i++)
        keys.push(key + "_" + i);
    const data = await storage().get(keys);
    let out = [];
    for (let i = 0; i < count; i++)
        out = out.concat(data[key + "_" + i] || []);
    return out;
}
async function listSet(key, list) {
    const chunks = [];
    let current = [];
    let size = 0;
    for (const item of list) {
        const itemSize = JSON.stringify(item).length + 1;
        if (size + itemSize > CHUNK_BUDGET && current.length > 0) {
            chunks.push(current);
            current = [];
            size = 0;
        }
        current.push(item);
        size += itemSize;
    }
    chunks.push(current);
    const toSet = {};
    chunks.forEach((c, i) => { toSet[key + "_" + i] = c; });
    toSet[key + "_chunks"] = chunks.length;
    await storage().set(toSet);
    const all = await storage().get(null);
    const stale = Object.keys(all).filter(k => {
        if (k == key)
            return true;
        if (!k.startsWith(key + "_") || k == key + "_chunks")
            return false;
        const n = parseInt(k.slice(key.length + 1), 10);
        return !isNaN(n) && n >= chunks.length;
    });
    if (stale.length > 0)
        await storage().remove(stale);
}
function normalizeHostname(hostname) {
    return hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}
function parseURL(url) {
    try {
        return new URL(url);
    }
    catch (_) {
        return null;
    }
}
function isWebURL(urlObj) {
    return !!urlObj && urlObj.hostname.trim() != "" && /^https?:$/.test(urlObj.protocol);
}
// Rules and settings are cached in memory so history and tab events don't
// hit storage.sync on every page load. The cache is dropped whenever sync
// storage changes (popup, settings page or another synced device).
let rulesPromise = null;
function compilePattern(p) {
    if (p.type == "string")
        return { type: "string", text: `${p.pattern}` };
    if (p.type == "regex") {
        try {
            const source = p.pattern instanceof RegExp ? p.pattern.source : String(p.pattern);
            return { type: "regex", re: new RegExp(source, "i") };
        }
        catch (_) {
            return null;
        }
    }
    return null;
}
async function loadRules() {
    const [urlList, patternList, settingResult] = await Promise.all([
        listGet("nohistory_urlList"),
        listGet("nohistory_patternList"),
        storage().get("nohistory_setting")
    ]);
    return {
        hosts: urlList.map(normalizeHostname),
        patterns: patternList.map(compilePattern).filter(p => p != null),
        setting: settingResult.nohistory_setting || {}
    };
}
function getRules() {
    if (!rulesPromise)
        rulesPromise = loadRules().catch(err => { rulesPromise = null; throw err; });
    return rulesPromise;
}
browser.storage.onChanged.addListener((changes, area) => {
    if (area != "sync")
        return;
    if (!Object.keys(changes).some(k => k.startsWith("nohistory_")))
        return;
    rulesPromise = null;
    refreshActiveBadges();
});
let tabSetPromise = null;
function getTabSet() {
    if (!tabSetPromise)
        tabSetPromise = browser.storage.session.get("nohistory_tabList")
            .then(r => new Set(r["nohistory_tabList"] || []));
    return tabSetPromise;
}
async function saveTabSet(set) {
    await browser.storage.session.set({ nohistory_tabList: [...set] });
}
async function doesTabExist(tabId) {
    return (await getTabSet()).has(tabId);
}
function hostMatches(rules, url) {
    const urlObj = parseURL(url);
    if (!urlObj)
        return false;
    const h = normalizeHostname(urlObj.hostname);
    return rules.hosts.some(e => h == e || h.endsWith("." + e));
}
function titleMatches(rules, title) {
    if (!title)
        return false;
    return rules.patterns.some(p => p.type == "string" ? title.indexOf(p.text) != -1 : p.re.test(title));
}
async function doesURLExist(url) {
    return hostMatches(await getRules(), url);
}
(async () => {
    // One-time migration from storage.local to storage.sync. Regex patterns
    // become plain strings because storage.sync only accepts JSON values.
    const syncData = await browser.storage.sync.get([
        "nohistory_urlList", "nohistory_urlList_chunks",
        "nohistory_patternList", "nohistory_patternList_chunks"
    ]);
    if (Object.keys(syncData).length == 0) {
        const local = await browser.storage.local.get(["nohistory_urlList", "nohistory_patternList", "nohistory_setting"]);
        if (local.nohistory_urlList)
            await listSet("nohistory_urlList", local.nohistory_urlList);
        if (local.nohistory_patternList)
            await listSet("nohistory_patternList", local.nohistory_patternList.map(p => {
                if (p.type != "regex")
                    return p;
                const source = p.pattern instanceof RegExp
                    ? p.pattern.source
                    : String(p.pattern).replace(/^\/(.*)\/[gmiyu]*$/, "$1");
                return { type: "regex", pattern: source };
            }));
        if (local.nohistory_setting)
            await browser.storage.sync.set({ nohistory_setting: local.nohistory_setting });
    }
})();
async function manageLinkInNH(mode, link) {
    const link_url = parseURL(link);
    if (!isWebURL(link_url))
        return;
    const urlList = await listGet("nohistory_urlList");
    const target = normalizeHostname(link_url.hostname);
    switch (mode) {
        case 0:
            if (!urlList.some(u => normalizeHostname(u) == target))
                urlList.push(target);
            break;
        case 1: {
            const idx = urlList.findIndex(u => normalizeHostname(u) == target);
            if (idx >= 0)
                urlList.splice(idx, 1);
            break;
        }
        default:
            break;
    }
    await listSet("nohistory_urlList", urlList);
}
async function handleMessage(sentMessage) {
    const tabs = await browser.tabs.query({ currentWindow: true, active: true });
    const tab = tabs[0];
    switch (sentMessage) {
        case "addItem":
            await manageLinkInNH(0, tab.url);
            return null;
        case "removeItem":
            await manageLinkInNH(1, tab.url);
            return null;
        case "addTab": {
            const set = await getTabSet();
            set.add(tab.id);
            await saveTabSet(set);
            updateBadge(tab);
            return null;
        }
        case "removeTab": {
            const set = await getTabSet();
            set.delete(tab.id);
            await saveTabSet(set);
            updateBadge(tab);
            return null;
        }
        case "getState":
            return {
                url: tab.url,
                tabId: tab.id,
                urlExists: await doesURLExist(tab.url),
                tabExists: await doesTabExist(tab.id)
            };
        case "isURLExist":
            return await doesURLExist(tab.url);
        case "isTabExist":
            return await doesTabExist(tab.id);
        case "getCurrentURL":
            return tab.url;
        case "getCurrentTabId":
            return tab.id;
        default:
            throw false;
    }
}
browser.runtime.onMessage.addListener((sentMessage) => handleMessage(sentMessage));
browser.tabs.onRemoved.addListener(async (tabId) => {
    const set = await getTabSet();
    if (set.delete(tabId))
        await saveTabSet(set);
});
browser.history.onTitleChanged.addListener(async (data) => {
    if (titleMatches(await getRules(), data.title))
        await browser.history.deleteUrl({ url: data.url });
});
browser.history.onVisited.addListener(async (history_data) => {
    const rules = await getRules();
    if (hostMatches(rules, history_data.url) || titleMatches(rules, history_data.title))
        await browser.history.deleteUrl({ url: history_data.url });
});
async function updateBadge(tab) {
    if (!tab)
        return;
    const rules = await getRules();
    if (!rules.setting.statusBadge) {
        browser.action.setBadgeText({ tabId: tab.id, text: "" });
        return;
    }
    if (!isWebURL(parseURL(tab.url))) {
        browser.action.setBadgeText({ tabId: tab.id, text: "?" });
        browser.action.setBadgeBackgroundColor({ tabId: tab.id, color: [107, 114, 128, 255] });
        browser.action.setBadgeTextColor({ tabId: tab.id, color: [255, 255, 255, 255] });
        return;
    }
    const matched = hostMatches(rules, tab.url) || (await doesTabExist(tab.id)) || titleMatches(rules, tab.title);
    if (matched) {
        browser.action.setBadgeText({ tabId: tab.id, text: "✓" });
        browser.action.setBadgeBackgroundColor({ tabId: tab.id, color: [22, 163, 74, 255] });
        browser.action.setBadgeTextColor({ tabId: tab.id, color: [255, 255, 255, 255] });
    }
    else {
        browser.action.setBadgeText({ tabId: tab.id, text: "" });
    }
}
async function refreshActiveBadges() {
    const tabs = await browser.tabs.query({ active: true });
    tabs.forEach(updateBadge);
}
// Filtered so favicon, audio and other unrelated tab updates don't wake us.
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, updatedTab) => {
    if (updatedTab.url && await doesTabExist(tabId))
        await browser.history.deleteUrl({ url: updatedTab.url });
    await updateBadge(updatedTab);
}, { properties: ["url", "title", "status"] });
browser.tabs.onActivated.addListener(async ({ tabId }) => {
    updateBadge(await browser.tabs.get(tabId));
});
