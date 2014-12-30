'use strict';
var P = require('bluebird')
var bodyParser = require('body-parser')
var Busboy = require('busboy')
var express = require('express')
var fs = require('graceful-fs')
var https = require('https')
var mime = require('mime')
var promisePipe = require('promisepipe')
var sha1stream = require('sha1-stream')
var temp = require('temp')

var app = express()
var content = require('./helpers/content')
var contentExists = require('./helpers/contentExists')
var pkg = require('../package.json')
var purchase = require('./helpers/purchase')
var sslOptions = {
  key: fs.readFileSync(__dirname + '/../ssl/oose_test.key'),
  cert: fs.readFileSync(__dirname + '/../ssl/oose_test.crt')
}
var server = https.createServer(sslOptions,app)
var user = require('./helpers/user')
var UserError = require('../helpers/UserError')

//make some promises
P.promisifyAll(fs)
P.promisifyAll(server)

//setup
app.use(bodyParser.json())


//--------------------
//public routes
//--------------------

//home page
app.post('/',function(req,res){
  res.json({message: 'Welcome to OOSE Mock version ' + pkg.version})
})

//health test
app.post('/ping',function(req,res){
  res.json({pong: 'pong'})
})

//--------------------
//protected routes
//--------------------
var validateSession = function(req,res,next){
  var token = req.get('X-OOSE-Token')
  if(!token || user.session.token !== token){
    res.status(401)
    res.json({error: 'Invalid session'})
  } else {
    req.session = user.session
    next()
  }
}

//user functions
app.post('/user/login',function(req,res){
  P.try(function(){
    if(!req.body.username || 'test' !== req.body.username)
      throw new UserError('No user found')
    if(!req.body.password || user.password !== req.body.password)
      throw new UserError('Invalid password')
    res.json({
      success: 'User logged in',
      session: user.session
    })
  })
    .catch(UserError,function(err){
      res.json({error: err.message})
    })
})

app.post('/user/logout',validateSession,function(req,res){
  res.json({success: 'User logged out'})
})
app.post('/user/password/reset',validateSession,function(req,res){
  res.json({
    success: 'User password reset',
    password: user.password
  })
})
app.post('/user/session/validate',validateSession,function(req,res){
  res.json({success: 'Session Valid'})
})
app.post('/user/session/update',validateSession,function(req,res){
  if(req.body.data)
    user.session.data = JSON.stringify(req.body.data)
  res.json(user.session)
})

//content functions
app.post('/content/detail',validateSession,function(req,res){
  var detail = contentExists
  detail.sha1 = req.body.sha1
  res.json(detail)
})
app.post('/content/upload',validateSession,function(req,res){
  var data = {}
  var files = {}
  var filePromises = []
  var busboy = new Busboy({
    headers: req.headers,
    highWaterMark: 65536, //64K
    limits: {
      fileSize: 2147483648000 //2TB
    }
  })
  busboy.on('field',function(key,value){
    data[key] = value
  })
  busboy.on('file',function(key,file,name,encoding,mimetype){
    var tmpfile = temp.path({prefix: 'oose-mock-'})
    var sniff = sha1stream.createStream()
    var writeStream = fs.createWriteStream(tmpfile)
    files[key] = {
      key: key,
      tmpfile: tmpfile,
      name: name,
      encoding: encoding,
      mimetype: mimetype,
      ext: mime.extension(mimetype),
      sha1: null
    }
    filePromises.push(
      promisePipe(file,sniff,writeStream)
        .then(function(){
          files[key].sha1 = sniff.sha1
        })
    )
  })
  busboy.on('finish',function(){
    P.all(filePromises)
      //destroy all the temp files from uploading
      .then(function(){
        var keys = Object.keys(files)
        var promises = []
        var file
        for(var i = 0; i < keys.length; i++){
          file = files[keys[i]]
          promises.push(fs.unlinkAsync(file.tmpfile))
        }
        return P.all(promises)
      })
      .then(function(){
        res.json({success: 'File(s) uploaded',data: data,files: files})
      })
      .catch(UserError,function(err){
        res.json({error: err.message})
      })
  })
  req.pipe(busboy)
})
app.post('/content/purchase',validateSession,function(req,res){
  var sha1 = req.body.sha1
  var referrer = req.body.referrer
  var life = req.body.life
  if(!sha1){
    res.json({error: 'No SHA1 passed for purchase'})
  }
  var detail = purchase
  detail.life = life || detail.life
  detail.referrer = referrer || detail.referrer
  detail.sha1 = sha1
  res.json(detail)
})
app.post('/content/remove',validateSession,function(req,res){
  var token = req.body.token
  res.json({token: token, count: 1, success: 'Purchase removed'})
})

//main content retrieval route
app.get('/:token/:filename',function(req,res){
  res.redirect(302,
    'http://mock.oose.io/' + purchase.token + '/' + req.params.filename)
})


/**
 * Mock content record
 * @type {object}
 */
exports.content = content


/**
 * Mock content exists
 * @type {object}
 */
exports.contentExists = contentExists


/**
 * Mock SSL certificate
 * @type {object}
 */
exports.sslOptions = sslOptions


/**
 * Mock purchase
 * @type {object}
 */
exports.purchase = purchase


/**
 * Mock user and session
 * @type {object}
 */
exports.user = user


/**
 * Start oose mock
 * @param {number} port
 * @param {string} host
 * @return {P}
 */
exports.start = function(port,host){
  return server.listenAsync(+port,host)
}


/**
 * Stop oose prism
 * @return {P}
 */
exports.stop = function(){
  return server.closeAsync()
}
