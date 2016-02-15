"use strict";

var experiments = require('./experiments'),
    Predicates = require('./predicates'),
    api = require('./api'),
    Fragments = require('./fragments'),
    documents = require('./documents');

var Api = api.Api,
    Experiments = experiments.Experiments;

/**
 * The kit's main entry point; initialize your API like this: Prismic.api(url, callback, accessToken, maybeRequestHandler)
 *
 * @global
 * @alias Api
 * @constructor
 * @param {string} url - The mandatory URL of the prismic.io API endpoint (like: https://lesbonneschoses.prismic.io/api)
 * @param {function} callback - Optional callback function
 * @param {string} maybeAccessToken - The accessToken for an OAuth2 connection
 * @param {function} maybeRequestHandler - Environment specific HTTP request handling function
 * @param {object} maybeApiCache - A cache object with get/set functions for caching API responses
 * @param {int} maybeApiDataTTL - How long (in seconds) to cache data used by the client to make calls (e.g. refs). Defaults to 5 seconds
 * @param {function} callback - Optional callback function that is called after the API was retrieved, which will be called with two parameters: a potential error object and the API object
 * @returns {Api} - The Api object that can be manipulated
 */
function getApi(url, maybeAccessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL) {
  var callback = null;
  if (typeof arguments[1] == 'function') {
    // The second argument is the callback, push the rest
    callback = arguments[1];
    maybeAccessToken = arguments[2];
    maybeRequestHandler = arguments[3];
    maybeApiCache = arguments[4];
    maybeApiDataTTL = arguments[5];
  }
  var api = new Api(url, maybeAccessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL);
  //Use cached api data if available
  return new Promise(function(resolve, reject) {
    var cb = function(err, value, xhr) {
      if (callback) callback(err, value, xhr);
      if (err) {
        reject(err);
      } else {
        resolve(value);
      }
    };
    api.get(function (err, data) {
      if (!err && data) {
        api.data = data;
        api.bookmarks = data.bookmarks;
        api.experiments = new Experiments(data.experiments);
      }

      cb(err, api);
    });

    return api;
  });
}

module.exports = {
  experimentCookie: "io.prismic.experiment",
  previewCookie: "io.prismic.preview",
  Document: documents.Document,
  SearchForm: api.SearchForm,
  Form: api.Form,
  Experiments: Experiments,
  Predicates: Predicates,
  Fragments: Fragments,
  api: getApi,
  Api: getApi, // Backward compatibility
  parseDoc: api.parseDoc
};

module.exports.Prismic = module.exports; // Backward compatibility
