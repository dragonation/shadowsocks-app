const extraScrollPadding = 20;

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
        "methods": [
            "none",
            "aes-128-cfb", "aes-192-cfb", "aes-256-cfb",
            "aes-128-cfb8", "aes-192-cfb8", "aes-256-cfb8",
            "aes-128-ctr", "aes-192-ctr", "aes-256-ctr",
            "camellia-128-cfb", "camellia-192-cfb", "camellia-256-cfb",
            "bf-cfb",
            "rc4", "rc4-md5", "rc4-md5-6",
            "salsa20", "xsalsa20",
            "chacha20", "xchacha20", "chacha20-ietf"
        ],
        "protocols": [
            "origin", "verify_deflate",
            "auth_sha1_v4", "auth_aes128_md5", "auth_aes128_sha1",
            "auth_chain_a", "auth_chain_b", "auth_chain_c",
            "auth_chain_d", "auth_chain_e", "auth_chain_f",
            "auth_akarin_rand", "auth_akarin_spec_a"
        ],
        "obfuscations": [
            "plain",
            "http_simple", "http_post", 
            "random_head", 
            "tls1.2_ticket_auth", "tls1.2_ticket_fastauth"
        ],
        "groups": [],
        "selected": null
    });

    $.ajax("/ssr/running", {
        "success": (result) => {


            if (!result) {
                $.ajax("/preferences/all", {
                    "success": (result) => {

                        if (!result.lastConnection) {
                            return;
                        }

                        let config = Object.assign({}, result.lastConnection, {
                            "id": JSON.stringify([result.lastConnection.group, result.lastConnection.name])
                        });

                        this.filler.fill({
                            "selected": config
                        });

                        this.scrollToConfig(config);

                    },
                    "error": (request) => {
                        console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
                    }
                })
                return;
            }

            let config = Object.assign({}, result.config, {
                "id": JSON.stringify([result.config.group, result.config.name])
            });

            this.filler.fill({
                "connected": config,
                "selected": config
            });

            this.scrollToConfig(config);

        },
        "error": (request) => {
            console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
        }
    });

    this.updateList(true);

};

App.prototype.onKeyPressed = function (event) {};

App.prototype.updateEditingURL = function () {

    let editing = this.filler.parameters.modification;
    if (!editing) {
        editing = this.filler.parameters.selected;
    } else if (this.filler.parameters.selected) {
        editing = Object.assign({}, this.filler.parameters.selected, editing);
    }

    if (!editing) {
        this.filler.fill({
            "editingURL": ""
        });
        return;
    }

    $.ajax("/uris/url", {
        "data": editing,
        "success": (url) => {
            this.filler.fill({
                "editingURL": url
            });
        },
        "error": (request, error, message) => {
            console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
        }
    })

};

App.prototype.scrollToConfig = function (config) {

    let groups = this.filler.parameters.groups;
    if (groups && (groups.length > 0)) {
        let sectionIndex = -1; 
        let cellIndex = -1;
        for (let looper = 0; looper < groups.length; ++looper) {
            for (let looper2 = 0; looper2 < groups[looper].configs.length; ++looper2) {
                if (groups[looper].configs[looper2].id === config.id) {
                    sectionIndex = looper;
                    cellIndex = looper2;
                }
            }
        }
        if (sectionIndex !== -1) {
            this.filler.query("#list")[0].scrollToCell(sectionIndex, cellIndex, extraScrollPadding);
        }
    }

};

App.prototype.updateList = function (scrollToSelected) {

    $.ajax("/uris/list", {
        "success": (uris) => {

            let maught = false;
            let selected = this.filler.parameters.selected;

            let groups = Object.create(null);
            for (let uri of uris) {
                let group = uri.group;
                if (!group) { group = ""; }
                if (!groups[group]) {
                    groups[group] = [];
                }
                if (selected && 
                    (selected.group === uri.group) && 
                    (selected.name === uri.name)) {
                    maught = true;
                }
                groups[group].push(uri);
            }

            if (selected && (!maught)) {
                // for those selected configs which is not available in the new versions
                if (!groups[selected.group]) {
                    groups[selected.group] = [];
                }
                groups[selected.group].push(selected);
            }

            let groupList = Object.keys(groups).sort().map((key) => {
                return {
                    "name": key,
                    "configs": groups[key].slice(0).sort((a, b) => {
                        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                    }).map((item) => {
                        let group = item.group;
                        if (!group) { group = ""; }
                        item.id = JSON.stringify([group, item.name]);
                        return item;
                    })
                };
            });

            if (!selected) {
                if (this.filler.parameters.connected) {
                    selected = this.filler.parameters.connected;
                } else {
                    if (groupList.length > 0) {
                        selected = groupList[0].configs[0];
                    }
                }
                scrollToSelected = true;
            } else {
                // TODO: rescroll to selected if it is visible before updates
            }

            this.filler.fill({
                "selected": selected,
                "formVersion": $.uuid(),
                "groups": groupList
            });

            this.updateEditingURL();

            if (scrollToSelected && this.filler.parameters.selected) {
                this.scrollToConfig(this.filler.parameters.selected);
            }

        },
        "error": (request, error, message) => {
            console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
        }
    });

};

