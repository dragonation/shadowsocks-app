// const defaultURL = "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt";
// https://pagure.io/gfwlist/raw/master/f/gfwlist.txt
// http://repo.or.cz/gfwlist.git/blob_plain/HEAD:/gfwlist.txt
const defaultURL = "https://bitbucket.org/gfwlist/gfwlist/raw/HEAD/gfwlist.txt";
// https://gitlab.com/gfwlist/gfwlist/raw/master/gfwlist.txt
// https://git.tuxfamily.org/gfwlist/gfwlist.git/plain/gfwlist.txt

const generateGFWListScript = function (content) {

    let configs = Buffer.from(content, "base64").toString("utf8");

    let list = configs.split("\n").slice(1).filter((line) => {
        line = line.trim();
        return line && (line[0] !== "!");
    });

    if (@.fs.exists(@path(@mewchan().workingPath, "data/gfwlist/custom.txt"))) {
        let custom = @.fs.readFile.sync(@path(@mewchan().workingPath, "data/gfwlist/custom.txt"), "utf8").split("\n").map((line) => {
            return line.trim();
        }).filter((line) => line);
        list = list.concat(custom);
    }

    list.sort((a, b) => {
        a = a.replace(/^[|@.]+/, "");
        b = b.replace(/^[|@.]+/, "");
        return a.localeCompare(b);
    });

    let template = @.fs.readFile.sync(@path(@mewchan().workingPath, "data/gfwlist/template.js.txt"), "utf8");

    let result = @.format(template, {
        "list": list
    });

    return result;

};

const downloadGFWList = function (url) {

    if (!url) {
        url = defaultURL;
    }

    return @.async(function () {

        let client = @.net.httpClient();

        client.request(url, {
            "timeout": 10000,
            "dataType": "text",
            "onSuccess": (result) => {
                this.next(result);
            },
            "onError": (error) => {
                this.reject(error);
            }
        });

    });
    
};

module.exports.downloadGFWList = downloadGFWList;
module.exports.generateGFWListScript = generateGFWListScript;
