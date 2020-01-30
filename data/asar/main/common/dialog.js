const dialog = require("../dialog.js");
const window = require("./window.js");
const electron = require("electron");

const { callbackProgramResult } = require("../program.js");

const installHandlers = function (installer) {

    installer("garden.dialog.error", showErrorDialog);
    installer("garden.dialog.save", showSaveDialog);
    installer("garden.dialog.open", showOpenDialog);

};

const showErrorDialog = function ({ message, stack }, callback) {

    dialog.showErrorDialog({
        "message": message,
        "stack": stack
    });

    callbackProgramResult(callback);


};

const showSaveDialog = function (content, callback) {

    let parent = content.window ? window.getWindow(content.window) : undefined;

    electron.dialog.showSaveDialog(parent, {
        "title": content ? content.title : undefined,
        "defaultPath": content ? content.defaultPath: undefined,
        "filters": content ? content.filters : undefined,
    }).catch((error) => {

        callbackProgramResult(callback, error);

    }).then(({ canceled, filePath }) => {

        callbackProgramResult(callback, undefined, filePath);

    });

};

const showOpenDialog = function (content, callback) {

    let parent = content.window ? window.getWindow(content.window) : undefined;

    electron.dialog.showOpenDialog(parent, {
        "title": content ? content.title : undefined,
        "defaultPath": content ? content.defaultPath: undefined,
        "filters": content ? content.filters : undefined,
    }).catch((error) => {

        callbackProgramResult(callback, error);

    }).then(({ canceled, filePaths }) => {

        if (filePaths && filePaths.length > 0) {
            callbackProgramResult(callback, undefined, filePaths);
        } else {
            callbackProgramResult(callback, undefined, undefined);
        }

    });

};

module.exports.installHandlers = installHandlers;
