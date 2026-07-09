const reRegex = /\/(.*)\/[gmiyu]*/g;
function storage() { return browser.storage.sync; }
;
function regexSource(pattern) {
    return pattern instanceof RegExp ? pattern.source : String(pattern).replace(/^\/(.*)\/[gmiyu]*$/, "$1");
}
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
async function storage_get(key) {
    var _a;
    const result = await storage().get(key);
    return (_a = result[key]) !== null && _a !== void 0 ? _a : false;
}
function qSel(selector) {
    return document.querySelector(selector);
}
function qSelAll(selector) {
    return document.querySelectorAll(selector);
}
function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
}
function toggleDarkMode(isIt) {
    if (isIt) {
        document.body.classList.add("dark_mode");
        document.body.classList.remove("light_mode");
    }
    else {
        document.body.classList.remove("dark_mode");
        document.body.classList.add("light_mode");
    }
}
function getCheckedValue(groupName) {
    var radios = document.getElementsByName(groupName);
    for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
            return radios[i].value;
        }
    }
    return null;
}
function toggleTransition(isIt) {
    if (isIt) {
        document.body.classList.remove("notransition");
    }
    else {
        document.body.classList.add("notransition");
    }
}
function saveAs(blob, filename) {
    var a = document.createElement("a");
    a.style.display = "none";
    document.body.appendChild(a);
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
}
function openFile() {
    return new Promise((resolve, reject) => {
        const readFile = function (e) {
            var file = e.target["files"][0];
            if (!file) {
                return null;
            }
            var reader = new FileReader();
            reader.onload = function (e) {
                var contents = e.target.result;
                document.body.removeChild(fileInput);
                resolve(contents);
            };
            reader.onerror = function (e) {
                reject(e);
            };
            reader.readAsText(file);
        };
        const fileInput = document.createElement("input");
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        fileInput.onchange = readFile;
        fileInput.accept = "application/json";
        document.body.appendChild(fileInput);
        fileInput.click();
    });
}
window.addEventListener("load", async () => {
    qSel("#versionNumber").innerText = browser.runtime.getManifest().version + (browser.runtime.id.includes("@temporary-addon") ? " (If you don't know what you are doing, please install this extension in a normal way.)" : "");
    const config = await storage_get("nohistory_setting");
    function toggleStuff() {
        toggleDarkMode(config.darkmode);
        toggleTransition(config.animation);
    }
    Object.keys(config).forEach(key => {
        qSelAll(".setting_option").forEach(e => {
            var option = e;
            option.onclick = async () => {
                var opt = option.getAttribute("data-settingOption");
                switch (typeof config[key]) {
                    case "boolean":
                        config[opt] = option.checked;
                        break;
                    case "string":
                    case "number":
                        config[opt] = option.value;
                        break;
                }
                await storage().set({
                    "nohistory_setting": config
                });
                toggleStuff();
            };
            if (e.getAttribute("data-settingOption") != key)
                return;
            switch (typeof config[key]) {
                case "boolean":
                    e["checked"] = config[key];
                    break;
                case "string":
                case "number":
                    e["value"] = config[key];
                    break;
            }
        });
    });
    toggleStuff();
});
qSelAll("button.setting_button").forEach(result => {
    var button = result;
    button.onclick = () => {
        qSelAll("button.setting_button").forEach(e => e.classList.remove("checked"));
        button.classList.add("checked");
        qSelAll("div.setting_page").forEach(e => e.classList.remove("opened"));
        qSel(`div[data-correspondingTab="${button.getAttribute("data-tab")}"].setting_page`).classList.add("opened");
    };
});
qSel("#export_setting").onclick = async () => {
    var patternList = await listGet("nohistory_patternList");
    patternList.forEach((t, i) => {
        switch (t.type) {
            case "regex":
                patternList[i].pattern = regexSource(t.pattern);
                break;
            default:
                return "";
        }
    });
    var data = {
        "setting": await storage_get("nohistory_setting"),
        "urlList": await listGet("nohistory_urlList"),
        "patternList": patternList
    };
    var blob = new Blob([JSON.stringify(data, null, 4)], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "nohistory_config.json");
};
qSel("#import_setting").onclick = async () => {
    var _a;
    const result = await openFile();
    if (result == null || typeof result != "string")
        return;
    try {
        var data = JSON.parse(result);
    }
    catch (e) {
        alert("Invalid JSON file.");
        return;
    }
    (_a = data.patternList) === null || _a === void 0 ? void 0 : _a.forEach((t, i) => {
        switch (t.type) {
            case "regex":
                data.patternList[i].pattern = regexSource(t.pattern);
                break;
            default:
                return "";
        }
    });
    var settingJSON = {
        "nohistory_setting": data.setting,
        "nohistory_urlList": data.urlList,
        "nohistory_patternList": data.patternList
    };
    if (Object.keys(settingJSON).some(t => settingJSON[t] == null || settingJSON[t] == undefined)) {
        alert("The file you uploaded is not a valid config file.");
        return;
    }
    try {
        await storage().set({ "nohistory_setting": data.setting });
        await listSet("nohistory_urlList", data.urlList);
        await listSet("nohistory_patternList", data.patternList);
    }
    catch (e) {
        alert("Import failed: " + e.message);
        return;
    }
    location.reload();
};
const url_table = qSel("tbody#url_table");
const pattern_table = qSel("tbody#pattern_table");
async function reloadTable() {
    while (pattern_table.firstChild) {
        pattern_table.removeChild(pattern_table.lastChild);
    }
    while (url_table.firstChild) {
        url_table.removeChild(url_table.lastChild);
    }
    let urlList = await listGet("nohistory_urlList");
    let patternList = await listGet("nohistory_patternList");
    urlList.forEach((url) => {
        url_table.insertAdjacentHTML("beforeend", `
            <tr data-url="${escapeHTML(url)}">
                <td>
                    <p>${escapeHTML(url)}</p>
                </td>
                <td>
                    <button class="remove">
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
                    </button>
                </td>
            </tr>
        `);
    });
    patternList.forEach((pattern) => {
        var output = "";
        switch (pattern.type) {
            case "string":
                output = `${pattern.pattern}`;
                break;
            case "regex":
                output = `/${regexSource(pattern.pattern)}/gi`;
                break;
            default:
                output = "";
                break;
        }
        pattern_table.insertAdjacentHTML("beforeend", `
            <tr data-pattern="${escapeHTML(output)}" data-type="${escapeHTML(pattern.type)}">
                <td>
                    <p>${escapeHTML(output)}</p>
                </td>
                <td>
                    <p>${escapeHTML(pattern.type)}</p>
                </td>
                <td>
                    <button class="remove">
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
                    </button>
                </td>
            </tr>
        `);
    });
    qSelAll("button.remove").forEach(e => {
        var button = e;
        button.onclick = async () => {
            const tr = button.closest("tr");
            if (tr.getAttribute("data-pattern") != null) {
                let patternList = await listGet("nohistory_patternList");
                patternList = patternList.filter(f => {
                    switch (tr.getAttribute("data-type")) {
                        case "string":
                            return f.pattern != tr.getAttribute("data-pattern");
                        case "regex":
                            return regexSource(f.pattern) != tr.getAttribute("data-pattern").replace(reRegex, "$1");
                        default:
                            return false;
                    }
                });
                await listSet("nohistory_patternList", patternList);
            }
            else if (tr.getAttribute("data-url") != null) {
                const url = tr.getAttribute("data-url");
                let urlList = await listGet("nohistory_urlList");
                urlList = urlList.filter(e => e != url);
                await listSet("nohistory_urlList", urlList);
            }
            button.closest("tr").remove();
        };
    });
}
window.addEventListener("load", reloadTable);
qSel("#reload_everything").onclick = async () => { await reloadTable(); };
qSel("#add_url").onclick = async () => {
    const text = qSel("#addorsearchurl")["value"].trim();
    try {
        const urlObj = new URL(/^https?:\/\//i.test(text) ? text : "https://" + text);
        if (urlObj.protocol.match(/^https?:$/).length > 0) {
            let urlList = await listGet("nohistory_urlList");
            const hostname = urlObj.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
            if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(hostname)) {
                alert("Sorry, but this is not a valid URL. Please make sure it start with \"http://\" or \"https://\".");
                return;
            }
            if (urlList.indexOf(hostname) >= 0) {
                alert("This URL is already added.");
                return;
            }
            urlList.push(hostname);
            try {
                await listSet("nohistory_urlList", urlList);
            }
            catch (e) {
                alert("Could not save: " + e.message);
                return;
            }
            await reloadTable();
            qSel("#addorsearchurl")["value"] = "";
        }
        else {
            alert("Sorry, but this is not a valid URL. Please make sure it start with \"http://\" or \"https://\".");
        }
    }
    catch (e) {
        alert("Sorry, but this is not a valid URL. Please make sure it start with \"http://\" or \"https://\".");
    }
};
qSel("#add_pattern").onclick = async () => {
    const text = qSel("#addorsearchpattern")["value"];
    const mode = getCheckedValue("pattern_mode");
    const patternList = await listGet("nohistory_patternList");
    const valueList = patternList.map(value => value.type == "regex" ? regexSource(value.pattern) : value.pattern.toString());
    var yeahno = false;
    switch (mode) {
        case "string":
        case "regex":
            yeahno = valueList.indexOf(text) >= 0;
            break;
        default:
            yeahno = false;
            break;
    }
    if (yeahno) {
        alert("This pattern is already added.");
        return;
    }
    switch (mode) {
        case "string":
            patternList.push({
                "type": "string",
                "pattern": text
            });
            break;
        case "regex":
            patternList.push({
                "type": "regex",
                "pattern": text
            });
            break;
        default:
            alert("Seems like something is broken. Please report it to the developers.");
            break;
    }
    try {
        await listSet("nohistory_patternList", patternList);
    }
    catch (e) {
        alert("Could not save: " + e.message);
        return;
    }
    await reloadTable();
    qSel("#addorsearchpattern")["value"] = "";
};
