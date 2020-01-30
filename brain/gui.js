
const gardenConfigs = require(@path(@mewchan().workingPath, "conf/garden.json"));

@servlet.get("/uris/list", function (request, response) {

    this.break();

    return @.async(function () {

        @mew.rpc("ssr.uri.list").pipe(this);

    }).then(function (list) {

        response.headers["Content-Type"] = "application/json";

        response.writer.end(JSON.stringify(list), this.test);

    });

});

@servlet.get("/uris/url", function (request, response) {

    this.break();

    return @mew.rpc("ssr.uri.url", {
        "type": request.form.type,
        "name": request.form.name,
        "group": request.form.group,
        "server": request.form.server,
        "port": request.form.port,
        "password": request.form.password,
        "method": request.form.method,
        "protocol": request.form.protocol,
        "protocolParameters": request.form.protocolParameters,
        "obfuscation": request.form.obfuscation,
        "obfuscationParameters": request.form.obfuscationParameters
    }).then(function (url) {

        response.headers["Content-Type"] = "text/plain";

        response.writer.end(url, this.test);

    });

});

@servlet.get("/uris/qrcode", function (request, response) {

    this.break();

    return @mew.rpc("qrcode.svg", { 
        "text": request.form.url, 
        "asURL": true, 
        "size": 10, 
        "margin": 1, 
        "ecLevel": "L" 
    }).then(function (result) {

        response.headers["Content-Type"] = "image/svg+xml";

        response.writer.end(result, this.test);

    });

});

@servlet.get("/uris/update", function (request, response) {
    
    this.break();

    return @mew.rpc("ssr.subscription.update").then(function (result) {

        response.headers["Content-Type"] = "application/json";

        response.writer.end(JSON.stringify(result), this.test);

    });

});

@servlet.get("/uris/delete", function (request, response) {

    this.break();

    return @mew.rpc("ssr.uri.delete", request.form).then(function () {

        response.headers["Content-Type"] = "text/plain";

        response.writer.end("OK", this.test);

    });

});

@servlet.get("/uris/modify", function (request, response) {

    this.break();

    let newConfig = JSON.parse(request.form["new"]);
    let oldConfig = JSON.parse(request.form["old"]);

    return @mew.rpc("ssr.uri.modify", {
        "new": newConfig,
        "old": oldConfig
    }).then(function () {

        response.headers["Content-Type"] = "text/plain";

        response.writer.end("OK", this.test);

    });

});

@servlet.get("/uris/subscribe", function (request, response) {

    this.break();

    return @mew.rpc("ssr.subscription.add", request.form.url).then(function () {

        response.headers["Content-Type"] = "text/plain";

        response.writer.end("OK", this.test);

    });

});

@servlet.get("/uris/analyze", function (request, response) {

    this.break();

    return @mew.rpc("ssr.subscription.analyze", request.form.url).then(function (result) {

        response.headers["Content-Type"] = "application/json";

        response.writer.end(JSON.stringify(result), this.test);

    });

});

@servlet.get("/uris/unsubscribe", function (request, response) {

    this.break();

    return @mew.rpc("ssr.subscription.remove", {
        "url": request.form.url,
        "configs": request.form.configs === undefined ? true : request.form.configs
    }).then(function () {

        response.headers["Content-Type"] = "text/plain";

        response.writer.end("OK", this.test);

    });

});

@servlet.get("/uris/import-subscription", function (request, response) {

    this.break();

    return @.async(function () {

        let parent = request.form.parent;

        @mew.rpc("ssr.window.show", {
            "id": "import", 
            "parent": parent, 
            "modal": parent ? true : false
        }).rejected((error) => {
            @error(error);
        });

        response.headers["Content-Type"] = "text/plain";

        response.writer.end("OK", this.test);

    });

});

