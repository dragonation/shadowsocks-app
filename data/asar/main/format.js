const formatErrorStack = function (error) {

    if (!error.stack) {
        return [];
    }

    return error.stack.split("\n").slice(1).map((line) => {
        return line.trim().replace(/\.[^\.]+\.mew\-([^\\\/:]+)/g, (x) => {
            let extname = x.split(".mew-").slice(-1)[0];
            if (extname === "union") { // union fs specified on dir
                return "";
            } else {
                return "." + extname;
            }
        });
    });

};

var formatDate = function (date, format, utc) {

    var toString = function (number, length) {

        number = number + "";
        while (number.length < length) {
            number = "0" + number;
        }

        return number;
    };

    if (!date) {
        date = new Date();
    }

    if (!format) {
        format = "YYYY-MM-DD hh:mm:ss.SSS";
    }

    var result = [];

    var looper = 0;
    while (looper < format.length) {
        switch (format[looper]) {

            case "Y": {
                if (format[looper + 1] == "Y") {
                    if ((format[looper + 2] == "Y") && (format[looper + 3] == "Y")) {
                        result.push(("000" + (utc ? date.getUTCFullYear() : date.getFullYear())).slice(-4));
                        looper += 4;
                    } else {
                        result.push(("0" + ((utc ? date.getUTCFullYear() : date.getFullYear()) % 100)).slice(-2));
                        looper += 2;
                    }
                } else {
                    result.push((utc ? date.getUTCFullYear() : date.getFullYear()) + "");
                    ++looper;
                }
                break;
            };

            case "M": {
                if (format[looper + 1] == "M") {
                    result.push(("0" + ((utc ? date.getUTCMonth() : date.getMonth()) + 1)).slice(-2));
                    looper += 2;
                } else {
                    result.push(((utc ? date.getUTCMonth() : date.getMonth()) + 1) + "");
                    ++looper;
                }
                break;
            };

            case "D": {
                if (format[looper + 1] == "D") {
                    result.push(("0" + (utc ? date.getUTCDate() : date.getDate())).slice(-2));
                    looper += 2;
                } else {
                    result.push((utc ? date.getUTCDate() : date.getDate()) + "");
                    ++looper;
                }
                break;
            };

            case "h": {
                if (format[looper + 1] == "h") {
                    result.push(("0" + (utc ? date.getUTCHours() : date.getHours())).slice(-2));
                    looper += 2;
                } else {
                    result.push((utc ? date.getUTCHours() : date.getHours()) + "");
                    ++looper;
                }
                break;
            };

            case "m": {
                if (format[looper + 1] == "m") {
                    result.push(("0" + (utc ? date.getUTCMinutes() : date.getMinutes())).slice(-2));
                    looper += 2;
                } else {
                    result.push((utc ? date.getUTCMinutes() : date.getMinutes()) + "");
                    ++looper;
                }
                break;
            };

            case "s": {
                if (format[looper + 1] == "s") {
                    result.push(("0" + (utc ? date.getUTCSeconds() : date.getSeconds())).slice(-2));
                    looper += 2;
                } else {
                    result.push((utc ? date.getUTCSeconds() : date.getSeconds()) + "");
                    ++looper;
                }
                break;
            };

            case "S": {
                if ((format[looper + 1] == "S") && (format[looper + 2] == "S")) {
                    result.push(("00" + (utc ? date.getUTCMilliseconds() : date.getMilliseconds())).slice(-3));
                    looper += 3;
                } else {
                    result.push((utc ? date.getUTCMilliseconds() : date.getMilliseconds()) + "");
                    ++looper;
                }
                break;
            };

            case "\"":
            case "'": {
                var offset = 1;
                while ((format[looper + offset] != format[looper]) &&
                    (looper + offset < format.length)) {
                    if (format[looper + offset] == "\\") {
                        result.push(format[looper + offset + 1]);
                        offset += 2;
                    } else {
                        result.push(format[looper + offset]);
                        ++offset;
                    }
                }
                looper += offset + 1;
                break;
            };

            default: {
                result.push(format[looper]);
                ++looper;
                break;
            }

        }
    }

    return result.join("");

};

module.exports.formatErrorStack = formatErrorStack;
module.exports.formatDate = formatDate;
