const { 
    app, 
    protocol,
    BrowserWindow,
    Menu
} = require("electron");

const main = async function () {

    const fs = require("fs");

    protocol.registerSchemesAsPrivileged([
        { "scheme": "garden", "privileges": { "standard": true, "secure": true } }
    ]);

    await app.whenReady();

    Menu.setApplicationMenu(null);

    const { 
        resolveProgramID, 
        startupProgram, 
        getProgramCommandLine,
        sendProgramStartedEvent
    } = require("./program.js");

    app.name = resolveProgramID();

    app.on("second-instance", (event, commandLine, workingDirectory) => {
        app.focus();
        sendProgramStartedEvent(commandLine, workingDirectory);
    });

    if (!app.requestSingleInstanceLock()) {
        app.quit(); 
        return;
    }

    await startupProgram();

    sendProgramStartedEvent(getProgramCommandLine(), process.cwd());

};

main().catch((error) => {

    const logger = require("./logger.js");

    logger.error(error);

    let dialog = require("./dialog.js").showErrorDialog(error);
    dialog.on("closed", () => {
        app.exit(1);
    });

});
