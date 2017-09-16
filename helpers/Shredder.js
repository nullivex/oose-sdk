'use strict';
var P = require('bluebird')
var dns = require('dns')
var ObjectManage = require('object-manage')
var oose = require('oose-sdk')
var Password = require('node-password').Password

var UserError = oose.UserError
var nano = require('./couchdb')
var job = require('./job')
var worker = require('./shredder-worker')
var couchSession = require('./couchSession')

//make some promises
P.promisifyAll(dns)


/**
 * Generate job Handle
 * @return {string}
 */
var generateHandle = function(){
  return new Password({length: 12, special: false}).toString()
}



/**
 * Shredder Interaction Helper
 * @param {object} opts
 * @constructor
 */
var Shredder = function(opts){
  //setup options
  this.opts = new ObjectManage({
      protocol: 'http://',
      host: '127.0.0.1',
      port: '5984',
      prefix: 'shredder',
      database: 'shredder',
      sessionToken:'X-SHREDDER-Token',
      options: {
        secure: false,
        cache: false,
        retries: 3,
        retryTimeout: 10000,
        auth: {
          username: 'shredder',
          password: ''
        }
      }
  })
  this.opts.$load(opts)
  //set properties
  this.api = {}
  this.authenticated = false
  this.connected = false
  this.session = {}

  worker.setSessionTokenName(this.opts.sessionToken)
  worker.setUsername(this.opts.options.auth.username)
  worker.setPassword(this.opts.options.auth.password)
  couchSession.setConfig(this.opts.host,this.opts.port,this.opts.options.secure)
}


/**
 * Setup the CouchDB session
 * @type {object}
 */
Shredder.prototype.couchSession = couchSession


/**
 * Check if we are connected
 * @return {boolean}
 */
Shredder.prototype.isConnected = function(){
  return this.connected
}


/**
 * Check if we are authenticated
 * @return {boolean}
 */
Shredder.prototype.isAuthenticated = function(){
  return this.authenticated
}


/**
 * Set the session statically
 * @param {string} sessionToken
 * @return {Prism}
 */
Shredder.prototype.setSession = function(sessionToken){
  this.session = {token: sessionToken}
  this.authenticated = true
  return this
}


/**
 * Select a prism and prepare for connection
 * @param {string} host
 * @return {P}
 */
Shredder.prototype.connect = function(host){
  var that = this
  return P.try(function(){
    that.connected = true
    //that.api = api.master(that.opts.master)
    return host
  })

}


/**
 * Authenticate the session
 * @param {string} username
 * @param {string} password
 * @return {P}
 */
Shredder.prototype.login = function(username,password){
  var that = this
  //setup our client
  var client = that.client = nano(that.opts)
  job.setClient(client)
  worker.setClient(client)
  if(!username) username = that.opts.options.auth.username
  if(!password) password = that.opts.options.auth.password
  return that.couchSession.login(username,password)
    .then(function(session){
      that.session = session
      that.authenticated = true
      that.connected = true
      worker.setSessionToken(session)
      return session.token
    },function(err){
      console.log(err)
      throw new UserError('Connection failed')
    })
}


/**
 * Prepare call and renew session if needed
 * @return {P}
 */
Shredder.prototype.prepare = function(){
  var that = this
  if(!that.isConnected()) throw new UserError('Not connected')
  if(!that.isAuthenticated()) throw new UserError('Not authenticated')
  return that.client
}


/**
 * Logout
 * @return {P}
 */
Shredder.prototype.logout = function(){
  return new P(function(resolve){
    resolve(true)
  })
}


/**
 * Reset your password
 * @return {P}
 */
Shredder.prototype.passwordReset = function(){
  return new P(function(resolve){
    resolve({password:'Reset'})
  })
}


/**
 * Job create
 * @param {object} description
 * @param {number} priority
 * @param {string} category
 * @return {P}
 */
