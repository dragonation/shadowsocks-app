const { ShadowsocksURI } = require("./uri.js");

const urisPath = @.fs.homePath(".shadowsocks/uris.json");
const preferencesPath = @.fs.homePath(".shadowsocks/preferences.json");

let preferences = undefined;

const loadPreferences = function () {

    if (!preferences) {
        if (@.fs.exists(preferencesPath)) {
            try {
                preferences = JSON.parse(@.fs.readFile.sync(preferencesPath));
            } catch (error) {
                @error(error);
            }
        }
        if (!preferences) {
            preferences = {

                "autoreconnectAfterStarted": true,
                
                "autoupdateSubscriptionsAfterStarted": true,
                "autoupdateGFWListAfterStarted": true,

                "preferIPv6ForLAN": false,
                "proxyMode": "pac",

                "serveSocks5ProxyForLAN": true,
                "localSocks5ProxyPort": 1086,

                "enableHTTPProxy": true,
                "serveHTTPProxyForLAN": true,
                "localHTTPProxyPort": 1087,

                "enablePACServer": true,
                "servePACServerForLAN": true,
                "localPACServerPort": 1088,
                "pacServerGFWListURL": "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt",

                "lastConnection": null,
                "lastConnectionConnected": false,

                "subscriptionURLs": [],
                "pythonLocation": @.task.resolve("python")

            };   
        }
    }

    return preferences;

};

const savePreferences = function (dirties) {

    let newPreferences = Object.assign({}, preferences, dirties);

    @.fs.makeDirs(@.fs.dirname(preferencesPath));

    @.fs.writeFile.sync(preferencesPath, JSON.stringify(newPreferences, null, 4));

    preferences = newPreferences;

    @mew.auto("ssr.preferences.updated", dirties);

};

const loadURIs = function () {

    let uris = [];
    if (@.fs.exists(urisPath)) {
        try {
            uris = JSON.parse(@.fs.readFile.sync(urisPath, "utf8")).map((uri) => {
                return new ShadowsocksURI(uri);
            });
        } catch (error) {
            @error("Failed to restore URIs");
            @error(error);
        }
    }

    return uris;

};

const modifyURI = function (newConfig, oldConfig) {

    let uris = loadURIs();

    if (oldConfig) {
        let index = -1;
        for (let looper = 0; looper < uris.length; ++looper) {
            let uri = uris[looper];
            if ((uri.group === oldConfig.group) && 
                (uri.name === oldConfig.name)) {
                index = looper;
            }
        }
        if (index === -1) {
            oldConfig = null;
        } else {
            uris.splice(index, 1);
        }
    }

    for (let looper = 0; looper < uris.length; ++looper) {
        let uri = uris[looper];
        if ((uri.group === newConfig.group) && 
            (uri.name === newConfig.name)) {
            throw new Error("Conflicted config with the same group and name");
        }
    }

    let config = {
        "type": newConfig.type,
        "group": newConfig.group,
        "name": newConfig.name,
        "server": newConfig.server,
        "port": newConfig.port,
        "method": newConfig.method,
        "password": newConfig.password,
        "protocol": newConfig.protocol,
        "protocolParameters": newConfig.protocolParameters,
        "obfuscation": newConfig.obfuscation,
        "obfuscationParameters": newConfig.obfuscationParameters
    };

    uris.push(new ShadowsocksURI(config));

    @.fs.writeFile.sync(urisPath, JSON.stringify(uris, null, 4));

    @mew.auto("ssr.uri.modified");

};

const deleteURI = function (config) {

    let uris = loadURIs();

    let group = config.group;
    if (!group) { group = ""; }
    let name = config.name;
    if (!name) { name = ""; }

    let index = -1;
    for (let looper = 0; looper < uris.length; ++looper) {
        let uri = uris[looper];
        if ((uri.group === group) && 
            (uri.name === name)) {
            index = looper;
        }
    }

    if (index !== -1) {
        uris.splice(index, 1);
        @.fs.writeFile.sync(urisPath, JSON.stringify(uris, null, 4));
        @mew.auto("ssr.uri.deleted");
    }

};

const updateURIs = function (source, uris) {

    let origins = Object.create(null);

    let names = Object.create(null);

    let result = {
        "updates": [],
        "adds": [],
        "removes": [],
        "kepts": []
    };

    for (let uri of loadURIs()) {
        if (!names[uri.group]) {
            names[uri.group] = Object.create(null);
        }
        names[uri.group][uri.name] = uri;
        if (uri.source === source) {
            if (!origins[uri.group]) {
                origins[uri.group] = Object.create(null);
            }
            if (origins[uri.group][uri.name]) {
                if (uri.group) {
                    @warn(`Duplicated name shadowsocks URI[${uri.group}/${uri.name}]`);
                } else {
                    @warn(`Duplicated name shadowsocks URI[${uri.name}]`);
                }
            }
            origins[uri.group][uri.name] = uri;
        }
    }

    for (let uri of uris) {
        if (!names[uri.group]) {
            names[uri.group] = Object.create(null);
        }
        if (origins[uri.group]) {
            delete origins[uri.group][uri.name];
        }
        if (!names[uri.group][uri.name]) {
            result.adds.push(uri);
            names[uri.group][uri.name] = uri;
            uri.source = source;
        } else {
            if (names[uri.group][uri.name].toString() !== uri.toString()) {
                if (names[uri.group][uri.name].source !== source) {
                    if (uri.group) {
                        @warn(`Conflicted source shadowsocks URI[${uri.group}/${uri.name}] overwritten`);
                    } else {
                        @warn(`Conflicted source shadowsocks URI[${uri.name}] overwritten`);
                    }
                }
                result.updates.push(new ShadowsocksURI(uri));
                uri.source = source;
                names[uri.group][uri.name] = uri;
            } else {
                result.kepts.push(names[uri.group][uri.name]);
            }
        }
    }

    for (let group in origins) {
        for (let name in origins[group]) {
            result.removes.push(origins[group][name]);
            delete names[group][name];
        }
    }

    let newURIs = [];
    for (let group in names) {
        for (let name in names[group]) {
            newURIs.push(new ShadowsocksURI(names[group][name]));
        }
    }

    if ((result.adds.length > 0) ||
        (result.removes.length > 0) ||
        (result.updates.length > 0)) {
        @.fs.makeDirs(@.fs.dirname(urisPath));
        @.fs.writeFile.sync(urisPath, JSON.stringify(newURIs, null, 4));
    }

    return result;

};

module.exports.loadPreferences = loadPreferences;
module.exports.savePreferences = savePreferences;

module.exports.loadURIs = loadURIs;
module.exports.updateURIs = updateURIs;

module.exports.modifyURI = modifyURI;
module.exports.deleteURI = deleteURI;
