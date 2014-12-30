'use strict';
var util = require('util')



/**
 * Userspace Error Object
 * @param {string} message
 * @constructor
 */
var NotFoundError = function(message){
  Error.apply(this,arguments)
  this.message = '' + message
}
util.inherits(NotFoundError,Error)


/**
 * Export the Error
 * @type {Function}
 */
module.exports = NotFoundError
