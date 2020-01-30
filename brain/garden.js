const path = require("path");

const gardenConfigs = require(@path(@mewchan().workingPath, "conf/garden.json"));

let started = false;

const createGUIURL = function (app, title) {

    if (!title) {
        title = gardenConfigs.name;
    } else if (title !== gardenConfigs.name) {
        title = `${title} - ${gardenConfigs.name}`;
    }

    return `garden://gui/index.html?title=${encodeURIComponent(title)}&apps=${encodeURIComponent(app)}&mode=content-only`;

};

@heard.rpc("ssr.window.show").then(function ({
    id, parent, modal
}) {

    let window = Object.assign({
        "id": id,
        "parent": parent, "modal": modal,
        "uri": createGUIURL(id)
    }, gardenConfigs.windows[id]);

    return @mew.rpc("garden.window.create", window);

});

const startupOnlyOnce = function () {

    return @promise("garden.gui.ready").then(function () {

        if (started) {
            this.next(); return;
        }
        started = true;

        let tray = gardenConfigs.tray;
        if (tray) {
            let icon = tray.icon;
            if (icon) {
                icon = @path(@mewchan().entryPath, tray.icon);
            }
            @mew.rpc("garden.tray.install", {
                "icon": icon,
                "tooltip": tray.tooltip,
                "menus": tray.menus
            }).then(function () {
                @mew.auto("garden.tray.default.installed");
                this.next();
            }).rejected((error) => {
                @error(error);
            });
        }

        this.next();

    }).then(function () {

        if (gardenConfigs.defaultWindow) {
            @mew.rpc("ssr.window.show", { 
                "id": gardenConfigs.defaultWindow 
            }).rejected((error) => {
                @error(error);
            });
        }

        this.next();

    });

};

@heard("garden.started").then(function (mew) {

    startupOnlyOnce().rejected((error) => {
        @error(error);
    });

});

await @promise("garden.ready");

let { binding, secure } = @playground.info("http.gui");

await @mew.rpc("garden.gui", {
    "host": "gui",
    "binding": binding,
    "secure": secure
});

@mew.emit("garden.gui.ready");
