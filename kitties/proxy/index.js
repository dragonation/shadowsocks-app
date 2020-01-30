const {
    updateSocks5Proxy,
    activateHTTPProxy,
    deactivateHTTPProxyServerIfRunning
} = require("./http.js");

@heard.rpc("proxy.http.socks5").then(function ({ host, port }) {

    return @.async(function () {

        updateSocks5Proxy(host, port);

        this.next();

    });

});

@heard.rpc("proxy.http.start").then(function ({ serveHTTPProxyForLAN, localHTTPProxyPort }) {

    return activateHTTPProxy({
        "serveHTTPProxyForLAN": serveHTTPProxyForLAN,
        "localHTTPProxyPort": localHTTPProxyPort
    });

});

@heard.rpc("proxy.http.stop").then(function () {

    return deactivateHTTPProxyServerIfRunning();

});
