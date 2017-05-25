var Botkit = require(__dirname + '/CoreBot.js');
var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');



function WebSocketBot(configuration) {
    var websocket_botkit = Botkit(configuration || {});

    var chats = {};

    websocket_botkit.defineBot(function (botkit, config) {
        var bot = {
            type: 'websocket',
            botkit: botkit,
            config: config || {},
            utterances: botkit.utterances
        };

        bot.startConversation = function (message, cb) {
            botkit.startConversation(this, message, cb);
        };

        bot.findConversation = function (message, cb) {
            // botkit.debug('CUSTOM FIND CONVO', message.user);
            for (var t = 0; t < botkit.tasks.length; t++) {
                for (var c = 0; c < botkit.tasks[t].convos.length; c++) {
                    if (botkit.tasks[t].convos[c].isActive() && botkit.tasks[t].convos[c].source_message.user == message.user) {
                        botkit.debug('FOUND EXISTING CONVO!');

                        if (message.delete_previous === true) {
                            botkit.tasks[t].convos[c].stop();
                            cb();
                        } else {

                            cb(botkit.tasks[t].convos[c]);
                        }
                        return;
                    }
                }
            }
            cb();
        };

        bot.send = function (message, cb) {

            botkit.debug('*** List of chats that are opened' + Object.keys(chats).join(','));

            if (chats[message.user]) {
                botkit.debug('*** SEND VIA WS', JSON.stringify(message));

                if (configuration.send) {
                    configuration.send(chats[message.user].ws.send, message);
                } else {
                    chats[message.user].ws.send(JSON.stringify(message));
                }
            } else {
                botkit.debug('*** Send to callback because there is no local socket opened for user ' + JSON.stringify(message));
                if (configuration.sendWithoutChannelOpened) {
                    configuration.sendWithoutChannelOpened(message);
                }
            }

            if (cb) {
                cb(null);
            }
        };

        bot.reply = function (src, resp, cb) {
            var message = {};
            if (typeof resp === 'string') {
                message.text = resp;
                message.channel = src.channel;
                message.sent_timestamp = Date.now();
            } else {
                message = resp;
            }
            message.user = src.user;
            bot.say(message, cb);
        };

        return bot;
    });

    websocket_botkit.setupWebserver = function (port, cb, appinstance) {
        if (!port) {
            throw new Error('Cannot start webserver without a port');
        }

        if (!appinstance) {
            appinstance = express();
            require('express-ws')(appinstance);
            websocket_botkit.config.port = port;
            websocket_botkit.webserver = appinstance;
            websocket_botkit.webserver.use(bodyParser.json());
            websocket_botkit.webserver.use(bodyParser.urlencoded({
                extended: true
            }));

            websocket_botkit.webserver.listen(websocket_botkit.config.port, websocket_botkit.config.hostname, function () {
                websocket_botkit.log('** Starting webserver on port ' + websocket_botkit.config.port);
                if (cb) {
                    cb(null, websocket_botkit.webserver);
                }
            });

        } else {
            websocket_botkit.log('app is defined in params, using it');
            websocket_botkit.config.port = port;
            websocket_botkit.webserver = appinstance;

            if (cb) {
                cb(null, websocket_botkit.webserver);
            }
        }


        return websocket_botkit;
    };

    websocket_botkit.createWebhookEndpoints = function (webserver, bot, cb) {

        websocket_botkit.log('** Serving webhook endpoints for WebSocket at: ' + 'ws://' + websocket_botkit.config.hostname + ':' + websocket_botkit.config.port + '/botkit');
        // Add WebSocket route
        webserver.ws('/botkit/:userId', function (ws, req) {
            chats[req.params.userId] = {
                ws: ws,
                req: req
            };

            ws.on('message', function (msg) {
                websocket_botkit.log('Received message for user ' + req.params.userId, msg);
                websocket_botkit.handleChatPayload(msg, req, bot);
            });
            ws.on('close', function () {
                websocket_botkit.log('Connection closes for user ' + req.params.userId);
                delete chats[req.params.userId];
            });

            if (configuration.onConnected) {

                var message = {
                    user: req.params.userId,
                    channel: req.params.userId,
                    messageTimestamp: Date.now(),
                    text: 'connected'
                };

                for (var key in req.query) {
                    if (!message[key]) {
                        message[key] = req.query[key];
                    }
                }
                configuration.onConnected(bot, message);
            }
        });


        if (cb) {
            cb();
        }

        websocket_botkit.startTicking();
        return websocket_botkit;
    };

    websocket_botkit.handleChatPayload = function (params, req, bot) {
        try {
            var message = JSON.parse(params);

            message.user = req.params.userId;
            message.channel = req.params.userId;
            message.messageTimestamp = Date.now();

            websocket_botkit.receiveMessage(bot, message);
        } catch (e) {
            websocket_botkit.log('Error with sent message', e);
        }
    };

    return websocket_botkit;
};

module.exports = WebSocketBot;
