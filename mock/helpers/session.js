var P = require('bluebird')
var cachedSessions = {}

exports.setConfig = function(host,port,secure){
  return
}


/**
 * User Login
 * @param {string} username
 * @param {string} password
 */
exports.login = function(username,password){
  return new P(function(resolve,reject){
    var sess = {
      token: getToken(),
        ip: '127.0.0.1',
        data: {}
    }
    resolve(sess)
  })
}


/**
 * User Logout
 * @param {string} token
 */
exports.logout = function(token){
  return new P(function(resolve,reject){
    if(cachedSessions[token]) cachedSessions[token]= null
    resolve(true)
  })
}

exports.isSessionValid = function(token){
  return !!cachedSessions[token]
}

var getToken = exports.getToken = function(){
  var token =  "AuthSession="+Date.now()
  cachedSessions[token] = true
  return token
}