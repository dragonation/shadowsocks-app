const pushBits = function (arr, n, value) {
    for (var bit = 1 << (n - 1); bit; bit = bit >>> 1) {
        arr.push(bit & value ? 1 : 0);
    }
};

const encode8Bit = function (data) {
    var len = data.length;
    var bits = [];

    for (var i = 0; i < len; i++) {
        pushBits(bits, 8, data[i]);
    }

    var res = {};

    var d = [0, 1, 0, 0];
    pushBits(d, 16, len);
    res.data10 = res.data27 = d.concat(bits);

    if (len < 256) {
        var d = [0, 1, 0, 0];
        pushBits(d, 8, len);
        res.data1 = d.concat(bits);
    }

    return res;
};

var ALPHANUM = (function(s) {
    var res = {};
    for (var i = 0; i < s.length; i++) {
        res[s[i]] = i;
    }
    return res;
})("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:");

const encodeAlphaNum = function (str) {
    var len = str.length;
    var bits = [];

    for (var i = 0; i < len; i += 2) {
        var b = 6;
        var n = ALPHANUM[str[i]];
        if (str[i+1]) {
            b = 11;
            n = n * 45 + ALPHANUM[str[i+1]];
        }
        pushBits(bits, b, n);
    }

    var res = {};

    var d = [0, 0, 1, 0];
    pushBits(d, 13, len);
    res.data27 = d.concat(bits);

    if (len < 2048) {
        var d = [0, 0, 1, 0];
        pushBits(d, 11, len);
        res.data10 = d.concat(bits);
    }

    if (len < 512) {
        var d = [0, 0, 1, 0];
        pushBits(d, 9, len);
        res.data1 = d.concat(bits);
    }

    return res;
};

const encodeNumeric = function (str) {
    var len = str.length;
    var bits = [];

    for (var i = 0; i < len; i += 3) {
        var s = str.substr(i, 3);
        var b = Math.ceil(s.length * 10 / 3);
        pushBits(bits, b, parseInt(s, 10));
    }

    var res = {};

    var d = [0, 0, 0, 1];
    pushBits(d, 14, len);
    res.data27 = d.concat(bits);

    if (len < 4096) {
        var d = [0, 0, 0, 1];
        pushBits(d, 12, len);
        res.data10 = d.concat(bits);
    }

    if (len < 1024) {
        var d = [0, 0, 0, 1];
        pushBits(d, 10, len);
        res.data1 = d.concat(bits);
    }

    return res;
};

const encodeURL = function (str) {
    var slash = str.indexOf("/", 8) + 1 || str.length;
    var res = encode(str.slice(0, slash).toUpperCase(), false);

    if (slash >= str.length) {
        return res;
    }

    var path_res = encode(str.slice(slash), false);

    res.data27 = res.data27.concat(path_res.data27);

    if (res.data10 && path_res.data10) {
        res.data10 = res.data10.concat(path_res.data10);
    }

    if (res.data1 && path_res.data1) {
        res.data1 = res.data1.concat(path_res.data1);
    }

    return res;
};

const encode = function (data, parse_url) {
    var str;
    var t = typeof data;

    if (t == "string" || t == "number") {
        str = "" + data;
        data = Buffer.from(str);
    } else if (Buffer.isBuffer(data)) {
        str = data.toString();
    } else if (Array.isArray(data)) {
        data = Buffer.from(data);
        str = data.toString();
    } else {
        throw new Error("Bad data");
    }

    if (/^[0-9]+$/.test(str)) {
        if (data.length > 7089) {
            throw new Error("Too much data");
        }
        return encodeNumeric(str);
    }

    if (/^[0-9A-Z \$%\*\+\.\/\:\-]+$/.test(str)) {
        if (data.length > 4296) {
            throw new Error("Too much data");
        }
        return encodeAlphaNum(str);
    }

    if (parse_url && /^https?:/i.test(str)) {
        return encodeURL(str);
    }

    if (data.length > 2953) {
        throw new Error("Too much data");
    }

    return encode8Bit(data);
};

module.exports.encode = encode;
