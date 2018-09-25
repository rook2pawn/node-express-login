var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser')
var formidable = require('formidable');
var fs = require('fs');
var Redis = require('connect-redis')(session);
var redisClient = require("redis"), 
client = redisClient.createClient();

client.on("error", function (err) {
    console.log("redis client Error " + err);
});
var auth = function(req,name) {
    req.session.auth = true;
    req.session.user = name;
};

var server = express();
server.use(cookieParser()) ; 
server.use(
    session({ 
        secret: "keyboard cat",
        store: new Redis,
        maxAge: 86400000,  // 1 day
    })
);

server.get('/', function (req, res) {
    if ((req.session.auth) && (req.session.user)) { 
        // logged in, show the good stuff
        res.render('index.ejs',{
            layout:false,
            error : req.session.error,
            auth : req.session.auth,
            user : req.session.user,
            host : req.headers.host
        });
    } else {
        // go to login
        res.redirect('/login') ; 
    };
}); 


server.post('/logout', function(req,res) {
    req.session.destroy(function(err) {
        res.redirect('/login');
    });
});

server.get('/login', function(req,res) {
    if ((req.session.auth) && (req.session.user)) { 
        // we are logged in, so go to the page
        res.redirect('/') 
    } else {
        // not logged in, show the form
        res.render('login.ejs',{
            layout:false,
            error : req.session.error,
            auth : req.session.auth,
            user : req.session.user,
            host : req.headers.host
        });
    }
}); 

server.post('/login', function(req,res) {
    var form = new formidable.IncomingForm();
    req.session.error = {};
    form.parse(req, function(err, fields, files) {
        var name = fields.name; var password = fields.password;
        client.hexists("users", name, function(err, replies) {
            if (replies == 1) {
                client.hget("users", name, function(err, obj) {
                    var hash = JSON.parse(obj);
                    if (password === hash.password) {
                        auth(req,name);
                    } else {
                        req.session.error.login = true;
                        req.session.error.password = true;
                    }
                    res.redirect('back');
                });
            } else {
                req.session.error.login = true;
                req.session.error.username = true;
                res.redirect('back');
            } 
        });
    }); 
});
server.post('/register', function(req,res) {
    var form = new formidable.IncomingForm();
    req.session.error = {};
    form.parse(req, function(err, fields, files) {
        if ((fields.name !== undefined) && (fields.password !== undefined)) {
            var name = fields.name;
            var password = fields.password;
            //verify "users" exists, or create
            client.hgetall("users", function (err, obj) {
                if ( err ) {
                    console.log("err", err) ;
                }
                //verify obj exists
                console.log("obj", obj) ;
                if ( obj === null ) {
                    obj = {} ;
                }
                //proceed
                if ( obj[name] === undefined ) {
                    var data = {name:name, password:password};
                    client.hmset("users", name, JSON.stringify(data));
                    auth(req,name);
                } else {
                    req.session.error = {};
                    req.session.error.register = true;
                }
                res.redirect('back');
            });
        } 
    }); 
});

var port = 4000;
console.log('Listening on ' + port);
server.listen(port);
