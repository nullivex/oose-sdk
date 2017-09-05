'use strict';
var e2e = require('./helpers/e2e')
var mock = require('../mock')


/**
 * Suppress bad cert warnings we only need SSL for the TLS
 * @type {string}
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

var mockConfig = {
  prism: {
    port: 3000,
    host: '127.0.0.1'
  }
}

describe('mock',function(){
  //spin up an entire cluster here
  this.timeout(3000)
  //start servers and create a user
  before(function(){
    return mock.start(mockConfig.prism.port,mockConfig.prism.host)
  })
  //remove user and stop services
  after(function(){
    return mock.stop()
  })
  it('mock should be up',e2e.checkUp('prism',mockConfig))
  it('should not require authentication for public functions',
    e2e.checkPublic(mockConfig))
  it('should require a session for all protected prism functions',
    e2e.checkProtected(mockConfig))
  it('should login',function(){
    return e2e.prismLogin(mockConfig)()
      .then(function(session){
        e2e.user.session = session
      })
  })

  it('should upload content',e2e.contentUpload(mockConfig))

  it('should show content detail publicly',
    e2e.contentDetail(mockConfig))

  it('should allow purchase of the content',function(){
    return e2e.contentPurchase(mockConfig)()
      .then(function(result){
        e2e.purchase = result
      })
  })

  it('should accept a purchased URL and deliver content on prism1',
    e2e.contentDeliver(mockConfig))

  it('should allow removal of purchases',
    e2e.contentPurchaseRemove(mockConfig))

  it('should log out',e2e.prismLogout(mockConfig,mock.user.session))

})
