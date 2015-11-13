'use strict';
var content = require('./content')


/**
 * Mock purchase
 * @type {object}
 */
module.exports = {
  sha1: content.sha1,
  ext: content.ext,
  token: '27p5Ujk4xNRqdj1anKb4128GWu7b8n30p8FN3wJk1VS4aMD7Bf5Ad21DU67U11Cl',
  sessionToken:
    'oGVWBp30n2OW62aHG6H0Esc14Sw78nPx0pKG7pyX7vE4k4eGgvT2SbQ7buPjusk6',
  life: 21600,
  referrer: ['localhost'],
  ip: '127.0.0.1',
  map: {
    exists: true,
    count: 2,
    map: ['prism1:store1','prism2:store3']
  }
}
