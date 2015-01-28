'use strict';



/**
 * NotFoundError Error Object
 * @param {string} message
 * @constructor
 */
function NotFoundError(message) {
  this.message = message;
  this.name = 'NotFoundError'
  Error.captureStackTrace(this,NotFoundError)
}
NotFoundError.prototype = Object.create(Error.prototype)


/**
 * Set constructor for prototype
 * @type {NotFoundError}
 */
NotFoundError.prototype.constructor = NotFoundError


/**
 * Export the Error
 * @type {Function}
 */
module.exports = NotFoundError
