'use strict';

var jobDescription = {
  callback: {
    request: {
      url: 'http://localhost:3000/shredder'
    }
  },
  resource: [
    {
      name: 'google.html',
      request: {
        url: 'http://www.google.com'
      }
    }
  ]
}


/**
 * Test job
 * @type {{file: string, sha1: string}}
 */
module.exports = {
  handle: '46QBCxtvJs3A',
  description: jobDescription,
  descriptionRaw: jobDescription,
  priority: 10,
  category: 'resource',
  status: 'queued',
  statusDescription: 'Waiting to start',
  stepTotal: 1,
  stepComplete: 0,
  frameTotal: 1,
  frameComplete: 0,
  frameDescription: 'Waiting to start',
  UserId: 1
}
