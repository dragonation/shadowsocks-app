const convertMatrix2Path = function (matrix) {

    var N = matrix.length;
    var filled = [];
    for (var row = -1; row <= N; row++) {
        filled[row] = [];
    }

    var path = [];
    for (var row = 0; row < N; row++) {
        for (var col = 0; col < N; col++) {
            if (filled[row][col]) continue;
            filled[row][col] = 1;
            if (isDark(row, col)) {
                if (!isDark(row - 1, col)) {
                    path.push(plot(row, col, "right"));
                }
            } else {
                if (isDark(row, col - 1)) {
                    path.push(plot(row, col, "down"));
                }
            }
        }
    }
    return path;

    function isDark(row, col) {
        if (row < 0 || col < 0 || row >= N || col >= N) return false;
        return !!matrix[row][col];
    }

    function plot(row0, col0, dir) {
        filled[row0][col0] = 1;
        var res = [];
        res.push(["M",  col0, row0 ]);
        var row = row0;
        var col = col0;
        var len = 0;
        do {
            switch (dir) {
                case "right": {
                    filled[row][col] = 1;
                    if (isDark(row, col)) {
                        filled[row - 1][col] = 1;
                        if (isDark(row - 1, col)) {
                            res.push(["h", len]);
                            len = 0;
                            dir = "up";
                        } else {
                            len++;
                            col++;
                        }
                    } else {
                        res.push(["h", len]);
                        len = 0;
                        dir = "down";
                    }
                    break;
                }
                case "left": {
                    filled[row - 1][col - 1] = 1;
                    if (isDark(row - 1, col - 1)) {
                        filled[row][col - 1] = 1;
                        if (isDark(row, col - 1)) {
                            res.push(["h", -len]);
                            len = 0;
                            dir = "down";
                        } else {
                            len++;
                            col--;
                        }
                    } else {
                        res.push(["h", -len]);
                        len = 0;
                        dir = "up";
                    }
                    break;
                }
                case "down": {
                    filled[row][col - 1] = 1;
                    if (isDark(row, col - 1)) {
                        filled[row][col] = 1;
                        if (isDark(row, col)) {
                            res.push(["v", len]);
                            len = 0;
                            dir = "right";
                        } else {
                            len++;
                            row++;
                        }
                    } else {
                        res.push(["v", len]);
                        len = 0;
                        dir = "left";
                    }
                    break;
                }
                case "up": {
                    filled[row - 1][col] = 1;
                    if (isDark(row - 1, col)) {
                        filled[row - 1][col - 1] = 1;
                        if (isDark(row - 1, col - 1)) {
                            res.push(["v", -len]);
                            len = 0;
                            dir = "left";
                        } else {
                            len++;
                            row--;
                        }
                    } else {
                        res.push(["v", -len]);
                        len = 0;
                        dir = "right";
                    }
                    break;
                }
            }
        } while (row != row0 || col != col0);
        return res;
    }
};

const pushSVGPath = function (matrix, stream, margin) {
    convertMatrix2Path(matrix).forEach(function (subpath) {
        var res = "";
        for (var k = 0; k < subpath.length; k++) {
            var item = subpath[k];
            switch (item[0]) {
                case "M": {
                    res += "M" + (item[1] + margin) + " " + (item[2] + margin);
                    break;
                }
                default: {
                    res += item.join('');
                    break;
                }
            }
        }
        res += "z";
        stream.push(res);
    });
};

const createSVGObject = function (matrix, margin) {

    var stream = [];
    pushSVGPath(matrix, stream, margin);

    var result = {
        "size": matrix.length + 2 * margin,
        "path": stream.filter(Boolean).join("")
    };

    return result;
};

const encodeSVG = function SVG(matrix, stream, margin, size) {
    var X = matrix.length + 2 * margin;
    stream.push("<svg xmlns=\"http://www.w3.org/2000/svg\" ");
    if (size > 0) {
        var XY = X * size;
        stream.push("width=\"" + XY + "\" height=\"" + XY + "\" ");
    }
    stream.push("viewBox=\"0 0 " + X + " " + X + "\">");
    stream.push("<path d=\"");
    pushSVGPath(matrix, stream, margin);
    stream.push("\"/></svg>");
    stream.push(null);
};

module.exports = {
    "encodeSVG": encodeSVG,
    "createSVGObject": createSVGObject 
};
