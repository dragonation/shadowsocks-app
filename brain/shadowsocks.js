const { 
    copyProxyEnvironments,
    configNoProxy, configPACProxy, configManualProxy
} = require("./proxy.js");

let started = false;

const notificationIconPath = @path(@mewchan().entryPath, "res/notification.png");

const menuActions = Object.create(null);

const updateTrayIcon = function (preferences, runningInfo) {

    let icon = @path(@mewchan().entryPath, "res/tray.disconnected.png");
    if (runningInfo) {
        switch (preferences.proxyMode) {
            case "pac": {
                icon = @path(@mewchan().entryPath, "res/tray.pac-proxy.png"); break;
            }
            case "manual": {
                icon = @path(@mewchan().entryPath, "res/tray.manual-proxy.png"); break;
            }
            case "none": 
            default: {
                icon = @path(@mewchan().entryPath, "res/tray.png"); break;
            }
        }
    }

    @mew.rpc("garden.tray.icon", {
        "icon": icon
    }).rejected((error) => {
        @error(error);
    });

};

const updateTrayMenuProxyModes = function () {

    @mew.rpc("ssr.preferences.load").then(function (preferences) {

        @mew.rpc("ssr.running").then(function (info) {

            updateTrayIcon(preferences, info);

            @mew.rpc("garden.tray.menu-item", {
                "config": { 
                    "id": "no-proxy",
                    "checked": preferences.proxyMode === "none"
                }
            });

            @mew.rpc("garden.tray.menu-item", {
                "config": { 
                    "id": "pac-proxy",
                    "checked": preferences.proxyMode === "pac"
                }
            });

            @mew.rpc("garden.tray.menu-item", {
                "config": { 
                    "id": "manual-proxy",
                    "checked": preferences.proxyMode === "manual"
                }
            });

        }).pipe(this);

    }).rejected((error) => {
        @error(error);
    });

};

const updateTrayMenuConnectionStates = function () {

    @mew.rpc("ssr.preferences.load").then(function (preferences) {

        @mew.rpc("ssr.running").then(function (info) {

            updateTrayIcon(preferences, info);

            @mew.rpc("garden.tray.menu-item", {
                "config": { 
                    "id": "connect-shadowsocks",
                    "label": (preferences.lastConnection ? 
                              "Connect “" + preferences.lastConnection.name + "”" : 
                              "Connect..."),
                    "visible": info ? false : true 
                }
            }).rejected((error) => {
                @error(error);
            });

            @mew.rpc("garden.tray.menu-item", {
                "config": { 
                    "id": "disconnect-shadowsocks",
                    "label": (info ? 
                              `Disconnect “${info.config.name}”` :
                              "Disconnect"),
                    "visible": info ? true : false
                }
            }).rejected((error) => {
                @error(error);
            });

            this.next();

        }).pipe(this);

    }).rejected((error) => {
        @error(error);
    });

};

@heard("garden.started").then(function (mew) {

    let { commandLine, workingDirectory } = mew.content["garden.started"];

    // parse command line 

    if (started) { return; }
    started = true;

    @mew.rpc("ssr.preferences.load").then(function (preferences) {

        if (preferences.autoupdateSubscriptionsAfterStarted) {
            @mew.rpc("ssr.subscription.update").rejected(function (error) {
                @error(error);
            });
        }

        if (preferences.autoupdateGFWListAfterStarted) {
            @mew.rpc("gfwlist.update").rejected(function (error) {
                @error(error);
            });
        }

        @mew.rpc("proxy.autoconfig").rejected((error) => {
            @error(error);
        });

        if ((!preferences.autoreconnectAfterStarted) ||
            (!preferences.lastConnection) ||
            (!preferences.lastConnectionConnected)) {
            return;
        }

        @mew.rpc("ssr.connect", preferences.lastConnection).rejected((error) => {
            @error(error);
        });

        this.next();

    });

});

@heard("garden.tray.default.installed").then(function () {
    updateTrayMenuProxyModes();
    updateTrayMenuConnectionStates();
});

@heard("garden.tray.menu.clicked").then(function (mew) {

    let { id, menu } = mew.content["garden.tray.menu.clicked"];

    if (menuActions[menu]) {
        try {
            menuActions[menu]();
        } catch (error) {
            @error(error);
        }
    }

});

