'use strict';
var expect = require('chai').expect
var fs = require('graceful-fs')
var url = require('url')

var api = require('../../helpers/api')
var content = require('../../mock/helpers/content')
var mock = require('../../mock')
var NetworkError = require('../../helpers/NetworkError')
var pkg = require('../../package.json')
var UserError = require('../../helpers/UserError')

//load promises here
//var P = require('bluebird')
//P.longStackTraces() //enable long stack traces for debugging only


/**
 * API Timeout for outage testing
 * @type {number}
 */
process.env.REQUEST_TIMEOUT = 10000


/**
 * Store user session
 * @type {object}
 */
exports.user = {
  username: mock.user.username,
  password: mock.user.password,
  session: {}
}


/**
 * Store purchase
 * @type {object}
 */
exports.purchase = {}


/**
 * Check if a host is up
 * @param {string} type
 * @param {object} server
 * @return {Function}
 */
exports.checkUp = function(type,server){
  return function(){
    var client = api.setupAccess(type,server[type])
    return client.postAsync({url: client.url('/ping'), timeout: 50})
      .spread(function(res,body){
        expect(body.pong).to.equal('pong')
      })
  }
}


/**
 * Check if a host is down
 * @param {string} type
 * @param {object} server
 * @return {Function}
 */
exports.checkDown = function(type,server){
  return function(){
    var client = api.setupAccess(type,server[type])
    return client.postAsync({url: client.url('/ping'), timeout: 50})
      .then(function(){
        throw new Error('Server not down')
      })
      .catch(Error,client.handleNetworkError)
      .catch(NetworkError,function(err){
        expect(err.message).to.match(/ECONNREFUSED|ETIMEDOUT/)
      })
  }
}


/**
 * Check if public routes work on a prism
 * @param {object} prism
 * @return {Function}
 */
exports.checkPublic = function(prism){
  return function(){
    var client = api.setupAccess('prism',prism.prism)
    return client
      .postAsync(client.url('/'))
      .spread(client.validateResponse())
      .spread(function(res,body){
        expect(body.message).to.equal(
          'Welcome to OOSE Mock version ' + pkg.version)
        return client.postAsync(client.url('/ping'))
      })
      .spread(client.validateResponse())
      .spread(function(res,body){
        expect(body.pong).to.equal('pong')
        return client.postAsync(client.url('/user/login'))
      })
      .spread(client.validateResponse())
      .spread(function(res,body){
        console.log(body)
        throw new Error('Should have thrown an error for no username')
      })
      .catch(Error,function(err){
        expect(err.message).to.equal('No user found')
      })
  }
}


/**
 * Check if protected routes require authentication on a prism
 * @param {object} prism
 * @return {Function}
 */
exports.checkProtected = function(prism){
  return function(){
    var client = api.setupAccess('prism',prism.prism)
    return client.postAsync(client.url('/user/logout'))
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/user/password/reset'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/user/session/validate'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/content/upload'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/content/purchase'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/content/remove'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/job/create'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/job/detail'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/job/update'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/job/remove'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/job/start'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/job/retry'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
        return client.postAsync(client.url('/job/abort'))
      })
      .catch(UserError,function(err){
        expect(err.message).to.match(/Invalid response code \(401\) to POST/)
      })
  }
}


/**
 * Login to a prism
 * @param {object} prism
 * @return {Function}
 */
exports.prismLogin = function(prism){
  return function(){
    var client = api.setupAccess('prism',prism.prism)
    return client.postAsync({
      url: client.url('/user/login'),
      json: {
        username: exports.user.username,
        password: exports.user.password
      },
      localAddress: '127.0.0.1'
    })
      .spread(function(res,body){
        expect(body.session).to.be.an('object')
        return body.session
      })
  }
}


/**
 * Logout of a prism
 * @param {object} prism
 * @param {object} session
 * @return {Function}
 */
exports.prismLogout = function(prism,session){
  return function(){
    var client = api.setSession(session,api.setupAccess('prism',prism.prism))
    return client.postAsync({
      url: client.url('/user/logout'),
      localAddress: '127.0.0.1',
      json: true
    })
      .spread(function(res,body){
        expect(body.success).to.equal('User logged out')
      })
  }
}


/**
 * Content upload
 * @param {object} prism
 * @return {Function}
 */
exports.contentUpload = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client
      .postAsync({
        url: client.url('/content/upload'),
        formData: {
          file: fs.createReadStream(content.file)
        },
        json: true,
        localAddress: '127.0.0.1'
      })
      .spread(function(res,body){
        expect(body.files.file.hash).to.equal(content.hash)
      })
  }
}


/**
 * Get content detail
 * @param {object} prism
 * @return {Function}
 */
exports.contentDetail = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client
      .postAsync({
        url: client.url('/content/detail'),
        json: {hash: content.hash},
        localAddress: '127.0.0.1'
      })
      .spread(function(res,body){
        expect(body.hash).to.equal(content.hash)
        expect(body.count).to.be.greaterThan(0)
        expect(body.exists).to.equal(true)
        expect(body.map).to.be.an('array')
      })
  }
}


/**
 * Purchase content
 * @param {object} prism
 * @return {Function}
 */
