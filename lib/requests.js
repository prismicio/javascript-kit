
"use strict";

var createError = function(status, message) {
  var err = new Error(message);
  err.status = status;
  return err;
};

// -- Request handlers

var ajaxRequest = (function() {
  if(typeof XMLHttpRequest != 'undefined' && 'withCredentials' in new XMLHttpRequest()) {
    return function(url, callback) {

      var xhr = new XMLHttpRequest();

      // Called on success
      var resolve = function() {
        var ttl, cacheControl = /max-age\s*=\s*(\d+)/.exec(
          xhr.getResponseHeader('Cache-Control'));
        if (cacheControl && cacheControl.length > 1) {
          ttl = parseInt(cacheControl[1], 10);
        }
        callback(null, JSON.parse(xhr.responseText), xhr, ttl);
      };

      // Called on error
      var reject = function() {
        var status = xhr.status;
        callback(createError(status, "Unexpected status code [" + status + "] on URL "+url), null, xhr);
      };

      // Bind the XHR finished callback
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if(xhr.status && xhr.status == 200) {
            resolve();
          } else {
            reject();
          }
        }
      };

      // Open the XHR
      xhr.open('GET', url, true);

      // Kit version (can't override the user-agent client side)
      // xhr.setRequestHeader("X-Prismic-User-Agent", "Prismic-javascript-kit/%VERSION%".replace("%VERSION%", Global.Prismic.version));

      // Json request
      xhr.setRequestHeader('Accept', 'application/json');

      // Send the XHR
      xhr.send();
    };
  }
  return null;
});

var xdomainRequest = (function() {
  if(typeof XDomainRequest != 'undefined') { // Internet Explorer
    return function(url, callback) {

      var xdr = new XDomainRequest();

      // Called on success
      var resolve = function() {
        callback(null, JSON.parse(xdr.responseText), xdr, 0);
      };

      // Called on error
      var reject = function(msg) {
        callback(new Error(msg), null, xdr);
      };

      // Bind the XDR finished callback
      xdr.onload = function() {
        resolve(xdr);
      };

      // Bind the XDR error callback
      xdr.onerror = function() {
        reject("Unexpected status code on URL " + url);
      };

      // Open the XHR
      xdr.open('GET', url, true);

      // Bind the XDR timeout callback
      xdr.ontimeout = function () {
        reject("Request timeout");
      };

      // Empty callback. IE sometimes abort the reqeust if
      // this is not present
      xdr.onprogress = function () { };

      xdr.send();
    };
  }
  return null;
});


// The experimental fetch API, required by React Native for example.
// We still use browser requests by default because there could be an
// incomplete polyfill in the context (lacking CORS for example)
var fetchRequest = (function() {
  if (typeof fetch == "function") {
    var pjson = require('../package.json');
    return function(requestUrl, callback) {
      fetch(requestUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Prismic-javascript-kit/' + pjson.version + " NodeJS/" + process.version
        }
      }).then(function (response) {
        if (~~(response.status / 100 != 2)) {
          throw new createError(response.status, "Unexpected status code [" + response.status + "] on URL " + requestUrl);
        } else {
          return response.json().then(function(json) {
            return {
              response: response,
              json: json
            };
          });
        }
      }).then(function(next) {
        var response = next.response;
        var json = next.json;
        var cacheControl = response.headers['cache-control'];
        var ttl = cacheControl && /max-age=(\d+)/.test(cacheControl) ? parseInt(/max-age=(\d+)/.exec(cacheControl)[1], 10) : undefined;
        callback(null, json, response, ttl);
      }).catch(function (error) {
        callback(error);
      });
    };
  }
  return null;
});

var nodeJSRequest = (function() {
  if(typeof require == 'function' && require('http')) {
    var http = require('http'),
        https = require('https'),
        url = require('url'),
        pjson = require('../package.json');

    return function(requestUrl, callback) {
      var parsed = url.parse(requestUrl),
          h = parsed.protocol == 'https:' ? https : http,
          options = {
            hostname: parsed.hostname,
            path: parsed.path,
            query: parsed.query,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Prismic-javascript-kit/' + pjson.version + " NodeJS/" + process.version
            }
          };

      if (!requestUrl) {
        var e = new Error('dummy');
        var stack = e.stack.replace(/^[^\(]+?[\n$]/gm, '')
              .replace(/^\s+at\s+/gm, '')
              .replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@')
              .split('\n');
        console.log(stack);
      }
      var request = h.get(options, function(response) {
        if (response.statusCode && response.statusCode == 200) {
          var jsonStr = '';

          response.setEncoding('utf8');
          response.on('data', function (chunk) {
            jsonStr += chunk;
          });

          response.on('end', function () {
            var json;
            try {
              json = JSON.parse(jsonStr);
            } catch (ex) {
              console.log("Failed to parse json: " + jsonStr, ex);
            }
            var cacheControl = response.headers['cache-control'];
            var ttl = cacheControl && /max-age=(\d+)/.test(cacheControl) ? parseInt(/max-age=(\d+)/.exec(cacheControl)[1], 10) : undefined;

            callback(null, json, response, ttl);
          });
        } else {
          callback(createError(response.statusCode, "Unexpected status code [" + response.statusCode + "] on URL "+requestUrl), null, response);
        }
      });

      // properly handle timeouts
      request.on('error', function(err) {
        callback(new Error("Unexpected error on URL "+requestUrl), null, err);
      });


    };
  }
  return null;
});

// Number of maximum simultaneous connections to the prismic server
var MAX_CONNECTIONS = 20;
// Number of requests currently running (capped by MAX_CONNECTIONS)
var running = 0;
// Requests in queue
var queue = [];

var processQueue = function() {
  if (queue.length === 0 || running >= MAX_CONNECTIONS) {
    return;
  }
  running++;
  var next = queue.shift();
  var fn = ajaxRequest() || xdomainRequest() || fetchRequest() || nodeJSRequest() ||
        (function() { throw new Error("No request handler available (tried XMLHttpRequest, fetch & NodeJS)"); })();
  fn.call(this, next.url, function(error, result, xhr, ttl) {
    running--;
    next.callback(error, result, xhr, ttl);
    processQueue();
  });
};

var request = function (url, callback) {
  queue.push({
    'url': url,
    'callback': callback
  });
  processQueue();
};

module.exports = {
  MAX_CONNECTIONS: MAX_CONNECTIONS, // Number of maximum simultaneous connections to the prismic server
  request: request
};