@heard("ssr.subscription.updated").then(function (mew) {

    let info = mew.content["ssr.subscription.updated"];

    let fakes = 0;
    let updates = 0;
    let kepts = 0;
    let adds = 0;
    let removes = 0;
    let errors = 0;

    for (let key in info) {
        if (info[key].error) {
            ++errors;
        } else {
            fakes += info[key].fakes.length;
            updates += info[key].updates.length;
            kepts += info[key].kepts.length;
            adds += info[key].adds.length;
            removes += info[key].removes.length;
        }
    }

    let texts = [];
    if (errors) { texts.push(`error: ${errors}`); }
    if (adds) { texts.push(`added: ${adds}`); }
    if (removes) { texts.push(`removed: ${removes}`); }
    if (updates) { texts.push(`updated: ${updates}`); }
    if (fakes) { texts.push(`ignored: ${fakes}`); }
    if (texts.length === 0) {
        texts.push("No config changeds");
    }

    let text = texts.join(", ");
    text = text[0].toUpperCase() + text.slice(1);

    @mew.rpc("garden.notification.create", {
        "title": "Shadowsocks subscriptions updated",
        "body": text,
        "icon": notificationIconPath
    }).pipe(this);

});

@heard("ssr.connected").then(function (mew) {

    let info = mew.content["ssr.connected"];

    updateTrayMenuConnectionStates();

    if (!info.testing) {
        @mew.rpc("garden.notification.create", {
            "title": `Shadowsocks${info.config.group ? "[" + info.config.group.toUpperCase().trim() + "]" : ""} connected`,
            "body": info.config.name,
            "icon": notificationIconPath
        });
    }

    @mew.rpc("proxy.http.socks5", { 
        "host": info.host, 
        "port": info.port 
    }).rejected(function (error) {
        @error(error);
    });

    @mew.rpc("gfwlist.proxy.socks5", { 
        "host": info.host, 
        "port": info.port 
    }).rejected(function (error) {
        @error(error);
    });

    @mew.rpc("ssr.preferences.load").then(function (preferences) {

        if (preferences.enableHTTPProxy) {
            @mew.rpc("proxy.http.start", {
                "serveHTTPProxyForLAN": preferences.serveHTTPProxyForLAN,
                "localHTTPProxyPort": preferences.localHTTPProxyPort
            }).rejected(function (error) {
                @error(error);
            });
        }

        if (preferences.enablePACServer) {
            @mew.rpc("gfwlist.pac.start", { 
                "servePACServerForLAN": preferences.servePACServerForLAN, 
                "localPACServerPort": preferences.localPACServerPort 
            }).rejected(function (error) {
                @error(error);
            });
        }

        @mew.rpc("proxy.autoconfig").rejected((error) => {
            @error(error);
        });

    });

});

@heard("ssr.disconnected").then(function (mew) {

    let info = mew.content["ssr.disconnected"];

    updateTrayMenuConnectionStates();

    if (!info.testing) {
        @mew.rpc("garden.notification.create", {
            "title": `Shadowsocks${info.config.group ? "[" + info.config.group.toUpperCase().trim() + "]" : ""} disconnected`,
            "body": info.config.name,
            "icon": notificationIconPath
        });
    }

    @mew.rpc("proxy.http.socks5", { 
        "host": "127.0.0.1", 
        "port": 0
    }).rejected(function (error) {
        @error(error);
    });

    @mew.rpc("gfwlist.proxy.socks5", { 
        "host": "127.0.0.1", 
        "port": 0
    }).rejected(function (error) {
        @error(error);
    });

    @mew.rpc("proxy.autoconfig").rejected((error) => {
        @error(error);
    });

    @mew.rpc("proxy.http.stop").rejected(function (error) {
        @error(error);
    });

    @mew.rpc("gfwlist.pac.stop").rejected(function (error) {
        @error(error);
    });

});

@heard("ssr.test.failed").then(function (mew) {

    let info = mew.content["ssr.test.failed"];

    @mew.rpc("garden.notification.create", {
        "title": `Shadowsocks${info.config.group ? "[" + info.config.group.toUpperCase().trim() + "]" : ""} test failed`,
        "body": `${info.config.name}: Google maybe not work...`,
        "icon": notificationIconPath
    }).pipe(this);

});

