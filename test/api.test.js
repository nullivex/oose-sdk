'use strict';
var expect = require('chai').expect

var api = require('../helpers/api')
var NetworkError = require('../helpers/NetworkError')

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
      expect(e.stack).to.match(/api\.test\.js:8/)
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
      expect(e.stack).to.match(/api\.test\.js:8/)
    }
  })
})
