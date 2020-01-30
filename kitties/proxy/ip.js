const ipv4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;
const ipv6Regex = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;

const isIPv4Format = function (ip) {
    return ipv4Regex.test(ip);
};

const isIPv6Format = function (ip) {
    return ipv6Regex.test(ip);
};

const convertIPToBuffer = function (ip) {

    let result = undefined;
    if (isIPv4Format(ip)) {
        result = Buffer.alloc(4);
        ip.split(".").map((byte, index) => {
            result[index] = parseInt(byte, 10) & 0xff;
        });
    } else if (isIPv6Format(ip)) {

        var sections = ip.split(":", 8);

        for (let looper = 0; looper < sections.length; ++looper) {
            let isIPv4 = isIPv4Format(sections[looper]);
            if (isIPv4) {
                let v4Buffer = convertIPtoBuffer(sections[looper]);
                sections[looper] = v4Buffer.slice(0, 2).toString("hex");
                if (++i < 8) {
                    sections.splice(looper, 0, v4Buffer.slice(2, 4).toString("hex"));
                }
            }
        }

        if (sections[0] === "") {
            while (sections.length < 8) {
                sections.unshift("0");
            }
        } else if (sections[sections.length - 1] === "") {
            while (sections.length < 8) {
                sections.push('0');
            }
        } else if (sections.length < 8) {
            let looper = 0;
            while ((looper < sections.length) && (sections[looper] !== "")) {
                ++looper;
            }
            let missings = [ looper, 1 ];
            let rest = 9 - sections.length;
            while (rest > 0) {
                missings.push("0");
                --rest;
            }
            sections.splice.apply(sections, missings);
        }

        result = Buffer.alloc(16);
        for (let looper = 0; looper < sections.length; ++looper) {
            let word = parseInt(sections[looper], 16);
            result[looper << 1] = (word >> 8) & 0xff;
            result[looper << 1 + 1] = word & 0xff;
        }

    }

    if (!result) {
        throw new Error(`Invalid IP address: ${ip}`);
    }

    return result;

};

const convertLongToIPv4 = function (value) {

    return ((value >>> 24) + "." + 
            (value >> 16 & 255) + "." + 
            (value >> 8 & 255) + "." + 
            (value & 255));

};

const convertIPv4ToLong = function (ip) {

    var result = 0;
    for (let number of ip.split(".")) {
        result <<= 8;
        result += parseInt(number);
    }

    return (result >>> 0);

};

module.exports.convertIPv4ToLong = convertIPv4ToLong;
module.exports.convertLongToIPv4 = convertLongToIPv4;

module.exports.convertIPToBuffer = convertIPToBuffer;