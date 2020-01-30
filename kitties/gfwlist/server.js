const http = require("http");
const { parse } = require("url");

let pacServer = undefined;
let pacServerRunning = false;

let pacText = @.fs.readFile.sync(@path(@mewchan().entryPath, "data/gfwlist/pac.txt"), "utf8");

let servePACServerForLAN = false;
let localPACServerPort = 0;

let socks5ProxyHost = 0;
let socks5ProxyPort = 0;

let httpProxyHost = 0;
let httpProxyPort = 0;

const updatePACText = function (newText) {

    pacText = newText;

    @.fs.writeFile.sync(@path(@mewchan().entryPath, "data/gfwlist/pac.txt"), newText);

    @mew.auto("gfwlist.pac.updated");

};

const updateSocks5Proxy = function (host, port) {

    socks5ProxyHost = host;
    socks5ProxyPort = port;

};

const updateHTTPProxy = function (host, port) {

    httpProxyHost = host;
    httpProxyPort = port;

};

const preparePACServer = function () {

    if (!pacServer) {

        pacServer = http.createServer(function (request, response) {

            if (parse(request.url).pathname !== "/proxy.pac") {
                response.writeHead(404, {
                    "Content-Type": "text/plain",
                    "Connection": "close"
                });
                response.write("NOT FOUND");
                response.end();
                return;
            }

            response.writeHead(200, {
                "Content-Type": "application/x-ns-proxy-autoconfig",
                "Connection": "close"
            });
            let configs = [
                `SOCKS5 ${socks5ProxyHost}:${socks5ProxyPort}`,
                `SOCKS ${socks5ProxyHost}:${socks5ProxyPort}`,
                `PROXY ${socks5ProxyHost}:${socks5ProxyPort}`
            ];
            if (httpProxyPort) {
                configs.push(`PROXY ${httpProxyHost}:${httpProxyPort}`);
            }
            configs.push("DIRECT");
            response.write(pacText.replace(/__PROXY__/g, configs.join("; ")));
            response.end();

        });

        pacServer.on("listening", function () {
            const localListeningHost = servePACServerForLAN ? "::" : "127.0.0.1";
            @info(`PAC server[${localListeningHost}:${localPACServerPort}] started`);
        });

        pacServer.on("error", function (error) {
            @error(`PAC server error`);
            @error(error);
        });

    }

    return pacServer;

};

const activatePACServer = function (options) {

    servePACServerForLAN = options.servePACServerForLAN;

    localPACServerPort = options.localPACServerPort;

    const localListeningHost = servePACServerForLAN ? "0.0.0.0" : "127.0.0.1";

    return @.async(function () {

        deactivatePACServerIfRuning().pipe(this);
        
    }).then(function () {

        @.net.availablePort({ "port": localPACServerPort }, (error, port) => {

            if (error) {
                this.reject(error); return;
            }

            if (port === localPACServerPort) {
                this.next();
            } else {
                this.reject(new Error("Port not available"));
            }
            
        });

    }).then(function () {

        let pacServer = preparePACServer();

        pacServer.listen(localPACServerPort, localListeningHost);

        pacServerRunning = true;

        @mew.auto("gfwlist.pac.started", {
            "host": localListeningHost,
            "port": localPACServerPort
        });

        this.next();
    
    });

};

const deactivatePACServerIfRuning = function () {

    return @.async(function () {

        if (pacServerRunning) {
            pacServerRunning = false;
            pacServer.close((error) => {
                if (error) {
                    this.reject(error); return;
                }
                @info(`PAC server stopped`);
                @mew.auto("gfwlist.pac.stopped");
                this.next();
            });
            return;
        }

        this.next();

    });

};

module.exports.updatePACText = updatePACText;
module.exports.updateSocks5Proxy = updateSocks5Proxy;
module.exports.updateHTTPProxy = updateHTTPProxy;

module.exports.activatePACServer = activatePACServer;
module.exports.deactivatePACServerIfRuning = deactivatePACServerIfRuning;
