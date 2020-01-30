(function () {

    const currentWindow = require("electron").remote.getCurrentWindow();

    const templateData = currentWindow.templateData;

    const evalute = function (code, data) {

        let components = code.split(".");
        let value = data;
        for (let key of components) {
            if (value) {
                value = value[key];
            }
        }

        return value;

    };

    const parseFor = function (node, data) {

        let children = Array.prototype.slice.call(node.childNodes, 0);

        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }

        let list = evalute(node.getAttribute("list"), data);
        if (list) {
            let itemName = node.getAttribute("item-name");
            if (!itemName) { itemName = "item"; }

            let indexName = node.getAttribute("index-name");
            if (!indexName) { indexName = "index"; }

            for (let looper = 0; looper < list.length; ++looper) {
                for (let child of children) {
                    child = child.cloneNode(true);
                    parseNode(child, Object.assign({}, data, {
                        [itemName]: list[looper],
                        [indexName]: looper
                    }));
                    node.parentNode.insertBefore(child, node);
                }
            }
        }

        node.parentNode.removeChild(node);

    };

    const parseText = function (node, data) {

        let code = node.getAttribute("code");

        let text = document.createTextNode("");

        let value = evalute(code, data);
        if (value) {
            text.nodeValue = value;
        }

        node.parentNode.insertBefore(text, node);

        node.parentNode.removeChild(node);

    };

    const parseIf = function (node, data) {

        let test = evalute(node.getAttribute("test"), data);
        if (!test) {
            node.parentNode.removeChild(node); return;
        }

        let children = Array.prototype.slice.call(node.childNodes, 0);

        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }

        for (let child of children) {
            child = child.cloneNode(true);
            parseNode(child, data);
            node.parentNode.insertBefore(child, node);
        }

        node.parentNode.removeChild(node);

    };

    const parseNode = function (node, data) {

        let templateData = {};

        if (node.getAttributeNames) {
            for (let name of node.getAttributeNames()) {
                if (name.toLowerCase().slice(0, 5) === "data-") {
                    templateData[name.slice(5)] = evalute(node.getAttribute(name), data);
                }
            }
        }

        node.templateData = data;

        for (let child of node.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                let name = child.localName.toLowerCase();
                switch (name) {
                    case "for": { parseFor(child, data); break; }
                    case "if": { parseIf(child, data); break; }
                    case "text": { parseText(child, data); break; }
                    default: { parseNode(child, data); break; }
                }
            }
        }

    };

    window.addEventListener("load", function () {
        if (templateData.app) {
            document.title = templateData.app;
        }
        parseNode(document.body, templateData);
    });

})();
