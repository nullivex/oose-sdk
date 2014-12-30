'use strict';


/**
 * Mock content exists
 * @type {object}
 */
module.exports = {
  sha1: 'a03f181dc7dedcfb577511149b8844711efdb04f',
  exists: true,
  count: 2,
  map: {
    prism1: {
      exists: true,
      count: 1,
      map: {
        store1: true,
        store2: false
      }
    },
    prism2: {
      exists: true,
      count: 1,
      map: {
        store3: true,
        store4: false
      }
    }
  }
}
