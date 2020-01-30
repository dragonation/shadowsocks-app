const { formatErrorStack, formatDate } = require("./format.js");
const { jsonize } = require("./jsonize.js");

const styleCodePoints = {

    "white": [37, 39],
    "black": [30, 39],
    "blue": [34, 39],
    "cyan": [36, 39],
    "green": [32, 39],
    "magenta": [35, 39],
    "red": [31, 39],
    "yellow": [33, 39],

    "brightBlack": [90, 39],
    "brightRed": [91, 39],
    "brightGreen": [92, 39],
    "brightYellow": [93, 39],
    "brightBlue": [94, 39],
    "brightMagenta": [95, 39],
    "brightCyan": [96, 39],
    "brightWhite": [97, 39],

    "bold": [1, 22],
    "dim": [2, 22],
    "italic": [3, 23],
    "underline": [4, 24],
    "inverse": [7, 27],
    "hidden": [8, 28],
    "strikethrough": [9, 29]

};

const styles = {
    "system": ["magenta"],
    "assert": ["magenta"],
    "error":  ["red"],
    "warn":   ["yellow"],
    "celebr": ["green"],
    "info":   ["brightWhite"],
    "debug":  ["white"],
    "dump":   ["cyan"],
    "line":   ["brightBlack"]
};

const logLevelMap = {
    "system": 1,
    "assert": 2,
    "error": 3,
    "dump": 4,
    "warn": 5,
    "celebr": 6,
    "info": 7,
    "debug": 8
};

const logLevelDisplayMap = {
    "system": "[SYSTEM]",
    "assert": "[ASSERT]",
    "error":  " [ERROR]",
    "warn":   "  [WARN]",
    "info":   "  [INFO]",
    "celebr": "[CELEBR]",
    "debug":  " [DEBUG]",
    "dump":   "  [DUMP]"
};

const formattedStackSources = Object.create(null);

let hasSpecifiedLogLevel = false;
let defaultLevel = "info";
let isDebugging = false;
process.argv.slice(2).forEach(function (argument) {
    if (argument.substring(0, 2) === "--") {
        var name = argument.split("=")[0];
        var value = argument.split("=").slice(1).join("=");
        switch (name) {
            case "--debug": {
                if ((!value) || (["no", "n", "f", "false", "0"].indexOf(value.toLowerCase()) === -1)) {
                    isDebugging = true;
                }
                break;
            };
            case "--log-level": {
                if (logLevelMap.hasOwnProperty(value)) {
                    defaultLevel = value;
                    hasSpecifiedLogLevel = true;
                }
                break;
            };
            default: { break; };
        }
    }
});

if ((!hasSpecifiedLogLevel) && isDebugging) {
    defaultLevel = "debug";
}

const prewhitespaces = ("MM-DD hh:mm:ss.SSS " + logLevelDisplayMap["info"] + " ").replace(/./g, function () {
    return " ";
});

const formatValue = function (value) {

    if (value === null) {
        return "null";
    } else if (value === undefined) {
        return "undefined";
    } else if (typeof value === "string") {
        return value;
    } else if (value instanceof Error) {
        return getErrorReport(value);
    } else {
        return jsonize(value);
    }

};

const getErrorReport = function (error) {

    return error.name + ": " + error.message + "\n" + formatErrorStack(error).map((line) => {
        return "    " + line;
    }).join("\n");

};

const formatStackFrame = function (frame, components) {

    if (arguments.length === 1) {
        components = 3;
    }

    if (!formattedStackSources[frame.source]) {
        formattedStackSources[frame.source] = Object.create(null);
    }
    if (!formattedStackSources[frame.source][components]) {
        let source = frame.source;
        source = source.replace(/\.([^\.]+)\.mew\-([^\-\.]+)($|\\|\/)/g, (text) => {
            return "." + text.split("-").slice(-1)[0];
        });
        formattedStackSources[frame.source][components] = source.split(/[\\\/]/g).slice(-components).join("/");
    }

    return formattedStackSources[frame.source][components] + ":" + frame.line;

};

const getStackFrame = function (offset) {

    if (!offset) {
        offset = 0;
    }

    let line = new Error().stack.split("\n")[1 + offset];
    if (!line) {
        return {
            "source": "unknown",
            "line": 0,
            "column": 0
        };
    } 

    let file = undefined;
    if (line[line.length - 1] === ")") {
        file = line.split("(").slice(-1)[0].slice(0, -1);
    } else {
        file = line.trim();
    }

    return {
        "source": file.split(":").slice(0, -2).join(":"),
        "line": parseInt(file.split(":").slice(-2)[0]),
        "column": parseInt(file.split(":").slice(-1)[0])
    };

};


