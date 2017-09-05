oose-sdk [![Build Status](https://travis-ci.org/nullivex/oose-sdk.svg?branch=master)](https://travis-ci.org/nullivex/oose-sdk)
========

OOSE Software Development Kit

## API Usage

```
$ npm install oose-sdk --save
```

```js
'use strict';
var oose = require('oose-sdk')

oose.api.updateConfig({
  prism: {
    host: 'prism.oose.io',
    port: 5972
  }
})

//store the user session
var session = {}

//setup our api and login
var prism = oose.api.prism()
prism.postAsync({
  url: prism.url('/user/login'),
  json: {
    username: 'myusername',
    password: 'mypassword'
  }
})
  .spread(prism.validateResponse())
  .spread(function(res,body){
    console.log(body)
    session = body.session
  })
  .catch(prism.handleNetworkError)
  .catch(oose.NetworkError,function(err){
    console.log('A network error occurred: ' + err.message)
  })
```

## Mock Usage

```js
'use strict';
var oose = require('oose-sdk')

oose.api.updateConfig({
  prism: {
    port: 3001,
    host: '127.0.0.1'
  }
})

describe('my test',function(){
  before(function(){
    return oose.mock.start(3001,'127.0.0.1')
  })
  after(function(){
    return oose.mock.stop()
  })
  it('should be up',function(){
    var prism = oose.api.prism()
    return prism.postAsync(prism.url('/ping'))
      .spread(function(res,body){
        expect(body.pong).to.equal('pong')
      })
  })
})
```

## Changelog

### 2.2.0
* Drop old access setup shortcuts that were related dynamic services
* BREAKING CHANGE: api.prism(), api.store() need to replaced with
api.setupAccess('prism',config.prism) and api.setupAccess('store',config.store)

### 2.1.0
* Update dependencies and bluebird implementation

### 2.0.2
* URL builder helpers no longer produce protocol forced URLs such as (http://)

### 2.0.1
* Fix issue with keygen passing configuration params
* Fix issue with Prism class wrongfully falling back on configuration params

### 2.0.0
* Update packages and dependencies
* Drop API methods removed in OOSE 2.0.0
 * `passwordReset`

### 1.4.1

* Remove a mistakenly left console log.

### 1.4.0

* Upgraded to run with node 4.x
* Skipped version 1.3.x to match the main OOSE release of 1.4.0
* Upgraded all dependencies
* Fixed bug that causes timeout `msecs not a number issue`

### 1.2.0
* Purchases now require the file extension and will no longer supply it this
is a breaking change to all integrations.

### 1.1.10
* Since node has started checking SSL certs without giving the user a chance
to intervene we  have to set `rejectUnauthorized: false` by default now. Have
also had to add `process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0` unfortunately.

### 1.1.9
* Fix issues using latest version of node request.

### 1.1.8
* Use the domain to make prism requests to that SSL will validate properly.

### 1.1.7
* Fixed issue with keygen getting installed as the `ndt` command

### 1.1.6
* Enable sticky session support.
* Add helper for generating session keys.
* Prism login now takes username and password at call time `prism.login(un,pw)`

### 1.1.5
* Drop user session timeout, they are now sticky

### 1.1.4
* Fix and test error handling for validateResponse
* Change default maxSocket to Infinity
* Add session token name to setupSession call instead of config

### 1.1.3
* Increase default max sockets

### 1.1.2
* Expose more of the API subsystem so it can be extended properly

### 1.1.1
* Actually export Prism helper
* Added `urlPurchase` and `urlStatic` to Prism helper

### 1.1.0
* Added `Prism` helpers to access Prisms
* Added testing for new `Prism` helper
* Added `/content/retrieve`
* Added `/user/session/renew`

### 1.0.11
* Add `socket hang up` to Network error messages

### 1.0.10
* Add missing error message `ESOCKETTIMEDOUT`

### 1.0.9
* `api.handleNetworkError()` now handles all TCP/IP unix errors
* `api.handleNetworkError()` now maintains the original stack trace
* Added testing for `api.handleNetworkError()`

### 1.0.8
* Upgrade error objects with bluebird standards

### 1.0.7
* Bug fix to `api.handleNetworkError()`

### 1.0.6
* Better error catching in `api.handleNetworkError()`

### 1.0.5
* SSL uses PEM instead of crt/key

### 1.0.4
* Request wasn'st included as a dependency (was a dev dependency)

### 1.0.3
* Fix typo in ssl options

### 1.0.2
* Fixed issue with ssl options being populated by http server
* Remove preceding slash on content.relativePath

### 1.0.1
* Fix missing package for api helper

### 1.0.0
* Initial Release