@heard("ssr.test.succeeded").then(function (mew) {

    let info = mew.content["ssr.test.succeeded"];

    @mew.rpc("garden.notification.create", {
        "title": `Shadowsocks${info.config.group ? "[" + info.config.group.toUpperCase().trim() + "]" : ""} test succeeded`,
        "body": `${info.config.name}: Google works!`,
        "icon": notificationIconPath
    }).pipe(this);

});

@heard("ssr.subscription.added").then(function (mew) {

    let url = mew.content["ssr.subscription.added"];

    @mew.rpc("ssr.subscription.update", url).then(function (result) {

        let fakes = 0;
        let updates = 0;
        let kepts = 0;
        let adds = 0;
        let removes = 0;

        fakes += result.fakes.length;
        updates += result.updates.length;
        kepts += result.kepts.length;
        adds += result.adds.length;
        removes += result.removes.length;

        let texts = [];
        if (adds) { texts.push(`added: ${adds}`); }
        if (removes) { texts.push(`removed: ${removes}`); }
        if (updates) { texts.push(`updated: ${updates}`); }
        if (fakes) { texts.push(`ignored: ${fakes}`); }
        if (texts.length === 0) {
            texts.push("No config changeds");
        }

        let text = texts.join(", ");
        text = text[0].toUpperCase() + text.slice(1);

        @mew.rpc("garden.notification.create", {
            "title": "Shadowsocks subscriptions updated",
            "body": text,
            "icon": notificationIconPath
        }).pipe(this);

        @mew.auto("ssr.subscription.added-updated", {
            "url": url,
            "fakes": result.fakes,
            "updates": result.updates,
            "kepts": result.kepts,
            "adds": result.adds,
            "removes": result.removes
        });

    }).rejected((error) => {
        @error(error);
    });

});

@heard("proxy.http.started").then(function (mew) {

    let info = mew.content["proxy.http.started"];

    @mew.rpc("gfwlist.proxy.http", { 
        "host": info.host, 
        "port": info.port 
    }).rejected(function (error) {
        @error(error);
    });

});

@heard("proxy.http.stopped").then(function (mew) {

    @mew.rpc("gfwlist.proxy.http", { 
        "host": "127.0.0.1", 
        "port": 0
    }).rejected(function (error) {
        @error(error);
    });

});

@heard("gfwlist.pac.started").then(function (mew) {});

@heard("gfwlist.pac.stopped").then(function (mew) {});

@heard("gfwlist.pac.updated").then(function (mew) {

    @mew.rpc("garden.notification.create", {
        "title": `PAC text file has been updated`,
        "body": `GFWList at github.com`,
        "icon": notificationIconPath
    }).pipe(this);

});

@heard("ssr.preferences.updated").then(function (mew) {

    let dirties = mew.content["ssr.preferences.updated"];

    @.async(async function () {

        let running = await @mew.rpc("ssr.running");
        if (!running) {
            return;
        }

        let preferences = await @mew.rpc("ssr.preferences.load");

        if ((dirties.serveSocks5ProxyForLAN !== undefined) ||
            (dirties.localSocks5ProxyPort !== undefined) ||
            (dirties.pythonLocation !== undefined)) {
            @mew.rpc("ssr.connect", running.config).rejected((error) => {
                @error(error);
            });
            return;
        }

        if ((dirties.enableHTTPProxy !== undefined) ||
            (dirties.serveHTTPProxyForLAN !== undefined) ||
            (dirties.localHTTPProxyPort !== undefined)) {
            if (preferences.enableHTTPProxy) {
                @mew.rpc("proxy.http.start", {
                    "serveHTTPProxyForLAN": preferences.serveHTTPProxyForLAN,
                    "localHTTPProxyPort": preferences.localHTTPProxyPort
                }).rejected(function (error) {
                    @error(error);
                });
            }
        }

        if ((dirties.enablePACServer !== undefined) ||
            (dirties.servePACServerForLAN !== undefined) ||
            (dirties.localPACServerPort !== undefined)) {
            if (preferences.enablePACServer) {
                @mew.rpc("gfwlist.pac.start", { 
                    "servePACServerForLAN": preferences.servePACServerForLAN, 
                    "localPACServerPort": preferences.localPACServerPort 
                }).rejected(function (error) {
                    @error(error);
                });
            }
        }

        if (dirties.proxyMode !== undefined) {
            updateTrayMenuProxyModes();
            @mew.rpc("proxy.autoconfig").rejected((error) => {
                @error(error);
            });
        }

    }).rejected((error) => {
        @error(error);
    });

});

