const fs = require("fs");
const http = require("http");
const path = require("path");
const net = require("net");
const os = require("os");
const stream = require("stream");
const url = require("url");
const zlib = require("zlib");

const { spawn, spawnSync } = require("child_process");
const { app, protocol } = require("electron");

const dialog = require("./dialog.js");
const logger = require("./logger.js");

const { createUUID } = require("./uuid.js");
const { initializeRPCHandlers } = require("./rpc.js");

const handlers = Object.create(null);

let programJSON = undefined;

const sendingTargets = [];

const startedContents = [];

let guiHosts = Object.create(null);

protocol.registerStreamProtocol("garden", function (request, callback) {

    let aborted = false;

    let parsed = url.parse(request.url);

    if (!guiHosts[parsed.host]) {
        let readable = new stream.Readable();
        readable.push(Buffer.from("Not Found", "utf8"));
        readable.push(null);
        callback({
            "statusCode": 404,
            "headers": {
                "Content-Type": "text/plain"
            },
            "data": readable
        });
        return;
    }

    // TODO: support http, https hosts
    let httpRequest = http.request({
        "socketPath": guiHosts[parsed.host],
        "path": parsed.path,
        "host": parsed.host,
        "method": request.method,
        "headers": request.headers,
        "rejectUnauthorized": false
    });

    // TODO: make it configurable
    let timeout = 5000;
    if (httpRequest.path.split("?")[0] === "/channel") {
        timeout = 10 * 60 * 1000;
    } else if (httpRequest.path.split("?")[0] === "/ssr/locate-python") {
        timeout = 10 * 60 * 1000;
    } else if (httpRequest.path.split("?")[0] === "/ssr/test") {
        timeout = 10 * 60 * 1000;
    }

    let timeoutHandle = setTimeout(() => {

        httpRequest.abort();

        var error = new Error("Request timeout");
        error.causedByTimeout = true;
        httpRequest.emit("error", error);

    }, timeout);

    httpRequest.on("error", (error) => {

        if (aborted) { return; }
        aborted = true;

        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = undefined;
        }

        if (error instanceof Number) {
            error = new Error(`Error[${error}]`);
        } else if (!(error instanceof Error)) {
            error = new Error(error);
        }

        logger.error(error);

        let readable = new stream.Readable();
        readable.push(Buffer.from(error.message, "utf8"));
        readable.push(null);

        callback({
            "statusCode": 408,
            "headers": {
                "Content-Type": "text/plain"
            },
            "data": readable
        });

    });

    httpRequest.on("response", function (response) {

        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = undefined;
        }

        var chunks = [];

        response.on("end", function () {
            let buffer = Buffer.concat(chunks);
            if (response.headers["content-encoding"] === "gzip") {
                buffer = zlib.gunzipSync(buffer);
            }
            let readable = new stream.Readable();
            readable.push(buffer);
            readable.push(null);
            callback({
                "statusCode": response.statusCode,
                "headers": response.headers,
                "data": readable
            });
        });

        response.on("data", function (chunk) {
            chunks.push(chunk);
        });

    });

    if (request.uploadData) {
        for (let data of request.uploadData) {
            httpRequest.write(data.bytes);
        }
    }
    httpRequest.end();

});

const resolveProgramPath = function () {

    let program = process.argv.slice(2).filter((argument) => argument[0] !== "-")[0];
    if (!program) {
        program = path.join(__dirname, "default");
    }

    return program;

};

const resolveProgramJSON = function () {

    if (!programJSON) {

        let program = resolveProgramPath();

        const gardenJSONPath = path.resolve(program, "conf", "garden.json");

        programJSON = Object.assign({
            "path": program
        }, require(gardenJSONPath));

    }

    return programJSON;

};

const resolveProgramID = function () {

    const json = resolveProgramJSON();

    if (!json.id) {
        return path.basename(json.path);
    }

    return json.id;

};

const resolveProgramName = function () {

    const json = resolveProgramJSON();

    if (!json.name) {
        return resolveProgramID();
    }

    return json.name;

};

