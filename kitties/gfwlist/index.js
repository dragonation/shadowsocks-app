const {
    updatePACText,
    updateSocks5Proxy,
    updateHTTPProxy,
    activatePACServer,
    deactivatePACServerIfRuning
} = require("./server.js");

const {
    generateGFWListScript,
    downloadGFWList
} = require("./update.js");


@heard.rpc("gfwlist.pac.start").then(function ({ servePACServerForLAN, localPACServerPort }) {

    return activatePACServer({ 
        "servePACServerForLAN": servePACServerForLAN, 
        "localPACServerPort": localPACServerPort
    });

});

@heard.rpc("gfwlist.pac.stop").then(function () {

    return deactivatePACServerIfRuning();

});

@heard.rpc("gfwlist.proxy.socks5").then(function ({ host, port }) {

    return @.async(function () {

        updateSocks5Proxy(host, port);

        this.next();

    });

});

@heard.rpc("gfwlist.proxy.http").then(function ({ host, port }) {

    return @.async(function () {

        updateHTTPProxy(host, port);

        this.next();

    });

});

@heard.rpc("gfwlist.update").then(function () {

    return @.async(function () {

        downloadGFWList().pipe(this);

    }).then(function (content) {

        let pacText = generateGFWListScript(content);

        updatePACText(pacText);

        this.next();

    });

});
