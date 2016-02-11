'use strict';

// IE below 12 doesn't support promises
require('es6-promise').polyfill();

// Polyfill for inheritance
if (typeof Object.create != 'function') {
  Object.create = (function() {
    var Object = function() {};
    return function (prototype) {
      if (arguments.length > 1) {
        throw Error('Second argument not supported');
      }
      if (typeof prototype != 'object') {
        throw TypeError('Argument must be an object');
      }
      Object.prototype = prototype;
      var result = {};
      Object.prototype = null;
      return result;
    };
  })();
}

window.Prismic = require('./prismic');
