const http = require("http");
const tls = require("tls");

const { spawn, execSync } = require("child_process");

const { loadPreferences } = require("./preferences.js");

const configPath = @.fs.homePath(".shadowsocks");
@.fs.makeDirs(configPath);

const shadowsocksRPythonPath = @path(@mewchan().entryPath, "data/shadowsocks");


const initializeShadowsocksR = function () {

    return @.async(function () {

        let isPythonInstalled = false;
        try {
            isPythonInstalled = /^hello$/.test(execSync("python -c \"print('hello')\"").toString().trim());
        } catch (error) {}

        if (!isPythonInstalled) {
            throw new Error("Python not installed");
        }

        stopShadowsocksRIfRuning().pipe(this);

    });

};

const stopShadowsocksRIfRuning = function () {

    let info = getShadowsocksRRunningInfo();
    if (!info) {
        return @.async.resolve();
    }

    let { pid, config } = info;

    let from = Date.now();

    return @.async(function () {

        if (!@.task.info(pid)[pid]) {
            this.next(); return;
        }

        try {
            process.kill(pid, "SIGKILL");
        } catch (error) {
            @error(error);
        }

        if (@.task.info(pid)[pid] && (Date.now() - from < 500)) {
            @.delay(50, this.retry);
            return;
        }

        if (@.task.info(pid)[pid]) {
            throw new Error(`Failed to kill process[${pid}]`);
        }

        this.next();

    }).then(function () {

        @mew.rpc("ssr.preferences.save", {
            "lastConnectionConnected": false
        }).rejected((error) => {
            @error(error);
        });

        @mew.auto("ssr.disconnected", {
            "config": config,
        });
        
        this.next();
        
    });

};

const getShadowsocksRRunningPID = function () {

    try {

        let lastPIDPath = @path(configPath, "pid");
        let lastPID = 0;
        if (@.fs.exists(lastPIDPath)) {
            lastPID = parseInt(@.fs.readFile.sync(lastPIDPath, "utf8"));
        }

        let lastPIDInfo = @.task.info(lastPID)[lastPID];

        if (lastPID && lastPIDInfo) {

            let lastPIDCommandLinePath = @path(configPath, "pid-cmdline");
            let lastPIDCommandLine = null;
            if (@.fs.exists.file(lastPIDCommandLinePath)) {
                lastPIDCommandLine = @.fs.readFile.sync(lastPIDCommandLinePath, "utf8");
            }

            if (lastPIDInfo.command === lastPIDCommandLine) {
                return lastPID;
            }

        }

    } catch (error) {
        @error("Failed to find out last shadowsocksr process info");
        @error(error);
    }

    return 0;

};

const getShadowsocksRRunningInfo = function () {

    let pid = getShadowsocksRRunningPID();
    if (pid) {
        let lastPIDConfigPath = @path(configPath, "pid-config");
        return {
            "pid": pid,
            "config": JSON.parse(@.fs.readFile.sync(lastPIDConfigPath))
        };
    }

    return null;

};

