const { parse } = require("url");
const http = require("http");

const { Socks5Agent } = require("./agent.js");
const { createSocks5Connection } = require("./connection.js");

let httpServer = undefined;
let httpServerRunning = false;

let serveHTTPProxyForLAN = false;
let localHTTPProxyPort = 0;

let socks5ProxyHost = undefined;
let socks5ProxyPort = 0;

const updateSocks5Proxy = function (host, port) {

    socks5ProxyHost = host;
    socks5ProxyPort = port;

};

const prepareHTTPProxyServer = function () {

    if (!httpServer) {

        httpServer = http.createServer();

        let proxy = {
            "host": socks5ProxyHost,
            "port": socks5ProxyPort
        };

        httpServer.on("connect", function (request, httpSocket, head) {

            @debug(`Connecting to ${request.url}`);

            const url = parse("http://" + request.url);
            const options = {
                "proxy": proxy,
                "target": { "host": url.hostname, "port": url.port },
                "command": "connect"
            };

            createSocks5Connection(options, (error, socks5Socket) => {

                if (error) {
                    httpSocket.write(`HTTP/${request.httpVersion} 500 Connection error\r\n\r\n`);
                    @error(error);
                    return;
                }
  
                socks5Socket.pipe(httpSocket);
                httpSocket.pipe(socks5Socket);
  
                socks5Socket.write(head);
                httpSocket.write(`HTTP/${request.httpVersion} 200 Connection established\r\n\r\n`);
                socks5Socket.resume();

            });

        });

        httpServer.on("request", function (request, response) {

            @debug(`Requesting ${request.url}`);

            const url = parse(request.url);

            const agent = new Socks5Agent({
                "proxy": proxy,
                "target": { "host": url.host, "port": url.port }
            });
  
            const options = {
                "hostname": url.hostname,
                "port": url.port ? url.port : 80,
                "path": url.path,
                "method": url.method ? url.method : "get",
                "headers": url.headers,
                "agent": agent
            };

            const socks5Request = http.request(options);
            socks5Request.on("response", (socks5Response) => {
                response.writeHead(socks5Response.statusCode, socks5Response.headers);
                socks5Response.pipe(response);
            }).on("error", (error) => {
                response.writeHead(500);
                response.end("Connection error\r\n\r\n");
                @error(error);
            });

            request.pipe(socks5Request);

        });

    }

    return httpServer;

};

const activateHTTPProxy = function (options) {

    serveHTTPProxyForLAN = options.serveHTTPProxyForLAN;

    localHTTPProxyPort = options.localHTTPProxyPort;

    const localListeningHost = serveHTTPProxyForLAN ? "::" : "127.0.0.1";

    return @.async(function () {

        deactivateHTTPProxyServerIfRunning().pipe(this);

    }).then(function () {

        let httpServer = prepareHTTPProxyServer();

        httpServer.listen(localHTTPProxyPort, localListeningHost);

        @info(`HTTP proxy server[${localListeningHost}:${localHTTPProxyPort}] started`);

        @mew.auto("proxy.http.started", {
            "host": localListeningHost,
            "port": localHTTPProxyPort
        });

        httpServerRunning = true;

        this.next();

    });

};

const deactivateHTTPProxyServerIfRunning = function () {

    return @.async(function () {

        if (httpServerRunning) {
            httpServerRunning = false;
            httpServer.close((error) => {
                if (error) {
                    this.reject(error); return;
                }
                @info(`HTTP proxy server stopped`);
                @mew.auto("proxy.http.stopped");
                this.next();
            });
            return;
        }

        this.next();

    });

};

module.exports.updateSocks5Proxy = updateSocks5Proxy;

module.exports.activateHTTPProxy = activateHTTPProxy;
module.exports.deactivateHTTPProxyServerIfRunning = deactivateHTTPProxyServerIfRunning;