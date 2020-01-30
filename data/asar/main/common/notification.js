const { Notification } = require("electron");

const installHandlers = function (installer) {

    installer("garden.notification.supported", isNotificationSupported);

    installer("garden.notification.create", createNotification);

};

const isNotificationSupported = function (content, callback) {

    callbackProgramResult(callback, undefined, Notification.isSupported());

};

const createNotification = function ({
    title, body, icon
}, callback) {

    let notification = new Notification({
        "title": title,
        "body": body ? body : "",
        "icon": icon
    });

    notification.show();

};

module.exports.installHandlers = installHandlers;
