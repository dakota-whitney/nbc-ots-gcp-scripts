//Base config info/utils
export const extension = {
    appUrls: /(play\.google|appstoreconnect\.apple|developer\.roku).+(apps?|edit\/\w+)\/\d+/,
    gPubId: "AKfycbzloi6Bb8n9pA44-mzzFEExwxtKMAlQhJiksESuGBn1", //Public Deployment ID from Apps Script
    getEmail(){
        return new Promise((res,rej) => chrome.identity.getProfileUserInfo({accountStatus: "ANY"}, ({ email }) => email ? res(email) : rej(email)))
    }
};
export const disable = () => {
    chrome.action.disable();
    chrome.action.setIcon({ path: "/img/nbc_grey-32.png" });
};

export const enable = () => {
    chrome.action.enable();
    chrome.action.setIcon({ path: "/img/nbc_colored-32.png" });
};

export const toggleEnabled = currentTab => {
    if(!currentTab.url.match(extension.appUrls)) return disable();
    const inputMap = getInputMap(currentTab.url);
    if(inputMap) chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: checkInputs, args: [ inputMap ] });
    else disable();
};

export const fetchMeta = async currentTab => {
    let appId = currentTab.url.match(extension.appUrls);
    const inputMap = getInputMap(currentTab.url);
    const email = await extension.getEmail();
    console.log(email);
    if(!email) return createNotification("error", "No Google Account detected");
    else if(!appId || !inputMap) return;

    const injectOptions = { target: {tabId: currentTab.id} };

    injectOptions.func = () => document.body.style.opacity = "0.5";
    chrome.scripting.executeScript(injectOptions);

    let platform = currentTab.url.split("/")[2].split(".")[1];
    if(platform === "apple") platform = currentTab.url.match(/ios/) ? "ios" : "tvos";

    appId = appId[0].split("/").pop();

    const params = new URLSearchParams({ user: email, [`${platform}Id`]: appId });
    const ep = new URL(`/macros/s/${extension.gPubId}/dev?${params.toString()}`,"https://script.google.com");
    console.log(ep.toString());
    const encoded = encodeURI(ep.toString());

    try{
        const res = await fetch(encoded);
        const appMeta = await res.json();
        injectOptions.func = injectMeta;
        injectOptions.args = [ appMeta, inputMap, platform ];
        chrome.scripting.executeScript(injectOptions);
        for(const key of Object.keys(appMeta)) if(key.match(/name|subtitle|description/i) && !currentTab.url.match(/\/(info|main-store-listing|descriptions?)/)) return createNotification(`${platform}-app-meta`);
    }
    catch(e) {
        createNotification("error", e.message);
        injectOptions.func = () => document.body.removeAttribute("style");
        if(injectOptions.args) delete injectOptions.args;
        chrome.scripting.executeScript(injectOptions);
    };
};

export const createNotification = (notificationId, errorMessage) => {
    const notification = {
        type:"basic",
        iconUrl:"/img/nbc_colored.png",
        title:"App Release Extension",
    };

    const [ platform ] = notificationId.split("-");
    if(platform.match(/ios|tvos/)) notificationId = notificationId.replace(/ios|tvos/,"apple");

    switch(notificationId){
        case "apple-app-meta":
            notification.message = "Click here to update App Information for this release";
        break;

        case "google-app-meta":
            notification.message = "Click here to update Main store listing for this release";
        break;

        case "roku-app-meta":
            notification.message = "Click here to update Channel Store Info for this release";
        break;

        case "error":
            notification.message = `Failed to autofill app metadata: ${errorMessage}`;
        break;
    };

    chrome.notifications.create(notificationId, notification, nId => {
        console.log(`Notification ${nId} created`);
        setTimeout(() => chrome.notifications.clear(nId, wasCleared => console.log(`Notification ${nId} cleared: ${wasCleared}`)), 5000)
    });
};

export const getInputMap = appUrl => {
    let inputMap = {};

    if(appUrl.includes("appstore/info")) inputMap = {
        "#name": "Name",
        "#subtitle": "Subtitle"
    }


    else if(appUrl.includes("ios/version")) inputMap = {
        "div[name='promotionalText']": "Promotional Text",
        "div[name='whatsNew']": "What's New in This Version",
        "div[name='description']": "Description",
        "input[name='keywords']": "Keywords",
        "input[name='supportUrl']": "Support URL",
        "input[name='versionString']": "Version",
    }

    else if(appUrl.includes("main-store-listing")) inputMap = {
        "input[aria-label='Name of the app']": "App Name",
        "input[aria-label='Short description of the app']": "Short Description",
        "textarea[aria-label='Full description of the app']": "Long Description"
    }

    else if(appUrl.includes("prepare")) inputMap = {
        "textarea[aria-label='Release notes']": "What's New?"
    }

    else if(appUrl.includes("descriptions")) inputMap = {
        "input[id='language.en.name']": "Name",
        "textarea[id='language.en.description']": "Short Description",
        "textarea[id='language.en.webDescription']": "Web Description"
    }

    else return null;

    inputMap = Object.entries(inputMap);
    return inputMap;
};

//Content Scripts
export const checkInputs = inputMap => {

    const platform = location.hostname.split(".")[1]

    const inputsLoaded = (mutationList, observer) => {
        const loaded = inputMap.every(([ selector ]) => document.querySelector(selector) && !document.querySelector(selector).disabled ? true : false);
        console.log(`Inputs loaded: ${loaded}`);
        chrome.runtime.sendMessage({ enable: loaded }).catch(e => console.log(e.message));
        if(loaded && platform.match(/apple|roku/) && observer) observer.disconnect();
        return loaded;
    };

    const loaded = inputsLoaded();
    if(loaded) return true;

    if(platform.match(/apple|roku/)){
        const observer = new MutationObserver(inputsLoaded);
        observer.observe(document.querySelector("body"), { childList: true, subtree: true });
    }
    else{
        let checks = 0;
        const intervalId = setInterval(() => {

            const loaded = inputsLoaded();
            if(loaded) clearInterval(intervalId);

            checks++;
            if(checks >= 240) clearInterval(intervalId);

        }, 500);
    };
};

export const injectMeta = (appMeta, inputMap, platform) => {
    console.clear();
    console.log("appMeta: %o", appMeta);

    document.body.removeAttribute("style");

    if(appMeta.appUrls) appMeta.appUrls.forEach(({ market, url }) => console.log(`${market}\n${url}`));

    inputMap.forEach(([ selector, ssKey ]) => {
        let inputElement = document.querySelector(selector);
        if(!inputElement || inputElement.disabled || !appMeta[ssKey]) return;
        inputElement.dispatchEvent(new InputEvent('input'));
        inputElement.value = appMeta[ssKey];
        inputElement.innerText = appMeta[ssKey];
        inputElement.style = "color:#3c0997;overflow:hidden auto;border:2px solid #3c0997;";
        if(platform === "google") inputElement = inputElement.parentElement.parentElement;
        const reminder = "<p class='extension-reminder' style='color:#3c0997;font-style:italic;font-size:11px;'>REMINDER: For autofilled content to submit properly, please manually append then delete any character in this field.<br />App URLs can be found in the browser console.</p>";
        if(inputElement.nextSibling.classList) !inputElement.nextSibling.classList.contains("extension-reminder") ? inputElement.insertAdjacentHTML("afterend",reminder) : undefined;
        else inputElement.insertAdjacentHTML("afterend",reminder);
    });
};