const startupProgram = async function () {

    const json = resolveProgramJSON();

    let env = Object.assign({}, process.env);
    if (typeof json.env === "object") {
        env = Object.assign(env, json.env);
    }

    let socketPath = path.join(os.tmpdir(), `garden-xui-${createUUID()}.sock`);

    initializeRPCHandlers(installProgramHandler);

    net.createServer(function (socket) { 

        sendingTargets.push({
            "socket": socket,
            "sending": false,
            "queue": []
        });

        let buffers = [];
        socket.on("data", function (data) { 

            buffers.push(data);

            let parse = () => {

                if (buffers.length === 0) {
                    return;
                }

                if (buffers[0].length < 4) {
                    if (buffers.length === 1) {
                        return;
                    }
                    let newBuffer = Buffer.concat([buffers[0], buffers[1]]);
                    buffers.splice(0, 2, newBuffer);
                    parse();
                    return;
                }

                let size = buffers[0].readUInt32LE(0);
                let bufferSize = 0;
                let looper = 0;
                while ((bufferSize < size + 4) && (looper < buffers.length)) {
                    bufferSize += buffers[looper].length;
                    ++looper;
                }
                if (bufferSize < size + 4) {
                    return;
                }

                let buffer = Buffer.concat(buffers.slice(0, looper));
                buffers.splice(0, looper);
                if (size + 4 < bufferSize) {
                    buffers.unshift(buffer.slice(size + 4));
                }

                let json = undefined;
                try {
                    json = JSON.parse(buffer.slice(4, size + 4).toString("utf8"));
                } catch (error) {
                    dialog.showErrorDialog(error);
                }

                if (json) {            
                    try {
                        handleProgramEvent(json);
                    } catch (error) {
                        dialog.showErrorDialog(error);
                    }
                }

                if (buffers.length > 0) {
                    parse();
                }

            }

            parse();

        });

        socket.on("error", function (error) {
            dialog.showErrorDialog(error);
        });

    }).listen(socketPath);

    let switches = [path.join(app.getAppPath(), "bin/garden")];
    if (process.argv.indexOf("--debug") !== -1) {
        switches.push("--debug");
    }
    switches.push(`--server=${socketPath}`);

    let mewJS = path.resolve(app.getAppPath(), "../mewjs/bin/mew_js");
    let childProcess = spawn(mewJS, switches, {
        "cwd": json.path,
        "env": env,
        "stdio": [0, 1, 2]
    });

    childProcess.on("error", (error) => {
        dialog.showErrorDialog(error).on("closed", () => {
            app.exit(1);
        });
    });

    let exited = false;

    childProcess.on("exit", (code, signal) => {

        exited = true;

        if (code) {
            dialog.showErrorDialog(new Error(`Program exited abnormal, code[${code}]`)).on("closed", () => {
                app.exit(code);
            });
            return;
        } 

        if (signal) {
            dialog.showErrorDialog(new Error(`Program exited abnormal, signal[${signal}]`)).on("closed", () => {
                app.exit(1);
            });
            return;
        } 

        app.exit();

    });

    app.on("quit", (event, code) => {
        if (!exited) {
            try {
                childProcess.kill("SIGTERM");
            } catch (error) {
                logger.error(error);
            }
        }
    });

};

const handleProgramEvent = function (event) {

    let usage = event.usage;
    if (!usage) {
        logger.error("Invalid message missing usage");
        return;
    }

    if (handlers[usage]) {
        handlers[usage](event.content, event.callback);
    } else {
        logger.error(`Unhandled message with usage[${event.usage}]`);
    }

};

const sendProgramData = function (data, id) {

    let targets = sendingTargets;
    if (id) {
        targets = targets.filter((item) => item.id === id);
    }

    targets.forEach((target) => {
        target.queue.push(data);
        let trySendData = () => {
            if (target.sending) { return; }
            if (target.queue.length === 0) { return; }
            target.sending = true;
            let buffer = target.queue.shift();
            target.socket.write(buffer, (error) => {
                if (error) {
                    // TODO: close connection
                    logger.error(error); 
                    return; 
                }
                target.sending = false;
                trySendData();
            });
        };
        trySendData();
    });

};

const sendProgramEvent = function (usage, content, id) {

    let targets = sendingTargets;
    if (id) {
        targets = targets.filter((item) => item.id === id);
    }
    if (targets.length === 0) {
        logger.warn(`Target missing for event[${usage}]`);
    }

    let eventBuffer = Buffer.from(JSON.stringify({
        "usage": usage,
        "content": content
    }), "utf8");
    let sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32LE(eventBuffer.length, 0);

    sendProgramData(sizeBuffer, id);
    sendProgramData(eventBuffer, id);
       
};

