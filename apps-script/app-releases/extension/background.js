import * as api from "./api.js";

//Listen for enable message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => message.enable ? api.enable() : api.disable());

//When extension button is clicked
chrome.action.onClicked.addListener(tab => api.fetchMeta(tab));

//When switching tabs
chrome.tabs.onActivated.addListener(async activeInfo => {
    const activeTab = await chrome.tabs.get(activeInfo.tabId);
    api.toggleEnabled(activeTab);
});

//When a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log("Tab change info %o", changeInfo);
    if(!tab.url || !changeInfo.status || changeInfo.status !== "complete") return;
    api.toggleEnabled(tab);
});

//When a window changes focus
chrome.windows.onFocusChanged.addListener(async windowId => {
    const [ activeTab ] = await chrome.tabs.query({ windowId: windowId, active: true });
    api.toggleEnabled(activeTab);
});

//When notification is clicked
chrome.notifications.onClicked.addListener(async nId => {
    const [ currentTab ] = await chrome.tabs.query({ active: true, currentWindow: true });
    if(!currentTab.url.match(api.extension.appUrls) || !nId.includes("app-meta")) return;

    const [ platform ] = nId.split("-");
    let infoUrl = "";

    switch(platform){
        case "apple":
            infoUrl = currentTab.url.replace(/(?<=appstore\/).+/,"info");
        break;

        case "google":
            const [ googleId ] = currentTab.url.match(/(?<=app\/)\d+/);
            infoUrl = currentTab.url.replace(new RegExp(`(?<=app\/${googleId}\/).+`),"main-store-listing");
        break;

        case "roku":
            infoUrl = currentTab.url.replace(/(?<=edit\/)\w+/,"descriptions");
        break;
    };

    await chrome.tabs.update(currentTab.id, { url: infoUrl });
});