'use strict';
var P = require('bluebird')
var debug = require('debug')('oose-sdk:api')
var ObjectManage = require('object-manage')
var request = require('request')

var NetworkError = require('../helpers/NetworkError')
var UserError = require('../helpers/UserError')

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
  maxSockets: 1024,
  sessionTokenName: 'X-OOSE-Token',
  master: {
    port: 3001,
    host: '127.0.0.1',
    username: 'oose',
    password: 'oose'
  },
  prism: {
    port: 3002,
    host: '127.0.0.1',
    username: 'oose',
    password: 'oose'
  },
  store: {
    port: 3003,
    host: '127.0.0.1',
    username: 'oose',
    password: 'oose'
  }
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
      else
        throw new UserError(body)
    }
    if(200 !== res.statusCode){
      throw new UserError(
        'Invalid response code (' + res.statusCode + ')' +
        ' to ' + res.method + ': ' + res.url)
    }
    if(body.error){
      if(body.error.message) throw new UserError(body.error.message)
      if(body.error) throw new UserError(body.error)
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
  P.promisifyAll(req)
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
    var req = request.defaults({
      rejectUnauthorized: false,
      json: true,
      timeout:
      process.env.REQUEST_TIMEOUT ||
      options.timeout ||
      config[type].timeout ||
      null,
      pool: pool,
      auth: {
        username: options.username || config[type].username,
        password: options.password || config[type].password
      }
    })
    cache[cacheKey] = extendRequest(req,type,options)
  } else {
    debug('cache hit',cacheKey)
  }
  return cache[cacheKey]
}


/**
 * Array of TCP errors
 * @type {array}
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
 * Setup master access
 * @param {object} options
 * @return {request}
 */
exports.master = function(options){
  if(!options) options = config.master
  return setupRequest('master',options)
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
 * Store access
 * @param {object} options
 * @return {request}
 */
exports.store = function(options){
  if(!options) options = config.store
  return setupRequest('store',options)
}


/**
 * Set session on any request object
 * @param {object} session
 * @param {request} request
 * @return {request}
 */
exports.setSession = function(session,request){
  var cacheKey = request.options.type + ':' + request.options.host +
    ':' + request.options.port + ':' + session.token
  if(!cache[cacheKey]){
    debug('cache miss',cacheKey)
    var newOptions = {headers: {}}
    newOptions.headers[config.sessionTokenName] = session.token
    var req = request.defaults(newOptions)
    req = extendRequest(req,request.options.type,request.options)
    cache[cacheKey] = req
  } else {
    debug('cache hit',cacheKey)
  }
  return cache[cacheKey]
}
