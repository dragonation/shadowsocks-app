const { 
    analyzeSubscription,
    updateSubscription, 
    updateSubscriptions, 
    addSubscriptionURL, 
    removeSubscriptionURL 
} = require("./subscription.js");

const { 

    loadPreferences, 
    savePreferences,

    loadURIs,
    updateURIs,

    modifyURI,
    deleteURI
    
} = require("./preferences.js");

const { 
    ShadowsocksURI,
    parseURIs
} = require("./uri.js");

const { 
    stopShadowsocksRIfRuning,
    startShadowsocksR,
    initializeShadowsocksR,
    getShadowsocksRRunningInfo
} = require("./shadowsocksr.js");

let connected = undefined;

@heard.rpc("ssr.subscription.update").then(function (url) {

    if (url) {
        return updateSubscription(url);
    } else {
        return updateSubscriptions();
    }

});

@heard.rpc("ssr.subscription.add").then(function (url) {

    return @.async(function () {

        addSubscriptionURL(url);

        this.next();

    });

});

@heard.rpc("ssr.subscription.analyze").then(function (url) {

    return analyzeSubscription(url);

});

@heard.rpc("ssr.subscription.remove").then(function (url) {

    let removeConfigs = true;
    if (url.url) {
        removeConfigs = url.configs;
        url = url.url;
    }

    return @.async(function () {

        removeSubscriptionURL(url, removeConfigs);

        this.next();

    });

});

@heard.rpc("ssr.uri.list").then(function () {

    return @.async.resolve(loadURIs());

});

@heard.rpc("ssr.uri.url").then(function (content) {

    return @.async.resolve(new ShadowsocksURI(content).toString());

});

@heard.rpc("ssr.uri.delete").then(function (config) {

    return @.async(function () {

        deleteURI(config);

        this.next();

    });

});

@heard.rpc("ssr.uri.modify").then(function (content) {

    let newConfig = content["new"];
    let oldConfig = content["old"];

    return @.async(function () {

        modifyURI(newConfig, oldConfig);

        this.next();

    });

});

@heard.rpc("ssr.uri.import").then(function (uris) {

    return @.async(function () {

        let configs = uris.filter((uri) => uri && (typeof uri !== "string"));
        let strings = uris.filter((uri) => typeof uri === "string");

        let { fakes, parseds } = parseURIs(strings);

        let result = updateURIs(null, configs.concat(parseds));

        this.next({
            "fakes": fakes,
            "adds": result.adds,
            "removes": result.removes,
            "kepts": result.kepts,
            "updates": result.updates
        });

    });

});

@heard.rpc("ssr.connect").then(function (config) {

    let preferences = loadPreferences();

    return initializeShadowsocksR().then(function () {

        startShadowsocksR({
            "serveSocks5ProxyForLAN": preferences.serveSocks5ProxyForLAN,
            "localSocks5ProxyPort": preferences.localSocks5ProxyPort,
            "pythonLocation": preferences.pythonLocation,
            "remoteConfig": config
        }).pipe(this);

    });

});

@heard.rpc("ssr.test").then(function (config) {

    let preferences = loadPreferences();

    return initializeShadowsocksR().then(function () {

        let info = getShadowsocksRRunningInfo();

        let advanced = false;
        startShadowsocksR({
            "serveSocks5ProxyForLAN": preferences.serveSocks5ProxyForLAN,
            "localSocks5ProxyPort": preferences.localSocks5ProxyPort,
            "preferIPv6ForLAN": preferences.preferIPv6ForLAN,
            "remoteConfig": config,
            "testing": (error) => {
                if (advanced) { return; }
                advanced = true;
                if (info) {
                    startShadowsocksR({
                        "serveSocks5ProxyForLAN": preferences.serveSocks5ProxyForLAN,
                        "localSocks5ProxyPort": preferences.localSocks5ProxyPort,           
                        "preferIPv6ForLAN": preferences.preferIPv6ForLAN,
                        "remoteConfig": info.config
                    }).rejected((error) => {
                        @error(error);
                    });
                }
                this.next({
                    "succeeded": error ? false : true, 
                    "reason": error ? error.message : undefined
                });
            }
        }).rejected((error) => {
            if (advanced) { return; }
            advanced = true;
            if (info) {
                startShadowsocksR({
                    "serveSocks5ProxyForLAN": preferences.serveSocks5ProxyForLAN,
                    "localSocks5ProxyPort": preferences.localSocks5ProxyPort,           
                    "preferIPv6ForLAN": preferences.preferIPv6ForLAN,
                    "remoteConfig": info.config
                }).rejected((error) => {
                    @error(error);
                });
            }
            this.reject(error);
        });

    });

});

@heard.rpc("ssr.disconnect").then(function () {

    return stopShadowsocksRIfRuning();

});

@heard.rpc("ssr.running").then(function () {

    return @.async.resolve(getShadowsocksRRunningInfo());

});

@heard.rpc("ssr.preferences.load").then(function () {

    return @.async.resolve(loadPreferences());

});

@heard.rpc("ssr.preferences.save").then(function (dirty) {

    return @.async(function () {

        savePreferences(dirty);

        this.next();

    });

});
