const App = function App(dom, filler) {

    this.dom = dom;

    this.filler = filler;

};

App.prototype.onKeyPressed = function (event) {};

App.prototype.title = "Import subscriptions - Shadowsocks";

App.functors = {

    "selectRow": function (event) {

        this.filler.fill({
            "selectedRowIndex": event.rowIndex
        });

    },

    "analyzeURL": function () {

        let url = this.filler.query("#url-input").val();

        $.ajax("/uris/analyze", {
            "data": {
                "url": url
            },
            "success": (result) => {
                this.filler.fill({
                    "uris": result.parseds
                });
            },
            "error": (request) => {
                alert("Invalid URL to analyze");
            }
        });

    },
    "addSubscription": function () {

        let url = this.filler.query("#url-input").val();

        $.ajax("/preferences/all", {
            "success": (result) => {

                if (result.subscriptionURLs.indexOf(url) !== -1) {
                    alert("The subscription URL already exists");
                    return;
                }

                $.ajax("/uris/subscribe", {
                    "data": {
                        "url": url
                    },
                    "success": (result) => {
                        alert("The subscription URL has been added");
                        window.close();
                    },
                    "error": (request) => {
                        alert("Failed to add subscription");
                    }
                });

            },
            "error": (error) => {
                alert("Failed to add subscription");
            }
        });

        

    }

};

module.exports.App = App;
