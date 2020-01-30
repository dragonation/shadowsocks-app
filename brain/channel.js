let channels = Object.create(null);

const channelTimeout = 10 * 60 * 1000;

@servlet.get("/channel", function (request, response) {

    this.break();

    let id = request.form.id;
    if (!id) {
        return response.reject(400);
    }

    if (!channels[id]) {
        channels[id] = {
            "id": id,
            "active": Date.now(),
            "queue": []
        };
    }

    response.setTimeout(5 * 60 * 1000);

    return @.async(function () {

        if (channels[id].sender) {
            channels[id].sender.timeout();
        }

        let channel = channels[id];

        channel.sender = {
            "timeout": () => {
                delete channel.sender;
                response.reject(408).pipe(this);
            },
            "send": () => {
                delete channel.sender;
                channel.active = Date.now();
                let queue = channel.queue.slice(0);
                channel.queue.length = 0;
                response.headers["Content-Type"] = "application/json";
                response.send(queue).pipe(this);
            }
        };

        if (channel.queue.length > 0) {
            scheduleSends();
        }

    });

});

const listenMew = function (usage, type) {

    @heard(usage).then(function (mew) {

        let content = mew.content[type ? type : usage];
        for (let key in channels) {
            if (Date.now() - channels[key].active > channelTimeout) {
                if (channels[key].sender) {
                    try {
                        channels[key].sender.timeout();
                    } catch (error) {
                        @error(error);
                    }
                }
                delete channels[key];
            } else {
                channels[key].queue.push({
                    "usage": mew.usage,
                    "content": content
                });
            }
        }

        scheduleSends();

    });

};

let sending = false;
const scheduleSends = function () {

    if (sending) { return; }
    sending = true;

    @.delay(() => {

        try {
            for (let key in channels) {
                if ((channels[key].queue.length > 0) && channels[key].sender) {
                    try {
                        channels[key].sender.send();
                    } catch (error) {
                        @error(error);
                    }
                }
            }
        } catch (error) {
            @error(error);
        }

        sending = false;

    });

};

listenMew("ssr.connected");
listenMew("ssr.disconnected");

listenMew("ssr.subscription.updated");
listenMew("ssr.subscription.added-updated");

listenMew("ssr.uri.deleted");
listenMew("ssr.uri.modified");
listenMew("ssr.uri.imported");

listenMew("ssr.preferences.updated");
