"use strict";

var experiments = require('./experiments'),
    Predicates = require('./predicates'),
    api = require('./api'),
    Fragments = require('./fragments'),
    documents = require('./documents');

var Api = api.Api,
    Experiments = experiments.Experiments;

/**
 * The kit's main entry point; initialize your API like this: Prismic.api(url, {accessToken: "XXX"})
 *
 * @global
 * @alias Api
 * @constructor
 * @param {string} url - The mandatory URL of the prismic.io API endpoint (like: https://lesbonneschoses.prismic.io/api)
 * @param {function} options.callback - Optional callback function that is called after the API was retrieved, which will be called with two parameters: a potential error object and the API object
 * @param {string} options.accessToken - The accessToken, necessary if the API is set as private
 * @param {string} options.req - The NodeJS request (only use in a NodeJS context)
 * @param {function} options.requestHandler - Environment specific HTTP request handling function
 * @param {object} options.apiCache - A cache object with get/set functions for caching API responses
 * @param {int} options.apiDataTTL - How long (in seconds) to cache data used by the client to make calls (e.g. refs). Defaults to 5 seconds
 * @returns {Api} - The Api object that can be manipulated
 */
function getApi(url, options) {
  options = options || {};
  if (typeof arguments[1] == 'function') {
    // Legacy (1) the second argument is the callback
    options = {
      "complete": arguments[1],
      "accessToken": arguments[2],
      "requestHandler": arguments[3],
      "apiCache": arguments[4],
      "apiDataTTL": arguments[5]
    };
  } else if (typeof arguments[1] == 'string') {
    // Legacy (2) the second argument is the accessToken
    options = {
      "accessToken": arguments[1],
      "requestHandler": arguments[2],
      "apiCache": arguments[3],
      "apiDataTTL": arguments[4]
    };
  }
  var api = new Api(url, options || {});
  //Use cached api data if available
  return new Promise(function(resolve, reject) {
    var cb = function(err, value, xhr) {
      if (options.complete) options.complete(err, value, xhr);
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
  experimentCookie: api.experimentCookie,
  previewCookie: api.previewCookie,
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
