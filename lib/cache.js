
"use strict";

var LRUCache = require('./lru');

/**
 * Api cache
 */
function ApiCache(limit) {
  this.lru = new LRUCache(limit);
}

ApiCache.prototype = {

  get: function(key, cb) {
    var maybeEntry = this.lru.get(key);
    if(maybeEntry && !this.isExpired(key)) {
      return cb(null, maybeEntry.data);
    }
    return cb();
  },

  set: function(key, value, ttl, cb) {
    this.lru.remove(key);
    this.lru.put(key, {
      data: value,
      expiredIn: ttl ? (Date.now() + (ttl * 1000)) : 0
    });

    return cb();
  },

  isExpired: function(key) {
    var entry = this.lru.get(key);
    if(entry) {
      return entry.expiredIn !== 0 && entry.expiredIn < Date.now();
    } else {
      return false;
    }
  },

  remove: function(key, cb) {
    this.lru.remove(key);
    return cb();
  },

  clear: function(cb) {
    this.lru.removeAll();
    return cb();
  }
};

module.exports = ApiCache;
