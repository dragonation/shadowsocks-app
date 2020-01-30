const installCommonRPCHandlers = function (installer) {

    for (let file of [
        "./common/accelerator.js",
        "./common/app.js",
        "./common/capturer.js",
        "./common/clipboard.js",
        "./common/dialog.js",
        "./common/menu.js",
        "./common/module.js",
        "./common/notification.js",
        "./common/screen.js",
        "./common/shell.js",
        "./common/tray.js",
        "./common/view.js",
        "./common/window.js",
        ]) {
        require(file).installHandlers(installer);
    }

};

const installWindowsRPCHandlers = function (installer) {

    for (let file of [
        "./windows/task.js",
        ]) {
        require(file).installHandlers(installer);
    }

};

const installOSXRPCHandlers = function (installer) {

    for (let file of [
        "./osx/dock.js",
        "./osx/main_menu.js",
        "./osx/touch_bar.js",
        ]) {
        require(file).installHandlers(installer);
    }

};

const installGNOMERPCHandlers = function (installer) {

    for (let file of [
        "./gnome/app_menu.js",
        ]) {
        require(file).installHandlers(installer);
    }

};

const initializeRPCHandlers = function (installer) {

    installCommonRPCHandlers(installer);

    switch (process.platform) {
        case "win32": {
            installWindowsRPCHandlers(installer);
            break;
        }
        case "macos": {
            installOSXRPCHandlers(installer);
            break;
        }
        case "linux": 
        default: {
            installGNOMERPCHandlers(installer);
            break;
        }
    } 

};

module.exports.initializeRPCHandlers = initializeRPCHandlers;