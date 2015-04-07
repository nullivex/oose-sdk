'use strict';
var P = require('bluebird')
var expect = require('chai').expect
var express = require('express')
var https = require('https')

var mock = require('../mock')

//prevent bad cert errors during testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

var app = express()
var server = https.createServer(
  {
    cert: mock.sslOptions.pem,
    key: mock.sslOptions.pem
  },
  app
)

//make some promises
P.promisifyAll(server)

app.post('/valid',function(req,res){
  res.json({success: 'valid'})
})
app.post('/invalid',function(req,res){
  res.json({error: 'invalid'})
})
app.post('/invalid-code/invalid',function(req,res){
  res.status(401)
  res.json({error: 'invalid'})
})
app.post('/invalid-code/valid',function(req,res){
  res.status(401)
  res.json({success: 'valid'})
})


var api = require('../helpers/api')
var NetworkError = require('../helpers/NetworkError')
var UserError = require('../helpers/UserError')

var throwError = function(message){
  throw new Error(message)
}

var testNetworkErrorCatch = function(message){
  return function(){
    try {
      try {
        throwError(message)
      } catch(e){
        api.handleNetworkError(e)
      }
    } catch(e){
      expect(e).to.be.an.instanceOf(NetworkError)
      expect(e.stack).to.match(/api\.test\.js:\d+/)
    }
  }
}


describe('api:NetworkError',function(){
  for(var i = 0; i < api.tcpErrors.length; i++){
    it('should catch tcp error ' + api.tcpErrors[i],
      testNetworkErrorCatch(api.tcpErrors[i]))
  }
  it('should not catch regular errors',function(){
    try {
      try {
        throwError('foo')
      } catch(e){
        api.handleNetworkError(e)
      }
    } catch(e){
      expect(e).to.not.be.an.instanceOf(NetworkError)
      expect(e.stack).to.match(/api\.test\.js:\d+/)
    }
  })
})

describe('api:validateResponse',function(){
  var client = api.master({
    host: '127.0.0.1',
    port: 5978
  })
  before(function(){
    return server.listenAsync(5978,'127.0.0.1')
  })
  after(function(){
    return server.closeAsync()
  })
  it('should hand back valid responses',function(){
    return client.postAsync(client.url('/valid'))
      .spread(client.validateResponse())
      .spread(function(res,body){
        expect(body.success).to.equal('valid')
      })
  })
  it('should throw errors',function(){
    return client.postAsync(client.url('/invalid'))
      .spread(client.validateResponse())
      .spread(function(){
        throw new Error('Error was not thrown')
      })
      .catch(UserError,function(err){
        expect(err.message).to.equal('invalid')
      })
  })
  it('should throw the error on error, invalid response codes',function(){
    return client.postAsync(client.url('/invalid-code/invalid'))
      .spread(client.validateResponse())
      .spread(function(){
        throw new Error('Error was not thrown')
      })
      .catch(UserError,function(err){
        expect(err.message).to.equal('invalid')
      })
  })
  it('should throw the body on success, invalid response codes',function(){
    return client.postAsync(client.url('/invalid-code/valid'))
      .spread(client.validateResponse())
      .spread(function(){
        throw new Error('Error was not thrown')
      })
      .catch(UserError,function(err){
        expect(err.message).to.equal(
          'Invalid response (401) to ' +
          'https://127.0.0.1:5978/invalid-code/valid ' +
          'body: { success: \'valid\' }'
        )
      })
  })
})