const Logger = function Logger(options) {

    this.level = defaultLevel;
    this.recordFileLine = true;

};

Logger.prototype.output = function (contents) {

    if (contents instanceof Array) {
        contents = contents.join("");
    }

    process.stderr.write(contents);

};

Logger.prototype.logWithLevel = function (level) {

    let frame = getStackFrame();

    let baseLevel = this.level;

    if (logLevelMap[baseLevel] >= logLevelMap[level]) {

        const prefix = formatDate(new Date(), "MM-DD hh:mm:ss.SSS") + " " + logLevelDisplayMap[level] + " ";

        const messages = [];
        let looper = 1;
        while (looper < arguments.length) {
            let formatted = formatValue(arguments[looper]);
            messages[messages.length] = formatted;
            ++looper;
        }

        let message = messages.join(", ").split("\n").map((line, index) => {
            if (index > 0) {
                return prewhitespaces + line;
            } else {
                return prefix + line;
            }
        }).join("\n");

        const opens = [];
        const outputs = [message];
        const closes = [];

        let messageStyles = styles[level];
        if (messageStyles) {
            messageStyles.forEach((style) => {
                if (styleCodePoints[style]) {
                    opens[opens.length] = "\u001b[" + styleCodePoints[style][0] + "m";
                    closes[closes.length] = "\u001b[" + styleCodePoints[style][1] + "m";
                }
            });
        }

        if (this.recordFileLine) {
            let fileLineStyles = styles["line"];
            if (fileLineStyles) {
                fileLineStyles.forEach((style) => {
                    if (styleCodePoints[style]) {
                        closes[closes.length] = " \u001b[" + styleCodePoints[style][0] + "m(";
                        closes[closes.length] = formatStackFrame(frame);
                        closes[closes.length] = ")\u001b[" + styleCodePoints[style][1] + "m";
                    }
                });
            }
        }

        closes.push("\n");

        this.output(opens.concat(outputs).concat(closes));

    }

    if (logLevelMap[level] <= logLevelMap["assert"]) {
        process.exit();
    }

};

["debug", "info", "celebr", "warn", "error", "system"].forEach((level) => {
    Logger.prototype[level] = function () {

        switch (arguments.length) {
            case 0: { this.logWithLevel(level); break; };
            case 1: { this.logWithLevel(level, arguments[0]); break; };
            case 2: { this.logWithLevel(level, arguments[0], arguments[1]); break; };
            case 3: { this.logWithLevel(level, arguments[0], arguments[1], arguments[2]); break; };
            default: {
                let newArguments = Array.prototype.slice.call(arguments);
                newArguments.unshift(level);
                this.logWithLevel.apply(this, newArguments);
                break;
            };
        }

    };
});

Logger.prototype.dump = function () {

    let maximumLevel = 3;
    
    let objects = Array.prototype.slice.call(arguments);

    let message = undefined;
    if (objects.length === 1) {
        message = jsonize(objects[0], maximumLevel);
    } else {
        message = jsonize(objects, maximumLevel);
    }

    this.logWithLevel("dump", message);

};

Logger.prototype.dumpAll = function () {

    let maximumLevel = 3;

    let objects = Array.prototype.slice.call(arguments);
    if ((objects.length === 2) && (typeof objects[1] === "number")) {
        maximumLevel = objects[1];
        --objects.length;
    }

    let message = jsonize(objects[0], maximumLevel, true);

    this.logWithLevel("dump", message);

};

Logger.prototype.assert = function (test, message) {

    if (!test) {
        this.logWithLevel("assert", message);
    }

};

Logger.prototype.assertEQ = function (value, expected, message) {

    if (value !== expected) {
        if (!message) {
            message = "Assertion failure";
        }
        message += ": expected " + jsonize(expected) + ", but got " + jsonize(value);
        this.logWithLevel("assert", message);
    }

};

const defaultLogger = new Logger();

module.exports.debug = defaultLogger.debug.bind(defaultLogger);
module.exports.info = defaultLogger.info.bind(defaultLogger);
module.exports.celebr = defaultLogger.celebr.bind(defaultLogger);
module.exports.warn = defaultLogger.warn.bind(defaultLogger);
module.exports.error = defaultLogger.error.bind(defaultLogger);
module.exports.system = defaultLogger.system.bind(defaultLogger);

module.exports.dump = defaultLogger.dump.bind(defaultLogger);
module.exports.dumpAll = defaultLogger.dumpAll.bind(defaultLogger);
module.exports.assert = defaultLogger.assert.bind(defaultLogger);
module.exports.assertEQ = defaultLogger.assertEQ.bind(defaultLogger);
