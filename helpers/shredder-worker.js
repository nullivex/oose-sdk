'use strict';
var nano
var api = require('./api')
var sessionToken = null  //We only need one for all the workers
var sessionTokenName = ''
var workerUsername = ''
var workerPassword = ''


/**
 * Construct worker
 * @param {object} config
 * @return {object}
 */
function construct(config){
  var that = {}
  var request = api.worker(config)

  that.request = request
  that.contentExist = function(handle,file){
    return request.postAsync({
      url: request.url('/job/content/exists'),
      json: {
        handle: handle,
        file: file
      }
    }).spread(function(res,body){
      if(body.error) throw new Error(body.error)
      return !!body.exists
    })
  }

  that.contentDownloadURL = function(handle,file){
    return 'https://' + config.host + ':' + config.port +
      '/job/content/download/' + handle + '/' + file
  }

  if(sessionToken){
    request=api.setSession(sessionToken,request,sessionTokenName)
    return that
  }else{
    return that
  }
}


/**
 * Set couch username
 * @param {string} username
 */
exports.setUsername = function(username){
  workerUsername = username
}


/**
 * Set couch password
 * @param {string} password
 */
exports.setPassword = function(password){
  workerPassword = password
}


/**
 * Authenticate the session
 * @param {object} worker
 * @return {P}
 *
function login(worker){
  return worker.request.postAsync({
    url: worker.request.url('/login'),
    json: {
      username: workerUsername,
      password: workerPassword
    }
  })
    .spread(function(res,body){
      if(!body.session)
        throw new Error('Login failed, no session')
      sessionToken = body.session
      return sessionToken
    })
}
*/


/**
 * Set couchdb client
* @param {object} client
 */
exports.setClient = function(client){
  nano = client
}


/**
 * Set session token name
 * @param {string} name
 */
exports.setSessionTokenName = function(name){
  sessionTokenName = name
}


/**
 * Set the couch session token
 * @param {string} token
 */
exports.setSessionToken = function(token){
  sessionToken = token
}


/**
 * Get the current worker config from couchdb
 * @param {string} name
 * @return {P}
 */
var getConfig = function(name){
  return nano.shredder.viewAsync('workers','all',{key:name})
    .then(function(result){
      if(result.rows && result.rows.length){
        return result.rows[0].value
      }else{
        return null
      }
    },function(err){
      throw err
    })
}


/**
 * Get available workers from couch
 * @return {P}
 */
exports.getAvailable = function(){
  return nano.shredder.viewAsync('workers','available')
    .then(function(jobRes){
      var result = []
      if(jobRes && jobRes.length){
        for(var i = 0; i < jobRes.length; i++){
          result.push(jobRes[i].value)
        }
      }
      return result
    },function(err){
      throw err
    })
}


/**
 * Get worker
 * @param {string} name
 * @return {P}
 */
exports.get = function(name){
  return getConfig(name).then(function(workerCfg){
    if(!workerCfg) return null
    return construct(workerCfg)
  })
}