App.prototype.title = "Shadowsocks (Don't forget to hide or wipe your secrets and QR code image while taking screenshots)";

App.prototype.handlers = {
    "ssr.connected": function (message) {
        this.filler.fill({
            "connected": Object.assign({}, message.content.config, {
                "id": JSON.stringify([message.content.config.group, message.content.config.name])
            })
        });
    },
    "ssr.disconnected": function (message) {
        let id = JSON.stringify([message.content.config.group, message.content.config.name]);
        if (this.filler.parameters.connected && 
            (this.filler.parameters.connected.id === id)) {
            this.filler.fill({
                "connected": null
            });
        }
    },
    "ssr.subscription.added-updated": function () {
        this.updateList();
    },
    "ssr.subscription.updated": function () {
        this.updateList();
    },
    "ssr.uri.imported": function () {
        this.updateList();
    },
    "ssr.uri.deleted": function () {
        this.updateList();
    },
    "ssr.uri.modified": function () {
        this.updateList();
    }
};

App.functors = {

    "escape": function (url) {

        return encodeURIComponent(url);

    },

    "selectConfig": function (group, item) {

        if (this.filler.parameters.selected &&
            (this.filler.parameters.selected.id === item.id)) {
            return;
        }

        if (this.filler.parameters.modification) {
            let confirmed = confirm("There are some modifications on the selected config. Are you sure to drop the modifications?");
            if (!confirmed) {
                return;
            }
        }
        if (window.garden) {
            window.garden.unlockClose(this.id);
        }

        this.filler.fill({
            "modification": null,
            "selected": item,
            "formVersion": $.uuid(),
            "editingURL": ""
        });

        this.updateEditingURL();

    },

    "updateModification": function (name, parameter) {

        let modification = this.filler.parameters.modification;
        if (!modification) {
            modification = Object.assign({}, this.filler.parameters.selected);
        }

        modification[name] = parameter.value;

        let hasModifications = modification["new"];
        for (let name in modification) {
            if (modification[name] !== this.filler.parameters.selected[name]) {
                hasModifications = true;
            }
        }

        if (hasModifications) {
            if (window.garden) {
                window.garden.lockClose(this.id, () => {
                    let confirmed = confirm("There are some modifications on the selected config. Are you sure to drop the modifications?");
                    if (!confirmed) {
                        return;
                    }
                    if (window.garden) {
                        window.garden.unlockClose(this.id);
                    }
                    window.close();
                });
            }
            this.filler.fill({
                "modification": modification
            });
        } else {
            if (window.garden) {
                window.garden.unlockClose(this.id);
            }
            this.filler.fill({
                "modification": null
            });
        }

        this.updateEditingURL();

    },

    "deleteConfig": function (config) {

        let confirmed = false;
        if (this.filler.parameters.selected && 
            this.filler.parameters.modification && 
            (config.id === this.filler.parameters.selected.id)) {
            confirmed = confirm("You have some modifications on the config. Are you sure to drop them and delete the config?");
        } else {
            confirmed = confirm("Are you sure to delete the config?");
        }

        if (!confirmed) {
            return;
        }

        let raw = null;
        let indices = [];
        let group = this.filler.parameters.groups.filter((item, index) => {
            if (item.name === config.group) {
                indices[0] = index;
                return true;
            }
            return false;
        })[0];
        if (group) {
            raw = group.configs.filter((item, index) => {
                if (item.name === config.name) {
                    indices[1] = index;
                    return true;
                }
                return false;
            })[0];
        }

        if (raw && raw.source) {
            confirmed = confirm("The config you wanted to delete is imported from a subscription, " +
                                "which means it will be recovered after an update of subscriptions. " + 
                                "Are you really want to delete the config?");
        }
        if (!confirmed) {
            return;
        }

        $.ajax("/uris/delete", {
            "data": config,
            "success": () => {

                let selectionChanged = false;

                let next = null;
                if (raw && this.filler.parameters.selected && 
                    (raw.id === this.filler.parameters.selected.id)) {
                    next = group.configs[indices[1] + 1];
                    if (!next) {
                        next = group.configs[indices[1] - 1];
                    }
                    if (!next) {
                        let nextGroup = this.filler.parameters.groups[indices[0] + 1];
                        if (nextGroup) {
                            next = nextGroup.configs[0];
                        } else {
                            let previousGroup = this.filler.parameters.groups[indices[0] - 1];
                            if (previousGroup) {
                                next = previousGroup.configs[previousGroup.configs.length - 1];
                            }
                        }
                    }
                    selectionChanged = true;
                } else {
                    next = this.filler.parameters.selected;
                }

                this.filler.fill({
                    "selected": next,
                    "formVersion": $.uuid(),
                    "modification": null
                });

                this.updateList(selectionChanged);

            },
            "error": (request) => {
                console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
                alert(`Failed to delete the config “${config.name}”`);
            }
        })

    },

    "cancelModifications": function () {

        if (window.garden) {
            window.garden.unlockClose(this.id);
        }
        this.filler.fill({
            "formVersion": $.uuid(),
            "modification": null
        });

    },
    "testModifications": function () {

        let modification = Object.assign({}, 
                                         this.filler.parameters.selected, 
                                         this.filler.parameters.modification);

        $.ajax({
            "url": "ssr/test",
            "data": modification,
            "timeout": 30000,
            "success": (result) => {
                if (result.succeeded) {
                    alert("The modification is workable!");
                } else {
                    alert(`There maybe some incorrects: ${result.reason}`);
                }
            },
            "error": (request) => {
                console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
                alert(`Failed to test the config “${this.filler.parameters.selected.name}”`);
            }
        });

    },
    "saveModifications": function () {

        let modification = Object.assign({}, 
                                         this.filler.parameters.selected, 
                                         this.filler.parameters.modification);

        let raw = null;
        let group = this.filler.parameters.groups.filter((item) => {
            return item.name === modification.group;
        })[0];
        if (group) {
            raw = group.configs.filter((item) => {
                return item.name === modification.name;
            })[0];
            if (raw) {
                modification.source = raw.source;
            }
        }

        let newID = JSON.stringify([modification.group, modification.name]);
        if (newID !== modification.id) {
            if (raw) {
                alert("Conflicted config with the same group and name, please give a new name or group");
                return;
            }
        }

        let old = this.filler.parameters.selected;

        if (raw && raw.source) {
            let confirmed = confirm("The config modified is initially from a subscription, " + 
                                    "which means it will be recovered after an update of subscriptions. " + 
                                    "A new duplicate is suggested to make the modification. " + 
                                    "Do you need to make a new duplicate for modification?");
            if (confirmed) {
                if (newID === modification.id) {
                    let group = modification.group;
                    let actualGroup = this.filler.parameters.groups.filter((item) => {
                        return item.name === group;
                    })[0];
                    let newName = undefined;
                    if (actualGroup) {
                        let index = 2;
                        let config = undefined;
                        do {
                            newName = modification.name + (index === 1 ? "" : " " + index);
                            config = actualGroup.configs.filter((item) => {
                                return item.name === newName;
                            })[0];
                            ++index;
                        } while (config);
                    } else {
                        newName = modification.name;
                    }
                    old = null;
                    modification = Object.assign({}, modification, {
                        "group": group,
                        "name": newName,
                        "source": null
                    });
                }
            }
        }

        $.ajax({
            "url": "uris/modify",
            "data": {
                "old": JSON.stringify(old),
                "new": JSON.stringify(modification)
            },
            "success": (result) => {
                this.filler.fill({
                    "modification": null,
                    "formVersion": $.uuid(),
                    "selected": Object.assign({}, modification, {
                        "id": JSON.stringify([modification.group, modification.name])
                    })
                });
                this.updateList(true);
            },
            "error": (request) => {
                console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
                alert(`Failed to modify the config “${this.filler.parameters.selected.name}”`);
            }
        });

    },

    "showAddActionList": function (event) {

        let actions = [];

        actions.push({ "text": "Create empty config", "action": () => {

            let name = "untitled";
            let index = 1;
            let group = this.filler.parameters.groups.filter((group) => group.name === "")[0];
            if (group) {
                while (group.configs.filter((config) => config.name === name)[0]) {
                    ++index;
                    name = "untitled " + index;
                }
            }

            this.filler.fill({
                "selected": {
                    "type": "ssr",
                    "group": "",
                    "name": name,
                    "id": JSON.stringify(["", name]),
                    "server": "localhost",
                    "port": 457,
                    "method": "none",
                    "password": "",
                    "protocol": "origin",
                    "protocolParameters": "",
                    "obfuscation": "plain",
                    "obfuscationParameters": ""
                },
                "modification": {
                    "new": true
                }
            });

            this.updateEditingURL();

        } });

        if (this.filler.parameters.selected) {
            actions.push({ "text": "Duplicate the config selected", "action": () => {

                let source = this.filler.parameters.selected;

                let group = source.group;

                let actualGroup = this.filler.parameters.groups.filter((item) => {
                    return item.name === group;
                })[0];

                let newName = undefined;
                if (actualGroup) {
                    let index = 1;
                    let config = undefined;
                    do {
                        newName = source.name + (index === 1 ? "" : " " + index);
                        config = actualGroup.configs.filter((item) => {
                            return item.name === newName;
                        })[0];
                        ++index;
                    } while (config);
                } else {
                    newName = source.name;
                }

                let newRecord = Object.assign({}, source, {
                    "name": newName,
                    "id": JSON.stringify(source.group, newName),
                    "source": null
                });

                this.filler.fill({
                    "selected": newRecord,
                    "modification": {
                        "new": true
                    } 
                });

            } });
        }

        actions.push({ "text": "Import from clipboard", "action": () => {

            $.ajax("/uris/import-from-clipboard", {
                "success": (result) => {

                    let texts = [];
                    if (result.adds.length) { texts.push(`added: ${result.adds.map(item => item.name).join(", ")}`); }
                    if (result.updates.length) { texts.push(`updated: ${result.updates}`); }
                    if (result.fakes.length) { texts.push(`ignored: ${result.fakes}`); }
                    if (texts.length === 0) {
                        texts.push("No config changeds");
                    }

                    let text = texts.join("; ");
                    text = text[0].toUpperCase() + text.slice(1);

                    alert(text);

                    this.updateList();

                },
                "error": (error) => {
                    alert("Import failed");
                }
            })

        } });

        // actions.push({ "text": "Import QRCode from screenshot", "action": () => {} });
        // actions.push({ "text": "Import from camera", "action": () => {} });
        // actions.push({ "text": "Import from local file", "action": () => {} });

        actions.push({ "text": "Add from subscription URL", "action": () => {

            $.ajax({
                "url": "/uris/import-subscription",
                "data": {
                    "parent": "shadowsocks"
                },
                "error": () => {
                    alert("Failed to import");
                }
            });

        } });

        this.showActionList(actions, event.target);

    },

    "disconnectSelectedConfig": function () {

        $.ajax({
            "url": "/ssr/disconnect",
            "success": (result) => {},
            "error": (request) => {
                console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
            }
        })

    },

    "connectSelectedConfig": function () {

        let selected = this.filler.parameters.selected;
        if (this.filler.parameters.connected && 
            (selected.id === this.filler.parameters.connected.id)) {
            return;
        }

        if (this.filler.parameters.modification) {
            alert("Config containing modifications could not connect directly");
            return;
        }

        $.ajax({
            "url": "/ssr/connect",
            "data": {
                "type": selected.type,
                "group": selected.group,
                "name": selected.name,
                "server": selected.server,
                "port": selected.port,
                "method": selected.method,
                "password": selected.password,
                "protocol": selected.protocol,
                "protocolParameters": selected.protocolParameters,
                "obfuscation": selected.obfuscation,
                "obfuscationParameters": selected.obfuscationParameters,
            },
            "success": (result) => {},
            "error": (request, error, message) => {
                console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
            }
        });
    },

    "connectSelectedConfig": function () {

        let selected = this.filler.parameters.selected;
        if (this.filler.parameters.connected && 
            (selected.id === this.filler.parameters.connected.id)) {
            return;
        }

        $.ajax({
            "url": "/ssr/connect",
            "data": {
                "type": selected.type,
                "group": selected.group,
                "name": selected.name,
                "server": selected.server,
                "port": selected.port,
                "method": selected.method,
                "password": selected.password,
                "protocol": selected.protocol,
                "protocolParameters": selected.protocolParameters,
                "obfuscation": selected.obfuscation,
                "obfuscationParameters": selected.obfuscationParameters,
            },
            "success": (result) => {},
            "error": (request, error, message) => {
                console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
            }
        });

    },

    "saveQRCode": function () {

        let selected = this.filler.parameters.selected;
        if (!selected) {
            return;
        }

        $.ajax({
            "url": "/ssr/save-qr-code",
            "data": {
                "window": "shadowsocks",
                "type": selected.type,
                "group": selected.group,
                "name": selected.name,
                "server": selected.server,
                "port": selected.port,
                "method": selected.method,
                "password": selected.password,
                "protocol": selected.protocol,
                "protocolParameters": selected.protocolParameters,
                "obfuscation": selected.obfuscation,
                "obfuscationParameters": selected.obfuscationParameters,
            },
            "success": () => {},
            "error": (request) => {
                console.error(`HTTP error status[${request.status}]: ${request.responseText}`);
                alert("Save failed");
            }
        })

    },

    "copyURIToClipboard": function () {

        garden.handleCommand("garden.clipboard.set", {
            "text/plain": Buffer.from(this.filler.parameters.editingURL, "utf8").toString("base64")
        }, (error) => {
            if (error) {
                console.error(error);
            }
        })

    }

};

module.exports.App = App;
