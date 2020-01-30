const tls = require("tls");

const { inherits } = require("util");
const { EventEmitter } = require("events");

const { createSocks5Connection } = require("./connection.js");

const Socks5Agent = function Socks5Agent(options, secure, rejectUnauthorized) {

    this.options = options;
    this.secure = secure || false;
    this.rejectUnauthorized = rejectUnauthorized;

    if (this.rejectUnauthorized === undefined) {
        this.rejectUnauthorized = true;
    }

};

inherits(Socks5Agent, EventEmitter);

Socks5Agent.prototype.createConnection = function(request, options, handler) {

    if (!this.options.target) {
        this.options.target = {};
    }

    if (!this.options.target.host) {
        this.options.target.host = options.host;
    }

    if (!this.options.target.port) {
        this.options.target.port = options.port;
    }

    if (this.secure) {
        let originHandler = handler;
        handler = (error, socket, info) => {

            if (error) {
                return handler(error);
            }

            this.encryptedSocket = socket;

            tls.connect({
                "socket": socket,
                "servername": this.options.target.host,
                "rejectUnauthorized": this.rejectUnauthorized
            }, function (error) {

                if (error) {
                    return originHandler(error);
                }

                return originHandler(error, this);

            }).on("error", originHandler);

            socket.resume();

        };
    }

    createSocks5Connection(this.options, handler);

};

Socks5Agent.prototype.addRequest = function (request, host, port, localAddress) {

    let options = undefined;
    if (typeof host === "object") {
        options = Object.assign({}, host);
        if (options.host && options.path) {
            // delete path to ensure no unix socket
            delete options.path;
        }
    } else {
        options = { "host": host, "port": port };
        if (null !== localAddress) {
            options.localAddress = localAddress;
        }
    }

    let syncing = true;

    this.createConnection(request, options, function (error, socket) {

        if (error) {
            if (syncing) {
                @.delay(() => {
                    request.emit("error", error);
                });
            } else {
                request.emit("error", error);
            }
            return;
        }

        request.onSocket(socket);
        socket.resume();

    });

    syncing = false;

};

exports.Socks5Agent = Socks5Agent;
