'use strict';
var util = require('util')



/**
 * NetworkError Error Object
 * @param {string} message
 * @constructor
 */
var NetworkError = function(message){
  Error.apply(this,arguments)
  this.message = '' + message
}
util.inherits(NetworkError,Error)


/**
 * Export the Error
 * @type {Function}
 */
module.exports = NetworkError