menuActions["open-shadowsocks"] = function () {

    @mew.rpc("ssr.window.show", { "id": "shadowsocks" }).rejected((error) => {
        @error(error);
    });

};

menuActions["connect-shadowsocks"] = function () {

    @mew.rpc("ssr.preferences.load").then(function (preferences) {

        if (!preferences.lastConnection) {
            @mew.rpc("ssr.window.show", { "id": "shadowsocks" }).pipe(this);
            return;
        }

        @mew.rpc("ssr.connect", preferences.lastConnection);

    }).rejected((error) => {
        @error(error);
    });

};

menuActions["disconnect-shadowsocks"] = function () {

    @mew.rpc("ssr.disconnect").rejected((error) => {
        @error(error);
    });

};

menuActions["no-proxy"] = function () {

    configNoProxy().rejected((error) => {
        @error(error);
    });

};

menuActions["pac-proxy"] = function () {

    configPACProxy().rejected((error) => {
        @error(error);
    });

};
menuActions["manual-proxy"] = function () {

    configManualProxy().rejected((error) => {
        @error(error);
    });

};

menuActions["copy-proxy-environments"] = function () {

    copyProxyEnvironments().rejected((error) => {
        @error(error);
    });

};

menuActions["update-pac-text"] = function () {

    @mew.rpc("gfwlist.update").rejected(function (error) {
        @error(error);
    });

};

menuActions["update-subscriptions"] = function () {

    @mew.rpc("ssr.subscription.update").rejected(function (error) {
        @error(error);
    });

};

menuActions["import-from-clipboard"] = function () {

    @mew.rpc("garden.clipboard.get").then(function (result) {

        let text = result["text/plain"];
        if (!text) {
            throw new Error("No content found in clipboard");
        }

        text = Buffer.from(text, "base64").toString("utf8");

        if (text[0] === "{") {
            let config = JSON.parse(text);
            @mew.rpc("ssr.uri.import", [{
                "type": "ssr",
                "server": config.server,
                "port": config.server_port,
                "password": config.password,
                "method": config.method,
                "obfuscation": config.obfs,
                "obfuscationParameters": config.obfs_param,
                "protocol": config.protocol,
                "protocolParameters": config.protocol_param,
                "group": "clipboard",
                "name": `${config.server.split(".")[0]}:${config.server_port} - ${@.format.date(new Date(), "MMDDhhmmss")}`
            }]).pipe(this);
        } else {
            switch (text.trim().split("://")[0]) {
                case "ss": 
                case "ssr": {
                    let uris = text.split(/[\r\n\s]+/).filter((line) => line.trim());
                    @mew.rpc("ssr.uri.import", uris).pipe(this);
                    break;
                }
                default: {
                    throw new Error("No content found in clipboard");
                }
            }
        }

    }).then(function (result) {

        let texts = [];
        if (result.adds.length) { texts.push(`added: ${result.adds.map(item => item.name).join(", ")}`); }
        if (result.updates.length) { texts.push(`updated: ${result.updates}`); }
        if (result.fakes.length) { texts.push(`ignored: ${result.fakes}`); }
        if (texts.length === 0) {
            texts.push("No config changeds");
        }

        let text = texts.join("; ");
        text = text[0].toUpperCase() + text.slice(1);

        @mew.rpc("garden.notification.create", {
            "title": "Shadowsocks configs import from clipboard",
            "body": text,
            "icon": notificationIconPath
        });

        @mew.auto("ssr.uri.imported");

    }).rejected((error) => {
        @error(error);
    });

};

menuActions["import-from-new-subscription-url"] = function () {

    @mew.rpc("ssr.window.show", { "id": "import" }).rejected((error) => {
        @error(error);
    });

};

menuActions["preferences"] = function () {

    @mew.rpc("ssr.window.show", { "id": "preferences" }).rejected((error) => {
        @error(error);
    });

};

menuActions["quit-shadowsocks"] = function () {

    process.exit(0);

};
