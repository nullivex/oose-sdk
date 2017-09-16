'use strict';
var P = require('bluebird')
var expect = require('chai').expect
var fs = require('fs')

//var mock = require('../mock')
var nano = require('../helpers/couchdb')
var mockJob = require('../mock/helpers/job')
var Shredder = require('../helpers/Shredder')
var mockSession = require('../mock/helpers/session');


/**
 * Prevent crashing on bad SSL certs
 * @type {string}
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

var mockConfig = {
  port: 5984,
  host: '127.0.0.1',
  database: 'shredder',
  options: {
    auth: {
      username: 'shredder',
      password: 'shredder'
    }
  }
}

//setup local nano client for controlling tests
nano = nano(mockConfig)

var mockShredderConfig = {
  server: {
    port: 5980,
    host: '127.0.0.1',
    database: 'shredder'
  },
  worker: {
    _id: 'fake',
    name:'fake',
    type: 'worker',
    available: true,
    active: true,
    host: '127.0.0.1',
    port: 5981
  }
}

describe('Shredder',function(){
  var shredder = {}
  var handle
  //spin up an entire cluster here
  this.timeout(3000)
  //start servers and create a user
  before(function(){
    shredder = new Shredder(mockConfig)
    shredder.couchSession = mockSession
    return shredder.login()
      .then(function(){
        //create views
        return P.all([
          nano.shredder.insertAsync(
            JSON.parse(fs.readFileSync('./test/design/jobs.json')),
            '_design/jobs'
          )
            .catch(function(err){
              if('Document update conflict.' !== err.message) throw err
            }),
          nano.shredder.insertAsync(
            JSON.parse(fs.readFileSync('./test/design/workers.json')),
            '_design/workers'
          )
            .catch(function(err){
              if('Document update conflict.' !== err.message) throw err
            })
        ])
      })
      .then(function(){
        //create worker
        return nano.shredder.insertAsync(mockShredderConfig.worker)
      })
  })
  //remove user and stop services
  after(function(){
    return shredder.logout()
      .then(function(){
        //destroy worker
        return nano.shredder.getAsync(mockShredderConfig.worker._id)
      })
      .then(function(result){
        return nano.shredder.destroyAsync(result._id,result._rev)
      })
  })
  it('should reset the password',function(){
    return shredder.passwordReset()
      .then(function(result){
        expect(result.password).to.equal('Reset')
      })
  })
  it('should create a job',function(){
    return shredder.jobCreate(mockJob.description)
      .then(function(result){
        expect(result).to.have.property('handle')
        handle = result.handle
        expect(result.status).to.equal('staged')
      })
  })
  it('should get job details',function(){
    return shredder.jobDetail(handle)
      .then(function(result){
        expect(result.handle).to.equal(handle)
      })
  })
  it('should not update a job if not forced',function(){
    return shredder.jobUpdate(handle,{status: 'complete'})
      .then(function(result){
        expect(result.handle).to.equal(handle)
        expect(result.status).to.equal('staged')
      })
  })
  it('should update a job',function(){
    return shredder.jobUpdate(handle,{priority: 10},true)
      .then(function(result){
        expect(result.handle).to.equal(handle)
        expect(result.priority).to.equal(10)
      })
  })
  it('should start a job',function(){
    return shredder.jobStart(handle)
      .then(function(result){
        expect(result.handle).to.equal(handle)
        expect(result.status).to.equal('queued')
      })
  })
  it('should retry a job',function(){
    return nano.shredder.getAsync(handle)
      .then(function(result){
        result.status = 'processing'
        return nano.shredder.insertAsync(result)
      })
      .then(function(){
        return shredder.jobRetry(handle)
      })
      .then(function(result){
        expect(result.handle).to.equal(handle)
        expect(result.status).to.equal('queued_retry')
      })
  })
  it('should abort a job',function(){
    return nano.shredder.getAsync(handle)
      .then(function(result){
        result.status = 'processing'
        return nano.shredder.insertAsync(result)
      })
      .then(function(){
        return shredder.jobAbort(handle)
      })
      .then(function(result){
        expect(result.handle).to.equal(handle)
        expect(result.status).to.equal('queued_abort')
      })
  })
  it('should remove a job',function(){
    return shredder.jobRemove(handle)
      .then(function(result){
        expect(result.success).to.equal('Job removed')
        expect(result.count).to.equal(1)
      })
  })

  it('should check if content exists',function(){
    return nano.shredder.getAsync(handle)
      .then(function(result){
        result.status = 'complete'
        result.worker = mockShredderConfig.worker.name
        return nano.shredder.insertAsync(result)
      })
      .then(function(){
        return shredder.jobContentExists(handle,'video.mp4')
      })
      .then(function(result){
        expect(result).to.equal(true)
      })
      .catch(function(err){
        expect(err.message).to.equal('connect ECONNREFUSED 127.0.0.1:5981')
      })
  })

  it('should generate a content download url',function(){
    return shredder.jobContentUrl(handle,'video.mp4').then(function(url){
      expect(url).to.equal(
        'https://127.0.0.1:5981/job/content/download/' +
        handle + '/video.mp4'
      )
    })
  })

  it('should connect with a session key',function(){
      var token = mockSession.getToken()
      var shredder = new Shredder().setSession(token)
      shredder.couchSession = mockSession
      return shredder.connect(mockConfig.host,mockConfig.port)
        .then(function(){
          return shredder.jobContentExists(handle,'video.mp4')
        })
        .then(function(result){
          expect(result).to.equal(true)
        })
        .catch(function(err){
          expect(err.message).to.equal('connect ECONNREFUSED 127.0.0.1:5981')
        })
  })
})
