const listen = function (app) {

    $.ajax("/channel", {
        "timeout": 2 * 60 * 1000,
        "data": {
            "id": app.id
        },
        "success": function (messages) {
            for (let message of messages) {
                if (app.handlers && app.handlers[message.usage]) {
                    try {
                        app.handlers[message.usage].call(app, message);
                    } catch (error) {
                        console.error(error);
                    }
                }
            }
            listen(app);
        },
        "error": function (request) {
            if (request.status && (request.status !== 408)) {
                console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
            }
            listen(app);
        }
    });

};

const App = function App(dom, filler) {

    this.dom = dom;

    this.filler = filler;

    this.id = $.uuid();

    listen(this);

    this.filler.fill({
        "activeTab": "general"
    });

    this.refreshPreferences();

};

App.prototype.refreshPreferences = function () {

    $.ajax("/preferences/all", {
        "success": (result) => {
            this.filler.fill({
                "preferences": result
            });
        },
        "error": (request) => {
            alert("Failed to load preferences");
            window.close();
        }
    });

};

App.prototype.onKeyPressed = function (event) {};

App.prototype.title = "Preferences - Shadowsocks";

App.prototype.handlers = {
    "ssr.preferences.updated": function () {
        this.refreshPreferences();
    }
};

App.functors = {

    "updateActiveTab": function (event) {

        let top = this.dom.getClientRects()[0].top;

        let visibles = [];
        for (let node of this.filler.query(".panel")) {
            let nodeTop = node.getClientRects()[0].top;
            if (nodeTop > top) {
                visibles.push(node);
            }
        }

        if (visibles.length === 0) {
            return;
        }

        let id = visibles[0].id.split("-").slice(1).join("-");

        this.filler.fill({
            "activeTab": id
        });

    },

    "switchTab": function (tab) {

        let node = this.filler.query(`#panel-${tab}.panel`)[0];
        if (!node) {
            return;
        }

        let scrollView = this.filler.query("#form")[0];

        let top = (scrollView.scrollTop + 
                   node.getClientRects()[0].top - 
                   this.dom.getClientRects()[0].top - 
                   $.dom.getDevicePixels(20));

        scrollView.scrollTo(0, top, true);

    },
    
    "locatePython": function () {

        $.ajax("/ssr/locate-python", {
            "data": {
                "window": "preferences",
                "location": this.filler.parameters.preferences.pythonLocation
            },
            "timeout": 30 * 60 * 1000,
            "success": (result) => {
                if (result) {
                    $.ajax({
                        "url": "/preferences/update",
                        "data": {
                            "changes": JSON.stringify({ "pythonLocation": result.path })
                        },
                        "error": () => {
                            alert(`Failed to change value[${key}] to ${event.value}`);
                        }
                    });
                }

            },
            "error": () => {
                alert("Failed to locate python executable");
            }
        })

    },
    "addSubscription": function () {
        $.ajax({
            "url": "/uris/import-subscription",
            "data": { "parent": "preferences" },
            "error": () => {
                alert("Failed to add subscription");
            }
        });
    },
    "removeSubscription": function (url) {

        let confirmed = confirm(`Are you sure to remove the subscription “${url}”`);
        if (!confirmed) { return; }

        $.ajax("/uris/unsubscribe", {
            "data": { "url": url },
            "error": () => {
                alert("Failed to remove subscription");
            }
        });

    },
    "updatePreference": function (key, event) {
        if (!event) { return; }
        $.ajax({
            "url": "/preferences/update",
            "data": {
                "changes": JSON.stringify({ [key]: event.value })
            },
            "error": () => {
                alert(`Failed to change value[${key}] to ${event.value}`);
            }
        });
    },
    "updateGFWList": function () {
        $.ajax("/pac/update", {
            "success": (result) => {},
            "error": (request) => {
                alert("Update failed");
            }
        });
    },
    "updateSubscriptions": function () {
        $.ajax("/uris/update", {
            "success": (result) => {},
            "error": (request) => {
                alert("Update failed");
            }
        });
    }
};

module.exports.App = App;
