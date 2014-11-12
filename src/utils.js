(function (Global, undefined) {

    "use strict";

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
                    callback(new Error("Unexpected status code [" + status + "] on URL "+url), null, xhr);
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
    });

    var xdomainRequest = (function() {
        if(typeof XDomainRequest != 'undefined') {
            return function(url, callback) {

                var xdr = new XDomainRequest();

                // Called on success
                var resolve = function() {
                    var ttl, cacheControl = /max-age\s*=\s*(\d+)/.exec(
                        xhr.getResponseHeader('Cache-Control'));
                    if (cacheControl && cacheControl.length > 1) {
                        ttl = parseInt(cacheControl[1], 10);
                    }
                    callback(null, JSON.parse(xdr.responseText), xdr, ttl);
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
    });

    var nodeJSRequest = (function() {
        if(typeof require == 'function' && require('http')) {
            var http = require('http'),
                https = require('https'),
                url = require('url'),
                querystring = require('querystring'),
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

                h.get(options, function(response) {
                    if(response.statusCode && response.statusCode == 200) {
                        var jsonStr = '';

                        response.setEncoding('utf8');
                        response.on('data', function (chunk) {
                            jsonStr += chunk;
                        });

                        response.on('end', function () {
                          var json = JSON.parse(jsonStr);
                          var cacheControl = response.headers['cache-control'];
                          var ttl = cacheControl && /max-age=(\d+)/.test(cacheControl) ? parseInt(/max-age=(\d+)/.exec(cacheControl)[1], 10) : undefined;

                          callback(null, json, response, ttl);
                        });
                    } else {
                        callback(new Error("Unexpected status code [" + response.statusCode + "] on URL "+requestUrl), null, response);
                    }
                });
            };
        }
    });

    // Number of requests currently running (capped by MAX_CONNECTIONS)
    var running = 0;
    // Requests in queue
    var queue = [];

    var processQueue = function() {
        if (queue.length === 0 || running >= Global.Prismic.Utils.MAX_CONNECTIONS) {
            return;
        }
        running++;
        var next = queue.shift();
        var fn = ajaxRequest() || xdomainRequest() || nodeJSRequest() ||
            (function() {throw new Error("No request handler available (tried XMLHttpRequest & NodeJS)");})();
        fn.call(this, next.url, function(error, result, xhr, ttl) {
            running--;
            next.callback(error, result, xhr, ttl);
            processQueue();
        });
    };

    var request = function () {
        return function (url, callback) {
            queue.push({
                'url': url,
                'callback': callback
            });
            processQueue();
        };
    };

    Global.Prismic.Utils = {
        MAX_CONNECTIONS: 20, // Number of maximum simultaneous connections to the prismic server
        request: request
    };

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));
