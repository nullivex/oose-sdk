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
var P = require('bluebird')
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
    var client = api[type](server[type])
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
    var client = api[type](server[type])
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
    var client = api.prism(prism.prism)
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
      .catch(UserError,function(err){
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
    var client = api.prism(prism.prism)
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
    var client = api.prism(prism.prism)
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
    var client = api.setSession(session,api.prism(prism.prism))
    return client.postAsync({
      url: client.url('/user/logout'),
      localAddress: '127.0.0.1'
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
    var client = api.setSession(exports.user.session,api.prism(prism.prism))
    return client
      .postAsync({
        url: client.url('/content/upload'),
        formData: {
          file: fs.createReadStream(content.file)
        },
        localAddress: '127.0.0.1'
      })
      .spread(function(res,body){
        expect(body.files.file.sha1).to.equal(content.sha1)
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
    var client = api.setSession(exports.user.session,api.prism(prism.prism))
    return client
      .postAsync({
        url: client.url('/content/detail'),
        json: {sha1: content.sha1},
        localAddress: '127.0.0.1'
      })
      .spread(function(res,body){
        expect(body.sha1).to.equal(content.sha1)
        expect(body.count).to.be.greaterThan(0)
        expect(body.exists).to.equal(true)
        expect(body.map).to.be.an('object')
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
    var client = api.setSession(exports.user.session,api.prism(prism.prism))
    return client
      .postAsync({
        url: client.url('/content/purchase'),
        json: {
          sha1: content.sha1,
          ip: '127.0.0.1',
          referrer: ['localhost']
        },
        localAddress: '127.0.0.1'
      })
      .spread(function(res,body){
        expect(body.token.length).to.equal(64)
        expect(body.ext).to.equal('txt')
        expect(body.life).to.equal(21600)
        expect(body.sha1).to.equal(content.sha1)
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
    var client = api.prism(prism.prism)
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
    var client = api.setSession(exports.user.session,api.prism(prism.prism))
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