const startShadowsocksR = function ({
    serveSocks5ProxyForLAN,
    localSocks5ProxyPort,
    remoteConfig,
    pythonLocation,
    testing
}) {

    let localListeningHost = serveSocks5ProxyForLAN ? "::" : "127.0.0.1";
    if (!localSocks5ProxyPort) { localSocks5ProxyPort = 1086; }

    if (!pythonLocation) {
        pythonLocation = @.task.resolve("python");
    }

    return @.async(function () {

        stopShadowsocksRIfRuning().pipe(this);

    }).then(function () {

        @.net.availablePort({ "port": localSocks5ProxyPort }, (error, port) => {

            if (error) {
                this.reject(error); return;
            }

            if (port === localSocks5ProxyPort) {
                this.next();
            } else {
                this.reject(new Error("Port not available"));
            }
            
        });

    }).then(function () {

        let switches = [["python", @path(shadowsocksRPythonPath, "local.py")]];

        switches.push(["-s", remoteConfig.server]);
        switches.push(["-p", remoteConfig.port]);

        switches.push(["-k", remoteConfig.password]);
        switches.push(["-m", remoteConfig.method]);

        switches.push(["-O", remoteConfig.protocol]);
        if (remoteConfig.protocolParameters) {
            switches.push(["-G", remoteConfig.protocolParameters]);
        }

        if (remoteConfig.obfuscation) {
            switches.push(["-o", remoteConfig.obfuscation]);
            if (remoteConfig.obfuscationParameters) {
                switches.push(["-g", remoteConfig.obfuscationParameters]);
            }
        }

        switches.push(["-b", localListeningHost]);
        switches.push(["-l", localSocks5ProxyPort]);

        if (remoteConfig.timeout) {
            switches.push(["-t", remoteConfig.timeout]);
        }

        @info("Start shadowsocks\n  " + switches.map((item) => {
            if ((item[0] === "-k") || 
                (item[0] === "-g") || 
                (item[0] === "-G") ||
                (item[0] === "-s")) {
                return `${item[0]} ${item[1].slice(0, 3)}${item[1].slice(3, -3).replace(/./g, "*")}${item[1].slice(-3)} #masked`
            }
            return item.join(" ");
        }).join(" \\\n    "));

        let realSwitches = [];
        for (let arguments of switches) {
            for (let argument of arguments) {
                realSwitches.push(argument);
            }
        }
        let childProcess = spawn(realSwitches[0], realSwitches.slice(1), {
            "cwd": shadowsocksRPythonPath,
            "env": process.env,
            "stdios": ["ipc", "ipc", "ipc"]
        });

        childProcess.on("exit", (code, signal) => {
            @info(`Command[python] exited with code[${code}], signal[${signal}]`);
            @info(`Socks5 proxy server stopped`);
            @mew.auto("ssr.disconnected", {
                "testing": testing ? true : false,
                "config": remoteConfig
            });
        });

        childProcess.on("error", (error) => {
            @error(error);
        });

        childProcess.stdout.on("data", (data) => {
            // drop data
        });

        let rest = "";
        childProcess.stderr.on("data", (data) => {

            rest += data.toString("utf8");
            let lines = rest.split("\n");
            if (!lines[lines.length - 1]) {
                rest = lines[lines.length - 1];
                lines = lines.slice(0, -1);
            } else {
                rest = ""; 
            }

            for (let line of lines) {
                if (/^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2}) /.test(line)) {
                    let time = line.slice(0, 19).slice(5) + ".000";
                    let level = "[" + line.slice(19, 29).trim().toUpperCase() + "]";
                    if (level === "[WARNING]") {
                        level = "[WARN]";
                    }
                    let content = line.slice(29);
                    let file = content.split(":")[0];
                    let lineNumber = content.split(":")[1].split(" ")[0];
                    let rest = content.split(":").slice(1).join(":").split(" ").slice(1).join(" ");
                    let log = time + ("       " + level).slice(-9) + " " + rest;
                    let fileline = "(" + file + ":" + lineNumber + ")";
                    let logStyle = undefined;
                    switch (level) {
                        case "[DEBUG]": { logStyle = "white"; break; }
                        case "[INFO]": { logStyle = "brightWhite"; break; }
                        case "[WARN]": { logStyle = "yellow"; break; }
                        default:
                        case "[ERROR]": { logStyle = "red"; break; }
                    }
                    if (rest.trim() === `Socks5 proxy server[${localListeningHost}:${localSocks5ProxyPort}] started`) {
                        @.delay(2000, () => {
                            testShadowsocksR(testing);
                        });
                    }
                    process.stderr.write(@.term.text(log, [logStyle]) + " " + 
                                         @.term.text(fileline, ["brightBlack"]) + "\n");
                }
            }

        });

        let pidPath = @path(configPath, "pid");
        let pidCommandLinePath = @path(configPath, "pid-cmdline");
        let pidConfigPath = @path(configPath, "pid-config");

        let commandLine = @.task.info(childProcess.pid)[childProcess.pid];
        if (commandLine) {
            @info(`Socks5 proxy[${childProcess.pid}] started`);
            @.fs.writeFile.sync(pidPath, childProcess.pid + "");
            @.fs.writeFile.sync(pidCommandLinePath, commandLine.command);
            @.fs.writeFile.sync(pidConfigPath, JSON.stringify(remoteConfig, null, 4));
        } else {
            throw new Error(`Process[${childProcess.pid}] info not found`);
        }

        if (!testing) {
            @mew.rpc("ssr.preferences.save", {
                "lastConnection": remoteConfig,
                "lastConnectionConnected": true
            }).rejected((error) => {
                @error(error);
            });
        }

        @mew.auto("ssr.connected", {
            "config": remoteConfig,
            "host": localListeningHost,
            "port": localSocks5ProxyPort,
            "testing": testing ? true : false
        });

        this.next({
            "pid": childProcess.pid,
            "commandLine": commandLine.command
        });

    });

};

