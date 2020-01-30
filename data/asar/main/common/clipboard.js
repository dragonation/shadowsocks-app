const { clipboard } = require("electron");

const { callbackProgramResult } = require("../program.js");

const installHandlers = function (installer) {

    installer("garden.clipboard.set", setClipboardData);

    installer("garden.clipboard.get", getClipboardData);

    installer("garden.clipboard.formats", listClipboardFormats);

};

const setClipboardData = function (content, callback) {

    clipboard.clear();

    // TODO: has bugs for duplicated entries
    // for (let format in content) {
    //     let data = content[format];
    //     data = Buffer.from(data, "base64");
    //     clipboard.writeBuffer(format, data);
    // }
    let data = {};
    if (content["text/plain"]) {
        data.text = Buffer.from(content["text/plain"], "base64").toString("utf8");
    }
    if (content["text/html"]) {
        data.html = Buffer.from(content["text/html"], "base64").toString("utf8");
    }
    clipboard.write(data);

    callbackProgramResult(callback);

};

const getClipboardData = function (content, callback) {

    let formats = clipboard.availableFormats();

    let data = {};

    for (let format of formats) {
        data[format] = clipboard.readBuffer(format).toString("base64");
    }

    callbackProgramResult(callback, undefined, data);

};

const listClipboardFormats = function (content, callback) {

    let formats = clipboard.availableFormats();

    callbackProgramResult(callback, undefined, formats);

};

module.exports.installHandlers = installHandlers;
