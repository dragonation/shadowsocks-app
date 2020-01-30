const net = require("net");

const {
    convertIPv4ToLong, 
    convertLongToIPv4, 
    convertIPToBuffer 
} = require("./ip.js");

const { SmartBuffer } = require("./smart-buffer.js");

const COMMAND = {
    "CONNECT": 0x01,
    "BIND": 0x02,
    "ASSOCIATE": 0x03
};

const SOCKS5_AUTH = {
    "NO_AUTH": 0x00,
    // "GSS_API": 0x01,
    "USER_PASS": 0x02
};

const SOCKS5_RESPONSE = {
    "GRANTED": 0x00,
    // "FAILURE": 0x01,
    // "NOT_ALLOWED": 0x02,
    // "NETWORK_UNREACHABLE": 0x03,
    // "HOST_UNREACHABLE": 0x04,
    // "CONNECTION_REFUSED": 0x05,
    // "TTL_EXPIRED": 0x06,
    // "COMMAND_NOT_SUPPORTED": 0x07,
    // "ADDRESS_NOT_SUPPORTED": 0x08
};

const parseCommandFromString = function (string) {

    if (string === "connect") {
        return COMMAND.CONNECT;
    } else if (string === 'associate') {
        return COMMAND.ASSOCIATE;
    } else if (string === 'bind') {
        return COMMAND.BIND;
    }

    return COMMAND.CONNECT;

};

const createSocks5Connection = function (options, callback) {

    options = Object.assign({}, options, {
        "proxy": Object.assign({}, options.proxy)
    });

    const socket = new net.Socket();
    let buffer = new SmartBuffer();

    if (!options.timeout) {
        options.timeout = 10000;
    }
    options.proxy.command = parseCommandFromString(options.proxy.command);

    if (!options.proxy.authentication) {
        options.proxy.authentication = {};
    } else {
        options.proxy.authentication = Object.assign({}, options.proxy.authentication);
    }
    if (!options.proxy.authentication.username) {
        options.proxy.authentication.username = "";
    }
    if (!options.proxy.authentication.password) {
        options.proxy.authentication.password = "";
    }

    let finished = false;
    const finish = function (error, socket, info, callback) {

        socket.setTimeout(0, onTimeout);

        if (finished) { return; }
        finished = true;

        if (buffer instanceof SmartBuffer) {
            buffer.destroy();
        }

        if (error && (socket instanceof net.Socket)) {
            socket.removeAllListeners("close");
            socket.removeAllListeners("timeout");
            socket.removeAllListeners("data");
            socket.destroy();
            socket = null;
        }

        callback(error, socket, info);

    };

    let onTimeout = function () {
        finish(new Error("Connection timed out"), socket, null, callback);
    };

    socket.setTimeout(options.timeout, onTimeout);

    socket.once("close", function () {
        finish(new Error("Socket closed"), socket, null, callback);
    });

    socket.once("error", function (error) {});

    socket.once("connect", function () {
        negotiateSocks5(options, socket, callback);
    });

    socket.connect(options.proxy.port, options.proxy.host);

    function negotiateSocks5(options, socket, callback) {

        buffer.writeUInt8(0x05);
        buffer.writeUInt8(2);
        buffer.writeUInt8(SOCKS5_AUTH.NO_AUTH);
        buffer.writeUInt8(SOCKS5_AUTH.USER_PASS);

        socket.once("data", function (data) {
            if (data.length !== 2) {
                finish(new Error("Negotiation error"), socket, null, callback);
            } else if (data[0] !== 0x05) {
                finish(new Error("Negotiation error (invalid version)"), socket, null, callback);
            } else if (data[1] === 0xFF) {
                finish(new Error("Negotiation error (unacceptable authentication)"), socket, null, callback);
            } else {
                if (data[1] === SOCKS5_AUTH.NO_AUTH) {
                    sendRequest();
                } else if (data[1] === SOCKS5_AUTH.USER_PASS) {
                    sendAuthentication(options.proxy.authentication);
                } else {
                    finish(new Error("Negotiation Error (unknown authentication type)"), socket, null, callback);
                }
            }
        });

        socket.write(buffer.toBuffer());

        const sendAuthentication = function (info) {

            buffer.clear();
            buffer.writeUInt8(0x01);
            buffer.writeUInt8(Buffer.byteLength(info.username));
            buffer.writeString(authinfo.username);
            buffer.writeUInt8(Buffer.byteLength(info.password));
            buffer.writeString(authinfo.password);

            socket.once("data", function (data) {
                if ((data.length === 2) && (data[1] === 0x00)) {
                    sendRequest();
                } else {
                    finish(new Error("Negotiation error (authentication failed)"), socket, null, callback);
                }
            });

            socket.write(buffer.toBuffer());
            
        };

        const sendRequest = function () {

            buffer.clear();
            buffer.writeUInt8(0x05);
            buffer.writeUInt8(options.proxy.command);
            buffer.writeUInt8(0x00);

            if (net.isIPv4(options.target.host)) {
                buffer.writeUInt8(0x01);
                buffer.writeBuffer(convertIPToBuffer(options.target.host));
            } else if (net.isIPv6(options.target.host)) {
                buffer.writeUInt8(0x04);
                buffer.writeBuffer(convertIPToBuffer(options.target.host));
            } else {
                buffer.writeUInt8(0x03);
                buffer.writeUInt8(options.target.host.length);
                buffer.writeString(options.target.host);
            }
            buffer.writeUInt16BE(options.target.port);

            socket.once("data", function (data) {

                socket.pause();

                if (data.length < 4) {
                    finish(new Error("Negotiation error"), socket, null, callback); return;
                } 

                if ((data[0] !== 0x05) || (data[1] !== SOCKS5_RESPONSE.GRANTED)) {
                    finish(new Error("Negotiation error (" + data[1] + ")"), socket, null, callback); return;
                }

                if (options.proxy.command === COMMAND.CONNECT) {
                    finish(null, socket, null, callback); return;
                } 

                if ((options.proxy.command !== COMMAND.BIND) &&
                    (options.proxy.command !== COMMAND.ASSOCIATE)) {
                    finish(new Error("Unknown command"), socket, null, callback); return;
                }

                buffer.clear();
                buffer.writeBuffer(data);
                buffer.skip(3);

                let info = {};
                let addressType = buffer.readUInt8();

                try {
                    switch (addressType) {
                        case 0x01: {
                            info.host = buffer.readUInt32BE();
                            if (info.host === 0) {
                                info.host = options.proxy.host;
                            } else {
                                info.host = convertLongToIPv4(info.host);
                            }
                            break;
                        }
                        case 0x03: {
                            info.host = buffer.readString(buffer.readUInt8());
                            break;
                        }
                        case 0x04: {
                            info.host = buffer.readBuffer(16);
                            break;
                        }
                        default: {
                            finish(new Error("Negotiation error (invalid host address)"), socket, null, callback);
                            return;
                        }
                    }
                    info.port = buffer.readUInt16BE();
                    finish(null, socket, info, callback);
                } catch (error) {
                    finish(new Error("Negotiation error (missing data)"), socket, null, callback);
                }

            });

            socket.write(buffer.toBuffer());

        };

    }

};

module.exports.createSocks5Connection = createSocks5Connection;