const installProgramHandler = function (usage, handler) {

    handlers[usage] = handler;

};

const getProgramCommandLine = function () {

    return snapshotProcessList(process.pid)[process.pid].command;

};

const executeCommand = function (command, switches, cwd, env) {

    var spawned = spawnSync(command, switches, {
        "cwd": cwd ? cwd : process.cwd(),
        "env": Object.assign({}, process.env, env ? env : {}),
        "windowsHide": true
    });

    return [spawned.stdout, spawned.stderr];

};

const snapshotProcessList = function (pid) {

    if (process.platform === "win32") {

        let switches = ["process"];
        if (pid) {
            switches.push("where", "ProcessId=" + pid);
        }
        switches.push("get", "ProcessId,CommandLine");

        let stdout = executeCommand("wmic", switches)[0];

        const lines = stdout.toString("utf8").split("\n");

        let headers = lines[0].split(/\s[^\s]/);

        let processes = Object.create(null);

        lines.slice(1).forEach((line) => {
            let command = line.slice(0, headers[0].length).trim();
            let pid = parseInt(line.slice(headers[0].length).trim());
            if (isFinite(pid)) {
                processes[pid] = {
                    "command": command,
                    "pid": pid
                };
            }
        });

        return processes;

    } else {

        let stdout = executeCommand("ps", ["ax"])[0];

        const lines = stdout.toString("utf8").split("\n");

        let pidIndex = lines[0].indexOf("PID") + 3;
        let commandIndex = lines[0].indexOf("COMMAND");
        if (commandIndex === -1) {
            commandIndex = lines[0].indexOf("CMD");
        }
        if ((pidIndex === -1) || (commandIndex === -1)) {
            throw new Error("Unknown PS output");
        }

        let processes = Object.create(null);

        lines.slice(1).forEach((line) => {
            let pid2 = parseInt(line.slice(0, pidIndex).trim());
            let command = line.slice(commandIndex).trim();
            if (isFinite(pid2) && ((!pid) || (pid === pid2))) {
                processes[pid2] = {
                    "pid": pid,
                    "command": command
                };
            }
        });

        return processes;

    }

};

const sendProgramStartedEvent = function (commandLine, workingDirectory) {

    let content = {
        "commandLine": commandLine,
        "workingDirectory": workingDirectory
    };

    if (sendingTargets.length === 0) {
        startedContents.push(content)
        return;
    }

    sendProgramEvent("garden.started", content);

};

const callbackProgramResult = function (id, error, result) {

    if (typeof error === "number") {
        error = {
            "code": error,
            "message": `Error[${error}]`
        };
    } else if (typeof error === "string") {
        error = {
            "message": error
        };
    } else if (error) {
        error = {
            "code": error.code,
            "message": error.message
        };
    } else {
        error = undefined;
    }

    if (typeof id === "function") {
        id(error, result);
        return;
    } 

    let eventBuffer = Buffer.from(JSON.stringify({
        "callback": id,
        "error": error,
        "result": result
    }), "utf8");
    let sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32LE(eventBuffer.length, 0);

    sendProgramData(sizeBuffer);
    sendProgramData(eventBuffer);

};

installProgramHandler("garden.ready", (event) => {

    let contents = startedContents.slice(0);
    startedContents.length = 0;

    for (let content of contents) {
        sendProgramEvent("garden.started", content);
    }

});

installProgramHandler("garden.gui", (event, callback) => {

    let binding = event.binding;
    if (typeof binding === "number") {
        binding = `${event.secure ? "https" : "http"}://localhost:${binding}`;
    }

    if (guiHosts[event.host]) {
        callbackProgramResult(callback, new Error(`Garden host[${event.host}] already registered`));
        return;
    }

    guiHosts[event.host] = binding;

    callbackProgramResult(callback);

});

module.exports.resolveProgramName = resolveProgramName;
module.exports.resolveProgramPath = resolveProgramPath;
module.exports.resolveProgramID = resolveProgramID;
module.exports.startupProgram = startupProgram;
module.exports.sendProgramEvent = sendProgramEvent;
module.exports.installProgramHandler = installProgramHandler;
module.exports.handleProgramEvent = handleProgramEvent;
module.exports.callbackProgramResult = callbackProgramResult;

module.exports.getProgramCommandLine = getProgramCommandLine;

module.exports.sendProgramStartedEvent = sendProgramStartedEvent;