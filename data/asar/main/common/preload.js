let { remote, webFrame } = require("electron");

let currentWindow = remote.getCurrentWindow();

process.once("loaded", () => {

    let garden = {};

    Object.defineProperty(global, "garden", {
        "value": garden  
    });

    garden.lockClose = function (id, notifier) {
        currentWindow.lockClose(id, notifier);
    };

    garden.unlockClose = function (id) {
        currentWindow.unlockClose(id);
    };

    garden.handleCommand = function (usage, content, callback) {
        currentWindow.handleCommand(usage, content, callback);
    };

});
