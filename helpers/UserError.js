'use strict';



/**
 * UserError Error Object
 * @param {string} message
 * @constructor
 */
function UserError(message) {
  this.message = message;
  this.name = 'UserError'
  Error.captureStackTrace(this,UserError)
}
UserError.prototype = Object.create(Error.prototype)


/**
 * Set constructor for prototype
 * @type {UserError}
 */
UserError.prototype.constructor = UserError


/**
 * Export the Error
 * @type {Function}
 */
module.exports = UserError
