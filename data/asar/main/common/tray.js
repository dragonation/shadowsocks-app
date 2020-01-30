const { app, Tray, Menu, MenuItem } = require("electron");

const { createUUID } = require("../uuid.js");
const { callbackProgramResult, sendProgramEvent } = require("../program.js");

const trays = Object.create(null);

const bindMenuClick = function (id, item) {

    if (item.submenu) {
        item.submenu = item.submenu.map((item) => {
            return bindMenuClick(id, item);
        });
    } else if (item.type !== "submenu") {
        item.click = function () {
            sendProgramEvent("garden.tray.menu.clicked", {
                "id": id,
                "menu": item.id
            });
        };
    }

    return item;
};

const installHandlers = function (installer) {

    installer("garden.tray.install", installTrayIcon);
    installer("garden.tray.uninstall", uninstallTrayIcon);
    installer("garden.tray.icon", updateTrayIcon);
    installer("garden.tray.menu-item", updateTrayMenuItem);

};

const installTrayIcon = function ({
    id, icon, tooltip, menus
}, callback) {

    if (!id) { id = "default"; }

    if (trays[id]) {
        app.off("window-all-closed", trays[id].onWindowAllClosed);
        trays[id].destroy();
    }

    let tray = new Tray(icon);
    tray.onWindowAllClosed = () => {};

    const contextMenu = Menu.buildFromTemplate(menus.map((item) => {
        return bindMenuClick(id, item);
    }));

    tray.setToolTip(tooltip);
    tray.setContextMenu(contextMenu)

    tray.contextMenu = contextMenu;

    trays[id] = tray;

    app.on("window-all-closed", tray.onWindowAllClosed);

    callbackProgramResult(callback, undefined, id);

};

const uninstallTrayIcon = function (id, callback) {

    if (!id) { id = "default"; }

    if (trays[id]) {
        app.off("window-all-closed", trays[id].onWindowAllClosed);
        trays[id].destroy();
        delete trays[id];
    }

    callbackProgramResult(callback);

};

const updateTrayMenuItem = function ({
    id, config
}, callback) {

    if (!id) { id = "default"; }
    if (!trays[id]) { return; }

    let tray = trays[id];

    let updateItem = (item) => {

        let changed = null;
        if (item.id === config.id) {
            for (let key of ["enabled", "visible", "checked", "label"]) {
                if (!changed) { changed = {}; }
                changed[key] = config[key];
            }
            if (config.submenu) {
                if (!changed) { changed = {}; }
                changed.submenu = Menu.buildFromTemplate(config.submenu.map((item) => {
                    return bindMenuClick(id, item);
                }));
            }
        }

        if (item.submenu && 
            ((item.id !== config.id) || (!config.submenu))) {
            let itemsChanged = false;
            let items = [];
            for (let subitem of item.submenu.items) {
                let result = updateItem(subitem);
                items.push(result.item);
                if (result.changed) {
                    itemsChanged = true;
                }
            }
            if (itemsChanged) {
                if (!changed) { changed = {}; }
                changed.submenu = new Menu();
                for (let item of items) {
                    changed.submenu.append(item);
                }
            }
        }

        if (changed) {
            let newConfig = {
                "id": item.id, "type": item.type,
                "label": changed.label !== undefined ? changed.label : item.label,
                "enabled": changed.enabled !== undefined ? changed.enabled : item.enabled,
                "visible": changed.visible !== undefined ? changed.visible : item.visible,
            };
            if ((item.type === "checkbox") || (item.type === "radio")) {
                newConfig.checked = (changed.checked !== undefined) ? changed.checked : item.checked;
            };
            if (item.type === "submenu") {
                newConfig.submenu = [];
            }
            let newItem = new MenuItem(bindMenuClick(id, newConfig));
            if (changed.submenu) {
                for (let item of changed.submenu.items) {
                    newItem.submenu.append(item);
                }
            } else if (item.submenu) {
                for (let item of item.submenu.items) {
                    newItem.submenu.append(item);
                }
            }
            item = newItem;
        }

        return {
            "changed": changed ? true : false,
            "item": item
        };

    };

    let contextMenu = new Menu();
    for (let item of tray.contextMenu.items) {
        let newItem = updateItem(item).item;
        contextMenu.append(newItem);
    }

    tray.contextMenu = contextMenu;
    tray.setContextMenu(contextMenu);

    callbackProgramResult(callback);

};

const updateTrayIcon = function ({
    id, icon
}, callback) {

    if (!id) { id = "default"; }

    if (!trays[id]) {
        callbackProgramResult(callback);
    }

    trays[id].setImage(icon);

};

module.exports.installHandlers = installHandlers;
