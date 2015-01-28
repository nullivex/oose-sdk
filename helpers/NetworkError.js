'use strict';



/**
 * NetworkError Error Object
 * @param {string} message
 * @constructor
 */
function NetworkError(message) {
  this.message = message;
  this.name = 'NetworkError'
  Error.captureStackTrace(this,NetworkError)
}
NetworkError.prototype = Object.create(Error.prototype)


/**
 * Set constructor for prototype
 * @type {NetworkError}
 */
NetworkError.prototype.constructor = NetworkError


/**
 * Export the Error
 * @type {Function}
 */
module.exports = NetworkError
