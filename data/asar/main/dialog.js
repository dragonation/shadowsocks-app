const { 
    app,
    BrowserWindow 
} = require("electron");

const program = require("./program.js");

const showErrorDialog = function (error) {

    let size = { "width": 640, "height": 276 };

    let window = new BrowserWindow({
        "title": "Shadowsocks",
        "width": size.width,
        "height": size.height,
        "useContentSize": true,
        "resizable": false,
        "modal": true,
        "webPreferences": {
            "nodeIntegration": true,
            "webSecurity": false
        }
    });

    let appPath = app.getAppPath();

    let title = error.message;
    let stack = error.stack.split("\n").slice(1).filter((line) => line.trim()).map((line) => {

        line = line.trim().slice(3);

        let file = undefined;
        let symbol = undefined;
        if (line[line.length - 1] === ")") {
            file = line.split("(").slice(-1)[0].slice(0, -1);
            symbol = line.split("(").slice(0, -1).join("(").trim() + "()";
        } else {
            file = line.trim();
            symbol = "<module>";
        }

        file = file.replace(/\.[^\.]+\.mew\-([^\\\/:]+)/g, (x) => {
            let extname = x.split(".mew-").slice(-1)[0];
            if (extname === "union") { // union fs specified on dir
                return "";
            } else {
                return "." + extname;
            }
        });

        if (file.indexOf(appPath + "/") === 0) {
            file = "@garden/" + file.slice(appPath.length + 1);
        }

        let programPath = program.resolveProgramPath();
        if (file.indexOf(programPath + "/") === 0) {
            file = "@app/" + file.slice(programPath.length + 1);
        }

        return {
            "file": file.split(":").slice(0, -2).join(":"),
            "line": parseInt(file.split(":").slice(-2)[0]),
            "column": parseInt(file.split(":").slice(-1)[0]),
            "symbol": symbol
        };

    }).filter((frame) => frame.file);

    window.templateData = {
        "app": program.resolveProgramName(),
        "title": title,
        "stack": stack
    };

    window.loadFile("ui/error-dialog/error-dialog.html");

    return window;

};

module.exports.showErrorDialog = showErrorDialog;
