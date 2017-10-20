var Discord = require('discord.io');
var logger = require('winston');
var auth = require ('./auth.json');
var config = require ('./config.json');
var ns = require ('./notifications.json');
var fs = require ('fs');
var times = require ("./times.json");


logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

var isDead = false;

var bot = new Discord.Client({
    token: auth.token,
    autorun: true
});

bot.getAllUsers();

var spams = {};

var spam = function () {
    if (!global.isDead) {
        for (var i in spams) {
            var t = 'Here you go!';
            for (var j = 0; j < spams[i].length; j++) {
                t += ' <@'+spams[i][j]+'>';
            }
            if (t !== 'Here you go!') {
                bot.sendMessage({
                    to: i,
                    message: t
                });
            }
        }
        setTimeout(spam, 1000);
    }
};

var checkReminders = function () {
    for (var i = 0; i < ns.length; i++) {
        if (!ns[i][3] && (Date.now() / 1000) - ns[i][0] >= 0) {
            ns[i][3] = true;
            bot.sendMessage({
                to: ns[i][4],
                message: "<@"+ns[i][2]+">! Don't forget: "+ns[i][1]
            });
        }
    }
    fs.writeFileSync("./notifications.json", JSON.stringify(ns, null, 4), console.log);

    setTimeout(checkReminders, 1000);
}

bot.on('ready', function (evt) {
    checkReminders();
    spam();
    logger.info('Connected');
    logger.info('Logged in as: '+bot.username + ' - ('+bot.id+')');
    bot.setPresence({
        idle_since: null,
        game: {
            name: "say @notify help"
        }
    });
});

var uid = function (t) {
    return t.substr(2, t.length-3);
}

