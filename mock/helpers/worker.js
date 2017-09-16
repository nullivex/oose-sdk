var P = require('bluebird')
var bodyParser = require('body-parser')
var express = require('express')
var fs = require('graceful-fs')
var https = require('https')
var mockSession = require('./session')

var routes
var sslOptions = {
  key: fs.readFileSync(__dirname + '/../../ssl/shredder_test.pem'),
  cert: fs.readFileSync(__dirname + '/../../ssl/shredder_test.pem')
}
var app = express()
var server = https.createServer(sslOptions,app)

//make some promises
P.promisifyAll(server)

var routerFactory = function(){
  var that = this
  var token = null
  var sessionData = {
    "ok":true,
    "userCtx": {
      "name":null,
      "roles":["_admin"]
    },"info":{
      "authentication_db":"_users",
      "authentication_handlers":["oauth","cookie","default"],
      "authenticated":"cookie"}
  }

  that.index = function(req,res){
    res.json({message: 'Welcome to Shredder mock worker'})
  }

  that.ping = function(req,res){
    res.json({pong: 'pong'})
  }

  that.login = function(req,res){
    if(!req.body || !req.body.username || !req.body.password){
      res.status(401)
      res.json({error: 'Invalid username or password'})
    } else {
      generateToken()
      sessionData.userCtx.name = req.body.username
      var session = {
        success: 'User logged in',
        session: {
          token: token,
          ip: req.ip,
          data: sessionData
        }
      }
      req.session = session
      res.json(session)
    }
  }

  that.logout = function(req,res){
    sessionData.userCtx.name = null
    token = null
    res.json({
      success: 'User logged out',
      data: {"ok":true}
    })
  }

  that.job = {}

  that.job.contentExists = function(req,res){
    var file = req.body.file
    res.json({
      exists: file == 'video.mp4'
    })
  }

  that.sessionValidate = function(req,res,next){
    var sentToken = req.get('X-SHREDDER-Token') || ''

    if(!sentToken){
      res.status(401)
      res.json({error: "No token"})
    }else{
      if(!mockSession.isSessionValid(sentToken)){
        res.status(401)
        res.json({error: "Wrong session"})
      }else{
        req.session = {
          token: token,
          ip: req.ip,
          data: sessionData
        }
        next()
      }
    }
  }

  var generateToken = function(){
    token = "AuthSession="+Date.now()
  }
}

routes = new routerFactory()

//setup
app.use(bodyParser.json({limit: '100mb'}))

//home page
app.post('/',routes.index)
app.get('/',routes.index)

//health test
app.post('/ping',routes.ping)
app.get('/ping',routes.ping)

app.post('/login',routes.login)
app.post('/logout',routes.logout)

//job functions
app.post('/job/content/exists',routes.sessionValidate,routes.job.contentExists)

exports.start = function(config){
  return server.listenAsync(+(config.worker.port),config.worker.host)
}

exports.stop = function(){
  return server.closeAsync()
}