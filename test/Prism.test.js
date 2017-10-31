'use strict';
var P = require('bluebird')
var expect = require('chai').expect
var express = require('express')
var http = require('http')
var path = require('path')

var mock = require('../mock')
var Prism = require('../helpers/Prism')


/**
 * Suppress warnings for bad ssl certs
 * @type {string}
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

var mockConfig = {
  prism: {
    port: 5971,
    host: '127.0.0.1'
  }
}

var mockServerConfig = {
  port: 3001,
  host: '127.0.0.1'
}

//setup a mock server to download a file from
var app = express()
var server = http.createServer(app)

app.get('/' + mock.content.filename,function(req,res){
  var file = path.resolve(mock.content.file)
  res.sendFile(file)
})

//make some promises
P.promisifyAll(server)

describe('Prism',function(){
  var prism = {}
  //spin up an entire cluster here
  this.timeout(3000)
  //start servers and create a user
  before(function(){
    prism = new Prism({
      username: mock.user.username,
      password: mock.user.password
    })
    return mock.start(mockConfig.prism.port,mockConfig.prism.host)
      .then(function(){
        return prism.connect(mockConfig.prism.host,mockConfig.prism.port)
      })
      .then(function(){
        return server.listenAsync(mockServerConfig.port,mockServerConfig.host)
      })
      .then(function(){
        return prism.login()
      })
  })
  //remove user and stop services
  after(function(){
    return prism.logout()
      .then(function(){
        return P.all([
          mock.stop(),
          server.closeAsync()
        ])
      })
  })
  it('should prepare a request object',function(){
    return prism.prepare()
      .then(function(client){
        expect(client.options.host).to.equal(mockConfig.prism.host)
        expect(client.options.port).to.equal(mockConfig.prism.port)
      })
  })
  it('should get content detail',function(){
    return prism.contentDetail(mock.content.hash)
      .then(function(result){
        expect(result.hash).to.equal(mock.content.hash)
      })
  })
  it('should upload content',function(){
    return prism.contentUpload(mock.content.file)
      .then(function(result){
        expect(result.files.file.hash).to.equal(mock.content.hash)
      })
  })
  it('should retrieve content',function(){
    return prism.contentRetrieve({
      url: 'http://' + mockServerConfig.host +
        ':' + mockServerConfig.port + '/' + mock.content.filename
    })
      .then(function(result){
        expect(result.hash).to.equal(mock.content.hash)
      })
  })
  it('should purchase content',function(){
    return prism.contentPurchase(
      mock.content.hash,mock.content.ext,['foo'],mock.purchase.life)
      .then(function(result){
        expect(result.token).to.equal(mock.purchase.token)
      })
  })
  it('should remove a purchase',function(){
    return prism.contentPurchaseRemove(mock.purchase.token)
      .then(function(result){
        expect(result.token).to.equal(mock.purchase.token)
      })
  })
  it('should output a purchase url',function(){
    var url = prism.urlPurchase(mock.purchase)
    expect(url).to.equal(
      '//' + prism.opts.domain + '/' +
      mock.purchase.token + '/' + 'video.' + mock.purchase.ext
    )
  })
  it('should output a static url',function(){
    var url = prism.urlStatic(mock.content.hash,mock.content.ext)
    expect(url).to.equal(
      '//' + prism.opts.domain + '/static/' +
      mock.content.hash + '/file.' + mock.content.ext
    )
  })
  it('should connect with a session key',function(){
    var prism = new Prism().setSession(mock.user.session.token)
    return prism.connect(mockConfig.prism.host,mockConfig.prism.port)
      .then(function(){
        return prism.contentDetail(mock.content.hash)
      })
      .then(function(result){
        expect(result).to.be.an('object')
      })
  })
  describe('Prism:job',function(){
    it('should create a job',function(){
      return prism.jobCreate(mock.job.description)
        .then(function(result){
          expect(result.handle).to.equal(mock.job.handle)
        })
    })
    it('should get job details',function(){
      return prism.jobDetail(mock.job.handle)
        .then(function(result){
          expect(result.handle).to.equal(mock.job.handle)
        })
    })
    it('should update a job',function(){
      return prism.jobUpdate(mock.job.handle,{status: 'complete'})
        .then(function(result){
          expect(result.handle).to.equal(mock.job.handle)
          expect(result.status).to.equal('complete')
        })
    })
    it('should remove a job',function(){
      return prism.jobRemove(mock.job.handle)
        .then(function(result){
          expect(result.success).to.equal('Job removed')
          expect(result.count).to.equal(1)
        })
    })
    it('should start a job',function(){
      return prism.jobStart(mock.job.handle)
        .then(function(result){
          expect(result.handle).to.equal(mock.job.handle)
          expect(result.status).to.equal('queued')
        })
    })
    it('should retry a job',function(){
      return prism.jobRetry(mock.job.handle)
        .then(function(result){
          expect(result.handle).to.equal(mock.job.handle)
          expect(result.status).to.equal('queued_retry')
        })
    })
    it('should abort a job',function(){
      return prism.jobAbort(mock.job.handle)
        .then(function(result){
          expect(result.handle).to.equal(mock.job.handle)
          expect(result.status).to.equal('queued_abort')
        })
    })
    it('should check if content exists',function(){
      return prism.jobContentExists(mock.job.handle,'video.mp4')
        .then(function(result){
          expect(result).to.equal(false)
        })
    })
    it('should generate a content download url',function(){
      var url = prism.jobContentUrl(mock.job.handle,'video.mp4')
      expect(url).to.equal(
        'https://' + mockConfig.prism.host + ':' +
        mockConfig.prism.port + '/job/content/download/' +
        mock.job.handle + '/video.mp4'
      )
    })
  })
})
