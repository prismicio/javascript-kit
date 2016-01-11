(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var Requests = require('./requests'),
    documents = require('./documents'),
    ApiCache = require('./cache'),
    Predicates = require('./predicates'),
    experiments = require('./experiments');

var Experiments = experiments.Experiments,
    Document = documents.Document;

/**
 * Initialisation of the API object.
 * This is for internal use, from outside this kit, you should call Prismic.Api()
 * @private
 */
function Api(url, accessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL) {
  this.url = url + (accessToken ? (url.indexOf('?') > -1 ? '&' : '?') + 'access_token=' + accessToken : '');
  this.accessToken = accessToken;
  this.apiCache = maybeApiCache || globalCache();
  this.requestHandler = maybeRequestHandler || Requests.request;
  this.apiCacheKey = this.url + (this.accessToken ? '#' + this.accessToken : '');
  this.apiDataTTL = maybeApiDataTTL || 5;
  return this;
}

Api.prototype = {

  // Predicates
  AT: "at",
  ANY: "any",
  SIMILAR: "similar",
  FULLTEXT: "fulltext",
  NUMBER: {
    GT: "number.gt",
    LT: "number.lt"
  },
  DATE: {
    // Other date operators are available: see the documentation.
    AFTER: "date.after",
    BEFORE: "date.before",
    BETWEEN: "date.between"
  },

  // Fragment: usable as the second element of a query array on most predicates (except SIMILAR).
  // You can also use "my.*" for your custom fields.
  DOCUMENT: {
    ID: "document.id",
    TYPE: "document.type",
    TAGS: "document.tags"
  },

  data: null,

  /**
   * Fetches data used to construct the api client, from cache if it's
   * present, otherwise from calling the prismic api endpoint (which is
   * then cached).
   *
   * @param {function} callback - Callback to receive the data. Optional, you can use the promise result.
   * @returns {Promise} Promise holding the data or error
   */
  get: function get(callback) {
    var self = this;
    var cacheKey = this.apiCacheKey;

    return new Promise(function (resolve, reject) {
      var cb = function cb(err, value, xhr, ttl) {
        if (callback) callback(err, value, xhr, ttl);
        if (value) resolve(value);
        if (err) reject(err);
      };
      self.apiCache.get(cacheKey, function (err, value) {
        if (err || value) {
          cb(err, value);
          return;
        }

        self.requestHandler(self.url, function (err, data, xhr, ttl) {
          if (err) {
            cb(err, null, xhr, ttl);
            return;
          }

          var parsed = self.parse(data);
          ttl = ttl || self.apiDataTTL;

          self.apiCache.set(cacheKey, parsed, ttl, function (err) {
            cb(err, parsed, xhr, ttl);
          });
        });
      });
    });
  },

  /**
   * Cleans api data from the cache and fetches an up to date copy.
   *
   * @param {function} callback - Optional callback function that is called after the data has been refreshed
   * @returns {Promise}
   */
  refresh: function refresh(callback) {
    var self = this;
    var cacheKey = this.apiCacheKey;

    return new Promise(function (resolve, reject) {
      var cb = function cb(err, value, xhr) {
        if (callback) callback(err, value, xhr);
        if (value) resolve(value);
        if (err) reject(err);
      };
      self.apiCache.remove(cacheKey, function (err) {
        if (err) {
          cb(err);return;
        }

        self.get(function (err, data) {
          if (err) {
            cb(err);return;
          }

          self.data = data;
          self.bookmarks = data.bookmarks;
          self.experiments = new Experiments(data.experiments);

          cb();
        });
      });
    });
  },

  /**
   * Parses and returns the /api document.
   * This is for internal use, from outside this kit, you should call Prismic.Api()
   *
   * @param {string} data - The JSON document responded on the API's endpoint
   * @returns {Api} - The Api object that can be manipulated
   * @private
   */
  parse: function parse(data) {
    var refs,
        master,
        forms = {},
        form,
        types,
        tags,
        f,
        i;

    // Parse the forms
    for (i in data.forms) {
      if (data.forms.hasOwnProperty(i)) {
        f = data.forms[i];

        if (this.accessToken) {
          f.fields['access_token'] = {};
          f.fields['access_token']['type'] = 'string';
          f.fields['access_token']['default'] = this.accessToken;
        }

        form = new Form(f.name, f.fields, f.form_method, f.rel, f.enctype, f.action);

        forms[i] = form;
      }
    }

    refs = data.refs.map(function (r) {
      return new Ref(r.ref, r.label, r.isMasterRef, r.scheduledAt, r.id);
    }) || [];

    master = refs.filter(function (r) {
      return r.isMaster === true;
    });

    types = data.types;

    tags = data.tags;

    if (master.length === 0) {
      throw "No master ref.";
    }

    return {
      bookmarks: data.bookmarks || {},
      refs: refs,
      forms: forms,
      master: master[0],
      types: types,
      tags: tags,
      experiments: data.experiments,
      oauthInitiate: data['oauth_initiate'],
      oauthToken: data['oauth_token']
    };
  },

  /**
   * @deprecated use form() now
   * @param {string} formId - The id of a form, like "everything", or "products"
   * @returns {SearchForm} - the SearchForm that can be used.
   */
  forms: function forms(formId) {
    return this.form(formId);
  },

  /**
   * Returns a useable form from its id, as described in the RESTful description of the API.
   * For instance: api.form("everything") works on every repository (as "everything" exists by default)
   * You can then chain the calls: api.form("everything").query('[[:d = at(document.id, "UkL0gMuvzYUANCpf")]]').ref(ref).submit()
   *
   * @param {string} formId - The id of a form, like "everything", or "products"
   * @returns {SearchForm} - the SearchForm that can be used.
   */
  form: function form(formId) {
    var form = this.data.forms[formId];
    if (form) {
      return new SearchForm(this, form, {});
    }
    return null;
  },

  /**
   * The ID of the master ref on this prismic.io API.
   * Do not use like this: searchForm.ref(api.master()).
   * Instead, set your ref once in a variable, and call it when you need it; this will allow to change the ref you're viewing easily for your entire page.
   *
   * @returns {string}
   */
  master: function master() {
    return this.data.master.ref;
  },

  /**
   * Returns the ref ID for a given ref's label.
   * Do not use like this: searchForm.ref(api.ref("Future release label")).
   * Instead, set your ref once in a variable, and call it when you need it; this will allow to change the ref you're viewing easily for your entire page.
   *
   * @param {string} label - the ref's label
   * @returns {string}
   */
  ref: function ref(label) {
    for (var i = 0; i < this.data.refs.length; i++) {
      if (this.data.refs[i].label == label) {
        return this.data.refs[i].ref;
      }
    }
    return null;
  },

  /**
   * The current experiment, or null
   * @returns {Experiment}
   */
  currentExperiment: function currentExperiment() {
    return this.experiments.current();
  },

  /**
   * Query the repository
   * @param {string|array|Predicate} the query itself
   * @param {object} additional parameters
   * @param {function} callback(err, response)
   */
  query: function query(q, options, callback) {
    var form = this.form('everything');
    for (var key in options) {
      form = form.set(key, options[key]);
    }
    if (!options['ref']) {
      form = form.ref(this.master());
    }
    return form.query(q).submit(callback);
  },

  /**
   * Retrieve the document with the given id
   * @param {string} id
   * @param {object} additional parameters
   * @param {function} callback(err, response)
   */
  getByID: function getByID(id, options, callback) {
    return this.query(Predicates.at('document.id', id), options, function (err, response) {
      if (response && response.results.length > 0) {
        callback(err, response.results[0]);
      } else {
        callback(err, null);
      }
    }).then(function (response) {
      return response && response.results && response.results[0];
    });
  },

  /**
   * Retrieve multiple documents from an array of id
   * @param {array} ids
   * @param {object} additional parameters
   * @param {function} callback(err, response)
   */
  getByIDs: function getByIDs(ids, options, callback) {
    return this.query(['in', 'document.id', ids], options, callback);
  },

  /**
   * Retrieve the document with the given uid
   * @param {string} type the custom type of the document
   * @param {string} uid
   * @param {object} additional parameters
   * @param {function} callback(err, response)
   */
  getByUID: function getByUID(type, uid, options, callback) {
    return this.query(Predicates.at('my.' + type + '.uid', uid), options, function (err, response) {
      if (response && response.results.length > 0) {
        callback(err, response.results[0]);
      } else {
        callback(err, null);
      }
    }).then(function (response) {
      return response && response.results && response.results[0];
    });
  },

  /**
   * Retrieve the document with the given uid
   * @param {string} type the custom type of the document
   * @param {string} uid
   * @param {object} additional parameters
   * @param {function} callback(err, response)
   */
  getBookmark: function getBookmark(bookmark, options, callback) {
    var id = this.bookmarks[bookmark];
    if (id) {
      this.getById(this.bookmarks[bookmark], options, callback);
    } else {
      callback(new Error("Error retrieving bookmarked id"));
    }
  },

  /**
   * Return the URL to display a given preview
   * @param {string} token as received from Prismic server to identify the content to preview
   * @param {function} linkResolver the link resolver to build URL for your site
   * @param {string} defaultUrl the URL to default to return if the preview doesn't correspond to a document
   *                (usually the home page of your site)
   * @param {function} callback to get the resulting URL (optional, you can get it from the Promise result)
   * @returns {Promise}
   */
  previewSession: function previewSession(token, linkResolver, defaultUrl, callback) {
    var api = this;
    var Predicates = Predicates;
    return new Promise(function (resolve, reject) {
      var cb = function cb(err, value, xhr) {
        if (callback) callback(err, value, xhr);
        if (value) resolve(value);
        if (err) reject(err);
      };
      self.requestHandler(token, function (err, result, xhr) {
        if (err) {
          cb(err, defaultUrl, xhr);
          return;
        }
        try {
          var mainDocumentId = result.mainDocument;
          if (!mainDocumentId) {
            cb(null, defaultUrl, xhr);
          } else {
            api.form("everything").query(Predicates.at("document.id", mainDocumentId)).ref(token).submit(function (err, response) {
              if (err) {
                cb(err);
              }
              try {
                if (response.results.length === 0) {
                  cb(null, defaultUrl, xhr);
                } else {
                  cb(null, linkResolver(response.results[0]), xhr);
                }
              } catch (e) {
                cb(e);
              }
            });
          }
        } catch (e) {
          cb(e, defaultUrl, xhr);
        }
      });
    });
  },

  /**
   * Fetch a URL corresponding to a query, and parse the response as a Response object
   */
  request: function request(url, callback) {
    var api = this;
    var cacheKey = url + (this.accessToken ? '#' + this.accessToken : '');
    var cache = this.apiCache;
    cache.get(cacheKey, function (err, value) {
      if (err || value) {
        callback(err, value);
        return;
      }
      api.requestHandler(url, function (err, documents, xhr, ttl) {
        if (err) {
          callback(err, null, xhr);
          return;
        }
        var results = documents.results.map(parseDoc);
        var response = new Response(documents.page, documents.results_per_page, documents.results_size, documents.total_results_size, documents.total_pages, documents.next_page, documents.prev_page, results || []);
        if (ttl) {
          cache.set(cacheKey, response, ttl, function (err) {
            callback(err, response);
          });
        } else {
          callback(null, response);
        }
      });
    });
  }

};

/**
 * Embodies a submittable RESTful form as described on the API endpoint (as per RESTful standards)
 * @constructor
 * @private
 */
function Form(name, fields, form_method, rel, enctype, action) {
  this.name = name;
  this.fields = fields;
  this.form_method = form_method;
  this.rel = rel;
  this.enctype = enctype;
  this.action = action;
}

Form.prototype = {};

/**
 * Parse json as a document
 *
 * @returns {Document}
 */
var parseDoc = function parseDoc(json) {
  var fragments = {};
  for (var field in json.data[json.type]) {
    fragments[json.type + '.' + field] = json.data[json.type][field];
  }

  var slugs = [];
  if (json.slugs !== undefined) {
    for (var i = 0; i < json.slugs.length; i++) {
      slugs.push(decodeURIComponent(json.slugs[i]));
    }
  }

  return new Document(json.id, json.uid || null, json.type, json.href, json.tags, slugs, fragments);
};

/**
 * Embodies a SearchForm object. To create SearchForm objects that are allowed in the API, please use the API.form() method.
 * @constructor
 * @global
 * @alias SearchForm
 */
function SearchForm(api, form, data) {
  this.api = api;
  this.form = form;
  this.data = data || {};

  for (var field in form.fields) {
    if (form.fields[field]['default']) {
      this.data[field] = [form.fields[field]['default']];
    }
  }
}

SearchForm.prototype = {

  /**
   * Set an API call parameter. This will only work if field is a valid field of the
   * RESTful form in the first place (as described in the /api document); otherwise,
   * an "Unknown field" error is thrown.
   * Please prefer using dedicated methods like query(), orderings(), ...
   *
   * @param {string} field - The name of the field to set
   * @param {string} value - The value that gets assigned
   * @returns {SearchForm} - The SearchForm itself
   */
  set: function set(field, value) {
    var fieldDesc = this.form.fields[field];
    if (!fieldDesc) throw new Error("Unknown field " + field);
    var values = this.data[field] || [];
    if (value === '' || value === undefined) {
      // we must compare value to null because we want to allow 0
      value = null;
    }
    if (fieldDesc.multiple) {
      if (value) values.push(value);
    } else {
      values = value && [value];
    }
    this.data[field] = values;
    return this;
  },

  /**
   * Sets a ref to query on for this SearchForm. This is a mandatory
   * method to call before calling submit(), and api.form('everything').submit()
   * will not work.
   *
   * @param {Ref} ref - The Ref object defining the ref to query
   * @returns {SearchForm} - The SearchForm itself
   */
  ref: function ref(_ref) {
    return this.set("ref", _ref);
  },

  /**
   * Sets a predicate-based query for this SearchForm. This is where you
   * paste what you compose in your prismic.io API browser.
   *
   * @example form.query(Prismic.Predicates.at("document.id", "foobar"))
   * @param {string|...array} query - Either a query as a string, or as many predicates as you want. See Prismic.Predicates.
   * @returns {SearchForm} - The SearchForm itself
   */
  query: function query(_query) {
    if (typeof _query === 'string') {
      return this.set("q", _query);
    } else {
      var predicates;
      if (_query.constructor === Array && _query.length > 0 && _query[0].constructor === Array) {
        predicates = _query;
      } else {
        predicates = [].slice.apply(arguments); // Convert to a real JS array
      }
      var stringQueries = [];
      predicates.forEach(function (predicate) {
        var firstArg = predicate[1].indexOf("my.") === 0 || predicate[1].indexOf("document") === 0 ? predicate[1] : '"' + predicate[1] + '"';
        stringQueries.push("[:d = " + predicate[0] + "(" + firstArg + (predicate.length > 2 ? ", " : "") + function () {
          return predicate.slice(2).map(function (p) {
            if (typeof p === 'string') {
              return '"' + p + '"';
            } else if (Array.isArray(p)) {
              return "[" + p.map(function (e) {
                return '"' + e + '"';
              }).join(',') + "]";
            } else if (p instanceof Date) {
              return p.getTime();
            } else {
              return p;
            }
          }).join(',');
        }() + ")]");
      });
      return this.query("[" + stringQueries.join("") + "]");
    }
  },

  /**
   * Sets a page size to query for this SearchForm. This is an optional method.
   *
   * @param {number} size - The page size
   * @returns {SearchForm} - The SearchForm itself
   */
  pageSize: function pageSize(size) {
    return this.set("pageSize", size);
  },

  /**
   * Restrict the results document to the specified fields
   *
   * @param {string|array} fields - The list of fields, array or comma separated string
   * @returns {SearchForm} - The SearchForm itself
   */
  fetch: function fetch(fields) {
    if (fields instanceof Array) {
      fields = fields.join(",");
    }
    return this.set("fetch", fields);
  },

  /**
   * Include the requested fields in the DocumentLink instances in the result
   *
   * @param {string|array} fields - The list of fields, array or comma separated string
   * @returns {SearchForm} - The SearchForm itself
   */
  fetchLinks: function fetchLinks(fields) {
    if (fields instanceof Array) {
      fields = fields.join(",");
    }
    return this.set("fetchLinks", fields);
  },

  /**
   * Sets the page number to query for this SearchForm. This is an optional method.
   *
   * @param {number} p - The page number
   * @returns {SearchForm} - The SearchForm itself
   */
  page: function page(p) {
    return this.set("page", p);
  },

  /**
   * Sets the orderings to query for this SearchForm. This is an optional method.
   *
   * @param {array} orderings - Array of string: list of fields, optionally followed by space and desc. Example: ['my.product.price desc', 'my.product.date']
   * @returns {SearchForm} - The SearchForm itself
   */
  orderings: function orderings(_orderings) {
    if (typeof _orderings === 'string') {
      // Backward compatibility
      return this.set("orderings", _orderings);
    } else if (!_orderings) {
      // Noop
      return this;
    } else {
      // Normal usage
      return this.set("orderings", "[" + _orderings.join(",") + "]");
    }
  },

  /**
   * Submits the query, and calls the callback function.
   *
   * @param {function} callback - Optional callback function that is called after the query was made,
   * to which you may pass three parameters: a potential error (null if no problem),
   * a Response object (containing all the pagination specifics + the array of Docs),
   * and the XMLHttpRequest
   */
  submit: function submit(callback) {
    var self = this;
    var url = this.form.action;

    if (this.data) {
      var sep = url.indexOf('?') > -1 ? '&' : '?';
      for (var key in this.data) {
        if (this.data.hasOwnProperty(key)) {
          var values = this.data[key];
          if (values) {
            for (var i = 0; i < values.length; i++) {
              url += sep + key + '=' + encodeURIComponent(values[i]);
              sep = '&';
            }
          }
        }
      }
    }

    return new Promise(function (resolve, reject) {
      self.api.request(url, function (err, value, xhr) {
        if (callback) callback(err, value, xhr);
        if (err) reject(err);
        if (value) resolve(value);
      });
    });
  }
};

/**
 * Embodies the response of a SearchForm query as returned by the API.
 * It includes all the fields that are useful for pagination (page, total_pages, total_results_size, ...),
 * as well as the field "results", which is an array of {@link Document} objects, the documents themselves.
 *
 * @constructor
 * @global
 */
function Response(page, results_per_page, results_size, total_results_size, total_pages, next_page, prev_page, results) {
  /**
   * The current page
   * @type {number}
   */
  this.page = page;
  /**
   * The number of results per page
   * @type {number}
   */
  this.results_per_page = results_per_page;
  /**
   * The size of the current page
   * @type {number}
   */
  this.results_size = results_size;
  /**
   * The total size of results across all pages
   * @type {number}
   */
  this.total_results_size = total_results_size;
  /**
   * The total number of pages
   * @type {number}
   */
  this.total_pages = total_pages;
  /**
   * The URL of the next page in the API
   * @type {string}
   */
  this.next_page = next_page;
  /**
   * The URL of the previous page in the API
   * @type {string}
   */
  this.prev_page = prev_page;
  /**
   * Array of {@link Document} for the current page
   * @type {Array}
   */
  this.results = results;
}

/**
 * Embodies a prismic.io ref (a past or future point in time you can query)
 * @constructor
 * @global
 */
function Ref(ref, label, isMaster, scheduledAt, id) {
  /**
   * @field
   * @description the ID of the ref
   */
  this.ref = ref;
  /**
   * @field
   * @description the label of the ref
   */
  this.label = label;
  /**
   * @field
   * @description is true if the ref is the master ref
   */
  this.isMaster = isMaster;
  /**
   * @field
   * @description the scheduled date of the ref
   */
  this.scheduledAt = scheduledAt;
  /**
   * @field
   * @description the name of the ref
   */
  this.id = id;
}
Ref.prototype = {};
function globalCache() {
  var g;
  if ((typeof global === 'undefined' ? 'undefined' : _typeof(global)) == 'object') {
    g = global; // NodeJS
  } else {
      g = window; // browser
    }
  if (!g.prismicCache) {
    g.prismicCache = new ApiCache();
  }
  return g.prismicCache;
}

module.exports = {
  Api: Api,
  Form: Form,
  SearchForm: SearchForm,
  Ref: Ref,
  parseDoc: parseDoc
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./cache":3,"./documents":4,"./experiments":5,"./predicates":8,"./requests":10}],2:[function(require,module,exports){
'use strict';

// IE below 12 doesn't support promises

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

require('es6-promise').polyfill();

// Polyfill for inheritance
if (typeof Object.create != 'function') {
  Object.create = function () {
    var Object = function Object() {};
    return function (prototype) {
      if (arguments.length > 1) {
        throw Error('Second argument not supported');
      }
      if ((typeof prototype === 'undefined' ? 'undefined' : _typeof(prototype)) != 'object') {
        throw TypeError('Argument must be an object');
      }
      Object.prototype = prototype;
      var result = {};
      Object.prototype = null;
      return result;
    };
  }();
}

window.Prismic = require('./prismic');

},{"./prismic":9,"es6-promise":17}],3:[function(require,module,exports){

"use strict";

var LRUCache = require('./lru');

/**
 * Api cache
 */
function ApiCache(limit) {
  this.lru = new LRUCache(limit);
}

ApiCache.prototype = {

  get: function get(key, cb) {
    var maybeEntry = this.lru.get(key);
    if (maybeEntry && !this.isExpired(key)) {
      return cb(null, maybeEntry.data);
    }
    return cb();
  },

  set: function set(key, value, ttl, cb) {
    this.lru.remove(key);
    this.lru.put(key, {
      data: value,
      expiredIn: ttl ? Date.now() + ttl * 1000 : 0
    });

    return cb();
  },

  isExpired: function isExpired(key) {
    var entry = this.lru.get(key);
    if (entry) {
      return entry.expiredIn !== 0 && entry.expiredIn < Date.now();
    } else {
      return false;
    }
  },

  remove: function remove(key, cb) {
    this.lru.remove(key);
    return cb();
  },

  clear: function clear(cb) {
    this.lru.removeAll();
    return cb();
  }
};

module.exports = ApiCache;

},{"./lru":7}],4:[function(require,module,exports){
"use strict";

/**
 * Functions to access fragments: superclass for Document and Doc (from Group), not supposed to be created directly
 * @constructor
 */

function WithFragments() {}

WithFragments.prototype = {
  /**
   * Gets the fragment in the current Document object. Since you most likely know the type
   * of this fragment, it is advised that you use a dedicated method, like get StructuredText() or getDate(),
   * for instance.
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.author"
   * @returns {object} - The JavaScript Fragment object to manipulate
   */
  get: function get(name) {
    var frags = this._getFragments(name);
    return frags.length ? frags[0] : null;
  },

  /**
   * Builds an array of all the fragments in case they are multiple.
   *
   * @param {string} name - The name of the multiple fragment to get, with its type; for instance, "blog-post.author"
   * @returns {array} - An array of each JavaScript fragment object to manipulate.
   */
  getAll: function getAll(name) {
    return this._getFragments(name);
  },

  /**
   * Gets the image fragment in the current Document object, for further manipulation.
   *
   * @example document.getImage('blog-post.photo').asHtml(linkResolver)
   *
   * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.photo"
   * @returns {ImageEl} - The Image object to manipulate
   */
  getImage: function getImage(fragment) {
    var Fragments = require('./fragments');
    var img = this.get(fragment);
    if (img instanceof Fragments.Image) {
      return img;
    }
    if (img instanceof Fragments.StructuredText) {
      // find first image in st.
      return img;
    }
    return null;
  },

  // Useful for obsolete multiples
  getAllImages: function getAllImages(fragment) {
    var Fragments = require('./fragments');
    var images = this.getAll(fragment);

    return images.map(function (image) {
      if (image instanceof Fragments.Image) {
        return image;
      }
      if (image instanceof Fragments.StructuredText) {
        throw new Error("Not done.");
      }
      return null;
    });
  },

  getFirstImage: function getFirstImage() {
    var Fragments = require('./fragments');
    var fragments = this.fragments;

    var firstImage = Object.keys(fragments).reduce(function (image, key) {
      if (image) {
        return image;
      } else {
        var element = fragments[key];
        if (typeof element.getFirstImage === "function") {
          return element.getFirstImage();
        } else if (element instanceof Fragments.Image) {
          return element;
        } else return null;
      }
    }, null);
    return firstImage;
  },

  getFirstTitle: function getFirstTitle() {
    var Fragments = require('./fragments');
    var fragments = this.fragments;

    var firstTitle = Object.keys(fragments).reduce(function (st, key) {
      if (st) {
        return st;
      } else {
        var element = fragments[key];
        if (typeof element.getFirstTitle === "function") {
          return element.getFirstTitle();
        } else if (element instanceof Fragments.StructuredText) {
          return element.getTitle();
        } else return null;
      }
    }, null);
    return firstTitle;
  },

  getFirstParagraph: function getFirstParagraph() {
    var fragments = this.fragments;

    var firstParagraph = Object.keys(fragments).reduce(function (st, key) {
      if (st) {
        return st;
      } else {
        var element = fragments[key];
        if (typeof element.getFirstParagraph === "function") {
          return element.getFirstParagraph();
        } else return null;
      }
    }, null);
    return firstParagraph;
  },

  /**
   * Gets the view within the image fragment in the current Document object, for further manipulation.
   *
   * @example document.getImageView('blog-post.photo', 'large').asHtml(linkResolver)
   *
   * @param {string} name- The name of the fragment to get, with its type; for instance, "blog-post.photo"
   * @returns {ImageView} view - The View object to manipulate
   */
  getImageView: function getImageView(name, view) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);
    if (fragment instanceof Fragments.Image) {
      return fragment.getView(view);
    }
    if (fragment instanceof Fragments.StructuredText) {
      for (var i = 0; i < fragment.blocks.length; i++) {
        if (fragment.blocks[i].type == 'image') {
          return fragment.blocks[i];
        }
      }
    }
    return null;
  },

  // Useful for obsolete multiples
  getAllImageViews: function getAllImageViews(name, view) {
    return this.getAllImages(name).map(function (image) {
      return image.getView(view);
    });
  },

  /**
   * Gets the timestamp fragment in the current Document object, for further manipulation.
   *
   * @example document.getDate('blog-post.publicationdate').asHtml(linkResolver)
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.publicationdate"
   * @returns {Date} - The Date object to manipulate
   */
  getTimestamp: function getTimestamp(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Timestamp) {
      return fragment.value;
    }
  },

  /**
   * Gets the date fragment in the current Document object, for further manipulation.
   *
   * @example document.getDate('blog-post.publicationdate').asHtml(linkResolver)
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.publicationdate"
   * @returns {Date} - The Date object to manipulate
   */
  getDate: function getDate(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Date) {
      return fragment.value;
    }
  },

  /**
   * Gets a boolean value of the fragment in the current Document object, for further manipulation.
   * This works great with a Select fragment. The Select values that are considered true are (lowercased before matching): 'yes', 'on', and 'true'.
   *
   * @example if(document.getBoolean('blog-post.enableComments')) { ... }
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.enableComments"
   * @returns {boolean} - The boolean value of the fragment
   */
  getBoolean: function getBoolean(name) {
    var fragment = this.get(name);
    return fragment.value && (fragment.value.toLowerCase() == 'yes' || fragment.value.toLowerCase() == 'on' || fragment.value.toLowerCase() == 'true');
  },

  /**
   * Gets the text fragment in the current Document object, for further manipulation.
   * The method works with StructuredText fragments, Text fragments, Number fragments, Select fragments and Color fragments.
   *
   * @example document.getText('blog-post.label').asHtml(linkResolver).
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.label"
   * @param {string} after - a suffix that will be appended to the value
   * @returns {object} - either StructuredText, or Text, or Number, or Select, or Color.
   */
  getText: function getText(name, after) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.StructuredText) {
      return fragment.blocks.map(function (block) {
        if (block.text) {
          return block.text + (after ? after : '');
        }
      }).join('\n');
    }

    if (fragment instanceof Fragments.Text) {
      if (fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }

    if (fragment instanceof Fragments.Number) {
      if (fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }

    if (fragment instanceof Fragments.Select) {
      if (fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }

    if (fragment instanceof Fragments.Color) {
      if (fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }
  },

  /**
   * Gets the StructuredText fragment in the current Document object, for further manipulation.
   * @example document.getStructuredText('blog-post.body').asHtml(linkResolver)
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.body"
   * @returns {StructuredText} - The StructuredText fragment to manipulate.
   */
  getStructuredText: function getStructuredText(name) {
    var fragment = this.get(name);

    if (fragment instanceof require('./fragments').StructuredText) {
      return fragment;
    }
    return null;
  },

  /**
   * Gets the Link fragment in the current Document object, for further manipulation.
   * @example document.getLink('blog-post.link').url(resolver)
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.link"
   * @returns {WebLink|DocumentLink|ImageLink} - The Link fragment to manipulate.
   */
  getLink: function getLink(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.WebLink || fragment instanceof Fragments.DocumentLink || fragment instanceof Fragments.ImageLink) {
      return fragment;
    }
    return null;
  },

  /**
   * Gets the Number fragment in the current Document object, for further manipulation.
   * @example document.getNumber('product.price')
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "product.price"
   * @returns {number} - The number value of the fragment.
   */
  getNumber: function getNumber(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Number) {
      return fragment.value;
    }
    return null;
  },

  /**
   * Gets the Color fragment in the current Document object, for further manipulation.
   * @example document.getColor('product.color')
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "product.color"
   * @returns {string} - The string value of the Color fragment.
   */
  getColor: function getColor(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Color) {
      return fragment.value;
    }
    return null;
  },

  /** Gets the GeoPoint fragment in the current Document object, for further manipulation.
   *
   * @example document.getGeoPoint('blog-post.location').asHtml(linkResolver)
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.location"
   * @returns {GeoPoint} - The GeoPoint object to manipulate
   */
  getGeoPoint: function getGeoPoint(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.GeoPoint) {
      return fragment;
    }
    return null;
  },

  /**
   * Gets the Group fragment in the current Document object, for further manipulation.
   *
   * @example document.getGroup('product.gallery').asHtml(linkResolver).
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "product.gallery"
   * @returns {Group} - The Group fragment to manipulate.
   */
  getGroup: function getGroup(name) {
    var fragment = this.get(name);

    if (fragment instanceof require('./fragments').Group) {
      return fragment;
    }
    return null;
  },

  /**
   * Shortcut to get the HTML output of the fragment in the current document.
   * This is the same as writing document.get(fragment).asHtml(linkResolver);
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.body"
   * @param {function} linkResolver
   * @returns {string} - The HTML output
   */
  getHtml: function getHtml(name, linkResolver) {
    if (!isFunction(linkResolver)) {
      // Backward compatibility with the old ctx argument
      var ctx = linkResolver;
      linkResolver = function linkResolver(doc, isBroken) {
        return ctx.linkResolver(ctx, doc, isBroken);
      };
    }
    var fragment = this.get(name);

    if (fragment && fragment.asHtml) {
      return fragment.asHtml(linkResolver);
    }
    return null;
  },

  /**
   * Transforms the whole document as an HTML output. Each fragment is separated by a &lt;section&gt; tag,
   * with the attribute data-field="nameoffragment"
   * Note that most of the time you will not use this method, but read fragment independently and generate
   * HTML output for {@link StructuredText} fragment with that class' asHtml method.
   *
   * @param {function} linkResolver
   * @returns {string} - The HTML output
   */
  asHtml: function asHtml(linkResolver) {
    if (!isFunction(linkResolver)) {
      // Backward compatibility with the old ctx argument
      var ctx = linkResolver;
      linkResolver = function linkResolver(doc, isBroken) {
        return ctx.linkResolver(ctx, doc, isBroken);
      };
    }
    var htmls = [];
    for (var field in this.fragments) {
      var fragment = this.get(field);
      htmls.push(fragment && fragment.asHtml ? '<section data-field="' + field + '">' + fragment.asHtml(linkResolver) + '</section>' : '');
    }
    return htmls.join('');
  },

  /**
   * Turns the document into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText(linkResolver) {
    if (!isFunction(linkResolver)) {
      // Backward compatibility with the old ctx argument
      var ctx = linkResolver;
      linkResolver = function linkResolver(doc, isBroken) {
        return ctx.linkResolver(ctx, doc, isBroken);
      };
    }
    var texts = [];
    for (var field in this.fragments) {
      var fragment = this.get(field);
      texts.push(fragment && fragment.asText ? fragment.asText(linkResolver) : '');
    }
    return texts.join('');
  },

  /**
   * Linked documents, as an array of {@link DocumentLink}
   * @returns {Array}
   */
  linkedDocuments: function linkedDocuments() {
    var i, j, link;
    var result = [];
    var Fragments = require('./fragments');
    for (var field in this.data) {
      var fragment = this.get(field);
      if (fragment instanceof Fragments.DocumentLink) {
        result.push(fragment);
      }
      if (fragment instanceof Fragments.StructuredText) {
        for (i = 0; i < fragment.blocks.length; i++) {
          var block = fragment.blocks[i];
          if (block.type == "image" && block.linkTo) {
            link = Fragments.initField(block.linkTo);
            if (link instanceof Fragments.DocumentLink) {
              result.push(link);
            }
          }
          var spans = block.spans || [];
          for (j = 0; j < spans.length; j++) {
            var span = spans[j];
            if (span.type == "hyperlink") {
              link = Fragments.initField(span.data);
              if (link instanceof Fragments.DocumentLink) {
                result.push(link);
              }
            }
          }
        }
      }
      if (fragment instanceof Fragments.Group) {
        for (i = 0; i < fragment.value.length; i++) {
          result = result.concat(fragment.value[i].linkedDocuments());
        }
      }
    }
    return result;
  },

  /**
   * An array of the fragments with the given fragment name.
   * The array is often a single-element array, expect when the fragment is a multiple fragment.
   * @private
   */
  _getFragments: function _getFragments(name) {
    if (!this.fragments || !this.fragments[name]) {
      return [];
    }

    if (Array.isArray(this.fragments[name])) {
      return this.fragments[name];
    } else {
      return [this.fragments[name]];
    }
  }

};

/**
 * Embodies a document as returned by the API.
 * Most useful fields: id, type, tags, slug, slugs
 * @constructor
 * @global
 * @alias Doc
 */
function Document(id, uid, type, href, tags, slugs, data) {
  /**
   * The ID of the document
   * @type {string}
   */
  this.id = id;
  /**
   * The User ID of the document, a human readable id
   * @type {string|null}
   */
  this.uid = uid;
  /**
   * The type of the document, corresponds to a document mask defined in the repository
   * @type {string}
   */
  this.type = type;
  /**
   * The URL of the document in the API
   * @type {string}
   */
  this.href = href;
  /**
   * The tags of the document
   * @type {array}
   */
  this.tags = tags;
  /**
   * The current slug of the document, "-" if none was provided
   * @type {string}
   */
  this.slug = slugs ? slugs[0] : "-";
  /**
   * All the slugs that were ever used by this document (including the current one, at the head)
   * @type {array}
   */
  this.slugs = slugs;
  /**
   * The original JSON data from the API
   */
  this.data = data;
  /**
   * Fragments, converted to business objects
   */
  this.fragments = require('./fragments').parseFragments(data);
}

Document.prototype = Object.create(WithFragments.prototype);

/**
 * Gets the SliceZone fragment in the current Document object, for further manipulation.
 *
 * @example document.getSliceZone('product.gallery').asHtml(linkResolver).
 *
 * @param {string} name - The name of the fragment to get, with its type; for instance, "product.gallery"
 * @returns {Group} - The SliceZone fragment to manipulate.
 */
Document.prototype.getSliceZone = function (name) {
  var fragment = this.get(name);

  if (fragment instanceof require('./fragments').SliceZone) {
    return fragment;
  }
  return null;
};

function GroupDoc(data) {
  /**
   * The original JSON data from the API
   */
  this.data = data;
  /**
   * Fragments, converted to business objects
   */
  this.fragments = require('./fragments').parseFragments(data);
}

GroupDoc.prototype = Object.create(WithFragments.prototype);

// -- Private helpers

function isFunction(f) {
  var getType = {};
  return f && getType.toString.call(f) === '[object Function]';
}

module.exports = {
  WithFragments: WithFragments,
  Document: Document,
  GroupDoc: GroupDoc
};

},{"./fragments":6}],5:[function(require,module,exports){

"use strict";

/**
 * A collection of experiments currently available
 * @param data the json data received from the Prismic API
 * @constructor
 */

function Experiments(data) {
  var drafts = [];
  var running = [];
  if (data) {
    data.drafts && data.drafts.forEach(function (exp) {
      drafts.push(new Experiment(exp));
    });
    data.running && data.running.forEach(function (exp) {
      running.push(new Experiment(exp));
    });
  }
  this.drafts = drafts;
  this.running = running;
}

Experiments.prototype.current = function () {
  return this.running.length > 0 ? this.running[0] : null;
};

/**
 * Get the current running experiment variation ref from a cookie content
 */
Experiments.prototype.refFromCookie = function (cookie) {
  if (!cookie || cookie.trim() === "") return null;
  var splitted = cookie.trim().split(" ");
  if (splitted.length < 2) return null;
  var expId = splitted[0];
  var varIndex = parseInt(splitted[1], 10);
  var exp = this.running.filter(function (exp) {
    return exp.googleId() == expId && exp.variations.length > varIndex;
  })[0];
  return exp ? exp.variations[varIndex].ref() : null;
};

function Experiment(data) {
  this.data = data;
  var variations = [];
  data.variations && data.variations.forEach(function (v) {
    variations.push(new Variation(v));
  });
  this.variations = variations;
}

Experiment.prototype.id = function () {
  return this.data.id;
};

Experiment.prototype.googleId = function () {
  return this.data.googleId;
};

Experiment.prototype.name = function () {
  return this.data.name;
};

function Variation(data) {
  this.data = data;
}

Variation.prototype.id = function () {
  return this.data.id;
};

Variation.prototype.ref = function () {
  return this.data.ref;
};

Variation.prototype.label = function () {
  return this.data.label;
};

module.exports = {
  Experiments: Experiments,
  Variation: Variation
};

},{}],6:[function(require,module,exports){
"use strict";

var documents = require('./documents');
var WithFragments = documents.WithFragments,
    GroupDoc = documents.GroupDoc;

/**
 * Embodies a plain text fragment (beware: not a structured text)
 * @constructor
 * @global
 * @alias Fragments:Text
 */
function Text(data) {
  this.value = data;
}
Text.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<span>" + this.value + "</span>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value;
  }
};
/**
 * Embodies a document link fragment (a link that is internal to a prismic.io repository)
 * @constructor
 * @global
 * @alias Fragments:DocumentLink
 */
function DocumentLink(data) {
  this.value = data;

  this.document = data.document;
  /**
   * @field
   * @description the linked document id
   */
  this.id = data.document.id;
  /**
   * @field
   * @description the linked document uid
   */
  this.uid = data.document.uid;
  /**
   * @field
   * @description the linked document tags
   */
  this.tags = data.document.tags;
  /**
   * @field
   * @description the linked document slug
   */
  this.slug = data.document.slug;
  /**
   * @field
   * @description the linked document type
   */
  this.type = data.document.type;

  var fragmentsData = {};
  if (data.document.data) {
    for (var field in data.document.data[data.document.type]) {
      fragmentsData[data.document.type + '.' + field] = data.document.data[data.document.type][field];
    }
  }
  /**
   * @field
   * @description the fragment list, if the fetchLinks parameter was used in at query time
   */
  this.fragments = parseFragments(fragmentsData);
  /**
   * @field
   * @description true if the link is broken, false otherwise
   */
  this.isBroken = data.isBroken;
}

DocumentLink.prototype = Object.create(WithFragments.prototype);

/**
 * Turns the fragment into a useable HTML version of it.
 * If the native HTML code doesn't suit your design, this function is meant to be overriden.
 *
 * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
 * @returns {string} - basic HTML code for the fragment
 */
DocumentLink.prototype.asHtml = function (ctx) {
  return "<a href=\"" + this.url(ctx) + "\">" + this.url(ctx) + "</a>";
};

/**
 * Returns the URL of the document link.
 *
 * @params {object} linkResolver - mandatory linkResolver function (please read prismic.io online documentation about this)
 * @returns {string} - the proper URL to use
 */
DocumentLink.prototype.url = function (linkResolver) {
  return linkResolver(this, this.isBroken);
};

/**
 * Turns the fragment into a useable text version of it.
 *
 * @returns {string} - basic text version of the fragment
 */
DocumentLink.prototype.asText = function (linkResolver) {
  return this.url(linkResolver);
};

/**
 * Embodies a web link fragment
 * @constructor
 * @global
 * @alias Fragments:WebLink
 */
function WebLink(data) {
  /**
   * @field
   * @description the JSON object exactly as is returned in the "data" field of the JSON responses (see API documentation: https://developers.prismic.io/documentation/UjBe8bGIJ3EKtgBZ/api-documentation#json-responses)
   */
  this.value = data;
}
WebLink.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<a href=\"" + this.url() + "\">" + this.url() + "</a>";
  },
  /**
   * Returns the URL of the link.
   *
   * @returns {string} - the proper URL to use
   */
  url: function url() {
    return this.value.url;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.url();
  }
};

/**
 * Embodies a file link fragment
 * @constructor
 * @global
 * @alias Fragments:FileLink
 */
function FileLink(data) {
  /**
   * @field
   * @description the JSON object exactly as is returned in the "data" field of the JSON responses (see API documentation: https://developers.prismic.io/documentation/UjBe8bGIJ3EKtgBZ/api-documentation#json-responses)
   */
  this.value = data;
}
FileLink.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<a href=\"" + this.url() + "\">" + this.value.file.name + "</a>";
  },
  /**
   * Returns the URL of the link.
   *
   * @returns {string} - the proper URL to use
   */
  url: function url() {
    return this.value.file.url;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.url();
  }
};

/**
 * Embodies an image link fragment
 * @constructor
 * @global
 * @alias Fragments:ImageLink
 */
function ImageLink(data) {
  /**
   *
   * @field
   * @description the JSON object exactly as is returned in the "data" field of the JSON responses (see API documentation: https://developers.prismic.io/documentation/UjBe8bGIJ3EKtgBZ/api-documentation#json-responses)
   */
  this.value = data;
}
ImageLink.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<a href=\"" + this.url() + "\"><img src=\"" + this.url() + "\" alt=\"" + this.alt + "\"></a>";
  },
  /**
   * Returns the URL of the link.
   *
   * @returns {string} - the proper URL to use
   */
  url: function url() {
    return this.value.image.url;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.url();
  }
};

/**
 * Embodies a select fragment
 * @constructor
 * @global
 * @alias Fragments:Select
 */
function Select(data) {
  /**
   * @field
   * @description the text value of the fragment
   */
  this.value = data;
}
Select.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<span>" + this.value + "</span>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value;
  }
};

/**
 * Embodies a color fragment
 * @constructor
 * @global
 * @alias Fragments:Color
 */
function Color(data) {
  /**
   * @field
   * @description the text value of the fragment
   */
  this.value = data;
}
Color.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<span>" + this.value + "</span>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value;
  }
};

/**
 * Embodies a geopoint
 * @constructor
 * @global
 * @alias Fragments:GeoPoint
 */
function GeoPoint(data) {
  /**
   * @field
   * @description the latitude of the geo point
   */
  this.latitude = data.latitude;
  /**
   * @field
   * @description the longitude of the geo point
   */
  this.longitude = data.longitude;
}

GeoPoint.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return '<div class="geopoint"><span class="latitude">' + this.latitude + '</span><span class="longitude">' + this.longitude + '</span></div>';
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return '(' + this.latitude + "," + this.longitude + ')';
  }
};

/**
 * Embodies a Number fragment
 * @constructor
 * @global
 * @alias Fragments:Num
 */
function Num(data) {
  /**
   * @field
   * @description the integer value of the fragment
   */
  this.value = data;
}
Num.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<span>" + this.value + "</span>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value.toString();
  }
};

/**
 * Embodies a Date fragment
 * @constructor
 * @global
 * @alias Fragments:Date
 */
function DateFragment(data) {
  /**
   * @field
   * @description the Date value of the fragment (as a regular JS Date object)
   */
  this.value = new Date(data);
}

DateFragment.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<time>" + this.value + "</time>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value.toString();
  }
};

/**
 * Embodies a Timestamp fragment
 * @constructor
 * @global
 * @alias Fragments:Timestamp
 */
function Timestamp(data) {
  /**
   * @field
   * @description the Date value of the fragment (as a regular JS Date object)
   */
  // Adding ":" in the locale if needed, so JS considers it ISO8601-compliant
  var correctIso8601Date = data.length == 24 ? data.substring(0, 22) + ':' + data.substring(22, 24) : data;
  this.value = new Date(correctIso8601Date);
}

Timestamp.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<time>" + this.value + "</time>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value.toString();
  }
};

/**
 * Embodies an embed fragment
 * @constructor
 * @global
 * @alias Fragments:Embed
 */
function Embed(data) {
  /**
   * @field
   * @description the JSON object exactly as is returned in the "data" field of the JSON responses (see API documentation: https://developers.prismic.io/documentation/UjBe8bGIJ3EKtgBZ/api-documentation#json-responses)
   */
  this.value = data;
}

Embed.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return this.value.oembed.html;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return "";
  }
};

/**
 * Embodies an Image fragment
 * @constructor
 * @global
 * @alias Fragments:ImageEl
 */
function ImageEl(main, views) {
  /**
   * @field
   * @description the main ImageView for this image
   */
  this.main = main;

  /**
   * @field
   * @description the url of the main ImageView for this image
   */
  this.url = main.url;

  /**
   * @field
   * @description an array of all the other ImageViews for this image
   */
  this.views = views || {};
}
ImageEl.prototype = {
  /**
   * Gets the view of the image, from its name
   *
   * @param {string} name - the name of the view to get
   * @returns {ImageView} - the proper view
   */
  getView: function getView(name) {
    if (name === "main") {
      return this.main;
    } else {
      return this.views[name];
    }
  },
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return this.main.asHtml();
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return "";
  }
};

/**
 * Embodies an image view (an image in prismic.io can be defined with several different thumbnail sizes, each size is called a "view")
 * @constructor
 * @global
 * @alias Fragments:ImageView
 */
function ImageView(url, width, height, alt) {
  /**
   * @field
   * @description the URL of the ImageView (useable as it, in a <img> tag in HTML, for instance)
   */
  this.url = url;
  /**
   * @field
   * @description the width of the ImageView
   */
  this.width = width;
  /**
   * @field
   * @description the height of the ImageView
   */
  this.height = height;
  /**
   * @field
   * @description the alt text for the ImageView
   */
  this.alt = alt;
}
ImageView.prototype = {
  ratio: function ratio() {
    return this.width / this.height;
  },
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<img src=\"" + this.url + "\" width=\"" + this.width + "\" height=\"" + this.height + "\" alt=\"" + this.alt + "\">";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return "";
  }
};

/**
 * Embodies a fragment of type "Group" (which is a group of subfragments)
 * @constructor
 * @global
 * @alias Fragments:Group
 */
function Group(data) {
  this.value = [];
  for (var i = 0; i < data.length; i++) {
    this.value.push(new GroupDoc(data[i]));
  }
}
Group.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   * @params {function} linkResolver - linkResolver function (please read prismic.io online documentation about this)
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml(linkResolver) {
    var output = "";
    for (var i = 0; i < this.value.length; i++) {
      output += this.value[i].asHtml(linkResolver);
    }
    return output;
  },
  /**
   * Turns the Group fragment into an array in order to access its items (groups of fragments),
   * or to loop through them.
   * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
   * @returns {Array} - the array of groups, each group being a JSON object with subfragment name as keys, and subfragment as values
   */
  toArray: function toArray() {
    return this.value;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText(linkResolver) {
    var output = "";
    for (var i = 0; i < this.value.length; i++) {
      output += this.value[i].asText(linkResolver) + '\n';
    }
    return output;
  },

  getFirstImage: function getFirstImage() {
    return this.toArray().reduce(function (image, fragment) {
      if (image) return image;else {
        return fragment.getFirstImage();
      }
    }, null);
  },

  getFirstTitle: function getFirstTitle() {
    return this.toArray().reduce(function (st, fragment) {
      if (st) return st;else {
        return fragment.getFirstTitle();
      }
    }, null);
  },

  getFirstParagraph: function getFirstParagraph() {
    return this.toArray().reduce(function (st, fragment) {
      if (st) return st;else {
        return fragment.getFirstParagraph();
      }
    }, null);
  }
};

/**
 * Embodies a structured text fragment
 * @constructor
 * @global
 * @alias Fragments:StructuredText
 */
function StructuredText(blocks) {

  this.blocks = blocks;
}

StructuredText.prototype = {

  /**
   * @returns {object} the first heading block in the text
   */
  getTitle: function getTitle() {
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.type.indexOf('heading') === 0) {
        return block;
      }
    }
    return null;
  },

  /**
   * @returns {object} the first block of type paragraph
   */
  getFirstParagraph: function getFirstParagraph() {
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.type == 'paragraph') {
        return block;
      }
    }
    return null;
  },

  /**
   * @returns {array} all paragraphs
   */
  getParagraphs: function getParagraphs() {
    var paragraphs = [];
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.type == 'paragraph') {
        paragraphs.push(block);
      }
    }
    return paragraphs;
  },

  /**
   * @returns {object} the nth paragraph
   */
  getParagraph: function getParagraph(n) {
    return this.getParagraphs()[n];
  },

  /**
   * @returns {object}
   */
  getFirstImage: function getFirstImage() {
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.type == 'image') {
        return new ImageView(block.url, block.dimensions.width, block.dimensions.height, block.alt);
      }
    }
    return null;
  },

  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   * @params {function} linkResolver - please read prismic.io online documentation about link resolvers
   * @params {function} htmlSerializer optional HTML serializer to customize the output
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml(linkResolver, htmlSerializer) {
    var blockGroups = [],
        blockGroup,
        block,
        html = [];
    if (!isFunction(linkResolver)) {
      // Backward compatibility with the old ctx argument
      var ctx = linkResolver;
      linkResolver = function linkResolver(doc, isBroken) {
        return ctx.linkResolver(ctx, doc, isBroken);
      };
    }
    if (Array.isArray(this.blocks)) {

      for (var i = 0; i < this.blocks.length; i++) {
        block = this.blocks[i];

        // Resolve image links
        if (block.type == "image" && block.linkTo) {
          var link = initField(block.linkTo);
          block.linkUrl = link.url(linkResolver);
        }

        if (block.type !== "list-item" && block.type !== "o-list-item") {
          // it's not a type that groups
          blockGroups.push(block);
          blockGroup = null;
        } else if (!blockGroup || blockGroup.type != "group-" + block.type) {
          // it's a new type or no BlockGroup was set so far
          blockGroup = {
            type: "group-" + block.type,
            blocks: [block]
          };
          blockGroups.push(blockGroup);
        } else {
          // it's the same type as before, no touching blockGroup
          blockGroup.blocks.push(block);
        }
      }

      var blockContent = function blockContent(block) {
        var content = "";
        if (block.blocks) {
          block.blocks.forEach(function (block2) {
            content = content + serialize(block2, blockContent(block2), htmlSerializer);
          });
        } else {
          content = insertSpans(block.text, block.spans, linkResolver, htmlSerializer);
        }
        return content;
      };

      blockGroups.forEach(function (blockGroup) {
        html.push(serialize(blockGroup, blockContent(blockGroup), htmlSerializer));
      });
    }

    return html.join('');
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    var output = [];
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.text) {
        output.push(block.text);
      }
    }
    return output.join(' ');
  }

};

function htmlEscape(input) {
  return input && input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

/**
 * Parses a block that has spans, and inserts the proper HTML code.
 *
 * @param {string} text - the original text of the block
 * @param {object} spans - the spans as returned by the API
 * @param {object} linkResolver - the function to build links that may be in the fragment (please read prismic.io's online documentation about this)
 * @param {function} htmlSerializer - optional serializer
 * @returns {string} - the HTML output
 */
function insertSpans(text, spans, linkResolver, htmlSerializer) {
  if (!spans || !spans.length) {
    return htmlEscape(text);
  }

  var tagsStart = {};
  var tagsEnd = {};

  spans.forEach(function (span) {
    if (!tagsStart[span.start]) {
      tagsStart[span.start] = [];
    }
    if (!tagsEnd[span.end]) {
      tagsEnd[span.end] = [];
    }

    tagsStart[span.start].push(span);
    tagsEnd[span.end].unshift(span);
  });

  var c;
  var html = "";
  var stack = [];
  for (var pos = 0, len = text.length + 1; pos < len; pos++) {
    // Looping to length + 1 to catch closing tags
    if (tagsEnd[pos]) {
      tagsEnd[pos].forEach(function () {
        // Close a tag
        var tag = stack.pop();
        // Continue only if block contains content.
        if (typeof tag !== 'undefined') {
          var innerHtml = serialize(tag.span, tag.text, htmlSerializer);
          if (stack.length === 0) {
            // The tag was top level
            html += innerHtml;
          } else {
            // Add the content to the parent tag
            stack[stack.length - 1].text += innerHtml;
          }
        }
      });
    }
    if (tagsStart[pos]) {
      // Sort bigger tags first to ensure the right tag hierarchy
      tagsStart[pos].sort(function (a, b) {
        return b.end - b.start - (a.end - a.start);
      });
      tagsStart[pos].forEach(function (span) {
        // Open a tag
        var url = null;
        if (span.type == "hyperlink") {
          var fragment = initField(span.data);
          if (fragment) {
            url = fragment.url(linkResolver);
          } else {
            if (console && console.error) console.error('Impossible to convert span.data as a Fragment', span);
            return;
          }
          span.url = url;
        }
        var elt = {
          span: span,
          text: ""
        };
        stack.push(elt);
      });
    }
    if (pos < text.length) {
      c = text[pos];
      if (stack.length === 0) {
        // Top-level text
        html += htmlEscape(c);
      } else {
        // Inner text of a span
        stack[stack.length - 1].text += htmlEscape(c);
      }
    }
  }

  return html;
}

/**
 * Embodies a Slice fragment
 * @constructor
 * @global
 * @alias Fragments:Slice
 */
function Slice(sliceType, label, value) {
  this.sliceType = sliceType;
  this.label = label;
  this.value = value;
}

Slice.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml(linkResolver) {
    var classes = ['slice'];
    if (this.label) classes.push(this.label);
    return '<div data-slicetype="' + this.sliceType + '" class="' + classes.join(' ') + '">' + this.value.asHtml(linkResolver) + '</div>';
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value.asText();
  },

  /**
   * Get the first Image in slice.
   * @returns {object}
   */
  getFirstImage: function getFirstImage() {
    var fragment = this.value;
    if (typeof fragment.getFirstImage === "function") {
      return fragment.getFirstImage();
    } else if (fragment instanceof ImageEl) {
      return fragment;
    } else return null;
  },

  getFirstTitle: function getFirstTitle() {
    var fragment = this.value;
    if (typeof fragment.getFirstTitle === "function") {
      return fragment.getFirstTitle();
    } else if (fragment instanceof StructuredText) {
      return fragment.getTitle();
    } else return null;
  },

  getFirstParagraph: function getFirstParagraph() {
    var fragment = this.value;
    if (typeof fragment.getFirstParagraph === "function") {
      return fragment.getFirstParagraph();
    } else return null;
  }
};

/**
 * Embodies a SliceZone fragment
 * @constructor
 * @global
 * @alias Fragments:SliceZone
 */
function SliceZone(data) {
  this.value = [];
  for (var i = 0; i < data.length; i++) {
    var sliceType = data[i]['slice_type'];
    var fragment = initField(data[i]['value']);
    var label = data[i]['slice_label'] || null;
    if (sliceType && fragment) {
      this.value.push(new Slice(sliceType, label, fragment));
    }
  }
  this.slices = this.value;
}

SliceZone.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml(linkResolver) {
    var output = "";
    for (var i = 0; i < this.value.length; i++) {
      output += this.value[i].asHtml(linkResolver);
    }
    return output;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    var output = "";
    for (var i = 0; i < this.value.length; i++) {
      output += this.value[i].asText() + '\n';
    }
    return output;
  },

  getFirstImage: function getFirstImage() {
    return this.value.reduce(function (image, slice) {
      if (image) return image;else {
        return slice.getFirstImage();
      }
    }, null);
  },

  getFirstTitle: function getFirstTitle() {
    return this.value.reduce(function (text, slice) {
      if (text) return text;else {
        return slice.getFirstTitle();
      }
    }, null);
  },

  getFirstParagraph: function getFirstParagraph() {
    return this.value.reduce(function (paragraph, slice) {
      if (paragraph) return paragraph;else {
        return slice.getFirstParagraph();
      }
    }, null);
  }
};

/**
 * From a fragment's name, casts it into the proper object type (like Prismic.Fragments.StructuredText)
 *
 * @private
 * @param {string} field - the fragment's name
 * @returns {object} - the object of the proper Fragments type.
 */
function initField(field) {

  var classForType = {
    "Color": Color,
    "Number": Num,
    "Date": DateFragment,
    "Timestamp": Timestamp,
    "Text": Text,
    "Embed": Embed,
    "GeoPoint": GeoPoint,
    "Select": Select,
    "StructuredText": StructuredText,
    "Link.document": DocumentLink,
    "Link.web": WebLink,
    "Link.file": FileLink,
    "Link.image": ImageLink,
    "Group": Group,
    "SliceZone": SliceZone
  };

  if (classForType[field.type]) {
    return new classForType[field.type](field.value);
  }

  if (field.type === "Image") {
    var img = field.value.main;
    var output = new ImageEl(new ImageView(img.url, img.dimensions.width, img.dimensions.height, img.alt), {});
    for (var name in field.value.views) {
      img = field.value.views[name];
      output.views[name] = new ImageView(img.url, img.dimensions.width, img.dimensions.height, img.alt);
    }
    return output;
  }

  if (console && console.log) console.log("Fragment type not supported: ", field.type);
  return null;
}

function parseFragments(json) {
  var result = {};
  for (var key in json) {
    if (json.hasOwnProperty(key)) {
      if (Array.isArray(json[key])) {
        result[key] = json[key].map(function (fragment) {
          return initField(fragment);
        });
      } else {
        result[key] = initField(json[key]);
      }
    }
  }
  return result;
}

function isFunction(f) {
  var getType = {};
  return f && getType.toString.call(f) === '[object Function]';
}

function serialize(element, content, htmlSerializer) {
  // Return the user customized output (if available)
  if (htmlSerializer) {
    var custom = htmlSerializer(element, content);
    if (custom) {
      return custom;
    }
  }

  // Fall back to the default HTML output
  var TAG_NAMES = {
    "heading1": "h1",
    "heading2": "h2",
    "heading3": "h3",
    "heading4": "h4",
    "heading5": "h5",
    "heading6": "h6",
    "paragraph": "p",
    "preformatted": "pre",
    "list-item": "li",
    "o-list-item": "li",
    "group-list-item": "ul",
    "group-o-list-item": "ol",
    "strong": "strong",
    "em": "em"
  };

  if (TAG_NAMES[element.type]) {
    var name = TAG_NAMES[element.type];
    var classCode = element.label ? ' class="' + element.label + '"' : '';
    return '<' + name + classCode + '>' + content + '</' + name + '>';
  }

  if (element.type == "image") {
    var label = element.label ? " " + element.label : "";
    var imgTag = '<img src="' + element.url + '" alt="' + element.alt + '">';
    return '<p class="block-img' + label + '">' + (element.linkUrl ? '<a href="' + element.linkUrl + '">' + imgTag + '</a>' : imgTag) + '</p>';
  }

  if (element.type == "embed") {
    return '<div data-oembed="' + element.embed_url + '" data-oembed-type="' + element.type + '" data-oembed-provider="' + element.provider_name + (element.label ? '" class="' + element.label : '') + '">' + element.oembed.html + "</div>";
  }

  if (element.type === 'hyperlink') {
    return '<a href="' + element.url + '">' + content + '</a>';
  }

  if (element.type === 'label') {
    return '<span class="' + element.data.label + '">' + content + '</span>';
  }

  return "<!-- Warning: " + element.type + " not implemented. Upgrade the Developer Kit. -->" + content;
}

module.exports = {
  Embed: Embed,
  Image: ImageEl,
  ImageView: ImageView,
  Text: Text,
  Number: Num,
  Date: DateFragment,
  Timestamp: Timestamp,
  Select: Select,
  Color: Color,
  StructuredText: StructuredText,
  WebLink: WebLink,
  DocumentLink: DocumentLink,
  ImageLink: ImageLink,
  FileLink: FileLink,
  Group: Group,
  GeoPoint: GeoPoint,
  Slice: Slice,
  SliceZone: SliceZone,
  initField: initField,
  parseFragments: parseFragments,
  insertSpans: insertSpans
};

},{"./documents":4}],7:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

/**
 * A doubly linked list-based Least Recently Used (LRU) cache. Will keep most
 * recently used items while discarding least recently used items when its limit
 * is reached.
 *
 * Licensed under MIT. Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>
 * See README.md for details.
 *
 * Illustration of the design:
 *
 *       entry             entry             entry             entry
 *       ______            ______            ______            ______
 *      | head |.newer => |      |.newer => |      |.newer => | tail |
 *      |  A   |          |  B   |          |  C   |          |  D   |
 *      |______| <= older.|______| <= older.|______| <= older.|______|
 *
 *  removed  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  added
 */
function LRUCache(limit) {
  // Current size of the cache. (Read-only).
  this.size = 0;
  // Maximum number of items this cache can hold.
  this.limit = limit;
  this._keymap = {};
}

/**
 * Put <value> into the cache associated with <key>. Returns the entry which was
 * removed to make room for the new entry. Otherwise undefined is returned
 * (i.e. if there was enough room already).
 */
LRUCache.prototype.put = function (key, value) {
  var entry = { key: key, value: value };
  // Note: No protection agains replacing, and thus orphan entries. By design.
  this._keymap[key] = entry;
  if (this.tail) {
    // link previous tail to the new tail (entry)
    this.tail.newer = entry;
    entry.older = this.tail;
  } else {
    // we're first in -- yay
    this.head = entry;
  }
  // add new entry to the end of the linked list -- it's now the freshest entry.
  this.tail = entry;
  if (this.size === this.limit) {
    // we hit the limit -- remove the head
    return this.shift();
  } else {
    // increase the size counter
    this.size++;
  }
};

/**
 * Purge the least recently used (oldest) entry from the cache. Returns the
 * removed entry or undefined if the cache was empty.
 *
 * If you need to perform any form of finalization of purged items, this is a
 * good place to do it. Simply override/replace this function:
 *
 *   var c = new LRUCache(123);
 *   c.shift = function() {
 *     var entry = LRUCache.prototype.shift.call(this);
 *     doSomethingWith(entry);
 *     return entry;
 *   }
 */
LRUCache.prototype.shift = function () {
  // todo: handle special case when limit == 1
  var entry = this.head;
  if (entry) {
    if (this.head.newer) {
      this.head = this.head.newer;
      this.head.older = undefined;
    } else {
      this.head = undefined;
    }
    // Remove last strong reference to <entry> and remove links from the purged
    // entry being returned:
    entry.newer = entry.older = undefined;
    // delete is slow, but we need to do this to avoid uncontrollable growth:
    delete this._keymap[entry.key];
  }
  return entry;
};

/**
 * Get and register recent use of <key>. Returns the value associated with <key>
 * or undefined if not in cache.
 */
LRUCache.prototype.get = function (key, returnEntry) {
  // First, find our cache entry
  var entry = this._keymap[key];
  if (entry === undefined) return null; // Not cached. Sorry.
  // As <key> was found in the cache, register it as being requested recently
  if (entry === this.tail) {
    // Already the most recenlty used entry, so no need to update the list
    return returnEntry ? entry : entry.value;
  }
  // HEAD--------------TAIL
  //   <.older   .newer>
  //  <--- add direction --
  //   A  B  C  <D>  E
  if (entry.newer) {
    if (entry === this.head) this.head = entry.newer;
    entry.newer.older = entry.older; // C <-- E.
  }
  if (entry.older) entry.older.newer = entry.newer; // C. --> E
  entry.newer = undefined; // D --x
  entry.older = this.tail; // D. --> E
  if (this.tail) this.tail.newer = entry; // E. <-- D
  this.tail = entry;
  return returnEntry ? entry : entry.value;
};

// ----------------------------------------------------------------------------
// Following code is optional and can be removed without breaking the core
// functionality.

/**
 * Check if <key> is in the cache without registering recent use. Feasible if
 * you do not want to chage the state of the cache, but only "peek" at it.
 * Returns the entry associated with <key> if found, or undefined if not found.
 */
LRUCache.prototype.find = function (key) {
  return this._keymap[key];
};

/**
 * Update the value of entry with <key>. Returns the old value, or undefined if
 * entry was not in the cache.
 */
LRUCache.prototype.set = function (key, value) {
  var oldvalue,
      entry = this.get(key, true);
  if (entry) {
    oldvalue = entry.value;
    entry.value = value;
  } else {
    oldvalue = this.put(key, value);
    if (oldvalue) oldvalue = oldvalue.value;
  }
  return oldvalue;
};

/**
 * Remove entry <key> from cache and return its value. Returns undefined if not
 * found.
 */
LRUCache.prototype.remove = function (key) {
  var entry = this._keymap[key];
  if (!entry) return null;
  delete this._keymap[entry.key]; // need to do delete unfortunately
  if (entry.newer && entry.older) {
    // relink the older entry with the newer entry
    entry.older.newer = entry.newer;
    entry.newer.older = entry.older;
  } else if (entry.newer) {
    // remove the link to us
    entry.newer.older = undefined;
    // link the newer entry to head
    this.head = entry.newer;
  } else if (entry.older) {
    // remove the link to us
    entry.older.newer = undefined;
    // link the newer entry to head
    this.tail = entry.older;
  } else {
    // if(entry.older === undefined && entry.newer === undefined) {
    this.head = this.tail = undefined;
  }

  this.size--;
  return entry.value;
};

/** Removes all entries */
LRUCache.prototype.removeAll = function () {
  // This should be safe, as we never expose strong refrences to the outside
  this.head = this.tail = undefined;
  this.size = 0;
  this._keymap = {};
};

/**
 * Return an array containing all keys of entries stored in the cache object, in
 * arbitrary order.
 */
if (typeof Object.keys === 'function') {
  LRUCache.prototype.keys = function () {
    return Object.keys(this._keymap);
  };
} else {
  LRUCache.prototype.keys = function () {
    var keys = [];
    for (var k in this._keymap) {
      keys.push(k);
    }return keys;
  };
}

/**
 * Call `fun` for each entry. Starting with the newest entry if `desc` is a true
 * value, otherwise starts with the oldest (head) enrty and moves towards the
 * tail.
 *
 * `fun` is called with 3 arguments in the context `context`:
 *   `fun.call(context, Object key, Object value, LRUCache self)`
 */
LRUCache.prototype.forEach = function (fun, context, desc) {
  var entry;
  if (context === true) {
    desc = true;context = undefined;
  } else if ((typeof context === 'undefined' ? 'undefined' : _typeof(context)) !== 'object') context = this;
  if (desc) {
    entry = this.tail;
    while (entry) {
      fun.call(context, entry.key, entry.value, this);
      entry = entry.older;
    }
  } else {
    entry = this.head;
    while (entry) {
      fun.call(context, entry.key, entry.value, this);
      entry = entry.newer;
    }
  }
};

/** Returns a JSON (array) representation */
LRUCache.prototype.toJSON = function () {
  var s = [],
      entry = this.head;
  while (entry) {
    s.push({ key: entry.key.toJSON(), value: entry.value.toJSON() });
    entry = entry.newer;
  }
  return s;
};

/** Returns a String representation */
LRUCache.prototype.toString = function () {
  var s = '',
      entry = this.head;
  while (entry) {
    s += String(entry.key) + ':' + entry.value;
    entry = entry.newer;
    if (entry) s += ' < ';
  }
  return s;
};

module.exports = LRUCache;

},{}],8:[function(require,module,exports){

"use strict";

/**
 * @global
 * @namespace
 * @alias Predicates
 */

module.exports = {

  /**
   * Build an "at" predicate: equality of a fragment to a value.
   *
   * @example Predicates.at("document.type", "article")
   * @param fragment {String}
   * @param value {String}
   * @returns {Array} an array corresponding to the predicate
   */
  at: function at(fragment, value) {
    return ["at", fragment, value];
  },

  /**
   * Build an "not" predicate: inequality of a fragment to a value.
   *
   * @example Predicates.not("document.type", "article")
   * @param fragment {String}
   * @param value {String}
   * @returns {Array} an array corresponding to the predicate
   */
  not: function not(fragment, value) {
    return ["not", fragment, value];
  },

  /**
   * Build a "missing" predicate: documents where the requested field is empty
   *
   * @example Predicates.missing("my.blog-post.author")
   * @param fragment {String}
   * @returns {Array} an array corresponding to the predicate
   */
  missing: function missing(fragment) {
    return ["missing", fragment];
  },

  /**
   * Build a "has" predicate: documents where the requested field is defined
   *
   * @example Predicates.has("my.blog-post.author")
   * @param fragment {String}
   * @returns {Array} an array corresponding to the predicate
   */
  has: function has(fragment) {
    return ["has", fragment];
  },

  /**
   * Build an "any" predicate: equality of a fragment to a value.
   *
   * @example Predicates.any("document.type", ["article", "blog-post"])
   * @param fragment {String}
   * @param values {Array}
   * @returns {Array} an array corresponding to the predicate
   */
  any: function any(fragment, values) {
    return ["any", fragment, values];
  },

  /**
   * Build an "in" predicate: equality of a fragment to a value.
   *
   * @example Predicates.in("my.product.price", [4, 5])
   * @param fragment {String}
   * @param values {Array}
   * @returns {Array} an array corresponding to the predicate
   */
  in: function _in(fragment, values) {
    return ["in", fragment, values];
  },

  /**
   * Build a "fulltext" predicate: fulltext search in a fragment.
   *
   * @example Predicates.fulltext("my.article.body", "sausage"])
   * @param fragment {String}
   * @param value {String} the term to search
   * @returns {Array} an array corresponding to the predicate
   */
  fulltext: function fulltext(fragment, value) {
    return ["fulltext", fragment, value];
  },

  /**
   * Build a "similar" predicate.
   *
   * @example Predicates.similar("UXasdFwe42D", 10)
   * @param documentId {String} the document id to retrieve similar documents to.
   * @param maxResults {Number} the maximum number of results to return
   * @returns {Array} an array corresponding to the predicate
   */
  similar: function similar(documentId, maxResults) {
    return ["similar", documentId, maxResults];
  },

  /**
   * Build a "number.gt" predicate: documents where the fragment field is greater than the given value.
   *
   * @example Predicates.gt("my.product.price", 10)
   * @param fragment {String} the name of the field - must be a number.
   * @param value {Number} the lower bound of the predicate
   * @returns {Array} an array corresponding to the predicate
   */
  gt: function gt(fragment, value) {
    return ["number.gt", fragment, value];
  },

  /**
   * Build a "number.lt" predicate: documents where the fragment field is lower than the given value.
   *
   * @example Predicates.lt("my.product.price", 20)
   * @param fragment {String} the name of the field - must be a number.
   * @param value {Number} the upper bound of the predicate
   * @returns {Array} an array corresponding to the predicate
   */
  lt: function lt(fragment, value) {
    return ["number.lt", fragment, value];
  },

  /**
   * Build a "number.inRange" predicate: combination of lt and gt.
   *
   * @example Predicates.inRange("my.product.price", 10, 20)
   * @param fragment {String} the name of the field - must be a number.
   * @param before {Number}
   * @param after {Number}
   * @returns {Array} an array corresponding to the predicate
   */
  inRange: function inRange(fragment, before, after) {
    return ["number.inRange", fragment, before, after];
  },

  /**
   * Build a "date.before" predicate: documents where the fragment field is before the given date.
   *
   * @example Predicates.dateBefore("my.product.releaseDate", new Date(2014, 6, 1))
   * @param fragment {String} the name of the field - must be a date or timestamp field.
   * @param before {Date}
   * @returns {Array} an array corresponding to the predicate
   */
  dateBefore: function dateBefore(fragment, before) {
    return ["date.before", fragment, before];
  },

  /**
   * Build a "date.after" predicate: documents where the fragment field is after the given date.
   *
   * @example Predicates.dateAfter("my.product.releaseDate", new Date(2014, 1, 1))
   * @param fragment {String} the name of the field - must be a date or timestamp field.
   * @param after {Date}
   * @returns {Array} an array corresponding to the predicate
   */
  dateAfter: function dateAfter(fragment, after) {
    return ["date.after", fragment, after];
  },

  /**
   * Build a "date.between" predicate: combination of dateBefore and dateAfter
   *
   * @example Predicates.dateBetween("my.product.releaseDate", new Date(2014, 1, 1), new Date(2014, 6, 1))
   * @param fragment {String} the name of the field - must be a date or timestamp field.
   * @param before {Date}
   * @param after {Date}
   * @returns {Array} an array corresponding to the predicate
   */
  dateBetween: function dateBetween(fragment, before, after) {
    return ["date.between", fragment, before, after];
  },

  /**
   *
   * @example Predicates.dayOfMonth("my.product.releaseDate", 14)
   * @param fragment
   * @param day {Number} between 1 and 31
   * @returns {Array}
   */
  dayOfMonth: function dayOfMonth(fragment, day) {
    return ["date.day-of-month", fragment, day];
  },

  /**
   *
   * @example Predicates.dayOfMonthAfter("my.product.releaseDate", 14)
   * @param fragment
   * @param day {Number} between 1 and 31
   * @returns {Array}
   */
  dayOfMonthAfter: function dayOfMonthAfter(fragment, day) {
    return ["date.day-of-month-after", fragment, day];
  },

  /**
   *
   * @example Predicates.dayOfMonthBefore("my.product.releaseDate", 14)
   * @param fragment
   * @param day {Number} between 1 and 31
   * @returns {Array}
   */
  dayOfMonthBefore: function dayOfMonthBefore(fragment, day) {
    return ["date.day-of-month-before", fragment, day];
  },

  /**
   *
   * @example Predicates.dayOfWeek("my.product.releaseDate", 14)
   * @param fragment
   * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
   * @returns {Array}
   */
  dayOfWeek: function dayOfWeek(fragment, day) {
    return ["date.day-of-week", fragment, day];
  },

  /**
   *
   * @example Predicates.dayOfWeekAfter("my.product.releaseDate", "Wednesday")
   * @param fragment
   * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
   * @returns {Array}
   */
  dayOfWeekAfter: function dayOfWeekAfter(fragment, day) {
    return ["date.day-of-week-after", fragment, day];
  },

  /**
   *
   * @example Predicates.dayOfWeekBefore("my.product.releaseDate", "Wednesday")
   * @param fragment
   * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
   * @returns {Array}
   */
  dayOfWeekBefore: function dayOfWeekBefore(fragment, day) {
    return ["date.day-of-week-before", fragment, day];
  },

  /**
   *
   * @example Predicates.month("my.product.releaseDate", "June")
   * @param fragment
   * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
   * @returns {Array}
   */
  month: function month(fragment, _month) {
    return ["date.month", fragment, _month];
  },

  /**
   *
   * @example Predicates.monthBefore("my.product.releaseDate", "June")
   * @param fragment
   * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
   * @returns {Array}
   */
  monthBefore: function monthBefore(fragment, month) {
    return ["date.month-before", fragment, month];
  },

  /**
   *
   * @example Predicates.monthAfter("my.product.releaseDate", "June")
   * @param fragment
   * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
   * @returns {Array}
   * @returns {Array}
   */
  monthAfter: function monthAfter(fragment, month) {
    return ["date.month-after", fragment, month];
  },

  /**
   *
   * @example Predicates.year("my.product.releaseDate", 2014)
   * @param fragment
   * @param year {Number}
   * @returns {Array}
   */
  year: function year(fragment, _year) {
    return ["date.year", fragment, _year];
  },

  /**
   *
   * @example Predicates.hour("my.product.releaseDate", 12)
   * @param fragment
   * @param hour {Number}
   * @returns {Array}
   */
  hour: function hour(fragment, _hour) {
    return ["date.hour", fragment, _hour];
  },

  /**
   *
   * @example Predicates.hourBefore("my.product.releaseDate", 12)
   * @param fragment
   * @param hour {Number}
   * @returns {Array}
   */
  hourBefore: function hourBefore(fragment, hour) {
    return ["date.hour-before", fragment, hour];
  },

  /**
   *
   * @example Predicates.hourAfter("my.product.releaseDate", 12)
   * @param fragment
   * @param hour {Number}
   * @returns {Array}
   */
  hourAfter: function hourAfter(fragment, hour) {
    return ["date.hour-after", fragment, hour];
  },

  /**
   *
   * @example Predicates.near("my.store.location", 48.8768767, 2.3338802, 10)
   * @param fragment
   * @param latitude {Number}
   * @param longitude {Number}
   * @param radius {Number} in kilometers
   * @returns {Array}
   */
  near: function near(fragment, latitude, longitude, radius) {
    return ["geopoint.near", fragment, latitude, longitude, radius];
  }

};

},{}],9:[function(require,module,exports){
"use strict";

var experiments = require('./experiments'),
    Predicates = require('./predicates'),
    api = require('./api'),
    Fragments = require('./fragments'),
    documents = require('./documents');

var Api = api.Api,
    Experiments = experiments.Experiments;

/**
 * The kit's main entry point; initialize your API like this: Prismic.Api(url, callback, accessToken, maybeRequestHandler)
 *
 * @global
 * @alias Api
 * @constructor
 * @param {string} url - The mandatory URL of the prismic.io API endpoint (like: https://lesbonneschoses.prismic.io/api)
 * @param {function} callback - Optional callback function that is called after the API was retrieved, which will be called with two parameters: a potential error object and the API object
 * @param {string} maybeAccessToken - The accessToken for an OAuth2 connection
 * @param {function} maybeRequestHandler - Environment specific HTTP request handling function
 * @param {object} maybeApiCache - A cache object with get/set functions for caching API responses
 * @param {int} maybeApiDataTTL - How long (in seconds) to cache data used by the client to make calls (e.g. refs). Defaults to 5 seconds
 * @returns {Api} - The Api object that can be manipulated
 */
function getApi(url, callback, maybeAccessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL) {
  var api = new Api(url, maybeAccessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL);
  //Use cached api data if available
  api.get(function (err, data) {
    if (callback && err) {
      callback(err);
      return;
    }

    if (data) {
      api.data = data;
      api.bookmarks = data.bookmarks;
      api.experiments = new Experiments(data.experiments);
    }

    if (callback) {
      callback(null, api);
    }
  });

  return api;
}

module.exports = {
  experimentCookie: "io.prismic.experiment",
  previewCookie: "io.prismic.preview",
  Api: Api,
  Document: documents.Document,
  SearchForm: api.SearchForm,
  Form: api.Form,
  Experiments: Experiments,
  Predicates: Predicates,
  Fragments: Fragments,
  api: getApi,
  parseDoc: api.parseDoc
};

module.exports.Prismic = module.exports; // Backward compatibility

},{"./api":1,"./documents":4,"./experiments":5,"./fragments":6,"./predicates":8}],10:[function(require,module,exports){
(function (process){

"use strict";

var createError = function createError(status, message) {
  var err = new Error(message);
  err.status = status;
  return err;
};

// -- Request handlers

var ajaxRequest = function ajaxRequest() {
  if (typeof XMLHttpRequest != 'undefined' && 'withCredentials' in new XMLHttpRequest()) {
    return function (url, callback) {

      var xhr = new XMLHttpRequest();

      // Called on success
      var resolve = function resolve() {
        var ttl,
            cacheControl = /max-age\s*=\s*(\d+)/.exec(xhr.getResponseHeader('Cache-Control'));
        if (cacheControl && cacheControl.length > 1) {
          ttl = parseInt(cacheControl[1], 10);
        }
        callback(null, JSON.parse(xhr.responseText), xhr, ttl);
      };

      // Called on error
      var reject = function reject() {
        var status = xhr.status;
        callback(createError(status, "Unexpected status code [" + status + "] on URL " + url), null, xhr);
      };

      // Bind the XHR finished callback
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status && xhr.status == 200) {
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
};

var xdomainRequest = function xdomainRequest() {
  if (typeof XDomainRequest != 'undefined') {
    // Internet Explorer
    return function (url, callback) {

      var xdr = new XDomainRequest();

      // Called on success
      var resolve = function resolve() {
        callback(null, JSON.parse(xdr.responseText), xdr, 0);
      };

      // Called on error
      var reject = function reject(msg) {
        callback(new Error(msg), null, xdr);
      };

      // Bind the XDR finished callback
      xdr.onload = function () {
        resolve(xdr);
      };

      // Bind the XDR error callback
      xdr.onerror = function () {
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
      xdr.onprogress = function () {};

      xdr.send();
    };
  }
};

var nodeJSRequest = function nodeJSRequest() {
  if (typeof require == 'function' && require('http')) {
    var http = require('http'),
        https = require('https'),
        url = require('url'),
        pjson = require('../package.json');

    return function (requestUrl, callback) {

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
        console.log("BOOM");
        var e = new Error('dummy');
        var stack = e.stack.replace(/^[^\(]+?[\n$]/gm, '').replace(/^\s+at\s+/gm, '').replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@').split('\n');
        console.log(stack);
      }
      var request = h.get(options, function (response) {
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
          callback(createError(response.statusCode, "Unexpected status code [" + response.statusCode + "] on URL " + requestUrl), null, response);
        }
      });

      // properly handle timeouts
      request.on('error', function (err) {
        callback(new Error("Unexpected error on URL " + requestUrl), null, err);
      });
    };
  }
};

// Number of maximum simultaneous connections to the prismic server
var MAX_CONNECTIONS = 20;
// Number of requests currently running (capped by MAX_CONNECTIONS)
var running = 0;
// Requests in queue
var queue = [];

var processQueue = function processQueue() {
  if (queue.length === 0 || running >= MAX_CONNECTIONS) {
    return;
  }
  running++;
  var next = queue.shift();
  var fn = ajaxRequest() || xdomainRequest() || nodeJSRequest() || function () {
    throw new Error("No request handler available (tried XMLHttpRequest & NodeJS)");
  }();
  fn.call(this, next.url, function (error, result, xhr, ttl) {
    running--;
    next.callback(error, result, xhr, ttl);
    processQueue();
  });
};

var request = function request(url, callback) {
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

}).call(this,require('_process'))

},{"../package.json":50,"_process":25,"http":41,"https":19,"url":46}],11:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],12:[function(require,module,exports){

},{}],13:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
 *     on objects.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  function Bar () {}
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    arr.constructor = Bar
    return arr.foo() === 42 && // typed array instances can be augmented
        arr.constructor === Bar && // constructor can be set
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    array.byteLength
    that = Buffer._augment(new Uint8Array(array))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` is deprecated
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` is deprecated
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":11,"ieee754":20,"isarray":14}],14:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],15:[function(require,module,exports){
module.exports = {
  "100": "Continue",
  "101": "Switching Protocols",
  "102": "Processing",
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content",
  "205": "Reset Content",
  "206": "Partial Content",
  "207": "Multi-Status",
  "300": "Multiple Choices",
  "301": "Moved Permanently",
  "302": "Moved Temporarily",
  "303": "See Other",
  "304": "Not Modified",
  "305": "Use Proxy",
  "307": "Temporary Redirect",
  "308": "Permanent Redirect",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Time-out",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Request Entity Too Large",
  "414": "Request-URI Too Large",
  "415": "Unsupported Media Type",
  "416": "Requested Range Not Satisfiable",
  "417": "Expectation Failed",
  "418": "I'm a teapot",
  "422": "Unprocessable Entity",
  "423": "Locked",
  "424": "Failed Dependency",
  "425": "Unordered Collection",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "429": "Too Many Requests",
  "431": "Request Header Fields Too Large",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Time-out",
  "505": "HTTP Version Not Supported",
  "506": "Variant Also Negotiates",
  "507": "Insufficient Storage",
  "509": "Bandwidth Limit Exceeded",
  "510": "Not Extended",
  "511": "Network Authentication Required"
}

},{}],16:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})

},{"../../is-buffer/index.js":22}],17:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/jakearchibald/es6-promise/master/LICENSE
 * @version   3.0.2
 */

(function() {
    "use strict";
    function lib$es6$promise$utils$$objectOrFunction(x) {
      return typeof x === 'function' || (typeof x === 'object' && x !== null);
    }

    function lib$es6$promise$utils$$isFunction(x) {
      return typeof x === 'function';
    }

    function lib$es6$promise$utils$$isMaybeThenable(x) {
      return typeof x === 'object' && x !== null;
    }

    var lib$es6$promise$utils$$_isArray;
    if (!Array.isArray) {
      lib$es6$promise$utils$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      };
    } else {
      lib$es6$promise$utils$$_isArray = Array.isArray;
    }

    var lib$es6$promise$utils$$isArray = lib$es6$promise$utils$$_isArray;
    var lib$es6$promise$asap$$len = 0;
    var lib$es6$promise$asap$$toString = {}.toString;
    var lib$es6$promise$asap$$vertxNext;
    var lib$es6$promise$asap$$customSchedulerFn;

    var lib$es6$promise$asap$$asap = function asap(callback, arg) {
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len] = callback;
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len + 1] = arg;
      lib$es6$promise$asap$$len += 2;
      if (lib$es6$promise$asap$$len === 2) {
        // If len is 2, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        if (lib$es6$promise$asap$$customSchedulerFn) {
          lib$es6$promise$asap$$customSchedulerFn(lib$es6$promise$asap$$flush);
        } else {
          lib$es6$promise$asap$$scheduleFlush();
        }
      }
    }

    function lib$es6$promise$asap$$setScheduler(scheduleFn) {
      lib$es6$promise$asap$$customSchedulerFn = scheduleFn;
    }

    function lib$es6$promise$asap$$setAsap(asapFn) {
      lib$es6$promise$asap$$asap = asapFn;
    }

    var lib$es6$promise$asap$$browserWindow = (typeof window !== 'undefined') ? window : undefined;
    var lib$es6$promise$asap$$browserGlobal = lib$es6$promise$asap$$browserWindow || {};
    var lib$es6$promise$asap$$BrowserMutationObserver = lib$es6$promise$asap$$browserGlobal.MutationObserver || lib$es6$promise$asap$$browserGlobal.WebKitMutationObserver;
    var lib$es6$promise$asap$$isNode = typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

    // test for web worker but not in IE10
    var lib$es6$promise$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' &&
      typeof importScripts !== 'undefined' &&
      typeof MessageChannel !== 'undefined';

    // node
    function lib$es6$promise$asap$$useNextTick() {
      // node version 0.10.x displays a deprecation warning when nextTick is used recursively
      // see https://github.com/cujojs/when/issues/410 for details
      return function() {
        process.nextTick(lib$es6$promise$asap$$flush);
      };
    }

    // vertx
    function lib$es6$promise$asap$$useVertxTimer() {
      return function() {
        lib$es6$promise$asap$$vertxNext(lib$es6$promise$asap$$flush);
      };
    }

    function lib$es6$promise$asap$$useMutationObserver() {
      var iterations = 0;
      var observer = new lib$es6$promise$asap$$BrowserMutationObserver(lib$es6$promise$asap$$flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    // web worker
    function lib$es6$promise$asap$$useMessageChannel() {
      var channel = new MessageChannel();
      channel.port1.onmessage = lib$es6$promise$asap$$flush;
      return function () {
        channel.port2.postMessage(0);
      };
    }

    function lib$es6$promise$asap$$useSetTimeout() {
      return function() {
        setTimeout(lib$es6$promise$asap$$flush, 1);
      };
    }

    var lib$es6$promise$asap$$queue = new Array(1000);
    function lib$es6$promise$asap$$flush() {
      for (var i = 0; i < lib$es6$promise$asap$$len; i+=2) {
        var callback = lib$es6$promise$asap$$queue[i];
        var arg = lib$es6$promise$asap$$queue[i+1];

        callback(arg);

        lib$es6$promise$asap$$queue[i] = undefined;
        lib$es6$promise$asap$$queue[i+1] = undefined;
      }

      lib$es6$promise$asap$$len = 0;
    }

    function lib$es6$promise$asap$$attemptVertx() {
      try {
        var r = require;
        var vertx = r('vertx');
        lib$es6$promise$asap$$vertxNext = vertx.runOnLoop || vertx.runOnContext;
        return lib$es6$promise$asap$$useVertxTimer();
      } catch(e) {
        return lib$es6$promise$asap$$useSetTimeout();
      }
    }

    var lib$es6$promise$asap$$scheduleFlush;
    // Decide what async method to use to triggering processing of queued callbacks:
    if (lib$es6$promise$asap$$isNode) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useNextTick();
    } else if (lib$es6$promise$asap$$BrowserMutationObserver) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMutationObserver();
    } else if (lib$es6$promise$asap$$isWorker) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMessageChannel();
    } else if (lib$es6$promise$asap$$browserWindow === undefined && typeof require === 'function') {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$attemptVertx();
    } else {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useSetTimeout();
    }

    function lib$es6$promise$$internal$$noop() {}

    var lib$es6$promise$$internal$$PENDING   = void 0;
    var lib$es6$promise$$internal$$FULFILLED = 1;
    var lib$es6$promise$$internal$$REJECTED  = 2;

    var lib$es6$promise$$internal$$GET_THEN_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$selfFulfillment() {
      return new TypeError("You cannot resolve a promise with itself");
    }

    function lib$es6$promise$$internal$$cannotReturnOwn() {
      return new TypeError('A promises callback cannot return that same promise.');
    }

    function lib$es6$promise$$internal$$getThen(promise) {
      try {
        return promise.then;
      } catch(error) {
        lib$es6$promise$$internal$$GET_THEN_ERROR.error = error;
        return lib$es6$promise$$internal$$GET_THEN_ERROR;
      }
    }

    function lib$es6$promise$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
      try {
        then.call(value, fulfillmentHandler, rejectionHandler);
      } catch(e) {
        return e;
      }
    }

    function lib$es6$promise$$internal$$handleForeignThenable(promise, thenable, then) {
       lib$es6$promise$asap$$asap(function(promise) {
        var sealed = false;
        var error = lib$es6$promise$$internal$$tryThen(then, thenable, function(value) {
          if (sealed) { return; }
          sealed = true;
          if (thenable !== value) {
            lib$es6$promise$$internal$$resolve(promise, value);
          } else {
            lib$es6$promise$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          if (sealed) { return; }
          sealed = true;

          lib$es6$promise$$internal$$reject(promise, reason);
        }, 'Settle: ' + (promise._label || ' unknown promise'));

        if (!sealed && error) {
          sealed = true;
          lib$es6$promise$$internal$$reject(promise, error);
        }
      }, promise);
    }

    function lib$es6$promise$$internal$$handleOwnThenable(promise, thenable) {
      if (thenable._state === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, thenable._result);
      } else if (thenable._state === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, thenable._result);
      } else {
        lib$es6$promise$$internal$$subscribe(thenable, undefined, function(value) {
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      }
    }

    function lib$es6$promise$$internal$$handleMaybeThenable(promise, maybeThenable) {
      if (maybeThenable.constructor === promise.constructor) {
        lib$es6$promise$$internal$$handleOwnThenable(promise, maybeThenable);
      } else {
        var then = lib$es6$promise$$internal$$getThen(maybeThenable);

        if (then === lib$es6$promise$$internal$$GET_THEN_ERROR) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$GET_THEN_ERROR.error);
        } else if (then === undefined) {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        } else if (lib$es6$promise$utils$$isFunction(then)) {
          lib$es6$promise$$internal$$handleForeignThenable(promise, maybeThenable, then);
        } else {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        }
      }
    }

    function lib$es6$promise$$internal$$resolve(promise, value) {
      if (promise === value) {
        lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$selfFulfillment());
      } else if (lib$es6$promise$utils$$objectOrFunction(value)) {
        lib$es6$promise$$internal$$handleMaybeThenable(promise, value);
      } else {
        lib$es6$promise$$internal$$fulfill(promise, value);
      }
    }

    function lib$es6$promise$$internal$$publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._result);
      }

      lib$es6$promise$$internal$$publish(promise);
    }

    function lib$es6$promise$$internal$$fulfill(promise, value) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }

      promise._result = value;
      promise._state = lib$es6$promise$$internal$$FULFILLED;

      if (promise._subscribers.length !== 0) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, promise);
      }
    }

    function lib$es6$promise$$internal$$reject(promise, reason) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }
      promise._state = lib$es6$promise$$internal$$REJECTED;
      promise._result = reason;

      lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publishRejection, promise);
    }

    function lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + lib$es6$promise$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + lib$es6$promise$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, parent);
      }
    }

    function lib$es6$promise$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if (subscribers.length === 0) { return; }

      var child, callback, detail = promise._result;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        if (child) {
          lib$es6$promise$$internal$$invokeCallback(settled, child, callback, detail);
        } else {
          callback(detail);
        }
      }

      promise._subscribers.length = 0;
    }

    function lib$es6$promise$$internal$$ErrorObject() {
      this.error = null;
    }

    var lib$es6$promise$$internal$$TRY_CATCH_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$tryCatch(callback, detail) {
      try {
        return callback(detail);
      } catch(e) {
        lib$es6$promise$$internal$$TRY_CATCH_ERROR.error = e;
        return lib$es6$promise$$internal$$TRY_CATCH_ERROR;
      }
    }

    function lib$es6$promise$$internal$$invokeCallback(settled, promise, callback, detail) {
      var hasCallback = lib$es6$promise$utils$$isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        value = lib$es6$promise$$internal$$tryCatch(callback, detail);

        if (value === lib$es6$promise$$internal$$TRY_CATCH_ERROR) {
          failed = true;
          error = value.error;
          value = null;
        } else {
          succeeded = true;
        }

        if (promise === value) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$cannotReturnOwn());
          return;
        }

      } else {
        value = detail;
        succeeded = true;
      }

      if (promise._state !== lib$es6$promise$$internal$$PENDING) {
        // noop
      } else if (hasCallback && succeeded) {
        lib$es6$promise$$internal$$resolve(promise, value);
      } else if (failed) {
        lib$es6$promise$$internal$$reject(promise, error);
      } else if (settled === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, value);
      } else if (settled === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, value);
      }
    }

    function lib$es6$promise$$internal$$initializePromise(promise, resolver) {
      try {
        resolver(function resolvePromise(value){
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function rejectPromise(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      } catch(e) {
        lib$es6$promise$$internal$$reject(promise, e);
      }
    }

    function lib$es6$promise$enumerator$$Enumerator(Constructor, input) {
      var enumerator = this;

      enumerator._instanceConstructor = Constructor;
      enumerator.promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (enumerator._validateInput(input)) {
        enumerator._input     = input;
        enumerator.length     = input.length;
        enumerator._remaining = input.length;

        enumerator._init();

        if (enumerator.length === 0) {
          lib$es6$promise$$internal$$fulfill(enumerator.promise, enumerator._result);
        } else {
          enumerator.length = enumerator.length || 0;
          enumerator._enumerate();
          if (enumerator._remaining === 0) {
            lib$es6$promise$$internal$$fulfill(enumerator.promise, enumerator._result);
          }
        }
      } else {
        lib$es6$promise$$internal$$reject(enumerator.promise, enumerator._validationError());
      }
    }

    lib$es6$promise$enumerator$$Enumerator.prototype._validateInput = function(input) {
      return lib$es6$promise$utils$$isArray(input);
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._validationError = function() {
      return new Error('Array Methods must be provided an Array');
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._init = function() {
      this._result = new Array(this.length);
    };

    var lib$es6$promise$enumerator$$default = lib$es6$promise$enumerator$$Enumerator;

    lib$es6$promise$enumerator$$Enumerator.prototype._enumerate = function() {
      var enumerator = this;

      var length  = enumerator.length;
      var promise = enumerator.promise;
      var input   = enumerator._input;

      for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        enumerator._eachEntry(input[i], i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
      var enumerator = this;
      var c = enumerator._instanceConstructor;

      if (lib$es6$promise$utils$$isMaybeThenable(entry)) {
        if (entry.constructor === c && entry._state !== lib$es6$promise$$internal$$PENDING) {
          entry._onerror = null;
          enumerator._settledAt(entry._state, i, entry._result);
        } else {
          enumerator._willSettleAt(c.resolve(entry), i);
        }
      } else {
        enumerator._remaining--;
        enumerator._result[i] = entry;
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
      var enumerator = this;
      var promise = enumerator.promise;

      if (promise._state === lib$es6$promise$$internal$$PENDING) {
        enumerator._remaining--;

        if (state === lib$es6$promise$$internal$$REJECTED) {
          lib$es6$promise$$internal$$reject(promise, value);
        } else {
          enumerator._result[i] = value;
        }
      }

      if (enumerator._remaining === 0) {
        lib$es6$promise$$internal$$fulfill(promise, enumerator._result);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      lib$es6$promise$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt(lib$es6$promise$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt(lib$es6$promise$$internal$$REJECTED, i, reason);
      });
    };
    function lib$es6$promise$promise$all$$all(entries) {
      return new lib$es6$promise$enumerator$$default(this, entries).promise;
    }
    var lib$es6$promise$promise$all$$default = lib$es6$promise$promise$all$$all;
    function lib$es6$promise$promise$race$$race(entries) {
      /*jshint validthis:true */
      var Constructor = this;

      var promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (!lib$es6$promise$utils$$isArray(entries)) {
        lib$es6$promise$$internal$$reject(promise, new TypeError('You must pass an array to race.'));
        return promise;
      }

      var length = entries.length;

      function onFulfillment(value) {
        lib$es6$promise$$internal$$resolve(promise, value);
      }

      function onRejection(reason) {
        lib$es6$promise$$internal$$reject(promise, reason);
      }

      for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        lib$es6$promise$$internal$$subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
      }

      return promise;
    }
    var lib$es6$promise$promise$race$$default = lib$es6$promise$promise$race$$race;
    function lib$es6$promise$promise$resolve$$resolve(object) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$resolve(promise, object);
      return promise;
    }
    var lib$es6$promise$promise$resolve$$default = lib$es6$promise$promise$resolve$$resolve;
    function lib$es6$promise$promise$reject$$reject(reason) {
      /*jshint validthis:true */
      var Constructor = this;
      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$reject(promise, reason);
      return promise;
    }
    var lib$es6$promise$promise$reject$$default = lib$es6$promise$promise$reject$$reject;

    var lib$es6$promise$promise$$counter = 0;

    function lib$es6$promise$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function lib$es6$promise$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }

    var lib$es6$promise$promise$$default = lib$es6$promise$promise$$Promise;
    /**
      Promise objects represent the eventual result of an asynchronous operation. The
      primary way of interacting with a promise is through its `then` method, which
      registers callbacks to receive either a promise's eventual value or the reason
      why the promise cannot be fulfilled.

      Terminology
      -----------

      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
      - `thenable` is an object or function that defines a `then` method.
      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
      - `exception` is a value that is thrown using the throw statement.
      - `reason` is a value that indicates why a promise was rejected.
      - `settled` the final resting state of a promise, fulfilled or rejected.

      A promise can be in one of three states: pending, fulfilled, or rejected.

      Promises that are fulfilled have a fulfillment value and are in the fulfilled
      state.  Promises that are rejected have a rejection reason and are in the
      rejected state.  A fulfillment value is never a thenable.

      Promises can also be said to *resolve* a value.  If this value is also a
      promise, then the original promise's settled state will match the value's
      settled state.  So a promise that *resolves* a promise that rejects will
      itself reject, and a promise that *resolves* a promise that fulfills will
      itself fulfill.


      Basic Usage:
      ------------

      ```js
      var promise = new Promise(function(resolve, reject) {
        // on success
        resolve(value);

        // on failure
        reject(reason);
      });

      promise.then(function(value) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Advanced Usage:
      ---------------

      Promises shine when abstracting away asynchronous interactions such as
      `XMLHttpRequest`s.

      ```js
      function getJSON(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();

          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'json';
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
              }
            }
          };
        });
      }

      getJSON('/posts.json').then(function(json) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Unlike callbacks, promises are great composable primitives.

      ```js
      Promise.all([
        getJSON('/posts'),
        getJSON('/comments')
      ]).then(function(values){
        values[0] // => postsJSON
        values[1] // => commentsJSON

        return values;
      });
      ```

      @class Promise
      @param {function} resolver
      Useful for tooling.
      @constructor
    */
    function lib$es6$promise$promise$$Promise(resolver) {
      this._id = lib$es6$promise$promise$$counter++;
      this._state = undefined;
      this._result = undefined;
      this._subscribers = [];

      if (lib$es6$promise$$internal$$noop !== resolver) {
        if (!lib$es6$promise$utils$$isFunction(resolver)) {
          lib$es6$promise$promise$$needsResolver();
        }

        if (!(this instanceof lib$es6$promise$promise$$Promise)) {
          lib$es6$promise$promise$$needsNew();
        }

        lib$es6$promise$$internal$$initializePromise(this, resolver);
      }
    }

    lib$es6$promise$promise$$Promise.all = lib$es6$promise$promise$all$$default;
    lib$es6$promise$promise$$Promise.race = lib$es6$promise$promise$race$$default;
    lib$es6$promise$promise$$Promise.resolve = lib$es6$promise$promise$resolve$$default;
    lib$es6$promise$promise$$Promise.reject = lib$es6$promise$promise$reject$$default;
    lib$es6$promise$promise$$Promise._setScheduler = lib$es6$promise$asap$$setScheduler;
    lib$es6$promise$promise$$Promise._setAsap = lib$es6$promise$asap$$setAsap;
    lib$es6$promise$promise$$Promise._asap = lib$es6$promise$asap$$asap;

    lib$es6$promise$promise$$Promise.prototype = {
      constructor: lib$es6$promise$promise$$Promise,

    /**
      The primary way of interacting with a promise is through its `then` method,
      which registers callbacks to receive either a promise's eventual value or the
      reason why the promise cannot be fulfilled.

      ```js
      findUser().then(function(user){
        // user is available
      }, function(reason){
        // user is unavailable, and you are given the reason why
      });
      ```

      Chaining
      --------

      The return value of `then` is itself a promise.  This second, 'downstream'
      promise is resolved with the return value of the first promise's fulfillment
      or rejection handler, or rejected if the handler throws an exception.

      ```js
      findUser().then(function (user) {
        return user.name;
      }, function (reason) {
        return 'default name';
      }).then(function (userName) {
        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
        // will be `'default name'`
      });

      findUser().then(function (user) {
        throw new Error('Found user, but still unhappy');
      }, function (reason) {
        throw new Error('`findUser` rejected and we're unhappy');
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
      });
      ```
      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

      ```js
      findUser().then(function (user) {
        throw new PedagogicalException('Upstream error');
      }).then(function (value) {
        // never reached
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // The `PedgagocialException` is propagated all the way down to here
      });
      ```

      Assimilation
      ------------

      Sometimes the value you want to propagate to a downstream promise can only be
      retrieved asynchronously. This can be achieved by returning a promise in the
      fulfillment or rejection handler. The downstream promise will then be pending
      until the returned promise is settled. This is called *assimilation*.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // The user's comments are now available
      });
      ```

      If the assimliated promise rejects, then the downstream promise will also reject.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // If `findCommentsByAuthor` fulfills, we'll have the value here
      }, function (reason) {
        // If `findCommentsByAuthor` rejects, we'll have the reason here
      });
      ```

      Simple Example
      --------------

      Synchronous Example

      ```javascript
      var result;

      try {
        result = findResult();
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js
      findResult(function(result, err){
        if (err) {
          // failure
        } else {
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findResult().then(function(result){
        // success
      }, function(reason){
        // failure
      });
      ```

      Advanced Example
      --------------

      Synchronous Example

      ```javascript
      var author, books;

      try {
        author = findAuthor();
        books  = findBooksByAuthor(author);
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js

      function foundBooks(books) {

      }

      function failure(reason) {

      }

      findAuthor(function(author, err){
        if (err) {
          failure(err);
          // failure
        } else {
          try {
            findBoooksByAuthor(author, function(books, err) {
              if (err) {
                failure(err);
              } else {
                try {
                  foundBooks(books);
                } catch(reason) {
                  failure(reason);
                }
              }
            });
          } catch(error) {
            failure(err);
          }
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findAuthor().
        then(findBooksByAuthor).
        then(function(books){
          // found books
      }).catch(function(reason){
        // something went wrong
      });
      ```

      @method then
      @param {Function} onFulfilled
      @param {Function} onRejected
      Useful for tooling.
      @return {Promise}
    */
      then: function(onFulfillment, onRejection) {
        var parent = this;
        var state = parent._state;

        if (state === lib$es6$promise$$internal$$FULFILLED && !onFulfillment || state === lib$es6$promise$$internal$$REJECTED && !onRejection) {
          return this;
        }

        var child = new this.constructor(lib$es6$promise$$internal$$noop);
        var result = parent._result;

        if (state) {
          var callback = arguments[state - 1];
          lib$es6$promise$asap$$asap(function(){
            lib$es6$promise$$internal$$invokeCallback(state, child, callback, result);
          });
        } else {
          lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection);
        }

        return child;
      },

    /**
      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
      as the catch block of a try/catch statement.

      ```js
      function findAuthor(){
        throw new Error('couldn't find that author');
      }

      // synchronous
      try {
        findAuthor();
      } catch(reason) {
        // something went wrong
      }

      // async with promises
      findAuthor().catch(function(reason){
        // something went wrong
      });
      ```

      @method catch
      @param {Function} onRejection
      Useful for tooling.
      @return {Promise}
    */
      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };
    function lib$es6$promise$polyfill$$polyfill() {
      var local;

      if (typeof global !== 'undefined') {
          local = global;
      } else if (typeof self !== 'undefined') {
          local = self;
      } else {
          try {
              local = Function('return this')();
          } catch (e) {
              throw new Error('polyfill failed because global object is unavailable in this environment');
          }
      }

      var P = local.Promise;

      if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
        return;
      }

      local.Promise = lib$es6$promise$promise$$default;
    }
    var lib$es6$promise$polyfill$$default = lib$es6$promise$polyfill$$polyfill;

    var lib$es6$promise$umd$$ES6Promise = {
      'Promise': lib$es6$promise$promise$$default,
      'polyfill': lib$es6$promise$polyfill$$default
    };

    /* global define:true module:true window: true */
    if (typeof define === 'function' && define['amd']) {
      define(function() { return lib$es6$promise$umd$$ES6Promise; });
    } else if (typeof module !== 'undefined' && module['exports']) {
      module['exports'] = lib$es6$promise$umd$$ES6Promise;
    } else if (typeof this !== 'undefined') {
      this['ES6Promise'] = lib$es6$promise$umd$$ES6Promise;
    }

    lib$es6$promise$polyfill$$default();
}).call(this);


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":25}],18:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],19:[function(require,module,exports){
var http = require('http');

var https = module.exports;

for (var key in http) {
    if (http.hasOwnProperty(key)) https[key] = http[key];
};

https.request = function (params, cb) {
    if (!params) params = {};
    params.scheme = 'https';
    params.protocol = 'https:';
    return http.request.call(this, params, cb);
}

},{"http":41}],20:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],21:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],22:[function(require,module,exports){
/**
 * Determine if an object is Buffer
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install is-buffer`
 */

module.exports = function (obj) {
  return !!(obj != null &&
    (obj._isBuffer || // For Safari 5-7 (missing Object.prototype.constructor)
      (obj.constructor &&
      typeof obj.constructor.isBuffer === 'function' &&
      obj.constructor.isBuffer(obj))
    ))
}

},{}],23:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],24:[function(require,module,exports){
(function (process){
'use strict';

if (!process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = nextTick;
} else {
  module.exports = process.nextTick;
}

function nextTick(fn) {
  var args = new Array(arguments.length - 1);
  var i = 0;
  while (i < args.length) {
    args[i++] = arguments[i];
  }
  process.nextTick(function afterTick() {
    fn.apply(null, args);
  });
}

}).call(this,require('_process'))

},{"_process":25}],25:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],26:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.4.0 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.3.2',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],27:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],28:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],29:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":27,"./encode":28}],30:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":31}],31:[function(require,module,exports){
// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


module.exports = Duplex;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/



/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

},{"./_stream_readable":33,"./_stream_writable":35,"core-util-is":16,"inherits":21,"process-nextick-args":24}],32:[function(require,module,exports){
// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":34,"core-util-is":16,"inherits":21}],33:[function(require,module,exports){
(function (process){
'use strict';

module.exports = Readable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/


/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events');

/*<replacement>*/
var EElistenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/



/*<replacement>*/
var Stream;
(function (){try{
  Stream = require('st' + 'ream');
}catch(_){}finally{
  if (!Stream)
    Stream = require('events').EventEmitter;
}}())
/*</replacement>*/

var Buffer = require('buffer').Buffer;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/



/*<replacement>*/
var debugUtil = require('util');
var debug;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

var Duplex;
function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

var Duplex;
function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options && typeof options.read === 'function')
    this._read = options.read;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (!state.objectMode && typeof chunk === 'string') {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

Readable.prototype.isPaused = function() {
  return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      if (!addToFront)
        state.reading = false;

      // if we want the data now, just emit it.
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit('data', chunk);
        stream.read(0);
      } else {
        // update the buffer info.
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront)
          state.buffer.unshift(chunk);
        else
          state.buffer.push(chunk);

        if (state.needReadable)
          emitReadable(stream);
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}


// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = computeNewHighWaterMark(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else {
      return state.length;
    }
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended)
      endReadable(this);
    else
      emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0)
    endReadable(this);

  if (ret !== null)
    this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!(Buffer.isBuffer(chunk)) &&
      typeof chunk !== 'string' &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync)
      processNextTick(emitReadable_, stream);
    else
      emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    processNextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain &&
        (!dest._writableState || dest._writableState.needDrain))
      ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      if (state.pipesCount === 1 &&
          state.pipes[0] === dest &&
          src.listenerCount('data') === 1 &&
          !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];


  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain)
      state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0);
}

Readable.prototype.pause = function() {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    debug('wrapped data');
    if (state.decoder)
      chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined))
      return;
    else if (!state.objectMode && (!chunk || !chunk.length))
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }; }(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};


// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else if (list.length === 1)
      ret = list[0];
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))

},{"./_stream_duplex":31,"_process":25,"buffer":13,"core-util-is":16,"events":18,"inherits":21,"isarray":23,"process-nextick-args":24,"string_decoder/":45,"util":12}],34:[function(require,module,exports){
// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function')
      this._transform = options.transform;

    if (typeof options.flush === 'function')
      this._flush = options.flush;
  }

  this.once('prefinish', function() {
    if (typeof this._flush === 'function')
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":31,"core-util-is":16,"inherits":21}],35:[function(require,module,exports){
// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

module.exports = Writable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/


/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/



/*<replacement>*/
var Stream;
(function (){try{
  Stream = require('st' + 'ream');
}catch(_){}finally{
  if (!Stream)
    Stream = require('events').EventEmitter;
}}())
/*</replacement>*/

var Buffer = require('buffer').Buffer;

util.inherits(Writable, Stream);

function nop() {}

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

var Duplex;
function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

WritableState.prototype.getBuffer = function writableStateGetBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function (){try {
Object.defineProperty(WritableState.prototype, 'buffer', {
  get: internalUtil.deprecate(function() {
    return this.getBuffer();
  }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' +
     'instead.')
});
}catch(_){}}());


var Duplex;
function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function')
      this._write = options.write;

    if (typeof options.writev === 'function')
      this._writev = options.writev;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;

  if (!(Buffer.isBuffer(chunk)) &&
      typeof chunk !== 'string' &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = nop;

  if (state.ended)
    writeAfterEnd(this, cb);
  else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function() {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function() {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing &&
        !state.corked &&
        !state.finished &&
        !state.bufferProcessing &&
        state.bufferedRequest)
      clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string')
    encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64',
'ucs2', 'ucs-2','utf16le', 'utf-16le', 'raw']
.indexOf((encoding + '').toLowerCase()) > -1))
    throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev)
    stream._writev(chunk, state.onwrite);
  else
    stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync)
    processNextTick(cb, er);
  else
    cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished &&
        !state.corked &&
        !state.bufferProcessing &&
        state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      processNextTick(afterWrite, stream, state, finished, cb);
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var buffer = [];
    var cbs = [];
    while (entry) {
      cbs.push(entry.callback);
      buffer.push(entry);
      entry = entry.next;
    }

    // count the one we are adding, as well.
    // TODO(isaacs) clean this up
    state.pendingcb++;
    state.lastBufferedRequest = null;
    doWrite(stream, state, true, state.length, buffer, '', function(err) {
      for (var i = 0; i < cbs.length; i++) {
        state.pendingcb--;
        cbs[i](err);
      }
    });

    // Clear buffer
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null)
      state.lastBufferedRequest = null;
  }
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined)
    this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(state) {
  return (state.ending &&
          state.length === 0 &&
          state.bufferedRequest === null &&
          !state.finished &&
          !state.writing);
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else {
      prefinish(stream, state);
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      processNextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

},{"./_stream_duplex":31,"buffer":13,"core-util-is":16,"events":18,"inherits":21,"process-nextick-args":24,"util-deprecate":48}],36:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":32}],37:[function(require,module,exports){
var Stream = (function (){
  try {
    return require('st' + 'ream'); // hack to fix a circular dependency issue when used with browserify
  } catch(_){}
}());
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = Stream || exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":31,"./lib/_stream_passthrough.js":32,"./lib/_stream_readable.js":33,"./lib/_stream_transform.js":34,"./lib/_stream_writable.js":35}],38:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":34}],39:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":35}],40:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":18,"inherits":21,"readable-stream/duplex.js":30,"readable-stream/passthrough.js":36,"readable-stream/readable.js":37,"readable-stream/transform.js":38,"readable-stream/writable.js":39}],41:[function(require,module,exports){
(function (global){
var ClientRequest = require('./lib/request')
var extend = require('xtend')
var statusCodes = require('builtin-status-codes')
var url = require('url')

var http = exports

http.request = function (opts, cb) {
	if (typeof opts === 'string')
		opts = url.parse(opts)
	else
		opts = extend(opts)

	// Normally, the page is loaded from http or https, so not specifying a protocol
	// will result in a (valid) protocol-relative url. However, this won't work if
	// the protocol is something else, like 'file:'
	var defaultProtocol = global.location.protocol.search(/^https?:$/) === -1 ? 'http:' : ''

	var protocol = opts.protocol || defaultProtocol
	var host = opts.hostname || opts.host
	var port = opts.port
	var path = opts.path || '/'

	// Necessary for IPv6 addresses
	if (host && host.indexOf(':') !== -1)
		host = '[' + host + ']'

	// This may be a relative url. The browser should always be able to interpret it correctly.
	opts.url = (host ? (protocol + '//' + host) : '') + (port ? ':' + port : '') + path
	opts.method = (opts.method || 'GET').toUpperCase()
	opts.headers = opts.headers || {}

	// Also valid opts.auth, opts.mode

	var req = new ClientRequest(opts)
	if (cb)
		req.on('response', cb)
	return req
}

http.get = function get (opts, cb) {
	var req = http.request(opts, cb)
	req.end()
	return req
}

http.Agent = function () {}
http.Agent.defaultMaxSockets = 4

http.STATUS_CODES = statusCodes

http.METHODS = [
	'CHECKOUT',
	'CONNECT',
	'COPY',
	'DELETE',
	'GET',
	'HEAD',
	'LOCK',
	'M-SEARCH',
	'MERGE',
	'MKACTIVITY',
	'MKCOL',
	'MOVE',
	'NOTIFY',
	'OPTIONS',
	'PATCH',
	'POST',
	'PROPFIND',
	'PROPPATCH',
	'PURGE',
	'PUT',
	'REPORT',
	'SEARCH',
	'SUBSCRIBE',
	'TRACE',
	'UNLOCK',
	'UNSUBSCRIBE'
]
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./lib/request":43,"builtin-status-codes":15,"url":46,"xtend":49}],42:[function(require,module,exports){
(function (global){
exports.fetch = isFunction(global.fetch) && isFunction(global.ReadableByteStream)

exports.blobConstructor = false
try {
	new Blob([new ArrayBuffer(1)])
	exports.blobConstructor = true
} catch (e) {}

var xhr = new global.XMLHttpRequest()
// If location.host is empty, e.g. if this page/worker was loaded
// from a Blob, then use example.com to avoid an error
xhr.open('GET', global.location.host ? '/' : 'https://example.com')

function checkTypeSupport (type) {
	try {
		xhr.responseType = type
		return xhr.responseType === type
	} catch (e) {}
	return false
}

// For some strange reason, Safari 7.0 reports typeof global.ArrayBuffer === 'object'.
// Safari 7.1 appears to have fixed this bug.
var haveArrayBuffer = typeof global.ArrayBuffer !== 'undefined'
var haveSlice = haveArrayBuffer && isFunction(global.ArrayBuffer.prototype.slice)

exports.arraybuffer = haveArrayBuffer && checkTypeSupport('arraybuffer')
// These next two tests unavoidably show warnings in Chrome. Since fetch will always
// be used if it's available, just return false for these to avoid the warnings.
exports.msstream = !exports.fetch && haveSlice && checkTypeSupport('ms-stream')
exports.mozchunkedarraybuffer = !exports.fetch && haveArrayBuffer &&
	checkTypeSupport('moz-chunked-arraybuffer')
exports.overrideMimeType = isFunction(xhr.overrideMimeType)
exports.vbArray = isFunction(global.VBArray)

function isFunction (value) {
  return typeof value === 'function'
}

xhr = null // Help gc

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],43:[function(require,module,exports){
(function (process,global,Buffer){
// var Base64 = require('Base64')
var capability = require('./capability')
var inherits = require('inherits')
var response = require('./response')
var stream = require('stream')

var IncomingMessage = response.IncomingMessage
var rStates = response.readyStates

function decideMode (preferBinary) {
	if (capability.fetch) {
		return 'fetch'
	} else if (capability.mozchunkedarraybuffer) {
		return 'moz-chunked-arraybuffer'
	} else if (capability.msstream) {
		return 'ms-stream'
	} else if (capability.arraybuffer && preferBinary) {
		return 'arraybuffer'
	} else if (capability.vbArray && preferBinary) {
		return 'text:vbarray'
	} else {
		return 'text'
	}
}

var ClientRequest = module.exports = function (opts) {
	var self = this
	stream.Writable.call(self)

	self._opts = opts
	self._body = []
	self._headers = {}
	if (opts.auth)
		self.setHeader('Authorization', 'Basic ' + new Buffer(opts.auth).toString('base64'))
	Object.keys(opts.headers).forEach(function (name) {
		self.setHeader(name, opts.headers[name])
	})

	var preferBinary
	if (opts.mode === 'prefer-streaming') {
		// If streaming is a high priority but binary compatibility and
		// the accuracy of the 'content-type' header aren't
		preferBinary = false
	} else if (opts.mode === 'allow-wrong-content-type') {
		// If streaming is more important than preserving the 'content-type' header
		preferBinary = !capability.overrideMimeType
	} else if (!opts.mode || opts.mode === 'default' || opts.mode === 'prefer-fast') {
		// Use binary if text streaming may corrupt data or the content-type header, or for speed
		preferBinary = true
	} else {
		throw new Error('Invalid value for opts.mode')
	}
	self._mode = decideMode(preferBinary)

	self.on('finish', function () {
		self._onFinish()
	})
}

inherits(ClientRequest, stream.Writable)

ClientRequest.prototype.setHeader = function (name, value) {
	var self = this
	var lowerName = name.toLowerCase()
	// This check is not necessary, but it prevents warnings from browsers about setting unsafe
	// headers. To be honest I'm not entirely sure hiding these warnings is a good thing, but
	// http-browserify did it, so I will too.
	if (unsafeHeaders.indexOf(lowerName) !== -1)
		return

	self._headers[lowerName] = {
		name: name,
		value: value
	}
}

ClientRequest.prototype.getHeader = function (name) {
	var self = this
	return self._headers[name.toLowerCase()].value
}

ClientRequest.prototype.removeHeader = function (name) {
	var self = this
	delete self._headers[name.toLowerCase()]
}

ClientRequest.prototype._onFinish = function () {
	var self = this

	if (self._destroyed)
		return
	var opts = self._opts

	var headersObj = self._headers
	var body
	if (opts.method === 'POST' || opts.method === 'PUT' || opts.method === 'PATCH') {
		if (capability.blobConstructor) {
			body = new global.Blob(self._body.map(function (buffer) {
				return buffer.toArrayBuffer()
			}), {
				type: (headersObj['content-type'] || {}).value || ''
			})
		} else {
			// get utf8 string
			body = Buffer.concat(self._body).toString()
		}
	}

	if (self._mode === 'fetch') {
		var headers = Object.keys(headersObj).map(function (name) {
			return [headersObj[name].name, headersObj[name].value]
		})

		global.fetch(self._opts.url, {
			method: self._opts.method,
			headers: headers,
			body: body,
			mode: 'cors',
			credentials: opts.withCredentials ? 'include' : 'same-origin'
		}).then(function (response) {
			self._fetchResponse = response
			self._connect()
		}, function (reason) {
			self.emit('error', reason)
		})
	} else {
		var xhr = self._xhr = new global.XMLHttpRequest()
		try {
			xhr.open(self._opts.method, self._opts.url, true)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}

		// Can't set responseType on really old browsers
		if ('responseType' in xhr)
			xhr.responseType = self._mode.split(':')[0]

		if ('withCredentials' in xhr)
			xhr.withCredentials = !!opts.withCredentials

		if (self._mode === 'text' && 'overrideMimeType' in xhr)
			xhr.overrideMimeType('text/plain; charset=x-user-defined')

		Object.keys(headersObj).forEach(function (name) {
			xhr.setRequestHeader(headersObj[name].name, headersObj[name].value)
		})

		self._response = null
		xhr.onreadystatechange = function () {
			switch (xhr.readyState) {
				case rStates.LOADING:
				case rStates.DONE:
					self._onXHRProgress()
					break
			}
		}
		// Necessary for streaming in Firefox, since xhr.response is ONLY defined
		// in onprogress, not in onreadystatechange with xhr.readyState = 3
		if (self._mode === 'moz-chunked-arraybuffer') {
			xhr.onprogress = function () {
				self._onXHRProgress()
			}
		}

		xhr.onerror = function () {
			if (self._destroyed)
				return
			self.emit('error', new Error('XHR error'))
		}

		try {
			xhr.send(body)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}
	}
}

/**
 * Checks if xhr.status is readable and non-zero, indicating no error.
 * Even though the spec says it should be available in readyState 3,
 * accessing it throws an exception in IE8
 */
function statusValid (xhr) {
	try {
		var status = xhr.status
		return (status !== null && status !== 0)
	} catch (e) {
		return false
	}
}

ClientRequest.prototype._onXHRProgress = function () {
	var self = this

	if (!statusValid(self._xhr) || self._destroyed)
		return

	if (!self._response)
		self._connect()

	self._response._onXHRProgress()
}

ClientRequest.prototype._connect = function () {
	var self = this

	if (self._destroyed)
		return

	self._response = new IncomingMessage(self._xhr, self._fetchResponse, self._mode)
	self.emit('response', self._response)
}

ClientRequest.prototype._write = function (chunk, encoding, cb) {
	var self = this

	self._body.push(chunk)
	cb()
}

ClientRequest.prototype.abort = ClientRequest.prototype.destroy = function () {
	var self = this
	self._destroyed = true
	if (self._response)
		self._response._destroyed = true
	if (self._xhr)
		self._xhr.abort()
	// Currently, there isn't a way to truly abort a fetch.
	// If you like bikeshedding, see https://github.com/whatwg/fetch/issues/27
}

ClientRequest.prototype.end = function (data, encoding, cb) {
	var self = this
	if (typeof data === 'function') {
		cb = data
		data = undefined
	}

	stream.Writable.prototype.end.call(self, data, encoding, cb)
}

ClientRequest.prototype.flushHeaders = function () {}
ClientRequest.prototype.setTimeout = function () {}
ClientRequest.prototype.setNoDelay = function () {}
ClientRequest.prototype.setSocketKeepAlive = function () {}

// Taken from http://www.w3.org/TR/XMLHttpRequest/#the-setrequestheader%28%29-method
var unsafeHeaders = [
	'accept-charset',
	'accept-encoding',
	'access-control-request-headers',
	'access-control-request-method',
	'connection',
	'content-length',
	'cookie',
	'cookie2',
	'date',
	'dnt',
	'expect',
	'host',
	'keep-alive',
	'origin',
	'referer',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'user-agent',
	'via'
]

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)

},{"./capability":42,"./response":44,"_process":25,"buffer":13,"inherits":21,"stream":40}],44:[function(require,module,exports){
(function (process,global,Buffer){
var capability = require('./capability')
var inherits = require('inherits')
var stream = require('stream')

var rStates = exports.readyStates = {
	UNSENT: 0,
	OPENED: 1,
	HEADERS_RECEIVED: 2,
	LOADING: 3,
	DONE: 4
}

var IncomingMessage = exports.IncomingMessage = function (xhr, response, mode) {
	var self = this
	stream.Readable.call(self)

	self._mode = mode
	self.headers = {}
	self.rawHeaders = []
	self.trailers = {}
	self.rawTrailers = []

	// Fake the 'close' event, but only once 'end' fires
	self.on('end', function () {
		// The nextTick is necessary to prevent the 'request' module from causing an infinite loop
		process.nextTick(function () {
			self.emit('close')
		})
	})

	if (mode === 'fetch') {
		self._fetchResponse = response

		self.statusCode = response.status
		self.statusMessage = response.statusText
		// backwards compatible version of for (<item> of <iterable>):
		// for (var <item>,_i,_it = <iterable>[Symbol.iterator](); <item> = (_i = _it.next()).value,!_i.done;)
		for (var header, _i, _it = response.headers[Symbol.iterator](); header = (_i = _it.next()).value, !_i.done;) {
			self.headers[header[0].toLowerCase()] = header[1]
			self.rawHeaders.push(header[0], header[1])
		}

		// TODO: this doesn't respect backpressure. Once WritableStream is available, this can be fixed
		var reader = response.body.getReader()
		function read () {
			reader.read().then(function (result) {
				if (self._destroyed)
					return
				if (result.done) {
					self.push(null)
					return
				}
				self.push(new Buffer(result.value))
				read()
			})
		}
		read()

	} else {
		self._xhr = xhr
		self._pos = 0

		self.statusCode = xhr.status
		self.statusMessage = xhr.statusText
		var headers = xhr.getAllResponseHeaders().split(/\r?\n/)
		headers.forEach(function (header) {
			var matches = header.match(/^([^:]+):\s*(.*)/)
			if (matches) {
				var key = matches[1].toLowerCase()
				if (self.headers[key] !== undefined)
					self.headers[key] += ', ' + matches[2]
				else
					self.headers[key] = matches[2]
				self.rawHeaders.push(matches[1], matches[2])
			}
		})

		self._charset = 'x-user-defined'
		if (!capability.overrideMimeType) {
			var mimeType = self.rawHeaders['mime-type']
			if (mimeType) {
				var charsetMatch = mimeType.match(/;\s*charset=([^;])(;|$)/)
				if (charsetMatch) {
					self._charset = charsetMatch[1].toLowerCase()
				}
			}
			if (!self._charset)
				self._charset = 'utf-8' // best guess
		}
	}
}

inherits(IncomingMessage, stream.Readable)

IncomingMessage.prototype._read = function () {}

IncomingMessage.prototype._onXHRProgress = function () {
	var self = this

	var xhr = self._xhr

	var response = null
	switch (self._mode) {
		case 'text:vbarray': // For IE9
			if (xhr.readyState !== rStates.DONE)
				break
			try {
				// This fails in IE8
				response = new global.VBArray(xhr.responseBody).toArray()
			} catch (e) {}
			if (response !== null) {
				self.push(new Buffer(response))
				break
			}
			// Falls through in IE8	
		case 'text':
			try { // This will fail when readyState = 3 in IE9. Switch mode and wait for readyState = 4
				response = xhr.responseText
			} catch (e) {
				self._mode = 'text:vbarray'
				break
			}
			if (response.length > self._pos) {
				var newData = response.substr(self._pos)
				if (self._charset === 'x-user-defined') {
					var buffer = new Buffer(newData.length)
					for (var i = 0; i < newData.length; i++)
						buffer[i] = newData.charCodeAt(i) & 0xff

					self.push(buffer)
				} else {
					self.push(newData, self._charset)
				}
				self._pos = response.length
			}
			break
		case 'arraybuffer':
			if (xhr.readyState !== rStates.DONE)
				break
			response = xhr.response
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'moz-chunked-arraybuffer': // take whole
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING || !response)
				break
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'ms-stream':
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING)
				break
			var reader = new global.MSStreamReader()
			reader.onprogress = function () {
				if (reader.result.byteLength > self._pos) {
					self.push(new Buffer(new Uint8Array(reader.result.slice(self._pos))))
					self._pos = reader.result.byteLength
				}
			}
			reader.onload = function () {
				self.push(null)
			}
			// reader.onerror = ??? // TODO: this
			reader.readAsArrayBuffer(response)
			break
	}

	// The ms-stream case handles end separately in reader.onload()
	if (self._xhr.readyState === rStates.DONE && self._mode !== 'ms-stream') {
		self.push(null)
	}
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)

},{"./capability":42,"_process":25,"buffer":13,"inherits":21,"stream":40}],45:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":13}],46:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var punycode = require('punycode');
var util = require('./util');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && util.isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!util.isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  // Copy chrome, IE, opera backslash-handling behavior.
  // Back slashes before the query string get converted to forward slashes
  // See: https://code.google.com/p/chromium/issues/detail?id=25916
  var queryIndex = url.indexOf('?'),
      splitter =
          (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
      uSplit = url.split(splitter),
      slashRegex = /\\/g;
  uSplit[0] = uSplit[0].replace(slashRegex, '/');
  url = uSplit.join(splitter);

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.path = rest;
      this.href = rest;
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
        if (parseQueryString) {
          this.query = querystring.parse(this.search.substr(1));
        } else {
          this.query = this.search.substr(1);
        }
      } else if (parseQueryString) {
        this.search = '';
        this.query = {};
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a punycoded representation of "domain".
      // It only converts parts of the domain name that
      // have non-ASCII characters, i.e. it doesn't matter if
      // you call it with a domain that already is ASCII-only.
      this.hostname = punycode.toASCII(this.hostname);
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      if (rest.indexOf(ae) === -1)
        continue;
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (util.isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      util.isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (util.isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  var tkeys = Object.keys(this);
  for (var tk = 0; tk < tkeys.length; tk++) {
    var tkey = tkeys[tk];
    result[tkey] = this[tkey];
  }

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    var rkeys = Object.keys(relative);
    for (var rk = 0; rk < rkeys.length; rk++) {
      var rkey = rkeys[rk];
      if (rkey !== 'protocol')
        result[rkey] = relative[rkey];
    }

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      var keys = Object.keys(relative);
      for (var v = 0; v < keys.length; v++) {
        var k = keys[v];
        result[k] = relative[k];
      }
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!util.isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host || srcPath.length > 1) &&
      (last === '.' || last === '..') || last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last === '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especially happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

},{"./util":47,"punycode":26,"querystring":29}],47:[function(require,module,exports){
'use strict';

module.exports = {
  isString: function(arg) {
    return typeof(arg) === 'string';
  },
  isObject: function(arg) {
    return typeof(arg) === 'object' && arg !== null;
  },
  isNull: function(arg) {
    return arg === null;
  },
  isNullOrUndefined: function(arg) {
    return arg == null;
  }
};

},{}],48:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],49:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],50:[function(require,module,exports){
module.exports={
  "name": "prismic.io",
  "description": "JavaScript development kit for prismic.io",
  "license": "Apache-2.0",
  "url": "https://github.com/prismicio/javascript-kit",
  "keywords": [
    "prismic",
    "prismic.io",
    "cms",
    "content",
    "api"
  ],
  "version": "2.0.0",
  "devDependencies": {
    "babel-preset-es2015": "^6.3.13",
    "babelify": "^7.2.0",
    "browserify": "^12.0.1",
    "chai": "*",
    "codeclimate-test-reporter": "~0.0.4",
    "es6-promise": "^3.0.2",
    "eslint": "^1.10.3",
    "gh-pages": "^0.8.0",
    "gulp": "~3.9.0",
    "gulp-sourcemaps": "^1.6.0",
    "gulp-uglify": "~1.2.0",
    "jsdoc": "^3.4.0",
    "mocha": "*",
    "vinyl-buffer": "^1.0.0",
    "vinyl-source-stream": "^1.1.0"
  },
  "repository": {
    "type": "git",
    "url": "http://github.com/prismicio/javascript-kit.git"
  },
  "main": "lib/api.js",
  "scripts": {
    "prepublish": "gulp",
    "lint": "eslint lib",
    "test": "mocha",
    "posttest": "eslint lib",
    "builddoc": "jsdoc dist/prismic.io.js README.md",
    "pushdoc": "",
    "prepushdoc": "npm run builddoc"
  }
}

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvYXBpLmpzIiwibGliL2Jyb3dzZXIuanMiLCJsaWIvY2FjaGUuanMiLCJsaWIvZG9jdW1lbnRzLmpzIiwibGliL2V4cGVyaW1lbnRzLmpzIiwibGliL2ZyYWdtZW50cy5qcyIsImxpYi9scnUuanMiLCJsaWIvcHJlZGljYXRlcy5qcyIsImxpYi9wcmlzbWljLmpzIiwibGliL3JlcXVlc3RzLmpzIiwibm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2J1aWx0aW4tc3RhdHVzLWNvZGVzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvY29yZS11dGlsLWlzL2xpYi91dGlsLmpzIiwibm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvZXM2LXByb21pc2UuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9odHRwcy1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaW5oZXJpdHMvaW5oZXJpdHNfYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9pcy1idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaXNhcnJheS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzLW5leHRpY2stYXJncy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcHVueWNvZGUvcHVueWNvZGUuanMiLCJub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvZW5jb2RlLmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vZHVwbGV4LmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9kdXBsZXguanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2xpYi9fc3RyZWFtX3Bhc3N0aHJvdWdoLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9yZWFkYWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV93cml0YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vcGFzc3Rocm91Z2guanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL3JlYWRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS90cmFuc2Zvcm0uanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL3dyaXRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2xpYi9jYXBhYmlsaXR5LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2xpYi9yZXF1ZXN0LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2xpYi9yZXNwb25zZS5qcyIsIm5vZGVfbW9kdWxlcy9zdHJpbmdfZGVjb2Rlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy91cmwvdXJsLmpzIiwibm9kZV9tb2R1bGVzL3VybC91dGlsLmpzIiwibm9kZV9tb2R1bGVzL3V0aWwtZGVwcmVjYXRlL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMveHRlbmQvaW1tdXRhYmxlLmpzIiwicGFja2FnZS5qc29uIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBLFlBQVksQ0FBQzs7OztBQUViLElBQUksUUFBUSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUM7SUFDaEMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFDbEMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7SUFDN0IsVUFBVSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUM7SUFDcEMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQzs7QUFFM0MsSUFBSSxXQUFXLEdBQUcsV0FBVyxDQUFDLFdBQVc7SUFDckMsUUFBUSxHQUFHLFNBQVMsQ0FBQyxRQUFROzs7Ozs7O0FBQUMsQUFPbEMsU0FBUyxHQUFHLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxtQkFBbUIsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFO0FBQ2xGLE1BQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxJQUFJLFdBQVcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQSxHQUFJLGVBQWUsR0FBRyxXQUFXLEdBQUcsRUFBRSxDQUFBLEFBQUMsQ0FBQztBQUMxRyxNQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztBQUMvQixNQUFJLENBQUMsUUFBUSxHQUFHLGFBQWEsSUFBSSxXQUFXLEVBQUUsQ0FBQztBQUMvQyxNQUFJLENBQUMsY0FBYyxHQUFHLG1CQUFtQixJQUFJLFFBQVEsQ0FBQyxPQUFPLENBQUM7QUFDOUQsTUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxXQUFXLEdBQUksRUFBRSxDQUFBLEFBQUMsQ0FBQztBQUNqRixNQUFJLENBQUMsVUFB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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVnREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3Y4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7OztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDcmhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMvOEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqaEJBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTs7QUNEQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNyUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzV0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgUmVxdWVzdHMgPSByZXF1aXJlKCcuL3JlcXVlc3RzJyksXG4gICAgZG9jdW1lbnRzID0gcmVxdWlyZSgnLi9kb2N1bWVudHMnKSxcbiAgICBBcGlDYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBQcmVkaWNhdGVzID0gcmVxdWlyZSgnLi9wcmVkaWNhdGVzJyksXG4gICAgZXhwZXJpbWVudHMgPSByZXF1aXJlKCcuL2V4cGVyaW1lbnRzJyk7XG5cbnZhciBFeHBlcmltZW50cyA9IGV4cGVyaW1lbnRzLkV4cGVyaW1lbnRzLFxuICAgIERvY3VtZW50ID0gZG9jdW1lbnRzLkRvY3VtZW50O1xuXG4vKipcbiAqIEluaXRpYWxpc2F0aW9uIG9mIHRoZSBBUEkgb2JqZWN0LlxuICogVGhpcyBpcyBmb3IgaW50ZXJuYWwgdXNlLCBmcm9tIG91dHNpZGUgdGhpcyBraXQsIHlvdSBzaG91bGQgY2FsbCBQcmlzbWljLkFwaSgpXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBBcGkodXJsLCBhY2Nlc3NUb2tlbiwgbWF5YmVSZXF1ZXN0SGFuZGxlciwgbWF5YmVBcGlDYWNoZSwgbWF5YmVBcGlEYXRhVFRMKSB7XG4gIHRoaXMudXJsID0gdXJsICsgKGFjY2Vzc1Rva2VuID8gKHVybC5pbmRleE9mKCc/JykgPiAtMSA/ICcmJyA6ICc/JykgKyAnYWNjZXNzX3Rva2VuPScgKyBhY2Nlc3NUb2tlbiA6ICcnKTtcbiAgdGhpcy5hY2Nlc3NUb2tlbiA9IGFjY2Vzc1Rva2VuO1xuICB0aGlzLmFwaUNhY2hlID0gbWF5YmVBcGlDYWNoZSB8fCBnbG9iYWxDYWNoZSgpO1xuICB0aGlzLnJlcXVlc3RIYW5kbGVyID0gbWF5YmVSZXF1ZXN0SGFuZGxlciB8fCBSZXF1ZXN0cy5yZXF1ZXN0O1xuICB0aGlzLmFwaUNhY2hlS2V5ID0gdGhpcy51cmwgKyAodGhpcy5hY2Nlc3NUb2tlbiA/ICgnIycgKyB0aGlzLmFjY2Vzc1Rva2VuKSA6ICcnKTtcbiAgdGhpcy5hcGlEYXRhVFRMID0gbWF5YmVBcGlEYXRhVFRMIHx8IDU7XG4gIHJldHVybiB0aGlzO1xufVxuXG5BcGkucHJvdG90eXBlID0ge1xuXG4gIC8vIFByZWRpY2F0ZXNcbiAgQVQ6IFwiYXRcIixcbiAgQU5ZOiBcImFueVwiLFxuICBTSU1JTEFSOiBcInNpbWlsYXJcIixcbiAgRlVMTFRFWFQ6IFwiZnVsbHRleHRcIixcbiAgTlVNQkVSOiB7XG4gICAgR1Q6IFwibnVtYmVyLmd0XCIsXG4gICAgTFQ6IFwibnVtYmVyLmx0XCJcbiAgfSxcbiAgREFURToge1xuICAgIC8vIE90aGVyIGRhdGUgb3BlcmF0b3JzIGFyZSBhdmFpbGFibGU6IHNlZSB0aGUgZG9jdW1lbnRhdGlvbi5cbiAgICBBRlRFUjogXCJkYXRlLmFmdGVyXCIsXG4gICAgQkVGT1JFOiBcImRhdGUuYmVmb3JlXCIsXG4gICAgQkVUV0VFTjogXCJkYXRlLmJldHdlZW5cIlxuICB9LFxuXG4gIC8vIEZyYWdtZW50OiB1c2FibGUgYXMgdGhlIHNlY29uZCBlbGVtZW50IG9mIGEgcXVlcnkgYXJyYXkgb24gbW9zdCBwcmVkaWNhdGVzIChleGNlcHQgU0lNSUxBUikuXG4gIC8vIFlvdSBjYW4gYWxzbyB1c2UgXCJteS4qXCIgZm9yIHlvdXIgY3VzdG9tIGZpZWxkcy5cbiAgRE9DVU1FTlQ6IHtcbiAgICBJRDogXCJkb2N1bWVudC5pZFwiLFxuICAgIFRZUEU6IFwiZG9jdW1lbnQudHlwZVwiLFxuICAgIFRBR1M6IFwiZG9jdW1lbnQudGFnc1wiXG4gIH0sXG5cbiAgZGF0YTogbnVsbCxcblxuICAvKipcbiAgICogRmV0Y2hlcyBkYXRhIHVzZWQgdG8gY29uc3RydWN0IHRoZSBhcGkgY2xpZW50LCBmcm9tIGNhY2hlIGlmIGl0J3NcbiAgICogcHJlc2VudCwgb3RoZXJ3aXNlIGZyb20gY2FsbGluZyB0aGUgcHJpc21pYyBhcGkgZW5kcG9pbnQgKHdoaWNoIGlzXG4gICAqIHRoZW4gY2FjaGVkKS5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayB0byByZWNlaXZlIHRoZSBkYXRhLiBPcHRpb25hbCwgeW91IGNhbiB1c2UgdGhlIHByb21pc2UgcmVzdWx0LlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX0gUHJvbWlzZSBob2xkaW5nIHRoZSBkYXRhIG9yIGVycm9yXG4gICAqL1xuICBnZXQ6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBjYWNoZUtleSA9IHRoaXMuYXBpQ2FjaGVLZXk7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIGNiID0gZnVuY3Rpb24oZXJyLCB2YWx1ZSwgeGhyLCB0dGwpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIHZhbHVlLCB4aHIsIHR0bCk7XG4gICAgICAgIGlmICh2YWx1ZSkgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICAgIGlmIChlcnIpIHJlamVjdChlcnIpO1xuICAgICAgfTtcbiAgICAgIHNlbGYuYXBpQ2FjaGUuZ2V0KGNhY2hlS2V5LCBmdW5jdGlvbiAoZXJyLCB2YWx1ZSkge1xuICAgICAgICBpZiAoZXJyIHx8IHZhbHVlKSB7XG4gICAgICAgICAgY2IoZXJyLCB2YWx1ZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5yZXF1ZXN0SGFuZGxlcihzZWxmLnVybCwgZnVuY3Rpb24oZXJyLCBkYXRhLCB4aHIsIHR0bCkge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNiKGVyciwgbnVsbCwgeGhyLCB0dGwpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBwYXJzZWQgPSBzZWxmLnBhcnNlKGRhdGEpO1xuICAgICAgICAgIHR0bCA9IHR0bCB8fCBzZWxmLmFwaURhdGFUVEw7XG5cbiAgICAgICAgICBzZWxmLmFwaUNhY2hlLnNldChjYWNoZUtleSwgcGFyc2VkLCB0dGwsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNiKGVyciwgcGFyc2VkLCB4aHIsIHR0bCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENsZWFucyBhcGkgZGF0YSBmcm9tIHRoZSBjYWNoZSBhbmQgZmV0Y2hlcyBhbiB1cCB0byBkYXRlIGNvcHkuXG4gICAqXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdGhlIGRhdGEgaGFzIGJlZW4gcmVmcmVzaGVkXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgcmVmcmVzaDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBjYWNoZUtleSA9IHRoaXMuYXBpQ2FjaGVLZXk7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgY2IgPSBmdW5jdGlvbihlcnIsIHZhbHVlLCB4aHIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIHZhbHVlLCB4aHIpO1xuICAgICAgICBpZiAodmFsdWUpIHJlc29sdmUodmFsdWUpO1xuICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcbiAgICAgIH07XG4gICAgICBzZWxmLmFwaUNhY2hlLnJlbW92ZShjYWNoZUtleSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICBpZiAoZXJyKSB7IGNiKGVycik7IHJldHVybjsgfVxuXG4gICAgICAgIHNlbGYuZ2V0KGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgICBpZiAoZXJyKSB7IGNiKGVycik7IHJldHVybjsgfVxuXG4gICAgICAgICAgc2VsZi5kYXRhID0gZGF0YTtcbiAgICAgICAgICBzZWxmLmJvb2ttYXJrcyA9IGRhdGEuYm9va21hcmtzO1xuICAgICAgICAgIHNlbGYuZXhwZXJpbWVudHMgPSBuZXcgRXhwZXJpbWVudHMoZGF0YS5leHBlcmltZW50cyk7XG5cbiAgICAgICAgICBjYigpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuXG4gIC8qKlxuICAgKiBQYXJzZXMgYW5kIHJldHVybnMgdGhlIC9hcGkgZG9jdW1lbnQuXG4gICAqIFRoaXMgaXMgZm9yIGludGVybmFsIHVzZSwgZnJvbSBvdXRzaWRlIHRoaXMga2l0LCB5b3Ugc2hvdWxkIGNhbGwgUHJpc21pYy5BcGkoKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZGF0YSAtIFRoZSBKU09OIGRvY3VtZW50IHJlc3BvbmRlZCBvbiB0aGUgQVBJJ3MgZW5kcG9pbnRcbiAgICogQHJldHVybnMge0FwaX0gLSBUaGUgQXBpIG9iamVjdCB0aGF0IGNhbiBiZSBtYW5pcHVsYXRlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcGFyc2U6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB2YXIgcmVmcyxcbiAgICAgICAgbWFzdGVyLFxuICAgICAgICBmb3JtcyA9IHt9LFxuICAgICAgICBmb3JtLFxuICAgICAgICB0eXBlcyxcbiAgICAgICAgdGFncyxcbiAgICAgICAgZixcbiAgICAgICAgaTtcblxuICAgIC8vIFBhcnNlIHRoZSBmb3Jtc1xuICAgIGZvciAoaSBpbiBkYXRhLmZvcm1zKSB7XG4gICAgICBpZiAoZGF0YS5mb3Jtcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBmID0gZGF0YS5mb3Jtc1tpXTtcblxuICAgICAgICBpZih0aGlzLmFjY2Vzc1Rva2VuKSB7XG4gICAgICAgICAgZi5maWVsZHNbJ2FjY2Vzc190b2tlbiddID0ge307XG4gICAgICAgICAgZi5maWVsZHNbJ2FjY2Vzc190b2tlbiddWyd0eXBlJ10gPSAnc3RyaW5nJztcbiAgICAgICAgICBmLmZpZWxkc1snYWNjZXNzX3Rva2VuJ11bJ2RlZmF1bHQnXSA9IHRoaXMuYWNjZXNzVG9rZW47XG4gICAgICAgIH1cblxuICAgICAgICBmb3JtID0gbmV3IEZvcm0oXG4gICAgICAgICAgZi5uYW1lLFxuICAgICAgICAgIGYuZmllbGRzLFxuICAgICAgICAgIGYuZm9ybV9tZXRob2QsXG4gICAgICAgICAgZi5yZWwsXG4gICAgICAgICAgZi5lbmN0eXBlLFxuICAgICAgICAgIGYuYWN0aW9uXG4gICAgICAgICk7XG5cbiAgICAgICAgZm9ybXNbaV0gPSBmb3JtO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJlZnMgPSBkYXRhLnJlZnMubWFwKGZ1bmN0aW9uIChyKSB7XG4gICAgICByZXR1cm4gbmV3IFJlZihcbiAgICAgICAgci5yZWYsXG4gICAgICAgIHIubGFiZWwsXG4gICAgICAgIHIuaXNNYXN0ZXJSZWYsXG4gICAgICAgIHIuc2NoZWR1bGVkQXQsXG4gICAgICAgIHIuaWRcbiAgICAgICk7XG4gICAgfSkgfHwgW107XG5cbiAgICBtYXN0ZXIgPSByZWZzLmZpbHRlcihmdW5jdGlvbiAocikge1xuICAgICAgcmV0dXJuIHIuaXNNYXN0ZXIgPT09IHRydWU7XG4gICAgfSk7XG5cbiAgICB0eXBlcyA9IGRhdGEudHlwZXM7XG5cbiAgICB0YWdzID0gZGF0YS50YWdzO1xuXG4gICAgaWYgKG1hc3Rlci5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IChcIk5vIG1hc3RlciByZWYuXCIpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBib29rbWFya3M6IGRhdGEuYm9va21hcmtzIHx8IHt9LFxuICAgICAgcmVmczogcmVmcyxcbiAgICAgIGZvcm1zOiBmb3JtcyxcbiAgICAgIG1hc3RlcjogbWFzdGVyWzBdLFxuICAgICAgdHlwZXM6IHR5cGVzLFxuICAgICAgdGFnczogdGFncyxcbiAgICAgIGV4cGVyaW1lbnRzOiBkYXRhLmV4cGVyaW1lbnRzLFxuICAgICAgb2F1dGhJbml0aWF0ZTogZGF0YVsnb2F1dGhfaW5pdGlhdGUnXSxcbiAgICAgIG9hdXRoVG9rZW46IGRhdGFbJ29hdXRoX3Rva2VuJ11cbiAgICB9O1xuXG4gIH0sXG5cbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIHVzZSBmb3JtKCkgbm93XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmb3JtSWQgLSBUaGUgaWQgb2YgYSBmb3JtLCBsaWtlIFwiZXZlcnl0aGluZ1wiLCBvciBcInByb2R1Y3RzXCJcbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gdGhlIFNlYXJjaEZvcm0gdGhhdCBjYW4gYmUgdXNlZC5cbiAgICovXG4gIGZvcm1zOiBmdW5jdGlvbihmb3JtSWQpIHtcbiAgICByZXR1cm4gdGhpcy5mb3JtKGZvcm1JZCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSB1c2VhYmxlIGZvcm0gZnJvbSBpdHMgaWQsIGFzIGRlc2NyaWJlZCBpbiB0aGUgUkVTVGZ1bCBkZXNjcmlwdGlvbiBvZiB0aGUgQVBJLlxuICAgKiBGb3IgaW5zdGFuY2U6IGFwaS5mb3JtKFwiZXZlcnl0aGluZ1wiKSB3b3JrcyBvbiBldmVyeSByZXBvc2l0b3J5IChhcyBcImV2ZXJ5dGhpbmdcIiBleGlzdHMgYnkgZGVmYXVsdClcbiAgICogWW91IGNhbiB0aGVuIGNoYWluIHRoZSBjYWxsczogYXBpLmZvcm0oXCJldmVyeXRoaW5nXCIpLnF1ZXJ5KCdbWzpkID0gYXQoZG9jdW1lbnQuaWQsIFwiVWtMMGdNdXZ6WVVBTkNwZlwiKV1dJykucmVmKHJlZikuc3VibWl0KClcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGZvcm1JZCAtIFRoZSBpZCBvZiBhIGZvcm0sIGxpa2UgXCJldmVyeXRoaW5nXCIsIG9yIFwicHJvZHVjdHNcIlxuICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSB0aGUgU2VhcmNoRm9ybSB0aGF0IGNhbiBiZSB1c2VkLlxuICAgKi9cbiAgZm9ybTogZnVuY3Rpb24oZm9ybUlkKSB7XG4gICAgdmFyIGZvcm0gPSB0aGlzLmRhdGEuZm9ybXNbZm9ybUlkXTtcbiAgICBpZihmb3JtKSB7XG4gICAgICByZXR1cm4gbmV3IFNlYXJjaEZvcm0odGhpcywgZm9ybSwge30pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogVGhlIElEIG9mIHRoZSBtYXN0ZXIgcmVmIG9uIHRoaXMgcHJpc21pYy5pbyBBUEkuXG4gICAqIERvIG5vdCB1c2UgbGlrZSB0aGlzOiBzZWFyY2hGb3JtLnJlZihhcGkubWFzdGVyKCkpLlxuICAgKiBJbnN0ZWFkLCBzZXQgeW91ciByZWYgb25jZSBpbiBhIHZhcmlhYmxlLCBhbmQgY2FsbCBpdCB3aGVuIHlvdSBuZWVkIGl0OyB0aGlzIHdpbGwgYWxsb3cgdG8gY2hhbmdlIHRoZSByZWYgeW91J3JlIHZpZXdpbmcgZWFzaWx5IGZvciB5b3VyIGVudGlyZSBwYWdlLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgKi9cbiAgbWFzdGVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLm1hc3Rlci5yZWY7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHJlZiBJRCBmb3IgYSBnaXZlbiByZWYncyBsYWJlbC5cbiAgICogRG8gbm90IHVzZSBsaWtlIHRoaXM6IHNlYXJjaEZvcm0ucmVmKGFwaS5yZWYoXCJGdXR1cmUgcmVsZWFzZSBsYWJlbFwiKSkuXG4gICAqIEluc3RlYWQsIHNldCB5b3VyIHJlZiBvbmNlIGluIGEgdmFyaWFibGUsIGFuZCBjYWxsIGl0IHdoZW4geW91IG5lZWQgaXQ7IHRoaXMgd2lsbCBhbGxvdyB0byBjaGFuZ2UgdGhlIHJlZiB5b3UncmUgdmlld2luZyBlYXNpbHkgZm9yIHlvdXIgZW50aXJlIHBhZ2UuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBsYWJlbCAtIHRoZSByZWYncyBsYWJlbFxuICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgKi9cbiAgcmVmOiBmdW5jdGlvbihsYWJlbCkge1xuICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuZGF0YS5yZWZzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZih0aGlzLmRhdGEucmVmc1tpXS5sYWJlbCA9PSBsYWJlbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhLnJlZnNbaV0ucmVmO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogVGhlIGN1cnJlbnQgZXhwZXJpbWVudCwgb3IgbnVsbFxuICAgKiBAcmV0dXJucyB7RXhwZXJpbWVudH1cbiAgICovXG4gIGN1cnJlbnRFeHBlcmltZW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5leHBlcmltZW50cy5jdXJyZW50KCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFF1ZXJ5IHRoZSByZXBvc2l0b3J5XG4gICAqIEBwYXJhbSB7c3RyaW5nfGFycmF5fFByZWRpY2F0ZX0gdGhlIHF1ZXJ5IGl0c2VsZlxuICAgKiBAcGFyYW0ge29iamVjdH0gYWRkaXRpb25hbCBwYXJhbWV0ZXJzXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrKGVyciwgcmVzcG9uc2UpXG4gICAqL1xuICBxdWVyeTogZnVuY3Rpb24ocSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICB2YXIgZm9ybSA9IHRoaXMuZm9ybSgnZXZlcnl0aGluZycpO1xuICAgIGZvciAodmFyIGtleSBpbiBvcHRpb25zKSB7XG4gICAgICBmb3JtID0gZm9ybS5zZXQoa2V5LCBvcHRpb25zW2tleV0pO1xuICAgIH1cbiAgICBpZiAoIW9wdGlvbnNbJ3JlZiddKSB7XG4gICAgICBmb3JtID0gZm9ybS5yZWYodGhpcy5tYXN0ZXIoKSk7XG4gICAgfVxuICAgIHJldHVybiBmb3JtLnF1ZXJ5KHEpLnN1Ym1pdChjYWxsYmFjayk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBkb2N1bWVudCB3aXRoIHRoZSBnaXZlbiBpZFxuICAgKiBAcGFyYW0ge3N0cmluZ30gaWRcbiAgICogQHBhcmFtIHtvYmplY3R9IGFkZGl0aW9uYWwgcGFyYW1ldGVyc1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayhlcnIsIHJlc3BvbnNlKVxuICAgKi9cbiAgZ2V0QnlJRDogZnVuY3Rpb24oaWQsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucXVlcnkoUHJlZGljYXRlcy5hdCgnZG9jdW1lbnQuaWQnLCBpZCksIG9wdGlvbnMsIGZ1bmN0aW9uKGVyciwgcmVzcG9uc2UpIHtcbiAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5yZXN1bHRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY2FsbGJhY2soZXJyLCByZXNwb25zZS5yZXN1bHRzWzBdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XG4gICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXNwb25zZSl7XG4gICAgICByZXR1cm4gcmVzcG9uc2UgJiYgcmVzcG9uc2UucmVzdWx0cyAmJiByZXNwb25zZS5yZXN1bHRzWzBdO1xuICAgIH0pO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBtdWx0aXBsZSBkb2N1bWVudHMgZnJvbSBhbiBhcnJheSBvZiBpZFxuICAgKiBAcGFyYW0ge2FycmF5fSBpZHNcbiAgICogQHBhcmFtIHtvYmplY3R9IGFkZGl0aW9uYWwgcGFyYW1ldGVyc1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayhlcnIsIHJlc3BvbnNlKVxuICAgKi9cbiAgZ2V0QnlJRHM6IGZ1bmN0aW9uKGlkcywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5xdWVyeShbJ2luJywgJ2RvY3VtZW50LmlkJywgaWRzXSwgb3B0aW9ucywgY2FsbGJhY2spO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgZG9jdW1lbnQgd2l0aCB0aGUgZ2l2ZW4gdWlkXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIHRoZSBjdXN0b20gdHlwZSBvZiB0aGUgZG9jdW1lbnRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVpZFxuICAgKiBAcGFyYW0ge29iamVjdH0gYWRkaXRpb25hbCBwYXJhbWV0ZXJzXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrKGVyciwgcmVzcG9uc2UpXG4gICAqL1xuICBnZXRCeVVJRDogZnVuY3Rpb24odHlwZSwgdWlkLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLnF1ZXJ5KFByZWRpY2F0ZXMuYXQoJ215LicrdHlwZSsnLnVpZCcsIHVpZCksIG9wdGlvbnMsIGZ1bmN0aW9uKGVyciwgcmVzcG9uc2UpIHtcbiAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5yZXN1bHRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY2FsbGJhY2soZXJyLCByZXNwb25zZS5yZXN1bHRzWzBdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XG4gICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXNwb25zZSl7XG4gICAgICByZXR1cm4gcmVzcG9uc2UgJiYgcmVzcG9uc2UucmVzdWx0cyAmJiByZXNwb25zZS5yZXN1bHRzWzBdO1xuICAgIH0pO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgZG9jdW1lbnQgd2l0aCB0aGUgZ2l2ZW4gdWlkXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIHRoZSBjdXN0b20gdHlwZSBvZiB0aGUgZG9jdW1lbnRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVpZFxuICAgKiBAcGFyYW0ge29iamVjdH0gYWRkaXRpb25hbCBwYXJhbWV0ZXJzXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrKGVyciwgcmVzcG9uc2UpXG4gICAqL1xuICBnZXRCb29rbWFyazogZnVuY3Rpb24oYm9va21hcmssIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGlkID0gdGhpcy5ib29rbWFya3NbYm9va21hcmtdO1xuICAgIGlmIChpZCkge1xuICAgICAgdGhpcy5nZXRCeUlkKHRoaXMuYm9va21hcmtzW2Jvb2ttYXJrXSwgb3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhuZXcgRXJyb3IoXCJFcnJvciByZXRyaWV2aW5nIGJvb2ttYXJrZWQgaWRcIikpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBVUkwgdG8gZGlzcGxheSBhIGdpdmVuIHByZXZpZXdcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRva2VuIGFzIHJlY2VpdmVkIGZyb20gUHJpc21pYyBzZXJ2ZXIgdG8gaWRlbnRpZnkgdGhlIGNvbnRlbnQgdG8gcHJldmlld1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaW5rUmVzb2x2ZXIgdGhlIGxpbmsgcmVzb2x2ZXIgdG8gYnVpbGQgVVJMIGZvciB5b3VyIHNpdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGRlZmF1bHRVcmwgdGhlIFVSTCB0byBkZWZhdWx0IHRvIHJldHVybiBpZiB0aGUgcHJldmlldyBkb2Vzbid0IGNvcnJlc3BvbmQgdG8gYSBkb2N1bWVudFxuICAgKiAgICAgICAgICAgICAgICAodXN1YWxseSB0aGUgaG9tZSBwYWdlIG9mIHlvdXIgc2l0ZSlcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgdG8gZ2V0IHRoZSByZXN1bHRpbmcgVVJMIChvcHRpb25hbCwgeW91IGNhbiBnZXQgaXQgZnJvbSB0aGUgUHJvbWlzZSByZXN1bHQpXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgcHJldmlld1Nlc3Npb246IGZ1bmN0aW9uKHRva2VuLCBsaW5rUmVzb2x2ZXIsIGRlZmF1bHRVcmwsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGFwaSA9IHRoaXM7XG4gICAgdmFyIFByZWRpY2F0ZXMgPSBQcmVkaWNhdGVzO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHZhciBjYiA9IGZ1bmN0aW9uKGVyciwgdmFsdWUsIHhocikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgdmFsdWUsIHhocik7XG4gICAgICAgIGlmICh2YWx1ZSkgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICAgIGlmIChlcnIpIHJlamVjdChlcnIpO1xuICAgICAgfTtcbiAgICAgIHNlbGYucmVxdWVzdEhhbmRsZXIodG9rZW4sIGZ1bmN0aW9uIChlcnIsIHJlc3VsdCwgeGhyKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBjYihlcnIsIGRlZmF1bHRVcmwsIHhocik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIG1haW5Eb2N1bWVudElkID0gcmVzdWx0Lm1haW5Eb2N1bWVudDtcbiAgICAgICAgICBpZiAoIW1haW5Eb2N1bWVudElkKSB7XG4gICAgICAgICAgICBjYihudWxsLCBkZWZhdWx0VXJsLCB4aHIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcGkuZm9ybShcImV2ZXJ5dGhpbmdcIikucXVlcnkoUHJlZGljYXRlcy5hdChcImRvY3VtZW50LmlkXCIsIG1haW5Eb2N1bWVudElkKSkucmVmKHRva2VuKS5zdWJtaXQoZnVuY3Rpb24oZXJyLCByZXNwb25zZSkge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS5yZXN1bHRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgY2IobnVsbCwgZGVmYXVsdFVybCwgeGhyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgY2IobnVsbCwgbGlua1Jlc29sdmVyKHJlc3BvbnNlLnJlc3VsdHNbMF0pLCB4aHIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNiKGUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBjYihlLCBkZWZhdWx0VXJsLCB4aHIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvKipcbiAgICogRmV0Y2ggYSBVUkwgY29ycmVzcG9uZGluZyB0byBhIHF1ZXJ5LCBhbmQgcGFyc2UgdGhlIHJlc3BvbnNlIGFzIGEgUmVzcG9uc2Ugb2JqZWN0XG4gICAqL1xuICByZXF1ZXN0OiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGFwaSA9IHRoaXM7XG4gICAgdmFyIGNhY2hlS2V5ID0gdXJsICsgKHRoaXMuYWNjZXNzVG9rZW4gPyAoJyMnICsgdGhpcy5hY2Nlc3NUb2tlbikgOiAnJyk7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5hcGlDYWNoZTtcbiAgICBjYWNoZS5nZXQoY2FjaGVLZXksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XG4gICAgICBpZiAoZXJyIHx8IHZhbHVlKSB7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgdmFsdWUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBhcGkucmVxdWVzdEhhbmRsZXIodXJsLCBmdW5jdGlvbiAoZXJyLCBkb2N1bWVudHMsIHhociwgdHRsKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIsIG51bGwsIHhocik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZXN1bHRzID0gZG9jdW1lbnRzLnJlc3VsdHMubWFwKHBhcnNlRG9jKTtcbiAgICAgICAgdmFyIHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKFxuICAgICAgICAgIGRvY3VtZW50cy5wYWdlLFxuICAgICAgICAgIGRvY3VtZW50cy5yZXN1bHRzX3Blcl9wYWdlLFxuICAgICAgICAgIGRvY3VtZW50cy5yZXN1bHRzX3NpemUsXG4gICAgICAgICAgZG9jdW1lbnRzLnRvdGFsX3Jlc3VsdHNfc2l6ZSxcbiAgICAgICAgICBkb2N1bWVudHMudG90YWxfcGFnZXMsXG4gICAgICAgICAgZG9jdW1lbnRzLm5leHRfcGFnZSxcbiAgICAgICAgICBkb2N1bWVudHMucHJldl9wYWdlLFxuICAgICAgICAgIHJlc3VsdHMgfHwgW10pO1xuICAgICAgICBpZiAodHRsKSB7XG4gICAgICAgICAgY2FjaGUuc2V0KGNhY2hlS2V5LCByZXNwb25zZSwgdHRsLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3BvbnNlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXNwb25zZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBzdWJtaXR0YWJsZSBSRVNUZnVsIGZvcm0gYXMgZGVzY3JpYmVkIG9uIHRoZSBBUEkgZW5kcG9pbnQgKGFzIHBlciBSRVNUZnVsIHN0YW5kYXJkcylcbiAqIEBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gRm9ybShuYW1lLCBmaWVsZHMsIGZvcm1fbWV0aG9kLCByZWwsIGVuY3R5cGUsIGFjdGlvbikge1xuICB0aGlzLm5hbWUgPSBuYW1lO1xuICB0aGlzLmZpZWxkcyA9IGZpZWxkcztcbiAgdGhpcy5mb3JtX21ldGhvZCA9IGZvcm1fbWV0aG9kO1xuICB0aGlzLnJlbCA9IHJlbDtcbiAgdGhpcy5lbmN0eXBlID0gZW5jdHlwZTtcbiAgdGhpcy5hY3Rpb24gPSBhY3Rpb247XG59XG5cbkZvcm0ucHJvdG90eXBlID0ge307XG5cbi8qKlxuICogUGFyc2UganNvbiBhcyBhIGRvY3VtZW50XG4gKlxuICogQHJldHVybnMge0RvY3VtZW50fVxuICovXG52YXIgcGFyc2VEb2MgPSBmdW5jdGlvbihqc29uKSB7XG4gIHZhciBmcmFnbWVudHMgPSB7fTtcbiAgZm9yKHZhciBmaWVsZCBpbiBqc29uLmRhdGFbanNvbi50eXBlXSkge1xuICAgIGZyYWdtZW50c1tqc29uLnR5cGUgKyAnLicgKyBmaWVsZF0gPSBqc29uLmRhdGFbanNvbi50eXBlXVtmaWVsZF07XG4gIH1cblxuICB2YXIgc2x1Z3MgPSBbXTtcbiAgaWYgKGpzb24uc2x1Z3MgIT09IHVuZGVmaW5lZCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwganNvbi5zbHVncy5sZW5ndGg7IGkrKykge1xuICAgICAgc2x1Z3MucHVzaChkZWNvZGVVUklDb21wb25lbnQoanNvbi5zbHVnc1tpXSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXcgRG9jdW1lbnQoXG4gICAganNvbi5pZCxcbiAgICBqc29uLnVpZCB8fCBudWxsLFxuICAgIGpzb24udHlwZSxcbiAgICBqc29uLmhyZWYsXG4gICAganNvbi50YWdzLFxuICAgIHNsdWdzLFxuICAgIGZyYWdtZW50c1xuICApO1xufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIFNlYXJjaEZvcm0gb2JqZWN0LiBUbyBjcmVhdGUgU2VhcmNoRm9ybSBvYmplY3RzIHRoYXQgYXJlIGFsbG93ZWQgaW4gdGhlIEFQSSwgcGxlYXNlIHVzZSB0aGUgQVBJLmZvcm0oKSBtZXRob2QuXG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBTZWFyY2hGb3JtXG4gKi9cbmZ1bmN0aW9uIFNlYXJjaEZvcm0oYXBpLCBmb3JtLCBkYXRhKSB7XG4gIHRoaXMuYXBpID0gYXBpO1xuICB0aGlzLmZvcm0gPSBmb3JtO1xuICB0aGlzLmRhdGEgPSBkYXRhIHx8IHt9O1xuXG4gIGZvcih2YXIgZmllbGQgaW4gZm9ybS5maWVsZHMpIHtcbiAgICBpZihmb3JtLmZpZWxkc1tmaWVsZF1bJ2RlZmF1bHQnXSkge1xuICAgICAgdGhpcy5kYXRhW2ZpZWxkXSA9IFtmb3JtLmZpZWxkc1tmaWVsZF1bJ2RlZmF1bHQnXV07XG4gICAgfVxuICB9XG59XG5cblNlYXJjaEZvcm0ucHJvdG90eXBlID0ge1xuXG4gIC8qKlxuICAgKiBTZXQgYW4gQVBJIGNhbGwgcGFyYW1ldGVyLiBUaGlzIHdpbGwgb25seSB3b3JrIGlmIGZpZWxkIGlzIGEgdmFsaWQgZmllbGQgb2YgdGhlXG4gICAqIFJFU1RmdWwgZm9ybSBpbiB0aGUgZmlyc3QgcGxhY2UgKGFzIGRlc2NyaWJlZCBpbiB0aGUgL2FwaSBkb2N1bWVudCk7IG90aGVyd2lzZSxcbiAgICogYW4gXCJVbmtub3duIGZpZWxkXCIgZXJyb3IgaXMgdGhyb3duLlxuICAgKiBQbGVhc2UgcHJlZmVyIHVzaW5nIGRlZGljYXRlZCBtZXRob2RzIGxpa2UgcXVlcnkoKSwgb3JkZXJpbmdzKCksIC4uLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZmllbGQgLSBUaGUgbmFtZSBvZiB0aGUgZmllbGQgdG8gc2V0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSAtIFRoZSB2YWx1ZSB0aGF0IGdldHMgYXNzaWduZWRcbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gVGhlIFNlYXJjaEZvcm0gaXRzZWxmXG4gICAqL1xuICBzZXQ6IGZ1bmN0aW9uKGZpZWxkLCB2YWx1ZSkge1xuICAgIHZhciBmaWVsZERlc2MgPSB0aGlzLmZvcm0uZmllbGRzW2ZpZWxkXTtcbiAgICBpZighZmllbGREZXNjKSB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIGZpZWxkIFwiICsgZmllbGQpO1xuICAgIHZhciB2YWx1ZXM9IHRoaXMuZGF0YVtmaWVsZF0gfHwgW107XG4gICAgaWYodmFsdWUgPT09ICcnIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIHdlIG11c3QgY29tcGFyZSB2YWx1ZSB0byBudWxsIGJlY2F1c2Ugd2Ugd2FudCB0byBhbGxvdyAwXG4gICAgICB2YWx1ZSA9IG51bGw7XG4gICAgfVxuICAgIGlmKGZpZWxkRGVzYy5tdWx0aXBsZSkge1xuICAgICAgaWYgKHZhbHVlKSB2YWx1ZXMucHVzaCh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlcyA9IHZhbHVlICYmIFt2YWx1ZV07XG4gICAgfVxuICAgIHRoaXMuZGF0YVtmaWVsZF0gPSB2YWx1ZXM7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFNldHMgYSByZWYgdG8gcXVlcnkgb24gZm9yIHRoaXMgU2VhcmNoRm9ybS4gVGhpcyBpcyBhIG1hbmRhdG9yeVxuICAgKiBtZXRob2QgdG8gY2FsbCBiZWZvcmUgY2FsbGluZyBzdWJtaXQoKSwgYW5kIGFwaS5mb3JtKCdldmVyeXRoaW5nJykuc3VibWl0KClcbiAgICogd2lsbCBub3Qgd29yay5cbiAgICpcbiAgICogQHBhcmFtIHtSZWZ9IHJlZiAtIFRoZSBSZWYgb2JqZWN0IGRlZmluaW5nIHRoZSByZWYgdG8gcXVlcnlcbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gVGhlIFNlYXJjaEZvcm0gaXRzZWxmXG4gICAqL1xuICByZWY6IGZ1bmN0aW9uKHJlZikge1xuICAgIHJldHVybiB0aGlzLnNldChcInJlZlwiLCByZWYpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBTZXRzIGEgcHJlZGljYXRlLWJhc2VkIHF1ZXJ5IGZvciB0aGlzIFNlYXJjaEZvcm0uIFRoaXMgaXMgd2hlcmUgeW91XG4gICAqIHBhc3RlIHdoYXQgeW91IGNvbXBvc2UgaW4geW91ciBwcmlzbWljLmlvIEFQSSBicm93c2VyLlxuICAgKlxuICAgKiBAZXhhbXBsZSBmb3JtLnF1ZXJ5KFByaXNtaWMuUHJlZGljYXRlcy5hdChcImRvY3VtZW50LmlkXCIsIFwiZm9vYmFyXCIpKVxuICAgKiBAcGFyYW0ge3N0cmluZ3wuLi5hcnJheX0gcXVlcnkgLSBFaXRoZXIgYSBxdWVyeSBhcyBhIHN0cmluZywgb3IgYXMgbWFueSBwcmVkaWNhdGVzIGFzIHlvdSB3YW50LiBTZWUgUHJpc21pYy5QcmVkaWNhdGVzLlxuICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICovXG4gIHF1ZXJ5OiBmdW5jdGlvbihxdWVyeSkge1xuICAgIGlmICh0eXBlb2YgcXVlcnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gdGhpcy5zZXQoXCJxXCIsIHF1ZXJ5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHByZWRpY2F0ZXM7XG4gICAgICBpZiAocXVlcnkuY29uc3RydWN0b3IgPT09IEFycmF5ICYmIHF1ZXJ5Lmxlbmd0aCA+IDAgJiYgcXVlcnlbMF0uY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgIHByZWRpY2F0ZXMgPSBxdWVyeTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHByZWRpY2F0ZXMgPSBbXS5zbGljZS5hcHBseShhcmd1bWVudHMpOyAvLyBDb252ZXJ0IHRvIGEgcmVhbCBKUyBhcnJheVxuICAgICAgfVxuICAgICAgdmFyIHN0cmluZ1F1ZXJpZXMgPSBbXTtcbiAgICAgIHByZWRpY2F0ZXMuZm9yRWFjaChmdW5jdGlvbiAocHJlZGljYXRlKSB7XG4gICAgICAgIHZhciBmaXJzdEFyZyA9IChwcmVkaWNhdGVbMV0uaW5kZXhPZihcIm15LlwiKSA9PT0gMCB8fCBwcmVkaWNhdGVbMV0uaW5kZXhPZihcImRvY3VtZW50XCIpID09PSAwKSA/IHByZWRpY2F0ZVsxXVxuICAgICAgICAgICAgICA6ICdcIicgKyBwcmVkaWNhdGVbMV0gKyAnXCInO1xuICAgICAgICBzdHJpbmdRdWVyaWVzLnB1c2goXCJbOmQgPSBcIiArIHByZWRpY2F0ZVswXSArIFwiKFwiICsgZmlyc3RBcmcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgKHByZWRpY2F0ZS5sZW5ndGggPiAyID8gXCIsIFwiIDogXCJcIikgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJlZGljYXRlLnNsaWNlKDIpLm1hcChmdW5jdGlvbihwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdcIicgKyBwICsgJ1wiJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBcIltcIiArIHAubWFwKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnXCInICsgZSArICdcIic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5qb2luKCcsJykgKyBcIl1cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHAgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcC5nZXRUaW1lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuam9pbignLCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkoKSArIFwiKV1cIik7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzLnF1ZXJ5KFwiW1wiICsgc3RyaW5nUXVlcmllcy5qb2luKFwiXCIpICsgXCJdXCIpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogU2V0cyBhIHBhZ2Ugc2l6ZSB0byBxdWVyeSBmb3IgdGhpcyBTZWFyY2hGb3JtLiBUaGlzIGlzIGFuIG9wdGlvbmFsIG1ldGhvZC5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IHNpemUgLSBUaGUgcGFnZSBzaXplXG4gICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgKi9cbiAgcGFnZVNpemU6IGZ1bmN0aW9uKHNpemUpIHtcbiAgICByZXR1cm4gdGhpcy5zZXQoXCJwYWdlU2l6ZVwiLCBzaXplKTtcbiAgfSxcblxuICAvKipcbiAgICogUmVzdHJpY3QgdGhlIHJlc3VsdHMgZG9jdW1lbnQgdG8gdGhlIHNwZWNpZmllZCBmaWVsZHNcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd8YXJyYXl9IGZpZWxkcyAtIFRoZSBsaXN0IG9mIGZpZWxkcywgYXJyYXkgb3IgY29tbWEgc2VwYXJhdGVkIHN0cmluZ1xuICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICovXG4gIGZldGNoOiBmdW5jdGlvbihmaWVsZHMpIHtcbiAgICBpZiAoZmllbGRzIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIGZpZWxkcyA9IGZpZWxkcy5qb2luKFwiLFwiKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2V0KFwiZmV0Y2hcIiwgZmllbGRzKTtcbiAgfSxcblxuICAvKipcbiAgICogSW5jbHVkZSB0aGUgcmVxdWVzdGVkIGZpZWxkcyBpbiB0aGUgRG9jdW1lbnRMaW5rIGluc3RhbmNlcyBpbiB0aGUgcmVzdWx0XG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfGFycmF5fSBmaWVsZHMgLSBUaGUgbGlzdCBvZiBmaWVsZHMsIGFycmF5IG9yIGNvbW1hIHNlcGFyYXRlZCBzdHJpbmdcbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gVGhlIFNlYXJjaEZvcm0gaXRzZWxmXG4gICAqL1xuICBmZXRjaExpbmtzOiBmdW5jdGlvbihmaWVsZHMpIHtcbiAgICBpZiAoZmllbGRzIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIGZpZWxkcyA9IGZpZWxkcy5qb2luKFwiLFwiKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2V0KFwiZmV0Y2hMaW5rc1wiLCBmaWVsZHMpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBwYWdlIG51bWJlciB0byBxdWVyeSBmb3IgdGhpcyBTZWFyY2hGb3JtLiBUaGlzIGlzIGFuIG9wdGlvbmFsIG1ldGhvZC5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IHAgLSBUaGUgcGFnZSBudW1iZXJcbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gVGhlIFNlYXJjaEZvcm0gaXRzZWxmXG4gICAqL1xuICBwYWdlOiBmdW5jdGlvbihwKSB7XG4gICAgcmV0dXJuIHRoaXMuc2V0KFwicGFnZVwiLCBwKTtcbiAgfSxcblxuICAvKipcbiAgICogU2V0cyB0aGUgb3JkZXJpbmdzIHRvIHF1ZXJ5IGZvciB0aGlzIFNlYXJjaEZvcm0uIFRoaXMgaXMgYW4gb3B0aW9uYWwgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0ge2FycmF5fSBvcmRlcmluZ3MgLSBBcnJheSBvZiBzdHJpbmc6IGxpc3Qgb2YgZmllbGRzLCBvcHRpb25hbGx5IGZvbGxvd2VkIGJ5IHNwYWNlIGFuZCBkZXNjLiBFeGFtcGxlOiBbJ215LnByb2R1Y3QucHJpY2UgZGVzYycsICdteS5wcm9kdWN0LmRhdGUnXVxuICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICovXG4gIG9yZGVyaW5nczogZnVuY3Rpb24ob3JkZXJpbmdzKSB7XG4gICAgaWYgKHR5cGVvZiBvcmRlcmluZ3MgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgICByZXR1cm4gdGhpcy5zZXQoXCJvcmRlcmluZ3NcIiwgb3JkZXJpbmdzKTtcbiAgICB9IGVsc2UgaWYgKCFvcmRlcmluZ3MpIHtcbiAgICAgIC8vIE5vb3BcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb3JtYWwgdXNhZ2VcbiAgICAgIHJldHVybiB0aGlzLnNldChcIm9yZGVyaW5nc1wiLCBcIltcIiArIG9yZGVyaW5ncy5qb2luKFwiLFwiKSArIFwiXVwiKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFN1Ym1pdHMgdGhlIHF1ZXJ5LCBhbmQgY2FsbHMgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHRoZSBxdWVyeSB3YXMgbWFkZSxcbiAgICogdG8gd2hpY2ggeW91IG1heSBwYXNzIHRocmVlIHBhcmFtZXRlcnM6IGEgcG90ZW50aWFsIGVycm9yIChudWxsIGlmIG5vIHByb2JsZW0pLFxuICAgKiBhIFJlc3BvbnNlIG9iamVjdCAoY29udGFpbmluZyBhbGwgdGhlIHBhZ2luYXRpb24gc3BlY2lmaWNzICsgdGhlIGFycmF5IG9mIERvY3MpLFxuICAgKiBhbmQgdGhlIFhNTEh0dHBSZXF1ZXN0XG4gICAqL1xuICBzdWJtaXQ6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciB1cmwgPSB0aGlzLmZvcm0uYWN0aW9uO1xuXG4gICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgdmFyIHNlcCA9ICh1cmwuaW5kZXhPZignPycpID4gLTEgPyAnJicgOiAnPycpO1xuICAgICAgZm9yKHZhciBrZXkgaW4gdGhpcy5kYXRhKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgIHZhciB2YWx1ZXMgPSB0aGlzLmRhdGFba2V5XTtcbiAgICAgICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICB1cmwgKz0gc2VwICsga2V5ICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KHZhbHVlc1tpXSk7XG4gICAgICAgICAgICAgIHNlcCA9ICcmJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBzZWxmLmFwaS5yZXF1ZXN0KHVybCwgZnVuY3Rpb24oZXJyLCB2YWx1ZSwgeGhyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyLCB2YWx1ZSwgeGhyKTtcbiAgICAgICAgaWYgKGVycikgcmVqZWN0KGVycik7XG4gICAgICAgIGlmICh2YWx1ZSkgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyB0aGUgcmVzcG9uc2Ugb2YgYSBTZWFyY2hGb3JtIHF1ZXJ5IGFzIHJldHVybmVkIGJ5IHRoZSBBUEkuXG4gKiBJdCBpbmNsdWRlcyBhbGwgdGhlIGZpZWxkcyB0aGF0IGFyZSB1c2VmdWwgZm9yIHBhZ2luYXRpb24gKHBhZ2UsIHRvdGFsX3BhZ2VzLCB0b3RhbF9yZXN1bHRzX3NpemUsIC4uLiksXG4gKiBhcyB3ZWxsIGFzIHRoZSBmaWVsZCBcInJlc3VsdHNcIiwgd2hpY2ggaXMgYW4gYXJyYXkgb2Yge0BsaW5rIERvY3VtZW50fSBvYmplY3RzLCB0aGUgZG9jdW1lbnRzIHRoZW1zZWx2ZXMuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlKHBhZ2UsIHJlc3VsdHNfcGVyX3BhZ2UsIHJlc3VsdHNfc2l6ZSwgdG90YWxfcmVzdWx0c19zaXplLCB0b3RhbF9wYWdlcywgbmV4dF9wYWdlLCBwcmV2X3BhZ2UsIHJlc3VsdHMpIHtcbiAgLyoqXG4gICAqIFRoZSBjdXJyZW50IHBhZ2VcbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHRoaXMucGFnZSA9IHBhZ2U7XG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIHJlc3VsdHMgcGVyIHBhZ2VcbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHRoaXMucmVzdWx0c19wZXJfcGFnZSA9IHJlc3VsdHNfcGVyX3BhZ2U7XG4gIC8qKlxuICAgKiBUaGUgc2l6ZSBvZiB0aGUgY3VycmVudCBwYWdlXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICB0aGlzLnJlc3VsdHNfc2l6ZSA9IHJlc3VsdHNfc2l6ZTtcbiAgLyoqXG4gICAqIFRoZSB0b3RhbCBzaXplIG9mIHJlc3VsdHMgYWNyb3NzIGFsbCBwYWdlc1xuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgdGhpcy50b3RhbF9yZXN1bHRzX3NpemUgPSB0b3RhbF9yZXN1bHRzX3NpemU7XG4gIC8qKlxuICAgKiBUaGUgdG90YWwgbnVtYmVyIG9mIHBhZ2VzXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICB0aGlzLnRvdGFsX3BhZ2VzID0gdG90YWxfcGFnZXM7XG4gIC8qKlxuICAgKiBUaGUgVVJMIG9mIHRoZSBuZXh0IHBhZ2UgaW4gdGhlIEFQSVxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgdGhpcy5uZXh0X3BhZ2UgPSBuZXh0X3BhZ2U7XG4gIC8qKlxuICAgKiBUaGUgVVJMIG9mIHRoZSBwcmV2aW91cyBwYWdlIGluIHRoZSBBUElcbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIHRoaXMucHJldl9wYWdlID0gcHJldl9wYWdlO1xuICAvKipcbiAgICogQXJyYXkgb2Yge0BsaW5rIERvY3VtZW50fSBmb3IgdGhlIGN1cnJlbnQgcGFnZVxuICAgKiBAdHlwZSB7QXJyYXl9XG4gICAqL1xuICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xufVxuXG4vKipcbiAqIEVtYm9kaWVzIGEgcHJpc21pYy5pbyByZWYgKGEgcGFzdCBvciBmdXR1cmUgcG9pbnQgaW4gdGltZSB5b3UgY2FuIHF1ZXJ5KVxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKi9cbmZ1bmN0aW9uIFJlZihyZWYsIGxhYmVsLCBpc01hc3Rlciwgc2NoZWR1bGVkQXQsIGlkKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBJRCBvZiB0aGUgcmVmXG4gICAqL1xuICB0aGlzLnJlZiA9IHJlZjtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGxhYmVsIG9mIHRoZSByZWZcbiAgICovXG4gIHRoaXMubGFiZWwgPSBsYWJlbDtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gaXMgdHJ1ZSBpZiB0aGUgcmVmIGlzIHRoZSBtYXN0ZXIgcmVmXG4gICAqL1xuICB0aGlzLmlzTWFzdGVyID0gaXNNYXN0ZXI7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBzY2hlZHVsZWQgZGF0ZSBvZiB0aGUgcmVmXG4gICAqL1xuICB0aGlzLnNjaGVkdWxlZEF0ID0gc2NoZWR1bGVkQXQ7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBuYW1lIG9mIHRoZSByZWZcbiAgICovXG4gIHRoaXMuaWQgPSBpZDtcbn1cblJlZi5wcm90b3R5cGUgPSB7fTtcbmZ1bmN0aW9uIGdsb2JhbENhY2hlKCkge1xuICB2YXIgZztcbiAgaWYgKHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcpIHtcbiAgICBnID0gZ2xvYmFsOyAvLyBOb2RlSlNcbiAgfSBlbHNlIHtcbiAgICBnID0gd2luZG93OyAvLyBicm93c2VyXG4gIH1cbiAgaWYgKCFnLnByaXNtaWNDYWNoZSkge1xuICAgIGcucHJpc21pY0NhY2hlID0gbmV3IEFwaUNhY2hlKCk7XG4gIH1cbiAgcmV0dXJuIGcucHJpc21pY0NhY2hlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgQXBpOiBBcGksXG4gIEZvcm06IEZvcm0sXG4gIFNlYXJjaEZvcm06IFNlYXJjaEZvcm0sXG4gIFJlZjogUmVmLFxuICBwYXJzZURvYzogcGFyc2VEb2Ncbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIElFIGJlbG93IDEyIGRvZXNuJ3Qgc3VwcG9ydCBwcm9taXNlc1xucmVxdWlyZSgnZXM2LXByb21pc2UnKS5wb2x5ZmlsbCgpO1xuXG4vLyBQb2x5ZmlsbCBmb3IgaW5oZXJpdGFuY2VcbmlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSAhPSAnZnVuY3Rpb24nKSB7XG4gIE9iamVjdC5jcmVhdGUgPSAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIE9iamVjdCA9IGZ1bmN0aW9uKCkge307XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChwcm90b3R5cGUpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBFcnJvcignU2Vjb25kIGFyZ3VtZW50IG5vdCBzdXBwb3J0ZWQnKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgcHJvdG90eXBlICE9ICdvYmplY3QnKSB7XG4gICAgICAgIHRocm93IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhbiBvYmplY3QnKTtcbiAgICAgIH1cbiAgICAgIE9iamVjdC5wcm90b3R5cGUgPSBwcm90b3R5cGU7XG4gICAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgICBPYmplY3QucHJvdG90eXBlID0gbnVsbDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfSkoKTtcbn1cblxud2luZG93LlByaXNtaWMgPSByZXF1aXJlKCcuL3ByaXNtaWMnKTtcbiIsIlxuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBMUlVDYWNoZSA9IHJlcXVpcmUoJy4vbHJ1Jyk7XG5cbi8qKlxuICogQXBpIGNhY2hlXG4gKi9cbmZ1bmN0aW9uIEFwaUNhY2hlKGxpbWl0KSB7XG4gIHRoaXMubHJ1ID0gbmV3IExSVUNhY2hlKGxpbWl0KTtcbn1cblxuQXBpQ2FjaGUucHJvdG90eXBlID0ge1xuXG4gIGdldDogZnVuY3Rpb24oa2V5LCBjYikge1xuICAgIHZhciBtYXliZUVudHJ5ID0gdGhpcy5scnUuZ2V0KGtleSk7XG4gICAgaWYobWF5YmVFbnRyeSAmJiAhdGhpcy5pc0V4cGlyZWQoa2V5KSkge1xuICAgICAgcmV0dXJuIGNiKG51bGwsIG1heWJlRW50cnkuZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBjYigpO1xuICB9LFxuXG4gIHNldDogZnVuY3Rpb24oa2V5LCB2YWx1ZSwgdHRsLCBjYikge1xuICAgIHRoaXMubHJ1LnJlbW92ZShrZXkpO1xuICAgIHRoaXMubHJ1LnB1dChrZXksIHtcbiAgICAgIGRhdGE6IHZhbHVlLFxuICAgICAgZXhwaXJlZEluOiB0dGwgPyAoRGF0ZS5ub3coKSArICh0dGwgKiAxMDAwKSkgOiAwXG4gICAgfSk7XG5cbiAgICByZXR1cm4gY2IoKTtcbiAgfSxcblxuICBpc0V4cGlyZWQ6IGZ1bmN0aW9uKGtleSkge1xuICAgIHZhciBlbnRyeSA9IHRoaXMubHJ1LmdldChrZXkpO1xuICAgIGlmKGVudHJ5KSB7XG4gICAgICByZXR1cm4gZW50cnkuZXhwaXJlZEluICE9PSAwICYmIGVudHJ5LmV4cGlyZWRJbiA8IERhdGUubm93KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0sXG5cbiAgcmVtb3ZlOiBmdW5jdGlvbihrZXksIGNiKSB7XG4gICAgdGhpcy5scnUucmVtb3ZlKGtleSk7XG4gICAgcmV0dXJuIGNiKCk7XG4gIH0sXG5cbiAgY2xlYXI6IGZ1bmN0aW9uKGNiKSB7XG4gICAgdGhpcy5scnUucmVtb3ZlQWxsKCk7XG4gICAgcmV0dXJuIGNiKCk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXBpQ2FjaGU7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLyoqXG4gKiBGdW5jdGlvbnMgdG8gYWNjZXNzIGZyYWdtZW50czogc3VwZXJjbGFzcyBmb3IgRG9jdW1lbnQgYW5kIERvYyAoZnJvbSBHcm91cCksIG5vdCBzdXBwb3NlZCB0byBiZSBjcmVhdGVkIGRpcmVjdGx5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gV2l0aEZyYWdtZW50cygpIHt9XG5cbldpdGhGcmFnbWVudHMucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogR2V0cyB0aGUgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LiBTaW5jZSB5b3UgbW9zdCBsaWtlbHkga25vdyB0aGUgdHlwZVxuICAgKiBvZiB0aGlzIGZyYWdtZW50LCBpdCBpcyBhZHZpc2VkIHRoYXQgeW91IHVzZSBhIGRlZGljYXRlZCBtZXRob2QsIGxpa2UgZ2V0IFN0cnVjdHVyZWRUZXh0KCkgb3IgZ2V0RGF0ZSgpLFxuICAgKiBmb3IgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5hdXRob3JcIlxuICAgKiBAcmV0dXJucyB7b2JqZWN0fSAtIFRoZSBKYXZhU2NyaXB0IEZyYWdtZW50IG9iamVjdCB0byBtYW5pcHVsYXRlXG4gICAqL1xuICBnZXQ6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgZnJhZ3MgPSB0aGlzLl9nZXRGcmFnbWVudHMobmFtZSk7XG4gICAgcmV0dXJuIGZyYWdzLmxlbmd0aCA/IGZyYWdzWzBdIDogbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogQnVpbGRzIGFuIGFycmF5IG9mIGFsbCB0aGUgZnJhZ21lbnRzIGluIGNhc2UgdGhleSBhcmUgbXVsdGlwbGUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIG11bHRpcGxlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5hdXRob3JcIlxuICAgKiBAcmV0dXJucyB7YXJyYXl9IC0gQW4gYXJyYXkgb2YgZWFjaCBKYXZhU2NyaXB0IGZyYWdtZW50IG9iamVjdCB0byBtYW5pcHVsYXRlLlxuICAgKi9cbiAgZ2V0QWxsOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldEZyYWdtZW50cyhuYW1lKTtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgaW1hZ2UgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAqXG4gICAqIEBleGFtcGxlIGRvY3VtZW50LmdldEltYWdlKCdibG9nLXBvc3QucGhvdG8nKS5hc0h0bWwobGlua1Jlc29sdmVyKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZnJhZ21lbnQgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LnBob3RvXCJcbiAgICogQHJldHVybnMge0ltYWdlRWx9IC0gVGhlIEltYWdlIG9iamVjdCB0byBtYW5pcHVsYXRlXG4gICAqL1xuICBnZXRJbWFnZTogZnVuY3Rpb24oZnJhZ21lbnQpIHtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICB2YXIgaW1nID0gdGhpcy5nZXQoZnJhZ21lbnQpO1xuICAgIGlmIChpbWcgaW5zdGFuY2VvZiBGcmFnbWVudHMuSW1hZ2UpIHtcbiAgICAgIHJldHVybiBpbWc7XG4gICAgfVxuICAgIGlmIChpbWcgaW5zdGFuY2VvZiBGcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgIC8vIGZpbmQgZmlyc3QgaW1hZ2UgaW4gc3QuXG4gICAgICByZXR1cm4gaW1nO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvLyBVc2VmdWwgZm9yIG9ic29sZXRlIG11bHRpcGxlc1xuICBnZXRBbGxJbWFnZXM6IGZ1bmN0aW9uKGZyYWdtZW50KSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGltYWdlcyA9IHRoaXMuZ2V0QWxsKGZyYWdtZW50KTtcblxuICAgIHJldHVybiBpbWFnZXMubWFwKGZ1bmN0aW9uIChpbWFnZSkge1xuICAgICAgaWYgKGltYWdlIGluc3RhbmNlb2YgRnJhZ21lbnRzLkltYWdlKSB7XG4gICAgICAgIHJldHVybiBpbWFnZTtcbiAgICAgIH1cbiAgICAgIGlmIChpbWFnZSBpbnN0YW5jZW9mIEZyYWdtZW50cy5TdHJ1Y3R1cmVkVGV4dCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgZG9uZS5cIik7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9KTtcbiAgfSxcblxuXG4gIGdldEZpcnN0SW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBmcmFnbWVudHMgPSB0aGlzLmZyYWdtZW50cztcblxuICAgIHZhciBmaXJzdEltYWdlID0gT2JqZWN0LmtleXMoZnJhZ21lbnRzKS5yZWR1Y2UoZnVuY3Rpb24oaW1hZ2UsIGtleSkge1xuICAgICAgaWYgKGltYWdlKSB7XG4gICAgICAgIHJldHVybiBpbWFnZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBlbGVtZW50ID0gZnJhZ21lbnRzW2tleV07XG4gICAgICAgIGlmKHR5cGVvZiBlbGVtZW50LmdldEZpcnN0SW1hZ2UgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHJldHVybiBlbGVtZW50LmdldEZpcnN0SW1hZ2UoKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkltYWdlKSB7XG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XG5cbiAgICAgICAgfSBlbHNlIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICAgIHJldHVybiBmaXJzdEltYWdlO1xuICB9LFxuXG4gIGdldEZpcnN0VGl0bGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBmcmFnbWVudHMgPSB0aGlzLmZyYWdtZW50cztcblxuICAgIHZhciBmaXJzdFRpdGxlID0gT2JqZWN0LmtleXMoZnJhZ21lbnRzKS5yZWR1Y2UoZnVuY3Rpb24oc3QsIGtleSkge1xuICAgICAgaWYgKHN0KSB7XG4gICAgICAgIHJldHVybiBzdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBlbGVtZW50ID0gZnJhZ21lbnRzW2tleV07XG4gICAgICAgIGlmKHR5cGVvZiBlbGVtZW50LmdldEZpcnN0VGl0bGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHJldHVybiBlbGVtZW50LmdldEZpcnN0VGl0bGUoKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnQuZ2V0VGl0bGUoKTtcbiAgICAgICAgfSBlbHNlIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICAgIHJldHVybiBmaXJzdFRpdGxlO1xuICB9LFxuXG4gIGdldEZpcnN0UGFyYWdyYXBoOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgZnJhZ21lbnRzID0gdGhpcy5mcmFnbWVudHM7XG5cbiAgICB2YXIgZmlyc3RQYXJhZ3JhcGggPSBPYmplY3Qua2V5cyhmcmFnbWVudHMpLnJlZHVjZShmdW5jdGlvbihzdCwga2V5KSB7XG4gICAgICBpZiAoc3QpIHtcbiAgICAgICAgcmV0dXJuIHN0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGVsZW1lbnQgPSBmcmFnbWVudHNba2V5XTtcbiAgICAgICAgaWYodHlwZW9mIGVsZW1lbnQuZ2V0Rmlyc3RQYXJhZ3JhcGggPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHJldHVybiBlbGVtZW50LmdldEZpcnN0UGFyYWdyYXBoKCk7XG4gICAgICAgIH0gZWxzZSByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9LCBudWxsKTtcbiAgICByZXR1cm4gZmlyc3RQYXJhZ3JhcGg7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIHZpZXcgd2l0aGluIHRoZSBpbWFnZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICpcbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0SW1hZ2VWaWV3KCdibG9nLXBvc3QucGhvdG8nLCAnbGFyZ2UnKS5hc0h0bWwobGlua1Jlc29sdmVyKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZS0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5waG90b1wiXG4gICAqIEByZXR1cm5zIHtJbWFnZVZpZXd9IHZpZXcgLSBUaGUgVmlldyBvYmplY3QgdG8gbWFuaXB1bGF0ZVxuICAgKi9cbiAgZ2V0SW1hZ2VWaWV3OiBmdW5jdGlvbihuYW1lLCB2aWV3KSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkltYWdlKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0Vmlldyh2aWV3KTtcbiAgICB9XG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICBmb3IodmFyIGk9MDsgaTxmcmFnbWVudC5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYoZnJhZ21lbnQuYmxvY2tzW2ldLnR5cGUgPT0gJ2ltYWdlJykge1xuICAgICAgICAgIHJldHVybiBmcmFnbWVudC5ibG9ja3NbaV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgLy8gVXNlZnVsIGZvciBvYnNvbGV0ZSBtdWx0aXBsZXNcbiAgZ2V0QWxsSW1hZ2VWaWV3czogZnVuY3Rpb24obmFtZSwgdmlldykge1xuICAgIHJldHVybiB0aGlzLmdldEFsbEltYWdlcyhuYW1lKS5tYXAoZnVuY3Rpb24gKGltYWdlKSB7XG4gICAgICByZXR1cm4gaW1hZ2UuZ2V0Vmlldyh2aWV3KTtcbiAgICB9KTtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgdGltZXN0YW1wIGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgKlxuICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXREYXRlKCdibG9nLXBvc3QucHVibGljYXRpb25kYXRlJykuYXNIdG1sKGxpbmtSZXNvbHZlcilcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LnB1YmxpY2F0aW9uZGF0ZVwiXG4gICAqIEByZXR1cm5zIHtEYXRlfSAtIFRoZSBEYXRlIG9iamVjdCB0byBtYW5pcHVsYXRlXG4gICAqL1xuICBnZXRUaW1lc3RhbXA6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5UaW1lc3RhbXApIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIGRhdGUgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAqXG4gICAqIEBleGFtcGxlIGRvY3VtZW50LmdldERhdGUoJ2Jsb2ctcG9zdC5wdWJsaWNhdGlvbmRhdGUnKS5hc0h0bWwobGlua1Jlc29sdmVyKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QucHVibGljYXRpb25kYXRlXCJcbiAgICogQHJldHVybnMge0RhdGV9IC0gVGhlIERhdGUgb2JqZWN0IHRvIG1hbmlwdWxhdGVcbiAgICovXG4gIGdldERhdGU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5EYXRlKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQudmFsdWU7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIGEgYm9vbGVhbiB2YWx1ZSBvZiB0aGUgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAqIFRoaXMgd29ya3MgZ3JlYXQgd2l0aCBhIFNlbGVjdCBmcmFnbWVudC4gVGhlIFNlbGVjdCB2YWx1ZXMgdGhhdCBhcmUgY29uc2lkZXJlZCB0cnVlIGFyZSAobG93ZXJjYXNlZCBiZWZvcmUgbWF0Y2hpbmcpOiAneWVzJywgJ29uJywgYW5kICd0cnVlJy5cbiAgICpcbiAgICogQGV4YW1wbGUgaWYoZG9jdW1lbnQuZ2V0Qm9vbGVhbignYmxvZy1wb3N0LmVuYWJsZUNvbW1lbnRzJykpIHsgLi4uIH1cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmVuYWJsZUNvbW1lbnRzXCJcbiAgICogQHJldHVybnMge2Jvb2xlYW59IC0gVGhlIGJvb2xlYW4gdmFsdWUgb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBnZXRCb29sZWFuOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG4gICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICYmIChmcmFnbWVudC52YWx1ZS50b0xvd2VyQ2FzZSgpID09ICd5ZXMnIHx8IGZyYWdtZW50LnZhbHVlLnRvTG93ZXJDYXNlKCkgPT0gJ29uJyB8fCBmcmFnbWVudC52YWx1ZS50b0xvd2VyQ2FzZSgpID09ICd0cnVlJyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIHRleHQgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAqIFRoZSBtZXRob2Qgd29ya3Mgd2l0aCBTdHJ1Y3R1cmVkVGV4dCBmcmFnbWVudHMsIFRleHQgZnJhZ21lbnRzLCBOdW1iZXIgZnJhZ21lbnRzLCBTZWxlY3QgZnJhZ21lbnRzIGFuZCBDb2xvciBmcmFnbWVudHMuXG4gICAqXG4gICAqIEBleGFtcGxlIGRvY3VtZW50LmdldFRleHQoJ2Jsb2ctcG9zdC5sYWJlbCcpLmFzSHRtbChsaW5rUmVzb2x2ZXIpLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QubGFiZWxcIlxuICAgKiBAcGFyYW0ge3N0cmluZ30gYWZ0ZXIgLSBhIHN1ZmZpeCB0aGF0IHdpbGwgYmUgYXBwZW5kZWQgdG8gdGhlIHZhbHVlXG4gICAqIEByZXR1cm5zIHtvYmplY3R9IC0gZWl0aGVyIFN0cnVjdHVyZWRUZXh0LCBvciBUZXh0LCBvciBOdW1iZXIsIG9yIFNlbGVjdCwgb3IgQ29sb3IuXG4gICAqL1xuICBnZXRUZXh0OiBmdW5jdGlvbihuYW1lLCBhZnRlcikge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQuYmxvY2tzLm1hcChmdW5jdGlvbihibG9jaykge1xuICAgICAgICBpZihibG9jay50ZXh0KSB7XG4gICAgICAgICAgcmV0dXJuIGJsb2NrLnRleHQgKyAoYWZ0ZXIgPyBhZnRlciA6ICcnKTtcbiAgICAgICAgfVxuICAgICAgfSkuam9pbignXFxuJyk7XG4gICAgfVxuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlRleHQpIHtcbiAgICAgIGlmKGZyYWdtZW50LnZhbHVlKSB7XG4gICAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZSArIChhZnRlciA/IGFmdGVyIDogJycpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5OdW1iZXIpIHtcbiAgICAgIGlmKGZyYWdtZW50LnZhbHVlKSB7XG4gICAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZSArIChhZnRlciA/IGFmdGVyIDogJycpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5TZWxlY3QpIHtcbiAgICAgIGlmKGZyYWdtZW50LnZhbHVlKSB7XG4gICAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZSArIChhZnRlciA/IGFmdGVyIDogJycpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5Db2xvcikge1xuICAgICAgaWYoZnJhZ21lbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICsgKGFmdGVyID8gYWZ0ZXIgOiAnJyk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBTdHJ1Y3R1cmVkVGV4dCBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0U3RydWN0dXJlZFRleHQoJ2Jsb2ctcG9zdC5ib2R5JykuYXNIdG1sKGxpbmtSZXNvbHZlcilcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmJvZHlcIlxuICAgKiBAcmV0dXJucyB7U3RydWN0dXJlZFRleHR9IC0gVGhlIFN0cnVjdHVyZWRUZXh0IGZyYWdtZW50IHRvIG1hbmlwdWxhdGUuXG4gICAqL1xuICBnZXRTdHJ1Y3R1cmVkVGV4dDogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgcmVxdWlyZSgnLi9mcmFnbWVudHMnKS5TdHJ1Y3R1cmVkVGV4dCkge1xuICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgTGluayBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0TGluaygnYmxvZy1wb3N0LmxpbmsnKS51cmwocmVzb2x2ZXIpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5saW5rXCJcbiAgICogQHJldHVybnMge1dlYkxpbmt8RG9jdW1lbnRMaW5rfEltYWdlTGlua30gLSBUaGUgTGluayBmcmFnbWVudCB0byBtYW5pcHVsYXRlLlxuICAgKi9cbiAgZ2V0TGluazogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLldlYkxpbmsgfHxcbiAgICAgICAgZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuRG9jdW1lbnRMaW5rIHx8XG4gICAgICAgIGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkltYWdlTGluaykge1xuICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgTnVtYmVyIGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXROdW1iZXIoJ3Byb2R1Y3QucHJpY2UnKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJwcm9kdWN0LnByaWNlXCJcbiAgICogQHJldHVybnMge251bWJlcn0gLSBUaGUgbnVtYmVyIHZhbHVlIG9mIHRoZSBmcmFnbWVudC5cbiAgICovXG4gIGdldE51bWJlcjogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLk51bWJlcikge1xuICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgQ29sb3IgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAqIEBleGFtcGxlIGRvY3VtZW50LmdldENvbG9yKCdwcm9kdWN0LmNvbG9yJylcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwicHJvZHVjdC5jb2xvclwiXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIHN0cmluZyB2YWx1ZSBvZiB0aGUgQ29sb3IgZnJhZ21lbnQuXG4gICAqL1xuICBnZXRDb2xvcjogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkNvbG9yKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQudmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKiBHZXRzIHRoZSBHZW9Qb2ludCBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICpcbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0R2VvUG9pbnQoJ2Jsb2ctcG9zdC5sb2NhdGlvbicpLmFzSHRtbChsaW5rUmVzb2x2ZXIpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5sb2NhdGlvblwiXG4gICAqIEByZXR1cm5zIHtHZW9Qb2ludH0gLSBUaGUgR2VvUG9pbnQgb2JqZWN0IHRvIG1hbmlwdWxhdGVcbiAgICovXG4gIGdldEdlb1BvaW50OiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZihmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5HZW9Qb2ludCkge1xuICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgR3JvdXAgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAqXG4gICAqIEBleGFtcGxlIGRvY3VtZW50LmdldEdyb3VwKCdwcm9kdWN0LmdhbGxlcnknKS5hc0h0bWwobGlua1Jlc29sdmVyKS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwicHJvZHVjdC5nYWxsZXJ5XCJcbiAgICogQHJldHVybnMge0dyb3VwfSAtIFRoZSBHcm91cCBmcmFnbWVudCB0byBtYW5pcHVsYXRlLlxuICAgKi9cbiAgZ2V0R3JvdXA6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIHJlcXVpcmUoJy4vZnJhZ21lbnRzJykuR3JvdXApIHtcbiAgICAgIHJldHVybiBmcmFnbWVudDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFNob3J0Y3V0IHRvIGdldCB0aGUgSFRNTCBvdXRwdXQgb2YgdGhlIGZyYWdtZW50IGluIHRoZSBjdXJyZW50IGRvY3VtZW50LlxuICAgKiBUaGlzIGlzIHRoZSBzYW1lIGFzIHdyaXRpbmcgZG9jdW1lbnQuZ2V0KGZyYWdtZW50KS5hc0h0bWwobGlua1Jlc29sdmVyKTtcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmJvZHlcIlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaW5rUmVzb2x2ZXJcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgSFRNTCBvdXRwdXRcbiAgICovXG4gIGdldEh0bWw6IGZ1bmN0aW9uKG5hbWUsIGxpbmtSZXNvbHZlcikge1xuICAgIGlmICghaXNGdW5jdGlvbihsaW5rUmVzb2x2ZXIpKSB7XG4gICAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdpdGggdGhlIG9sZCBjdHggYXJndW1lbnRcbiAgICAgIHZhciBjdHggPSBsaW5rUmVzb2x2ZXI7XG4gICAgICBsaW5rUmVzb2x2ZXIgPSBmdW5jdGlvbihkb2MsIGlzQnJva2VuKSB7XG4gICAgICAgIHJldHVybiBjdHgubGlua1Jlc29sdmVyKGN0eCwgZG9jLCBpc0Jyb2tlbik7XG4gICAgICB9O1xuICAgIH1cbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgIGlmKGZyYWdtZW50ICYmIGZyYWdtZW50LmFzSHRtbCkge1xuICAgICAgcmV0dXJuIGZyYWdtZW50LmFzSHRtbChsaW5rUmVzb2x2ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogVHJhbnNmb3JtcyB0aGUgd2hvbGUgZG9jdW1lbnQgYXMgYW4gSFRNTCBvdXRwdXQuIEVhY2ggZnJhZ21lbnQgaXMgc2VwYXJhdGVkIGJ5IGEgJmx0O3NlY3Rpb24mZ3Q7IHRhZyxcbiAgICogd2l0aCB0aGUgYXR0cmlidXRlIGRhdGEtZmllbGQ9XCJuYW1lb2ZmcmFnbWVudFwiXG4gICAqIE5vdGUgdGhhdCBtb3N0IG9mIHRoZSB0aW1lIHlvdSB3aWxsIG5vdCB1c2UgdGhpcyBtZXRob2QsIGJ1dCByZWFkIGZyYWdtZW50IGluZGVwZW5kZW50bHkgYW5kIGdlbmVyYXRlXG4gICAqIEhUTUwgb3V0cHV0IGZvciB7QGxpbmsgU3RydWN0dXJlZFRleHR9IGZyYWdtZW50IHdpdGggdGhhdCBjbGFzcycgYXNIdG1sIG1ldGhvZC5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gbGlua1Jlc29sdmVyXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIEhUTUwgb3V0cHV0XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uKGxpbmtSZXNvbHZlcikge1xuICAgIGlmICghaXNGdW5jdGlvbihsaW5rUmVzb2x2ZXIpKSB7XG4gICAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdpdGggdGhlIG9sZCBjdHggYXJndW1lbnRcbiAgICAgIHZhciBjdHggPSBsaW5rUmVzb2x2ZXI7XG4gICAgICBsaW5rUmVzb2x2ZXIgPSBmdW5jdGlvbihkb2MsIGlzQnJva2VuKSB7XG4gICAgICAgIHJldHVybiBjdHgubGlua1Jlc29sdmVyKGN0eCwgZG9jLCBpc0Jyb2tlbik7XG4gICAgICB9O1xuICAgIH1cbiAgICB2YXIgaHRtbHMgPSBbXTtcbiAgICBmb3IodmFyIGZpZWxkIGluIHRoaXMuZnJhZ21lbnRzKSB7XG4gICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChmaWVsZCk7XG4gICAgICBodG1scy5wdXNoKGZyYWdtZW50ICYmIGZyYWdtZW50LmFzSHRtbCA/ICc8c2VjdGlvbiBkYXRhLWZpZWxkPVwiJyArIGZpZWxkICsgJ1wiPicgKyBmcmFnbWVudC5hc0h0bWwobGlua1Jlc29sdmVyKSArICc8L3NlY3Rpb24+JyA6ICcnKTtcbiAgICB9XG4gICAgcmV0dXJuIGh0bWxzLmpvaW4oJycpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZG9jdW1lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24obGlua1Jlc29sdmVyKSB7XG4gICAgaWYgKCFpc0Z1bmN0aW9uKGxpbmtSZXNvbHZlcikpIHtcbiAgICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgb2xkIGN0eCBhcmd1bWVudFxuICAgICAgdmFyIGN0eCA9IGxpbmtSZXNvbHZlcjtcbiAgICAgIGxpbmtSZXNvbHZlciA9IGZ1bmN0aW9uKGRvYywgaXNCcm9rZW4pIHtcbiAgICAgICAgcmV0dXJuIGN0eC5saW5rUmVzb2x2ZXIoY3R4LCBkb2MsIGlzQnJva2VuKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHZhciB0ZXh0cyA9IFtdO1xuICAgIGZvcih2YXIgZmllbGQgaW4gdGhpcy5mcmFnbWVudHMpIHtcbiAgICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KGZpZWxkKTtcbiAgICAgIHRleHRzLnB1c2goZnJhZ21lbnQgJiYgZnJhZ21lbnQuYXNUZXh0ID8gZnJhZ21lbnQuYXNUZXh0KGxpbmtSZXNvbHZlcikgOiAnJyk7XG4gICAgfVxuICAgIHJldHVybiB0ZXh0cy5qb2luKCcnKTtcbiAgfSxcblxuICAvKipcbiAgICogTGlua2VkIGRvY3VtZW50cywgYXMgYW4gYXJyYXkgb2Yge0BsaW5rIERvY3VtZW50TGlua31cbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgbGlua2VkRG9jdW1lbnRzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaSwgaiwgbGluaztcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgZm9yICh2YXIgZmllbGQgaW4gdGhpcy5kYXRhKSB7XG4gICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChmaWVsZCk7XG4gICAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuRG9jdW1lbnRMaW5rKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGZyYWdtZW50KTtcbiAgICAgIH1cbiAgICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5TdHJ1Y3R1cmVkVGV4dCkge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZnJhZ21lbnQuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIGJsb2NrID0gZnJhZ21lbnQuYmxvY2tzW2ldO1xuICAgICAgICAgIGlmIChibG9jay50eXBlID09IFwiaW1hZ2VcIiAmJiBibG9jay5saW5rVG8pIHtcbiAgICAgICAgICAgIGxpbmsgPSBGcmFnbWVudHMuaW5pdEZpZWxkKGJsb2NrLmxpbmtUbyk7XG4gICAgICAgICAgICBpZiAobGluayBpbnN0YW5jZW9mIEZyYWdtZW50cy5Eb2N1bWVudExpbmspIHtcbiAgICAgICAgICAgICAgcmVzdWx0LnB1c2gobGluayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBzcGFucyA9IGJsb2NrLnNwYW5zIHx8IFtdO1xuICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBzcGFucy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgdmFyIHNwYW4gPSBzcGFuc1tqXTtcbiAgICAgICAgICAgIGlmIChzcGFuLnR5cGUgPT0gXCJoeXBlcmxpbmtcIikge1xuICAgICAgICAgICAgICBsaW5rID0gRnJhZ21lbnRzLmluaXRGaWVsZChzcGFuLmRhdGEpO1xuICAgICAgICAgICAgICBpZiAobGluayBpbnN0YW5jZW9mIEZyYWdtZW50cy5Eb2N1bWVudExpbmspIHtcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChsaW5rKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkdyb3VwKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBmcmFnbWVudC52YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5jb25jYXQoZnJhZ21lbnQudmFsdWVbaV0ubGlua2VkRG9jdW1lbnRzKCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIHRoZSBmcmFnbWVudHMgd2l0aCB0aGUgZ2l2ZW4gZnJhZ21lbnQgbmFtZS5cbiAgICogVGhlIGFycmF5IGlzIG9mdGVuIGEgc2luZ2xlLWVsZW1lbnQgYXJyYXksIGV4cGVjdCB3aGVuIHRoZSBmcmFnbWVudCBpcyBhIG11bHRpcGxlIGZyYWdtZW50LlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2dldEZyYWdtZW50czogZnVuY3Rpb24obmFtZSkge1xuICAgIGlmICghdGhpcy5mcmFnbWVudHMgfHwgIXRoaXMuZnJhZ21lbnRzW25hbWVdKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodGhpcy5mcmFnbWVudHNbbmFtZV0pKSB7XG4gICAgICByZXR1cm4gdGhpcy5mcmFnbWVudHNbbmFtZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBbdGhpcy5mcmFnbWVudHNbbmFtZV1dO1xuICAgIH1cblxuICB9XG5cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBkb2N1bWVudCBhcyByZXR1cm5lZCBieSB0aGUgQVBJLlxuICogTW9zdCB1c2VmdWwgZmllbGRzOiBpZCwgdHlwZSwgdGFncywgc2x1Zywgc2x1Z3NcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIERvY1xuICovXG5mdW5jdGlvbiBEb2N1bWVudChpZCwgdWlkLCB0eXBlLCBocmVmLCB0YWdzLCBzbHVncywgZGF0YSkge1xuICAvKipcbiAgICogVGhlIElEIG9mIHRoZSBkb2N1bWVudFxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgdGhpcy5pZCA9IGlkO1xuICAvKipcbiAgICogVGhlIFVzZXIgSUQgb2YgdGhlIGRvY3VtZW50LCBhIGh1bWFuIHJlYWRhYmxlIGlkXG4gICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICovXG4gIHRoaXMudWlkID0gdWlkO1xuICAvKipcbiAgICogVGhlIHR5cGUgb2YgdGhlIGRvY3VtZW50LCBjb3JyZXNwb25kcyB0byBhIGRvY3VtZW50IG1hc2sgZGVmaW5lZCBpbiB0aGUgcmVwb3NpdG9yeVxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgdGhpcy50eXBlID0gdHlwZTtcbiAgLyoqXG4gICAqIFRoZSBVUkwgb2YgdGhlIGRvY3VtZW50IGluIHRoZSBBUElcbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIHRoaXMuaHJlZiA9IGhyZWY7XG4gIC8qKlxuICAgKiBUaGUgdGFncyBvZiB0aGUgZG9jdW1lbnRcbiAgICogQHR5cGUge2FycmF5fVxuICAgKi9cbiAgdGhpcy50YWdzID0gdGFncztcbiAgLyoqXG4gICAqIFRoZSBjdXJyZW50IHNsdWcgb2YgdGhlIGRvY3VtZW50LCBcIi1cIiBpZiBub25lIHdhcyBwcm92aWRlZFxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgdGhpcy5zbHVnID0gc2x1Z3MgPyBzbHVnc1swXSA6IFwiLVwiO1xuICAvKipcbiAgICogQWxsIHRoZSBzbHVncyB0aGF0IHdlcmUgZXZlciB1c2VkIGJ5IHRoaXMgZG9jdW1lbnQgKGluY2x1ZGluZyB0aGUgY3VycmVudCBvbmUsIGF0IHRoZSBoZWFkKVxuICAgKiBAdHlwZSB7YXJyYXl9XG4gICAqL1xuICB0aGlzLnNsdWdzID0gc2x1Z3M7XG4gIC8qKlxuICAgKiBUaGUgb3JpZ2luYWwgSlNPTiBkYXRhIGZyb20gdGhlIEFQSVxuICAgKi9cbiAgdGhpcy5kYXRhID0gZGF0YTtcbiAgLyoqXG4gICAqIEZyYWdtZW50cywgY29udmVydGVkIHRvIGJ1c2luZXNzIG9iamVjdHNcbiAgICovXG4gIHRoaXMuZnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKS5wYXJzZUZyYWdtZW50cyhkYXRhKTtcbn1cblxuRG9jdW1lbnQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShXaXRoRnJhZ21lbnRzLnByb3RvdHlwZSk7XG5cbi8qKlxuICogR2V0cyB0aGUgU2xpY2Vab25lIGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICpcbiAqIEBleGFtcGxlIGRvY3VtZW50LmdldFNsaWNlWm9uZSgncHJvZHVjdC5nYWxsZXJ5JykuYXNIdG1sKGxpbmtSZXNvbHZlcikuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwicHJvZHVjdC5nYWxsZXJ5XCJcbiAqIEByZXR1cm5zIHtHcm91cH0gLSBUaGUgU2xpY2Vab25lIGZyYWdtZW50IHRvIG1hbmlwdWxhdGUuXG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS5nZXRTbGljZVpvbmUgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIHJlcXVpcmUoJy4vZnJhZ21lbnRzJykuU2xpY2Vab25lKSB7XG4gICAgcmV0dXJuIGZyYWdtZW50O1xuICB9XG4gIHJldHVybiBudWxsO1xufTtcblxuZnVuY3Rpb24gR3JvdXBEb2MoZGF0YSkge1xuICAvKipcbiAgICogVGhlIG9yaWdpbmFsIEpTT04gZGF0YSBmcm9tIHRoZSBBUElcbiAgICovXG4gIHRoaXMuZGF0YSA9IGRhdGE7XG4gIC8qKlxuICAgKiBGcmFnbWVudHMsIGNvbnZlcnRlZCB0byBidXNpbmVzcyBvYmplY3RzXG4gICAqL1xuICB0aGlzLmZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJykucGFyc2VGcmFnbWVudHMoZGF0YSk7XG59XG5cbkdyb3VwRG9jLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoV2l0aEZyYWdtZW50cy5wcm90b3R5cGUpO1xuXG4vLyAtLSBQcml2YXRlIGhlbHBlcnNcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihmKSB7XG4gIHZhciBnZXRUeXBlID0ge307XG4gIHJldHVybiBmICYmIGdldFR5cGUudG9TdHJpbmcuY2FsbChmKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIFdpdGhGcmFnbWVudHM6IFdpdGhGcmFnbWVudHMsXG4gIERvY3VtZW50OiBEb2N1bWVudCxcbiAgR3JvdXBEb2M6IEdyb3VwRG9jXG59O1xuIiwiXG5cInVzZSBzdHJpY3RcIjtcblxuLyoqXG4gKiBBIGNvbGxlY3Rpb24gb2YgZXhwZXJpbWVudHMgY3VycmVudGx5IGF2YWlsYWJsZVxuICogQHBhcmFtIGRhdGEgdGhlIGpzb24gZGF0YSByZWNlaXZlZCBmcm9tIHRoZSBQcmlzbWljIEFQSVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEV4cGVyaW1lbnRzKGRhdGEpIHtcbiAgdmFyIGRyYWZ0cyA9IFtdO1xuICB2YXIgcnVubmluZyA9IFtdO1xuICBpZiAoZGF0YSkge1xuICAgIGRhdGEuZHJhZnRzICYmIGRhdGEuZHJhZnRzLmZvckVhY2goZnVuY3Rpb24gKGV4cCkge1xuICAgICAgZHJhZnRzLnB1c2gobmV3IEV4cGVyaW1lbnQoZXhwKSk7XG4gICAgfSk7XG4gICAgZGF0YS5ydW5uaW5nICYmIGRhdGEucnVubmluZy5mb3JFYWNoKGZ1bmN0aW9uIChleHApIHtcbiAgICAgIHJ1bm5pbmcucHVzaChuZXcgRXhwZXJpbWVudChleHApKTtcbiAgICB9KTtcbiAgfVxuICB0aGlzLmRyYWZ0cyA9IGRyYWZ0cztcbiAgdGhpcy5ydW5uaW5nID0gcnVubmluZztcbn1cblxuRXhwZXJpbWVudHMucHJvdG90eXBlLmN1cnJlbnQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMucnVubmluZy5sZW5ndGggPiAwID8gdGhpcy5ydW5uaW5nWzBdIDogbnVsbDtcbn07XG5cbi8qKlxuICogR2V0IHRoZSBjdXJyZW50IHJ1bm5pbmcgZXhwZXJpbWVudCB2YXJpYXRpb24gcmVmIGZyb20gYSBjb29raWUgY29udGVudFxuICovXG5FeHBlcmltZW50cy5wcm90b3R5cGUucmVmRnJvbUNvb2tpZSA9IGZ1bmN0aW9uKGNvb2tpZSkge1xuICBpZiAoIWNvb2tpZSB8fCBjb29raWUudHJpbSgpID09PSBcIlwiKSByZXR1cm4gbnVsbDtcbiAgdmFyIHNwbGl0dGVkID0gY29va2llLnRyaW0oKS5zcGxpdChcIiBcIik7XG4gIGlmIChzcGxpdHRlZC5sZW5ndGggPCAyKSByZXR1cm4gbnVsbDtcbiAgdmFyIGV4cElkID0gc3BsaXR0ZWRbMF07XG4gIHZhciB2YXJJbmRleCA9IHBhcnNlSW50KHNwbGl0dGVkWzFdLCAxMCk7XG4gIHZhciBleHAgPSB0aGlzLnJ1bm5pbmcuZmlsdGVyKGZ1bmN0aW9uKGV4cCkge1xuICAgIHJldHVybiBleHAuZ29vZ2xlSWQoKSA9PSBleHBJZCAmJiBleHAudmFyaWF0aW9ucy5sZW5ndGggPiB2YXJJbmRleDtcbiAgfSlbMF07XG4gIHJldHVybiBleHAgPyBleHAudmFyaWF0aW9uc1t2YXJJbmRleF0ucmVmKCkgOiBudWxsO1xufTtcblxuZnVuY3Rpb24gRXhwZXJpbWVudChkYXRhKSB7XG4gIHRoaXMuZGF0YSA9IGRhdGE7XG4gIHZhciB2YXJpYXRpb25zID0gW107XG4gIGRhdGEudmFyaWF0aW9ucyAmJiBkYXRhLnZhcmlhdGlvbnMuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgdmFyaWF0aW9ucy5wdXNoKG5ldyBWYXJpYXRpb24odikpO1xuICB9KTtcbiAgdGhpcy52YXJpYXRpb25zID0gdmFyaWF0aW9ucztcbn1cblxuRXhwZXJpbWVudC5wcm90b3R5cGUuaWQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuZGF0YS5pZDtcbn07XG5cbkV4cGVyaW1lbnQucHJvdG90eXBlLmdvb2dsZUlkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLmRhdGEuZ29vZ2xlSWQ7XG59O1xuXG5FeHBlcmltZW50LnByb3RvdHlwZS5uYW1lID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLmRhdGEubmFtZTtcbn07XG5cbmZ1bmN0aW9uIFZhcmlhdGlvbihkYXRhKSB7XG4gIHRoaXMuZGF0YSA9IGRhdGE7XG59XG5cblZhcmlhdGlvbi5wcm90b3R5cGUuaWQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuZGF0YS5pZDtcbn07XG5cblZhcmlhdGlvbi5wcm90b3R5cGUucmVmID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLmRhdGEucmVmO1xufTtcblxuVmFyaWF0aW9uLnByb3RvdHlwZS5sYWJlbCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5kYXRhLmxhYmVsO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIEV4cGVyaW1lbnRzOiBFeHBlcmltZW50cyxcbiAgVmFyaWF0aW9uOiBWYXJpYXRpb25cbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIGRvY3VtZW50cyA9IHJlcXVpcmUoJy4vZG9jdW1lbnRzJyk7XG52YXIgV2l0aEZyYWdtZW50cyA9IGRvY3VtZW50cy5XaXRoRnJhZ21lbnRzLFxuICAgIEdyb3VwRG9jID0gZG9jdW1lbnRzLkdyb3VwRG9jO1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgcGxhaW4gdGV4dCBmcmFnbWVudCAoYmV3YXJlOiBub3QgYSBzdHJ1Y3R1cmVkIHRleHQpXG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6VGV4dFxuICovXG5mdW5jdGlvbiBUZXh0KGRhdGEpIHtcbiAgdGhpcy52YWx1ZSA9IGRhdGE7XG59XG5UZXh0LnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBcIjxzcGFuPlwiICsgdGhpcy52YWx1ZSArIFwiPC9zcGFuPlwiO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWU7XG4gIH1cbn07XG4vKipcbiAqIEVtYm9kaWVzIGEgZG9jdW1lbnQgbGluayBmcmFnbWVudCAoYSBsaW5rIHRoYXQgaXMgaW50ZXJuYWwgdG8gYSBwcmlzbWljLmlvIHJlcG9zaXRvcnkpXG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6RG9jdW1lbnRMaW5rXG4gKi9cbmZ1bmN0aW9uIERvY3VtZW50TGluayhkYXRhKSB7XG4gIHRoaXMudmFsdWUgPSBkYXRhO1xuXG4gIHRoaXMuZG9jdW1lbnQgPSBkYXRhLmRvY3VtZW50O1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgbGlua2VkIGRvY3VtZW50IGlkXG4gICAqL1xuICB0aGlzLmlkID0gZGF0YS5kb2N1bWVudC5pZDtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGxpbmtlZCBkb2N1bWVudCB1aWRcbiAgICovXG4gIHRoaXMudWlkID0gZGF0YS5kb2N1bWVudC51aWQ7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBsaW5rZWQgZG9jdW1lbnQgdGFnc1xuICAgKi9cbiAgdGhpcy50YWdzID0gZGF0YS5kb2N1bWVudC50YWdzO1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgbGlua2VkIGRvY3VtZW50IHNsdWdcbiAgICovXG4gIHRoaXMuc2x1ZyA9IGRhdGEuZG9jdW1lbnQuc2x1ZztcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGxpbmtlZCBkb2N1bWVudCB0eXBlXG4gICAqL1xuICB0aGlzLnR5cGUgPSBkYXRhLmRvY3VtZW50LnR5cGU7XG5cbiAgdmFyIGZyYWdtZW50c0RhdGEgPSB7fTtcbiAgaWYgKGRhdGEuZG9jdW1lbnQuZGF0YSkge1xuICAgIGZvciAodmFyIGZpZWxkIGluIGRhdGEuZG9jdW1lbnQuZGF0YVtkYXRhLmRvY3VtZW50LnR5cGVdKSB7XG4gICAgICBmcmFnbWVudHNEYXRhW2RhdGEuZG9jdW1lbnQudHlwZSArICcuJyArIGZpZWxkXSA9IGRhdGEuZG9jdW1lbnQuZGF0YVtkYXRhLmRvY3VtZW50LnR5cGVdW2ZpZWxkXTtcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGZyYWdtZW50IGxpc3QsIGlmIHRoZSBmZXRjaExpbmtzIHBhcmFtZXRlciB3YXMgdXNlZCBpbiBhdCBxdWVyeSB0aW1lXG4gICAqL1xuICB0aGlzLmZyYWdtZW50cyA9IHBhcnNlRnJhZ21lbnRzKGZyYWdtZW50c0RhdGEpO1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0cnVlIGlmIHRoZSBsaW5rIGlzIGJyb2tlbiwgZmFsc2Ugb3RoZXJ3aXNlXG4gICAqL1xuICB0aGlzLmlzQnJva2VuID0gZGF0YS5pc0Jyb2tlbjtcbn1cblxuRG9jdW1lbnRMaW5rLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoV2l0aEZyYWdtZW50cy5wcm90b3R5cGUpO1xuXG4vKipcbiAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICpcbiAqIEBwYXJhbXMge29iamVjdH0gY3R4IC0gbWFuZGF0b3J5IGN0eCBvYmplY3QsIHdpdGggYSB1c2VhYmxlIGxpbmtSZXNvbHZlciBmdW5jdGlvbiAocGxlYXNlIHJlYWQgcHJpc21pYy5pbyBvbmxpbmUgZG9jdW1lbnRhdGlvbiBhYm91dCB0aGlzKVxuICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICovXG5Eb2N1bWVudExpbmsucHJvdG90eXBlLmFzSHRtbCA9IGZ1bmN0aW9uIChjdHgpIHtcbiAgcmV0dXJuIFwiPGEgaHJlZj1cXFwiXCIrdGhpcy51cmwoY3R4KStcIlxcXCI+XCIrdGhpcy51cmwoY3R4KStcIjwvYT5cIjtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgVVJMIG9mIHRoZSBkb2N1bWVudCBsaW5rLlxuICpcbiAqIEBwYXJhbXMge29iamVjdH0gbGlua1Jlc29sdmVyIC0gbWFuZGF0b3J5IGxpbmtSZXNvbHZlciBmdW5jdGlvbiAocGxlYXNlIHJlYWQgcHJpc21pYy5pbyBvbmxpbmUgZG9jdW1lbnRhdGlvbiBhYm91dCB0aGlzKVxuICogQHJldHVybnMge3N0cmluZ30gLSB0aGUgcHJvcGVyIFVSTCB0byB1c2VcbiAqL1xuRG9jdW1lbnRMaW5rLnByb3RvdHlwZS51cmwgPSBmdW5jdGlvbiAobGlua1Jlc29sdmVyKSB7XG4gIHJldHVybiBsaW5rUmVzb2x2ZXIodGhpcywgdGhpcy5pc0Jyb2tlbik7XG59O1xuXG4vKipcbiAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gKlxuICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gKi9cbkRvY3VtZW50TGluay5wcm90b3R5cGUuYXNUZXh0ID0gZnVuY3Rpb24obGlua1Jlc29sdmVyKSB7XG4gIHJldHVybiB0aGlzLnVybChsaW5rUmVzb2x2ZXIpO1xufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIHdlYiBsaW5rIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6V2ViTGlua1xuICovXG5mdW5jdGlvbiBXZWJMaW5rKGRhdGEpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIEpTT04gb2JqZWN0IGV4YWN0bHkgYXMgaXMgcmV0dXJuZWQgaW4gdGhlIFwiZGF0YVwiIGZpZWxkIG9mIHRoZSBKU09OIHJlc3BvbnNlcyAoc2VlIEFQSSBkb2N1bWVudGF0aW9uOiBodHRwczovL2RldmVsb3BlcnMucHJpc21pYy5pby9kb2N1bWVudGF0aW9uL1VqQmU4YkdJSjNFS3RnQlovYXBpLWRvY3VtZW50YXRpb24janNvbi1yZXNwb25zZXMpXG4gICAqL1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cbldlYkxpbmsucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiPGEgaHJlZj1cXFwiXCIrdGhpcy51cmwoKStcIlxcXCI+XCIrdGhpcy51cmwoKStcIjwvYT5cIjtcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIFVSTCBvZiB0aGUgbGluay5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSB0aGUgcHJvcGVyIFVSTCB0byB1c2VcbiAgICovXG4gIHVybDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWUudXJsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudXJsKCk7XG4gIH1cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBmaWxlIGxpbmsgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpGaWxlTGlua1xuICovXG5mdW5jdGlvbiBGaWxlTGluayhkYXRhKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBKU09OIG9iamVjdCBleGFjdGx5IGFzIGlzIHJldHVybmVkIGluIHRoZSBcImRhdGFcIiBmaWVsZCBvZiB0aGUgSlNPTiByZXNwb25zZXMgKHNlZSBBUEkgZG9jdW1lbnRhdGlvbjogaHR0cHM6Ly9kZXZlbG9wZXJzLnByaXNtaWMuaW8vZG9jdW1lbnRhdGlvbi9VakJlOGJHSUozRUt0Z0JaL2FwaS1kb2N1bWVudGF0aW9uI2pzb24tcmVzcG9uc2VzKVxuICAgKi9cbiAgdGhpcy52YWx1ZSA9IGRhdGE7XG59XG5GaWxlTGluay5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8YSBocmVmPVxcXCJcIit0aGlzLnVybCgpK1wiXFxcIj5cIit0aGlzLnZhbHVlLmZpbGUubmFtZStcIjwvYT5cIjtcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIFVSTCBvZiB0aGUgbGluay5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSB0aGUgcHJvcGVyIFVSTCB0byB1c2VcbiAgICovXG4gIHVybDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWUuZmlsZS51cmw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy51cmwoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhbiBpbWFnZSBsaW5rIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6SW1hZ2VMaW5rXG4gKi9cbmZ1bmN0aW9uIEltYWdlTGluayhkYXRhKSB7XG4gIC8qKlxuICAgKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBKU09OIG9iamVjdCBleGFjdGx5IGFzIGlzIHJldHVybmVkIGluIHRoZSBcImRhdGFcIiBmaWVsZCBvZiB0aGUgSlNPTiByZXNwb25zZXMgKHNlZSBBUEkgZG9jdW1lbnRhdGlvbjogaHR0cHM6Ly9kZXZlbG9wZXJzLnByaXNtaWMuaW8vZG9jdW1lbnRhdGlvbi9VakJlOGJHSUozRUt0Z0JaL2FwaS1kb2N1bWVudGF0aW9uI2pzb24tcmVzcG9uc2VzKVxuICAgKi9cbiAgdGhpcy52YWx1ZSA9IGRhdGE7XG59XG5JbWFnZUxpbmsucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiPGEgaHJlZj1cXFwiXCIrdGhpcy51cmwoKStcIlxcXCI+PGltZyBzcmM9XFxcIlwiK3RoaXMudXJsKCkrXCJcXFwiIGFsdD1cXFwiXCIgKyB0aGlzLmFsdCArIFwiXFxcIj48L2E+XCI7XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBVUkwgb2YgdGhlIGxpbmsuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gdGhlIHByb3BlciBVUkwgdG8gdXNlXG4gICAqL1xuICB1cmw6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlLmltYWdlLnVybDtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnVybCgpO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgc2VsZWN0IGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6U2VsZWN0XG4gKi9cbmZ1bmN0aW9uIFNlbGVjdChkYXRhKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSB0ZXh0IHZhbHVlIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgdGhpcy52YWx1ZSA9IGRhdGE7XG59XG5TZWxlY3QucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiPHNwYW4+XCIgKyB0aGlzLnZhbHVlICsgXCI8L3NwYW4+XCI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIGNvbG9yIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6Q29sb3JcbiAqL1xuZnVuY3Rpb24gQ29sb3IoZGF0YSkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgdGV4dCB2YWx1ZSBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIHRoaXMudmFsdWUgPSBkYXRhO1xufVxuQ29sb3IucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiPHNwYW4+XCIgKyB0aGlzLnZhbHVlICsgXCI8L3NwYW4+XCI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIGdlb3BvaW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6R2VvUG9pbnRcbiAqL1xuZnVuY3Rpb24gR2VvUG9pbnQoZGF0YSkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgbGF0aXR1ZGUgb2YgdGhlIGdlbyBwb2ludFxuICAgKi9cbiAgdGhpcy5sYXRpdHVkZSA9IGRhdGEubGF0aXR1ZGU7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBsb25naXR1ZGUgb2YgdGhlIGdlbyBwb2ludFxuICAgKi9cbiAgdGhpcy5sb25naXR1ZGUgPSBkYXRhLmxvbmdpdHVkZTtcbn1cblxuR2VvUG9pbnQucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICc8ZGl2IGNsYXNzPVwiZ2VvcG9pbnRcIj48c3BhbiBjbGFzcz1cImxhdGl0dWRlXCI+JyArIHRoaXMubGF0aXR1ZGUgKyAnPC9zcGFuPjxzcGFuIGNsYXNzPVwibG9uZ2l0dWRlXCI+JyArIHRoaXMubG9uZ2l0dWRlICsgJzwvc3Bhbj48L2Rpdj4nO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICcoJyArIHRoaXMubGF0aXR1ZGUgKyBcIixcIiArIHRoaXMubG9uZ2l0dWRlICsgJyknO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgTnVtYmVyIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6TnVtXG4gKi9cbmZ1bmN0aW9uIE51bShkYXRhKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBpbnRlZ2VyIHZhbHVlIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgdGhpcy52YWx1ZSA9IGRhdGE7XG59XG5OdW0ucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiPHNwYW4+XCIgKyB0aGlzLnZhbHVlICsgXCI8L3NwYW4+XCI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS50b1N0cmluZygpO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgRGF0ZSBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOkRhdGVcbiAqL1xuZnVuY3Rpb24gRGF0ZUZyYWdtZW50KGRhdGEpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIERhdGUgdmFsdWUgb2YgdGhlIGZyYWdtZW50IChhcyBhIHJlZ3VsYXIgSlMgRGF0ZSBvYmplY3QpXG4gICAqL1xuICB0aGlzLnZhbHVlID0gbmV3IERhdGUoZGF0YSk7XG59XG5cbkRhdGVGcmFnbWVudC5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8dGltZT5cIiArIHRoaXMudmFsdWUgKyBcIjwvdGltZT5cIjtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlLnRvU3RyaW5nKCk7XG4gIH1cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBUaW1lc3RhbXAgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpUaW1lc3RhbXBcbiAqL1xuZnVuY3Rpb24gVGltZXN0YW1wKGRhdGEpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIERhdGUgdmFsdWUgb2YgdGhlIGZyYWdtZW50IChhcyBhIHJlZ3VsYXIgSlMgRGF0ZSBvYmplY3QpXG4gICAqL1xuICAvLyBBZGRpbmcgXCI6XCIgaW4gdGhlIGxvY2FsZSBpZiBuZWVkZWQsIHNvIEpTIGNvbnNpZGVycyBpdCBJU084NjAxLWNvbXBsaWFudFxuICB2YXIgY29ycmVjdElzbzg2MDFEYXRlID0gKGRhdGEubGVuZ3RoID09IDI0KSA/IGRhdGEuc3Vic3RyaW5nKDAsIDIyKSArICc6JyArIGRhdGEuc3Vic3RyaW5nKDIyLCAyNCkgOiBkYXRhO1xuICB0aGlzLnZhbHVlID0gbmV3IERhdGUoY29ycmVjdElzbzg2MDFEYXRlKTtcbn1cblxuVGltZXN0YW1wLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBcIjx0aW1lPlwiICsgdGhpcy52YWx1ZSArIFwiPC90aW1lPlwiO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWUudG9TdHJpbmcoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhbiBlbWJlZCBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOkVtYmVkXG4gKi9cbmZ1bmN0aW9uIEVtYmVkKGRhdGEpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIEpTT04gb2JqZWN0IGV4YWN0bHkgYXMgaXMgcmV0dXJuZWQgaW4gdGhlIFwiZGF0YVwiIGZpZWxkIG9mIHRoZSBKU09OIHJlc3BvbnNlcyAoc2VlIEFQSSBkb2N1bWVudGF0aW9uOiBodHRwczovL2RldmVsb3BlcnMucHJpc21pYy5pby9kb2N1bWVudGF0aW9uL1VqQmU4YkdJSjNFS3RnQlovYXBpLWRvY3VtZW50YXRpb24janNvbi1yZXNwb25zZXMpXG4gICAqL1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cblxuRW1iZWQucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWUub2VtYmVkLmh0bWw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhbiBJbWFnZSBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOkltYWdlRWxcbiAqL1xuZnVuY3Rpb24gSW1hZ2VFbChtYWluLCB2aWV3cykge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgbWFpbiBJbWFnZVZpZXcgZm9yIHRoaXMgaW1hZ2VcbiAgICovXG4gIHRoaXMubWFpbiA9IG1haW47XG5cblxuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgdXJsIG9mIHRoZSBtYWluIEltYWdlVmlldyBmb3IgdGhpcyBpbWFnZVxuICAgKi9cbiAgdGhpcy51cmwgPSBtYWluLnVybDtcblxuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiBhbiBhcnJheSBvZiBhbGwgdGhlIG90aGVyIEltYWdlVmlld3MgZm9yIHRoaXMgaW1hZ2VcbiAgICovXG4gIHRoaXMudmlld3MgPSB2aWV3cyB8fCB7fTtcbn1cbkltYWdlRWwucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogR2V0cyB0aGUgdmlldyBvZiB0aGUgaW1hZ2UsIGZyb20gaXRzIG5hbWVcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSB0aGUgbmFtZSBvZiB0aGUgdmlldyB0byBnZXRcbiAgICogQHJldHVybnMge0ltYWdlVmlld30gLSB0aGUgcHJvcGVyIHZpZXdcbiAgICovXG4gIGdldFZpZXc6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBpZiAobmFtZSA9PT0gXCJtYWluXCIpIHtcbiAgICAgIHJldHVybiB0aGlzLm1haW47XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnZpZXdzW25hbWVdO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLm1haW4uYXNIdG1sKCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhbiBpbWFnZSB2aWV3IChhbiBpbWFnZSBpbiBwcmlzbWljLmlvIGNhbiBiZSBkZWZpbmVkIHdpdGggc2V2ZXJhbCBkaWZmZXJlbnQgdGh1bWJuYWlsIHNpemVzLCBlYWNoIHNpemUgaXMgY2FsbGVkIGEgXCJ2aWV3XCIpXG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6SW1hZ2VWaWV3XG4gKi9cbmZ1bmN0aW9uIEltYWdlVmlldyh1cmwsIHdpZHRoLCBoZWlnaHQsIGFsdCkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgVVJMIG9mIHRoZSBJbWFnZVZpZXcgKHVzZWFibGUgYXMgaXQsIGluIGEgPGltZz4gdGFnIGluIEhUTUwsIGZvciBpbnN0YW5jZSlcbiAgICovXG4gIHRoaXMudXJsID0gdXJsO1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgd2lkdGggb2YgdGhlIEltYWdlVmlld1xuICAgKi9cbiAgdGhpcy53aWR0aCA9IHdpZHRoO1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgaGVpZ2h0IG9mIHRoZSBJbWFnZVZpZXdcbiAgICovXG4gIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgYWx0IHRleHQgZm9yIHRoZSBJbWFnZVZpZXdcbiAgICovXG4gIHRoaXMuYWx0ID0gYWx0O1xufVxuSW1hZ2VWaWV3LnByb3RvdHlwZSA9IHtcbiAgcmF0aW86IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy53aWR0aCAvIHRoaXMuaGVpZ2h0O1xuICB9LFxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiPGltZyBzcmM9XFxcIlwiICsgdGhpcy51cmwgKyBcIlxcXCIgd2lkdGg9XFxcIlwiICsgdGhpcy53aWR0aCArIFwiXFxcIiBoZWlnaHQ9XFxcIlwiICsgdGhpcy5oZWlnaHQgKyBcIlxcXCIgYWx0PVxcXCJcIiArIHRoaXMuYWx0ICsgXCJcXFwiPlwiO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBmcmFnbWVudCBvZiB0eXBlIFwiR3JvdXBcIiAod2hpY2ggaXMgYSBncm91cCBvZiBzdWJmcmFnbWVudHMpXG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6R3JvdXBcbiAqL1xuZnVuY3Rpb24gR3JvdXAoZGF0YSkge1xuICB0aGlzLnZhbHVlID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgIHRoaXMudmFsdWUucHVzaChuZXcgR3JvdXBEb2MoZGF0YVtpXSkpO1xuICB9XG59XG5Hcm91cC5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKiBAcGFyYW1zIHtmdW5jdGlvbn0gbGlua1Jlc29sdmVyIC0gbGlua1Jlc29sdmVyIGZ1bmN0aW9uIChwbGVhc2UgcmVhZCBwcmlzbWljLmlvIG9ubGluZSBkb2N1bWVudGF0aW9uIGFib3V0IHRoaXMpXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24obGlua1Jlc29sdmVyKSB7XG4gICAgdmFyIG91dHB1dCA9IFwiXCI7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvdXRwdXQgKz0gdGhpcy52YWx1ZVtpXS5hc0h0bWwobGlua1Jlc29sdmVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSxcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBHcm91cCBmcmFnbWVudCBpbnRvIGFuIGFycmF5IGluIG9yZGVyIHRvIGFjY2VzcyBpdHMgaXRlbXMgKGdyb3VwcyBvZiBmcmFnbWVudHMpLFxuICAgKiBvciB0byBsb29wIHRocm91Z2ggdGhlbS5cbiAgICogQHBhcmFtcyB7b2JqZWN0fSBjdHggLSBtYW5kYXRvcnkgY3R4IG9iamVjdCwgd2l0aCBhIHVzZWFibGUgbGlua1Jlc29sdmVyIGZ1bmN0aW9uIChwbGVhc2UgcmVhZCBwcmlzbWljLmlvIG9ubGluZSBkb2N1bWVudGF0aW9uIGFib3V0IHRoaXMpXG4gICAqIEByZXR1cm5zIHtBcnJheX0gLSB0aGUgYXJyYXkgb2YgZ3JvdXBzLCBlYWNoIGdyb3VwIGJlaW5nIGEgSlNPTiBvYmplY3Qgd2l0aCBzdWJmcmFnbWVudCBuYW1lIGFzIGtleXMsIGFuZCBzdWJmcmFnbWVudCBhcyB2YWx1ZXNcbiAgICovXG4gIHRvQXJyYXk6IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIHRoaXMudmFsdWU7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbihsaW5rUmVzb2x2ZXIpIHtcbiAgICB2YXIgb3V0cHV0ID0gXCJcIjtcbiAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy52YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgb3V0cHV0ICs9IHRoaXMudmFsdWVbaV0uYXNUZXh0KGxpbmtSZXNvbHZlcikgKyAnXFxuJztcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSxcblxuICBnZXRGaXJzdEltYWdlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy50b0FycmF5KCkucmVkdWNlKGZ1bmN0aW9uKGltYWdlLCBmcmFnbWVudCkge1xuICAgICAgaWYgKGltYWdlKSByZXR1cm4gaW1hZ2U7XG4gICAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0SW1hZ2UoKTtcbiAgICAgIH1cbiAgICB9LCBudWxsKTtcbiAgfSxcblxuICBnZXRGaXJzdFRpdGxlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy50b0FycmF5KCkucmVkdWNlKGZ1bmN0aW9uKHN0LCBmcmFnbWVudCkge1xuICAgICAgaWYgKHN0KSByZXR1cm4gc3Q7XG4gICAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0VGl0bGUoKTtcbiAgICAgIH1cbiAgICB9LCBudWxsKTtcbiAgfSxcblxuICBnZXRGaXJzdFBhcmFncmFwaDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudG9BcnJheSgpLnJlZHVjZShmdW5jdGlvbihzdCwgZnJhZ21lbnQpIHtcbiAgICAgIGlmIChzdCkgcmV0dXJuIHN0O1xuICAgICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBmcmFnbWVudC5nZXRGaXJzdFBhcmFncmFwaCgpO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICB9XG59O1xuXG5cbi8qKlxuICogRW1ib2RpZXMgYSBzdHJ1Y3R1cmVkIHRleHQgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpTdHJ1Y3R1cmVkVGV4dFxuICovXG5mdW5jdGlvbiBTdHJ1Y3R1cmVkVGV4dChibG9ja3MpIHtcblxuICB0aGlzLmJsb2NrcyA9IGJsb2NrcztcblxufVxuXG5TdHJ1Y3R1cmVkVGV4dC5wcm90b3R5cGUgPSB7XG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtvYmplY3R9IHRoZSBmaXJzdCBoZWFkaW5nIGJsb2NrIGluIHRoZSB0ZXh0XG4gICAqL1xuICBnZXRUaXRsZTogZnVuY3Rpb24gKCkge1xuICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgIGlmKGJsb2NrLnR5cGUuaW5kZXhPZignaGVhZGluZycpID09PSAwKSB7XG4gICAgICAgIHJldHVybiBibG9jaztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtvYmplY3R9IHRoZSBmaXJzdCBibG9jayBvZiB0eXBlIHBhcmFncmFwaFxuICAgKi9cbiAgZ2V0Rmlyc3RQYXJhZ3JhcGg6IGZ1bmN0aW9uKCkge1xuICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgIGlmKGJsb2NrLnR5cGUgPT0gJ3BhcmFncmFwaCcpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogQHJldHVybnMge2FycmF5fSBhbGwgcGFyYWdyYXBoc1xuICAgKi9cbiAgZ2V0UGFyYWdyYXBoczogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBhcmFncmFwaHMgPSBbXTtcbiAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGJsb2NrID0gdGhpcy5ibG9ja3NbaV07XG4gICAgICBpZihibG9jay50eXBlID09ICdwYXJhZ3JhcGgnKSB7XG4gICAgICAgIHBhcmFncmFwaHMucHVzaChibG9jayk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwYXJhZ3JhcGhzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7b2JqZWN0fSB0aGUgbnRoIHBhcmFncmFwaFxuICAgKi9cbiAgZ2V0UGFyYWdyYXBoOiBmdW5jdGlvbihuKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0UGFyYWdyYXBocygpW25dO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7b2JqZWN0fVxuICAgKi9cbiAgZ2V0Rmlyc3RJbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgZm9yKHZhciBpPTA7IGk8dGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBibG9jayA9IHRoaXMuYmxvY2tzW2ldO1xuICAgICAgaWYoYmxvY2sudHlwZSA9PSAnaW1hZ2UnKSB7XG4gICAgICAgIHJldHVybiBuZXcgSW1hZ2VWaWV3KFxuICAgICAgICAgIGJsb2NrLnVybCxcbiAgICAgICAgICBibG9jay5kaW1lbnNpb25zLndpZHRoLFxuICAgICAgICAgIGJsb2NrLmRpbWVuc2lvbnMuaGVpZ2h0LFxuICAgICAgICAgIGJsb2NrLmFsdFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICogQHBhcmFtcyB7ZnVuY3Rpb259IGxpbmtSZXNvbHZlciAtIHBsZWFzZSByZWFkIHByaXNtaWMuaW8gb25saW5lIGRvY3VtZW50YXRpb24gYWJvdXQgbGluayByZXNvbHZlcnNcbiAgICogQHBhcmFtcyB7ZnVuY3Rpb259IGh0bWxTZXJpYWxpemVyIG9wdGlvbmFsIEhUTUwgc2VyaWFsaXplciB0byBjdXN0b21pemUgdGhlIG91dHB1dFxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uKGxpbmtSZXNvbHZlciwgaHRtbFNlcmlhbGl6ZXIpIHtcbiAgICB2YXIgYmxvY2tHcm91cHMgPSBbXSxcbiAgICAgICAgYmxvY2tHcm91cCxcbiAgICAgICAgYmxvY2ssXG4gICAgICAgIGh0bWwgPSBbXTtcbiAgICBpZiAoIWlzRnVuY3Rpb24obGlua1Jlc29sdmVyKSkge1xuICAgICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eSB3aXRoIHRoZSBvbGQgY3R4IGFyZ3VtZW50XG4gICAgICB2YXIgY3R4ID0gbGlua1Jlc29sdmVyO1xuICAgICAgbGlua1Jlc29sdmVyID0gZnVuY3Rpb24oZG9jLCBpc0Jyb2tlbikge1xuICAgICAgICByZXR1cm4gY3R4LmxpbmtSZXNvbHZlcihjdHgsIGRvYywgaXNCcm9rZW4pO1xuICAgICAgfTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodGhpcy5ibG9ja3MpKSB7XG5cbiAgICAgIGZvcih2YXIgaT0wOyBpIDwgdGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcblxuICAgICAgICAvLyBSZXNvbHZlIGltYWdlIGxpbmtzXG4gICAgICAgIGlmIChibG9jay50eXBlID09IFwiaW1hZ2VcIiAmJiBibG9jay5saW5rVG8pIHtcbiAgICAgICAgICB2YXIgbGluayA9IGluaXRGaWVsZChibG9jay5saW5rVG8pO1xuICAgICAgICAgIGJsb2NrLmxpbmtVcmwgPSBsaW5rLnVybChsaW5rUmVzb2x2ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGJsb2NrLnR5cGUgIT09IFwibGlzdC1pdGVtXCIgJiYgYmxvY2sudHlwZSAhPT0gXCJvLWxpc3QtaXRlbVwiKSB7XG4gICAgICAgICAgLy8gaXQncyBub3QgYSB0eXBlIHRoYXQgZ3JvdXBzXG4gICAgICAgICAgYmxvY2tHcm91cHMucHVzaChibG9jayk7XG4gICAgICAgICAgYmxvY2tHcm91cCA9IG51bGw7XG4gICAgICAgIH0gZWxzZSBpZiAoIWJsb2NrR3JvdXAgfHwgYmxvY2tHcm91cC50eXBlICE9IChcImdyb3VwLVwiICsgYmxvY2sudHlwZSkpIHtcbiAgICAgICAgICAvLyBpdCdzIGEgbmV3IHR5cGUgb3Igbm8gQmxvY2tHcm91cCB3YXMgc2V0IHNvIGZhclxuICAgICAgICAgIGJsb2NrR3JvdXAgPSB7XG4gICAgICAgICAgICB0eXBlOiBcImdyb3VwLVwiICsgYmxvY2sudHlwZSxcbiAgICAgICAgICAgIGJsb2NrczogW2Jsb2NrXVxuICAgICAgICAgIH07XG4gICAgICAgICAgYmxvY2tHcm91cHMucHVzaChibG9ja0dyb3VwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBpdCdzIHRoZSBzYW1lIHR5cGUgYXMgYmVmb3JlLCBubyB0b3VjaGluZyBibG9ja0dyb3VwXG4gICAgICAgICAgYmxvY2tHcm91cC5ibG9ja3MucHVzaChibG9jayk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIGJsb2NrQ29udGVudCA9IGZ1bmN0aW9uKGJsb2NrKSB7XG4gICAgICAgIHZhciBjb250ZW50ID0gXCJcIjtcbiAgICAgICAgaWYgKGJsb2NrLmJsb2Nrcykge1xuICAgICAgICAgIGJsb2NrLmJsb2Nrcy5mb3JFYWNoKGZ1bmN0aW9uIChibG9jazIpIHtcbiAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50ICsgc2VyaWFsaXplKGJsb2NrMiwgYmxvY2tDb250ZW50KGJsb2NrMiksIGh0bWxTZXJpYWxpemVyKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250ZW50ID0gaW5zZXJ0U3BhbnMoYmxvY2sudGV4dCwgYmxvY2suc3BhbnMsIGxpbmtSZXNvbHZlciwgaHRtbFNlcmlhbGl6ZXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb250ZW50O1xuICAgICAgfTtcblxuICAgICAgYmxvY2tHcm91cHMuZm9yRWFjaChmdW5jdGlvbiAoYmxvY2tHcm91cCkge1xuICAgICAgICBodG1sLnB1c2goc2VyaWFsaXplKGJsb2NrR3JvdXAsIGJsb2NrQ29udGVudChibG9ja0dyb3VwKSwgaHRtbFNlcmlhbGl6ZXIpKTtcbiAgICAgIH0pO1xuXG4gICAgfVxuXG4gICAgcmV0dXJuIGh0bWwuam9pbignJyk7XG5cbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvdXRwdXQgPSBbXTtcbiAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGJsb2NrID0gdGhpcy5ibG9ja3NbaV07XG4gICAgICBpZiAoYmxvY2sudGV4dCkge1xuICAgICAgICBvdXRwdXQucHVzaChibG9jay50ZXh0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dC5qb2luKCcgJyk7XG4gIH1cblxufTtcblxuZnVuY3Rpb24gaHRtbEVzY2FwZShpbnB1dCkge1xuICByZXR1cm4gaW5wdXQgJiYgaW5wdXQucmVwbGFjZSgvJi9nLCBcIiZhbXA7XCIpXG4gICAgLnJlcGxhY2UoLzwvZywgXCImbHQ7XCIpXG4gICAgLnJlcGxhY2UoLz4vZywgXCImZ3Q7XCIpXG4gICAgLnJlcGxhY2UoL1xcbi9nLCBcIjxicj5cIik7XG59XG5cbi8qKlxuICogUGFyc2VzIGEgYmxvY2sgdGhhdCBoYXMgc3BhbnMsIGFuZCBpbnNlcnRzIHRoZSBwcm9wZXIgSFRNTCBjb2RlLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IC0gdGhlIG9yaWdpbmFsIHRleHQgb2YgdGhlIGJsb2NrXG4gKiBAcGFyYW0ge29iamVjdH0gc3BhbnMgLSB0aGUgc3BhbnMgYXMgcmV0dXJuZWQgYnkgdGhlIEFQSVxuICogQHBhcmFtIHtvYmplY3R9IGxpbmtSZXNvbHZlciAtIHRoZSBmdW5jdGlvbiB0byBidWlsZCBsaW5rcyB0aGF0IG1heSBiZSBpbiB0aGUgZnJhZ21lbnQgKHBsZWFzZSByZWFkIHByaXNtaWMuaW8ncyBvbmxpbmUgZG9jdW1lbnRhdGlvbiBhYm91dCB0aGlzKVxuICogQHBhcmFtIHtmdW5jdGlvbn0gaHRtbFNlcmlhbGl6ZXIgLSBvcHRpb25hbCBzZXJpYWxpemVyXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIHRoZSBIVE1MIG91dHB1dFxuICovXG5mdW5jdGlvbiBpbnNlcnRTcGFucyh0ZXh0LCBzcGFucywgbGlua1Jlc29sdmVyLCBodG1sU2VyaWFsaXplcikge1xuICBpZiAoIXNwYW5zIHx8ICFzcGFucy5sZW5ndGgpIHtcbiAgICByZXR1cm4gaHRtbEVzY2FwZSh0ZXh0KTtcbiAgfVxuXG4gIHZhciB0YWdzU3RhcnQgPSB7fTtcbiAgdmFyIHRhZ3NFbmQgPSB7fTtcblxuICBzcGFucy5mb3JFYWNoKGZ1bmN0aW9uIChzcGFuKSB7XG4gICAgaWYgKCF0YWdzU3RhcnRbc3Bhbi5zdGFydF0pIHsgdGFnc1N0YXJ0W3NwYW4uc3RhcnRdID0gW107IH1cbiAgICBpZiAoIXRhZ3NFbmRbc3Bhbi5lbmRdKSB7IHRhZ3NFbmRbc3Bhbi5lbmRdID0gW107IH1cblxuICAgIHRhZ3NTdGFydFtzcGFuLnN0YXJ0XS5wdXNoKHNwYW4pO1xuICAgIHRhZ3NFbmRbc3Bhbi5lbmRdLnVuc2hpZnQoc3Bhbik7XG4gIH0pO1xuXG4gIHZhciBjO1xuICB2YXIgaHRtbCA9IFwiXCI7XG4gIHZhciBzdGFjayA9IFtdO1xuICBmb3IgKHZhciBwb3MgPSAwLCBsZW4gPSB0ZXh0Lmxlbmd0aCArIDE7IHBvcyA8IGxlbjsgcG9zKyspIHsgLy8gTG9vcGluZyB0byBsZW5ndGggKyAxIHRvIGNhdGNoIGNsb3NpbmcgdGFnc1xuICAgIGlmICh0YWdzRW5kW3Bvc10pIHtcbiAgICAgIHRhZ3NFbmRbcG9zXS5mb3JFYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gQ2xvc2UgYSB0YWdcbiAgICAgICAgdmFyIHRhZyA9IHN0YWNrLnBvcCgpO1xuICAgICAgICAvLyBDb250aW51ZSBvbmx5IGlmIGJsb2NrIGNvbnRhaW5zIGNvbnRlbnQuXG4gICAgICAgIGlmICh0eXBlb2YgdGFnICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHZhciBpbm5lckh0bWwgPSBzZXJpYWxpemUodGFnLnNwYW4sIHRhZy50ZXh0LCBodG1sU2VyaWFsaXplcik7XG4gICAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgLy8gVGhlIHRhZyB3YXMgdG9wIGxldmVsXG4gICAgICAgICAgICBodG1sICs9IGlubmVySHRtbDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQWRkIHRoZSBjb250ZW50IHRvIHRoZSBwYXJlbnQgdGFnXG4gICAgICAgICAgICBzdGFja1tzdGFjay5sZW5ndGggLSAxXS50ZXh0ICs9IGlubmVySHRtbDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAodGFnc1N0YXJ0W3Bvc10pIHtcbiAgICAgIC8vIFNvcnQgYmlnZ2VyIHRhZ3MgZmlyc3QgdG8gZW5zdXJlIHRoZSByaWdodCB0YWcgaGllcmFyY2h5XG4gICAgICB0YWdzU3RhcnRbcG9zXS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiAoYi5lbmQgLSBiLnN0YXJ0KSAtIChhLmVuZCAtIGEuc3RhcnQpO1xuICAgICAgfSk7XG4gICAgICB0YWdzU3RhcnRbcG9zXS5mb3JFYWNoKGZ1bmN0aW9uIChzcGFuKSB7XG4gICAgICAgIC8vIE9wZW4gYSB0YWdcbiAgICAgICAgdmFyIHVybCA9IG51bGw7XG4gICAgICAgIGlmIChzcGFuLnR5cGUgPT0gXCJoeXBlcmxpbmtcIikge1xuICAgICAgICAgIHZhciBmcmFnbWVudCA9IGluaXRGaWVsZChzcGFuLmRhdGEpO1xuICAgICAgICAgIGlmIChmcmFnbWVudCkge1xuICAgICAgICAgICAgdXJsID0gZnJhZ21lbnQudXJsKGxpbmtSZXNvbHZlcik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChjb25zb2xlICYmIGNvbnNvbGUuZXJyb3IpIGNvbnNvbGUuZXJyb3IoJ0ltcG9zc2libGUgdG8gY29udmVydCBzcGFuLmRhdGEgYXMgYSBGcmFnbWVudCcsIHNwYW4pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzcGFuLnVybCA9IHVybDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZWx0ID0ge1xuICAgICAgICAgIHNwYW46IHNwYW4sXG4gICAgICAgICAgdGV4dDogXCJcIlxuICAgICAgICB9O1xuICAgICAgICBzdGFjay5wdXNoKGVsdCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKHBvcyA8IHRleHQubGVuZ3RoKSB7XG4gICAgICBjID0gdGV4dFtwb3NdO1xuICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBUb3AtbGV2ZWwgdGV4dFxuICAgICAgICBodG1sICs9IGh0bWxFc2NhcGUoYyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJbm5lciB0ZXh0IG9mIGEgc3BhblxuICAgICAgICBzdGFja1tzdGFjay5sZW5ndGggLSAxXS50ZXh0ICs9IGh0bWxFc2NhcGUoYyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGh0bWw7XG59XG5cbi8qKlxuICogRW1ib2RpZXMgYSBTbGljZSBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOlNsaWNlXG4gKi9cbmZ1bmN0aW9uIFNsaWNlKHNsaWNlVHlwZSwgbGFiZWwsIHZhbHVlKSB7XG4gIHRoaXMuc2xpY2VUeXBlID0gc2xpY2VUeXBlO1xuICB0aGlzLmxhYmVsID0gbGFiZWw7XG4gIHRoaXMudmFsdWUgPSB2YWx1ZTtcbn1cblxuU2xpY2UucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAobGlua1Jlc29sdmVyKSB7XG4gICAgdmFyIGNsYXNzZXMgPSBbJ3NsaWNlJ107XG4gICAgaWYgKHRoaXMubGFiZWwpIGNsYXNzZXMucHVzaCh0aGlzLmxhYmVsKTtcbiAgICByZXR1cm4gJzxkaXYgZGF0YS1zbGljZXR5cGU9XCInICsgdGhpcy5zbGljZVR5cGUgKyAnXCIgY2xhc3M9XCInICsgY2xhc3Nlcy5qb2luKCcgJykgKyAnXCI+JyArXG4gICAgICB0aGlzLnZhbHVlLmFzSHRtbChsaW5rUmVzb2x2ZXIpICtcbiAgICAgICc8L2Rpdj4nO1xuXG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS5hc1RleHQoKTtcbiAgfSxcblxuICAvKipcbiAgICogR2V0IHRoZSBmaXJzdCBJbWFnZSBpbiBzbGljZS5cbiAgICogQHJldHVybnMge29iamVjdH1cbiAgICovXG4gIGdldEZpcnN0SW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMudmFsdWU7XG4gICAgaWYodHlwZW9mIGZyYWdtZW50LmdldEZpcnN0SW1hZ2UgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0SW1hZ2UoKTtcbiAgICB9IGVsc2UgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgSW1hZ2VFbCkge1xuICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgIH0gZWxzZSByZXR1cm4gbnVsbDtcbiAgfSxcblxuICBnZXRGaXJzdFRpdGxlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLnZhbHVlO1xuICAgIGlmKHR5cGVvZiBmcmFnbWVudC5nZXRGaXJzdFRpdGxlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC5nZXRGaXJzdFRpdGxlKCk7XG4gICAgfSBlbHNlIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIFN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0VGl0bGUoKTtcbiAgICB9IGVsc2UgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgZ2V0Rmlyc3RQYXJhZ3JhcGg6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMudmFsdWU7XG4gICAgaWYodHlwZW9mIGZyYWdtZW50LmdldEZpcnN0UGFyYWdyYXBoID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC5nZXRGaXJzdFBhcmFncmFwaCgpO1xuICAgIH0gZWxzZSByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIFNsaWNlWm9uZSBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOlNsaWNlWm9uZVxuICovXG5mdW5jdGlvbiBTbGljZVpvbmUoZGF0YSkge1xuICB0aGlzLnZhbHVlID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgIHZhciBzbGljZVR5cGUgPSBkYXRhW2ldWydzbGljZV90eXBlJ107XG4gICAgdmFyIGZyYWdtZW50ID0gaW5pdEZpZWxkKGRhdGFbaV1bJ3ZhbHVlJ10pO1xuICAgIHZhciBsYWJlbCA9IGRhdGFbaV1bJ3NsaWNlX2xhYmVsJ10gfHwgbnVsbDtcbiAgICBpZiAoc2xpY2VUeXBlICYmIGZyYWdtZW50KSB7XG4gICAgICB0aGlzLnZhbHVlLnB1c2gobmV3IFNsaWNlKHNsaWNlVHlwZSwgbGFiZWwsIGZyYWdtZW50KSk7XG4gICAgfVxuICB9XG4gIHRoaXMuc2xpY2VzID0gdGhpcy52YWx1ZTtcbn1cblxuU2xpY2Vab25lLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24gKGxpbmtSZXNvbHZlcikge1xuICAgIHZhciBvdXRwdXQgPSBcIlwiO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy52YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgb3V0cHV0ICs9IHRoaXMudmFsdWVbaV0uYXNIdG1sKGxpbmtSZXNvbHZlcik7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgb3V0cHV0ID0gXCJcIjtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgIG91dHB1dCArPSB0aGlzLnZhbHVlW2ldLmFzVGV4dCgpICsgJ1xcbic7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0sXG5cbiAgZ2V0Rmlyc3RJbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWUucmVkdWNlKGZ1bmN0aW9uKGltYWdlLCBzbGljZSkge1xuICAgICAgaWYgKGltYWdlKSByZXR1cm4gaW1hZ2U7XG4gICAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHNsaWNlLmdldEZpcnN0SW1hZ2UoKTtcbiAgICAgIH1cbiAgICB9LCBudWxsKTtcbiAgfSxcblxuICBnZXRGaXJzdFRpdGxlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS5yZWR1Y2UoZnVuY3Rpb24odGV4dCwgc2xpY2UpIHtcbiAgICAgIGlmICh0ZXh0KSByZXR1cm4gdGV4dDtcbiAgICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gc2xpY2UuZ2V0Rmlyc3RUaXRsZSgpO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICB9LFxuXG4gIGdldEZpcnN0UGFyYWdyYXBoOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS5yZWR1Y2UoZnVuY3Rpb24ocGFyYWdyYXBoLCBzbGljZSkge1xuICAgICAgaWYgKHBhcmFncmFwaCkgcmV0dXJuIHBhcmFncmFwaDtcbiAgICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gc2xpY2UuZ2V0Rmlyc3RQYXJhZ3JhcGgoKTtcbiAgICAgIH1cbiAgICB9LCBudWxsKTtcbiAgfVxufTtcblxuLyoqXG4gKiBGcm9tIGEgZnJhZ21lbnQncyBuYW1lLCBjYXN0cyBpdCBpbnRvIHRoZSBwcm9wZXIgb2JqZWN0IHR5cGUgKGxpa2UgUHJpc21pYy5GcmFnbWVudHMuU3RydWN0dXJlZFRleHQpXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZCAtIHRoZSBmcmFnbWVudCdzIG5hbWVcbiAqIEByZXR1cm5zIHtvYmplY3R9IC0gdGhlIG9iamVjdCBvZiB0aGUgcHJvcGVyIEZyYWdtZW50cyB0eXBlLlxuICovXG5mdW5jdGlvbiBpbml0RmllbGQoZmllbGQpIHtcblxuICB2YXIgY2xhc3NGb3JUeXBlID0ge1xuICAgIFwiQ29sb3JcIjogQ29sb3IsXG4gICAgXCJOdW1iZXJcIjogTnVtLFxuICAgIFwiRGF0ZVwiOiBEYXRlRnJhZ21lbnQsXG4gICAgXCJUaW1lc3RhbXBcIjogVGltZXN0YW1wLFxuICAgIFwiVGV4dFwiOiBUZXh0LFxuICAgIFwiRW1iZWRcIjogRW1iZWQsXG4gICAgXCJHZW9Qb2ludFwiOiBHZW9Qb2ludCxcbiAgICBcIlNlbGVjdFwiOiBTZWxlY3QsXG4gICAgXCJTdHJ1Y3R1cmVkVGV4dFwiOiBTdHJ1Y3R1cmVkVGV4dCxcbiAgICBcIkxpbmsuZG9jdW1lbnRcIjogRG9jdW1lbnRMaW5rLFxuICAgIFwiTGluay53ZWJcIjogV2ViTGluayxcbiAgICBcIkxpbmsuZmlsZVwiOiBGaWxlTGluayxcbiAgICBcIkxpbmsuaW1hZ2VcIjogSW1hZ2VMaW5rLFxuICAgIFwiR3JvdXBcIjogR3JvdXAsXG4gICAgXCJTbGljZVpvbmVcIjogU2xpY2Vab25lXG4gIH07XG5cbiAgaWYgKGNsYXNzRm9yVHlwZVtmaWVsZC50eXBlXSkge1xuICAgIHJldHVybiBuZXcgY2xhc3NGb3JUeXBlW2ZpZWxkLnR5cGVdKGZpZWxkLnZhbHVlKTtcbiAgfVxuXG4gIGlmIChmaWVsZC50eXBlID09PSBcIkltYWdlXCIpIHtcbiAgICB2YXIgaW1nID0gZmllbGQudmFsdWUubWFpbjtcbiAgICB2YXIgb3V0cHV0ID0gbmV3IEltYWdlRWwoXG4gICAgICBuZXcgSW1hZ2VWaWV3KFxuICAgICAgICBpbWcudXJsLFxuICAgICAgICBpbWcuZGltZW5zaW9ucy53aWR0aCxcbiAgICAgICAgaW1nLmRpbWVuc2lvbnMuaGVpZ2h0LFxuICAgICAgICBpbWcuYWx0XG4gICAgICApLFxuICAgICAge31cbiAgICApO1xuICAgIGZvciAodmFyIG5hbWUgaW4gZmllbGQudmFsdWUudmlld3MpIHtcbiAgICAgIGltZyA9IGZpZWxkLnZhbHVlLnZpZXdzW25hbWVdO1xuICAgICAgb3V0cHV0LnZpZXdzW25hbWVdID0gbmV3IEltYWdlVmlldyhcbiAgICAgICAgaW1nLnVybCxcbiAgICAgICAgaW1nLmRpbWVuc2lvbnMud2lkdGgsXG4gICAgICAgIGltZy5kaW1lbnNpb25zLmhlaWdodCxcbiAgICAgICAgaW1nLmFsdFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuXG4gIGlmIChjb25zb2xlICYmIGNvbnNvbGUubG9nKSBjb25zb2xlLmxvZyhcIkZyYWdtZW50IHR5cGUgbm90IHN1cHBvcnRlZDogXCIsIGZpZWxkLnR5cGUpO1xuICByZXR1cm4gbnVsbDtcblxufVxuXG5mdW5jdGlvbiBwYXJzZUZyYWdtZW50cyhqc29uKSB7XG4gIHZhciByZXN1bHQgPSB7fTtcbiAgZm9yICh2YXIga2V5IGluIGpzb24pIHtcbiAgICBpZiAoanNvbi5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShqc29uW2tleV0pKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0ganNvbltrZXldLm1hcChmdW5jdGlvbiAoZnJhZ21lbnQpIHtcbiAgICAgICAgICByZXR1cm4gaW5pdEZpZWxkKGZyYWdtZW50KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHRba2V5XSA9IGluaXRGaWVsZChqc29uW2tleV0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oZikge1xuICB2YXIgZ2V0VHlwZSA9IHt9O1xuICByZXR1cm4gZiAmJiBnZXRUeXBlLnRvU3RyaW5nLmNhbGwoZikgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZShlbGVtZW50LCBjb250ZW50LCBodG1sU2VyaWFsaXplcikge1xuICAvLyBSZXR1cm4gdGhlIHVzZXIgY3VzdG9taXplZCBvdXRwdXQgKGlmIGF2YWlsYWJsZSlcbiAgaWYgKGh0bWxTZXJpYWxpemVyKSB7XG4gICAgdmFyIGN1c3RvbSA9IGh0bWxTZXJpYWxpemVyKGVsZW1lbnQsIGNvbnRlbnQpO1xuICAgIGlmIChjdXN0b20pIHtcbiAgICAgIHJldHVybiBjdXN0b207XG4gICAgfVxuICB9XG5cbiAgLy8gRmFsbCBiYWNrIHRvIHRoZSBkZWZhdWx0IEhUTUwgb3V0cHV0XG4gIHZhciBUQUdfTkFNRVMgPSB7XG4gICAgXCJoZWFkaW5nMVwiOiBcImgxXCIsXG4gICAgXCJoZWFkaW5nMlwiOiBcImgyXCIsXG4gICAgXCJoZWFkaW5nM1wiOiBcImgzXCIsXG4gICAgXCJoZWFkaW5nNFwiOiBcImg0XCIsXG4gICAgXCJoZWFkaW5nNVwiOiBcImg1XCIsXG4gICAgXCJoZWFkaW5nNlwiOiBcImg2XCIsXG4gICAgXCJwYXJhZ3JhcGhcIjogXCJwXCIsXG4gICAgXCJwcmVmb3JtYXR0ZWRcIjogXCJwcmVcIixcbiAgICBcImxpc3QtaXRlbVwiOiBcImxpXCIsXG4gICAgXCJvLWxpc3QtaXRlbVwiOiBcImxpXCIsXG4gICAgXCJncm91cC1saXN0LWl0ZW1cIjogXCJ1bFwiLFxuICAgIFwiZ3JvdXAtby1saXN0LWl0ZW1cIjogXCJvbFwiLFxuICAgIFwic3Ryb25nXCI6IFwic3Ryb25nXCIsXG4gICAgXCJlbVwiOiBcImVtXCJcbiAgfTtcblxuICBpZiAoVEFHX05BTUVTW2VsZW1lbnQudHlwZV0pIHtcbiAgICB2YXIgbmFtZSA9IFRBR19OQU1FU1tlbGVtZW50LnR5cGVdO1xuICAgIHZhciBjbGFzc0NvZGUgPSBlbGVtZW50LmxhYmVsID8gKCcgY2xhc3M9XCInICsgZWxlbWVudC5sYWJlbCArICdcIicpIDogJyc7XG4gICAgcmV0dXJuICc8JyArIG5hbWUgKyBjbGFzc0NvZGUgKyAnPicgKyBjb250ZW50ICsgJzwvJyArIG5hbWUgKyAnPic7XG4gIH1cblxuICBpZiAoZWxlbWVudC50eXBlID09IFwiaW1hZ2VcIikge1xuICAgIHZhciBsYWJlbCA9IGVsZW1lbnQubGFiZWwgPyAoXCIgXCIgKyBlbGVtZW50LmxhYmVsKSA6IFwiXCI7XG4gICAgdmFyIGltZ1RhZyA9ICc8aW1nIHNyYz1cIicgKyBlbGVtZW50LnVybCArICdcIiBhbHQ9XCInICsgZWxlbWVudC5hbHQgKyAnXCI+JztcbiAgICByZXR1cm4gJzxwIGNsYXNzPVwiYmxvY2staW1nJyArIGxhYmVsICsgJ1wiPicgK1xuICAgICAgKGVsZW1lbnQubGlua1VybCA/ICgnPGEgaHJlZj1cIicgKyBlbGVtZW50LmxpbmtVcmwgKyAnXCI+JyArIGltZ1RhZyArICc8L2E+JykgOiBpbWdUYWcpICtcbiAgICAgICc8L3A+JztcbiAgfVxuXG4gIGlmIChlbGVtZW50LnR5cGUgPT0gXCJlbWJlZFwiKSB7XG4gICAgcmV0dXJuICc8ZGl2IGRhdGEtb2VtYmVkPVwiJysgZWxlbWVudC5lbWJlZF91cmwgK1xuICAgICAgJ1wiIGRhdGEtb2VtYmVkLXR5cGU9XCInKyBlbGVtZW50LnR5cGUgK1xuICAgICAgJ1wiIGRhdGEtb2VtYmVkLXByb3ZpZGVyPVwiJysgZWxlbWVudC5wcm92aWRlcl9uYW1lICtcbiAgICAgIChlbGVtZW50LmxhYmVsID8gKCdcIiBjbGFzcz1cIicgKyBlbGVtZW50LmxhYmVsKSA6ICcnKSArXG4gICAgICAnXCI+JyArIGVsZW1lbnQub2VtYmVkLmh0bWwrXCI8L2Rpdj5cIjtcbiAgfVxuXG4gIGlmIChlbGVtZW50LnR5cGUgPT09ICdoeXBlcmxpbmsnKSB7XG4gICAgcmV0dXJuICc8YSBocmVmPVwiJyArIGVsZW1lbnQudXJsICsgJ1wiPicgKyBjb250ZW50ICsgJzwvYT4nO1xuICB9XG5cbiAgaWYgKGVsZW1lbnQudHlwZSA9PT0gJ2xhYmVsJykge1xuICAgIHJldHVybiAnPHNwYW4gY2xhc3M9XCInICsgZWxlbWVudC5kYXRhLmxhYmVsICsgJ1wiPicgKyBjb250ZW50ICsgJzwvc3Bhbj4nO1xuICB9XG5cbiAgcmV0dXJuIFwiPCEtLSBXYXJuaW5nOiBcIiArIGVsZW1lbnQudHlwZSArIFwiIG5vdCBpbXBsZW1lbnRlZC4gVXBncmFkZSB0aGUgRGV2ZWxvcGVyIEtpdC4gLS0+XCIgKyBjb250ZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgRW1iZWQ6IEVtYmVkLFxuICBJbWFnZTogSW1hZ2VFbCxcbiAgSW1hZ2VWaWV3OiBJbWFnZVZpZXcsXG4gIFRleHQ6IFRleHQsXG4gIE51bWJlcjogTnVtLFxuICBEYXRlOiBEYXRlRnJhZ21lbnQsXG4gIFRpbWVzdGFtcDogVGltZXN0YW1wLFxuICBTZWxlY3Q6IFNlbGVjdCxcbiAgQ29sb3I6IENvbG9yLFxuICBTdHJ1Y3R1cmVkVGV4dDogU3RydWN0dXJlZFRleHQsXG4gIFdlYkxpbms6IFdlYkxpbmssXG4gIERvY3VtZW50TGluazogRG9jdW1lbnRMaW5rLFxuICBJbWFnZUxpbms6IEltYWdlTGluayxcbiAgRmlsZUxpbms6IEZpbGVMaW5rLFxuICBHcm91cDogR3JvdXAsXG4gIEdlb1BvaW50OiBHZW9Qb2ludCxcbiAgU2xpY2U6IFNsaWNlLFxuICBTbGljZVpvbmU6IFNsaWNlWm9uZSxcbiAgaW5pdEZpZWxkOiBpbml0RmllbGQsXG4gIHBhcnNlRnJhZ21lbnRzOiBwYXJzZUZyYWdtZW50cyxcbiAgaW5zZXJ0U3BhbnM6IGluc2VydFNwYW5zXG59O1xuIiwiXG4vKipcbiAqIEEgZG91Ymx5IGxpbmtlZCBsaXN0LWJhc2VkIExlYXN0IFJlY2VudGx5IFVzZWQgKExSVSkgY2FjaGUuIFdpbGwga2VlcCBtb3N0XG4gKiByZWNlbnRseSB1c2VkIGl0ZW1zIHdoaWxlIGRpc2NhcmRpbmcgbGVhc3QgcmVjZW50bHkgdXNlZCBpdGVtcyB3aGVuIGl0cyBsaW1pdFxuICogaXMgcmVhY2hlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciBNSVQuIENvcHlyaWdodCAoYykgMjAxMCBSYXNtdXMgQW5kZXJzc29uIDxodHRwOi8vaHVuY2guc2UvPlxuICogU2VlIFJFQURNRS5tZCBmb3IgZGV0YWlscy5cbiAqXG4gKiBJbGx1c3RyYXRpb24gb2YgdGhlIGRlc2lnbjpcbiAqXG4gKiAgICAgICBlbnRyeSAgICAgICAgICAgICBlbnRyeSAgICAgICAgICAgICBlbnRyeSAgICAgICAgICAgICBlbnRyeVxuICogICAgICAgX19fX19fICAgICAgICAgICAgX19fX19fICAgICAgICAgICAgX19fX19fICAgICAgICAgICAgX19fX19fXG4gKiAgICAgIHwgaGVhZCB8Lm5ld2VyID0+IHwgICAgICB8Lm5ld2VyID0+IHwgICAgICB8Lm5ld2VyID0+IHwgdGFpbCB8XG4gKiAgICAgIHwgIEEgICB8ICAgICAgICAgIHwgIEIgICB8ICAgICAgICAgIHwgIEMgICB8ICAgICAgICAgIHwgIEQgICB8XG4gKiAgICAgIHxfX19fX198IDw9IG9sZGVyLnxfX19fX198IDw9IG9sZGVyLnxfX19fX198IDw9IG9sZGVyLnxfX19fX198XG4gKlxuICogIHJlbW92ZWQgIDwtLSAgPC0tICA8LS0gIDwtLSAgPC0tICA8LS0gIDwtLSAgPC0tICA8LS0gIDwtLSAgPC0tICBhZGRlZFxuICovXG5mdW5jdGlvbiBMUlVDYWNoZSAobGltaXQpIHtcbiAgLy8gQ3VycmVudCBzaXplIG9mIHRoZSBjYWNoZS4gKFJlYWQtb25seSkuXG4gIHRoaXMuc2l6ZSA9IDA7XG4gIC8vIE1heGltdW0gbnVtYmVyIG9mIGl0ZW1zIHRoaXMgY2FjaGUgY2FuIGhvbGQuXG4gIHRoaXMubGltaXQgPSBsaW1pdDtcbiAgdGhpcy5fa2V5bWFwID0ge307XG59XG5cbi8qKlxuICogUHV0IDx2YWx1ZT4gaW50byB0aGUgY2FjaGUgYXNzb2NpYXRlZCB3aXRoIDxrZXk+LiBSZXR1cm5zIHRoZSBlbnRyeSB3aGljaCB3YXNcbiAqIHJlbW92ZWQgdG8gbWFrZSByb29tIGZvciB0aGUgbmV3IGVudHJ5LiBPdGhlcndpc2UgdW5kZWZpbmVkIGlzIHJldHVybmVkXG4gKiAoaS5lLiBpZiB0aGVyZSB3YXMgZW5vdWdoIHJvb20gYWxyZWFkeSkuXG4gKi9cbkxSVUNhY2hlLnByb3RvdHlwZS5wdXQgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gIHZhciBlbnRyeSA9IHtrZXk6a2V5LCB2YWx1ZTp2YWx1ZX07XG4gIC8vIE5vdGU6IE5vIHByb3RlY3Rpb24gYWdhaW5zIHJlcGxhY2luZywgYW5kIHRodXMgb3JwaGFuIGVudHJpZXMuIEJ5IGRlc2lnbi5cbiAgdGhpcy5fa2V5bWFwW2tleV0gPSBlbnRyeTtcbiAgaWYgKHRoaXMudGFpbCkge1xuICAgIC8vIGxpbmsgcHJldmlvdXMgdGFpbCB0byB0aGUgbmV3IHRhaWwgKGVudHJ5KVxuICAgIHRoaXMudGFpbC5uZXdlciA9IGVudHJ5O1xuICAgIGVudHJ5Lm9sZGVyID0gdGhpcy50YWlsO1xuICB9IGVsc2Uge1xuICAgIC8vIHdlJ3JlIGZpcnN0IGluIC0tIHlheVxuICAgIHRoaXMuaGVhZCA9IGVudHJ5O1xuICB9XG4gIC8vIGFkZCBuZXcgZW50cnkgdG8gdGhlIGVuZCBvZiB0aGUgbGlua2VkIGxpc3QgLS0gaXQncyBub3cgdGhlIGZyZXNoZXN0IGVudHJ5LlxuICB0aGlzLnRhaWwgPSBlbnRyeTtcbiAgaWYgKHRoaXMuc2l6ZSA9PT0gdGhpcy5saW1pdCkge1xuICAgIC8vIHdlIGhpdCB0aGUgbGltaXQgLS0gcmVtb3ZlIHRoZSBoZWFkXG4gICAgcmV0dXJuIHRoaXMuc2hpZnQoKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBpbmNyZWFzZSB0aGUgc2l6ZSBjb3VudGVyXG4gICAgdGhpcy5zaXplKys7XG4gIH1cbn07XG5cbi8qKlxuICogUHVyZ2UgdGhlIGxlYXN0IHJlY2VudGx5IHVzZWQgKG9sZGVzdCkgZW50cnkgZnJvbSB0aGUgY2FjaGUuIFJldHVybnMgdGhlXG4gKiByZW1vdmVkIGVudHJ5IG9yIHVuZGVmaW5lZCBpZiB0aGUgY2FjaGUgd2FzIGVtcHR5LlxuICpcbiAqIElmIHlvdSBuZWVkIHRvIHBlcmZvcm0gYW55IGZvcm0gb2YgZmluYWxpemF0aW9uIG9mIHB1cmdlZCBpdGVtcywgdGhpcyBpcyBhXG4gKiBnb29kIHBsYWNlIHRvIGRvIGl0LiBTaW1wbHkgb3ZlcnJpZGUvcmVwbGFjZSB0aGlzIGZ1bmN0aW9uOlxuICpcbiAqICAgdmFyIGMgPSBuZXcgTFJVQ2FjaGUoMTIzKTtcbiAqICAgYy5zaGlmdCA9IGZ1bmN0aW9uKCkge1xuICogICAgIHZhciBlbnRyeSA9IExSVUNhY2hlLnByb3RvdHlwZS5zaGlmdC5jYWxsKHRoaXMpO1xuICogICAgIGRvU29tZXRoaW5nV2l0aChlbnRyeSk7XG4gKiAgICAgcmV0dXJuIGVudHJ5O1xuICogICB9XG4gKi9cbkxSVUNhY2hlLnByb3RvdHlwZS5zaGlmdCA9IGZ1bmN0aW9uKCkge1xuICAvLyB0b2RvOiBoYW5kbGUgc3BlY2lhbCBjYXNlIHdoZW4gbGltaXQgPT0gMVxuICB2YXIgZW50cnkgPSB0aGlzLmhlYWQ7XG4gIGlmIChlbnRyeSkge1xuICAgIGlmICh0aGlzLmhlYWQubmV3ZXIpIHtcbiAgICAgIHRoaXMuaGVhZCA9IHRoaXMuaGVhZC5uZXdlcjtcbiAgICAgIHRoaXMuaGVhZC5vbGRlciA9IHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5oZWFkID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICAvLyBSZW1vdmUgbGFzdCBzdHJvbmcgcmVmZXJlbmNlIHRvIDxlbnRyeT4gYW5kIHJlbW92ZSBsaW5rcyBmcm9tIHRoZSBwdXJnZWRcbiAgICAvLyBlbnRyeSBiZWluZyByZXR1cm5lZDpcbiAgICBlbnRyeS5uZXdlciA9IGVudHJ5Lm9sZGVyID0gdW5kZWZpbmVkO1xuICAgIC8vIGRlbGV0ZSBpcyBzbG93LCBidXQgd2UgbmVlZCB0byBkbyB0aGlzIHRvIGF2b2lkIHVuY29udHJvbGxhYmxlIGdyb3d0aDpcbiAgICBkZWxldGUgdGhpcy5fa2V5bWFwW2VudHJ5LmtleV07XG4gIH1cbiAgcmV0dXJuIGVudHJ5O1xufTtcblxuLyoqXG4gKiBHZXQgYW5kIHJlZ2lzdGVyIHJlY2VudCB1c2Ugb2YgPGtleT4uIFJldHVybnMgdGhlIHZhbHVlIGFzc29jaWF0ZWQgd2l0aCA8a2V5PlxuICogb3IgdW5kZWZpbmVkIGlmIG5vdCBpbiBjYWNoZS5cbiAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKGtleSwgcmV0dXJuRW50cnkpIHtcbiAgLy8gRmlyc3QsIGZpbmQgb3VyIGNhY2hlIGVudHJ5XG4gIHZhciBlbnRyeSA9IHRoaXMuX2tleW1hcFtrZXldO1xuICBpZiAoZW50cnkgPT09IHVuZGVmaW5lZCkgcmV0dXJuIG51bGw7IC8vIE5vdCBjYWNoZWQuIFNvcnJ5LlxuICAvLyBBcyA8a2V5PiB3YXMgZm91bmQgaW4gdGhlIGNhY2hlLCByZWdpc3RlciBpdCBhcyBiZWluZyByZXF1ZXN0ZWQgcmVjZW50bHlcbiAgaWYgKGVudHJ5ID09PSB0aGlzLnRhaWwpIHtcbiAgICAvLyBBbHJlYWR5IHRoZSBtb3N0IHJlY2VubHR5IHVzZWQgZW50cnksIHNvIG5vIG5lZWQgdG8gdXBkYXRlIHRoZSBsaXN0XG4gICAgcmV0dXJuIHJldHVybkVudHJ5ID8gZW50cnkgOiBlbnRyeS52YWx1ZTtcbiAgfVxuICAvLyBIRUFELS0tLS0tLS0tLS0tLS1UQUlMXG4gIC8vICAgPC5vbGRlciAgIC5uZXdlcj5cbiAgLy8gIDwtLS0gYWRkIGRpcmVjdGlvbiAtLVxuICAvLyAgIEEgIEIgIEMgIDxEPiAgRVxuICBpZiAoZW50cnkubmV3ZXIpIHtcbiAgICBpZiAoZW50cnkgPT09IHRoaXMuaGVhZClcbiAgICAgIHRoaXMuaGVhZCA9IGVudHJ5Lm5ld2VyO1xuICAgIGVudHJ5Lm5ld2VyLm9sZGVyID0gZW50cnkub2xkZXI7IC8vIEMgPC0tIEUuXG4gIH1cbiAgaWYgKGVudHJ5Lm9sZGVyKVxuICAgIGVudHJ5Lm9sZGVyLm5ld2VyID0gZW50cnkubmV3ZXI7IC8vIEMuIC0tPiBFXG4gIGVudHJ5Lm5ld2VyID0gdW5kZWZpbmVkOyAvLyBEIC0teFxuICBlbnRyeS5vbGRlciA9IHRoaXMudGFpbDsgLy8gRC4gLS0+IEVcbiAgaWYgKHRoaXMudGFpbClcbiAgICB0aGlzLnRhaWwubmV3ZXIgPSBlbnRyeTsgLy8gRS4gPC0tIERcbiAgdGhpcy50YWlsID0gZW50cnk7XG4gIHJldHVybiByZXR1cm5FbnRyeSA/IGVudHJ5IDogZW50cnkudmFsdWU7XG59O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBGb2xsb3dpbmcgY29kZSBpcyBvcHRpb25hbCBhbmQgY2FuIGJlIHJlbW92ZWQgd2l0aG91dCBicmVha2luZyB0aGUgY29yZVxuLy8gZnVuY3Rpb25hbGl0eS5cblxuLyoqXG4gKiBDaGVjayBpZiA8a2V5PiBpcyBpbiB0aGUgY2FjaGUgd2l0aG91dCByZWdpc3RlcmluZyByZWNlbnQgdXNlLiBGZWFzaWJsZSBpZlxuICogeW91IGRvIG5vdCB3YW50IHRvIGNoYWdlIHRoZSBzdGF0ZSBvZiB0aGUgY2FjaGUsIGJ1dCBvbmx5IFwicGVla1wiIGF0IGl0LlxuICogUmV0dXJucyB0aGUgZW50cnkgYXNzb2NpYXRlZCB3aXRoIDxrZXk+IGlmIGZvdW5kLCBvciB1bmRlZmluZWQgaWYgbm90IGZvdW5kLlxuICovXG5MUlVDYWNoZS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uKGtleSkge1xuICByZXR1cm4gdGhpcy5fa2V5bWFwW2tleV07XG59O1xuXG4vKipcbiAqIFVwZGF0ZSB0aGUgdmFsdWUgb2YgZW50cnkgd2l0aCA8a2V5Pi4gUmV0dXJucyB0aGUgb2xkIHZhbHVlLCBvciB1bmRlZmluZWQgaWZcbiAqIGVudHJ5IHdhcyBub3QgaW4gdGhlIGNhY2hlLlxuICovXG5MUlVDYWNoZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICB2YXIgb2xkdmFsdWUsIGVudHJ5ID0gdGhpcy5nZXQoa2V5LCB0cnVlKTtcbiAgaWYgKGVudHJ5KSB7XG4gICAgb2xkdmFsdWUgPSBlbnRyeS52YWx1ZTtcbiAgICBlbnRyeS52YWx1ZSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIG9sZHZhbHVlID0gdGhpcy5wdXQoa2V5LCB2YWx1ZSk7XG4gICAgaWYgKG9sZHZhbHVlKSBvbGR2YWx1ZSA9IG9sZHZhbHVlLnZhbHVlO1xuICB9XG4gIHJldHVybiBvbGR2YWx1ZTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIGVudHJ5IDxrZXk+IGZyb20gY2FjaGUgYW5kIHJldHVybiBpdHMgdmFsdWUuIFJldHVybnMgdW5kZWZpbmVkIGlmIG5vdFxuICogZm91bmQuXG4gKi9cbkxSVUNhY2hlLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihrZXkpIHtcbiAgdmFyIGVudHJ5ID0gdGhpcy5fa2V5bWFwW2tleV07XG4gIGlmICghZW50cnkpIHJldHVybiBudWxsO1xuICBkZWxldGUgdGhpcy5fa2V5bWFwW2VudHJ5LmtleV07IC8vIG5lZWQgdG8gZG8gZGVsZXRlIHVuZm9ydHVuYXRlbHlcbiAgaWYgKGVudHJ5Lm5ld2VyICYmIGVudHJ5Lm9sZGVyKSB7XG4gICAgLy8gcmVsaW5rIHRoZSBvbGRlciBlbnRyeSB3aXRoIHRoZSBuZXdlciBlbnRyeVxuICAgIGVudHJ5Lm9sZGVyLm5ld2VyID0gZW50cnkubmV3ZXI7XG4gICAgZW50cnkubmV3ZXIub2xkZXIgPSBlbnRyeS5vbGRlcjtcbiAgfSBlbHNlIGlmIChlbnRyeS5uZXdlcikge1xuICAgIC8vIHJlbW92ZSB0aGUgbGluayB0byB1c1xuICAgIGVudHJ5Lm5ld2VyLm9sZGVyID0gdW5kZWZpbmVkO1xuICAgIC8vIGxpbmsgdGhlIG5ld2VyIGVudHJ5IHRvIGhlYWRcbiAgICB0aGlzLmhlYWQgPSBlbnRyeS5uZXdlcjtcbiAgfSBlbHNlIGlmIChlbnRyeS5vbGRlcikge1xuICAgIC8vIHJlbW92ZSB0aGUgbGluayB0byB1c1xuICAgIGVudHJ5Lm9sZGVyLm5ld2VyID0gdW5kZWZpbmVkO1xuICAgIC8vIGxpbmsgdGhlIG5ld2VyIGVudHJ5IHRvIGhlYWRcbiAgICB0aGlzLnRhaWwgPSBlbnRyeS5vbGRlcjtcbiAgfSBlbHNlIHsgLy8gaWYoZW50cnkub2xkZXIgPT09IHVuZGVmaW5lZCAmJiBlbnRyeS5uZXdlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgdGhpcy5zaXplLS07XG4gIHJldHVybiBlbnRyeS52YWx1ZTtcbn07XG5cbi8qKiBSZW1vdmVzIGFsbCBlbnRyaWVzICovXG5MUlVDYWNoZS5wcm90b3R5cGUucmVtb3ZlQWxsID0gZnVuY3Rpb24oKSB7XG4gIC8vIFRoaXMgc2hvdWxkIGJlIHNhZmUsIGFzIHdlIG5ldmVyIGV4cG9zZSBzdHJvbmcgcmVmcmVuY2VzIHRvIHRoZSBvdXRzaWRlXG4gIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IHVuZGVmaW5lZDtcbiAgdGhpcy5zaXplID0gMDtcbiAgdGhpcy5fa2V5bWFwID0ge307XG59O1xuXG4vKipcbiAqIFJldHVybiBhbiBhcnJheSBjb250YWluaW5nIGFsbCBrZXlzIG9mIGVudHJpZXMgc3RvcmVkIGluIHRoZSBjYWNoZSBvYmplY3QsIGluXG4gKiBhcmJpdHJhcnkgb3JkZXIuXG4gKi9cbmlmICh0eXBlb2YgT2JqZWN0LmtleXMgPT09ICdmdW5jdGlvbicpIHtcbiAgTFJVQ2FjaGUucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbigpIHsgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2tleW1hcCk7IH07XG59IGVsc2Uge1xuICBMUlVDYWNoZS5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIgayBpbiB0aGlzLl9rZXltYXApIGtleXMucHVzaChrKTtcbiAgICByZXR1cm4ga2V5cztcbiAgfTtcbn1cblxuLyoqXG4gKiBDYWxsIGBmdW5gIGZvciBlYWNoIGVudHJ5LiBTdGFydGluZyB3aXRoIHRoZSBuZXdlc3QgZW50cnkgaWYgYGRlc2NgIGlzIGEgdHJ1ZVxuICogdmFsdWUsIG90aGVyd2lzZSBzdGFydHMgd2l0aCB0aGUgb2xkZXN0IChoZWFkKSBlbnJ0eSBhbmQgbW92ZXMgdG93YXJkcyB0aGVcbiAqIHRhaWwuXG4gKlxuICogYGZ1bmAgaXMgY2FsbGVkIHdpdGggMyBhcmd1bWVudHMgaW4gdGhlIGNvbnRleHQgYGNvbnRleHRgOlxuICogICBgZnVuLmNhbGwoY29udGV4dCwgT2JqZWN0IGtleSwgT2JqZWN0IHZhbHVlLCBMUlVDYWNoZSBzZWxmKWBcbiAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbihmdW4sIGNvbnRleHQsIGRlc2MpIHtcbiAgdmFyIGVudHJ5O1xuICBpZiAoY29udGV4dCA9PT0gdHJ1ZSkgeyBkZXNjID0gdHJ1ZTsgY29udGV4dCA9IHVuZGVmaW5lZDsgfVxuICBlbHNlIGlmICh0eXBlb2YgY29udGV4dCAhPT0gJ29iamVjdCcpIGNvbnRleHQgPSB0aGlzO1xuICBpZiAoZGVzYykge1xuICAgIGVudHJ5ID0gdGhpcy50YWlsO1xuICAgIHdoaWxlIChlbnRyeSkge1xuICAgICAgZnVuLmNhbGwoY29udGV4dCwgZW50cnkua2V5LCBlbnRyeS52YWx1ZSwgdGhpcyk7XG4gICAgICBlbnRyeSA9IGVudHJ5Lm9sZGVyO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBlbnRyeSA9IHRoaXMuaGVhZDtcbiAgICB3aGlsZSAoZW50cnkpIHtcbiAgICAgIGZ1bi5jYWxsKGNvbnRleHQsIGVudHJ5LmtleSwgZW50cnkudmFsdWUsIHRoaXMpO1xuICAgICAgZW50cnkgPSBlbnRyeS5uZXdlcjtcbiAgICB9XG4gIH1cbn07XG5cbi8qKiBSZXR1cm5zIGEgSlNPTiAoYXJyYXkpIHJlcHJlc2VudGF0aW9uICovXG5MUlVDYWNoZS5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzID0gW10sIGVudHJ5ID0gdGhpcy5oZWFkO1xuICB3aGlsZSAoZW50cnkpIHtcbiAgICBzLnB1c2goe2tleTplbnRyeS5rZXkudG9KU09OKCksIHZhbHVlOmVudHJ5LnZhbHVlLnRvSlNPTigpfSk7XG4gICAgZW50cnkgPSBlbnRyeS5uZXdlcjtcbiAgfVxuICByZXR1cm4gcztcbn07XG5cbi8qKiBSZXR1cm5zIGEgU3RyaW5nIHJlcHJlc2VudGF0aW9uICovXG5MUlVDYWNoZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHMgPSAnJywgZW50cnkgPSB0aGlzLmhlYWQ7XG4gIHdoaWxlIChlbnRyeSkge1xuICAgIHMgKz0gU3RyaW5nKGVudHJ5LmtleSkrJzonK2VudHJ5LnZhbHVlO1xuICAgIGVudHJ5ID0gZW50cnkubmV3ZXI7XG4gICAgaWYgKGVudHJ5KVxuICAgICAgcyArPSAnIDwgJztcbiAgfVxuICByZXR1cm4gcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTFJVQ2FjaGU7XG4iLCJcblwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIEBnbG9iYWxcbiAqIEBuYW1lc3BhY2VcbiAqIEBhbGlhcyBQcmVkaWNhdGVzXG4gKi9cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIC8qKlxuICAgKiBCdWlsZCBhbiBcImF0XCIgcHJlZGljYXRlOiBlcXVhbGl0eSBvZiBhIGZyYWdtZW50IHRvIGEgdmFsdWUuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuYXQoXCJkb2N1bWVudC50eXBlXCIsIFwiYXJ0aWNsZVwiKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ31cbiAgICogQHBhcmFtIHZhbHVlIHtTdHJpbmd9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBhdDogZnVuY3Rpb24oZnJhZ21lbnQsIHZhbHVlKSB7IHJldHVybiBbXCJhdFwiLCBmcmFnbWVudCwgdmFsdWVdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhbiBcIm5vdFwiIHByZWRpY2F0ZTogaW5lcXVhbGl0eSBvZiBhIGZyYWdtZW50IHRvIGEgdmFsdWUuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMubm90KFwiZG9jdW1lbnQudHlwZVwiLCBcImFydGljbGVcIilcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9XG4gICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgbm90OiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWUpIHsgcmV0dXJuIFtcIm5vdFwiLCBmcmFnbWVudCwgdmFsdWVdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFwibWlzc2luZ1wiIHByZWRpY2F0ZTogZG9jdW1lbnRzIHdoZXJlIHRoZSByZXF1ZXN0ZWQgZmllbGQgaXMgZW1wdHlcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5taXNzaW5nKFwibXkuYmxvZy1wb3N0LmF1dGhvclwiKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ31cbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIG1pc3Npbmc6IGZ1bmN0aW9uKGZyYWdtZW50KSB7IHJldHVybiBbXCJtaXNzaW5nXCIsIGZyYWdtZW50XTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcImhhc1wiIHByZWRpY2F0ZTogZG9jdW1lbnRzIHdoZXJlIHRoZSByZXF1ZXN0ZWQgZmllbGQgaXMgZGVmaW5lZFxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmhhcyhcIm15LmJsb2ctcG9zdC5hdXRob3JcIilcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBoYXM6IGZ1bmN0aW9uKGZyYWdtZW50KSB7IHJldHVybiBbXCJoYXNcIiwgZnJhZ21lbnRdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhbiBcImFueVwiIHByZWRpY2F0ZTogZXF1YWxpdHkgb2YgYSBmcmFnbWVudCB0byBhIHZhbHVlLlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmFueShcImRvY3VtZW50LnR5cGVcIiwgW1wiYXJ0aWNsZVwiLCBcImJsb2ctcG9zdFwiXSlcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9XG4gICAqIEBwYXJhbSB2YWx1ZXMge0FycmF5fVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgYW55OiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWVzKSB7IHJldHVybiBbXCJhbnlcIiwgZnJhZ21lbnQsIHZhbHVlc107IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGFuIFwiaW5cIiBwcmVkaWNhdGU6IGVxdWFsaXR5IG9mIGEgZnJhZ21lbnQgdG8gYSB2YWx1ZS5cbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5pbihcIm15LnByb2R1Y3QucHJpY2VcIiwgWzQsIDVdKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ31cbiAgICogQHBhcmFtIHZhbHVlcyB7QXJyYXl9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBpbjogZnVuY3Rpb24oZnJhZ21lbnQsIHZhbHVlcykgeyByZXR1cm4gW1wiaW5cIiwgZnJhZ21lbnQsIHZhbHVlc107IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgXCJmdWxsdGV4dFwiIHByZWRpY2F0ZTogZnVsbHRleHQgc2VhcmNoIGluIGEgZnJhZ21lbnQuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZnVsbHRleHQoXCJteS5hcnRpY2xlLmJvZHlcIiwgXCJzYXVzYWdlXCJdKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ31cbiAgICogQHBhcmFtIHZhbHVlIHtTdHJpbmd9IHRoZSB0ZXJtIHRvIHNlYXJjaFxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgZnVsbHRleHQ6IGZ1bmN0aW9uKGZyYWdtZW50LCB2YWx1ZSkgeyByZXR1cm4gW1wiZnVsbHRleHRcIiwgZnJhZ21lbnQsIHZhbHVlXTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcInNpbWlsYXJcIiBwcmVkaWNhdGUuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuc2ltaWxhcihcIlVYYXNkRndlNDJEXCIsIDEwKVxuICAgKiBAcGFyYW0gZG9jdW1lbnRJZCB7U3RyaW5nfSB0aGUgZG9jdW1lbnQgaWQgdG8gcmV0cmlldmUgc2ltaWxhciBkb2N1bWVudHMgdG8uXG4gICAqIEBwYXJhbSBtYXhSZXN1bHRzIHtOdW1iZXJ9IHRoZSBtYXhpbXVtIG51bWJlciBvZiByZXN1bHRzIHRvIHJldHVyblxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgc2ltaWxhcjogZnVuY3Rpb24oZG9jdW1lbnRJZCwgbWF4UmVzdWx0cykgeyByZXR1cm4gW1wic2ltaWxhclwiLCBkb2N1bWVudElkLCBtYXhSZXN1bHRzXTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcIm51bWJlci5ndFwiIHByZWRpY2F0ZTogZG9jdW1lbnRzIHdoZXJlIHRoZSBmcmFnbWVudCBmaWVsZCBpcyBncmVhdGVyIHRoYW4gdGhlIGdpdmVuIHZhbHVlLlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmd0KFwibXkucHJvZHVjdC5wcmljZVwiLCAxMClcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9IHRoZSBuYW1lIG9mIHRoZSBmaWVsZCAtIG11c3QgYmUgYSBudW1iZXIuXG4gICAqIEBwYXJhbSB2YWx1ZSB7TnVtYmVyfSB0aGUgbG93ZXIgYm91bmQgb2YgdGhlIHByZWRpY2F0ZVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgZ3Q6IGZ1bmN0aW9uKGZyYWdtZW50LCB2YWx1ZSkgeyByZXR1cm4gW1wibnVtYmVyLmd0XCIsIGZyYWdtZW50LCB2YWx1ZV07IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgXCJudW1iZXIubHRcIiBwcmVkaWNhdGU6IGRvY3VtZW50cyB3aGVyZSB0aGUgZnJhZ21lbnQgZmllbGQgaXMgbG93ZXIgdGhhbiB0aGUgZ2l2ZW4gdmFsdWUuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMubHQoXCJteS5wcm9kdWN0LnByaWNlXCIsIDIwKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ30gdGhlIG5hbWUgb2YgdGhlIGZpZWxkIC0gbXVzdCBiZSBhIG51bWJlci5cbiAgICogQHBhcmFtIHZhbHVlIHtOdW1iZXJ9IHRoZSB1cHBlciBib3VuZCBvZiB0aGUgcHJlZGljYXRlXG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBsdDogZnVuY3Rpb24oZnJhZ21lbnQsIHZhbHVlKSB7IHJldHVybiBbXCJudW1iZXIubHRcIiwgZnJhZ21lbnQsIHZhbHVlXTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcIm51bWJlci5pblJhbmdlXCIgcHJlZGljYXRlOiBjb21iaW5hdGlvbiBvZiBsdCBhbmQgZ3QuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuaW5SYW5nZShcIm15LnByb2R1Y3QucHJpY2VcIiwgMTAsIDIwKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ30gdGhlIG5hbWUgb2YgdGhlIGZpZWxkIC0gbXVzdCBiZSBhIG51bWJlci5cbiAgICogQHBhcmFtIGJlZm9yZSB7TnVtYmVyfVxuICAgKiBAcGFyYW0gYWZ0ZXIge051bWJlcn1cbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIGluUmFuZ2U6IGZ1bmN0aW9uKGZyYWdtZW50LCBiZWZvcmUsIGFmdGVyKSB7IHJldHVybiBbXCJudW1iZXIuaW5SYW5nZVwiLCBmcmFnbWVudCwgYmVmb3JlLCBhZnRlcl07IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgXCJkYXRlLmJlZm9yZVwiIHByZWRpY2F0ZTogZG9jdW1lbnRzIHdoZXJlIHRoZSBmcmFnbWVudCBmaWVsZCBpcyBiZWZvcmUgdGhlIGdpdmVuIGRhdGUuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF0ZUJlZm9yZShcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgbmV3IERhdGUoMjAxNCwgNiwgMSkpXG4gICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgZmllbGQgLSBtdXN0IGJlIGEgZGF0ZSBvciB0aW1lc3RhbXAgZmllbGQuXG4gICAqIEBwYXJhbSBiZWZvcmUge0RhdGV9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBkYXRlQmVmb3JlOiBmdW5jdGlvbihmcmFnbWVudCwgYmVmb3JlKSB7IHJldHVybiBbXCJkYXRlLmJlZm9yZVwiLCBmcmFnbWVudCwgYmVmb3JlXTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcImRhdGUuYWZ0ZXJcIiBwcmVkaWNhdGU6IGRvY3VtZW50cyB3aGVyZSB0aGUgZnJhZ21lbnQgZmllbGQgaXMgYWZ0ZXIgdGhlIGdpdmVuIGRhdGUuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF0ZUFmdGVyKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCBuZXcgRGF0ZSgyMDE0LCAxLCAxKSlcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9IHRoZSBuYW1lIG9mIHRoZSBmaWVsZCAtIG11c3QgYmUgYSBkYXRlIG9yIHRpbWVzdGFtcCBmaWVsZC5cbiAgICogQHBhcmFtIGFmdGVyIHtEYXRlfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgZGF0ZUFmdGVyOiBmdW5jdGlvbihmcmFnbWVudCwgYWZ0ZXIpIHsgcmV0dXJuIFtcImRhdGUuYWZ0ZXJcIiwgZnJhZ21lbnQsIGFmdGVyXTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcImRhdGUuYmV0d2VlblwiIHByZWRpY2F0ZTogY29tYmluYXRpb24gb2YgZGF0ZUJlZm9yZSBhbmQgZGF0ZUFmdGVyXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF0ZUJldHdlZW4oXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIG5ldyBEYXRlKDIwMTQsIDEsIDEpLCBuZXcgRGF0ZSgyMDE0LCA2LCAxKSlcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9IHRoZSBuYW1lIG9mIHRoZSBmaWVsZCAtIG11c3QgYmUgYSBkYXRlIG9yIHRpbWVzdGFtcCBmaWVsZC5cbiAgICogQHBhcmFtIGJlZm9yZSB7RGF0ZX1cbiAgICogQHBhcmFtIGFmdGVyIHtEYXRlfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgZGF0ZUJldHdlZW46IGZ1bmN0aW9uKGZyYWdtZW50LCBiZWZvcmUsIGFmdGVyKSB7IHJldHVybiBbXCJkYXRlLmJldHdlZW5cIiwgZnJhZ21lbnQsIGJlZm9yZSwgYWZ0ZXJdOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmRheU9mTW9udGgoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDE0KVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIGRheSB7TnVtYmVyfSBiZXR3ZWVuIDEgYW5kIDMxXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIGRheU9mTW9udGg6IGZ1bmN0aW9uKGZyYWdtZW50LCBkYXkpIHsgcmV0dXJuIFtcImRhdGUuZGF5LW9mLW1vbnRoXCIsIGZyYWdtZW50LCBkYXldOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmRheU9mTW9udGhBZnRlcihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMTQpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gZGF5IHtOdW1iZXJ9IGJldHdlZW4gMSBhbmQgMzFcbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgZGF5T2ZNb250aEFmdGVyOiBmdW5jdGlvbihmcmFnbWVudCwgZGF5KSB7IHJldHVybiBbXCJkYXRlLmRheS1vZi1tb250aC1hZnRlclwiLCBmcmFnbWVudCwgZGF5XTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXlPZk1vbnRoQmVmb3JlKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCAxNClcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBkYXkge051bWJlcn0gYmV0d2VlbiAxIGFuZCAzMVxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBkYXlPZk1vbnRoQmVmb3JlOiBmdW5jdGlvbihmcmFnbWVudCwgZGF5KSB7IHJldHVybiBbXCJkYXRlLmRheS1vZi1tb250aC1iZWZvcmVcIiwgZnJhZ21lbnQsIGRheV07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF5T2ZXZWVrKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCAxNClcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBkYXkge051bWJlcnxTdHJpbmd9IE51bWJlciBiZXR3ZWVuIDEgYW5kIDcgb3Igc3RyaW5nIGJldHdlZW4gXCJNb25kYXlcIiBhbmQgXCJTdW5kYXlcIlxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBkYXlPZldlZWs6IGZ1bmN0aW9uKGZyYWdtZW50LCBkYXkpIHsgcmV0dXJuIFtcImRhdGUuZGF5LW9mLXdlZWtcIiwgZnJhZ21lbnQsIGRheV07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF5T2ZXZWVrQWZ0ZXIoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIFwiV2VkbmVzZGF5XCIpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gZGF5IHtOdW1iZXJ8U3RyaW5nfSBOdW1iZXIgYmV0d2VlbiAxIGFuZCA3IG9yIHN0cmluZyBiZXR3ZWVuIFwiTW9uZGF5XCIgYW5kIFwiU3VuZGF5XCJcbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgZGF5T2ZXZWVrQWZ0ZXI6IGZ1bmN0aW9uKGZyYWdtZW50LCBkYXkpIHsgcmV0dXJuIFtcImRhdGUuZGF5LW9mLXdlZWstYWZ0ZXJcIiwgZnJhZ21lbnQsIGRheV07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF5T2ZXZWVrQmVmb3JlKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCBcIldlZG5lc2RheVwiKVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIGRheSB7TnVtYmVyfFN0cmluZ30gTnVtYmVyIGJldHdlZW4gMSBhbmQgNyBvciBzdHJpbmcgYmV0d2VlbiBcIk1vbmRheVwiIGFuZCBcIlN1bmRheVwiXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIGRheU9mV2Vla0JlZm9yZTogZnVuY3Rpb24oZnJhZ21lbnQsIGRheSkgeyByZXR1cm4gW1wiZGF0ZS5kYXktb2Ytd2Vlay1iZWZvcmVcIiwgZnJhZ21lbnQsIGRheV07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMubW9udGgoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIFwiSnVuZVwiKVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIG1vbnRoIHtOdW1iZXJ8U3RyaW5nfSBOdW1iZXIgYmV0d2VlbiAxIGFuZCAxMiBvciBzdHJpbmcgYmV0d2VlbiBcIkphbnVhcnlcIiBhbmQgXCJEZWNlbWJlclwiXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIG1vbnRoOiBmdW5jdGlvbihmcmFnbWVudCwgbW9udGgpIHsgcmV0dXJuIFtcImRhdGUubW9udGhcIiwgZnJhZ21lbnQsIG1vbnRoXTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5tb250aEJlZm9yZShcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgXCJKdW5lXCIpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gbW9udGgge051bWJlcnxTdHJpbmd9IE51bWJlciBiZXR3ZWVuIDEgYW5kIDEyIG9yIHN0cmluZyBiZXR3ZWVuIFwiSmFudWFyeVwiIGFuZCBcIkRlY2VtYmVyXCJcbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgbW9udGhCZWZvcmU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb250aCkgeyByZXR1cm4gW1wiZGF0ZS5tb250aC1iZWZvcmVcIiwgZnJhZ21lbnQsIG1vbnRoXTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5tb250aEFmdGVyKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCBcIkp1bmVcIilcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBtb250aCB7TnVtYmVyfFN0cmluZ30gTnVtYmVyIGJldHdlZW4gMSBhbmQgMTIgb3Igc3RyaW5nIGJldHdlZW4gXCJKYW51YXJ5XCIgYW5kIFwiRGVjZW1iZXJcIlxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIG1vbnRoQWZ0ZXI6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb250aCkgeyByZXR1cm4gW1wiZGF0ZS5tb250aC1hZnRlclwiLCBmcmFnbWVudCwgbW9udGhdOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLnllYXIoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDIwMTQpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0geWVhciB7TnVtYmVyfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICB5ZWFyOiBmdW5jdGlvbihmcmFnbWVudCwgeWVhcikgeyByZXR1cm4gW1wiZGF0ZS55ZWFyXCIsIGZyYWdtZW50LCB5ZWFyXTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5ob3VyKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCAxMilcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBob3VyIHtOdW1iZXJ9XG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIGhvdXI6IGZ1bmN0aW9uKGZyYWdtZW50LCBob3VyKSB7IHJldHVybiBbXCJkYXRlLmhvdXJcIiwgZnJhZ21lbnQsIGhvdXJdOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmhvdXJCZWZvcmUoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDEyKVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIGhvdXIge051bWJlcn1cbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgaG91ckJlZm9yZTogZnVuY3Rpb24oZnJhZ21lbnQsIGhvdXIpIHsgcmV0dXJuIFtcImRhdGUuaG91ci1iZWZvcmVcIiwgZnJhZ21lbnQsIGhvdXJdOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmhvdXJBZnRlcihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMTIpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gaG91ciB7TnVtYmVyfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBob3VyQWZ0ZXI6IGZ1bmN0aW9uKGZyYWdtZW50LCBob3VyKSB7IHJldHVybiBbXCJkYXRlLmhvdXItYWZ0ZXJcIiwgZnJhZ21lbnQsIGhvdXJdOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLm5lYXIoXCJteS5zdG9yZS5sb2NhdGlvblwiLCA0OC44NzY4NzY3LCAyLjMzMzg4MDIsIDEwKVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIGxhdGl0dWRlIHtOdW1iZXJ9XG4gICAqIEBwYXJhbSBsb25naXR1ZGUge051bWJlcn1cbiAgICogQHBhcmFtIHJhZGl1cyB7TnVtYmVyfSBpbiBraWxvbWV0ZXJzXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIG5lYXI6IGZ1bmN0aW9uKGZyYWdtZW50LCBsYXRpdHVkZSwgbG9uZ2l0dWRlLCByYWRpdXMpIHsgcmV0dXJuIFtcImdlb3BvaW50Lm5lYXJcIiwgZnJhZ21lbnQsIGxhdGl0dWRlLCBsb25naXR1ZGUsIHJhZGl1c107IH1cblxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgZXhwZXJpbWVudHMgPSByZXF1aXJlKCcuL2V4cGVyaW1lbnRzJyksXG4gICAgUHJlZGljYXRlcyA9IHJlcXVpcmUoJy4vcHJlZGljYXRlcycpLFxuICAgIGFwaSA9IHJlcXVpcmUoJy4vYXBpJyksXG4gICAgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKSxcbiAgICBkb2N1bWVudHMgPSByZXF1aXJlKCcuL2RvY3VtZW50cycpO1xuXG52YXIgQXBpID0gYXBpLkFwaSxcbiAgICBFeHBlcmltZW50cyA9IGV4cGVyaW1lbnRzLkV4cGVyaW1lbnRzO1xuXG4vKipcbiAqIFRoZSBraXQncyBtYWluIGVudHJ5IHBvaW50OyBpbml0aWFsaXplIHlvdXIgQVBJIGxpa2UgdGhpczogUHJpc21pYy5BcGkodXJsLCBjYWxsYmFjaywgYWNjZXNzVG9rZW4sIG1heWJlUmVxdWVzdEhhbmRsZXIpXG4gKlxuICogQGdsb2JhbFxuICogQGFsaWFzIEFwaVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIG1hbmRhdG9yeSBVUkwgb2YgdGhlIHByaXNtaWMuaW8gQVBJIGVuZHBvaW50IChsaWtlOiBodHRwczovL2xlc2Jvbm5lc2Nob3Nlcy5wcmlzbWljLmlvL2FwaSlcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdGhlIEFQSSB3YXMgcmV0cmlldmVkLCB3aGljaCB3aWxsIGJlIGNhbGxlZCB3aXRoIHR3byBwYXJhbWV0ZXJzOiBhIHBvdGVudGlhbCBlcnJvciBvYmplY3QgYW5kIHRoZSBBUEkgb2JqZWN0XG4gKiBAcGFyYW0ge3N0cmluZ30gbWF5YmVBY2Nlc3NUb2tlbiAtIFRoZSBhY2Nlc3NUb2tlbiBmb3IgYW4gT0F1dGgyIGNvbm5lY3Rpb25cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IG1heWJlUmVxdWVzdEhhbmRsZXIgLSBFbnZpcm9ubWVudCBzcGVjaWZpYyBIVFRQIHJlcXVlc3QgaGFuZGxpbmcgZnVuY3Rpb25cbiAqIEBwYXJhbSB7b2JqZWN0fSBtYXliZUFwaUNhY2hlIC0gQSBjYWNoZSBvYmplY3Qgd2l0aCBnZXQvc2V0IGZ1bmN0aW9ucyBmb3IgY2FjaGluZyBBUEkgcmVzcG9uc2VzXG4gKiBAcGFyYW0ge2ludH0gbWF5YmVBcGlEYXRhVFRMIC0gSG93IGxvbmcgKGluIHNlY29uZHMpIHRvIGNhY2hlIGRhdGEgdXNlZCBieSB0aGUgY2xpZW50IHRvIG1ha2UgY2FsbHMgKGUuZy4gcmVmcykuIERlZmF1bHRzIHRvIDUgc2Vjb25kc1xuICogQHJldHVybnMge0FwaX0gLSBUaGUgQXBpIG9iamVjdCB0aGF0IGNhbiBiZSBtYW5pcHVsYXRlZFxuICovXG5mdW5jdGlvbiBnZXRBcGkodXJsLCBjYWxsYmFjaywgbWF5YmVBY2Nlc3NUb2tlbiwgbWF5YmVSZXF1ZXN0SGFuZGxlciwgbWF5YmVBcGlDYWNoZSwgbWF5YmVBcGlEYXRhVFRMKSB7XG4gIHZhciBhcGkgPSBuZXcgQXBpKHVybCwgbWF5YmVBY2Nlc3NUb2tlbiwgbWF5YmVSZXF1ZXN0SGFuZGxlciwgbWF5YmVBcGlDYWNoZSwgbWF5YmVBcGlEYXRhVFRMKTtcbiAgLy9Vc2UgY2FjaGVkIGFwaSBkYXRhIGlmIGF2YWlsYWJsZVxuICBhcGkuZ2V0KGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICBpZiAoY2FsbGJhY2sgJiYgZXJyKSB7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChkYXRhKSB7XG4gICAgICBhcGkuZGF0YSA9IGRhdGE7XG4gICAgICBhcGkuYm9va21hcmtzID0gZGF0YS5ib29rbWFya3M7XG4gICAgICBhcGkuZXhwZXJpbWVudHMgPSBuZXcgRXhwZXJpbWVudHMoZGF0YS5leHBlcmltZW50cyk7XG4gICAgfVxuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayhudWxsLCBhcGkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGFwaTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGV4cGVyaW1lbnRDb29raWU6IFwiaW8ucHJpc21pYy5leHBlcmltZW50XCIsXG4gIHByZXZpZXdDb29raWU6IFwiaW8ucHJpc21pYy5wcmV2aWV3XCIsXG4gIEFwaTogQXBpLFxuICBEb2N1bWVudDogZG9jdW1lbnRzLkRvY3VtZW50LFxuICBTZWFyY2hGb3JtOiBhcGkuU2VhcmNoRm9ybSxcbiAgRm9ybTogYXBpLkZvcm0sXG4gIEV4cGVyaW1lbnRzOiBFeHBlcmltZW50cyxcbiAgUHJlZGljYXRlczogUHJlZGljYXRlcyxcbiAgRnJhZ21lbnRzOiBGcmFnbWVudHMsXG4gIGFwaTogZ2V0QXBpLFxuICBwYXJzZURvYzogYXBpLnBhcnNlRG9jXG59O1xuXG5tb2R1bGUuZXhwb3J0cy5QcmlzbWljID0gbW9kdWxlLmV4cG9ydHM7IC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiIsIlxuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBjcmVhdGVFcnJvciA9IGZ1bmN0aW9uKHN0YXR1cywgbWVzc2FnZSkge1xuICB2YXIgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnIuc3RhdHVzID0gc3RhdHVzO1xuICByZXR1cm4gZXJyO1xufTtcblxuLy8gLS0gUmVxdWVzdCBoYW5kbGVyc1xuXG52YXIgYWpheFJlcXVlc3QgPSAoZnVuY3Rpb24oKSB7XG4gIGlmKHR5cGVvZiBYTUxIdHRwUmVxdWVzdCAhPSAndW5kZWZpbmVkJyAmJiAnd2l0aENyZWRlbnRpYWxzJyBpbiBuZXcgWE1MSHR0cFJlcXVlc3QoKSkge1xuICAgIHJldHVybiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgLy8gQ2FsbGVkIG9uIHN1Y2Nlc3NcbiAgICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB0dGwsIGNhY2hlQ29udHJvbCA9IC9tYXgtYWdlXFxzKj1cXHMqKFxcZCspLy5leGVjKFxuICAgICAgICAgIHhoci5nZXRSZXNwb25zZUhlYWRlcignQ2FjaGUtQ29udHJvbCcpKTtcbiAgICAgICAgaWYgKGNhY2hlQ29udHJvbCAmJiBjYWNoZUNvbnRyb2wubGVuZ3RoID4gMSkge1xuICAgICAgICAgIHR0bCA9IHBhcnNlSW50KGNhY2hlQ29udHJvbFsxXSwgMTApO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCksIHhociwgdHRsKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIENhbGxlZCBvbiBlcnJvclxuICAgICAgdmFyIHJlamVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0geGhyLnN0YXR1cztcbiAgICAgICAgY2FsbGJhY2soY3JlYXRlRXJyb3Ioc3RhdHVzLCBcIlVuZXhwZWN0ZWQgc3RhdHVzIGNvZGUgW1wiICsgc3RhdHVzICsgXCJdIG9uIFVSTCBcIit1cmwpLCBudWxsLCB4aHIpO1xuICAgICAgfTtcblxuICAgICAgLy8gQmluZCB0aGUgWEhSIGZpbmlzaGVkIGNhbGxiYWNrXG4gICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgIGlmKHhoci5zdGF0dXMgJiYgeGhyLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBPcGVuIHRoZSBYSFJcbiAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAvLyBLaXQgdmVyc2lvbiAoY2FuJ3Qgb3ZlcnJpZGUgdGhlIHVzZXItYWdlbnQgY2xpZW50IHNpZGUpXG4gICAgICAvLyB4aHIuc2V0UmVxdWVzdEhlYWRlcihcIlgtUHJpc21pYy1Vc2VyLUFnZW50XCIsIFwiUHJpc21pYy1qYXZhc2NyaXB0LWtpdC8lVkVSU0lPTiVcIi5yZXBsYWNlKFwiJVZFUlNJT04lXCIsIEdsb2JhbC5QcmlzbWljLnZlcnNpb24pKTtcblxuICAgICAgLy8gSnNvbiByZXF1ZXN0XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcblxuICAgICAgLy8gU2VuZCB0aGUgWEhSXG4gICAgICB4aHIuc2VuZCgpO1xuICAgIH07XG4gIH1cbn0pO1xuXG52YXIgeGRvbWFpblJlcXVlc3QgPSAoZnVuY3Rpb24oKSB7XG4gIGlmKHR5cGVvZiBYRG9tYWluUmVxdWVzdCAhPSAndW5kZWZpbmVkJykgeyAvLyBJbnRlcm5ldCBFeHBsb3JlclxuICAgIHJldHVybiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG5cbiAgICAgIHZhciB4ZHIgPSBuZXcgWERvbWFpblJlcXVlc3QoKTtcblxuICAgICAgLy8gQ2FsbGVkIG9uIHN1Y2Nlc3NcbiAgICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIEpTT04ucGFyc2UoeGRyLnJlc3BvbnNlVGV4dCksIHhkciwgMCk7XG4gICAgICB9O1xuXG4gICAgICAvLyBDYWxsZWQgb24gZXJyb3JcbiAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKG1zZyksIG51bGwsIHhkcik7XG4gICAgICB9O1xuXG4gICAgICAvLyBCaW5kIHRoZSBYRFIgZmluaXNoZWQgY2FsbGJhY2tcbiAgICAgIHhkci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZSh4ZHIpO1xuICAgICAgfTtcblxuICAgICAgLy8gQmluZCB0aGUgWERSIGVycm9yIGNhbGxiYWNrXG4gICAgICB4ZHIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QoXCJVbmV4cGVjdGVkIHN0YXR1cyBjb2RlIG9uIFVSTCBcIiArIHVybCk7XG4gICAgICB9O1xuXG4gICAgICAvLyBPcGVuIHRoZSBYSFJcbiAgICAgIHhkci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAvLyBCaW5kIHRoZSBYRFIgdGltZW91dCBjYWxsYmFja1xuICAgICAgeGRyLm9udGltZW91dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmVqZWN0KFwiUmVxdWVzdCB0aW1lb3V0XCIpO1xuICAgICAgfTtcblxuICAgICAgLy8gRW1wdHkgY2FsbGJhY2suIElFIHNvbWV0aW1lcyBhYm9ydCB0aGUgcmVxZXVzdCBpZlxuICAgICAgLy8gdGhpcyBpcyBub3QgcHJlc2VudFxuICAgICAgeGRyLm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7IH07XG5cbiAgICAgIHhkci5zZW5kKCk7XG4gICAgfTtcbiAgfVxufSk7XG5cbnZhciBub2RlSlNSZXF1ZXN0ID0gKGZ1bmN0aW9uKCkge1xuICBpZih0eXBlb2YgcmVxdWlyZSA9PSAnZnVuY3Rpb24nICYmIHJlcXVpcmUoJ2h0dHAnKSkge1xuICAgIHZhciBodHRwID0gcmVxdWlyZSgnaHR0cCcpLFxuICAgICAgICBodHRwcyA9IHJlcXVpcmUoJ2h0dHBzJyksXG4gICAgICAgIHVybCA9IHJlcXVpcmUoJ3VybCcpLFxuICAgICAgICBwanNvbiA9IHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKHJlcXVlc3RVcmwsIGNhbGxiYWNrKSB7XG5cbiAgICAgIHZhciBwYXJzZWQgPSB1cmwucGFyc2UocmVxdWVzdFVybCksXG4gICAgICAgICAgaCA9IHBhcnNlZC5wcm90b2NvbCA9PSAnaHR0cHM6JyA/IGh0dHBzIDogaHR0cCxcbiAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgaG9zdG5hbWU6IHBhcnNlZC5ob3N0bmFtZSxcbiAgICAgICAgICAgIHBhdGg6IHBhcnNlZC5wYXRoLFxuICAgICAgICAgICAgcXVlcnk6IHBhcnNlZC5xdWVyeSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgJ1VzZXItQWdlbnQnOiAnUHJpc21pYy1qYXZhc2NyaXB0LWtpdC8nICsgcGpzb24udmVyc2lvbiArIFwiIE5vZGVKUy9cIiArIHByb2Nlc3MudmVyc2lvblxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgIGlmICghcmVxdWVzdFVybCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIkJPT01cIik7XG4gICAgICAgIHZhciBlID0gbmV3IEVycm9yKCdkdW1teScpO1xuICAgICAgICB2YXIgc3RhY2sgPSBlLnN0YWNrLnJlcGxhY2UoL15bXlxcKF0rP1tcXG4kXS9nbSwgJycpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9eXFxzK2F0XFxzKy9nbSwgJycpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9eT2JqZWN0Ljxhbm9ueW1vdXM+XFxzKlxcKC9nbSwgJ3thbm9ueW1vdXN9KClAJylcbiAgICAgICAgICAgICAgLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgY29uc29sZS5sb2coc3RhY2spO1xuXG4gICAgICB9XG4gICAgICB2YXIgcmVxdWVzdCA9IGguZ2V0KG9wdGlvbnMsIGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgJiYgcmVzcG9uc2Uuc3RhdHVzQ29kZSA9PSAyMDApIHtcbiAgICAgICAgICB2YXIganNvblN0ciA9ICcnO1xuXG4gICAgICAgICAgcmVzcG9uc2Uuc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcbiAgICAgICAgICByZXNwb25zZS5vbignZGF0YScsIGZ1bmN0aW9uIChjaHVuaykge1xuICAgICAgICAgICAganNvblN0ciArPSBjaHVuaztcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHJlc3BvbnNlLm9uKCdlbmQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIganNvbjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGpzb24gPSBKU09OLnBhcnNlKGpzb25TdHIpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJGYWlsZWQgdG8gcGFyc2UganNvbjogXCIgKyBqc29uU3RyLCBleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY2FjaGVDb250cm9sID0gcmVzcG9uc2UuaGVhZGVyc1snY2FjaGUtY29udHJvbCddO1xuICAgICAgICAgICAgdmFyIHR0bCA9IGNhY2hlQ29udHJvbCAmJiAvbWF4LWFnZT0oXFxkKykvLnRlc3QoY2FjaGVDb250cm9sKSA/IHBhcnNlSW50KC9tYXgtYWdlPShcXGQrKS8uZXhlYyhjYWNoZUNvbnRyb2wpWzFdLCAxMCkgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGpzb24sIHJlc3BvbnNlLCB0dGwpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKHJlc3BvbnNlLnN0YXR1c0NvZGUsIFwiVW5leHBlY3RlZCBzdGF0dXMgY29kZSBbXCIgKyByZXNwb25zZS5zdGF0dXNDb2RlICsgXCJdIG9uIFVSTCBcIityZXF1ZXN0VXJsKSwgbnVsbCwgcmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gcHJvcGVybHkgaGFuZGxlIHRpbWVvdXRzXG4gICAgICByZXF1ZXN0Lm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYWxsYmFjayhuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIGVycm9yIG9uIFVSTCBcIityZXF1ZXN0VXJsKSwgbnVsbCwgZXJyKTtcbiAgICAgIH0pO1xuXG5cbiAgICB9O1xuICB9XG59KTtcblxuLy8gTnVtYmVyIG9mIG1heGltdW0gc2ltdWx0YW5lb3VzIGNvbm5lY3Rpb25zIHRvIHRoZSBwcmlzbWljIHNlcnZlclxudmFyIE1BWF9DT05ORUNUSU9OUyA9IDIwO1xuLy8gTnVtYmVyIG9mIHJlcXVlc3RzIGN1cnJlbnRseSBydW5uaW5nIChjYXBwZWQgYnkgTUFYX0NPTk5FQ1RJT05TKVxudmFyIHJ1bm5pbmcgPSAwO1xuLy8gUmVxdWVzdHMgaW4gcXVldWVcbnZhciBxdWV1ZSA9IFtdO1xuXG52YXIgcHJvY2Vzc1F1ZXVlID0gZnVuY3Rpb24oKSB7XG4gIGlmIChxdWV1ZS5sZW5ndGggPT09IDAgfHwgcnVubmluZyA+PSBNQVhfQ09OTkVDVElPTlMpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgcnVubmluZysrO1xuICB2YXIgbmV4dCA9IHF1ZXVlLnNoaWZ0KCk7XG4gIHZhciBmbiA9IGFqYXhSZXF1ZXN0KCkgfHwgeGRvbWFpblJlcXVlc3QoKSB8fCBub2RlSlNSZXF1ZXN0KCkgfHxcbiAgICAgICAgKGZ1bmN0aW9uKCkgeyB0aHJvdyBuZXcgRXJyb3IoXCJObyByZXF1ZXN0IGhhbmRsZXIgYXZhaWxhYmxlICh0cmllZCBYTUxIdHRwUmVxdWVzdCAmIE5vZGVKUylcIik7IH0pKCk7XG4gIGZuLmNhbGwodGhpcywgbmV4dC51cmwsIGZ1bmN0aW9uKGVycm9yLCByZXN1bHQsIHhociwgdHRsKSB7XG4gICAgcnVubmluZy0tO1xuICAgIG5leHQuY2FsbGJhY2soZXJyb3IsIHJlc3VsdCwgeGhyLCB0dGwpO1xuICAgIHByb2Nlc3NRdWV1ZSgpO1xuICB9KTtcbn07XG5cbnZhciByZXF1ZXN0ID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2spIHtcbiAgcXVldWUucHVzaCh7XG4gICAgJ3VybCc6IHVybCxcbiAgICAnY2FsbGJhY2snOiBjYWxsYmFja1xuICB9KTtcbiAgcHJvY2Vzc1F1ZXVlKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgTUFYX0NPTk5FQ1RJT05TOiBNQVhfQ09OTkVDVElPTlMsIC8vIE51bWJlciBvZiBtYXhpbXVtIHNpbXVsdGFuZW91cyBjb25uZWN0aW9ucyB0byB0aGUgcHJpc21pYyBzZXJ2ZXJcbiAgcmVxdWVzdDogcmVxdWVzdFxufTtcbiIsInZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cdHZhciBQTFVTX1VSTF9TQUZFID0gJy0nLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIX1VSTF9TQUZFID0gJ18nLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUyB8fFxuXHRcdCAgICBjb2RlID09PSBQTFVTX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSCB8fFxuXHRcdCAgICBjb2RlID09PSBTTEFTSF9VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuIiwiIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG52YXIgcm9vdFBhcmVudCA9IHt9XG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIER1ZSB0byB2YXJpb3VzIGJyb3dzZXIgYnVncywgc29tZXRpbWVzIHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkIGV2ZW5cbiAqIHdoZW4gdGhlIGJyb3dzZXIgc3VwcG9ydHMgdHlwZWQgYXJyYXlzLlxuICpcbiAqIE5vdGU6XG4gKlxuICogICAtIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcyxcbiAqICAgICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgIC0gU2FmYXJpIDUtNyBsYWNrcyBzdXBwb3J0IGZvciBjaGFuZ2luZyB0aGUgYE9iamVjdC5wcm90b3R5cGUuY29uc3RydWN0b3JgIHByb3BlcnR5XG4gKiAgICAgb24gb2JqZWN0cy5cbiAqXG4gKiAgIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleVxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgYmVoYXZlcyBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlQgIT09IHVuZGVmaW5lZFxuICA/IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gIDogdHlwZWRBcnJheVN1cHBvcnQoKVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIGZ1bmN0aW9uIEJhciAoKSB7fVxuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgYXJyLmNvbnN0cnVjdG9yID0gQmFyXG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgYXJyLmNvbnN0cnVjdG9yID09PSBCYXIgJiYgLy8gY29uc3RydWN0b3IgY2FuIGJlIHNldFxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nICYmIC8vIGNocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICAgICAgICBhcnIuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuZnVuY3Rpb24ga01heExlbmd0aCAoKSB7XG4gIHJldHVybiBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVFxuICAgID8gMHg3ZmZmZmZmZlxuICAgIDogMHgzZmZmZmZmZlxufVxuXG4vKipcbiAqIENsYXNzOiBCdWZmZXJcbiAqID09PT09PT09PT09PT1cbiAqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGFyZSBhdWdtZW50ZWRcbiAqIHdpdGggZnVuY3Rpb24gcHJvcGVydGllcyBmb3IgYWxsIHRoZSBub2RlIGBCdWZmZXJgIEFQSSBmdW5jdGlvbnMuIFdlIHVzZVxuICogYFVpbnQ4QXJyYXlgIHNvIHRoYXQgc3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXQgcmV0dXJuc1xuICogYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogQnkgYXVnbWVudGluZyB0aGUgaW5zdGFuY2VzLCB3ZSBjYW4gYXZvaWQgbW9kaWZ5aW5nIHRoZSBgVWludDhBcnJheWBcbiAqIHByb3RvdHlwZS5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChhcmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAvLyBBdm9pZCBnb2luZyB0aHJvdWdoIGFuIEFyZ3VtZW50c0FkYXB0b3JUcmFtcG9saW5lIGluIHRoZSBjb21tb24gY2FzZS5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHJldHVybiBuZXcgQnVmZmVyKGFyZywgYXJndW1lbnRzWzFdKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKGFyZylcbiAgfVxuXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzLmxlbmd0aCA9IDBcbiAgICB0aGlzLnBhcmVudCA9IHVuZGVmaW5lZFxuICB9XG5cbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBmcm9tTnVtYmVyKHRoaXMsIGFyZylcbiAgfVxuXG4gIC8vIFNsaWdodGx5IGxlc3MgY29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoaXMsIGFyZywgYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiAndXRmOCcpXG4gIH1cblxuICAvLyBVbnVzdWFsLlxuICByZXR1cm4gZnJvbU9iamVjdCh0aGlzLCBhcmcpXG59XG5cbmZ1bmN0aW9uIGZyb21OdW1iZXIgKHRoYXQsIGxlbmd0aCkge1xuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGxlbmd0aCkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdGhhdFtpXSA9IDBcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgLy8gQXNzdW1wdGlvbjogYnl0ZUxlbmd0aCgpIHJldHVybiB2YWx1ZSBpcyBhbHdheXMgPCBrTWF4TGVuZ3RoLlxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICB0aGF0LndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iamVjdCkpIHJldHVybiBmcm9tQnVmZmVyKHRoYXQsIG9iamVjdClcblxuICBpZiAoaXNBcnJheShvYmplY3QpKSByZXR1cm4gZnJvbUFycmF5KHRoYXQsIG9iamVjdClcblxuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG4gIH1cblxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChvYmplY3QuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tVHlwZWRBcnJheSh0aGF0LCBvYmplY3QpXG4gICAgfVxuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih0aGF0LCBvYmplY3QpXG4gICAgfVxuICB9XG5cbiAgaWYgKG9iamVjdC5sZW5ndGgpIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iamVjdClcblxuICByZXR1cm4gZnJvbUpzb25PYmplY3QodGhhdCwgb2JqZWN0KVxufVxuXG5mdW5jdGlvbiBmcm9tQnVmZmVyICh0aGF0LCBidWZmZXIpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYnVmZmVyLmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGJ1ZmZlci5jb3B5KHRoYXQsIDAsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRHVwbGljYXRlIG9mIGZyb21BcnJheSgpIHRvIGtlZXAgZnJvbUFycmF5KCkgbW9ub21vcnBoaWMuXG5mdW5jdGlvbiBmcm9tVHlwZWRBcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgLy8gVHJ1bmNhdGluZyB0aGUgZWxlbWVudHMgaXMgcHJvYmFibHkgbm90IHdoYXQgcGVvcGxlIGV4cGVjdCBmcm9tIHR5cGVkXG4gIC8vIGFycmF5cyB3aXRoIEJZVEVTX1BFUl9FTEVNRU5UID4gMSBidXQgaXQncyBjb21wYXRpYmxlIHdpdGggdGhlIGJlaGF2aW9yXG4gIC8vIG9mIHRoZSBvbGQgQnVmZmVyIGNvbnN0cnVjdG9yLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyICh0aGF0LCBhcnJheSkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICBhcnJheS5ieXRlTGVuZ3RoXG4gICAgdGhhdCA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQgPSBmcm9tVHlwZWRBcnJheSh0aGF0LCBuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIERlc2VyaWFsaXplIHsgdHlwZTogJ0J1ZmZlcicsIGRhdGE6IFsxLDIsMywuLi5dIH0gaW50byBhIEJ1ZmZlciBvYmplY3QuXG4vLyBSZXR1cm5zIGEgemVyby1sZW5ndGggYnVmZmVyIGZvciBpbnB1dHMgdGhhdCBkb24ndCBjb25mb3JtIHRvIHRoZSBzcGVjLlxuZnVuY3Rpb24gZnJvbUpzb25PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICB2YXIgYXJyYXlcbiAgdmFyIGxlbmd0aCA9IDBcblxuICBpZiAob2JqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqZWN0LmRhdGEpKSB7XG4gICAgYXJyYXkgPSBvYmplY3QuZGF0YVxuICAgIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgfVxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5pZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuICBCdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxufSBlbHNlIHtcbiAgLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbiAgQnVmZmVyLnByb3RvdHlwZS5sZW5ndGggPSB1bmRlZmluZWRcbiAgQnVmZmVyLnByb3RvdHlwZS5wYXJlbnQgPSB1bmRlZmluZWRcbn1cblxuZnVuY3Rpb24gYWxsb2NhdGUgKHRoYXQsIGxlbmd0aCkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGxlbmd0aCkpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQubGVuZ3RoID0gbGVuZ3RoXG4gICAgdGhhdC5faXNCdWZmZXIgPSB0cnVlXG4gIH1cblxuICB2YXIgZnJvbVBvb2wgPSBsZW5ndGggIT09IDAgJiYgbGVuZ3RoIDw9IEJ1ZmZlci5wb29sU2l6ZSA+Pj4gMVxuICBpZiAoZnJvbVBvb2wpIHRoYXQucGFyZW50ID0gcm9vdFBhcmVudFxuXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBrTWF4TGVuZ3RoYCBoZXJlIGJlY2F1c2UgdGhhdCBmYWlscyB3aGVuXG4gIC8vIGxlbmd0aCBpcyBOYU4gKHdoaWNoIGlzIG90aGVyd2lzZSBjb2VyY2VkIHRvIHplcm8uKVxuICBpZiAobGVuZ3RoID49IGtNYXhMZW5ndGgoKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoKCkudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG4gIH1cbiAgcmV0dXJuIGxlbmd0aCB8IDBcbn1cblxuZnVuY3Rpb24gU2xvd0J1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNsb3dCdWZmZXIpKSByZXR1cm4gbmV3IFNsb3dCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGRlbGV0ZSBidWYucGFyZW50XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIHZhciBpID0gMFxuICB2YXIgbGVuID0gTWF0aC5taW4oeCwgeSlcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgYnJlYWtcblxuICAgICsraVxuICB9XG5cbiAgaWYgKGkgIT09IGxlbikge1xuICAgIHggPSBhW2ldXG4gICAgeSA9IGJbaV1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdCBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMuJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihsZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHN0cmluZyA9ICcnICsgc3RyaW5nXG5cbiAgdmFyIGxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKGxlbiA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBVc2UgYSBmb3IgbG9vcCB0byBhdm9pZCByZWN1cnNpb25cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAvLyBEZXByZWNhdGVkXG4gICAgICBjYXNlICdyYXcnOlxuICAgICAgY2FzZSAncmF3cyc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgc3RhcnQgPSBzdGFydCB8IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID09PSBJbmZpbml0eSA/IHRoaXMubGVuZ3RoIDogZW5kIHwgMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGggfCAwXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gMFxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0KSB7XG4gIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgYnl0ZU9mZnNldCA+Pj0gMFxuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG4gIGlmIChieXRlT2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm4gLTFcblxuICAvLyBOZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IE1hdGgubWF4KHRoaXMubGVuZ3RoICsgYnl0ZU9mZnNldCwgMClcblxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xIC8vIHNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nIGFsd2F5cyBmYWlsc1xuICAgIHJldHVybiBTdHJpbmcucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIFsgdmFsIF0sIGJ5dGVPZmZzZXQpXG4gIH1cblxuICBmdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0KSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAodmFyIGkgPSAwOyBieXRlT2Zmc2V0ICsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFycltieXRlT2Zmc2V0ICsgaV0gPT09IHZhbFtmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleF0pIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWwubGVuZ3RoKSByZXR1cm4gYnl0ZU9mZnNldCArIGZvdW5kSW5kZXhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTFcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbi8vIGBnZXRgIGlzIGRlcHJlY2F0ZWRcbkJ1ZmZlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gZ2V0IChvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5nZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLnJlYWRVSW50OChvZmZzZXQpXG59XG5cbi8vIGBzZXRgIGlzIGRlcHJlY2F0ZWRcbkJ1ZmZlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gc2V0ICh2LCBvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5zZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLndyaXRlVUludDgodiwgb2Zmc2V0KVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKHBhcnNlZCkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGggfCAwXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBuZXdCdWYgPSBCdWZmZXIuX2F1Z21lbnQodGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfVxuXG4gIGlmIChuZXdCdWYubGVuZ3RoKSBuZXdCdWYucGFyZW50ID0gdGhpcy5wYXJlbnQgfHwgdGhpc1xuXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYnVmZmVyIG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gd3JpdGVGbG9hdEJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuICB2YXIgaVxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAoaSA9IGxlbiAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIGFzY2VuZGluZyBjb3B5IGZyb20gc3RhcnRcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5fc2V0KHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSwgdGFyZ2V0U3RhcnQpXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAoZW5kIDwgc3RhcnQpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IHZhbHVlXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IHV0ZjhUb0J5dGVzKHZhbHVlLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBgQXJyYXlCdWZmZXJgIHdpdGggdGhlICpjb3BpZWQqIG1lbW9yeSBvZiB0aGUgYnVmZmVyIGluc3RhbmNlLlxuICogQWRkZWQgaW4gTm9kZSAwLjEyLiBPbmx5IGF2YWlsYWJsZSBpbiBicm93c2VycyB0aGF0IHN1cHBvcnQgQXJyYXlCdWZmZXIuXG4gKi9cbkJ1ZmZlci5wcm90b3R5cGUudG9BcnJheUJ1ZmZlciA9IGZ1bmN0aW9uIHRvQXJyYXlCdWZmZXIgKCkge1xuICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgICByZXR1cm4gKG5ldyBCdWZmZXIodGhpcykpLmJ1ZmZlclxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5sZW5ndGgpXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYnVmLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgICAgIGJ1ZltpXSA9IHRoaXNbaV1cbiAgICAgIH1cbiAgICAgIHJldHVybiBidWYuYnVmZmVyXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIF9hdWdtZW50IChhcnIpIHtcbiAgYXJyLmNvbnN0cnVjdG9yID0gQnVmZmVyXG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBzZXQgbWV0aG9kIGJlZm9yZSBvdmVyd3JpdGluZ1xuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmVxdWFscyA9IEJQLmVxdWFsc1xuICBhcnIuY29tcGFyZSA9IEJQLmNvbXBhcmVcbiAgYXJyLmluZGV4T2YgPSBCUC5pbmRleE9mXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnRMRSA9IEJQLnJlYWRVSW50TEVcbiAgYXJyLnJlYWRVSW50QkUgPSBCUC5yZWFkVUludEJFXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludExFID0gQlAucmVhZEludExFXG4gIGFyci5yZWFkSW50QkUgPSBCUC5yZWFkSW50QkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50TEUgPSBCUC53cml0ZVVJbnRMRVxuICBhcnIud3JpdGVVSW50QkUgPSBCUC53cml0ZVVJbnRCRVxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50TEUgPSBCUC53cml0ZUludExFXG4gIGFyci53cml0ZUludEJFID0gQlAud3JpdGVJbnRCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuIiwidmFyIHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG5cbm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgXCIxMDBcIjogXCJDb250aW51ZVwiLFxuICBcIjEwMVwiOiBcIlN3aXRjaGluZyBQcm90b2NvbHNcIixcbiAgXCIxMDJcIjogXCJQcm9jZXNzaW5nXCIsXG4gIFwiMjAwXCI6IFwiT0tcIixcbiAgXCIyMDFcIjogXCJDcmVhdGVkXCIsXG4gIFwiMjAyXCI6IFwiQWNjZXB0ZWRcIixcbiAgXCIyMDNcIjogXCJOb24tQXV0aG9yaXRhdGl2ZSBJbmZvcm1hdGlvblwiLFxuICBcIjIwNFwiOiBcIk5vIENvbnRlbnRcIixcbiAgXCIyMDVcIjogXCJSZXNldCBDb250ZW50XCIsXG4gIFwiMjA2XCI6IFwiUGFydGlhbCBDb250ZW50XCIsXG4gIFwiMjA3XCI6IFwiTXVsdGktU3RhdHVzXCIsXG4gIFwiMzAwXCI6IFwiTXVsdGlwbGUgQ2hvaWNlc1wiLFxuICBcIjMwMVwiOiBcIk1vdmVkIFBlcm1hbmVudGx5XCIsXG4gIFwiMzAyXCI6IFwiTW92ZWQgVGVtcG9yYXJpbHlcIixcbiAgXCIzMDNcIjogXCJTZWUgT3RoZXJcIixcbiAgXCIzMDRcIjogXCJOb3QgTW9kaWZpZWRcIixcbiAgXCIzMDVcIjogXCJVc2UgUHJveHlcIixcbiAgXCIzMDdcIjogXCJUZW1wb3JhcnkgUmVkaXJlY3RcIixcbiAgXCIzMDhcIjogXCJQZXJtYW5lbnQgUmVkaXJlY3RcIixcbiAgXCI0MDBcIjogXCJCYWQgUmVxdWVzdFwiLFxuICBcIjQwMVwiOiBcIlVuYXV0aG9yaXplZFwiLFxuICBcIjQwMlwiOiBcIlBheW1lbnQgUmVxdWlyZWRcIixcbiAgXCI0MDNcIjogXCJGb3JiaWRkZW5cIixcbiAgXCI0MDRcIjogXCJOb3QgRm91bmRcIixcbiAgXCI0MDVcIjogXCJNZXRob2QgTm90IEFsbG93ZWRcIixcbiAgXCI0MDZcIjogXCJOb3QgQWNjZXB0YWJsZVwiLFxuICBcIjQwN1wiOiBcIlByb3h5IEF1dGhlbnRpY2F0aW9uIFJlcXVpcmVkXCIsXG4gIFwiNDA4XCI6IFwiUmVxdWVzdCBUaW1lLW91dFwiLFxuICBcIjQwOVwiOiBcIkNvbmZsaWN0XCIsXG4gIFwiNDEwXCI6IFwiR29uZVwiLFxuICBcIjQxMVwiOiBcIkxlbmd0aCBSZXF1aXJlZFwiLFxuICBcIjQxMlwiOiBcIlByZWNvbmRpdGlvbiBGYWlsZWRcIixcbiAgXCI0MTNcIjogXCJSZXF1ZXN0IEVudGl0eSBUb28gTGFyZ2VcIixcbiAgXCI0MTRcIjogXCJSZXF1ZXN0LVVSSSBUb28gTGFyZ2VcIixcbiAgXCI0MTVcIjogXCJVbnN1cHBvcnRlZCBNZWRpYSBUeXBlXCIsXG4gIFwiNDE2XCI6IFwiUmVxdWVzdGVkIFJhbmdlIE5vdCBTYXRpc2ZpYWJsZVwiLFxuICBcIjQxN1wiOiBcIkV4cGVjdGF0aW9uIEZhaWxlZFwiLFxuICBcIjQxOFwiOiBcIkknbSBhIHRlYXBvdFwiLFxuICBcIjQyMlwiOiBcIlVucHJvY2Vzc2FibGUgRW50aXR5XCIsXG4gIFwiNDIzXCI6IFwiTG9ja2VkXCIsXG4gIFwiNDI0XCI6IFwiRmFpbGVkIERlcGVuZGVuY3lcIixcbiAgXCI0MjVcIjogXCJVbm9yZGVyZWQgQ29sbGVjdGlvblwiLFxuICBcIjQyNlwiOiBcIlVwZ3JhZGUgUmVxdWlyZWRcIixcbiAgXCI0MjhcIjogXCJQcmVjb25kaXRpb24gUmVxdWlyZWRcIixcbiAgXCI0MjlcIjogXCJUb28gTWFueSBSZXF1ZXN0c1wiLFxuICBcIjQzMVwiOiBcIlJlcXVlc3QgSGVhZGVyIEZpZWxkcyBUb28gTGFyZ2VcIixcbiAgXCI1MDBcIjogXCJJbnRlcm5hbCBTZXJ2ZXIgRXJyb3JcIixcbiAgXCI1MDFcIjogXCJOb3QgSW1wbGVtZW50ZWRcIixcbiAgXCI1MDJcIjogXCJCYWQgR2F0ZXdheVwiLFxuICBcIjUwM1wiOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgXCI1MDRcIjogXCJHYXRld2F5IFRpbWUtb3V0XCIsXG4gIFwiNTA1XCI6IFwiSFRUUCBWZXJzaW9uIE5vdCBTdXBwb3J0ZWRcIixcbiAgXCI1MDZcIjogXCJWYXJpYW50IEFsc28gTmVnb3RpYXRlc1wiLFxuICBcIjUwN1wiOiBcIkluc3VmZmljaWVudCBTdG9yYWdlXCIsXG4gIFwiNTA5XCI6IFwiQmFuZHdpZHRoIExpbWl0IEV4Y2VlZGVkXCIsXG4gIFwiNTEwXCI6IFwiTm90IEV4dGVuZGVkXCIsXG4gIFwiNTExXCI6IFwiTmV0d29yayBBdXRoZW50aWNhdGlvbiBSZXF1aXJlZFwiXG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gTk9URTogVGhlc2UgdHlwZSBjaGVja2luZyBmdW5jdGlvbnMgaW50ZW50aW9uYWxseSBkb24ndCB1c2UgYGluc3RhbmNlb2ZgXG4vLyBiZWNhdXNlIGl0IGlzIGZyYWdpbGUgYW5kIGNhbiBiZSBlYXNpbHkgZmFrZWQgd2l0aCBgT2JqZWN0LmNyZWF0ZSgpYC5cblxuZnVuY3Rpb24gaXNBcnJheShhcmcpIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkpIHtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShhcmcpO1xuICB9XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhhcmcpID09PSAnW29iamVjdCBBcnJheV0nO1xufVxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gaXNCb29sZWFuKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nO1xufVxuZXhwb3J0cy5pc0Jvb2xlYW4gPSBpc0Jvb2xlYW47XG5cbmZ1bmN0aW9uIGlzTnVsbChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsID0gaXNOdWxsO1xuXG5mdW5jdGlvbiBpc051bGxPclVuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGxPclVuZGVmaW5lZCA9IGlzTnVsbE9yVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyO1xuXG5mdW5jdGlvbiBpc1N0cmluZyhhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnO1xufVxuZXhwb3J0cy5pc1N0cmluZyA9IGlzU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1N5bWJvbChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnO1xufVxuZXhwb3J0cy5pc1N5bWJvbCA9IGlzU3ltYm9sO1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuZXhwb3J0cy5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gKG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nIHx8IGUgaW5zdGFuY2VvZiBFcnJvcik7XG59XG5leHBvcnRzLmlzRXJyb3IgPSBpc0Vycm9yO1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcgfHwgIC8vIEVTNiBzeW1ib2xcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICd1bmRlZmluZWQnO1xufVxuZXhwb3J0cy5pc1ByaW1pdGl2ZSA9IGlzUHJpbWl0aXZlO1xuXG5leHBvcnRzLmlzQnVmZmVyID0gQnVmZmVyLmlzQnVmZmVyO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG4iLCIvKiFcbiAqIEBvdmVydmlldyBlczYtcHJvbWlzZSAtIGEgdGlueSBpbXBsZW1lbnRhdGlvbiBvZiBQcm9taXNlcy9BKy5cbiAqIEBjb3B5cmlnaHQgQ29weXJpZ2h0IChjKSAyMDE0IFllaHVkYSBLYXR6LCBUb20gRGFsZSwgU3RlZmFuIFBlbm5lciBhbmQgY29udHJpYnV0b3JzIChDb252ZXJzaW9uIHRvIEVTNiBBUEkgYnkgSmFrZSBBcmNoaWJhbGQpXG4gKiBAbGljZW5zZSAgIExpY2Vuc2VkIHVuZGVyIE1JVCBsaWNlbnNlXG4gKiAgICAgICAgICAgIFNlZSBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vamFrZWFyY2hpYmFsZC9lczYtcHJvbWlzZS9tYXN0ZXIvTElDRU5TRVxuICogQHZlcnNpb24gICAzLjAuMlxuICovXG5cbihmdW5jdGlvbigpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJG9iamVjdE9yRnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nIHx8ICh0eXBlb2YgeCA9PT0gJ29iamVjdCcgJiYgeCAhPT0gbnVsbCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzTWF5YmVUaGVuYWJsZSh4KSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdvYmplY3QnICYmIHggIT09IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXk7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5ID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzQXJyYXkgPSBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5O1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuID0gMDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQ7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbjtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcCA9IGZ1bmN0aW9uIGFzYXAoY2FsbGJhY2ssIGFyZykge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2xpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW5dID0gY2FsbGJhY2s7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiArIDFdID0gYXJnO1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiArPSAyO1xuICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gPT09IDIpIHtcbiAgICAgICAgLy8gSWYgbGVuIGlzIDIsIHRoYXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHNjaGVkdWxlIGFuIGFzeW5jIGZsdXNoLlxuICAgICAgICAvLyBJZiBhZGRpdGlvbmFsIGNhbGxiYWNrcyBhcmUgcXVldWVkIGJlZm9yZSB0aGUgcXVldWUgaXMgZmx1c2hlZCwgdGhleVxuICAgICAgICAvLyB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGlzIGZsdXNoIHRoYXQgd2UgYXJlIHNjaGVkdWxpbmcuXG4gICAgICAgIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm4pIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm4obGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldFNjaGVkdWxlcihzY2hlZHVsZUZuKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm4gPSBzY2hlZHVsZUZuO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRBc2FwKGFzYXBGbikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAgPSBhc2FwRm47XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyV2luZG93ID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSA/IHdpbmRvdyA6IHVuZGVmaW5lZDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJHbG9iYWwgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3NlcldpbmRvdyB8fCB7fTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJHbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3Nlckdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNOb2RlID0gdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHt9LnRvU3RyaW5nLmNhbGwocHJvY2VzcykgPT09ICdbb2JqZWN0IHByb2Nlc3NdJztcblxuICAgIC8vIHRlc3QgZm9yIHdlYiB3b3JrZXIgYnV0IG5vdCBpbiBJRTEwXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc1dvcmtlciA9IHR5cGVvZiBVaW50OENsYW1wZWRBcnJheSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIHR5cGVvZiBpbXBvcnRTY3JpcHRzICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgdHlwZW9mIE1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJztcblxuICAgIC8vIG5vZGVcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTmV4dFRpY2soKSB7XG4gICAgICAvLyBub2RlIHZlcnNpb24gMC4xMC54IGRpc3BsYXlzIGEgZGVwcmVjYXRpb24gd2FybmluZyB3aGVuIG5leHRUaWNrIGlzIHVzZWQgcmVjdXJzaXZlbHlcbiAgICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vY3Vqb2pzL3doZW4vaXNzdWVzLzQxMCBmb3IgZGV0YWlsc1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBwcm9jZXNzLm5leHRUaWNrKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIHZlcnR4XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVZlcnR4VGltZXIoKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU11dGF0aW9uT2JzZXJ2ZXIoKSB7XG4gICAgICB2YXIgaXRlcmF0aW9ucyA9IDA7XG4gICAgICB2YXIgb2JzZXJ2ZXIgPSBuZXcgbGliJGVzNiRwcm9taXNlJGFzYXAkJEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgICAgIG9ic2VydmVyLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhOiB0cnVlIH0pO1xuXG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIG5vZGUuZGF0YSA9IChpdGVyYXRpb25zID0gKytpdGVyYXRpb25zICUgMik7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIHdlYiB3b3JrZXJcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTWVzc2FnZUNoYW5uZWwoKSB7XG4gICAgICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2g7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlU2V0VGltZW91dCgpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgc2V0VGltZW91dChsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gsIDEpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlID0gbmV3IEFycmF5KDEwMDApO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbjsgaSs9Mikge1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaV07XG4gICAgICAgIHZhciBhcmcgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaSsxXTtcblxuICAgICAgICBjYWxsYmFjayhhcmcpO1xuXG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2krMV0gPSB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gPSAwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhdHRlbXB0VmVydHgoKSB7XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgciA9IHJlcXVpcmU7XG4gICAgICAgIHZhciB2ZXJ0eCA9IHIoJ3ZlcnR4Jyk7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQgPSB2ZXJ0eC5ydW5Pbkxvb3AgfHwgdmVydHgucnVuT25Db250ZXh0O1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVZlcnR4VGltZXIoKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVNldFRpbWVvdXQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2g7XG4gICAgLy8gRGVjaWRlIHdoYXQgYXN5bmMgbWV0aG9kIHRvIHVzZSB0byB0cmlnZ2VyaW5nIHByb2Nlc3Npbmcgb2YgcXVldWVkIGNhbGxiYWNrczpcbiAgICBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGlzTm9kZSkge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTmV4dFRpY2soKTtcbiAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRCcm93c2VyTXV0YXRpb25PYnNlcnZlcikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTXV0YXRpb25PYnNlcnZlcigpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGlzV29ya2VyKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNZXNzYWdlQ2hhbm5lbCgpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJXaW5kb3cgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXR0ZW1wdFZlcnR4KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVNldFRpbWVvdXQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKCkge31cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HICAgPSB2b2lkIDA7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCA9IDE7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEICA9IDI7XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IgPSBuZXcgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRXJyb3JPYmplY3QoKTtcblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHNlbGZGdWxmaWxsbWVudCgpIHtcbiAgICAgIHJldHVybiBuZXcgVHlwZUVycm9yKFwiWW91IGNhbm5vdCByZXNvbHZlIGEgcHJvbWlzZSB3aXRoIGl0c2VsZlwiKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRjYW5ub3RSZXR1cm5Pd24oKSB7XG4gICAgICByZXR1cm4gbmV3IFR5cGVFcnJvcignQSBwcm9taXNlcyBjYWxsYmFjayBjYW5ub3QgcmV0dXJuIHRoYXQgc2FtZSBwcm9taXNlLicpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGdldFRoZW4ocHJvbWlzZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHByb21pc2UudGhlbjtcbiAgICAgIH0gY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IuZXJyb3IgPSBlcnJvcjtcbiAgICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeVRoZW4odGhlbiwgdmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhlbi5jYWxsKHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSwgdGhlbikge1xuICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGZ1bmN0aW9uKHByb21pc2UpIHtcbiAgICAgICAgdmFyIHNlYWxlZCA9IGZhbHNlO1xuICAgICAgICB2YXIgZXJyb3IgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlUaGVuKHRoZW4sIHRoZW5hYmxlLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgIGlmIChzZWFsZWQpIHsgcmV0dXJuOyB9XG4gICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcbiAgICAgICAgICBpZiAodGhlbmFibGUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICBpZiAoc2VhbGVkKSB7IHJldHVybjsgfVxuICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG5cbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgICAgfSwgJ1NldHRsZTogJyArIChwcm9taXNlLl9sYWJlbCB8fCAnIHVua25vd24gcHJvbWlzZScpKTtcblxuICAgICAgICBpZiAoIXNlYWxlZCAmJiBlcnJvcikge1xuICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSwgcHJvbWlzZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgdGhlbmFibGUpIHtcbiAgICAgIGlmICh0aGVuYWJsZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuICAgICAgfSBlbHNlIGlmICh0aGVuYWJsZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZSh0aGVuYWJsZSwgdW5kZWZpbmVkLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlKSB7XG4gICAgICBpZiAobWF5YmVUaGVuYWJsZS5jb25zdHJ1Y3RvciA9PT0gcHJvbWlzZS5jb25zdHJ1Y3Rvcikge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciB0aGVuID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZ2V0VGhlbihtYXliZVRoZW5hYmxlKTtcblxuICAgICAgICBpZiAodGhlbiA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IuZXJyb3IpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoZW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKHRoZW4pKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKSB7XG4gICAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHNlbGZGdWxmaWxsbWVudCgpKTtcbiAgICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRvYmplY3RPckZ1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2hSZWplY3Rpb24ocHJvbWlzZSkge1xuICAgICAgaWYgKHByb21pc2UuX29uZXJyb3IpIHtcbiAgICAgICAgcHJvbWlzZS5fb25lcnJvcihwcm9taXNlLl9yZXN1bHQpO1xuICAgICAgfVxuXG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoKHByb21pc2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpIHtcbiAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykgeyByZXR1cm47IH1cblxuICAgICAgcHJvbWlzZS5fcmVzdWx0ID0gdmFsdWU7XG4gICAgICBwcm9taXNlLl9zdGF0ZSA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRDtcblxuICAgICAgaWYgKHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoLCBwcm9taXNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKSB7XG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHsgcmV0dXJuOyB9XG4gICAgICBwcm9taXNlLl9zdGF0ZSA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEO1xuICAgICAgcHJvbWlzZS5fcmVzdWx0ID0gcmVhc29uO1xuXG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoUmVqZWN0aW9uLCBwcm9taXNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgICAgIHZhciBzdWJzY3JpYmVycyA9IHBhcmVudC5fc3Vic2NyaWJlcnM7XG4gICAgICB2YXIgbGVuZ3RoID0gc3Vic2NyaWJlcnMubGVuZ3RoO1xuXG4gICAgICBwYXJlbnQuX29uZXJyb3IgPSBudWxsO1xuXG4gICAgICBzdWJzY3JpYmVyc1tsZW5ndGhdID0gY2hpbGQ7XG4gICAgICBzdWJzY3JpYmVyc1tsZW5ndGggKyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRURdID0gb25GdWxmaWxsbWVudDtcbiAgICAgIHN1YnNjcmliZXJzW2xlbmd0aCArIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEXSAgPSBvblJlamVjdGlvbjtcblxuICAgICAgaWYgKGxlbmd0aCA9PT0gMCAmJiBwYXJlbnQuX3N0YXRlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gsIHBhcmVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaChwcm9taXNlKSB7XG4gICAgICB2YXIgc3Vic2NyaWJlcnMgPSBwcm9taXNlLl9zdWJzY3JpYmVycztcbiAgICAgIHZhciBzZXR0bGVkID0gcHJvbWlzZS5fc3RhdGU7XG5cbiAgICAgIGlmIChzdWJzY3JpYmVycy5sZW5ndGggPT09IDApIHsgcmV0dXJuOyB9XG5cbiAgICAgIHZhciBjaGlsZCwgY2FsbGJhY2ssIGRldGFpbCA9IHByb21pc2UuX3Jlc3VsdDtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWJzY3JpYmVycy5sZW5ndGg7IGkgKz0gMykge1xuICAgICAgICBjaGlsZCA9IHN1YnNjcmliZXJzW2ldO1xuICAgICAgICBjYWxsYmFjayA9IHN1YnNjcmliZXJzW2kgKyBzZXR0bGVkXTtcblxuICAgICAgICBpZiAoY2hpbGQpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBjaGlsZCwgY2FsbGJhY2ssIGRldGFpbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2FsbGJhY2soZGV0YWlsKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEVycm9yT2JqZWN0KCkge1xuICAgICAgdGhpcy5lcnJvciA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUiA9IG5ldyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRFcnJvck9iamVjdCgpO1xuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGRldGFpbCk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkVFJZX0NBVENIX0VSUk9SLmVycm9yID0gZTtcbiAgICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBwcm9taXNlLCBjYWxsYmFjaywgZGV0YWlsKSB7XG4gICAgICB2YXIgaGFzQ2FsbGJhY2sgPSBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzRnVuY3Rpb24oY2FsbGJhY2spLFxuICAgICAgICAgIHZhbHVlLCBlcnJvciwgc3VjY2VlZGVkLCBmYWlsZWQ7XG5cbiAgICAgIGlmIChoYXNDYWxsYmFjaykge1xuICAgICAgICB2YWx1ZSA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeUNhdGNoKGNhbGxiYWNrLCBkZXRhaWwpO1xuXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkVFJZX0NBVENIX0VSUk9SKSB7XG4gICAgICAgICAgZmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgICBlcnJvciA9IHZhbHVlLmVycm9yO1xuICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGNhbm5vdFJldHVybk93bigpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgPSBkZXRhaWw7XG4gICAgICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykge1xuICAgICAgICAvLyBub29wXG4gICAgICB9IGVsc2UgaWYgKGhhc0NhbGxiYWNrICYmIHN1Y2NlZWRlZCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoZmFpbGVkKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbml0aWFsaXplUHJvbWlzZShwcm9taXNlLCByZXNvbHZlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzb2x2ZXIoZnVuY3Rpb24gcmVzb2x2ZVByb21pc2UodmFsdWUpe1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICB9LCBmdW5jdGlvbiByZWplY3RQcm9taXNlKHJlYXNvbikge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IoQ29uc3RydWN0b3IsIGlucHV0KSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG5cbiAgICAgIGVudW1lcmF0b3IuX2luc3RhbmNlQ29uc3RydWN0b3IgPSBDb25zdHJ1Y3RvcjtcbiAgICAgIGVudW1lcmF0b3IucHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcblxuICAgICAgaWYgKGVudW1lcmF0b3IuX3ZhbGlkYXRlSW5wdXQoaW5wdXQpKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX2lucHV0ICAgICA9IGlucHV0O1xuICAgICAgICBlbnVtZXJhdG9yLmxlbmd0aCAgICAgPSBpbnB1dC5sZW5ndGg7XG4gICAgICAgIGVudW1lcmF0b3IuX3JlbWFpbmluZyA9IGlucHV0Lmxlbmd0aDtcblxuICAgICAgICBlbnVtZXJhdG9yLl9pbml0KCk7XG5cbiAgICAgICAgaWYgKGVudW1lcmF0b3IubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChlbnVtZXJhdG9yLnByb21pc2UsIGVudW1lcmF0b3IuX3Jlc3VsdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZW51bWVyYXRvci5sZW5ndGggPSBlbnVtZXJhdG9yLmxlbmd0aCB8fCAwO1xuICAgICAgICAgIGVudW1lcmF0b3IuX2VudW1lcmF0ZSgpO1xuICAgICAgICAgIGlmIChlbnVtZXJhdG9yLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwoZW51bWVyYXRvci5wcm9taXNlLCBlbnVtZXJhdG9yLl9yZXN1bHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KGVudW1lcmF0b3IucHJvbWlzZSwgZW51bWVyYXRvci5fdmFsaWRhdGlvbkVycm9yKCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fdmFsaWRhdGVJbnB1dCA9IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0FycmF5KGlucHV0KTtcbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl92YWxpZGF0aW9uRXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgRXJyb3IoJ0FycmF5IE1ldGhvZHMgbXVzdCBiZSBwcm92aWRlZCBhbiBBcnJheScpO1xuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX3Jlc3VsdCA9IG5ldyBBcnJheSh0aGlzLmxlbmd0aCk7XG4gICAgfTtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yO1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9lbnVtZXJhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcblxuICAgICAgdmFyIGxlbmd0aCAgPSBlbnVtZXJhdG9yLmxlbmd0aDtcbiAgICAgIHZhciBwcm9taXNlID0gZW51bWVyYXRvci5wcm9taXNlO1xuICAgICAgdmFyIGlucHV0ICAgPSBlbnVtZXJhdG9yLl9pbnB1dDtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IHByb21pc2UuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HICYmIGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBlbnVtZXJhdG9yLl9lYWNoRW50cnkoaW5wdXRbaV0sIGkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX2VhY2hFbnRyeSA9IGZ1bmN0aW9uKGVudHJ5LCBpKSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG4gICAgICB2YXIgYyA9IGVudW1lcmF0b3IuX2luc3RhbmNlQ29uc3RydWN0b3I7XG5cbiAgICAgIGlmIChsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzTWF5YmVUaGVuYWJsZShlbnRyeSkpIHtcbiAgICAgICAgaWYgKGVudHJ5LmNvbnN0cnVjdG9yID09PSBjICYmIGVudHJ5Ll9zdGF0ZSAhPT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykge1xuICAgICAgICAgIGVudHJ5Ll9vbmVycm9yID0gbnVsbDtcbiAgICAgICAgICBlbnVtZXJhdG9yLl9zZXR0bGVkQXQoZW50cnkuX3N0YXRlLCBpLCBlbnRyeS5fcmVzdWx0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbnVtZXJhdG9yLl93aWxsU2V0dGxlQXQoYy5yZXNvbHZlKGVudHJ5KSwgaSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVudW1lcmF0b3IuX3JlbWFpbmluZy0tO1xuICAgICAgICBlbnVtZXJhdG9yLl9yZXN1bHRbaV0gPSBlbnRyeTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9zZXR0bGVkQXQgPSBmdW5jdGlvbihzdGF0ZSwgaSwgdmFsdWUpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcbiAgICAgIHZhciBwcm9taXNlID0gZW51bWVyYXRvci5wcm9taXNlO1xuXG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHtcbiAgICAgICAgZW51bWVyYXRvci5fcmVtYWluaW5nLS07XG5cbiAgICAgICAgaWYgKHN0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZW51bWVyYXRvci5fcmVzdWx0W2ldID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGVudW1lcmF0b3IuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIGVudW1lcmF0b3IuX3Jlc3VsdCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fd2lsbFNldHRsZUF0ID0gZnVuY3Rpb24ocHJvbWlzZSwgaSkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUocHJvbWlzZSwgdW5kZWZpbmVkLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICBlbnVtZXJhdG9yLl9zZXR0bGVkQXQobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVELCBpLCB2YWx1ZSk7XG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgZW51bWVyYXRvci5fc2V0dGxlZEF0KGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVELCBpLCByZWFzb24pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRhbGwkJGFsbChlbnRyaWVzKSB7XG4gICAgICByZXR1cm4gbmV3IGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRkZWZhdWx0KHRoaXMsIGVudHJpZXMpLnByb21pc2U7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRhbGwkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRhbGwkJGFsbDtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyYWNlJCRyYWNlKGVudHJpZXMpIHtcbiAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcblxuICAgICAgaWYgKCFsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gcmFjZS4nKSk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgICAgfVxuXG4gICAgICB2YXIgbGVuZ3RoID0gZW50cmllcy5sZW5ndGg7XG5cbiAgICAgIGZ1bmN0aW9uIG9uRnVsZmlsbG1lbnQodmFsdWUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIG9uUmVqZWN0aW9uKHJlYXNvbikge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IDA7IHByb21pc2UuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HICYmIGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUoQ29uc3RydWN0b3IucmVzb2x2ZShlbnRyaWVzW2ldKSwgdW5kZWZpbmVkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJHJhY2U7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkcmVzb2x2ZShvYmplY3QpIHtcbiAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gICAgICBpZiAob2JqZWN0ICYmIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmIG9iamVjdC5jb25zdHJ1Y3RvciA9PT0gQ29uc3RydWN0b3IpIHtcbiAgICAgICAgcmV0dXJuIG9iamVjdDtcbiAgICAgIH1cblxuICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIG9iamVjdCk7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRyZXNvbHZlO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkcmVqZWN0KHJlYXNvbikge1xuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJHJlamVjdDtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkY291bnRlciA9IDA7XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNSZXNvbHZlcigpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYSByZXNvbHZlciBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIHByb21pc2UgY29uc3RydWN0b3InKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNOZXcoKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRmFpbGVkIHRvIGNvbnN0cnVjdCAnUHJvbWlzZSc6IFBsZWFzZSB1c2UgdGhlICduZXcnIG9wZXJhdG9yLCB0aGlzIG9iamVjdCBjb25zdHJ1Y3RvciBjYW5ub3QgYmUgY2FsbGVkIGFzIGEgZnVuY3Rpb24uXCIpO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlO1xuICAgIC8qKlxuICAgICAgUHJvbWlzZSBvYmplY3RzIHJlcHJlc2VudCB0aGUgZXZlbnR1YWwgcmVzdWx0IG9mIGFuIGFzeW5jaHJvbm91cyBvcGVyYXRpb24uIFRoZVxuICAgICAgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCwgd2hpY2hcbiAgICAgIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlIHJlYXNvblxuICAgICAgd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG5cbiAgICAgIFRlcm1pbm9sb2d5XG4gICAgICAtLS0tLS0tLS0tLVxuXG4gICAgICAtIGBwcm9taXNlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gd2l0aCBhIGB0aGVuYCBtZXRob2Qgd2hvc2UgYmVoYXZpb3IgY29uZm9ybXMgdG8gdGhpcyBzcGVjaWZpY2F0aW9uLlxuICAgICAgLSBgdGhlbmFibGVgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB0aGF0IGRlZmluZXMgYSBgdGhlbmAgbWV0aG9kLlxuICAgICAgLSBgdmFsdWVgIGlzIGFueSBsZWdhbCBKYXZhU2NyaXB0IHZhbHVlIChpbmNsdWRpbmcgdW5kZWZpbmVkLCBhIHRoZW5hYmxlLCBvciBhIHByb21pc2UpLlxuICAgICAgLSBgZXhjZXB0aW9uYCBpcyBhIHZhbHVlIHRoYXQgaXMgdGhyb3duIHVzaW5nIHRoZSB0aHJvdyBzdGF0ZW1lbnQuXG4gICAgICAtIGByZWFzb25gIGlzIGEgdmFsdWUgdGhhdCBpbmRpY2F0ZXMgd2h5IGEgcHJvbWlzZSB3YXMgcmVqZWN0ZWQuXG4gICAgICAtIGBzZXR0bGVkYCB0aGUgZmluYWwgcmVzdGluZyBzdGF0ZSBvZiBhIHByb21pc2UsIGZ1bGZpbGxlZCBvciByZWplY3RlZC5cblxuICAgICAgQSBwcm9taXNlIGNhbiBiZSBpbiBvbmUgb2YgdGhyZWUgc3RhdGVzOiBwZW5kaW5nLCBmdWxmaWxsZWQsIG9yIHJlamVjdGVkLlxuXG4gICAgICBQcm9taXNlcyB0aGF0IGFyZSBmdWxmaWxsZWQgaGF2ZSBhIGZ1bGZpbGxtZW50IHZhbHVlIGFuZCBhcmUgaW4gdGhlIGZ1bGZpbGxlZFxuICAgICAgc3RhdGUuICBQcm9taXNlcyB0aGF0IGFyZSByZWplY3RlZCBoYXZlIGEgcmVqZWN0aW9uIHJlYXNvbiBhbmQgYXJlIGluIHRoZVxuICAgICAgcmVqZWN0ZWQgc3RhdGUuICBBIGZ1bGZpbGxtZW50IHZhbHVlIGlzIG5ldmVyIGEgdGhlbmFibGUuXG5cbiAgICAgIFByb21pc2VzIGNhbiBhbHNvIGJlIHNhaWQgdG8gKnJlc29sdmUqIGEgdmFsdWUuICBJZiB0aGlzIHZhbHVlIGlzIGFsc28gYVxuICAgICAgcHJvbWlzZSwgdGhlbiB0aGUgb3JpZ2luYWwgcHJvbWlzZSdzIHNldHRsZWQgc3RhdGUgd2lsbCBtYXRjaCB0aGUgdmFsdWUnc1xuICAgICAgc2V0dGxlZCBzdGF0ZS4gIFNvIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgcmVqZWN0cyB3aWxsXG4gICAgICBpdHNlbGYgcmVqZWN0LCBhbmQgYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCBmdWxmaWxscyB3aWxsXG4gICAgICBpdHNlbGYgZnVsZmlsbC5cblxuXG4gICAgICBCYXNpYyBVc2FnZTpcbiAgICAgIC0tLS0tLS0tLS0tLVxuXG4gICAgICBgYGBqc1xuICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgLy8gb24gc3VjY2Vzc1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcblxuICAgICAgICAvLyBvbiBmYWlsdXJlXG4gICAgICAgIHJlamVjdChyZWFzb24pO1xuICAgICAgfSk7XG5cbiAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAvLyBvbiBmdWxmaWxsbWVudFxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIC8vIG9uIHJlamVjdGlvblxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQWR2YW5jZWQgVXNhZ2U6XG4gICAgICAtLS0tLS0tLS0tLS0tLS1cblxuICAgICAgUHJvbWlzZXMgc2hpbmUgd2hlbiBhYnN0cmFjdGluZyBhd2F5IGFzeW5jaHJvbm91cyBpbnRlcmFjdGlvbnMgc3VjaCBhc1xuICAgICAgYFhNTEh0dHBSZXF1ZXN0YHMuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmdW5jdGlvbiBnZXRKU09OKHVybCkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgICB4aHIub3BlbignR0VUJywgdXJsKTtcbiAgICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gaGFuZGxlcjtcbiAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgIHhoci5zZW5kKCk7XG5cbiAgICAgICAgICBmdW5jdGlvbiBoYW5kbGVyKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5ET05FKSB7XG4gICAgICAgICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdnZXRKU09OOiBgJyArIHVybCArICdgIGZhaWxlZCB3aXRoIHN0YXR1czogWycgKyB0aGlzLnN0YXR1cyArICddJykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGdldEpTT04oJy9wb3N0cy5qc29uJykudGhlbihmdW5jdGlvbihqc29uKSB7XG4gICAgICAgIC8vIG9uIGZ1bGZpbGxtZW50XG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgLy8gb24gcmVqZWN0aW9uXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBVbmxpa2UgY2FsbGJhY2tzLCBwcm9taXNlcyBhcmUgZ3JlYXQgY29tcG9zYWJsZSBwcmltaXRpdmVzLlxuXG4gICAgICBgYGBqc1xuICAgICAgUHJvbWlzZS5hbGwoW1xuICAgICAgICBnZXRKU09OKCcvcG9zdHMnKSxcbiAgICAgICAgZ2V0SlNPTignL2NvbW1lbnRzJylcbiAgICAgIF0pLnRoZW4oZnVuY3Rpb24odmFsdWVzKXtcbiAgICAgICAgdmFsdWVzWzBdIC8vID0+IHBvc3RzSlNPTlxuICAgICAgICB2YWx1ZXNbMV0gLy8gPT4gY29tbWVudHNKU09OXG5cbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEBjbGFzcyBQcm9taXNlXG4gICAgICBAcGFyYW0ge2Z1bmN0aW9ufSByZXNvbHZlclxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQGNvbnN0cnVjdG9yXG4gICAgKi9cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZShyZXNvbHZlcikge1xuICAgICAgdGhpcy5faWQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkY291bnRlcisrO1xuICAgICAgdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLl9yZXN1bHQgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLl9zdWJzY3JpYmVycyA9IFtdO1xuXG4gICAgICBpZiAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCAhPT0gcmVzb2x2ZXIpIHtcbiAgICAgICAgaWYgKCFsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzRnVuY3Rpb24ocmVzb2x2ZXIpKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzUmVzb2x2ZXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZSkpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNOZXcoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGluaXRpYWxpemVQcm9taXNlKHRoaXMsIHJlc29sdmVyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5hbGwgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRhbGwkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmFjZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmVzb2x2ZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmVqZWN0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRkZWZhdWx0O1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLl9zZXRTY2hlZHVsZXIgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0U2NoZWR1bGVyO1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLl9zZXRBc2FwID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldEFzYXA7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuX2FzYXAgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcDtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLnByb3RvdHlwZSA9IHtcbiAgICAgIGNvbnN0cnVjdG9yOiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZSxcblxuICAgIC8qKlxuICAgICAgVGhlIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsXG4gICAgICB3aGljaCByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZVxuICAgICAgcmVhc29uIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAvLyB1c2VyIGlzIGF2YWlsYWJsZVxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gdXNlciBpcyB1bmF2YWlsYWJsZSwgYW5kIHlvdSBhcmUgZ2l2ZW4gdGhlIHJlYXNvbiB3aHlcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIENoYWluaW5nXG4gICAgICAtLS0tLS0tLVxuXG4gICAgICBUaGUgcmV0dXJuIHZhbHVlIG9mIGB0aGVuYCBpcyBpdHNlbGYgYSBwcm9taXNlLiAgVGhpcyBzZWNvbmQsICdkb3duc3RyZWFtJ1xuICAgICAgcHJvbWlzZSBpcyByZXNvbHZlZCB3aXRoIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZpcnN0IHByb21pc2UncyBmdWxmaWxsbWVudFxuICAgICAgb3IgcmVqZWN0aW9uIGhhbmRsZXIsIG9yIHJlamVjdGVkIGlmIHRoZSBoYW5kbGVyIHRocm93cyBhbiBleGNlcHRpb24uXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgcmV0dXJuIHVzZXIubmFtZTtcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgcmV0dXJuICdkZWZhdWx0IG5hbWUnO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodXNlck5hbWUpIHtcbiAgICAgICAgLy8gSWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGB1c2VyTmFtZWAgd2lsbCBiZSB0aGUgdXNlcidzIG5hbWUsIG90aGVyd2lzZSBpdFxuICAgICAgICAvLyB3aWxsIGJlIGAnZGVmYXVsdCBuYW1lJ2BcbiAgICAgIH0pO1xuXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScpO1xuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgLy8gaWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGByZWFzb25gIHdpbGwgYmUgJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jy5cbiAgICAgICAgLy8gSWYgYGZpbmRVc2VyYCByZWplY3RlZCwgYHJlYXNvbmAgd2lsbCBiZSAnYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScuXG4gICAgICB9KTtcbiAgICAgIGBgYFxuICAgICAgSWYgdGhlIGRvd25zdHJlYW0gcHJvbWlzZSBkb2VzIG5vdCBzcGVjaWZ5IGEgcmVqZWN0aW9uIGhhbmRsZXIsIHJlamVjdGlvbiByZWFzb25zIHdpbGwgYmUgcHJvcGFnYXRlZCBmdXJ0aGVyIGRvd25zdHJlYW0uXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFBlZGFnb2dpY2FsRXhjZXB0aW9uKCdVcHN0cmVhbSBlcnJvcicpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAvLyBUaGUgYFBlZGdhZ29jaWFsRXhjZXB0aW9uYCBpcyBwcm9wYWdhdGVkIGFsbCB0aGUgd2F5IGRvd24gdG8gaGVyZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQXNzaW1pbGF0aW9uXG4gICAgICAtLS0tLS0tLS0tLS1cblxuICAgICAgU29tZXRpbWVzIHRoZSB2YWx1ZSB5b3Ugd2FudCB0byBwcm9wYWdhdGUgdG8gYSBkb3duc3RyZWFtIHByb21pc2UgY2FuIG9ubHkgYmVcbiAgICAgIHJldHJpZXZlZCBhc3luY2hyb25vdXNseS4gVGhpcyBjYW4gYmUgYWNoaWV2ZWQgYnkgcmV0dXJuaW5nIGEgcHJvbWlzZSBpbiB0aGVcbiAgICAgIGZ1bGZpbGxtZW50IG9yIHJlamVjdGlvbiBoYW5kbGVyLiBUaGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgdGhlbiBiZSBwZW5kaW5nXG4gICAgICB1bnRpbCB0aGUgcmV0dXJuZWQgcHJvbWlzZSBpcyBzZXR0bGVkLiBUaGlzIGlzIGNhbGxlZCAqYXNzaW1pbGF0aW9uKi5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgICAgICAvLyBUaGUgdXNlcidzIGNvbW1lbnRzIGFyZSBub3cgYXZhaWxhYmxlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBJZiB0aGUgYXNzaW1saWF0ZWQgcHJvbWlzZSByZWplY3RzLCB0aGVuIHRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCBhbHNvIHJlamVjdC5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIGZ1bGZpbGxzLCB3ZSdsbCBoYXZlIHRoZSB2YWx1ZSBoZXJlXG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgcmVqZWN0cywgd2UnbGwgaGF2ZSB0aGUgcmVhc29uIGhlcmVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFNpbXBsZSBFeGFtcGxlXG4gICAgICAtLS0tLS0tLS0tLS0tLVxuXG4gICAgICBTeW5jaHJvbm91cyBFeGFtcGxlXG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIHZhciByZXN1bHQ7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc3VsdCA9IGZpbmRSZXN1bHQoKTtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfVxuICAgICAgYGBgXG5cbiAgICAgIEVycmJhY2sgRXhhbXBsZVxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFJlc3VsdChmdW5jdGlvbihyZXN1bHQsIGVycil7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAvLyBmYWlsdXJlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBQcm9taXNlIEV4YW1wbGU7XG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIGZpbmRSZXN1bHQoKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEFkdmFuY2VkIEV4YW1wbGVcbiAgICAgIC0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgdmFyIGF1dGhvciwgYm9va3M7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGF1dGhvciA9IGZpbmRBdXRob3IoKTtcbiAgICAgICAgYm9va3MgID0gZmluZEJvb2tzQnlBdXRob3IoYXV0aG9yKTtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfVxuICAgICAgYGBgXG5cbiAgICAgIEVycmJhY2sgRXhhbXBsZVxuXG4gICAgICBgYGBqc1xuXG4gICAgICBmdW5jdGlvbiBmb3VuZEJvb2tzKGJvb2tzKSB7XG5cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZmFpbHVyZShyZWFzb24pIHtcblxuICAgICAgfVxuXG4gICAgICBmaW5kQXV0aG9yKGZ1bmN0aW9uKGF1dGhvciwgZXJyKXtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICAvLyBmYWlsdXJlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZpbmRCb29va3NCeUF1dGhvcihhdXRob3IsIGZ1bmN0aW9uKGJvb2tzLCBlcnIpIHtcbiAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgZm91bmRCb29rcyhib29rcyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgICAgICAgICAgIGZhaWx1cmUocmVhc29uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBQcm9taXNlIEV4YW1wbGU7XG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIGZpbmRBdXRob3IoKS5cbiAgICAgICAgdGhlbihmaW5kQm9va3NCeUF1dGhvcikuXG4gICAgICAgIHRoZW4oZnVuY3Rpb24oYm9va3Mpe1xuICAgICAgICAgIC8vIGZvdW5kIGJvb2tzXG4gICAgICB9KS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQG1ldGhvZCB0aGVuXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvbkZ1bGZpbGxlZFxuICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZFxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQHJldHVybiB7UHJvbWlzZX1cbiAgICAqL1xuICAgICAgdGhlbjogZnVuY3Rpb24ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IHRoaXM7XG4gICAgICAgIHZhciBzdGF0ZSA9IHBhcmVudC5fc3RhdGU7XG5cbiAgICAgICAgaWYgKHN0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQgJiYgIW9uRnVsZmlsbG1lbnQgfHwgc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEICYmICFvblJlamVjdGlvbikge1xuICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNoaWxkID0gbmV3IHRoaXMuY29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICAgIHZhciByZXN1bHQgPSBwYXJlbnQuX3Jlc3VsdDtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbc3RhdGUgLSAxXTtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChmdW5jdGlvbigpe1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc3RhdGUsIGNoaWxkLCBjYWxsYmFjaywgcmVzdWx0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNoaWxkO1xuICAgICAgfSxcblxuICAgIC8qKlxuICAgICAgYGNhdGNoYCBpcyBzaW1wbHkgc3VnYXIgZm9yIGB0aGVuKHVuZGVmaW5lZCwgb25SZWplY3Rpb24pYCB3aGljaCBtYWtlcyBpdCB0aGUgc2FtZVxuICAgICAgYXMgdGhlIGNhdGNoIGJsb2NrIG9mIGEgdHJ5L2NhdGNoIHN0YXRlbWVudC5cblxuICAgICAgYGBganNcbiAgICAgIGZ1bmN0aW9uIGZpbmRBdXRob3IoKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZG4ndCBmaW5kIHRoYXQgYXV0aG9yJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIHN5bmNocm9ub3VzXG4gICAgICB0cnkge1xuICAgICAgICBmaW5kQXV0aG9yKCk7XG4gICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgICAgfVxuXG4gICAgICAvLyBhc3luYyB3aXRoIHByb21pc2VzXG4gICAgICBmaW5kQXV0aG9yKCkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEBtZXRob2QgY2F0Y2hcbiAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0aW9uXG4gICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgICBAcmV0dXJuIHtQcm9taXNlfVxuICAgICovXG4gICAgICAnY2F0Y2gnOiBmdW5jdGlvbihvblJlamVjdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0aW9uKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkcG9seWZpbGwoKSB7XG4gICAgICB2YXIgbG9jYWw7XG5cbiAgICAgIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGxvY2FsID0gZ2xvYmFsO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBsb2NhbCA9IHNlbGY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGxvY2FsID0gRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seWZpbGwgZmFpbGVkIGJlY2F1c2UgZ2xvYmFsIG9iamVjdCBpcyB1bmF2YWlsYWJsZSBpbiB0aGlzIGVudmlyb25tZW50Jyk7XG4gICAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgUCA9IGxvY2FsLlByb21pc2U7XG5cbiAgICAgIGlmIChQICYmIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChQLnJlc29sdmUoKSkgPT09ICdbb2JqZWN0IFByb21pc2VdJyAmJiAhUC5jYXN0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbG9jYWwuUHJvbWlzZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRkZWZhdWx0O1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRwb2x5ZmlsbDtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlID0ge1xuICAgICAgJ1Byb21pc2UnOiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkZGVmYXVsdCxcbiAgICAgICdwb2x5ZmlsbCc6IGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkZGVmYXVsdFxuICAgIH07XG5cbiAgICAvKiBnbG9iYWwgZGVmaW5lOnRydWUgbW9kdWxlOnRydWUgd2luZG93OiB0cnVlICovXG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lWydhbWQnXSkge1xuICAgICAgZGVmaW5lKGZ1bmN0aW9uKCkgeyByZXR1cm4gbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZTsgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGVbJ2V4cG9ydHMnXSkge1xuICAgICAgbW9kdWxlWydleHBvcnRzJ10gPSBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRoaXMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzWydFUzZQcm9taXNlJ10gPSBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlO1xuICAgIH1cblxuICAgIGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkZGVmYXVsdCgpO1xufSkuY2FsbCh0aGlzKTtcblxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyIGh0dHAgPSByZXF1aXJlKCdodHRwJyk7XG5cbnZhciBodHRwcyA9IG1vZHVsZS5leHBvcnRzO1xuXG5mb3IgKHZhciBrZXkgaW4gaHR0cCkge1xuICAgIGlmIChodHRwLmhhc093blByb3BlcnR5KGtleSkpIGh0dHBzW2tleV0gPSBodHRwW2tleV07XG59O1xuXG5odHRwcy5yZXF1ZXN0ID0gZnVuY3Rpb24gKHBhcmFtcywgY2IpIHtcbiAgICBpZiAoIXBhcmFtcykgcGFyYW1zID0ge307XG4gICAgcGFyYW1zLnNjaGVtZSA9ICdodHRwcyc7XG4gICAgcGFyYW1zLnByb3RvY29sID0gJ2h0dHBzOic7XG4gICAgcmV0dXJuIGh0dHAucmVxdWVzdC5jYWxsKHRoaXMsIHBhcmFtcywgY2IpO1xufVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn0gZWxzZSB7XG4gIC8vIG9sZCBzY2hvb2wgc2hpbSBmb3Igb2xkIGJyb3dzZXJzXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgIFRlbXBDdG9yLnByb3RvdHlwZSA9IHN1cGVyQ3Rvci5wcm90b3R5cGVcbiAgICBjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpXG4gICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gIH1cbn1cbiIsIi8qKlxuICogRGV0ZXJtaW5lIGlmIGFuIG9iamVjdCBpcyBCdWZmZXJcbiAqXG4gKiBBdXRob3I6ICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIExpY2Vuc2U6ICBNSVRcbiAqXG4gKiBgbnBtIGluc3RhbGwgaXMtYnVmZmVyYFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gISEob2JqICE9IG51bGwgJiZcbiAgICAob2JqLl9pc0J1ZmZlciB8fCAvLyBGb3IgU2FmYXJpIDUtNyAobWlzc2luZyBPYmplY3QucHJvdG90eXBlLmNvbnN0cnVjdG9yKVxuICAgICAgKG9iai5jb25zdHJ1Y3RvciAmJlxuICAgICAgdHlwZW9mIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iaikpXG4gICAgKSlcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaWYgKCFwcm9jZXNzLnZlcnNpb24gfHxcbiAgICBwcm9jZXNzLnZlcnNpb24uaW5kZXhPZigndjAuJykgPT09IDAgfHxcbiAgICBwcm9jZXNzLnZlcnNpb24uaW5kZXhPZigndjEuJykgPT09IDAgJiYgcHJvY2Vzcy52ZXJzaW9uLmluZGV4T2YoJ3YxLjguJykgIT09IDApIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBuZXh0VGljaztcbn0gZWxzZSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcHJvY2Vzcy5uZXh0VGljaztcbn1cblxuZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICB2YXIgaSA9IDA7XG4gIHdoaWxlIChpIDwgYXJncy5sZW5ndGgpIHtcbiAgICBhcmdzW2krK10gPSBhcmd1bWVudHNbaV07XG4gIH1cbiAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiBhZnRlclRpY2soKSB7XG4gICAgZm4uYXBwbHkobnVsbCwgYXJncyk7XG4gIH0pO1xufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKiEgaHR0cHM6Ly9tdGhzLmJlL3B1bnljb2RlIHYxLjQuMCBieSBAbWF0aGlhcyAqL1xuOyhmdW5jdGlvbihyb290KSB7XG5cblx0LyoqIERldGVjdCBmcmVlIHZhcmlhYmxlcyAqL1xuXHR2YXIgZnJlZUV4cG9ydHMgPSB0eXBlb2YgZXhwb3J0cyA9PSAnb2JqZWN0JyAmJiBleHBvcnRzICYmXG5cdFx0IWV4cG9ydHMubm9kZVR5cGUgJiYgZXhwb3J0cztcblx0dmFyIGZyZWVNb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJlxuXHRcdCFtb2R1bGUubm9kZVR5cGUgJiYgbW9kdWxlO1xuXHR2YXIgZnJlZUdsb2JhbCA9IHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsO1xuXHRpZiAoXG5cdFx0ZnJlZUdsb2JhbC5nbG9iYWwgPT09IGZyZWVHbG9iYWwgfHxcblx0XHRmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCB8fFxuXHRcdGZyZWVHbG9iYWwuc2VsZiA9PT0gZnJlZUdsb2JhbFxuXHQpIHtcblx0XHRyb290ID0gZnJlZUdsb2JhbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgYHB1bnljb2RlYCBvYmplY3QuXG5cdCAqIEBuYW1lIHB1bnljb2RlXG5cdCAqIEB0eXBlIE9iamVjdFxuXHQgKi9cblx0dmFyIHB1bnljb2RlLFxuXG5cdC8qKiBIaWdoZXN0IHBvc2l0aXZlIHNpZ25lZCAzMi1iaXQgZmxvYXQgdmFsdWUgKi9cblx0bWF4SW50ID0gMjE0NzQ4MzY0NywgLy8gYWthLiAweDdGRkZGRkZGIG9yIDJeMzEtMVxuXG5cdC8qKiBCb290c3RyaW5nIHBhcmFtZXRlcnMgKi9cblx0YmFzZSA9IDM2LFxuXHR0TWluID0gMSxcblx0dE1heCA9IDI2LFxuXHRza2V3ID0gMzgsXG5cdGRhbXAgPSA3MDAsXG5cdGluaXRpYWxCaWFzID0gNzIsXG5cdGluaXRpYWxOID0gMTI4LCAvLyAweDgwXG5cdGRlbGltaXRlciA9ICctJywgLy8gJ1xceDJEJ1xuXG5cdC8qKiBSZWd1bGFyIGV4cHJlc3Npb25zICovXG5cdHJlZ2V4UHVueWNvZGUgPSAvXnhuLS0vLFxuXHRyZWdleE5vbkFTQ0lJID0gL1teXFx4MjAtXFx4N0VdLywgLy8gdW5wcmludGFibGUgQVNDSUkgY2hhcnMgKyBub24tQVNDSUkgY2hhcnNcblx0cmVnZXhTZXBhcmF0b3JzID0gL1tcXHgyRVxcdTMwMDJcXHVGRjBFXFx1RkY2MV0vZywgLy8gUkZDIDM0OTAgc2VwYXJhdG9yc1xuXG5cdC8qKiBFcnJvciBtZXNzYWdlcyAqL1xuXHRlcnJvcnMgPSB7XG5cdFx0J292ZXJmbG93JzogJ092ZXJmbG93OiBpbnB1dCBuZWVkcyB3aWRlciBpbnRlZ2VycyB0byBwcm9jZXNzJyxcblx0XHQnbm90LWJhc2ljJzogJ0lsbGVnYWwgaW5wdXQgPj0gMHg4MCAobm90IGEgYmFzaWMgY29kZSBwb2ludCknLFxuXHRcdCdpbnZhbGlkLWlucHV0JzogJ0ludmFsaWQgaW5wdXQnXG5cdH0sXG5cblx0LyoqIENvbnZlbmllbmNlIHNob3J0Y3V0cyAqL1xuXHRiYXNlTWludXNUTWluID0gYmFzZSAtIHRNaW4sXG5cdGZsb29yID0gTWF0aC5mbG9vcixcblx0c3RyaW5nRnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZSxcblxuXHQvKiogVGVtcG9yYXJ5IHZhcmlhYmxlICovXG5cdGtleTtcblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGVycm9yIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIFRoZSBlcnJvciB0eXBlLlxuXHQgKiBAcmV0dXJucyB7RXJyb3J9IFRocm93cyBhIGBSYW5nZUVycm9yYCB3aXRoIHRoZSBhcHBsaWNhYmxlIGVycm9yIG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBlcnJvcih0eXBlKSB7XG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoZXJyb3JzW3R5cGVdKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIGdlbmVyaWMgYEFycmF5I21hcGAgdXRpbGl0eSBmdW5jdGlvbi5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5IGFycmF5XG5cdCAqIGl0ZW0uXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gQSBuZXcgYXJyYXkgb2YgdmFsdWVzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFjayBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcChhcnJheSwgZm4pIHtcblx0XHR2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuXHRcdHZhciByZXN1bHQgPSBbXTtcblx0XHR3aGlsZSAobGVuZ3RoLS0pIHtcblx0XHRcdHJlc3VsdFtsZW5ndGhdID0gZm4oYXJyYXlbbGVuZ3RoXSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvKipcblx0ICogQSBzaW1wbGUgYEFycmF5I21hcGAtbGlrZSB3cmFwcGVyIHRvIHdvcmsgd2l0aCBkb21haW4gbmFtZSBzdHJpbmdzIG9yIGVtYWlsXG5cdCAqIGFkZHJlc3Nlcy5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRvbWFpbiBUaGUgZG9tYWluIG5hbWUgb3IgZW1haWwgYWRkcmVzcy5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5XG5cdCAqIGNoYXJhY3Rlci5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBzdHJpbmcgb2YgY2hhcmFjdGVycyByZXR1cm5lZCBieSB0aGUgY2FsbGJhY2tcblx0ICogZnVuY3Rpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBtYXBEb21haW4oc3RyaW5nLCBmbikge1xuXHRcdHZhciBwYXJ0cyA9IHN0cmluZy5zcGxpdCgnQCcpO1xuXHRcdHZhciByZXN1bHQgPSAnJztcblx0XHRpZiAocGFydHMubGVuZ3RoID4gMSkge1xuXHRcdFx0Ly8gSW4gZW1haWwgYWRkcmVzc2VzLCBvbmx5IHRoZSBkb21haW4gbmFtZSBzaG91bGQgYmUgcHVueWNvZGVkLiBMZWF2ZVxuXHRcdFx0Ly8gdGhlIGxvY2FsIHBhcnQgKGkuZS4gZXZlcnl0aGluZyB1cCB0byBgQGApIGludGFjdC5cblx0XHRcdHJlc3VsdCA9IHBhcnRzWzBdICsgJ0AnO1xuXHRcdFx0c3RyaW5nID0gcGFydHNbMV07XG5cdFx0fVxuXHRcdC8vIEF2b2lkIGBzcGxpdChyZWdleClgIGZvciBJRTggY29tcGF0aWJpbGl0eS4gU2VlICMxNy5cblx0XHRzdHJpbmcgPSBzdHJpbmcucmVwbGFjZShyZWdleFNlcGFyYXRvcnMsICdcXHgyRScpO1xuXHRcdHZhciBsYWJlbHMgPSBzdHJpbmcuc3BsaXQoJy4nKTtcblx0XHR2YXIgZW5jb2RlZCA9IG1hcChsYWJlbHMsIGZuKS5qb2luKCcuJyk7XG5cdFx0cmV0dXJuIHJlc3VsdCArIGVuY29kZWQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhbiBhcnJheSBjb250YWluaW5nIHRoZSBudW1lcmljIGNvZGUgcG9pbnRzIG9mIGVhY2ggVW5pY29kZVxuXHQgKiBjaGFyYWN0ZXIgaW4gdGhlIHN0cmluZy4gV2hpbGUgSmF2YVNjcmlwdCB1c2VzIFVDUy0yIGludGVybmFsbHksXG5cdCAqIHRoaXMgZnVuY3Rpb24gd2lsbCBjb252ZXJ0IGEgcGFpciBvZiBzdXJyb2dhdGUgaGFsdmVzIChlYWNoIG9mIHdoaWNoXG5cdCAqIFVDUy0yIGV4cG9zZXMgYXMgc2VwYXJhdGUgY2hhcmFjdGVycykgaW50byBhIHNpbmdsZSBjb2RlIHBvaW50LFxuXHQgKiBtYXRjaGluZyBVVEYtMTYuXG5cdCAqIEBzZWUgYHB1bnljb2RlLnVjczIuZW5jb2RlYFxuXHQgKiBAc2VlIDxodHRwczovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZz5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlLnVjczJcblx0ICogQG5hbWUgZGVjb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmcgVGhlIFVuaWNvZGUgaW5wdXQgc3RyaW5nIChVQ1MtMikuXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gVGhlIG5ldyBhcnJheSBvZiBjb2RlIHBvaW50cy5cblx0ICovXG5cdGZ1bmN0aW9uIHVjczJkZWNvZGUoc3RyaW5nKSB7XG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBjb3VudGVyID0gMCxcblx0XHQgICAgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aCxcblx0XHQgICAgdmFsdWUsXG5cdFx0ICAgIGV4dHJhO1xuXHRcdHdoaWxlIChjb3VudGVyIDwgbGVuZ3RoKSB7XG5cdFx0XHR2YWx1ZSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRpZiAodmFsdWUgPj0gMHhEODAwICYmIHZhbHVlIDw9IDB4REJGRiAmJiBjb3VudGVyIDwgbGVuZ3RoKSB7XG5cdFx0XHRcdC8vIGhpZ2ggc3Vycm9nYXRlLCBhbmQgdGhlcmUgaXMgYSBuZXh0IGNoYXJhY3RlclxuXHRcdFx0XHRleHRyYSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRcdGlmICgoZXh0cmEgJiAweEZDMDApID09IDB4REMwMCkgeyAvLyBsb3cgc3Vycm9nYXRlXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2goKCh2YWx1ZSAmIDB4M0ZGKSA8PCAxMCkgKyAoZXh0cmEgJiAweDNGRikgKyAweDEwMDAwKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyB1bm1hdGNoZWQgc3Vycm9nYXRlOyBvbmx5IGFwcGVuZCB0aGlzIGNvZGUgdW5pdCwgaW4gY2FzZSB0aGUgbmV4dFxuXHRcdFx0XHRcdC8vIGNvZGUgdW5pdCBpcyB0aGUgaGlnaCBzdXJyb2dhdGUgb2YgYSBzdXJyb2dhdGUgcGFpclxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdFx0XHRjb3VudGVyLS07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgc3RyaW5nIGJhc2VkIG9uIGFuIGFycmF5IG9mIG51bWVyaWMgY29kZSBwb2ludHMuXG5cdCAqIEBzZWUgYHB1bnljb2RlLnVjczIuZGVjb2RlYFxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGUudWNzMlxuXHQgKiBAbmFtZSBlbmNvZGVcblx0ICogQHBhcmFtIHtBcnJheX0gY29kZVBvaW50cyBUaGUgYXJyYXkgb2YgbnVtZXJpYyBjb2RlIHBvaW50cy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIG5ldyBVbmljb2RlIHN0cmluZyAoVUNTLTIpLlxuXHQgKi9cblx0ZnVuY3Rpb24gdWNzMmVuY29kZShhcnJheSkge1xuXHRcdHJldHVybiBtYXAoYXJyYXksIGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHR2YXIgb3V0cHV0ID0gJyc7XG5cdFx0XHRpZiAodmFsdWUgPiAweEZGRkYpIHtcblx0XHRcdFx0dmFsdWUgLT0gMHgxMDAwMDtcblx0XHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMCk7XG5cdFx0XHRcdHZhbHVlID0gMHhEQzAwIHwgdmFsdWUgJiAweDNGRjtcblx0XHRcdH1cblx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUpO1xuXHRcdFx0cmV0dXJuIG91dHB1dDtcblx0XHR9KS5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIGJhc2ljIGNvZGUgcG9pbnQgaW50byBhIGRpZ2l0L2ludGVnZXIuXG5cdCAqIEBzZWUgYGRpZ2l0VG9CYXNpYygpYFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0gY29kZVBvaW50IFRoZSBiYXNpYyBudW1lcmljIGNvZGUgcG9pbnQgdmFsdWUuXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IFRoZSBudW1lcmljIHZhbHVlIG9mIGEgYmFzaWMgY29kZSBwb2ludCAoZm9yIHVzZSBpblxuXHQgKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGluIHRoZSByYW5nZSBgMGAgdG8gYGJhc2UgLSAxYCwgb3IgYGJhc2VgIGlmXG5cdCAqIHRoZSBjb2RlIHBvaW50IGRvZXMgbm90IHJlcHJlc2VudCBhIHZhbHVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gYmFzaWNUb0RpZ2l0KGNvZGVQb2ludCkge1xuXHRcdGlmIChjb2RlUG9pbnQgLSA0OCA8IDEwKSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gMjI7XG5cdFx0fVxuXHRcdGlmIChjb2RlUG9pbnQgLSA2NSA8IDI2KSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gNjU7XG5cdFx0fVxuXHRcdGlmIChjb2RlUG9pbnQgLSA5NyA8IDI2KSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gOTc7XG5cdFx0fVxuXHRcdHJldHVybiBiYXNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgZGlnaXQvaW50ZWdlciBpbnRvIGEgYmFzaWMgY29kZSBwb2ludC5cblx0ICogQHNlZSBgYmFzaWNUb0RpZ2l0KClgXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBkaWdpdCBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQuXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IFRoZSBiYXNpYyBjb2RlIHBvaW50IHdob3NlIHZhbHVlICh3aGVuIHVzZWQgZm9yXG5cdCAqIHJlcHJlc2VudGluZyBpbnRlZ2VycykgaXMgYGRpZ2l0YCwgd2hpY2ggbmVlZHMgdG8gYmUgaW4gdGhlIHJhbmdlXG5cdCAqIGAwYCB0byBgYmFzZSAtIDFgLiBJZiBgZmxhZ2AgaXMgbm9uLXplcm8sIHRoZSB1cHBlcmNhc2UgZm9ybSBpc1xuXHQgKiB1c2VkOyBlbHNlLCB0aGUgbG93ZXJjYXNlIGZvcm0gaXMgdXNlZC4gVGhlIGJlaGF2aW9yIGlzIHVuZGVmaW5lZFxuXHQgKiBpZiBgZmxhZ2AgaXMgbm9uLXplcm8gYW5kIGBkaWdpdGAgaGFzIG5vIHVwcGVyY2FzZSBmb3JtLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGlnaXRUb0Jhc2ljKGRpZ2l0LCBmbGFnKSB7XG5cdFx0Ly8gIDAuLjI1IG1hcCB0byBBU0NJSSBhLi56IG9yIEEuLlpcblx0XHQvLyAyNi4uMzUgbWFwIHRvIEFTQ0lJIDAuLjlcblx0XHRyZXR1cm4gZGlnaXQgKyAyMiArIDc1ICogKGRpZ2l0IDwgMjYpIC0gKChmbGFnICE9IDApIDw8IDUpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJpYXMgYWRhcHRhdGlvbiBmdW5jdGlvbiBhcyBwZXIgc2VjdGlvbiAzLjQgb2YgUkZDIDM0OTIuXG5cdCAqIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzNDkyI3NlY3Rpb24tMy40XG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRmdW5jdGlvbiBhZGFwdChkZWx0YSwgbnVtUG9pbnRzLCBmaXJzdFRpbWUpIHtcblx0XHR2YXIgayA9IDA7XG5cdFx0ZGVsdGEgPSBmaXJzdFRpbWUgPyBmbG9vcihkZWx0YSAvIGRhbXApIDogZGVsdGEgPj4gMTtcblx0XHRkZWx0YSArPSBmbG9vcihkZWx0YSAvIG51bVBvaW50cyk7XG5cdFx0Zm9yICgvKiBubyBpbml0aWFsaXphdGlvbiAqLzsgZGVsdGEgPiBiYXNlTWludXNUTWluICogdE1heCA+PiAxOyBrICs9IGJhc2UpIHtcblx0XHRcdGRlbHRhID0gZmxvb3IoZGVsdGEgLyBiYXNlTWludXNUTWluKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZsb29yKGsgKyAoYmFzZU1pbnVzVE1pbiArIDEpICogZGVsdGEgLyAoZGVsdGEgKyBza2V3KSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzIHRvIGEgc3RyaW5nIG9mIFVuaWNvZGVcblx0ICogc3ltYm9scy5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlc3VsdGluZyBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGVjb2RlKGlucHV0KSB7XG5cdFx0Ly8gRG9uJ3QgdXNlIFVDUy0yXG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aCxcblx0XHQgICAgb3V0LFxuXHRcdCAgICBpID0gMCxcblx0XHQgICAgbiA9IGluaXRpYWxOLFxuXHRcdCAgICBiaWFzID0gaW5pdGlhbEJpYXMsXG5cdFx0ICAgIGJhc2ljLFxuXHRcdCAgICBqLFxuXHRcdCAgICBpbmRleCxcblx0XHQgICAgb2xkaSxcblx0XHQgICAgdyxcblx0XHQgICAgayxcblx0XHQgICAgZGlnaXQsXG5cdFx0ICAgIHQsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBiYXNlTWludXNUO1xuXG5cdFx0Ly8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50czogbGV0IGBiYXNpY2AgYmUgdGhlIG51bWJlciBvZiBpbnB1dCBjb2RlXG5cdFx0Ly8gcG9pbnRzIGJlZm9yZSB0aGUgbGFzdCBkZWxpbWl0ZXIsIG9yIGAwYCBpZiB0aGVyZSBpcyBub25lLCB0aGVuIGNvcHlcblx0XHQvLyB0aGUgZmlyc3QgYmFzaWMgY29kZSBwb2ludHMgdG8gdGhlIG91dHB1dC5cblxuXHRcdGJhc2ljID0gaW5wdXQubGFzdEluZGV4T2YoZGVsaW1pdGVyKTtcblx0XHRpZiAoYmFzaWMgPCAwKSB7XG5cdFx0XHRiYXNpYyA9IDA7XG5cdFx0fVxuXG5cdFx0Zm9yIChqID0gMDsgaiA8IGJhc2ljOyArK2opIHtcblx0XHRcdC8vIGlmIGl0J3Mgbm90IGEgYmFzaWMgY29kZSBwb2ludFxuXHRcdFx0aWYgKGlucHV0LmNoYXJDb2RlQXQoaikgPj0gMHg4MCkge1xuXHRcdFx0XHRlcnJvcignbm90LWJhc2ljJyk7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQucHVzaChpbnB1dC5jaGFyQ29kZUF0KGopKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIGRlY29kaW5nIGxvb3A6IHN0YXJ0IGp1c3QgYWZ0ZXIgdGhlIGxhc3QgZGVsaW1pdGVyIGlmIGFueSBiYXNpYyBjb2RlXG5cdFx0Ly8gcG9pbnRzIHdlcmUgY29waWVkOyBzdGFydCBhdCB0aGUgYmVnaW5uaW5nIG90aGVyd2lzZS5cblxuXHRcdGZvciAoaW5kZXggPSBiYXNpYyA+IDAgPyBiYXNpYyArIDEgOiAwOyBpbmRleCA8IGlucHV0TGVuZ3RoOyAvKiBubyBmaW5hbCBleHByZXNzaW9uICovKSB7XG5cblx0XHRcdC8vIGBpbmRleGAgaXMgdGhlIGluZGV4IG9mIHRoZSBuZXh0IGNoYXJhY3RlciB0byBiZSBjb25zdW1lZC5cblx0XHRcdC8vIERlY29kZSBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyIGludG8gYGRlbHRhYCxcblx0XHRcdC8vIHdoaWNoIGdldHMgYWRkZWQgdG8gYGlgLiBUaGUgb3ZlcmZsb3cgY2hlY2tpbmcgaXMgZWFzaWVyXG5cdFx0XHQvLyBpZiB3ZSBpbmNyZWFzZSBgaWAgYXMgd2UgZ28sIHRoZW4gc3VidHJhY3Qgb2ZmIGl0cyBzdGFydGluZ1xuXHRcdFx0Ly8gdmFsdWUgYXQgdGhlIGVuZCB0byBvYnRhaW4gYGRlbHRhYC5cblx0XHRcdGZvciAob2xkaSA9IGksIHcgPSAxLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblxuXHRcdFx0XHRpZiAoaW5kZXggPj0gaW5wdXRMZW5ndGgpIHtcblx0XHRcdFx0XHRlcnJvcignaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZGlnaXQgPSBiYXNpY1RvRGlnaXQoaW5wdXQuY2hhckNvZGVBdChpbmRleCsrKSk7XG5cblx0XHRcdFx0aWYgKGRpZ2l0ID49IGJhc2UgfHwgZGlnaXQgPiBmbG9vcigobWF4SW50IC0gaSkgLyB3KSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aSArPSBkaWdpdCAqIHc7XG5cdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA8IHQpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0aWYgKHcgPiBmbG9vcihtYXhJbnQgLyBiYXNlTWludXNUKSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dyAqPSBiYXNlTWludXNUO1xuXG5cdFx0XHR9XG5cblx0XHRcdG91dCA9IG91dHB1dC5sZW5ndGggKyAxO1xuXHRcdFx0YmlhcyA9IGFkYXB0KGkgLSBvbGRpLCBvdXQsIG9sZGkgPT0gMCk7XG5cblx0XHRcdC8vIGBpYCB3YXMgc3VwcG9zZWQgdG8gd3JhcCBhcm91bmQgZnJvbSBgb3V0YCB0byBgMGAsXG5cdFx0XHQvLyBpbmNyZW1lbnRpbmcgYG5gIGVhY2ggdGltZSwgc28gd2UnbGwgZml4IHRoYXQgbm93OlxuXHRcdFx0aWYgKGZsb29yKGkgLyBvdXQpID4gbWF4SW50IC0gbikge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0biArPSBmbG9vcihpIC8gb3V0KTtcblx0XHRcdGkgJT0gb3V0O1xuXG5cdFx0XHQvLyBJbnNlcnQgYG5gIGF0IHBvc2l0aW9uIGBpYCBvZiB0aGUgb3V0cHV0XG5cdFx0XHRvdXRwdXQuc3BsaWNlKGkrKywgMCwgbik7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gdWNzMmVuY29kZShvdXRwdXQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scyAoZS5nLiBhIGRvbWFpbiBuYW1lIGxhYmVsKSB0byBhXG5cdCAqIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGVuY29kZShpbnB1dCkge1xuXHRcdHZhciBuLFxuXHRcdCAgICBkZWx0YSxcblx0XHQgICAgaGFuZGxlZENQQ291bnQsXG5cdFx0ICAgIGJhc2ljTGVuZ3RoLFxuXHRcdCAgICBiaWFzLFxuXHRcdCAgICBqLFxuXHRcdCAgICBtLFxuXHRcdCAgICBxLFxuXHRcdCAgICBrLFxuXHRcdCAgICB0LFxuXHRcdCAgICBjdXJyZW50VmFsdWUsXG5cdFx0ICAgIG91dHB1dCA9IFtdLFxuXHRcdCAgICAvKiogYGlucHV0TGVuZ3RoYCB3aWxsIGhvbGQgdGhlIG51bWJlciBvZiBjb2RlIHBvaW50cyBpbiBgaW5wdXRgLiAqL1xuXHRcdCAgICBpbnB1dExlbmd0aCxcblx0XHQgICAgLyoqIENhY2hlZCBjYWxjdWxhdGlvbiByZXN1bHRzICovXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50UGx1c09uZSxcblx0XHQgICAgYmFzZU1pbnVzVCxcblx0XHQgICAgcU1pbnVzVDtcblxuXHRcdC8vIENvbnZlcnQgdGhlIGlucHV0IGluIFVDUy0yIHRvIFVuaWNvZGVcblx0XHRpbnB1dCA9IHVjczJkZWNvZGUoaW5wdXQpO1xuXG5cdFx0Ly8gQ2FjaGUgdGhlIGxlbmd0aFxuXHRcdGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSB0aGUgc3RhdGVcblx0XHRuID0gaW5pdGlhbE47XG5cdFx0ZGVsdGEgPSAwO1xuXHRcdGJpYXMgPSBpbml0aWFsQmlhcztcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHNcblx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgMHg4MCkge1xuXHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoY3VycmVudFZhbHVlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aGFuZGxlZENQQ291bnQgPSBiYXNpY0xlbmd0aCA9IG91dHB1dC5sZW5ndGg7XG5cblx0XHQvLyBgaGFuZGxlZENQQ291bnRgIGlzIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgdGhhdCBoYXZlIGJlZW4gaGFuZGxlZDtcblx0XHQvLyBgYmFzaWNMZW5ndGhgIGlzIHRoZSBudW1iZXIgb2YgYmFzaWMgY29kZSBwb2ludHMuXG5cblx0XHQvLyBGaW5pc2ggdGhlIGJhc2ljIHN0cmluZyAtIGlmIGl0IGlzIG5vdCBlbXB0eSAtIHdpdGggYSBkZWxpbWl0ZXJcblx0XHRpZiAoYmFzaWNMZW5ndGgpIHtcblx0XHRcdG91dHB1dC5wdXNoKGRlbGltaXRlcik7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBlbmNvZGluZyBsb29wOlxuXHRcdHdoaWxlIChoYW5kbGVkQ1BDb3VudCA8IGlucHV0TGVuZ3RoKSB7XG5cblx0XHRcdC8vIEFsbCBub24tYmFzaWMgY29kZSBwb2ludHMgPCBuIGhhdmUgYmVlbiBoYW5kbGVkIGFscmVhZHkuIEZpbmQgdGhlIG5leHRcblx0XHRcdC8vIGxhcmdlciBvbmU6XG5cdFx0XHRmb3IgKG0gPSBtYXhJbnQsIGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA+PSBuICYmIGN1cnJlbnRWYWx1ZSA8IG0pIHtcblx0XHRcdFx0XHRtID0gY3VycmVudFZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluY3JlYXNlIGBkZWx0YWAgZW5vdWdoIHRvIGFkdmFuY2UgdGhlIGRlY29kZXIncyA8bixpPiBzdGF0ZSB0byA8bSwwPixcblx0XHRcdC8vIGJ1dCBndWFyZCBhZ2FpbnN0IG92ZXJmbG93XG5cdFx0XHRoYW5kbGVkQ1BDb3VudFBsdXNPbmUgPSBoYW5kbGVkQ1BDb3VudCArIDE7XG5cdFx0XHRpZiAobSAtIG4gPiBmbG9vcigobWF4SW50IC0gZGVsdGEpIC8gaGFuZGxlZENQQ291bnRQbHVzT25lKSkge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0ZGVsdGEgKz0gKG0gLSBuKSAqIGhhbmRsZWRDUENvdW50UGx1c09uZTtcblx0XHRcdG4gPSBtO1xuXG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgbiAmJiArK2RlbHRhID4gbWF4SW50KSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlID09IG4pIHtcblx0XHRcdFx0XHQvLyBSZXByZXNlbnQgZGVsdGEgYXMgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlclxuXHRcdFx0XHRcdGZvciAocSA9IGRlbHRhLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblx0XHRcdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXHRcdFx0XHRcdFx0aWYgKHEgPCB0KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cU1pbnVzVCA9IHEgLSB0O1xuXHRcdFx0XHRcdFx0YmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXHRcdFx0XHRcdFx0b3V0cHV0LnB1c2goXG5cdFx0XHRcdFx0XHRcdHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWModCArIHFNaW51c1QgJSBiYXNlTWludXNULCAwKSlcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRxID0gZmxvb3IocU1pbnVzVCAvIGJhc2VNaW51c1QpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWMocSwgMCkpKTtcblx0XHRcdFx0XHRiaWFzID0gYWRhcHQoZGVsdGEsIGhhbmRsZWRDUENvdW50UGx1c09uZSwgaGFuZGxlZENQQ291bnQgPT0gYmFzaWNMZW5ndGgpO1xuXHRcdFx0XHRcdGRlbHRhID0gMDtcblx0XHRcdFx0XHQrK2hhbmRsZWRDUENvdW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdCsrZGVsdGE7XG5cdFx0XHQrK247XG5cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dC5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSBvciBhbiBlbWFpbCBhZGRyZXNzXG5cdCAqIHRvIFVuaWNvZGUuIE9ubHkgdGhlIFB1bnljb2RlZCBwYXJ0cyBvZiB0aGUgaW5wdXQgd2lsbCBiZSBjb252ZXJ0ZWQsIGkuZS5cblx0ICogaXQgZG9lc24ndCBtYXR0ZXIgaWYgeW91IGNhbGwgaXQgb24gYSBzdHJpbmcgdGhhdCBoYXMgYWxyZWFkeSBiZWVuXG5cdCAqIGNvbnZlcnRlZCB0byBVbmljb2RlLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBQdW55Y29kZWQgZG9tYWluIG5hbWUgb3IgZW1haWwgYWRkcmVzcyB0b1xuXHQgKiBjb252ZXJ0IHRvIFVuaWNvZGUuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBVbmljb2RlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBnaXZlbiBQdW55Y29kZVxuXHQgKiBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b1VuaWNvZGUoaW5wdXQpIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGlucHV0LCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleFB1bnljb2RlLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/IGRlY29kZShzdHJpbmcuc2xpY2UoNCkudG9Mb3dlckNhc2UoKSlcblx0XHRcdFx0OiBzdHJpbmc7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBVbmljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSBvciBhbiBlbWFpbCBhZGRyZXNzIHRvXG5cdCAqIFB1bnljb2RlLiBPbmx5IHRoZSBub24tQVNDSUkgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHdpbGwgYmUgY29udmVydGVkLFxuXHQgKiBpLmUuIGl0IGRvZXNuJ3QgbWF0dGVyIGlmIHlvdSBjYWxsIGl0IHdpdGggYSBkb21haW4gdGhhdCdzIGFscmVhZHkgaW5cblx0ICogQVNDSUkuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIGRvbWFpbiBuYW1lIG9yIGVtYWlsIGFkZHJlc3MgdG8gY29udmVydCwgYXMgYVxuXHQgKiBVbmljb2RlIHN0cmluZy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIFB1bnljb2RlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBnaXZlbiBkb21haW4gbmFtZSBvclxuXHQgKiBlbWFpbCBhZGRyZXNzLlxuXHQgKi9cblx0ZnVuY3Rpb24gdG9BU0NJSShpbnB1dCkge1xuXHRcdHJldHVybiBtYXBEb21haW4oaW5wdXQsIGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdFx0cmV0dXJuIHJlZ2V4Tm9uQVNDSUkudGVzdChzdHJpbmcpXG5cdFx0XHRcdD8gJ3huLS0nICsgZW5jb2RlKHN0cmluZylcblx0XHRcdFx0OiBzdHJpbmc7XG5cdFx0fSk7XG5cdH1cblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKiogRGVmaW5lIHRoZSBwdWJsaWMgQVBJICovXG5cdHB1bnljb2RlID0ge1xuXHRcdC8qKlxuXHRcdCAqIEEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgY3VycmVudCBQdW55Y29kZS5qcyB2ZXJzaW9uIG51bWJlci5cblx0XHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0XHQgKiBAdHlwZSBTdHJpbmdcblx0XHQgKi9cblx0XHQndmVyc2lvbic6ICcxLjMuMicsXG5cdFx0LyoqXG5cdFx0ICogQW4gb2JqZWN0IG9mIG1ldGhvZHMgdG8gY29udmVydCBmcm9tIEphdmFTY3JpcHQncyBpbnRlcm5hbCBjaGFyYWN0ZXJcblx0XHQgKiByZXByZXNlbnRhdGlvbiAoVUNTLTIpIHRvIFVuaWNvZGUgY29kZSBwb2ludHMsIGFuZCBiYWNrLlxuXHRcdCAqIEBzZWUgPGh0dHBzOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIE9iamVjdFxuXHRcdCAqL1xuXHRcdCd1Y3MyJzoge1xuXHRcdFx0J2RlY29kZSc6IHVjczJkZWNvZGUsXG5cdFx0XHQnZW5jb2RlJzogdWNzMmVuY29kZVxuXHRcdH0sXG5cdFx0J2RlY29kZSc6IGRlY29kZSxcblx0XHQnZW5jb2RlJzogZW5jb2RlLFxuXHRcdCd0b0FTQ0lJJzogdG9BU0NJSSxcblx0XHQndG9Vbmljb2RlJzogdG9Vbmljb2RlXG5cdH07XG5cblx0LyoqIEV4cG9zZSBgcHVueWNvZGVgICovXG5cdC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMsIGxpa2Ugci5qcywgY2hlY2sgZm9yIHNwZWNpZmljIGNvbmRpdGlvbiBwYXR0ZXJuc1xuXHQvLyBsaWtlIHRoZSBmb2xsb3dpbmc6XG5cdGlmIChcblx0XHR0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiZcblx0XHR0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJlxuXHRcdGRlZmluZS5hbWRcblx0KSB7XG5cdFx0ZGVmaW5lKCdwdW55Y29kZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHB1bnljb2RlO1xuXHRcdH0pO1xuXHR9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUpIHtcblx0XHRpZiAobW9kdWxlLmV4cG9ydHMgPT0gZnJlZUV4cG9ydHMpIHtcblx0XHRcdC8vIGluIE5vZGUuanMsIGlvLmpzLCBvciBSaW5nb0pTIHYwLjguMCtcblx0XHRcdGZyZWVNb2R1bGUuZXhwb3J0cyA9IHB1bnljb2RlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0Zm9yIChrZXkgaW4gcHVueWNvZGUpIHtcblx0XHRcdFx0cHVueWNvZGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IHB1bnljb2RlW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBpbiBSaGlubyBvciBhIHdlYiBicm93c2VyXG5cdFx0cm9vdC5wdW55Y29kZSA9IHB1bnljb2RlO1xuXHR9XG5cbn0odGhpcykpO1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gSWYgb2JqLmhhc093blByb3BlcnR5IGhhcyBiZWVuIG92ZXJyaWRkZW4sIHRoZW4gY2FsbGluZ1xuLy8gb2JqLmhhc093blByb3BlcnR5KHByb3ApIHdpbGwgYnJlYWsuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9qb3llbnQvbm9kZS9pc3N1ZXMvMTcwN1xuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihxcywgc2VwLCBlcSwgb3B0aW9ucykge1xuICBzZXAgPSBzZXAgfHwgJyYnO1xuICBlcSA9IGVxIHx8ICc9JztcbiAgdmFyIG9iaiA9IHt9O1xuXG4gIGlmICh0eXBlb2YgcXMgIT09ICdzdHJpbmcnIHx8IHFzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICB2YXIgcmVnZXhwID0gL1xcKy9nO1xuICBxcyA9IHFzLnNwbGl0KHNlcCk7XG5cbiAgdmFyIG1heEtleXMgPSAxMDAwO1xuICBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5tYXhLZXlzID09PSAnbnVtYmVyJykge1xuICAgIG1heEtleXMgPSBvcHRpb25zLm1heEtleXM7XG4gIH1cblxuICB2YXIgbGVuID0gcXMubGVuZ3RoO1xuICAvLyBtYXhLZXlzIDw9IDAgbWVhbnMgdGhhdCB3ZSBzaG91bGQgbm90IGxpbWl0IGtleXMgY291bnRcbiAgaWYgKG1heEtleXMgPiAwICYmIGxlbiA+IG1heEtleXMpIHtcbiAgICBsZW4gPSBtYXhLZXlzO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIHZhciB4ID0gcXNbaV0ucmVwbGFjZShyZWdleHAsICclMjAnKSxcbiAgICAgICAgaWR4ID0geC5pbmRleE9mKGVxKSxcbiAgICAgICAga3N0ciwgdnN0ciwgaywgdjtcblxuICAgIGlmIChpZHggPj0gMCkge1xuICAgICAga3N0ciA9IHguc3Vic3RyKDAsIGlkeCk7XG4gICAgICB2c3RyID0geC5zdWJzdHIoaWR4ICsgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGtzdHIgPSB4O1xuICAgICAgdnN0ciA9ICcnO1xuICAgIH1cblxuICAgIGsgPSBkZWNvZGVVUklDb21wb25lbnQoa3N0cik7XG4gICAgdiA9IGRlY29kZVVSSUNvbXBvbmVudCh2c3RyKTtcblxuICAgIGlmICghaGFzT3duUHJvcGVydHkob2JqLCBrKSkge1xuICAgICAgb2JqW2tdID0gdjtcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkob2JqW2tdKSkge1xuICAgICAgb2JqW2tdLnB1c2godik7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ialtrXSA9IFtvYmpba10sIHZdO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvYmo7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdpZnlQcmltaXRpdmUgPSBmdW5jdGlvbih2KSB7XG4gIHN3aXRjaCAodHlwZW9mIHYpIHtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIHY7XG5cbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiB2ID8gJ3RydWUnIDogJ2ZhbHNlJztcblxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gaXNGaW5pdGUodikgPyB2IDogJyc7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuICcnO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9iaiwgc2VwLCBlcSwgbmFtZSkge1xuICBzZXAgPSBzZXAgfHwgJyYnO1xuICBlcSA9IGVxIHx8ICc9JztcbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIG9iaiA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBtYXAob2JqZWN0S2V5cyhvYmopLCBmdW5jdGlvbihrKSB7XG4gICAgICB2YXIga3MgPSBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKGspKSArIGVxO1xuICAgICAgaWYgKGlzQXJyYXkob2JqW2tdKSkge1xuICAgICAgICByZXR1cm4gbWFwKG9ialtrXSwgZnVuY3Rpb24odikge1xuICAgICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUodikpO1xuICAgICAgICB9KS5qb2luKHNlcCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ga3MgKyBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG9ialtrXSkpO1xuICAgICAgfVxuICAgIH0pLmpvaW4oc2VwKTtcblxuICB9XG5cbiAgaWYgKCFuYW1lKSByZXR1cm4gJyc7XG4gIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG5hbWUpKSArIGVxICtcbiAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqKSk7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxuZnVuY3Rpb24gbWFwICh4cywgZikge1xuICBpZiAoeHMubWFwKSByZXR1cm4geHMubWFwKGYpO1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICByZXMucHVzaChmKHhzW2ldLCBpKSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSByZXMucHVzaChrZXkpO1xuICB9XG4gIHJldHVybiByZXM7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmRlY29kZSA9IGV4cG9ydHMucGFyc2UgPSByZXF1aXJlKCcuL2RlY29kZScpO1xuZXhwb3J0cy5lbmNvZGUgPSBleHBvcnRzLnN0cmluZ2lmeSA9IHJlcXVpcmUoJy4vZW5jb2RlJyk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2xpYi9fc3RyZWFtX2R1cGxleC5qc1wiKVxuIiwiLy8gYSBkdXBsZXggc3RyZWFtIGlzIGp1c3QgYSBzdHJlYW0gdGhhdCBpcyBib3RoIHJlYWRhYmxlIGFuZCB3cml0YWJsZS5cbi8vIFNpbmNlIEpTIGRvZXNuJ3QgaGF2ZSBtdWx0aXBsZSBwcm90b3R5cGFsIGluaGVyaXRhbmNlLCB0aGlzIGNsYXNzXG4vLyBwcm90b3R5cGFsbHkgaW5oZXJpdHMgZnJvbSBSZWFkYWJsZSwgYW5kIHRoZW4gcGFyYXNpdGljYWxseSBmcm9tXG4vLyBXcml0YWJsZS5cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBrZXlzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIGtleXMucHVzaChrZXkpO1xuICByZXR1cm4ga2V5cztcbn1cbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbm1vZHVsZS5leHBvcnRzID0gRHVwbGV4O1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHByb2Nlc3NOZXh0VGljayA9IHJlcXVpcmUoJ3Byb2Nlc3MtbmV4dGljay1hcmdzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFJlYWRhYmxlID0gcmVxdWlyZSgnLi9fc3RyZWFtX3JlYWRhYmxlJyk7XG52YXIgV3JpdGFibGUgPSByZXF1aXJlKCcuL19zdHJlYW1fd3JpdGFibGUnKTtcblxudXRpbC5pbmhlcml0cyhEdXBsZXgsIFJlYWRhYmxlKTtcblxudmFyIGtleXMgPSBvYmplY3RLZXlzKFdyaXRhYmxlLnByb3RvdHlwZSk7XG5mb3IgKHZhciB2ID0gMDsgdiA8IGtleXMubGVuZ3RoOyB2KyspIHtcbiAgdmFyIG1ldGhvZCA9IGtleXNbdl07XG4gIGlmICghRHVwbGV4LnByb3RvdHlwZVttZXRob2RdKVxuICAgIER1cGxleC5wcm90b3R5cGVbbWV0aG9kXSA9IFdyaXRhYmxlLnByb3RvdHlwZVttZXRob2RdO1xufVxuXG5mdW5jdGlvbiBEdXBsZXgob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRHVwbGV4KSlcbiAgICByZXR1cm4gbmV3IER1cGxleChvcHRpb25zKTtcblxuICBSZWFkYWJsZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuICBXcml0YWJsZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuXG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMucmVhZGFibGUgPT09IGZhbHNlKVxuICAgIHRoaXMucmVhZGFibGUgPSBmYWxzZTtcblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLndyaXRhYmxlID09PSBmYWxzZSlcbiAgICB0aGlzLndyaXRhYmxlID0gZmFsc2U7XG5cbiAgdGhpcy5hbGxvd0hhbGZPcGVuID0gdHJ1ZTtcbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5hbGxvd0hhbGZPcGVuID09PSBmYWxzZSlcbiAgICB0aGlzLmFsbG93SGFsZk9wZW4gPSBmYWxzZTtcblxuICB0aGlzLm9uY2UoJ2VuZCcsIG9uZW5kKTtcbn1cblxuLy8gdGhlIG5vLWhhbGYtb3BlbiBlbmZvcmNlclxuZnVuY3Rpb24gb25lbmQoKSB7XG4gIC8vIGlmIHdlIGFsbG93IGhhbGYtb3BlbiBzdGF0ZSwgb3IgaWYgdGhlIHdyaXRhYmxlIHNpZGUgZW5kZWQsXG4gIC8vIHRoZW4gd2UncmUgb2suXG4gIGlmICh0aGlzLmFsbG93SGFsZk9wZW4gfHwgdGhpcy5fd3JpdGFibGVTdGF0ZS5lbmRlZClcbiAgICByZXR1cm47XG5cbiAgLy8gbm8gbW9yZSBkYXRhIGNhbiBiZSB3cml0dGVuLlxuICAvLyBCdXQgYWxsb3cgbW9yZSB3cml0ZXMgdG8gaGFwcGVuIGluIHRoaXMgdGljay5cbiAgcHJvY2Vzc05leHRUaWNrKG9uRW5kTlQsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBvbkVuZE5UKHNlbGYpIHtcbiAgc2VsZi5lbmQoKTtcbn1cblxuZnVuY3Rpb24gZm9yRWFjaCAoeHMsIGYpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmKHhzW2ldLCBpKTtcbiAgfVxufVxuIiwiLy8gYSBwYXNzdGhyb3VnaCBzdHJlYW0uXG4vLyBiYXNpY2FsbHkganVzdCB0aGUgbW9zdCBtaW5pbWFsIHNvcnQgb2YgVHJhbnNmb3JtIHN0cmVhbS5cbi8vIEV2ZXJ5IHdyaXR0ZW4gY2h1bmsgZ2V0cyBvdXRwdXQgYXMtaXMuXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBQYXNzVGhyb3VnaDtcblxudmFyIFRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vX3N0cmVhbV90cmFuc2Zvcm0nKTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG51dGlsLmluaGVyaXRzKFBhc3NUaHJvdWdoLCBUcmFuc2Zvcm0pO1xuXG5mdW5jdGlvbiBQYXNzVGhyb3VnaChvcHRpb25zKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQYXNzVGhyb3VnaCkpXG4gICAgcmV0dXJuIG5ldyBQYXNzVGhyb3VnaChvcHRpb25zKTtcblxuICBUcmFuc2Zvcm0uY2FsbCh0aGlzLCBvcHRpb25zKTtcbn1cblxuUGFzc1Rocm91Z2gucHJvdG90eXBlLl90cmFuc2Zvcm0gPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNiKG51bGwsIGNodW5rKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhZGFibGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgcHJvY2Vzc05leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy1uZXh0aWNrLWFyZ3MnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblJlYWRhYmxlLlJlYWRhYmxlU3RhdGUgPSBSZWFkYWJsZVN0YXRlO1xuXG52YXIgRUUgPSByZXF1aXJlKCdldmVudHMnKTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBFRWxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVycyh0eXBlKS5sZW5ndGg7XG59O1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIFN0cmVhbTtcbihmdW5jdGlvbiAoKXt0cnl7XG4gIFN0cmVhbSA9IHJlcXVpcmUoJ3N0JyArICdyZWFtJyk7XG59Y2F0Y2goXyl7fWZpbmFsbHl7XG4gIGlmICghU3RyZWFtKVxuICAgIFN0cmVhbSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbn19KCkpXG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBkZWJ1Z1V0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG52YXIgZGVidWc7XG5pZiAoZGVidWdVdGlsICYmIGRlYnVnVXRpbC5kZWJ1Z2xvZykge1xuICBkZWJ1ZyA9IGRlYnVnVXRpbC5kZWJ1Z2xvZygnc3RyZWFtJyk7XG59IGVsc2Uge1xuICBkZWJ1ZyA9IGZ1bmN0aW9uICgpIHt9O1xufVxuLyo8L3JlcGxhY2VtZW50PiovXG5cbnZhciBTdHJpbmdEZWNvZGVyO1xuXG51dGlsLmluaGVyaXRzKFJlYWRhYmxlLCBTdHJlYW0pO1xuXG52YXIgRHVwbGV4O1xuZnVuY3Rpb24gUmVhZGFibGVTdGF0ZShvcHRpb25zLCBzdHJlYW0pIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyBvYmplY3Qgc3RyZWFtIGZsYWcuIFVzZWQgdG8gbWFrZSByZWFkKG4pIGlnbm9yZSBuIGFuZCB0b1xuICAvLyBtYWtlIGFsbCB0aGUgYnVmZmVyIG1lcmdpbmcgYW5kIGxlbmd0aCBjaGVja3MgZ28gYXdheVxuICB0aGlzLm9iamVjdE1vZGUgPSAhIW9wdGlvbnMub2JqZWN0TW9kZTtcblxuICBpZiAoc3RyZWFtIGluc3RhbmNlb2YgRHVwbGV4KVxuICAgIHRoaXMub2JqZWN0TW9kZSA9IHRoaXMub2JqZWN0TW9kZSB8fCAhIW9wdGlvbnMucmVhZGFibGVPYmplY3RNb2RlO1xuXG4gIC8vIHRoZSBwb2ludCBhdCB3aGljaCBpdCBzdG9wcyBjYWxsaW5nIF9yZWFkKCkgdG8gZmlsbCB0aGUgYnVmZmVyXG4gIC8vIE5vdGU6IDAgaXMgYSB2YWxpZCB2YWx1ZSwgbWVhbnMgXCJkb24ndCBjYWxsIF9yZWFkIHByZWVtcHRpdmVseSBldmVyXCJcbiAgdmFyIGh3bSA9IG9wdGlvbnMuaGlnaFdhdGVyTWFyaztcbiAgdmFyIGRlZmF1bHRId20gPSB0aGlzLm9iamVjdE1vZGUgPyAxNiA6IDE2ICogMTAyNDtcbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gKGh3bSB8fCBod20gPT09IDApID8gaHdtIDogZGVmYXVsdEh3bTtcblxuICAvLyBjYXN0IHRvIGludHMuXG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IH5+dGhpcy5oaWdoV2F0ZXJNYXJrO1xuXG4gIHRoaXMuYnVmZmVyID0gW107XG4gIHRoaXMubGVuZ3RoID0gMDtcbiAgdGhpcy5waXBlcyA9IG51bGw7XG4gIHRoaXMucGlwZXNDb3VudCA9IDA7XG4gIHRoaXMuZmxvd2luZyA9IG51bGw7XG4gIHRoaXMuZW5kZWQgPSBmYWxzZTtcbiAgdGhpcy5lbmRFbWl0dGVkID0gZmFsc2U7XG4gIHRoaXMucmVhZGluZyA9IGZhbHNlO1xuXG4gIC8vIGEgZmxhZyB0byBiZSBhYmxlIHRvIHRlbGwgaWYgdGhlIG9ud3JpdGUgY2IgaXMgY2FsbGVkIGltbWVkaWF0ZWx5LFxuICAvLyBvciBvbiBhIGxhdGVyIHRpY2suICBXZSBzZXQgdGhpcyB0byB0cnVlIGF0IGZpcnN0LCBiZWNhdXNlIGFueVxuICAvLyBhY3Rpb25zIHRoYXQgc2hvdWxkbid0IGhhcHBlbiB1bnRpbCBcImxhdGVyXCIgc2hvdWxkIGdlbmVyYWxseSBhbHNvXG4gIC8vIG5vdCBoYXBwZW4gYmVmb3JlIHRoZSBmaXJzdCB3cml0ZSBjYWxsLlxuICB0aGlzLnN5bmMgPSB0cnVlO1xuXG4gIC8vIHdoZW5ldmVyIHdlIHJldHVybiBudWxsLCB0aGVuIHdlIHNldCBhIGZsYWcgdG8gc2F5XG4gIC8vIHRoYXQgd2UncmUgYXdhaXRpbmcgYSAncmVhZGFibGUnIGV2ZW50IGVtaXNzaW9uLlxuICB0aGlzLm5lZWRSZWFkYWJsZSA9IGZhbHNlO1xuICB0aGlzLmVtaXR0ZWRSZWFkYWJsZSA9IGZhbHNlO1xuICB0aGlzLnJlYWRhYmxlTGlzdGVuaW5nID0gZmFsc2U7XG5cbiAgLy8gQ3J5cHRvIGlzIGtpbmQgb2Ygb2xkIGFuZCBjcnVzdHkuICBIaXN0b3JpY2FsbHksIGl0cyBkZWZhdWx0IHN0cmluZ1xuICAvLyBlbmNvZGluZyBpcyAnYmluYXJ5JyBzbyB3ZSBoYXZlIHRvIG1ha2UgdGhpcyBjb25maWd1cmFibGUuXG4gIC8vIEV2ZXJ5dGhpbmcgZWxzZSBpbiB0aGUgdW5pdmVyc2UgdXNlcyAndXRmOCcsIHRob3VnaC5cbiAgdGhpcy5kZWZhdWx0RW5jb2RpbmcgPSBvcHRpb25zLmRlZmF1bHRFbmNvZGluZyB8fCAndXRmOCc7XG5cbiAgLy8gd2hlbiBwaXBpbmcsIHdlIG9ubHkgY2FyZSBhYm91dCAncmVhZGFibGUnIGV2ZW50cyB0aGF0IGhhcHBlblxuICAvLyBhZnRlciByZWFkKClpbmcgYWxsIHRoZSBieXRlcyBhbmQgbm90IGdldHRpbmcgYW55IHB1c2hiYWNrLlxuICB0aGlzLnJhbk91dCA9IGZhbHNlO1xuXG4gIC8vIHRoZSBudW1iZXIgb2Ygd3JpdGVycyB0aGF0IGFyZSBhd2FpdGluZyBhIGRyYWluIGV2ZW50IGluIC5waXBlKClzXG4gIHRoaXMuYXdhaXREcmFpbiA9IDA7XG5cbiAgLy8gaWYgdHJ1ZSwgYSBtYXliZVJlYWRNb3JlIGhhcyBiZWVuIHNjaGVkdWxlZFxuICB0aGlzLnJlYWRpbmdNb3JlID0gZmFsc2U7XG5cbiAgdGhpcy5kZWNvZGVyID0gbnVsbDtcbiAgdGhpcy5lbmNvZGluZyA9IG51bGw7XG4gIGlmIChvcHRpb25zLmVuY29kaW5nKSB7XG4gICAgaWYgKCFTdHJpbmdEZWNvZGVyKVxuICAgICAgU3RyaW5nRGVjb2RlciA9IHJlcXVpcmUoJ3N0cmluZ19kZWNvZGVyLycpLlN0cmluZ0RlY29kZXI7XG4gICAgdGhpcy5kZWNvZGVyID0gbmV3IFN0cmluZ0RlY29kZXIob3B0aW9ucy5lbmNvZGluZyk7XG4gICAgdGhpcy5lbmNvZGluZyA9IG9wdGlvbnMuZW5jb2Rpbmc7XG4gIH1cbn1cblxudmFyIER1cGxleDtcbmZ1bmN0aW9uIFJlYWRhYmxlKG9wdGlvbnMpIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUmVhZGFibGUpKVxuICAgIHJldHVybiBuZXcgUmVhZGFibGUob3B0aW9ucyk7XG5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZSA9IG5ldyBSZWFkYWJsZVN0YXRlKG9wdGlvbnMsIHRoaXMpO1xuXG4gIC8vIGxlZ2FjeVxuICB0aGlzLnJlYWRhYmxlID0gdHJ1ZTtcblxuICBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5yZWFkID09PSAnZnVuY3Rpb24nKVxuICAgIHRoaXMuX3JlYWQgPSBvcHRpb25zLnJlYWQ7XG5cbiAgU3RyZWFtLmNhbGwodGhpcyk7XG59XG5cbi8vIE1hbnVhbGx5IHNob3ZlIHNvbWV0aGluZyBpbnRvIHRoZSByZWFkKCkgYnVmZmVyLlxuLy8gVGhpcyByZXR1cm5zIHRydWUgaWYgdGhlIGhpZ2hXYXRlck1hcmsgaGFzIG5vdCBiZWVuIGhpdCB5ZXQsXG4vLyBzaW1pbGFyIHRvIGhvdyBXcml0YWJsZS53cml0ZSgpIHJldHVybnMgdHJ1ZSBpZiB5b3Ugc2hvdWxkXG4vLyB3cml0ZSgpIHNvbWUgbW9yZS5cblJlYWRhYmxlLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgaWYgKCFzdGF0ZS5vYmplY3RNb2RlICYmIHR5cGVvZiBjaHVuayA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IGVuY29kaW5nIHx8IHN0YXRlLmRlZmF1bHRFbmNvZGluZztcbiAgICBpZiAoZW5jb2RpbmcgIT09IHN0YXRlLmVuY29kaW5nKSB7XG4gICAgICBjaHVuayA9IG5ldyBCdWZmZXIoY2h1bmssIGVuY29kaW5nKTtcbiAgICAgIGVuY29kaW5nID0gJyc7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlYWRhYmxlQWRkQ2h1bmsodGhpcywgc3RhdGUsIGNodW5rLCBlbmNvZGluZywgZmFsc2UpO1xufTtcblxuLy8gVW5zaGlmdCBzaG91bGQgKmFsd2F5cyogYmUgc29tZXRoaW5nIGRpcmVjdGx5IG91dCBvZiByZWFkKClcblJlYWRhYmxlLnByb3RvdHlwZS51bnNoaWZ0ID0gZnVuY3Rpb24oY2h1bmspIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgcmV0dXJuIHJlYWRhYmxlQWRkQ2h1bmsodGhpcywgc3RhdGUsIGNodW5rLCAnJywgdHJ1ZSk7XG59O1xuXG5SZWFkYWJsZS5wcm90b3R5cGUuaXNQYXVzZWQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX3JlYWRhYmxlU3RhdGUuZmxvd2luZyA9PT0gZmFsc2U7XG59O1xuXG5mdW5jdGlvbiByZWFkYWJsZUFkZENodW5rKHN0cmVhbSwgc3RhdGUsIGNodW5rLCBlbmNvZGluZywgYWRkVG9Gcm9udCkge1xuICB2YXIgZXIgPSBjaHVua0ludmFsaWQoc3RhdGUsIGNodW5rKTtcbiAgaWYgKGVyKSB7XG4gICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuICB9IGVsc2UgaWYgKGNodW5rID09PSBudWxsKSB7XG4gICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuICAgIG9uRW9mQ2h1bmsoc3RyZWFtLCBzdGF0ZSk7XG4gIH0gZWxzZSBpZiAoc3RhdGUub2JqZWN0TW9kZSB8fCBjaHVuayAmJiBjaHVuay5sZW5ndGggPiAwKSB7XG4gICAgaWYgKHN0YXRlLmVuZGVkICYmICFhZGRUb0Zyb250KSB7XG4gICAgICB2YXIgZSA9IG5ldyBFcnJvcignc3RyZWFtLnB1c2goKSBhZnRlciBFT0YnKTtcbiAgICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpO1xuICAgIH0gZWxzZSBpZiAoc3RhdGUuZW5kRW1pdHRlZCAmJiBhZGRUb0Zyb250KSB7XG4gICAgICB2YXIgZSA9IG5ldyBFcnJvcignc3RyZWFtLnVuc2hpZnQoKSBhZnRlciBlbmQgZXZlbnQnKTtcbiAgICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoc3RhdGUuZGVjb2RlciAmJiAhYWRkVG9Gcm9udCAmJiAhZW5jb2RpbmcpXG4gICAgICAgIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG5cbiAgICAgIGlmICghYWRkVG9Gcm9udClcbiAgICAgICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuXG4gICAgICAvLyBpZiB3ZSB3YW50IHRoZSBkYXRhIG5vdywganVzdCBlbWl0IGl0LlxuICAgICAgaWYgKHN0YXRlLmZsb3dpbmcgJiYgc3RhdGUubGVuZ3RoID09PSAwICYmICFzdGF0ZS5zeW5jKSB7XG4gICAgICAgIHN0cmVhbS5lbWl0KCdkYXRhJywgY2h1bmspO1xuICAgICAgICBzdHJlYW0ucmVhZCgwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgYnVmZmVyIGluZm8uXG4gICAgICAgIHN0YXRlLmxlbmd0aCArPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcbiAgICAgICAgaWYgKGFkZFRvRnJvbnQpXG4gICAgICAgICAgc3RhdGUuYnVmZmVyLnVuc2hpZnQoY2h1bmspO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgc3RhdGUuYnVmZmVyLnB1c2goY2h1bmspO1xuXG4gICAgICAgIGlmIChzdGF0ZS5uZWVkUmVhZGFibGUpXG4gICAgICAgICAgZW1pdFJlYWRhYmxlKHN0cmVhbSk7XG4gICAgICB9XG5cbiAgICAgIG1heWJlUmVhZE1vcmUoc3RyZWFtLCBzdGF0ZSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKCFhZGRUb0Zyb250KSB7XG4gICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIG5lZWRNb3JlRGF0YShzdGF0ZSk7XG59XG5cblxuLy8gaWYgaXQncyBwYXN0IHRoZSBoaWdoIHdhdGVyIG1hcmssIHdlIGNhbiBwdXNoIGluIHNvbWUgbW9yZS5cbi8vIEFsc28sIGlmIHdlIGhhdmUgbm8gZGF0YSB5ZXQsIHdlIGNhbiBzdGFuZCBzb21lXG4vLyBtb3JlIGJ5dGVzLiAgVGhpcyBpcyB0byB3b3JrIGFyb3VuZCBjYXNlcyB3aGVyZSBod209MCxcbi8vIHN1Y2ggYXMgdGhlIHJlcGwuICBBbHNvLCBpZiB0aGUgcHVzaCgpIHRyaWdnZXJlZCBhXG4vLyByZWFkYWJsZSBldmVudCwgYW5kIHRoZSB1c2VyIGNhbGxlZCByZWFkKGxhcmdlTnVtYmVyKSBzdWNoIHRoYXRcbi8vIG5lZWRSZWFkYWJsZSB3YXMgc2V0LCB0aGVuIHdlIG91Z2h0IHRvIHB1c2ggbW9yZSwgc28gdGhhdCBhbm90aGVyXG4vLyAncmVhZGFibGUnIGV2ZW50IHdpbGwgYmUgdHJpZ2dlcmVkLlxuZnVuY3Rpb24gbmVlZE1vcmVEYXRhKHN0YXRlKSB7XG4gIHJldHVybiAhc3RhdGUuZW5kZWQgJiZcbiAgICAgICAgIChzdGF0ZS5uZWVkUmVhZGFibGUgfHxcbiAgICAgICAgICBzdGF0ZS5sZW5ndGggPCBzdGF0ZS5oaWdoV2F0ZXJNYXJrIHx8XG4gICAgICAgICAgc3RhdGUubGVuZ3RoID09PSAwKTtcbn1cblxuLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXG5SZWFkYWJsZS5wcm90b3R5cGUuc2V0RW5jb2RpbmcgPSBmdW5jdGlvbihlbmMpIHtcbiAgaWYgKCFTdHJpbmdEZWNvZGVyKVxuICAgIFN0cmluZ0RlY29kZXIgPSByZXF1aXJlKCdzdHJpbmdfZGVjb2Rlci8nKS5TdHJpbmdEZWNvZGVyO1xuICB0aGlzLl9yZWFkYWJsZVN0YXRlLmRlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihlbmMpO1xuICB0aGlzLl9yZWFkYWJsZVN0YXRlLmVuY29kaW5nID0gZW5jO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIERvbid0IHJhaXNlIHRoZSBod20gPiA4TUJcbnZhciBNQVhfSFdNID0gMHg4MDAwMDA7XG5mdW5jdGlvbiBjb21wdXRlTmV3SGlnaFdhdGVyTWFyayhuKSB7XG4gIGlmIChuID49IE1BWF9IV00pIHtcbiAgICBuID0gTUFYX0hXTTtcbiAgfSBlbHNlIHtcbiAgICAvLyBHZXQgdGhlIG5leHQgaGlnaGVzdCBwb3dlciBvZiAyXG4gICAgbi0tO1xuICAgIG4gfD0gbiA+Pj4gMTtcbiAgICBuIHw9IG4gPj4+IDI7XG4gICAgbiB8PSBuID4+PiA0O1xuICAgIG4gfD0gbiA+Pj4gODtcbiAgICBuIHw9IG4gPj4+IDE2O1xuICAgIG4rKztcbiAgfVxuICByZXR1cm4gbjtcbn1cblxuZnVuY3Rpb24gaG93TXVjaFRvUmVhZChuLCBzdGF0ZSkge1xuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmIHN0YXRlLmVuZGVkKVxuICAgIHJldHVybiAwO1xuXG4gIGlmIChzdGF0ZS5vYmplY3RNb2RlKVxuICAgIHJldHVybiBuID09PSAwID8gMCA6IDE7XG5cbiAgaWYgKG4gPT09IG51bGwgfHwgaXNOYU4obikpIHtcbiAgICAvLyBvbmx5IGZsb3cgb25lIGJ1ZmZlciBhdCBhIHRpbWVcbiAgICBpZiAoc3RhdGUuZmxvd2luZyAmJiBzdGF0ZS5idWZmZXIubGVuZ3RoKVxuICAgICAgcmV0dXJuIHN0YXRlLmJ1ZmZlclswXS5sZW5ndGg7XG4gICAgZWxzZVxuICAgICAgcmV0dXJuIHN0YXRlLmxlbmd0aDtcbiAgfVxuXG4gIGlmIChuIDw9IDApXG4gICAgcmV0dXJuIDA7XG5cbiAgLy8gSWYgd2UncmUgYXNraW5nIGZvciBtb3JlIHRoYW4gdGhlIHRhcmdldCBidWZmZXIgbGV2ZWwsXG4gIC8vIHRoZW4gcmFpc2UgdGhlIHdhdGVyIG1hcmsuICBCdW1wIHVwIHRvIHRoZSBuZXh0IGhpZ2hlc3RcbiAgLy8gcG93ZXIgb2YgMiwgdG8gcHJldmVudCBpbmNyZWFzaW5nIGl0IGV4Y2Vzc2l2ZWx5IGluIHRpbnlcbiAgLy8gYW1vdW50cy5cbiAgaWYgKG4gPiBzdGF0ZS5oaWdoV2F0ZXJNYXJrKVxuICAgIHN0YXRlLmhpZ2hXYXRlck1hcmsgPSBjb21wdXRlTmV3SGlnaFdhdGVyTWFyayhuKTtcblxuICAvLyBkb24ndCBoYXZlIHRoYXQgbXVjaC4gIHJldHVybiBudWxsLCB1bmxlc3Mgd2UndmUgZW5kZWQuXG4gIGlmIChuID4gc3RhdGUubGVuZ3RoKSB7XG4gICAgaWYgKCFzdGF0ZS5lbmRlZCkge1xuICAgICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICAgIHJldHVybiAwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3RhdGUubGVuZ3RoO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuO1xufVxuXG4vLyB5b3UgY2FuIG92ZXJyaWRlIGVpdGhlciB0aGlzIG1ldGhvZCwgb3IgdGhlIGFzeW5jIF9yZWFkKG4pIGJlbG93LlxuUmVhZGFibGUucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbihuKSB7XG4gIGRlYnVnKCdyZWFkJywgbik7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHZhciBuT3JpZyA9IG47XG5cbiAgaWYgKHR5cGVvZiBuICE9PSAnbnVtYmVyJyB8fCBuID4gMClcbiAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcblxuICAvLyBpZiB3ZSdyZSBkb2luZyByZWFkKDApIHRvIHRyaWdnZXIgYSByZWFkYWJsZSBldmVudCwgYnV0IHdlXG4gIC8vIGFscmVhZHkgaGF2ZSBhIGJ1bmNoIG9mIGRhdGEgaW4gdGhlIGJ1ZmZlciwgdGhlbiBqdXN0IHRyaWdnZXJcbiAgLy8gdGhlICdyZWFkYWJsZScgZXZlbnQgYW5kIG1vdmUgb24uXG4gIGlmIChuID09PSAwICYmXG4gICAgICBzdGF0ZS5uZWVkUmVhZGFibGUgJiZcbiAgICAgIChzdGF0ZS5sZW5ndGggPj0gc3RhdGUuaGlnaFdhdGVyTWFyayB8fCBzdGF0ZS5lbmRlZCkpIHtcbiAgICBkZWJ1ZygncmVhZDogZW1pdFJlYWRhYmxlJywgc3RhdGUubGVuZ3RoLCBzdGF0ZS5lbmRlZCk7XG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5lbmRlZClcbiAgICAgIGVuZFJlYWRhYmxlKHRoaXMpO1xuICAgIGVsc2VcbiAgICAgIGVtaXRSZWFkYWJsZSh0aGlzKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIG4gPSBob3dNdWNoVG9SZWFkKG4sIHN0YXRlKTtcblxuICAvLyBpZiB3ZSd2ZSBlbmRlZCwgYW5kIHdlJ3JlIG5vdyBjbGVhciwgdGhlbiBmaW5pc2ggaXQgdXAuXG4gIGlmIChuID09PSAwICYmIHN0YXRlLmVuZGVkKSB7XG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMClcbiAgICAgIGVuZFJlYWRhYmxlKHRoaXMpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gQWxsIHRoZSBhY3R1YWwgY2h1bmsgZ2VuZXJhdGlvbiBsb2dpYyBuZWVkcyB0byBiZVxuICAvLyAqYmVsb3cqIHRoZSBjYWxsIHRvIF9yZWFkLiAgVGhlIHJlYXNvbiBpcyB0aGF0IGluIGNlcnRhaW5cbiAgLy8gc3ludGhldGljIHN0cmVhbSBjYXNlcywgc3VjaCBhcyBwYXNzdGhyb3VnaCBzdHJlYW1zLCBfcmVhZFxuICAvLyBtYXkgYmUgYSBjb21wbGV0ZWx5IHN5bmNocm9ub3VzIG9wZXJhdGlvbiB3aGljaCBtYXkgY2hhbmdlXG4gIC8vIHRoZSBzdGF0ZSBvZiB0aGUgcmVhZCBidWZmZXIsIHByb3ZpZGluZyBlbm91Z2ggZGF0YSB3aGVuXG4gIC8vIGJlZm9yZSB0aGVyZSB3YXMgKm5vdCogZW5vdWdoLlxuICAvL1xuICAvLyBTbywgdGhlIHN0ZXBzIGFyZTpcbiAgLy8gMS4gRmlndXJlIG91dCB3aGF0IHRoZSBzdGF0ZSBvZiB0aGluZ3Mgd2lsbCBiZSBhZnRlciB3ZSBkb1xuICAvLyBhIHJlYWQgZnJvbSB0aGUgYnVmZmVyLlxuICAvL1xuICAvLyAyLiBJZiB0aGF0IHJlc3VsdGluZyBzdGF0ZSB3aWxsIHRyaWdnZXIgYSBfcmVhZCwgdGhlbiBjYWxsIF9yZWFkLlxuICAvLyBOb3RlIHRoYXQgdGhpcyBtYXkgYmUgYXN5bmNocm9ub3VzLCBvciBzeW5jaHJvbm91cy4gIFllcywgaXQgaXNcbiAgLy8gZGVlcGx5IHVnbHkgdG8gd3JpdGUgQVBJcyB0aGlzIHdheSwgYnV0IHRoYXQgc3RpbGwgZG9lc24ndCBtZWFuXG4gIC8vIHRoYXQgdGhlIFJlYWRhYmxlIGNsYXNzIHNob3VsZCBiZWhhdmUgaW1wcm9wZXJseSwgYXMgc3RyZWFtcyBhcmVcbiAgLy8gZGVzaWduZWQgdG8gYmUgc3luYy9hc3luYyBhZ25vc3RpYy5cbiAgLy8gVGFrZSBub3RlIGlmIHRoZSBfcmVhZCBjYWxsIGlzIHN5bmMgb3IgYXN5bmMgKGllLCBpZiB0aGUgcmVhZCBjYWxsXG4gIC8vIGhhcyByZXR1cm5lZCB5ZXQpLCBzbyB0aGF0IHdlIGtub3cgd2hldGhlciBvciBub3QgaXQncyBzYWZlIHRvIGVtaXRcbiAgLy8gJ3JlYWRhYmxlJyBldGMuXG4gIC8vXG4gIC8vIDMuIEFjdHVhbGx5IHB1bGwgdGhlIHJlcXVlc3RlZCBjaHVua3Mgb3V0IG9mIHRoZSBidWZmZXIgYW5kIHJldHVybi5cblxuICAvLyBpZiB3ZSBuZWVkIGEgcmVhZGFibGUgZXZlbnQsIHRoZW4gd2UgbmVlZCB0byBkbyBzb21lIHJlYWRpbmcuXG4gIHZhciBkb1JlYWQgPSBzdGF0ZS5uZWVkUmVhZGFibGU7XG4gIGRlYnVnKCduZWVkIHJlYWRhYmxlJywgZG9SZWFkKTtcblxuICAvLyBpZiB3ZSBjdXJyZW50bHkgaGF2ZSBsZXNzIHRoYW4gdGhlIGhpZ2hXYXRlck1hcmssIHRoZW4gYWxzbyByZWFkIHNvbWVcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCB8fCBzdGF0ZS5sZW5ndGggLSBuIDwgc3RhdGUuaGlnaFdhdGVyTWFyaykge1xuICAgIGRvUmVhZCA9IHRydWU7XG4gICAgZGVidWcoJ2xlbmd0aCBsZXNzIHRoYW4gd2F0ZXJtYXJrJywgZG9SZWFkKTtcbiAgfVxuXG4gIC8vIGhvd2V2ZXIsIGlmIHdlJ3ZlIGVuZGVkLCB0aGVuIHRoZXJlJ3Mgbm8gcG9pbnQsIGFuZCBpZiB3ZSdyZSBhbHJlYWR5XG4gIC8vIHJlYWRpbmcsIHRoZW4gaXQncyB1bm5lY2Vzc2FyeS5cbiAgaWYgKHN0YXRlLmVuZGVkIHx8IHN0YXRlLnJlYWRpbmcpIHtcbiAgICBkb1JlYWQgPSBmYWxzZTtcbiAgICBkZWJ1ZygncmVhZGluZyBvciBlbmRlZCcsIGRvUmVhZCk7XG4gIH1cblxuICBpZiAoZG9SZWFkKSB7XG4gICAgZGVidWcoJ2RvIHJlYWQnKTtcbiAgICBzdGF0ZS5yZWFkaW5nID0gdHJ1ZTtcbiAgICBzdGF0ZS5zeW5jID0gdHJ1ZTtcbiAgICAvLyBpZiB0aGUgbGVuZ3RoIGlzIGN1cnJlbnRseSB6ZXJvLCB0aGVuIHdlICpuZWVkKiBhIHJlYWRhYmxlIGV2ZW50LlxuICAgIGlmIChzdGF0ZS5sZW5ndGggPT09IDApXG4gICAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgIC8vIGNhbGwgaW50ZXJuYWwgcmVhZCBtZXRob2RcbiAgICB0aGlzLl9yZWFkKHN0YXRlLmhpZ2hXYXRlck1hcmspO1xuICAgIHN0YXRlLnN5bmMgPSBmYWxzZTtcbiAgfVxuXG4gIC8vIElmIF9yZWFkIHB1c2hlZCBkYXRhIHN5bmNocm9ub3VzbHksIHRoZW4gYHJlYWRpbmdgIHdpbGwgYmUgZmFsc2UsXG4gIC8vIGFuZCB3ZSBuZWVkIHRvIHJlLWV2YWx1YXRlIGhvdyBtdWNoIGRhdGEgd2UgY2FuIHJldHVybiB0byB0aGUgdXNlci5cbiAgaWYgKGRvUmVhZCAmJiAhc3RhdGUucmVhZGluZylcbiAgICBuID0gaG93TXVjaFRvUmVhZChuT3JpZywgc3RhdGUpO1xuXG4gIHZhciByZXQ7XG4gIGlmIChuID4gMClcbiAgICByZXQgPSBmcm9tTGlzdChuLCBzdGF0ZSk7XG4gIGVsc2VcbiAgICByZXQgPSBudWxsO1xuXG4gIGlmIChyZXQgPT09IG51bGwpIHtcbiAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgIG4gPSAwO1xuICB9XG5cbiAgc3RhdGUubGVuZ3RoIC09IG47XG5cbiAgLy8gSWYgd2UgaGF2ZSBub3RoaW5nIGluIHRoZSBidWZmZXIsIHRoZW4gd2Ugd2FudCB0byBrbm93XG4gIC8vIGFzIHNvb24gYXMgd2UgKmRvKiBnZXQgc29tZXRoaW5nIGludG8gdGhlIGJ1ZmZlci5cbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiAhc3RhdGUuZW5kZWQpXG4gICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcblxuICAvLyBJZiB3ZSB0cmllZCB0byByZWFkKCkgcGFzdCB0aGUgRU9GLCB0aGVuIGVtaXQgZW5kIG9uIHRoZSBuZXh0IHRpY2suXG4gIGlmIChuT3JpZyAhPT0gbiAmJiBzdGF0ZS5lbmRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApXG4gICAgZW5kUmVhZGFibGUodGhpcyk7XG5cbiAgaWYgKHJldCAhPT0gbnVsbClcbiAgICB0aGlzLmVtaXQoJ2RhdGEnLCByZXQpO1xuXG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBjaHVua0ludmFsaWQoc3RhdGUsIGNodW5rKSB7XG4gIHZhciBlciA9IG51bGw7XG4gIGlmICghKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpICYmXG4gICAgICB0eXBlb2YgY2h1bmsgIT09ICdzdHJpbmcnICYmXG4gICAgICBjaHVuayAhPT0gbnVsbCAmJlxuICAgICAgY2h1bmsgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgIXN0YXRlLm9iamVjdE1vZGUpIHtcbiAgICBlciA9IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgbm9uLXN0cmluZy9idWZmZXIgY2h1bmsnKTtcbiAgfVxuICByZXR1cm4gZXI7XG59XG5cblxuZnVuY3Rpb24gb25Fb2ZDaHVuayhzdHJlYW0sIHN0YXRlKSB7XG4gIGlmIChzdGF0ZS5lbmRlZCkgcmV0dXJuO1xuICBpZiAoc3RhdGUuZGVjb2Rlcikge1xuICAgIHZhciBjaHVuayA9IHN0YXRlLmRlY29kZXIuZW5kKCk7XG4gICAgaWYgKGNodW5rICYmIGNodW5rLmxlbmd0aCkge1xuICAgICAgc3RhdGUuYnVmZmVyLnB1c2goY2h1bmspO1xuICAgICAgc3RhdGUubGVuZ3RoICs9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuICAgIH1cbiAgfVxuICBzdGF0ZS5lbmRlZCA9IHRydWU7XG5cbiAgLy8gZW1pdCAncmVhZGFibGUnIG5vdyB0byBtYWtlIHN1cmUgaXQgZ2V0cyBwaWNrZWQgdXAuXG4gIGVtaXRSZWFkYWJsZShzdHJlYW0pO1xufVxuXG4vLyBEb24ndCBlbWl0IHJlYWRhYmxlIHJpZ2h0IGF3YXkgaW4gc3luYyBtb2RlLCBiZWNhdXNlIHRoaXMgY2FuIHRyaWdnZXJcbi8vIGFub3RoZXIgcmVhZCgpIGNhbGwgPT4gc3RhY2sgb3ZlcmZsb3cuICBUaGlzIHdheSwgaXQgbWlnaHQgdHJpZ2dlclxuLy8gYSBuZXh0VGljayByZWN1cnNpb24gd2FybmluZywgYnV0IHRoYXQncyBub3Qgc28gYmFkLlxuZnVuY3Rpb24gZW1pdFJlYWRhYmxlKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIHN0YXRlLm5lZWRSZWFkYWJsZSA9IGZhbHNlO1xuICBpZiAoIXN0YXRlLmVtaXR0ZWRSZWFkYWJsZSkge1xuICAgIGRlYnVnKCdlbWl0UmVhZGFibGUnLCBzdGF0ZS5mbG93aW5nKTtcbiAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSB0cnVlO1xuICAgIGlmIChzdGF0ZS5zeW5jKVxuICAgICAgcHJvY2Vzc05leHRUaWNrKGVtaXRSZWFkYWJsZV8sIHN0cmVhbSk7XG4gICAgZWxzZVxuICAgICAgZW1pdFJlYWRhYmxlXyhzdHJlYW0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtaXRSZWFkYWJsZV8oc3RyZWFtKSB7XG4gIGRlYnVnKCdlbWl0IHJlYWRhYmxlJyk7XG4gIHN0cmVhbS5lbWl0KCdyZWFkYWJsZScpO1xuICBmbG93KHN0cmVhbSk7XG59XG5cblxuLy8gYXQgdGhpcyBwb2ludCwgdGhlIHVzZXIgaGFzIHByZXN1bWFibHkgc2VlbiB0aGUgJ3JlYWRhYmxlJyBldmVudCxcbi8vIGFuZCBjYWxsZWQgcmVhZCgpIHRvIGNvbnN1bWUgc29tZSBkYXRhLiAgdGhhdCBtYXkgaGF2ZSB0cmlnZ2VyZWRcbi8vIGluIHR1cm4gYW5vdGhlciBfcmVhZChuKSBjYWxsLCBpbiB3aGljaCBjYXNlIHJlYWRpbmcgPSB0cnVlIGlmXG4vLyBpdCdzIGluIHByb2dyZXNzLlxuLy8gSG93ZXZlciwgaWYgd2UncmUgbm90IGVuZGVkLCBvciByZWFkaW5nLCBhbmQgdGhlIGxlbmd0aCA8IGh3bSxcbi8vIHRoZW4gZ28gYWhlYWQgYW5kIHRyeSB0byByZWFkIHNvbWUgbW9yZSBwcmVlbXB0aXZlbHkuXG5mdW5jdGlvbiBtYXliZVJlYWRNb3JlKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZWFkaW5nTW9yZSkge1xuICAgIHN0YXRlLnJlYWRpbmdNb3JlID0gdHJ1ZTtcbiAgICBwcm9jZXNzTmV4dFRpY2sobWF5YmVSZWFkTW9yZV8sIHN0cmVhbSwgc3RhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1heWJlUmVhZE1vcmVfKHN0cmVhbSwgc3RhdGUpIHtcbiAgdmFyIGxlbiA9IHN0YXRlLmxlbmd0aDtcbiAgd2hpbGUgKCFzdGF0ZS5yZWFkaW5nICYmICFzdGF0ZS5mbG93aW5nICYmICFzdGF0ZS5lbmRlZCAmJlxuICAgICAgICAgc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyaykge1xuICAgIGRlYnVnKCdtYXliZVJlYWRNb3JlIHJlYWQgMCcpO1xuICAgIHN0cmVhbS5yZWFkKDApO1xuICAgIGlmIChsZW4gPT09IHN0YXRlLmxlbmd0aClcbiAgICAgIC8vIGRpZG4ndCBnZXQgYW55IGRhdGEsIHN0b3Agc3Bpbm5pbmcuXG4gICAgICBicmVhaztcbiAgICBlbHNlXG4gICAgICBsZW4gPSBzdGF0ZS5sZW5ndGg7XG4gIH1cbiAgc3RhdGUucmVhZGluZ01vcmUgPSBmYWxzZTtcbn1cblxuLy8gYWJzdHJhY3QgbWV0aG9kLiAgdG8gYmUgb3ZlcnJpZGRlbiBpbiBzcGVjaWZpYyBpbXBsZW1lbnRhdGlvbiBjbGFzc2VzLlxuLy8gY2FsbCBjYihlciwgZGF0YSkgd2hlcmUgZGF0YSBpcyA8PSBuIGluIGxlbmd0aC5cbi8vIGZvciB2aXJ0dWFsIChub24tc3RyaW5nLCBub24tYnVmZmVyKSBzdHJlYW1zLCBcImxlbmd0aFwiIGlzIHNvbWV3aGF0XG4vLyBhcmJpdHJhcnksIGFuZCBwZXJoYXBzIG5vdCB2ZXJ5IG1lYW5pbmdmdWwuXG5SZWFkYWJsZS5wcm90b3R5cGUuX3JlYWQgPSBmdW5jdGlvbihuKSB7XG4gIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpKTtcbn07XG5cblJlYWRhYmxlLnByb3RvdHlwZS5waXBlID0gZnVuY3Rpb24oZGVzdCwgcGlwZU9wdHMpIHtcbiAgdmFyIHNyYyA9IHRoaXM7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgc3dpdGNoIChzdGF0ZS5waXBlc0NvdW50KSB7XG4gICAgY2FzZSAwOlxuICAgICAgc3RhdGUucGlwZXMgPSBkZXN0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAxOlxuICAgICAgc3RhdGUucGlwZXMgPSBbc3RhdGUucGlwZXMsIGRlc3RdO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHN0YXRlLnBpcGVzLnB1c2goZGVzdCk7XG4gICAgICBicmVhaztcbiAgfVxuICBzdGF0ZS5waXBlc0NvdW50ICs9IDE7XG4gIGRlYnVnKCdwaXBlIGNvdW50PSVkIG9wdHM9JWonLCBzdGF0ZS5waXBlc0NvdW50LCBwaXBlT3B0cyk7XG5cbiAgdmFyIGRvRW5kID0gKCFwaXBlT3B0cyB8fCBwaXBlT3B0cy5lbmQgIT09IGZhbHNlKSAmJlxuICAgICAgICAgICAgICBkZXN0ICE9PSBwcm9jZXNzLnN0ZG91dCAmJlxuICAgICAgICAgICAgICBkZXN0ICE9PSBwcm9jZXNzLnN0ZGVycjtcblxuICB2YXIgZW5kRm4gPSBkb0VuZCA/IG9uZW5kIDogY2xlYW51cDtcbiAgaWYgKHN0YXRlLmVuZEVtaXR0ZWQpXG4gICAgcHJvY2Vzc05leHRUaWNrKGVuZEZuKTtcbiAgZWxzZVxuICAgIHNyYy5vbmNlKCdlbmQnLCBlbmRGbik7XG5cbiAgZGVzdC5vbigndW5waXBlJywgb251bnBpcGUpO1xuICBmdW5jdGlvbiBvbnVucGlwZShyZWFkYWJsZSkge1xuICAgIGRlYnVnKCdvbnVucGlwZScpO1xuICAgIGlmIChyZWFkYWJsZSA9PT0gc3JjKSB7XG4gICAgICBjbGVhbnVwKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25lbmQoKSB7XG4gICAgZGVidWcoJ29uZW5kJyk7XG4gICAgZGVzdC5lbmQoKTtcbiAgfVxuXG4gIC8vIHdoZW4gdGhlIGRlc3QgZHJhaW5zLCBpdCByZWR1Y2VzIHRoZSBhd2FpdERyYWluIGNvdW50ZXJcbiAgLy8gb24gdGhlIHNvdXJjZS4gIFRoaXMgd291bGQgYmUgbW9yZSBlbGVnYW50IHdpdGggYSAub25jZSgpXG4gIC8vIGhhbmRsZXIgaW4gZmxvdygpLCBidXQgYWRkaW5nIGFuZCByZW1vdmluZyByZXBlYXRlZGx5IGlzXG4gIC8vIHRvbyBzbG93LlxuICB2YXIgb25kcmFpbiA9IHBpcGVPbkRyYWluKHNyYyk7XG4gIGRlc3Qub24oJ2RyYWluJywgb25kcmFpbik7XG5cbiAgdmFyIGNsZWFuZWRVcCA9IGZhbHNlO1xuICBmdW5jdGlvbiBjbGVhbnVwKCkge1xuICAgIGRlYnVnKCdjbGVhbnVwJyk7XG4gICAgLy8gY2xlYW51cCBldmVudCBoYW5kbGVycyBvbmNlIHRoZSBwaXBlIGlzIGJyb2tlblxuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZmluaXNoJywgb25maW5pc2gpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2RyYWluJywgb25kcmFpbik7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCd1bnBpcGUnLCBvbnVucGlwZSk7XG4gICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBvbmVuZCk7XG4gICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBjbGVhbnVwKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2RhdGEnLCBvbmRhdGEpO1xuXG4gICAgY2xlYW5lZFVwID0gdHJ1ZTtcblxuICAgIC8vIGlmIHRoZSByZWFkZXIgaXMgd2FpdGluZyBmb3IgYSBkcmFpbiBldmVudCBmcm9tIHRoaXNcbiAgICAvLyBzcGVjaWZpYyB3cml0ZXIsIHRoZW4gaXQgd291bGQgY2F1c2UgaXQgdG8gbmV2ZXIgc3RhcnRcbiAgICAvLyBmbG93aW5nIGFnYWluLlxuICAgIC8vIFNvLCBpZiB0aGlzIGlzIGF3YWl0aW5nIGEgZHJhaW4sIHRoZW4gd2UganVzdCBjYWxsIGl0IG5vdy5cbiAgICAvLyBJZiB3ZSBkb24ndCBrbm93LCB0aGVuIGFzc3VtZSB0aGF0IHdlIGFyZSB3YWl0aW5nIGZvciBvbmUuXG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4gJiZcbiAgICAgICAgKCFkZXN0Ll93cml0YWJsZVN0YXRlIHx8IGRlc3QuX3dyaXRhYmxlU3RhdGUubmVlZERyYWluKSlcbiAgICAgIG9uZHJhaW4oKTtcbiAgfVxuXG4gIHNyYy5vbignZGF0YScsIG9uZGF0YSk7XG4gIGZ1bmN0aW9uIG9uZGF0YShjaHVuaykge1xuICAgIGRlYnVnKCdvbmRhdGEnKTtcbiAgICB2YXIgcmV0ID0gZGVzdC53cml0ZShjaHVuayk7XG4gICAgaWYgKGZhbHNlID09PSByZXQpIHtcbiAgICAgIC8vIElmIHRoZSB1c2VyIHVucGlwZWQgZHVyaW5nIGBkZXN0LndyaXRlKClgLCBpdCBpcyBwb3NzaWJsZVxuICAgICAgLy8gdG8gZ2V0IHN0dWNrIGluIGEgcGVybWFuZW50bHkgcGF1c2VkIHN0YXRlIGlmIHRoYXQgd3JpdGVcbiAgICAgIC8vIGFsc28gcmV0dXJuZWQgZmFsc2UuXG4gICAgICBpZiAoc3RhdGUucGlwZXNDb3VudCA9PT0gMSAmJlxuICAgICAgICAgIHN0YXRlLnBpcGVzWzBdID09PSBkZXN0ICYmXG4gICAgICAgICAgc3JjLmxpc3RlbmVyQ291bnQoJ2RhdGEnKSA9PT0gMSAmJlxuICAgICAgICAgICFjbGVhbmVkVXApIHtcbiAgICAgICAgZGVidWcoJ2ZhbHNlIHdyaXRlIHJlc3BvbnNlLCBwYXVzZScsIHNyYy5fcmVhZGFibGVTdGF0ZS5hd2FpdERyYWluKTtcbiAgICAgICAgc3JjLl9yZWFkYWJsZVN0YXRlLmF3YWl0RHJhaW4rKztcbiAgICAgIH1cbiAgICAgIHNyYy5wYXVzZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBkZXN0IGhhcyBhbiBlcnJvciwgdGhlbiBzdG9wIHBpcGluZyBpbnRvIGl0LlxuICAvLyBob3dldmVyLCBkb24ndCBzdXBwcmVzcyB0aGUgdGhyb3dpbmcgYmVoYXZpb3IgZm9yIHRoaXMuXG4gIGZ1bmN0aW9uIG9uZXJyb3IoZXIpIHtcbiAgICBkZWJ1Zygnb25lcnJvcicsIGVyKTtcbiAgICB1bnBpcGUoKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGlmIChFRWxpc3RlbmVyQ291bnQoZGVzdCwgJ2Vycm9yJykgPT09IDApXG4gICAgICBkZXN0LmVtaXQoJ2Vycm9yJywgZXIpO1xuICB9XG4gIC8vIFRoaXMgaXMgYSBicnV0YWxseSB1Z2x5IGhhY2sgdG8gbWFrZSBzdXJlIHRoYXQgb3VyIGVycm9yIGhhbmRsZXJcbiAgLy8gaXMgYXR0YWNoZWQgYmVmb3JlIGFueSB1c2VybGFuZCBvbmVzLiAgTkVWRVIgRE8gVEhJUy5cbiAgaWYgKCFkZXN0Ll9ldmVudHMgfHwgIWRlc3QuX2V2ZW50cy5lcnJvcilcbiAgICBkZXN0Lm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuICBlbHNlIGlmIChpc0FycmF5KGRlc3QuX2V2ZW50cy5lcnJvcikpXG4gICAgZGVzdC5fZXZlbnRzLmVycm9yLnVuc2hpZnQob25lcnJvcik7XG4gIGVsc2VcbiAgICBkZXN0Ll9ldmVudHMuZXJyb3IgPSBbb25lcnJvciwgZGVzdC5fZXZlbnRzLmVycm9yXTtcblxuXG4gIC8vIEJvdGggY2xvc2UgYW5kIGZpbmlzaCBzaG91bGQgdHJpZ2dlciB1bnBpcGUsIGJ1dCBvbmx5IG9uY2UuXG4gIGZ1bmN0aW9uIG9uY2xvc2UoKSB7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZmluaXNoJywgb25maW5pc2gpO1xuICAgIHVucGlwZSgpO1xuICB9XG4gIGRlc3Qub25jZSgnY2xvc2UnLCBvbmNsb3NlKTtcbiAgZnVuY3Rpb24gb25maW5pc2goKSB7XG4gICAgZGVidWcoJ29uZmluaXNoJyk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBvbmNsb3NlKTtcbiAgICB1bnBpcGUoKTtcbiAgfVxuICBkZXN0Lm9uY2UoJ2ZpbmlzaCcsIG9uZmluaXNoKTtcblxuICBmdW5jdGlvbiB1bnBpcGUoKSB7XG4gICAgZGVidWcoJ3VucGlwZScpO1xuICAgIHNyYy51bnBpcGUoZGVzdCk7XG4gIH1cblxuICAvLyB0ZWxsIHRoZSBkZXN0IHRoYXQgaXQncyBiZWluZyBwaXBlZCB0b1xuICBkZXN0LmVtaXQoJ3BpcGUnLCBzcmMpO1xuXG4gIC8vIHN0YXJ0IHRoZSBmbG93IGlmIGl0IGhhc24ndCBiZWVuIHN0YXJ0ZWQgYWxyZWFkeS5cbiAgaWYgKCFzdGF0ZS5mbG93aW5nKSB7XG4gICAgZGVidWcoJ3BpcGUgcmVzdW1lJyk7XG4gICAgc3JjLnJlc3VtZSgpO1xuICB9XG5cbiAgcmV0dXJuIGRlc3Q7XG59O1xuXG5mdW5jdGlvbiBwaXBlT25EcmFpbihzcmMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdGF0ZSA9IHNyYy5fcmVhZGFibGVTdGF0ZTtcbiAgICBkZWJ1ZygncGlwZU9uRHJhaW4nLCBzdGF0ZS5hd2FpdERyYWluKTtcbiAgICBpZiAoc3RhdGUuYXdhaXREcmFpbilcbiAgICAgIHN0YXRlLmF3YWl0RHJhaW4tLTtcbiAgICBpZiAoc3RhdGUuYXdhaXREcmFpbiA9PT0gMCAmJiBFRWxpc3RlbmVyQ291bnQoc3JjLCAnZGF0YScpKSB7XG4gICAgICBzdGF0ZS5mbG93aW5nID0gdHJ1ZTtcbiAgICAgIGZsb3coc3JjKTtcbiAgICB9XG4gIH07XG59XG5cblxuUmVhZGFibGUucHJvdG90eXBlLnVucGlwZSA9IGZ1bmN0aW9uKGRlc3QpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcblxuICAvLyBpZiB3ZSdyZSBub3QgcGlwaW5nIGFueXdoZXJlLCB0aGVuIGRvIG5vdGhpbmcuXG4gIGlmIChzdGF0ZS5waXBlc0NvdW50ID09PSAwKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIGp1c3Qgb25lIGRlc3RpbmF0aW9uLiAgbW9zdCBjb21tb24gY2FzZS5cbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDEpIHtcbiAgICAvLyBwYXNzZWQgaW4gb25lLCBidXQgaXQncyBub3QgdGhlIHJpZ2h0IG9uZS5cbiAgICBpZiAoZGVzdCAmJiBkZXN0ICE9PSBzdGF0ZS5waXBlcylcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKCFkZXN0KVxuICAgICAgZGVzdCA9IHN0YXRlLnBpcGVzO1xuXG4gICAgLy8gZ290IGEgbWF0Y2guXG4gICAgc3RhdGUucGlwZXMgPSBudWxsO1xuICAgIHN0YXRlLnBpcGVzQ291bnQgPSAwO1xuICAgIHN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcbiAgICBpZiAoZGVzdClcbiAgICAgIGRlc3QuZW1pdCgndW5waXBlJywgdGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBzbG93IGNhc2UuIG11bHRpcGxlIHBpcGUgZGVzdGluYXRpb25zLlxuXG4gIGlmICghZGVzdCkge1xuICAgIC8vIHJlbW92ZSBhbGwuXG4gICAgdmFyIGRlc3RzID0gc3RhdGUucGlwZXM7XG4gICAgdmFyIGxlbiA9IHN0YXRlLnBpcGVzQ291bnQ7XG4gICAgc3RhdGUucGlwZXMgPSBudWxsO1xuICAgIHN0YXRlLnBpcGVzQ291bnQgPSAwO1xuICAgIHN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBkZXN0c1tpXS5lbWl0KCd1bnBpcGUnLCB0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIHRyeSB0byBmaW5kIHRoZSByaWdodCBvbmUuXG4gIHZhciBpID0gaW5kZXhPZihzdGF0ZS5waXBlcywgZGVzdCk7XG4gIGlmIChpID09PSAtMSlcbiAgICByZXR1cm4gdGhpcztcblxuICBzdGF0ZS5waXBlcy5zcGxpY2UoaSwgMSk7XG4gIHN0YXRlLnBpcGVzQ291bnQgLT0gMTtcbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDEpXG4gICAgc3RhdGUucGlwZXMgPSBzdGF0ZS5waXBlc1swXTtcblxuICBkZXN0LmVtaXQoJ3VucGlwZScsIHRoaXMpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gc2V0IHVwIGRhdGEgZXZlbnRzIGlmIHRoZXkgYXJlIGFza2VkIGZvclxuLy8gRW5zdXJlIHJlYWRhYmxlIGxpc3RlbmVycyBldmVudHVhbGx5IGdldCBzb21ldGhpbmdcblJlYWRhYmxlLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2LCBmbikge1xuICB2YXIgcmVzID0gU3RyZWFtLnByb3RvdHlwZS5vbi5jYWxsKHRoaXMsIGV2LCBmbik7XG5cbiAgLy8gSWYgbGlzdGVuaW5nIHRvIGRhdGEsIGFuZCBpdCBoYXMgbm90IGV4cGxpY2l0bHkgYmVlbiBwYXVzZWQsXG4gIC8vIHRoZW4gY2FsbCByZXN1bWUgdG8gc3RhcnQgdGhlIGZsb3cgb2YgZGF0YSBvbiB0aGUgbmV4dCB0aWNrLlxuICBpZiAoZXYgPT09ICdkYXRhJyAmJiBmYWxzZSAhPT0gdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKSB7XG4gICAgdGhpcy5yZXN1bWUoKTtcbiAgfVxuXG4gIGlmIChldiA9PT0gJ3JlYWRhYmxlJyAmJiB0aGlzLnJlYWRhYmxlKSB7XG4gICAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgICBpZiAoIXN0YXRlLnJlYWRhYmxlTGlzdGVuaW5nKSB7XG4gICAgICBzdGF0ZS5yZWFkYWJsZUxpc3RlbmluZyA9IHRydWU7XG4gICAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcbiAgICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgICBpZiAoIXN0YXRlLnJlYWRpbmcpIHtcbiAgICAgICAgcHJvY2Vzc05leHRUaWNrKG5SZWFkaW5nTmV4dFRpY2ssIHRoaXMpO1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZS5sZW5ndGgpIHtcbiAgICAgICAgZW1pdFJlYWRhYmxlKHRoaXMsIHN0YXRlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzO1xufTtcblJlYWRhYmxlLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IFJlYWRhYmxlLnByb3RvdHlwZS5vbjtcblxuZnVuY3Rpb24gblJlYWRpbmdOZXh0VGljayhzZWxmKSB7XG4gIGRlYnVnKCdyZWFkYWJsZSBuZXh0dGljayByZWFkIDAnKTtcbiAgc2VsZi5yZWFkKDApO1xufVxuXG4vLyBwYXVzZSgpIGFuZCByZXN1bWUoKSBhcmUgcmVtbmFudHMgb2YgdGhlIGxlZ2FjeSByZWFkYWJsZSBzdHJlYW0gQVBJXG4vLyBJZiB0aGUgdXNlciB1c2VzIHRoZW0sIHRoZW4gc3dpdGNoIGludG8gb2xkIG1vZGUuXG5SZWFkYWJsZS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdyZXN1bWUnKTtcbiAgICBzdGF0ZS5mbG93aW5nID0gdHJ1ZTtcbiAgICByZXN1bWUodGhpcywgc3RhdGUpO1xuICB9XG4gIHJldHVybiB0aGlzO1xufTtcblxuZnVuY3Rpb24gcmVzdW1lKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZXN1bWVTY2hlZHVsZWQpIHtcbiAgICBzdGF0ZS5yZXN1bWVTY2hlZHVsZWQgPSB0cnVlO1xuICAgIHByb2Nlc3NOZXh0VGljayhyZXN1bWVfLCBzdHJlYW0sIHN0YXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZXN1bWVfKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZWFkaW5nKSB7XG4gICAgZGVidWcoJ3Jlc3VtZSByZWFkIDAnKTtcbiAgICBzdHJlYW0ucmVhZCgwKTtcbiAgfVxuXG4gIHN0YXRlLnJlc3VtZVNjaGVkdWxlZCA9IGZhbHNlO1xuICBzdHJlYW0uZW1pdCgncmVzdW1lJyk7XG4gIGZsb3coc3RyZWFtKTtcbiAgaWYgKHN0YXRlLmZsb3dpbmcgJiYgIXN0YXRlLnJlYWRpbmcpXG4gICAgc3RyZWFtLnJlYWQoMCk7XG59XG5cblJlYWRhYmxlLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICBkZWJ1ZygnY2FsbCBwYXVzZSBmbG93aW5nPSVqJywgdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKTtcbiAgaWYgKGZhbHNlICE9PSB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpIHtcbiAgICBkZWJ1ZygncGF1c2UnKTtcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmVtaXQoJ3BhdXNlJyk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiBmbG93KHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIGRlYnVnKCdmbG93Jywgc3RhdGUuZmxvd2luZyk7XG4gIGlmIChzdGF0ZS5mbG93aW5nKSB7XG4gICAgZG8ge1xuICAgICAgdmFyIGNodW5rID0gc3RyZWFtLnJlYWQoKTtcbiAgICB9IHdoaWxlIChudWxsICE9PSBjaHVuayAmJiBzdGF0ZS5mbG93aW5nKTtcbiAgfVxufVxuXG4vLyB3cmFwIGFuIG9sZC1zdHlsZSBzdHJlYW0gYXMgdGhlIGFzeW5jIGRhdGEgc291cmNlLlxuLy8gVGhpcyBpcyAqbm90KiBwYXJ0IG9mIHRoZSByZWFkYWJsZSBzdHJlYW0gaW50ZXJmYWNlLlxuLy8gSXQgaXMgYW4gdWdseSB1bmZvcnR1bmF0ZSBtZXNzIG9mIGhpc3RvcnkuXG5SZWFkYWJsZS5wcm90b3R5cGUud3JhcCA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICB2YXIgcGF1c2VkID0gZmFsc2U7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uKCkge1xuICAgIGRlYnVnKCd3cmFwcGVkIGVuZCcpO1xuICAgIGlmIChzdGF0ZS5kZWNvZGVyICYmICFzdGF0ZS5lbmRlZCkge1xuICAgICAgdmFyIGNodW5rID0gc3RhdGUuZGVjb2Rlci5lbmQoKTtcbiAgICAgIGlmIChjaHVuayAmJiBjaHVuay5sZW5ndGgpXG4gICAgICAgIHNlbGYucHVzaChjaHVuayk7XG4gICAgfVxuXG4gICAgc2VsZi5wdXNoKG51bGwpO1xuICB9KTtcblxuICBzdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbihjaHVuaykge1xuICAgIGRlYnVnKCd3cmFwcGVkIGRhdGEnKTtcbiAgICBpZiAoc3RhdGUuZGVjb2RlcilcbiAgICAgIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG5cbiAgICAvLyBkb24ndCBza2lwIG92ZXIgZmFsc3kgdmFsdWVzIGluIG9iamVjdE1vZGVcbiAgICBpZiAoc3RhdGUub2JqZWN0TW9kZSAmJiAoY2h1bmsgPT09IG51bGwgfHwgY2h1bmsgPT09IHVuZGVmaW5lZCkpXG4gICAgICByZXR1cm47XG4gICAgZWxzZSBpZiAoIXN0YXRlLm9iamVjdE1vZGUgJiYgKCFjaHVuayB8fCAhY2h1bmsubGVuZ3RoKSlcbiAgICAgIHJldHVybjtcblxuICAgIHZhciByZXQgPSBzZWxmLnB1c2goY2h1bmspO1xuICAgIGlmICghcmV0KSB7XG4gICAgICBwYXVzZWQgPSB0cnVlO1xuICAgICAgc3RyZWFtLnBhdXNlKCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBwcm94eSBhbGwgdGhlIG90aGVyIG1ldGhvZHMuXG4gIC8vIGltcG9ydGFudCB3aGVuIHdyYXBwaW5nIGZpbHRlcnMgYW5kIGR1cGxleGVzLlxuICBmb3IgKHZhciBpIGluIHN0cmVhbSkge1xuICAgIGlmICh0aGlzW2ldID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIHN0cmVhbVtpXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpc1tpXSA9IGZ1bmN0aW9uKG1ldGhvZCkgeyByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzdHJlYW1bbWV0aG9kXS5hcHBseShzdHJlYW0sIGFyZ3VtZW50cyk7XG4gICAgICB9OyB9KGkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIHByb3h5IGNlcnRhaW4gaW1wb3J0YW50IGV2ZW50cy5cbiAgdmFyIGV2ZW50cyA9IFsnZXJyb3InLCAnY2xvc2UnLCAnZGVzdHJveScsICdwYXVzZScsICdyZXN1bWUnXTtcbiAgZm9yRWFjaChldmVudHMsIGZ1bmN0aW9uKGV2KSB7XG4gICAgc3RyZWFtLm9uKGV2LCBzZWxmLmVtaXQuYmluZChzZWxmLCBldikpO1xuICB9KTtcblxuICAvLyB3aGVuIHdlIHRyeSB0byBjb25zdW1lIHNvbWUgbW9yZSBieXRlcywgc2ltcGx5IHVucGF1c2UgdGhlXG4gIC8vIHVuZGVybHlpbmcgc3RyZWFtLlxuICBzZWxmLl9yZWFkID0gZnVuY3Rpb24obikge1xuICAgIGRlYnVnKCd3cmFwcGVkIF9yZWFkJywgbik7XG4gICAgaWYgKHBhdXNlZCkge1xuICAgICAgcGF1c2VkID0gZmFsc2U7XG4gICAgICBzdHJlYW0ucmVzdW1lKCk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBzZWxmO1xufTtcblxuXG4vLyBleHBvc2VkIGZvciB0ZXN0aW5nIHB1cnBvc2VzIG9ubHkuXG5SZWFkYWJsZS5fZnJvbUxpc3QgPSBmcm9tTGlzdDtcblxuLy8gUGx1Y2sgb2ZmIG4gYnl0ZXMgZnJvbSBhbiBhcnJheSBvZiBidWZmZXJzLlxuLy8gTGVuZ3RoIGlzIHRoZSBjb21iaW5lZCBsZW5ndGhzIG9mIGFsbCB0aGUgYnVmZmVycyBpbiB0aGUgbGlzdC5cbmZ1bmN0aW9uIGZyb21MaXN0KG4sIHN0YXRlKSB7XG4gIHZhciBsaXN0ID0gc3RhdGUuYnVmZmVyO1xuICB2YXIgbGVuZ3RoID0gc3RhdGUubGVuZ3RoO1xuICB2YXIgc3RyaW5nTW9kZSA9ICEhc3RhdGUuZGVjb2RlcjtcbiAgdmFyIG9iamVjdE1vZGUgPSAhIXN0YXRlLm9iamVjdE1vZGU7XG4gIHZhciByZXQ7XG5cbiAgLy8gbm90aGluZyBpbiB0aGUgbGlzdCwgZGVmaW5pdGVseSBlbXB0eS5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKVxuICAgIHJldHVybiBudWxsO1xuXG4gIGlmIChsZW5ndGggPT09IDApXG4gICAgcmV0ID0gbnVsbDtcbiAgZWxzZSBpZiAob2JqZWN0TW9kZSlcbiAgICByZXQgPSBsaXN0LnNoaWZ0KCk7XG4gIGVsc2UgaWYgKCFuIHx8IG4gPj0gbGVuZ3RoKSB7XG4gICAgLy8gcmVhZCBpdCBhbGwsIHRydW5jYXRlIHRoZSBhcnJheS5cbiAgICBpZiAoc3RyaW5nTW9kZSlcbiAgICAgIHJldCA9IGxpc3Quam9pbignJyk7XG4gICAgZWxzZSBpZiAobGlzdC5sZW5ndGggPT09IDEpXG4gICAgICByZXQgPSBsaXN0WzBdO1xuICAgIGVsc2VcbiAgICAgIHJldCA9IEJ1ZmZlci5jb25jYXQobGlzdCwgbGVuZ3RoKTtcbiAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gIH0gZWxzZSB7XG4gICAgLy8gcmVhZCBqdXN0IHNvbWUgb2YgaXQuXG4gICAgaWYgKG4gPCBsaXN0WzBdLmxlbmd0aCkge1xuICAgICAgLy8ganVzdCB0YWtlIGEgcGFydCBvZiB0aGUgZmlyc3QgbGlzdCBpdGVtLlxuICAgICAgLy8gc2xpY2UgaXMgdGhlIHNhbWUgZm9yIGJ1ZmZlcnMgYW5kIHN0cmluZ3MuXG4gICAgICB2YXIgYnVmID0gbGlzdFswXTtcbiAgICAgIHJldCA9IGJ1Zi5zbGljZSgwLCBuKTtcbiAgICAgIGxpc3RbMF0gPSBidWYuc2xpY2Uobik7XG4gICAgfSBlbHNlIGlmIChuID09PSBsaXN0WzBdLmxlbmd0aCkge1xuICAgICAgLy8gZmlyc3QgbGlzdCBpcyBhIHBlcmZlY3QgbWF0Y2hcbiAgICAgIHJldCA9IGxpc3Quc2hpZnQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY29tcGxleCBjYXNlLlxuICAgICAgLy8gd2UgaGF2ZSBlbm91Z2ggdG8gY292ZXIgaXQsIGJ1dCBpdCBzcGFucyBwYXN0IHRoZSBmaXJzdCBidWZmZXIuXG4gICAgICBpZiAoc3RyaW5nTW9kZSlcbiAgICAgICAgcmV0ID0gJyc7XG4gICAgICBlbHNlXG4gICAgICAgIHJldCA9IG5ldyBCdWZmZXIobik7XG5cbiAgICAgIHZhciBjID0gMDtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdC5sZW5ndGg7IGkgPCBsICYmIGMgPCBuOyBpKyspIHtcbiAgICAgICAgdmFyIGJ1ZiA9IGxpc3RbMF07XG4gICAgICAgIHZhciBjcHkgPSBNYXRoLm1pbihuIC0gYywgYnVmLmxlbmd0aCk7XG5cbiAgICAgICAgaWYgKHN0cmluZ01vZGUpXG4gICAgICAgICAgcmV0ICs9IGJ1Zi5zbGljZSgwLCBjcHkpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYnVmLmNvcHkocmV0LCBjLCAwLCBjcHkpO1xuXG4gICAgICAgIGlmIChjcHkgPCBidWYubGVuZ3RoKVxuICAgICAgICAgIGxpc3RbMF0gPSBidWYuc2xpY2UoY3B5KTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGxpc3Quc2hpZnQoKTtcblxuICAgICAgICBjICs9IGNweTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBlbmRSZWFkYWJsZShzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuXG4gIC8vIElmIHdlIGdldCBoZXJlIGJlZm9yZSBjb25zdW1pbmcgYWxsIHRoZSBieXRlcywgdGhlbiB0aGF0IGlzIGFcbiAgLy8gYnVnIGluIG5vZGUuICBTaG91bGQgbmV2ZXIgaGFwcGVuLlxuICBpZiAoc3RhdGUubGVuZ3RoID4gMClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2VuZFJlYWRhYmxlIGNhbGxlZCBvbiBub24tZW1wdHkgc3RyZWFtJyk7XG5cbiAgaWYgKCFzdGF0ZS5lbmRFbWl0dGVkKSB7XG4gICAgc3RhdGUuZW5kZWQgPSB0cnVlO1xuICAgIHByb2Nlc3NOZXh0VGljayhlbmRSZWFkYWJsZU5ULCBzdGF0ZSwgc3RyZWFtKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbmRSZWFkYWJsZU5UKHN0YXRlLCBzdHJlYW0pIHtcbiAgLy8gQ2hlY2sgdGhhdCB3ZSBkaWRuJ3QgZ2V0IG9uZSBsYXN0IHVuc2hpZnQuXG4gIGlmICghc3RhdGUuZW5kRW1pdHRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApIHtcbiAgICBzdGF0ZS5lbmRFbWl0dGVkID0gdHJ1ZTtcbiAgICBzdHJlYW0ucmVhZGFibGUgPSBmYWxzZTtcbiAgICBzdHJlYW0uZW1pdCgnZW5kJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZm9yRWFjaCAoeHMsIGYpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmKHhzW2ldLCBpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbmRleE9mICh4cywgeCkge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGlmICh4c1tpXSA9PT0geCkgcmV0dXJuIGk7XG4gIH1cbiAgcmV0dXJuIC0xO1xufVxuIiwiLy8gYSB0cmFuc2Zvcm0gc3RyZWFtIGlzIGEgcmVhZGFibGUvd3JpdGFibGUgc3RyZWFtIHdoZXJlIHlvdSBkb1xuLy8gc29tZXRoaW5nIHdpdGggdGhlIGRhdGEuICBTb21ldGltZXMgaXQncyBjYWxsZWQgYSBcImZpbHRlclwiLFxuLy8gYnV0IHRoYXQncyBub3QgYSBncmVhdCBuYW1lIGZvciBpdCwgc2luY2UgdGhhdCBpbXBsaWVzIGEgdGhpbmcgd2hlcmVcbi8vIHNvbWUgYml0cyBwYXNzIHRocm91Z2gsIGFuZCBvdGhlcnMgYXJlIHNpbXBseSBpZ25vcmVkLiAgKFRoYXQgd291bGRcbi8vIGJlIGEgdmFsaWQgZXhhbXBsZSBvZiBhIHRyYW5zZm9ybSwgb2YgY291cnNlLilcbi8vXG4vLyBXaGlsZSB0aGUgb3V0cHV0IGlzIGNhdXNhbGx5IHJlbGF0ZWQgdG8gdGhlIGlucHV0LCBpdCdzIG5vdCBhXG4vLyBuZWNlc3NhcmlseSBzeW1tZXRyaWMgb3Igc3luY2hyb25vdXMgdHJhbnNmb3JtYXRpb24uICBGb3IgZXhhbXBsZSxcbi8vIGEgemxpYiBzdHJlYW0gbWlnaHQgdGFrZSBtdWx0aXBsZSBwbGFpbi10ZXh0IHdyaXRlcygpLCBhbmQgdGhlblxuLy8gZW1pdCBhIHNpbmdsZSBjb21wcmVzc2VkIGNodW5rIHNvbWUgdGltZSBpbiB0aGUgZnV0dXJlLlxuLy9cbi8vIEhlcmUncyBob3cgdGhpcyB3b3Jrczpcbi8vXG4vLyBUaGUgVHJhbnNmb3JtIHN0cmVhbSBoYXMgYWxsIHRoZSBhc3BlY3RzIG9mIHRoZSByZWFkYWJsZSBhbmQgd3JpdGFibGVcbi8vIHN0cmVhbSBjbGFzc2VzLiAgV2hlbiB5b3Ugd3JpdGUoY2h1bmspLCB0aGF0IGNhbGxzIF93cml0ZShjaHVuayxjYilcbi8vIGludGVybmFsbHksIGFuZCByZXR1cm5zIGZhbHNlIGlmIHRoZXJlJ3MgYSBsb3Qgb2YgcGVuZGluZyB3cml0ZXNcbi8vIGJ1ZmZlcmVkIHVwLiAgV2hlbiB5b3UgY2FsbCByZWFkKCksIHRoYXQgY2FsbHMgX3JlYWQobikgdW50aWxcbi8vIHRoZXJlJ3MgZW5vdWdoIHBlbmRpbmcgcmVhZGFibGUgZGF0YSBidWZmZXJlZCB1cC5cbi8vXG4vLyBJbiBhIHRyYW5zZm9ybSBzdHJlYW0sIHRoZSB3cml0dGVuIGRhdGEgaXMgcGxhY2VkIGluIGEgYnVmZmVyLiAgV2hlblxuLy8gX3JlYWQobikgaXMgY2FsbGVkLCBpdCB0cmFuc2Zvcm1zIHRoZSBxdWV1ZWQgdXAgZGF0YSwgY2FsbGluZyB0aGVcbi8vIGJ1ZmZlcmVkIF93cml0ZSBjYidzIGFzIGl0IGNvbnN1bWVzIGNodW5rcy4gIElmIGNvbnN1bWluZyBhIHNpbmdsZVxuLy8gd3JpdHRlbiBjaHVuayB3b3VsZCByZXN1bHQgaW4gbXVsdGlwbGUgb3V0cHV0IGNodW5rcywgdGhlbiB0aGUgZmlyc3Rcbi8vIG91dHB1dHRlZCBiaXQgY2FsbHMgdGhlIHJlYWRjYiwgYW5kIHN1YnNlcXVlbnQgY2h1bmtzIGp1c3QgZ28gaW50b1xuLy8gdGhlIHJlYWQgYnVmZmVyLCBhbmQgd2lsbCBjYXVzZSBpdCB0byBlbWl0ICdyZWFkYWJsZScgaWYgbmVjZXNzYXJ5LlxuLy9cbi8vIFRoaXMgd2F5LCBiYWNrLXByZXNzdXJlIGlzIGFjdHVhbGx5IGRldGVybWluZWQgYnkgdGhlIHJlYWRpbmcgc2lkZSxcbi8vIHNpbmNlIF9yZWFkIGhhcyB0byBiZSBjYWxsZWQgdG8gc3RhcnQgcHJvY2Vzc2luZyBhIG5ldyBjaHVuay4gIEhvd2V2ZXIsXG4vLyBhIHBhdGhvbG9naWNhbCBpbmZsYXRlIHR5cGUgb2YgdHJhbnNmb3JtIGNhbiBjYXVzZSBleGNlc3NpdmUgYnVmZmVyaW5nXG4vLyBoZXJlLiAgRm9yIGV4YW1wbGUsIGltYWdpbmUgYSBzdHJlYW0gd2hlcmUgZXZlcnkgYnl0ZSBvZiBpbnB1dCBpc1xuLy8gaW50ZXJwcmV0ZWQgYXMgYW4gaW50ZWdlciBmcm9tIDAtMjU1LCBhbmQgdGhlbiByZXN1bHRzIGluIHRoYXQgbWFueVxuLy8gYnl0ZXMgb2Ygb3V0cHV0LiAgV3JpdGluZyB0aGUgNCBieXRlcyB7ZmYsZmYsZmYsZmZ9IHdvdWxkIHJlc3VsdCBpblxuLy8gMWtiIG9mIGRhdGEgYmVpbmcgb3V0cHV0LiAgSW4gdGhpcyBjYXNlLCB5b3UgY291bGQgd3JpdGUgYSB2ZXJ5IHNtYWxsXG4vLyBhbW91bnQgb2YgaW5wdXQsIGFuZCBlbmQgdXAgd2l0aCBhIHZlcnkgbGFyZ2UgYW1vdW50IG9mIG91dHB1dC4gIEluXG4vLyBzdWNoIGEgcGF0aG9sb2dpY2FsIGluZmxhdGluZyBtZWNoYW5pc20sIHRoZXJlJ2QgYmUgbm8gd2F5IHRvIHRlbGxcbi8vIHRoZSBzeXN0ZW0gdG8gc3RvcCBkb2luZyB0aGUgdHJhbnNmb3JtLiAgQSBzaW5nbGUgNE1CIHdyaXRlIGNvdWxkXG4vLyBjYXVzZSB0aGUgc3lzdGVtIHRvIHJ1biBvdXQgb2YgbWVtb3J5LlxuLy9cbi8vIEhvd2V2ZXIsIGV2ZW4gaW4gc3VjaCBhIHBhdGhvbG9naWNhbCBjYXNlLCBvbmx5IGEgc2luZ2xlIHdyaXR0ZW4gY2h1bmtcbi8vIHdvdWxkIGJlIGNvbnN1bWVkLCBhbmQgdGhlbiB0aGUgcmVzdCB3b3VsZCB3YWl0ICh1bi10cmFuc2Zvcm1lZCkgdW50aWxcbi8vIHRoZSByZXN1bHRzIG9mIHRoZSBwcmV2aW91cyB0cmFuc2Zvcm1lZCBjaHVuayB3ZXJlIGNvbnN1bWVkLlxuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gVHJhbnNmb3JtO1xuXG52YXIgRHVwbGV4ID0gcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbnV0aWwuaW5oZXJpdHMoVHJhbnNmb3JtLCBEdXBsZXgpO1xuXG5cbmZ1bmN0aW9uIFRyYW5zZm9ybVN0YXRlKHN0cmVhbSkge1xuICB0aGlzLmFmdGVyVHJhbnNmb3JtID0gZnVuY3Rpb24oZXIsIGRhdGEpIHtcbiAgICByZXR1cm4gYWZ0ZXJUcmFuc2Zvcm0oc3RyZWFtLCBlciwgZGF0YSk7XG4gIH07XG5cbiAgdGhpcy5uZWVkVHJhbnNmb3JtID0gZmFsc2U7XG4gIHRoaXMudHJhbnNmb3JtaW5nID0gZmFsc2U7XG4gIHRoaXMud3JpdGVjYiA9IG51bGw7XG4gIHRoaXMud3JpdGVjaHVuayA9IG51bGw7XG59XG5cbmZ1bmN0aW9uIGFmdGVyVHJhbnNmb3JtKHN0cmVhbSwgZXIsIGRhdGEpIHtcbiAgdmFyIHRzID0gc3RyZWFtLl90cmFuc2Zvcm1TdGF0ZTtcbiAgdHMudHJhbnNmb3JtaW5nID0gZmFsc2U7XG5cbiAgdmFyIGNiID0gdHMud3JpdGVjYjtcblxuICBpZiAoIWNiKVxuICAgIHJldHVybiBzdHJlYW0uZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ25vIHdyaXRlY2IgaW4gVHJhbnNmb3JtIGNsYXNzJykpO1xuXG4gIHRzLndyaXRlY2h1bmsgPSBudWxsO1xuICB0cy53cml0ZWNiID0gbnVsbDtcblxuICBpZiAoZGF0YSAhPT0gbnVsbCAmJiBkYXRhICE9PSB1bmRlZmluZWQpXG4gICAgc3RyZWFtLnB1c2goZGF0YSk7XG5cbiAgaWYgKGNiKVxuICAgIGNiKGVyKTtcblxuICB2YXIgcnMgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIHJzLnJlYWRpbmcgPSBmYWxzZTtcbiAgaWYgKHJzLm5lZWRSZWFkYWJsZSB8fCBycy5sZW5ndGggPCBycy5oaWdoV2F0ZXJNYXJrKSB7XG4gICAgc3RyZWFtLl9yZWFkKHJzLmhpZ2hXYXRlck1hcmspO1xuICB9XG59XG5cblxuZnVuY3Rpb24gVHJhbnNmb3JtKG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFRyYW5zZm9ybSkpXG4gICAgcmV0dXJuIG5ldyBUcmFuc2Zvcm0ob3B0aW9ucyk7XG5cbiAgRHVwbGV4LmNhbGwodGhpcywgb3B0aW9ucyk7XG5cbiAgdGhpcy5fdHJhbnNmb3JtU3RhdGUgPSBuZXcgVHJhbnNmb3JtU3RhdGUodGhpcyk7XG5cbiAgLy8gd2hlbiB0aGUgd3JpdGFibGUgc2lkZSBmaW5pc2hlcywgdGhlbiBmbHVzaCBvdXQgYW55dGhpbmcgcmVtYWluaW5nLlxuICB2YXIgc3RyZWFtID0gdGhpcztcblxuICAvLyBzdGFydCBvdXQgYXNraW5nIGZvciBhIHJlYWRhYmxlIGV2ZW50IG9uY2UgZGF0YSBpcyB0cmFuc2Zvcm1lZC5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuXG4gIC8vIHdlIGhhdmUgaW1wbGVtZW50ZWQgdGhlIF9yZWFkIG1ldGhvZCwgYW5kIGRvbmUgdGhlIG90aGVyIHRoaW5nc1xuICAvLyB0aGF0IFJlYWRhYmxlIHdhbnRzIGJlZm9yZSB0aGUgZmlyc3QgX3JlYWQgY2FsbCwgc28gdW5zZXQgdGhlXG4gIC8vIHN5bmMgZ3VhcmQgZmxhZy5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5zeW5jID0gZmFsc2U7XG5cbiAgaWYgKG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMudHJhbnNmb3JtID09PSAnZnVuY3Rpb24nKVxuICAgICAgdGhpcy5fdHJhbnNmb3JtID0gb3B0aW9ucy50cmFuc2Zvcm07XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuZmx1c2ggPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl9mbHVzaCA9IG9wdGlvbnMuZmx1c2g7XG4gIH1cblxuICB0aGlzLm9uY2UoJ3ByZWZpbmlzaCcsIGZ1bmN0aW9uKCkge1xuICAgIGlmICh0eXBlb2YgdGhpcy5fZmx1c2ggPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl9mbHVzaChmdW5jdGlvbihlcikge1xuICAgICAgICBkb25lKHN0cmVhbSwgZXIpO1xuICAgICAgfSk7XG4gICAgZWxzZVxuICAgICAgZG9uZShzdHJlYW0pO1xuICB9KTtcbn1cblxuVHJhbnNmb3JtLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nKSB7XG4gIHRoaXMuX3RyYW5zZm9ybVN0YXRlLm5lZWRUcmFuc2Zvcm0gPSBmYWxzZTtcbiAgcmV0dXJuIER1cGxleC5wcm90b3R5cGUucHVzaC5jYWxsKHRoaXMsIGNodW5rLCBlbmNvZGluZyk7XG59O1xuXG4vLyBUaGlzIGlzIHRoZSBwYXJ0IHdoZXJlIHlvdSBkbyBzdHVmZiFcbi8vIG92ZXJyaWRlIHRoaXMgZnVuY3Rpb24gaW4gaW1wbGVtZW50YXRpb24gY2xhc3Nlcy5cbi8vICdjaHVuaycgaXMgYW4gaW5wdXQgY2h1bmsuXG4vL1xuLy8gQ2FsbCBgcHVzaChuZXdDaHVuaylgIHRvIHBhc3MgYWxvbmcgdHJhbnNmb3JtZWQgb3V0cHV0XG4vLyB0byB0aGUgcmVhZGFibGUgc2lkZS4gIFlvdSBtYXkgY2FsbCAncHVzaCcgemVybyBvciBtb3JlIHRpbWVzLlxuLy9cbi8vIENhbGwgYGNiKGVycilgIHdoZW4geW91IGFyZSBkb25lIHdpdGggdGhpcyBjaHVuay4gIElmIHlvdSBwYXNzXG4vLyBhbiBlcnJvciwgdGhlbiB0aGF0J2xsIHB1dCB0aGUgaHVydCBvbiB0aGUgd2hvbGUgb3BlcmF0aW9uLiAgSWYgeW91XG4vLyBuZXZlciBjYWxsIGNiKCksIHRoZW4geW91J2xsIG5ldmVyIGdldCBhbm90aGVyIGNodW5rLlxuVHJhbnNmb3JtLnByb3RvdHlwZS5fdHJhbnNmb3JtID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xufTtcblxuVHJhbnNmb3JtLnByb3RvdHlwZS5fd3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciB0cyA9IHRoaXMuX3RyYW5zZm9ybVN0YXRlO1xuICB0cy53cml0ZWNiID0gY2I7XG4gIHRzLndyaXRlY2h1bmsgPSBjaHVuaztcbiAgdHMud3JpdGVlbmNvZGluZyA9IGVuY29kaW5nO1xuICBpZiAoIXRzLnRyYW5zZm9ybWluZykge1xuICAgIHZhciBycyA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gICAgaWYgKHRzLm5lZWRUcmFuc2Zvcm0gfHxcbiAgICAgICAgcnMubmVlZFJlYWRhYmxlIHx8XG4gICAgICAgIHJzLmxlbmd0aCA8IHJzLmhpZ2hXYXRlck1hcmspXG4gICAgICB0aGlzLl9yZWFkKHJzLmhpZ2hXYXRlck1hcmspO1xuICB9XG59O1xuXG4vLyBEb2Vzbid0IG1hdHRlciB3aGF0IHRoZSBhcmdzIGFyZSBoZXJlLlxuLy8gX3RyYW5zZm9ybSBkb2VzIGFsbCB0aGUgd29yay5cbi8vIFRoYXQgd2UgZ290IGhlcmUgbWVhbnMgdGhhdCB0aGUgcmVhZGFibGUgc2lkZSB3YW50cyBtb3JlIGRhdGEuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLl9yZWFkID0gZnVuY3Rpb24obikge1xuICB2YXIgdHMgPSB0aGlzLl90cmFuc2Zvcm1TdGF0ZTtcblxuICBpZiAodHMud3JpdGVjaHVuayAhPT0gbnVsbCAmJiB0cy53cml0ZWNiICYmICF0cy50cmFuc2Zvcm1pbmcpIHtcbiAgICB0cy50cmFuc2Zvcm1pbmcgPSB0cnVlO1xuICAgIHRoaXMuX3RyYW5zZm9ybSh0cy53cml0ZWNodW5rLCB0cy53cml0ZWVuY29kaW5nLCB0cy5hZnRlclRyYW5zZm9ybSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gbWFyayB0aGF0IHdlIG5lZWQgYSB0cmFuc2Zvcm0sIHNvIHRoYXQgYW55IGRhdGEgdGhhdCBjb21lcyBpblxuICAgIC8vIHdpbGwgZ2V0IHByb2Nlc3NlZCwgbm93IHRoYXQgd2UndmUgYXNrZWQgZm9yIGl0LlxuICAgIHRzLm5lZWRUcmFuc2Zvcm0gPSB0cnVlO1xuICB9XG59O1xuXG5cbmZ1bmN0aW9uIGRvbmUoc3RyZWFtLCBlcikge1xuICBpZiAoZXIpXG4gICAgcmV0dXJuIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcblxuICAvLyBpZiB0aGVyZSdzIG5vdGhpbmcgaW4gdGhlIHdyaXRlIGJ1ZmZlciwgdGhlbiB0aGF0IG1lYW5zXG4gIC8vIHRoYXQgbm90aGluZyBtb3JlIHdpbGwgZXZlciBiZSBwcm92aWRlZFxuICB2YXIgd3MgPSBzdHJlYW0uX3dyaXRhYmxlU3RhdGU7XG4gIHZhciB0cyA9IHN0cmVhbS5fdHJhbnNmb3JtU3RhdGU7XG5cbiAgaWYgKHdzLmxlbmd0aClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbGxpbmcgdHJhbnNmb3JtIGRvbmUgd2hlbiB3cy5sZW5ndGggIT0gMCcpO1xuXG4gIGlmICh0cy50cmFuc2Zvcm1pbmcpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjYWxsaW5nIHRyYW5zZm9ybSBkb25lIHdoZW4gc3RpbGwgdHJhbnNmb3JtaW5nJyk7XG5cbiAgcmV0dXJuIHN0cmVhbS5wdXNoKG51bGwpO1xufVxuIiwiLy8gQSBiaXQgc2ltcGxlciB0aGFuIHJlYWRhYmxlIHN0cmVhbXMuXG4vLyBJbXBsZW1lbnQgYW4gYXN5bmMgLl93cml0ZShjaHVuaywgZW5jb2RpbmcsIGNiKSwgYW5kIGl0J2xsIGhhbmRsZSBhbGxcbi8vIHRoZSBkcmFpbiBldmVudCBlbWlzc2lvbiBhbmQgYnVmZmVyaW5nLlxuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gV3JpdGFibGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgcHJvY2Vzc05leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy1uZXh0aWNrLWFyZ3MnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbldyaXRhYmxlLldyaXRhYmxlU3RhdGUgPSBXcml0YWJsZVN0YXRlO1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGludGVybmFsVXRpbCA9IHtcbiAgZGVwcmVjYXRlOiByZXF1aXJlKCd1dGlsLWRlcHJlY2F0ZScpXG59O1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIFN0cmVhbTtcbihmdW5jdGlvbiAoKXt0cnl7XG4gIFN0cmVhbSA9IHJlcXVpcmUoJ3N0JyArICdyZWFtJyk7XG59Y2F0Y2goXyl7fWZpbmFsbHl7XG4gIGlmICghU3RyZWFtKVxuICAgIFN0cmVhbSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbn19KCkpXG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcblxudXRpbC5pbmhlcml0cyhXcml0YWJsZSwgU3RyZWFtKTtcblxuZnVuY3Rpb24gbm9wKCkge31cblxuZnVuY3Rpb24gV3JpdGVSZXEoY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB0aGlzLmNodW5rID0gY2h1bms7XG4gIHRoaXMuZW5jb2RpbmcgPSBlbmNvZGluZztcbiAgdGhpcy5jYWxsYmFjayA9IGNiO1xuICB0aGlzLm5leHQgPSBudWxsO1xufVxuXG52YXIgRHVwbGV4O1xuZnVuY3Rpb24gV3JpdGFibGVTdGF0ZShvcHRpb25zLCBzdHJlYW0pIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyBvYmplY3Qgc3RyZWFtIGZsYWcgdG8gaW5kaWNhdGUgd2hldGhlciBvciBub3QgdGhpcyBzdHJlYW1cbiAgLy8gY29udGFpbnMgYnVmZmVycyBvciBvYmplY3RzLlxuICB0aGlzLm9iamVjdE1vZGUgPSAhIW9wdGlvbnMub2JqZWN0TW9kZTtcblxuICBpZiAoc3RyZWFtIGluc3RhbmNlb2YgRHVwbGV4KVxuICAgIHRoaXMub2JqZWN0TW9kZSA9IHRoaXMub2JqZWN0TW9kZSB8fCAhIW9wdGlvbnMud3JpdGFibGVPYmplY3RNb2RlO1xuXG4gIC8vIHRoZSBwb2ludCBhdCB3aGljaCB3cml0ZSgpIHN0YXJ0cyByZXR1cm5pbmcgZmFsc2VcbiAgLy8gTm90ZTogMCBpcyBhIHZhbGlkIHZhbHVlLCBtZWFucyB0aGF0IHdlIGFsd2F5cyByZXR1cm4gZmFsc2UgaWZcbiAgLy8gdGhlIGVudGlyZSBidWZmZXIgaXMgbm90IGZsdXNoZWQgaW1tZWRpYXRlbHkgb24gd3JpdGUoKVxuICB2YXIgaHdtID0gb3B0aW9ucy5oaWdoV2F0ZXJNYXJrO1xuICB2YXIgZGVmYXVsdEh3bSA9IHRoaXMub2JqZWN0TW9kZSA/IDE2IDogMTYgKiAxMDI0O1xuICB0aGlzLmhpZ2hXYXRlck1hcmsgPSAoaHdtIHx8IGh3bSA9PT0gMCkgPyBod20gOiBkZWZhdWx0SHdtO1xuXG4gIC8vIGNhc3QgdG8gaW50cy5cbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gfn50aGlzLmhpZ2hXYXRlck1hcms7XG5cbiAgdGhpcy5uZWVkRHJhaW4gPSBmYWxzZTtcbiAgLy8gYXQgdGhlIHN0YXJ0IG9mIGNhbGxpbmcgZW5kKClcbiAgdGhpcy5lbmRpbmcgPSBmYWxzZTtcbiAgLy8gd2hlbiBlbmQoKSBoYXMgYmVlbiBjYWxsZWQsIGFuZCByZXR1cm5lZFxuICB0aGlzLmVuZGVkID0gZmFsc2U7XG4gIC8vIHdoZW4gJ2ZpbmlzaCcgaXMgZW1pdHRlZFxuICB0aGlzLmZpbmlzaGVkID0gZmFsc2U7XG5cbiAgLy8gc2hvdWxkIHdlIGRlY29kZSBzdHJpbmdzIGludG8gYnVmZmVycyBiZWZvcmUgcGFzc2luZyB0byBfd3JpdGU/XG4gIC8vIHRoaXMgaXMgaGVyZSBzbyB0aGF0IHNvbWUgbm9kZS1jb3JlIHN0cmVhbXMgY2FuIG9wdGltaXplIHN0cmluZ1xuICAvLyBoYW5kbGluZyBhdCBhIGxvd2VyIGxldmVsLlxuICB2YXIgbm9EZWNvZGUgPSBvcHRpb25zLmRlY29kZVN0cmluZ3MgPT09IGZhbHNlO1xuICB0aGlzLmRlY29kZVN0cmluZ3MgPSAhbm9EZWNvZGU7XG5cbiAgLy8gQ3J5cHRvIGlzIGtpbmQgb2Ygb2xkIGFuZCBjcnVzdHkuICBIaXN0b3JpY2FsbHksIGl0cyBkZWZhdWx0IHN0cmluZ1xuICAvLyBlbmNvZGluZyBpcyAnYmluYXJ5JyBzbyB3ZSBoYXZlIHRvIG1ha2UgdGhpcyBjb25maWd1cmFibGUuXG4gIC8vIEV2ZXJ5dGhpbmcgZWxzZSBpbiB0aGUgdW5pdmVyc2UgdXNlcyAndXRmOCcsIHRob3VnaC5cbiAgdGhpcy5kZWZhdWx0RW5jb2RpbmcgPSBvcHRpb25zLmRlZmF1bHRFbmNvZGluZyB8fCAndXRmOCc7XG5cbiAgLy8gbm90IGFuIGFjdHVhbCBidWZmZXIgd2Uga2VlcCB0cmFjayBvZiwgYnV0IGEgbWVhc3VyZW1lbnRcbiAgLy8gb2YgaG93IG11Y2ggd2UncmUgd2FpdGluZyB0byBnZXQgcHVzaGVkIHRvIHNvbWUgdW5kZXJseWluZ1xuICAvLyBzb2NrZXQgb3IgZmlsZS5cbiAgdGhpcy5sZW5ndGggPSAwO1xuXG4gIC8vIGEgZmxhZyB0byBzZWUgd2hlbiB3ZSdyZSBpbiB0aGUgbWlkZGxlIG9mIGEgd3JpdGUuXG4gIHRoaXMud3JpdGluZyA9IGZhbHNlO1xuXG4gIC8vIHdoZW4gdHJ1ZSBhbGwgd3JpdGVzIHdpbGwgYmUgYnVmZmVyZWQgdW50aWwgLnVuY29yaygpIGNhbGxcbiAgdGhpcy5jb3JrZWQgPSAwO1xuXG4gIC8vIGEgZmxhZyB0byBiZSBhYmxlIHRvIHRlbGwgaWYgdGhlIG9ud3JpdGUgY2IgaXMgY2FsbGVkIGltbWVkaWF0ZWx5LFxuICAvLyBvciBvbiBhIGxhdGVyIHRpY2suICBXZSBzZXQgdGhpcyB0byB0cnVlIGF0IGZpcnN0LCBiZWNhdXNlIGFueVxuICAvLyBhY3Rpb25zIHRoYXQgc2hvdWxkbid0IGhhcHBlbiB1bnRpbCBcImxhdGVyXCIgc2hvdWxkIGdlbmVyYWxseSBhbHNvXG4gIC8vIG5vdCBoYXBwZW4gYmVmb3JlIHRoZSBmaXJzdCB3cml0ZSBjYWxsLlxuICB0aGlzLnN5bmMgPSB0cnVlO1xuXG4gIC8vIGEgZmxhZyB0byBrbm93IGlmIHdlJ3JlIHByb2Nlc3NpbmcgcHJldmlvdXNseSBidWZmZXJlZCBpdGVtcywgd2hpY2hcbiAgLy8gbWF5IGNhbGwgdGhlIF93cml0ZSgpIGNhbGxiYWNrIGluIHRoZSBzYW1lIHRpY2ssIHNvIHRoYXQgd2UgZG9uJ3RcbiAgLy8gZW5kIHVwIGluIGFuIG92ZXJsYXBwZWQgb253cml0ZSBzaXR1YXRpb24uXG4gIHRoaXMuYnVmZmVyUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG4gIC8vIHRoZSBjYWxsYmFjayB0aGF0J3MgcGFzc2VkIHRvIF93cml0ZShjaHVuayxjYilcbiAgdGhpcy5vbndyaXRlID0gZnVuY3Rpb24oZXIpIHtcbiAgICBvbndyaXRlKHN0cmVhbSwgZXIpO1xuICB9O1xuXG4gIC8vIHRoZSBjYWxsYmFjayB0aGF0IHRoZSB1c2VyIHN1cHBsaWVzIHRvIHdyaXRlKGNodW5rLGVuY29kaW5nLGNiKVxuICB0aGlzLndyaXRlY2IgPSBudWxsO1xuXG4gIC8vIHRoZSBhbW91bnQgdGhhdCBpcyBiZWluZyB3cml0dGVuIHdoZW4gX3dyaXRlIGlzIGNhbGxlZC5cbiAgdGhpcy53cml0ZWxlbiA9IDA7XG5cbiAgdGhpcy5idWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuICB0aGlzLmxhc3RCdWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuXG4gIC8vIG51bWJlciBvZiBwZW5kaW5nIHVzZXItc3VwcGxpZWQgd3JpdGUgY2FsbGJhY2tzXG4gIC8vIHRoaXMgbXVzdCBiZSAwIGJlZm9yZSAnZmluaXNoJyBjYW4gYmUgZW1pdHRlZFxuICB0aGlzLnBlbmRpbmdjYiA9IDA7XG5cbiAgLy8gZW1pdCBwcmVmaW5pc2ggaWYgdGhlIG9ubHkgdGhpbmcgd2UncmUgd2FpdGluZyBmb3IgaXMgX3dyaXRlIGNic1xuICAvLyBUaGlzIGlzIHJlbGV2YW50IGZvciBzeW5jaHJvbm91cyBUcmFuc2Zvcm0gc3RyZWFtc1xuICB0aGlzLnByZWZpbmlzaGVkID0gZmFsc2U7XG5cbiAgLy8gVHJ1ZSBpZiB0aGUgZXJyb3Igd2FzIGFscmVhZHkgZW1pdHRlZCBhbmQgc2hvdWxkIG5vdCBiZSB0aHJvd24gYWdhaW5cbiAgdGhpcy5lcnJvckVtaXR0ZWQgPSBmYWxzZTtcbn1cblxuV3JpdGFibGVTdGF0ZS5wcm90b3R5cGUuZ2V0QnVmZmVyID0gZnVuY3Rpb24gd3JpdGFibGVTdGF0ZUdldEJ1ZmZlcigpIHtcbiAgdmFyIGN1cnJlbnQgPSB0aGlzLmJ1ZmZlcmVkUmVxdWVzdDtcbiAgdmFyIG91dCA9IFtdO1xuICB3aGlsZSAoY3VycmVudCkge1xuICAgIG91dC5wdXNoKGN1cnJlbnQpO1xuICAgIGN1cnJlbnQgPSBjdXJyZW50Lm5leHQ7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn07XG5cbihmdW5jdGlvbiAoKXt0cnkge1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFdyaXRhYmxlU3RhdGUucHJvdG90eXBlLCAnYnVmZmVyJywge1xuICBnZXQ6IGludGVybmFsVXRpbC5kZXByZWNhdGUoZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyKCk7XG4gIH0sICdfd3JpdGFibGVTdGF0ZS5idWZmZXIgaXMgZGVwcmVjYXRlZC4gVXNlIF93cml0YWJsZVN0YXRlLmdldEJ1ZmZlciAnICtcbiAgICAgJ2luc3RlYWQuJylcbn0pO1xufWNhdGNoKF8pe319KCkpO1xuXG5cbnZhciBEdXBsZXg7XG5mdW5jdGlvbiBXcml0YWJsZShvcHRpb25zKSB7XG4gIER1cGxleCA9IER1cGxleCB8fCByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgLy8gV3JpdGFibGUgY3RvciBpcyBhcHBsaWVkIHRvIER1cGxleGVzLCB0aG91Z2ggdGhleSdyZSBub3RcbiAgLy8gaW5zdGFuY2VvZiBXcml0YWJsZSwgdGhleSdyZSBpbnN0YW5jZW9mIFJlYWRhYmxlLlxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgV3JpdGFibGUpICYmICEodGhpcyBpbnN0YW5jZW9mIER1cGxleCkpXG4gICAgcmV0dXJuIG5ldyBXcml0YWJsZShvcHRpb25zKTtcblxuICB0aGlzLl93cml0YWJsZVN0YXRlID0gbmV3IFdyaXRhYmxlU3RhdGUob3B0aW9ucywgdGhpcyk7XG5cbiAgLy8gbGVnYWN5LlxuICB0aGlzLndyaXRhYmxlID0gdHJ1ZTtcblxuICBpZiAob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy53cml0ZSA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgIHRoaXMuX3dyaXRlID0gb3B0aW9ucy53cml0ZTtcblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy53cml0ZXYgPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl93cml0ZXYgPSBvcHRpb25zLndyaXRldjtcbiAgfVxuXG4gIFN0cmVhbS5jYWxsKHRoaXMpO1xufVxuXG4vLyBPdGhlcndpc2UgcGVvcGxlIGNhbiBwaXBlIFdyaXRhYmxlIHN0cmVhbXMsIHdoaWNoIGlzIGp1c3Qgd3JvbmcuXG5Xcml0YWJsZS5wcm90b3R5cGUucGlwZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdDYW5ub3QgcGlwZS4gTm90IHJlYWRhYmxlLicpKTtcbn07XG5cblxuZnVuY3Rpb24gd3JpdGVBZnRlckVuZChzdHJlYW0sIGNiKSB7XG4gIHZhciBlciA9IG5ldyBFcnJvcignd3JpdGUgYWZ0ZXIgZW5kJyk7XG4gIC8vIFRPRE86IGRlZmVyIGVycm9yIGV2ZW50cyBjb25zaXN0ZW50bHkgZXZlcnl3aGVyZSwgbm90IGp1c3QgdGhlIGNiXG4gIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgcHJvY2Vzc05leHRUaWNrKGNiLCBlcik7XG59XG5cbi8vIElmIHdlIGdldCBzb21ldGhpbmcgdGhhdCBpcyBub3QgYSBidWZmZXIsIHN0cmluZywgbnVsbCwgb3IgdW5kZWZpbmVkLFxuLy8gYW5kIHdlJ3JlIG5vdCBpbiBvYmplY3RNb2RlLCB0aGVuIHRoYXQncyBhbiBlcnJvci5cbi8vIE90aGVyd2lzZSBzdHJlYW0gY2h1bmtzIGFyZSBhbGwgY29uc2lkZXJlZCB0byBiZSBvZiBsZW5ndGg9MSwgYW5kIHRoZVxuLy8gd2F0ZXJtYXJrcyBkZXRlcm1pbmUgaG93IG1hbnkgb2JqZWN0cyB0byBrZWVwIGluIHRoZSBidWZmZXIsIHJhdGhlciB0aGFuXG4vLyBob3cgbWFueSBieXRlcyBvciBjaGFyYWN0ZXJzLlxuZnVuY3Rpb24gdmFsaWRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgY2IpIHtcbiAgdmFyIHZhbGlkID0gdHJ1ZTtcblxuICBpZiAoIShCdWZmZXIuaXNCdWZmZXIoY2h1bmspKSAmJlxuICAgICAgdHlwZW9mIGNodW5rICE9PSAnc3RyaW5nJyAmJlxuICAgICAgY2h1bmsgIT09IG51bGwgJiZcbiAgICAgIGNodW5rICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgdmFyIGVyID0gbmV3IFR5cGVFcnJvcignSW52YWxpZCBub24tc3RyaW5nL2J1ZmZlciBjaHVuaycpO1xuICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgICBwcm9jZXNzTmV4dFRpY2soY2IsIGVyKTtcbiAgICB2YWxpZCA9IGZhbHNlO1xuICB9XG4gIHJldHVybiB2YWxpZDtcbn1cblxuV3JpdGFibGUucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuICB2YXIgcmV0ID0gZmFsc2U7XG5cbiAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNiID0gZW5jb2Rpbmc7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9XG5cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpXG4gICAgZW5jb2RpbmcgPSAnYnVmZmVyJztcbiAgZWxzZSBpZiAoIWVuY29kaW5nKVxuICAgIGVuY29kaW5nID0gc3RhdGUuZGVmYXVsdEVuY29kaW5nO1xuXG4gIGlmICh0eXBlb2YgY2IgIT09ICdmdW5jdGlvbicpXG4gICAgY2IgPSBub3A7XG5cbiAgaWYgKHN0YXRlLmVuZGVkKVxuICAgIHdyaXRlQWZ0ZXJFbmQodGhpcywgY2IpO1xuICBlbHNlIGlmICh2YWxpZENodW5rKHRoaXMsIHN0YXRlLCBjaHVuaywgY2IpKSB7XG4gICAgc3RhdGUucGVuZGluZ2NiKys7XG4gICAgcmV0ID0gd3JpdGVPckJ1ZmZlcih0aGlzLCBzdGF0ZSwgY2h1bmssIGVuY29kaW5nLCBjYik7XG4gIH1cblxuICByZXR1cm4gcmV0O1xufTtcblxuV3JpdGFibGUucHJvdG90eXBlLmNvcmsgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fd3JpdGFibGVTdGF0ZTtcblxuICBzdGF0ZS5jb3JrZWQrKztcbn07XG5cbldyaXRhYmxlLnByb3RvdHlwZS51bmNvcmsgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fd3JpdGFibGVTdGF0ZTtcblxuICBpZiAoc3RhdGUuY29ya2VkKSB7XG4gICAgc3RhdGUuY29ya2VkLS07XG5cbiAgICBpZiAoIXN0YXRlLndyaXRpbmcgJiZcbiAgICAgICAgIXN0YXRlLmNvcmtlZCAmJlxuICAgICAgICAhc3RhdGUuZmluaXNoZWQgJiZcbiAgICAgICAgIXN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgJiZcbiAgICAgICAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0KVxuICAgICAgY2xlYXJCdWZmZXIodGhpcywgc3RhdGUpO1xuICB9XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuc2V0RGVmYXVsdEVuY29kaW5nID0gZnVuY3Rpb24gc2V0RGVmYXVsdEVuY29kaW5nKGVuY29kaW5nKSB7XG4gIC8vIG5vZGU6OlBhcnNlRW5jb2RpbmcoKSByZXF1aXJlcyBsb3dlciBjYXNlLlxuICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJylcbiAgICBlbmNvZGluZyA9IGVuY29kaW5nLnRvTG93ZXJDYXNlKCk7XG4gIGlmICghKFsnaGV4JywgJ3V0ZjgnLCAndXRmLTgnLCAnYXNjaWknLCAnYmluYXJ5JywgJ2Jhc2U2NCcsXG4ndWNzMicsICd1Y3MtMicsJ3V0ZjE2bGUnLCAndXRmLTE2bGUnLCAncmF3J11cbi5pbmRleE9mKChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpKSA+IC0xKSlcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpO1xuICB0aGlzLl93cml0YWJsZVN0YXRlLmRlZmF1bHRFbmNvZGluZyA9IGVuY29kaW5nO1xufTtcblxuZnVuY3Rpb24gZGVjb2RlQ2h1bmsoc3RhdGUsIGNodW5rLCBlbmNvZGluZykge1xuICBpZiAoIXN0YXRlLm9iamVjdE1vZGUgJiZcbiAgICAgIHN0YXRlLmRlY29kZVN0cmluZ3MgIT09IGZhbHNlICYmXG4gICAgICB0eXBlb2YgY2h1bmsgPT09ICdzdHJpbmcnKSB7XG4gICAgY2h1bmsgPSBuZXcgQnVmZmVyKGNodW5rLCBlbmNvZGluZyk7XG4gIH1cbiAgcmV0dXJuIGNodW5rO1xufVxuXG4vLyBpZiB3ZSdyZSBhbHJlYWR5IHdyaXRpbmcgc29tZXRoaW5nLCB0aGVuIGp1c3QgcHV0IHRoaXNcbi8vIGluIHRoZSBxdWV1ZSwgYW5kIHdhaXQgb3VyIHR1cm4uICBPdGhlcndpc2UsIGNhbGwgX3dyaXRlXG4vLyBJZiB3ZSByZXR1cm4gZmFsc2UsIHRoZW4gd2UgbmVlZCBhIGRyYWluIGV2ZW50LCBzbyBzZXQgdGhhdCBmbGFnLlxuZnVuY3Rpb24gd3JpdGVPckJ1ZmZlcihzdHJlYW0sIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNodW5rID0gZGVjb2RlQ2h1bmsoc3RhdGUsIGNodW5rLCBlbmNvZGluZyk7XG5cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpXG4gICAgZW5jb2RpbmcgPSAnYnVmZmVyJztcbiAgdmFyIGxlbiA9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuXG4gIHN0YXRlLmxlbmd0aCArPSBsZW47XG5cbiAgdmFyIHJldCA9IHN0YXRlLmxlbmd0aCA8IHN0YXRlLmhpZ2hXYXRlck1hcms7XG4gIC8vIHdlIG11c3QgZW5zdXJlIHRoYXQgcHJldmlvdXMgbmVlZERyYWluIHdpbGwgbm90IGJlIHJlc2V0IHRvIGZhbHNlLlxuICBpZiAoIXJldClcbiAgICBzdGF0ZS5uZWVkRHJhaW4gPSB0cnVlO1xuXG4gIGlmIChzdGF0ZS53cml0aW5nIHx8IHN0YXRlLmNvcmtlZCkge1xuICAgIHZhciBsYXN0ID0gc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdDtcbiAgICBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0gbmV3IFdyaXRlUmVxKGNodW5rLCBlbmNvZGluZywgY2IpO1xuICAgIGlmIChsYXN0KSB7XG4gICAgICBsYXN0Lm5leHQgPSBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0ZS5idWZmZXJlZFJlcXVlc3QgPSBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0O1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIGZhbHNlLCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCB3cml0ZXYsIGxlbiwgY2h1bmssIGVuY29kaW5nLCBjYikge1xuICBzdGF0ZS53cml0ZWxlbiA9IGxlbjtcbiAgc3RhdGUud3JpdGVjYiA9IGNiO1xuICBzdGF0ZS53cml0aW5nID0gdHJ1ZTtcbiAgc3RhdGUuc3luYyA9IHRydWU7XG4gIGlmICh3cml0ZXYpXG4gICAgc3RyZWFtLl93cml0ZXYoY2h1bmssIHN0YXRlLm9ud3JpdGUpO1xuICBlbHNlXG4gICAgc3RyZWFtLl93cml0ZShjaHVuaywgZW5jb2RpbmcsIHN0YXRlLm9ud3JpdGUpO1xuICBzdGF0ZS5zeW5jID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIG9ud3JpdGVFcnJvcihzdHJlYW0sIHN0YXRlLCBzeW5jLCBlciwgY2IpIHtcbiAgLS1zdGF0ZS5wZW5kaW5nY2I7XG4gIGlmIChzeW5jKVxuICAgIHByb2Nlc3NOZXh0VGljayhjYiwgZXIpO1xuICBlbHNlXG4gICAgY2IoZXIpO1xuXG4gIHN0cmVhbS5fd3JpdGFibGVTdGF0ZS5lcnJvckVtaXR0ZWQgPSB0cnVlO1xuICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG59XG5cbmZ1bmN0aW9uIG9ud3JpdGVTdGF0ZVVwZGF0ZShzdGF0ZSkge1xuICBzdGF0ZS53cml0aW5nID0gZmFsc2U7XG4gIHN0YXRlLndyaXRlY2IgPSBudWxsO1xuICBzdGF0ZS5sZW5ndGggLT0gc3RhdGUud3JpdGVsZW47XG4gIHN0YXRlLndyaXRlbGVuID0gMDtcbn1cblxuZnVuY3Rpb24gb253cml0ZShzdHJlYW0sIGVyKSB7XG4gIHZhciBzdGF0ZSA9IHN0cmVhbS5fd3JpdGFibGVTdGF0ZTtcbiAgdmFyIHN5bmMgPSBzdGF0ZS5zeW5jO1xuICB2YXIgY2IgPSBzdGF0ZS53cml0ZWNiO1xuXG4gIG9ud3JpdGVTdGF0ZVVwZGF0ZShzdGF0ZSk7XG5cbiAgaWYgKGVyKVxuICAgIG9ud3JpdGVFcnJvcihzdHJlYW0sIHN0YXRlLCBzeW5jLCBlciwgY2IpO1xuICBlbHNlIHtcbiAgICAvLyBDaGVjayBpZiB3ZSdyZSBhY3R1YWxseSByZWFkeSB0byBmaW5pc2gsIGJ1dCBkb24ndCBlbWl0IHlldFxuICAgIHZhciBmaW5pc2hlZCA9IG5lZWRGaW5pc2goc3RhdGUpO1xuXG4gICAgaWYgKCFmaW5pc2hlZCAmJlxuICAgICAgICAhc3RhdGUuY29ya2VkICYmXG4gICAgICAgICFzdGF0ZS5idWZmZXJQcm9jZXNzaW5nICYmXG4gICAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCkge1xuICAgICAgY2xlYXJCdWZmZXIoc3RyZWFtLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgaWYgKHN5bmMpIHtcbiAgICAgIHByb2Nlc3NOZXh0VGljayhhZnRlcldyaXRlLCBzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhZnRlcldyaXRlKHN0cmVhbSwgc3RhdGUsIGZpbmlzaGVkLCBjYik7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFmdGVyV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmluaXNoZWQsIGNiKSB7XG4gIGlmICghZmluaXNoZWQpXG4gICAgb253cml0ZURyYWluKHN0cmVhbSwgc3RhdGUpO1xuICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgY2IoKTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG59XG5cbi8vIE11c3QgZm9yY2UgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIG9uIG5leHRUaWNrLCBzbyB0aGF0IHdlIGRvbid0XG4vLyBlbWl0ICdkcmFpbicgYmVmb3JlIHRoZSB3cml0ZSgpIGNvbnN1bWVyIGdldHMgdGhlICdmYWxzZScgcmV0dXJuXG4vLyB2YWx1ZSwgYW5kIGhhcyBhIGNoYW5jZSB0byBhdHRhY2ggYSAnZHJhaW4nIGxpc3RlbmVyLlxuZnVuY3Rpb24gb253cml0ZURyYWluKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5uZWVkRHJhaW4pIHtcbiAgICBzdGF0ZS5uZWVkRHJhaW4gPSBmYWxzZTtcbiAgICBzdHJlYW0uZW1pdCgnZHJhaW4nKTtcbiAgfVxufVxuXG5cbi8vIGlmIHRoZXJlJ3Mgc29tZXRoaW5nIGluIHRoZSBidWZmZXIgd2FpdGluZywgdGhlbiBwcm9jZXNzIGl0XG5mdW5jdGlvbiBjbGVhckJ1ZmZlcihzdHJlYW0sIHN0YXRlKSB7XG4gIHN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgPSB0cnVlO1xuICB2YXIgZW50cnkgPSBzdGF0ZS5idWZmZXJlZFJlcXVlc3Q7XG5cbiAgaWYgKHN0cmVhbS5fd3JpdGV2ICYmIGVudHJ5ICYmIGVudHJ5Lm5leHQpIHtcbiAgICAvLyBGYXN0IGNhc2UsIHdyaXRlIGV2ZXJ5dGhpbmcgdXNpbmcgX3dyaXRldigpXG4gICAgdmFyIGJ1ZmZlciA9IFtdO1xuICAgIHZhciBjYnMgPSBbXTtcbiAgICB3aGlsZSAoZW50cnkpIHtcbiAgICAgIGNicy5wdXNoKGVudHJ5LmNhbGxiYWNrKTtcbiAgICAgIGJ1ZmZlci5wdXNoKGVudHJ5KTtcbiAgICAgIGVudHJ5ID0gZW50cnkubmV4dDtcbiAgICB9XG5cbiAgICAvLyBjb3VudCB0aGUgb25lIHdlIGFyZSBhZGRpbmcsIGFzIHdlbGwuXG4gICAgLy8gVE9ETyhpc2FhY3MpIGNsZWFuIHRoaXMgdXBcbiAgICBzdGF0ZS5wZW5kaW5nY2IrKztcbiAgICBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0gbnVsbDtcbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIHRydWUsIHN0YXRlLmxlbmd0aCwgYnVmZmVyLCAnJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNicy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgICAgICAgY2JzW2ldKGVycik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDbGVhciBidWZmZXJcbiAgfSBlbHNlIHtcbiAgICAvLyBTbG93IGNhc2UsIHdyaXRlIGNodW5rcyBvbmUtYnktb25lXG4gICAgd2hpbGUgKGVudHJ5KSB7XG4gICAgICB2YXIgY2h1bmsgPSBlbnRyeS5jaHVuaztcbiAgICAgIHZhciBlbmNvZGluZyA9IGVudHJ5LmVuY29kaW5nO1xuICAgICAgdmFyIGNiID0gZW50cnkuY2FsbGJhY2s7XG4gICAgICB2YXIgbGVuID0gc3RhdGUub2JqZWN0TW9kZSA/IDEgOiBjaHVuay5sZW5ndGg7XG5cbiAgICAgIGRvV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmFsc2UsIGxlbiwgY2h1bmssIGVuY29kaW5nLCBjYik7XG4gICAgICBlbnRyeSA9IGVudHJ5Lm5leHQ7XG4gICAgICAvLyBpZiB3ZSBkaWRuJ3QgY2FsbCB0aGUgb253cml0ZSBpbW1lZGlhdGVseSwgdGhlblxuICAgICAgLy8gaXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHdhaXQgdW50aWwgaXQgZG9lcy5cbiAgICAgIC8vIGFsc28sIHRoYXQgbWVhbnMgdGhhdCB0aGUgY2h1bmsgYW5kIGNiIGFyZSBjdXJyZW50bHlcbiAgICAgIC8vIGJlaW5nIHByb2Nlc3NlZCwgc28gbW92ZSB0aGUgYnVmZmVyIGNvdW50ZXIgcGFzdCB0aGVtLlxuICAgICAgaWYgKHN0YXRlLndyaXRpbmcpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGVudHJ5ID09PSBudWxsKVxuICAgICAgc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdCA9IG51bGw7XG4gIH1cbiAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0ID0gZW50cnk7XG4gIHN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgPSBmYWxzZTtcbn1cblxuV3JpdGFibGUucHJvdG90eXBlLl93cml0ZSA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgY2IobmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKSk7XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuX3dyaXRldiA9IG51bGw7XG5cbldyaXRhYmxlLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG5cbiAgaWYgKHR5cGVvZiBjaHVuayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNiID0gY2h1bms7XG4gICAgY2h1bmsgPSBudWxsO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYiA9IGVuY29kaW5nO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfVxuXG4gIGlmIChjaHVuayAhPT0gbnVsbCAmJiBjaHVuayAhPT0gdW5kZWZpbmVkKVxuICAgIHRoaXMud3JpdGUoY2h1bmssIGVuY29kaW5nKTtcblxuICAvLyAuZW5kKCkgZnVsbHkgdW5jb3Jrc1xuICBpZiAoc3RhdGUuY29ya2VkKSB7XG4gICAgc3RhdGUuY29ya2VkID0gMTtcbiAgICB0aGlzLnVuY29yaygpO1xuICB9XG5cbiAgLy8gaWdub3JlIHVubmVjZXNzYXJ5IGVuZCgpIGNhbGxzLlxuICBpZiAoIXN0YXRlLmVuZGluZyAmJiAhc3RhdGUuZmluaXNoZWQpXG4gICAgZW5kV3JpdGFibGUodGhpcywgc3RhdGUsIGNiKTtcbn07XG5cblxuZnVuY3Rpb24gbmVlZEZpbmlzaChzdGF0ZSkge1xuICByZXR1cm4gKHN0YXRlLmVuZGluZyAmJlxuICAgICAgICAgIHN0YXRlLmxlbmd0aCA9PT0gMCAmJlxuICAgICAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCA9PT0gbnVsbCAmJlxuICAgICAgICAgICFzdGF0ZS5maW5pc2hlZCAmJlxuICAgICAgICAgICFzdGF0ZS53cml0aW5nKTtcbn1cblxuZnVuY3Rpb24gcHJlZmluaXNoKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5wcmVmaW5pc2hlZCkge1xuICAgIHN0YXRlLnByZWZpbmlzaGVkID0gdHJ1ZTtcbiAgICBzdHJlYW0uZW1pdCgncHJlZmluaXNoJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSkge1xuICB2YXIgbmVlZCA9IG5lZWRGaW5pc2goc3RhdGUpO1xuICBpZiAobmVlZCkge1xuICAgIGlmIChzdGF0ZS5wZW5kaW5nY2IgPT09IDApIHtcbiAgICAgIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKTtcbiAgICAgIHN0YXRlLmZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgIHN0cmVhbS5lbWl0KCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJlZmluaXNoKHN0cmVhbSwgc3RhdGUpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbmVlZDtcbn1cblxuZnVuY3Rpb24gZW5kV3JpdGFibGUoc3RyZWFtLCBzdGF0ZSwgY2IpIHtcbiAgc3RhdGUuZW5kaW5nID0gdHJ1ZTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG4gIGlmIChjYikge1xuICAgIGlmIChzdGF0ZS5maW5pc2hlZClcbiAgICAgIHByb2Nlc3NOZXh0VGljayhjYik7XG4gICAgZWxzZVxuICAgICAgc3RyZWFtLm9uY2UoJ2ZpbmlzaCcsIGNiKTtcbiAgfVxuICBzdGF0ZS5lbmRlZCA9IHRydWU7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2xpYi9fc3RyZWFtX3Bhc3N0aHJvdWdoLmpzXCIpXG4iLCJ2YXIgU3RyZWFtID0gKGZ1bmN0aW9uICgpe1xuICB0cnkge1xuICAgIHJldHVybiByZXF1aXJlKCdzdCcgKyAncmVhbScpOyAvLyBoYWNrIHRvIGZpeCBhIGNpcmN1bGFyIGRlcGVuZGVuY3kgaXNzdWUgd2hlbiB1c2VkIHdpdGggYnJvd3NlcmlmeVxuICB9IGNhdGNoKF8pe31cbn0oKSk7XG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3JlYWRhYmxlLmpzJyk7XG5leHBvcnRzLlN0cmVhbSA9IFN0cmVhbSB8fCBleHBvcnRzO1xuZXhwb3J0cy5SZWFkYWJsZSA9IGV4cG9ydHM7XG5leHBvcnRzLldyaXRhYmxlID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV93cml0YWJsZS5qcycpO1xuZXhwb3J0cy5EdXBsZXggPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX2R1cGxleC5qcycpO1xuZXhwb3J0cy5UcmFuc2Zvcm0gPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3RyYW5zZm9ybS5qcycpO1xuZXhwb3J0cy5QYXNzVGhyb3VnaCA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fcGFzc3Rocm91Z2guanMnKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzXCIpXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2xpYi9fc3RyZWFtX3dyaXRhYmxlLmpzXCIpXG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxubW9kdWxlLmV4cG9ydHMgPSBTdHJlYW07XG5cbnZhciBFRSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG5cbmluaGVyaXRzKFN0cmVhbSwgRUUpO1xuU3RyZWFtLlJlYWRhYmxlID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3JlYWRhYmxlLmpzJyk7XG5TdHJlYW0uV3JpdGFibGUgPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vd3JpdGFibGUuanMnKTtcblN0cmVhbS5EdXBsZXggPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vZHVwbGV4LmpzJyk7XG5TdHJlYW0uVHJhbnNmb3JtID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3RyYW5zZm9ybS5qcycpO1xuU3RyZWFtLlBhc3NUaHJvdWdoID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3Bhc3N0aHJvdWdoLmpzJyk7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuNC54XG5TdHJlYW0uU3RyZWFtID0gU3RyZWFtO1xuXG5cblxuLy8gb2xkLXN0eWxlIHN0cmVhbXMuICBOb3RlIHRoYXQgdGhlIHBpcGUgbWV0aG9kICh0aGUgb25seSByZWxldmFudFxuLy8gcGFydCBvZiB0aGlzIGNsYXNzKSBpcyBvdmVycmlkZGVuIGluIHRoZSBSZWFkYWJsZSBjbGFzcy5cblxuZnVuY3Rpb24gU3RyZWFtKCkge1xuICBFRS5jYWxsKHRoaXMpO1xufVxuXG5TdHJlYW0ucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbihkZXN0LCBvcHRpb25zKSB7XG4gIHZhciBzb3VyY2UgPSB0aGlzO1xuXG4gIGZ1bmN0aW9uIG9uZGF0YShjaHVuaykge1xuICAgIGlmIChkZXN0LndyaXRhYmxlKSB7XG4gICAgICBpZiAoZmFsc2UgPT09IGRlc3Qud3JpdGUoY2h1bmspICYmIHNvdXJjZS5wYXVzZSkge1xuICAgICAgICBzb3VyY2UucGF1c2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzb3VyY2Uub24oJ2RhdGEnLCBvbmRhdGEpO1xuXG4gIGZ1bmN0aW9uIG9uZHJhaW4oKSB7XG4gICAgaWYgKHNvdXJjZS5yZWFkYWJsZSAmJiBzb3VyY2UucmVzdW1lKSB7XG4gICAgICBzb3VyY2UucmVzdW1lKCk7XG4gICAgfVxuICB9XG5cbiAgZGVzdC5vbignZHJhaW4nLCBvbmRyYWluKTtcblxuICAvLyBJZiB0aGUgJ2VuZCcgb3B0aW9uIGlzIG5vdCBzdXBwbGllZCwgZGVzdC5lbmQoKSB3aWxsIGJlIGNhbGxlZCB3aGVuXG4gIC8vIHNvdXJjZSBnZXRzIHRoZSAnZW5kJyBvciAnY2xvc2UnIGV2ZW50cy4gIE9ubHkgZGVzdC5lbmQoKSBvbmNlLlxuICBpZiAoIWRlc3QuX2lzU3RkaW8gJiYgKCFvcHRpb25zIHx8IG9wdGlvbnMuZW5kICE9PSBmYWxzZSkpIHtcbiAgICBzb3VyY2Uub24oJ2VuZCcsIG9uZW5kKTtcbiAgICBzb3VyY2Uub24oJ2Nsb3NlJywgb25jbG9zZSk7XG4gIH1cblxuICB2YXIgZGlkT25FbmQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gb25lbmQoKSB7XG4gICAgaWYgKGRpZE9uRW5kKSByZXR1cm47XG4gICAgZGlkT25FbmQgPSB0cnVlO1xuXG4gICAgZGVzdC5lbmQoKTtcbiAgfVxuXG5cbiAgZnVuY3Rpb24gb25jbG9zZSgpIHtcbiAgICBpZiAoZGlkT25FbmQpIHJldHVybjtcbiAgICBkaWRPbkVuZCA9IHRydWU7XG5cbiAgICBpZiAodHlwZW9mIGRlc3QuZGVzdHJveSA9PT0gJ2Z1bmN0aW9uJykgZGVzdC5kZXN0cm95KCk7XG4gIH1cblxuICAvLyBkb24ndCBsZWF2ZSBkYW5nbGluZyBwaXBlcyB3aGVuIHRoZXJlIGFyZSBlcnJvcnMuXG4gIGZ1bmN0aW9uIG9uZXJyb3IoZXIpIHtcbiAgICBjbGVhbnVwKCk7XG4gICAgaWYgKEVFLmxpc3RlbmVyQ291bnQodGhpcywgJ2Vycm9yJykgPT09IDApIHtcbiAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgc3RyZWFtIGVycm9yIGluIHBpcGUuXG4gICAgfVxuICB9XG5cbiAgc291cmNlLm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuICBkZXN0Lm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuXG4gIC8vIHJlbW92ZSBhbGwgdGhlIGV2ZW50IGxpc3RlbmVycyB0aGF0IHdlcmUgYWRkZWQuXG4gIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdkYXRhJywgb25kYXRhKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdkcmFpbicsIG9uZHJhaW4pO1xuXG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBvbmVuZCk7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIG9uY2xvc2UpO1xuXG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG5cbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIGNsZWFudXApO1xuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBjbGVhbnVwKTtcblxuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgY2xlYW51cCk7XG4gIH1cblxuICBzb3VyY2Uub24oJ2VuZCcsIGNsZWFudXApO1xuICBzb3VyY2Uub24oJ2Nsb3NlJywgY2xlYW51cCk7XG5cbiAgZGVzdC5vbignY2xvc2UnLCBjbGVhbnVwKTtcblxuICBkZXN0LmVtaXQoJ3BpcGUnLCBzb3VyY2UpO1xuXG4gIC8vIEFsbG93IGZvciB1bml4LWxpa2UgdXNhZ2U6IEEucGlwZShCKS5waXBlKEMpXG4gIHJldHVybiBkZXN0O1xufTtcbiIsInZhciBDbGllbnRSZXF1ZXN0ID0gcmVxdWlyZSgnLi9saWIvcmVxdWVzdCcpXG52YXIgZXh0ZW5kID0gcmVxdWlyZSgneHRlbmQnKVxudmFyIHN0YXR1c0NvZGVzID0gcmVxdWlyZSgnYnVpbHRpbi1zdGF0dXMtY29kZXMnKVxudmFyIHVybCA9IHJlcXVpcmUoJ3VybCcpXG5cbnZhciBodHRwID0gZXhwb3J0c1xuXG5odHRwLnJlcXVlc3QgPSBmdW5jdGlvbiAob3B0cywgY2IpIHtcblx0aWYgKHR5cGVvZiBvcHRzID09PSAnc3RyaW5nJylcblx0XHRvcHRzID0gdXJsLnBhcnNlKG9wdHMpXG5cdGVsc2Vcblx0XHRvcHRzID0gZXh0ZW5kKG9wdHMpXG5cblx0Ly8gTm9ybWFsbHksIHRoZSBwYWdlIGlzIGxvYWRlZCBmcm9tIGh0dHAgb3IgaHR0cHMsIHNvIG5vdCBzcGVjaWZ5aW5nIGEgcHJvdG9jb2xcblx0Ly8gd2lsbCByZXN1bHQgaW4gYSAodmFsaWQpIHByb3RvY29sLXJlbGF0aXZlIHVybC4gSG93ZXZlciwgdGhpcyB3b24ndCB3b3JrIGlmXG5cdC8vIHRoZSBwcm90b2NvbCBpcyBzb21ldGhpbmcgZWxzZSwgbGlrZSAnZmlsZTonXG5cdHZhciBkZWZhdWx0UHJvdG9jb2wgPSBnbG9iYWwubG9jYXRpb24ucHJvdG9jb2wuc2VhcmNoKC9eaHR0cHM/OiQvKSA9PT0gLTEgPyAnaHR0cDonIDogJydcblxuXHR2YXIgcHJvdG9jb2wgPSBvcHRzLnByb3RvY29sIHx8IGRlZmF1bHRQcm90b2NvbFxuXHR2YXIgaG9zdCA9IG9wdHMuaG9zdG5hbWUgfHwgb3B0cy5ob3N0XG5cdHZhciBwb3J0ID0gb3B0cy5wb3J0XG5cdHZhciBwYXRoID0gb3B0cy5wYXRoIHx8ICcvJ1xuXG5cdC8vIE5lY2Vzc2FyeSBmb3IgSVB2NiBhZGRyZXNzZXNcblx0aWYgKGhvc3QgJiYgaG9zdC5pbmRleE9mKCc6JykgIT09IC0xKVxuXHRcdGhvc3QgPSAnWycgKyBob3N0ICsgJ10nXG5cblx0Ly8gVGhpcyBtYXkgYmUgYSByZWxhdGl2ZSB1cmwuIFRoZSBicm93c2VyIHNob3VsZCBhbHdheXMgYmUgYWJsZSB0byBpbnRlcnByZXQgaXQgY29ycmVjdGx5LlxuXHRvcHRzLnVybCA9IChob3N0ID8gKHByb3RvY29sICsgJy8vJyArIGhvc3QpIDogJycpICsgKHBvcnQgPyAnOicgKyBwb3J0IDogJycpICsgcGF0aFxuXHRvcHRzLm1ldGhvZCA9IChvcHRzLm1ldGhvZCB8fCAnR0VUJykudG9VcHBlckNhc2UoKVxuXHRvcHRzLmhlYWRlcnMgPSBvcHRzLmhlYWRlcnMgfHwge31cblxuXHQvLyBBbHNvIHZhbGlkIG9wdHMuYXV0aCwgb3B0cy5tb2RlXG5cblx0dmFyIHJlcSA9IG5ldyBDbGllbnRSZXF1ZXN0KG9wdHMpXG5cdGlmIChjYilcblx0XHRyZXEub24oJ3Jlc3BvbnNlJywgY2IpXG5cdHJldHVybiByZXFcbn1cblxuaHR0cC5nZXQgPSBmdW5jdGlvbiBnZXQgKG9wdHMsIGNiKSB7XG5cdHZhciByZXEgPSBodHRwLnJlcXVlc3Qob3B0cywgY2IpXG5cdHJlcS5lbmQoKVxuXHRyZXR1cm4gcmVxXG59XG5cbmh0dHAuQWdlbnQgPSBmdW5jdGlvbiAoKSB7fVxuaHR0cC5BZ2VudC5kZWZhdWx0TWF4U29ja2V0cyA9IDRcblxuaHR0cC5TVEFUVVNfQ09ERVMgPSBzdGF0dXNDb2Rlc1xuXG5odHRwLk1FVEhPRFMgPSBbXG5cdCdDSEVDS09VVCcsXG5cdCdDT05ORUNUJyxcblx0J0NPUFknLFxuXHQnREVMRVRFJyxcblx0J0dFVCcsXG5cdCdIRUFEJyxcblx0J0xPQ0snLFxuXHQnTS1TRUFSQ0gnLFxuXHQnTUVSR0UnLFxuXHQnTUtBQ1RJVklUWScsXG5cdCdNS0NPTCcsXG5cdCdNT1ZFJyxcblx0J05PVElGWScsXG5cdCdPUFRJT05TJyxcblx0J1BBVENIJyxcblx0J1BPU1QnLFxuXHQnUFJPUEZJTkQnLFxuXHQnUFJPUFBBVENIJyxcblx0J1BVUkdFJyxcblx0J1BVVCcsXG5cdCdSRVBPUlQnLFxuXHQnU0VBUkNIJyxcblx0J1NVQlNDUklCRScsXG5cdCdUUkFDRScsXG5cdCdVTkxPQ0snLFxuXHQnVU5TVUJTQ1JJQkUnXG5dIiwiZXhwb3J0cy5mZXRjaCA9IGlzRnVuY3Rpb24oZ2xvYmFsLmZldGNoKSAmJiBpc0Z1bmN0aW9uKGdsb2JhbC5SZWFkYWJsZUJ5dGVTdHJlYW0pXG5cbmV4cG9ydHMuYmxvYkNvbnN0cnVjdG9yID0gZmFsc2VcbnRyeSB7XG5cdG5ldyBCbG9iKFtuZXcgQXJyYXlCdWZmZXIoMSldKVxuXHRleHBvcnRzLmJsb2JDb25zdHJ1Y3RvciA9IHRydWVcbn0gY2F0Y2ggKGUpIHt9XG5cbnZhciB4aHIgPSBuZXcgZ2xvYmFsLlhNTEh0dHBSZXF1ZXN0KClcbi8vIElmIGxvY2F0aW9uLmhvc3QgaXMgZW1wdHksIGUuZy4gaWYgdGhpcyBwYWdlL3dvcmtlciB3YXMgbG9hZGVkXG4vLyBmcm9tIGEgQmxvYiwgdGhlbiB1c2UgZXhhbXBsZS5jb20gdG8gYXZvaWQgYW4gZXJyb3Jcbnhoci5vcGVuKCdHRVQnLCBnbG9iYWwubG9jYXRpb24uaG9zdCA/ICcvJyA6ICdodHRwczovL2V4YW1wbGUuY29tJylcblxuZnVuY3Rpb24gY2hlY2tUeXBlU3VwcG9ydCAodHlwZSkge1xuXHR0cnkge1xuXHRcdHhoci5yZXNwb25zZVR5cGUgPSB0eXBlXG5cdFx0cmV0dXJuIHhoci5yZXNwb25zZVR5cGUgPT09IHR5cGVcblx0fSBjYXRjaCAoZSkge31cblx0cmV0dXJuIGZhbHNlXG59XG5cbi8vIEZvciBzb21lIHN0cmFuZ2UgcmVhc29uLCBTYWZhcmkgNy4wIHJlcG9ydHMgdHlwZW9mIGdsb2JhbC5BcnJheUJ1ZmZlciA9PT0gJ29iamVjdCcuXG4vLyBTYWZhcmkgNy4xIGFwcGVhcnMgdG8gaGF2ZSBmaXhlZCB0aGlzIGJ1Zy5cbnZhciBoYXZlQXJyYXlCdWZmZXIgPSB0eXBlb2YgZ2xvYmFsLkFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJ1xudmFyIGhhdmVTbGljZSA9IGhhdmVBcnJheUJ1ZmZlciAmJiBpc0Z1bmN0aW9uKGdsb2JhbC5BcnJheUJ1ZmZlci5wcm90b3R5cGUuc2xpY2UpXG5cbmV4cG9ydHMuYXJyYXlidWZmZXIgPSBoYXZlQXJyYXlCdWZmZXIgJiYgY2hlY2tUeXBlU3VwcG9ydCgnYXJyYXlidWZmZXInKVxuLy8gVGhlc2UgbmV4dCB0d28gdGVzdHMgdW5hdm9pZGFibHkgc2hvdyB3YXJuaW5ncyBpbiBDaHJvbWUuIFNpbmNlIGZldGNoIHdpbGwgYWx3YXlzXG4vLyBiZSB1c2VkIGlmIGl0J3MgYXZhaWxhYmxlLCBqdXN0IHJldHVybiBmYWxzZSBmb3IgdGhlc2UgdG8gYXZvaWQgdGhlIHdhcm5pbmdzLlxuZXhwb3J0cy5tc3N0cmVhbSA9ICFleHBvcnRzLmZldGNoICYmIGhhdmVTbGljZSAmJiBjaGVja1R5cGVTdXBwb3J0KCdtcy1zdHJlYW0nKVxuZXhwb3J0cy5tb3pjaHVua2VkYXJyYXlidWZmZXIgPSAhZXhwb3J0cy5mZXRjaCAmJiBoYXZlQXJyYXlCdWZmZXIgJiZcblx0Y2hlY2tUeXBlU3VwcG9ydCgnbW96LWNodW5rZWQtYXJyYXlidWZmZXInKVxuZXhwb3J0cy5vdmVycmlkZU1pbWVUeXBlID0gaXNGdW5jdGlvbih4aHIub3ZlcnJpZGVNaW1lVHlwZSlcbmV4cG9ydHMudmJBcnJheSA9IGlzRnVuY3Rpb24oZ2xvYmFsLlZCQXJyYXkpXG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbidcbn1cblxueGhyID0gbnVsbCAvLyBIZWxwIGdjXG4iLCIvLyB2YXIgQmFzZTY0ID0gcmVxdWlyZSgnQmFzZTY0JylcbnZhciBjYXBhYmlsaXR5ID0gcmVxdWlyZSgnLi9jYXBhYmlsaXR5JylcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJylcbnZhciByZXNwb25zZSA9IHJlcXVpcmUoJy4vcmVzcG9uc2UnKVxudmFyIHN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpXG5cbnZhciBJbmNvbWluZ01lc3NhZ2UgPSByZXNwb25zZS5JbmNvbWluZ01lc3NhZ2VcbnZhciByU3RhdGVzID0gcmVzcG9uc2UucmVhZHlTdGF0ZXNcblxuZnVuY3Rpb24gZGVjaWRlTW9kZSAocHJlZmVyQmluYXJ5KSB7XG5cdGlmIChjYXBhYmlsaXR5LmZldGNoKSB7XG5cdFx0cmV0dXJuICdmZXRjaCdcblx0fSBlbHNlIGlmIChjYXBhYmlsaXR5Lm1vemNodW5rZWRhcnJheWJ1ZmZlcikge1xuXHRcdHJldHVybiAnbW96LWNodW5rZWQtYXJyYXlidWZmZXInXG5cdH0gZWxzZSBpZiAoY2FwYWJpbGl0eS5tc3N0cmVhbSkge1xuXHRcdHJldHVybiAnbXMtc3RyZWFtJ1xuXHR9IGVsc2UgaWYgKGNhcGFiaWxpdHkuYXJyYXlidWZmZXIgJiYgcHJlZmVyQmluYXJ5KSB7XG5cdFx0cmV0dXJuICdhcnJheWJ1ZmZlcidcblx0fSBlbHNlIGlmIChjYXBhYmlsaXR5LnZiQXJyYXkgJiYgcHJlZmVyQmluYXJ5KSB7XG5cdFx0cmV0dXJuICd0ZXh0OnZiYXJyYXknXG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuICd0ZXh0J1xuXHR9XG59XG5cbnZhciBDbGllbnRSZXF1ZXN0ID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob3B0cykge1xuXHR2YXIgc2VsZiA9IHRoaXNcblx0c3RyZWFtLldyaXRhYmxlLmNhbGwoc2VsZilcblxuXHRzZWxmLl9vcHRzID0gb3B0c1xuXHRzZWxmLl9ib2R5ID0gW11cblx0c2VsZi5faGVhZGVycyA9IHt9XG5cdGlmIChvcHRzLmF1dGgpXG5cdFx0c2VsZi5zZXRIZWFkZXIoJ0F1dGhvcml6YXRpb24nLCAnQmFzaWMgJyArIG5ldyBCdWZmZXIob3B0cy5hdXRoKS50b1N0cmluZygnYmFzZTY0JykpXG5cdE9iamVjdC5rZXlzKG9wdHMuaGVhZGVycykuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuXHRcdHNlbGYuc2V0SGVhZGVyKG5hbWUsIG9wdHMuaGVhZGVyc1tuYW1lXSlcblx0fSlcblxuXHR2YXIgcHJlZmVyQmluYXJ5XG5cdGlmIChvcHRzLm1vZGUgPT09ICdwcmVmZXItc3RyZWFtaW5nJykge1xuXHRcdC8vIElmIHN0cmVhbWluZyBpcyBhIGhpZ2ggcHJpb3JpdHkgYnV0IGJpbmFyeSBjb21wYXRpYmlsaXR5IGFuZFxuXHRcdC8vIHRoZSBhY2N1cmFjeSBvZiB0aGUgJ2NvbnRlbnQtdHlwZScgaGVhZGVyIGFyZW4ndFxuXHRcdHByZWZlckJpbmFyeSA9IGZhbHNlXG5cdH0gZWxzZSBpZiAob3B0cy5tb2RlID09PSAnYWxsb3ctd3JvbmctY29udGVudC10eXBlJykge1xuXHRcdC8vIElmIHN0cmVhbWluZyBpcyBtb3JlIGltcG9ydGFudCB0aGFuIHByZXNlcnZpbmcgdGhlICdjb250ZW50LXR5cGUnIGhlYWRlclxuXHRcdHByZWZlckJpbmFyeSA9ICFjYXBhYmlsaXR5Lm92ZXJyaWRlTWltZVR5cGVcblx0fSBlbHNlIGlmICghb3B0cy5tb2RlIHx8IG9wdHMubW9kZSA9PT0gJ2RlZmF1bHQnIHx8IG9wdHMubW9kZSA9PT0gJ3ByZWZlci1mYXN0Jykge1xuXHRcdC8vIFVzZSBiaW5hcnkgaWYgdGV4dCBzdHJlYW1pbmcgbWF5IGNvcnJ1cHQgZGF0YSBvciB0aGUgY29udGVudC10eXBlIGhlYWRlciwgb3IgZm9yIHNwZWVkXG5cdFx0cHJlZmVyQmluYXJ5ID0gdHJ1ZVxuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCB2YWx1ZSBmb3Igb3B0cy5tb2RlJylcblx0fVxuXHRzZWxmLl9tb2RlID0gZGVjaWRlTW9kZShwcmVmZXJCaW5hcnkpXG5cblx0c2VsZi5vbignZmluaXNoJywgZnVuY3Rpb24gKCkge1xuXHRcdHNlbGYuX29uRmluaXNoKClcblx0fSlcbn1cblxuaW5oZXJpdHMoQ2xpZW50UmVxdWVzdCwgc3RyZWFtLldyaXRhYmxlKVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5zZXRIZWFkZXIgPSBmdW5jdGlvbiAobmFtZSwgdmFsdWUpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cdHZhciBsb3dlck5hbWUgPSBuYW1lLnRvTG93ZXJDYXNlKClcblx0Ly8gVGhpcyBjaGVjayBpcyBub3QgbmVjZXNzYXJ5LCBidXQgaXQgcHJldmVudHMgd2FybmluZ3MgZnJvbSBicm93c2VycyBhYm91dCBzZXR0aW5nIHVuc2FmZVxuXHQvLyBoZWFkZXJzLiBUbyBiZSBob25lc3QgSSdtIG5vdCBlbnRpcmVseSBzdXJlIGhpZGluZyB0aGVzZSB3YXJuaW5ncyBpcyBhIGdvb2QgdGhpbmcsIGJ1dFxuXHQvLyBodHRwLWJyb3dzZXJpZnkgZGlkIGl0LCBzbyBJIHdpbGwgdG9vLlxuXHRpZiAodW5zYWZlSGVhZGVycy5pbmRleE9mKGxvd2VyTmFtZSkgIT09IC0xKVxuXHRcdHJldHVyblxuXG5cdHNlbGYuX2hlYWRlcnNbbG93ZXJOYW1lXSA9IHtcblx0XHRuYW1lOiBuYW1lLFxuXHRcdHZhbHVlOiB2YWx1ZVxuXHR9XG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLmdldEhlYWRlciA9IGZ1bmN0aW9uIChuYW1lKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXHRyZXR1cm4gc2VsZi5faGVhZGVyc1tuYW1lLnRvTG93ZXJDYXNlKCldLnZhbHVlXG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLnJlbW92ZUhlYWRlciA9IGZ1bmN0aW9uIChuYW1lKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXHRkZWxldGUgc2VsZi5faGVhZGVyc1tuYW1lLnRvTG93ZXJDYXNlKCldXG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLl9vbkZpbmlzaCA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cblx0aWYgKHNlbGYuX2Rlc3Ryb3llZClcblx0XHRyZXR1cm5cblx0dmFyIG9wdHMgPSBzZWxmLl9vcHRzXG5cblx0dmFyIGhlYWRlcnNPYmogPSBzZWxmLl9oZWFkZXJzXG5cdHZhciBib2R5XG5cdGlmIChvcHRzLm1ldGhvZCA9PT0gJ1BPU1QnIHx8IG9wdHMubWV0aG9kID09PSAnUFVUJyB8fCBvcHRzLm1ldGhvZCA9PT0gJ1BBVENIJykge1xuXHRcdGlmIChjYXBhYmlsaXR5LmJsb2JDb25zdHJ1Y3Rvcikge1xuXHRcdFx0Ym9keSA9IG5ldyBnbG9iYWwuQmxvYihzZWxmLl9ib2R5Lm1hcChmdW5jdGlvbiAoYnVmZmVyKSB7XG5cdFx0XHRcdHJldHVybiBidWZmZXIudG9BcnJheUJ1ZmZlcigpXG5cdFx0XHR9KSwge1xuXHRcdFx0XHR0eXBlOiAoaGVhZGVyc09ialsnY29udGVudC10eXBlJ10gfHwge30pLnZhbHVlIHx8ICcnXG5cdFx0XHR9KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBnZXQgdXRmOCBzdHJpbmdcblx0XHRcdGJvZHkgPSBCdWZmZXIuY29uY2F0KHNlbGYuX2JvZHkpLnRvU3RyaW5nKClcblx0XHR9XG5cdH1cblxuXHRpZiAoc2VsZi5fbW9kZSA9PT0gJ2ZldGNoJykge1xuXHRcdHZhciBoZWFkZXJzID0gT2JqZWN0LmtleXMoaGVhZGVyc09iaikubWFwKGZ1bmN0aW9uIChuYW1lKSB7XG5cdFx0XHRyZXR1cm4gW2hlYWRlcnNPYmpbbmFtZV0ubmFtZSwgaGVhZGVyc09ialtuYW1lXS52YWx1ZV1cblx0XHR9KVxuXG5cdFx0Z2xvYmFsLmZldGNoKHNlbGYuX29wdHMudXJsLCB7XG5cdFx0XHRtZXRob2Q6IHNlbGYuX29wdHMubWV0aG9kLFxuXHRcdFx0aGVhZGVyczogaGVhZGVycyxcblx0XHRcdGJvZHk6IGJvZHksXG5cdFx0XHRtb2RlOiAnY29ycycsXG5cdFx0XHRjcmVkZW50aWFsczogb3B0cy53aXRoQ3JlZGVudGlhbHMgPyAnaW5jbHVkZScgOiAnc2FtZS1vcmlnaW4nXG5cdFx0fSkudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcblx0XHRcdHNlbGYuX2ZldGNoUmVzcG9uc2UgPSByZXNwb25zZVxuXHRcdFx0c2VsZi5fY29ubmVjdCgpXG5cdFx0fSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHRcdFx0c2VsZi5lbWl0KCdlcnJvcicsIHJlYXNvbilcblx0XHR9KVxuXHR9IGVsc2Uge1xuXHRcdHZhciB4aHIgPSBzZWxmLl94aHIgPSBuZXcgZ2xvYmFsLlhNTEh0dHBSZXF1ZXN0KClcblx0XHR0cnkge1xuXHRcdFx0eGhyLm9wZW4oc2VsZi5fb3B0cy5tZXRob2QsIHNlbGYuX29wdHMudXJsLCB0cnVlKVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0cHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNlbGYuZW1pdCgnZXJyb3InLCBlcnIpXG5cdFx0XHR9KVxuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXG5cdFx0Ly8gQ2FuJ3Qgc2V0IHJlc3BvbnNlVHlwZSBvbiByZWFsbHkgb2xkIGJyb3dzZXJzXG5cdFx0aWYgKCdyZXNwb25zZVR5cGUnIGluIHhocilcblx0XHRcdHhoci5yZXNwb25zZVR5cGUgPSBzZWxmLl9tb2RlLnNwbGl0KCc6JylbMF1cblxuXHRcdGlmICgnd2l0aENyZWRlbnRpYWxzJyBpbiB4aHIpXG5cdFx0XHR4aHIud2l0aENyZWRlbnRpYWxzID0gISFvcHRzLndpdGhDcmVkZW50aWFsc1xuXG5cdFx0aWYgKHNlbGYuX21vZGUgPT09ICd0ZXh0JyAmJiAnb3ZlcnJpZGVNaW1lVHlwZScgaW4geGhyKVxuXHRcdFx0eGhyLm92ZXJyaWRlTWltZVR5cGUoJ3RleHQvcGxhaW47IGNoYXJzZXQ9eC11c2VyLWRlZmluZWQnKVxuXG5cdFx0T2JqZWN0LmtleXMoaGVhZGVyc09iaikuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuXHRcdFx0eGhyLnNldFJlcXVlc3RIZWFkZXIoaGVhZGVyc09ialtuYW1lXS5uYW1lLCBoZWFkZXJzT2JqW25hbWVdLnZhbHVlKVxuXHRcdH0pXG5cblx0XHRzZWxmLl9yZXNwb25zZSA9IG51bGxcblx0XHR4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0c3dpdGNoICh4aHIucmVhZHlTdGF0ZSkge1xuXHRcdFx0XHRjYXNlIHJTdGF0ZXMuTE9BRElORzpcblx0XHRcdFx0Y2FzZSByU3RhdGVzLkRPTkU6XG5cdFx0XHRcdFx0c2VsZi5fb25YSFJQcm9ncmVzcygpXG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gTmVjZXNzYXJ5IGZvciBzdHJlYW1pbmcgaW4gRmlyZWZveCwgc2luY2UgeGhyLnJlc3BvbnNlIGlzIE9OTFkgZGVmaW5lZFxuXHRcdC8vIGluIG9ucHJvZ3Jlc3MsIG5vdCBpbiBvbnJlYWR5c3RhdGVjaGFuZ2Ugd2l0aCB4aHIucmVhZHlTdGF0ZSA9IDNcblx0XHRpZiAoc2VsZi5fbW9kZSA9PT0gJ21vei1jaHVua2VkLWFycmF5YnVmZmVyJykge1xuXHRcdFx0eGhyLm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNlbGYuX29uWEhSUHJvZ3Jlc3MoKVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHhoci5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKHNlbGYuX2Rlc3Ryb3llZClcblx0XHRcdFx0cmV0dXJuXG5cdFx0XHRzZWxmLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdYSFIgZXJyb3InKSlcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0eGhyLnNlbmQoYm9keSlcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRzZWxmLmVtaXQoJ2Vycm9yJywgZXJyKVxuXHRcdFx0fSlcblx0XHRcdHJldHVyblxuXHRcdH1cblx0fVxufVxuXG4vKipcbiAqIENoZWNrcyBpZiB4aHIuc3RhdHVzIGlzIHJlYWRhYmxlIGFuZCBub24temVybywgaW5kaWNhdGluZyBubyBlcnJvci5cbiAqIEV2ZW4gdGhvdWdoIHRoZSBzcGVjIHNheXMgaXQgc2hvdWxkIGJlIGF2YWlsYWJsZSBpbiByZWFkeVN0YXRlIDMsXG4gKiBhY2Nlc3NpbmcgaXQgdGhyb3dzIGFuIGV4Y2VwdGlvbiBpbiBJRThcbiAqL1xuZnVuY3Rpb24gc3RhdHVzVmFsaWQgKHhocikge1xuXHR0cnkge1xuXHRcdHZhciBzdGF0dXMgPSB4aHIuc3RhdHVzXG5cdFx0cmV0dXJuIChzdGF0dXMgIT09IG51bGwgJiYgc3RhdHVzICE9PSAwKVxuXHR9IGNhdGNoIChlKSB7XG5cdFx0cmV0dXJuIGZhbHNlXG5cdH1cbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuX29uWEhSUHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXG5cdGlmICghc3RhdHVzVmFsaWQoc2VsZi5feGhyKSB8fCBzZWxmLl9kZXN0cm95ZWQpXG5cdFx0cmV0dXJuXG5cblx0aWYgKCFzZWxmLl9yZXNwb25zZSlcblx0XHRzZWxmLl9jb25uZWN0KClcblxuXHRzZWxmLl9yZXNwb25zZS5fb25YSFJQcm9ncmVzcygpXG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLl9jb25uZWN0ID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblxuXHRpZiAoc2VsZi5fZGVzdHJveWVkKVxuXHRcdHJldHVyblxuXG5cdHNlbGYuX3Jlc3BvbnNlID0gbmV3IEluY29taW5nTWVzc2FnZShzZWxmLl94aHIsIHNlbGYuX2ZldGNoUmVzcG9uc2UsIHNlbGYuX21vZGUpXG5cdHNlbGYuZW1pdCgncmVzcG9uc2UnLCBzZWxmLl9yZXNwb25zZSlcbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuX3dyaXRlID0gZnVuY3Rpb24gKGNodW5rLCBlbmNvZGluZywgY2IpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cblx0c2VsZi5fYm9keS5wdXNoKGNodW5rKVxuXHRjYigpXG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLmFib3J0ID0gQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cdHNlbGYuX2Rlc3Ryb3llZCA9IHRydWVcblx0aWYgKHNlbGYuX3Jlc3BvbnNlKVxuXHRcdHNlbGYuX3Jlc3BvbnNlLl9kZXN0cm95ZWQgPSB0cnVlXG5cdGlmIChzZWxmLl94aHIpXG5cdFx0c2VsZi5feGhyLmFib3J0KClcblx0Ly8gQ3VycmVudGx5LCB0aGVyZSBpc24ndCBhIHdheSB0byB0cnVseSBhYm9ydCBhIGZldGNoLlxuXHQvLyBJZiB5b3UgbGlrZSBiaWtlc2hlZGRpbmcsIHNlZSBodHRwczovL2dpdGh1Yi5jb20vd2hhdHdnL2ZldGNoL2lzc3Vlcy8yN1xufVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbiAoZGF0YSwgZW5jb2RpbmcsIGNiKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXHRpZiAodHlwZW9mIGRhdGEgPT09ICdmdW5jdGlvbicpIHtcblx0XHRjYiA9IGRhdGFcblx0XHRkYXRhID0gdW5kZWZpbmVkXG5cdH1cblxuXHRzdHJlYW0uV3JpdGFibGUucHJvdG90eXBlLmVuZC5jYWxsKHNlbGYsIGRhdGEsIGVuY29kaW5nLCBjYilcbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuZmx1c2hIZWFkZXJzID0gZnVuY3Rpb24gKCkge31cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLnNldFRpbWVvdXQgPSBmdW5jdGlvbiAoKSB7fVxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuc2V0Tm9EZWxheSA9IGZ1bmN0aW9uICgpIHt9XG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5zZXRTb2NrZXRLZWVwQWxpdmUgPSBmdW5jdGlvbiAoKSB7fVxuXG4vLyBUYWtlbiBmcm9tIGh0dHA6Ly93d3cudzMub3JnL1RSL1hNTEh0dHBSZXF1ZXN0LyN0aGUtc2V0cmVxdWVzdGhlYWRlciUyOCUyOS1tZXRob2RcbnZhciB1bnNhZmVIZWFkZXJzID0gW1xuXHQnYWNjZXB0LWNoYXJzZXQnLFxuXHQnYWNjZXB0LWVuY29kaW5nJyxcblx0J2FjY2Vzcy1jb250cm9sLXJlcXVlc3QtaGVhZGVycycsXG5cdCdhY2Nlc3MtY29udHJvbC1yZXF1ZXN0LW1ldGhvZCcsXG5cdCdjb25uZWN0aW9uJyxcblx0J2NvbnRlbnQtbGVuZ3RoJyxcblx0J2Nvb2tpZScsXG5cdCdjb29raWUyJyxcblx0J2RhdGUnLFxuXHQnZG50Jyxcblx0J2V4cGVjdCcsXG5cdCdob3N0Jyxcblx0J2tlZXAtYWxpdmUnLFxuXHQnb3JpZ2luJyxcblx0J3JlZmVyZXInLFxuXHQndGUnLFxuXHQndHJhaWxlcicsXG5cdCd0cmFuc2Zlci1lbmNvZGluZycsXG5cdCd1cGdyYWRlJyxcblx0J3VzZXItYWdlbnQnLFxuXHQndmlhJ1xuXVxuIiwidmFyIGNhcGFiaWxpdHkgPSByZXF1aXJlKCcuL2NhcGFiaWxpdHknKVxudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKVxudmFyIHN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpXG5cbnZhciByU3RhdGVzID0gZXhwb3J0cy5yZWFkeVN0YXRlcyA9IHtcblx0VU5TRU5UOiAwLFxuXHRPUEVORUQ6IDEsXG5cdEhFQURFUlNfUkVDRUlWRUQ6IDIsXG5cdExPQURJTkc6IDMsXG5cdERPTkU6IDRcbn1cblxudmFyIEluY29taW5nTWVzc2FnZSA9IGV4cG9ydHMuSW5jb21pbmdNZXNzYWdlID0gZnVuY3Rpb24gKHhociwgcmVzcG9uc2UsIG1vZGUpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cdHN0cmVhbS5SZWFkYWJsZS5jYWxsKHNlbGYpXG5cblx0c2VsZi5fbW9kZSA9IG1vZGVcblx0c2VsZi5oZWFkZXJzID0ge31cblx0c2VsZi5yYXdIZWFkZXJzID0gW11cblx0c2VsZi50cmFpbGVycyA9IHt9XG5cdHNlbGYucmF3VHJhaWxlcnMgPSBbXVxuXG5cdC8vIEZha2UgdGhlICdjbG9zZScgZXZlbnQsIGJ1dCBvbmx5IG9uY2UgJ2VuZCcgZmlyZXNcblx0c2VsZi5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuXHRcdC8vIFRoZSBuZXh0VGljayBpcyBuZWNlc3NhcnkgdG8gcHJldmVudCB0aGUgJ3JlcXVlc3QnIG1vZHVsZSBmcm9tIGNhdXNpbmcgYW4gaW5maW5pdGUgbG9vcFxuXHRcdHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuXHRcdFx0c2VsZi5lbWl0KCdjbG9zZScpXG5cdFx0fSlcblx0fSlcblxuXHRpZiAobW9kZSA9PT0gJ2ZldGNoJykge1xuXHRcdHNlbGYuX2ZldGNoUmVzcG9uc2UgPSByZXNwb25zZVxuXG5cdFx0c2VsZi5zdGF0dXNDb2RlID0gcmVzcG9uc2Uuc3RhdHVzXG5cdFx0c2VsZi5zdGF0dXNNZXNzYWdlID0gcmVzcG9uc2Uuc3RhdHVzVGV4dFxuXHRcdC8vIGJhY2t3YXJkcyBjb21wYXRpYmxlIHZlcnNpb24gb2YgZm9yICg8aXRlbT4gb2YgPGl0ZXJhYmxlPik6XG5cdFx0Ly8gZm9yICh2YXIgPGl0ZW0+LF9pLF9pdCA9IDxpdGVyYWJsZT5bU3ltYm9sLml0ZXJhdG9yXSgpOyA8aXRlbT4gPSAoX2kgPSBfaXQubmV4dCgpKS52YWx1ZSwhX2kuZG9uZTspXG5cdFx0Zm9yICh2YXIgaGVhZGVyLCBfaSwgX2l0ID0gcmVzcG9uc2UuaGVhZGVyc1tTeW1ib2wuaXRlcmF0b3JdKCk7IGhlYWRlciA9IChfaSA9IF9pdC5uZXh0KCkpLnZhbHVlLCAhX2kuZG9uZTspIHtcblx0XHRcdHNlbGYuaGVhZGVyc1toZWFkZXJbMF0udG9Mb3dlckNhc2UoKV0gPSBoZWFkZXJbMV1cblx0XHRcdHNlbGYucmF3SGVhZGVycy5wdXNoKGhlYWRlclswXSwgaGVhZGVyWzFdKVxuXHRcdH1cblxuXHRcdC8vIFRPRE86IHRoaXMgZG9lc24ndCByZXNwZWN0IGJhY2twcmVzc3VyZS4gT25jZSBXcml0YWJsZVN0cmVhbSBpcyBhdmFpbGFibGUsIHRoaXMgY2FuIGJlIGZpeGVkXG5cdFx0dmFyIHJlYWRlciA9IHJlc3BvbnNlLmJvZHkuZ2V0UmVhZGVyKClcblx0XHRmdW5jdGlvbiByZWFkICgpIHtcblx0XHRcdHJlYWRlci5yZWFkKCkudGhlbihmdW5jdGlvbiAocmVzdWx0KSB7XG5cdFx0XHRcdGlmIChzZWxmLl9kZXN0cm95ZWQpXG5cdFx0XHRcdFx0cmV0dXJuXG5cdFx0XHRcdGlmIChyZXN1bHQuZG9uZSkge1xuXHRcdFx0XHRcdHNlbGYucHVzaChudWxsKVxuXHRcdFx0XHRcdHJldHVyblxuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGYucHVzaChuZXcgQnVmZmVyKHJlc3VsdC52YWx1ZSkpXG5cdFx0XHRcdHJlYWQoKVxuXHRcdFx0fSlcblx0XHR9XG5cdFx0cmVhZCgpXG5cblx0fSBlbHNlIHtcblx0XHRzZWxmLl94aHIgPSB4aHJcblx0XHRzZWxmLl9wb3MgPSAwXG5cblx0XHRzZWxmLnN0YXR1c0NvZGUgPSB4aHIuc3RhdHVzXG5cdFx0c2VsZi5zdGF0dXNNZXNzYWdlID0geGhyLnN0YXR1c1RleHRcblx0XHR2YXIgaGVhZGVycyA9IHhoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKS5zcGxpdCgvXFxyP1xcbi8pXG5cdFx0aGVhZGVycy5mb3JFYWNoKGZ1bmN0aW9uIChoZWFkZXIpIHtcblx0XHRcdHZhciBtYXRjaGVzID0gaGVhZGVyLm1hdGNoKC9eKFteOl0rKTpcXHMqKC4qKS8pXG5cdFx0XHRpZiAobWF0Y2hlcykge1xuXHRcdFx0XHR2YXIga2V5ID0gbWF0Y2hlc1sxXS50b0xvd2VyQ2FzZSgpXG5cdFx0XHRcdGlmIChzZWxmLmhlYWRlcnNba2V5XSAhPT0gdW5kZWZpbmVkKVxuXHRcdFx0XHRcdHNlbGYuaGVhZGVyc1trZXldICs9ICcsICcgKyBtYXRjaGVzWzJdXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRzZWxmLmhlYWRlcnNba2V5XSA9IG1hdGNoZXNbMl1cblx0XHRcdFx0c2VsZi5yYXdIZWFkZXJzLnB1c2gobWF0Y2hlc1sxXSwgbWF0Y2hlc1syXSlcblx0XHRcdH1cblx0XHR9KVxuXG5cdFx0c2VsZi5fY2hhcnNldCA9ICd4LXVzZXItZGVmaW5lZCdcblx0XHRpZiAoIWNhcGFiaWxpdHkub3ZlcnJpZGVNaW1lVHlwZSkge1xuXHRcdFx0dmFyIG1pbWVUeXBlID0gc2VsZi5yYXdIZWFkZXJzWydtaW1lLXR5cGUnXVxuXHRcdFx0aWYgKG1pbWVUeXBlKSB7XG5cdFx0XHRcdHZhciBjaGFyc2V0TWF0Y2ggPSBtaW1lVHlwZS5tYXRjaCgvO1xccypjaGFyc2V0PShbXjtdKSg7fCQpLylcblx0XHRcdFx0aWYgKGNoYXJzZXRNYXRjaCkge1xuXHRcdFx0XHRcdHNlbGYuX2NoYXJzZXQgPSBjaGFyc2V0TWF0Y2hbMV0udG9Mb3dlckNhc2UoKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXNlbGYuX2NoYXJzZXQpXG5cdFx0XHRcdHNlbGYuX2NoYXJzZXQgPSAndXRmLTgnIC8vIGJlc3QgZ3Vlc3Ncblx0XHR9XG5cdH1cbn1cblxuaW5oZXJpdHMoSW5jb21pbmdNZXNzYWdlLCBzdHJlYW0uUmVhZGFibGUpXG5cbkluY29taW5nTWVzc2FnZS5wcm90b3R5cGUuX3JlYWQgPSBmdW5jdGlvbiAoKSB7fVxuXG5JbmNvbWluZ01lc3NhZ2UucHJvdG90eXBlLl9vblhIUlByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblxuXHR2YXIgeGhyID0gc2VsZi5feGhyXG5cblx0dmFyIHJlc3BvbnNlID0gbnVsbFxuXHRzd2l0Y2ggKHNlbGYuX21vZGUpIHtcblx0XHRjYXNlICd0ZXh0OnZiYXJyYXknOiAvLyBGb3IgSUU5XG5cdFx0XHRpZiAoeGhyLnJlYWR5U3RhdGUgIT09IHJTdGF0ZXMuRE9ORSlcblx0XHRcdFx0YnJlYWtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdC8vIFRoaXMgZmFpbHMgaW4gSUU4XG5cdFx0XHRcdHJlc3BvbnNlID0gbmV3IGdsb2JhbC5WQkFycmF5KHhoci5yZXNwb25zZUJvZHkpLnRvQXJyYXkoKVxuXHRcdFx0fSBjYXRjaCAoZSkge31cblx0XHRcdGlmIChyZXNwb25zZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRzZWxmLnB1c2gobmV3IEJ1ZmZlcihyZXNwb25zZSkpXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHQvLyBGYWxscyB0aHJvdWdoIGluIElFOFx0XG5cdFx0Y2FzZSAndGV4dCc6XG5cdFx0XHR0cnkgeyAvLyBUaGlzIHdpbGwgZmFpbCB3aGVuIHJlYWR5U3RhdGUgPSAzIGluIElFOS4gU3dpdGNoIG1vZGUgYW5kIHdhaXQgZm9yIHJlYWR5U3RhdGUgPSA0XG5cdFx0XHRcdHJlc3BvbnNlID0geGhyLnJlc3BvbnNlVGV4dFxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRzZWxmLl9tb2RlID0gJ3RleHQ6dmJhcnJheSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdGlmIChyZXNwb25zZS5sZW5ndGggPiBzZWxmLl9wb3MpIHtcblx0XHRcdFx0dmFyIG5ld0RhdGEgPSByZXNwb25zZS5zdWJzdHIoc2VsZi5fcG9zKVxuXHRcdFx0XHRpZiAoc2VsZi5fY2hhcnNldCA9PT0gJ3gtdXNlci1kZWZpbmVkJykge1xuXHRcdFx0XHRcdHZhciBidWZmZXIgPSBuZXcgQnVmZmVyKG5ld0RhdGEubGVuZ3RoKVxuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbmV3RGF0YS5sZW5ndGg7IGkrKylcblx0XHRcdFx0XHRcdGJ1ZmZlcltpXSA9IG5ld0RhdGEuY2hhckNvZGVBdChpKSAmIDB4ZmZcblxuXHRcdFx0XHRcdHNlbGYucHVzaChidWZmZXIpXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2VsZi5wdXNoKG5ld0RhdGEsIHNlbGYuX2NoYXJzZXQpXG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fcG9zID0gcmVzcG9uc2UubGVuZ3RoXG5cdFx0XHR9XG5cdFx0XHRicmVha1xuXHRcdGNhc2UgJ2FycmF5YnVmZmVyJzpcblx0XHRcdGlmICh4aHIucmVhZHlTdGF0ZSAhPT0gclN0YXRlcy5ET05FKVxuXHRcdFx0XHRicmVha1xuXHRcdFx0cmVzcG9uc2UgPSB4aHIucmVzcG9uc2Vcblx0XHRcdHNlbGYucHVzaChuZXcgQnVmZmVyKG5ldyBVaW50OEFycmF5KHJlc3BvbnNlKSkpXG5cdFx0XHRicmVha1xuXHRcdGNhc2UgJ21vei1jaHVua2VkLWFycmF5YnVmZmVyJzogLy8gdGFrZSB3aG9sZVxuXHRcdFx0cmVzcG9uc2UgPSB4aHIucmVzcG9uc2Vcblx0XHRcdGlmICh4aHIucmVhZHlTdGF0ZSAhPT0gclN0YXRlcy5MT0FESU5HIHx8ICFyZXNwb25zZSlcblx0XHRcdFx0YnJlYWtcblx0XHRcdHNlbGYucHVzaChuZXcgQnVmZmVyKG5ldyBVaW50OEFycmF5KHJlc3BvbnNlKSkpXG5cdFx0XHRicmVha1xuXHRcdGNhc2UgJ21zLXN0cmVhbSc6XG5cdFx0XHRyZXNwb25zZSA9IHhoci5yZXNwb25zZVxuXHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlICE9PSByU3RhdGVzLkxPQURJTkcpXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR2YXIgcmVhZGVyID0gbmV3IGdsb2JhbC5NU1N0cmVhbVJlYWRlcigpXG5cdFx0XHRyZWFkZXIub25wcm9ncmVzcyA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKHJlYWRlci5yZXN1bHQuYnl0ZUxlbmd0aCA+IHNlbGYuX3Bvcykge1xuXHRcdFx0XHRcdHNlbGYucHVzaChuZXcgQnVmZmVyKG5ldyBVaW50OEFycmF5KHJlYWRlci5yZXN1bHQuc2xpY2Uoc2VsZi5fcG9zKSkpKVxuXHRcdFx0XHRcdHNlbGYuX3BvcyA9IHJlYWRlci5yZXN1bHQuYnl0ZUxlbmd0aFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZWFkZXIub25sb2FkID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRzZWxmLnB1c2gobnVsbClcblx0XHRcdH1cblx0XHRcdC8vIHJlYWRlci5vbmVycm9yID0gPz8/IC8vIFRPRE86IHRoaXNcblx0XHRcdHJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihyZXNwb25zZSlcblx0XHRcdGJyZWFrXG5cdH1cblxuXHQvLyBUaGUgbXMtc3RyZWFtIGNhc2UgaGFuZGxlcyBlbmQgc2VwYXJhdGVseSBpbiByZWFkZXIub25sb2FkKClcblx0aWYgKHNlbGYuX3hoci5yZWFkeVN0YXRlID09PSByU3RhdGVzLkRPTkUgJiYgc2VsZi5fbW9kZSAhPT0gJ21zLXN0cmVhbScpIHtcblx0XHRzZWxmLnB1c2gobnVsbClcblx0fVxufVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG5cbnZhciBpc0J1ZmZlckVuY29kaW5nID0gQnVmZmVyLmlzRW5jb2RpbmdcbiAgfHwgZnVuY3Rpb24oZW5jb2RpbmcpIHtcbiAgICAgICBzd2l0Y2ggKGVuY29kaW5nICYmIGVuY29kaW5nLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgIGNhc2UgJ2hleCc6IGNhc2UgJ3V0ZjgnOiBjYXNlICd1dGYtOCc6IGNhc2UgJ2FzY2lpJzogY2FzZSAnYmluYXJ5JzogY2FzZSAnYmFzZTY0JzogY2FzZSAndWNzMic6IGNhc2UgJ3Vjcy0yJzogY2FzZSAndXRmMTZsZSc6IGNhc2UgJ3V0Zi0xNmxlJzogY2FzZSAncmF3JzogcmV0dXJuIHRydWU7XG4gICAgICAgICBkZWZhdWx0OiByZXR1cm4gZmFsc2U7XG4gICAgICAgfVxuICAgICB9XG5cblxuZnVuY3Rpb24gYXNzZXJ0RW5jb2RpbmcoZW5jb2RpbmcpIHtcbiAgaWYgKGVuY29kaW5nICYmICFpc0J1ZmZlckVuY29kaW5nKGVuY29kaW5nKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKTtcbiAgfVxufVxuXG4vLyBTdHJpbmdEZWNvZGVyIHByb3ZpZGVzIGFuIGludGVyZmFjZSBmb3IgZWZmaWNpZW50bHkgc3BsaXR0aW5nIGEgc2VyaWVzIG9mXG4vLyBidWZmZXJzIGludG8gYSBzZXJpZXMgb2YgSlMgc3RyaW5ncyB3aXRob3V0IGJyZWFraW5nIGFwYXJ0IG11bHRpLWJ5dGVcbi8vIGNoYXJhY3RlcnMuIENFU1UtOCBpcyBoYW5kbGVkIGFzIHBhcnQgb2YgdGhlIFVURi04IGVuY29kaW5nLlxuLy9cbi8vIEBUT0RPIEhhbmRsaW5nIGFsbCBlbmNvZGluZ3MgaW5zaWRlIGEgc2luZ2xlIG9iamVjdCBtYWtlcyBpdCB2ZXJ5IGRpZmZpY3VsdFxuLy8gdG8gcmVhc29uIGFib3V0IHRoaXMgY29kZSwgc28gaXQgc2hvdWxkIGJlIHNwbGl0IHVwIGluIHRoZSBmdXR1cmUuXG4vLyBAVE9ETyBUaGVyZSBzaG91bGQgYmUgYSB1dGY4LXN0cmljdCBlbmNvZGluZyB0aGF0IHJlamVjdHMgaW52YWxpZCBVVEYtOCBjb2RlXG4vLyBwb2ludHMgYXMgdXNlZCBieSBDRVNVLTguXG52YXIgU3RyaW5nRGVjb2RlciA9IGV4cG9ydHMuU3RyaW5nRGVjb2RlciA9IGZ1bmN0aW9uKGVuY29kaW5nKSB7XG4gIHRoaXMuZW5jb2RpbmcgPSAoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1stX10vLCAnJyk7XG4gIGFzc2VydEVuY29kaW5nKGVuY29kaW5nKTtcbiAgc3dpdGNoICh0aGlzLmVuY29kaW5nKSB7XG4gICAgY2FzZSAndXRmOCc6XG4gICAgICAvLyBDRVNVLTggcmVwcmVzZW50cyBlYWNoIG9mIFN1cnJvZ2F0ZSBQYWlyIGJ5IDMtYnl0ZXNcbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDM7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIC8vIFVURi0xNiByZXByZXNlbnRzIGVhY2ggb2YgU3Vycm9nYXRlIFBhaXIgYnkgMi1ieXRlc1xuICAgICAgdGhpcy5zdXJyb2dhdGVTaXplID0gMjtcbiAgICAgIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIgPSB1dGYxNkRldGVjdEluY29tcGxldGVDaGFyO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIC8vIEJhc2UtNjQgc3RvcmVzIDMgYnl0ZXMgaW4gNCBjaGFycywgYW5kIHBhZHMgdGhlIHJlbWFpbmRlci5cbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDM7XG4gICAgICB0aGlzLmRldGVjdEluY29tcGxldGVDaGFyID0gYmFzZTY0RGV0ZWN0SW5jb21wbGV0ZUNoYXI7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhpcy53cml0ZSA9IHBhc3NUaHJvdWdoV3JpdGU7XG4gICAgICByZXR1cm47XG4gIH1cblxuICAvLyBFbm91Z2ggc3BhY2UgdG8gc3RvcmUgYWxsIGJ5dGVzIG9mIGEgc2luZ2xlIGNoYXJhY3Rlci4gVVRGLTggbmVlZHMgNFxuICAvLyBieXRlcywgYnV0IENFU1UtOCBtYXkgcmVxdWlyZSB1cCB0byA2ICgzIGJ5dGVzIHBlciBzdXJyb2dhdGUpLlxuICB0aGlzLmNoYXJCdWZmZXIgPSBuZXcgQnVmZmVyKDYpO1xuICAvLyBOdW1iZXIgb2YgYnl0ZXMgcmVjZWl2ZWQgZm9yIHRoZSBjdXJyZW50IGluY29tcGxldGUgbXVsdGktYnl0ZSBjaGFyYWN0ZXIuXG4gIHRoaXMuY2hhclJlY2VpdmVkID0gMDtcbiAgLy8gTnVtYmVyIG9mIGJ5dGVzIGV4cGVjdGVkIGZvciB0aGUgY3VycmVudCBpbmNvbXBsZXRlIG11bHRpLWJ5dGUgY2hhcmFjdGVyLlxuICB0aGlzLmNoYXJMZW5ndGggPSAwO1xufTtcblxuXG4vLyB3cml0ZSBkZWNvZGVzIHRoZSBnaXZlbiBidWZmZXIgYW5kIHJldHVybnMgaXQgYXMgSlMgc3RyaW5nIHRoYXQgaXNcbi8vIGd1YXJhbnRlZWQgdG8gbm90IGNvbnRhaW4gYW55IHBhcnRpYWwgbXVsdGktYnl0ZSBjaGFyYWN0ZXJzLiBBbnkgcGFydGlhbFxuLy8gY2hhcmFjdGVyIGZvdW5kIGF0IHRoZSBlbmQgb2YgdGhlIGJ1ZmZlciBpcyBidWZmZXJlZCB1cCwgYW5kIHdpbGwgYmVcbi8vIHJldHVybmVkIHdoZW4gY2FsbGluZyB3cml0ZSBhZ2FpbiB3aXRoIHRoZSByZW1haW5pbmcgYnl0ZXMuXG4vL1xuLy8gTm90ZTogQ29udmVydGluZyBhIEJ1ZmZlciBjb250YWluaW5nIGFuIG9ycGhhbiBzdXJyb2dhdGUgdG8gYSBTdHJpbmdcbi8vIGN1cnJlbnRseSB3b3JrcywgYnV0IGNvbnZlcnRpbmcgYSBTdHJpbmcgdG8gYSBCdWZmZXIgKHZpYSBgbmV3IEJ1ZmZlcmAsIG9yXG4vLyBCdWZmZXIjd3JpdGUpIHdpbGwgcmVwbGFjZSBpbmNvbXBsZXRlIHN1cnJvZ2F0ZXMgd2l0aCB0aGUgdW5pY29kZVxuLy8gcmVwbGFjZW1lbnQgY2hhcmFjdGVyLiBTZWUgaHR0cHM6Ly9jb2RlcmV2aWV3LmNocm9taXVtLm9yZy8xMjExNzMwMDkvIC5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIHZhciBjaGFyU3RyID0gJyc7XG4gIC8vIGlmIG91ciBsYXN0IHdyaXRlIGVuZGVkIHdpdGggYW4gaW5jb21wbGV0ZSBtdWx0aWJ5dGUgY2hhcmFjdGVyXG4gIHdoaWxlICh0aGlzLmNoYXJMZW5ndGgpIHtcbiAgICAvLyBkZXRlcm1pbmUgaG93IG1hbnkgcmVtYWluaW5nIGJ5dGVzIHRoaXMgYnVmZmVyIGhhcyB0byBvZmZlciBmb3IgdGhpcyBjaGFyXG4gICAgdmFyIGF2YWlsYWJsZSA9IChidWZmZXIubGVuZ3RoID49IHRoaXMuY2hhckxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkKSA/XG4gICAgICAgIHRoaXMuY2hhckxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkIDpcbiAgICAgICAgYnVmZmVyLmxlbmd0aDtcblxuICAgIC8vIGFkZCB0aGUgbmV3IGJ5dGVzIHRvIHRoZSBjaGFyIGJ1ZmZlclxuICAgIGJ1ZmZlci5jb3B5KHRoaXMuY2hhckJ1ZmZlciwgdGhpcy5jaGFyUmVjZWl2ZWQsIDAsIGF2YWlsYWJsZSk7XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgKz0gYXZhaWxhYmxlO1xuXG4gICAgaWYgKHRoaXMuY2hhclJlY2VpdmVkIDwgdGhpcy5jaGFyTGVuZ3RoKSB7XG4gICAgICAvLyBzdGlsbCBub3QgZW5vdWdoIGNoYXJzIGluIHRoaXMgYnVmZmVyPyB3YWl0IGZvciBtb3JlIC4uLlxuICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIC8vIHJlbW92ZSBieXRlcyBiZWxvbmdpbmcgdG8gdGhlIGN1cnJlbnQgY2hhcmFjdGVyIGZyb20gdGhlIGJ1ZmZlclxuICAgIGJ1ZmZlciA9IGJ1ZmZlci5zbGljZShhdmFpbGFibGUsIGJ1ZmZlci5sZW5ndGgpO1xuXG4gICAgLy8gZ2V0IHRoZSBjaGFyYWN0ZXIgdGhhdCB3YXMgc3BsaXRcbiAgICBjaGFyU3RyID0gdGhpcy5jaGFyQnVmZmVyLnNsaWNlKDAsIHRoaXMuY2hhckxlbmd0aCkudG9TdHJpbmcodGhpcy5lbmNvZGluZyk7XG5cbiAgICAvLyBDRVNVLTg6IGxlYWQgc3Vycm9nYXRlIChEODAwLURCRkYpIGlzIGFsc28gdGhlIGluY29tcGxldGUgY2hhcmFjdGVyXG4gICAgdmFyIGNoYXJDb2RlID0gY2hhclN0ci5jaGFyQ29kZUF0KGNoYXJTdHIubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGNoYXJDb2RlID49IDB4RDgwMCAmJiBjaGFyQ29kZSA8PSAweERCRkYpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCArPSB0aGlzLnN1cnJvZ2F0ZVNpemU7XG4gICAgICBjaGFyU3RyID0gJyc7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgPSB0aGlzLmNoYXJMZW5ndGggPSAwO1xuXG4gICAgLy8gaWYgdGhlcmUgYXJlIG5vIG1vcmUgYnl0ZXMgaW4gdGhpcyBidWZmZXIsIGp1c3QgZW1pdCBvdXIgY2hhclxuICAgIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gY2hhclN0cjtcbiAgICB9XG4gICAgYnJlYWs7XG4gIH1cblxuICAvLyBkZXRlcm1pbmUgYW5kIHNldCBjaGFyTGVuZ3RoIC8gY2hhclJlY2VpdmVkXG4gIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKTtcblxuICB2YXIgZW5kID0gYnVmZmVyLmxlbmd0aDtcbiAgaWYgKHRoaXMuY2hhckxlbmd0aCkge1xuICAgIC8vIGJ1ZmZlciB0aGUgaW5jb21wbGV0ZSBjaGFyYWN0ZXIgYnl0ZXMgd2UgZ290XG4gICAgYnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCAwLCBidWZmZXIubGVuZ3RoIC0gdGhpcy5jaGFyUmVjZWl2ZWQsIGVuZCk7XG4gICAgZW5kIC09IHRoaXMuY2hhclJlY2VpdmVkO1xuICB9XG5cbiAgY2hhclN0ciArPSBidWZmZXIudG9TdHJpbmcodGhpcy5lbmNvZGluZywgMCwgZW5kKTtcblxuICB2YXIgZW5kID0gY2hhclN0ci5sZW5ndGggLSAxO1xuICB2YXIgY2hhckNvZGUgPSBjaGFyU3RyLmNoYXJDb2RlQXQoZW5kKTtcbiAgLy8gQ0VTVS04OiBsZWFkIHN1cnJvZ2F0ZSAoRDgwMC1EQkZGKSBpcyBhbHNvIHRoZSBpbmNvbXBsZXRlIGNoYXJhY3RlclxuICBpZiAoY2hhckNvZGUgPj0gMHhEODAwICYmIGNoYXJDb2RlIDw9IDB4REJGRikge1xuICAgIHZhciBzaXplID0gdGhpcy5zdXJyb2dhdGVTaXplO1xuICAgIHRoaXMuY2hhckxlbmd0aCArPSBzaXplO1xuICAgIHRoaXMuY2hhclJlY2VpdmVkICs9IHNpemU7XG4gICAgdGhpcy5jaGFyQnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCBzaXplLCAwLCBzaXplKTtcbiAgICBidWZmZXIuY29weSh0aGlzLmNoYXJCdWZmZXIsIDAsIDAsIHNpemUpO1xuICAgIHJldHVybiBjaGFyU3RyLnN1YnN0cmluZygwLCBlbmQpO1xuICB9XG5cbiAgLy8gb3IganVzdCBlbWl0IHRoZSBjaGFyU3RyXG4gIHJldHVybiBjaGFyU3RyO1xufTtcblxuLy8gZGV0ZWN0SW5jb21wbGV0ZUNoYXIgZGV0ZXJtaW5lcyBpZiB0aGVyZSBpcyBhbiBpbmNvbXBsZXRlIFVURi04IGNoYXJhY3RlciBhdFxuLy8gdGhlIGVuZCBvZiB0aGUgZ2l2ZW4gYnVmZmVyLiBJZiBzbywgaXQgc2V0cyB0aGlzLmNoYXJMZW5ndGggdG8gdGhlIGJ5dGVcbi8vIGxlbmd0aCB0aGF0IGNoYXJhY3RlciwgYW5kIHNldHMgdGhpcy5jaGFyUmVjZWl2ZWQgdG8gdGhlIG51bWJlciBvZiBieXRlc1xuLy8gdGhhdCBhcmUgYXZhaWxhYmxlIGZvciB0aGlzIGNoYXJhY3Rlci5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLmRldGVjdEluY29tcGxldGVDaGFyID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIC8vIGRldGVybWluZSBob3cgbWFueSBieXRlcyB3ZSBoYXZlIHRvIGNoZWNrIGF0IHRoZSBlbmQgb2YgdGhpcyBidWZmZXJcbiAgdmFyIGkgPSAoYnVmZmVyLmxlbmd0aCA+PSAzKSA/IDMgOiBidWZmZXIubGVuZ3RoO1xuXG4gIC8vIEZpZ3VyZSBvdXQgaWYgb25lIG9mIHRoZSBsYXN0IGkgYnl0ZXMgb2Ygb3VyIGJ1ZmZlciBhbm5vdW5jZXMgYW5cbiAgLy8gaW5jb21wbGV0ZSBjaGFyLlxuICBmb3IgKDsgaSA+IDA7IGktLSkge1xuICAgIHZhciBjID0gYnVmZmVyW2J1ZmZlci5sZW5ndGggLSBpXTtcblxuICAgIC8vIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1VURi04I0Rlc2NyaXB0aW9uXG5cbiAgICAvLyAxMTBYWFhYWFxuICAgIGlmIChpID09IDEgJiYgYyA+PiA1ID09IDB4MDYpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDI7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyAxMTEwWFhYWFxuICAgIGlmIChpIDw9IDIgJiYgYyA+PiA0ID09IDB4MEUpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDM7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyAxMTExMFhYWFxuICAgIGlmIChpIDw9IDMgJiYgYyA+PiAzID09IDB4MUUpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDQ7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBpO1xufTtcblxuU3RyaW5nRGVjb2Rlci5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIHZhciByZXMgPSAnJztcbiAgaWYgKGJ1ZmZlciAmJiBidWZmZXIubGVuZ3RoKVxuICAgIHJlcyA9IHRoaXMud3JpdGUoYnVmZmVyKTtcblxuICBpZiAodGhpcy5jaGFyUmVjZWl2ZWQpIHtcbiAgICB2YXIgY3IgPSB0aGlzLmNoYXJSZWNlaXZlZDtcbiAgICB2YXIgYnVmID0gdGhpcy5jaGFyQnVmZmVyO1xuICAgIHZhciBlbmMgPSB0aGlzLmVuY29kaW5nO1xuICAgIHJlcyArPSBidWYuc2xpY2UoMCwgY3IpLnRvU3RyaW5nKGVuYyk7XG4gIH1cblxuICByZXR1cm4gcmVzO1xufTtcblxuZnVuY3Rpb24gcGFzc1Rocm91Z2hXcml0ZShidWZmZXIpIHtcbiAgcmV0dXJuIGJ1ZmZlci50b1N0cmluZyh0aGlzLmVuY29kaW5nKTtcbn1cblxuZnVuY3Rpb24gdXRmMTZEZXRlY3RJbmNvbXBsZXRlQ2hhcihidWZmZXIpIHtcbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBidWZmZXIubGVuZ3RoICUgMjtcbiAgdGhpcy5jaGFyTGVuZ3RoID0gdGhpcy5jaGFyUmVjZWl2ZWQgPyAyIDogMDtcbn1cblxuZnVuY3Rpb24gYmFzZTY0RGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKSB7XG4gIHRoaXMuY2hhclJlY2VpdmVkID0gYnVmZmVyLmxlbmd0aCAlIDM7XG4gIHRoaXMuY2hhckxlbmd0aCA9IHRoaXMuY2hhclJlY2VpdmVkID8gMyA6IDA7XG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcHVueWNvZGUgPSByZXF1aXJlKCdwdW55Y29kZScpO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuZXhwb3J0cy5wYXJzZSA9IHVybFBhcnNlO1xuZXhwb3J0cy5yZXNvbHZlID0gdXJsUmVzb2x2ZTtcbmV4cG9ydHMucmVzb2x2ZU9iamVjdCA9IHVybFJlc29sdmVPYmplY3Q7XG5leHBvcnRzLmZvcm1hdCA9IHVybEZvcm1hdDtcblxuZXhwb3J0cy5VcmwgPSBVcmw7XG5cbmZ1bmN0aW9uIFVybCgpIHtcbiAgdGhpcy5wcm90b2NvbCA9IG51bGw7XG4gIHRoaXMuc2xhc2hlcyA9IG51bGw7XG4gIHRoaXMuYXV0aCA9IG51bGw7XG4gIHRoaXMuaG9zdCA9IG51bGw7XG4gIHRoaXMucG9ydCA9IG51bGw7XG4gIHRoaXMuaG9zdG5hbWUgPSBudWxsO1xuICB0aGlzLmhhc2ggPSBudWxsO1xuICB0aGlzLnNlYXJjaCA9IG51bGw7XG4gIHRoaXMucXVlcnkgPSBudWxsO1xuICB0aGlzLnBhdGhuYW1lID0gbnVsbDtcbiAgdGhpcy5wYXRoID0gbnVsbDtcbiAgdGhpcy5ocmVmID0gbnVsbDtcbn1cblxuLy8gUmVmZXJlbmNlOiBSRkMgMzk4NiwgUkZDIDE4MDgsIFJGQyAyMzk2XG5cbi8vIGRlZmluZSB0aGVzZSBoZXJlIHNvIGF0IGxlYXN0IHRoZXkgb25seSBoYXZlIHRvIGJlXG4vLyBjb21waWxlZCBvbmNlIG9uIHRoZSBmaXJzdCBtb2R1bGUgbG9hZC5cbnZhciBwcm90b2NvbFBhdHRlcm4gPSAvXihbYS16MC05ListXSs6KS9pLFxuICAgIHBvcnRQYXR0ZXJuID0gLzpbMC05XSokLyxcblxuICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgYSBzaW1wbGUgcGF0aCBVUkxcbiAgICBzaW1wbGVQYXRoUGF0dGVybiA9IC9eKFxcL1xcLz8oPyFcXC8pW15cXD9cXHNdKikoXFw/W15cXHNdKik/JC8sXG5cbiAgICAvLyBSRkMgMjM5NjogY2hhcmFjdGVycyByZXNlcnZlZCBmb3IgZGVsaW1pdGluZyBVUkxzLlxuICAgIC8vIFdlIGFjdHVhbGx5IGp1c3QgYXV0by1lc2NhcGUgdGhlc2UuXG4gICAgZGVsaW1zID0gWyc8JywgJz4nLCAnXCInLCAnYCcsICcgJywgJ1xccicsICdcXG4nLCAnXFx0J10sXG5cbiAgICAvLyBSRkMgMjM5NjogY2hhcmFjdGVycyBub3QgYWxsb3dlZCBmb3IgdmFyaW91cyByZWFzb25zLlxuICAgIHVud2lzZSA9IFsneycsICd9JywgJ3wnLCAnXFxcXCcsICdeJywgJ2AnXS5jb25jYXQoZGVsaW1zKSxcblxuICAgIC8vIEFsbG93ZWQgYnkgUkZDcywgYnV0IGNhdXNlIG9mIFhTUyBhdHRhY2tzLiAgQWx3YXlzIGVzY2FwZSB0aGVzZS5cbiAgICBhdXRvRXNjYXBlID0gWydcXCcnXS5jb25jYXQodW53aXNlKSxcbiAgICAvLyBDaGFyYWN0ZXJzIHRoYXQgYXJlIG5ldmVyIGV2ZXIgYWxsb3dlZCBpbiBhIGhvc3RuYW1lLlxuICAgIC8vIE5vdGUgdGhhdCBhbnkgaW52YWxpZCBjaGFycyBhcmUgYWxzbyBoYW5kbGVkLCBidXQgdGhlc2VcbiAgICAvLyBhcmUgdGhlIG9uZXMgdGhhdCBhcmUgKmV4cGVjdGVkKiB0byBiZSBzZWVuLCBzbyB3ZSBmYXN0LXBhdGhcbiAgICAvLyB0aGVtLlxuICAgIG5vbkhvc3RDaGFycyA9IFsnJScsICcvJywgJz8nLCAnOycsICcjJ10uY29uY2F0KGF1dG9Fc2NhcGUpLFxuICAgIGhvc3RFbmRpbmdDaGFycyA9IFsnLycsICc/JywgJyMnXSxcbiAgICBob3N0bmFtZU1heExlbiA9IDI1NSxcbiAgICBob3N0bmFtZVBhcnRQYXR0ZXJuID0gL15bK2EtejAtOUEtWl8tXXswLDYzfSQvLFxuICAgIGhvc3RuYW1lUGFydFN0YXJ0ID0gL14oWythLXowLTlBLVpfLV17MCw2M30pKC4qKSQvLFxuICAgIC8vIHByb3RvY29scyB0aGF0IGNhbiBhbGxvdyBcInVuc2FmZVwiIGFuZCBcInVud2lzZVwiIGNoYXJzLlxuICAgIHVuc2FmZVByb3RvY29sID0ge1xuICAgICAgJ2phdmFzY3JpcHQnOiB0cnVlLFxuICAgICAgJ2phdmFzY3JpcHQ6JzogdHJ1ZVxuICAgIH0sXG4gICAgLy8gcHJvdG9jb2xzIHRoYXQgbmV2ZXIgaGF2ZSBhIGhvc3RuYW1lLlxuICAgIGhvc3RsZXNzUHJvdG9jb2wgPSB7XG4gICAgICAnamF2YXNjcmlwdCc6IHRydWUsXG4gICAgICAnamF2YXNjcmlwdDonOiB0cnVlXG4gICAgfSxcbiAgICAvLyBwcm90b2NvbHMgdGhhdCBhbHdheXMgY29udGFpbiBhIC8vIGJpdC5cbiAgICBzbGFzaGVkUHJvdG9jb2wgPSB7XG4gICAgICAnaHR0cCc6IHRydWUsXG4gICAgICAnaHR0cHMnOiB0cnVlLFxuICAgICAgJ2Z0cCc6IHRydWUsXG4gICAgICAnZ29waGVyJzogdHJ1ZSxcbiAgICAgICdmaWxlJzogdHJ1ZSxcbiAgICAgICdodHRwOic6IHRydWUsXG4gICAgICAnaHR0cHM6JzogdHJ1ZSxcbiAgICAgICdmdHA6JzogdHJ1ZSxcbiAgICAgICdnb3BoZXI6JzogdHJ1ZSxcbiAgICAgICdmaWxlOic6IHRydWVcbiAgICB9LFxuICAgIHF1ZXJ5c3RyaW5nID0gcmVxdWlyZSgncXVlcnlzdHJpbmcnKTtcblxuZnVuY3Rpb24gdXJsUGFyc2UodXJsLCBwYXJzZVF1ZXJ5U3RyaW5nLCBzbGFzaGVzRGVub3RlSG9zdCkge1xuICBpZiAodXJsICYmIHV0aWwuaXNPYmplY3QodXJsKSAmJiB1cmwgaW5zdGFuY2VvZiBVcmwpIHJldHVybiB1cmw7XG5cbiAgdmFyIHUgPSBuZXcgVXJsO1xuICB1LnBhcnNlKHVybCwgcGFyc2VRdWVyeVN0cmluZywgc2xhc2hlc0Rlbm90ZUhvc3QpO1xuICByZXR1cm4gdTtcbn1cblxuVXJsLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uKHVybCwgcGFyc2VRdWVyeVN0cmluZywgc2xhc2hlc0Rlbm90ZUhvc3QpIHtcbiAgaWYgKCF1dGlsLmlzU3RyaW5nKHVybCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUGFyYW1ldGVyICd1cmwnIG11c3QgYmUgYSBzdHJpbmcsIG5vdCBcIiArIHR5cGVvZiB1cmwpO1xuICB9XG5cbiAgLy8gQ29weSBjaHJvbWUsIElFLCBvcGVyYSBiYWNrc2xhc2gtaGFuZGxpbmcgYmVoYXZpb3IuXG4gIC8vIEJhY2sgc2xhc2hlcyBiZWZvcmUgdGhlIHF1ZXJ5IHN0cmluZyBnZXQgY29udmVydGVkIHRvIGZvcndhcmQgc2xhc2hlc1xuICAvLyBTZWU6IGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0yNTkxNlxuICB2YXIgcXVlcnlJbmRleCA9IHVybC5pbmRleE9mKCc/JyksXG4gICAgICBzcGxpdHRlciA9XG4gICAgICAgICAgKHF1ZXJ5SW5kZXggIT09IC0xICYmIHF1ZXJ5SW5kZXggPCB1cmwuaW5kZXhPZignIycpKSA/ICc/JyA6ICcjJyxcbiAgICAgIHVTcGxpdCA9IHVybC5zcGxpdChzcGxpdHRlciksXG4gICAgICBzbGFzaFJlZ2V4ID0gL1xcXFwvZztcbiAgdVNwbGl0WzBdID0gdVNwbGl0WzBdLnJlcGxhY2Uoc2xhc2hSZWdleCwgJy8nKTtcbiAgdXJsID0gdVNwbGl0LmpvaW4oc3BsaXR0ZXIpO1xuXG4gIHZhciByZXN0ID0gdXJsO1xuXG4gIC8vIHRyaW0gYmVmb3JlIHByb2NlZWRpbmcuXG4gIC8vIFRoaXMgaXMgdG8gc3VwcG9ydCBwYXJzZSBzdHVmZiBsaWtlIFwiICBodHRwOi8vZm9vLmNvbSAgXFxuXCJcbiAgcmVzdCA9IHJlc3QudHJpbSgpO1xuXG4gIGlmICghc2xhc2hlc0Rlbm90ZUhvc3QgJiYgdXJsLnNwbGl0KCcjJykubGVuZ3RoID09PSAxKSB7XG4gICAgLy8gVHJ5IGZhc3QgcGF0aCByZWdleHBcbiAgICB2YXIgc2ltcGxlUGF0aCA9IHNpbXBsZVBhdGhQYXR0ZXJuLmV4ZWMocmVzdCk7XG4gICAgaWYgKHNpbXBsZVBhdGgpIHtcbiAgICAgIHRoaXMucGF0aCA9IHJlc3Q7XG4gICAgICB0aGlzLmhyZWYgPSByZXN0O1xuICAgICAgdGhpcy5wYXRobmFtZSA9IHNpbXBsZVBhdGhbMV07XG4gICAgICBpZiAoc2ltcGxlUGF0aFsyXSkge1xuICAgICAgICB0aGlzLnNlYXJjaCA9IHNpbXBsZVBhdGhbMl07XG4gICAgICAgIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHF1ZXJ5c3RyaW5nLnBhcnNlKHRoaXMuc2VhcmNoLnN1YnN0cigxKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHRoaXMuc2VhcmNoLnN1YnN0cigxKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICAgIHRoaXMuc2VhcmNoID0gJyc7XG4gICAgICAgIHRoaXMucXVlcnkgPSB7fTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfVxuXG4gIHZhciBwcm90byA9IHByb3RvY29sUGF0dGVybi5leGVjKHJlc3QpO1xuICBpZiAocHJvdG8pIHtcbiAgICBwcm90byA9IHByb3RvWzBdO1xuICAgIHZhciBsb3dlclByb3RvID0gcHJvdG8udG9Mb3dlckNhc2UoKTtcbiAgICB0aGlzLnByb3RvY29sID0gbG93ZXJQcm90bztcbiAgICByZXN0ID0gcmVzdC5zdWJzdHIocHJvdG8ubGVuZ3RoKTtcbiAgfVxuXG4gIC8vIGZpZ3VyZSBvdXQgaWYgaXQncyBnb3QgYSBob3N0XG4gIC8vIHVzZXJAc2VydmVyIGlzICphbHdheXMqIGludGVycHJldGVkIGFzIGEgaG9zdG5hbWUsIGFuZCB1cmxcbiAgLy8gcmVzb2x1dGlvbiB3aWxsIHRyZWF0IC8vZm9vL2JhciBhcyBob3N0PWZvbyxwYXRoPWJhciBiZWNhdXNlIHRoYXQnc1xuICAvLyBob3cgdGhlIGJyb3dzZXIgcmVzb2x2ZXMgcmVsYXRpdmUgVVJMcy5cbiAgaWYgKHNsYXNoZXNEZW5vdGVIb3N0IHx8IHByb3RvIHx8IHJlc3QubWF0Y2goL15cXC9cXC9bXkBcXC9dK0BbXkBcXC9dKy8pKSB7XG4gICAgdmFyIHNsYXNoZXMgPSByZXN0LnN1YnN0cigwLCAyKSA9PT0gJy8vJztcbiAgICBpZiAoc2xhc2hlcyAmJiAhKHByb3RvICYmIGhvc3RsZXNzUHJvdG9jb2xbcHJvdG9dKSkge1xuICAgICAgcmVzdCA9IHJlc3Quc3Vic3RyKDIpO1xuICAgICAgdGhpcy5zbGFzaGVzID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWhvc3RsZXNzUHJvdG9jb2xbcHJvdG9dICYmXG4gICAgICAoc2xhc2hlcyB8fCAocHJvdG8gJiYgIXNsYXNoZWRQcm90b2NvbFtwcm90b10pKSkge1xuXG4gICAgLy8gdGhlcmUncyBhIGhvc3RuYW1lLlxuICAgIC8vIHRoZSBmaXJzdCBpbnN0YW5jZSBvZiAvLCA/LCA7LCBvciAjIGVuZHMgdGhlIGhvc3QuXG4gICAgLy9cbiAgICAvLyBJZiB0aGVyZSBpcyBhbiBAIGluIHRoZSBob3N0bmFtZSwgdGhlbiBub24taG9zdCBjaGFycyAqYXJlKiBhbGxvd2VkXG4gICAgLy8gdG8gdGhlIGxlZnQgb2YgdGhlIGxhc3QgQCBzaWduLCB1bmxlc3Mgc29tZSBob3N0LWVuZGluZyBjaGFyYWN0ZXJcbiAgICAvLyBjb21lcyAqYmVmb3JlKiB0aGUgQC1zaWduLlxuICAgIC8vIFVSTHMgYXJlIG9ibm94aW91cy5cbiAgICAvL1xuICAgIC8vIGV4OlxuICAgIC8vIGh0dHA6Ly9hQGJAYy8gPT4gdXNlcjphQGIgaG9zdDpjXG4gICAgLy8gaHR0cDovL2FAYj9AYyA9PiB1c2VyOmEgaG9zdDpjIHBhdGg6Lz9AY1xuXG4gICAgLy8gdjAuMTIgVE9ETyhpc2FhY3MpOiBUaGlzIGlzIG5vdCBxdWl0ZSBob3cgQ2hyb21lIGRvZXMgdGhpbmdzLlxuICAgIC8vIFJldmlldyBvdXIgdGVzdCBjYXNlIGFnYWluc3QgYnJvd3NlcnMgbW9yZSBjb21wcmVoZW5zaXZlbHkuXG5cbiAgICAvLyBmaW5kIHRoZSBmaXJzdCBpbnN0YW5jZSBvZiBhbnkgaG9zdEVuZGluZ0NoYXJzXG4gICAgdmFyIGhvc3RFbmQgPSAtMTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGhvc3RFbmRpbmdDaGFycy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGhlYyA9IHJlc3QuaW5kZXhPZihob3N0RW5kaW5nQ2hhcnNbaV0pO1xuICAgICAgaWYgKGhlYyAhPT0gLTEgJiYgKGhvc3RFbmQgPT09IC0xIHx8IGhlYyA8IGhvc3RFbmQpKVxuICAgICAgICBob3N0RW5kID0gaGVjO1xuICAgIH1cblxuICAgIC8vIGF0IHRoaXMgcG9pbnQsIGVpdGhlciB3ZSBoYXZlIGFuIGV4cGxpY2l0IHBvaW50IHdoZXJlIHRoZVxuICAgIC8vIGF1dGggcG9ydGlvbiBjYW5ub3QgZ28gcGFzdCwgb3IgdGhlIGxhc3QgQCBjaGFyIGlzIHRoZSBkZWNpZGVyLlxuICAgIHZhciBhdXRoLCBhdFNpZ247XG4gICAgaWYgKGhvc3RFbmQgPT09IC0xKSB7XG4gICAgICAvLyBhdFNpZ24gY2FuIGJlIGFueXdoZXJlLlxuICAgICAgYXRTaWduID0gcmVzdC5sYXN0SW5kZXhPZignQCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBhdFNpZ24gbXVzdCBiZSBpbiBhdXRoIHBvcnRpb24uXG4gICAgICAvLyBodHRwOi8vYUBiL2NAZCA9PiBob3N0OmIgYXV0aDphIHBhdGg6L2NAZFxuICAgICAgYXRTaWduID0gcmVzdC5sYXN0SW5kZXhPZignQCcsIGhvc3RFbmQpO1xuICAgIH1cblxuICAgIC8vIE5vdyB3ZSBoYXZlIGEgcG9ydGlvbiB3aGljaCBpcyBkZWZpbml0ZWx5IHRoZSBhdXRoLlxuICAgIC8vIFB1bGwgdGhhdCBvZmYuXG4gICAgaWYgKGF0U2lnbiAhPT0gLTEpIHtcbiAgICAgIGF1dGggPSByZXN0LnNsaWNlKDAsIGF0U2lnbik7XG4gICAgICByZXN0ID0gcmVzdC5zbGljZShhdFNpZ24gKyAxKTtcbiAgICAgIHRoaXMuYXV0aCA9IGRlY29kZVVSSUNvbXBvbmVudChhdXRoKTtcbiAgICB9XG5cbiAgICAvLyB0aGUgaG9zdCBpcyB0aGUgcmVtYWluaW5nIHRvIHRoZSBsZWZ0IG9mIHRoZSBmaXJzdCBub24taG9zdCBjaGFyXG4gICAgaG9zdEVuZCA9IC0xO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9uSG9zdENoYXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaGVjID0gcmVzdC5pbmRleE9mKG5vbkhvc3RDaGFyc1tpXSk7XG4gICAgICBpZiAoaGVjICE9PSAtMSAmJiAoaG9zdEVuZCA9PT0gLTEgfHwgaGVjIDwgaG9zdEVuZCkpXG4gICAgICAgIGhvc3RFbmQgPSBoZWM7XG4gICAgfVxuICAgIC8vIGlmIHdlIHN0aWxsIGhhdmUgbm90IGhpdCBpdCwgdGhlbiB0aGUgZW50aXJlIHRoaW5nIGlzIGEgaG9zdC5cbiAgICBpZiAoaG9zdEVuZCA9PT0gLTEpXG4gICAgICBob3N0RW5kID0gcmVzdC5sZW5ndGg7XG5cbiAgICB0aGlzLmhvc3QgPSByZXN0LnNsaWNlKDAsIGhvc3RFbmQpO1xuICAgIHJlc3QgPSByZXN0LnNsaWNlKGhvc3RFbmQpO1xuXG4gICAgLy8gcHVsbCBvdXQgcG9ydC5cbiAgICB0aGlzLnBhcnNlSG9zdCgpO1xuXG4gICAgLy8gd2UndmUgaW5kaWNhdGVkIHRoYXQgdGhlcmUgaXMgYSBob3N0bmFtZSxcbiAgICAvLyBzbyBldmVuIGlmIGl0J3MgZW1wdHksIGl0IGhhcyB0byBiZSBwcmVzZW50LlxuICAgIHRoaXMuaG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lIHx8ICcnO1xuXG4gICAgLy8gaWYgaG9zdG5hbWUgYmVnaW5zIHdpdGggWyBhbmQgZW5kcyB3aXRoIF1cbiAgICAvLyBhc3N1bWUgdGhhdCBpdCdzIGFuIElQdjYgYWRkcmVzcy5cbiAgICB2YXIgaXB2Nkhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZVswXSA9PT0gJ1snICYmXG4gICAgICAgIHRoaXMuaG9zdG5hbWVbdGhpcy5ob3N0bmFtZS5sZW5ndGggLSAxXSA9PT0gJ10nO1xuXG4gICAgLy8gdmFsaWRhdGUgYSBsaXR0bGUuXG4gICAgaWYgKCFpcHY2SG9zdG5hbWUpIHtcbiAgICAgIHZhciBob3N0cGFydHMgPSB0aGlzLmhvc3RuYW1lLnNwbGl0KC9cXC4vKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gaG9zdHBhcnRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIgcGFydCA9IGhvc3RwYXJ0c1tpXTtcbiAgICAgICAgaWYgKCFwYXJ0KSBjb250aW51ZTtcbiAgICAgICAgaWYgKCFwYXJ0Lm1hdGNoKGhvc3RuYW1lUGFydFBhdHRlcm4pKSB7XG4gICAgICAgICAgdmFyIG5ld3BhcnQgPSAnJztcbiAgICAgICAgICBmb3IgKHZhciBqID0gMCwgayA9IHBhcnQubGVuZ3RoOyBqIDwgazsgaisrKSB7XG4gICAgICAgICAgICBpZiAocGFydC5jaGFyQ29kZUF0KGopID4gMTI3KSB7XG4gICAgICAgICAgICAgIC8vIHdlIHJlcGxhY2Ugbm9uLUFTQ0lJIGNoYXIgd2l0aCBhIHRlbXBvcmFyeSBwbGFjZWhvbGRlclxuICAgICAgICAgICAgICAvLyB3ZSBuZWVkIHRoaXMgdG8gbWFrZSBzdXJlIHNpemUgb2YgaG9zdG5hbWUgaXMgbm90XG4gICAgICAgICAgICAgIC8vIGJyb2tlbiBieSByZXBsYWNpbmcgbm9uLUFTQ0lJIGJ5IG5vdGhpbmdcbiAgICAgICAgICAgICAgbmV3cGFydCArPSAneCc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuZXdwYXJ0ICs9IHBhcnRbal07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHdlIHRlc3QgYWdhaW4gd2l0aCBBU0NJSSBjaGFyIG9ubHlcbiAgICAgICAgICBpZiAoIW5ld3BhcnQubWF0Y2goaG9zdG5hbWVQYXJ0UGF0dGVybikpIHtcbiAgICAgICAgICAgIHZhciB2YWxpZFBhcnRzID0gaG9zdHBhcnRzLnNsaWNlKDAsIGkpO1xuICAgICAgICAgICAgdmFyIG5vdEhvc3QgPSBob3N0cGFydHMuc2xpY2UoaSArIDEpO1xuICAgICAgICAgICAgdmFyIGJpdCA9IHBhcnQubWF0Y2goaG9zdG5hbWVQYXJ0U3RhcnQpO1xuICAgICAgICAgICAgaWYgKGJpdCkge1xuICAgICAgICAgICAgICB2YWxpZFBhcnRzLnB1c2goYml0WzFdKTtcbiAgICAgICAgICAgICAgbm90SG9zdC51bnNoaWZ0KGJpdFsyXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobm90SG9zdC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgcmVzdCA9ICcvJyArIG5vdEhvc3Quam9pbignLicpICsgcmVzdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuaG9zdG5hbWUgPSB2YWxpZFBhcnRzLmpvaW4oJy4nKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmhvc3RuYW1lLmxlbmd0aCA+IGhvc3RuYW1lTWF4TGVuKSB7XG4gICAgICB0aGlzLmhvc3RuYW1lID0gJyc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGhvc3RuYW1lcyBhcmUgYWx3YXlzIGxvd2VyIGNhc2UuXG4gICAgICB0aGlzLmhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIH1cblxuICAgIGlmICghaXB2Nkhvc3RuYW1lKSB7XG4gICAgICAvLyBJRE5BIFN1cHBvcnQ6IFJldHVybnMgYSBwdW55Y29kZWQgcmVwcmVzZW50YXRpb24gb2YgXCJkb21haW5cIi5cbiAgICAgIC8vIEl0IG9ubHkgY29udmVydHMgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHRoYXRcbiAgICAgIC8vIGhhdmUgbm9uLUFTQ0lJIGNoYXJhY3RlcnMsIGkuZS4gaXQgZG9lc24ndCBtYXR0ZXIgaWZcbiAgICAgIC8vIHlvdSBjYWxsIGl0IHdpdGggYSBkb21haW4gdGhhdCBhbHJlYWR5IGlzIEFTQ0lJLW9ubHkuXG4gICAgICB0aGlzLmhvc3RuYW1lID0gcHVueWNvZGUudG9BU0NJSSh0aGlzLmhvc3RuYW1lKTtcbiAgICB9XG5cbiAgICB2YXIgcCA9IHRoaXMucG9ydCA/ICc6JyArIHRoaXMucG9ydCA6ICcnO1xuICAgIHZhciBoID0gdGhpcy5ob3N0bmFtZSB8fCAnJztcbiAgICB0aGlzLmhvc3QgPSBoICsgcDtcbiAgICB0aGlzLmhyZWYgKz0gdGhpcy5ob3N0O1xuXG4gICAgLy8gc3RyaXAgWyBhbmQgXSBmcm9tIHRoZSBob3N0bmFtZVxuICAgIC8vIHRoZSBob3N0IGZpZWxkIHN0aWxsIHJldGFpbnMgdGhlbSwgdGhvdWdoXG4gICAgaWYgKGlwdjZIb3N0bmFtZSkge1xuICAgICAgdGhpcy5ob3N0bmFtZSA9IHRoaXMuaG9zdG5hbWUuc3Vic3RyKDEsIHRoaXMuaG9zdG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBpZiAocmVzdFswXSAhPT0gJy8nKSB7XG4gICAgICAgIHJlc3QgPSAnLycgKyByZXN0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIG5vdyByZXN0IGlzIHNldCB0byB0aGUgcG9zdC1ob3N0IHN0dWZmLlxuICAvLyBjaG9wIG9mZiBhbnkgZGVsaW0gY2hhcnMuXG4gIGlmICghdW5zYWZlUHJvdG9jb2xbbG93ZXJQcm90b10pIHtcblxuICAgIC8vIEZpcnN0LCBtYWtlIDEwMCUgc3VyZSB0aGF0IGFueSBcImF1dG9Fc2NhcGVcIiBjaGFycyBnZXRcbiAgICAvLyBlc2NhcGVkLCBldmVuIGlmIGVuY29kZVVSSUNvbXBvbmVudCBkb2Vzbid0IHRoaW5rIHRoZXlcbiAgICAvLyBuZWVkIHRvIGJlLlxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXV0b0VzY2FwZS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHZhciBhZSA9IGF1dG9Fc2NhcGVbaV07XG4gICAgICBpZiAocmVzdC5pbmRleE9mKGFlKSA9PT0gLTEpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgdmFyIGVzYyA9IGVuY29kZVVSSUNvbXBvbmVudChhZSk7XG4gICAgICBpZiAoZXNjID09PSBhZSkge1xuICAgICAgICBlc2MgPSBlc2NhcGUoYWUpO1xuICAgICAgfVxuICAgICAgcmVzdCA9IHJlc3Quc3BsaXQoYWUpLmpvaW4oZXNjKTtcbiAgICB9XG4gIH1cblxuXG4gIC8vIGNob3Agb2ZmIGZyb20gdGhlIHRhaWwgZmlyc3QuXG4gIHZhciBoYXNoID0gcmVzdC5pbmRleE9mKCcjJyk7XG4gIGlmIChoYXNoICE9PSAtMSkge1xuICAgIC8vIGdvdCBhIGZyYWdtZW50IHN0cmluZy5cbiAgICB0aGlzLmhhc2ggPSByZXN0LnN1YnN0cihoYXNoKTtcbiAgICByZXN0ID0gcmVzdC5zbGljZSgwLCBoYXNoKTtcbiAgfVxuICB2YXIgcW0gPSByZXN0LmluZGV4T2YoJz8nKTtcbiAgaWYgKHFtICE9PSAtMSkge1xuICAgIHRoaXMuc2VhcmNoID0gcmVzdC5zdWJzdHIocW0pO1xuICAgIHRoaXMucXVlcnkgPSByZXN0LnN1YnN0cihxbSArIDEpO1xuICAgIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICB0aGlzLnF1ZXJ5ID0gcXVlcnlzdHJpbmcucGFyc2UodGhpcy5xdWVyeSk7XG4gICAgfVxuICAgIHJlc3QgPSByZXN0LnNsaWNlKDAsIHFtKTtcbiAgfSBlbHNlIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgLy8gbm8gcXVlcnkgc3RyaW5nLCBidXQgcGFyc2VRdWVyeVN0cmluZyBzdGlsbCByZXF1ZXN0ZWRcbiAgICB0aGlzLnNlYXJjaCA9ICcnO1xuICAgIHRoaXMucXVlcnkgPSB7fTtcbiAgfVxuICBpZiAocmVzdCkgdGhpcy5wYXRobmFtZSA9IHJlc3Q7XG4gIGlmIChzbGFzaGVkUHJvdG9jb2xbbG93ZXJQcm90b10gJiZcbiAgICAgIHRoaXMuaG9zdG5hbWUgJiYgIXRoaXMucGF0aG5hbWUpIHtcbiAgICB0aGlzLnBhdGhuYW1lID0gJy8nO1xuICB9XG5cbiAgLy90byBzdXBwb3J0IGh0dHAucmVxdWVzdFxuICBpZiAodGhpcy5wYXRobmFtZSB8fCB0aGlzLnNlYXJjaCkge1xuICAgIHZhciBwID0gdGhpcy5wYXRobmFtZSB8fCAnJztcbiAgICB2YXIgcyA9IHRoaXMuc2VhcmNoIHx8ICcnO1xuICAgIHRoaXMucGF0aCA9IHAgKyBzO1xuICB9XG5cbiAgLy8gZmluYWxseSwgcmVjb25zdHJ1Y3QgdGhlIGhyZWYgYmFzZWQgb24gd2hhdCBoYXMgYmVlbiB2YWxpZGF0ZWQuXG4gIHRoaXMuaHJlZiA9IHRoaXMuZm9ybWF0KCk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZm9ybWF0IGEgcGFyc2VkIG9iamVjdCBpbnRvIGEgdXJsIHN0cmluZ1xuZnVuY3Rpb24gdXJsRm9ybWF0KG9iaikge1xuICAvLyBlbnN1cmUgaXQncyBhbiBvYmplY3QsIGFuZCBub3QgYSBzdHJpbmcgdXJsLlxuICAvLyBJZiBpdCdzIGFuIG9iaiwgdGhpcyBpcyBhIG5vLW9wLlxuICAvLyB0aGlzIHdheSwgeW91IGNhbiBjYWxsIHVybF9mb3JtYXQoKSBvbiBzdHJpbmdzXG4gIC8vIHRvIGNsZWFuIHVwIHBvdGVudGlhbGx5IHdvbmt5IHVybHMuXG4gIGlmICh1dGlsLmlzU3RyaW5nKG9iaikpIG9iaiA9IHVybFBhcnNlKG9iaik7XG4gIGlmICghKG9iaiBpbnN0YW5jZW9mIFVybCkpIHJldHVybiBVcmwucHJvdG90eXBlLmZvcm1hdC5jYWxsKG9iaik7XG4gIHJldHVybiBvYmouZm9ybWF0KCk7XG59XG5cblVybC5wcm90b3R5cGUuZm9ybWF0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBhdXRoID0gdGhpcy5hdXRoIHx8ICcnO1xuICBpZiAoYXV0aCkge1xuICAgIGF1dGggPSBlbmNvZGVVUklDb21wb25lbnQoYXV0aCk7XG4gICAgYXV0aCA9IGF1dGgucmVwbGFjZSgvJTNBL2ksICc6Jyk7XG4gICAgYXV0aCArPSAnQCc7XG4gIH1cblxuICB2YXIgcHJvdG9jb2wgPSB0aGlzLnByb3RvY29sIHx8ICcnLFxuICAgICAgcGF0aG5hbWUgPSB0aGlzLnBhdGhuYW1lIHx8ICcnLFxuICAgICAgaGFzaCA9IHRoaXMuaGFzaCB8fCAnJyxcbiAgICAgIGhvc3QgPSBmYWxzZSxcbiAgICAgIHF1ZXJ5ID0gJyc7XG5cbiAgaWYgKHRoaXMuaG9zdCkge1xuICAgIGhvc3QgPSBhdXRoICsgdGhpcy5ob3N0O1xuICB9IGVsc2UgaWYgKHRoaXMuaG9zdG5hbWUpIHtcbiAgICBob3N0ID0gYXV0aCArICh0aGlzLmhvc3RuYW1lLmluZGV4T2YoJzonKSA9PT0gLTEgP1xuICAgICAgICB0aGlzLmhvc3RuYW1lIDpcbiAgICAgICAgJ1snICsgdGhpcy5ob3N0bmFtZSArICddJyk7XG4gICAgaWYgKHRoaXMucG9ydCkge1xuICAgICAgaG9zdCArPSAnOicgKyB0aGlzLnBvcnQ7XG4gICAgfVxuICB9XG5cbiAgaWYgKHRoaXMucXVlcnkgJiZcbiAgICAgIHV0aWwuaXNPYmplY3QodGhpcy5xdWVyeSkgJiZcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMucXVlcnkpLmxlbmd0aCkge1xuICAgIHF1ZXJ5ID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHRoaXMucXVlcnkpO1xuICB9XG5cbiAgdmFyIHNlYXJjaCA9IHRoaXMuc2VhcmNoIHx8IChxdWVyeSAmJiAoJz8nICsgcXVlcnkpKSB8fCAnJztcblxuICBpZiAocHJvdG9jb2wgJiYgcHJvdG9jb2wuc3Vic3RyKC0xKSAhPT0gJzonKSBwcm90b2NvbCArPSAnOic7XG5cbiAgLy8gb25seSB0aGUgc2xhc2hlZFByb3RvY29scyBnZXQgdGhlIC8vLiAgTm90IG1haWx0bzosIHhtcHA6LCBldGMuXG4gIC8vIHVubGVzcyB0aGV5IGhhZCB0aGVtIHRvIGJlZ2luIHdpdGguXG4gIGlmICh0aGlzLnNsYXNoZXMgfHxcbiAgICAgICghcHJvdG9jb2wgfHwgc2xhc2hlZFByb3RvY29sW3Byb3RvY29sXSkgJiYgaG9zdCAhPT0gZmFsc2UpIHtcbiAgICBob3N0ID0gJy8vJyArIChob3N0IHx8ICcnKTtcbiAgICBpZiAocGF0aG5hbWUgJiYgcGF0aG5hbWUuY2hhckF0KDApICE9PSAnLycpIHBhdGhuYW1lID0gJy8nICsgcGF0aG5hbWU7XG4gIH0gZWxzZSBpZiAoIWhvc3QpIHtcbiAgICBob3N0ID0gJyc7XG4gIH1cblxuICBpZiAoaGFzaCAmJiBoYXNoLmNoYXJBdCgwKSAhPT0gJyMnKSBoYXNoID0gJyMnICsgaGFzaDtcbiAgaWYgKHNlYXJjaCAmJiBzZWFyY2guY2hhckF0KDApICE9PSAnPycpIHNlYXJjaCA9ICc/JyArIHNlYXJjaDtcblxuICBwYXRobmFtZSA9IHBhdGhuYW1lLnJlcGxhY2UoL1s/I10vZywgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KG1hdGNoKTtcbiAgfSk7XG4gIHNlYXJjaCA9IHNlYXJjaC5yZXBsYWNlKCcjJywgJyUyMycpO1xuXG4gIHJldHVybiBwcm90b2NvbCArIGhvc3QgKyBwYXRobmFtZSArIHNlYXJjaCArIGhhc2g7XG59O1xuXG5mdW5jdGlvbiB1cmxSZXNvbHZlKHNvdXJjZSwgcmVsYXRpdmUpIHtcbiAgcmV0dXJuIHVybFBhcnNlKHNvdXJjZSwgZmFsc2UsIHRydWUpLnJlc29sdmUocmVsYXRpdmUpO1xufVxuXG5VcmwucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbihyZWxhdGl2ZSkge1xuICByZXR1cm4gdGhpcy5yZXNvbHZlT2JqZWN0KHVybFBhcnNlKHJlbGF0aXZlLCBmYWxzZSwgdHJ1ZSkpLmZvcm1hdCgpO1xufTtcblxuZnVuY3Rpb24gdXJsUmVzb2x2ZU9iamVjdChzb3VyY2UsIHJlbGF0aXZlKSB7XG4gIGlmICghc291cmNlKSByZXR1cm4gcmVsYXRpdmU7XG4gIHJldHVybiB1cmxQYXJzZShzb3VyY2UsIGZhbHNlLCB0cnVlKS5yZXNvbHZlT2JqZWN0KHJlbGF0aXZlKTtcbn1cblxuVXJsLnByb3RvdHlwZS5yZXNvbHZlT2JqZWN0ID0gZnVuY3Rpb24ocmVsYXRpdmUpIHtcbiAgaWYgKHV0aWwuaXNTdHJpbmcocmVsYXRpdmUpKSB7XG4gICAgdmFyIHJlbCA9IG5ldyBVcmwoKTtcbiAgICByZWwucGFyc2UocmVsYXRpdmUsIGZhbHNlLCB0cnVlKTtcbiAgICByZWxhdGl2ZSA9IHJlbDtcbiAgfVxuXG4gIHZhciByZXN1bHQgPSBuZXcgVXJsKCk7XG4gIHZhciB0a2V5cyA9IE9iamVjdC5rZXlzKHRoaXMpO1xuICBmb3IgKHZhciB0ayA9IDA7IHRrIDwgdGtleXMubGVuZ3RoOyB0aysrKSB7XG4gICAgdmFyIHRrZXkgPSB0a2V5c1t0a107XG4gICAgcmVzdWx0W3RrZXldID0gdGhpc1t0a2V5XTtcbiAgfVxuXG4gIC8vIGhhc2ggaXMgYWx3YXlzIG92ZXJyaWRkZW4sIG5vIG1hdHRlciB3aGF0LlxuICAvLyBldmVuIGhyZWY9XCJcIiB3aWxsIHJlbW92ZSBpdC5cbiAgcmVzdWx0Lmhhc2ggPSByZWxhdGl2ZS5oYXNoO1xuXG4gIC8vIGlmIHRoZSByZWxhdGl2ZSB1cmwgaXMgZW1wdHksIHRoZW4gdGhlcmUncyBub3RoaW5nIGxlZnQgdG8gZG8gaGVyZS5cbiAgaWYgKHJlbGF0aXZlLmhyZWYgPT09ICcnKSB7XG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIGhyZWZzIGxpa2UgLy9mb28vYmFyIGFsd2F5cyBjdXQgdG8gdGhlIHByb3RvY29sLlxuICBpZiAocmVsYXRpdmUuc2xhc2hlcyAmJiAhcmVsYXRpdmUucHJvdG9jb2wpIHtcbiAgICAvLyB0YWtlIGV2ZXJ5dGhpbmcgZXhjZXB0IHRoZSBwcm90b2NvbCBmcm9tIHJlbGF0aXZlXG4gICAgdmFyIHJrZXlzID0gT2JqZWN0LmtleXMocmVsYXRpdmUpO1xuICAgIGZvciAodmFyIHJrID0gMDsgcmsgPCBya2V5cy5sZW5ndGg7IHJrKyspIHtcbiAgICAgIHZhciBya2V5ID0gcmtleXNbcmtdO1xuICAgICAgaWYgKHJrZXkgIT09ICdwcm90b2NvbCcpXG4gICAgICAgIHJlc3VsdFtya2V5XSA9IHJlbGF0aXZlW3JrZXldO1xuICAgIH1cblxuICAgIC8vdXJsUGFyc2UgYXBwZW5kcyB0cmFpbGluZyAvIHRvIHVybHMgbGlrZSBodHRwOi8vd3d3LmV4YW1wbGUuY29tXG4gICAgaWYgKHNsYXNoZWRQcm90b2NvbFtyZXN1bHQucHJvdG9jb2xdICYmXG4gICAgICAgIHJlc3VsdC5ob3N0bmFtZSAmJiAhcmVzdWx0LnBhdGhuYW1lKSB7XG4gICAgICByZXN1bHQucGF0aCA9IHJlc3VsdC5wYXRobmFtZSA9ICcvJztcbiAgICB9XG5cbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgaWYgKHJlbGF0aXZlLnByb3RvY29sICYmIHJlbGF0aXZlLnByb3RvY29sICE9PSByZXN1bHQucHJvdG9jb2wpIHtcbiAgICAvLyBpZiBpdCdzIGEga25vd24gdXJsIHByb3RvY29sLCB0aGVuIGNoYW5naW5nXG4gICAgLy8gdGhlIHByb3RvY29sIGRvZXMgd2VpcmQgdGhpbmdzXG4gICAgLy8gZmlyc3QsIGlmIGl0J3Mgbm90IGZpbGU6LCB0aGVuIHdlIE1VU1QgaGF2ZSBhIGhvc3QsXG4gICAgLy8gYW5kIGlmIHRoZXJlIHdhcyBhIHBhdGhcbiAgICAvLyB0byBiZWdpbiB3aXRoLCB0aGVuIHdlIE1VU1QgaGF2ZSBhIHBhdGguXG4gICAgLy8gaWYgaXQgaXMgZmlsZTosIHRoZW4gdGhlIGhvc3QgaXMgZHJvcHBlZCxcbiAgICAvLyBiZWNhdXNlIHRoYXQncyBrbm93biB0byBiZSBob3N0bGVzcy5cbiAgICAvLyBhbnl0aGluZyBlbHNlIGlzIGFzc3VtZWQgdG8gYmUgYWJzb2x1dGUuXG4gICAgaWYgKCFzbGFzaGVkUHJvdG9jb2xbcmVsYXRpdmUucHJvdG9jb2xdKSB7XG4gICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHJlbGF0aXZlKTtcbiAgICAgIGZvciAodmFyIHYgPSAwOyB2IDwga2V5cy5sZW5ndGg7IHYrKykge1xuICAgICAgICB2YXIgayA9IGtleXNbdl07XG4gICAgICAgIHJlc3VsdFtrXSA9IHJlbGF0aXZlW2tdO1xuICAgICAgfVxuICAgICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHJlc3VsdC5wcm90b2NvbCA9IHJlbGF0aXZlLnByb3RvY29sO1xuICAgIGlmICghcmVsYXRpdmUuaG9zdCAmJiAhaG9zdGxlc3NQcm90b2NvbFtyZWxhdGl2ZS5wcm90b2NvbF0pIHtcbiAgICAgIHZhciByZWxQYXRoID0gKHJlbGF0aXZlLnBhdGhuYW1lIHx8ICcnKS5zcGxpdCgnLycpO1xuICAgICAgd2hpbGUgKHJlbFBhdGgubGVuZ3RoICYmICEocmVsYXRpdmUuaG9zdCA9IHJlbFBhdGguc2hpZnQoKSkpO1xuICAgICAgaWYgKCFyZWxhdGl2ZS5ob3N0KSByZWxhdGl2ZS5ob3N0ID0gJyc7XG4gICAgICBpZiAoIXJlbGF0aXZlLmhvc3RuYW1lKSByZWxhdGl2ZS5ob3N0bmFtZSA9ICcnO1xuICAgICAgaWYgKHJlbFBhdGhbMF0gIT09ICcnKSByZWxQYXRoLnVuc2hpZnQoJycpO1xuICAgICAgaWYgKHJlbFBhdGgubGVuZ3RoIDwgMikgcmVsUGF0aC51bnNoaWZ0KCcnKTtcbiAgICAgIHJlc3VsdC5wYXRobmFtZSA9IHJlbFBhdGguam9pbignLycpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQucGF0aG5hbWUgPSByZWxhdGl2ZS5wYXRobmFtZTtcbiAgICB9XG4gICAgcmVzdWx0LnNlYXJjaCA9IHJlbGF0aXZlLnNlYXJjaDtcbiAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgICByZXN1bHQuaG9zdCA9IHJlbGF0aXZlLmhvc3QgfHwgJyc7XG4gICAgcmVzdWx0LmF1dGggPSByZWxhdGl2ZS5hdXRoO1xuICAgIHJlc3VsdC5ob3N0bmFtZSA9IHJlbGF0aXZlLmhvc3RuYW1lIHx8IHJlbGF0aXZlLmhvc3Q7XG4gICAgcmVzdWx0LnBvcnQgPSByZWxhdGl2ZS5wb3J0O1xuICAgIC8vIHRvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgaWYgKHJlc3VsdC5wYXRobmFtZSB8fCByZXN1bHQuc2VhcmNoKSB7XG4gICAgICB2YXIgcCA9IHJlc3VsdC5wYXRobmFtZSB8fCAnJztcbiAgICAgIHZhciBzID0gcmVzdWx0LnNlYXJjaCB8fCAnJztcbiAgICAgIHJlc3VsdC5wYXRoID0gcCArIHM7XG4gICAgfVxuICAgIHJlc3VsdC5zbGFzaGVzID0gcmVzdWx0LnNsYXNoZXMgfHwgcmVsYXRpdmUuc2xhc2hlcztcbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgdmFyIGlzU291cmNlQWJzID0gKHJlc3VsdC5wYXRobmFtZSAmJiByZXN1bHQucGF0aG5hbWUuY2hhckF0KDApID09PSAnLycpLFxuICAgICAgaXNSZWxBYnMgPSAoXG4gICAgICAgICAgcmVsYXRpdmUuaG9zdCB8fFxuICAgICAgICAgIHJlbGF0aXZlLnBhdGhuYW1lICYmIHJlbGF0aXZlLnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nXG4gICAgICApLFxuICAgICAgbXVzdEVuZEFicyA9IChpc1JlbEFicyB8fCBpc1NvdXJjZUFicyB8fFxuICAgICAgICAgICAgICAgICAgICAocmVzdWx0Lmhvc3QgJiYgcmVsYXRpdmUucGF0aG5hbWUpKSxcbiAgICAgIHJlbW92ZUFsbERvdHMgPSBtdXN0RW5kQWJzLFxuICAgICAgc3JjUGF0aCA9IHJlc3VsdC5wYXRobmFtZSAmJiByZXN1bHQucGF0aG5hbWUuc3BsaXQoJy8nKSB8fCBbXSxcbiAgICAgIHJlbFBhdGggPSByZWxhdGl2ZS5wYXRobmFtZSAmJiByZWxhdGl2ZS5wYXRobmFtZS5zcGxpdCgnLycpIHx8IFtdLFxuICAgICAgcHN5Y2hvdGljID0gcmVzdWx0LnByb3RvY29sICYmICFzbGFzaGVkUHJvdG9jb2xbcmVzdWx0LnByb3RvY29sXTtcblxuICAvLyBpZiB0aGUgdXJsIGlzIGEgbm9uLXNsYXNoZWQgdXJsLCB0aGVuIHJlbGF0aXZlXG4gIC8vIGxpbmtzIGxpa2UgLi4vLi4gc2hvdWxkIGJlIGFibGVcbiAgLy8gdG8gY3Jhd2wgdXAgdG8gdGhlIGhvc3RuYW1lLCBhcyB3ZWxsLiAgVGhpcyBpcyBzdHJhbmdlLlxuICAvLyByZXN1bHQucHJvdG9jb2wgaGFzIGFscmVhZHkgYmVlbiBzZXQgYnkgbm93LlxuICAvLyBMYXRlciBvbiwgcHV0IHRoZSBmaXJzdCBwYXRoIHBhcnQgaW50byB0aGUgaG9zdCBmaWVsZC5cbiAgaWYgKHBzeWNob3RpYykge1xuICAgIHJlc3VsdC5ob3N0bmFtZSA9ICcnO1xuICAgIHJlc3VsdC5wb3J0ID0gbnVsbDtcbiAgICBpZiAocmVzdWx0Lmhvc3QpIHtcbiAgICAgIGlmIChzcmNQYXRoWzBdID09PSAnJykgc3JjUGF0aFswXSA9IHJlc3VsdC5ob3N0O1xuICAgICAgZWxzZSBzcmNQYXRoLnVuc2hpZnQocmVzdWx0Lmhvc3QpO1xuICAgIH1cbiAgICByZXN1bHQuaG9zdCA9ICcnO1xuICAgIGlmIChyZWxhdGl2ZS5wcm90b2NvbCkge1xuICAgICAgcmVsYXRpdmUuaG9zdG5hbWUgPSBudWxsO1xuICAgICAgcmVsYXRpdmUucG9ydCA9IG51bGw7XG4gICAgICBpZiAocmVsYXRpdmUuaG9zdCkge1xuICAgICAgICBpZiAocmVsUGF0aFswXSA9PT0gJycpIHJlbFBhdGhbMF0gPSByZWxhdGl2ZS5ob3N0O1xuICAgICAgICBlbHNlIHJlbFBhdGgudW5zaGlmdChyZWxhdGl2ZS5ob3N0KTtcbiAgICAgIH1cbiAgICAgIHJlbGF0aXZlLmhvc3QgPSBudWxsO1xuICAgIH1cbiAgICBtdXN0RW5kQWJzID0gbXVzdEVuZEFicyAmJiAocmVsUGF0aFswXSA9PT0gJycgfHwgc3JjUGF0aFswXSA9PT0gJycpO1xuICB9XG5cbiAgaWYgKGlzUmVsQWJzKSB7XG4gICAgLy8gaXQncyBhYnNvbHV0ZS5cbiAgICByZXN1bHQuaG9zdCA9IChyZWxhdGl2ZS5ob3N0IHx8IHJlbGF0aXZlLmhvc3QgPT09ICcnKSA/XG4gICAgICAgICAgICAgICAgICByZWxhdGl2ZS5ob3N0IDogcmVzdWx0Lmhvc3Q7XG4gICAgcmVzdWx0Lmhvc3RuYW1lID0gKHJlbGF0aXZlLmhvc3RuYW1lIHx8IHJlbGF0aXZlLmhvc3RuYW1lID09PSAnJykgP1xuICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aXZlLmhvc3RuYW1lIDogcmVzdWx0Lmhvc3RuYW1lO1xuICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gICAgc3JjUGF0aCA9IHJlbFBhdGg7XG4gICAgLy8gZmFsbCB0aHJvdWdoIHRvIHRoZSBkb3QtaGFuZGxpbmcgYmVsb3cuXG4gIH0gZWxzZSBpZiAocmVsUGF0aC5sZW5ndGgpIHtcbiAgICAvLyBpdCdzIHJlbGF0aXZlXG4gICAgLy8gdGhyb3cgYXdheSB0aGUgZXhpc3RpbmcgZmlsZSwgYW5kIHRha2UgdGhlIG5ldyBwYXRoIGluc3RlYWQuXG4gICAgaWYgKCFzcmNQYXRoKSBzcmNQYXRoID0gW107XG4gICAgc3JjUGF0aC5wb3AoKTtcbiAgICBzcmNQYXRoID0gc3JjUGF0aC5jb25jYXQocmVsUGF0aCk7XG4gICAgcmVzdWx0LnNlYXJjaCA9IHJlbGF0aXZlLnNlYXJjaDtcbiAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgfSBlbHNlIGlmICghdXRpbC5pc051bGxPclVuZGVmaW5lZChyZWxhdGl2ZS5zZWFyY2gpKSB7XG4gICAgLy8ganVzdCBwdWxsIG91dCB0aGUgc2VhcmNoLlxuICAgIC8vIGxpa2UgaHJlZj0nP2ZvbycuXG4gICAgLy8gUHV0IHRoaXMgYWZ0ZXIgdGhlIG90aGVyIHR3byBjYXNlcyBiZWNhdXNlIGl0IHNpbXBsaWZpZXMgdGhlIGJvb2xlYW5zXG4gICAgaWYgKHBzeWNob3RpYykge1xuICAgICAgcmVzdWx0Lmhvc3RuYW1lID0gcmVzdWx0Lmhvc3QgPSBzcmNQYXRoLnNoaWZ0KCk7XG4gICAgICAvL29jY2F0aW9uYWx5IHRoZSBhdXRoIGNhbiBnZXQgc3R1Y2sgb25seSBpbiBob3N0XG4gICAgICAvL3RoaXMgZXNwZWNpYWxseSBoYXBwZW5zIGluIGNhc2VzIGxpa2VcbiAgICAgIC8vdXJsLnJlc29sdmVPYmplY3QoJ21haWx0bzpsb2NhbDFAZG9tYWluMScsICdsb2NhbDJAZG9tYWluMicpXG4gICAgICB2YXIgYXV0aEluSG9zdCA9IHJlc3VsdC5ob3N0ICYmIHJlc3VsdC5ob3N0LmluZGV4T2YoJ0AnKSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuaG9zdC5zcGxpdCgnQCcpIDogZmFsc2U7XG4gICAgICBpZiAoYXV0aEluSG9zdCkge1xuICAgICAgICByZXN1bHQuYXV0aCA9IGF1dGhJbkhvc3Quc2hpZnQoKTtcbiAgICAgICAgcmVzdWx0Lmhvc3QgPSByZXN1bHQuaG9zdG5hbWUgPSBhdXRoSW5Ib3N0LnNoaWZ0KCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gICAgLy90byBzdXBwb3J0IGh0dHAucmVxdWVzdFxuICAgIGlmICghdXRpbC5pc051bGwocmVzdWx0LnBhdGhuYW1lKSB8fCAhdXRpbC5pc051bGwocmVzdWx0LnNlYXJjaCkpIHtcbiAgICAgIHJlc3VsdC5wYXRoID0gKHJlc3VsdC5wYXRobmFtZSA/IHJlc3VsdC5wYXRobmFtZSA6ICcnKSArXG4gICAgICAgICAgICAgICAgICAgIChyZXN1bHQuc2VhcmNoID8gcmVzdWx0LnNlYXJjaCA6ICcnKTtcbiAgICB9XG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGlmICghc3JjUGF0aC5sZW5ndGgpIHtcbiAgICAvLyBubyBwYXRoIGF0IGFsbC4gIGVhc3kuXG4gICAgLy8gd2UndmUgYWxyZWFkeSBoYW5kbGVkIHRoZSBvdGhlciBzdHVmZiBhYm92ZS5cbiAgICByZXN1bHQucGF0aG5hbWUgPSBudWxsO1xuICAgIC8vdG8gc3VwcG9ydCBodHRwLnJlcXVlc3RcbiAgICBpZiAocmVzdWx0LnNlYXJjaCkge1xuICAgICAgcmVzdWx0LnBhdGggPSAnLycgKyByZXN1bHQuc2VhcmNoO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQucGF0aCA9IG51bGw7XG4gICAgfVxuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBpZiBhIHVybCBFTkRzIGluIC4gb3IgLi4sIHRoZW4gaXQgbXVzdCBnZXQgYSB0cmFpbGluZyBzbGFzaC5cbiAgLy8gaG93ZXZlciwgaWYgaXQgZW5kcyBpbiBhbnl0aGluZyBlbHNlIG5vbi1zbGFzaHksXG4gIC8vIHRoZW4gaXQgbXVzdCBOT1QgZ2V0IGEgdHJhaWxpbmcgc2xhc2guXG4gIHZhciBsYXN0ID0gc3JjUGF0aC5zbGljZSgtMSlbMF07XG4gIHZhciBoYXNUcmFpbGluZ1NsYXNoID0gKFxuICAgICAgKHJlc3VsdC5ob3N0IHx8IHJlbGF0aXZlLmhvc3QgfHwgc3JjUGF0aC5sZW5ndGggPiAxKSAmJlxuICAgICAgKGxhc3QgPT09ICcuJyB8fCBsYXN0ID09PSAnLi4nKSB8fCBsYXN0ID09PSAnJyk7XG5cbiAgLy8gc3RyaXAgc2luZ2xlIGRvdHMsIHJlc29sdmUgZG91YmxlIGRvdHMgdG8gcGFyZW50IGRpclxuICAvLyBpZiB0aGUgcGF0aCB0cmllcyB0byBnbyBhYm92ZSB0aGUgcm9vdCwgYHVwYCBlbmRzIHVwID4gMFxuICB2YXIgdXAgPSAwO1xuICBmb3IgKHZhciBpID0gc3JjUGF0aC5sZW5ndGg7IGkgPj0gMDsgaS0tKSB7XG4gICAgbGFzdCA9IHNyY1BhdGhbaV07XG4gICAgaWYgKGxhc3QgPT09ICcuJykge1xuICAgICAgc3JjUGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgfSBlbHNlIGlmIChsYXN0ID09PSAnLi4nKSB7XG4gICAgICBzcmNQYXRoLnNwbGljZShpLCAxKTtcbiAgICAgIHVwKys7XG4gICAgfSBlbHNlIGlmICh1cCkge1xuICAgICAgc3JjUGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBwYXRoIGlzIGFsbG93ZWQgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIHJlc3RvcmUgbGVhZGluZyAuLnNcbiAgaWYgKCFtdXN0RW5kQWJzICYmICFyZW1vdmVBbGxEb3RzKSB7XG4gICAgZm9yICg7IHVwLS07IHVwKSB7XG4gICAgICBzcmNQYXRoLnVuc2hpZnQoJy4uJyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG11c3RFbmRBYnMgJiYgc3JjUGF0aFswXSAhPT0gJycgJiZcbiAgICAgICghc3JjUGF0aFswXSB8fCBzcmNQYXRoWzBdLmNoYXJBdCgwKSAhPT0gJy8nKSkge1xuICAgIHNyY1BhdGgudW5zaGlmdCgnJyk7XG4gIH1cblxuICBpZiAoaGFzVHJhaWxpbmdTbGFzaCAmJiAoc3JjUGF0aC5qb2luKCcvJykuc3Vic3RyKC0xKSAhPT0gJy8nKSkge1xuICAgIHNyY1BhdGgucHVzaCgnJyk7XG4gIH1cblxuICB2YXIgaXNBYnNvbHV0ZSA9IHNyY1BhdGhbMF0gPT09ICcnIHx8XG4gICAgICAoc3JjUGF0aFswXSAmJiBzcmNQYXRoWzBdLmNoYXJBdCgwKSA9PT0gJy8nKTtcblxuICAvLyBwdXQgdGhlIGhvc3QgYmFja1xuICBpZiAocHN5Y2hvdGljKSB7XG4gICAgcmVzdWx0Lmhvc3RuYW1lID0gcmVzdWx0Lmhvc3QgPSBpc0Fic29sdXRlID8gJycgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjUGF0aC5sZW5ndGggPyBzcmNQYXRoLnNoaWZ0KCkgOiAnJztcbiAgICAvL29jY2F0aW9uYWx5IHRoZSBhdXRoIGNhbiBnZXQgc3R1Y2sgb25seSBpbiBob3N0XG4gICAgLy90aGlzIGVzcGVjaWFsbHkgaGFwcGVucyBpbiBjYXNlcyBsaWtlXG4gICAgLy91cmwucmVzb2x2ZU9iamVjdCgnbWFpbHRvOmxvY2FsMUBkb21haW4xJywgJ2xvY2FsMkBkb21haW4yJylcbiAgICB2YXIgYXV0aEluSG9zdCA9IHJlc3VsdC5ob3N0ICYmIHJlc3VsdC5ob3N0LmluZGV4T2YoJ0AnKSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAgcmVzdWx0Lmhvc3Quc3BsaXQoJ0AnKSA6IGZhbHNlO1xuICAgIGlmIChhdXRoSW5Ib3N0KSB7XG4gICAgICByZXN1bHQuYXV0aCA9IGF1dGhJbkhvc3Quc2hpZnQoKTtcbiAgICAgIHJlc3VsdC5ob3N0ID0gcmVzdWx0Lmhvc3RuYW1lID0gYXV0aEluSG9zdC5zaGlmdCgpO1xuICAgIH1cbiAgfVxuXG4gIG11c3RFbmRBYnMgPSBtdXN0RW5kQWJzIHx8IChyZXN1bHQuaG9zdCAmJiBzcmNQYXRoLmxlbmd0aCk7XG5cbiAgaWYgKG11c3RFbmRBYnMgJiYgIWlzQWJzb2x1dGUpIHtcbiAgICBzcmNQYXRoLnVuc2hpZnQoJycpO1xuICB9XG5cbiAgaWYgKCFzcmNQYXRoLmxlbmd0aCkge1xuICAgIHJlc3VsdC5wYXRobmFtZSA9IG51bGw7XG4gICAgcmVzdWx0LnBhdGggPSBudWxsO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdC5wYXRobmFtZSA9IHNyY1BhdGguam9pbignLycpO1xuICB9XG5cbiAgLy90byBzdXBwb3J0IHJlcXVlc3QuaHR0cFxuICBpZiAoIXV0aWwuaXNOdWxsKHJlc3VsdC5wYXRobmFtZSkgfHwgIXV0aWwuaXNOdWxsKHJlc3VsdC5zZWFyY2gpKSB7XG4gICAgcmVzdWx0LnBhdGggPSAocmVzdWx0LnBhdGhuYW1lID8gcmVzdWx0LnBhdGhuYW1lIDogJycpICtcbiAgICAgICAgICAgICAgICAgIChyZXN1bHQuc2VhcmNoID8gcmVzdWx0LnNlYXJjaCA6ICcnKTtcbiAgfVxuICByZXN1bHQuYXV0aCA9IHJlbGF0aXZlLmF1dGggfHwgcmVzdWx0LmF1dGg7XG4gIHJlc3VsdC5zbGFzaGVzID0gcmVzdWx0LnNsYXNoZXMgfHwgcmVsYXRpdmUuc2xhc2hlcztcbiAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5VcmwucHJvdG90eXBlLnBhcnNlSG9zdCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaG9zdCA9IHRoaXMuaG9zdDtcbiAgdmFyIHBvcnQgPSBwb3J0UGF0dGVybi5leGVjKGhvc3QpO1xuICBpZiAocG9ydCkge1xuICAgIHBvcnQgPSBwb3J0WzBdO1xuICAgIGlmIChwb3J0ICE9PSAnOicpIHtcbiAgICAgIHRoaXMucG9ydCA9IHBvcnQuc3Vic3RyKDEpO1xuICAgIH1cbiAgICBob3N0ID0gaG9zdC5zdWJzdHIoMCwgaG9zdC5sZW5ndGggLSBwb3J0Lmxlbmd0aCk7XG4gIH1cbiAgaWYgKGhvc3QpIHRoaXMuaG9zdG5hbWUgPSBob3N0O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGlzU3RyaW5nOiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gdHlwZW9mKGFyZykgPT09ICdzdHJpbmcnO1xuICB9LFxuICBpc09iamVjdDogZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIHR5cGVvZihhcmcpID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG4gIH0sXG4gIGlzTnVsbDogZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbiAgfSxcbiAgaXNOdWxsT3JVbmRlZmluZWQ6IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiBhcmcgPT0gbnVsbDtcbiAgfVxufTtcbiIsIlxuLyoqXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRlcHJlY2F0ZTtcblxuLyoqXG4gKiBNYXJrIHRoYXQgYSBtZXRob2Qgc2hvdWxkIG5vdCBiZSB1c2VkLlxuICogUmV0dXJucyBhIG1vZGlmaWVkIGZ1bmN0aW9uIHdoaWNoIHdhcm5zIG9uY2UgYnkgZGVmYXVsdC5cbiAqXG4gKiBJZiBgbG9jYWxTdG9yYWdlLm5vRGVwcmVjYXRpb24gPSB0cnVlYCBpcyBzZXQsIHRoZW4gaXQgaXMgYSBuby1vcC5cbiAqXG4gKiBJZiBgbG9jYWxTdG9yYWdlLnRocm93RGVwcmVjYXRpb24gPSB0cnVlYCBpcyBzZXQsIHRoZW4gZGVwcmVjYXRlZCBmdW5jdGlvbnNcbiAqIHdpbGwgdGhyb3cgYW4gRXJyb3Igd2hlbiBpbnZva2VkLlxuICpcbiAqIElmIGBsb2NhbFN0b3JhZ2UudHJhY2VEZXByZWNhdGlvbiA9IHRydWVgIGlzIHNldCwgdGhlbiBkZXByZWNhdGVkIGZ1bmN0aW9uc1xuICogd2lsbCBpbnZva2UgYGNvbnNvbGUudHJhY2UoKWAgaW5zdGVhZCBvZiBgY29uc29sZS5lcnJvcigpYC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiAtIHRoZSBmdW5jdGlvbiB0byBkZXByZWNhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBtc2cgLSB0aGUgc3RyaW5nIHRvIHByaW50IHRvIHRoZSBjb25zb2xlIHdoZW4gYGZuYCBpcyBpbnZva2VkXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IGEgbmV3IFwiZGVwcmVjYXRlZFwiIHZlcnNpb24gb2YgYGZuYFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZXByZWNhdGUgKGZuLCBtc2cpIHtcbiAgaWYgKGNvbmZpZygnbm9EZXByZWNhdGlvbicpKSB7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgdmFyIHdhcm5lZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBkZXByZWNhdGVkKCkge1xuICAgIGlmICghd2FybmVkKSB7XG4gICAgICBpZiAoY29uZmlnKCd0aHJvd0RlcHJlY2F0aW9uJykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKGNvbmZpZygndHJhY2VEZXByZWNhdGlvbicpKSB7XG4gICAgICAgIGNvbnNvbGUudHJhY2UobXNnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2Fybihtc2cpO1xuICAgICAgfVxuICAgICAgd2FybmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gZGVwcmVjYXRlZDtcbn1cblxuLyoqXG4gKiBDaGVja3MgYGxvY2FsU3RvcmFnZWAgZm9yIGJvb2xlYW4gdmFsdWVzIGZvciB0aGUgZ2l2ZW4gYG5hbWVgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvbmZpZyAobmFtZSkge1xuICAvLyBhY2Nlc3NpbmcgZ2xvYmFsLmxvY2FsU3RvcmFnZSBjYW4gdHJpZ2dlciBhIERPTUV4Y2VwdGlvbiBpbiBzYW5kYm94ZWQgaWZyYW1lc1xuICB0cnkge1xuICAgIGlmICghZ2xvYmFsLmxvY2FsU3RvcmFnZSkgcmV0dXJuIGZhbHNlO1xuICB9IGNhdGNoIChfKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZhciB2YWwgPSBnbG9iYWwubG9jYWxTdG9yYWdlW25hbWVdO1xuICBpZiAobnVsbCA9PSB2YWwpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIFN0cmluZyh2YWwpLnRvTG93ZXJDYXNlKCkgPT09ICd0cnVlJztcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICB2YXIgdGFyZ2V0ID0ge31cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV1cblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0XG59XG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwibmFtZVwiOiBcInByaXNtaWMuaW9cIixcbiAgXCJkZXNjcmlwdGlvblwiOiBcIkphdmFTY3JpcHQgZGV2ZWxvcG1lbnQga2l0IGZvciBwcmlzbWljLmlvXCIsXG4gIFwibGljZW5zZVwiOiBcIkFwYWNoZS0yLjBcIixcbiAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vcHJpc21pY2lvL2phdmFzY3JpcHQta2l0XCIsXG4gIFwia2V5d29yZHNcIjogW1xuICAgIFwicHJpc21pY1wiLFxuICAgIFwicHJpc21pYy5pb1wiLFxuICAgIFwiY21zXCIsXG4gICAgXCJjb250ZW50XCIsXG4gICAgXCJhcGlcIlxuICBdLFxuICBcInZlcnNpb25cIjogXCIyLjAuMFwiLFxuICBcImRldkRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJiYWJlbC1wcmVzZXQtZXMyMDE1XCI6IFwiXjYuMy4xM1wiLFxuICAgIFwiYmFiZWxpZnlcIjogXCJeNy4yLjBcIixcbiAgICBcImJyb3dzZXJpZnlcIjogXCJeMTIuMC4xXCIsXG4gICAgXCJjaGFpXCI6IFwiKlwiLFxuICAgIFwiY29kZWNsaW1hdGUtdGVzdC1yZXBvcnRlclwiOiBcIn4wLjAuNFwiLFxuICAgIFwiZXM2LXByb21pc2VcIjogXCJeMy4wLjJcIixcbiAgICBcImVzbGludFwiOiBcIl4xLjEwLjNcIixcbiAgICBcImdoLXBhZ2VzXCI6IFwiXjAuOC4wXCIsXG4gICAgXCJndWxwXCI6IFwifjMuOS4wXCIsXG4gICAgXCJndWxwLXNvdXJjZW1hcHNcIjogXCJeMS42LjBcIixcbiAgICBcImd1bHAtdWdsaWZ5XCI6IFwifjEuMi4wXCIsXG4gICAgXCJqc2RvY1wiOiBcIl4zLjQuMFwiLFxuICAgIFwibW9jaGFcIjogXCIqXCIsXG4gICAgXCJ2aW55bC1idWZmZXJcIjogXCJeMS4wLjBcIixcbiAgICBcInZpbnlsLXNvdXJjZS1zdHJlYW1cIjogXCJeMS4xLjBcIlxuICB9LFxuICBcInJlcG9zaXRvcnlcIjoge1xuICAgIFwidHlwZVwiOiBcImdpdFwiLFxuICAgIFwidXJsXCI6IFwiaHR0cDovL2dpdGh1Yi5jb20vcHJpc21pY2lvL2phdmFzY3JpcHQta2l0LmdpdFwiXG4gIH0sXG4gIFwibWFpblwiOiBcImxpYi9hcGkuanNcIixcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcInByZXB1Ymxpc2hcIjogXCJndWxwXCIsXG4gICAgXCJsaW50XCI6IFwiZXNsaW50IGxpYlwiLFxuICAgIFwidGVzdFwiOiBcIm1vY2hhXCIsXG4gICAgXCJwb3N0dGVzdFwiOiBcImVzbGludCBsaWJcIixcbiAgICBcImJ1aWxkZG9jXCI6IFwianNkb2MgZGlzdC9wcmlzbWljLmlvLmpzIFJFQURNRS5tZFwiLFxuICAgIFwicHVzaGRvY1wiOiBcIlwiLFxuICAgIFwicHJlcHVzaGRvY1wiOiBcIm5wbSBydW4gYnVpbGRkb2NcIlxuICB9XG59XG4iXX0=
