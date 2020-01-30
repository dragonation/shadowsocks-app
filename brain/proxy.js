const autoconfigGNOMEManualProxy = function () {

    return @mew.rpc("ssr.preferences.load").then(function (preferences) {

        @mew.rpc("ssr.running").then(function (info) {

            let host = "127.0.0.1";

            if (info) {
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy", "mode", "manual"], true);
            } else {
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy", "mode", "none"], true);
            }

            if (preferences.enableHTTPProxy) {
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.http", "host", host], true);
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.http", "port", preferences.localHTTPProxyPort], true);
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.https", "host", host], true);
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.https", "port", preferences.localHTTPProxyPort], true);
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.ftp", "host", host], true);
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.ftp", "port", preferences.localHTTPProxyPort], true);
            } else {
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.http", "host", ""], true);
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.http", "port", "0"], true);
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.https", "host", ""], true);
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.https", "port", "0"], true);
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.ftp", "host", ""], true);
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.ftp", "port", "0"], true);
            }

            @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.socks", "host", host], true);
            @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy.socks", "port", preferences.localSocks5ProxyPort], true);

            @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy", "ignore-hosts", 
                                              "['localhost', '127.0.0.0/8', '10.0.0.0/8', '192.168.0.0/16', '172.16.0.0/12' , '*.localdomain']"], true);

            this.next();

        }).pipe(this);

    });

};

const autoconfigGNOMEPACProxy = function () {

    return @mew.rpc("ssr.preferences.load").then(function (preferences) {

        @mew.rpc("ssr.running").then(function (info) {

            let host = "127.0.0.1";

            if (info) {
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy", "mode", "auto"], true);
            } else {
                @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy", "mode", "none"], true);
            }

            @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy", "autoconfig-url", 
                                              `http://${host}:${preferences.localPACServerPort}/proxy.pac`], true);

            this.next();

        }).pipe(this);

    });

};

const autoconfigGNOMENoProxy = function () {

    return @.async(function () {

        @.task.execute.sync("gsettings", ["set", "org.gnome.system.proxy", "mode", "none"], true);

        this.next();

    });

};

const configNoProxy = function () {

    return @mew.rpc("ssr.preferences.save", {
        "proxyMode": "none"
    });

};

const configManualProxy = function () {

    return @mew.rpc("ssr.preferences.save", {
        "proxyMode": "manual"
    });

};

const configPACProxy = function () {

    return @mew.rpc("ssr.preferences.save", {
        "proxyMode": "pac"
    });

};

const autoconfigNoProxy = function () {

    return autoconfigGNOMENoProxy();

};

const autoconfigManualProxy = function () {

    return autoconfigGNOMEManualProxy();

};

const autoconfigPACProxy = function () {

    return autoconfigGNOMEPACProxy();

};

const autoconfigProxy = function () {

    return @mew.rpc("ssr.preferences.load").then(function (preferences) {
        switch (preferences.proxyMode) {
            case "pac": { autoconfigPACProxy().pipe(this); break; }
            case "manual": { autoconfigManualProxy().pipe(this); break; }
            case "none": 
            default: { autoconfigNoProxy().pipe(this); break; }
        }
    });

};

const copyProxyEnvironments = function () {

    return @mew.rpc("ssr.preferences.load").then(function (preferences) {

        let host = "127.0.0.1";
        let lanHost = @.net.hostIPs(false)[0];
        if (preferences.preferIPv6ForLAN) {
            host = "[::1]";
            lanHost = "[" + @.net.hostIPs(false, true)[0] + "]";
        }

        let socks5 = `socks5h://${preferences.serveSocks5ProxyForLAN ? lanHost : host}:${preferences.localSocks5ProxyPort}`;
        let http = socks5;
        if (preferences.enableHTTPProxy) {
            http = `http://${preferences.serveHTTPProxyForLAN ? lanHost : host}:${preferences.localHTTPProxyPort}`;
        }

        let texts = [
            "export no_proxy=\"127.0.0.1,::1,localhost,localaddress,.localdomain\"",
            `export http_proxy="${http}"`,
            `export https_proxy="${http}"`,
            `export ftp_proxy="${http}"`,
            `export rsync_proxy="${http}"`,
            `export all_proxy="${socks5}"`,
        ].join("\n");

        @mew.rpc("garden.clipboard.set", {
            "text/plain": Buffer.from(texts, "utf8").toString("base64")
        }).pipe(this);

    });

};

@heard.rpc("proxy.autoconfig").then(function () {

    return autoconfigProxy();

});

module.exports.copyProxyEnvironments = copyProxyEnvironments;

module.exports.autoconfigProxy = autoconfigProxy;

module.exports.configNoProxy = configNoProxy;
module.exports.configManualProxy = configManualProxy;
module.exports.configPACProxy = configPACProxy;
