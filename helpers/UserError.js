'use strict';
var util = require('util')



/**
 * Userspace Error Object
 * @param {string} message
 * @constructor
 */
var UserError = function(message){
  Error.apply(this,arguments)
  this.message = '' + message
}
util.inherits(UserError,Error)


/**
 * Export the Error
 * @type {Function}
 */
module.exports = UserError