bot.on('message', function (user, userID, channelID, message, evt) {
    if (message.substring(0,7).toLowerCase() == '@notify') {
        var args = message.substring(8).split(' ');
        var cmd = args[0];

        if (isDead && auth.admins.indexOf(userID) >= 0) {
            bot.sendMessage({
                to: channelID,
                message: "You're not strong enough!"
            });
        }
        if (isDead && auth.admins.indexOf(userID) >= 0 && 
            (
                cmd !== 'revive' &&
                cmd !== 'die'
            )
        ) {
            bot.sendMessage({
                to: channelID,
                message: "*ded*"
            });
            return;
        }
        if (!times[cmd]) times[cmd] = 0;
        times[cmd] += 1;
        fs.writeFileSync("./times.json", JSON.stringify(times, null, 4));

        switch (cmd.toLowerCase()) {
            case 'ping':
                bot.sendMessage({
                    to: channelID,
                    message: '<@'+userID+'>'+' Pong!'
                });
            break;

            case 'spam':
                var u = args[1];
                u = u.substr(2, u.length-3);
                if (!spams[channelID]) spams[channelID] = [];
                spams[channelID].push(u);
                bot.sendMessage({
                    to: channelID,
                    message: "Prepare yourselves!"
                });
            break;

            case 'spamstop' :
                if (args.length == 1) {
                    spams[channelID] = [];
                    bot.sendMessage({
                        to: channelID,
                        message: "Spamming stopped for channel"
                    });
                } else {
                    var u = args[1];
                    u = u.substr(2, u.length-3);
                    spams[channelID].splice(spams[channelID].indexOf(u), 1);
                    bot.sendMessage({
                        to: channelID,
                        message: "Spamming stopped"
                    });
                }
            break;  

            case 'remind' :
                if (args.slice(1,3).join(" ").match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2})(\d{2})/)) {
                    var reminder = args.slice(3).join(" ");
                    var data = args.slice(1,3).join(" ").match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2})(\d{2})/);
                    data.shift();
                    data = data.map((v, _, _1) => parseInt(v, 10));
                    date = new Date(data[0], data[1]-1, data[2], data[3], data[4]);
                    var ds = date.toLocaleString();
                    var id = ns.length;
                    ns.push([date.getTime() / 1000, reminder, userID, false, channelID]);
                    bot.sendMessage({
                        to: channelID,
                        message: "Reminder '"+reminder+"' set for "+ds+" (ID "+id+")"
                    });
                    fs.writeFileSync("./notifications.json", JSON.stringify(ns, null, 4), console.log);
                } else {
                    bot.sendMessage({
                        to: channelID,
                        message: "Please format your date like so: `YYYY/MM/DD HHMM` (With the 24 hour clock)"
                    });
                }
            break;

            case 'remindother' :
                if (auth.admins.indexOf(userID) >= 0) {
                    if (args.slice(2,4).join(" ").match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2})(\d{2})/)) {
                        var reminder = args.slice(4).join(" ");
                        var data = args.slice(2,4).join(" ").match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2})(\d{2})/);
                        data.shift();
                        data = data.map((v, _, _1) => parseInt(v, 10));
                        date = new Date(data[0], data[1]-1, data[2], data[3], data[4]);
                        var ds = date.toLocaleString();
                        var id = args[3].substr(2, args[3].length-3);
                        ns.push([date.getTime() / 1000, reminder, id, false, channelID]);
                        id = ns.length;
                        bot.sendMessage({
                            to: channelID,
                            message: "Reminder '"+reminder+"' set for "+ds+" (ID "+id+")"
                        });
                        fs.writeFileSync("./notifications.json", JSON.stringify(ns, null, 4), console.log);
                    } else {
                        bot.sendMessage({
                            to: channelID,
                            message: "Please format your date like so: `YYYY/MM/DD HHMM` (With the 24 hour clock)"
                        });
                    }
                } else {
                    bot.sendMessage({
                        to: channelID,
                        message: "You're not strong enough!"
                    })
                }
            break;

            case 'setmain' : 
                if (auth.admins.indexOf(userID) >= 0) {
                    config.mainChannel = channelID;
                    fs.writeFile("./config.json", JSON.stringify(config, null, 4), () => {
                        bot.sendMessage({
                            to: channelID,
                            message: "Set main channel!"
                        })
                    });
                } else {
                    bot.sendMessage({
                        to: channelID,
                        message: "You're not strong enough!"
                    })
                }
            break;

            case 'forget' :
                if (args[1]) {
                    var id = args[1];
                    var n = ns[id];
                    if (n[2] == userID || auth.admins.indexOf(userID) >= 0) {
                        ns[id][3] = true;
                        bot.sendMessage({
                            to: channelID,
                            message: "Forgotten!"
                        });
                        fs.writeFileSync("./notifications.json", JSON.stringify(ns, null, 4), console.log);
                    } else {
                        bot.sendMessage({
                            to: channelID,
                            message: "You can't forget that which isn't yours to forget"
                        });
                    }
                } else {
                    bot.sendMessage({
                        to: channelID,
                        message: "I forgot what to forget"
                    });
                }
            break;

            case 'reminders' :
                bot.sendMessage({
                    to: channelID,
                    message: "Here are your active reminders:"
                }, function () {;
                    for (var i = 0; i < ns.length; i++){
                        if (ns[i][2] == userID && !ns[i][3]) {
                            bot.sendMessage({
                                to:channelID,
                                message: (new Date(1000 * ns[i][0])).toLocaleString()+": "+ns[i][1]+" (ID "+i+")"
                            })
                        }
                    }
                });
            break;

            case 'addadmin' : 
                if (auth.admins.indexOf(userID) >= 0) {
                    auth.admins.push(uid(args[1]));
                    bot.sendMessage({
                        to: channelID,
                        message: "Added the admin"
                    });
                    fs.writeFileSync("./auth.json", JSON.stringify(auth, null, 4));
                } else {
                    bot.sendMessage({
                        to: channelID,
                        message: "You're not strong enough"
                    });
                }
            break;

            case 'removeadmin' :
                if (auth.admins.indexOf(userID) >= 0) {
                    auth.admins.splice(auth.admins.indexOf(uid(args[1])), 1);
                    bot.sendMessage({
                        to: channelID,
                        message: "Removed admin"
                    });
                    fs.writeFileSync("./auth.json", JSON.stringify(auth, null, 4));
                } else {
                    bot.sendMessage({
                        to: channelID,
                        message: "You're not strong enough"
                    });
                }
            break;

            case 'listadmins' :
                bot.sendMessage({
                    to: channelID,
                    message: "OK!"
                }, function () {
                    for (var i = 0; i < auth.admins.length; i++) {
                        bot.sendMessage({
                            message: bot.users[auth.admins[i]].username,
                            to: channelID
                        })
                    }
                });
            break;

            case 'die' :
                if (isDead && userID == '192688519045578762') {
                    bot.sendMessage({
                        message:"*splat*",
                        to:channelID
                    });
                    setTimeout(cleanup, 500);
                } else {
                    bot.sendMessage({
                        to: channelID,
                        message: "Nooo!!!"
                    });
                    setTimeout (function () {
                        bot.sendMessage({
                            to: channelID,
                            message: "No!"
                        }); 
                        setTimeout (function () {
                            bot.sendMessage({
                                to: channelID,
                                message: "No..."
                            });
                            if (userID == '192688519045578762') {
                                setTimeout(function () {
                                    bot.sendMessage({
                                        to:channelID,
                                        message: "*ded*"
                                    });
                                    isDead = true;
                                    try {
                                        bot.setPresence({
                                            idle_since: Date.now() - 1000,
                                            game : {
                                                name : "say @notify revive"
                                            }
                                        });
                                    } catch (e) {
                                        console.log(e);
                                    }
                                }, 500);
                            } else {
                                setTimeout(function () {
                                    bot.sendMessage({
                                        to: channelID,
                                        message: "Your attacks weren't strong enough!"
                                    });
                                }, 500);
                            }
                        }, 500);
                    }, 500);
                }
            break;

            case 'revive' :
                if (auth.admins.indexOf(userID) >= 0) {
                    bot.sendMessage({
                        to:channelID,
                        message: isDead?"Revived!":"Already alive?"
                    });
                    isDead = false;
                    bot.setPresence({
                        idle_since: null,
                        game: {
                            name: "say @notify help"
                        }
                    });
                } else {
                    bot.sendMessage({
                        to:channelID,
                        message: "I'm already alive!"
                    });
                }
            break;

            case 'help' :
                bot.sendMessage({
                    to: channelID,
                    message: `Hello! Here's a list of my commands: (* denotes requiring admin privileges)

\`ping\` - (Used ${times.ping || "0"} times)
    Replies to you with 'Pong'

\`spam @name\` - (Used ${times.spam || "0"} times)
    Annoys @name with notifications

\`spamstop [@name]\` - (Used ${times.spamstop || "0"} times)
    Stops spamming @name, or stops spamming everyone in the channel this command is used in

\`remind YYYY/MM/DD HHMM "reminder message"\` - (Used ${times.reminder || "0"} times)
    Sets a reminder for the time specified and alerts with you the message provided

\`remindother @name YYYY/MM/DD HHMM "reminder message"\`* - (Used ${times.remindother || "0"} times)
    Same as \`remind\`, but sets it for someone else and requires admin privileges

\`setmain\` - (Used ${times.setmain || "0"} times)
    Sets the channel this was used in as the bots main channel

\`forget id\` - (Used ${times.forget || "0"} times)
    Forgets the notification by id specified
    You cannot forget someone elses notification unless you are admin

\`reminders\` - (Used ${times.reminders || "0"} times)
    Shows you your current reminders and their IDs

\`addadmin @name\`* - (Used ${times.addadmin || "0"} times)
    Elevates @name to admin

\`removeadmin @name\`* - (Used ${times.removeadmin || "0"} times)
    Demotes @name from admin

\`listadmins\` - (Used ${times.listadmins || "0"} times)
    Shows a list of the current admins

\`die\`* - (Used ${times.die || "0"} times)
    Locks the bot, making it so that no one can use it (also stops spam)

\`revive\`* - (Used ${times.revive || "0"} times)
    Unlocks the bot, resumes spam

\`help\` - (Used ${times.help || "0"} times)
    Displays this help message
`
                });
            break;

            default: 
                bot.sendMessage({
                    to: channelID,
                    message: "Huh?"
                });
            break;
        }
    }
});

