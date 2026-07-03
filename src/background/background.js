function storage() { return browser.storage.local; }
;
async function storage_get(key) {
    var _a;
    const result = await storage().get(key);
    return (_a = result[key]) !== null && _a !== void 0 ? _a : false;
}
async function getTabList() {
    const result = await browser.storage.session.get("nohistory_tabList");
    return result["nohistory_tabList"] || [];
}
async function setTabList(list) {
    await browser.storage.session.set({ nohistory_tabList: list });
}
async function doesTabExist(tabId) {
    const tabList = await getTabList();
    return tabList.some(id => id == tabId);
}
async function doesURLExist(url) {
    const urlList = await storage_get("nohistory_urlList");
    const check = urlList.some(u => u == new URL(url).hostname);
    return check;
}
async function doesTitleExist(title) {
    const pattern = await storage_get("nohistory_patternList");
    return pattern.some(pattern => {
        switch (pattern.type) {
            case "string":
                var check_str = title.indexOf(`${pattern.pattern}`);
                return check_str != -1;
            case "regex":
                var check_re = title.match(pattern.pattern);
                return check_re != null;
            default:
                return false;
        }
    });
}
(async () => {
    const urlList = (await storage_get("nohistory_urlList")) || [];
    const patternList = (await storage_get("nohistory_patternList")) || [];
    if (urlList.length == 0) {
        await storage().set({
            "nohistory_urlList": [],
        });
    }
    if (patternList.length == 0) {
        await storage().set({
            "nohistory_patternList": [],
        });
    }
})();
function escapeString(str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
async function manageLinkInNH(mode, link) {
    const urlList = (await storage_get("nohistory_urlList")) || [];
    var link_url = new URL(link);
    if (link_url.hostname.trim() == "" || !(link_url.protocol.match(/^https?:$/).length > 0))
        return;
    switch (mode) {
        case 0:
            urlList.push(link_url.hostname);
            break;
        case 1:
            urlList.splice(urlList.indexOf(link_url.hostname), 1);
            break;
        default:
            break;
    }
    await storage().set({ nohistory_urlList: urlList });
}
browser.runtime.onMessage.addListener(async (sentMessage, _0, _1) => {
    return new Promise(async (resolve, reject) => {
        var tabs = await browser.tabs.query({ currentWindow: true, active: true });
        let tab = tabs[0];
        switch (sentMessage) {
            case "addItem":
                await manageLinkInNH(0, tab.url);
                resolve(null);
                break;
            case "removeItem":
                await manageLinkInNH(1, tab.url);
                resolve(null);
                break;
            case "addTab": {
                const tabList = await getTabList();
                tabList.push(tab.id);
                await setTabList(tabList);
                resolve(null);
                break;
            }
            case "removeTab": {
                const tabList = await getTabList();
                await setTabList(tabList.filter(id => id != tab.id));
                resolve(null);
                break;
            }
            case "isURLExist":
                const urlList = (await storage_get("nohistory_urlList")) || [];
                resolve(urlList.some(url => url == new URL(tab.url).hostname));
                break;
            case "isTabExist":
                resolve(await doesTabExist(tab.id));
                break;
            case "getCurrentURL":
                resolve(tab.url);
                break;
            case "getCurrentTabId":
                resolve(tab.id);
                break;
            default:
                reject(false);
                break;
        }
    });
});
browser.tabs.onRemoved.addListener(async (tabId) => {
    const tabList = await getTabList();
    await setTabList(tabList.filter(id => id != tabId));
});
browser.history.onTitleChanged.addListener(async (data) => {
    const check = await doesTitleExist(data.title);
    if (check)
        await browser.history.deleteUrl({ url: data.url });
});
browser.history.onVisited.addListener(async (history_data) => {
    const check = await doesURLExist(history_data.url) || await doesTitleExist(history_data.title);
    if (check) {
        await browser.history.deleteUrl({ url: history_data.url });
    }
});
browser.tabs.onUpdated.addListener(async (e, changeInfo, updatedTab) => {
    var _a;
    const check = await doesTabExist(e);
    if (check && (updatedTab === null || updatedTab === void 0 ? void 0 : updatedTab.url)) {
        await browser.history.deleteUrl({ url: updatedTab.url });
    }
    const setting = await storage_get("nohistory_setting");
    if (!setting.statusBadge) {
        browser.action.setBadgeText({ text: "" });
        return;
    }
    var tabs = await browser.tabs.query({ currentWindow: true, active: true });
    if (!tabs[0])
        return;
    var matched = (await doesURLExist(tabs[0].url)) || (await doesTabExist(tabs[0].id)) || (await doesTitleExist(tabs[0].title));
    const urlObj = new URL(tabs[0].url);
    if (urlObj.hostname.trim() == "" || !(((_a = urlObj.protocol.match(/^https?:$/)) === null || _a === void 0 ? void 0 : _a.length) > 0)) {
        browser.action.setBadgeText({ text: "?" });
        browser.action.setBadgeBackgroundColor({ color: [107, 114, 128, 255] });
        browser.action.setBadgeTextColor({ color: [255, 255, 255, 255] });
    }
    else if (matched) {
        browser.action.setBadgeText({ text: "✓" });
        browser.action.setBadgeBackgroundColor({ color: [22, 163, 74, 255] });
        browser.action.setBadgeTextColor({ color: [255, 255, 255, 255] });
    }
    else {
        browser.action.setBadgeText({ text: "" });
    }
});
