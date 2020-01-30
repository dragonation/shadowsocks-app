const fs = require("fs");
const path = require("path");

const { 
    app,
    BrowserWindow 
} = require("electron");

const { 
    resolveProgramName, 
    callbackProgramResult,
    handleProgramEvent
} = require("../program.js");

const installHandlers = function (installer) {

    installer("garden.window.create", createWindow);
    installer("garden.window.close", closeWindow);

    installer("garden.window.show", showWindow);
    installer("garden.window.hide", hideWindow);
    installer("garden.window.top", moveWindowToTop);

    installer("garden.window.focus", focusWindow);
    installer("garden.window.blur", blurWindow);
    installer("garden.window.flash", flashWindow);

    installer("garden.window.move", moveWindow);
    installer("garden.window.resize", resizeWindow);

    installer("garden.window.update", updateWindow);
    installer("garden.window.info", getWindowInfo);

    installer("garden.window.list", listWindows);
    installer("garden.window.focused", getFocusedWindow);

    installer("garden.window.reload", reloadWindow);
    installer("garden.window.capture", captureWindow);

};

const windows = Object.create(null);

const createWindow = function ({ 
    id, parent,
    uri, 
    title, 
    width, height, resizable,
    minWidth, minHeight, maxWidth, maxHeight,
    modal, alwaysOnTop, hidden,
    background,
    frameless,
    preload,
    debug
}, callback) {

    if (id && windows[id]) {
        windows[id].show(); return;
    }

    let window = new BrowserWindow({

        "title": (title !== undefined) ? title : resolveProgramName(),

        "width": width, "height": height,
        "minWidth": minWidth, "minHeight": minHeight,
        "maxWidth": maxWidth, "maxHeight": maxHeight,

        "useContentSize": true,
        "resizable": resizable === true,

        "parent": parent ? windows[parent] : null,
        "modal": modal ? true : false,
        "alwaysOnTop": alwaysOnTop === true,
        "show": false,

        "backgroundColor": background,

        "frame": frameless !== true,

        "webPreferences": {
            "nodeIntegration": false,
            "nodeIntegrationInWorker": false,
            "nodeIntegrationInSubFrames": false,
            "webSecurity": false,
            "allowRunningInsecureContent": true,
            "scrollBounce": true,
            // "contextIsolation": true,
            "preload": path.join(__dirname, "preload.js")
        }

    });

    if (id) {
        windows[id] = window;
    }

    if (!hidden) {
        window.once("ready-to-show", () => {
            window.show();
        });
    }

    let closeNotifiers = Object.create(null);
    window.lockClose = function (id, notifier) {
        closeNotifiers[id] = notifier;
    };
    window.unlockClose = function (id) {
        delete closeNotifiers[id];
    };
    window.on("close", (event) => {
        if (Object.keys(closeNotifiers).length > 0) {
            event.preventDefault();
            closeNotifiers[Object.keys(closeNotifiers)[0]]();
        }
    });

    window.handleCommand = function (usage, content, callback) {
        handleProgramEvent({
            "usage": usage,
            "content": content,
            "callback": callback
        });
    };

    window.on("closed", () => {
        if (id) {
            delete windows[id];
        }
    });

    window.on("unresponsive", () => {});
    window.on("responsive", () => {});

    if (uri.indexOf("://") === -1) {
        window.loadFile(uri);
    } else {
        window.loadURL(uri);
    }

    if (debug) {
        window.webContents.openDevTools();
    }

    callbackProgramResult(callback, undefined, window.id);

};

const closeWindow = function (id, callback) {

};

const showWindow = function (id, callback) {};
const hideWindow = function (id, callback) {};
const moveWindowToTop = function (id, callback) {};

const focusWindow = function (id, callback) {};
const blurWindow = function (id, callback) {};
const flashWindow = function (id, callback) {};

const moveWindow = function () {};
const resizeWindow = function () {};

const updateWindow = function () {};
const getWindowInfo = function () {};

const listWindows = function () {};
const getFocusedWindow = function () {};

const reloadWindow = function () {};
const captureWindow = function () {};

const getWindow = function (id) {

    return windows[id];

};

module.exports.installHandlers = installHandlers;
module.exports.getWindow = getWindow;