@servlet.get("/uris/import-from-clipboard", function (request, response) {

    this.break();

    return @mew.rpc("garden.clipboard.get").then(function (result) {

        let text = result["text/plain"];
        if (!text) {
            throw new Error("No content found in clipboard");
        }

        text = Buffer.from(text, "base64").toString("utf8");

        if (text.trim()[0] === "{") {
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

        response.headers["Content-Type"] = "application/json";

        response.writer.end(JSON.stringify(result), this.test);

        @mew.auto("ssr.uri.imported");

    });

});

@servlet.get("/preferences/all", function (request, response) {

    this.break();

    return @mew.rpc("ssr.preferences.load").then(function (preferences) {

        response.headers["Content-Type"] = "application/json";

        response.writer.end(JSON.stringify(preferences), this.test);

    });

});

@servlet.get("/preferences/update", function (request, response) {

    this.break();

    let dirties = JSON.parse(request.form.changes);

    return @mew.rpc("ssr.preferences.save", dirties).then(function () {

        response.headers["Content-Type"] = "text/plain";

        response.writer.end("OK", this.test);

    });

});

@servlet.get("/ssr/running", function (request, response) {

    this.break();

    return @mew.rpc("ssr.running").then(function (info) {

        response.headers["Content-Type"] = "application/json";

        let json = info ? JSON.stringify(info) : "null";

        response.writer.end(json, this.test);

    });

});

@servlet.get("/ssr/test", function (request, response) {

    this.break();

    return @mew.rpc("ssr.test", request.form, {
        "timeout": 10 * 60 * 1000
    }).then(function (result) {

        response.headers["Content-Type"] = "application/json";

        response.send(result).pipe(this);

    });

});

@servlet.get("/ssr/connect", function (request, response) {

    this.break();

    return @mew.rpc("ssr.connect", request.form).then(function (result) {

        response.headers["Content-Type"] = "application/json";

        response.send(result).pipe(this);

    });

});

@servlet.get("/ssr/disconnect", function (request, response) {

    this.break();

    return @mew.rpc("ssr.disconnect").then(function () {

        response.headers["Content-Type"] = "text/plain";

        response.writer.end("OK", this.test);

    });

});

@servlet.get("/ssr/save-qr-code", function (request, response) {

    this.break();
    
    response.setTimeout(30 * 60 * 1000);

    return @mew.rpc("ssr.uri.url", {
        "type": request.form.type,
        "name": request.form.name,
        "group": request.form.group,
        "server": request.form.server,
        "port": request.form.port,
        "password": request.form.password,
        "method": request.form.method,
        "protocol": request.form.protocol,
        "protocolParameters": request.form.protocolParameters,
        "obfuscation": request.form.obfuscation,
        "obfuscationParameters": request.form.obfuscationParameters
    }).then(function (url) {

        @mew.rpc("qrcode.svg", { 
            "text": url, 
            "asURL": true, 
            "size": 10, 
            "margin": 1, 
            "ecLevel": "L" 
        }).pipe(this);

    }).then(function (result) {

        @mew.rpc("garden.dialog.save", {
            "window": request.form.window,
            "title": "Save the QRCode image",
            "filters": [
                { "name": "SVG image", "extensions": [".svg"] }
            ]
        }, {
            "timeout": 30 * 60 * 1000
        }).then(function (path) {

            if (!path) {
                return; // user canceled
            }

            if (!@.fs.extname(path)) {
                path = path + ".svg";
            }

            @.fs.writeFile.sync(path, result);

        }).rejected((error) => {
            @error(error);
        });

        response.headers["Content-Type"] = "text/plain";

        response.writer.end("OK", this.test);

    });

});

@servlet.get("/pac/update", function (request, response) {

    this.break();

    return @mew.rpc("gfwlist.update").then(function () {

        response.headers["Content-Type"] = "text/plain";

        response.writer.end("OK", this.test);

    });

});

@servlet.get("/ssr/locate-python", function (request, response) {

    this.break();

    response.setTimeout(30 * 60 * 1000);

    return @mew.rpc("garden.dialog.open", {
        "window": request.form.window,
        "defaultPath": request.form.location,
        "title": "Locate python executable"
    }, {
        "timeout": 30 * 60 * 1000
    }).then(function (paths) {

        response.headers["Content-Type"] = "application/json";

        response.writer.end(JSON.stringify({
            "path": paths ? paths[0] : undefined
        }), this.test);

    });

});