const testShadowsocksR = function (callback) {

    const info = getShadowsocksRRunningInfo();
    if (!info) {
        return;
    }

    @debug("Testing shadowsocksr connection");

    let { localHTTPProxyPort } = loadPreferences();

    let request = http.request({
        "host": "127.0.0.1",
        "port": localHTTPProxyPort,
        "method": "CONNECT",
        "path": "google.com:443"
    });
    request.setTimeout(5000);
    request.setSocketKeepAlive(false);

    let tested = false;

    request.on("connect", (response, socket, head) => {

        let connection = tls.connect({
            "host": "google.com",
            "socket": socket
        }, () => {
            connection.write("GET / HTTP/1.1\r\nHost: google.com\r\n\r\n");
        });

        connection.setKeepAlive(false);
        connection.setTimeout(4000);

        const newLine = Buffer.from("\r", "utf8");
        let data = [];
        connection.on("data", (slice) => {
            let index = slice.indexOf(newLine);
            data.push(slice);
            if (index !== -1) {
                let all = Buffer.concat(data);
                let status = all.slice(0, all.indexOf(newLine)).toString("utf8").split(" ")[1];
                if (!tested) {
                    tested = true;
                    if (!/^[0-9]{3}$/.test(status)) {
                        if (callback) {
                            callback(new Error("HTTP protocol not match"));
                        } else {
                            @mew.auto("ssr.test.failed", {
                                "config": info.config,
                                "reason": "HTTP protocol not match"
                            });
                        }
                    } else {
                        let code = Math.floor(parseInt(status) / 100);
                        if ((code === 2) || (code === 3)) {
                            if (callback) {
                                callback();
                            } else {
                                @mew.auto("ssr.test.succeeded", {
                                    "config": info.config
                                });
                            }
                        } else {
                            if (callback) {
                                callback(new Error("HTTP status code not correct"));
                            } else {
                                @mew.auto("ssr.test.failed", {
                                    "config": info.config,
                                    "reason": "HTTP status code not correct"
                                });
                            }
                        }
                    }
                }
                connection.end();
            }
        });

        connection.on("error", (error) => {
            if (!tested) {
                tested = true;
                if (callback) {
                    callback(error);
                } else {
                    @mew.auto("ssr.test.failed", {
                        "config": info.config,
                        "reason": error.message
                    }); 
                }
            }
        });

        connection.on("close", (hadError) => {});
        connection.on("end", () => {});

        connection.on("timeout", () => {
            if (!tested) {
                tested = true;
                if (callback) {
                    callback(new Error("TLS connection timeout"));
                } else {
                    @mew.auto("ssr.test.failed", {
                        "config": info.config,
                        "reason": "TLS connection timeout"
                    }); 
                }
            }
        });

    });

    request.on("error", (error) => {
        if (!tested) {
            tested = true;
            if (callback) {
                callback(error);
            } else {
                @mew.auto("ssr.test.failed", {
                    "config": info.config,
                    "reason": error.message
                }); 
            }
        }
    });

    request.on("timeout", () => {
        if (!tested) {
            tested = true;
            if (callback) {
                callback(new Error("HTTP proxy request timeout"));
            } else {
                @mew.auto("ssr.test.failed", {
                    "config": info.config,
                    "reason": "HTTP proxy request timeout"
                }); 
            }
        }
    });

    request.end();

};

module.exports.initializeShadowsocksR = initializeShadowsocksR;

module.exports.startShadowsocksR = startShadowsocksR;
module.exports.stopShadowsocksRIfRuning = stopShadowsocksRIfRuning;
module.exports.getShadowsocksRRunningInfo = getShadowsocksRRunningInfo;