Shredder.prototype.jobCreate = function(description,priority,category){
  this.prepare()
  return job.save({
    handle: generateHandle(),
    description: description,
    priority: priority || null,
    category: category || 'resource',
    status: 'staged',
    type:'job',
    statusDescription: 'Staged',
    stepTotal: 1,
    stepComplete: 0,
    frameDescription: 'Staged',
    frameTotal: 1,
    frameComplete: 0
  })
}


/**
 * Job detail
 * @param {string} handle
 * @return {P}
 */
Shredder.prototype.jobDetail = function(handle){
  this.prepare()
  return job.getByHandle(handle)
}


/**
 * Job Update
 * @param {string} handle
 * @param {object} changes
 * @param {boolean} force
 * @return {P}
 */
Shredder.prototype.jobUpdate = function(handle,changes,force){
  //force boolean
  force = (force)
  this.prepare()
  return job.getByHandle(handle)
    .then(function(result){
      if('staged' !== result.status && !force){
        throw new UserError('Job cannot be updated after being started')
      }
      if(changes.description) result.description = changes.description
      if(changes.priority) result.priority = changes.priority
      if(changes.status && force) result.status = changes.status
      return job.save(result)
    })
}


/**
 * Job remove
 * @param {string} handle
 * @return {P}
 */
Shredder.prototype.jobRemove = function(handle){
  this.prepare()
  return job.getByHandle(handle).then(function(result){
    if('processing' !== result.status){
      result.status = 'removed'
      return job.save(result)
    }else{
      return job.remove(result)
    }
  }).then(function(){
    return({success: 'Job removed', count: 1})
  })
}


/**
 * Job Start
 * @param {string} handle
 * @return {P}
 */
Shredder.prototype.jobStart = function(handle){
  this.prepare()
  return job.getByHandle(handle).then(function(result){
    if('staged' !== result.status){
      throw new UserError('Job cannot be started after being started')
    }else{
      result.status = 'queued'
      return job.save(result)
    }
  })
}


/**
 * Job Retry
 * @param {string} handle
 * @return {P}
 */
Shredder.prototype.jobRetry = function(handle){
  this.prepare()
  var validStatus = [
    'error',
    'timeout',
    'aborted',
    'unknown',
    'complete',
    'processing',
    'archived'
  ]
  return job.getByHandle(handle).then(function(result){
    if(validStatus.indexOf(result.status) < 0){
      throw new UserError(
        'Job cannot be retried ' +
        'with a status of ' + result.status
      )
    }else{
      if(result.status !== 'processing') result.worker = null
      result.status = 'queued_retry'
      return job.save(result)
    }
  })
}


/**
 * Job Abort
 * @param {string} handle
 * @return {P}
 */
Shredder.prototype.jobAbort = function(handle){
  this.prepare()
  return job.getByHandle(handle).then(function(retrievedJob){
    if('processing' !== retrievedJob.status){
      throw new UserError('Job cannot be aborted when not processing')
    }else{
      retrievedJob.status = 'queued_abort'
      return job.save(retrievedJob)
    }
  })
}


/**
 * Check if job content exists
 * @param {string} handle
 * @param {string} file
 * @return {P}
 */
Shredder.prototype.jobContentExists = function(handle,file){
  return job.getByHandle(handle)
    .then(function(result){
      if(result.worker) return worker.get(result.worker)
      else throw new Error('No worker assigned to this job')
    })
    .then(function(worker){
      return worker.contentExist(handle, file)
    })
}


/**
 * URL to download job content
 * @param {string} handle
 * @param {string} file
 * @return {string}
 */
Shredder.prototype.jobContentUrl = function(handle,file){
  return job.getByHandle(handle).then(function(retrievedJob){
    if(retrievedJob.worker) return worker.get(retrievedJob.worker)
    else throw new Error('No worker assigned to this job')
  }).then(function(worker){
    return worker.contentDownloadURL(handle, file)
  })
}


/**
 * Export Shredder
 * @type {Shredder}
 */
module.exports = Shredder