function cleanup () {
    fs.writeFileSync("./notifications.json", JSON.stringify(ns, null, 4), console.log);
    bot.disconnect();
    setTimeout(process.exit, 500);
}

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGUSR1', cleanup);
process.on('SIGUSR2', cleanup);
process.on('uncaughtException', cleanup);

process.stdin.on('data', function (data) {
    data = data.toString().trim();
    args = data.split(' ');
    cmd = args[0];

    uidFromName = function (data) {
        if (data[0] !== '@') return '';
        data = data.substr(1).split("#");
        if (data.length == 1) {
            for (var i in bot.users) {
                if (bot.users[i].username == data[0]) {
                    return i;
                }
            }
        } else {
            for (var i in bot.users) {
                if (bot.users[i].username == data[0] && bot.users[i].discriminator == data[1]) {
                    return i;
                }
            }
        }
    };

    switch (cmd) {
        case 'say' : 
            var m = args.slice(1).join(" ");
            bot.sendMessage({
                to: config.mainChannel,
                message: m
            });
        break;

        case 'spam':
            var u = args[1];
            u = u.substr(2, u.length-3);
            if (!spams[config.mainChannel]) spams[config.mainChannel] = [];
            spams[config.mainChannel].push(u);
            bot.sendMessage({
                to: config.mainChannel,
                message: "Prepare yourselves!"
            });
        break;

        case 'spamstop' :
            if (args.length == 1) {
                spams[config.mainChannel] = [];
                bot.sendMessage({
                    to: channelID,
                    message: "Spamming stopped for channel"
                });
            } else {
                var u = args[1];
                u = u.substr(2, u.length-3);
                spams[config.mainChannel].splice(spams[config.mainChannel].indexOf(u), 1);
                bot.sendMessage({
                    to: config.mainChannel,
                    message: "Spamming stopped"
                });
            }
        break;  

        case 'remindother' :
            if (args.slice(2,4).join(" ").match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2})(\d{2})/)) {
                var reminder = args.slice(4).join(" ");
                var data = args.slice(2,4).join(" ").match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2})(\d{2})/);
                data.shift();
                data = data.map((v, _, _1) => parseInt(v, 10));
                date = new Date(data[0], data[1]-1, data[2], data[3], data[4]);
                var ds = date.toLocaleString();
                var id = uidFromName(args[1]);
                ns.push([date.getTime() / 1000, reminder, id, false, config.mainChannel]);
                id = ns.length;
                bot.sendMessage({
                    to: config.mainChannel,
                    message: "Reminder '"+reminder+"' set for "+ds+" (ID "+id+")"
                });
                fs.writeFileSync("./notifications.json", JSON.stringify(ns, null, 4), console.log);
            } else {
                console.log("Please format your date like so: `YYYY/MM/DD HHMM` (With the 24 hour clock)");
            }
        break;

        case 'forget' :
            if (args[1]) {
                var id = args[1];
                var n = ns[id];
                ns[id][3] = true;
                console.log("Forgotten");
                fs.writeFileSync("./notifications.json", JSON.stringify(ns, null, 4), console.log);
            } else {
                console.log("I forgot what to forget");
            }
        break;

        case 'addadmin' : 
            auth.admins.push(uidFromName(args[1]));
            bot.sendMessage({
                to: config.mainChannel,
                message: `Congratulations <@${uidFromName(args[1])}>! You're an admin`
            });
            console.log("Added admin");
            fs.writeFileSync("./auth.json", JSON.stringify(auth, null, 4));
        break;

        case 'removeadmin' :
            auth.admins.splice(auth.admins.indexOf(uidFromName(args[1])), 1);
            console.log("Removed admin");
            bot.sendMessage({
                to: config.mainChannel,
                message: `Sorry to see you go <@${uidFromName(args[1])}>! You're no longer an admin`
            });
            fs.writeFileSync("./auth.json", JSON.stringify(auth, null, 4));
        break;

        case 'listadmins' :
            console.log("Ok!");
            for (var i = 0; i < auth.admins.length; i++) {
                console.log(bot.users[auth.admins[i]].username)
            }
        break;

        case 'die' :
            if (isDead) {
                bot.sendMessage({
                    message:"*splat*",
                    to:config.mainChannel
                }, cleanup);
            } else {
                bot.sendMessage({
                    to: config.mainChannel,
                    message: "Nooo!!!"
                }, function () {
                    bot.sendMessage({
                        to: config.mainChannel,
                        message: "No!"
                    }, function () {
                        bot.sendMessage({
                            to: config.mainChannel,
                            message: "No..."
                        }, function () {
                            bot.sendMessage({
                                to: config.mainChannel,
                                message: "*ded*"
                            }, function () {
                                bot.setPresence({
                                    idle_since: Date.now() - 1000,
                                    game : {
                                        name : "say @notify revive"
                                    }
                                });
                            });
                            isDead = true;
                        });
                    });
                });
            }
        break;

        case 'revive' :
            bot.setPresence({
                idle_since: null,
                game: {
                    name: "say @notify help"
                }
            });
            bot.sendMessage({
                to:config.mainChannel,
                message: isDead?"Revived!":"Already alive?"
            });
            isDead = false;
        break;
    }
});

// Template for permission check
//
// if (auth.admins.indexOf(userID) >= 0) {
//  
// } else {
//     bot.sendMessage({
//         to: channelID,
//         message: "You're not strong enough"
//     });
// }