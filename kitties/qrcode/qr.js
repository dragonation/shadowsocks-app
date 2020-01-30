var { Readable } = require("stream");

var { QR } = require("./qr_base.js");
var vector = require("./vector.js");

const initialOptions = function (options) {

    if (typeof options === "string") {
        options = { "ecLevel": options }
    } else if (!options) {
        options = {};
    }

    options = Object.assign({}, options);

    if (options.parseURL === undefined) {
        options.parseURL = false;
    }
    if (options.ecLevel === undefined) {
        options.ecLevel = "M";
    }
    if (options.margin === undefined) {
        options.margin = 1;
    }
    if (options.size === undefined) {
        options.size = 0;
    }

    return options;

};

const svgQRCode = function (text, options) {

    options = initialOptions(options);

    var matrix = QR(text, options.ecLevel, options.parseURL);

    var stream = new Readable();
    stream._read = function () {};

    process.nextTick(function() {
        vector.encodeSVG(matrix, stream, options.margin, options.size);
    });
    
    return stream;

};

const svgQRCodeSync = function (text, options) {

    options = initialOptions(options);

    var matrix = QR(text, options.ecLevel, options.parseURL);
    var stream = [];

    vector.encodeSVG(matrix, stream, options.margin, options.size);

    return stream.filter(Boolean).join("");

};

const createSVGObject = function (text, options) {

    options = initialOptions(options);

    var matrix = QR(text, options.ecLevel);

    return vector.createSVGObject(matrix, options.margin);

};

module.exports = {
    "QR": QR,
    "svgQRCode": svgQRCode,
    "svgQRCodeSync": svgQRCodeSync,
    "createSVGObject": createSVGObject 
};