exports.contentPurchase = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client
      .postAsync({
        url: client.url('/content/purchase'),
        json: {
          hash: content.hash,
          ext: content.ext,
          ip: '127.0.0.1',
          referrer: ['localhost']
        },
        localAddress: '127.0.0.1'
      })
      .spread(function(res,body){
        expect(body.token.length).to.equal(64)
        expect(body.ext).to.equal('txt')
        expect(body.life).to.equal(21600)
        expect(body.hash).to.equal(content.hash)
        expect(body.referrer).to.be.an('array')
        expect(body.referrer[0]).to.equal('localhost')
        return body
      })
  }
}


/**
 * Deliver content
 * @param {object} prism
 * @param {string} localAddress
 * @param {string} referrer
 * @return {Function}
 */
exports.contentDeliver = function(prism,localAddress,referrer){
  return function(){
    var client = api.setupAccess('prism',prism.prism)
    var options = {
      url: client.url('/' + exports.purchase.token + '/' + content.filename),
      headers: {
        'Referer': referrer || 'localhost'
      },
      followRedirect: false,
      localAddress: localAddress || '127.0.0.1'
    }
    return client.getAsync(options)
      .spread(function(res){
        expect(res.statusCode).to.equal(302)
        var uri = url.parse(res.headers.location)
        var host = uri.host.split('.')
        expect(host[0]).to.match(/^mock/)
        expect(host[1]).to.equal('oose')
        expect(uri.pathname).to.equal(
          '/' + exports.purchase.token + '/' + content.filename)
      })
  }
}


/**
 * Remove content purchase
 * @param {object} prism
 * @return {Function}
 */
exports.contentPurchaseRemove = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client.postAsync({
      url: client.url('/content/purchase/remove'),
      json: {token: exports.purchase.token},
      localAddress: '127.0.0.1'
    })
      .spread(function(res,body){
        expect(body.token).to.equal(exports.purchase.token)
        expect(body.count).to.equal(1)
        expect(body.success).to.equal('Purchase removed')
      })
  }
}


/**
 * Job create
 * @param {object} prism
 * @return {Function}
 */
exports.jobCreate = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client.postAsync({
      url: client.url('/job/create'),
      localAddress: '127.0.0.1',
      json: {
        category: mock.job.category,
        description: mock.job.description,
        priority: mock.job.priority
      }
    })
      .spread(function(res,body){
        expect(body.handle).to.equal(mock.job.handle)
        expect(body.priority).to.equal(mock.job.priority)
        expect(body.category).to.equal(mock.job.category)
      })
  }
}


/**
 * Job detail
 * @param {object} prism
 * @return {Function}
 */
exports.jobDetail = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client.postAsync({
      url: client.url('/job/detail'),
      localAddress: '127.0.0.1',
      json: {
        handle: mock.job.handle
      }
    })
      .spread(function(res,body){
        expect(body.handle).to.equal(mock.job.handle)
        expect(body.priority).to.equal(mock.job.priority)
        expect(body.category).to.equal(mock.job.category)
        expect(body.status).to.equal(mock.job.status)
      })
  }
}


/**
 * Job update
 * @param {object} prism
 * @return {Function}
 */
exports.jobUpdate = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client.postAsync({
      url: client.url('/job/update'),
      localAddress: '127.0.0.1',
      json: {
        handle: mock.job.handle,
        priority: 5
      }
    })
      .spread(function(res,body){
        expect(body.handle).to.equal(mock.job.handle)
        expect(body.priority).to.equal(5)
      })
  }
}


/**
 * Job remove
 * @param {object} prism
 * @return {Function}
 */
exports.jobRemove = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client.postAsync({
      url: client.url('/job/remove'),
      localAddress: '127.0.0.1',
      json: {
        handle: mock.job.handle
      }
    })
      .spread(function(res,body){
        expect(body.success).to.equal('Job removed')
        expect(body.count).to.equal(1)
      })
  }
}


/**
 * Job Start
 * @param {object} prism
 * @return {Function}
 */
exports.jobStart = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client.postAsync({
      url: client.url('/job/start'),
      localAddress: '127.0.0.1',
      json: {
        handle: mock.job.handle
      }
    })
      .spread(function(res,body){
        expect(body.handle).to.equal(mock.job.handle)
        expect(body.status).to.equal('queued')
      })
  }
}


/**
 * Job Retru
 * @param {object} prism
 * @return {Function}
 */
exports.jobRetry = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client.postAsync({
      url: client.url('/job/retry'),
      localAddress: '127.0.0.1',
      json: {
        handle: mock.job.handle
      }
    })
      .spread(function(res,body){
        expect(body.handle).to.equal(mock.job.handle)
        expect(body.status).to.equal('queued_retry')
      })
  }
}


/**
 * Job Abort
 * @param {object} prism
 * @return {Function}
 */
exports.jobAbort = function(prism){
  return function(){
    var client = api.setSession(
      exports.user.session,api.setupAccess('prism',prism.prism))
    return client.postAsync({
      url: client.url('/job/abort'),
      localAddress: '127.0.0.1',
      json: {
        handle: mock.job.handle
      }
    })
      .spread(function(res,body){
        expect(body.handle).to.equal(mock.job.handle)
        expect(body.status).to.equal('queued_abort')
      })
  }
}
