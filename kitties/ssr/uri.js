const ShadowsocksURI = function (config) {

    for (let key in config) {
        if (!@.is.nil(config[key])) {
            this[key] = config[key];
        }
    }

};

ShadowsocksURI.prototype.server = "127.0.0.1";
ShadowsocksURI.prototype.port = 8388;
ShadowsocksURI.prototype.password = "0";
ShadowsocksURI.prototype.method = "aes-256-cfb";

ShadowsocksURI.prototype.protocol = "origin";
ShadowsocksURI.prototype.protocolParameters = "";

ShadowsocksURI.prototype.obfuscation = "plain";
ShadowsocksURI.prototype.obfuscationParameters = "";

ShadowsocksURI.prototype.group = "";
ShadowsocksURI.prototype.name = "";

ShadowsocksURI.prototype.toString = function () {

    switch (this.type) {

        case "ss": {

            let uri = "ss://";

            uri += Buffer.from(`${this.method}:${this.password}@${this.server}:${this.port}`, "utf8").toString("base64");

            if (this.name) {
                uri += "#" + this.name;
            }

            return uri;
        }

        case "ssr": {

            let uri = "ssr://";

            let config = [
                this.server, this.port, 
                this.protocol, this.method, this.obfuscation,
                Buffer.from(this.password, "utf8").toString("base64")
            ].join(":");

            let query = [
                ["group", "group"], ["name", "remarks"],
                ["protocolParameters", "protocolparam"], 
                ["obfuscationParameters", "obfsparam"]
            ].filter(([from]) => {
                return this[from];
            }).map(([from, to]) => {
                return encodeURIComponent(to) + "=" + encodeURIComponent(Buffer.from(this[from], "utf8").toString("base64"));
            }).join("&");

            if (query) {
                config += "/?" + query;
            }

            uri += Buffer.from(config, "utf8").toString("base64");

            return uri;
        }
        
        default: { throw new Error("Invalid shadowsocks URI"); }

    }

};

const parseURIs = function (uris) {

    const parseds = [];
    const fakes = [];
    for (let uri of uris) {
        let scheme = uri.split("://")[0];
        let parsed = undefined;
        switch (scheme) {
            case "ssr": {
                try {
                    parsed = parseSSRURI(uri);
                } catch (error) {}
                break;
            }
            case "ss": {
                try {
                    parsed = parseSSURI(uri);
                } catch (error) {}
                break;
            }
            default: { break;}
        }
        if (parsed) {
            parseds.push(parsed);
        } else {
            fakes.push(uri);
        }
    }

    return {
        "parseds": parseds,
        "fakes": fakes 
    };

}

const parseSSURI = function (uri) {

    let splitted = uri.split("://");
    if (splitted[0] !== "ss") {
        throw new Error("Scheme not correct");
    }

    splitted = splitted.slice(1).join("://").split("#");
    const decoded = Buffer.from(splitted[0], "base64").toString("utf8");
    const components = decoded.split("@").map((item) => item.split(":"));
    if ((components.length !== 2) || 
        (components[0].length !== 2) || 
        (components[1].length !== 2)) {
        throw new Error("Invalid SS URI");
    }

    return new ShadowsocksURI({
        "type": "ss",
        "server": components[1][0],
        "port": components[1][1],
        "method": components[0][0],
        "password": components[0][1],
        "remarks": splitted.slice(1).join("#")
    });

};

const parseSSRURI = function (uri) {

    let splitted = uri.split("://");
    if (splitted[0] !== "ssr") {
        throw new Error("Scheme not correct");
    }

    let decoded = Buffer.from(splitted.slice(1).join("://"), "base64").toString("utf8");

    let components = decoded.split("/?")[0].split(":");
    if (components.length !== 6) {
        throw new Error("Invalid SSR URI");
    }
    if (!isFinite(parseInt(components[1]))) {
        throw new Error("Invalid SSR URI");
    }

    let query = {};
    for (let pair of decoded.split("/?").slice(1).join(":/").split("&")) {
        let splitted = pair.split("=");
        let key = decodeURIComponent(splitted[0]);
        let value = decodeURIComponent(splitted.slice(1).join("="));
        query[key] = Buffer.from(value, "base64").toString("utf8");
    }

    return new ShadowsocksURI({
        "type": "ssr",
        "group": query.group,
        "name": query.remarks,
        "server": components[0],
        "port": parseInt(components[1]),
        "method": components[3],
        "password": Buffer.from(components[5], "base64").toString("utf8"),
        "protocol": components[2],
        "protocolParameters": query.protoparam,
        "obfuscation": components[4],
        "obfuscationParameters": query.obfsparam,
    });

};

module.exports.parseSSRURI = parseSSRURI;
module.exports.parseSSURI = parseSSURI;

module.exports.parseURIs = parseURIs;

module.exports.ShadowsocksURI = ShadowsocksURI;
