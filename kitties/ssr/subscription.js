const { parseURIs } = require("./uri.js");
const { loadPreferences, savePreferences, updateURIs } = require("./preferences.js");

const parseSubscriptedContents = function (content) {

    if (!content) {
        @warn("Subscripted content empty");
        return {
            "parseds": [],
            "fakes": [] 
        };
    }

    const decoded = Buffer.from(content, "base64").toString("utf8");

    let uris = decoded.split(/[\n ]+/).filter((line) => line);

    return parseURIs(uris);

};

const updateSubscription = function (url) {

    return analyzeSubscription(url).then(function (result) {

        let { adds, updates, removes, kepts } = updateURIs(url, result.parseds);

        this.next({
            "fakes": result.fakes,
            "adds": adds,
            "updates": updates,
            "removes": removes,
            "kepts": kepts
        });

    });

};

const analyzeSubscription = function (url) {

    let client = @.net.httpClient();

    return @.async(function () {

        client.request(url, {
            "dataType": "text",
            "onSuccess": this.next,
            "onError": this.reject
        });

    }).then(function (contents) {

        let result = parseSubscriptedContents(contents);

        this.next(result);

    });

};

const updateSubscriptions = function () {

    let preferences = loadPreferences();

    let statistics = Object.create(null);

    let urls = preferences["subscriptionURLs"];
    if ((!urls) || (urls.length === 0)) {
        return @.async.resolve(statistics);
    }

    return @.async.all(urls, function (url) {

        @.async(function () {

            updateSubscription(url).catch(this);

        }).then(function (error, result) {

            if (error) {
                statistics[url] = { "error": error };
            } else {
                statistics[url] = result;
            }

            this.next();
            
        }).pipe(this);

    }).then(function () {

        @mew.auto("ssr.subscription.updated", statistics);

        this.next();

    }).resolve(statistics);

};

const addSubscriptionURL = function (url) {

    let urls = loadPreferences().subscriptionURLs.slice(0);
    if (urls.indexOf(url) !== -1) {
        return;
    }

    urls.push(url);

    savePreferences({
        "subscriptionURLs": urls
    });

    @mew.auto("ssr.subscription.added", url);

};

const removeSubscriptionURL = function (url, removeConfigs) {

    let urls = loadPreferences().subscriptionURLs.slice(0);
    let index = urls.indexOf(url);
    if (index !== -1) {
        urls.splice(url, 1);
    }

    savePreferences({
        "subscriptionURLs": urls
    });

    if (removeConfigs) {
        updateURIs(url, []);
    }

};

module.exports.parseSubscriptedContents = parseSubscriptedContents;

module.exports.analyzeSubscription = analyzeSubscription;

module.exports.updateSubscription = updateSubscription;
module.exports.updateSubscriptions = updateSubscriptions;

module.exports.addSubscriptionURL = addSubscriptionURL;
module.exports.removeSubscriptionURL = removeSubscriptionURL;
