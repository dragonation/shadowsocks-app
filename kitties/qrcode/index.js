const { svgQRCodeSync, createSVGObject } = require("./qr.js");

@heard.rpc("qrcode.svg").then(function ({ text, asURL, size, margin, ecLevel }) {

    return @.async.resolve(svgQRCodeSync(text, {
        "parseURL": asURL,
        "size": size,
        "margin": margin,
        "ecLevel": ecLevel
    }));

});

@heard.rpc("qrcode.svg.object").then(function ({ text, asURL, size, margin, ecLevel }) {

    return @.async.resolve(createSVGObject(text, {
        "parseURL": asURL,
        "size": size,
        "margin": margin,
        "ecLevel": ecLevel
    }));

});
