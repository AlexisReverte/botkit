var Botkit = require('./lib/Botkit.js');


function sendWithoutChannelOpened(message) {
    console.log('Send without channel opened', message);
}




var controller = Botkit.websocketbot({
    debug: true,
    sendWithoutChannelOpened: sendWithoutChannelOpened,
    storage: require('./lib/storage/mongo_storage')()
});

var bot = controller.spawn({});

var express = require('express');
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
require('express-ws')(app);


app.listen(process.env.port || 3000, '0.0.0.0', function () {

    controller.setupWebserver(process.env.port || 3000, function (err, webserver) {
        controller.createWebhookEndpoints(webserver, bot, function () {
            console.log('*** Hell yeah ... i\'m online :)');
        });
    }, app);

})

controller.hears(['bonjour'], 'message_received', function (bot, message) {
    bot.startConversation(message, function (err, convo) {
        convo.say('Bonjour !');
        convo.ask('Comment vous appelez vous ?', function (response, convo) {
            convo.ask('Vous souhaitez que je vous appelle \'' + response.text + '\' ?', [{
                pattern: 'oui',
                callback: function (response, convo) {
                    convo.next();
                }
            }, {
                pattern: 'non',
                callback: function (response, convo) {
                    convo.stop();
                }
            }, {
                default: true,
                callback: function (response, convo) {
                    convo.repeat();
                    convo.next();
                }
            }]);
            convo.next();
        }, {
            'key': 'nickname'
        });

        convo.on('end', function (convo) {
            if (convo.status == 'completed') {
                bot.reply(message, 'OK! Je met à jour mon dossier...');

                bot.reply(message, 'Tout est en ordre ' + convo.extractResponse('nickname') + '.');


            } else {
                // this happens if the conversation ended prematurely for some reason
                bot.reply(message, 'OK, nevermind!');
            }
        });

    });
});
