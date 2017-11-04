'use strict';
var P = require('bluebird')
var debug = require('debug')('oose-sdk:api')
var ObjectManage = require('object-manage')
var request = require('request')
var util = require('util')

var NetworkError = require('../helpers/NetworkError')

//set a default timeout
//equiv to timeout max in node.js/lib/timers.js
request = request.defaults({timeout: 2147483647})


/**
 * Allow self signed certs
 * @type {number}
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

var tcpErrors = [
  'EINTR',
  'EBADF',
  'EAGAIN',
  'EFAULT',
  'EBUSY',
  'EINVAL',
  'ENFILE',
  'EMFILE',
  'ENOSPC',
  'EPIPE',
  'EWOULDBLOCK',
  'ENOTSOCK',
  'ENOTPROTOOPT',
  'EADDRINUSE',
  'EADDRNOTAVAIL',
  'ENETDOWN',
  'ENETUNREACH',
  'ENETRESET',
  'ECONNRESET',
  'ENOBUFS',
  'EISCONN',
  'ENOTCONN',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'ESOCKETTIMEDOUT',
  'socket hang up'
]

var cache = {}

var config = {
  maxSockets: Infinity,
  sessionTokenName: 'X-OOSE-Token'
}

var pool = {maxSockets: config.maxSockets}


/**
 * Make an API URL
 * @param {object} options
 * @return {function}
 */
var makeURL = function(options){
  return function(uri){
    return 'https://' + (options.host || '127.0.0.1') + ':' + options.port + uri
  }
}


/**
 * Validate a response (implicit error handling)
 * @return {function}
 */
var validateResponse = function(){
  return function(res,body){
    if('object' !== typeof body){
      if('{' === body[0])
        body = JSON.parse(body)
    }
    if('object' === typeof body && body.error){
      if(body.error.message) throw new Error(body.error.message)
      if(body.error) throw new Error(body.error)
    }
    if(200 !== res.statusCode){
      throw new Error(
        'Invalid response (' + res.statusCode + ')' +
        ' to ' + res.request.href + ' body: ' + util.inspect(body))
    }
    return [res,body]
  }
}


/**
 * Handle network errors
 * @param {Error} err
 */
var handleNetworkError = function(err){
  //if this is already a network error just throw it
  if(err instanceof NetworkError){
    throw err
  }
  //convert strings to errors
  if('string' === typeof err){
    err = new Error(err)
  }
  //check if the error message matches a known TCP error
  var error
  for(var i = 0; i < tcpErrors.length; i++){
    if(err.message.indexOf(tcpErrors[i]) >= 0){
      //lets throw a NetworkError
      error = new NetworkError(err.message)
      //preserve the original stack trace so we can actually debug these
      error.stack = err.stack
      throw error
    }
  }
  //if we make it here it is not an error we can handle just throw it
  throw err
}


/**
 * Extend request
 * @param {request} req
 * @param {string} type
 * @param {object} options
 * @return {request}
 */
var extendRequest = function(req,type,options){
  req.options = options
  req.options.type = type
  req.url = makeURL(options)
  req.validateResponse = validateResponse
  req.handleNetworkError = handleNetworkError
  P.promisifyAll(req,{multiArgs: true})
  return req
}


/**
 * Setup a new request object
 * @param {string} type
 * @param {object} options
 * @return {request}
 */
var setupRequest = function(type,options){
  var cacheKey = type + ':' + options.host + ':' + options.port
  if(!cache[cacheKey]){
    debug('cache miss',cacheKey)
    var reqDefaults = {
      rejectUnauthorized: false,
      json: true,
      timeout:
        +process.env.REQUEST_TIMEOUT ||
        +options.timeout ||
        2147483647, //equiv to timeout max in node.js/lib/timers.js
      pool: pool
    }
    if(options.username || (config[type] && config[type].username)){
      reqDefaults.auth = {
        username: options.username || config[type].username
      }
    }
    if(options.password || (config[type] && config[type].password)){
      if(reqDefaults.auth){
        reqDefaults.auth.password = options.password || config[type].password
      } else {
        reqDefaults.auth = {
          password: options.password || config[type].password
        }
      }
    }
    var req = request.defaults(reqDefaults)
    cache[cacheKey] = extendRequest(req,type,options)
  } else {
    debug('cache hit',cacheKey)
  }
  return cache[cacheKey]
}


/**
 * Array of TCP errors
 * @type {Array}
 */
exports.tcpErrors = tcpErrors


/**
 * Make URL
 * @type {Function}
 */
exports.makeURL = makeURL


/**
 * Validate API response
 * @type {Function}
 */
exports.validateResponse = validateResponse


/**
 * Handle network error
 * @type {Function}
 */
exports.handleNetworkError = handleNetworkError


/**
 * Setup request
 * @type {Function}
 */
exports.setupRequest = setupRequest


/**
 * Extend request
 * @type {Function}
 */
exports.extendRequest = extendRequest


/**
 * Update API Config
 * @param {object} update
 */
exports.updateConfig = function(update){
  var cfg = new ObjectManage()
  cfg.$load(config)
  cfg.$load(update)
  config = cfg.$strip()
  pool.maxSockets = config.maxSockets
}


/**
 * Setup access
 * @param {string} type
 * @param {object} options
 * @return {request}
 */
exports.setupAccess = function(type,options){
  if(!type) type = 'prism'
  if(!options) options = config[type]
  return setupRequest(type,options)
}


/**
 * Setup prism access
 * @param {object} options
 * @return {request}
 */
exports.prism = function(options){
  if(!options) options = config.prism
  return setupRequest('prism',options)
}


/**
 * Setup store access
 * @param {object} options
 * @return {request}
 */
exports.store = function(options){
  if(!options) options = config.prism
  return setupRequest('store',options)
}


/**
 * Set session on any request object
 * @param {object} session
 * @param {request} request
 * @param {string} tokenName
 * @return {request}
 */
exports.setSession = function(session,request,tokenName){
  var cacheKey = request.options.type + ':' + request.options.host +
    ':' + request.options.port + ':' + session.token
  if(!cache[cacheKey]){
    debug('cache miss',cacheKey)
    var newOptions = {headers: {}}
    newOptions.headers[tokenName || config.sessionTokenName] = session.token
    var req = request.defaults(newOptions)
    req = extendRequest(req,request.options.type,request.options)
    cache[cacheKey] = req
  } else {
    debug('cache hit',cacheKey)
  }
  return cache[cacheKey]
}
