(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _api = require('./lib/api.js');

var _api2 = _interopRequireDefault(_api);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

window.Prismic = _api2.default;

},{"./lib/api.js":2}],2:[function(require,module,exports){
(function (global){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _experiments = require('./experiments');

var _experiments2 = _interopRequireDefault(_experiments);

var _predicates = require('./predicates');

var _predicates2 = _interopRequireDefault(_predicates);

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

var _fragments = require('./fragments');

var _fragments2 = _interopRequireDefault(_fragments);

var _cache = require('./cache.js');

var _cache2 = _interopRequireDefault(_cache);

var _documents = require('./documents');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

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
var prismic = function prismic(url, callback, maybeAccessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL) {
    var api = new prismic.fn.init(url, maybeAccessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL);
    //Use cached api data if available
    api.get(function (err, data) {
        if (callback && err) {
            return callback(err);
        }

        if (data) {
            api.data = data;
            api.bookmarks = data.bookmarks;
            api.experiments = new _experiments2.default(data.experiments);
        }

        if (callback) {
            return callback(null, api);
        }
    });

    return api;
};
// note that the prismic variable is later affected as "Api" while exporting

// Defining Api's instance methods; note that the prismic variable is later affected as "Api" while exporting
prismic.fn = prismic.prototype = {

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

    constructor: prismic,
    data: null,

    /**
     * Fetches data used to construct the api client, from cache if it's
     * present, otherwise from calling the prismic api endpoint (which is
     * then cached).
     *
     * @param {function} callback - Callback to receive the data
     */
    get: function get(callback) {
        var self = this;
        var cacheKey = this.apiCacheKey;

        this.apiCache.get(cacheKey, function (err, value) {
            if (err) {
                return callback(err);
            }
            if (value) {
                return callback(null, value);
            }

            self.requestHandler(self.url, function (err, data, xhr, ttl) {
                if (err) {
                    return callback(err, null, xhr);
                }

                var parsed = self.parse(data);
                ttl = ttl || self.apiDataTTL;

                self.apiCache.set(cacheKey, parsed, ttl, function (err) {
                    if (err) {
                        return callback(err, null, xhr);
                    }
                    return callback(null, parsed, xhr);
                });
            });
        });
    },

    /**
     * Cleans api data from the cache and fetches an up to date copy.
     *
     * @param {function} callback - Optional callback function that is called after the data has been refreshed
     */
    refresh: function refresh(callback) {
        var self = this;
        var cacheKey = this.apiCacheKey;

        this.apiCache.remove(cacheKey, function (err) {
            if (callback && err) {
                return callback(err);
            }
            if (!callback && err) {
                throw err;
            }

            self.get(function (err, data, xhr) {
                if (callback && err) {
                    return callback(err);
                }
                if (!callback && err) {
                    throw err;
                }

                self.data = data;
                self.bookmarks = data.bookmarks;
                self.experiments = new _experiments2.default(data.experiments);

                if (callback) {
                    return callback();
                }
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
     * Initialisation of the API object.
     * This is for internal use, from outside this kit, you should call Prismic.Api()
     * @private
     */
    init: function init(url, accessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL) {
        this.url = url + (accessToken ? (url.indexOf('?') > -1 ? '&' : '?') + 'access_token=' + accessToken : '');
        this.accessToken = accessToken;
        this.apiCache = maybeApiCache || globalCache();
        this.requestHandler = maybeRequestHandler || _utils2.default.request();
        this.apiCacheKey = this.url + (this.accessToken ? '#' + this.accessToken : '');
        this.apiDataTTL = maybeApiDataTTL || 5;
        return this;
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
    },

    /**
     * The current experiment, or null
     * @returns {Experiment}
     */
    currentExperiment: function currentExperiment() {
        return this.experiments.current();
    },

    /**
     * Parse json as a document
     *
     * @returns {Document}
     */
    parseDoc: function parseDoc(json) {
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

        return new Global.Prismic.Document(json.id, json.uid || null, json.type, json.href, json.tags, slugs, fragments);
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
        var Predicates = Global.Prismic.Predicates;
        return this.query(Predicates.at('document.id', id), options, function (err, response) {
            if (response && response.results.length > 0) {
                callback(err, response.results[0]);
            } else {
                callback(err, null);
            }
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
        var Predicates = Global.Prismic.Predicates;
        return this.query(Predicates.at('my.' + type + '.uid', uid), options, function (err, response) {
            if (response && response.results.length > 0) {
                callback(err, response.results[0]);
            } else {
                callback(err, null);
            }
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
     * @param {function} callback to get the resulting URL
     */
    previewSession: function previewSession(token, linkResolver, defaultUrl, callback) {
        var api = this;
        var Predicates = Global.Prismic.Predicates;
        this.requestHandler(token, function (err, result, xhr) {
            if (err) {
                console.log("Error from the request");
                callback(err, defaultUrl, xhr);
                return;
            }
            try {
                var mainDocumentId = result.mainDocument;
                if (!mainDocumentId) {
                    callback(null, defaultUrl, xhr);
                } else {
                    api.form("everything").query(Predicates.at("document.id", mainDocumentId)).ref(token).submit(function (err, response) {
                        if (err) {
                            callback(err);
                        }
                        try {
                            if (response.results.length === 0) {
                                callback(null, defaultUrl, xhr);
                            } else {
                                callback(null, linkResolver(response.results[0]), xhr);
                            }
                        } catch (e) {
                            callback(e);
                        }
                    });
                }
            } catch (e) {
                console.log("Caught e ", e);
                callback(e, defaultUrl, xhr);
            }
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
            if (err) {
                return callback(err);
            }
            if (value) {
                return callback(null, value);
            }
            api.requestHandler(url, function (err, documents, xhr, ttl) {
                if (err) {
                    callback(err, null, xhr);
                    return;
                }
                var results = documents.results.map(prismic.fn.parseDoc);
                var response = new Response(documents.page, documents.results_per_page, documents.results_size, documents.total_results_size, documents.total_pages, documents.next_page, documents.prev_page, results || []);
                if (ttl) {
                    cache.set(cacheKey, response, ttl, function (err) {
                        if (err) {
                            return callback(err);
                        }
                        return callback(null, response);
                    });
                } else {
                    return callback(null, response);
                }
            });
        });
    }

};

prismic.fn.init.prototype = prismic.fn;

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
                stringQueries.push("[:d = " + predicate[0] + "(" + firstArg + (predicate.length > 2 ? ", " : "") + (function () {
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
                })() + ")]");
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

        this.api.request(url, callback);
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
        g.prismicCache = new Global.Prismic.ApiCache();
    }
    return g.prismicCache;
}

exports.default = {
    experimentCookie: "io.prismic.experiment",
    previewCookie: "io.prismic.preview",
    Api: prismic,
    Experiments: _experiments2.default,
    Predicates: _predicates2.default,
    Fragments: _fragments2.default,
    ApiCache: _cache2.default
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./cache.js":3,"./documents":4,"./experiments":5,"./fragments":6,"./predicates":7,"./utils":8}],3:[function(require,module,exports){

"use strict";

/**
 * Api cache
 */

Object.defineProperty(exports, "__esModule", {
    value: true
});
function ApiCache(limit) {
    this.lru = new Global.Prismic.LRUCache(limit);
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

exports.default = ApiCache;

},{}],4:[function(require,module,exports){
"use strict";

var _fragments = require("./fragments");

var _fragments2 = _interopRequireDefault(_fragments);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
        var img = this.get(fragment);
        if (img instanceof _fragments2.default.Image) {
            return img;
        }
        if (img instanceof _fragments2.default.StructuredText) {
            // find first image in st.
            return img;
        }
        return null;
    },

    // Useful for obsolete multiples
    getAllImages: function getAllImages(fragment) {
        var images = this.getAll(fragment);

        return images.map(function (image) {
            if (image instanceof _fragments2.default.Image) {
                return image;
            }
            if (image instanceof _fragments2.default.StructuredText) {
                throw new Error("Not done.");
            }
            return null;
        });
    },

    getFirstImage: function getFirstImage() {
        var fragments = this.fragments;

        var firstImage = Object.keys(fragments).reduce(function (image, key) {
            if (image) {
                return image;
            } else {
                var element = fragments[key];
                if (typeof element.getFirstImage === "function") {
                    return element.getFirstImage();
                } else if (element instanceof _fragments2.default.Image) {
                    return element;
                } else return null;
            }
        }, null);
        return firstImage;
    },

    getFirstTitle: function getFirstTitle() {
        var fragments = this.fragments;

        var firstTitle = Object.keys(fragments).reduce(function (st, key) {
            if (st) {
                return st;
            } else {
                var element = fragments[key];
                if (typeof element.getFirstTitle === "function") {
                    return element.getFirstTitle();
                } else if (element instanceof _fragments2.default.StructuredText) {
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
        var fragment = this.get(name);
        if (fragment instanceof _fragments2.default.Image) {
            return fragment.getView(view);
        }
        if (fragment instanceof _fragments2.default.StructuredText) {
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
        var fragment = this.get(name);

        if (fragment instanceof _fragments2.default.Timestamp) {
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
        var fragment = this.get(name);

        if (fragment instanceof _fragments2.default.Date) {
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
        var fragment = this.get(name);

        if (fragment instanceof _fragments2.default.StructuredText) {
            return fragment.blocks.map(function (block) {
                if (block.text) {
                    return block.text + (after ? after : '');
                }
            }).join('\n');
        }

        if (fragment instanceof _fragments2.default.Text) {
            if (fragment.value) {
                return fragment.value + (after ? after : '');
            }
        }

        if (fragment instanceof _fragments2.default.Number) {
            if (fragment.value) {
                return fragment.value + (after ? after : '');
            }
        }

        if (fragment instanceof _fragments2.default.Select) {
            if (fragment.value) {
                return fragment.value + (after ? after : '');
            }
        }

        if (fragment instanceof _fragments2.default.Color) {
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

        if (fragment instanceof _fragments2.default.StructuredText) {
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
        var fragment = this.get(name);

        if (fragment instanceof _fragments2.default.WebLink || fragment instanceof _fragments2.default.DocumentLink || fragment instanceof _fragments2.default.ImageLink) {
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
        var fragment = this.get(name);

        if (fragment instanceof _fragments2.default.Number) {
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
        var fragment = this.get(name);

        if (fragment instanceof _fragments2.default.Color) {
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
        var fragment = this.get(name);

        if (fragment instanceof _fragments2.default.GeoPoint) {
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

        if (fragment instanceof _fragments2.default.Group) {
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
            linkResolver = function (doc, isBroken) {
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
            linkResolver = function (doc, isBroken) {
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
            linkResolver = function (doc, isBroken) {
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
        for (var field in this.data) {
            var fragment = this.get(field);
            if (fragment instanceof _fragments2.default.DocumentLink) {
                result.push(fragment);
            }
            if (fragment instanceof _fragments2.default.StructuredText) {
                for (i = 0; i < fragment.blocks.length; i++) {
                    var block = fragment.blocks[i];
                    if (block.type == "image" && block.linkTo) {
                        link = _fragments2.default.initField(block.linkTo);
                        if (link instanceof DocumentLink) {
                            result.push(link);
                        }
                    }
                    var spans = block.spans || [];
                    for (j = 0; j < spans.length; j++) {
                        var span = spans[j];
                        if (span.type == "hyperlink") {
                            link = _fragments2.default.initField(span.data);
                            if (link instanceof _fragments2.default.DocumentLink) {
                                result.push(link);
                            }
                        }
                    }
                }
            }
            if (fragment instanceof _fragments2.default.Group) {
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
    this.fragments = _fragments2.default.parseFragments(data);
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

    if (fragment instanceof _fragments2.default.SliceZone) {
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
    this.fragments = _fragments2.default.parseFragments(data);
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

Object.defineProperty(exports, "__esModule", {
    value: true
});
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

exports.default = {
    Experiments: Experiments, Variation: Variation
};

},{}],6:[function(require,module,exports){

"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _documents = require("./documents");

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

DocumentLink.prototype = Object.create(_documents.WithFragments.prototype);

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
        this.value.push(new Global.Prismic.GroupDoc(data[i]));
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
            linkResolver = function (doc, isBroken) {
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
        } else if (fragment instanceof Global.Prismic.Fragments.Image) {
            return fragment;
        } else return null;
    },

    getFirstTitle: function getFirstTitle() {
        var fragment = this.value;
        if (typeof fragment.getFirstTitle === "function") {
            return fragment.getFirstTitle();
        } else if (fragment instanceof Global.Prismic.Fragments.StructuredText) {
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

exports.default = {
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

"use strict";

/**
 * @global
 * @namespace
 * @alias Predicates
 */

Object.defineProperty(exports, "__esModule", {
  value: true
});
var predicates = {

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

exports.default = predicates;

},{}],8:[function(require,module,exports){
(function (process){

"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
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
            querystring = require('querystring'),
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

            var request = h.get(options, function (response) {
                if (response.statusCode && response.statusCode == 200) {
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

// Number of requests currently running (capped by MAX_CONNECTIONS)
var running = 0;
// Requests in queue
var queue = [];

var processQueue = function processQueue() {
    if (queue.length === 0 || running >= Global.Prismic.Utils.MAX_CONNECTIONS) {
        return;
    }
    running++;
    var next = queue.shift();
    var fn = ajaxRequest() || xdomainRequest() || nodeJSRequest() || (function () {
        throw new Error("No request handler available (tried XMLHttpRequest & NodeJS)");
    })();
    fn.call(this, next.url, function (error, result, xhr, ttl) {
        running--;
        next.callback(error, result, xhr, ttl);
        processQueue();
    });
};

var request = function request() {
    return function (url, callback) {
        queue.push({
            'url': url,
            'callback': callback
        });
        processQueue();
    };
};

exports.default = {
    MAX_CONNECTIONS: 20, // Number of maximum simultaneous connections to the prismic server
    request: request
};

}).call(this,require('_process'))

},{"../package.json":47,"_process":22,"http":38,"https":16,"querystring":26,"url":43}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){

},{}],11:[function(require,module,exports){
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

},{"base64-js":9,"ieee754":17,"isarray":12}],12:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],13:[function(require,module,exports){
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

},{}],14:[function(require,module,exports){
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

},{"../../is-buffer/index.js":19}],15:[function(require,module,exports){
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

},{}],16:[function(require,module,exports){
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

},{"http":38}],17:[function(require,module,exports){
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

},{}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],21:[function(require,module,exports){
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

},{"_process":22}],22:[function(require,module,exports){
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

},{}],23:[function(require,module,exports){
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

},{}],24:[function(require,module,exports){
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

},{}],25:[function(require,module,exports){
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

},{}],26:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":24,"./encode":25}],27:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":28}],28:[function(require,module,exports){
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

},{"./_stream_readable":30,"./_stream_writable":32,"core-util-is":14,"inherits":18,"process-nextick-args":21}],29:[function(require,module,exports){
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

},{"./_stream_transform":31,"core-util-is":14,"inherits":18}],30:[function(require,module,exports){
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

},{"./_stream_duplex":28,"_process":22,"buffer":11,"core-util-is":14,"events":15,"inherits":18,"isarray":20,"process-nextick-args":21,"string_decoder/":42,"util":10}],31:[function(require,module,exports){
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

},{"./_stream_duplex":28,"core-util-is":14,"inherits":18}],32:[function(require,module,exports){
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

},{"./_stream_duplex":28,"buffer":11,"core-util-is":14,"events":15,"inherits":18,"process-nextick-args":21,"util-deprecate":45}],33:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":29}],34:[function(require,module,exports){
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

},{"./lib/_stream_duplex.js":28,"./lib/_stream_passthrough.js":29,"./lib/_stream_readable.js":30,"./lib/_stream_transform.js":31,"./lib/_stream_writable.js":32}],35:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":31}],36:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":32}],37:[function(require,module,exports){
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

},{"events":15,"inherits":18,"readable-stream/duplex.js":27,"readable-stream/passthrough.js":33,"readable-stream/readable.js":34,"readable-stream/transform.js":35,"readable-stream/writable.js":36}],38:[function(require,module,exports){
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

	var protocol = opts.protocol || ''
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
},{"./lib/request":40,"builtin-status-codes":13,"url":43,"xtend":46}],39:[function(require,module,exports){
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

},{}],40:[function(require,module,exports){
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
 * Checks if xhr.status is readable. Even though the spec says it should
 * be available in readyState 3, accessing it throws an exception in IE8
 */
function statusValid (xhr) {
	try {
		return (xhr.status !== null)
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

},{"./capability":39,"./response":41,"_process":22,"buffer":11,"inherits":18,"stream":37}],41:[function(require,module,exports){
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

},{"./capability":39,"_process":22,"buffer":11,"inherits":18,"stream":37}],42:[function(require,module,exports){
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

},{"buffer":11}],43:[function(require,module,exports){
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

},{"./util":44,"punycode":23,"querystring":26}],44:[function(require,module,exports){
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

},{}],45:[function(require,module,exports){
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

},{}],46:[function(require,module,exports){
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

},{}],47:[function(require,module,exports){
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
    "gulp": "~3.9.0",
    "gulp-gh-pages": "~0.5.0",
    "gulp-gist": "~1.0.3",
    "gulp-jsdoc": "~0.1.4",
    "gulp-jshint": "~1.11.2",
    "gulp-mocha-phantomjs": "git://github.com/erwan/gulp-mocha-phantomjs.git#phantomjs198",
    "gulp-sourcemaps": "^1.6.0",
    "gulp-uglify": "~1.2.0",
    "gulp-util": "~3.0.6",
    "mocha": "*",
    "source-map-support": "^0.4.0",
    "vinyl-buffer": "^1.0.0",
    "vinyl-source-stream": "^1.1.0"
  },
  "repository": {
    "type": "git",
    "url": "http://github.com/prismicio/javascript-kit.git"
  },
  "main": "lib/index.js",
  "scripts": {
    "test": "gulp test"
  }
}

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxpYi9hcGkuanMiLCJsaWIvY2FjaGUuanMiLCJsaWIvZG9jdW1lbnRzLmpzIiwibGliL2V4cGVyaW1lbnRzLmpzIiwibGliL2ZyYWdtZW50cy5qcyIsImxpYi9wcmVkaWNhdGVzLmpzIiwibGliL3V0aWxzLmpzIiwibm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2J1aWx0aW4tc3RhdHVzLWNvZGVzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvY29yZS11dGlsLWlzL2xpYi91dGlsLmpzIiwibm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCJub2RlX21vZHVsZXMvaHR0cHMtYnJvd3NlcmlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2luaGVyaXRzL2luaGVyaXRzX2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvaXMtYnVmZmVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2lzYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy1uZXh0aWNrLWFyZ3MvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3B1bnljb2RlL3B1bnljb2RlLmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9kZWNvZGUuanMiLCJub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2VuY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2R1cGxleC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fZHVwbGV4LmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9wYXNzdGhyb3VnaC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fcmVhZGFibGUuanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2xpYi9fc3RyZWFtX3RyYW5zZm9ybS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fd3JpdGFibGUuanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL3Bhc3N0aHJvdWdoLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9yZWFkYWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vdHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS93cml0YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9zdHJlYW0tYnJvd3NlcmlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zdHJlYW0taHR0cC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zdHJlYW0taHR0cC9saWIvY2FwYWJpbGl0eS5qcyIsIm5vZGVfbW9kdWxlcy9zdHJlYW0taHR0cC9saWIvcmVxdWVzdC5qcyIsIm5vZGVfbW9kdWxlcy9zdHJlYW0taHR0cC9saWIvcmVzcG9uc2UuanMiLCJub2RlX21vZHVsZXMvc3RyaW5nX2RlY29kZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdXJsL3VybC5qcyIsIm5vZGVfbW9kdWxlcy91cmwvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy91dGlsLWRlcHJlY2F0ZS9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3h0ZW5kL2ltbXV0YWJsZS5qcyIsInBhY2thZ2UuanNvbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdz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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1Z0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7OztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDcmhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMvOEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqaEJBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTs7QUNEQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDblJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1dEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImltcG9ydCBQcmlzbWljIGZyb20gJy4vbGliL2FwaS5qcyc7XG5cblxud2luZG93LlByaXNtaWMgPSBQcmlzbWljO1xuXG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IEV4cGVyaW1lbnRzIGZyb20gJy4vZXhwZXJpbWVudHMnO1xuaW1wb3J0IFByZWRpY2F0ZXMgZnJvbSAnLi9wcmVkaWNhdGVzJztcbmltcG9ydCBVdGlscyBmcm9tICcuL3V0aWxzJztcbmltcG9ydCBGcmFnbWVudHMgZnJvbSAnLi9mcmFnbWVudHMnO1xuaW1wb3J0IEFwaUNhY2hlIGZyb20gJy4vY2FjaGUuanMnO1xuaW1wb3J0IHsgRG9jdW1lbnQsIEdyb3VwRG9jIH0gZnJvbSAnLi9kb2N1bWVudHMnO1xuXG4vKipcbiAqIFRoZSBraXQncyBtYWluIGVudHJ5IHBvaW50OyBpbml0aWFsaXplIHlvdXIgQVBJIGxpa2UgdGhpczogUHJpc21pYy5BcGkodXJsLCBjYWxsYmFjaywgYWNjZXNzVG9rZW4sIG1heWJlUmVxdWVzdEhhbmRsZXIpXG4gKlxuICogQGdsb2JhbFxuICogQGFsaWFzIEFwaVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIG1hbmRhdG9yeSBVUkwgb2YgdGhlIHByaXNtaWMuaW8gQVBJIGVuZHBvaW50IChsaWtlOiBodHRwczovL2xlc2Jvbm5lc2Nob3Nlcy5wcmlzbWljLmlvL2FwaSlcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdGhlIEFQSSB3YXMgcmV0cmlldmVkLCB3aGljaCB3aWxsIGJlIGNhbGxlZCB3aXRoIHR3byBwYXJhbWV0ZXJzOiBhIHBvdGVudGlhbCBlcnJvciBvYmplY3QgYW5kIHRoZSBBUEkgb2JqZWN0XG4gKiBAcGFyYW0ge3N0cmluZ30gbWF5YmVBY2Nlc3NUb2tlbiAtIFRoZSBhY2Nlc3NUb2tlbiBmb3IgYW4gT0F1dGgyIGNvbm5lY3Rpb25cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IG1heWJlUmVxdWVzdEhhbmRsZXIgLSBFbnZpcm9ubWVudCBzcGVjaWZpYyBIVFRQIHJlcXVlc3QgaGFuZGxpbmcgZnVuY3Rpb25cbiAqIEBwYXJhbSB7b2JqZWN0fSBtYXliZUFwaUNhY2hlIC0gQSBjYWNoZSBvYmplY3Qgd2l0aCBnZXQvc2V0IGZ1bmN0aW9ucyBmb3IgY2FjaGluZyBBUEkgcmVzcG9uc2VzXG4gKiBAcGFyYW0ge2ludH0gbWF5YmVBcGlEYXRhVFRMIC0gSG93IGxvbmcgKGluIHNlY29uZHMpIHRvIGNhY2hlIGRhdGEgdXNlZCBieSB0aGUgY2xpZW50IHRvIG1ha2UgY2FsbHMgKGUuZy4gcmVmcykuIERlZmF1bHRzIHRvIDUgc2Vjb25kc1xuICogQHJldHVybnMge0FwaX0gLSBUaGUgQXBpIG9iamVjdCB0aGF0IGNhbiBiZSBtYW5pcHVsYXRlZFxuICovXG52YXIgcHJpc21pYyA9IGZ1bmN0aW9uKHVybCwgY2FsbGJhY2ssIG1heWJlQWNjZXNzVG9rZW4sIG1heWJlUmVxdWVzdEhhbmRsZXIsIG1heWJlQXBpQ2FjaGUsIG1heWJlQXBpRGF0YVRUTCkge1xuICB2YXIgYXBpID0gbmV3IHByaXNtaWMuZm4uaW5pdCh1cmwsIG1heWJlQWNjZXNzVG9rZW4sIG1heWJlUmVxdWVzdEhhbmRsZXIsIG1heWJlQXBpQ2FjaGUsIG1heWJlQXBpRGF0YVRUTCk7XG4gIC8vVXNlIGNhY2hlZCBhcGkgZGF0YSBpZiBhdmFpbGFibGVcbiAgYXBpLmdldChmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgaWYgKGNhbGxiYWNrICYmIGVycikgeyByZXR1cm4gY2FsbGJhY2soZXJyKTsgfVxuXG4gICAgaWYgKGRhdGEpIHtcbiAgICAgIGFwaS5kYXRhID0gZGF0YTtcbiAgICAgIGFwaS5ib29rbWFya3MgPSBkYXRhLmJvb2ttYXJrcztcbiAgICAgIGFwaS5leHBlcmltZW50cyA9IG5ldyBFeHBlcmltZW50cyhkYXRhLmV4cGVyaW1lbnRzKTtcbiAgICB9XG5cbiAgICBpZiAoY2FsbGJhY2spIHsgcmV0dXJuIGNhbGxiYWNrKG51bGwsIGFwaSk7IH1cbiAgfSk7XG5cbiAgcmV0dXJuIGFwaTtcbn07XG4vLyBub3RlIHRoYXQgdGhlIHByaXNtaWMgdmFyaWFibGUgaXMgbGF0ZXIgYWZmZWN0ZWQgYXMgXCJBcGlcIiB3aGlsZSBleHBvcnRpbmdcblxuLy8gRGVmaW5pbmcgQXBpJ3MgaW5zdGFuY2UgbWV0aG9kczsgbm90ZSB0aGF0IHRoZSBwcmlzbWljIHZhcmlhYmxlIGlzIGxhdGVyIGFmZmVjdGVkIGFzIFwiQXBpXCIgd2hpbGUgZXhwb3J0aW5nXG5wcmlzbWljLmZuID0gcHJpc21pYy5wcm90b3R5cGUgPSB7XG5cbiAgLy8gUHJlZGljYXRlc1xuICBBVDogXCJhdFwiLFxuICBBTlk6IFwiYW55XCIsXG4gIFNJTUlMQVI6IFwic2ltaWxhclwiLFxuICBGVUxMVEVYVDogXCJmdWxsdGV4dFwiLFxuICBOVU1CRVI6IHtcbiAgICBHVDogXCJudW1iZXIuZ3RcIixcbiAgICBMVDogXCJudW1iZXIubHRcIlxuICB9LFxuICBEQVRFOiB7XG4gICAgLy8gT3RoZXIgZGF0ZSBvcGVyYXRvcnMgYXJlIGF2YWlsYWJsZTogc2VlIHRoZSBkb2N1bWVudGF0aW9uLlxuICAgIEFGVEVSOiBcImRhdGUuYWZ0ZXJcIixcbiAgICBCRUZPUkU6IFwiZGF0ZS5iZWZvcmVcIixcbiAgICBCRVRXRUVOOiBcImRhdGUuYmV0d2VlblwiXG4gIH0sXG5cbiAgLy8gRnJhZ21lbnQ6IHVzYWJsZSBhcyB0aGUgc2Vjb25kIGVsZW1lbnQgb2YgYSBxdWVyeSBhcnJheSBvbiBtb3N0IHByZWRpY2F0ZXMgKGV4Y2VwdCBTSU1JTEFSKS5cbiAgLy8gWW91IGNhbiBhbHNvIHVzZSBcIm15LipcIiBmb3IgeW91ciBjdXN0b20gZmllbGRzLlxuICBET0NVTUVOVDoge1xuICAgIElEOiBcImRvY3VtZW50LmlkXCIsXG4gICAgVFlQRTogXCJkb2N1bWVudC50eXBlXCIsXG4gICAgVEFHUzogXCJkb2N1bWVudC50YWdzXCJcbiAgfSxcblxuICBjb25zdHJ1Y3RvcjogcHJpc21pYyxcbiAgZGF0YTogbnVsbCxcblxuICAvKipcbiAgICogRmV0Y2hlcyBkYXRhIHVzZWQgdG8gY29uc3RydWN0IHRoZSBhcGkgY2xpZW50LCBmcm9tIGNhY2hlIGlmIGl0J3NcbiAgICogcHJlc2VudCwgb3RoZXJ3aXNlIGZyb20gY2FsbGluZyB0aGUgcHJpc21pYyBhcGkgZW5kcG9pbnQgKHdoaWNoIGlzXG4gICAqIHRoZW4gY2FjaGVkKS5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayB0byByZWNlaXZlIHRoZSBkYXRhXG4gICAqL1xuICBnZXQ6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBjYWNoZUtleSA9IHRoaXMuYXBpQ2FjaGVLZXk7XG5cbiAgICB0aGlzLmFwaUNhY2hlLmdldChjYWNoZUtleSwgZnVuY3Rpb24gKGVyciwgdmFsdWUpIHtcbiAgICAgIGlmIChlcnIpIHsgcmV0dXJuIGNhbGxiYWNrKGVycik7IH1cbiAgICAgIGlmICh2YWx1ZSkgeyByZXR1cm4gY2FsbGJhY2sobnVsbCwgdmFsdWUpOyB9XG5cbiAgICAgIHNlbGYucmVxdWVzdEhhbmRsZXIoc2VsZi51cmwsIGZ1bmN0aW9uKGVyciwgZGF0YSwgeGhyLCB0dGwpIHtcbiAgICAgICAgaWYgKGVycikgeyByZXR1cm4gY2FsbGJhY2soZXJyLCBudWxsLCB4aHIpOyB9XG5cbiAgICAgICAgdmFyIHBhcnNlZCA9IHNlbGYucGFyc2UoZGF0YSk7XG4gICAgICAgIHR0bCA9IHR0bCB8fCBzZWxmLmFwaURhdGFUVEw7XG5cbiAgICAgICAgc2VsZi5hcGlDYWNoZS5zZXQoY2FjaGVLZXksIHBhcnNlZCwgdHRsLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgaWYgKGVycikgeyByZXR1cm4gY2FsbGJhY2soZXJyLCBudWxsLCB4aHIpOyB9XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIHBhcnNlZCwgeGhyKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvKipcbiAgICogQ2xlYW5zIGFwaSBkYXRhIGZyb20gdGhlIGNhY2hlIGFuZCBmZXRjaGVzIGFuIHVwIHRvIGRhdGUgY29weS5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBPcHRpb25hbCBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGUgZGF0YSBoYXMgYmVlbiByZWZyZXNoZWRcbiAgICovXG4gIHJlZnJlc2g6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY2FjaGVLZXkgPSB0aGlzLmFwaUNhY2hlS2V5O1xuIFxuICAgIHRoaXMuYXBpQ2FjaGUucmVtb3ZlKGNhY2hlS2V5LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICBpZiAoY2FsbGJhY2sgJiYgZXJyKSB7IHJldHVybiBjYWxsYmFjayhlcnIpOyB9XG4gICAgICBpZiAoIWNhbGxiYWNrICYmIGVycikgeyB0aHJvdyBlcnI7IH1cblxuc2VsZi5nZXQoZnVuY3Rpb24gKGVyciwgZGF0YSwgeGhyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjayAmJiBlcnIpIHsgcmV0dXJuIGNhbGxiYWNrKGVycik7IH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjYWxsYmFjayAmJiBlcnIpIHsgdGhyb3cgZXJyOyB9XG5cbiAgICAgICAgICAgICAgICAgICAgc2VsZi5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5ib29rbWFya3MgPSBkYXRhLmJvb2ttYXJrcztcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5leHBlcmltZW50cyA9IG5ldyBFeHBlcmltZW50cyhkYXRhLmV4cGVyaW1lbnRzKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHsgcmV0dXJuIGNhbGxiYWNrKCk7IH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBQYXJzZXMgYW5kIHJldHVybnMgdGhlIC9hcGkgZG9jdW1lbnQuXG4gICAgICAgICAqIFRoaXMgaXMgZm9yIGludGVybmFsIHVzZSwgZnJvbSBvdXRzaWRlIHRoaXMga2l0LCB5b3Ugc2hvdWxkIGNhbGwgUHJpc21pYy5BcGkoKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZGF0YSAtIFRoZSBKU09OIGRvY3VtZW50IHJlc3BvbmRlZCBvbiB0aGUgQVBJJ3MgZW5kcG9pbnRcbiAgICAgICAgICogQHJldHVybnMge0FwaX0gLSBUaGUgQXBpIG9iamVjdCB0aGF0IGNhbiBiZSBtYW5pcHVsYXRlZFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgcGFyc2U6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIHZhciByZWZzLFxuICAgICAgICAgICAgICAgIG1hc3RlcixcbiAgICAgICAgICAgICAgICBmb3JtcyA9IHt9LFxuICAgICAgICAgICAgICAgIGZvcm0sXG4gICAgICAgICAgICAgICAgdHlwZXMsXG4gICAgICAgICAgICAgICAgdGFncyxcbiAgICAgICAgICAgICAgICBmLFxuICAgICAgICAgICAgICAgIGk7XG5cbiAgICAgICAgICAgIC8vIFBhcnNlIHRoZSBmb3Jtc1xuICAgICAgICAgICAgZm9yIChpIGluIGRhdGEuZm9ybXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5mb3Jtcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICAgICAgICAgICAgICBmID0gZGF0YS5mb3Jtc1tpXTtcblxuICAgICAgICAgICAgICAgICAgICBpZih0aGlzLmFjY2Vzc1Rva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmLmZpZWxkc1snYWNjZXNzX3Rva2VuJ10gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGYuZmllbGRzWydhY2Nlc3NfdG9rZW4nXVsndHlwZSddID0gJ3N0cmluZyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBmLmZpZWxkc1snYWNjZXNzX3Rva2VuJ11bJ2RlZmF1bHQnXSA9IHRoaXMuYWNjZXNzVG9rZW47XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBmb3JtID0gbmV3IEZvcm0oXG4gICAgICAgICAgICAgICAgICAgICAgICBmLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBmLmZpZWxkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGYuZm9ybV9tZXRob2QsXG4gICAgICAgICAgICAgICAgICAgICAgICBmLnJlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGYuZW5jdHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGYuYWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9ybXNbaV0gPSBmb3JtO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVmcyA9IGRhdGEucmVmcy5tYXAoZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFJlZihcbiAgICAgICAgICAgICAgICAgICAgci5yZWYsXG4gICAgICAgICAgICAgICAgICAgIHIubGFiZWwsXG4gICAgICAgICAgICAgICAgICAgIHIuaXNNYXN0ZXJSZWYsXG4gICAgICAgICAgICAgICAgICAgIHIuc2NoZWR1bGVkQXQsXG4gICAgICAgICAgICAgICAgICAgIHIuaWRcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSkgfHwgW107XG5cbiAgICAgICAgICAgIG1hc3RlciA9IHJlZnMuZmlsdGVyKGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHIuaXNNYXN0ZXIgPT09IHRydWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdHlwZXMgPSBkYXRhLnR5cGVzO1xuXG4gICAgICAgICAgICB0YWdzID0gZGF0YS50YWdzO1xuXG4gICAgICAgICAgICBpZiAobWFzdGVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRocm93IChcIk5vIG1hc3RlciByZWYuXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGJvb2ttYXJrczogZGF0YS5ib29rbWFya3MgfHwge30sXG4gICAgICAgICAgICAgICAgcmVmczogcmVmcyxcbiAgICAgICAgICAgICAgICBmb3JtczogZm9ybXMsXG4gICAgICAgICAgICAgICAgbWFzdGVyOiBtYXN0ZXJbMF0sXG4gICAgICAgICAgICAgICAgdHlwZXM6IHR5cGVzLFxuICAgICAgICAgICAgICAgIHRhZ3M6IHRhZ3MsXG4gICAgICAgICAgICAgICAgZXhwZXJpbWVudHM6IGRhdGEuZXhwZXJpbWVudHMsXG4gICAgICAgICAgICAgICAgb2F1dGhJbml0aWF0ZTogZGF0YVsnb2F1dGhfaW5pdGlhdGUnXSxcbiAgICAgICAgICAgICAgICBvYXV0aFRva2VuOiBkYXRhWydvYXV0aF90b2tlbiddXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEluaXRpYWxpc2F0aW9uIG9mIHRoZSBBUEkgb2JqZWN0LlxuICAgICAgICAgKiBUaGlzIGlzIGZvciBpbnRlcm5hbCB1c2UsIGZyb20gb3V0c2lkZSB0aGlzIGtpdCwgeW91IHNob3VsZCBjYWxsIFByaXNtaWMuQXBpKClcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uKHVybCwgYWNjZXNzVG9rZW4sIG1heWJlUmVxdWVzdEhhbmRsZXIsIG1heWJlQXBpQ2FjaGUsIG1heWJlQXBpRGF0YVRUTCkge1xuICAgICAgICAgICAgdGhpcy51cmwgPSB1cmwgKyAoYWNjZXNzVG9rZW4gPyAodXJsLmluZGV4T2YoJz8nKSA+IC0xID8gJyYnIDogJz8nKSArICdhY2Nlc3NfdG9rZW49JyArIGFjY2Vzc1Rva2VuIDogJycpO1xuICAgICAgICAgICAgdGhpcy5hY2Nlc3NUb2tlbiA9IGFjY2Vzc1Rva2VuO1xuICAgICAgICAgICAgdGhpcy5hcGlDYWNoZSA9IG1heWJlQXBpQ2FjaGUgfHwgZ2xvYmFsQ2FjaGUoKTtcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdEhhbmRsZXIgPSBtYXliZVJlcXVlc3RIYW5kbGVyIHx8IFV0aWxzLnJlcXVlc3QoKTtcbiAgICAgICAgICAgIHRoaXMuYXBpQ2FjaGVLZXkgPSB0aGlzLnVybCArICh0aGlzLmFjY2Vzc1Rva2VuID8gKCcjJyArIHRoaXMuYWNjZXNzVG9rZW4pIDogJycpO1xuICAgICAgICAgICAgdGhpcy5hcGlEYXRhVFRMID0gbWF5YmVBcGlEYXRhVFRMIHx8IDU7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGRlcHJlY2F0ZWQgdXNlIGZvcm0oKSBub3dcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGZvcm1JZCAtIFRoZSBpZCBvZiBhIGZvcm0sIGxpa2UgXCJldmVyeXRoaW5nXCIsIG9yIFwicHJvZHVjdHNcIlxuICAgICAgICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSB0aGUgU2VhcmNoRm9ybSB0aGF0IGNhbiBiZSB1c2VkLlxuICAgICAgICAgKi9cbiAgICAgICAgZm9ybXM6IGZ1bmN0aW9uKGZvcm1JZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybShmb3JtSWQpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIGEgdXNlYWJsZSBmb3JtIGZyb20gaXRzIGlkLCBhcyBkZXNjcmliZWQgaW4gdGhlIFJFU1RmdWwgZGVzY3JpcHRpb24gb2YgdGhlIEFQSS5cbiAgICAgICAgICogRm9yIGluc3RhbmNlOiBhcGkuZm9ybShcImV2ZXJ5dGhpbmdcIikgd29ya3Mgb24gZXZlcnkgcmVwb3NpdG9yeSAoYXMgXCJldmVyeXRoaW5nXCIgZXhpc3RzIGJ5IGRlZmF1bHQpXG4gICAgICAgICAqIFlvdSBjYW4gdGhlbiBjaGFpbiB0aGUgY2FsbHM6IGFwaS5mb3JtKFwiZXZlcnl0aGluZ1wiKS5xdWVyeSgnW1s6ZCA9IGF0KGRvY3VtZW50LmlkLCBcIlVrTDBnTXV2ellVQU5DcGZcIildXScpLnJlZihyZWYpLnN1Ym1pdCgpXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBmb3JtSWQgLSBUaGUgaWQgb2YgYSBmb3JtLCBsaWtlIFwiZXZlcnl0aGluZ1wiLCBvciBcInByb2R1Y3RzXCJcbiAgICAgICAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gdGhlIFNlYXJjaEZvcm0gdGhhdCBjYW4gYmUgdXNlZC5cbiAgICAgICAgICovXG4gICAgICAgIGZvcm06IGZ1bmN0aW9uKGZvcm1JZCkge1xuICAgICAgICAgICAgdmFyIGZvcm0gPSB0aGlzLmRhdGEuZm9ybXNbZm9ybUlkXTtcbiAgICAgICAgICAgIGlmKGZvcm0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFNlYXJjaEZvcm0odGhpcywgZm9ybSwge30pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgSUQgb2YgdGhlIG1hc3RlciByZWYgb24gdGhpcyBwcmlzbWljLmlvIEFQSS5cbiAgICAgICAgICogRG8gbm90IHVzZSBsaWtlIHRoaXM6IHNlYXJjaEZvcm0ucmVmKGFwaS5tYXN0ZXIoKSkuXG4gICAgICAgICAqIEluc3RlYWQsIHNldCB5b3VyIHJlZiBvbmNlIGluIGEgdmFyaWFibGUsIGFuZCBjYWxsIGl0IHdoZW4geW91IG5lZWQgaXQ7IHRoaXMgd2lsbCBhbGxvdyB0byBjaGFuZ2UgdGhlIHJlZiB5b3UncmUgdmlld2luZyBlYXNpbHkgZm9yIHlvdXIgZW50aXJlIHBhZ2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBtYXN0ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5tYXN0ZXIucmVmO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIHRoZSByZWYgSUQgZm9yIGEgZ2l2ZW4gcmVmJ3MgbGFiZWwuXG4gICAgICAgICAqIERvIG5vdCB1c2UgbGlrZSB0aGlzOiBzZWFyY2hGb3JtLnJlZihhcGkucmVmKFwiRnV0dXJlIHJlbGVhc2UgbGFiZWxcIikpLlxuICAgICAgICAgKiBJbnN0ZWFkLCBzZXQgeW91ciByZWYgb25jZSBpbiBhIHZhcmlhYmxlLCBhbmQgY2FsbCBpdCB3aGVuIHlvdSBuZWVkIGl0OyB0aGlzIHdpbGwgYWxsb3cgdG8gY2hhbmdlIHRoZSByZWYgeW91J3JlIHZpZXdpbmcgZWFzaWx5IGZvciB5b3VyIGVudGlyZSBwYWdlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbGFiZWwgLSB0aGUgcmVmJ3MgbGFiZWxcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHJlZjogZnVuY3Rpb24obGFiZWwpIHtcbiAgICAgICAgICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuZGF0YS5yZWZzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYodGhpcy5kYXRhLnJlZnNbaV0ubGFiZWwgPT0gbGFiZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5yZWZzW2ldLnJlZjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBjdXJyZW50IGV4cGVyaW1lbnQsIG9yIG51bGxcbiAgICAgICAgICogQHJldHVybnMge0V4cGVyaW1lbnR9XG4gICAgICAgICAqL1xuICAgICAgICBjdXJyZW50RXhwZXJpbWVudDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leHBlcmltZW50cy5jdXJyZW50KCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFBhcnNlIGpzb24gYXMgYSBkb2N1bWVudFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7RG9jdW1lbnR9XG4gICAgICAgICAqL1xuICAgICAgICBwYXJzZURvYzogZnVuY3Rpb24oanNvbikge1xuICAgICAgICAgICAgdmFyIGZyYWdtZW50cyA9IHt9O1xuICAgICAgICAgICAgZm9yKHZhciBmaWVsZCBpbiBqc29uLmRhdGFbanNvbi50eXBlXSkge1xuICAgICAgICAgICAgICAgIGZyYWdtZW50c1tqc29uLnR5cGUgKyAnLicgKyBmaWVsZF0gPSBqc29uLmRhdGFbanNvbi50eXBlXVtmaWVsZF07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBzbHVncyA9IFtdO1xuICAgICAgICAgICAgaWYgKGpzb24uc2x1Z3MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwganNvbi5zbHVncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBzbHVncy5wdXNoKGRlY29kZVVSSUNvbXBvbmVudChqc29uLnNsdWdzW2ldKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbmV3IEdsb2JhbC5QcmlzbWljLkRvY3VtZW50KFxuICAgICAgICAgICAgICAgIGpzb24uaWQsXG4gICAgICAgICAgICAgICAganNvbi51aWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBqc29uLnR5cGUsXG4gICAgICAgICAgICAgICAganNvbi5ocmVmLFxuICAgICAgICAgICAgICAgIGpzb24udGFncyxcbiAgICAgICAgICAgICAgICBzbHVncyxcbiAgICAgICAgICAgICAgICBmcmFnbWVudHNcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFF1ZXJ5IHRoZSByZXBvc2l0b3J5XG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfGFycmF5fFByZWRpY2F0ZX0gdGhlIHF1ZXJ5IGl0c2VsZlxuICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gYWRkaXRpb25hbCBwYXJhbWV0ZXJzXG5cdFx0XHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrKGVyciwgcmVzcG9uc2UpXG4gICAgICAgICAqL1xuICAgICAgICBxdWVyeTogZnVuY3Rpb24ocSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHZhciBmb3JtID0gdGhpcy5mb3JtKCdldmVyeXRoaW5nJyk7XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIGZvcm0gPSBmb3JtLnNldChrZXksIG9wdGlvbnNba2V5XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnNbJ3JlZiddKSB7XG4gICAgICAgICAgICAgICAgZm9ybSA9IGZvcm0ucmVmKHRoaXMubWFzdGVyKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZvcm0ucXVlcnkocSkuc3VibWl0KGNhbGxiYWNrKTtcbiAgICAgICAgfSxcblxuXHRcdFx0XHQvKipcblx0XHRcdFx0ICogUmV0cmlldmUgdGhlIGRvY3VtZW50IHdpdGggdGhlIGdpdmVuIGlkXG5cdFx0XHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBpZFxuICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gYWRkaXRpb25hbCBwYXJhbWV0ZXJzXG5cdFx0XHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrKGVyciwgcmVzcG9uc2UpXG5cdFx0XHRcdCAqL1xuXHRcdFx0XHRnZXRCeUlEOiBmdW5jdGlvbihpZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHZhciBQcmVkaWNhdGVzID0gR2xvYmFsLlByaXNtaWMuUHJlZGljYXRlcztcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLnF1ZXJ5KFByZWRpY2F0ZXMuYXQoJ2RvY3VtZW50LmlkJywgaWQpLCBvcHRpb25zLCBmdW5jdGlvbihlcnIsIHJlc3BvbnNlKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLnJlc3VsdHMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRjYWxsYmFjayhlcnIsIHJlc3BvbnNlLnJlc3VsdHNbMF0pO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGxiYWNrKGVyciwgbnVsbCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0sXG5cblx0XHRcdFx0LyoqXG5cdFx0XHRcdCAqIFJldHJpZXZlIG11bHRpcGxlIGRvY3VtZW50cyBmcm9tIGFuIGFycmF5IG9mIGlkXG5cdFx0XHRcdCAqIEBwYXJhbSB7YXJyYXl9IGlkc1xuICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gYWRkaXRpb25hbCBwYXJhbWV0ZXJzXG5cdFx0XHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrKGVyciwgcmVzcG9uc2UpXG5cdFx0XHRcdCAqL1xuXHRcdFx0XHRnZXRCeUlEczogZnVuY3Rpb24oaWRzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMucXVlcnkoWydpbicsICdkb2N1bWVudC5pZCcsIGlkc10sIG9wdGlvbnMsIGNhbGxiYWNrKTtcblx0XHRcdFx0fSxcblxuXHRcdFx0XHQvKipcblx0XHRcdFx0ICogUmV0cmlldmUgdGhlIGRvY3VtZW50IHdpdGggdGhlIGdpdmVuIHVpZFxuXHRcdFx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSB0aGUgY3VzdG9tIHR5cGUgb2YgdGhlIGRvY3VtZW50XG5cdFx0XHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB1aWRcbiAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IGFkZGl0aW9uYWwgcGFyYW1ldGVyc1xuXHRcdFx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayhlcnIsIHJlc3BvbnNlKVxuXHRcdFx0XHQgKi9cblx0XHRcdFx0Z2V0QnlVSUQ6IGZ1bmN0aW9uKHR5cGUsIHVpZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHZhciBQcmVkaWNhdGVzID0gR2xvYmFsLlByaXNtaWMuUHJlZGljYXRlcztcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLnF1ZXJ5KFByZWRpY2F0ZXMuYXQoJ215LicrdHlwZSsnLnVpZCcsIHVpZCksIG9wdGlvbnMsIGZ1bmN0aW9uKGVyciwgcmVzcG9uc2UpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2UucmVzdWx0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGxiYWNrKGVyciwgcmVzcG9uc2UucmVzdWx0c1swXSk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsbGJhY2soZXJyLCBudWxsKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSxcblxuXHRcdFx0XHQvKipcblx0XHRcdFx0ICogUmV0cmlldmUgdGhlIGRvY3VtZW50IHdpdGggdGhlIGdpdmVuIHVpZFxuXHRcdFx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSB0aGUgY3VzdG9tIHR5cGUgb2YgdGhlIGRvY3VtZW50XG5cdFx0XHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB1aWRcbiAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IGFkZGl0aW9uYWwgcGFyYW1ldGVyc1xuXHRcdFx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayhlcnIsIHJlc3BvbnNlKVxuXHRcdFx0XHQgKi9cblx0XHRcdFx0Z2V0Qm9va21hcms6IGZ1bmN0aW9uKGJvb2ttYXJrLCBvcHRpb25zLCBjYWxsYmFjaykge1xuXHRcdFx0XHRcdFx0dmFyIGlkID0gdGhpcy5ib29rbWFya3NbYm9va21hcmtdO1xuXHRcdFx0XHRcdFx0aWYgKGlkKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5nZXRCeUlkKHRoaXMuYm9va21hcmtzW2Jvb2ttYXJrXSwgb3B0aW9ucywgY2FsbGJhY2spO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRjYWxsYmFjayhuZXcgRXJyb3IoXCJFcnJvciByZXRyaWV2aW5nIGJvb2ttYXJrZWQgaWRcIikpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm4gdGhlIFVSTCB0byBkaXNwbGF5IGEgZ2l2ZW4gcHJldmlld1xuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gdG9rZW4gYXMgcmVjZWl2ZWQgZnJvbSBQcmlzbWljIHNlcnZlciB0byBpZGVudGlmeSB0aGUgY29udGVudCB0byBwcmV2aWV3XG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpbmtSZXNvbHZlciB0aGUgbGluayByZXNvbHZlciB0byBidWlsZCBVUkwgZm9yIHlvdXIgc2l0ZVxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZGVmYXVsdFVybCB0aGUgVVJMIHRvIGRlZmF1bHQgdG8gcmV0dXJuIGlmIHRoZSBwcmV2aWV3IGRvZXNuJ3QgY29ycmVzcG9uZCB0byBhIGRvY3VtZW50XG4gICAgICAgICAqICAgICAgICAgICAgICAgICh1c3VhbGx5IHRoZSBob21lIHBhZ2Ugb2YgeW91ciBzaXRlKVxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayB0byBnZXQgdGhlIHJlc3VsdGluZyBVUkxcbiAgICAgICAgICovXG4gICAgICAgIHByZXZpZXdTZXNzaW9uOiBmdW5jdGlvbih0b2tlbiwgbGlua1Jlc29sdmVyLCBkZWZhdWx0VXJsLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgdmFyIGFwaSA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgUHJlZGljYXRlcyA9IEdsb2JhbC5QcmlzbWljLlByZWRpY2F0ZXM7XG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RIYW5kbGVyKHRva2VuLCBmdW5jdGlvbiAoZXJyLCByZXN1bHQsIHhocikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJFcnJvciBmcm9tIHRoZSByZXF1ZXN0XCIpO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIGRlZmF1bHRVcmwsIHhocik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1haW5Eb2N1bWVudElkID0gcmVzdWx0Lm1haW5Eb2N1bWVudDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFtYWluRG9jdW1lbnRJZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZGVmYXVsdFVybCwgeGhyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwaS5mb3JtKFwiZXZlcnl0aGluZ1wiKS5xdWVyeShQcmVkaWNhdGVzLmF0KFwiZG9jdW1lbnQuaWRcIiwgbWFpbkRvY3VtZW50SWQpKS5yZWYodG9rZW4pLnN1Ym1pdChmdW5jdGlvbihlcnIsIHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2UucmVzdWx0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRlZmF1bHRVcmwsIHhocik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBsaW5rUmVzb2x2ZXIocmVzcG9uc2UucmVzdWx0c1swXSksIHhocik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkNhdWdodCBlIFwiLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZSwgZGVmYXVsdFVybCwgeGhyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRmV0Y2ggYSBVUkwgY29ycmVzcG9uZGluZyB0byBhIHF1ZXJ5LCBhbmQgcGFyc2UgdGhlIHJlc3BvbnNlIGFzIGEgUmVzcG9uc2Ugb2JqZWN0XG4gICAgICAgICAqL1xuICAgICAgICByZXF1ZXN0OiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB2YXIgYXBpID0gdGhpcztcbiAgICAgICAgICAgIHZhciBjYWNoZUtleSA9IHVybCArICh0aGlzLmFjY2Vzc1Rva2VuID8gKCcjJyArIHRoaXMuYWNjZXNzVG9rZW4pIDogJycpO1xuICAgICAgICAgICAgdmFyIGNhY2hlID0gdGhpcy5hcGlDYWNoZTtcbiAgICAgICAgICAgIGNhY2hlLmdldChjYWNoZUtleSwgZnVuY3Rpb24gKGVyciwgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7IHJldHVybiBjYWxsYmFjayhlcnIpOyB9XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlKSB7IHJldHVybiBjYWxsYmFjayhudWxsLCB2YWx1ZSk7IH1cbiAgICAgICAgICAgICAgICBhcGkucmVxdWVzdEhhbmRsZXIodXJsLCBmdW5jdGlvbiAoZXJyLCBkb2N1bWVudHMsIHhociwgdHRsKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCwgeGhyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IGRvY3VtZW50cy5yZXN1bHRzLm1hcChwcmlzbWljLmZuLnBhcnNlRG9jKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnRzLnBhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudHMucmVzdWx0c19wZXJfcGFnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50cy5yZXN1bHRzX3NpemUsXG4gICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudHMudG90YWxfcmVzdWx0c19zaXplLFxuICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnRzLnRvdGFsX3BhZ2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnRzLm5leHRfcGFnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50cy5wcmV2X3BhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzIHx8IFtdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR0bCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGUuc2V0KGNhY2hlS2V5LCByZXNwb25zZSwgdHRsLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBwcmlzbWljLmZuLmluaXQucHJvdG90eXBlID0gcHJpc21pYy5mbjtcblxuICAgIC8qKlxuICAgICAqIEVtYm9kaWVzIGEgc3VibWl0dGFibGUgUkVTVGZ1bCBmb3JtIGFzIGRlc2NyaWJlZCBvbiB0aGUgQVBJIGVuZHBvaW50IChhcyBwZXIgUkVTVGZ1bCBzdGFuZGFyZHMpXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBGb3JtKG5hbWUsIGZpZWxkcywgZm9ybV9tZXRob2QsIHJlbCwgZW5jdHlwZSwgYWN0aW9uKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMuZmllbGRzID0gZmllbGRzO1xuICAgICAgICB0aGlzLmZvcm1fbWV0aG9kID0gZm9ybV9tZXRob2Q7XG4gICAgICAgIHRoaXMucmVsID0gcmVsO1xuICAgICAgICB0aGlzLmVuY3R5cGUgPSBlbmN0eXBlO1xuICAgICAgICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcbiAgICB9XG5cbiAgICBGb3JtLnByb3RvdHlwZSA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogRW1ib2RpZXMgYSBTZWFyY2hGb3JtIG9iamVjdC4gVG8gY3JlYXRlIFNlYXJjaEZvcm0gb2JqZWN0cyB0aGF0IGFyZSBhbGxvd2VkIGluIHRoZSBBUEksIHBsZWFzZSB1c2UgdGhlIEFQSS5mb3JtKCkgbWV0aG9kLlxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBnbG9iYWxcbiAgICAgKiBAYWxpYXMgU2VhcmNoRm9ybVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNlYXJjaEZvcm0oYXBpLCBmb3JtLCBkYXRhKSB7XG4gICAgICAgIHRoaXMuYXBpID0gYXBpO1xuICAgICAgICB0aGlzLmZvcm0gPSBmb3JtO1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhIHx8IHt9O1xuXG4gICAgICAgIGZvcih2YXIgZmllbGQgaW4gZm9ybS5maWVsZHMpIHtcbiAgICAgICAgICAgIGlmKGZvcm0uZmllbGRzW2ZpZWxkXVsnZGVmYXVsdCddKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhW2ZpZWxkXSA9IFtmb3JtLmZpZWxkc1tmaWVsZF1bJ2RlZmF1bHQnXV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBTZWFyY2hGb3JtLnByb3RvdHlwZSA9IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IGFuIEFQSSBjYWxsIHBhcmFtZXRlci4gVGhpcyB3aWxsIG9ubHkgd29yayBpZiBmaWVsZCBpcyBhIHZhbGlkIGZpZWxkIG9mIHRoZVxuICAgICAgICAgKiBSRVNUZnVsIGZvcm0gaW4gdGhlIGZpcnN0IHBsYWNlIChhcyBkZXNjcmliZWQgaW4gdGhlIC9hcGkgZG9jdW1lbnQpOyBvdGhlcndpc2UsXG4gICAgICAgICAqIGFuIFwiVW5rbm93biBmaWVsZFwiIGVycm9yIGlzIHRocm93bi5cbiAgICAgICAgICogUGxlYXNlIHByZWZlciB1c2luZyBkZWRpY2F0ZWQgbWV0aG9kcyBsaWtlIHF1ZXJ5KCksIG9yZGVyaW5ncygpLCAuLi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkIC0gVGhlIG5hbWUgb2YgdGhlIGZpZWxkIHRvIHNldFxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgLSBUaGUgdmFsdWUgdGhhdCBnZXRzIGFzc2lnbmVkXG4gICAgICAgICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgICAgICAgKi9cbiAgICAgICAgc2V0OiBmdW5jdGlvbihmaWVsZCwgdmFsdWUpIHtcbiAgICAgICAgICAgIHZhciBmaWVsZERlc2MgPSB0aGlzLmZvcm0uZmllbGRzW2ZpZWxkXTtcbiAgICAgICAgICAgIGlmKCFmaWVsZERlc2MpIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gZmllbGQgXCIgKyBmaWVsZCk7XG4gICAgICAgICAgICB2YXIgdmFsdWVzPSB0aGlzLmRhdGFbZmllbGRdIHx8IFtdO1xuICAgICAgICAgICAgaWYodmFsdWUgPT09ICcnIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAvLyB3ZSBtdXN0IGNvbXBhcmUgdmFsdWUgdG8gbnVsbCBiZWNhdXNlIHdlIHdhbnQgdG8gYWxsb3cgMFxuICAgICAgICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKGZpZWxkRGVzYy5tdWx0aXBsZSkge1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSkgdmFsdWVzLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSB2YWx1ZSAmJiBbdmFsdWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5kYXRhW2ZpZWxkXSA9IHZhbHVlcztcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXRzIGEgcmVmIHRvIHF1ZXJ5IG9uIGZvciB0aGlzIFNlYXJjaEZvcm0uIFRoaXMgaXMgYSBtYW5kYXRvcnlcbiAgICAgICAgICogbWV0aG9kIHRvIGNhbGwgYmVmb3JlIGNhbGxpbmcgc3VibWl0KCksIGFuZCBhcGkuZm9ybSgnZXZlcnl0aGluZycpLnN1Ym1pdCgpXG4gICAgICAgICAqIHdpbGwgbm90IHdvcmsuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7UmVmfSByZWYgLSBUaGUgUmVmIG9iamVjdCBkZWZpbmluZyB0aGUgcmVmIHRvIHF1ZXJ5XG4gICAgICAgICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgICAgICAgKi9cbiAgICAgICAgcmVmOiBmdW5jdGlvbihyZWYpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNldChcInJlZlwiLCByZWYpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXRzIGEgcHJlZGljYXRlLWJhc2VkIHF1ZXJ5IGZvciB0aGlzIFNlYXJjaEZvcm0uIFRoaXMgaXMgd2hlcmUgeW91XG4gICAgICAgICAqIHBhc3RlIHdoYXQgeW91IGNvbXBvc2UgaW4geW91ciBwcmlzbWljLmlvIEFQSSBicm93c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZSBmb3JtLnF1ZXJ5KFByaXNtaWMuUHJlZGljYXRlcy5hdChcImRvY3VtZW50LmlkXCIsIFwiZm9vYmFyXCIpKVxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ3wuLi5hcnJheX0gcXVlcnkgLSBFaXRoZXIgYSBxdWVyeSBhcyBhIHN0cmluZywgb3IgYXMgbWFueSBwcmVkaWNhdGVzIGFzIHlvdSB3YW50LiBTZWUgUHJpc21pYy5QcmVkaWNhdGVzLlxuICAgICAgICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICAgICAgICovXG4gICAgICAgIHF1ZXJ5OiBmdW5jdGlvbihxdWVyeSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zZXQoXCJxXCIsIHF1ZXJ5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHByZWRpY2F0ZXM7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXJ5LmNvbnN0cnVjdG9yID09PSBBcnJheSAmJiBxdWVyeS5sZW5ndGggPiAwICYmIHF1ZXJ5WzBdLmNvbnN0cnVjdG9yID09PSBBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICBwcmVkaWNhdGVzID0gcXVlcnk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJlZGljYXRlcyA9IFtdLnNsaWNlLmFwcGx5KGFyZ3VtZW50cyk7IC8vIENvbnZlcnQgdG8gYSByZWFsIEpTIGFycmF5XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBzdHJpbmdRdWVyaWVzID0gW107XG4gICAgICAgICAgICAgICAgcHJlZGljYXRlcy5mb3JFYWNoKGZ1bmN0aW9uIChwcmVkaWNhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpcnN0QXJnID0gKHByZWRpY2F0ZVsxXS5pbmRleE9mKFwibXkuXCIpID09PSAwIHx8IHByZWRpY2F0ZVsxXS5pbmRleE9mKFwiZG9jdW1lbnRcIikgPT09IDApID8gcHJlZGljYXRlWzFdXG4gICAgICAgICAgICAgICAgICAgICAgICA6ICdcIicgKyBwcmVkaWNhdGVbMV0gKyAnXCInO1xuICAgICAgICAgICAgICAgICAgc3RyaW5nUXVlcmllcy5wdXNoKFwiWzpkID0gXCIgKyBwcmVkaWNhdGVbMF0gKyBcIihcIiArIGZpcnN0QXJnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAocHJlZGljYXRlLmxlbmd0aCA+IDIgPyBcIiwgXCIgOiBcIlwiKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWRpY2F0ZS5zbGljZSgyKS5tYXAoZnVuY3Rpb24ocCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdcIicgKyBwICsgJ1wiJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiW1wiICsgcC5tYXAoZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnXCInICsgZSArICdcIic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJywnKSArIFwiXVwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAuZ2V0VGltZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJywnKTtcbiAgICAgICAgICAgICAgICAgICAgfSkoKSArIFwiKV1cIik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucXVlcnkoXCJbXCIgKyBzdHJpbmdRdWVyaWVzLmpvaW4oXCJcIikgKyBcIl1cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldHMgYSBwYWdlIHNpemUgdG8gcXVlcnkgZm9yIHRoaXMgU2VhcmNoRm9ybS4gVGhpcyBpcyBhbiBvcHRpb25hbCBtZXRob2QuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzaXplIC0gVGhlIHBhZ2Ugc2l6ZVxuICAgICAgICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICAgICAgICovXG4gICAgICAgIHBhZ2VTaXplOiBmdW5jdGlvbihzaXplKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zZXQoXCJwYWdlU2l6ZVwiLCBzaXplKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzdHJpY3QgdGhlIHJlc3VsdHMgZG9jdW1lbnQgdG8gdGhlIHNwZWNpZmllZCBmaWVsZHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd8YXJyYXl9IGZpZWxkcyAtIFRoZSBsaXN0IG9mIGZpZWxkcywgYXJyYXkgb3IgY29tbWEgc2VwYXJhdGVkIHN0cmluZ1xuICAgICAgICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICAgICAgICovXG4gICAgICAgIGZldGNoOiBmdW5jdGlvbihmaWVsZHMpIHtcbiAgICAgICAgICAgIGlmIChmaWVsZHMgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgICAgICAgIGZpZWxkcyA9IGZpZWxkcy5qb2luKFwiLFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNldChcImZldGNoXCIsIGZpZWxkcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEluY2x1ZGUgdGhlIHJlcXVlc3RlZCBmaWVsZHMgaW4gdGhlIERvY3VtZW50TGluayBpbnN0YW5jZXMgaW4gdGhlIHJlc3VsdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ3xhcnJheX0gZmllbGRzIC0gVGhlIGxpc3Qgb2YgZmllbGRzLCBhcnJheSBvciBjb21tYSBzZXBhcmF0ZWQgc3RyaW5nXG4gICAgICAgICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgICAgICAgKi9cbiAgICAgICAgZmV0Y2hMaW5rczogZnVuY3Rpb24oZmllbGRzKSB7XG4gICAgICAgICAgICBpZiAoZmllbGRzIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgICAgICBmaWVsZHMgPSBmaWVsZHMuam9pbihcIixcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zZXQoXCJmZXRjaExpbmtzXCIsIGZpZWxkcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldHMgdGhlIHBhZ2UgbnVtYmVyIHRvIHF1ZXJ5IGZvciB0aGlzIFNlYXJjaEZvcm0uIFRoaXMgaXMgYW4gb3B0aW9uYWwgbWV0aG9kLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge251bWJlcn0gcCAtIFRoZSBwYWdlIG51bWJlclxuICAgICAgICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICAgICAgICovXG4gICAgICAgIHBhZ2U6IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNldChcInBhZ2VcIiwgcCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldHMgdGhlIG9yZGVyaW5ncyB0byBxdWVyeSBmb3IgdGhpcyBTZWFyY2hGb3JtLiBUaGlzIGlzIGFuIG9wdGlvbmFsIG1ldGhvZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHthcnJheX0gb3JkZXJpbmdzIC0gQXJyYXkgb2Ygc3RyaW5nOiBsaXN0IG9mIGZpZWxkcywgb3B0aW9uYWxseSBmb2xsb3dlZCBieSBzcGFjZSBhbmQgZGVzYy4gRXhhbXBsZTogWydteS5wcm9kdWN0LnByaWNlIGRlc2MnLCAnbXkucHJvZHVjdC5kYXRlJ11cbiAgICAgICAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gVGhlIFNlYXJjaEZvcm0gaXRzZWxmXG4gICAgICAgICAqL1xuICAgICAgICBvcmRlcmluZ3M6IGZ1bmN0aW9uKG9yZGVyaW5ncykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBvcmRlcmluZ3MgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnNldChcIm9yZGVyaW5nc1wiLCBvcmRlcmluZ3MpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghb3JkZXJpbmdzKSB7XG4gICAgICAgICAgICAgICAgLy8gTm9vcFxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBOb3JtYWwgdXNhZ2VcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zZXQoXCJvcmRlcmluZ3NcIiwgXCJbXCIgKyBvcmRlcmluZ3Muam9pbihcIixcIikgKyBcIl1cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN1Ym1pdHMgdGhlIHF1ZXJ5LCBhbmQgY2FsbHMgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHRoZSBxdWVyeSB3YXMgbWFkZSxcbiAgICAgICAgICogdG8gd2hpY2ggeW91IG1heSBwYXNzIHRocmVlIHBhcmFtZXRlcnM6IGEgcG90ZW50aWFsIGVycm9yIChudWxsIGlmIG5vIHByb2JsZW0pLFxuICAgICAgICAgKiBhIFJlc3BvbnNlIG9iamVjdCAoY29udGFpbmluZyBhbGwgdGhlIHBhZ2luYXRpb24gc3BlY2lmaWNzICsgdGhlIGFycmF5IG9mIERvY3MpLFxuICAgICAgICAgKiBhbmQgdGhlIFhNTEh0dHBSZXF1ZXN0XG4gICAgICAgICAqL1xuICAgICAgICBzdWJtaXQ6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB2YXIgdXJsID0gdGhpcy5mb3JtLmFjdGlvbjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgICAgICAgICAgIHZhciBzZXAgPSAodXJsLmluZGV4T2YoJz8nKSA+IC0xID8gJyYnIDogJz8nKTtcbiAgICAgICAgICAgICAgICBmb3IodmFyIGtleSBpbiB0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZGF0YS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gdGhpcy5kYXRhW2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsICs9IHNlcCArIGtleSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZXNbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXAgPSAnJic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmFwaS5yZXF1ZXN0KHVybCwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEVtYm9kaWVzIHRoZSByZXNwb25zZSBvZiBhIFNlYXJjaEZvcm0gcXVlcnkgYXMgcmV0dXJuZWQgYnkgdGhlIEFQSS5cbiAgICAgKiBJdCBpbmNsdWRlcyBhbGwgdGhlIGZpZWxkcyB0aGF0IGFyZSB1c2VmdWwgZm9yIHBhZ2luYXRpb24gKHBhZ2UsIHRvdGFsX3BhZ2VzLCB0b3RhbF9yZXN1bHRzX3NpemUsIC4uLiksXG4gICAgICogYXMgd2VsbCBhcyB0aGUgZmllbGQgXCJyZXN1bHRzXCIsIHdoaWNoIGlzIGFuIGFycmF5IG9mIHtAbGluayBEb2N1bWVudH0gb2JqZWN0cywgdGhlIGRvY3VtZW50cyB0aGVtc2VsdmVzLlxuICAgICAqXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGdsb2JhbFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFJlc3BvbnNlKHBhZ2UsIHJlc3VsdHNfcGVyX3BhZ2UsIHJlc3VsdHNfc2l6ZSwgdG90YWxfcmVzdWx0c19zaXplLCB0b3RhbF9wYWdlcywgbmV4dF9wYWdlLCBwcmV2X3BhZ2UsIHJlc3VsdHMpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBjdXJyZW50IHBhZ2VcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucGFnZSA9IHBhZ2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbnVtYmVyIG9mIHJlc3VsdHMgcGVyIHBhZ2VcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVzdWx0c19wZXJfcGFnZSA9IHJlc3VsdHNfcGVyX3BhZ2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2l6ZSBvZiB0aGUgY3VycmVudCBwYWdlXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlc3VsdHNfc2l6ZSA9IHJlc3VsdHNfc2l6ZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0b3RhbCBzaXplIG9mIHJlc3VsdHMgYWNyb3NzIGFsbCBwYWdlc1xuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50b3RhbF9yZXN1bHRzX3NpemUgPSB0b3RhbF9yZXN1bHRzX3NpemU7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG90YWwgbnVtYmVyIG9mIHBhZ2VzXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRvdGFsX3BhZ2VzID0gdG90YWxfcGFnZXM7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgVVJMIG9mIHRoZSBuZXh0IHBhZ2UgaW4gdGhlIEFQSVxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uZXh0X3BhZ2UgPSBuZXh0X3BhZ2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgVVJMIG9mIHRoZSBwcmV2aW91cyBwYWdlIGluIHRoZSBBUElcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucHJldl9wYWdlID0gcHJldl9wYWdlO1xuICAgICAgICAvKipcbiAgICAgICAgICogQXJyYXkgb2Yge0BsaW5rIERvY3VtZW50fSBmb3IgdGhlIGN1cnJlbnQgcGFnZVxuICAgICAgICAgKiBAdHlwZSB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVtYm9kaWVzIGEgcHJpc21pYy5pbyByZWYgKGEgcGFzdCBvciBmdXR1cmUgcG9pbnQgaW4gdGltZSB5b3UgY2FuIHF1ZXJ5KVxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBnbG9iYWxcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBSZWYocmVmLCBsYWJlbCwgaXNNYXN0ZXIsIHNjaGVkdWxlZEF0LCBpZCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogQGZpZWxkXG4gICAgICAgICAqIEBkZXNjcmlwdGlvbiB0aGUgSUQgb2YgdGhlIHJlZlxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZWYgPSByZWY7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBsYWJlbCBvZiB0aGUgcmVmXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxhYmVsID0gbGFiZWw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIGlzIHRydWUgaWYgdGhlIHJlZiBpcyB0aGUgbWFzdGVyIHJlZlxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pc01hc3RlciA9IGlzTWFzdGVyO1xuICAgICAgICAvKipcbiAgICAgICAgICogQGZpZWxkXG4gICAgICAgICAqIEBkZXNjcmlwdGlvbiB0aGUgc2NoZWR1bGVkIGRhdGUgb2YgdGhlIHJlZlxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zY2hlZHVsZWRBdCA9IHNjaGVkdWxlZEF0O1xuICAgICAgICAvKipcbiAgICAgICAgICogQGZpZWxkXG4gICAgICAgICAqIEBkZXNjcmlwdGlvbiB0aGUgbmFtZSBvZiB0aGUgcmVmXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmlkID0gaWQ7XG4gICAgfVxuICAgIFJlZi5wcm90b3R5cGUgPSB7fTtcblxuZnVuY3Rpb24gZ2xvYmFsQ2FjaGUoKSB7XG4gIHZhciBnO1xuICBpZiAodHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0Jykge1xuICAgIGcgPSBnbG9iYWw7IC8vIE5vZGVKU1xuICB9IGVsc2Uge1xuICAgIGcgPSB3aW5kb3c7IC8vIGJyb3dzZXJcbiAgfVxuICBpZiAoIWcucHJpc21pY0NhY2hlKSB7XG4gICAgZy5wcmlzbWljQ2FjaGUgPSBuZXcgR2xvYmFsLlByaXNtaWMuQXBpQ2FjaGUoKTtcbiAgfVxuICByZXR1cm4gZy5wcmlzbWljQ2FjaGU7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgZXhwZXJpbWVudENvb2tpZTogXCJpby5wcmlzbWljLmV4cGVyaW1lbnRcIixcbiAgcHJldmlld0Nvb2tpZTogXCJpby5wcmlzbWljLnByZXZpZXdcIixcbiAgQXBpOiBwcmlzbWljLFxuICBFeHBlcmltZW50cyxcbiAgUHJlZGljYXRlcyxcbiAgRnJhZ21lbnRzLFxuICBBcGlDYWNoZVxufTtcblxuIiwiXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAvKipcbiAgICAgKiBBcGkgY2FjaGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBBcGlDYWNoZShsaW1pdCkge1xuICAgICAgICB0aGlzLmxydSA9IG5ldyBHbG9iYWwuUHJpc21pYy5MUlVDYWNoZShsaW1pdCk7XG4gICAgfVxuXG4gICAgQXBpQ2FjaGUucHJvdG90eXBlID0ge1xuXG4gICAgICAgIGdldDogZnVuY3Rpb24oa2V5LCBjYikge1xuICAgICAgICAgICAgdmFyIG1heWJlRW50cnkgPSB0aGlzLmxydS5nZXQoa2V5KTtcbiAgICAgICAgICAgIGlmKG1heWJlRW50cnkgJiYgIXRoaXMuaXNFeHBpcmVkKGtleSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2IobnVsbCwgbWF5YmVFbnRyeS5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjYigpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldDogZnVuY3Rpb24oa2V5LCB2YWx1ZSwgdHRsLCBjYikge1xuICAgICAgICAgICAgdGhpcy5scnUucmVtb3ZlKGtleSk7XG4gICAgICAgICAgICB0aGlzLmxydS5wdXQoa2V5LCB7XG4gICAgICAgICAgICAgICAgZGF0YTogdmFsdWUsXG4gICAgICAgICAgICAgICAgZXhwaXJlZEluOiB0dGwgPyAoRGF0ZS5ub3coKSArICh0dGwgKiAxMDAwKSkgOiAwXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGNiKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgaXNFeHBpcmVkOiBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIHZhciBlbnRyeSA9IHRoaXMubHJ1LmdldChrZXkpO1xuICAgICAgICAgICAgaWYoZW50cnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZW50cnkuZXhwaXJlZEluICE9PSAwICYmIGVudHJ5LmV4cGlyZWRJbiA8IERhdGUubm93KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICByZW1vdmU6IGZ1bmN0aW9uKGtleSwgY2IpIHtcbiAgICAgICAgICAgIHRoaXMubHJ1LnJlbW92ZShrZXkpO1xuICAgICAgICAgICAgcmV0dXJuIGNiKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgY2xlYXI6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgICAgICB0aGlzLmxydS5yZW1vdmVBbGwoKTtcbiAgICAgICAgICAgIHJldHVybiBjYigpO1xuICAgICAgICB9XG4gICAgfTtcblxuZXhwb3J0IGRlZmF1bHQgQXBpQ2FjaGU7XG5cbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQgRnJhZ21lbnRzIGZyb20gJy4vZnJhZ21lbnRzJztcblxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9ucyB0byBhY2Nlc3MgZnJhZ21lbnRzOiBzdXBlcmNsYXNzIGZvciBEb2N1bWVudCBhbmQgRG9jIChmcm9tIEdyb3VwKSwgbm90IHN1cHBvc2VkIHRvIGJlIGNyZWF0ZWQgZGlyZWN0bHlcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBXaXRoRnJhZ21lbnRzKCkge31cblxuICAgIFdpdGhGcmFnbWVudHMucHJvdG90eXBlID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogR2V0cyB0aGUgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LiBTaW5jZSB5b3UgbW9zdCBsaWtlbHkga25vdyB0aGUgdHlwZVxuICAgICAgICAgKiBvZiB0aGlzIGZyYWdtZW50LCBpdCBpcyBhZHZpc2VkIHRoYXQgeW91IHVzZSBhIGRlZGljYXRlZCBtZXRob2QsIGxpa2UgZ2V0IFN0cnVjdHVyZWRUZXh0KCkgb3IgZ2V0RGF0ZSgpLFxuICAgICAgICAgKiBmb3IgaW5zdGFuY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5hdXRob3JcIlxuICAgICAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSAtIFRoZSBKYXZhU2NyaXB0IEZyYWdtZW50IG9iamVjdCB0byBtYW5pcHVsYXRlXG4gICAgICAgICAqL1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgICAgIHZhciBmcmFncyA9IHRoaXMuX2dldEZyYWdtZW50cyhuYW1lKTtcbiAgICAgICAgICAgIHJldHVybiBmcmFncy5sZW5ndGggPyBmcmFnc1swXSA6IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJ1aWxkcyBhbiBhcnJheSBvZiBhbGwgdGhlIGZyYWdtZW50cyBpbiBjYXNlIHRoZXkgYXJlIG11bHRpcGxlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBtdWx0aXBsZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QuYXV0aG9yXCJcbiAgICAgICAgICogQHJldHVybnMge2FycmF5fSAtIEFuIGFycmF5IG9mIGVhY2ggSmF2YVNjcmlwdCBmcmFnbWVudCBvYmplY3QgdG8gbWFuaXB1bGF0ZS5cbiAgICAgICAgICovXG4gICAgICAgIGdldEFsbDogZnVuY3Rpb24obmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldEZyYWdtZW50cyhuYW1lKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogR2V0cyB0aGUgaW1hZ2UgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlIGRvY3VtZW50LmdldEltYWdlKCdibG9nLXBvc3QucGhvdG8nKS5hc0h0bWwobGlua1Jlc29sdmVyKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZnJhZ21lbnQgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LnBob3RvXCJcbiAgICAgICAgICogQHJldHVybnMge0ltYWdlRWx9IC0gVGhlIEltYWdlIG9iamVjdCB0byBtYW5pcHVsYXRlXG4gICAgICAgICAqL1xuICAgICAgICBnZXRJbWFnZTogZnVuY3Rpb24oZnJhZ21lbnQpIHtcbiAgICAgICAgICAgIHZhciBpbWcgPSB0aGlzLmdldChmcmFnbWVudCk7XG4gICAgICAgICAgICBpZiAoaW1nIGluc3RhbmNlb2YgRnJhZ21lbnRzLkltYWdlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGltZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbWcgaW5zdGFuY2VvZiBGcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgICAgICAgICAgICAvLyBmaW5kIGZpcnN0IGltYWdlIGluIHN0LlxuICAgICAgICAgICAgICAgIHJldHVybiBpbWc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBVc2VmdWwgZm9yIG9ic29sZXRlIG11bHRpcGxlc1xuICAgICAgICBnZXRBbGxJbWFnZXM6IGZ1bmN0aW9uKGZyYWdtZW50KSB7XG4gICAgICAgICAgICB2YXIgaW1hZ2VzID0gdGhpcy5nZXRBbGwoZnJhZ21lbnQpO1xuXG4gICAgICAgICAgICByZXR1cm4gaW1hZ2VzLm1hcChmdW5jdGlvbiAoaW1hZ2UpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW1hZ2UgaW5zdGFuY2VvZiBGcmFnbWVudHMuSW1hZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGltYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaW1hZ2UgaW5zdGFuY2VvZiBGcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGRvbmUuXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG5cbiAgICAgICAgZ2V0Rmlyc3RJbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ21lbnRzID0gdGhpcy5mcmFnbWVudHM7XG5cbiAgICAgICAgICAgIHZhciBmaXJzdEltYWdlID0gT2JqZWN0LmtleXMoZnJhZ21lbnRzKS5yZWR1Y2UoZnVuY3Rpb24oaW1hZ2UsIGtleSkge1xuICAgICAgICAgICAgICAgIGlmIChpbWFnZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW1hZ2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBmcmFnbWVudHNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgaWYodHlwZW9mIGVsZW1lbnQuZ2V0Rmlyc3RJbWFnZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZWxlbWVudC5nZXRGaXJzdEltYWdlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5JbWFnZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuIGZpcnN0SW1hZ2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0Rmlyc3RUaXRsZTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ21lbnRzID0gdGhpcy5mcmFnbWVudHM7XG5cbiAgICAgICAgICAgIHZhciBmaXJzdFRpdGxlID0gT2JqZWN0LmtleXMoZnJhZ21lbnRzKS5yZWR1Y2UoZnVuY3Rpb24oc3QsIGtleSkge1xuICAgICAgICAgICAgICAgIGlmIChzdCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3Q7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBmcmFnbWVudHNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgaWYodHlwZW9mIGVsZW1lbnQuZ2V0Rmlyc3RUaXRsZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZWxlbWVudC5nZXRGaXJzdFRpdGxlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5TdHJ1Y3R1cmVkVGV4dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuZ2V0VGl0bGUoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuIGZpcnN0VGl0bGU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0Rmlyc3RQYXJhZ3JhcGg6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGZyYWdtZW50cyA9IHRoaXMuZnJhZ21lbnRzO1xuXG4gICAgICAgICAgICB2YXIgZmlyc3RQYXJhZ3JhcGggPSBPYmplY3Qua2V5cyhmcmFnbWVudHMpLnJlZHVjZShmdW5jdGlvbihzdCwga2V5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZWxlbWVudCA9IGZyYWdtZW50c1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZih0eXBlb2YgZWxlbWVudC5nZXRGaXJzdFBhcmFncmFwaCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZWxlbWVudC5nZXRGaXJzdFBhcmFncmFwaCgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgbnVsbCk7XG4gICAgICAgICAgICByZXR1cm4gZmlyc3RQYXJhZ3JhcGg7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldHMgdGhlIHZpZXcgd2l0aGluIHRoZSBpbWFnZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0SW1hZ2VWaWV3KCdibG9nLXBvc3QucGhvdG8nLCAnbGFyZ2UnKS5hc0h0bWwobGlua1Jlc29sdmVyKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZS0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5waG90b1wiXG4gICAgICAgICAqIEByZXR1cm5zIHtJbWFnZVZpZXd9IHZpZXcgLSBUaGUgVmlldyBvYmplY3QgdG8gbWFuaXB1bGF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0SW1hZ2VWaWV3OiBmdW5jdGlvbihuYW1lLCB2aWV3KSB7XG4gICAgICAgICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcbiAgICAgICAgICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5JbWFnZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmcmFnbWVudC5nZXRWaWV3KHZpZXcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8ZnJhZ21lbnQuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKGZyYWdtZW50LmJsb2Nrc1tpXS50eXBlID09ICdpbWFnZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmcmFnbWVudC5ibG9ja3NbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBVc2VmdWwgZm9yIG9ic29sZXRlIG11bHRpcGxlc1xuICAgICAgICBnZXRBbGxJbWFnZVZpZXdzOiBmdW5jdGlvbihuYW1lLCB2aWV3KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRBbGxJbWFnZXMobmFtZSkubWFwKGZ1bmN0aW9uIChpbWFnZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpbWFnZS5nZXRWaWV3KHZpZXcpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldHMgdGhlIHRpbWVzdGFtcCBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0RGF0ZSgnYmxvZy1wb3N0LnB1YmxpY2F0aW9uZGF0ZScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5wdWJsaWNhdGlvbmRhdGVcIlxuICAgICAgICAgKiBAcmV0dXJucyB7RGF0ZX0gLSBUaGUgRGF0ZSBvYmplY3QgdG8gbWFuaXB1bGF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0VGltZXN0YW1wOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgICAgICAgICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogR2V0cyB0aGUgZGF0ZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0RGF0ZSgnYmxvZy1wb3N0LnB1YmxpY2F0aW9uZGF0ZScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5wdWJsaWNhdGlvbmRhdGVcIlxuICAgICAgICAgKiBAcmV0dXJucyB7RGF0ZX0gLSBUaGUgRGF0ZSBvYmplY3QgdG8gbWFuaXB1bGF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0RGF0ZTogZnVuY3Rpb24obmFtZSkge1xuICAgICAgICAgICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5EYXRlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXRzIGEgYm9vbGVhbiB2YWx1ZSBvZiB0aGUgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAgICAgICAqIFRoaXMgd29ya3MgZ3JlYXQgd2l0aCBhIFNlbGVjdCBmcmFnbWVudC4gVGhlIFNlbGVjdCB2YWx1ZXMgdGhhdCBhcmUgY29uc2lkZXJlZCB0cnVlIGFyZSAobG93ZXJjYXNlZCBiZWZvcmUgbWF0Y2hpbmcpOiAneWVzJywgJ29uJywgYW5kICd0cnVlJy5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgaWYoZG9jdW1lbnQuZ2V0Qm9vbGVhbignYmxvZy1wb3N0LmVuYWJsZUNvbW1lbnRzJykpIHsgLi4uIH1cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmVuYWJsZUNvbW1lbnRzXCJcbiAgICAgICAgICogQHJldHVybnMge2Jvb2xlYW59IC0gVGhlIGJvb2xlYW4gdmFsdWUgb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICBnZXRCb29sZWFuOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcbiAgICAgICAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZSAmJiAoZnJhZ21lbnQudmFsdWUudG9Mb3dlckNhc2UoKSA9PSAneWVzJyB8fCBmcmFnbWVudC52YWx1ZS50b0xvd2VyQ2FzZSgpID09ICdvbicgfHwgZnJhZ21lbnQudmFsdWUudG9Mb3dlckNhc2UoKSA9PSAndHJ1ZScpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXRzIHRoZSB0ZXh0IGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgICAgICAgKiBUaGUgbWV0aG9kIHdvcmtzIHdpdGggU3RydWN0dXJlZFRleHQgZnJhZ21lbnRzLCBUZXh0IGZyYWdtZW50cywgTnVtYmVyIGZyYWdtZW50cywgU2VsZWN0IGZyYWdtZW50cyBhbmQgQ29sb3IgZnJhZ21lbnRzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRUZXh0KCdibG9nLXBvc3QubGFiZWwnKS5hc0h0bWwobGlua1Jlc29sdmVyKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmxhYmVsXCJcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGFmdGVyIC0gYSBzdWZmaXggdGhhdCB3aWxsIGJlIGFwcGVuZGVkIHRvIHRoZSB2YWx1ZVxuICAgICAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSAtIGVpdGhlciBTdHJ1Y3R1cmVkVGV4dCwgb3IgVGV4dCwgb3IgTnVtYmVyLCBvciBTZWxlY3QsIG9yIENvbG9yLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0VGV4dDogZnVuY3Rpb24obmFtZSwgYWZ0ZXIpIHtcbiAgICAgICAgICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnJhZ21lbnQuYmxvY2tzLm1hcChmdW5jdGlvbihibG9jaykge1xuICAgICAgICAgICAgICAgICAgICBpZihibG9jay50ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYmxvY2sudGV4dCArIChhZnRlciA/IGFmdGVyIDogJycpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSkuam9pbignXFxuJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5UZXh0KSB7XG4gICAgICAgICAgICAgICAgaWYoZnJhZ21lbnQudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICsgKGFmdGVyID8gYWZ0ZXIgOiAnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuTnVtYmVyKSB7XG4gICAgICAgICAgICAgICAgaWYoZnJhZ21lbnQudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICsgKGFmdGVyID8gYWZ0ZXIgOiAnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuU2VsZWN0KSB7XG4gICAgICAgICAgICAgICAgaWYoZnJhZ21lbnQudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICsgKGFmdGVyID8gYWZ0ZXIgOiAnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuQ29sb3IpIHtcbiAgICAgICAgICAgICAgICBpZihmcmFnbWVudC52YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnJhZ21lbnQudmFsdWUgKyAoYWZ0ZXIgPyBhZnRlciA6ICcnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldHMgdGhlIFN0cnVjdHVyZWRUZXh0IGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgICAgICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRTdHJ1Y3R1cmVkVGV4dCgnYmxvZy1wb3N0LmJvZHknKS5hc0h0bWwobGlua1Jlc29sdmVyKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QuYm9keVwiXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJ1Y3R1cmVkVGV4dH0gLSBUaGUgU3RydWN0dXJlZFRleHQgZnJhZ21lbnQgdG8gbWFuaXB1bGF0ZS5cbiAgICAgICAgICovXG4gICAgICAgIGdldFN0cnVjdHVyZWRUZXh0OiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgICAgICAgICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldHMgdGhlIExpbmsgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAgICAgICAqIEBleGFtcGxlIGRvY3VtZW50LmdldExpbmsoJ2Jsb2ctcG9zdC5saW5rJykudXJsKHJlc29sdmVyKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QubGlua1wiXG4gICAgICAgICAqIEByZXR1cm5zIHtXZWJMaW5rfERvY3VtZW50TGlua3xJbWFnZUxpbmt9IC0gVGhlIExpbmsgZnJhZ21lbnQgdG8gbWFuaXB1bGF0ZS5cbiAgICAgICAgICovXG4gICAgICAgIGdldExpbms6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuV2ViTGluayB8fFxuICAgICAgICAgICAgICAgIGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkRvY3VtZW50TGluayB8fFxuICAgICAgICAgICAgICAgIGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkltYWdlTGluaykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmcmFnbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXRzIHRoZSBOdW1iZXIgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAgICAgICAqIEBleGFtcGxlIGRvY3VtZW50LmdldE51bWJlcigncHJvZHVjdC5wcmljZScpXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcInByb2R1Y3QucHJpY2VcIlxuICAgICAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIFRoZSBudW1iZXIgdmFsdWUgb2YgdGhlIGZyYWdtZW50LlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TnVtYmVyOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgICAgICAgICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLk51bWJlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXRzIHRoZSBDb2xvciBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICAgICAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0Q29sb3IoJ3Byb2R1Y3QuY29sb3InKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJwcm9kdWN0LmNvbG9yXCJcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgc3RyaW5nIHZhbHVlIG9mIHRoZSBDb2xvciBmcmFnbWVudC5cbiAgICAgICAgICovXG4gICAgICAgIGdldENvbG9yOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgICAgICAgICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkNvbG9yKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEdldHMgdGhlIEdlb1BvaW50IGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRHZW9Qb2ludCgnYmxvZy1wb3N0LmxvY2F0aW9uJykuYXNIdG1sKGxpbmtSZXNvbHZlcilcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmxvY2F0aW9uXCJcbiAgICAgICAgICogQHJldHVybnMge0dlb1BvaW50fSAtIFRoZSBHZW9Qb2ludCBvYmplY3QgdG8gbWFuaXB1bGF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0R2VvUG9pbnQ6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgICAgICAgICBpZihmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5HZW9Qb2ludCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmcmFnbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXRzIHRoZSBHcm91cCBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0R3JvdXAoJ3Byb2R1Y3QuZ2FsbGVyeScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJwcm9kdWN0LmdhbGxlcnlcIlxuICAgICAgICAgKiBAcmV0dXJucyB7R3JvdXB9IC0gVGhlIEdyb3VwIGZyYWdtZW50IHRvIG1hbmlwdWxhdGUuXG4gICAgICAgICAqL1xuICAgICAgICBnZXRHcm91cDogZnVuY3Rpb24obmFtZSkge1xuICAgICAgICAgICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5Hcm91cCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmcmFnbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTaG9ydGN1dCB0byBnZXQgdGhlIEhUTUwgb3V0cHV0IG9mIHRoZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBkb2N1bWVudC5cbiAgICAgICAgICogVGhpcyBpcyB0aGUgc2FtZSBhcyB3cml0aW5nIGRvY3VtZW50LmdldChmcmFnbWVudCkuYXNIdG1sKGxpbmtSZXNvbHZlcik7XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5ib2R5XCJcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbn0gbGlua1Jlc29sdmVyXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIEhUTUwgb3V0cHV0XG4gICAgICAgICAqL1xuICAgICAgICBnZXRIdG1sOiBmdW5jdGlvbihuYW1lLCBsaW5rUmVzb2x2ZXIpIHtcbiAgICAgICAgICAgIGlmICghaXNGdW5jdGlvbihsaW5rUmVzb2x2ZXIpKSB7XG4gICAgICAgICAgICAgICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eSB3aXRoIHRoZSBvbGQgY3R4IGFyZ3VtZW50XG4gICAgICAgICAgICAgICAgdmFyIGN0eCA9IGxpbmtSZXNvbHZlcjtcbiAgICAgICAgICAgICAgICBsaW5rUmVzb2x2ZXIgPSBmdW5jdGlvbihkb2MsIGlzQnJva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjdHgubGlua1Jlc29sdmVyKGN0eCwgZG9jLCBpc0Jyb2tlbik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgICAgICAgICBpZihmcmFnbWVudCAmJiBmcmFnbWVudC5hc0h0bWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnJhZ21lbnQuYXNIdG1sKGxpbmtSZXNvbHZlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJhbnNmb3JtcyB0aGUgd2hvbGUgZG9jdW1lbnQgYXMgYW4gSFRNTCBvdXRwdXQuIEVhY2ggZnJhZ21lbnQgaXMgc2VwYXJhdGVkIGJ5IGEgJmx0O3NlY3Rpb24mZ3Q7IHRhZyxcbiAgICAgICAgICogd2l0aCB0aGUgYXR0cmlidXRlIGRhdGEtZmllbGQ9XCJuYW1lb2ZmcmFnbWVudFwiXG4gICAgICAgICAqIE5vdGUgdGhhdCBtb3N0IG9mIHRoZSB0aW1lIHlvdSB3aWxsIG5vdCB1c2UgdGhpcyBtZXRob2QsIGJ1dCByZWFkIGZyYWdtZW50IGluZGVwZW5kZW50bHkgYW5kIGdlbmVyYXRlXG4gICAgICAgICAqIEhUTUwgb3V0cHV0IGZvciB7QGxpbmsgU3RydWN0dXJlZFRleHR9IGZyYWdtZW50IHdpdGggdGhhdCBjbGFzcycgYXNIdG1sIG1ldGhvZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbn0gbGlua1Jlc29sdmVyXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIEhUTUwgb3V0cHV0XG4gICAgICAgICAqL1xuICAgICAgICBhc0h0bWw6IGZ1bmN0aW9uKGxpbmtSZXNvbHZlcikge1xuICAgICAgICAgICAgaWYgKCFpc0Z1bmN0aW9uKGxpbmtSZXNvbHZlcikpIHtcbiAgICAgICAgICAgICAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdpdGggdGhlIG9sZCBjdHggYXJndW1lbnRcbiAgICAgICAgICAgICAgICB2YXIgY3R4ID0gbGlua1Jlc29sdmVyO1xuICAgICAgICAgICAgICAgIGxpbmtSZXNvbHZlciA9IGZ1bmN0aW9uKGRvYywgaXNCcm9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN0eC5saW5rUmVzb2x2ZXIoY3R4LCBkb2MsIGlzQnJva2VuKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGh0bWxzID0gW107XG4gICAgICAgICAgICBmb3IodmFyIGZpZWxkIGluIHRoaXMuZnJhZ21lbnRzKSB7XG4gICAgICAgICAgICAgICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQoZmllbGQpO1xuICAgICAgICAgICAgICAgIGh0bWxzLnB1c2goZnJhZ21lbnQgJiYgZnJhZ21lbnQuYXNIdG1sID8gJzxzZWN0aW9uIGRhdGEtZmllbGQ9XCInICsgZmllbGQgKyAnXCI+JyArIGZyYWdtZW50LmFzSHRtbChsaW5rUmVzb2x2ZXIpICsgJzwvc2VjdGlvbj4nIDogJycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGh0bWxzLmpvaW4oJycpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUdXJucyB0aGUgZG9jdW1lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgICBhc1RleHQ6IGZ1bmN0aW9uKGxpbmtSZXNvbHZlcikge1xuICAgICAgICAgICAgaWYgKCFpc0Z1bmN0aW9uKGxpbmtSZXNvbHZlcikpIHtcbiAgICAgICAgICAgICAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdpdGggdGhlIG9sZCBjdHggYXJndW1lbnRcbiAgICAgICAgICAgICAgICB2YXIgY3R4ID0gbGlua1Jlc29sdmVyO1xuICAgICAgICAgICAgICAgIGxpbmtSZXNvbHZlciA9IGZ1bmN0aW9uKGRvYywgaXNCcm9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN0eC5saW5rUmVzb2x2ZXIoY3R4LCBkb2MsIGlzQnJva2VuKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHRleHRzID0gW107XG4gICAgICAgICAgICBmb3IodmFyIGZpZWxkIGluIHRoaXMuZnJhZ21lbnRzKSB7XG4gICAgICAgICAgICAgICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQoZmllbGQpO1xuICAgICAgICAgICAgICAgIHRleHRzLnB1c2goZnJhZ21lbnQgJiYgZnJhZ21lbnQuYXNUZXh0ID8gZnJhZ21lbnQuYXNUZXh0KGxpbmtSZXNvbHZlcikgOiAnJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGV4dHMuam9pbignJyk7XG4gICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMaW5rZWQgZG9jdW1lbnRzLCBhcyBhbiBhcnJheSBvZiB7QGxpbmsgRG9jdW1lbnRMaW5rfVxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBsaW5rZWREb2N1bWVudHM6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGksIGosIGxpbms7XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBmaWVsZCBpbiB0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChmaWVsZCk7XG4gICAgICAgICAgICAgICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkRvY3VtZW50TGluaykge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChmcmFnbWVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5TdHJ1Y3R1cmVkVGV4dCkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZnJhZ21lbnQuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYmxvY2sgPSBmcmFnbWVudC5ibG9ja3NbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmxvY2sudHlwZSA9PSBcImltYWdlXCIgJiYgYmxvY2subGlua1RvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGluayA9IEZyYWdtZW50cy5pbml0RmllbGQoYmxvY2subGlua1RvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGluayBpbnN0YW5jZW9mIERvY3VtZW50TGluaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChsaW5rKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3BhbnMgPSBibG9jay5zcGFucyB8fCBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBzcGFucy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzcGFuID0gc3BhbnNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNwYW4udHlwZSA9PSBcImh5cGVybGlua1wiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmsgPSBGcmFnbWVudHMuaW5pdEZpZWxkKHNwYW4uZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaW5rIGluc3RhbmNlb2YgRnJhZ21lbnRzLkRvY3VtZW50TGluaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gobGluayk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkdyb3VwKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBmcmFnbWVudC52YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LmNvbmNhdChmcmFnbWVudC52YWx1ZVtpXS5saW5rZWREb2N1bWVudHMoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBbiBhcnJheSBvZiB0aGUgZnJhZ21lbnRzIHdpdGggdGhlIGdpdmVuIGZyYWdtZW50IG5hbWUuXG4gICAgICAgICAqIFRoZSBhcnJheSBpcyBvZnRlbiBhIHNpbmdsZS1lbGVtZW50IGFycmF5LCBleHBlY3Qgd2hlbiB0aGUgZnJhZ21lbnQgaXMgYSBtdWx0aXBsZSBmcmFnbWVudC5cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9nZXRGcmFnbWVudHM6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5mcmFnbWVudHMgfHwgIXRoaXMuZnJhZ21lbnRzW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0aGlzLmZyYWdtZW50c1tuYW1lXSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5mcmFnbWVudHNbbmFtZV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBbdGhpcy5mcmFnbWVudHNbbmFtZV1dO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFbWJvZGllcyBhIGRvY3VtZW50IGFzIHJldHVybmVkIGJ5IHRoZSBBUEkuXG4gICAgICogTW9zdCB1c2VmdWwgZmllbGRzOiBpZCwgdHlwZSwgdGFncywgc2x1Zywgc2x1Z3NcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKiBAZ2xvYmFsXG4gICAgICogQGFsaWFzIERvY1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIERvY3VtZW50KGlkLCB1aWQsIHR5cGUsIGhyZWYsIHRhZ3MsIHNsdWdzLCBkYXRhKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgSUQgb2YgdGhlIGRvY3VtZW50XG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmlkID0gaWQ7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgVXNlciBJRCBvZiB0aGUgZG9jdW1lbnQsIGEgaHVtYW4gcmVhZGFibGUgaWRcbiAgICAgICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy51aWQgPSB1aWQ7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdHlwZSBvZiB0aGUgZG9jdW1lbnQsIGNvcnJlc3BvbmRzIHRvIGEgZG9jdW1lbnQgbWFzayBkZWZpbmVkIGluIHRoZSByZXBvc2l0b3J5XG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnR5cGUgPSB0eXBlO1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIFVSTCBvZiB0aGUgZG9jdW1lbnQgaW4gdGhlIEFQSVxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ocmVmID0gaHJlZjtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0YWdzIG9mIHRoZSBkb2N1bWVudFxuICAgICAgICAgKiBAdHlwZSB7YXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRhZ3MgPSB0YWdzO1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGN1cnJlbnQgc2x1ZyBvZiB0aGUgZG9jdW1lbnQsIFwiLVwiIGlmIG5vbmUgd2FzIHByb3ZpZGVkXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNsdWcgPSBzbHVncyA/IHNsdWdzWzBdIDogXCItXCI7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBbGwgdGhlIHNsdWdzIHRoYXQgd2VyZSBldmVyIHVzZWQgYnkgdGhpcyBkb2N1bWVudCAoaW5jbHVkaW5nIHRoZSBjdXJyZW50IG9uZSwgYXQgdGhlIGhlYWQpXG4gICAgICAgICAqIEB0eXBlIHthcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2x1Z3MgPSBzbHVncztcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBvcmlnaW5hbCBKU09OIGRhdGEgZnJvbSB0aGUgQVBJXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgICAgICAvKipcbiAgICAgICAgICogRnJhZ21lbnRzLCBjb252ZXJ0ZWQgdG8gYnVzaW5lc3Mgb2JqZWN0c1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5mcmFnbWVudHMgPSBGcmFnbWVudHMucGFyc2VGcmFnbWVudHMoZGF0YSk7XG4gICAgfVxuXG4gICAgRG9jdW1lbnQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShXaXRoRnJhZ21lbnRzLnByb3RvdHlwZSk7XG5cbiAgICAvKipcbiAgICAgICogR2V0cyB0aGUgU2xpY2Vab25lIGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgICAgKlxuICAgICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRTbGljZVpvbmUoJ3Byb2R1Y3QuZ2FsbGVyeScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpLlxuICAgICAgKlxuICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJwcm9kdWN0LmdhbGxlcnlcIlxuICAgICAgKiBAcmV0dXJucyB7R3JvdXB9IC0gVGhlIFNsaWNlWm9uZSBmcmFnbWVudCB0byBtYW5pcHVsYXRlLlxuICAgICAgKi9cbiAgICBEb2N1bWVudC5wcm90b3R5cGUuZ2V0U2xpY2Vab25lID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgICAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuU2xpY2Vab25lKSB7XG4gICAgICAgICAgICByZXR1cm4gZnJhZ21lbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIEdyb3VwRG9jKGRhdGEpIHtcbiAgICAgIC8qKlxuICAgICAgICogVGhlIG9yaWdpbmFsIEpTT04gZGF0YSBmcm9tIHRoZSBBUElcbiAgICAgICAqL1xuICAgICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAgIC8qKlxuICAgICAgICogRnJhZ21lbnRzLCBjb252ZXJ0ZWQgdG8gYnVzaW5lc3Mgb2JqZWN0c1xuICAgICAgICovXG4gICAgICB0aGlzLmZyYWdtZW50cyA9IEZyYWdtZW50cy5wYXJzZUZyYWdtZW50cyhkYXRhKTtcbiAgICB9XG5cbiAgICBHcm91cERvYy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFdpdGhGcmFnbWVudHMucHJvdG90eXBlKTtcblxuICAgIC8vIC0tIFByaXZhdGUgaGVscGVyc1xuXG4gICAgZnVuY3Rpb24gaXNGdW5jdGlvbihmKSB7XG4gICAgICAgIHZhciBnZXRUeXBlID0ge307XG4gICAgICAgIHJldHVybiBmICYmIGdldFR5cGUudG9TdHJpbmcuY2FsbChmKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbiAgICB9XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBXaXRoRnJhZ21lbnRzOiBXaXRoRnJhZ21lbnRzLFxuICBEb2N1bWVudDogRG9jdW1lbnQsXG4gIEdyb3VwRG9jOiBHcm91cERvY1xufVxuXG5cbiIsIlxuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgLyoqXG4gICAgICogQSBjb2xsZWN0aW9uIG9mIGV4cGVyaW1lbnRzIGN1cnJlbnRseSBhdmFpbGFibGVcbiAgICAgKiBAcGFyYW0gZGF0YSB0aGUganNvbiBkYXRhIHJlY2VpdmVkIGZyb20gdGhlIFByaXNtaWMgQVBJXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgZnVuY3Rpb24gRXhwZXJpbWVudHMoZGF0YSkge1xuICAgICAgICB2YXIgZHJhZnRzID0gW107XG4gICAgICAgIHZhciBydW5uaW5nID0gW107XG4gICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICBkYXRhLmRyYWZ0cyAmJiBkYXRhLmRyYWZ0cy5mb3JFYWNoKGZ1bmN0aW9uIChleHApIHtcbiAgICAgICAgICAgICAgICBkcmFmdHMucHVzaChuZXcgRXhwZXJpbWVudChleHApKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZGF0YS5ydW5uaW5nICYmIGRhdGEucnVubmluZy5mb3JFYWNoKGZ1bmN0aW9uIChleHApIHtcbiAgICAgICAgICAgICAgICBydW5uaW5nLnB1c2gobmV3IEV4cGVyaW1lbnQoZXhwKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRyYWZ0cyA9IGRyYWZ0cztcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gcnVubmluZztcbiAgICB9XG5cbiAgICBFeHBlcmltZW50cy5wcm90b3R5cGUuY3VycmVudCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5uaW5nLmxlbmd0aCA+IDAgPyB0aGlzLnJ1bm5pbmdbMF0gOiBudWxsO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGN1cnJlbnQgcnVubmluZyBleHBlcmltZW50IHZhcmlhdGlvbiByZWYgZnJvbSBhIGNvb2tpZSBjb250ZW50XG4gICAgICovXG4gICAgRXhwZXJpbWVudHMucHJvdG90eXBlLnJlZkZyb21Db29raWUgPSBmdW5jdGlvbihjb29raWUpIHtcbiAgICAgICAgaWYgKCFjb29raWUgfHwgY29va2llLnRyaW0oKSA9PT0gXCJcIikgcmV0dXJuIG51bGw7XG4gICAgICAgIHZhciBzcGxpdHRlZCA9IGNvb2tpZS50cmltKCkuc3BsaXQoXCIgXCIpO1xuICAgICAgICBpZiAoc3BsaXR0ZWQubGVuZ3RoIDwgMikgcmV0dXJuIG51bGw7XG4gICAgICAgIHZhciBleHBJZCA9IHNwbGl0dGVkWzBdO1xuICAgICAgICB2YXIgdmFySW5kZXggPSBwYXJzZUludChzcGxpdHRlZFsxXSwgMTApO1xuICAgICAgICB2YXIgZXhwID0gdGhpcy5ydW5uaW5nLmZpbHRlcihmdW5jdGlvbihleHApIHtcbiAgICAgICAgICByZXR1cm4gZXhwLmdvb2dsZUlkKCkgPT0gZXhwSWQgJiYgZXhwLnZhcmlhdGlvbnMubGVuZ3RoID4gdmFySW5kZXg7XG4gICAgICAgIH0pWzBdO1xuICAgICAgICByZXR1cm4gZXhwID8gZXhwLnZhcmlhdGlvbnNbdmFySW5kZXhdLnJlZigpIDogbnVsbDtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gRXhwZXJpbWVudChkYXRhKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgICAgIHZhciB2YXJpYXRpb25zID0gW107XG4gICAgICAgIGRhdGEudmFyaWF0aW9ucyAmJiBkYXRhLnZhcmlhdGlvbnMuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICAgICAgICB2YXJpYXRpb25zLnB1c2gobmV3IFZhcmlhdGlvbih2KSk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnZhcmlhdGlvbnMgPSB2YXJpYXRpb25zO1xuICAgIH1cblxuICAgIEV4cGVyaW1lbnQucHJvdG90eXBlLmlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGEuaWQ7XG4gICAgfTtcblxuICAgIEV4cGVyaW1lbnQucHJvdG90eXBlLmdvb2dsZUlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGEuZ29vZ2xlSWQ7XG4gICAgfTtcblxuICAgIEV4cGVyaW1lbnQucHJvdG90eXBlLm5hbWUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5uYW1lO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBWYXJpYXRpb24oZGF0YSkge1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIH1cblxuICAgIFZhcmlhdGlvbi5wcm90b3R5cGUuaWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5pZDtcbiAgICB9O1xuXG4gICAgVmFyaWF0aW9uLnByb3RvdHlwZS5yZWYgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5yZWY7XG4gICAgfTtcblxuICAgIFZhcmlhdGlvbi5wcm90b3R5cGUubGFiZWwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5sYWJlbDtcbiAgICB9O1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIEV4cGVyaW1lbnRzLCBWYXJpYXRpb25cbn1cblxuIiwiXG5cInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgV2l0aEZyYWdtZW50cyB9IGZyb20gJy4vZG9jdW1lbnRzJztcblxuXG4gICAgLyoqXG4gICAgICogRW1ib2RpZXMgYSBwbGFpbiB0ZXh0IGZyYWdtZW50IChiZXdhcmU6IG5vdCBhIHN0cnVjdHVyZWQgdGV4dClcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKiBAZ2xvYmFsXG4gICAgICogQGFsaWFzIEZyYWdtZW50czpUZXh0XG4gICAgICovXG4gICAgZnVuY3Rpb24gVGV4dChkYXRhKSB7XG4gICAgICAgIHRoaXMudmFsdWUgPSBkYXRhO1xuICAgIH1cbiAgICBUZXh0LnByb3RvdHlwZSA9IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAgICAgICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIFwiPHNwYW4+XCIgKyB0aGlzLnZhbHVlICsgXCI8L3NwYW4+XCI7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRW1ib2RpZXMgYSBkb2N1bWVudCBsaW5rIGZyYWdtZW50IChhIGxpbmsgdGhhdCBpcyBpbnRlcm5hbCB0byBhIHByaXNtaWMuaW8gcmVwb3NpdG9yeSlcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKiBAZ2xvYmFsXG4gICAgICogQGFsaWFzIEZyYWdtZW50czpEb2N1bWVudExpbmtcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBEb2N1bWVudExpbmsoZGF0YSkge1xuICAgICAgICB0aGlzLnZhbHVlID0gZGF0YTtcblxuICAgICAgICB0aGlzLmRvY3VtZW50ID0gZGF0YS5kb2N1bWVudDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBmaWVsZFxuICAgICAgICAgKiBAZGVzY3JpcHRpb24gdGhlIGxpbmtlZCBkb2N1bWVudCBpZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pZCA9IGRhdGEuZG9jdW1lbnQuaWQ7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBsaW5rZWQgZG9jdW1lbnQgdWlkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnVpZCA9IGRhdGEuZG9jdW1lbnQudWlkO1xuICAgICAgICAvKipcbiAgICAgICAgICogQGZpZWxkXG4gICAgICAgICAqIEBkZXNjcmlwdGlvbiB0aGUgbGlua2VkIGRvY3VtZW50IHRhZ3NcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudGFncyA9IGRhdGEuZG9jdW1lbnQudGFncztcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBmaWVsZFxuICAgICAgICAgKiBAZGVzY3JpcHRpb24gdGhlIGxpbmtlZCBkb2N1bWVudCBzbHVnXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNsdWcgPSBkYXRhLmRvY3VtZW50LnNsdWc7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBsaW5rZWQgZG9jdW1lbnQgdHlwZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50eXBlID0gZGF0YS5kb2N1bWVudC50eXBlO1xuXG4gICAgICAgIHZhciBmcmFnbWVudHNEYXRhID0ge307XG4gICAgICAgIGlmIChkYXRhLmRvY3VtZW50LmRhdGEpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGZpZWxkIGluIGRhdGEuZG9jdW1lbnQuZGF0YVtkYXRhLmRvY3VtZW50LnR5cGVdKSB7XG4gICAgICAgICAgICAgICAgZnJhZ21lbnRzRGF0YVtkYXRhLmRvY3VtZW50LnR5cGUgKyAnLicgKyBmaWVsZF0gPSBkYXRhLmRvY3VtZW50LmRhdGFbZGF0YS5kb2N1bWVudC50eXBlXVtmaWVsZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBmaWVsZFxuICAgICAgICAgKiBAZGVzY3JpcHRpb24gdGhlIGZyYWdtZW50IGxpc3QsIGlmIHRoZSBmZXRjaExpbmtzIHBhcmFtZXRlciB3YXMgdXNlZCBpbiBhdCBxdWVyeSB0aW1lXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmZyYWdtZW50cyA9IHBhcnNlRnJhZ21lbnRzKGZyYWdtZW50c0RhdGEpO1xuICAgICAgICAvKipcbiAgICAgICAgICogQGZpZWxkXG4gICAgICAgICAqIEBkZXNjcmlwdGlvbiB0cnVlIGlmIHRoZSBsaW5rIGlzIGJyb2tlbiwgZmFsc2Ugb3RoZXJ3aXNlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmlzQnJva2VuID0gZGF0YS5pc0Jyb2tlbjtcbiAgICB9XG5cbiAgICBEb2N1bWVudExpbmsucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShXaXRoRnJhZ21lbnRzLnByb3RvdHlwZSk7XG5cbiAgICAvKipcbiAgICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAgICpcbiAgICAgKiBAcGFyYW1zIHtvYmplY3R9IGN0eCAtIG1hbmRhdG9yeSBjdHggb2JqZWN0LCB3aXRoIGEgdXNlYWJsZSBsaW5rUmVzb2x2ZXIgZnVuY3Rpb24gKHBsZWFzZSByZWFkIHByaXNtaWMuaW8gb25saW5lIGRvY3VtZW50YXRpb24gYWJvdXQgdGhpcylcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAgICovXG4gICAgRG9jdW1lbnRMaW5rLnByb3RvdHlwZS5hc0h0bWwgPSBmdW5jdGlvbiAoY3R4KSB7XG4gICAgICAgIHJldHVybiBcIjxhIGhyZWY9XFxcIlwiK3RoaXMudXJsKGN0eCkrXCJcXFwiPlwiK3RoaXMudXJsKGN0eCkrXCI8L2E+XCI7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIFVSTCBvZiB0aGUgZG9jdW1lbnQgbGluay5cbiAgICAgKlxuICAgICAqIEBwYXJhbXMge29iamVjdH0gbGlua1Jlc29sdmVyIC0gbWFuZGF0b3J5IGxpbmtSZXNvbHZlciBmdW5jdGlvbiAocGxlYXNlIHJlYWQgcHJpc21pYy5pbyBvbmxpbmUgZG9jdW1lbnRhdGlvbiBhYm91dCB0aGlzKVxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gdGhlIHByb3BlciBVUkwgdG8gdXNlXG4gICAgICovXG4gICAgRG9jdW1lbnRMaW5rLnByb3RvdHlwZS51cmwgPSBmdW5jdGlvbiAobGlua1Jlc29sdmVyKSB7XG4gICAgICAgIHJldHVybiBsaW5rUmVzb2x2ZXIodGhpcywgdGhpcy5pc0Jyb2tlbik7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICAgKi9cbiAgICBEb2N1bWVudExpbmsucHJvdG90eXBlLmFzVGV4dCA9IGZ1bmN0aW9uKGxpbmtSZXNvbHZlcikge1xuICAgICAgICByZXR1cm4gdGhpcy51cmwobGlua1Jlc29sdmVyKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRW1ib2RpZXMgYSB3ZWIgbGluayBmcmFnbWVudFxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBnbG9iYWxcbiAgICAgKiBAYWxpYXMgRnJhZ21lbnRzOldlYkxpbmtcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBXZWJMaW5rKGRhdGEpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBmaWVsZFxuICAgICAgICAgKiBAZGVzY3JpcHRpb24gdGhlIEpTT04gb2JqZWN0IGV4YWN0bHkgYXMgaXMgcmV0dXJuZWQgaW4gdGhlIFwiZGF0YVwiIGZpZWxkIG9mIHRoZSBKU09OIHJlc3BvbnNlcyAoc2VlIEFQSSBkb2N1bWVudGF0aW9uOiBodHRwczovL2RldmVsb3BlcnMucHJpc21pYy5pby9kb2N1bWVudGF0aW9uL1VqQmU4YkdJSjNFS3RnQlovYXBpLWRvY3VtZW50YXRpb24janNvbi1yZXNwb25zZXMpXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnZhbHVlID0gZGF0YTtcbiAgICB9XG4gICAgV2ViTGluay5wcm90b3R5cGUgPSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgICAgICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBcIjxhIGhyZWY9XFxcIlwiK3RoaXMudXJsKCkrXCJcXFwiPlwiK3RoaXMudXJsKCkrXCI8L2E+XCI7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBVUkwgb2YgdGhlIGxpbmsuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gdGhlIHByb3BlciBVUkwgdG8gdXNlXG4gICAgICAgICAqL1xuICAgICAgICB1cmw6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWUudXJsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudXJsKCk7XG4gICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEVtYm9kaWVzIGEgZmlsZSBsaW5rIGZyYWdtZW50XG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGdsb2JhbFxuICAgICAqIEBhbGlhcyBGcmFnbWVudHM6RmlsZUxpbmtcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBGaWxlTGluayhkYXRhKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBKU09OIG9iamVjdCBleGFjdGx5IGFzIGlzIHJldHVybmVkIGluIHRoZSBcImRhdGFcIiBmaWVsZCBvZiB0aGUgSlNPTiByZXNwb25zZXMgKHNlZSBBUEkgZG9jdW1lbnRhdGlvbjogaHR0cHM6Ly9kZXZlbG9wZXJzLnByaXNtaWMuaW8vZG9jdW1lbnRhdGlvbi9VakJlOGJHSUozRUt0Z0JaL2FwaS1kb2N1bWVudGF0aW9uI2pzb24tcmVzcG9uc2VzKVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy52YWx1ZSA9IGRhdGE7XG4gICAgfVxuICAgIEZpbGVMaW5rLnByb3RvdHlwZSA9IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAgICAgICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIFwiPGEgaHJlZj1cXFwiXCIrdGhpcy51cmwoKStcIlxcXCI+XCIrdGhpcy52YWx1ZS5maWxlLm5hbWUrXCI8L2E+XCI7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBVUkwgb2YgdGhlIGxpbmsuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gdGhlIHByb3BlciBVUkwgdG8gdXNlXG4gICAgICAgICAqL1xuICAgICAgICB1cmw6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWUuZmlsZS51cmw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy51cmwoKTtcbiAgICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRW1ib2RpZXMgYW4gaW1hZ2UgbGluayBmcmFnbWVudFxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBnbG9iYWxcbiAgICAgKiBAYWxpYXMgRnJhZ21lbnRzOkltYWdlTGlua1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIEltYWdlTGluayhkYXRhKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBKU09OIG9iamVjdCBleGFjdGx5IGFzIGlzIHJldHVybmVkIGluIHRoZSBcImRhdGFcIiBmaWVsZCBvZiB0aGUgSlNPTiByZXNwb25zZXMgKHNlZSBBUEkgZG9jdW1lbnRhdGlvbjogaHR0cHM6Ly9kZXZlbG9wZXJzLnByaXNtaWMuaW8vZG9jdW1lbnRhdGlvbi9VakJlOGJHSUozRUt0Z0JaL2FwaS1kb2N1bWVudGF0aW9uI2pzb24tcmVzcG9uc2VzKVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy52YWx1ZSA9IGRhdGE7XG4gICAgfVxuICAgIEltYWdlTGluay5wcm90b3R5cGUgPSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgICAgICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBcIjxhIGhyZWY9XFxcIlwiK3RoaXMudXJsKCkrXCJcXFwiPjxpbWcgc3JjPVxcXCJcIit0aGlzLnVybCgpK1wiXFxcIiBhbHQ9XFxcIlwiICsgdGhpcy5hbHQgKyBcIlxcXCI+PC9hPlwiO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyB0aGUgVVJMIG9mIHRoZSBsaW5rLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIHRoZSBwcm9wZXIgVVJMIHRvIHVzZVxuICAgICAgICAgKi9cbiAgICAgICAgdXJsOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlLmltYWdlLnVybDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnVybCgpO1xuICAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFbWJvZGllcyBhIHNlbGVjdCBmcmFnbWVudFxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBnbG9iYWxcbiAgICAgKiBAYWxpYXMgRnJhZ21lbnRzOlNlbGVjdFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNlbGVjdChkYXRhKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSB0ZXh0IHZhbHVlIG9mIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy52YWx1ZSA9IGRhdGE7XG4gICAgfVxuICAgIFNlbGVjdC5wcm90b3R5cGUgPSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgICAgICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBcIjxzcGFuPlwiICsgdGhpcy52YWx1ZSArIFwiPC9zcGFuPlwiO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWU7XG4gICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEVtYm9kaWVzIGEgY29sb3IgZnJhZ21lbnRcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKiBAZ2xvYmFsXG4gICAgICogQGFsaWFzIEZyYWdtZW50czpDb2xvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIENvbG9yKGRhdGEpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBmaWVsZFxuICAgICAgICAgKiBAZGVzY3JpcHRpb24gdGhlIHRleHQgdmFsdWUgb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnZhbHVlID0gZGF0YTtcbiAgICB9XG4gICAgQ29sb3IucHJvdG90eXBlID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gXCI8c3Bhbj5cIiArIHRoaXMudmFsdWUgKyBcIjwvc3Bhbj5cIjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlO1xuICAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFbWJvZGllcyBhIGdlb3BvaW50XG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGdsb2JhbFxuICAgICAqIEBhbGlhcyBGcmFnbWVudHM6R2VvUG9pbnRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBHZW9Qb2ludChkYXRhKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBsYXRpdHVkZSBvZiB0aGUgZ2VvIHBvaW50XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxhdGl0dWRlID0gZGF0YS5sYXRpdHVkZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBmaWVsZFxuICAgICAgICAgKiBAZGVzY3JpcHRpb24gdGhlIGxvbmdpdHVkZSBvZiB0aGUgZ2VvIHBvaW50XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvbmdpdHVkZSA9IGRhdGEubG9uZ2l0dWRlO1xuICAgIH1cblxuICAgIEdlb1BvaW50LnByb3RvdHlwZSA9IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAgICAgICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICc8ZGl2IGNsYXNzPVwiZ2VvcG9pbnRcIj48c3BhbiBjbGFzcz1cImxhdGl0dWRlXCI+JyArIHRoaXMubGF0aXR1ZGUgKyAnPC9zcGFuPjxzcGFuIGNsYXNzPVwibG9uZ2l0dWRlXCI+JyArIHRoaXMubG9uZ2l0dWRlICsgJzwvc3Bhbj48L2Rpdj4nO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gJygnICsgdGhpcy5sYXRpdHVkZSArIFwiLFwiICsgdGhpcy5sb25naXR1ZGUgKyAnKSc7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRW1ib2RpZXMgYSBOdW1iZXIgZnJhZ21lbnRcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKiBAZ2xvYmFsXG4gICAgICogQGFsaWFzIEZyYWdtZW50czpOdW1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBOdW0oZGF0YSkge1xuICAgICAgICAvKipcbiAgICAgICAgICogQGZpZWxkXG4gICAgICAgICAqIEBkZXNjcmlwdGlvbiB0aGUgaW50ZWdlciB2YWx1ZSBvZiB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmFsdWUgPSBkYXRhO1xuICAgIH1cbiAgICBOdW0ucHJvdG90eXBlID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gXCI8c3Bhbj5cIiArIHRoaXMudmFsdWUgKyBcIjwvc3Bhbj5cIjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEVtYm9kaWVzIGEgRGF0ZSBmcmFnbWVudFxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBnbG9iYWxcbiAgICAgKiBAYWxpYXMgRnJhZ21lbnRzOkRhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBEYXRlRnJhZ21lbnQoZGF0YSkge1xuICAgICAgICAvKipcbiAgICAgICAgICogQGZpZWxkXG4gICAgICAgICAqIEBkZXNjcmlwdGlvbiB0aGUgRGF0ZSB2YWx1ZSBvZiB0aGUgZnJhZ21lbnQgKGFzIGEgcmVndWxhciBKUyBEYXRlIG9iamVjdClcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmFsdWUgPSBuZXcgRGF0ZShkYXRhKTtcbiAgICB9XG5cbiAgICBEYXRlRnJhZ21lbnQucHJvdG90eXBlID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gXCI8dGltZT5cIiArIHRoaXMudmFsdWUgKyBcIjwvdGltZT5cIjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEVtYm9kaWVzIGEgVGltZXN0YW1wIGZyYWdtZW50XG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGdsb2JhbFxuICAgICAqIEBhbGlhcyBGcmFnbWVudHM6VGltZXN0YW1wXG4gICAgICovXG4gICAgZnVuY3Rpb24gVGltZXN0YW1wKGRhdGEpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBmaWVsZFxuICAgICAgICAgKiBAZGVzY3JpcHRpb24gdGhlIERhdGUgdmFsdWUgb2YgdGhlIGZyYWdtZW50IChhcyBhIHJlZ3VsYXIgSlMgRGF0ZSBvYmplY3QpXG4gICAgICAgICAqL1xuICAgICAgICAvLyBBZGRpbmcgXCI6XCIgaW4gdGhlIGxvY2FsZSBpZiBuZWVkZWQsIHNvIEpTIGNvbnNpZGVycyBpdCBJU084NjAxLWNvbXBsaWFudFxuICAgICAgICB2YXIgY29ycmVjdElzbzg2MDFEYXRlID0gKGRhdGEubGVuZ3RoID09IDI0KSA/IGRhdGEuc3Vic3RyaW5nKDAsIDIyKSArICc6JyArIGRhdGEuc3Vic3RyaW5nKDIyLCAyNCkgOiBkYXRhO1xuICAgICAgICB0aGlzLnZhbHVlID0gbmV3IERhdGUoY29ycmVjdElzbzg2MDFEYXRlKTtcbiAgICB9XG5cbiAgICBUaW1lc3RhbXAucHJvdG90eXBlID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gXCI8dGltZT5cIiArIHRoaXMudmFsdWUgKyBcIjwvdGltZT5cIjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEVtYm9kaWVzIGFuIGVtYmVkIGZyYWdtZW50XG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGdsb2JhbFxuICAgICAqIEBhbGlhcyBGcmFnbWVudHM6RW1iZWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBFbWJlZChkYXRhKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBKU09OIG9iamVjdCBleGFjdGx5IGFzIGlzIHJldHVybmVkIGluIHRoZSBcImRhdGFcIiBmaWVsZCBvZiB0aGUgSlNPTiByZXNwb25zZXMgKHNlZSBBUEkgZG9jdW1lbnRhdGlvbjogaHR0cHM6Ly9kZXZlbG9wZXJzLnByaXNtaWMuaW8vZG9jdW1lbnRhdGlvbi9VakJlOGJHSUozRUt0Z0JaL2FwaS1kb2N1bWVudGF0aW9uI2pzb24tcmVzcG9uc2VzKVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy52YWx1ZSA9IGRhdGE7XG4gICAgfVxuXG4gICAgRW1iZWQucHJvdG90eXBlID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZS5vZW1iZWQuaHRtbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFbWJvZGllcyBhbiBJbWFnZSBmcmFnbWVudFxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBnbG9iYWxcbiAgICAgKiBAYWxpYXMgRnJhZ21lbnRzOkltYWdlRWxcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBJbWFnZUVsKG1haW4sIHZpZXdzKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBtYWluIEltYWdlVmlldyBmb3IgdGhpcyBpbWFnZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tYWluID0gbWFpbjtcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSB1cmwgb2YgdGhlIG1haW4gSW1hZ2VWaWV3IGZvciB0aGlzIGltYWdlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnVybCA9IG1haW4udXJsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIGFuIGFycmF5IG9mIGFsbCB0aGUgb3RoZXIgSW1hZ2VWaWV3cyBmb3IgdGhpcyBpbWFnZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy52aWV3cyA9IHZpZXdzIHx8IHt9O1xuICAgIH1cbiAgICBJbWFnZUVsLnByb3RvdHlwZSA9IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldHMgdGhlIHZpZXcgb2YgdGhlIGltYWdlLCBmcm9tIGl0cyBuYW1lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gdGhlIG5hbWUgb2YgdGhlIHZpZXcgdG8gZ2V0XG4gICAgICAgICAqIEByZXR1cm5zIHtJbWFnZVZpZXd9IC0gdGhlIHByb3BlciB2aWV3XG4gICAgICAgICAqL1xuICAgICAgICBnZXRWaWV3OiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICBpZiAobmFtZSA9PT0gXCJtYWluXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYWluO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy52aWV3c1tuYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAgICAgICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWFpbi5hc0h0bWwoKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFbWJvZGllcyBhbiBpbWFnZSB2aWV3IChhbiBpbWFnZSBpbiBwcmlzbWljLmlvIGNhbiBiZSBkZWZpbmVkIHdpdGggc2V2ZXJhbCBkaWZmZXJlbnQgdGh1bWJuYWlsIHNpemVzLCBlYWNoIHNpemUgaXMgY2FsbGVkIGEgXCJ2aWV3XCIpXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGdsb2JhbFxuICAgICAqIEBhbGlhcyBGcmFnbWVudHM6SW1hZ2VWaWV3XG4gICAgICovXG4gICAgZnVuY3Rpb24gSW1hZ2VWaWV3KHVybCwgd2lkdGgsIGhlaWdodCwgYWx0KSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBVUkwgb2YgdGhlIEltYWdlVmlldyAodXNlYWJsZSBhcyBpdCwgaW4gYSA8aW1nPiB0YWcgaW4gSFRNTCwgZm9yIGluc3RhbmNlKVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy51cmwgPSB1cmw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSB3aWR0aCBvZiB0aGUgSW1hZ2VWaWV3XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLndpZHRoID0gd2lkdGg7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBoZWlnaHQgb2YgdGhlIEltYWdlVmlld1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZmllbGRcbiAgICAgICAgICogQGRlc2NyaXB0aW9uIHRoZSBhbHQgdGV4dCBmb3IgdGhlIEltYWdlVmlld1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5hbHQgPSBhbHQ7XG4gICAgfVxuICAgIEltYWdlVmlldy5wcm90b3R5cGUgPSB7XG4gICAgICAgIHJhdGlvOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy53aWR0aCAvIHRoaXMuaGVpZ2h0O1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gXCI8aW1nIHNyYz1cXFwiXCIgKyB0aGlzLnVybCArIFwiXFxcIiB3aWR0aD1cXFwiXCIgKyB0aGlzLndpZHRoICsgXCJcXFwiIGhlaWdodD1cXFwiXCIgKyB0aGlzLmhlaWdodCArIFwiXFxcIiBhbHQ9XFxcIlwiICsgdGhpcy5hbHQgKyBcIlxcXCI+XCI7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJcIjtcbiAgICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRW1ib2RpZXMgYSBmcmFnbWVudCBvZiB0eXBlIFwiR3JvdXBcIiAod2hpY2ggaXMgYSBncm91cCBvZiBzdWJmcmFnbWVudHMpXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGdsb2JhbFxuICAgICAqIEBhbGlhcyBGcmFnbWVudHM6R3JvdXBcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBHcm91cChkYXRhKSB7XG4gICAgICAgIHRoaXMudmFsdWUgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlLnB1c2gobmV3IEdsb2JhbC5QcmlzbWljLkdyb3VwRG9jKGRhdGFbaV0pKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBHcm91cC5wcm90b3R5cGUgPSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgICAgICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgICAgICAgKiBAcGFyYW1zIHtmdW5jdGlvbn0gbGlua1Jlc29sdmVyIC0gbGlua1Jlc29sdmVyIGZ1bmN0aW9uIChwbGVhc2UgcmVhZCBwcmlzbWljLmlvIG9ubGluZSBkb2N1bWVudGF0aW9uIGFib3V0IHRoaXMpXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgIGFzSHRtbDogZnVuY3Rpb24obGlua1Jlc29sdmVyKSB7XG4gICAgICAgICAgICB2YXIgb3V0cHV0ID0gXCJcIjtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy52YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG91dHB1dCArPSB0aGlzLnZhbHVlW2ldLmFzSHRtbChsaW5rUmVzb2x2ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFR1cm5zIHRoZSBHcm91cCBmcmFnbWVudCBpbnRvIGFuIGFycmF5IGluIG9yZGVyIHRvIGFjY2VzcyBpdHMgaXRlbXMgKGdyb3VwcyBvZiBmcmFnbWVudHMpLFxuICAgICAgICAgKiBvciB0byBsb29wIHRocm91Z2ggdGhlbS5cbiAgICAgICAgICogQHBhcmFtcyB7b2JqZWN0fSBjdHggLSBtYW5kYXRvcnkgY3R4IG9iamVjdCwgd2l0aCBhIHVzZWFibGUgbGlua1Jlc29sdmVyIGZ1bmN0aW9uIChwbGVhc2UgcmVhZCBwcmlzbWljLmlvIG9ubGluZSBkb2N1bWVudGF0aW9uIGFib3V0IHRoaXMpXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gLSB0aGUgYXJyYXkgb2YgZ3JvdXBzLCBlYWNoIGdyb3VwIGJlaW5nIGEgSlNPTiBvYmplY3Qgd2l0aCBzdWJmcmFnbWVudCBuYW1lIGFzIGtleXMsIGFuZCBzdWJmcmFnbWVudCBhcyB2YWx1ZXNcbiAgICAgICAgICovXG4gICAgICAgIHRvQXJyYXk6IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICBhc1RleHQ6IGZ1bmN0aW9uKGxpbmtSZXNvbHZlcikge1xuICAgICAgICAgICAgdmFyIG91dHB1dCA9IFwiXCI7XG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy52YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG91dHB1dCArPSB0aGlzLnZhbHVlW2ldLmFzVGV4dChsaW5rUmVzb2x2ZXIpICsgJ1xcbic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICB9LFxuXG4gICAgICAgIGdldEZpcnN0SW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9BcnJheSgpLnJlZHVjZShmdW5jdGlvbihpbWFnZSwgZnJhZ21lbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW1hZ2UpIHJldHVybiBpbWFnZTtcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0SW1hZ2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBudWxsKTtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXRGaXJzdFRpdGxlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvQXJyYXkoKS5yZWR1Y2UoZnVuY3Rpb24oc3QsIGZyYWdtZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0KSByZXR1cm4gc3Q7XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmcmFnbWVudC5nZXRGaXJzdFRpdGxlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgbnVsbCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0Rmlyc3RQYXJhZ3JhcGg6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9BcnJheSgpLnJlZHVjZShmdW5jdGlvbihzdCwgZnJhZ21lbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3QpIHJldHVybiBzdDtcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0UGFyYWdyYXBoKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBFbWJvZGllcyBhIHN0cnVjdHVyZWQgdGV4dCBmcmFnbWVudFxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBnbG9iYWxcbiAgICAgKiBAYWxpYXMgRnJhZ21lbnRzOlN0cnVjdHVyZWRUZXh0XG4gICAgICovXG4gICAgZnVuY3Rpb24gU3RydWN0dXJlZFRleHQoYmxvY2tzKSB7XG5cbiAgICAgICAgdGhpcy5ibG9ja3MgPSBibG9ja3M7XG5cbiAgICB9XG5cbiAgICBTdHJ1Y3R1cmVkVGV4dC5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm5zIHtvYmplY3R9IHRoZSBmaXJzdCBoZWFkaW5nIGJsb2NrIGluIHRoZSB0ZXh0XG4gICAgICAgICAqL1xuICAgICAgICBnZXRUaXRsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8dGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgICAgICAgICAgICBpZihibG9jay50eXBlLmluZGV4T2YoJ2hlYWRpbmcnKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYmxvY2s7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm5zIHtvYmplY3R9IHRoZSBmaXJzdCBibG9jayBvZiB0eXBlIHBhcmFncmFwaFxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0Rmlyc3RQYXJhZ3JhcGg6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8dGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgICAgICAgICAgICBpZihibG9jay50eXBlID09ICdwYXJhZ3JhcGgnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBibG9jaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybnMge2FycmF5fSBhbGwgcGFyYWdyYXBoc1xuICAgICAgICAgKi9cbiAgICAgICAgZ2V0UGFyYWdyYXBoczogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgcGFyYWdyYXBocyA9IFtdO1xuICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8dGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgICAgICAgICAgICBpZihibG9jay50eXBlID09ICdwYXJhZ3JhcGgnKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFncmFwaHMucHVzaChibG9jayk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHBhcmFncmFwaHM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm5zIHtvYmplY3R9IHRoZSBudGggcGFyYWdyYXBoXG4gICAgICAgICAqL1xuICAgICAgICBnZXRQYXJhZ3JhcGg6IGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmdldFBhcmFncmFwaHMoKVtuXTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybnMge29iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGdldEZpcnN0SW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8dGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgICAgICAgICAgICBpZihibG9jay50eXBlID09ICdpbWFnZScpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBJbWFnZVZpZXcoXG4gICAgICAgICAgICAgICAgICAgICAgICBibG9jay51cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBibG9jay5kaW1lbnNpb25zLndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2suZGltZW5zaW9ucy5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICBibG9jay5hbHRcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICAgICAgICogQHBhcmFtcyB7ZnVuY3Rpb259IGxpbmtSZXNvbHZlciAtIHBsZWFzZSByZWFkIHByaXNtaWMuaW8gb25saW5lIGRvY3VtZW50YXRpb24gYWJvdXQgbGluayByZXNvbHZlcnNcbiAgICAgICAgICogQHBhcmFtcyB7ZnVuY3Rpb259IGh0bWxTZXJpYWxpemVyIG9wdGlvbmFsIEhUTUwgc2VyaWFsaXplciB0byBjdXN0b21pemUgdGhlIG91dHB1dFxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICBhc0h0bWw6IGZ1bmN0aW9uKGxpbmtSZXNvbHZlciwgaHRtbFNlcmlhbGl6ZXIpIHtcbiAgICAgICAgICAgIHZhciBibG9ja0dyb3VwcyA9IFtdLFxuICAgICAgICAgICAgICAgIGJsb2NrR3JvdXAsXG4gICAgICAgICAgICAgICAgYmxvY2ssXG4gICAgICAgICAgICAgICAgaHRtbCA9IFtdO1xuICAgICAgICAgICAgaWYgKCFpc0Z1bmN0aW9uKGxpbmtSZXNvbHZlcikpIHtcbiAgICAgICAgICAgICAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdpdGggdGhlIG9sZCBjdHggYXJndW1lbnRcbiAgICAgICAgICAgICAgICB2YXIgY3R4ID0gbGlua1Jlc29sdmVyO1xuICAgICAgICAgICAgICAgIGxpbmtSZXNvbHZlciA9IGZ1bmN0aW9uKGRvYywgaXNCcm9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN0eC5saW5rUmVzb2x2ZXIoY3R4LCBkb2MsIGlzQnJva2VuKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodGhpcy5ibG9ja3MpKSB7XG5cbiAgICAgICAgICAgICAgICBmb3IodmFyIGk9MDsgaSA8IHRoaXMuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2NrID0gdGhpcy5ibG9ja3NbaV07XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUmVzb2x2ZSBpbWFnZSBsaW5rc1xuICAgICAgICAgICAgICAgICAgICBpZiAoYmxvY2sudHlwZSA9PSBcImltYWdlXCIgJiYgYmxvY2subGlua1RvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGluayA9IGluaXRGaWVsZChibG9jay5saW5rVG8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2subGlua1VybCA9IGxpbmsudXJsKGxpbmtSZXNvbHZlcik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoYmxvY2sudHlwZSAhPT0gXCJsaXN0LWl0ZW1cIiAmJiBibG9jay50eXBlICE9PSBcIm8tbGlzdC1pdGVtXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGl0J3Mgbm90IGEgdHlwZSB0aGF0IGdyb3Vwc1xuICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2tHcm91cHMucHVzaChibG9jayk7XG4gICAgICAgICAgICAgICAgICAgICAgICBibG9ja0dyb3VwID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICghYmxvY2tHcm91cCB8fCBibG9ja0dyb3VwLnR5cGUgIT0gKFwiZ3JvdXAtXCIgKyBibG9jay50eXBlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaXQncyBhIG5ldyB0eXBlIG9yIG5vIEJsb2NrR3JvdXAgd2FzIHNldCBzbyBmYXJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrR3JvdXAgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJncm91cC1cIiArIGJsb2NrLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2tzOiBbYmxvY2tdXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2tHcm91cHMucHVzaChibG9ja0dyb3VwKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGl0J3MgdGhlIHNhbWUgdHlwZSBhcyBiZWZvcmUsIG5vIHRvdWNoaW5nIGJsb2NrR3JvdXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrR3JvdXAuYmxvY2tzLnB1c2goYmxvY2spO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIGJsb2NrQ29udGVudCA9IGZ1bmN0aW9uKGJsb2NrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjb250ZW50ID0gXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJsb2NrLmJsb2Nrcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2suYmxvY2tzLmZvckVhY2goZnVuY3Rpb24gKGJsb2NrMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50ICsgc2VyaWFsaXplKGJsb2NrMiwgYmxvY2tDb250ZW50KGJsb2NrMiksIGh0bWxTZXJpYWxpemVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudCA9IGluc2VydFNwYW5zKGJsb2NrLnRleHQsIGJsb2NrLnNwYW5zLCBsaW5rUmVzb2x2ZXIsIGh0bWxTZXJpYWxpemVyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgYmxvY2tHcm91cHMuZm9yRWFjaChmdW5jdGlvbiAoYmxvY2tHcm91cCkge1xuICAgICAgICAgICAgICAgICAgICBodG1sLnB1c2goc2VyaWFsaXplKGJsb2NrR3JvdXAsIGJsb2NrQ29udGVudChibG9ja0dyb3VwKSwgaHRtbFNlcmlhbGl6ZXIpKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gaHRtbC5qb2luKCcnKTtcblxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIG91dHB1dCA9IFtdO1xuICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8dGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoYmxvY2sudGV4dCkge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChibG9jay50ZXh0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb3V0cHV0LmpvaW4oJyAnKTtcbiAgICAgICAgIH1cblxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBodG1sRXNjYXBlKGlucHV0KSB7XG4gICAgICAgIHJldHVybiBpbnB1dCAmJiBpbnB1dC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIilcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxuL2csIFwiPGJyPlwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXJzZXMgYSBibG9jayB0aGF0IGhhcyBzcGFucywgYW5kIGluc2VydHMgdGhlIHByb3BlciBIVE1MIGNvZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAtIHRoZSBvcmlnaW5hbCB0ZXh0IG9mIHRoZSBibG9ja1xuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzcGFucyAtIHRoZSBzcGFucyBhcyByZXR1cm5lZCBieSB0aGUgQVBJXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGxpbmtSZXNvbHZlciAtIHRoZSBmdW5jdGlvbiB0byBidWlsZCBsaW5rcyB0aGF0IG1heSBiZSBpbiB0aGUgZnJhZ21lbnQgKHBsZWFzZSByZWFkIHByaXNtaWMuaW8ncyBvbmxpbmUgZG9jdW1lbnRhdGlvbiBhYm91dCB0aGlzKVxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGh0bWxTZXJpYWxpemVyIC0gb3B0aW9uYWwgc2VyaWFsaXplclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gdGhlIEhUTUwgb3V0cHV0XG4gICAgICovXG4gICAgZnVuY3Rpb24gaW5zZXJ0U3BhbnModGV4dCwgc3BhbnMsIGxpbmtSZXNvbHZlciwgaHRtbFNlcmlhbGl6ZXIpIHtcbiAgICAgICAgaWYgKCFzcGFucyB8fCAhc3BhbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gaHRtbEVzY2FwZSh0ZXh0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB0YWdzU3RhcnQgPSB7fTtcbiAgICAgICAgdmFyIHRhZ3NFbmQgPSB7fTtcblxuICAgICAgICBzcGFucy5mb3JFYWNoKGZ1bmN0aW9uIChzcGFuKSB7XG4gICAgICAgICAgICBpZiAoIXRhZ3NTdGFydFtzcGFuLnN0YXJ0XSkgeyB0YWdzU3RhcnRbc3Bhbi5zdGFydF0gPSBbXTsgfVxuICAgICAgICAgICAgaWYgKCF0YWdzRW5kW3NwYW4uZW5kXSkgeyB0YWdzRW5kW3NwYW4uZW5kXSA9IFtdOyB9XG5cbiAgICAgICAgICAgIHRhZ3NTdGFydFtzcGFuLnN0YXJ0XS5wdXNoKHNwYW4pO1xuICAgICAgICAgICAgdGFnc0VuZFtzcGFuLmVuZF0udW5zaGlmdChzcGFuKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIGM7XG4gICAgICAgIHZhciBodG1sID0gXCJcIjtcbiAgICAgICAgdmFyIHN0YWNrID0gW107XG4gICAgICAgIGZvciAodmFyIHBvcyA9IDAsIGxlbiA9IHRleHQubGVuZ3RoICsgMTsgcG9zIDwgbGVuOyBwb3MrKykgeyAvLyBMb29waW5nIHRvIGxlbmd0aCArIDEgdG8gY2F0Y2ggY2xvc2luZyB0YWdzXG4gICAgICAgICAgICBpZiAodGFnc0VuZFtwb3NdKSB7XG4gICAgICAgICAgICAgICAgdGFnc0VuZFtwb3NdLmZvckVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBDbG9zZSBhIHRhZ1xuICAgICAgICAgICAgICAgICAgICB2YXIgdGFnID0gc3RhY2sucG9wKCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIENvbnRpbnVlIG9ubHkgaWYgYmxvY2sgY29udGFpbnMgY29udGVudC5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0YWcgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdmFyIGlubmVySHRtbCA9IHNlcmlhbGl6ZSh0YWcuc3BhbiwgdGFnLnRleHQsIGh0bWxTZXJpYWxpemVyKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZSB0YWcgd2FzIHRvcCBsZXZlbFxuICAgICAgICAgICAgICAgICAgICAgICAgICBodG1sICs9IGlubmVySHRtbDtcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBZGQgdGhlIGNvbnRlbnQgdG8gdGhlIHBhcmVudCB0YWdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0udGV4dCArPSBpbm5lckh0bWw7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGFnc1N0YXJ0W3Bvc10pIHtcbiAgICAgICAgICAgICAgICAvLyBTb3J0IGJpZ2dlciB0YWdzIGZpcnN0IHRvIGVuc3VyZSB0aGUgcmlnaHQgdGFnIGhpZXJhcmNoeVxuICAgICAgICAgICAgICAgIHRhZ3NTdGFydFtwb3NdLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChiLmVuZCAtIGIuc3RhcnQpIC0gKGEuZW5kIC0gYS5zdGFydCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGFnc1N0YXJ0W3Bvc10uZm9yRWFjaChmdW5jdGlvbiAoc3Bhbikge1xuICAgICAgICAgICAgICAgICAgICAvLyBPcGVuIGEgdGFnXG4gICAgICAgICAgICAgICAgICAgIHZhciB1cmwgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3Bhbi50eXBlID09IFwiaHlwZXJsaW5rXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmcmFnbWVudCA9IGluaXRGaWVsZChzcGFuLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZyYWdtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsID0gZnJhZ21lbnQudXJsKGxpbmtSZXNvbHZlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25zb2xlICYmIGNvbnNvbGUuZXJyb3IpIGNvbnNvbGUuZXJyb3IoJ0ltcG9zc2libGUgdG8gY29udmVydCBzcGFuLmRhdGEgYXMgYSBGcmFnbWVudCcsIHNwYW4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHNwYW4udXJsID0gdXJsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHZhciBlbHQgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGFuOiBzcGFuLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dDogXCJcIlxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBzdGFjay5wdXNoKGVsdCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocG9zIDwgdGV4dC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBjID0gdGV4dFtwb3NdO1xuICAgICAgICAgICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVG9wLWxldmVsIHRleHRcbiAgICAgICAgICAgICAgICAgICAgaHRtbCArPSBodG1sRXNjYXBlKGMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIElubmVyIHRleHQgb2YgYSBzcGFuXG4gICAgICAgICAgICAgICAgICAgIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLnRleHQgKz0gaHRtbEVzY2FwZShjKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaHRtbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbWJvZGllcyBhIFNsaWNlIGZyYWdtZW50XG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGdsb2JhbFxuICAgICAqIEBhbGlhcyBGcmFnbWVudHM6U2xpY2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBTbGljZShzbGljZVR5cGUsIGxhYmVsLCB2YWx1ZSkge1xuICAgICAgICB0aGlzLnNsaWNlVHlwZSA9IHNsaWNlVHlwZTtcbiAgICAgICAgdGhpcy5sYWJlbCA9IGxhYmVsO1xuICAgICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgU2xpY2UucHJvdG90eXBlID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgYXNIdG1sOiBmdW5jdGlvbiAobGlua1Jlc29sdmVyKSB7XG4gICAgICAgICAgICB2YXIgY2xhc3NlcyA9IFsnc2xpY2UnXTtcbiAgICAgICAgICAgIGlmICh0aGlzLmxhYmVsKSBjbGFzc2VzLnB1c2godGhpcy5sYWJlbCk7XG4gICAgICAgICAgICByZXR1cm4gJzxkaXYgZGF0YS1zbGljZXR5cGU9XCInICsgdGhpcy5zbGljZVR5cGUgKyAnXCIgY2xhc3M9XCInICsgY2xhc3Nlcy5qb2luKCcgJykgKyAnXCI+JyArXG4gICAgICAgICAgICAgICAgICAgdGhpcy52YWx1ZS5hc0h0bWwobGlua1Jlc29sdmVyKSArXG4gICAgICAgICAgICAgICAgICAgJzwvZGl2Pic7XG5cbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAgICAgICAqL1xuICAgICAgICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWUuYXNUZXh0KCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldCB0aGUgZmlyc3QgSW1hZ2UgaW4gc2xpY2UuXG4gICAgICAgICAqIEByZXR1cm5zIHtvYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBnZXRGaXJzdEltYWdlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBmcmFnbWVudCA9IHRoaXMudmFsdWU7XG4gICAgICAgICAgICBpZih0eXBlb2YgZnJhZ21lbnQuZ2V0Rmlyc3RJbWFnZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0SW1hZ2UoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiAgR2xvYmFsLlByaXNtaWMuRnJhZ21lbnRzLkltYWdlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgICAgICAgICAgfSBlbHNlIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIGdldEZpcnN0VGl0bGU6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGZyYWdtZW50ID0gdGhpcy52YWx1ZTtcbiAgICAgICAgICAgIGlmKHR5cGVvZiBmcmFnbWVudC5nZXRGaXJzdFRpdGxlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0Rmlyc3RUaXRsZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mICBHbG9iYWwuUHJpc21pYy5GcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0VGl0bGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXRGaXJzdFBhcmFncmFwaDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLnZhbHVlO1xuICAgICAgICAgICAgaWYodHlwZW9mIGZyYWdtZW50LmdldEZpcnN0UGFyYWdyYXBoID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0Rmlyc3RQYXJhZ3JhcGgoKTtcbiAgICAgICAgICAgIH0gZWxzZSByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFbWJvZGllcyBhIFNsaWNlWm9uZSBmcmFnbWVudFxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBnbG9iYWxcbiAgICAgKiBAYWxpYXMgRnJhZ21lbnRzOlNsaWNlWm9uZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNsaWNlWm9uZShkYXRhKSB7XG4gICAgICAgIHRoaXMudmFsdWUgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgc2xpY2VUeXBlID0gZGF0YVtpXVsnc2xpY2VfdHlwZSddO1xuICAgICAgICAgICAgdmFyIGZyYWdtZW50ID0gaW5pdEZpZWxkKGRhdGFbaV1bJ3ZhbHVlJ10pO1xuICAgICAgICAgICAgdmFyIGxhYmVsID0gZGF0YVtpXVsnc2xpY2VfbGFiZWwnXSB8fCBudWxsO1xuICAgICAgICAgICAgaWYgKHNsaWNlVHlwZSAmJiBmcmFnbWVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMudmFsdWUucHVzaChuZXcgU2xpY2Uoc2xpY2VUeXBlLCBsYWJlbCwgZnJhZ21lbnQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNsaWNlcyA9IHRoaXMudmFsdWU7XG4gICAgfVxuXG4gICAgU2xpY2Vab25lLnByb3RvdHlwZSA9IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAgICAgICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICAgICAgICovXG4gICAgICAgIGFzSHRtbDogZnVuY3Rpb24gKGxpbmtSZXNvbHZlcikge1xuICAgICAgICAgICAgdmFyIG91dHB1dCA9IFwiXCI7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBvdXRwdXQgKz0gdGhpcy52YWx1ZVtpXS5hc0h0bWwobGlua1Jlc29sdmVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgICAgICAgKi9cbiAgICAgICAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBvdXRwdXQgPSBcIlwiO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ICs9IHRoaXMudmFsdWVbaV0uYXNUZXh0KCkgKyAnXFxuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0Rmlyc3RJbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZS5yZWR1Y2UoZnVuY3Rpb24oaW1hZ2UsIHNsaWNlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGltYWdlKSByZXR1cm4gaW1hZ2U7XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzbGljZS5nZXRGaXJzdEltYWdlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgbnVsbCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0Rmlyc3RUaXRsZTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZS5yZWR1Y2UoZnVuY3Rpb24odGV4dCwgc2xpY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAodGV4dCkgcmV0dXJuIHRleHQ7XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzbGljZS5nZXRGaXJzdFRpdGxlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgbnVsbCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0Rmlyc3RQYXJhZ3JhcGg6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWUucmVkdWNlKGZ1bmN0aW9uKHBhcmFncmFwaCwgc2xpY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAocGFyYWdyYXBoKSByZXR1cm4gcGFyYWdyYXBoO1xuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2xpY2UuZ2V0Rmlyc3RQYXJhZ3JhcGgoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBudWxsKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGcm9tIGEgZnJhZ21lbnQncyBuYW1lLCBjYXN0cyBpdCBpbnRvIHRoZSBwcm9wZXIgb2JqZWN0IHR5cGUgKGxpa2UgUHJpc21pYy5GcmFnbWVudHMuU3RydWN0dXJlZFRleHQpXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZCAtIHRoZSBmcmFnbWVudCdzIG5hbWVcbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSAtIHRoZSBvYmplY3Qgb2YgdGhlIHByb3BlciBGcmFnbWVudHMgdHlwZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpbml0RmllbGQoZmllbGQpIHtcblxuICAgICAgICB2YXIgY2xhc3NGb3JUeXBlID0ge1xuICAgICAgICAgICAgXCJDb2xvclwiOiBDb2xvcixcbiAgICAgICAgICAgIFwiTnVtYmVyXCI6IE51bSxcbiAgICAgICAgICAgIFwiRGF0ZVwiOiBEYXRlRnJhZ21lbnQsXG4gICAgICAgICAgICBcIlRpbWVzdGFtcFwiOiBUaW1lc3RhbXAsXG4gICAgICAgICAgICBcIlRleHRcIjogVGV4dCxcbiAgICAgICAgICAgIFwiRW1iZWRcIjogRW1iZWQsXG4gICAgICAgICAgICBcIkdlb1BvaW50XCI6IEdlb1BvaW50LFxuICAgICAgICAgICAgXCJTZWxlY3RcIjogU2VsZWN0LFxuICAgICAgICAgICAgXCJTdHJ1Y3R1cmVkVGV4dFwiOiBTdHJ1Y3R1cmVkVGV4dCxcbiAgICAgICAgICAgIFwiTGluay5kb2N1bWVudFwiOiBEb2N1bWVudExpbmssXG4gICAgICAgICAgICBcIkxpbmsud2ViXCI6IFdlYkxpbmssXG4gICAgICAgICAgICBcIkxpbmsuZmlsZVwiOiBGaWxlTGluayxcbiAgICAgICAgICAgIFwiTGluay5pbWFnZVwiOiBJbWFnZUxpbmssXG4gICAgICAgICAgICBcIkdyb3VwXCI6IEdyb3VwLFxuICAgICAgICAgICAgXCJTbGljZVpvbmVcIjogU2xpY2Vab25lXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGNsYXNzRm9yVHlwZVtmaWVsZC50eXBlXSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBjbGFzc0ZvclR5cGVbZmllbGQudHlwZV0oZmllbGQudmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZpZWxkLnR5cGUgPT09IFwiSW1hZ2VcIikge1xuICAgICAgICAgICAgdmFyIGltZyA9IGZpZWxkLnZhbHVlLm1haW47XG4gICAgICAgICAgICB2YXIgb3V0cHV0ID0gbmV3IEltYWdlRWwoXG4gICAgICAgICAgICAgICAgbmV3IEltYWdlVmlldyhcbiAgICAgICAgICAgICAgICAgICAgaW1nLnVybCxcbiAgICAgICAgICAgICAgICAgICAgaW1nLmRpbWVuc2lvbnMud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgIGltZy5kaW1lbnNpb25zLmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgaW1nLmFsdFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAge31cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIGZpZWxkLnZhbHVlLnZpZXdzKSB7XG4gICAgICAgICAgICAgICAgaW1nID0gZmllbGQudmFsdWUudmlld3NbbmFtZV07XG4gICAgICAgICAgICAgICAgb3V0cHV0LnZpZXdzW25hbWVdID0gbmV3IEltYWdlVmlldyhcbiAgICAgICAgICAgICAgICAgICAgaW1nLnVybCxcbiAgICAgICAgICAgICAgICAgICAgaW1nLmRpbWVuc2lvbnMud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgIGltZy5kaW1lbnNpb25zLmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgaW1nLmFsdFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbnNvbGUgJiYgY29uc29sZS5sb2cpIGNvbnNvbGUubG9nKFwiRnJhZ21lbnQgdHlwZSBub3Qgc3VwcG9ydGVkOiBcIiwgZmllbGQudHlwZSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VGcmFnbWVudHMoanNvbikge1xuICAgICAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBqc29uKSB7XG4gICAgICAgICAgICBpZiAoanNvbi5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoanNvbltrZXldKSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRba2V5XSA9IGpzb25ba2V5XS5tYXAoZnVuY3Rpb24gKGZyYWdtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5pdEZpZWxkKGZyYWdtZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBpbml0RmllbGQoanNvbltrZXldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGlzRnVuY3Rpb24oZikge1xuICAgICAgICB2YXIgZ2V0VHlwZSA9IHt9O1xuICAgICAgICByZXR1cm4gZiAmJiBnZXRUeXBlLnRvU3RyaW5nLmNhbGwoZikgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2VyaWFsaXplKGVsZW1lbnQsIGNvbnRlbnQsIGh0bWxTZXJpYWxpemVyKSB7XG4gICAgICAgIC8vIFJldHVybiB0aGUgdXNlciBjdXN0b21pemVkIG91dHB1dCAoaWYgYXZhaWxhYmxlKVxuICAgICAgICBpZiAoaHRtbFNlcmlhbGl6ZXIpIHtcbiAgICAgICAgICAgIHZhciBjdXN0b20gPSBodG1sU2VyaWFsaXplcihlbGVtZW50LCBjb250ZW50KTtcbiAgICAgICAgICAgIGlmIChjdXN0b20pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3VzdG9tO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmFsbCBiYWNrIHRvIHRoZSBkZWZhdWx0IEhUTUwgb3V0cHV0XG4gICAgICAgIHZhciBUQUdfTkFNRVMgPSB7XG4gICAgICAgICAgICBcImhlYWRpbmcxXCI6IFwiaDFcIixcbiAgICAgICAgICAgIFwiaGVhZGluZzJcIjogXCJoMlwiLFxuICAgICAgICAgICAgXCJoZWFkaW5nM1wiOiBcImgzXCIsXG4gICAgICAgICAgICBcImhlYWRpbmc0XCI6IFwiaDRcIixcbiAgICAgICAgICAgIFwiaGVhZGluZzVcIjogXCJoNVwiLFxuICAgICAgICAgICAgXCJoZWFkaW5nNlwiOiBcImg2XCIsXG4gICAgICAgICAgICBcInBhcmFncmFwaFwiOiBcInBcIixcbiAgICAgICAgICAgIFwicHJlZm9ybWF0dGVkXCI6IFwicHJlXCIsXG4gICAgICAgICAgICBcImxpc3QtaXRlbVwiOiBcImxpXCIsXG4gICAgICAgICAgICBcIm8tbGlzdC1pdGVtXCI6IFwibGlcIixcbiAgICAgICAgICAgIFwiZ3JvdXAtbGlzdC1pdGVtXCI6IFwidWxcIixcbiAgICAgICAgICAgIFwiZ3JvdXAtby1saXN0LWl0ZW1cIjogXCJvbFwiLFxuICAgICAgICAgICAgXCJzdHJvbmdcIjogXCJzdHJvbmdcIixcbiAgICAgICAgICAgIFwiZW1cIjogXCJlbVwiXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKFRBR19OQU1FU1tlbGVtZW50LnR5cGVdKSB7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IFRBR19OQU1FU1tlbGVtZW50LnR5cGVdO1xuICAgICAgICAgICAgdmFyIGNsYXNzQ29kZSA9IGVsZW1lbnQubGFiZWwgPyAoJyBjbGFzcz1cIicgKyBlbGVtZW50LmxhYmVsICsgJ1wiJykgOiAnJztcbiAgICAgICAgICAgIHJldHVybiAnPCcgKyBuYW1lICsgY2xhc3NDb2RlICsgJz4nICsgY29udGVudCArICc8LycgKyBuYW1lICsgJz4nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVsZW1lbnQudHlwZSA9PSBcImltYWdlXCIpIHtcbiAgICAgICAgICAgIHZhciBsYWJlbCA9IGVsZW1lbnQubGFiZWwgPyAoXCIgXCIgKyBlbGVtZW50LmxhYmVsKSA6IFwiXCI7XG4gICAgICAgICAgICB2YXIgaW1nVGFnID0gJzxpbWcgc3JjPVwiJyArIGVsZW1lbnQudXJsICsgJ1wiIGFsdD1cIicgKyBlbGVtZW50LmFsdCArICdcIj4nO1xuICAgICAgICAgICAgcmV0dXJuICc8cCBjbGFzcz1cImJsb2NrLWltZycgKyBsYWJlbCArICdcIj4nICtcbiAgICAgICAgICAgICAgICAoZWxlbWVudC5saW5rVXJsID8gKCc8YSBocmVmPVwiJyArIGVsZW1lbnQubGlua1VybCArICdcIj4nICsgaW1nVGFnICsgJzwvYT4nKSA6IGltZ1RhZykgK1xuICAgICAgICAgICAgICAgICc8L3A+JztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbGVtZW50LnR5cGUgPT0gXCJlbWJlZFwiKSB7XG4gICAgICAgICAgICByZXR1cm4gJzxkaXYgZGF0YS1vZW1iZWQ9XCInKyBlbGVtZW50LmVtYmVkX3VybCArXG4gICAgICAgICAgICAgICAgJ1wiIGRhdGEtb2VtYmVkLXR5cGU9XCInKyBlbGVtZW50LnR5cGUgK1xuICAgICAgICAgICAgICAgICdcIiBkYXRhLW9lbWJlZC1wcm92aWRlcj1cIicrIGVsZW1lbnQucHJvdmlkZXJfbmFtZSArXG4gICAgICAgICAgICAgICAgKGVsZW1lbnQubGFiZWwgPyAoJ1wiIGNsYXNzPVwiJyArIGVsZW1lbnQubGFiZWwpIDogJycpICtcbiAgICAgICAgICAgICAgICAnXCI+JyArIGVsZW1lbnQub2VtYmVkLmh0bWwrXCI8L2Rpdj5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbGVtZW50LnR5cGUgPT09ICdoeXBlcmxpbmsnKSB7XG4gICAgICAgICAgICByZXR1cm4gJzxhIGhyZWY9XCInICsgZWxlbWVudC51cmwgKyAnXCI+JyArIGNvbnRlbnQgKyAnPC9hPic7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZWxlbWVudC50eXBlID09PSAnbGFiZWwnKSB7XG4gICAgICAgICAgICByZXR1cm4gJzxzcGFuIGNsYXNzPVwiJyArIGVsZW1lbnQuZGF0YS5sYWJlbCArICdcIj4nICsgY29udGVudCArICc8L3NwYW4+JztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBcIjwhLS0gV2FybmluZzogXCIgKyBlbGVtZW50LnR5cGUgKyBcIiBub3QgaW1wbGVtZW50ZWQuIFVwZ3JhZGUgdGhlIERldmVsb3BlciBLaXQuIC0tPlwiICsgY29udGVudDtcbiAgICB9XG5cbiAgICBleHBvcnQgZGVmYXVsdCB7XG4gICAgICAgIEVtYmVkOiBFbWJlZCxcbiAgICAgICAgSW1hZ2U6IEltYWdlRWwsXG4gICAgICAgIEltYWdlVmlldzogSW1hZ2VWaWV3LFxuICAgICAgICBUZXh0OiBUZXh0LFxuICAgICAgICBOdW1iZXI6IE51bSxcbiAgICAgICAgRGF0ZTogRGF0ZUZyYWdtZW50LFxuICAgICAgICBUaW1lc3RhbXA6IFRpbWVzdGFtcCxcbiAgICAgICAgU2VsZWN0OiBTZWxlY3QsXG4gICAgICAgIENvbG9yOiBDb2xvcixcbiAgICAgICAgU3RydWN0dXJlZFRleHQ6IFN0cnVjdHVyZWRUZXh0LFxuICAgICAgICBXZWJMaW5rOiBXZWJMaW5rLFxuICAgICAgICBEb2N1bWVudExpbms6IERvY3VtZW50TGluayxcbiAgICAgICAgSW1hZ2VMaW5rOiBJbWFnZUxpbmssXG4gICAgICAgIEZpbGVMaW5rOiBGaWxlTGluayxcbiAgICAgICAgR3JvdXA6IEdyb3VwLFxuICAgICAgICBHZW9Qb2ludDogR2VvUG9pbnQsXG4gICAgICAgIFNsaWNlOiBTbGljZSxcbiAgICAgICAgU2xpY2Vab25lOiBTbGljZVpvbmUsXG4gICAgICAgIGluaXRGaWVsZDogaW5pdEZpZWxkLFxuICAgICAgICBwYXJzZUZyYWdtZW50czogcGFyc2VGcmFnbWVudHMsXG4gICAgICAgIGluc2VydFNwYW5zOiBpbnNlcnRTcGFuc1xuICAgIH07XG5cbiIsIlxuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgLyoqXG4gICAgICogQGdsb2JhbFxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKiBAYWxpYXMgUHJlZGljYXRlc1xuICAgICAqL1xuICAgIGNvbnN0IHByZWRpY2F0ZXMgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJ1aWxkIGFuIFwiYXRcIiBwcmVkaWNhdGU6IGVxdWFsaXR5IG9mIGEgZnJhZ21lbnQgdG8gYSB2YWx1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5hdChcImRvY3VtZW50LnR5cGVcIiwgXCJhcnRpY2xlXCIpXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gdmFsdWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICAgICAgICovXG4gICAgICAgIGF0OiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWUpIHsgcmV0dXJuIFtcImF0XCIsIGZyYWdtZW50LCB2YWx1ZV07IH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJ1aWxkIGFuIFwibm90XCIgcHJlZGljYXRlOiBpbmVxdWFsaXR5IG9mIGEgZnJhZ21lbnQgdG8gYSB2YWx1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5ub3QoXCJkb2N1bWVudC50eXBlXCIsIFwiYXJ0aWNsZVwiKVxuICAgICAgICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIHZhbHVlIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAgICAgICAqL1xuICAgICAgICBub3Q6IGZ1bmN0aW9uKGZyYWdtZW50LCB2YWx1ZSkgeyByZXR1cm4gW1wibm90XCIsIGZyYWdtZW50LCB2YWx1ZV07IH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJ1aWxkIGEgXCJtaXNzaW5nXCIgcHJlZGljYXRlOiBkb2N1bWVudHMgd2hlcmUgdGhlIHJlcXVlc3RlZCBmaWVsZCBpcyBlbXB0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLm1pc3NpbmcoXCJteS5ibG9nLXBvc3QuYXV0aG9yXCIpXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgICAgICAgKi9cbiAgICAgICAgbWlzc2luZzogZnVuY3Rpb24oZnJhZ21lbnQpIHsgcmV0dXJuIFtcIm1pc3NpbmdcIiwgZnJhZ21lbnRdOyB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCdWlsZCBhIFwiaGFzXCIgcHJlZGljYXRlOiBkb2N1bWVudHMgd2hlcmUgdGhlIHJlcXVlc3RlZCBmaWVsZCBpcyBkZWZpbmVkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuaGFzKFwibXkuYmxvZy1wb3N0LmF1dGhvclwiKVxuICAgICAgICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICAgICAgICovXG4gICAgICAgIGhhczogZnVuY3Rpb24oZnJhZ21lbnQpIHsgcmV0dXJuIFtcImhhc1wiLCBmcmFnbWVudF07IH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJ1aWxkIGFuIFwiYW55XCIgcHJlZGljYXRlOiBlcXVhbGl0eSBvZiBhIGZyYWdtZW50IHRvIGEgdmFsdWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuYW55KFwiZG9jdW1lbnQudHlwZVwiLCBbXCJhcnRpY2xlXCIsIFwiYmxvZy1wb3N0XCJdKVxuICAgICAgICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIHZhbHVlcyB7QXJyYXl9XG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAgICAgICAqL1xuICAgICAgICBhbnk6IGZ1bmN0aW9uKGZyYWdtZW50LCB2YWx1ZXMpIHsgcmV0dXJuIFtcImFueVwiLCBmcmFnbWVudCwgdmFsdWVzXTsgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQnVpbGQgYW4gXCJpblwiIHByZWRpY2F0ZTogZXF1YWxpdHkgb2YgYSBmcmFnbWVudCB0byBhIHZhbHVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmluKFwibXkucHJvZHVjdC5wcmljZVwiLCBbNCwgNV0pXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gdmFsdWVzIHtBcnJheX1cbiAgICAgICAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICAgICAgICovXG4gICAgICAgIGluOiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWVzKSB7IHJldHVybiBbXCJpblwiLCBmcmFnbWVudCwgdmFsdWVzXTsgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQnVpbGQgYSBcImZ1bGx0ZXh0XCIgcHJlZGljYXRlOiBmdWxsdGV4dCBzZWFyY2ggaW4gYSBmcmFnbWVudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5mdWxsdGV4dChcIm15LmFydGljbGUuYm9keVwiLCBcInNhdXNhZ2VcIl0pXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gdmFsdWUge1N0cmluZ30gdGhlIHRlcm0gdG8gc2VhcmNoXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAgICAgICAqL1xuICAgICAgICBmdWxsdGV4dDogZnVuY3Rpb24oZnJhZ21lbnQsIHZhbHVlKSB7IHJldHVybiBbXCJmdWxsdGV4dFwiLCBmcmFnbWVudCwgdmFsdWVdOyB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCdWlsZCBhIFwic2ltaWxhclwiIHByZWRpY2F0ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5zaW1pbGFyKFwiVVhhc2RGd2U0MkRcIiwgMTApXG4gICAgICAgICAqIEBwYXJhbSBkb2N1bWVudElkIHtTdHJpbmd9IHRoZSBkb2N1bWVudCBpZCB0byByZXRyaWV2ZSBzaW1pbGFyIGRvY3VtZW50cyB0by5cbiAgICAgICAgICogQHBhcmFtIG1heFJlc3VsdHMge051bWJlcn0gdGhlIG1heGltdW0gbnVtYmVyIG9mIHJlc3VsdHMgdG8gcmV0dXJuXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAgICAgICAqL1xuICAgICAgICBzaW1pbGFyOiBmdW5jdGlvbihkb2N1bWVudElkLCBtYXhSZXN1bHRzKSB7IHJldHVybiBbXCJzaW1pbGFyXCIsIGRvY3VtZW50SWQsIG1heFJlc3VsdHNdOyB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCdWlsZCBhIFwibnVtYmVyLmd0XCIgcHJlZGljYXRlOiBkb2N1bWVudHMgd2hlcmUgdGhlIGZyYWdtZW50IGZpZWxkIGlzIGdyZWF0ZXIgdGhhbiB0aGUgZ2l2ZW4gdmFsdWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZ3QoXCJteS5wcm9kdWN0LnByaWNlXCIsIDEwKVxuICAgICAgICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ30gdGhlIG5hbWUgb2YgdGhlIGZpZWxkIC0gbXVzdCBiZSBhIG51bWJlci5cbiAgICAgICAgICogQHBhcmFtIHZhbHVlIHtOdW1iZXJ9IHRoZSBsb3dlciBib3VuZCBvZiB0aGUgcHJlZGljYXRlXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAgICAgICAqL1xuICAgICAgICBndDogZnVuY3Rpb24oZnJhZ21lbnQsIHZhbHVlKSB7IHJldHVybiBbXCJudW1iZXIuZ3RcIiwgZnJhZ21lbnQsIHZhbHVlXTsgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQnVpbGQgYSBcIm51bWJlci5sdFwiIHByZWRpY2F0ZTogZG9jdW1lbnRzIHdoZXJlIHRoZSBmcmFnbWVudCBmaWVsZCBpcyBsb3dlciB0aGFuIHRoZSBnaXZlbiB2YWx1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5sdChcIm15LnByb2R1Y3QucHJpY2VcIiwgMjApXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgZmllbGQgLSBtdXN0IGJlIGEgbnVtYmVyLlxuICAgICAgICAgKiBAcGFyYW0gdmFsdWUge051bWJlcn0gdGhlIHVwcGVyIGJvdW5kIG9mIHRoZSBwcmVkaWNhdGVcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICAgICAgICovXG4gICAgICAgIGx0OiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWUpIHsgcmV0dXJuIFtcIm51bWJlci5sdFwiLCBmcmFnbWVudCwgdmFsdWVdOyB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCdWlsZCBhIFwibnVtYmVyLmluUmFuZ2VcIiBwcmVkaWNhdGU6IGNvbWJpbmF0aW9uIG9mIGx0IGFuZCBndC5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5pblJhbmdlKFwibXkucHJvZHVjdC5wcmljZVwiLCAxMCwgMjApXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgZmllbGQgLSBtdXN0IGJlIGEgbnVtYmVyLlxuICAgICAgICAgKiBAcGFyYW0gYmVmb3JlIHtOdW1iZXJ9XG4gICAgICAgICAqIEBwYXJhbSBhZnRlciB7TnVtYmVyfVxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgICAgICAgKi9cbiAgICAgICAgaW5SYW5nZTogZnVuY3Rpb24oZnJhZ21lbnQsIGJlZm9yZSwgYWZ0ZXIpIHsgcmV0dXJuIFtcIm51bWJlci5pblJhbmdlXCIsIGZyYWdtZW50LCBiZWZvcmUsIGFmdGVyXTsgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQnVpbGQgYSBcImRhdGUuYmVmb3JlXCIgcHJlZGljYXRlOiBkb2N1bWVudHMgd2hlcmUgdGhlIGZyYWdtZW50IGZpZWxkIGlzIGJlZm9yZSB0aGUgZ2l2ZW4gZGF0ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXRlQmVmb3JlKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCBuZXcgRGF0ZSgyMDE0LCA2LCAxKSlcbiAgICAgICAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9IHRoZSBuYW1lIG9mIHRoZSBmaWVsZCAtIG11c3QgYmUgYSBkYXRlIG9yIHRpbWVzdGFtcCBmaWVsZC5cbiAgICAgICAgICogQHBhcmFtIGJlZm9yZSB7RGF0ZX1cbiAgICAgICAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICAgICAgICovXG4gICAgICAgIGRhdGVCZWZvcmU6IGZ1bmN0aW9uKGZyYWdtZW50LCBiZWZvcmUpIHsgcmV0dXJuIFtcImRhdGUuYmVmb3JlXCIsIGZyYWdtZW50LCBiZWZvcmVdOyB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCdWlsZCBhIFwiZGF0ZS5hZnRlclwiIHByZWRpY2F0ZTogZG9jdW1lbnRzIHdoZXJlIHRoZSBmcmFnbWVudCBmaWVsZCBpcyBhZnRlciB0aGUgZ2l2ZW4gZGF0ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXRlQWZ0ZXIoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIG5ldyBEYXRlKDIwMTQsIDEsIDEpKVxuICAgICAgICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ30gdGhlIG5hbWUgb2YgdGhlIGZpZWxkIC0gbXVzdCBiZSBhIGRhdGUgb3IgdGltZXN0YW1wIGZpZWxkLlxuICAgICAgICAgKiBAcGFyYW0gYWZ0ZXIge0RhdGV9XG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAgICAgICAqL1xuICAgICAgICBkYXRlQWZ0ZXI6IGZ1bmN0aW9uKGZyYWdtZW50LCBhZnRlcikgeyByZXR1cm4gW1wiZGF0ZS5hZnRlclwiLCBmcmFnbWVudCwgYWZ0ZXJdOyB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCdWlsZCBhIFwiZGF0ZS5iZXR3ZWVuXCIgcHJlZGljYXRlOiBjb21iaW5hdGlvbiBvZiBkYXRlQmVmb3JlIGFuZCBkYXRlQWZ0ZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXRlQmV0d2VlbihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgbmV3IERhdGUoMjAxNCwgMSwgMSksIG5ldyBEYXRlKDIwMTQsIDYsIDEpKVxuICAgICAgICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ30gdGhlIG5hbWUgb2YgdGhlIGZpZWxkIC0gbXVzdCBiZSBhIGRhdGUgb3IgdGltZXN0YW1wIGZpZWxkLlxuICAgICAgICAgKiBAcGFyYW0gYmVmb3JlIHtEYXRlfVxuICAgICAgICAgKiBAcGFyYW0gYWZ0ZXIge0RhdGV9XG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAgICAgICAqL1xuICAgICAgICBkYXRlQmV0d2VlbjogZnVuY3Rpb24oZnJhZ21lbnQsIGJlZm9yZSwgYWZ0ZXIpIHsgcmV0dXJuIFtcImRhdGUuYmV0d2VlblwiLCBmcmFnbWVudCwgYmVmb3JlLCBhZnRlcl07IH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF5T2ZNb250aChcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMTQpXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudFxuICAgICAgICAgKiBAcGFyYW0gZGF5IHtOdW1iZXJ9IGJldHdlZW4gMSBhbmQgMzFcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgZGF5T2ZNb250aDogZnVuY3Rpb24oZnJhZ21lbnQsIGRheSkgeyByZXR1cm4gW1wiZGF0ZS5kYXktb2YtbW9udGhcIiwgZnJhZ21lbnQsIGRheV07IH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF5T2ZNb250aEFmdGVyKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCAxNClcbiAgICAgICAgICogQHBhcmFtIGZyYWdtZW50XG4gICAgICAgICAqIEBwYXJhbSBkYXkge051bWJlcn0gYmV0d2VlbiAxIGFuZCAzMVxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBkYXlPZk1vbnRoQWZ0ZXI6IGZ1bmN0aW9uKGZyYWdtZW50LCBkYXkpIHsgcmV0dXJuIFtcImRhdGUuZGF5LW9mLW1vbnRoLWFmdGVyXCIsIGZyYWdtZW50LCBkYXldOyB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmRheU9mTW9udGhCZWZvcmUoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDE0KVxuICAgICAgICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICAgICAgICogQHBhcmFtIGRheSB7TnVtYmVyfSBiZXR3ZWVuIDEgYW5kIDMxXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIGRheU9mTW9udGhCZWZvcmU6IGZ1bmN0aW9uKGZyYWdtZW50LCBkYXkpIHsgcmV0dXJuIFtcImRhdGUuZGF5LW9mLW1vbnRoLWJlZm9yZVwiLCBmcmFnbWVudCwgZGF5XTsgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXlPZldlZWsoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDE0KVxuICAgICAgICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICAgICAgICogQHBhcmFtIGRheSB7TnVtYmVyfFN0cmluZ30gTnVtYmVyIGJldHdlZW4gMSBhbmQgNyBvciBzdHJpbmcgYmV0d2VlbiBcIk1vbmRheVwiIGFuZCBcIlN1bmRheVwiXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIGRheU9mV2VlazogZnVuY3Rpb24oZnJhZ21lbnQsIGRheSkgeyByZXR1cm4gW1wiZGF0ZS5kYXktb2Ytd2Vla1wiLCBmcmFnbWVudCwgZGF5XTsgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXlPZldlZWtBZnRlcihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgXCJXZWRuZXNkYXlcIilcbiAgICAgICAgICogQHBhcmFtIGZyYWdtZW50XG4gICAgICAgICAqIEBwYXJhbSBkYXkge051bWJlcnxTdHJpbmd9IE51bWJlciBiZXR3ZWVuIDEgYW5kIDcgb3Igc3RyaW5nIGJldHdlZW4gXCJNb25kYXlcIiBhbmQgXCJTdW5kYXlcIlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBkYXlPZldlZWtBZnRlcjogZnVuY3Rpb24oZnJhZ21lbnQsIGRheSkgeyByZXR1cm4gW1wiZGF0ZS5kYXktb2Ytd2Vlay1hZnRlclwiLCBmcmFnbWVudCwgZGF5XTsgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXlPZldlZWtCZWZvcmUoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIFwiV2VkbmVzZGF5XCIpXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudFxuICAgICAgICAgKiBAcGFyYW0gZGF5IHtOdW1iZXJ8U3RyaW5nfSBOdW1iZXIgYmV0d2VlbiAxIGFuZCA3IG9yIHN0cmluZyBiZXR3ZWVuIFwiTW9uZGF5XCIgYW5kIFwiU3VuZGF5XCJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgZGF5T2ZXZWVrQmVmb3JlOiBmdW5jdGlvbihmcmFnbWVudCwgZGF5KSB7IHJldHVybiBbXCJkYXRlLmRheS1vZi13ZWVrLWJlZm9yZVwiLCBmcmFnbWVudCwgZGF5XTsgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5tb250aChcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgXCJKdW5lXCIpXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudFxuICAgICAgICAgKiBAcGFyYW0gbW9udGgge051bWJlcnxTdHJpbmd9IE51bWJlciBiZXR3ZWVuIDEgYW5kIDEyIG9yIHN0cmluZyBiZXR3ZWVuIFwiSmFudWFyeVwiIGFuZCBcIkRlY2VtYmVyXCJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgbW9udGg6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb250aCkgeyByZXR1cm4gW1wiZGF0ZS5tb250aFwiLCBmcmFnbWVudCwgbW9udGhdOyB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLm1vbnRoQmVmb3JlKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCBcIkp1bmVcIilcbiAgICAgICAgICogQHBhcmFtIGZyYWdtZW50XG4gICAgICAgICAqIEBwYXJhbSBtb250aCB7TnVtYmVyfFN0cmluZ30gTnVtYmVyIGJldHdlZW4gMSBhbmQgMTIgb3Igc3RyaW5nIGJldHdlZW4gXCJKYW51YXJ5XCIgYW5kIFwiRGVjZW1iZXJcIlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBtb250aEJlZm9yZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vbnRoKSB7IHJldHVybiBbXCJkYXRlLm1vbnRoLWJlZm9yZVwiLCBmcmFnbWVudCwgbW9udGhdOyB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLm1vbnRoQWZ0ZXIoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIFwiSnVuZVwiKVxuICAgICAgICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICAgICAgICogQHBhcmFtIG1vbnRoIHtOdW1iZXJ8U3RyaW5nfSBOdW1iZXIgYmV0d2VlbiAxIGFuZCAxMiBvciBzdHJpbmcgYmV0d2VlbiBcIkphbnVhcnlcIiBhbmQgXCJEZWNlbWJlclwiXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgbW9udGhBZnRlcjogZnVuY3Rpb24oZnJhZ21lbnQsIG1vbnRoKSB7IHJldHVybiBbXCJkYXRlLm1vbnRoLWFmdGVyXCIsIGZyYWdtZW50LCBtb250aF07IH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlIFByZWRpY2F0ZXMueWVhcihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMjAxNClcbiAgICAgICAgICogQHBhcmFtIGZyYWdtZW50XG4gICAgICAgICAqIEBwYXJhbSB5ZWFyIHtOdW1iZXJ9XG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIHllYXI6IGZ1bmN0aW9uKGZyYWdtZW50LCB5ZWFyKSB7IHJldHVybiBbXCJkYXRlLnllYXJcIiwgZnJhZ21lbnQsIHllYXJdOyB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmhvdXIoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDEyKVxuICAgICAgICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICAgICAgICogQHBhcmFtIGhvdXIge051bWJlcn1cbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgaG91cjogZnVuY3Rpb24oZnJhZ21lbnQsIGhvdXIpIHsgcmV0dXJuIFtcImRhdGUuaG91clwiLCBmcmFnbWVudCwgaG91cl07IH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuaG91ckJlZm9yZShcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMTIpXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudFxuICAgICAgICAgKiBAcGFyYW0gaG91ciB7TnVtYmVyfVxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBob3VyQmVmb3JlOiBmdW5jdGlvbihmcmFnbWVudCwgaG91cikgeyByZXR1cm4gW1wiZGF0ZS5ob3VyLWJlZm9yZVwiLCBmcmFnbWVudCwgaG91cl07IH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuaG91ckFmdGVyKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCAxMilcbiAgICAgICAgICogQHBhcmFtIGZyYWdtZW50XG4gICAgICAgICAqIEBwYXJhbSBob3VyIHtOdW1iZXJ9XG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIGhvdXJBZnRlcjogZnVuY3Rpb24oZnJhZ21lbnQsIGhvdXIpIHsgcmV0dXJuIFtcImRhdGUuaG91ci1hZnRlclwiLCBmcmFnbWVudCwgaG91cl07IH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlIFByZWRpY2F0ZXMubmVhcihcIm15LnN0b3JlLmxvY2F0aW9uXCIsIDQ4Ljg3Njg3NjcsIDIuMzMzODgwMiwgMTApXG4gICAgICAgICAqIEBwYXJhbSBmcmFnbWVudFxuICAgICAgICAgKiBAcGFyYW0gbGF0aXR1ZGUge051bWJlcn1cbiAgICAgICAgICogQHBhcmFtIGxvbmdpdHVkZSB7TnVtYmVyfVxuICAgICAgICAgKiBAcGFyYW0gcmFkaXVzIHtOdW1iZXJ9IGluIGtpbG9tZXRlcnNcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgbmVhcjogZnVuY3Rpb24oZnJhZ21lbnQsIGxhdGl0dWRlLCBsb25naXR1ZGUsIHJhZGl1cykgeyByZXR1cm4gW1wiZ2VvcG9pbnQubmVhclwiLCBmcmFnbWVudCwgbGF0aXR1ZGUsIGxvbmdpdHVkZSwgcmFkaXVzXTsgfVxuXG4gICAgfTtcblxuZXhwb3J0IGRlZmF1bHQgcHJlZGljYXRlcztcblxuIiwiXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICB2YXIgY3JlYXRlRXJyb3IgPSBmdW5jdGlvbihzdGF0dXMsIG1lc3NhZ2UpIHtcbiAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgZXJyLnN0YXR1cyA9IHN0YXR1cztcbiAgICAgICAgcmV0dXJuIGVycjtcbiAgICB9O1xuXG4gICAgLy8gLS0gUmVxdWVzdCBoYW5kbGVyc1xuXG4gICAgdmFyIGFqYXhSZXF1ZXN0ID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICBpZih0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT0gJ3VuZGVmaW5lZCcgJiYgJ3dpdGhDcmVkZW50aWFscycgaW4gbmV3IFhNTEh0dHBSZXF1ZXN0KCkpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG5cbiAgICAgICAgICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgICAgICAgICAvLyBDYWxsZWQgb24gc3VjY2Vzc1xuICAgICAgICAgICAgICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0dGwsIGNhY2hlQ29udHJvbCA9IC9tYXgtYWdlXFxzKj1cXHMqKFxcZCspLy5leGVjKFxuICAgICAgICAgICAgICAgICAgICAgICAgeGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDYWNoZS1Db250cm9sJykpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FjaGVDb250cm9sICYmIGNhY2hlQ29udHJvbC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0dGwgPSBwYXJzZUludChjYWNoZUNvbnRyb2xbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpLCB4aHIsIHR0bCk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIENhbGxlZCBvbiBlcnJvclxuICAgICAgICAgICAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN0YXR1cyA9IHhoci5zdGF0dXM7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKHN0YXR1cywgXCJVbmV4cGVjdGVkIHN0YXR1cyBjb2RlIFtcIiArIHN0YXR1cyArIFwiXSBvbiBVUkwgXCIrdXJsKSwgbnVsbCwgeGhyKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgLy8gQmluZCB0aGUgWEhSIGZpbmlzaGVkIGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHhoci5zdGF0dXMgJiYgeGhyLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIE9wZW4gdGhlIFhIUlxuICAgICAgICAgICAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAgICAgICAgICAgLy8gS2l0IHZlcnNpb24gKGNhbid0IG92ZXJyaWRlIHRoZSB1c2VyLWFnZW50IGNsaWVudCBzaWRlKVxuICAgICAgICAgICAgICAgIC8vIHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiWC1QcmlzbWljLVVzZXItQWdlbnRcIiwgXCJQcmlzbWljLWphdmFzY3JpcHQta2l0LyVWRVJTSU9OJVwiLnJlcGxhY2UoXCIlVkVSU0lPTiVcIiwgR2xvYmFsLlByaXNtaWMudmVyc2lvbikpO1xuXG4gICAgICAgICAgICAgICAgLy8gSnNvbiByZXF1ZXN0XG4gICAgICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG5cbiAgICAgICAgICAgICAgICAvLyBTZW5kIHRoZSBYSFJcbiAgICAgICAgICAgICAgICB4aHIuc2VuZCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgdmFyIHhkb21haW5SZXF1ZXN0ID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICBpZih0eXBlb2YgWERvbWFpblJlcXVlc3QgIT0gJ3VuZGVmaW5lZCcpIHsgLy8gSW50ZXJuZXQgRXhwbG9yZXJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG5cbiAgICAgICAgICAgICAgICB2YXIgeGRyID0gbmV3IFhEb21haW5SZXF1ZXN0KCk7XG5cbiAgICAgICAgICAgICAgICAvLyBDYWxsZWQgb24gc3VjY2Vzc1xuICAgICAgICAgICAgICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIEpTT04ucGFyc2UoeGRyLnJlc3BvbnNlVGV4dCksIHhkciwgMCk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIENhbGxlZCBvbiBlcnJvclxuICAgICAgICAgICAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKG1zZyksIG51bGwsIHhkcik7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIEJpbmQgdGhlIFhEUiBmaW5pc2hlZCBjYWxsYmFja1xuICAgICAgICAgICAgICAgIHhkci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh4ZHIpO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBCaW5kIHRoZSBYRFIgZXJyb3IgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICB4ZHIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoXCJVbmV4cGVjdGVkIHN0YXR1cyBjb2RlIG9uIFVSTCBcIiArIHVybCk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIE9wZW4gdGhlIFhIUlxuICAgICAgICAgICAgICAgIHhkci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAgICAgICAgICAgLy8gQmluZCB0aGUgWERSIHRpbWVvdXQgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICB4ZHIub250aW1lb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoXCJSZXF1ZXN0IHRpbWVvdXRcIik7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIEVtcHR5IGNhbGxiYWNrLiBJRSBzb21ldGltZXMgYWJvcnQgdGhlIHJlcWV1c3QgaWZcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGlzIG5vdCBwcmVzZW50XG4gICAgICAgICAgICAgICAgeGRyLm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7IH07XG5cbiAgICAgICAgICAgICAgICB4ZHIuc2VuZCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgdmFyIG5vZGVKU1JlcXVlc3QgPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmKHR5cGVvZiByZXF1aXJlID09ICdmdW5jdGlvbicgJiYgcmVxdWlyZSgnaHR0cCcpKSB7XG4gICAgICAgICAgICB2YXIgaHR0cCA9IHJlcXVpcmUoJ2h0dHAnKSxcbiAgICAgICAgICAgICAgICBodHRwcyA9IHJlcXVpcmUoJ2h0dHBzJyksXG4gICAgICAgICAgICAgICAgdXJsID0gcmVxdWlyZSgndXJsJyksXG4gICAgICAgICAgICAgICAgcXVlcnlzdHJpbmcgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpLFxuICAgICAgICAgICAgICAgIHBqc29uID0gcmVxdWlyZSgnLi4vcGFja2FnZS5qc29uJyk7XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihyZXF1ZXN0VXJsLCBjYWxsYmFjaykge1xuXG4gICAgICAgICAgICAgICAgdmFyIHBhcnNlZCA9IHVybC5wYXJzZShyZXF1ZXN0VXJsKSxcbiAgICAgICAgICAgICAgICAgICAgaCA9IHBhcnNlZC5wcm90b2NvbCA9PSAnaHR0cHM6JyA/IGh0dHBzIDogaHR0cCxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhvc3RuYW1lOiBwYXJzZWQuaG9zdG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBwYXJzZWQucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5OiBwYXJzZWQucXVlcnksXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnVXNlci1BZ2VudCc6ICdQcmlzbWljLWphdmFzY3JpcHQta2l0LycgKyBwanNvbi52ZXJzaW9uICsgXCIgTm9kZUpTL1wiICsgcHJvY2Vzcy52ZXJzaW9uXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICB2YXIgcmVxdWVzdCA9IGguZ2V0KG9wdGlvbnMsIGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgJiYgcmVzcG9uc2Uuc3RhdHVzQ29kZSA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBqc29uU3RyID0gJyc7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLnNldEVuY29kaW5nKCd1dGY4Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZS5vbignZGF0YScsIGZ1bmN0aW9uIChjaHVuaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpzb25TdHIgKz0gY2h1bms7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2Uub24oJ2VuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGpzb24gPSBKU09OLnBhcnNlKGpzb25TdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVDb250cm9sID0gcmVzcG9uc2UuaGVhZGVyc1snY2FjaGUtY29udHJvbCddO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdHRsID0gY2FjaGVDb250cm9sICYmIC9tYXgtYWdlPShcXGQrKS8udGVzdChjYWNoZUNvbnRyb2wpID8gcGFyc2VJbnQoL21heC1hZ2U9KFxcZCspLy5leGVjKGNhY2hlQ29udHJvbClbMV0sIDEwKSA6IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBqc29uLCByZXNwb25zZSwgdHRsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soY3JlYXRlRXJyb3IocmVzcG9uc2Uuc3RhdHVzQ29kZSwgXCJVbmV4cGVjdGVkIHN0YXR1cyBjb2RlIFtcIiArIHJlc3BvbnNlLnN0YXR1c0NvZGUgKyBcIl0gb24gVVJMIFwiK3JlcXVlc3RVcmwpLCBudWxsLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIHByb3Blcmx5IGhhbmRsZSB0aW1lb3V0c1xuICAgICAgICAgICAgICAgIHJlcXVlc3Qub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgZXJyb3Igb24gVVJMIFwiK3JlcXVlc3RVcmwpLCBudWxsLCBlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIE51bWJlciBvZiByZXF1ZXN0cyBjdXJyZW50bHkgcnVubmluZyAoY2FwcGVkIGJ5IE1BWF9DT05ORUNUSU9OUylcbiAgICB2YXIgcnVubmluZyA9IDA7XG4gICAgLy8gUmVxdWVzdHMgaW4gcXVldWVcbiAgICB2YXIgcXVldWUgPSBbXTtcblxuICAgIHZhciBwcm9jZXNzUXVldWUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMCB8fCBydW5uaW5nID49IEdsb2JhbC5QcmlzbWljLlV0aWxzLk1BWF9DT05ORUNUSU9OUykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJ1bm5pbmcrKztcbiAgICAgICAgdmFyIG5leHQgPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICB2YXIgZm4gPSBhamF4UmVxdWVzdCgpIHx8IHhkb21haW5SZXF1ZXN0KCkgfHwgbm9kZUpTUmVxdWVzdCgpIHx8XG4gICAgICAgICAgICAoZnVuY3Rpb24oKSB7dGhyb3cgbmV3IEVycm9yKFwiTm8gcmVxdWVzdCBoYW5kbGVyIGF2YWlsYWJsZSAodHJpZWQgWE1MSHR0cFJlcXVlc3QgJiBOb2RlSlMpXCIpO30pKCk7XG4gICAgICAgIGZuLmNhbGwodGhpcywgbmV4dC51cmwsIGZ1bmN0aW9uKGVycm9yLCByZXN1bHQsIHhociwgdHRsKSB7XG4gICAgICAgICAgICBydW5uaW5nLS07XG4gICAgICAgICAgICBuZXh0LmNhbGxiYWNrKGVycm9yLCByZXN1bHQsIHhociwgdHRsKTtcbiAgICAgICAgICAgIHByb2Nlc3NRdWV1ZSgpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgdmFyIHJlcXVlc3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodXJsLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgcXVldWUucHVzaCh7XG4gICAgICAgICAgICAgICAgJ3VybCc6IHVybCxcbiAgICAgICAgICAgICAgICAnY2FsbGJhY2snOiBjYWxsYmFja1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwcm9jZXNzUXVldWUoKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgZXhwb3J0IGRlZmF1bHQge1xuICAgICAgICBNQVhfQ09OTkVDVElPTlM6IDIwLCAvLyBOdW1iZXIgb2YgbWF4aW11bSBzaW11bHRhbmVvdXMgY29ubmVjdGlvbnMgdG8gdGhlIHByaXNtaWMgc2VydmVyXG4gICAgICAgIHJlcXVlc3Q6IHJlcXVlc3RcbiAgICB9O1xuXG4iLCJ2YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFBMVVMgICA9ICcrJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSCAgPSAnLycuY2hhckNvZGVBdCgwKVxuXHR2YXIgTlVNQkVSID0gJzAnLmNoYXJDb2RlQXQoMClcblx0dmFyIExPV0VSICA9ICdhJy5jaGFyQ29kZUF0KDApXG5cdHZhciBVUFBFUiAgPSAnQScuY2hhckNvZGVBdCgwKVxuXHR2YXIgUExVU19VUkxfU0FGRSA9ICctJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSF9VUkxfU0FGRSA9ICdfJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMgfHxcblx0XHQgICAgY29kZSA9PT0gUExVU19VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0ggfHxcblx0XHQgICAgY29kZSA9PT0gU0xBU0hfVVJMX1NBRkUpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcbiIsIiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxudmFyIHJvb3RQYXJlbnQgPSB7fVxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBEdWUgdG8gdmFyaW91cyBicm93c2VyIGJ1Z3MsIHNvbWV0aW1lcyB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uIHdpbGwgYmUgdXNlZCBldmVuXG4gKiB3aGVuIHRoZSBicm93c2VyIHN1cHBvcnRzIHR5cGVkIGFycmF5cy5cbiAqXG4gKiBOb3RlOlxuICpcbiAqICAgLSBGaXJlZm94IDQtMjkgbGFja3Mgc3VwcG9ydCBmb3IgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsXG4gKiAgICAgU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzguXG4gKlxuICogICAtIFNhZmFyaSA1LTcgbGFja3Mgc3VwcG9ydCBmb3IgY2hhbmdpbmcgdGhlIGBPYmplY3QucHJvdG90eXBlLmNvbnN0cnVjdG9yYCBwcm9wZXJ0eVxuICogICAgIG9uIG9iamVjdHMuXG4gKlxuICogICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogICAtIElFMTAgaGFzIGEgYnJva2VuIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhcnJheXMgb2ZcbiAqICAgICBpbmNvcnJlY3QgbGVuZ3RoIGluIHNvbWUgc2l0dWF0aW9ucy5cblxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXlcbiAqIGdldCB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uLCB3aGljaCBpcyBzbG93ZXIgYnV0IGJlaGF2ZXMgY29ycmVjdGx5LlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUICE9PSB1bmRlZmluZWRcbiAgPyBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVFxuICA6IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICBmdW5jdGlvbiBCYXIgKCkge31cbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIGFyci5jb25zdHJ1Y3RvciA9IEJhclxuICAgIHJldHVybiBhcnIuZm9vKCkgPT09IDQyICYmIC8vIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkXG4gICAgICAgIGFyci5jb25zdHJ1Y3RvciA9PT0gQmFyICYmIC8vIGNvbnN0cnVjdG9yIGNhbiBiZSBzZXRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgLy8gQXZvaWQgZ29pbmcgdGhyb3VnaCBhbiBBcmd1bWVudHNBZGFwdG9yVHJhbXBvbGluZSBpbiB0aGUgY29tbW9uIGNhc2UuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSByZXR1cm4gbmV3IEJ1ZmZlcihhcmcsIGFyZ3VtZW50c1sxXSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihhcmcpXG4gIH1cblxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpcy5sZW5ndGggPSAwXG4gICAgdGhpcy5wYXJlbnQgPSB1bmRlZmluZWRcbiAgfVxuXG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gZnJvbU51bWJlcih0aGlzLCBhcmcpXG4gIH1cblxuICAvLyBTbGlnaHRseSBsZXNzIGNvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh0aGlzLCBhcmcsIGFyZ3VtZW50cy5sZW5ndGggPiAxID8gYXJndW1lbnRzWzFdIDogJ3V0ZjgnKVxuICB9XG5cbiAgLy8gVW51c3VhbC5cbiAgcmV0dXJuIGZyb21PYmplY3QodGhpcywgYXJnKVxufVxuXG5mdW5jdGlvbiBmcm9tTnVtYmVyICh0aGF0LCBsZW5ndGgpIHtcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aCA8IDAgPyAwIDogY2hlY2tlZChsZW5ndGgpIHwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoYXRbaV0gPSAwXG4gICAgfVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHRoYXQsIHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIC8vIEFzc3VtcHRpb246IGJ5dGVMZW5ndGgoKSByZXR1cm4gdmFsdWUgaXMgYWx3YXlzIDwga01heExlbmd0aC5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgdGhhdC53cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tT2JqZWN0ICh0aGF0LCBvYmplY3QpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihvYmplY3QpKSByZXR1cm4gZnJvbUJ1ZmZlcih0aGF0LCBvYmplY3QpXG5cbiAgaWYgKGlzQXJyYXkob2JqZWN0KSkgcmV0dXJuIGZyb21BcnJheSh0aGF0LCBvYmplY3QpXG5cbiAgaWYgKG9iamVjdCA9PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbXVzdCBzdGFydCB3aXRoIG51bWJlciwgYnVmZmVyLCBhcnJheSBvciBzdHJpbmcnKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAob2JqZWN0LmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICByZXR1cm4gZnJvbVR5cGVkQXJyYXkodGhhdCwgb2JqZWN0KVxuICAgIH1cbiAgICBpZiAob2JqZWN0IGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tQXJyYXlCdWZmZXIodGhhdCwgb2JqZWN0KVxuICAgIH1cbiAgfVxuXG4gIGlmIChvYmplY3QubGVuZ3RoKSByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmplY3QpXG5cbiAgcmV0dXJuIGZyb21Kc29uT2JqZWN0KHRoYXQsIG9iamVjdClcbn1cblxuZnVuY3Rpb24gZnJvbUJ1ZmZlciAodGhhdCwgYnVmZmVyKSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGJ1ZmZlci5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBidWZmZXIuY29weSh0aGF0LCAwLCAwLCBsZW5ndGgpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIER1cGxpY2F0ZSBvZiBmcm9tQXJyYXkoKSB0byBrZWVwIGZyb21BcnJheSgpIG1vbm9tb3JwaGljLlxuZnVuY3Rpb24gZnJvbVR5cGVkQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIC8vIFRydW5jYXRpbmcgdGhlIGVsZW1lbnRzIGlzIHByb2JhYmx5IG5vdCB3aGF0IHBlb3BsZSBleHBlY3QgZnJvbSB0eXBlZFxuICAvLyBhcnJheXMgd2l0aCBCWVRFU19QRVJfRUxFTUVOVCA+IDEgYnV0IGl0J3MgY29tcGF0aWJsZSB3aXRoIHRoZSBiZWhhdmlvclxuICAvLyBvZiB0aGUgb2xkIEJ1ZmZlciBjb25zdHJ1Y3Rvci5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAodGhhdCwgYXJyYXkpIHtcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgYXJyYXkuYnl0ZUxlbmd0aFxuICAgIHRoYXQgPSBCdWZmZXIuX2F1Z21lbnQobmV3IFVpbnQ4QXJyYXkoYXJyYXkpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0ID0gZnJvbVR5cGVkQXJyYXkodGhhdCwgbmV3IFVpbnQ4QXJyYXkoYXJyYXkpKVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEZXNlcmlhbGl6ZSB7IHR5cGU6ICdCdWZmZXInLCBkYXRhOiBbMSwyLDMsLi4uXSB9IGludG8gYSBCdWZmZXIgb2JqZWN0LlxuLy8gUmV0dXJucyBhIHplcm8tbGVuZ3RoIGJ1ZmZlciBmb3IgaW5wdXRzIHRoYXQgZG9uJ3QgY29uZm9ybSB0byB0aGUgc3BlYy5cbmZ1bmN0aW9uIGZyb21Kc29uT2JqZWN0ICh0aGF0LCBvYmplY3QpIHtcbiAgdmFyIGFycmF5XG4gIHZhciBsZW5ndGggPSAwXG5cbiAgaWYgKG9iamVjdC50eXBlID09PSAnQnVmZmVyJyAmJiBpc0FycmF5KG9iamVjdC5kYXRhKSkge1xuICAgIGFycmF5ID0gb2JqZWN0LmRhdGFcbiAgICBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIH1cbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gIEJ1ZmZlci5wcm90b3R5cGUuX19wcm90b19fID0gVWludDhBcnJheS5wcm90b3R5cGVcbiAgQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcbn0gZWxzZSB7XG4gIC8vIHByZS1zZXQgZm9yIHZhbHVlcyB0aGF0IG1heSBleGlzdCBpbiB0aGUgZnV0dXJlXG4gIEJ1ZmZlci5wcm90b3R5cGUubGVuZ3RoID0gdW5kZWZpbmVkXG4gIEJ1ZmZlci5wcm90b3R5cGUucGFyZW50ID0gdW5kZWZpbmVkXG59XG5cbmZ1bmN0aW9uIGFsbG9jYXRlICh0aGF0LCBsZW5ndGgpIHtcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0Lmxlbmd0aCA9IGxlbmd0aFxuICAgIHRoYXQuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGZyb21Qb29sID0gbGVuZ3RoICE9PSAwICYmIGxlbmd0aCA8PSBCdWZmZXIucG9vbFNpemUgPj4+IDFcbiAgaWYgKGZyb21Qb29sKSB0aGF0LnBhcmVudCA9IHJvb3RQYXJlbnRcblxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwga01heExlbmd0aGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aCgpLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTbG93QnVmZmVyKSkgcmV0dXJuIG5ldyBTbG93QnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuICBkZWxldGUgYnVmLnBhcmVudFxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIGlzQnVmZmVyIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICB2YXIgaSA9IDBcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIGJyZWFrXG5cbiAgICArK2lcbiAgfVxuXG4gIGlmIChpICE9PSBsZW4pIHtcbiAgICB4ID0gYVtpXVxuICAgIHkgPSBiW2ldXG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzLicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSBzdHJpbmcgPSAnJyArIHN0cmluZ1xuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgLy8gRGVwcmVjYXRlZFxuICAgICAgY2FzZSAncmF3JzpcbiAgICAgIGNhc2UgJ3Jhd3MnOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIHN0YXJ0ID0gc3RhcnQgfCAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gSW5maW5pdHkgPyB0aGlzLmxlbmd0aCA6IGVuZCB8IDBcblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoZW5kIDw9IHN0YXJ0KSByZXR1cm4gJydcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoIHwgMFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIDBcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCkge1xuICBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIGJ5dGVPZmZzZXQgPj49IDBcblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVybiAtMVxuICBpZiAoYnl0ZU9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuIC0xXG5cbiAgLy8gTmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBNYXRoLm1heCh0aGlzLmxlbmd0aCArIGJ5dGVPZmZzZXQsIDApXG5cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHJldHVybiAtMSAvLyBzcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZyBhbHdheXMgZmFpbHNcbiAgICByZXR1cm4gU3RyaW5nLnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCBbIHZhbCBdLCBieXRlT2Zmc2V0KVxuICB9XG5cbiAgZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCkge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKHZhciBpID0gMDsgYnl0ZU9mZnNldCArIGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJbYnl0ZU9mZnNldCArIGldID09PSB2YWxbZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXhdKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsLmxlbmd0aCkgcmV0dXJuIGJ5dGVPZmZzZXQgKyBmb3VuZEluZGV4XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3VuZEluZGV4ID0gLTFcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG4vLyBgZ2V0YCBpcyBkZXByZWNhdGVkXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIGdldCAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCBpcyBkZXByZWNhdGVkXG5CdWZmZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIHNldCAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChpc05hTihwYXJzZWQpKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCB8IDBcbiAgICAgIGlmIChlbmNvZGluZyA9PT0gdW5kZWZpbmVkKSBlbmNvZGluZyA9ICd1dGY4J1xuICAgIH0gZWxzZSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICAvLyBsZWdhY3kgd3JpdGUoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpIC0gcmVtb3ZlIGluIHYwLjEzXG4gIH0gZWxzZSB7XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoIHwgMFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdhdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICBpZiAobmV3QnVmLmxlbmd0aCkgbmV3QnVmLnBhcmVudCA9IHRoaXMucGFyZW50IHx8IHRoaXNcblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2J1ZmZlciBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcbiAgdmFyIGlcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHN0YXJ0IDwgdGFyZ2V0U3RhcnQgJiYgdGFyZ2V0U3RhcnQgPCBlbmQpIHtcbiAgICAvLyBkZXNjZW5kaW5nIGNvcHkgZnJvbSBlbmRcbiAgICBmb3IgKGkgPSBsZW4gLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBhc2NlbmRpbmcgY29weSBmcm9tIHN0YXJ0XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldFN0YXJ0KVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSB1dGY4VG9CeXRlcyh2YWx1ZS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiB0b0FycmF5QnVmZmVyICgpIHtcbiAgaWYgKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICB9XG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiBfYXVnbWVudCAoYXJyKSB7XG4gIGFyci5jb25zdHJ1Y3RvciA9IEJ1ZmZlclxuICBhcnIuX2lzQnVmZmVyID0gdHJ1ZVxuXG4gIC8vIHNhdmUgcmVmZXJlbmNlIHRvIG9yaWdpbmFsIFVpbnQ4QXJyYXkgc2V0IG1ldGhvZCBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9zZXQgPSBhcnIuc2V0XG5cbiAgLy8gZGVwcmVjYXRlZFxuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5lcXVhbHMgPSBCUC5lcXVhbHNcbiAgYXJyLmNvbXBhcmUgPSBCUC5jb21wYXJlXG4gIGFyci5pbmRleE9mID0gQlAuaW5kZXhPZlxuICBhcnIuY29weSA9IEJQLmNvcHlcbiAgYXJyLnNsaWNlID0gQlAuc2xpY2VcbiAgYXJyLnJlYWRVSW50TEUgPSBCUC5yZWFkVUludExFXG4gIGFyci5yZWFkVUludEJFID0gQlAucmVhZFVJbnRCRVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnRMRSA9IEJQLnJlYWRJbnRMRVxuICBhcnIucmVhZEludEJFID0gQlAucmVhZEludEJFXG4gIGFyci5yZWFkSW50OCA9IEJQLnJlYWRJbnQ4XG4gIGFyci5yZWFkSW50MTZMRSA9IEJQLnJlYWRJbnQxNkxFXG4gIGFyci5yZWFkSW50MTZCRSA9IEJQLnJlYWRJbnQxNkJFXG4gIGFyci5yZWFkSW50MzJMRSA9IEJQLnJlYWRJbnQzMkxFXG4gIGFyci5yZWFkSW50MzJCRSA9IEJQLnJlYWRJbnQzMkJFXG4gIGFyci5yZWFkRmxvYXRMRSA9IEJQLnJlYWRGbG9hdExFXG4gIGFyci5yZWFkRmxvYXRCRSA9IEJQLnJlYWRGbG9hdEJFXG4gIGFyci5yZWFkRG91YmxlTEUgPSBCUC5yZWFkRG91YmxlTEVcbiAgYXJyLnJlYWREb3VibGVCRSA9IEJQLnJlYWREb3VibGVCRVxuICBhcnIud3JpdGVVSW50OCA9IEJQLndyaXRlVUludDhcbiAgYXJyLndyaXRlVUludExFID0gQlAud3JpdGVVSW50TEVcbiAgYXJyLndyaXRlVUludEJFID0gQlAud3JpdGVVSW50QkVcbiAgYXJyLndyaXRlVUludDE2TEUgPSBCUC53cml0ZVVJbnQxNkxFXG4gIGFyci53cml0ZVVJbnQxNkJFID0gQlAud3JpdGVVSW50MTZCRVxuICBhcnIud3JpdGVVSW50MzJMRSA9IEJQLndyaXRlVUludDMyTEVcbiAgYXJyLndyaXRlVUludDMyQkUgPSBCUC53cml0ZVVJbnQzMkJFXG4gIGFyci53cml0ZUludExFID0gQlAud3JpdGVJbnRMRVxuICBhcnIud3JpdGVJbnRCRSA9IEJQLndyaXRlSW50QkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCA8PCAxMCB8IGNvZGVQb2ludCAtIDB4REMwMCkgKyAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cbiIsInZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIFwiMTAwXCI6IFwiQ29udGludWVcIixcbiAgXCIxMDFcIjogXCJTd2l0Y2hpbmcgUHJvdG9jb2xzXCIsXG4gIFwiMTAyXCI6IFwiUHJvY2Vzc2luZ1wiLFxuICBcIjIwMFwiOiBcIk9LXCIsXG4gIFwiMjAxXCI6IFwiQ3JlYXRlZFwiLFxuICBcIjIwMlwiOiBcIkFjY2VwdGVkXCIsXG4gIFwiMjAzXCI6IFwiTm9uLUF1dGhvcml0YXRpdmUgSW5mb3JtYXRpb25cIixcbiAgXCIyMDRcIjogXCJObyBDb250ZW50XCIsXG4gIFwiMjA1XCI6IFwiUmVzZXQgQ29udGVudFwiLFxuICBcIjIwNlwiOiBcIlBhcnRpYWwgQ29udGVudFwiLFxuICBcIjIwN1wiOiBcIk11bHRpLVN0YXR1c1wiLFxuICBcIjMwMFwiOiBcIk11bHRpcGxlIENob2ljZXNcIixcbiAgXCIzMDFcIjogXCJNb3ZlZCBQZXJtYW5lbnRseVwiLFxuICBcIjMwMlwiOiBcIk1vdmVkIFRlbXBvcmFyaWx5XCIsXG4gIFwiMzAzXCI6IFwiU2VlIE90aGVyXCIsXG4gIFwiMzA0XCI6IFwiTm90IE1vZGlmaWVkXCIsXG4gIFwiMzA1XCI6IFwiVXNlIFByb3h5XCIsXG4gIFwiMzA3XCI6IFwiVGVtcG9yYXJ5IFJlZGlyZWN0XCIsXG4gIFwiMzA4XCI6IFwiUGVybWFuZW50IFJlZGlyZWN0XCIsXG4gIFwiNDAwXCI6IFwiQmFkIFJlcXVlc3RcIixcbiAgXCI0MDFcIjogXCJVbmF1dGhvcml6ZWRcIixcbiAgXCI0MDJcIjogXCJQYXltZW50IFJlcXVpcmVkXCIsXG4gIFwiNDAzXCI6IFwiRm9yYmlkZGVuXCIsXG4gIFwiNDA0XCI6IFwiTm90IEZvdW5kXCIsXG4gIFwiNDA1XCI6IFwiTWV0aG9kIE5vdCBBbGxvd2VkXCIsXG4gIFwiNDA2XCI6IFwiTm90IEFjY2VwdGFibGVcIixcbiAgXCI0MDdcIjogXCJQcm94eSBBdXRoZW50aWNhdGlvbiBSZXF1aXJlZFwiLFxuICBcIjQwOFwiOiBcIlJlcXVlc3QgVGltZS1vdXRcIixcbiAgXCI0MDlcIjogXCJDb25mbGljdFwiLFxuICBcIjQxMFwiOiBcIkdvbmVcIixcbiAgXCI0MTFcIjogXCJMZW5ndGggUmVxdWlyZWRcIixcbiAgXCI0MTJcIjogXCJQcmVjb25kaXRpb24gRmFpbGVkXCIsXG4gIFwiNDEzXCI6IFwiUmVxdWVzdCBFbnRpdHkgVG9vIExhcmdlXCIsXG4gIFwiNDE0XCI6IFwiUmVxdWVzdC1VUkkgVG9vIExhcmdlXCIsXG4gIFwiNDE1XCI6IFwiVW5zdXBwb3J0ZWQgTWVkaWEgVHlwZVwiLFxuICBcIjQxNlwiOiBcIlJlcXVlc3RlZCBSYW5nZSBOb3QgU2F0aXNmaWFibGVcIixcbiAgXCI0MTdcIjogXCJFeHBlY3RhdGlvbiBGYWlsZWRcIixcbiAgXCI0MThcIjogXCJJJ20gYSB0ZWFwb3RcIixcbiAgXCI0MjJcIjogXCJVbnByb2Nlc3NhYmxlIEVudGl0eVwiLFxuICBcIjQyM1wiOiBcIkxvY2tlZFwiLFxuICBcIjQyNFwiOiBcIkZhaWxlZCBEZXBlbmRlbmN5XCIsXG4gIFwiNDI1XCI6IFwiVW5vcmRlcmVkIENvbGxlY3Rpb25cIixcbiAgXCI0MjZcIjogXCJVcGdyYWRlIFJlcXVpcmVkXCIsXG4gIFwiNDI4XCI6IFwiUHJlY29uZGl0aW9uIFJlcXVpcmVkXCIsXG4gIFwiNDI5XCI6IFwiVG9vIE1hbnkgUmVxdWVzdHNcIixcbiAgXCI0MzFcIjogXCJSZXF1ZXN0IEhlYWRlciBGaWVsZHMgVG9vIExhcmdlXCIsXG4gIFwiNTAwXCI6IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCIsXG4gIFwiNTAxXCI6IFwiTm90IEltcGxlbWVudGVkXCIsXG4gIFwiNTAyXCI6IFwiQmFkIEdhdGV3YXlcIixcbiAgXCI1MDNcIjogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gIFwiNTA0XCI6IFwiR2F0ZXdheSBUaW1lLW91dFwiLFxuICBcIjUwNVwiOiBcIkhUVFAgVmVyc2lvbiBOb3QgU3VwcG9ydGVkXCIsXG4gIFwiNTA2XCI6IFwiVmFyaWFudCBBbHNvIE5lZ290aWF0ZXNcIixcbiAgXCI1MDdcIjogXCJJbnN1ZmZpY2llbnQgU3RvcmFnZVwiLFxuICBcIjUwOVwiOiBcIkJhbmR3aWR0aCBMaW1pdCBFeGNlZWRlZFwiLFxuICBcIjUxMFwiOiBcIk5vdCBFeHRlbmRlZFwiLFxuICBcIjUxMVwiOiBcIk5ldHdvcmsgQXV0aGVudGljYXRpb24gUmVxdWlyZWRcIlxufVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIE5PVEU6IFRoZXNlIHR5cGUgY2hlY2tpbmcgZnVuY3Rpb25zIGludGVudGlvbmFsbHkgZG9uJ3QgdXNlIGBpbnN0YW5jZW9mYFxuLy8gYmVjYXVzZSBpdCBpcyBmcmFnaWxlIGFuZCBjYW4gYmUgZWFzaWx5IGZha2VkIHdpdGggYE9iamVjdC5jcmVhdGUoKWAuXG5cbmZ1bmN0aW9uIGlzQXJyYXkoYXJnKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KSB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXJnKTtcbiAgfVxuICByZXR1cm4gb2JqZWN0VG9TdHJpbmcoYXJnKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn1cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJztcbn1cbmV4cG9ydHMuaXNCb29sZWFuID0gaXNCb29sZWFuO1xuXG5mdW5jdGlvbiBpc051bGwoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbCA9IGlzTnVsbDtcblxuZnVuY3Rpb24gaXNOdWxsT3JVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsT3JVbmRlZmluZWQgPSBpc051bGxPclVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cbmV4cG9ydHMuaXNOdW1iZXIgPSBpc051bWJlcjtcblxuZnVuY3Rpb24gaXNTdHJpbmcoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3RyaW5nJztcbn1cbmV4cG9ydHMuaXNTdHJpbmcgPSBpc1N0cmluZztcblxuZnVuY3Rpb24gaXNTeW1ib2woYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3ltYm9sJztcbn1cbmV4cG9ydHMuaXNTeW1ib2wgPSBpc1N5bWJvbDtcblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbmV4cG9ydHMuaXNVbmRlZmluZWQgPSBpc1VuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNSZWdFeHAocmUpIHtcbiAgcmV0dXJuIG9iamVjdFRvU3RyaW5nKHJlKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59XG5leHBvcnRzLmlzUmVnRXhwID0gaXNSZWdFeHA7XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuZXhwb3J0cy5pc09iamVjdCA9IGlzT2JqZWN0O1xuXG5mdW5jdGlvbiBpc0RhdGUoZCkge1xuICByZXR1cm4gb2JqZWN0VG9TdHJpbmcoZCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cbmV4cG9ydHMuaXNEYXRlID0gaXNEYXRlO1xuXG5mdW5jdGlvbiBpc0Vycm9yKGUpIHtcbiAgcmV0dXJuIChvYmplY3RUb1N0cmluZyhlKSA9PT0gJ1tvYmplY3QgRXJyb3JdJyB8fCBlIGluc3RhbmNlb2YgRXJyb3IpO1xufVxuZXhwb3J0cy5pc0Vycm9yID0gaXNFcnJvcjtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbCB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnIHx8ICAvLyBFUzYgc3ltYm9sXG4gICAgICAgICB0eXBlb2YgYXJnID09PSAndW5kZWZpbmVkJztcbn1cbmV4cG9ydHMuaXNQcmltaXRpdmUgPSBpc1ByaW1pdGl2ZTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IEJ1ZmZlci5pc0J1ZmZlcjtcblxuZnVuY3Rpb24gb2JqZWN0VG9TdHJpbmcobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyIGh0dHAgPSByZXF1aXJlKCdodHRwJyk7XG5cbnZhciBodHRwcyA9IG1vZHVsZS5leHBvcnRzO1xuXG5mb3IgKHZhciBrZXkgaW4gaHR0cCkge1xuICAgIGlmIChodHRwLmhhc093blByb3BlcnR5KGtleSkpIGh0dHBzW2tleV0gPSBodHRwW2tleV07XG59O1xuXG5odHRwcy5yZXF1ZXN0ID0gZnVuY3Rpb24gKHBhcmFtcywgY2IpIHtcbiAgICBpZiAoIXBhcmFtcykgcGFyYW1zID0ge307XG4gICAgcGFyYW1zLnNjaGVtZSA9ICdodHRwcyc7XG4gICAgcGFyYW1zLnByb3RvY29sID0gJ2h0dHBzOic7XG4gICAgcmV0dXJuIGh0dHAucmVxdWVzdC5jYWxsKHRoaXMsIHBhcmFtcywgY2IpO1xufVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn0gZWxzZSB7XG4gIC8vIG9sZCBzY2hvb2wgc2hpbSBmb3Igb2xkIGJyb3dzZXJzXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgIFRlbXBDdG9yLnByb3RvdHlwZSA9IHN1cGVyQ3Rvci5wcm90b3R5cGVcbiAgICBjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpXG4gICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gIH1cbn1cbiIsIi8qKlxuICogRGV0ZXJtaW5lIGlmIGFuIG9iamVjdCBpcyBCdWZmZXJcbiAqXG4gKiBBdXRob3I6ICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIExpY2Vuc2U6ICBNSVRcbiAqXG4gKiBgbnBtIGluc3RhbGwgaXMtYnVmZmVyYFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gISEob2JqICE9IG51bGwgJiZcbiAgICAob2JqLl9pc0J1ZmZlciB8fCAvLyBGb3IgU2FmYXJpIDUtNyAobWlzc2luZyBPYmplY3QucHJvdG90eXBlLmNvbnN0cnVjdG9yKVxuICAgICAgKG9iai5jb25zdHJ1Y3RvciAmJlxuICAgICAgdHlwZW9mIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iaikpXG4gICAgKSlcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaWYgKCFwcm9jZXNzLnZlcnNpb24gfHxcbiAgICBwcm9jZXNzLnZlcnNpb24uaW5kZXhPZigndjAuJykgPT09IDAgfHxcbiAgICBwcm9jZXNzLnZlcnNpb24uaW5kZXhPZigndjEuJykgPT09IDAgJiYgcHJvY2Vzcy52ZXJzaW9uLmluZGV4T2YoJ3YxLjguJykgIT09IDApIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBuZXh0VGljaztcbn0gZWxzZSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcHJvY2Vzcy5uZXh0VGljaztcbn1cblxuZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICB2YXIgaSA9IDA7XG4gIHdoaWxlIChpIDwgYXJncy5sZW5ndGgpIHtcbiAgICBhcmdzW2krK10gPSBhcmd1bWVudHNbaV07XG4gIH1cbiAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiBhZnRlclRpY2soKSB7XG4gICAgZm4uYXBwbHkobnVsbCwgYXJncyk7XG4gIH0pO1xufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKiEgaHR0cHM6Ly9tdGhzLmJlL3B1bnljb2RlIHYxLjQuMCBieSBAbWF0aGlhcyAqL1xuOyhmdW5jdGlvbihyb290KSB7XG5cblx0LyoqIERldGVjdCBmcmVlIHZhcmlhYmxlcyAqL1xuXHR2YXIgZnJlZUV4cG9ydHMgPSB0eXBlb2YgZXhwb3J0cyA9PSAnb2JqZWN0JyAmJiBleHBvcnRzICYmXG5cdFx0IWV4cG9ydHMubm9kZVR5cGUgJiYgZXhwb3J0cztcblx0dmFyIGZyZWVNb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJlxuXHRcdCFtb2R1bGUubm9kZVR5cGUgJiYgbW9kdWxlO1xuXHR2YXIgZnJlZUdsb2JhbCA9IHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsO1xuXHRpZiAoXG5cdFx0ZnJlZUdsb2JhbC5nbG9iYWwgPT09IGZyZWVHbG9iYWwgfHxcblx0XHRmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCB8fFxuXHRcdGZyZWVHbG9iYWwuc2VsZiA9PT0gZnJlZUdsb2JhbFxuXHQpIHtcblx0XHRyb290ID0gZnJlZUdsb2JhbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgYHB1bnljb2RlYCBvYmplY3QuXG5cdCAqIEBuYW1lIHB1bnljb2RlXG5cdCAqIEB0eXBlIE9iamVjdFxuXHQgKi9cblx0dmFyIHB1bnljb2RlLFxuXG5cdC8qKiBIaWdoZXN0IHBvc2l0aXZlIHNpZ25lZCAzMi1iaXQgZmxvYXQgdmFsdWUgKi9cblx0bWF4SW50ID0gMjE0NzQ4MzY0NywgLy8gYWthLiAweDdGRkZGRkZGIG9yIDJeMzEtMVxuXG5cdC8qKiBCb290c3RyaW5nIHBhcmFtZXRlcnMgKi9cblx0YmFzZSA9IDM2LFxuXHR0TWluID0gMSxcblx0dE1heCA9IDI2LFxuXHRza2V3ID0gMzgsXG5cdGRhbXAgPSA3MDAsXG5cdGluaXRpYWxCaWFzID0gNzIsXG5cdGluaXRpYWxOID0gMTI4LCAvLyAweDgwXG5cdGRlbGltaXRlciA9ICctJywgLy8gJ1xceDJEJ1xuXG5cdC8qKiBSZWd1bGFyIGV4cHJlc3Npb25zICovXG5cdHJlZ2V4UHVueWNvZGUgPSAvXnhuLS0vLFxuXHRyZWdleE5vbkFTQ0lJID0gL1teXFx4MjAtXFx4N0VdLywgLy8gdW5wcmludGFibGUgQVNDSUkgY2hhcnMgKyBub24tQVNDSUkgY2hhcnNcblx0cmVnZXhTZXBhcmF0b3JzID0gL1tcXHgyRVxcdTMwMDJcXHVGRjBFXFx1RkY2MV0vZywgLy8gUkZDIDM0OTAgc2VwYXJhdG9yc1xuXG5cdC8qKiBFcnJvciBtZXNzYWdlcyAqL1xuXHRlcnJvcnMgPSB7XG5cdFx0J292ZXJmbG93JzogJ092ZXJmbG93OiBpbnB1dCBuZWVkcyB3aWRlciBpbnRlZ2VycyB0byBwcm9jZXNzJyxcblx0XHQnbm90LWJhc2ljJzogJ0lsbGVnYWwgaW5wdXQgPj0gMHg4MCAobm90IGEgYmFzaWMgY29kZSBwb2ludCknLFxuXHRcdCdpbnZhbGlkLWlucHV0JzogJ0ludmFsaWQgaW5wdXQnXG5cdH0sXG5cblx0LyoqIENvbnZlbmllbmNlIHNob3J0Y3V0cyAqL1xuXHRiYXNlTWludXNUTWluID0gYmFzZSAtIHRNaW4sXG5cdGZsb29yID0gTWF0aC5mbG9vcixcblx0c3RyaW5nRnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZSxcblxuXHQvKiogVGVtcG9yYXJ5IHZhcmlhYmxlICovXG5cdGtleTtcblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGVycm9yIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIFRoZSBlcnJvciB0eXBlLlxuXHQgKiBAcmV0dXJucyB7RXJyb3J9IFRocm93cyBhIGBSYW5nZUVycm9yYCB3aXRoIHRoZSBhcHBsaWNhYmxlIGVycm9yIG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBlcnJvcih0eXBlKSB7XG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoZXJyb3JzW3R5cGVdKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIGdlbmVyaWMgYEFycmF5I21hcGAgdXRpbGl0eSBmdW5jdGlvbi5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5IGFycmF5XG5cdCAqIGl0ZW0uXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gQSBuZXcgYXJyYXkgb2YgdmFsdWVzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFjayBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcChhcnJheSwgZm4pIHtcblx0XHR2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuXHRcdHZhciByZXN1bHQgPSBbXTtcblx0XHR3aGlsZSAobGVuZ3RoLS0pIHtcblx0XHRcdHJlc3VsdFtsZW5ndGhdID0gZm4oYXJyYXlbbGVuZ3RoXSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvKipcblx0ICogQSBzaW1wbGUgYEFycmF5I21hcGAtbGlrZSB3cmFwcGVyIHRvIHdvcmsgd2l0aCBkb21haW4gbmFtZSBzdHJpbmdzIG9yIGVtYWlsXG5cdCAqIGFkZHJlc3Nlcy5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRvbWFpbiBUaGUgZG9tYWluIG5hbWUgb3IgZW1haWwgYWRkcmVzcy5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5XG5cdCAqIGNoYXJhY3Rlci5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBzdHJpbmcgb2YgY2hhcmFjdGVycyByZXR1cm5lZCBieSB0aGUgY2FsbGJhY2tcblx0ICogZnVuY3Rpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBtYXBEb21haW4oc3RyaW5nLCBmbikge1xuXHRcdHZhciBwYXJ0cyA9IHN0cmluZy5zcGxpdCgnQCcpO1xuXHRcdHZhciByZXN1bHQgPSAnJztcblx0XHRpZiAocGFydHMubGVuZ3RoID4gMSkge1xuXHRcdFx0Ly8gSW4gZW1haWwgYWRkcmVzc2VzLCBvbmx5IHRoZSBkb21haW4gbmFtZSBzaG91bGQgYmUgcHVueWNvZGVkLiBMZWF2ZVxuXHRcdFx0Ly8gdGhlIGxvY2FsIHBhcnQgKGkuZS4gZXZlcnl0aGluZyB1cCB0byBgQGApIGludGFjdC5cblx0XHRcdHJlc3VsdCA9IHBhcnRzWzBdICsgJ0AnO1xuXHRcdFx0c3RyaW5nID0gcGFydHNbMV07XG5cdFx0fVxuXHRcdC8vIEF2b2lkIGBzcGxpdChyZWdleClgIGZvciBJRTggY29tcGF0aWJpbGl0eS4gU2VlICMxNy5cblx0XHRzdHJpbmcgPSBzdHJpbmcucmVwbGFjZShyZWdleFNlcGFyYXRvcnMsICdcXHgyRScpO1xuXHRcdHZhciBsYWJlbHMgPSBzdHJpbmcuc3BsaXQoJy4nKTtcblx0XHR2YXIgZW5jb2RlZCA9IG1hcChsYWJlbHMsIGZuKS5qb2luKCcuJyk7XG5cdFx0cmV0dXJuIHJlc3VsdCArIGVuY29kZWQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhbiBhcnJheSBjb250YWluaW5nIHRoZSBudW1lcmljIGNvZGUgcG9pbnRzIG9mIGVhY2ggVW5pY29kZVxuXHQgKiBjaGFyYWN0ZXIgaW4gdGhlIHN0cmluZy4gV2hpbGUgSmF2YVNjcmlwdCB1c2VzIFVDUy0yIGludGVybmFsbHksXG5cdCAqIHRoaXMgZnVuY3Rpb24gd2lsbCBjb252ZXJ0IGEgcGFpciBvZiBzdXJyb2dhdGUgaGFsdmVzIChlYWNoIG9mIHdoaWNoXG5cdCAqIFVDUy0yIGV4cG9zZXMgYXMgc2VwYXJhdGUgY2hhcmFjdGVycykgaW50byBhIHNpbmdsZSBjb2RlIHBvaW50LFxuXHQgKiBtYXRjaGluZyBVVEYtMTYuXG5cdCAqIEBzZWUgYHB1bnljb2RlLnVjczIuZW5jb2RlYFxuXHQgKiBAc2VlIDxodHRwczovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZz5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlLnVjczJcblx0ICogQG5hbWUgZGVjb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmcgVGhlIFVuaWNvZGUgaW5wdXQgc3RyaW5nIChVQ1MtMikuXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gVGhlIG5ldyBhcnJheSBvZiBjb2RlIHBvaW50cy5cblx0ICovXG5cdGZ1bmN0aW9uIHVjczJkZWNvZGUoc3RyaW5nKSB7XG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBjb3VudGVyID0gMCxcblx0XHQgICAgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aCxcblx0XHQgICAgdmFsdWUsXG5cdFx0ICAgIGV4dHJhO1xuXHRcdHdoaWxlIChjb3VudGVyIDwgbGVuZ3RoKSB7XG5cdFx0XHR2YWx1ZSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRpZiAodmFsdWUgPj0gMHhEODAwICYmIHZhbHVlIDw9IDB4REJGRiAmJiBjb3VudGVyIDwgbGVuZ3RoKSB7XG5cdFx0XHRcdC8vIGhpZ2ggc3Vycm9nYXRlLCBhbmQgdGhlcmUgaXMgYSBuZXh0IGNoYXJhY3RlclxuXHRcdFx0XHRleHRyYSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRcdGlmICgoZXh0cmEgJiAweEZDMDApID09IDB4REMwMCkgeyAvLyBsb3cgc3Vycm9nYXRlXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2goKCh2YWx1ZSAmIDB4M0ZGKSA8PCAxMCkgKyAoZXh0cmEgJiAweDNGRikgKyAweDEwMDAwKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyB1bm1hdGNoZWQgc3Vycm9nYXRlOyBvbmx5IGFwcGVuZCB0aGlzIGNvZGUgdW5pdCwgaW4gY2FzZSB0aGUgbmV4dFxuXHRcdFx0XHRcdC8vIGNvZGUgdW5pdCBpcyB0aGUgaGlnaCBzdXJyb2dhdGUgb2YgYSBzdXJyb2dhdGUgcGFpclxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdFx0XHRjb3VudGVyLS07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgc3RyaW5nIGJhc2VkIG9uIGFuIGFycmF5IG9mIG51bWVyaWMgY29kZSBwb2ludHMuXG5cdCAqIEBzZWUgYHB1bnljb2RlLnVjczIuZGVjb2RlYFxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGUudWNzMlxuXHQgKiBAbmFtZSBlbmNvZGVcblx0ICogQHBhcmFtIHtBcnJheX0gY29kZVBvaW50cyBUaGUgYXJyYXkgb2YgbnVtZXJpYyBjb2RlIHBvaW50cy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIG5ldyBVbmljb2RlIHN0cmluZyAoVUNTLTIpLlxuXHQgKi9cblx0ZnVuY3Rpb24gdWNzMmVuY29kZShhcnJheSkge1xuXHRcdHJldHVybiBtYXAoYXJyYXksIGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHR2YXIgb3V0cHV0ID0gJyc7XG5cdFx0XHRpZiAodmFsdWUgPiAweEZGRkYpIHtcblx0XHRcdFx0dmFsdWUgLT0gMHgxMDAwMDtcblx0XHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMCk7XG5cdFx0XHRcdHZhbHVlID0gMHhEQzAwIHwgdmFsdWUgJiAweDNGRjtcblx0XHRcdH1cblx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUpO1xuXHRcdFx0cmV0dXJuIG91dHB1dDtcblx0XHR9KS5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIGJhc2ljIGNvZGUgcG9pbnQgaW50byBhIGRpZ2l0L2ludGVnZXIuXG5cdCAqIEBzZWUgYGRpZ2l0VG9CYXNpYygpYFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0gY29kZVBvaW50IFRoZSBiYXNpYyBudW1lcmljIGNvZGUgcG9pbnQgdmFsdWUuXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IFRoZSBudW1lcmljIHZhbHVlIG9mIGEgYmFzaWMgY29kZSBwb2ludCAoZm9yIHVzZSBpblxuXHQgKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGluIHRoZSByYW5nZSBgMGAgdG8gYGJhc2UgLSAxYCwgb3IgYGJhc2VgIGlmXG5cdCAqIHRoZSBjb2RlIHBvaW50IGRvZXMgbm90IHJlcHJlc2VudCBhIHZhbHVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gYmFzaWNUb0RpZ2l0KGNvZGVQb2ludCkge1xuXHRcdGlmIChjb2RlUG9pbnQgLSA0OCA8IDEwKSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gMjI7XG5cdFx0fVxuXHRcdGlmIChjb2RlUG9pbnQgLSA2NSA8IDI2KSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gNjU7XG5cdFx0fVxuXHRcdGlmIChjb2RlUG9pbnQgLSA5NyA8IDI2KSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gOTc7XG5cdFx0fVxuXHRcdHJldHVybiBiYXNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgZGlnaXQvaW50ZWdlciBpbnRvIGEgYmFzaWMgY29kZSBwb2ludC5cblx0ICogQHNlZSBgYmFzaWNUb0RpZ2l0KClgXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBkaWdpdCBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQuXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IFRoZSBiYXNpYyBjb2RlIHBvaW50IHdob3NlIHZhbHVlICh3aGVuIHVzZWQgZm9yXG5cdCAqIHJlcHJlc2VudGluZyBpbnRlZ2VycykgaXMgYGRpZ2l0YCwgd2hpY2ggbmVlZHMgdG8gYmUgaW4gdGhlIHJhbmdlXG5cdCAqIGAwYCB0byBgYmFzZSAtIDFgLiBJZiBgZmxhZ2AgaXMgbm9uLXplcm8sIHRoZSB1cHBlcmNhc2UgZm9ybSBpc1xuXHQgKiB1c2VkOyBlbHNlLCB0aGUgbG93ZXJjYXNlIGZvcm0gaXMgdXNlZC4gVGhlIGJlaGF2aW9yIGlzIHVuZGVmaW5lZFxuXHQgKiBpZiBgZmxhZ2AgaXMgbm9uLXplcm8gYW5kIGBkaWdpdGAgaGFzIG5vIHVwcGVyY2FzZSBmb3JtLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGlnaXRUb0Jhc2ljKGRpZ2l0LCBmbGFnKSB7XG5cdFx0Ly8gIDAuLjI1IG1hcCB0byBBU0NJSSBhLi56IG9yIEEuLlpcblx0XHQvLyAyNi4uMzUgbWFwIHRvIEFTQ0lJIDAuLjlcblx0XHRyZXR1cm4gZGlnaXQgKyAyMiArIDc1ICogKGRpZ2l0IDwgMjYpIC0gKChmbGFnICE9IDApIDw8IDUpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJpYXMgYWRhcHRhdGlvbiBmdW5jdGlvbiBhcyBwZXIgc2VjdGlvbiAzLjQgb2YgUkZDIDM0OTIuXG5cdCAqIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzNDkyI3NlY3Rpb24tMy40XG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRmdW5jdGlvbiBhZGFwdChkZWx0YSwgbnVtUG9pbnRzLCBmaXJzdFRpbWUpIHtcblx0XHR2YXIgayA9IDA7XG5cdFx0ZGVsdGEgPSBmaXJzdFRpbWUgPyBmbG9vcihkZWx0YSAvIGRhbXApIDogZGVsdGEgPj4gMTtcblx0XHRkZWx0YSArPSBmbG9vcihkZWx0YSAvIG51bVBvaW50cyk7XG5cdFx0Zm9yICgvKiBubyBpbml0aWFsaXphdGlvbiAqLzsgZGVsdGEgPiBiYXNlTWludXNUTWluICogdE1heCA+PiAxOyBrICs9IGJhc2UpIHtcblx0XHRcdGRlbHRhID0gZmxvb3IoZGVsdGEgLyBiYXNlTWludXNUTWluKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZsb29yKGsgKyAoYmFzZU1pbnVzVE1pbiArIDEpICogZGVsdGEgLyAoZGVsdGEgKyBza2V3KSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzIHRvIGEgc3RyaW5nIG9mIFVuaWNvZGVcblx0ICogc3ltYm9scy5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlc3VsdGluZyBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGVjb2RlKGlucHV0KSB7XG5cdFx0Ly8gRG9uJ3QgdXNlIFVDUy0yXG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aCxcblx0XHQgICAgb3V0LFxuXHRcdCAgICBpID0gMCxcblx0XHQgICAgbiA9IGluaXRpYWxOLFxuXHRcdCAgICBiaWFzID0gaW5pdGlhbEJpYXMsXG5cdFx0ICAgIGJhc2ljLFxuXHRcdCAgICBqLFxuXHRcdCAgICBpbmRleCxcblx0XHQgICAgb2xkaSxcblx0XHQgICAgdyxcblx0XHQgICAgayxcblx0XHQgICAgZGlnaXQsXG5cdFx0ICAgIHQsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBiYXNlTWludXNUO1xuXG5cdFx0Ly8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50czogbGV0IGBiYXNpY2AgYmUgdGhlIG51bWJlciBvZiBpbnB1dCBjb2RlXG5cdFx0Ly8gcG9pbnRzIGJlZm9yZSB0aGUgbGFzdCBkZWxpbWl0ZXIsIG9yIGAwYCBpZiB0aGVyZSBpcyBub25lLCB0aGVuIGNvcHlcblx0XHQvLyB0aGUgZmlyc3QgYmFzaWMgY29kZSBwb2ludHMgdG8gdGhlIG91dHB1dC5cblxuXHRcdGJhc2ljID0gaW5wdXQubGFzdEluZGV4T2YoZGVsaW1pdGVyKTtcblx0XHRpZiAoYmFzaWMgPCAwKSB7XG5cdFx0XHRiYXNpYyA9IDA7XG5cdFx0fVxuXG5cdFx0Zm9yIChqID0gMDsgaiA8IGJhc2ljOyArK2opIHtcblx0XHRcdC8vIGlmIGl0J3Mgbm90IGEgYmFzaWMgY29kZSBwb2ludFxuXHRcdFx0aWYgKGlucHV0LmNoYXJDb2RlQXQoaikgPj0gMHg4MCkge1xuXHRcdFx0XHRlcnJvcignbm90LWJhc2ljJyk7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQucHVzaChpbnB1dC5jaGFyQ29kZUF0KGopKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIGRlY29kaW5nIGxvb3A6IHN0YXJ0IGp1c3QgYWZ0ZXIgdGhlIGxhc3QgZGVsaW1pdGVyIGlmIGFueSBiYXNpYyBjb2RlXG5cdFx0Ly8gcG9pbnRzIHdlcmUgY29waWVkOyBzdGFydCBhdCB0aGUgYmVnaW5uaW5nIG90aGVyd2lzZS5cblxuXHRcdGZvciAoaW5kZXggPSBiYXNpYyA+IDAgPyBiYXNpYyArIDEgOiAwOyBpbmRleCA8IGlucHV0TGVuZ3RoOyAvKiBubyBmaW5hbCBleHByZXNzaW9uICovKSB7XG5cblx0XHRcdC8vIGBpbmRleGAgaXMgdGhlIGluZGV4IG9mIHRoZSBuZXh0IGNoYXJhY3RlciB0byBiZSBjb25zdW1lZC5cblx0XHRcdC8vIERlY29kZSBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyIGludG8gYGRlbHRhYCxcblx0XHRcdC8vIHdoaWNoIGdldHMgYWRkZWQgdG8gYGlgLiBUaGUgb3ZlcmZsb3cgY2hlY2tpbmcgaXMgZWFzaWVyXG5cdFx0XHQvLyBpZiB3ZSBpbmNyZWFzZSBgaWAgYXMgd2UgZ28sIHRoZW4gc3VidHJhY3Qgb2ZmIGl0cyBzdGFydGluZ1xuXHRcdFx0Ly8gdmFsdWUgYXQgdGhlIGVuZCB0byBvYnRhaW4gYGRlbHRhYC5cblx0XHRcdGZvciAob2xkaSA9IGksIHcgPSAxLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblxuXHRcdFx0XHRpZiAoaW5kZXggPj0gaW5wdXRMZW5ndGgpIHtcblx0XHRcdFx0XHRlcnJvcignaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZGlnaXQgPSBiYXNpY1RvRGlnaXQoaW5wdXQuY2hhckNvZGVBdChpbmRleCsrKSk7XG5cblx0XHRcdFx0aWYgKGRpZ2l0ID49IGJhc2UgfHwgZGlnaXQgPiBmbG9vcigobWF4SW50IC0gaSkgLyB3KSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aSArPSBkaWdpdCAqIHc7XG5cdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA8IHQpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0aWYgKHcgPiBmbG9vcihtYXhJbnQgLyBiYXNlTWludXNUKSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dyAqPSBiYXNlTWludXNUO1xuXG5cdFx0XHR9XG5cblx0XHRcdG91dCA9IG91dHB1dC5sZW5ndGggKyAxO1xuXHRcdFx0YmlhcyA9IGFkYXB0KGkgLSBvbGRpLCBvdXQsIG9sZGkgPT0gMCk7XG5cblx0XHRcdC8vIGBpYCB3YXMgc3VwcG9zZWQgdG8gd3JhcCBhcm91bmQgZnJvbSBgb3V0YCB0byBgMGAsXG5cdFx0XHQvLyBpbmNyZW1lbnRpbmcgYG5gIGVhY2ggdGltZSwgc28gd2UnbGwgZml4IHRoYXQgbm93OlxuXHRcdFx0aWYgKGZsb29yKGkgLyBvdXQpID4gbWF4SW50IC0gbikge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0biArPSBmbG9vcihpIC8gb3V0KTtcblx0XHRcdGkgJT0gb3V0O1xuXG5cdFx0XHQvLyBJbnNlcnQgYG5gIGF0IHBvc2l0aW9uIGBpYCBvZiB0aGUgb3V0cHV0XG5cdFx0XHRvdXRwdXQuc3BsaWNlKGkrKywgMCwgbik7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gdWNzMmVuY29kZShvdXRwdXQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scyAoZS5nLiBhIGRvbWFpbiBuYW1lIGxhYmVsKSB0byBhXG5cdCAqIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGVuY29kZShpbnB1dCkge1xuXHRcdHZhciBuLFxuXHRcdCAgICBkZWx0YSxcblx0XHQgICAgaGFuZGxlZENQQ291bnQsXG5cdFx0ICAgIGJhc2ljTGVuZ3RoLFxuXHRcdCAgICBiaWFzLFxuXHRcdCAgICBqLFxuXHRcdCAgICBtLFxuXHRcdCAgICBxLFxuXHRcdCAgICBrLFxuXHRcdCAgICB0LFxuXHRcdCAgICBjdXJyZW50VmFsdWUsXG5cdFx0ICAgIG91dHB1dCA9IFtdLFxuXHRcdCAgICAvKiogYGlucHV0TGVuZ3RoYCB3aWxsIGhvbGQgdGhlIG51bWJlciBvZiBjb2RlIHBvaW50cyBpbiBgaW5wdXRgLiAqL1xuXHRcdCAgICBpbnB1dExlbmd0aCxcblx0XHQgICAgLyoqIENhY2hlZCBjYWxjdWxhdGlvbiByZXN1bHRzICovXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50UGx1c09uZSxcblx0XHQgICAgYmFzZU1pbnVzVCxcblx0XHQgICAgcU1pbnVzVDtcblxuXHRcdC8vIENvbnZlcnQgdGhlIGlucHV0IGluIFVDUy0yIHRvIFVuaWNvZGVcblx0XHRpbnB1dCA9IHVjczJkZWNvZGUoaW5wdXQpO1xuXG5cdFx0Ly8gQ2FjaGUgdGhlIGxlbmd0aFxuXHRcdGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSB0aGUgc3RhdGVcblx0XHRuID0gaW5pdGlhbE47XG5cdFx0ZGVsdGEgPSAwO1xuXHRcdGJpYXMgPSBpbml0aWFsQmlhcztcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHNcblx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgMHg4MCkge1xuXHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoY3VycmVudFZhbHVlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aGFuZGxlZENQQ291bnQgPSBiYXNpY0xlbmd0aCA9IG91dHB1dC5sZW5ndGg7XG5cblx0XHQvLyBgaGFuZGxlZENQQ291bnRgIGlzIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgdGhhdCBoYXZlIGJlZW4gaGFuZGxlZDtcblx0XHQvLyBgYmFzaWNMZW5ndGhgIGlzIHRoZSBudW1iZXIgb2YgYmFzaWMgY29kZSBwb2ludHMuXG5cblx0XHQvLyBGaW5pc2ggdGhlIGJhc2ljIHN0cmluZyAtIGlmIGl0IGlzIG5vdCBlbXB0eSAtIHdpdGggYSBkZWxpbWl0ZXJcblx0XHRpZiAoYmFzaWNMZW5ndGgpIHtcblx0XHRcdG91dHB1dC5wdXNoKGRlbGltaXRlcik7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBlbmNvZGluZyBsb29wOlxuXHRcdHdoaWxlIChoYW5kbGVkQ1BDb3VudCA8IGlucHV0TGVuZ3RoKSB7XG5cblx0XHRcdC8vIEFsbCBub24tYmFzaWMgY29kZSBwb2ludHMgPCBuIGhhdmUgYmVlbiBoYW5kbGVkIGFscmVhZHkuIEZpbmQgdGhlIG5leHRcblx0XHRcdC8vIGxhcmdlciBvbmU6XG5cdFx0XHRmb3IgKG0gPSBtYXhJbnQsIGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA+PSBuICYmIGN1cnJlbnRWYWx1ZSA8IG0pIHtcblx0XHRcdFx0XHRtID0gY3VycmVudFZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluY3JlYXNlIGBkZWx0YWAgZW5vdWdoIHRvIGFkdmFuY2UgdGhlIGRlY29kZXIncyA8bixpPiBzdGF0ZSB0byA8bSwwPixcblx0XHRcdC8vIGJ1dCBndWFyZCBhZ2FpbnN0IG92ZXJmbG93XG5cdFx0XHRoYW5kbGVkQ1BDb3VudFBsdXNPbmUgPSBoYW5kbGVkQ1BDb3VudCArIDE7XG5cdFx0XHRpZiAobSAtIG4gPiBmbG9vcigobWF4SW50IC0gZGVsdGEpIC8gaGFuZGxlZENQQ291bnRQbHVzT25lKSkge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0ZGVsdGEgKz0gKG0gLSBuKSAqIGhhbmRsZWRDUENvdW50UGx1c09uZTtcblx0XHRcdG4gPSBtO1xuXG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgbiAmJiArK2RlbHRhID4gbWF4SW50KSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlID09IG4pIHtcblx0XHRcdFx0XHQvLyBSZXByZXNlbnQgZGVsdGEgYXMgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlclxuXHRcdFx0XHRcdGZvciAocSA9IGRlbHRhLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblx0XHRcdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXHRcdFx0XHRcdFx0aWYgKHEgPCB0KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cU1pbnVzVCA9IHEgLSB0O1xuXHRcdFx0XHRcdFx0YmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXHRcdFx0XHRcdFx0b3V0cHV0LnB1c2goXG5cdFx0XHRcdFx0XHRcdHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWModCArIHFNaW51c1QgJSBiYXNlTWludXNULCAwKSlcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRxID0gZmxvb3IocU1pbnVzVCAvIGJhc2VNaW51c1QpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWMocSwgMCkpKTtcblx0XHRcdFx0XHRiaWFzID0gYWRhcHQoZGVsdGEsIGhhbmRsZWRDUENvdW50UGx1c09uZSwgaGFuZGxlZENQQ291bnQgPT0gYmFzaWNMZW5ndGgpO1xuXHRcdFx0XHRcdGRlbHRhID0gMDtcblx0XHRcdFx0XHQrK2hhbmRsZWRDUENvdW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdCsrZGVsdGE7XG5cdFx0XHQrK247XG5cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dC5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSBvciBhbiBlbWFpbCBhZGRyZXNzXG5cdCAqIHRvIFVuaWNvZGUuIE9ubHkgdGhlIFB1bnljb2RlZCBwYXJ0cyBvZiB0aGUgaW5wdXQgd2lsbCBiZSBjb252ZXJ0ZWQsIGkuZS5cblx0ICogaXQgZG9lc24ndCBtYXR0ZXIgaWYgeW91IGNhbGwgaXQgb24gYSBzdHJpbmcgdGhhdCBoYXMgYWxyZWFkeSBiZWVuXG5cdCAqIGNvbnZlcnRlZCB0byBVbmljb2RlLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBQdW55Y29kZWQgZG9tYWluIG5hbWUgb3IgZW1haWwgYWRkcmVzcyB0b1xuXHQgKiBjb252ZXJ0IHRvIFVuaWNvZGUuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBVbmljb2RlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBnaXZlbiBQdW55Y29kZVxuXHQgKiBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b1VuaWNvZGUoaW5wdXQpIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGlucHV0LCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleFB1bnljb2RlLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/IGRlY29kZShzdHJpbmcuc2xpY2UoNCkudG9Mb3dlckNhc2UoKSlcblx0XHRcdFx0OiBzdHJpbmc7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBVbmljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSBvciBhbiBlbWFpbCBhZGRyZXNzIHRvXG5cdCAqIFB1bnljb2RlLiBPbmx5IHRoZSBub24tQVNDSUkgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHdpbGwgYmUgY29udmVydGVkLFxuXHQgKiBpLmUuIGl0IGRvZXNuJ3QgbWF0dGVyIGlmIHlvdSBjYWxsIGl0IHdpdGggYSBkb21haW4gdGhhdCdzIGFscmVhZHkgaW5cblx0ICogQVNDSUkuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIGRvbWFpbiBuYW1lIG9yIGVtYWlsIGFkZHJlc3MgdG8gY29udmVydCwgYXMgYVxuXHQgKiBVbmljb2RlIHN0cmluZy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIFB1bnljb2RlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBnaXZlbiBkb21haW4gbmFtZSBvclxuXHQgKiBlbWFpbCBhZGRyZXNzLlxuXHQgKi9cblx0ZnVuY3Rpb24gdG9BU0NJSShpbnB1dCkge1xuXHRcdHJldHVybiBtYXBEb21haW4oaW5wdXQsIGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdFx0cmV0dXJuIHJlZ2V4Tm9uQVNDSUkudGVzdChzdHJpbmcpXG5cdFx0XHRcdD8gJ3huLS0nICsgZW5jb2RlKHN0cmluZylcblx0XHRcdFx0OiBzdHJpbmc7XG5cdFx0fSk7XG5cdH1cblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKiogRGVmaW5lIHRoZSBwdWJsaWMgQVBJICovXG5cdHB1bnljb2RlID0ge1xuXHRcdC8qKlxuXHRcdCAqIEEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgY3VycmVudCBQdW55Y29kZS5qcyB2ZXJzaW9uIG51bWJlci5cblx0XHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0XHQgKiBAdHlwZSBTdHJpbmdcblx0XHQgKi9cblx0XHQndmVyc2lvbic6ICcxLjMuMicsXG5cdFx0LyoqXG5cdFx0ICogQW4gb2JqZWN0IG9mIG1ldGhvZHMgdG8gY29udmVydCBmcm9tIEphdmFTY3JpcHQncyBpbnRlcm5hbCBjaGFyYWN0ZXJcblx0XHQgKiByZXByZXNlbnRhdGlvbiAoVUNTLTIpIHRvIFVuaWNvZGUgY29kZSBwb2ludHMsIGFuZCBiYWNrLlxuXHRcdCAqIEBzZWUgPGh0dHBzOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIE9iamVjdFxuXHRcdCAqL1xuXHRcdCd1Y3MyJzoge1xuXHRcdFx0J2RlY29kZSc6IHVjczJkZWNvZGUsXG5cdFx0XHQnZW5jb2RlJzogdWNzMmVuY29kZVxuXHRcdH0sXG5cdFx0J2RlY29kZSc6IGRlY29kZSxcblx0XHQnZW5jb2RlJzogZW5jb2RlLFxuXHRcdCd0b0FTQ0lJJzogdG9BU0NJSSxcblx0XHQndG9Vbmljb2RlJzogdG9Vbmljb2RlXG5cdH07XG5cblx0LyoqIEV4cG9zZSBgcHVueWNvZGVgICovXG5cdC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMsIGxpa2Ugci5qcywgY2hlY2sgZm9yIHNwZWNpZmljIGNvbmRpdGlvbiBwYXR0ZXJuc1xuXHQvLyBsaWtlIHRoZSBmb2xsb3dpbmc6XG5cdGlmIChcblx0XHR0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiZcblx0XHR0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJlxuXHRcdGRlZmluZS5hbWRcblx0KSB7XG5cdFx0ZGVmaW5lKCdwdW55Y29kZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHB1bnljb2RlO1xuXHRcdH0pO1xuXHR9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUpIHtcblx0XHRpZiAobW9kdWxlLmV4cG9ydHMgPT0gZnJlZUV4cG9ydHMpIHtcblx0XHRcdC8vIGluIE5vZGUuanMsIGlvLmpzLCBvciBSaW5nb0pTIHYwLjguMCtcblx0XHRcdGZyZWVNb2R1bGUuZXhwb3J0cyA9IHB1bnljb2RlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0Zm9yIChrZXkgaW4gcHVueWNvZGUpIHtcblx0XHRcdFx0cHVueWNvZGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IHB1bnljb2RlW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBpbiBSaGlubyBvciBhIHdlYiBicm93c2VyXG5cdFx0cm9vdC5wdW55Y29kZSA9IHB1bnljb2RlO1xuXHR9XG5cbn0odGhpcykpO1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gSWYgb2JqLmhhc093blByb3BlcnR5IGhhcyBiZWVuIG92ZXJyaWRkZW4sIHRoZW4gY2FsbGluZ1xuLy8gb2JqLmhhc093blByb3BlcnR5KHByb3ApIHdpbGwgYnJlYWsuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9qb3llbnQvbm9kZS9pc3N1ZXMvMTcwN1xuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihxcywgc2VwLCBlcSwgb3B0aW9ucykge1xuICBzZXAgPSBzZXAgfHwgJyYnO1xuICBlcSA9IGVxIHx8ICc9JztcbiAgdmFyIG9iaiA9IHt9O1xuXG4gIGlmICh0eXBlb2YgcXMgIT09ICdzdHJpbmcnIHx8IHFzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICB2YXIgcmVnZXhwID0gL1xcKy9nO1xuICBxcyA9IHFzLnNwbGl0KHNlcCk7XG5cbiAgdmFyIG1heEtleXMgPSAxMDAwO1xuICBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5tYXhLZXlzID09PSAnbnVtYmVyJykge1xuICAgIG1heEtleXMgPSBvcHRpb25zLm1heEtleXM7XG4gIH1cblxuICB2YXIgbGVuID0gcXMubGVuZ3RoO1xuICAvLyBtYXhLZXlzIDw9IDAgbWVhbnMgdGhhdCB3ZSBzaG91bGQgbm90IGxpbWl0IGtleXMgY291bnRcbiAgaWYgKG1heEtleXMgPiAwICYmIGxlbiA+IG1heEtleXMpIHtcbiAgICBsZW4gPSBtYXhLZXlzO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIHZhciB4ID0gcXNbaV0ucmVwbGFjZShyZWdleHAsICclMjAnKSxcbiAgICAgICAgaWR4ID0geC5pbmRleE9mKGVxKSxcbiAgICAgICAga3N0ciwgdnN0ciwgaywgdjtcblxuICAgIGlmIChpZHggPj0gMCkge1xuICAgICAga3N0ciA9IHguc3Vic3RyKDAsIGlkeCk7XG4gICAgICB2c3RyID0geC5zdWJzdHIoaWR4ICsgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGtzdHIgPSB4O1xuICAgICAgdnN0ciA9ICcnO1xuICAgIH1cblxuICAgIGsgPSBkZWNvZGVVUklDb21wb25lbnQoa3N0cik7XG4gICAgdiA9IGRlY29kZVVSSUNvbXBvbmVudCh2c3RyKTtcblxuICAgIGlmICghaGFzT3duUHJvcGVydHkob2JqLCBrKSkge1xuICAgICAgb2JqW2tdID0gdjtcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkob2JqW2tdKSkge1xuICAgICAgb2JqW2tdLnB1c2godik7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ialtrXSA9IFtvYmpba10sIHZdO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvYmo7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdpZnlQcmltaXRpdmUgPSBmdW5jdGlvbih2KSB7XG4gIHN3aXRjaCAodHlwZW9mIHYpIHtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIHY7XG5cbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiB2ID8gJ3RydWUnIDogJ2ZhbHNlJztcblxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gaXNGaW5pdGUodikgPyB2IDogJyc7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuICcnO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9iaiwgc2VwLCBlcSwgbmFtZSkge1xuICBzZXAgPSBzZXAgfHwgJyYnO1xuICBlcSA9IGVxIHx8ICc9JztcbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIG9iaiA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBtYXAob2JqZWN0S2V5cyhvYmopLCBmdW5jdGlvbihrKSB7XG4gICAgICB2YXIga3MgPSBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKGspKSArIGVxO1xuICAgICAgaWYgKGlzQXJyYXkob2JqW2tdKSkge1xuICAgICAgICByZXR1cm4gbWFwKG9ialtrXSwgZnVuY3Rpb24odikge1xuICAgICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUodikpO1xuICAgICAgICB9KS5qb2luKHNlcCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ga3MgKyBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG9ialtrXSkpO1xuICAgICAgfVxuICAgIH0pLmpvaW4oc2VwKTtcblxuICB9XG5cbiAgaWYgKCFuYW1lKSByZXR1cm4gJyc7XG4gIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG5hbWUpKSArIGVxICtcbiAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqKSk7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxuZnVuY3Rpb24gbWFwICh4cywgZikge1xuICBpZiAoeHMubWFwKSByZXR1cm4geHMubWFwKGYpO1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICByZXMucHVzaChmKHhzW2ldLCBpKSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSByZXMucHVzaChrZXkpO1xuICB9XG4gIHJldHVybiByZXM7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmRlY29kZSA9IGV4cG9ydHMucGFyc2UgPSByZXF1aXJlKCcuL2RlY29kZScpO1xuZXhwb3J0cy5lbmNvZGUgPSBleHBvcnRzLnN0cmluZ2lmeSA9IHJlcXVpcmUoJy4vZW5jb2RlJyk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2xpYi9fc3RyZWFtX2R1cGxleC5qc1wiKVxuIiwiLy8gYSBkdXBsZXggc3RyZWFtIGlzIGp1c3QgYSBzdHJlYW0gdGhhdCBpcyBib3RoIHJlYWRhYmxlIGFuZCB3cml0YWJsZS5cbi8vIFNpbmNlIEpTIGRvZXNuJ3QgaGF2ZSBtdWx0aXBsZSBwcm90b3R5cGFsIGluaGVyaXRhbmNlLCB0aGlzIGNsYXNzXG4vLyBwcm90b3R5cGFsbHkgaW5oZXJpdHMgZnJvbSBSZWFkYWJsZSwgYW5kIHRoZW4gcGFyYXNpdGljYWxseSBmcm9tXG4vLyBXcml0YWJsZS5cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBrZXlzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIGtleXMucHVzaChrZXkpO1xuICByZXR1cm4ga2V5cztcbn1cbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbm1vZHVsZS5leHBvcnRzID0gRHVwbGV4O1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHByb2Nlc3NOZXh0VGljayA9IHJlcXVpcmUoJ3Byb2Nlc3MtbmV4dGljay1hcmdzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFJlYWRhYmxlID0gcmVxdWlyZSgnLi9fc3RyZWFtX3JlYWRhYmxlJyk7XG52YXIgV3JpdGFibGUgPSByZXF1aXJlKCcuL19zdHJlYW1fd3JpdGFibGUnKTtcblxudXRpbC5pbmhlcml0cyhEdXBsZXgsIFJlYWRhYmxlKTtcblxudmFyIGtleXMgPSBvYmplY3RLZXlzKFdyaXRhYmxlLnByb3RvdHlwZSk7XG5mb3IgKHZhciB2ID0gMDsgdiA8IGtleXMubGVuZ3RoOyB2KyspIHtcbiAgdmFyIG1ldGhvZCA9IGtleXNbdl07XG4gIGlmICghRHVwbGV4LnByb3RvdHlwZVttZXRob2RdKVxuICAgIER1cGxleC5wcm90b3R5cGVbbWV0aG9kXSA9IFdyaXRhYmxlLnByb3RvdHlwZVttZXRob2RdO1xufVxuXG5mdW5jdGlvbiBEdXBsZXgob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRHVwbGV4KSlcbiAgICByZXR1cm4gbmV3IER1cGxleChvcHRpb25zKTtcblxuICBSZWFkYWJsZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuICBXcml0YWJsZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuXG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMucmVhZGFibGUgPT09IGZhbHNlKVxuICAgIHRoaXMucmVhZGFibGUgPSBmYWxzZTtcblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLndyaXRhYmxlID09PSBmYWxzZSlcbiAgICB0aGlzLndyaXRhYmxlID0gZmFsc2U7XG5cbiAgdGhpcy5hbGxvd0hhbGZPcGVuID0gdHJ1ZTtcbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5hbGxvd0hhbGZPcGVuID09PSBmYWxzZSlcbiAgICB0aGlzLmFsbG93SGFsZk9wZW4gPSBmYWxzZTtcblxuICB0aGlzLm9uY2UoJ2VuZCcsIG9uZW5kKTtcbn1cblxuLy8gdGhlIG5vLWhhbGYtb3BlbiBlbmZvcmNlclxuZnVuY3Rpb24gb25lbmQoKSB7XG4gIC8vIGlmIHdlIGFsbG93IGhhbGYtb3BlbiBzdGF0ZSwgb3IgaWYgdGhlIHdyaXRhYmxlIHNpZGUgZW5kZWQsXG4gIC8vIHRoZW4gd2UncmUgb2suXG4gIGlmICh0aGlzLmFsbG93SGFsZk9wZW4gfHwgdGhpcy5fd3JpdGFibGVTdGF0ZS5lbmRlZClcbiAgICByZXR1cm47XG5cbiAgLy8gbm8gbW9yZSBkYXRhIGNhbiBiZSB3cml0dGVuLlxuICAvLyBCdXQgYWxsb3cgbW9yZSB3cml0ZXMgdG8gaGFwcGVuIGluIHRoaXMgdGljay5cbiAgcHJvY2Vzc05leHRUaWNrKG9uRW5kTlQsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBvbkVuZE5UKHNlbGYpIHtcbiAgc2VsZi5lbmQoKTtcbn1cblxuZnVuY3Rpb24gZm9yRWFjaCAoeHMsIGYpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmKHhzW2ldLCBpKTtcbiAgfVxufVxuIiwiLy8gYSBwYXNzdGhyb3VnaCBzdHJlYW0uXG4vLyBiYXNpY2FsbHkganVzdCB0aGUgbW9zdCBtaW5pbWFsIHNvcnQgb2YgVHJhbnNmb3JtIHN0cmVhbS5cbi8vIEV2ZXJ5IHdyaXR0ZW4gY2h1bmsgZ2V0cyBvdXRwdXQgYXMtaXMuXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBQYXNzVGhyb3VnaDtcblxudmFyIFRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vX3N0cmVhbV90cmFuc2Zvcm0nKTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG51dGlsLmluaGVyaXRzKFBhc3NUaHJvdWdoLCBUcmFuc2Zvcm0pO1xuXG5mdW5jdGlvbiBQYXNzVGhyb3VnaChvcHRpb25zKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQYXNzVGhyb3VnaCkpXG4gICAgcmV0dXJuIG5ldyBQYXNzVGhyb3VnaChvcHRpb25zKTtcblxuICBUcmFuc2Zvcm0uY2FsbCh0aGlzLCBvcHRpb25zKTtcbn1cblxuUGFzc1Rocm91Z2gucHJvdG90eXBlLl90cmFuc2Zvcm0gPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNiKG51bGwsIGNodW5rKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhZGFibGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgcHJvY2Vzc05leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy1uZXh0aWNrLWFyZ3MnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblJlYWRhYmxlLlJlYWRhYmxlU3RhdGUgPSBSZWFkYWJsZVN0YXRlO1xuXG52YXIgRUUgPSByZXF1aXJlKCdldmVudHMnKTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBFRWxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVycyh0eXBlKS5sZW5ndGg7XG59O1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIFN0cmVhbTtcbihmdW5jdGlvbiAoKXt0cnl7XG4gIFN0cmVhbSA9IHJlcXVpcmUoJ3N0JyArICdyZWFtJyk7XG59Y2F0Y2goXyl7fWZpbmFsbHl7XG4gIGlmICghU3RyZWFtKVxuICAgIFN0cmVhbSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbn19KCkpXG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBkZWJ1Z1V0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG52YXIgZGVidWc7XG5pZiAoZGVidWdVdGlsICYmIGRlYnVnVXRpbC5kZWJ1Z2xvZykge1xuICBkZWJ1ZyA9IGRlYnVnVXRpbC5kZWJ1Z2xvZygnc3RyZWFtJyk7XG59IGVsc2Uge1xuICBkZWJ1ZyA9IGZ1bmN0aW9uICgpIHt9O1xufVxuLyo8L3JlcGxhY2VtZW50PiovXG5cbnZhciBTdHJpbmdEZWNvZGVyO1xuXG51dGlsLmluaGVyaXRzKFJlYWRhYmxlLCBTdHJlYW0pO1xuXG52YXIgRHVwbGV4O1xuZnVuY3Rpb24gUmVhZGFibGVTdGF0ZShvcHRpb25zLCBzdHJlYW0pIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyBvYmplY3Qgc3RyZWFtIGZsYWcuIFVzZWQgdG8gbWFrZSByZWFkKG4pIGlnbm9yZSBuIGFuZCB0b1xuICAvLyBtYWtlIGFsbCB0aGUgYnVmZmVyIG1lcmdpbmcgYW5kIGxlbmd0aCBjaGVja3MgZ28gYXdheVxuICB0aGlzLm9iamVjdE1vZGUgPSAhIW9wdGlvbnMub2JqZWN0TW9kZTtcblxuICBpZiAoc3RyZWFtIGluc3RhbmNlb2YgRHVwbGV4KVxuICAgIHRoaXMub2JqZWN0TW9kZSA9IHRoaXMub2JqZWN0TW9kZSB8fCAhIW9wdGlvbnMucmVhZGFibGVPYmplY3RNb2RlO1xuXG4gIC8vIHRoZSBwb2ludCBhdCB3aGljaCBpdCBzdG9wcyBjYWxsaW5nIF9yZWFkKCkgdG8gZmlsbCB0aGUgYnVmZmVyXG4gIC8vIE5vdGU6IDAgaXMgYSB2YWxpZCB2YWx1ZSwgbWVhbnMgXCJkb24ndCBjYWxsIF9yZWFkIHByZWVtcHRpdmVseSBldmVyXCJcbiAgdmFyIGh3bSA9IG9wdGlvbnMuaGlnaFdhdGVyTWFyaztcbiAgdmFyIGRlZmF1bHRId20gPSB0aGlzLm9iamVjdE1vZGUgPyAxNiA6IDE2ICogMTAyNDtcbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gKGh3bSB8fCBod20gPT09IDApID8gaHdtIDogZGVmYXVsdEh3bTtcblxuICAvLyBjYXN0IHRvIGludHMuXG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IH5+dGhpcy5oaWdoV2F0ZXJNYXJrO1xuXG4gIHRoaXMuYnVmZmVyID0gW107XG4gIHRoaXMubGVuZ3RoID0gMDtcbiAgdGhpcy5waXBlcyA9IG51bGw7XG4gIHRoaXMucGlwZXNDb3VudCA9IDA7XG4gIHRoaXMuZmxvd2luZyA9IG51bGw7XG4gIHRoaXMuZW5kZWQgPSBmYWxzZTtcbiAgdGhpcy5lbmRFbWl0dGVkID0gZmFsc2U7XG4gIHRoaXMucmVhZGluZyA9IGZhbHNlO1xuXG4gIC8vIGEgZmxhZyB0byBiZSBhYmxlIHRvIHRlbGwgaWYgdGhlIG9ud3JpdGUgY2IgaXMgY2FsbGVkIGltbWVkaWF0ZWx5LFxuICAvLyBvciBvbiBhIGxhdGVyIHRpY2suICBXZSBzZXQgdGhpcyB0byB0cnVlIGF0IGZpcnN0LCBiZWNhdXNlIGFueVxuICAvLyBhY3Rpb25zIHRoYXQgc2hvdWxkbid0IGhhcHBlbiB1bnRpbCBcImxhdGVyXCIgc2hvdWxkIGdlbmVyYWxseSBhbHNvXG4gIC8vIG5vdCBoYXBwZW4gYmVmb3JlIHRoZSBmaXJzdCB3cml0ZSBjYWxsLlxuICB0aGlzLnN5bmMgPSB0cnVlO1xuXG4gIC8vIHdoZW5ldmVyIHdlIHJldHVybiBudWxsLCB0aGVuIHdlIHNldCBhIGZsYWcgdG8gc2F5XG4gIC8vIHRoYXQgd2UncmUgYXdhaXRpbmcgYSAncmVhZGFibGUnIGV2ZW50IGVtaXNzaW9uLlxuICB0aGlzLm5lZWRSZWFkYWJsZSA9IGZhbHNlO1xuICB0aGlzLmVtaXR0ZWRSZWFkYWJsZSA9IGZhbHNlO1xuICB0aGlzLnJlYWRhYmxlTGlzdGVuaW5nID0gZmFsc2U7XG5cbiAgLy8gQ3J5cHRvIGlzIGtpbmQgb2Ygb2xkIGFuZCBjcnVzdHkuICBIaXN0b3JpY2FsbHksIGl0cyBkZWZhdWx0IHN0cmluZ1xuICAvLyBlbmNvZGluZyBpcyAnYmluYXJ5JyBzbyB3ZSBoYXZlIHRvIG1ha2UgdGhpcyBjb25maWd1cmFibGUuXG4gIC8vIEV2ZXJ5dGhpbmcgZWxzZSBpbiB0aGUgdW5pdmVyc2UgdXNlcyAndXRmOCcsIHRob3VnaC5cbiAgdGhpcy5kZWZhdWx0RW5jb2RpbmcgPSBvcHRpb25zLmRlZmF1bHRFbmNvZGluZyB8fCAndXRmOCc7XG5cbiAgLy8gd2hlbiBwaXBpbmcsIHdlIG9ubHkgY2FyZSBhYm91dCAncmVhZGFibGUnIGV2ZW50cyB0aGF0IGhhcHBlblxuICAvLyBhZnRlciByZWFkKClpbmcgYWxsIHRoZSBieXRlcyBhbmQgbm90IGdldHRpbmcgYW55IHB1c2hiYWNrLlxuICB0aGlzLnJhbk91dCA9IGZhbHNlO1xuXG4gIC8vIHRoZSBudW1iZXIgb2Ygd3JpdGVycyB0aGF0IGFyZSBhd2FpdGluZyBhIGRyYWluIGV2ZW50IGluIC5waXBlKClzXG4gIHRoaXMuYXdhaXREcmFpbiA9IDA7XG5cbiAgLy8gaWYgdHJ1ZSwgYSBtYXliZVJlYWRNb3JlIGhhcyBiZWVuIHNjaGVkdWxlZFxuICB0aGlzLnJlYWRpbmdNb3JlID0gZmFsc2U7XG5cbiAgdGhpcy5kZWNvZGVyID0gbnVsbDtcbiAgdGhpcy5lbmNvZGluZyA9IG51bGw7XG4gIGlmIChvcHRpb25zLmVuY29kaW5nKSB7XG4gICAgaWYgKCFTdHJpbmdEZWNvZGVyKVxuICAgICAgU3RyaW5nRGVjb2RlciA9IHJlcXVpcmUoJ3N0cmluZ19kZWNvZGVyLycpLlN0cmluZ0RlY29kZXI7XG4gICAgdGhpcy5kZWNvZGVyID0gbmV3IFN0cmluZ0RlY29kZXIob3B0aW9ucy5lbmNvZGluZyk7XG4gICAgdGhpcy5lbmNvZGluZyA9IG9wdGlvbnMuZW5jb2Rpbmc7XG4gIH1cbn1cblxudmFyIER1cGxleDtcbmZ1bmN0aW9uIFJlYWRhYmxlKG9wdGlvbnMpIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUmVhZGFibGUpKVxuICAgIHJldHVybiBuZXcgUmVhZGFibGUob3B0aW9ucyk7XG5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZSA9IG5ldyBSZWFkYWJsZVN0YXRlKG9wdGlvbnMsIHRoaXMpO1xuXG4gIC8vIGxlZ2FjeVxuICB0aGlzLnJlYWRhYmxlID0gdHJ1ZTtcblxuICBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5yZWFkID09PSAnZnVuY3Rpb24nKVxuICAgIHRoaXMuX3JlYWQgPSBvcHRpb25zLnJlYWQ7XG5cbiAgU3RyZWFtLmNhbGwodGhpcyk7XG59XG5cbi8vIE1hbnVhbGx5IHNob3ZlIHNvbWV0aGluZyBpbnRvIHRoZSByZWFkKCkgYnVmZmVyLlxuLy8gVGhpcyByZXR1cm5zIHRydWUgaWYgdGhlIGhpZ2hXYXRlck1hcmsgaGFzIG5vdCBiZWVuIGhpdCB5ZXQsXG4vLyBzaW1pbGFyIHRvIGhvdyBXcml0YWJsZS53cml0ZSgpIHJldHVybnMgdHJ1ZSBpZiB5b3Ugc2hvdWxkXG4vLyB3cml0ZSgpIHNvbWUgbW9yZS5cblJlYWRhYmxlLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgaWYgKCFzdGF0ZS5vYmplY3RNb2RlICYmIHR5cGVvZiBjaHVuayA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IGVuY29kaW5nIHx8IHN0YXRlLmRlZmF1bHRFbmNvZGluZztcbiAgICBpZiAoZW5jb2RpbmcgIT09IHN0YXRlLmVuY29kaW5nKSB7XG4gICAgICBjaHVuayA9IG5ldyBCdWZmZXIoY2h1bmssIGVuY29kaW5nKTtcbiAgICAgIGVuY29kaW5nID0gJyc7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlYWRhYmxlQWRkQ2h1bmsodGhpcywgc3RhdGUsIGNodW5rLCBlbmNvZGluZywgZmFsc2UpO1xufTtcblxuLy8gVW5zaGlmdCBzaG91bGQgKmFsd2F5cyogYmUgc29tZXRoaW5nIGRpcmVjdGx5IG91dCBvZiByZWFkKClcblJlYWRhYmxlLnByb3RvdHlwZS51bnNoaWZ0ID0gZnVuY3Rpb24oY2h1bmspIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgcmV0dXJuIHJlYWRhYmxlQWRkQ2h1bmsodGhpcywgc3RhdGUsIGNodW5rLCAnJywgdHJ1ZSk7XG59O1xuXG5SZWFkYWJsZS5wcm90b3R5cGUuaXNQYXVzZWQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX3JlYWRhYmxlU3RhdGUuZmxvd2luZyA9PT0gZmFsc2U7XG59O1xuXG5mdW5jdGlvbiByZWFkYWJsZUFkZENodW5rKHN0cmVhbSwgc3RhdGUsIGNodW5rLCBlbmNvZGluZywgYWRkVG9Gcm9udCkge1xuICB2YXIgZXIgPSBjaHVua0ludmFsaWQoc3RhdGUsIGNodW5rKTtcbiAgaWYgKGVyKSB7XG4gICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuICB9IGVsc2UgaWYgKGNodW5rID09PSBudWxsKSB7XG4gICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuICAgIG9uRW9mQ2h1bmsoc3RyZWFtLCBzdGF0ZSk7XG4gIH0gZWxzZSBpZiAoc3RhdGUub2JqZWN0TW9kZSB8fCBjaHVuayAmJiBjaHVuay5sZW5ndGggPiAwKSB7XG4gICAgaWYgKHN0YXRlLmVuZGVkICYmICFhZGRUb0Zyb250KSB7XG4gICAgICB2YXIgZSA9IG5ldyBFcnJvcignc3RyZWFtLnB1c2goKSBhZnRlciBFT0YnKTtcbiAgICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpO1xuICAgIH0gZWxzZSBpZiAoc3RhdGUuZW5kRW1pdHRlZCAmJiBhZGRUb0Zyb250KSB7XG4gICAgICB2YXIgZSA9IG5ldyBFcnJvcignc3RyZWFtLnVuc2hpZnQoKSBhZnRlciBlbmQgZXZlbnQnKTtcbiAgICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoc3RhdGUuZGVjb2RlciAmJiAhYWRkVG9Gcm9udCAmJiAhZW5jb2RpbmcpXG4gICAgICAgIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG5cbiAgICAgIGlmICghYWRkVG9Gcm9udClcbiAgICAgICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuXG4gICAgICAvLyBpZiB3ZSB3YW50IHRoZSBkYXRhIG5vdywganVzdCBlbWl0IGl0LlxuICAgICAgaWYgKHN0YXRlLmZsb3dpbmcgJiYgc3RhdGUubGVuZ3RoID09PSAwICYmICFzdGF0ZS5zeW5jKSB7XG4gICAgICAgIHN0cmVhbS5lbWl0KCdkYXRhJywgY2h1bmspO1xuICAgICAgICBzdHJlYW0ucmVhZCgwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgYnVmZmVyIGluZm8uXG4gICAgICAgIHN0YXRlLmxlbmd0aCArPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcbiAgICAgICAgaWYgKGFkZFRvRnJvbnQpXG4gICAgICAgICAgc3RhdGUuYnVmZmVyLnVuc2hpZnQoY2h1bmspO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgc3RhdGUuYnVmZmVyLnB1c2goY2h1bmspO1xuXG4gICAgICAgIGlmIChzdGF0ZS5uZWVkUmVhZGFibGUpXG4gICAgICAgICAgZW1pdFJlYWRhYmxlKHN0cmVhbSk7XG4gICAgICB9XG5cbiAgICAgIG1heWJlUmVhZE1vcmUoc3RyZWFtLCBzdGF0ZSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKCFhZGRUb0Zyb250KSB7XG4gICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIG5lZWRNb3JlRGF0YShzdGF0ZSk7XG59XG5cblxuLy8gaWYgaXQncyBwYXN0IHRoZSBoaWdoIHdhdGVyIG1hcmssIHdlIGNhbiBwdXNoIGluIHNvbWUgbW9yZS5cbi8vIEFsc28sIGlmIHdlIGhhdmUgbm8gZGF0YSB5ZXQsIHdlIGNhbiBzdGFuZCBzb21lXG4vLyBtb3JlIGJ5dGVzLiAgVGhpcyBpcyB0byB3b3JrIGFyb3VuZCBjYXNlcyB3aGVyZSBod209MCxcbi8vIHN1Y2ggYXMgdGhlIHJlcGwuICBBbHNvLCBpZiB0aGUgcHVzaCgpIHRyaWdnZXJlZCBhXG4vLyByZWFkYWJsZSBldmVudCwgYW5kIHRoZSB1c2VyIGNhbGxlZCByZWFkKGxhcmdlTnVtYmVyKSBzdWNoIHRoYXRcbi8vIG5lZWRSZWFkYWJsZSB3YXMgc2V0LCB0aGVuIHdlIG91Z2h0IHRvIHB1c2ggbW9yZSwgc28gdGhhdCBhbm90aGVyXG4vLyAncmVhZGFibGUnIGV2ZW50IHdpbGwgYmUgdHJpZ2dlcmVkLlxuZnVuY3Rpb24gbmVlZE1vcmVEYXRhKHN0YXRlKSB7XG4gIHJldHVybiAhc3RhdGUuZW5kZWQgJiZcbiAgICAgICAgIChzdGF0ZS5uZWVkUmVhZGFibGUgfHxcbiAgICAgICAgICBzdGF0ZS5sZW5ndGggPCBzdGF0ZS5oaWdoV2F0ZXJNYXJrIHx8XG4gICAgICAgICAgc3RhdGUubGVuZ3RoID09PSAwKTtcbn1cblxuLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXG5SZWFkYWJsZS5wcm90b3R5cGUuc2V0RW5jb2RpbmcgPSBmdW5jdGlvbihlbmMpIHtcbiAgaWYgKCFTdHJpbmdEZWNvZGVyKVxuICAgIFN0cmluZ0RlY29kZXIgPSByZXF1aXJlKCdzdHJpbmdfZGVjb2Rlci8nKS5TdHJpbmdEZWNvZGVyO1xuICB0aGlzLl9yZWFkYWJsZVN0YXRlLmRlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihlbmMpO1xuICB0aGlzLl9yZWFkYWJsZVN0YXRlLmVuY29kaW5nID0gZW5jO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIERvbid0IHJhaXNlIHRoZSBod20gPiA4TUJcbnZhciBNQVhfSFdNID0gMHg4MDAwMDA7XG5mdW5jdGlvbiBjb21wdXRlTmV3SGlnaFdhdGVyTWFyayhuKSB7XG4gIGlmIChuID49IE1BWF9IV00pIHtcbiAgICBuID0gTUFYX0hXTTtcbiAgfSBlbHNlIHtcbiAgICAvLyBHZXQgdGhlIG5leHQgaGlnaGVzdCBwb3dlciBvZiAyXG4gICAgbi0tO1xuICAgIG4gfD0gbiA+Pj4gMTtcbiAgICBuIHw9IG4gPj4+IDI7XG4gICAgbiB8PSBuID4+PiA0O1xuICAgIG4gfD0gbiA+Pj4gODtcbiAgICBuIHw9IG4gPj4+IDE2O1xuICAgIG4rKztcbiAgfVxuICByZXR1cm4gbjtcbn1cblxuZnVuY3Rpb24gaG93TXVjaFRvUmVhZChuLCBzdGF0ZSkge1xuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmIHN0YXRlLmVuZGVkKVxuICAgIHJldHVybiAwO1xuXG4gIGlmIChzdGF0ZS5vYmplY3RNb2RlKVxuICAgIHJldHVybiBuID09PSAwID8gMCA6IDE7XG5cbiAgaWYgKG4gPT09IG51bGwgfHwgaXNOYU4obikpIHtcbiAgICAvLyBvbmx5IGZsb3cgb25lIGJ1ZmZlciBhdCBhIHRpbWVcbiAgICBpZiAoc3RhdGUuZmxvd2luZyAmJiBzdGF0ZS5idWZmZXIubGVuZ3RoKVxuICAgICAgcmV0dXJuIHN0YXRlLmJ1ZmZlclswXS5sZW5ndGg7XG4gICAgZWxzZVxuICAgICAgcmV0dXJuIHN0YXRlLmxlbmd0aDtcbiAgfVxuXG4gIGlmIChuIDw9IDApXG4gICAgcmV0dXJuIDA7XG5cbiAgLy8gSWYgd2UncmUgYXNraW5nIGZvciBtb3JlIHRoYW4gdGhlIHRhcmdldCBidWZmZXIgbGV2ZWwsXG4gIC8vIHRoZW4gcmFpc2UgdGhlIHdhdGVyIG1hcmsuICBCdW1wIHVwIHRvIHRoZSBuZXh0IGhpZ2hlc3RcbiAgLy8gcG93ZXIgb2YgMiwgdG8gcHJldmVudCBpbmNyZWFzaW5nIGl0IGV4Y2Vzc2l2ZWx5IGluIHRpbnlcbiAgLy8gYW1vdW50cy5cbiAgaWYgKG4gPiBzdGF0ZS5oaWdoV2F0ZXJNYXJrKVxuICAgIHN0YXRlLmhpZ2hXYXRlck1hcmsgPSBjb21wdXRlTmV3SGlnaFdhdGVyTWFyayhuKTtcblxuICAvLyBkb24ndCBoYXZlIHRoYXQgbXVjaC4gIHJldHVybiBudWxsLCB1bmxlc3Mgd2UndmUgZW5kZWQuXG4gIGlmIChuID4gc3RhdGUubGVuZ3RoKSB7XG4gICAgaWYgKCFzdGF0ZS5lbmRlZCkge1xuICAgICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICAgIHJldHVybiAwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3RhdGUubGVuZ3RoO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuO1xufVxuXG4vLyB5b3UgY2FuIG92ZXJyaWRlIGVpdGhlciB0aGlzIG1ldGhvZCwgb3IgdGhlIGFzeW5jIF9yZWFkKG4pIGJlbG93LlxuUmVhZGFibGUucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbihuKSB7XG4gIGRlYnVnKCdyZWFkJywgbik7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHZhciBuT3JpZyA9IG47XG5cbiAgaWYgKHR5cGVvZiBuICE9PSAnbnVtYmVyJyB8fCBuID4gMClcbiAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcblxuICAvLyBpZiB3ZSdyZSBkb2luZyByZWFkKDApIHRvIHRyaWdnZXIgYSByZWFkYWJsZSBldmVudCwgYnV0IHdlXG4gIC8vIGFscmVhZHkgaGF2ZSBhIGJ1bmNoIG9mIGRhdGEgaW4gdGhlIGJ1ZmZlciwgdGhlbiBqdXN0IHRyaWdnZXJcbiAgLy8gdGhlICdyZWFkYWJsZScgZXZlbnQgYW5kIG1vdmUgb24uXG4gIGlmIChuID09PSAwICYmXG4gICAgICBzdGF0ZS5uZWVkUmVhZGFibGUgJiZcbiAgICAgIChzdGF0ZS5sZW5ndGggPj0gc3RhdGUuaGlnaFdhdGVyTWFyayB8fCBzdGF0ZS5lbmRlZCkpIHtcbiAgICBkZWJ1ZygncmVhZDogZW1pdFJlYWRhYmxlJywgc3RhdGUubGVuZ3RoLCBzdGF0ZS5lbmRlZCk7XG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5lbmRlZClcbiAgICAgIGVuZFJlYWRhYmxlKHRoaXMpO1xuICAgIGVsc2VcbiAgICAgIGVtaXRSZWFkYWJsZSh0aGlzKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIG4gPSBob3dNdWNoVG9SZWFkKG4sIHN0YXRlKTtcblxuICAvLyBpZiB3ZSd2ZSBlbmRlZCwgYW5kIHdlJ3JlIG5vdyBjbGVhciwgdGhlbiBmaW5pc2ggaXQgdXAuXG4gIGlmIChuID09PSAwICYmIHN0YXRlLmVuZGVkKSB7XG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMClcbiAgICAgIGVuZFJlYWRhYmxlKHRoaXMpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gQWxsIHRoZSBhY3R1YWwgY2h1bmsgZ2VuZXJhdGlvbiBsb2dpYyBuZWVkcyB0byBiZVxuICAvLyAqYmVsb3cqIHRoZSBjYWxsIHRvIF9yZWFkLiAgVGhlIHJlYXNvbiBpcyB0aGF0IGluIGNlcnRhaW5cbiAgLy8gc3ludGhldGljIHN0cmVhbSBjYXNlcywgc3VjaCBhcyBwYXNzdGhyb3VnaCBzdHJlYW1zLCBfcmVhZFxuICAvLyBtYXkgYmUgYSBjb21wbGV0ZWx5IHN5bmNocm9ub3VzIG9wZXJhdGlvbiB3aGljaCBtYXkgY2hhbmdlXG4gIC8vIHRoZSBzdGF0ZSBvZiB0aGUgcmVhZCBidWZmZXIsIHByb3ZpZGluZyBlbm91Z2ggZGF0YSB3aGVuXG4gIC8vIGJlZm9yZSB0aGVyZSB3YXMgKm5vdCogZW5vdWdoLlxuICAvL1xuICAvLyBTbywgdGhlIHN0ZXBzIGFyZTpcbiAgLy8gMS4gRmlndXJlIG91dCB3aGF0IHRoZSBzdGF0ZSBvZiB0aGluZ3Mgd2lsbCBiZSBhZnRlciB3ZSBkb1xuICAvLyBhIHJlYWQgZnJvbSB0aGUgYnVmZmVyLlxuICAvL1xuICAvLyAyLiBJZiB0aGF0IHJlc3VsdGluZyBzdGF0ZSB3aWxsIHRyaWdnZXIgYSBfcmVhZCwgdGhlbiBjYWxsIF9yZWFkLlxuICAvLyBOb3RlIHRoYXQgdGhpcyBtYXkgYmUgYXN5bmNocm9ub3VzLCBvciBzeW5jaHJvbm91cy4gIFllcywgaXQgaXNcbiAgLy8gZGVlcGx5IHVnbHkgdG8gd3JpdGUgQVBJcyB0aGlzIHdheSwgYnV0IHRoYXQgc3RpbGwgZG9lc24ndCBtZWFuXG4gIC8vIHRoYXQgdGhlIFJlYWRhYmxlIGNsYXNzIHNob3VsZCBiZWhhdmUgaW1wcm9wZXJseSwgYXMgc3RyZWFtcyBhcmVcbiAgLy8gZGVzaWduZWQgdG8gYmUgc3luYy9hc3luYyBhZ25vc3RpYy5cbiAgLy8gVGFrZSBub3RlIGlmIHRoZSBfcmVhZCBjYWxsIGlzIHN5bmMgb3IgYXN5bmMgKGllLCBpZiB0aGUgcmVhZCBjYWxsXG4gIC8vIGhhcyByZXR1cm5lZCB5ZXQpLCBzbyB0aGF0IHdlIGtub3cgd2hldGhlciBvciBub3QgaXQncyBzYWZlIHRvIGVtaXRcbiAgLy8gJ3JlYWRhYmxlJyBldGMuXG4gIC8vXG4gIC8vIDMuIEFjdHVhbGx5IHB1bGwgdGhlIHJlcXVlc3RlZCBjaHVua3Mgb3V0IG9mIHRoZSBidWZmZXIgYW5kIHJldHVybi5cblxuICAvLyBpZiB3ZSBuZWVkIGEgcmVhZGFibGUgZXZlbnQsIHRoZW4gd2UgbmVlZCB0byBkbyBzb21lIHJlYWRpbmcuXG4gIHZhciBkb1JlYWQgPSBzdGF0ZS5uZWVkUmVhZGFibGU7XG4gIGRlYnVnKCduZWVkIHJlYWRhYmxlJywgZG9SZWFkKTtcblxuICAvLyBpZiB3ZSBjdXJyZW50bHkgaGF2ZSBsZXNzIHRoYW4gdGhlIGhpZ2hXYXRlck1hcmssIHRoZW4gYWxzbyByZWFkIHNvbWVcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCB8fCBzdGF0ZS5sZW5ndGggLSBuIDwgc3RhdGUuaGlnaFdhdGVyTWFyaykge1xuICAgIGRvUmVhZCA9IHRydWU7XG4gICAgZGVidWcoJ2xlbmd0aCBsZXNzIHRoYW4gd2F0ZXJtYXJrJywgZG9SZWFkKTtcbiAgfVxuXG4gIC8vIGhvd2V2ZXIsIGlmIHdlJ3ZlIGVuZGVkLCB0aGVuIHRoZXJlJ3Mgbm8gcG9pbnQsIGFuZCBpZiB3ZSdyZSBhbHJlYWR5XG4gIC8vIHJlYWRpbmcsIHRoZW4gaXQncyB1bm5lY2Vzc2FyeS5cbiAgaWYgKHN0YXRlLmVuZGVkIHx8IHN0YXRlLnJlYWRpbmcpIHtcbiAgICBkb1JlYWQgPSBmYWxzZTtcbiAgICBkZWJ1ZygncmVhZGluZyBvciBlbmRlZCcsIGRvUmVhZCk7XG4gIH1cblxuICBpZiAoZG9SZWFkKSB7XG4gICAgZGVidWcoJ2RvIHJlYWQnKTtcbiAgICBzdGF0ZS5yZWFkaW5nID0gdHJ1ZTtcbiAgICBzdGF0ZS5zeW5jID0gdHJ1ZTtcbiAgICAvLyBpZiB0aGUgbGVuZ3RoIGlzIGN1cnJlbnRseSB6ZXJvLCB0aGVuIHdlICpuZWVkKiBhIHJlYWRhYmxlIGV2ZW50LlxuICAgIGlmIChzdGF0ZS5sZW5ndGggPT09IDApXG4gICAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgIC8vIGNhbGwgaW50ZXJuYWwgcmVhZCBtZXRob2RcbiAgICB0aGlzLl9yZWFkKHN0YXRlLmhpZ2hXYXRlck1hcmspO1xuICAgIHN0YXRlLnN5bmMgPSBmYWxzZTtcbiAgfVxuXG4gIC8vIElmIF9yZWFkIHB1c2hlZCBkYXRhIHN5bmNocm9ub3VzbHksIHRoZW4gYHJlYWRpbmdgIHdpbGwgYmUgZmFsc2UsXG4gIC8vIGFuZCB3ZSBuZWVkIHRvIHJlLWV2YWx1YXRlIGhvdyBtdWNoIGRhdGEgd2UgY2FuIHJldHVybiB0byB0aGUgdXNlci5cbiAgaWYgKGRvUmVhZCAmJiAhc3RhdGUucmVhZGluZylcbiAgICBuID0gaG93TXVjaFRvUmVhZChuT3JpZywgc3RhdGUpO1xuXG4gIHZhciByZXQ7XG4gIGlmIChuID4gMClcbiAgICByZXQgPSBmcm9tTGlzdChuLCBzdGF0ZSk7XG4gIGVsc2VcbiAgICByZXQgPSBudWxsO1xuXG4gIGlmIChyZXQgPT09IG51bGwpIHtcbiAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgIG4gPSAwO1xuICB9XG5cbiAgc3RhdGUubGVuZ3RoIC09IG47XG5cbiAgLy8gSWYgd2UgaGF2ZSBub3RoaW5nIGluIHRoZSBidWZmZXIsIHRoZW4gd2Ugd2FudCB0byBrbm93XG4gIC8vIGFzIHNvb24gYXMgd2UgKmRvKiBnZXQgc29tZXRoaW5nIGludG8gdGhlIGJ1ZmZlci5cbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiAhc3RhdGUuZW5kZWQpXG4gICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcblxuICAvLyBJZiB3ZSB0cmllZCB0byByZWFkKCkgcGFzdCB0aGUgRU9GLCB0aGVuIGVtaXQgZW5kIG9uIHRoZSBuZXh0IHRpY2suXG4gIGlmIChuT3JpZyAhPT0gbiAmJiBzdGF0ZS5lbmRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApXG4gICAgZW5kUmVhZGFibGUodGhpcyk7XG5cbiAgaWYgKHJldCAhPT0gbnVsbClcbiAgICB0aGlzLmVtaXQoJ2RhdGEnLCByZXQpO1xuXG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBjaHVua0ludmFsaWQoc3RhdGUsIGNodW5rKSB7XG4gIHZhciBlciA9IG51bGw7XG4gIGlmICghKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpICYmXG4gICAgICB0eXBlb2YgY2h1bmsgIT09ICdzdHJpbmcnICYmXG4gICAgICBjaHVuayAhPT0gbnVsbCAmJlxuICAgICAgY2h1bmsgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgIXN0YXRlLm9iamVjdE1vZGUpIHtcbiAgICBlciA9IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgbm9uLXN0cmluZy9idWZmZXIgY2h1bmsnKTtcbiAgfVxuICByZXR1cm4gZXI7XG59XG5cblxuZnVuY3Rpb24gb25Fb2ZDaHVuayhzdHJlYW0sIHN0YXRlKSB7XG4gIGlmIChzdGF0ZS5lbmRlZCkgcmV0dXJuO1xuICBpZiAoc3RhdGUuZGVjb2Rlcikge1xuICAgIHZhciBjaHVuayA9IHN0YXRlLmRlY29kZXIuZW5kKCk7XG4gICAgaWYgKGNodW5rICYmIGNodW5rLmxlbmd0aCkge1xuICAgICAgc3RhdGUuYnVmZmVyLnB1c2goY2h1bmspO1xuICAgICAgc3RhdGUubGVuZ3RoICs9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuICAgIH1cbiAgfVxuICBzdGF0ZS5lbmRlZCA9IHRydWU7XG5cbiAgLy8gZW1pdCAncmVhZGFibGUnIG5vdyB0byBtYWtlIHN1cmUgaXQgZ2V0cyBwaWNrZWQgdXAuXG4gIGVtaXRSZWFkYWJsZShzdHJlYW0pO1xufVxuXG4vLyBEb24ndCBlbWl0IHJlYWRhYmxlIHJpZ2h0IGF3YXkgaW4gc3luYyBtb2RlLCBiZWNhdXNlIHRoaXMgY2FuIHRyaWdnZXJcbi8vIGFub3RoZXIgcmVhZCgpIGNhbGwgPT4gc3RhY2sgb3ZlcmZsb3cuICBUaGlzIHdheSwgaXQgbWlnaHQgdHJpZ2dlclxuLy8gYSBuZXh0VGljayByZWN1cnNpb24gd2FybmluZywgYnV0IHRoYXQncyBub3Qgc28gYmFkLlxuZnVuY3Rpb24gZW1pdFJlYWRhYmxlKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIHN0YXRlLm5lZWRSZWFkYWJsZSA9IGZhbHNlO1xuICBpZiAoIXN0YXRlLmVtaXR0ZWRSZWFkYWJsZSkge1xuICAgIGRlYnVnKCdlbWl0UmVhZGFibGUnLCBzdGF0ZS5mbG93aW5nKTtcbiAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSB0cnVlO1xuICAgIGlmIChzdGF0ZS5zeW5jKVxuICAgICAgcHJvY2Vzc05leHRUaWNrKGVtaXRSZWFkYWJsZV8sIHN0cmVhbSk7XG4gICAgZWxzZVxuICAgICAgZW1pdFJlYWRhYmxlXyhzdHJlYW0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtaXRSZWFkYWJsZV8oc3RyZWFtKSB7XG4gIGRlYnVnKCdlbWl0IHJlYWRhYmxlJyk7XG4gIHN0cmVhbS5lbWl0KCdyZWFkYWJsZScpO1xuICBmbG93KHN0cmVhbSk7XG59XG5cblxuLy8gYXQgdGhpcyBwb2ludCwgdGhlIHVzZXIgaGFzIHByZXN1bWFibHkgc2VlbiB0aGUgJ3JlYWRhYmxlJyBldmVudCxcbi8vIGFuZCBjYWxsZWQgcmVhZCgpIHRvIGNvbnN1bWUgc29tZSBkYXRhLiAgdGhhdCBtYXkgaGF2ZSB0cmlnZ2VyZWRcbi8vIGluIHR1cm4gYW5vdGhlciBfcmVhZChuKSBjYWxsLCBpbiB3aGljaCBjYXNlIHJlYWRpbmcgPSB0cnVlIGlmXG4vLyBpdCdzIGluIHByb2dyZXNzLlxuLy8gSG93ZXZlciwgaWYgd2UncmUgbm90IGVuZGVkLCBvciByZWFkaW5nLCBhbmQgdGhlIGxlbmd0aCA8IGh3bSxcbi8vIHRoZW4gZ28gYWhlYWQgYW5kIHRyeSB0byByZWFkIHNvbWUgbW9yZSBwcmVlbXB0aXZlbHkuXG5mdW5jdGlvbiBtYXliZVJlYWRNb3JlKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZWFkaW5nTW9yZSkge1xuICAgIHN0YXRlLnJlYWRpbmdNb3JlID0gdHJ1ZTtcbiAgICBwcm9jZXNzTmV4dFRpY2sobWF5YmVSZWFkTW9yZV8sIHN0cmVhbSwgc3RhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1heWJlUmVhZE1vcmVfKHN0cmVhbSwgc3RhdGUpIHtcbiAgdmFyIGxlbiA9IHN0YXRlLmxlbmd0aDtcbiAgd2hpbGUgKCFzdGF0ZS5yZWFkaW5nICYmICFzdGF0ZS5mbG93aW5nICYmICFzdGF0ZS5lbmRlZCAmJlxuICAgICAgICAgc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyaykge1xuICAgIGRlYnVnKCdtYXliZVJlYWRNb3JlIHJlYWQgMCcpO1xuICAgIHN0cmVhbS5yZWFkKDApO1xuICAgIGlmIChsZW4gPT09IHN0YXRlLmxlbmd0aClcbiAgICAgIC8vIGRpZG4ndCBnZXQgYW55IGRhdGEsIHN0b3Agc3Bpbm5pbmcuXG4gICAgICBicmVhaztcbiAgICBlbHNlXG4gICAgICBsZW4gPSBzdGF0ZS5sZW5ndGg7XG4gIH1cbiAgc3RhdGUucmVhZGluZ01vcmUgPSBmYWxzZTtcbn1cblxuLy8gYWJzdHJhY3QgbWV0aG9kLiAgdG8gYmUgb3ZlcnJpZGRlbiBpbiBzcGVjaWZpYyBpbXBsZW1lbnRhdGlvbiBjbGFzc2VzLlxuLy8gY2FsbCBjYihlciwgZGF0YSkgd2hlcmUgZGF0YSBpcyA8PSBuIGluIGxlbmd0aC5cbi8vIGZvciB2aXJ0dWFsIChub24tc3RyaW5nLCBub24tYnVmZmVyKSBzdHJlYW1zLCBcImxlbmd0aFwiIGlzIHNvbWV3aGF0XG4vLyBhcmJpdHJhcnksIGFuZCBwZXJoYXBzIG5vdCB2ZXJ5IG1lYW5pbmdmdWwuXG5SZWFkYWJsZS5wcm90b3R5cGUuX3JlYWQgPSBmdW5jdGlvbihuKSB7XG4gIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpKTtcbn07XG5cblJlYWRhYmxlLnByb3RvdHlwZS5waXBlID0gZnVuY3Rpb24oZGVzdCwgcGlwZU9wdHMpIHtcbiAgdmFyIHNyYyA9IHRoaXM7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgc3dpdGNoIChzdGF0ZS5waXBlc0NvdW50KSB7XG4gICAgY2FzZSAwOlxuICAgICAgc3RhdGUucGlwZXMgPSBkZXN0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAxOlxuICAgICAgc3RhdGUucGlwZXMgPSBbc3RhdGUucGlwZXMsIGRlc3RdO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHN0YXRlLnBpcGVzLnB1c2goZGVzdCk7XG4gICAgICBicmVhaztcbiAgfVxuICBzdGF0ZS5waXBlc0NvdW50ICs9IDE7XG4gIGRlYnVnKCdwaXBlIGNvdW50PSVkIG9wdHM9JWonLCBzdGF0ZS5waXBlc0NvdW50LCBwaXBlT3B0cyk7XG5cbiAgdmFyIGRvRW5kID0gKCFwaXBlT3B0cyB8fCBwaXBlT3B0cy5lbmQgIT09IGZhbHNlKSAmJlxuICAgICAgICAgICAgICBkZXN0ICE9PSBwcm9jZXNzLnN0ZG91dCAmJlxuICAgICAgICAgICAgICBkZXN0ICE9PSBwcm9jZXNzLnN0ZGVycjtcblxuICB2YXIgZW5kRm4gPSBkb0VuZCA/IG9uZW5kIDogY2xlYW51cDtcbiAgaWYgKHN0YXRlLmVuZEVtaXR0ZWQpXG4gICAgcHJvY2Vzc05leHRUaWNrKGVuZEZuKTtcbiAgZWxzZVxuICAgIHNyYy5vbmNlKCdlbmQnLCBlbmRGbik7XG5cbiAgZGVzdC5vbigndW5waXBlJywgb251bnBpcGUpO1xuICBmdW5jdGlvbiBvbnVucGlwZShyZWFkYWJsZSkge1xuICAgIGRlYnVnKCdvbnVucGlwZScpO1xuICAgIGlmIChyZWFkYWJsZSA9PT0gc3JjKSB7XG4gICAgICBjbGVhbnVwKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25lbmQoKSB7XG4gICAgZGVidWcoJ29uZW5kJyk7XG4gICAgZGVzdC5lbmQoKTtcbiAgfVxuXG4gIC8vIHdoZW4gdGhlIGRlc3QgZHJhaW5zLCBpdCByZWR1Y2VzIHRoZSBhd2FpdERyYWluIGNvdW50ZXJcbiAgLy8gb24gdGhlIHNvdXJjZS4gIFRoaXMgd291bGQgYmUgbW9yZSBlbGVnYW50IHdpdGggYSAub25jZSgpXG4gIC8vIGhhbmRsZXIgaW4gZmxvdygpLCBidXQgYWRkaW5nIGFuZCByZW1vdmluZyByZXBlYXRlZGx5IGlzXG4gIC8vIHRvbyBzbG93LlxuICB2YXIgb25kcmFpbiA9IHBpcGVPbkRyYWluKHNyYyk7XG4gIGRlc3Qub24oJ2RyYWluJywgb25kcmFpbik7XG5cbiAgdmFyIGNsZWFuZWRVcCA9IGZhbHNlO1xuICBmdW5jdGlvbiBjbGVhbnVwKCkge1xuICAgIGRlYnVnKCdjbGVhbnVwJyk7XG4gICAgLy8gY2xlYW51cCBldmVudCBoYW5kbGVycyBvbmNlIHRoZSBwaXBlIGlzIGJyb2tlblxuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZmluaXNoJywgb25maW5pc2gpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2RyYWluJywgb25kcmFpbik7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCd1bnBpcGUnLCBvbnVucGlwZSk7XG4gICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBvbmVuZCk7XG4gICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBjbGVhbnVwKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2RhdGEnLCBvbmRhdGEpO1xuXG4gICAgY2xlYW5lZFVwID0gdHJ1ZTtcblxuICAgIC8vIGlmIHRoZSByZWFkZXIgaXMgd2FpdGluZyBmb3IgYSBkcmFpbiBldmVudCBmcm9tIHRoaXNcbiAgICAvLyBzcGVjaWZpYyB3cml0ZXIsIHRoZW4gaXQgd291bGQgY2F1c2UgaXQgdG8gbmV2ZXIgc3RhcnRcbiAgICAvLyBmbG93aW5nIGFnYWluLlxuICAgIC8vIFNvLCBpZiB0aGlzIGlzIGF3YWl0aW5nIGEgZHJhaW4sIHRoZW4gd2UganVzdCBjYWxsIGl0IG5vdy5cbiAgICAvLyBJZiB3ZSBkb24ndCBrbm93LCB0aGVuIGFzc3VtZSB0aGF0IHdlIGFyZSB3YWl0aW5nIGZvciBvbmUuXG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4gJiZcbiAgICAgICAgKCFkZXN0Ll93cml0YWJsZVN0YXRlIHx8IGRlc3QuX3dyaXRhYmxlU3RhdGUubmVlZERyYWluKSlcbiAgICAgIG9uZHJhaW4oKTtcbiAgfVxuXG4gIHNyYy5vbignZGF0YScsIG9uZGF0YSk7XG4gIGZ1bmN0aW9uIG9uZGF0YShjaHVuaykge1xuICAgIGRlYnVnKCdvbmRhdGEnKTtcbiAgICB2YXIgcmV0ID0gZGVzdC53cml0ZShjaHVuayk7XG4gICAgaWYgKGZhbHNlID09PSByZXQpIHtcbiAgICAgIC8vIElmIHRoZSB1c2VyIHVucGlwZWQgZHVyaW5nIGBkZXN0LndyaXRlKClgLCBpdCBpcyBwb3NzaWJsZVxuICAgICAgLy8gdG8gZ2V0IHN0dWNrIGluIGEgcGVybWFuZW50bHkgcGF1c2VkIHN0YXRlIGlmIHRoYXQgd3JpdGVcbiAgICAgIC8vIGFsc28gcmV0dXJuZWQgZmFsc2UuXG4gICAgICBpZiAoc3RhdGUucGlwZXNDb3VudCA9PT0gMSAmJlxuICAgICAgICAgIHN0YXRlLnBpcGVzWzBdID09PSBkZXN0ICYmXG4gICAgICAgICAgc3JjLmxpc3RlbmVyQ291bnQoJ2RhdGEnKSA9PT0gMSAmJlxuICAgICAgICAgICFjbGVhbmVkVXApIHtcbiAgICAgICAgZGVidWcoJ2ZhbHNlIHdyaXRlIHJlc3BvbnNlLCBwYXVzZScsIHNyYy5fcmVhZGFibGVTdGF0ZS5hd2FpdERyYWluKTtcbiAgICAgICAgc3JjLl9yZWFkYWJsZVN0YXRlLmF3YWl0RHJhaW4rKztcbiAgICAgIH1cbiAgICAgIHNyYy5wYXVzZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBkZXN0IGhhcyBhbiBlcnJvciwgdGhlbiBzdG9wIHBpcGluZyBpbnRvIGl0LlxuICAvLyBob3dldmVyLCBkb24ndCBzdXBwcmVzcyB0aGUgdGhyb3dpbmcgYmVoYXZpb3IgZm9yIHRoaXMuXG4gIGZ1bmN0aW9uIG9uZXJyb3IoZXIpIHtcbiAgICBkZWJ1Zygnb25lcnJvcicsIGVyKTtcbiAgICB1bnBpcGUoKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGlmIChFRWxpc3RlbmVyQ291bnQoZGVzdCwgJ2Vycm9yJykgPT09IDApXG4gICAgICBkZXN0LmVtaXQoJ2Vycm9yJywgZXIpO1xuICB9XG4gIC8vIFRoaXMgaXMgYSBicnV0YWxseSB1Z2x5IGhhY2sgdG8gbWFrZSBzdXJlIHRoYXQgb3VyIGVycm9yIGhhbmRsZXJcbiAgLy8gaXMgYXR0YWNoZWQgYmVmb3JlIGFueSB1c2VybGFuZCBvbmVzLiAgTkVWRVIgRE8gVEhJUy5cbiAgaWYgKCFkZXN0Ll9ldmVudHMgfHwgIWRlc3QuX2V2ZW50cy5lcnJvcilcbiAgICBkZXN0Lm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuICBlbHNlIGlmIChpc0FycmF5KGRlc3QuX2V2ZW50cy5lcnJvcikpXG4gICAgZGVzdC5fZXZlbnRzLmVycm9yLnVuc2hpZnQob25lcnJvcik7XG4gIGVsc2VcbiAgICBkZXN0Ll9ldmVudHMuZXJyb3IgPSBbb25lcnJvciwgZGVzdC5fZXZlbnRzLmVycm9yXTtcblxuXG4gIC8vIEJvdGggY2xvc2UgYW5kIGZpbmlzaCBzaG91bGQgdHJpZ2dlciB1bnBpcGUsIGJ1dCBvbmx5IG9uY2UuXG4gIGZ1bmN0aW9uIG9uY2xvc2UoKSB7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZmluaXNoJywgb25maW5pc2gpO1xuICAgIHVucGlwZSgpO1xuICB9XG4gIGRlc3Qub25jZSgnY2xvc2UnLCBvbmNsb3NlKTtcbiAgZnVuY3Rpb24gb25maW5pc2goKSB7XG4gICAgZGVidWcoJ29uZmluaXNoJyk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBvbmNsb3NlKTtcbiAgICB1bnBpcGUoKTtcbiAgfVxuICBkZXN0Lm9uY2UoJ2ZpbmlzaCcsIG9uZmluaXNoKTtcblxuICBmdW5jdGlvbiB1bnBpcGUoKSB7XG4gICAgZGVidWcoJ3VucGlwZScpO1xuICAgIHNyYy51bnBpcGUoZGVzdCk7XG4gIH1cblxuICAvLyB0ZWxsIHRoZSBkZXN0IHRoYXQgaXQncyBiZWluZyBwaXBlZCB0b1xuICBkZXN0LmVtaXQoJ3BpcGUnLCBzcmMpO1xuXG4gIC8vIHN0YXJ0IHRoZSBmbG93IGlmIGl0IGhhc24ndCBiZWVuIHN0YXJ0ZWQgYWxyZWFkeS5cbiAgaWYgKCFzdGF0ZS5mbG93aW5nKSB7XG4gICAgZGVidWcoJ3BpcGUgcmVzdW1lJyk7XG4gICAgc3JjLnJlc3VtZSgpO1xuICB9XG5cbiAgcmV0dXJuIGRlc3Q7XG59O1xuXG5mdW5jdGlvbiBwaXBlT25EcmFpbihzcmMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdGF0ZSA9IHNyYy5fcmVhZGFibGVTdGF0ZTtcbiAgICBkZWJ1ZygncGlwZU9uRHJhaW4nLCBzdGF0ZS5hd2FpdERyYWluKTtcbiAgICBpZiAoc3RhdGUuYXdhaXREcmFpbilcbiAgICAgIHN0YXRlLmF3YWl0RHJhaW4tLTtcbiAgICBpZiAoc3RhdGUuYXdhaXREcmFpbiA9PT0gMCAmJiBFRWxpc3RlbmVyQ291bnQoc3JjLCAnZGF0YScpKSB7XG4gICAgICBzdGF0ZS5mbG93aW5nID0gdHJ1ZTtcbiAgICAgIGZsb3coc3JjKTtcbiAgICB9XG4gIH07XG59XG5cblxuUmVhZGFibGUucHJvdG90eXBlLnVucGlwZSA9IGZ1bmN0aW9uKGRlc3QpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcblxuICAvLyBpZiB3ZSdyZSBub3QgcGlwaW5nIGFueXdoZXJlLCB0aGVuIGRvIG5vdGhpbmcuXG4gIGlmIChzdGF0ZS5waXBlc0NvdW50ID09PSAwKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIGp1c3Qgb25lIGRlc3RpbmF0aW9uLiAgbW9zdCBjb21tb24gY2FzZS5cbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDEpIHtcbiAgICAvLyBwYXNzZWQgaW4gb25lLCBidXQgaXQncyBub3QgdGhlIHJpZ2h0IG9uZS5cbiAgICBpZiAoZGVzdCAmJiBkZXN0ICE9PSBzdGF0ZS5waXBlcylcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKCFkZXN0KVxuICAgICAgZGVzdCA9IHN0YXRlLnBpcGVzO1xuXG4gICAgLy8gZ290IGEgbWF0Y2guXG4gICAgc3RhdGUucGlwZXMgPSBudWxsO1xuICAgIHN0YXRlLnBpcGVzQ291bnQgPSAwO1xuICAgIHN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcbiAgICBpZiAoZGVzdClcbiAgICAgIGRlc3QuZW1pdCgndW5waXBlJywgdGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBzbG93IGNhc2UuIG11bHRpcGxlIHBpcGUgZGVzdGluYXRpb25zLlxuXG4gIGlmICghZGVzdCkge1xuICAgIC8vIHJlbW92ZSBhbGwuXG4gICAgdmFyIGRlc3RzID0gc3RhdGUucGlwZXM7XG4gICAgdmFyIGxlbiA9IHN0YXRlLnBpcGVzQ291bnQ7XG4gICAgc3RhdGUucGlwZXMgPSBudWxsO1xuICAgIHN0YXRlLnBpcGVzQ291bnQgPSAwO1xuICAgIHN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBkZXN0c1tpXS5lbWl0KCd1bnBpcGUnLCB0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIHRyeSB0byBmaW5kIHRoZSByaWdodCBvbmUuXG4gIHZhciBpID0gaW5kZXhPZihzdGF0ZS5waXBlcywgZGVzdCk7XG4gIGlmIChpID09PSAtMSlcbiAgICByZXR1cm4gdGhpcztcblxuICBzdGF0ZS5waXBlcy5zcGxpY2UoaSwgMSk7XG4gIHN0YXRlLnBpcGVzQ291bnQgLT0gMTtcbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDEpXG4gICAgc3RhdGUucGlwZXMgPSBzdGF0ZS5waXBlc1swXTtcblxuICBkZXN0LmVtaXQoJ3VucGlwZScsIHRoaXMpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gc2V0IHVwIGRhdGEgZXZlbnRzIGlmIHRoZXkgYXJlIGFza2VkIGZvclxuLy8gRW5zdXJlIHJlYWRhYmxlIGxpc3RlbmVycyBldmVudHVhbGx5IGdldCBzb21ldGhpbmdcblJlYWRhYmxlLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2LCBmbikge1xuICB2YXIgcmVzID0gU3RyZWFtLnByb3RvdHlwZS5vbi5jYWxsKHRoaXMsIGV2LCBmbik7XG5cbiAgLy8gSWYgbGlzdGVuaW5nIHRvIGRhdGEsIGFuZCBpdCBoYXMgbm90IGV4cGxpY2l0bHkgYmVlbiBwYXVzZWQsXG4gIC8vIHRoZW4gY2FsbCByZXN1bWUgdG8gc3RhcnQgdGhlIGZsb3cgb2YgZGF0YSBvbiB0aGUgbmV4dCB0aWNrLlxuICBpZiAoZXYgPT09ICdkYXRhJyAmJiBmYWxzZSAhPT0gdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKSB7XG4gICAgdGhpcy5yZXN1bWUoKTtcbiAgfVxuXG4gIGlmIChldiA9PT0gJ3JlYWRhYmxlJyAmJiB0aGlzLnJlYWRhYmxlKSB7XG4gICAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgICBpZiAoIXN0YXRlLnJlYWRhYmxlTGlzdGVuaW5nKSB7XG4gICAgICBzdGF0ZS5yZWFkYWJsZUxpc3RlbmluZyA9IHRydWU7XG4gICAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcbiAgICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgICBpZiAoIXN0YXRlLnJlYWRpbmcpIHtcbiAgICAgICAgcHJvY2Vzc05leHRUaWNrKG5SZWFkaW5nTmV4dFRpY2ssIHRoaXMpO1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZS5sZW5ndGgpIHtcbiAgICAgICAgZW1pdFJlYWRhYmxlKHRoaXMsIHN0YXRlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzO1xufTtcblJlYWRhYmxlLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IFJlYWRhYmxlLnByb3RvdHlwZS5vbjtcblxuZnVuY3Rpb24gblJlYWRpbmdOZXh0VGljayhzZWxmKSB7XG4gIGRlYnVnKCdyZWFkYWJsZSBuZXh0dGljayByZWFkIDAnKTtcbiAgc2VsZi5yZWFkKDApO1xufVxuXG4vLyBwYXVzZSgpIGFuZCByZXN1bWUoKSBhcmUgcmVtbmFudHMgb2YgdGhlIGxlZ2FjeSByZWFkYWJsZSBzdHJlYW0gQVBJXG4vLyBJZiB0aGUgdXNlciB1c2VzIHRoZW0sIHRoZW4gc3dpdGNoIGludG8gb2xkIG1vZGUuXG5SZWFkYWJsZS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdyZXN1bWUnKTtcbiAgICBzdGF0ZS5mbG93aW5nID0gdHJ1ZTtcbiAgICByZXN1bWUodGhpcywgc3RhdGUpO1xuICB9XG4gIHJldHVybiB0aGlzO1xufTtcblxuZnVuY3Rpb24gcmVzdW1lKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZXN1bWVTY2hlZHVsZWQpIHtcbiAgICBzdGF0ZS5yZXN1bWVTY2hlZHVsZWQgPSB0cnVlO1xuICAgIHByb2Nlc3NOZXh0VGljayhyZXN1bWVfLCBzdHJlYW0sIHN0YXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZXN1bWVfKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZWFkaW5nKSB7XG4gICAgZGVidWcoJ3Jlc3VtZSByZWFkIDAnKTtcbiAgICBzdHJlYW0ucmVhZCgwKTtcbiAgfVxuXG4gIHN0YXRlLnJlc3VtZVNjaGVkdWxlZCA9IGZhbHNlO1xuICBzdHJlYW0uZW1pdCgncmVzdW1lJyk7XG4gIGZsb3coc3RyZWFtKTtcbiAgaWYgKHN0YXRlLmZsb3dpbmcgJiYgIXN0YXRlLnJlYWRpbmcpXG4gICAgc3RyZWFtLnJlYWQoMCk7XG59XG5cblJlYWRhYmxlLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICBkZWJ1ZygnY2FsbCBwYXVzZSBmbG93aW5nPSVqJywgdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKTtcbiAgaWYgKGZhbHNlICE9PSB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpIHtcbiAgICBkZWJ1ZygncGF1c2UnKTtcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmVtaXQoJ3BhdXNlJyk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiBmbG93KHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIGRlYnVnKCdmbG93Jywgc3RhdGUuZmxvd2luZyk7XG4gIGlmIChzdGF0ZS5mbG93aW5nKSB7XG4gICAgZG8ge1xuICAgICAgdmFyIGNodW5rID0gc3RyZWFtLnJlYWQoKTtcbiAgICB9IHdoaWxlIChudWxsICE9PSBjaHVuayAmJiBzdGF0ZS5mbG93aW5nKTtcbiAgfVxufVxuXG4vLyB3cmFwIGFuIG9sZC1zdHlsZSBzdHJlYW0gYXMgdGhlIGFzeW5jIGRhdGEgc291cmNlLlxuLy8gVGhpcyBpcyAqbm90KiBwYXJ0IG9mIHRoZSByZWFkYWJsZSBzdHJlYW0gaW50ZXJmYWNlLlxuLy8gSXQgaXMgYW4gdWdseSB1bmZvcnR1bmF0ZSBtZXNzIG9mIGhpc3RvcnkuXG5SZWFkYWJsZS5wcm90b3R5cGUud3JhcCA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICB2YXIgcGF1c2VkID0gZmFsc2U7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uKCkge1xuICAgIGRlYnVnKCd3cmFwcGVkIGVuZCcpO1xuICAgIGlmIChzdGF0ZS5kZWNvZGVyICYmICFzdGF0ZS5lbmRlZCkge1xuICAgICAgdmFyIGNodW5rID0gc3RhdGUuZGVjb2Rlci5lbmQoKTtcbiAgICAgIGlmIChjaHVuayAmJiBjaHVuay5sZW5ndGgpXG4gICAgICAgIHNlbGYucHVzaChjaHVuayk7XG4gICAgfVxuXG4gICAgc2VsZi5wdXNoKG51bGwpO1xuICB9KTtcblxuICBzdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbihjaHVuaykge1xuICAgIGRlYnVnKCd3cmFwcGVkIGRhdGEnKTtcbiAgICBpZiAoc3RhdGUuZGVjb2RlcilcbiAgICAgIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG5cbiAgICAvLyBkb24ndCBza2lwIG92ZXIgZmFsc3kgdmFsdWVzIGluIG9iamVjdE1vZGVcbiAgICBpZiAoc3RhdGUub2JqZWN0TW9kZSAmJiAoY2h1bmsgPT09IG51bGwgfHwgY2h1bmsgPT09IHVuZGVmaW5lZCkpXG4gICAgICByZXR1cm47XG4gICAgZWxzZSBpZiAoIXN0YXRlLm9iamVjdE1vZGUgJiYgKCFjaHVuayB8fCAhY2h1bmsubGVuZ3RoKSlcbiAgICAgIHJldHVybjtcblxuICAgIHZhciByZXQgPSBzZWxmLnB1c2goY2h1bmspO1xuICAgIGlmICghcmV0KSB7XG4gICAgICBwYXVzZWQgPSB0cnVlO1xuICAgICAgc3RyZWFtLnBhdXNlKCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBwcm94eSBhbGwgdGhlIG90aGVyIG1ldGhvZHMuXG4gIC8vIGltcG9ydGFudCB3aGVuIHdyYXBwaW5nIGZpbHRlcnMgYW5kIGR1cGxleGVzLlxuICBmb3IgKHZhciBpIGluIHN0cmVhbSkge1xuICAgIGlmICh0aGlzW2ldID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIHN0cmVhbVtpXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpc1tpXSA9IGZ1bmN0aW9uKG1ldGhvZCkgeyByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzdHJlYW1bbWV0aG9kXS5hcHBseShzdHJlYW0sIGFyZ3VtZW50cyk7XG4gICAgICB9OyB9KGkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIHByb3h5IGNlcnRhaW4gaW1wb3J0YW50IGV2ZW50cy5cbiAgdmFyIGV2ZW50cyA9IFsnZXJyb3InLCAnY2xvc2UnLCAnZGVzdHJveScsICdwYXVzZScsICdyZXN1bWUnXTtcbiAgZm9yRWFjaChldmVudHMsIGZ1bmN0aW9uKGV2KSB7XG4gICAgc3RyZWFtLm9uKGV2LCBzZWxmLmVtaXQuYmluZChzZWxmLCBldikpO1xuICB9KTtcblxuICAvLyB3aGVuIHdlIHRyeSB0byBjb25zdW1lIHNvbWUgbW9yZSBieXRlcywgc2ltcGx5IHVucGF1c2UgdGhlXG4gIC8vIHVuZGVybHlpbmcgc3RyZWFtLlxuICBzZWxmLl9yZWFkID0gZnVuY3Rpb24obikge1xuICAgIGRlYnVnKCd3cmFwcGVkIF9yZWFkJywgbik7XG4gICAgaWYgKHBhdXNlZCkge1xuICAgICAgcGF1c2VkID0gZmFsc2U7XG4gICAgICBzdHJlYW0ucmVzdW1lKCk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBzZWxmO1xufTtcblxuXG4vLyBleHBvc2VkIGZvciB0ZXN0aW5nIHB1cnBvc2VzIG9ubHkuXG5SZWFkYWJsZS5fZnJvbUxpc3QgPSBmcm9tTGlzdDtcblxuLy8gUGx1Y2sgb2ZmIG4gYnl0ZXMgZnJvbSBhbiBhcnJheSBvZiBidWZmZXJzLlxuLy8gTGVuZ3RoIGlzIHRoZSBjb21iaW5lZCBsZW5ndGhzIG9mIGFsbCB0aGUgYnVmZmVycyBpbiB0aGUgbGlzdC5cbmZ1bmN0aW9uIGZyb21MaXN0KG4sIHN0YXRlKSB7XG4gIHZhciBsaXN0ID0gc3RhdGUuYnVmZmVyO1xuICB2YXIgbGVuZ3RoID0gc3RhdGUubGVuZ3RoO1xuICB2YXIgc3RyaW5nTW9kZSA9ICEhc3RhdGUuZGVjb2RlcjtcbiAgdmFyIG9iamVjdE1vZGUgPSAhIXN0YXRlLm9iamVjdE1vZGU7XG4gIHZhciByZXQ7XG5cbiAgLy8gbm90aGluZyBpbiB0aGUgbGlzdCwgZGVmaW5pdGVseSBlbXB0eS5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKVxuICAgIHJldHVybiBudWxsO1xuXG4gIGlmIChsZW5ndGggPT09IDApXG4gICAgcmV0ID0gbnVsbDtcbiAgZWxzZSBpZiAob2JqZWN0TW9kZSlcbiAgICByZXQgPSBsaXN0LnNoaWZ0KCk7XG4gIGVsc2UgaWYgKCFuIHx8IG4gPj0gbGVuZ3RoKSB7XG4gICAgLy8gcmVhZCBpdCBhbGwsIHRydW5jYXRlIHRoZSBhcnJheS5cbiAgICBpZiAoc3RyaW5nTW9kZSlcbiAgICAgIHJldCA9IGxpc3Quam9pbignJyk7XG4gICAgZWxzZSBpZiAobGlzdC5sZW5ndGggPT09IDEpXG4gICAgICByZXQgPSBsaXN0WzBdO1xuICAgIGVsc2VcbiAgICAgIHJldCA9IEJ1ZmZlci5jb25jYXQobGlzdCwgbGVuZ3RoKTtcbiAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gIH0gZWxzZSB7XG4gICAgLy8gcmVhZCBqdXN0IHNvbWUgb2YgaXQuXG4gICAgaWYgKG4gPCBsaXN0WzBdLmxlbmd0aCkge1xuICAgICAgLy8ganVzdCB0YWtlIGEgcGFydCBvZiB0aGUgZmlyc3QgbGlzdCBpdGVtLlxuICAgICAgLy8gc2xpY2UgaXMgdGhlIHNhbWUgZm9yIGJ1ZmZlcnMgYW5kIHN0cmluZ3MuXG4gICAgICB2YXIgYnVmID0gbGlzdFswXTtcbiAgICAgIHJldCA9IGJ1Zi5zbGljZSgwLCBuKTtcbiAgICAgIGxpc3RbMF0gPSBidWYuc2xpY2Uobik7XG4gICAgfSBlbHNlIGlmIChuID09PSBsaXN0WzBdLmxlbmd0aCkge1xuICAgICAgLy8gZmlyc3QgbGlzdCBpcyBhIHBlcmZlY3QgbWF0Y2hcbiAgICAgIHJldCA9IGxpc3Quc2hpZnQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY29tcGxleCBjYXNlLlxuICAgICAgLy8gd2UgaGF2ZSBlbm91Z2ggdG8gY292ZXIgaXQsIGJ1dCBpdCBzcGFucyBwYXN0IHRoZSBmaXJzdCBidWZmZXIuXG4gICAgICBpZiAoc3RyaW5nTW9kZSlcbiAgICAgICAgcmV0ID0gJyc7XG4gICAgICBlbHNlXG4gICAgICAgIHJldCA9IG5ldyBCdWZmZXIobik7XG5cbiAgICAgIHZhciBjID0gMDtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdC5sZW5ndGg7IGkgPCBsICYmIGMgPCBuOyBpKyspIHtcbiAgICAgICAgdmFyIGJ1ZiA9IGxpc3RbMF07XG4gICAgICAgIHZhciBjcHkgPSBNYXRoLm1pbihuIC0gYywgYnVmLmxlbmd0aCk7XG5cbiAgICAgICAgaWYgKHN0cmluZ01vZGUpXG4gICAgICAgICAgcmV0ICs9IGJ1Zi5zbGljZSgwLCBjcHkpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYnVmLmNvcHkocmV0LCBjLCAwLCBjcHkpO1xuXG4gICAgICAgIGlmIChjcHkgPCBidWYubGVuZ3RoKVxuICAgICAgICAgIGxpc3RbMF0gPSBidWYuc2xpY2UoY3B5KTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGxpc3Quc2hpZnQoKTtcblxuICAgICAgICBjICs9IGNweTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBlbmRSZWFkYWJsZShzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuXG4gIC8vIElmIHdlIGdldCBoZXJlIGJlZm9yZSBjb25zdW1pbmcgYWxsIHRoZSBieXRlcywgdGhlbiB0aGF0IGlzIGFcbiAgLy8gYnVnIGluIG5vZGUuICBTaG91bGQgbmV2ZXIgaGFwcGVuLlxuICBpZiAoc3RhdGUubGVuZ3RoID4gMClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2VuZFJlYWRhYmxlIGNhbGxlZCBvbiBub24tZW1wdHkgc3RyZWFtJyk7XG5cbiAgaWYgKCFzdGF0ZS5lbmRFbWl0dGVkKSB7XG4gICAgc3RhdGUuZW5kZWQgPSB0cnVlO1xuICAgIHByb2Nlc3NOZXh0VGljayhlbmRSZWFkYWJsZU5ULCBzdGF0ZSwgc3RyZWFtKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbmRSZWFkYWJsZU5UKHN0YXRlLCBzdHJlYW0pIHtcbiAgLy8gQ2hlY2sgdGhhdCB3ZSBkaWRuJ3QgZ2V0IG9uZSBsYXN0IHVuc2hpZnQuXG4gIGlmICghc3RhdGUuZW5kRW1pdHRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApIHtcbiAgICBzdGF0ZS5lbmRFbWl0dGVkID0gdHJ1ZTtcbiAgICBzdHJlYW0ucmVhZGFibGUgPSBmYWxzZTtcbiAgICBzdHJlYW0uZW1pdCgnZW5kJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZm9yRWFjaCAoeHMsIGYpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmKHhzW2ldLCBpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbmRleE9mICh4cywgeCkge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGlmICh4c1tpXSA9PT0geCkgcmV0dXJuIGk7XG4gIH1cbiAgcmV0dXJuIC0xO1xufVxuIiwiLy8gYSB0cmFuc2Zvcm0gc3RyZWFtIGlzIGEgcmVhZGFibGUvd3JpdGFibGUgc3RyZWFtIHdoZXJlIHlvdSBkb1xuLy8gc29tZXRoaW5nIHdpdGggdGhlIGRhdGEuICBTb21ldGltZXMgaXQncyBjYWxsZWQgYSBcImZpbHRlclwiLFxuLy8gYnV0IHRoYXQncyBub3QgYSBncmVhdCBuYW1lIGZvciBpdCwgc2luY2UgdGhhdCBpbXBsaWVzIGEgdGhpbmcgd2hlcmVcbi8vIHNvbWUgYml0cyBwYXNzIHRocm91Z2gsIGFuZCBvdGhlcnMgYXJlIHNpbXBseSBpZ25vcmVkLiAgKFRoYXQgd291bGRcbi8vIGJlIGEgdmFsaWQgZXhhbXBsZSBvZiBhIHRyYW5zZm9ybSwgb2YgY291cnNlLilcbi8vXG4vLyBXaGlsZSB0aGUgb3V0cHV0IGlzIGNhdXNhbGx5IHJlbGF0ZWQgdG8gdGhlIGlucHV0LCBpdCdzIG5vdCBhXG4vLyBuZWNlc3NhcmlseSBzeW1tZXRyaWMgb3Igc3luY2hyb25vdXMgdHJhbnNmb3JtYXRpb24uICBGb3IgZXhhbXBsZSxcbi8vIGEgemxpYiBzdHJlYW0gbWlnaHQgdGFrZSBtdWx0aXBsZSBwbGFpbi10ZXh0IHdyaXRlcygpLCBhbmQgdGhlblxuLy8gZW1pdCBhIHNpbmdsZSBjb21wcmVzc2VkIGNodW5rIHNvbWUgdGltZSBpbiB0aGUgZnV0dXJlLlxuLy9cbi8vIEhlcmUncyBob3cgdGhpcyB3b3Jrczpcbi8vXG4vLyBUaGUgVHJhbnNmb3JtIHN0cmVhbSBoYXMgYWxsIHRoZSBhc3BlY3RzIG9mIHRoZSByZWFkYWJsZSBhbmQgd3JpdGFibGVcbi8vIHN0cmVhbSBjbGFzc2VzLiAgV2hlbiB5b3Ugd3JpdGUoY2h1bmspLCB0aGF0IGNhbGxzIF93cml0ZShjaHVuayxjYilcbi8vIGludGVybmFsbHksIGFuZCByZXR1cm5zIGZhbHNlIGlmIHRoZXJlJ3MgYSBsb3Qgb2YgcGVuZGluZyB3cml0ZXNcbi8vIGJ1ZmZlcmVkIHVwLiAgV2hlbiB5b3UgY2FsbCByZWFkKCksIHRoYXQgY2FsbHMgX3JlYWQobikgdW50aWxcbi8vIHRoZXJlJ3MgZW5vdWdoIHBlbmRpbmcgcmVhZGFibGUgZGF0YSBidWZmZXJlZCB1cC5cbi8vXG4vLyBJbiBhIHRyYW5zZm9ybSBzdHJlYW0sIHRoZSB3cml0dGVuIGRhdGEgaXMgcGxhY2VkIGluIGEgYnVmZmVyLiAgV2hlblxuLy8gX3JlYWQobikgaXMgY2FsbGVkLCBpdCB0cmFuc2Zvcm1zIHRoZSBxdWV1ZWQgdXAgZGF0YSwgY2FsbGluZyB0aGVcbi8vIGJ1ZmZlcmVkIF93cml0ZSBjYidzIGFzIGl0IGNvbnN1bWVzIGNodW5rcy4gIElmIGNvbnN1bWluZyBhIHNpbmdsZVxuLy8gd3JpdHRlbiBjaHVuayB3b3VsZCByZXN1bHQgaW4gbXVsdGlwbGUgb3V0cHV0IGNodW5rcywgdGhlbiB0aGUgZmlyc3Rcbi8vIG91dHB1dHRlZCBiaXQgY2FsbHMgdGhlIHJlYWRjYiwgYW5kIHN1YnNlcXVlbnQgY2h1bmtzIGp1c3QgZ28gaW50b1xuLy8gdGhlIHJlYWQgYnVmZmVyLCBhbmQgd2lsbCBjYXVzZSBpdCB0byBlbWl0ICdyZWFkYWJsZScgaWYgbmVjZXNzYXJ5LlxuLy9cbi8vIFRoaXMgd2F5LCBiYWNrLXByZXNzdXJlIGlzIGFjdHVhbGx5IGRldGVybWluZWQgYnkgdGhlIHJlYWRpbmcgc2lkZSxcbi8vIHNpbmNlIF9yZWFkIGhhcyB0byBiZSBjYWxsZWQgdG8gc3RhcnQgcHJvY2Vzc2luZyBhIG5ldyBjaHVuay4gIEhvd2V2ZXIsXG4vLyBhIHBhdGhvbG9naWNhbCBpbmZsYXRlIHR5cGUgb2YgdHJhbnNmb3JtIGNhbiBjYXVzZSBleGNlc3NpdmUgYnVmZmVyaW5nXG4vLyBoZXJlLiAgRm9yIGV4YW1wbGUsIGltYWdpbmUgYSBzdHJlYW0gd2hlcmUgZXZlcnkgYnl0ZSBvZiBpbnB1dCBpc1xuLy8gaW50ZXJwcmV0ZWQgYXMgYW4gaW50ZWdlciBmcm9tIDAtMjU1LCBhbmQgdGhlbiByZXN1bHRzIGluIHRoYXQgbWFueVxuLy8gYnl0ZXMgb2Ygb3V0cHV0LiAgV3JpdGluZyB0aGUgNCBieXRlcyB7ZmYsZmYsZmYsZmZ9IHdvdWxkIHJlc3VsdCBpblxuLy8gMWtiIG9mIGRhdGEgYmVpbmcgb3V0cHV0LiAgSW4gdGhpcyBjYXNlLCB5b3UgY291bGQgd3JpdGUgYSB2ZXJ5IHNtYWxsXG4vLyBhbW91bnQgb2YgaW5wdXQsIGFuZCBlbmQgdXAgd2l0aCBhIHZlcnkgbGFyZ2UgYW1vdW50IG9mIG91dHB1dC4gIEluXG4vLyBzdWNoIGEgcGF0aG9sb2dpY2FsIGluZmxhdGluZyBtZWNoYW5pc20sIHRoZXJlJ2QgYmUgbm8gd2F5IHRvIHRlbGxcbi8vIHRoZSBzeXN0ZW0gdG8gc3RvcCBkb2luZyB0aGUgdHJhbnNmb3JtLiAgQSBzaW5nbGUgNE1CIHdyaXRlIGNvdWxkXG4vLyBjYXVzZSB0aGUgc3lzdGVtIHRvIHJ1biBvdXQgb2YgbWVtb3J5LlxuLy9cbi8vIEhvd2V2ZXIsIGV2ZW4gaW4gc3VjaCBhIHBhdGhvbG9naWNhbCBjYXNlLCBvbmx5IGEgc2luZ2xlIHdyaXR0ZW4gY2h1bmtcbi8vIHdvdWxkIGJlIGNvbnN1bWVkLCBhbmQgdGhlbiB0aGUgcmVzdCB3b3VsZCB3YWl0ICh1bi10cmFuc2Zvcm1lZCkgdW50aWxcbi8vIHRoZSByZXN1bHRzIG9mIHRoZSBwcmV2aW91cyB0cmFuc2Zvcm1lZCBjaHVuayB3ZXJlIGNvbnN1bWVkLlxuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gVHJhbnNmb3JtO1xuXG52YXIgRHVwbGV4ID0gcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbnV0aWwuaW5oZXJpdHMoVHJhbnNmb3JtLCBEdXBsZXgpO1xuXG5cbmZ1bmN0aW9uIFRyYW5zZm9ybVN0YXRlKHN0cmVhbSkge1xuICB0aGlzLmFmdGVyVHJhbnNmb3JtID0gZnVuY3Rpb24oZXIsIGRhdGEpIHtcbiAgICByZXR1cm4gYWZ0ZXJUcmFuc2Zvcm0oc3RyZWFtLCBlciwgZGF0YSk7XG4gIH07XG5cbiAgdGhpcy5uZWVkVHJhbnNmb3JtID0gZmFsc2U7XG4gIHRoaXMudHJhbnNmb3JtaW5nID0gZmFsc2U7XG4gIHRoaXMud3JpdGVjYiA9IG51bGw7XG4gIHRoaXMud3JpdGVjaHVuayA9IG51bGw7XG59XG5cbmZ1bmN0aW9uIGFmdGVyVHJhbnNmb3JtKHN0cmVhbSwgZXIsIGRhdGEpIHtcbiAgdmFyIHRzID0gc3RyZWFtLl90cmFuc2Zvcm1TdGF0ZTtcbiAgdHMudHJhbnNmb3JtaW5nID0gZmFsc2U7XG5cbiAgdmFyIGNiID0gdHMud3JpdGVjYjtcblxuICBpZiAoIWNiKVxuICAgIHJldHVybiBzdHJlYW0uZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ25vIHdyaXRlY2IgaW4gVHJhbnNmb3JtIGNsYXNzJykpO1xuXG4gIHRzLndyaXRlY2h1bmsgPSBudWxsO1xuICB0cy53cml0ZWNiID0gbnVsbDtcblxuICBpZiAoZGF0YSAhPT0gbnVsbCAmJiBkYXRhICE9PSB1bmRlZmluZWQpXG4gICAgc3RyZWFtLnB1c2goZGF0YSk7XG5cbiAgaWYgKGNiKVxuICAgIGNiKGVyKTtcblxuICB2YXIgcnMgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIHJzLnJlYWRpbmcgPSBmYWxzZTtcbiAgaWYgKHJzLm5lZWRSZWFkYWJsZSB8fCBycy5sZW5ndGggPCBycy5oaWdoV2F0ZXJNYXJrKSB7XG4gICAgc3RyZWFtLl9yZWFkKHJzLmhpZ2hXYXRlck1hcmspO1xuICB9XG59XG5cblxuZnVuY3Rpb24gVHJhbnNmb3JtKG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFRyYW5zZm9ybSkpXG4gICAgcmV0dXJuIG5ldyBUcmFuc2Zvcm0ob3B0aW9ucyk7XG5cbiAgRHVwbGV4LmNhbGwodGhpcywgb3B0aW9ucyk7XG5cbiAgdGhpcy5fdHJhbnNmb3JtU3RhdGUgPSBuZXcgVHJhbnNmb3JtU3RhdGUodGhpcyk7XG5cbiAgLy8gd2hlbiB0aGUgd3JpdGFibGUgc2lkZSBmaW5pc2hlcywgdGhlbiBmbHVzaCBvdXQgYW55dGhpbmcgcmVtYWluaW5nLlxuICB2YXIgc3RyZWFtID0gdGhpcztcblxuICAvLyBzdGFydCBvdXQgYXNraW5nIGZvciBhIHJlYWRhYmxlIGV2ZW50IG9uY2UgZGF0YSBpcyB0cmFuc2Zvcm1lZC5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuXG4gIC8vIHdlIGhhdmUgaW1wbGVtZW50ZWQgdGhlIF9yZWFkIG1ldGhvZCwgYW5kIGRvbmUgdGhlIG90aGVyIHRoaW5nc1xuICAvLyB0aGF0IFJlYWRhYmxlIHdhbnRzIGJlZm9yZSB0aGUgZmlyc3QgX3JlYWQgY2FsbCwgc28gdW5zZXQgdGhlXG4gIC8vIHN5bmMgZ3VhcmQgZmxhZy5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5zeW5jID0gZmFsc2U7XG5cbiAgaWYgKG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMudHJhbnNmb3JtID09PSAnZnVuY3Rpb24nKVxuICAgICAgdGhpcy5fdHJhbnNmb3JtID0gb3B0aW9ucy50cmFuc2Zvcm07XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuZmx1c2ggPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl9mbHVzaCA9IG9wdGlvbnMuZmx1c2g7XG4gIH1cblxuICB0aGlzLm9uY2UoJ3ByZWZpbmlzaCcsIGZ1bmN0aW9uKCkge1xuICAgIGlmICh0eXBlb2YgdGhpcy5fZmx1c2ggPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl9mbHVzaChmdW5jdGlvbihlcikge1xuICAgICAgICBkb25lKHN0cmVhbSwgZXIpO1xuICAgICAgfSk7XG4gICAgZWxzZVxuICAgICAgZG9uZShzdHJlYW0pO1xuICB9KTtcbn1cblxuVHJhbnNmb3JtLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nKSB7XG4gIHRoaXMuX3RyYW5zZm9ybVN0YXRlLm5lZWRUcmFuc2Zvcm0gPSBmYWxzZTtcbiAgcmV0dXJuIER1cGxleC5wcm90b3R5cGUucHVzaC5jYWxsKHRoaXMsIGNodW5rLCBlbmNvZGluZyk7XG59O1xuXG4vLyBUaGlzIGlzIHRoZSBwYXJ0IHdoZXJlIHlvdSBkbyBzdHVmZiFcbi8vIG92ZXJyaWRlIHRoaXMgZnVuY3Rpb24gaW4gaW1wbGVtZW50YXRpb24gY2xhc3Nlcy5cbi8vICdjaHVuaycgaXMgYW4gaW5wdXQgY2h1bmsuXG4vL1xuLy8gQ2FsbCBgcHVzaChuZXdDaHVuaylgIHRvIHBhc3MgYWxvbmcgdHJhbnNmb3JtZWQgb3V0cHV0XG4vLyB0byB0aGUgcmVhZGFibGUgc2lkZS4gIFlvdSBtYXkgY2FsbCAncHVzaCcgemVybyBvciBtb3JlIHRpbWVzLlxuLy9cbi8vIENhbGwgYGNiKGVycilgIHdoZW4geW91IGFyZSBkb25lIHdpdGggdGhpcyBjaHVuay4gIElmIHlvdSBwYXNzXG4vLyBhbiBlcnJvciwgdGhlbiB0aGF0J2xsIHB1dCB0aGUgaHVydCBvbiB0aGUgd2hvbGUgb3BlcmF0aW9uLiAgSWYgeW91XG4vLyBuZXZlciBjYWxsIGNiKCksIHRoZW4geW91J2xsIG5ldmVyIGdldCBhbm90aGVyIGNodW5rLlxuVHJhbnNmb3JtLnByb3RvdHlwZS5fdHJhbnNmb3JtID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xufTtcblxuVHJhbnNmb3JtLnByb3RvdHlwZS5fd3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciB0cyA9IHRoaXMuX3RyYW5zZm9ybVN0YXRlO1xuICB0cy53cml0ZWNiID0gY2I7XG4gIHRzLndyaXRlY2h1bmsgPSBjaHVuaztcbiAgdHMud3JpdGVlbmNvZGluZyA9IGVuY29kaW5nO1xuICBpZiAoIXRzLnRyYW5zZm9ybWluZykge1xuICAgIHZhciBycyA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gICAgaWYgKHRzLm5lZWRUcmFuc2Zvcm0gfHxcbiAgICAgICAgcnMubmVlZFJlYWRhYmxlIHx8XG4gICAgICAgIHJzLmxlbmd0aCA8IHJzLmhpZ2hXYXRlck1hcmspXG4gICAgICB0aGlzLl9yZWFkKHJzLmhpZ2hXYXRlck1hcmspO1xuICB9XG59O1xuXG4vLyBEb2Vzbid0IG1hdHRlciB3aGF0IHRoZSBhcmdzIGFyZSBoZXJlLlxuLy8gX3RyYW5zZm9ybSBkb2VzIGFsbCB0aGUgd29yay5cbi8vIFRoYXQgd2UgZ290IGhlcmUgbWVhbnMgdGhhdCB0aGUgcmVhZGFibGUgc2lkZSB3YW50cyBtb3JlIGRhdGEuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLl9yZWFkID0gZnVuY3Rpb24obikge1xuICB2YXIgdHMgPSB0aGlzLl90cmFuc2Zvcm1TdGF0ZTtcblxuICBpZiAodHMud3JpdGVjaHVuayAhPT0gbnVsbCAmJiB0cy53cml0ZWNiICYmICF0cy50cmFuc2Zvcm1pbmcpIHtcbiAgICB0cy50cmFuc2Zvcm1pbmcgPSB0cnVlO1xuICAgIHRoaXMuX3RyYW5zZm9ybSh0cy53cml0ZWNodW5rLCB0cy53cml0ZWVuY29kaW5nLCB0cy5hZnRlclRyYW5zZm9ybSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gbWFyayB0aGF0IHdlIG5lZWQgYSB0cmFuc2Zvcm0sIHNvIHRoYXQgYW55IGRhdGEgdGhhdCBjb21lcyBpblxuICAgIC8vIHdpbGwgZ2V0IHByb2Nlc3NlZCwgbm93IHRoYXQgd2UndmUgYXNrZWQgZm9yIGl0LlxuICAgIHRzLm5lZWRUcmFuc2Zvcm0gPSB0cnVlO1xuICB9XG59O1xuXG5cbmZ1bmN0aW9uIGRvbmUoc3RyZWFtLCBlcikge1xuICBpZiAoZXIpXG4gICAgcmV0dXJuIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcblxuICAvLyBpZiB0aGVyZSdzIG5vdGhpbmcgaW4gdGhlIHdyaXRlIGJ1ZmZlciwgdGhlbiB0aGF0IG1lYW5zXG4gIC8vIHRoYXQgbm90aGluZyBtb3JlIHdpbGwgZXZlciBiZSBwcm92aWRlZFxuICB2YXIgd3MgPSBzdHJlYW0uX3dyaXRhYmxlU3RhdGU7XG4gIHZhciB0cyA9IHN0cmVhbS5fdHJhbnNmb3JtU3RhdGU7XG5cbiAgaWYgKHdzLmxlbmd0aClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbGxpbmcgdHJhbnNmb3JtIGRvbmUgd2hlbiB3cy5sZW5ndGggIT0gMCcpO1xuXG4gIGlmICh0cy50cmFuc2Zvcm1pbmcpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjYWxsaW5nIHRyYW5zZm9ybSBkb25lIHdoZW4gc3RpbGwgdHJhbnNmb3JtaW5nJyk7XG5cbiAgcmV0dXJuIHN0cmVhbS5wdXNoKG51bGwpO1xufVxuIiwiLy8gQSBiaXQgc2ltcGxlciB0aGFuIHJlYWRhYmxlIHN0cmVhbXMuXG4vLyBJbXBsZW1lbnQgYW4gYXN5bmMgLl93cml0ZShjaHVuaywgZW5jb2RpbmcsIGNiKSwgYW5kIGl0J2xsIGhhbmRsZSBhbGxcbi8vIHRoZSBkcmFpbiBldmVudCBlbWlzc2lvbiBhbmQgYnVmZmVyaW5nLlxuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gV3JpdGFibGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgcHJvY2Vzc05leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy1uZXh0aWNrLWFyZ3MnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbldyaXRhYmxlLldyaXRhYmxlU3RhdGUgPSBXcml0YWJsZVN0YXRlO1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGludGVybmFsVXRpbCA9IHtcbiAgZGVwcmVjYXRlOiByZXF1aXJlKCd1dGlsLWRlcHJlY2F0ZScpXG59O1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIFN0cmVhbTtcbihmdW5jdGlvbiAoKXt0cnl7XG4gIFN0cmVhbSA9IHJlcXVpcmUoJ3N0JyArICdyZWFtJyk7XG59Y2F0Y2goXyl7fWZpbmFsbHl7XG4gIGlmICghU3RyZWFtKVxuICAgIFN0cmVhbSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbn19KCkpXG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcblxudXRpbC5pbmhlcml0cyhXcml0YWJsZSwgU3RyZWFtKTtcblxuZnVuY3Rpb24gbm9wKCkge31cblxuZnVuY3Rpb24gV3JpdGVSZXEoY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB0aGlzLmNodW5rID0gY2h1bms7XG4gIHRoaXMuZW5jb2RpbmcgPSBlbmNvZGluZztcbiAgdGhpcy5jYWxsYmFjayA9IGNiO1xuICB0aGlzLm5leHQgPSBudWxsO1xufVxuXG52YXIgRHVwbGV4O1xuZnVuY3Rpb24gV3JpdGFibGVTdGF0ZShvcHRpb25zLCBzdHJlYW0pIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyBvYmplY3Qgc3RyZWFtIGZsYWcgdG8gaW5kaWNhdGUgd2hldGhlciBvciBub3QgdGhpcyBzdHJlYW1cbiAgLy8gY29udGFpbnMgYnVmZmVycyBvciBvYmplY3RzLlxuICB0aGlzLm9iamVjdE1vZGUgPSAhIW9wdGlvbnMub2JqZWN0TW9kZTtcblxuICBpZiAoc3RyZWFtIGluc3RhbmNlb2YgRHVwbGV4KVxuICAgIHRoaXMub2JqZWN0TW9kZSA9IHRoaXMub2JqZWN0TW9kZSB8fCAhIW9wdGlvbnMud3JpdGFibGVPYmplY3RNb2RlO1xuXG4gIC8vIHRoZSBwb2ludCBhdCB3aGljaCB3cml0ZSgpIHN0YXJ0cyByZXR1cm5pbmcgZmFsc2VcbiAgLy8gTm90ZTogMCBpcyBhIHZhbGlkIHZhbHVlLCBtZWFucyB0aGF0IHdlIGFsd2F5cyByZXR1cm4gZmFsc2UgaWZcbiAgLy8gdGhlIGVudGlyZSBidWZmZXIgaXMgbm90IGZsdXNoZWQgaW1tZWRpYXRlbHkgb24gd3JpdGUoKVxuICB2YXIgaHdtID0gb3B0aW9ucy5oaWdoV2F0ZXJNYXJrO1xuICB2YXIgZGVmYXVsdEh3bSA9IHRoaXMub2JqZWN0TW9kZSA/IDE2IDogMTYgKiAxMDI0O1xuICB0aGlzLmhpZ2hXYXRlck1hcmsgPSAoaHdtIHx8IGh3bSA9PT0gMCkgPyBod20gOiBkZWZhdWx0SHdtO1xuXG4gIC8vIGNhc3QgdG8gaW50cy5cbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gfn50aGlzLmhpZ2hXYXRlck1hcms7XG5cbiAgdGhpcy5uZWVkRHJhaW4gPSBmYWxzZTtcbiAgLy8gYXQgdGhlIHN0YXJ0IG9mIGNhbGxpbmcgZW5kKClcbiAgdGhpcy5lbmRpbmcgPSBmYWxzZTtcbiAgLy8gd2hlbiBlbmQoKSBoYXMgYmVlbiBjYWxsZWQsIGFuZCByZXR1cm5lZFxuICB0aGlzLmVuZGVkID0gZmFsc2U7XG4gIC8vIHdoZW4gJ2ZpbmlzaCcgaXMgZW1pdHRlZFxuICB0aGlzLmZpbmlzaGVkID0gZmFsc2U7XG5cbiAgLy8gc2hvdWxkIHdlIGRlY29kZSBzdHJpbmdzIGludG8gYnVmZmVycyBiZWZvcmUgcGFzc2luZyB0byBfd3JpdGU/XG4gIC8vIHRoaXMgaXMgaGVyZSBzbyB0aGF0IHNvbWUgbm9kZS1jb3JlIHN0cmVhbXMgY2FuIG9wdGltaXplIHN0cmluZ1xuICAvLyBoYW5kbGluZyBhdCBhIGxvd2VyIGxldmVsLlxuICB2YXIgbm9EZWNvZGUgPSBvcHRpb25zLmRlY29kZVN0cmluZ3MgPT09IGZhbHNlO1xuICB0aGlzLmRlY29kZVN0cmluZ3MgPSAhbm9EZWNvZGU7XG5cbiAgLy8gQ3J5cHRvIGlzIGtpbmQgb2Ygb2xkIGFuZCBjcnVzdHkuICBIaXN0b3JpY2FsbHksIGl0cyBkZWZhdWx0IHN0cmluZ1xuICAvLyBlbmNvZGluZyBpcyAnYmluYXJ5JyBzbyB3ZSBoYXZlIHRvIG1ha2UgdGhpcyBjb25maWd1cmFibGUuXG4gIC8vIEV2ZXJ5dGhpbmcgZWxzZSBpbiB0aGUgdW5pdmVyc2UgdXNlcyAndXRmOCcsIHRob3VnaC5cbiAgdGhpcy5kZWZhdWx0RW5jb2RpbmcgPSBvcHRpb25zLmRlZmF1bHRFbmNvZGluZyB8fCAndXRmOCc7XG5cbiAgLy8gbm90IGFuIGFjdHVhbCBidWZmZXIgd2Uga2VlcCB0cmFjayBvZiwgYnV0IGEgbWVhc3VyZW1lbnRcbiAgLy8gb2YgaG93IG11Y2ggd2UncmUgd2FpdGluZyB0byBnZXQgcHVzaGVkIHRvIHNvbWUgdW5kZXJseWluZ1xuICAvLyBzb2NrZXQgb3IgZmlsZS5cbiAgdGhpcy5sZW5ndGggPSAwO1xuXG4gIC8vIGEgZmxhZyB0byBzZWUgd2hlbiB3ZSdyZSBpbiB0aGUgbWlkZGxlIG9mIGEgd3JpdGUuXG4gIHRoaXMud3JpdGluZyA9IGZhbHNlO1xuXG4gIC8vIHdoZW4gdHJ1ZSBhbGwgd3JpdGVzIHdpbGwgYmUgYnVmZmVyZWQgdW50aWwgLnVuY29yaygpIGNhbGxcbiAgdGhpcy5jb3JrZWQgPSAwO1xuXG4gIC8vIGEgZmxhZyB0byBiZSBhYmxlIHRvIHRlbGwgaWYgdGhlIG9ud3JpdGUgY2IgaXMgY2FsbGVkIGltbWVkaWF0ZWx5LFxuICAvLyBvciBvbiBhIGxhdGVyIHRpY2suICBXZSBzZXQgdGhpcyB0byB0cnVlIGF0IGZpcnN0LCBiZWNhdXNlIGFueVxuICAvLyBhY3Rpb25zIHRoYXQgc2hvdWxkbid0IGhhcHBlbiB1bnRpbCBcImxhdGVyXCIgc2hvdWxkIGdlbmVyYWxseSBhbHNvXG4gIC8vIG5vdCBoYXBwZW4gYmVmb3JlIHRoZSBmaXJzdCB3cml0ZSBjYWxsLlxuICB0aGlzLnN5bmMgPSB0cnVlO1xuXG4gIC8vIGEgZmxhZyB0byBrbm93IGlmIHdlJ3JlIHByb2Nlc3NpbmcgcHJldmlvdXNseSBidWZmZXJlZCBpdGVtcywgd2hpY2hcbiAgLy8gbWF5IGNhbGwgdGhlIF93cml0ZSgpIGNhbGxiYWNrIGluIHRoZSBzYW1lIHRpY2ssIHNvIHRoYXQgd2UgZG9uJ3RcbiAgLy8gZW5kIHVwIGluIGFuIG92ZXJsYXBwZWQgb253cml0ZSBzaXR1YXRpb24uXG4gIHRoaXMuYnVmZmVyUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG4gIC8vIHRoZSBjYWxsYmFjayB0aGF0J3MgcGFzc2VkIHRvIF93cml0ZShjaHVuayxjYilcbiAgdGhpcy5vbndyaXRlID0gZnVuY3Rpb24oZXIpIHtcbiAgICBvbndyaXRlKHN0cmVhbSwgZXIpO1xuICB9O1xuXG4gIC8vIHRoZSBjYWxsYmFjayB0aGF0IHRoZSB1c2VyIHN1cHBsaWVzIHRvIHdyaXRlKGNodW5rLGVuY29kaW5nLGNiKVxuICB0aGlzLndyaXRlY2IgPSBudWxsO1xuXG4gIC8vIHRoZSBhbW91bnQgdGhhdCBpcyBiZWluZyB3cml0dGVuIHdoZW4gX3dyaXRlIGlzIGNhbGxlZC5cbiAgdGhpcy53cml0ZWxlbiA9IDA7XG5cbiAgdGhpcy5idWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuICB0aGlzLmxhc3RCdWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuXG4gIC8vIG51bWJlciBvZiBwZW5kaW5nIHVzZXItc3VwcGxpZWQgd3JpdGUgY2FsbGJhY2tzXG4gIC8vIHRoaXMgbXVzdCBiZSAwIGJlZm9yZSAnZmluaXNoJyBjYW4gYmUgZW1pdHRlZFxuICB0aGlzLnBlbmRpbmdjYiA9IDA7XG5cbiAgLy8gZW1pdCBwcmVmaW5pc2ggaWYgdGhlIG9ubHkgdGhpbmcgd2UncmUgd2FpdGluZyBmb3IgaXMgX3dyaXRlIGNic1xuICAvLyBUaGlzIGlzIHJlbGV2YW50IGZvciBzeW5jaHJvbm91cyBUcmFuc2Zvcm0gc3RyZWFtc1xuICB0aGlzLnByZWZpbmlzaGVkID0gZmFsc2U7XG5cbiAgLy8gVHJ1ZSBpZiB0aGUgZXJyb3Igd2FzIGFscmVhZHkgZW1pdHRlZCBhbmQgc2hvdWxkIG5vdCBiZSB0aHJvd24gYWdhaW5cbiAgdGhpcy5lcnJvckVtaXR0ZWQgPSBmYWxzZTtcbn1cblxuV3JpdGFibGVTdGF0ZS5wcm90b3R5cGUuZ2V0QnVmZmVyID0gZnVuY3Rpb24gd3JpdGFibGVTdGF0ZUdldEJ1ZmZlcigpIHtcbiAgdmFyIGN1cnJlbnQgPSB0aGlzLmJ1ZmZlcmVkUmVxdWVzdDtcbiAgdmFyIG91dCA9IFtdO1xuICB3aGlsZSAoY3VycmVudCkge1xuICAgIG91dC5wdXNoKGN1cnJlbnQpO1xuICAgIGN1cnJlbnQgPSBjdXJyZW50Lm5leHQ7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn07XG5cbihmdW5jdGlvbiAoKXt0cnkge1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFdyaXRhYmxlU3RhdGUucHJvdG90eXBlLCAnYnVmZmVyJywge1xuICBnZXQ6IGludGVybmFsVXRpbC5kZXByZWNhdGUoZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyKCk7XG4gIH0sICdfd3JpdGFibGVTdGF0ZS5idWZmZXIgaXMgZGVwcmVjYXRlZC4gVXNlIF93cml0YWJsZVN0YXRlLmdldEJ1ZmZlciAnICtcbiAgICAgJ2luc3RlYWQuJylcbn0pO1xufWNhdGNoKF8pe319KCkpO1xuXG5cbnZhciBEdXBsZXg7XG5mdW5jdGlvbiBXcml0YWJsZShvcHRpb25zKSB7XG4gIER1cGxleCA9IER1cGxleCB8fCByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgLy8gV3JpdGFibGUgY3RvciBpcyBhcHBsaWVkIHRvIER1cGxleGVzLCB0aG91Z2ggdGhleSdyZSBub3RcbiAgLy8gaW5zdGFuY2VvZiBXcml0YWJsZSwgdGhleSdyZSBpbnN0YW5jZW9mIFJlYWRhYmxlLlxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgV3JpdGFibGUpICYmICEodGhpcyBpbnN0YW5jZW9mIER1cGxleCkpXG4gICAgcmV0dXJuIG5ldyBXcml0YWJsZShvcHRpb25zKTtcblxuICB0aGlzLl93cml0YWJsZVN0YXRlID0gbmV3IFdyaXRhYmxlU3RhdGUob3B0aW9ucywgdGhpcyk7XG5cbiAgLy8gbGVnYWN5LlxuICB0aGlzLndyaXRhYmxlID0gdHJ1ZTtcblxuICBpZiAob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy53cml0ZSA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgIHRoaXMuX3dyaXRlID0gb3B0aW9ucy53cml0ZTtcblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy53cml0ZXYgPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl93cml0ZXYgPSBvcHRpb25zLndyaXRldjtcbiAgfVxuXG4gIFN0cmVhbS5jYWxsKHRoaXMpO1xufVxuXG4vLyBPdGhlcndpc2UgcGVvcGxlIGNhbiBwaXBlIFdyaXRhYmxlIHN0cmVhbXMsIHdoaWNoIGlzIGp1c3Qgd3JvbmcuXG5Xcml0YWJsZS5wcm90b3R5cGUucGlwZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdDYW5ub3QgcGlwZS4gTm90IHJlYWRhYmxlLicpKTtcbn07XG5cblxuZnVuY3Rpb24gd3JpdGVBZnRlckVuZChzdHJlYW0sIGNiKSB7XG4gIHZhciBlciA9IG5ldyBFcnJvcignd3JpdGUgYWZ0ZXIgZW5kJyk7XG4gIC8vIFRPRE86IGRlZmVyIGVycm9yIGV2ZW50cyBjb25zaXN0ZW50bHkgZXZlcnl3aGVyZSwgbm90IGp1c3QgdGhlIGNiXG4gIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgcHJvY2Vzc05leHRUaWNrKGNiLCBlcik7XG59XG5cbi8vIElmIHdlIGdldCBzb21ldGhpbmcgdGhhdCBpcyBub3QgYSBidWZmZXIsIHN0cmluZywgbnVsbCwgb3IgdW5kZWZpbmVkLFxuLy8gYW5kIHdlJ3JlIG5vdCBpbiBvYmplY3RNb2RlLCB0aGVuIHRoYXQncyBhbiBlcnJvci5cbi8vIE90aGVyd2lzZSBzdHJlYW0gY2h1bmtzIGFyZSBhbGwgY29uc2lkZXJlZCB0byBiZSBvZiBsZW5ndGg9MSwgYW5kIHRoZVxuLy8gd2F0ZXJtYXJrcyBkZXRlcm1pbmUgaG93IG1hbnkgb2JqZWN0cyB0byBrZWVwIGluIHRoZSBidWZmZXIsIHJhdGhlciB0aGFuXG4vLyBob3cgbWFueSBieXRlcyBvciBjaGFyYWN0ZXJzLlxuZnVuY3Rpb24gdmFsaWRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgY2IpIHtcbiAgdmFyIHZhbGlkID0gdHJ1ZTtcblxuICBpZiAoIShCdWZmZXIuaXNCdWZmZXIoY2h1bmspKSAmJlxuICAgICAgdHlwZW9mIGNodW5rICE9PSAnc3RyaW5nJyAmJlxuICAgICAgY2h1bmsgIT09IG51bGwgJiZcbiAgICAgIGNodW5rICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgdmFyIGVyID0gbmV3IFR5cGVFcnJvcignSW52YWxpZCBub24tc3RyaW5nL2J1ZmZlciBjaHVuaycpO1xuICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgICBwcm9jZXNzTmV4dFRpY2soY2IsIGVyKTtcbiAgICB2YWxpZCA9IGZhbHNlO1xuICB9XG4gIHJldHVybiB2YWxpZDtcbn1cblxuV3JpdGFibGUucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuICB2YXIgcmV0ID0gZmFsc2U7XG5cbiAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNiID0gZW5jb2Rpbmc7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9XG5cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpXG4gICAgZW5jb2RpbmcgPSAnYnVmZmVyJztcbiAgZWxzZSBpZiAoIWVuY29kaW5nKVxuICAgIGVuY29kaW5nID0gc3RhdGUuZGVmYXVsdEVuY29kaW5nO1xuXG4gIGlmICh0eXBlb2YgY2IgIT09ICdmdW5jdGlvbicpXG4gICAgY2IgPSBub3A7XG5cbiAgaWYgKHN0YXRlLmVuZGVkKVxuICAgIHdyaXRlQWZ0ZXJFbmQodGhpcywgY2IpO1xuICBlbHNlIGlmICh2YWxpZENodW5rKHRoaXMsIHN0YXRlLCBjaHVuaywgY2IpKSB7XG4gICAgc3RhdGUucGVuZGluZ2NiKys7XG4gICAgcmV0ID0gd3JpdGVPckJ1ZmZlcih0aGlzLCBzdGF0ZSwgY2h1bmssIGVuY29kaW5nLCBjYik7XG4gIH1cblxuICByZXR1cm4gcmV0O1xufTtcblxuV3JpdGFibGUucHJvdG90eXBlLmNvcmsgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fd3JpdGFibGVTdGF0ZTtcblxuICBzdGF0ZS5jb3JrZWQrKztcbn07XG5cbldyaXRhYmxlLnByb3RvdHlwZS51bmNvcmsgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fd3JpdGFibGVTdGF0ZTtcblxuICBpZiAoc3RhdGUuY29ya2VkKSB7XG4gICAgc3RhdGUuY29ya2VkLS07XG5cbiAgICBpZiAoIXN0YXRlLndyaXRpbmcgJiZcbiAgICAgICAgIXN0YXRlLmNvcmtlZCAmJlxuICAgICAgICAhc3RhdGUuZmluaXNoZWQgJiZcbiAgICAgICAgIXN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgJiZcbiAgICAgICAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0KVxuICAgICAgY2xlYXJCdWZmZXIodGhpcywgc3RhdGUpO1xuICB9XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuc2V0RGVmYXVsdEVuY29kaW5nID0gZnVuY3Rpb24gc2V0RGVmYXVsdEVuY29kaW5nKGVuY29kaW5nKSB7XG4gIC8vIG5vZGU6OlBhcnNlRW5jb2RpbmcoKSByZXF1aXJlcyBsb3dlciBjYXNlLlxuICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJylcbiAgICBlbmNvZGluZyA9IGVuY29kaW5nLnRvTG93ZXJDYXNlKCk7XG4gIGlmICghKFsnaGV4JywgJ3V0ZjgnLCAndXRmLTgnLCAnYXNjaWknLCAnYmluYXJ5JywgJ2Jhc2U2NCcsXG4ndWNzMicsICd1Y3MtMicsJ3V0ZjE2bGUnLCAndXRmLTE2bGUnLCAncmF3J11cbi5pbmRleE9mKChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpKSA+IC0xKSlcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpO1xuICB0aGlzLl93cml0YWJsZVN0YXRlLmRlZmF1bHRFbmNvZGluZyA9IGVuY29kaW5nO1xufTtcblxuZnVuY3Rpb24gZGVjb2RlQ2h1bmsoc3RhdGUsIGNodW5rLCBlbmNvZGluZykge1xuICBpZiAoIXN0YXRlLm9iamVjdE1vZGUgJiZcbiAgICAgIHN0YXRlLmRlY29kZVN0cmluZ3MgIT09IGZhbHNlICYmXG4gICAgICB0eXBlb2YgY2h1bmsgPT09ICdzdHJpbmcnKSB7XG4gICAgY2h1bmsgPSBuZXcgQnVmZmVyKGNodW5rLCBlbmNvZGluZyk7XG4gIH1cbiAgcmV0dXJuIGNodW5rO1xufVxuXG4vLyBpZiB3ZSdyZSBhbHJlYWR5IHdyaXRpbmcgc29tZXRoaW5nLCB0aGVuIGp1c3QgcHV0IHRoaXNcbi8vIGluIHRoZSBxdWV1ZSwgYW5kIHdhaXQgb3VyIHR1cm4uICBPdGhlcndpc2UsIGNhbGwgX3dyaXRlXG4vLyBJZiB3ZSByZXR1cm4gZmFsc2UsIHRoZW4gd2UgbmVlZCBhIGRyYWluIGV2ZW50LCBzbyBzZXQgdGhhdCBmbGFnLlxuZnVuY3Rpb24gd3JpdGVPckJ1ZmZlcihzdHJlYW0sIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNodW5rID0gZGVjb2RlQ2h1bmsoc3RhdGUsIGNodW5rLCBlbmNvZGluZyk7XG5cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpXG4gICAgZW5jb2RpbmcgPSAnYnVmZmVyJztcbiAgdmFyIGxlbiA9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuXG4gIHN0YXRlLmxlbmd0aCArPSBsZW47XG5cbiAgdmFyIHJldCA9IHN0YXRlLmxlbmd0aCA8IHN0YXRlLmhpZ2hXYXRlck1hcms7XG4gIC8vIHdlIG11c3QgZW5zdXJlIHRoYXQgcHJldmlvdXMgbmVlZERyYWluIHdpbGwgbm90IGJlIHJlc2V0IHRvIGZhbHNlLlxuICBpZiAoIXJldClcbiAgICBzdGF0ZS5uZWVkRHJhaW4gPSB0cnVlO1xuXG4gIGlmIChzdGF0ZS53cml0aW5nIHx8IHN0YXRlLmNvcmtlZCkge1xuICAgIHZhciBsYXN0ID0gc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdDtcbiAgICBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0gbmV3IFdyaXRlUmVxKGNodW5rLCBlbmNvZGluZywgY2IpO1xuICAgIGlmIChsYXN0KSB7XG4gICAgICBsYXN0Lm5leHQgPSBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0ZS5idWZmZXJlZFJlcXVlc3QgPSBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0O1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIGZhbHNlLCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCB3cml0ZXYsIGxlbiwgY2h1bmssIGVuY29kaW5nLCBjYikge1xuICBzdGF0ZS53cml0ZWxlbiA9IGxlbjtcbiAgc3RhdGUud3JpdGVjYiA9IGNiO1xuICBzdGF0ZS53cml0aW5nID0gdHJ1ZTtcbiAgc3RhdGUuc3luYyA9IHRydWU7XG4gIGlmICh3cml0ZXYpXG4gICAgc3RyZWFtLl93cml0ZXYoY2h1bmssIHN0YXRlLm9ud3JpdGUpO1xuICBlbHNlXG4gICAgc3RyZWFtLl93cml0ZShjaHVuaywgZW5jb2RpbmcsIHN0YXRlLm9ud3JpdGUpO1xuICBzdGF0ZS5zeW5jID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIG9ud3JpdGVFcnJvcihzdHJlYW0sIHN0YXRlLCBzeW5jLCBlciwgY2IpIHtcbiAgLS1zdGF0ZS5wZW5kaW5nY2I7XG4gIGlmIChzeW5jKVxuICAgIHByb2Nlc3NOZXh0VGljayhjYiwgZXIpO1xuICBlbHNlXG4gICAgY2IoZXIpO1xuXG4gIHN0cmVhbS5fd3JpdGFibGVTdGF0ZS5lcnJvckVtaXR0ZWQgPSB0cnVlO1xuICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG59XG5cbmZ1bmN0aW9uIG9ud3JpdGVTdGF0ZVVwZGF0ZShzdGF0ZSkge1xuICBzdGF0ZS53cml0aW5nID0gZmFsc2U7XG4gIHN0YXRlLndyaXRlY2IgPSBudWxsO1xuICBzdGF0ZS5sZW5ndGggLT0gc3RhdGUud3JpdGVsZW47XG4gIHN0YXRlLndyaXRlbGVuID0gMDtcbn1cblxuZnVuY3Rpb24gb253cml0ZShzdHJlYW0sIGVyKSB7XG4gIHZhciBzdGF0ZSA9IHN0cmVhbS5fd3JpdGFibGVTdGF0ZTtcbiAgdmFyIHN5bmMgPSBzdGF0ZS5zeW5jO1xuICB2YXIgY2IgPSBzdGF0ZS53cml0ZWNiO1xuXG4gIG9ud3JpdGVTdGF0ZVVwZGF0ZShzdGF0ZSk7XG5cbiAgaWYgKGVyKVxuICAgIG9ud3JpdGVFcnJvcihzdHJlYW0sIHN0YXRlLCBzeW5jLCBlciwgY2IpO1xuICBlbHNlIHtcbiAgICAvLyBDaGVjayBpZiB3ZSdyZSBhY3R1YWxseSByZWFkeSB0byBmaW5pc2gsIGJ1dCBkb24ndCBlbWl0IHlldFxuICAgIHZhciBmaW5pc2hlZCA9IG5lZWRGaW5pc2goc3RhdGUpO1xuXG4gICAgaWYgKCFmaW5pc2hlZCAmJlxuICAgICAgICAhc3RhdGUuY29ya2VkICYmXG4gICAgICAgICFzdGF0ZS5idWZmZXJQcm9jZXNzaW5nICYmXG4gICAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCkge1xuICAgICAgY2xlYXJCdWZmZXIoc3RyZWFtLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgaWYgKHN5bmMpIHtcbiAgICAgIHByb2Nlc3NOZXh0VGljayhhZnRlcldyaXRlLCBzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhZnRlcldyaXRlKHN0cmVhbSwgc3RhdGUsIGZpbmlzaGVkLCBjYik7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFmdGVyV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmluaXNoZWQsIGNiKSB7XG4gIGlmICghZmluaXNoZWQpXG4gICAgb253cml0ZURyYWluKHN0cmVhbSwgc3RhdGUpO1xuICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgY2IoKTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG59XG5cbi8vIE11c3QgZm9yY2UgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIG9uIG5leHRUaWNrLCBzbyB0aGF0IHdlIGRvbid0XG4vLyBlbWl0ICdkcmFpbicgYmVmb3JlIHRoZSB3cml0ZSgpIGNvbnN1bWVyIGdldHMgdGhlICdmYWxzZScgcmV0dXJuXG4vLyB2YWx1ZSwgYW5kIGhhcyBhIGNoYW5jZSB0byBhdHRhY2ggYSAnZHJhaW4nIGxpc3RlbmVyLlxuZnVuY3Rpb24gb253cml0ZURyYWluKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5uZWVkRHJhaW4pIHtcbiAgICBzdGF0ZS5uZWVkRHJhaW4gPSBmYWxzZTtcbiAgICBzdHJlYW0uZW1pdCgnZHJhaW4nKTtcbiAgfVxufVxuXG5cbi8vIGlmIHRoZXJlJ3Mgc29tZXRoaW5nIGluIHRoZSBidWZmZXIgd2FpdGluZywgdGhlbiBwcm9jZXNzIGl0XG5mdW5jdGlvbiBjbGVhckJ1ZmZlcihzdHJlYW0sIHN0YXRlKSB7XG4gIHN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgPSB0cnVlO1xuICB2YXIgZW50cnkgPSBzdGF0ZS5idWZmZXJlZFJlcXVlc3Q7XG5cbiAgaWYgKHN0cmVhbS5fd3JpdGV2ICYmIGVudHJ5ICYmIGVudHJ5Lm5leHQpIHtcbiAgICAvLyBGYXN0IGNhc2UsIHdyaXRlIGV2ZXJ5dGhpbmcgdXNpbmcgX3dyaXRldigpXG4gICAgdmFyIGJ1ZmZlciA9IFtdO1xuICAgIHZhciBjYnMgPSBbXTtcbiAgICB3aGlsZSAoZW50cnkpIHtcbiAgICAgIGNicy5wdXNoKGVudHJ5LmNhbGxiYWNrKTtcbiAgICAgIGJ1ZmZlci5wdXNoKGVudHJ5KTtcbiAgICAgIGVudHJ5ID0gZW50cnkubmV4dDtcbiAgICB9XG5cbiAgICAvLyBjb3VudCB0aGUgb25lIHdlIGFyZSBhZGRpbmcsIGFzIHdlbGwuXG4gICAgLy8gVE9ETyhpc2FhY3MpIGNsZWFuIHRoaXMgdXBcbiAgICBzdGF0ZS5wZW5kaW5nY2IrKztcbiAgICBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0gbnVsbDtcbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIHRydWUsIHN0YXRlLmxlbmd0aCwgYnVmZmVyLCAnJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNicy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgICAgICAgY2JzW2ldKGVycik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDbGVhciBidWZmZXJcbiAgfSBlbHNlIHtcbiAgICAvLyBTbG93IGNhc2UsIHdyaXRlIGNodW5rcyBvbmUtYnktb25lXG4gICAgd2hpbGUgKGVudHJ5KSB7XG4gICAgICB2YXIgY2h1bmsgPSBlbnRyeS5jaHVuaztcbiAgICAgIHZhciBlbmNvZGluZyA9IGVudHJ5LmVuY29kaW5nO1xuICAgICAgdmFyIGNiID0gZW50cnkuY2FsbGJhY2s7XG4gICAgICB2YXIgbGVuID0gc3RhdGUub2JqZWN0TW9kZSA/IDEgOiBjaHVuay5sZW5ndGg7XG5cbiAgICAgIGRvV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmFsc2UsIGxlbiwgY2h1bmssIGVuY29kaW5nLCBjYik7XG4gICAgICBlbnRyeSA9IGVudHJ5Lm5leHQ7XG4gICAgICAvLyBpZiB3ZSBkaWRuJ3QgY2FsbCB0aGUgb253cml0ZSBpbW1lZGlhdGVseSwgdGhlblxuICAgICAgLy8gaXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHdhaXQgdW50aWwgaXQgZG9lcy5cbiAgICAgIC8vIGFsc28sIHRoYXQgbWVhbnMgdGhhdCB0aGUgY2h1bmsgYW5kIGNiIGFyZSBjdXJyZW50bHlcbiAgICAgIC8vIGJlaW5nIHByb2Nlc3NlZCwgc28gbW92ZSB0aGUgYnVmZmVyIGNvdW50ZXIgcGFzdCB0aGVtLlxuICAgICAgaWYgKHN0YXRlLndyaXRpbmcpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGVudHJ5ID09PSBudWxsKVxuICAgICAgc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdCA9IG51bGw7XG4gIH1cbiAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0ID0gZW50cnk7XG4gIHN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgPSBmYWxzZTtcbn1cblxuV3JpdGFibGUucHJvdG90eXBlLl93cml0ZSA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgY2IobmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKSk7XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuX3dyaXRldiA9IG51bGw7XG5cbldyaXRhYmxlLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG5cbiAgaWYgKHR5cGVvZiBjaHVuayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNiID0gY2h1bms7XG4gICAgY2h1bmsgPSBudWxsO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYiA9IGVuY29kaW5nO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfVxuXG4gIGlmIChjaHVuayAhPT0gbnVsbCAmJiBjaHVuayAhPT0gdW5kZWZpbmVkKVxuICAgIHRoaXMud3JpdGUoY2h1bmssIGVuY29kaW5nKTtcblxuICAvLyAuZW5kKCkgZnVsbHkgdW5jb3Jrc1xuICBpZiAoc3RhdGUuY29ya2VkKSB7XG4gICAgc3RhdGUuY29ya2VkID0gMTtcbiAgICB0aGlzLnVuY29yaygpO1xuICB9XG5cbiAgLy8gaWdub3JlIHVubmVjZXNzYXJ5IGVuZCgpIGNhbGxzLlxuICBpZiAoIXN0YXRlLmVuZGluZyAmJiAhc3RhdGUuZmluaXNoZWQpXG4gICAgZW5kV3JpdGFibGUodGhpcywgc3RhdGUsIGNiKTtcbn07XG5cblxuZnVuY3Rpb24gbmVlZEZpbmlzaChzdGF0ZSkge1xuICByZXR1cm4gKHN0YXRlLmVuZGluZyAmJlxuICAgICAgICAgIHN0YXRlLmxlbmd0aCA9PT0gMCAmJlxuICAgICAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCA9PT0gbnVsbCAmJlxuICAgICAgICAgICFzdGF0ZS5maW5pc2hlZCAmJlxuICAgICAgICAgICFzdGF0ZS53cml0aW5nKTtcbn1cblxuZnVuY3Rpb24gcHJlZmluaXNoKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5wcmVmaW5pc2hlZCkge1xuICAgIHN0YXRlLnByZWZpbmlzaGVkID0gdHJ1ZTtcbiAgICBzdHJlYW0uZW1pdCgncHJlZmluaXNoJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSkge1xuICB2YXIgbmVlZCA9IG5lZWRGaW5pc2goc3RhdGUpO1xuICBpZiAobmVlZCkge1xuICAgIGlmIChzdGF0ZS5wZW5kaW5nY2IgPT09IDApIHtcbiAgICAgIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKTtcbiAgICAgIHN0YXRlLmZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgIHN0cmVhbS5lbWl0KCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJlZmluaXNoKHN0cmVhbSwgc3RhdGUpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbmVlZDtcbn1cblxuZnVuY3Rpb24gZW5kV3JpdGFibGUoc3RyZWFtLCBzdGF0ZSwgY2IpIHtcbiAgc3RhdGUuZW5kaW5nID0gdHJ1ZTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG4gIGlmIChjYikge1xuICAgIGlmIChzdGF0ZS5maW5pc2hlZClcbiAgICAgIHByb2Nlc3NOZXh0VGljayhjYik7XG4gICAgZWxzZVxuICAgICAgc3RyZWFtLm9uY2UoJ2ZpbmlzaCcsIGNiKTtcbiAgfVxuICBzdGF0ZS5lbmRlZCA9IHRydWU7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2xpYi9fc3RyZWFtX3Bhc3N0aHJvdWdoLmpzXCIpXG4iLCJ2YXIgU3RyZWFtID0gKGZ1bmN0aW9uICgpe1xuICB0cnkge1xuICAgIHJldHVybiByZXF1aXJlKCdzdCcgKyAncmVhbScpOyAvLyBoYWNrIHRvIGZpeCBhIGNpcmN1bGFyIGRlcGVuZGVuY3kgaXNzdWUgd2hlbiB1c2VkIHdpdGggYnJvd3NlcmlmeVxuICB9IGNhdGNoKF8pe31cbn0oKSk7XG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3JlYWRhYmxlLmpzJyk7XG5leHBvcnRzLlN0cmVhbSA9IFN0cmVhbSB8fCBleHBvcnRzO1xuZXhwb3J0cy5SZWFkYWJsZSA9IGV4cG9ydHM7XG5leHBvcnRzLldyaXRhYmxlID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV93cml0YWJsZS5qcycpO1xuZXhwb3J0cy5EdXBsZXggPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX2R1cGxleC5qcycpO1xuZXhwb3J0cy5UcmFuc2Zvcm0gPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3RyYW5zZm9ybS5qcycpO1xuZXhwb3J0cy5QYXNzVGhyb3VnaCA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fcGFzc3Rocm91Z2guanMnKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzXCIpXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2xpYi9fc3RyZWFtX3dyaXRhYmxlLmpzXCIpXG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxubW9kdWxlLmV4cG9ydHMgPSBTdHJlYW07XG5cbnZhciBFRSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG5cbmluaGVyaXRzKFN0cmVhbSwgRUUpO1xuU3RyZWFtLlJlYWRhYmxlID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3JlYWRhYmxlLmpzJyk7XG5TdHJlYW0uV3JpdGFibGUgPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vd3JpdGFibGUuanMnKTtcblN0cmVhbS5EdXBsZXggPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vZHVwbGV4LmpzJyk7XG5TdHJlYW0uVHJhbnNmb3JtID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3RyYW5zZm9ybS5qcycpO1xuU3RyZWFtLlBhc3NUaHJvdWdoID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3Bhc3N0aHJvdWdoLmpzJyk7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuNC54XG5TdHJlYW0uU3RyZWFtID0gU3RyZWFtO1xuXG5cblxuLy8gb2xkLXN0eWxlIHN0cmVhbXMuICBOb3RlIHRoYXQgdGhlIHBpcGUgbWV0aG9kICh0aGUgb25seSByZWxldmFudFxuLy8gcGFydCBvZiB0aGlzIGNsYXNzKSBpcyBvdmVycmlkZGVuIGluIHRoZSBSZWFkYWJsZSBjbGFzcy5cblxuZnVuY3Rpb24gU3RyZWFtKCkge1xuICBFRS5jYWxsKHRoaXMpO1xufVxuXG5TdHJlYW0ucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbihkZXN0LCBvcHRpb25zKSB7XG4gIHZhciBzb3VyY2UgPSB0aGlzO1xuXG4gIGZ1bmN0aW9uIG9uZGF0YShjaHVuaykge1xuICAgIGlmIChkZXN0LndyaXRhYmxlKSB7XG4gICAgICBpZiAoZmFsc2UgPT09IGRlc3Qud3JpdGUoY2h1bmspICYmIHNvdXJjZS5wYXVzZSkge1xuICAgICAgICBzb3VyY2UucGF1c2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzb3VyY2Uub24oJ2RhdGEnLCBvbmRhdGEpO1xuXG4gIGZ1bmN0aW9uIG9uZHJhaW4oKSB7XG4gICAgaWYgKHNvdXJjZS5yZWFkYWJsZSAmJiBzb3VyY2UucmVzdW1lKSB7XG4gICAgICBzb3VyY2UucmVzdW1lKCk7XG4gICAgfVxuICB9XG5cbiAgZGVzdC5vbignZHJhaW4nLCBvbmRyYWluKTtcblxuICAvLyBJZiB0aGUgJ2VuZCcgb3B0aW9uIGlzIG5vdCBzdXBwbGllZCwgZGVzdC5lbmQoKSB3aWxsIGJlIGNhbGxlZCB3aGVuXG4gIC8vIHNvdXJjZSBnZXRzIHRoZSAnZW5kJyBvciAnY2xvc2UnIGV2ZW50cy4gIE9ubHkgZGVzdC5lbmQoKSBvbmNlLlxuICBpZiAoIWRlc3QuX2lzU3RkaW8gJiYgKCFvcHRpb25zIHx8IG9wdGlvbnMuZW5kICE9PSBmYWxzZSkpIHtcbiAgICBzb3VyY2Uub24oJ2VuZCcsIG9uZW5kKTtcbiAgICBzb3VyY2Uub24oJ2Nsb3NlJywgb25jbG9zZSk7XG4gIH1cblxuICB2YXIgZGlkT25FbmQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gb25lbmQoKSB7XG4gICAgaWYgKGRpZE9uRW5kKSByZXR1cm47XG4gICAgZGlkT25FbmQgPSB0cnVlO1xuXG4gICAgZGVzdC5lbmQoKTtcbiAgfVxuXG5cbiAgZnVuY3Rpb24gb25jbG9zZSgpIHtcbiAgICBpZiAoZGlkT25FbmQpIHJldHVybjtcbiAgICBkaWRPbkVuZCA9IHRydWU7XG5cbiAgICBpZiAodHlwZW9mIGRlc3QuZGVzdHJveSA9PT0gJ2Z1bmN0aW9uJykgZGVzdC5kZXN0cm95KCk7XG4gIH1cblxuICAvLyBkb24ndCBsZWF2ZSBkYW5nbGluZyBwaXBlcyB3aGVuIHRoZXJlIGFyZSBlcnJvcnMuXG4gIGZ1bmN0aW9uIG9uZXJyb3IoZXIpIHtcbiAgICBjbGVhbnVwKCk7XG4gICAgaWYgKEVFLmxpc3RlbmVyQ291bnQodGhpcywgJ2Vycm9yJykgPT09IDApIHtcbiAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgc3RyZWFtIGVycm9yIGluIHBpcGUuXG4gICAgfVxuICB9XG5cbiAgc291cmNlLm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuICBkZXN0Lm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuXG4gIC8vIHJlbW92ZSBhbGwgdGhlIGV2ZW50IGxpc3RlbmVycyB0aGF0IHdlcmUgYWRkZWQuXG4gIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdkYXRhJywgb25kYXRhKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdkcmFpbicsIG9uZHJhaW4pO1xuXG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBvbmVuZCk7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIG9uY2xvc2UpO1xuXG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG5cbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIGNsZWFudXApO1xuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBjbGVhbnVwKTtcblxuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgY2xlYW51cCk7XG4gIH1cblxuICBzb3VyY2Uub24oJ2VuZCcsIGNsZWFudXApO1xuICBzb3VyY2Uub24oJ2Nsb3NlJywgY2xlYW51cCk7XG5cbiAgZGVzdC5vbignY2xvc2UnLCBjbGVhbnVwKTtcblxuICBkZXN0LmVtaXQoJ3BpcGUnLCBzb3VyY2UpO1xuXG4gIC8vIEFsbG93IGZvciB1bml4LWxpa2UgdXNhZ2U6IEEucGlwZShCKS5waXBlKEMpXG4gIHJldHVybiBkZXN0O1xufTtcbiIsInZhciBDbGllbnRSZXF1ZXN0ID0gcmVxdWlyZSgnLi9saWIvcmVxdWVzdCcpXG52YXIgZXh0ZW5kID0gcmVxdWlyZSgneHRlbmQnKVxudmFyIHN0YXR1c0NvZGVzID0gcmVxdWlyZSgnYnVpbHRpbi1zdGF0dXMtY29kZXMnKVxudmFyIHVybCA9IHJlcXVpcmUoJ3VybCcpXG5cbnZhciBodHRwID0gZXhwb3J0c1xuXG5odHRwLnJlcXVlc3QgPSBmdW5jdGlvbiAob3B0cywgY2IpIHtcblx0aWYgKHR5cGVvZiBvcHRzID09PSAnc3RyaW5nJylcblx0XHRvcHRzID0gdXJsLnBhcnNlKG9wdHMpXG5cdGVsc2Vcblx0XHRvcHRzID0gZXh0ZW5kKG9wdHMpXG5cblx0dmFyIHByb3RvY29sID0gb3B0cy5wcm90b2NvbCB8fCAnJ1xuXHR2YXIgaG9zdCA9IG9wdHMuaG9zdG5hbWUgfHwgb3B0cy5ob3N0XG5cdHZhciBwb3J0ID0gb3B0cy5wb3J0XG5cdHZhciBwYXRoID0gb3B0cy5wYXRoIHx8ICcvJ1xuXG5cdC8vIE5lY2Vzc2FyeSBmb3IgSVB2NiBhZGRyZXNzZXNcblx0aWYgKGhvc3QgJiYgaG9zdC5pbmRleE9mKCc6JykgIT09IC0xKVxuXHRcdGhvc3QgPSAnWycgKyBob3N0ICsgJ10nXG5cblx0Ly8gVGhpcyBtYXkgYmUgYSByZWxhdGl2ZSB1cmwuIFRoZSBicm93c2VyIHNob3VsZCBhbHdheXMgYmUgYWJsZSB0byBpbnRlcnByZXQgaXQgY29ycmVjdGx5LlxuXHRvcHRzLnVybCA9IChob3N0ID8gKHByb3RvY29sICsgJy8vJyArIGhvc3QpIDogJycpICsgKHBvcnQgPyAnOicgKyBwb3J0IDogJycpICsgcGF0aFxuXHRvcHRzLm1ldGhvZCA9IChvcHRzLm1ldGhvZCB8fCAnR0VUJykudG9VcHBlckNhc2UoKVxuXHRvcHRzLmhlYWRlcnMgPSBvcHRzLmhlYWRlcnMgfHwge31cblxuXHQvLyBBbHNvIHZhbGlkIG9wdHMuYXV0aCwgb3B0cy5tb2RlXG5cblx0dmFyIHJlcSA9IG5ldyBDbGllbnRSZXF1ZXN0KG9wdHMpXG5cdGlmIChjYilcblx0XHRyZXEub24oJ3Jlc3BvbnNlJywgY2IpXG5cdHJldHVybiByZXFcbn1cblxuaHR0cC5nZXQgPSBmdW5jdGlvbiBnZXQgKG9wdHMsIGNiKSB7XG5cdHZhciByZXEgPSBodHRwLnJlcXVlc3Qob3B0cywgY2IpXG5cdHJlcS5lbmQoKVxuXHRyZXR1cm4gcmVxXG59XG5cbmh0dHAuQWdlbnQgPSBmdW5jdGlvbiAoKSB7fVxuaHR0cC5BZ2VudC5kZWZhdWx0TWF4U29ja2V0cyA9IDRcblxuaHR0cC5TVEFUVVNfQ09ERVMgPSBzdGF0dXNDb2Rlc1xuXG5odHRwLk1FVEhPRFMgPSBbXG5cdCdDSEVDS09VVCcsXG5cdCdDT05ORUNUJyxcblx0J0NPUFknLFxuXHQnREVMRVRFJyxcblx0J0dFVCcsXG5cdCdIRUFEJyxcblx0J0xPQ0snLFxuXHQnTS1TRUFSQ0gnLFxuXHQnTUVSR0UnLFxuXHQnTUtBQ1RJVklUWScsXG5cdCdNS0NPTCcsXG5cdCdNT1ZFJyxcblx0J05PVElGWScsXG5cdCdPUFRJT05TJyxcblx0J1BBVENIJyxcblx0J1BPU1QnLFxuXHQnUFJPUEZJTkQnLFxuXHQnUFJPUFBBVENIJyxcblx0J1BVUkdFJyxcblx0J1BVVCcsXG5cdCdSRVBPUlQnLFxuXHQnU0VBUkNIJyxcblx0J1NVQlNDUklCRScsXG5cdCdUUkFDRScsXG5cdCdVTkxPQ0snLFxuXHQnVU5TVUJTQ1JJQkUnXG5dIiwiZXhwb3J0cy5mZXRjaCA9IGlzRnVuY3Rpb24oZ2xvYmFsLmZldGNoKSAmJiBpc0Z1bmN0aW9uKGdsb2JhbC5SZWFkYWJsZUJ5dGVTdHJlYW0pXG5cbmV4cG9ydHMuYmxvYkNvbnN0cnVjdG9yID0gZmFsc2VcbnRyeSB7XG5cdG5ldyBCbG9iKFtuZXcgQXJyYXlCdWZmZXIoMSldKVxuXHRleHBvcnRzLmJsb2JDb25zdHJ1Y3RvciA9IHRydWVcbn0gY2F0Y2ggKGUpIHt9XG5cbnZhciB4aHIgPSBuZXcgZ2xvYmFsLlhNTEh0dHBSZXF1ZXN0KClcbi8vIElmIGxvY2F0aW9uLmhvc3QgaXMgZW1wdHksIGUuZy4gaWYgdGhpcyBwYWdlL3dvcmtlciB3YXMgbG9hZGVkXG4vLyBmcm9tIGEgQmxvYiwgdGhlbiB1c2UgZXhhbXBsZS5jb20gdG8gYXZvaWQgYW4gZXJyb3Jcbnhoci5vcGVuKCdHRVQnLCBnbG9iYWwubG9jYXRpb24uaG9zdCA/ICcvJyA6ICdodHRwczovL2V4YW1wbGUuY29tJylcblxuZnVuY3Rpb24gY2hlY2tUeXBlU3VwcG9ydCAodHlwZSkge1xuXHR0cnkge1xuXHRcdHhoci5yZXNwb25zZVR5cGUgPSB0eXBlXG5cdFx0cmV0dXJuIHhoci5yZXNwb25zZVR5cGUgPT09IHR5cGVcblx0fSBjYXRjaCAoZSkge31cblx0cmV0dXJuIGZhbHNlXG59XG5cbi8vIEZvciBzb21lIHN0cmFuZ2UgcmVhc29uLCBTYWZhcmkgNy4wIHJlcG9ydHMgdHlwZW9mIGdsb2JhbC5BcnJheUJ1ZmZlciA9PT0gJ29iamVjdCcuXG4vLyBTYWZhcmkgNy4xIGFwcGVhcnMgdG8gaGF2ZSBmaXhlZCB0aGlzIGJ1Zy5cbnZhciBoYXZlQXJyYXlCdWZmZXIgPSB0eXBlb2YgZ2xvYmFsLkFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJ1xudmFyIGhhdmVTbGljZSA9IGhhdmVBcnJheUJ1ZmZlciAmJiBpc0Z1bmN0aW9uKGdsb2JhbC5BcnJheUJ1ZmZlci5wcm90b3R5cGUuc2xpY2UpXG5cbmV4cG9ydHMuYXJyYXlidWZmZXIgPSBoYXZlQXJyYXlCdWZmZXIgJiYgY2hlY2tUeXBlU3VwcG9ydCgnYXJyYXlidWZmZXInKVxuLy8gVGhlc2UgbmV4dCB0d28gdGVzdHMgdW5hdm9pZGFibHkgc2hvdyB3YXJuaW5ncyBpbiBDaHJvbWUuIFNpbmNlIGZldGNoIHdpbGwgYWx3YXlzXG4vLyBiZSB1c2VkIGlmIGl0J3MgYXZhaWxhYmxlLCBqdXN0IHJldHVybiBmYWxzZSBmb3IgdGhlc2UgdG8gYXZvaWQgdGhlIHdhcm5pbmdzLlxuZXhwb3J0cy5tc3N0cmVhbSA9ICFleHBvcnRzLmZldGNoICYmIGhhdmVTbGljZSAmJiBjaGVja1R5cGVTdXBwb3J0KCdtcy1zdHJlYW0nKVxuZXhwb3J0cy5tb3pjaHVua2VkYXJyYXlidWZmZXIgPSAhZXhwb3J0cy5mZXRjaCAmJiBoYXZlQXJyYXlCdWZmZXIgJiZcblx0Y2hlY2tUeXBlU3VwcG9ydCgnbW96LWNodW5rZWQtYXJyYXlidWZmZXInKVxuZXhwb3J0cy5vdmVycmlkZU1pbWVUeXBlID0gaXNGdW5jdGlvbih4aHIub3ZlcnJpZGVNaW1lVHlwZSlcbmV4cG9ydHMudmJBcnJheSA9IGlzRnVuY3Rpb24oZ2xvYmFsLlZCQXJyYXkpXG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbidcbn1cblxueGhyID0gbnVsbCAvLyBIZWxwIGdjXG4iLCIvLyB2YXIgQmFzZTY0ID0gcmVxdWlyZSgnQmFzZTY0JylcbnZhciBjYXBhYmlsaXR5ID0gcmVxdWlyZSgnLi9jYXBhYmlsaXR5JylcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJylcbnZhciByZXNwb25zZSA9IHJlcXVpcmUoJy4vcmVzcG9uc2UnKVxudmFyIHN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpXG5cbnZhciBJbmNvbWluZ01lc3NhZ2UgPSByZXNwb25zZS5JbmNvbWluZ01lc3NhZ2VcbnZhciByU3RhdGVzID0gcmVzcG9uc2UucmVhZHlTdGF0ZXNcblxuZnVuY3Rpb24gZGVjaWRlTW9kZSAocHJlZmVyQmluYXJ5KSB7XG5cdGlmIChjYXBhYmlsaXR5LmZldGNoKSB7XG5cdFx0cmV0dXJuICdmZXRjaCdcblx0fSBlbHNlIGlmIChjYXBhYmlsaXR5Lm1vemNodW5rZWRhcnJheWJ1ZmZlcikge1xuXHRcdHJldHVybiAnbW96LWNodW5rZWQtYXJyYXlidWZmZXInXG5cdH0gZWxzZSBpZiAoY2FwYWJpbGl0eS5tc3N0cmVhbSkge1xuXHRcdHJldHVybiAnbXMtc3RyZWFtJ1xuXHR9IGVsc2UgaWYgKGNhcGFiaWxpdHkuYXJyYXlidWZmZXIgJiYgcHJlZmVyQmluYXJ5KSB7XG5cdFx0cmV0dXJuICdhcnJheWJ1ZmZlcidcblx0fSBlbHNlIGlmIChjYXBhYmlsaXR5LnZiQXJyYXkgJiYgcHJlZmVyQmluYXJ5KSB7XG5cdFx0cmV0dXJuICd0ZXh0OnZiYXJyYXknXG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuICd0ZXh0J1xuXHR9XG59XG5cbnZhciBDbGllbnRSZXF1ZXN0ID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob3B0cykge1xuXHR2YXIgc2VsZiA9IHRoaXNcblx0c3RyZWFtLldyaXRhYmxlLmNhbGwoc2VsZilcblxuXHRzZWxmLl9vcHRzID0gb3B0c1xuXHRzZWxmLl9ib2R5ID0gW11cblx0c2VsZi5faGVhZGVycyA9IHt9XG5cdGlmIChvcHRzLmF1dGgpXG5cdFx0c2VsZi5zZXRIZWFkZXIoJ0F1dGhvcml6YXRpb24nLCAnQmFzaWMgJyArIG5ldyBCdWZmZXIob3B0cy5hdXRoKS50b1N0cmluZygnYmFzZTY0JykpXG5cdE9iamVjdC5rZXlzKG9wdHMuaGVhZGVycykuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuXHRcdHNlbGYuc2V0SGVhZGVyKG5hbWUsIG9wdHMuaGVhZGVyc1tuYW1lXSlcblx0fSlcblxuXHR2YXIgcHJlZmVyQmluYXJ5XG5cdGlmIChvcHRzLm1vZGUgPT09ICdwcmVmZXItc3RyZWFtaW5nJykge1xuXHRcdC8vIElmIHN0cmVhbWluZyBpcyBhIGhpZ2ggcHJpb3JpdHkgYnV0IGJpbmFyeSBjb21wYXRpYmlsaXR5IGFuZFxuXHRcdC8vIHRoZSBhY2N1cmFjeSBvZiB0aGUgJ2NvbnRlbnQtdHlwZScgaGVhZGVyIGFyZW4ndFxuXHRcdHByZWZlckJpbmFyeSA9IGZhbHNlXG5cdH0gZWxzZSBpZiAob3B0cy5tb2RlID09PSAnYWxsb3ctd3JvbmctY29udGVudC10eXBlJykge1xuXHRcdC8vIElmIHN0cmVhbWluZyBpcyBtb3JlIGltcG9ydGFudCB0aGFuIHByZXNlcnZpbmcgdGhlICdjb250ZW50LXR5cGUnIGhlYWRlclxuXHRcdHByZWZlckJpbmFyeSA9ICFjYXBhYmlsaXR5Lm92ZXJyaWRlTWltZVR5cGVcblx0fSBlbHNlIGlmICghb3B0cy5tb2RlIHx8IG9wdHMubW9kZSA9PT0gJ2RlZmF1bHQnIHx8IG9wdHMubW9kZSA9PT0gJ3ByZWZlci1mYXN0Jykge1xuXHRcdC8vIFVzZSBiaW5hcnkgaWYgdGV4dCBzdHJlYW1pbmcgbWF5IGNvcnJ1cHQgZGF0YSBvciB0aGUgY29udGVudC10eXBlIGhlYWRlciwgb3IgZm9yIHNwZWVkXG5cdFx0cHJlZmVyQmluYXJ5ID0gdHJ1ZVxuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCB2YWx1ZSBmb3Igb3B0cy5tb2RlJylcblx0fVxuXHRzZWxmLl9tb2RlID0gZGVjaWRlTW9kZShwcmVmZXJCaW5hcnkpXG5cblx0c2VsZi5vbignZmluaXNoJywgZnVuY3Rpb24gKCkge1xuXHRcdHNlbGYuX29uRmluaXNoKClcblx0fSlcbn1cblxuaW5oZXJpdHMoQ2xpZW50UmVxdWVzdCwgc3RyZWFtLldyaXRhYmxlKVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5zZXRIZWFkZXIgPSBmdW5jdGlvbiAobmFtZSwgdmFsdWUpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cdHZhciBsb3dlck5hbWUgPSBuYW1lLnRvTG93ZXJDYXNlKClcblx0Ly8gVGhpcyBjaGVjayBpcyBub3QgbmVjZXNzYXJ5LCBidXQgaXQgcHJldmVudHMgd2FybmluZ3MgZnJvbSBicm93c2VycyBhYm91dCBzZXR0aW5nIHVuc2FmZVxuXHQvLyBoZWFkZXJzLiBUbyBiZSBob25lc3QgSSdtIG5vdCBlbnRpcmVseSBzdXJlIGhpZGluZyB0aGVzZSB3YXJuaW5ncyBpcyBhIGdvb2QgdGhpbmcsIGJ1dFxuXHQvLyBodHRwLWJyb3dzZXJpZnkgZGlkIGl0LCBzbyBJIHdpbGwgdG9vLlxuXHRpZiAodW5zYWZlSGVhZGVycy5pbmRleE9mKGxvd2VyTmFtZSkgIT09IC0xKVxuXHRcdHJldHVyblxuXG5cdHNlbGYuX2hlYWRlcnNbbG93ZXJOYW1lXSA9IHtcblx0XHRuYW1lOiBuYW1lLFxuXHRcdHZhbHVlOiB2YWx1ZVxuXHR9XG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLmdldEhlYWRlciA9IGZ1bmN0aW9uIChuYW1lKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXHRyZXR1cm4gc2VsZi5faGVhZGVyc1tuYW1lLnRvTG93ZXJDYXNlKCldLnZhbHVlXG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLnJlbW92ZUhlYWRlciA9IGZ1bmN0aW9uIChuYW1lKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXHRkZWxldGUgc2VsZi5faGVhZGVyc1tuYW1lLnRvTG93ZXJDYXNlKCldXG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLl9vbkZpbmlzaCA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cblx0aWYgKHNlbGYuX2Rlc3Ryb3llZClcblx0XHRyZXR1cm5cblx0dmFyIG9wdHMgPSBzZWxmLl9vcHRzXG5cblx0dmFyIGhlYWRlcnNPYmogPSBzZWxmLl9oZWFkZXJzXG5cdHZhciBib2R5XG5cdGlmIChvcHRzLm1ldGhvZCA9PT0gJ1BPU1QnIHx8IG9wdHMubWV0aG9kID09PSAnUFVUJyB8fCBvcHRzLm1ldGhvZCA9PT0gJ1BBVENIJykge1xuXHRcdGlmIChjYXBhYmlsaXR5LmJsb2JDb25zdHJ1Y3Rvcikge1xuXHRcdFx0Ym9keSA9IG5ldyBnbG9iYWwuQmxvYihzZWxmLl9ib2R5Lm1hcChmdW5jdGlvbiAoYnVmZmVyKSB7XG5cdFx0XHRcdHJldHVybiBidWZmZXIudG9BcnJheUJ1ZmZlcigpXG5cdFx0XHR9KSwge1xuXHRcdFx0XHR0eXBlOiAoaGVhZGVyc09ialsnY29udGVudC10eXBlJ10gfHwge30pLnZhbHVlIHx8ICcnXG5cdFx0XHR9KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBnZXQgdXRmOCBzdHJpbmdcblx0XHRcdGJvZHkgPSBCdWZmZXIuY29uY2F0KHNlbGYuX2JvZHkpLnRvU3RyaW5nKClcblx0XHR9XG5cdH1cblxuXHRpZiAoc2VsZi5fbW9kZSA9PT0gJ2ZldGNoJykge1xuXHRcdHZhciBoZWFkZXJzID0gT2JqZWN0LmtleXMoaGVhZGVyc09iaikubWFwKGZ1bmN0aW9uIChuYW1lKSB7XG5cdFx0XHRyZXR1cm4gW2hlYWRlcnNPYmpbbmFtZV0ubmFtZSwgaGVhZGVyc09ialtuYW1lXS52YWx1ZV1cblx0XHR9KVxuXG5cdFx0Z2xvYmFsLmZldGNoKHNlbGYuX29wdHMudXJsLCB7XG5cdFx0XHRtZXRob2Q6IHNlbGYuX29wdHMubWV0aG9kLFxuXHRcdFx0aGVhZGVyczogaGVhZGVycyxcblx0XHRcdGJvZHk6IGJvZHksXG5cdFx0XHRtb2RlOiAnY29ycycsXG5cdFx0XHRjcmVkZW50aWFsczogb3B0cy53aXRoQ3JlZGVudGlhbHMgPyAnaW5jbHVkZScgOiAnc2FtZS1vcmlnaW4nXG5cdFx0fSkudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcblx0XHRcdHNlbGYuX2ZldGNoUmVzcG9uc2UgPSByZXNwb25zZVxuXHRcdFx0c2VsZi5fY29ubmVjdCgpXG5cdFx0fSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHRcdFx0c2VsZi5lbWl0KCdlcnJvcicsIHJlYXNvbilcblx0XHR9KVxuXHR9IGVsc2Uge1xuXHRcdHZhciB4aHIgPSBzZWxmLl94aHIgPSBuZXcgZ2xvYmFsLlhNTEh0dHBSZXF1ZXN0KClcblx0XHR0cnkge1xuXHRcdFx0eGhyLm9wZW4oc2VsZi5fb3B0cy5tZXRob2QsIHNlbGYuX29wdHMudXJsLCB0cnVlKVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0cHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNlbGYuZW1pdCgnZXJyb3InLCBlcnIpXG5cdFx0XHR9KVxuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXG5cdFx0Ly8gQ2FuJ3Qgc2V0IHJlc3BvbnNlVHlwZSBvbiByZWFsbHkgb2xkIGJyb3dzZXJzXG5cdFx0aWYgKCdyZXNwb25zZVR5cGUnIGluIHhocilcblx0XHRcdHhoci5yZXNwb25zZVR5cGUgPSBzZWxmLl9tb2RlLnNwbGl0KCc6JylbMF1cblxuXHRcdGlmICgnd2l0aENyZWRlbnRpYWxzJyBpbiB4aHIpXG5cdFx0XHR4aHIud2l0aENyZWRlbnRpYWxzID0gISFvcHRzLndpdGhDcmVkZW50aWFsc1xuXG5cdFx0aWYgKHNlbGYuX21vZGUgPT09ICd0ZXh0JyAmJiAnb3ZlcnJpZGVNaW1lVHlwZScgaW4geGhyKVxuXHRcdFx0eGhyLm92ZXJyaWRlTWltZVR5cGUoJ3RleHQvcGxhaW47IGNoYXJzZXQ9eC11c2VyLWRlZmluZWQnKVxuXG5cdFx0T2JqZWN0LmtleXMoaGVhZGVyc09iaikuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuXHRcdFx0eGhyLnNldFJlcXVlc3RIZWFkZXIoaGVhZGVyc09ialtuYW1lXS5uYW1lLCBoZWFkZXJzT2JqW25hbWVdLnZhbHVlKVxuXHRcdH0pXG5cblx0XHRzZWxmLl9yZXNwb25zZSA9IG51bGxcblx0XHR4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0c3dpdGNoICh4aHIucmVhZHlTdGF0ZSkge1xuXHRcdFx0XHRjYXNlIHJTdGF0ZXMuTE9BRElORzpcblx0XHRcdFx0Y2FzZSByU3RhdGVzLkRPTkU6XG5cdFx0XHRcdFx0c2VsZi5fb25YSFJQcm9ncmVzcygpXG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gTmVjZXNzYXJ5IGZvciBzdHJlYW1pbmcgaW4gRmlyZWZveCwgc2luY2UgeGhyLnJlc3BvbnNlIGlzIE9OTFkgZGVmaW5lZFxuXHRcdC8vIGluIG9ucHJvZ3Jlc3MsIG5vdCBpbiBvbnJlYWR5c3RhdGVjaGFuZ2Ugd2l0aCB4aHIucmVhZHlTdGF0ZSA9IDNcblx0XHRpZiAoc2VsZi5fbW9kZSA9PT0gJ21vei1jaHVua2VkLWFycmF5YnVmZmVyJykge1xuXHRcdFx0eGhyLm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNlbGYuX29uWEhSUHJvZ3Jlc3MoKVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHhoci5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKHNlbGYuX2Rlc3Ryb3llZClcblx0XHRcdFx0cmV0dXJuXG5cdFx0XHRzZWxmLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdYSFIgZXJyb3InKSlcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0eGhyLnNlbmQoYm9keSlcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRzZWxmLmVtaXQoJ2Vycm9yJywgZXJyKVxuXHRcdFx0fSlcblx0XHRcdHJldHVyblxuXHRcdH1cblx0fVxufVxuXG4vKipcbiAqIENoZWNrcyBpZiB4aHIuc3RhdHVzIGlzIHJlYWRhYmxlLiBFdmVuIHRob3VnaCB0aGUgc3BlYyBzYXlzIGl0IHNob3VsZFxuICogYmUgYXZhaWxhYmxlIGluIHJlYWR5U3RhdGUgMywgYWNjZXNzaW5nIGl0IHRocm93cyBhbiBleGNlcHRpb24gaW4gSUU4XG4gKi9cbmZ1bmN0aW9uIHN0YXR1c1ZhbGlkICh4aHIpIHtcblx0dHJ5IHtcblx0XHRyZXR1cm4gKHhoci5zdGF0dXMgIT09IG51bGwpXG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRyZXR1cm4gZmFsc2Vcblx0fVxufVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5fb25YSFJQcm9ncmVzcyA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cblx0aWYgKCFzdGF0dXNWYWxpZChzZWxmLl94aHIpIHx8IHNlbGYuX2Rlc3Ryb3llZClcblx0XHRyZXR1cm5cblxuXHRpZiAoIXNlbGYuX3Jlc3BvbnNlKVxuXHRcdHNlbGYuX2Nvbm5lY3QoKVxuXG5cdHNlbGYuX3Jlc3BvbnNlLl9vblhIUlByb2dyZXNzKClcbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuX2Nvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXG5cdGlmIChzZWxmLl9kZXN0cm95ZWQpXG5cdFx0cmV0dXJuXG5cblx0c2VsZi5fcmVzcG9uc2UgPSBuZXcgSW5jb21pbmdNZXNzYWdlKHNlbGYuX3hociwgc2VsZi5fZmV0Y2hSZXNwb25zZSwgc2VsZi5fbW9kZSlcblx0c2VsZi5lbWl0KCdyZXNwb25zZScsIHNlbGYuX3Jlc3BvbnNlKVxufVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5fd3JpdGUgPSBmdW5jdGlvbiAoY2h1bmssIGVuY29kaW5nLCBjYikge1xuXHR2YXIgc2VsZiA9IHRoaXNcblxuXHRzZWxmLl9ib2R5LnB1c2goY2h1bmspXG5cdGNiKClcbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuYWJvcnQgPSBDbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblx0c2VsZi5fZGVzdHJveWVkID0gdHJ1ZVxuXHRpZiAoc2VsZi5fcmVzcG9uc2UpXG5cdFx0c2VsZi5fcmVzcG9uc2UuX2Rlc3Ryb3llZCA9IHRydWVcblx0aWYgKHNlbGYuX3hocilcblx0XHRzZWxmLl94aHIuYWJvcnQoKVxuXHQvLyBDdXJyZW50bHksIHRoZXJlIGlzbid0IGEgd2F5IHRvIHRydWx5IGFib3J0IGEgZmV0Y2guXG5cdC8vIElmIHlvdSBsaWtlIGJpa2VzaGVkZGluZywgc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS93aGF0d2cvZmV0Y2gvaXNzdWVzLzI3XG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uIChkYXRhLCBlbmNvZGluZywgY2IpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cdGlmICh0eXBlb2YgZGF0YSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdGNiID0gZGF0YVxuXHRcdGRhdGEgPSB1bmRlZmluZWRcblx0fVxuXG5cdHN0cmVhbS5Xcml0YWJsZS5wcm90b3R5cGUuZW5kLmNhbGwoc2VsZiwgZGF0YSwgZW5jb2RpbmcsIGNiKVxufVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5mbHVzaEhlYWRlcnMgPSBmdW5jdGlvbiAoKSB7fVxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuc2V0VGltZW91dCA9IGZ1bmN0aW9uICgpIHt9XG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5zZXROb0RlbGF5ID0gZnVuY3Rpb24gKCkge31cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLnNldFNvY2tldEtlZXBBbGl2ZSA9IGZ1bmN0aW9uICgpIHt9XG5cbi8vIFRha2VuIGZyb20gaHR0cDovL3d3dy53My5vcmcvVFIvWE1MSHR0cFJlcXVlc3QvI3RoZS1zZXRyZXF1ZXN0aGVhZGVyJTI4JTI5LW1ldGhvZFxudmFyIHVuc2FmZUhlYWRlcnMgPSBbXG5cdCdhY2NlcHQtY2hhcnNldCcsXG5cdCdhY2NlcHQtZW5jb2RpbmcnLFxuXHQnYWNjZXNzLWNvbnRyb2wtcmVxdWVzdC1oZWFkZXJzJyxcblx0J2FjY2Vzcy1jb250cm9sLXJlcXVlc3QtbWV0aG9kJyxcblx0J2Nvbm5lY3Rpb24nLFxuXHQnY29udGVudC1sZW5ndGgnLFxuXHQnY29va2llJyxcblx0J2Nvb2tpZTInLFxuXHQnZGF0ZScsXG5cdCdkbnQnLFxuXHQnZXhwZWN0Jyxcblx0J2hvc3QnLFxuXHQna2VlcC1hbGl2ZScsXG5cdCdvcmlnaW4nLFxuXHQncmVmZXJlcicsXG5cdCd0ZScsXG5cdCd0cmFpbGVyJyxcblx0J3RyYW5zZmVyLWVuY29kaW5nJyxcblx0J3VwZ3JhZGUnLFxuXHQndXNlci1hZ2VudCcsXG5cdCd2aWEnXG5dXG4iLCJ2YXIgY2FwYWJpbGl0eSA9IHJlcXVpcmUoJy4vY2FwYWJpbGl0eScpXG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpXG52YXIgc3RyZWFtID0gcmVxdWlyZSgnc3RyZWFtJylcblxudmFyIHJTdGF0ZXMgPSBleHBvcnRzLnJlYWR5U3RhdGVzID0ge1xuXHRVTlNFTlQ6IDAsXG5cdE9QRU5FRDogMSxcblx0SEVBREVSU19SRUNFSVZFRDogMixcblx0TE9BRElORzogMyxcblx0RE9ORTogNFxufVxuXG52YXIgSW5jb21pbmdNZXNzYWdlID0gZXhwb3J0cy5JbmNvbWluZ01lc3NhZ2UgPSBmdW5jdGlvbiAoeGhyLCByZXNwb25zZSwgbW9kZSkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblx0c3RyZWFtLlJlYWRhYmxlLmNhbGwoc2VsZilcblxuXHRzZWxmLl9tb2RlID0gbW9kZVxuXHRzZWxmLmhlYWRlcnMgPSB7fVxuXHRzZWxmLnJhd0hlYWRlcnMgPSBbXVxuXHRzZWxmLnRyYWlsZXJzID0ge31cblx0c2VsZi5yYXdUcmFpbGVycyA9IFtdXG5cblx0Ly8gRmFrZSB0aGUgJ2Nsb3NlJyBldmVudCwgYnV0IG9ubHkgb25jZSAnZW5kJyBmaXJlc1xuXHRzZWxmLm9uKCdlbmQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Ly8gVGhlIG5leHRUaWNrIGlzIG5lY2Vzc2FyeSB0byBwcmV2ZW50IHRoZSAncmVxdWVzdCcgbW9kdWxlIGZyb20gY2F1c2luZyBhbiBpbmZpbml0ZSBsb29wXG5cdFx0cHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG5cdFx0XHRzZWxmLmVtaXQoJ2Nsb3NlJylcblx0XHR9KVxuXHR9KVxuXG5cdGlmIChtb2RlID09PSAnZmV0Y2gnKSB7XG5cdFx0c2VsZi5fZmV0Y2hSZXNwb25zZSA9IHJlc3BvbnNlXG5cblx0XHRzZWxmLnN0YXR1c0NvZGUgPSByZXNwb25zZS5zdGF0dXNcblx0XHRzZWxmLnN0YXR1c01lc3NhZ2UgPSByZXNwb25zZS5zdGF0dXNUZXh0XG5cdFx0Ly8gYmFja3dhcmRzIGNvbXBhdGlibGUgdmVyc2lvbiBvZiBmb3IgKDxpdGVtPiBvZiA8aXRlcmFibGU+KTpcblx0XHQvLyBmb3IgKHZhciA8aXRlbT4sX2ksX2l0ID0gPGl0ZXJhYmxlPltTeW1ib2wuaXRlcmF0b3JdKCk7IDxpdGVtPiA9IChfaSA9IF9pdC5uZXh0KCkpLnZhbHVlLCFfaS5kb25lOylcblx0XHRmb3IgKHZhciBoZWFkZXIsIF9pLCBfaXQgPSByZXNwb25zZS5oZWFkZXJzW1N5bWJvbC5pdGVyYXRvcl0oKTsgaGVhZGVyID0gKF9pID0gX2l0Lm5leHQoKSkudmFsdWUsICFfaS5kb25lOykge1xuXHRcdFx0c2VsZi5oZWFkZXJzW2hlYWRlclswXS50b0xvd2VyQ2FzZSgpXSA9IGhlYWRlclsxXVxuXHRcdFx0c2VsZi5yYXdIZWFkZXJzLnB1c2goaGVhZGVyWzBdLCBoZWFkZXJbMV0pXG5cdFx0fVxuXG5cdFx0Ly8gVE9ETzogdGhpcyBkb2Vzbid0IHJlc3BlY3QgYmFja3ByZXNzdXJlLiBPbmNlIFdyaXRhYmxlU3RyZWFtIGlzIGF2YWlsYWJsZSwgdGhpcyBjYW4gYmUgZml4ZWRcblx0XHR2YXIgcmVhZGVyID0gcmVzcG9uc2UuYm9keS5nZXRSZWFkZXIoKVxuXHRcdGZ1bmN0aW9uIHJlYWQgKCkge1xuXHRcdFx0cmVhZGVyLnJlYWQoKS50aGVuKGZ1bmN0aW9uIChyZXN1bHQpIHtcblx0XHRcdFx0aWYgKHNlbGYuX2Rlc3Ryb3llZClcblx0XHRcdFx0XHRyZXR1cm5cblx0XHRcdFx0aWYgKHJlc3VsdC5kb25lKSB7XG5cdFx0XHRcdFx0c2VsZi5wdXNoKG51bGwpXG5cdFx0XHRcdFx0cmV0dXJuXG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5wdXNoKG5ldyBCdWZmZXIocmVzdWx0LnZhbHVlKSlcblx0XHRcdFx0cmVhZCgpXG5cdFx0XHR9KVxuXHRcdH1cblx0XHRyZWFkKClcblxuXHR9IGVsc2Uge1xuXHRcdHNlbGYuX3hociA9IHhoclxuXHRcdHNlbGYuX3BvcyA9IDBcblxuXHRcdHNlbGYuc3RhdHVzQ29kZSA9IHhoci5zdGF0dXNcblx0XHRzZWxmLnN0YXR1c01lc3NhZ2UgPSB4aHIuc3RhdHVzVGV4dFxuXHRcdHZhciBoZWFkZXJzID0geGhyLmdldEFsbFJlc3BvbnNlSGVhZGVycygpLnNwbGl0KC9cXHI/XFxuLylcblx0XHRoZWFkZXJzLmZvckVhY2goZnVuY3Rpb24gKGhlYWRlcikge1xuXHRcdFx0dmFyIG1hdGNoZXMgPSBoZWFkZXIubWF0Y2goL14oW146XSspOlxccyooLiopLylcblx0XHRcdGlmIChtYXRjaGVzKSB7XG5cdFx0XHRcdHZhciBrZXkgPSBtYXRjaGVzWzFdLnRvTG93ZXJDYXNlKClcblx0XHRcdFx0aWYgKHNlbGYuaGVhZGVyc1trZXldICE9PSB1bmRlZmluZWQpXG5cdFx0XHRcdFx0c2VsZi5oZWFkZXJzW2tleV0gKz0gJywgJyArIG1hdGNoZXNbMl1cblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdHNlbGYuaGVhZGVyc1trZXldID0gbWF0Y2hlc1syXVxuXHRcdFx0XHRzZWxmLnJhd0hlYWRlcnMucHVzaChtYXRjaGVzWzFdLCBtYXRjaGVzWzJdKVxuXHRcdFx0fVxuXHRcdH0pXG5cblx0XHRzZWxmLl9jaGFyc2V0ID0gJ3gtdXNlci1kZWZpbmVkJ1xuXHRcdGlmICghY2FwYWJpbGl0eS5vdmVycmlkZU1pbWVUeXBlKSB7XG5cdFx0XHR2YXIgbWltZVR5cGUgPSBzZWxmLnJhd0hlYWRlcnNbJ21pbWUtdHlwZSddXG5cdFx0XHRpZiAobWltZVR5cGUpIHtcblx0XHRcdFx0dmFyIGNoYXJzZXRNYXRjaCA9IG1pbWVUeXBlLm1hdGNoKC87XFxzKmNoYXJzZXQ9KFteO10pKDt8JCkvKVxuXHRcdFx0XHRpZiAoY2hhcnNldE1hdGNoKSB7XG5cdFx0XHRcdFx0c2VsZi5fY2hhcnNldCA9IGNoYXJzZXRNYXRjaFsxXS50b0xvd2VyQ2FzZSgpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghc2VsZi5fY2hhcnNldClcblx0XHRcdFx0c2VsZi5fY2hhcnNldCA9ICd1dGYtOCcgLy8gYmVzdCBndWVzc1xuXHRcdH1cblx0fVxufVxuXG5pbmhlcml0cyhJbmNvbWluZ01lc3NhZ2UsIHN0cmVhbS5SZWFkYWJsZSlcblxuSW5jb21pbmdNZXNzYWdlLnByb3RvdHlwZS5fcmVhZCA9IGZ1bmN0aW9uICgpIHt9XG5cbkluY29taW5nTWVzc2FnZS5wcm90b3R5cGUuX29uWEhSUHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXG5cdHZhciB4aHIgPSBzZWxmLl94aHJcblxuXHR2YXIgcmVzcG9uc2UgPSBudWxsXG5cdHN3aXRjaCAoc2VsZi5fbW9kZSkge1xuXHRcdGNhc2UgJ3RleHQ6dmJhcnJheSc6IC8vIEZvciBJRTlcblx0XHRcdGlmICh4aHIucmVhZHlTdGF0ZSAhPT0gclN0YXRlcy5ET05FKVxuXHRcdFx0XHRicmVha1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Ly8gVGhpcyBmYWlscyBpbiBJRThcblx0XHRcdFx0cmVzcG9uc2UgPSBuZXcgZ2xvYmFsLlZCQXJyYXkoeGhyLnJlc3BvbnNlQm9keSkudG9BcnJheSgpXG5cdFx0XHR9IGNhdGNoIChlKSB7fVxuXHRcdFx0aWYgKHJlc3BvbnNlICE9PSBudWxsKSB7XG5cdFx0XHRcdHNlbGYucHVzaChuZXcgQnVmZmVyKHJlc3BvbnNlKSlcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdC8vIEZhbGxzIHRocm91Z2ggaW4gSUU4XHRcblx0XHRjYXNlICd0ZXh0Jzpcblx0XHRcdHRyeSB7IC8vIFRoaXMgd2lsbCBmYWlsIHdoZW4gcmVhZHlTdGF0ZSA9IDMgaW4gSUU5LiBTd2l0Y2ggbW9kZSBhbmQgd2FpdCBmb3IgcmVhZHlTdGF0ZSA9IDRcblx0XHRcdFx0cmVzcG9uc2UgPSB4aHIucmVzcG9uc2VUZXh0XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHNlbGYuX21vZGUgPSAndGV4dDp2YmFycmF5J1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdFx0aWYgKHJlc3BvbnNlLmxlbmd0aCA+IHNlbGYuX3Bvcykge1xuXHRcdFx0XHR2YXIgbmV3RGF0YSA9IHJlc3BvbnNlLnN1YnN0cihzZWxmLl9wb3MpXG5cdFx0XHRcdGlmIChzZWxmLl9jaGFyc2V0ID09PSAneC11c2VyLWRlZmluZWQnKSB7XG5cdFx0XHRcdFx0dmFyIGJ1ZmZlciA9IG5ldyBCdWZmZXIobmV3RGF0YS5sZW5ndGgpXG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuZXdEYXRhLmxlbmd0aDsgaSsrKVxuXHRcdFx0XHRcdFx0YnVmZmVyW2ldID0gbmV3RGF0YS5jaGFyQ29kZUF0KGkpICYgMHhmZlxuXG5cdFx0XHRcdFx0c2VsZi5wdXNoKGJ1ZmZlcilcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzZWxmLnB1c2gobmV3RGF0YSwgc2VsZi5fY2hhcnNldClcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxmLl9wb3MgPSByZXNwb25zZS5sZW5ndGhcblx0XHRcdH1cblx0XHRcdGJyZWFrXG5cdFx0Y2FzZSAnYXJyYXlidWZmZXInOlxuXHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlICE9PSByU3RhdGVzLkRPTkUpXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRyZXNwb25zZSA9IHhoci5yZXNwb25zZVxuXHRcdFx0c2VsZi5wdXNoKG5ldyBCdWZmZXIobmV3IFVpbnQ4QXJyYXkocmVzcG9uc2UpKSlcblx0XHRcdGJyZWFrXG5cdFx0Y2FzZSAnbW96LWNodW5rZWQtYXJyYXlidWZmZXInOiAvLyB0YWtlIHdob2xlXG5cdFx0XHRyZXNwb25zZSA9IHhoci5yZXNwb25zZVxuXHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlICE9PSByU3RhdGVzLkxPQURJTkcgfHwgIXJlc3BvbnNlKVxuXHRcdFx0XHRicmVha1xuXHRcdFx0c2VsZi5wdXNoKG5ldyBCdWZmZXIobmV3IFVpbnQ4QXJyYXkocmVzcG9uc2UpKSlcblx0XHRcdGJyZWFrXG5cdFx0Y2FzZSAnbXMtc3RyZWFtJzpcblx0XHRcdHJlc3BvbnNlID0geGhyLnJlc3BvbnNlXG5cdFx0XHRpZiAoeGhyLnJlYWR5U3RhdGUgIT09IHJTdGF0ZXMuTE9BRElORylcblx0XHRcdFx0YnJlYWtcblx0XHRcdHZhciByZWFkZXIgPSBuZXcgZ2xvYmFsLk1TU3RyZWFtUmVhZGVyKClcblx0XHRcdHJlYWRlci5vbnByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAocmVhZGVyLnJlc3VsdC5ieXRlTGVuZ3RoID4gc2VsZi5fcG9zKSB7XG5cdFx0XHRcdFx0c2VsZi5wdXNoKG5ldyBCdWZmZXIobmV3IFVpbnQ4QXJyYXkocmVhZGVyLnJlc3VsdC5zbGljZShzZWxmLl9wb3MpKSkpXG5cdFx0XHRcdFx0c2VsZi5fcG9zID0gcmVhZGVyLnJlc3VsdC5ieXRlTGVuZ3RoXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNlbGYucHVzaChudWxsKVxuXHRcdFx0fVxuXHRcdFx0Ly8gcmVhZGVyLm9uZXJyb3IgPSA/Pz8gLy8gVE9ETzogdGhpc1xuXHRcdFx0cmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKHJlc3BvbnNlKVxuXHRcdFx0YnJlYWtcblx0fVxuXG5cdC8vIFRoZSBtcy1zdHJlYW0gY2FzZSBoYW5kbGVzIGVuZCBzZXBhcmF0ZWx5IGluIHJlYWRlci5vbmxvYWQoKVxuXHRpZiAoc2VsZi5feGhyLnJlYWR5U3RhdGUgPT09IHJTdGF0ZXMuRE9ORSAmJiBzZWxmLl9tb2RlICE9PSAnbXMtc3RyZWFtJykge1xuXHRcdHNlbGYucHVzaChudWxsKVxuXHR9XG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcblxudmFyIGlzQnVmZmVyRW5jb2RpbmcgPSBCdWZmZXIuaXNFbmNvZGluZ1xuICB8fCBmdW5jdGlvbihlbmNvZGluZykge1xuICAgICAgIHN3aXRjaCAoZW5jb2RpbmcgJiYgZW5jb2RpbmcudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgY2FzZSAnaGV4JzogY2FzZSAndXRmOCc6IGNhc2UgJ3V0Zi04JzogY2FzZSAnYXNjaWknOiBjYXNlICdiaW5hcnknOiBjYXNlICdiYXNlNjQnOiBjYXNlICd1Y3MyJzogY2FzZSAndWNzLTInOiBjYXNlICd1dGYxNmxlJzogY2FzZSAndXRmLTE2bGUnOiBjYXNlICdyYXcnOiByZXR1cm4gdHJ1ZTtcbiAgICAgICAgIGRlZmF1bHQ6IHJldHVybiBmYWxzZTtcbiAgICAgICB9XG4gICAgIH1cblxuXG5mdW5jdGlvbiBhc3NlcnRFbmNvZGluZyhlbmNvZGluZykge1xuICBpZiAoZW5jb2RpbmcgJiYgIWlzQnVmZmVyRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpO1xuICB9XG59XG5cbi8vIFN0cmluZ0RlY29kZXIgcHJvdmlkZXMgYW4gaW50ZXJmYWNlIGZvciBlZmZpY2llbnRseSBzcGxpdHRpbmcgYSBzZXJpZXMgb2Zcbi8vIGJ1ZmZlcnMgaW50byBhIHNlcmllcyBvZiBKUyBzdHJpbmdzIHdpdGhvdXQgYnJlYWtpbmcgYXBhcnQgbXVsdGktYnl0ZVxuLy8gY2hhcmFjdGVycy4gQ0VTVS04IGlzIGhhbmRsZWQgYXMgcGFydCBvZiB0aGUgVVRGLTggZW5jb2RpbmcuXG4vL1xuLy8gQFRPRE8gSGFuZGxpbmcgYWxsIGVuY29kaW5ncyBpbnNpZGUgYSBzaW5nbGUgb2JqZWN0IG1ha2VzIGl0IHZlcnkgZGlmZmljdWx0XG4vLyB0byByZWFzb24gYWJvdXQgdGhpcyBjb2RlLCBzbyBpdCBzaG91bGQgYmUgc3BsaXQgdXAgaW4gdGhlIGZ1dHVyZS5cbi8vIEBUT0RPIFRoZXJlIHNob3VsZCBiZSBhIHV0Zjgtc3RyaWN0IGVuY29kaW5nIHRoYXQgcmVqZWN0cyBpbnZhbGlkIFVURi04IGNvZGVcbi8vIHBvaW50cyBhcyB1c2VkIGJ5IENFU1UtOC5cbnZhciBTdHJpbmdEZWNvZGVyID0gZXhwb3J0cy5TdHJpbmdEZWNvZGVyID0gZnVuY3Rpb24oZW5jb2RpbmcpIHtcbiAgdGhpcy5lbmNvZGluZyA9IChlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvWy1fXS8sICcnKTtcbiAgYXNzZXJ0RW5jb2RpbmcoZW5jb2RpbmcpO1xuICBzd2l0Y2ggKHRoaXMuZW5jb2RpbmcpIHtcbiAgICBjYXNlICd1dGY4JzpcbiAgICAgIC8vIENFU1UtOCByZXByZXNlbnRzIGVhY2ggb2YgU3Vycm9nYXRlIFBhaXIgYnkgMy1ieXRlc1xuICAgICAgdGhpcy5zdXJyb2dhdGVTaXplID0gMztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgLy8gVVRGLTE2IHJlcHJlc2VudHMgZWFjaCBvZiBTdXJyb2dhdGUgUGFpciBieSAyLWJ5dGVzXG4gICAgICB0aGlzLnN1cnJvZ2F0ZVNpemUgPSAyO1xuICAgICAgdGhpcy5kZXRlY3RJbmNvbXBsZXRlQ2hhciA9IHV0ZjE2RGV0ZWN0SW5jb21wbGV0ZUNoYXI7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgLy8gQmFzZS02NCBzdG9yZXMgMyBieXRlcyBpbiA0IGNoYXJzLCBhbmQgcGFkcyB0aGUgcmVtYWluZGVyLlxuICAgICAgdGhpcy5zdXJyb2dhdGVTaXplID0gMztcbiAgICAgIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIgPSBiYXNlNjREZXRlY3RJbmNvbXBsZXRlQ2hhcjtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aGlzLndyaXRlID0gcGFzc1Rocm91Z2hXcml0ZTtcbiAgICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEVub3VnaCBzcGFjZSB0byBzdG9yZSBhbGwgYnl0ZXMgb2YgYSBzaW5nbGUgY2hhcmFjdGVyLiBVVEYtOCBuZWVkcyA0XG4gIC8vIGJ5dGVzLCBidXQgQ0VTVS04IG1heSByZXF1aXJlIHVwIHRvIDYgKDMgYnl0ZXMgcGVyIHN1cnJvZ2F0ZSkuXG4gIHRoaXMuY2hhckJ1ZmZlciA9IG5ldyBCdWZmZXIoNik7XG4gIC8vIE51bWJlciBvZiBieXRlcyByZWNlaXZlZCBmb3IgdGhlIGN1cnJlbnQgaW5jb21wbGV0ZSBtdWx0aS1ieXRlIGNoYXJhY3Rlci5cbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSAwO1xuICAvLyBOdW1iZXIgb2YgYnl0ZXMgZXhwZWN0ZWQgZm9yIHRoZSBjdXJyZW50IGluY29tcGxldGUgbXVsdGktYnl0ZSBjaGFyYWN0ZXIuXG4gIHRoaXMuY2hhckxlbmd0aCA9IDA7XG59O1xuXG5cbi8vIHdyaXRlIGRlY29kZXMgdGhlIGdpdmVuIGJ1ZmZlciBhbmQgcmV0dXJucyBpdCBhcyBKUyBzdHJpbmcgdGhhdCBpc1xuLy8gZ3VhcmFudGVlZCB0byBub3QgY29udGFpbiBhbnkgcGFydGlhbCBtdWx0aS1ieXRlIGNoYXJhY3RlcnMuIEFueSBwYXJ0aWFsXG4vLyBjaGFyYWN0ZXIgZm91bmQgYXQgdGhlIGVuZCBvZiB0aGUgYnVmZmVyIGlzIGJ1ZmZlcmVkIHVwLCBhbmQgd2lsbCBiZVxuLy8gcmV0dXJuZWQgd2hlbiBjYWxsaW5nIHdyaXRlIGFnYWluIHdpdGggdGhlIHJlbWFpbmluZyBieXRlcy5cbi8vXG4vLyBOb3RlOiBDb252ZXJ0aW5nIGEgQnVmZmVyIGNvbnRhaW5pbmcgYW4gb3JwaGFuIHN1cnJvZ2F0ZSB0byBhIFN0cmluZ1xuLy8gY3VycmVudGx5IHdvcmtzLCBidXQgY29udmVydGluZyBhIFN0cmluZyB0byBhIEJ1ZmZlciAodmlhIGBuZXcgQnVmZmVyYCwgb3Jcbi8vIEJ1ZmZlciN3cml0ZSkgd2lsbCByZXBsYWNlIGluY29tcGxldGUgc3Vycm9nYXRlcyB3aXRoIHRoZSB1bmljb2RlXG4vLyByZXBsYWNlbWVudCBjaGFyYWN0ZXIuIFNlZSBodHRwczovL2NvZGVyZXZpZXcuY2hyb21pdW0ub3JnLzEyMTE3MzAwOS8gLlxuU3RyaW5nRGVjb2Rlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbihidWZmZXIpIHtcbiAgdmFyIGNoYXJTdHIgPSAnJztcbiAgLy8gaWYgb3VyIGxhc3Qgd3JpdGUgZW5kZWQgd2l0aCBhbiBpbmNvbXBsZXRlIG11bHRpYnl0ZSBjaGFyYWN0ZXJcbiAgd2hpbGUgKHRoaXMuY2hhckxlbmd0aCkge1xuICAgIC8vIGRldGVybWluZSBob3cgbWFueSByZW1haW5pbmcgYnl0ZXMgdGhpcyBidWZmZXIgaGFzIHRvIG9mZmVyIGZvciB0aGlzIGNoYXJcbiAgICB2YXIgYXZhaWxhYmxlID0gKGJ1ZmZlci5sZW5ndGggPj0gdGhpcy5jaGFyTGVuZ3RoIC0gdGhpcy5jaGFyUmVjZWl2ZWQpID9cbiAgICAgICAgdGhpcy5jaGFyTGVuZ3RoIC0gdGhpcy5jaGFyUmVjZWl2ZWQgOlxuICAgICAgICBidWZmZXIubGVuZ3RoO1xuXG4gICAgLy8gYWRkIHRoZSBuZXcgYnl0ZXMgdG8gdGhlIGNoYXIgYnVmZmVyXG4gICAgYnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCB0aGlzLmNoYXJSZWNlaXZlZCwgMCwgYXZhaWxhYmxlKTtcbiAgICB0aGlzLmNoYXJSZWNlaXZlZCArPSBhdmFpbGFibGU7XG5cbiAgICBpZiAodGhpcy5jaGFyUmVjZWl2ZWQgPCB0aGlzLmNoYXJMZW5ndGgpIHtcbiAgICAgIC8vIHN0aWxsIG5vdCBlbm91Z2ggY2hhcnMgaW4gdGhpcyBidWZmZXI/IHdhaXQgZm9yIG1vcmUgLi4uXG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlIGJ5dGVzIGJlbG9uZ2luZyB0byB0aGUgY3VycmVudCBjaGFyYWN0ZXIgZnJvbSB0aGUgYnVmZmVyXG4gICAgYnVmZmVyID0gYnVmZmVyLnNsaWNlKGF2YWlsYWJsZSwgYnVmZmVyLmxlbmd0aCk7XG5cbiAgICAvLyBnZXQgdGhlIGNoYXJhY3RlciB0aGF0IHdhcyBzcGxpdFxuICAgIGNoYXJTdHIgPSB0aGlzLmNoYXJCdWZmZXIuc2xpY2UoMCwgdGhpcy5jaGFyTGVuZ3RoKS50b1N0cmluZyh0aGlzLmVuY29kaW5nKTtcblxuICAgIC8vIENFU1UtODogbGVhZCBzdXJyb2dhdGUgKEQ4MDAtREJGRikgaXMgYWxzbyB0aGUgaW5jb21wbGV0ZSBjaGFyYWN0ZXJcbiAgICB2YXIgY2hhckNvZGUgPSBjaGFyU3RyLmNoYXJDb2RlQXQoY2hhclN0ci5sZW5ndGggLSAxKTtcbiAgICBpZiAoY2hhckNvZGUgPj0gMHhEODAwICYmIGNoYXJDb2RlIDw9IDB4REJGRikge1xuICAgICAgdGhpcy5jaGFyTGVuZ3RoICs9IHRoaXMuc3Vycm9nYXRlU2l6ZTtcbiAgICAgIGNoYXJTdHIgPSAnJztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB0aGlzLmNoYXJSZWNlaXZlZCA9IHRoaXMuY2hhckxlbmd0aCA9IDA7XG5cbiAgICAvLyBpZiB0aGVyZSBhcmUgbm8gbW9yZSBieXRlcyBpbiB0aGlzIGJ1ZmZlciwganVzdCBlbWl0IG91ciBjaGFyXG4gICAgaWYgKGJ1ZmZlci5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBjaGFyU3RyO1xuICAgIH1cbiAgICBicmVhaztcbiAgfVxuXG4gIC8vIGRldGVybWluZSBhbmQgc2V0IGNoYXJMZW5ndGggLyBjaGFyUmVjZWl2ZWRcbiAgdGhpcy5kZXRlY3RJbmNvbXBsZXRlQ2hhcihidWZmZXIpO1xuXG4gIHZhciBlbmQgPSBidWZmZXIubGVuZ3RoO1xuICBpZiAodGhpcy5jaGFyTGVuZ3RoKSB7XG4gICAgLy8gYnVmZmVyIHRoZSBpbmNvbXBsZXRlIGNoYXJhY3RlciBieXRlcyB3ZSBnb3RcbiAgICBidWZmZXIuY29weSh0aGlzLmNoYXJCdWZmZXIsIDAsIGJ1ZmZlci5sZW5ndGggLSB0aGlzLmNoYXJSZWNlaXZlZCwgZW5kKTtcbiAgICBlbmQgLT0gdGhpcy5jaGFyUmVjZWl2ZWQ7XG4gIH1cblxuICBjaGFyU3RyICs9IGJ1ZmZlci50b1N0cmluZyh0aGlzLmVuY29kaW5nLCAwLCBlbmQpO1xuXG4gIHZhciBlbmQgPSBjaGFyU3RyLmxlbmd0aCAtIDE7XG4gIHZhciBjaGFyQ29kZSA9IGNoYXJTdHIuY2hhckNvZGVBdChlbmQpO1xuICAvLyBDRVNVLTg6IGxlYWQgc3Vycm9nYXRlIChEODAwLURCRkYpIGlzIGFsc28gdGhlIGluY29tcGxldGUgY2hhcmFjdGVyXG4gIGlmIChjaGFyQ29kZSA+PSAweEQ4MDAgJiYgY2hhckNvZGUgPD0gMHhEQkZGKSB7XG4gICAgdmFyIHNpemUgPSB0aGlzLnN1cnJvZ2F0ZVNpemU7XG4gICAgdGhpcy5jaGFyTGVuZ3RoICs9IHNpemU7XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgKz0gc2l6ZTtcbiAgICB0aGlzLmNoYXJCdWZmZXIuY29weSh0aGlzLmNoYXJCdWZmZXIsIHNpemUsIDAsIHNpemUpO1xuICAgIGJ1ZmZlci5jb3B5KHRoaXMuY2hhckJ1ZmZlciwgMCwgMCwgc2l6ZSk7XG4gICAgcmV0dXJuIGNoYXJTdHIuc3Vic3RyaW5nKDAsIGVuZCk7XG4gIH1cblxuICAvLyBvciBqdXN0IGVtaXQgdGhlIGNoYXJTdHJcbiAgcmV0dXJuIGNoYXJTdHI7XG59O1xuXG4vLyBkZXRlY3RJbmNvbXBsZXRlQ2hhciBkZXRlcm1pbmVzIGlmIHRoZXJlIGlzIGFuIGluY29tcGxldGUgVVRGLTggY2hhcmFjdGVyIGF0XG4vLyB0aGUgZW5kIG9mIHRoZSBnaXZlbiBidWZmZXIuIElmIHNvLCBpdCBzZXRzIHRoaXMuY2hhckxlbmd0aCB0byB0aGUgYnl0ZVxuLy8gbGVuZ3RoIHRoYXQgY2hhcmFjdGVyLCBhbmQgc2V0cyB0aGlzLmNoYXJSZWNlaXZlZCB0byB0aGUgbnVtYmVyIG9mIGJ5dGVzXG4vLyB0aGF0IGFyZSBhdmFpbGFibGUgZm9yIHRoaXMgY2hhcmFjdGVyLlxuU3RyaW5nRGVjb2Rlci5wcm90b3R5cGUuZGV0ZWN0SW5jb21wbGV0ZUNoYXIgPSBmdW5jdGlvbihidWZmZXIpIHtcbiAgLy8gZGV0ZXJtaW5lIGhvdyBtYW55IGJ5dGVzIHdlIGhhdmUgdG8gY2hlY2sgYXQgdGhlIGVuZCBvZiB0aGlzIGJ1ZmZlclxuICB2YXIgaSA9IChidWZmZXIubGVuZ3RoID49IDMpID8gMyA6IGJ1ZmZlci5sZW5ndGg7XG5cbiAgLy8gRmlndXJlIG91dCBpZiBvbmUgb2YgdGhlIGxhc3QgaSBieXRlcyBvZiBvdXIgYnVmZmVyIGFubm91bmNlcyBhblxuICAvLyBpbmNvbXBsZXRlIGNoYXIuXG4gIGZvciAoOyBpID4gMDsgaS0tKSB7XG4gICAgdmFyIGMgPSBidWZmZXJbYnVmZmVyLmxlbmd0aCAtIGldO1xuXG4gICAgLy8gU2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvVVRGLTgjRGVzY3JpcHRpb25cblxuICAgIC8vIDExMFhYWFhYXG4gICAgaWYgKGkgPT0gMSAmJiBjID4+IDUgPT0gMHgwNikge1xuICAgICAgdGhpcy5jaGFyTGVuZ3RoID0gMjtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIDExMTBYWFhYXG4gICAgaWYgKGkgPD0gMiAmJiBjID4+IDQgPT0gMHgwRSkge1xuICAgICAgdGhpcy5jaGFyTGVuZ3RoID0gMztcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIDExMTEwWFhYXG4gICAgaWYgKGkgPD0gMyAmJiBjID4+IDMgPT0gMHgxRSkge1xuICAgICAgdGhpcy5jaGFyTGVuZ3RoID0gNDtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICB0aGlzLmNoYXJSZWNlaXZlZCA9IGk7XG59O1xuXG5TdHJpbmdEZWNvZGVyLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbihidWZmZXIpIHtcbiAgdmFyIHJlcyA9ICcnO1xuICBpZiAoYnVmZmVyICYmIGJ1ZmZlci5sZW5ndGgpXG4gICAgcmVzID0gdGhpcy53cml0ZShidWZmZXIpO1xuXG4gIGlmICh0aGlzLmNoYXJSZWNlaXZlZCkge1xuICAgIHZhciBjciA9IHRoaXMuY2hhclJlY2VpdmVkO1xuICAgIHZhciBidWYgPSB0aGlzLmNoYXJCdWZmZXI7XG4gICAgdmFyIGVuYyA9IHRoaXMuZW5jb2Rpbmc7XG4gICAgcmVzICs9IGJ1Zi5zbGljZSgwLCBjcikudG9TdHJpbmcoZW5jKTtcbiAgfVxuXG4gIHJldHVybiByZXM7XG59O1xuXG5mdW5jdGlvbiBwYXNzVGhyb3VnaFdyaXRlKGJ1ZmZlcikge1xuICByZXR1cm4gYnVmZmVyLnRvU3RyaW5nKHRoaXMuZW5jb2RpbmcpO1xufVxuXG5mdW5jdGlvbiB1dGYxNkRldGVjdEluY29tcGxldGVDaGFyKGJ1ZmZlcikge1xuICB0aGlzLmNoYXJSZWNlaXZlZCA9IGJ1ZmZlci5sZW5ndGggJSAyO1xuICB0aGlzLmNoYXJMZW5ndGggPSB0aGlzLmNoYXJSZWNlaXZlZCA/IDIgOiAwO1xufVxuXG5mdW5jdGlvbiBiYXNlNjREZXRlY3RJbmNvbXBsZXRlQ2hhcihidWZmZXIpIHtcbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBidWZmZXIubGVuZ3RoICUgMztcbiAgdGhpcy5jaGFyTGVuZ3RoID0gdGhpcy5jaGFyUmVjZWl2ZWQgPyAzIDogMDtcbn1cbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBwdW55Y29kZSA9IHJlcXVpcmUoJ3B1bnljb2RlJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5leHBvcnRzLnBhcnNlID0gdXJsUGFyc2U7XG5leHBvcnRzLnJlc29sdmUgPSB1cmxSZXNvbHZlO1xuZXhwb3J0cy5yZXNvbHZlT2JqZWN0ID0gdXJsUmVzb2x2ZU9iamVjdDtcbmV4cG9ydHMuZm9ybWF0ID0gdXJsRm9ybWF0O1xuXG5leHBvcnRzLlVybCA9IFVybDtcblxuZnVuY3Rpb24gVXJsKCkge1xuICB0aGlzLnByb3RvY29sID0gbnVsbDtcbiAgdGhpcy5zbGFzaGVzID0gbnVsbDtcbiAgdGhpcy5hdXRoID0gbnVsbDtcbiAgdGhpcy5ob3N0ID0gbnVsbDtcbiAgdGhpcy5wb3J0ID0gbnVsbDtcbiAgdGhpcy5ob3N0bmFtZSA9IG51bGw7XG4gIHRoaXMuaGFzaCA9IG51bGw7XG4gIHRoaXMuc2VhcmNoID0gbnVsbDtcbiAgdGhpcy5xdWVyeSA9IG51bGw7XG4gIHRoaXMucGF0aG5hbWUgPSBudWxsO1xuICB0aGlzLnBhdGggPSBudWxsO1xuICB0aGlzLmhyZWYgPSBudWxsO1xufVxuXG4vLyBSZWZlcmVuY2U6IFJGQyAzOTg2LCBSRkMgMTgwOCwgUkZDIDIzOTZcblxuLy8gZGVmaW5lIHRoZXNlIGhlcmUgc28gYXQgbGVhc3QgdGhleSBvbmx5IGhhdmUgdG8gYmVcbi8vIGNvbXBpbGVkIG9uY2Ugb24gdGhlIGZpcnN0IG1vZHVsZSBsb2FkLlxudmFyIHByb3RvY29sUGF0dGVybiA9IC9eKFthLXowLTkuKy1dKzopL2ksXG4gICAgcG9ydFBhdHRlcm4gPSAvOlswLTldKiQvLFxuXG4gICAgLy8gU3BlY2lhbCBjYXNlIGZvciBhIHNpbXBsZSBwYXRoIFVSTFxuICAgIHNpbXBsZVBhdGhQYXR0ZXJuID0gL14oXFwvXFwvPyg/IVxcLylbXlxcP1xcc10qKShcXD9bXlxcc10qKT8kLyxcblxuICAgIC8vIFJGQyAyMzk2OiBjaGFyYWN0ZXJzIHJlc2VydmVkIGZvciBkZWxpbWl0aW5nIFVSTHMuXG4gICAgLy8gV2UgYWN0dWFsbHkganVzdCBhdXRvLWVzY2FwZSB0aGVzZS5cbiAgICBkZWxpbXMgPSBbJzwnLCAnPicsICdcIicsICdgJywgJyAnLCAnXFxyJywgJ1xcbicsICdcXHQnXSxcblxuICAgIC8vIFJGQyAyMzk2OiBjaGFyYWN0ZXJzIG5vdCBhbGxvd2VkIGZvciB2YXJpb3VzIHJlYXNvbnMuXG4gICAgdW53aXNlID0gWyd7JywgJ30nLCAnfCcsICdcXFxcJywgJ14nLCAnYCddLmNvbmNhdChkZWxpbXMpLFxuXG4gICAgLy8gQWxsb3dlZCBieSBSRkNzLCBidXQgY2F1c2Ugb2YgWFNTIGF0dGFja3MuICBBbHdheXMgZXNjYXBlIHRoZXNlLlxuICAgIGF1dG9Fc2NhcGUgPSBbJ1xcJyddLmNvbmNhdCh1bndpc2UpLFxuICAgIC8vIENoYXJhY3RlcnMgdGhhdCBhcmUgbmV2ZXIgZXZlciBhbGxvd2VkIGluIGEgaG9zdG5hbWUuXG4gICAgLy8gTm90ZSB0aGF0IGFueSBpbnZhbGlkIGNoYXJzIGFyZSBhbHNvIGhhbmRsZWQsIGJ1dCB0aGVzZVxuICAgIC8vIGFyZSB0aGUgb25lcyB0aGF0IGFyZSAqZXhwZWN0ZWQqIHRvIGJlIHNlZW4sIHNvIHdlIGZhc3QtcGF0aFxuICAgIC8vIHRoZW0uXG4gICAgbm9uSG9zdENoYXJzID0gWyclJywgJy8nLCAnPycsICc7JywgJyMnXS5jb25jYXQoYXV0b0VzY2FwZSksXG4gICAgaG9zdEVuZGluZ0NoYXJzID0gWycvJywgJz8nLCAnIyddLFxuICAgIGhvc3RuYW1lTWF4TGVuID0gMjU1LFxuICAgIGhvc3RuYW1lUGFydFBhdHRlcm4gPSAvXlsrYS16MC05QS1aXy1dezAsNjN9JC8sXG4gICAgaG9zdG5hbWVQYXJ0U3RhcnQgPSAvXihbK2EtejAtOUEtWl8tXXswLDYzfSkoLiopJC8sXG4gICAgLy8gcHJvdG9jb2xzIHRoYXQgY2FuIGFsbG93IFwidW5zYWZlXCIgYW5kIFwidW53aXNlXCIgY2hhcnMuXG4gICAgdW5zYWZlUHJvdG9jb2wgPSB7XG4gICAgICAnamF2YXNjcmlwdCc6IHRydWUsXG4gICAgICAnamF2YXNjcmlwdDonOiB0cnVlXG4gICAgfSxcbiAgICAvLyBwcm90b2NvbHMgdGhhdCBuZXZlciBoYXZlIGEgaG9zdG5hbWUuXG4gICAgaG9zdGxlc3NQcm90b2NvbCA9IHtcbiAgICAgICdqYXZhc2NyaXB0JzogdHJ1ZSxcbiAgICAgICdqYXZhc2NyaXB0Oic6IHRydWVcbiAgICB9LFxuICAgIC8vIHByb3RvY29scyB0aGF0IGFsd2F5cyBjb250YWluIGEgLy8gYml0LlxuICAgIHNsYXNoZWRQcm90b2NvbCA9IHtcbiAgICAgICdodHRwJzogdHJ1ZSxcbiAgICAgICdodHRwcyc6IHRydWUsXG4gICAgICAnZnRwJzogdHJ1ZSxcbiAgICAgICdnb3BoZXInOiB0cnVlLFxuICAgICAgJ2ZpbGUnOiB0cnVlLFxuICAgICAgJ2h0dHA6JzogdHJ1ZSxcbiAgICAgICdodHRwczonOiB0cnVlLFxuICAgICAgJ2Z0cDonOiB0cnVlLFxuICAgICAgJ2dvcGhlcjonOiB0cnVlLFxuICAgICAgJ2ZpbGU6JzogdHJ1ZVxuICAgIH0sXG4gICAgcXVlcnlzdHJpbmcgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpO1xuXG5mdW5jdGlvbiB1cmxQYXJzZSh1cmwsIHBhcnNlUXVlcnlTdHJpbmcsIHNsYXNoZXNEZW5vdGVIb3N0KSB7XG4gIGlmICh1cmwgJiYgdXRpbC5pc09iamVjdCh1cmwpICYmIHVybCBpbnN0YW5jZW9mIFVybCkgcmV0dXJuIHVybDtcblxuICB2YXIgdSA9IG5ldyBVcmw7XG4gIHUucGFyc2UodXJsLCBwYXJzZVF1ZXJ5U3RyaW5nLCBzbGFzaGVzRGVub3RlSG9zdCk7XG4gIHJldHVybiB1O1xufVxuXG5VcmwucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24odXJsLCBwYXJzZVF1ZXJ5U3RyaW5nLCBzbGFzaGVzRGVub3RlSG9zdCkge1xuICBpZiAoIXV0aWwuaXNTdHJpbmcodXJsKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQYXJhbWV0ZXIgJ3VybCcgbXVzdCBiZSBhIHN0cmluZywgbm90IFwiICsgdHlwZW9mIHVybCk7XG4gIH1cblxuICAvLyBDb3B5IGNocm9tZSwgSUUsIG9wZXJhIGJhY2tzbGFzaC1oYW5kbGluZyBiZWhhdmlvci5cbiAgLy8gQmFjayBzbGFzaGVzIGJlZm9yZSB0aGUgcXVlcnkgc3RyaW5nIGdldCBjb252ZXJ0ZWQgdG8gZm9yd2FyZCBzbGFzaGVzXG4gIC8vIFNlZTogaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTI1OTE2XG4gIHZhciBxdWVyeUluZGV4ID0gdXJsLmluZGV4T2YoJz8nKSxcbiAgICAgIHNwbGl0dGVyID1cbiAgICAgICAgICAocXVlcnlJbmRleCAhPT0gLTEgJiYgcXVlcnlJbmRleCA8IHVybC5pbmRleE9mKCcjJykpID8gJz8nIDogJyMnLFxuICAgICAgdVNwbGl0ID0gdXJsLnNwbGl0KHNwbGl0dGVyKSxcbiAgICAgIHNsYXNoUmVnZXggPSAvXFxcXC9nO1xuICB1U3BsaXRbMF0gPSB1U3BsaXRbMF0ucmVwbGFjZShzbGFzaFJlZ2V4LCAnLycpO1xuICB1cmwgPSB1U3BsaXQuam9pbihzcGxpdHRlcik7XG5cbiAgdmFyIHJlc3QgPSB1cmw7XG5cbiAgLy8gdHJpbSBiZWZvcmUgcHJvY2VlZGluZy5cbiAgLy8gVGhpcyBpcyB0byBzdXBwb3J0IHBhcnNlIHN0dWZmIGxpa2UgXCIgIGh0dHA6Ly9mb28uY29tICBcXG5cIlxuICByZXN0ID0gcmVzdC50cmltKCk7XG5cbiAgaWYgKCFzbGFzaGVzRGVub3RlSG9zdCAmJiB1cmwuc3BsaXQoJyMnKS5sZW5ndGggPT09IDEpIHtcbiAgICAvLyBUcnkgZmFzdCBwYXRoIHJlZ2V4cFxuICAgIHZhciBzaW1wbGVQYXRoID0gc2ltcGxlUGF0aFBhdHRlcm4uZXhlYyhyZXN0KTtcbiAgICBpZiAoc2ltcGxlUGF0aCkge1xuICAgICAgdGhpcy5wYXRoID0gcmVzdDtcbiAgICAgIHRoaXMuaHJlZiA9IHJlc3Q7XG4gICAgICB0aGlzLnBhdGhuYW1lID0gc2ltcGxlUGF0aFsxXTtcbiAgICAgIGlmIChzaW1wbGVQYXRoWzJdKSB7XG4gICAgICAgIHRoaXMuc2VhcmNoID0gc2ltcGxlUGF0aFsyXTtcbiAgICAgICAgaWYgKHBhcnNlUXVlcnlTdHJpbmcpIHtcbiAgICAgICAgICB0aGlzLnF1ZXJ5ID0gcXVlcnlzdHJpbmcucGFyc2UodGhpcy5zZWFyY2guc3Vic3RyKDEpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnF1ZXJ5ID0gdGhpcy5zZWFyY2guc3Vic3RyKDEpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHBhcnNlUXVlcnlTdHJpbmcpIHtcbiAgICAgICAgdGhpcy5zZWFyY2ggPSAnJztcbiAgICAgICAgdGhpcy5xdWVyeSA9IHt9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9XG5cbiAgdmFyIHByb3RvID0gcHJvdG9jb2xQYXR0ZXJuLmV4ZWMocmVzdCk7XG4gIGlmIChwcm90bykge1xuICAgIHByb3RvID0gcHJvdG9bMF07XG4gICAgdmFyIGxvd2VyUHJvdG8gPSBwcm90by50b0xvd2VyQ2FzZSgpO1xuICAgIHRoaXMucHJvdG9jb2wgPSBsb3dlclByb3RvO1xuICAgIHJlc3QgPSByZXN0LnN1YnN0cihwcm90by5sZW5ndGgpO1xuICB9XG5cbiAgLy8gZmlndXJlIG91dCBpZiBpdCdzIGdvdCBhIGhvc3RcbiAgLy8gdXNlckBzZXJ2ZXIgaXMgKmFsd2F5cyogaW50ZXJwcmV0ZWQgYXMgYSBob3N0bmFtZSwgYW5kIHVybFxuICAvLyByZXNvbHV0aW9uIHdpbGwgdHJlYXQgLy9mb28vYmFyIGFzIGhvc3Q9Zm9vLHBhdGg9YmFyIGJlY2F1c2UgdGhhdCdzXG4gIC8vIGhvdyB0aGUgYnJvd3NlciByZXNvbHZlcyByZWxhdGl2ZSBVUkxzLlxuICBpZiAoc2xhc2hlc0Rlbm90ZUhvc3QgfHwgcHJvdG8gfHwgcmVzdC5tYXRjaCgvXlxcL1xcL1teQFxcL10rQFteQFxcL10rLykpIHtcbiAgICB2YXIgc2xhc2hlcyA9IHJlc3Quc3Vic3RyKDAsIDIpID09PSAnLy8nO1xuICAgIGlmIChzbGFzaGVzICYmICEocHJvdG8gJiYgaG9zdGxlc3NQcm90b2NvbFtwcm90b10pKSB7XG4gICAgICByZXN0ID0gcmVzdC5zdWJzdHIoMik7XG4gICAgICB0aGlzLnNsYXNoZXMgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGlmICghaG9zdGxlc3NQcm90b2NvbFtwcm90b10gJiZcbiAgICAgIChzbGFzaGVzIHx8IChwcm90byAmJiAhc2xhc2hlZFByb3RvY29sW3Byb3RvXSkpKSB7XG5cbiAgICAvLyB0aGVyZSdzIGEgaG9zdG5hbWUuXG4gICAgLy8gdGhlIGZpcnN0IGluc3RhbmNlIG9mIC8sID8sIDssIG9yICMgZW5kcyB0aGUgaG9zdC5cbiAgICAvL1xuICAgIC8vIElmIHRoZXJlIGlzIGFuIEAgaW4gdGhlIGhvc3RuYW1lLCB0aGVuIG5vbi1ob3N0IGNoYXJzICphcmUqIGFsbG93ZWRcbiAgICAvLyB0byB0aGUgbGVmdCBvZiB0aGUgbGFzdCBAIHNpZ24sIHVubGVzcyBzb21lIGhvc3QtZW5kaW5nIGNoYXJhY3RlclxuICAgIC8vIGNvbWVzICpiZWZvcmUqIHRoZSBALXNpZ24uXG4gICAgLy8gVVJMcyBhcmUgb2Jub3hpb3VzLlxuICAgIC8vXG4gICAgLy8gZXg6XG4gICAgLy8gaHR0cDovL2FAYkBjLyA9PiB1c2VyOmFAYiBob3N0OmNcbiAgICAvLyBodHRwOi8vYUBiP0BjID0+IHVzZXI6YSBob3N0OmMgcGF0aDovP0BjXG5cbiAgICAvLyB2MC4xMiBUT0RPKGlzYWFjcyk6IFRoaXMgaXMgbm90IHF1aXRlIGhvdyBDaHJvbWUgZG9lcyB0aGluZ3MuXG4gICAgLy8gUmV2aWV3IG91ciB0ZXN0IGNhc2UgYWdhaW5zdCBicm93c2VycyBtb3JlIGNvbXByZWhlbnNpdmVseS5cblxuICAgIC8vIGZpbmQgdGhlIGZpcnN0IGluc3RhbmNlIG9mIGFueSBob3N0RW5kaW5nQ2hhcnNcbiAgICB2YXIgaG9zdEVuZCA9IC0xO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaG9zdEVuZGluZ0NoYXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaGVjID0gcmVzdC5pbmRleE9mKGhvc3RFbmRpbmdDaGFyc1tpXSk7XG4gICAgICBpZiAoaGVjICE9PSAtMSAmJiAoaG9zdEVuZCA9PT0gLTEgfHwgaGVjIDwgaG9zdEVuZCkpXG4gICAgICAgIGhvc3RFbmQgPSBoZWM7XG4gICAgfVxuXG4gICAgLy8gYXQgdGhpcyBwb2ludCwgZWl0aGVyIHdlIGhhdmUgYW4gZXhwbGljaXQgcG9pbnQgd2hlcmUgdGhlXG4gICAgLy8gYXV0aCBwb3J0aW9uIGNhbm5vdCBnbyBwYXN0LCBvciB0aGUgbGFzdCBAIGNoYXIgaXMgdGhlIGRlY2lkZXIuXG4gICAgdmFyIGF1dGgsIGF0U2lnbjtcbiAgICBpZiAoaG9zdEVuZCA9PT0gLTEpIHtcbiAgICAgIC8vIGF0U2lnbiBjYW4gYmUgYW55d2hlcmUuXG4gICAgICBhdFNpZ24gPSByZXN0Lmxhc3RJbmRleE9mKCdAJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGF0U2lnbiBtdXN0IGJlIGluIGF1dGggcG9ydGlvbi5cbiAgICAgIC8vIGh0dHA6Ly9hQGIvY0BkID0+IGhvc3Q6YiBhdXRoOmEgcGF0aDovY0BkXG4gICAgICBhdFNpZ24gPSByZXN0Lmxhc3RJbmRleE9mKCdAJywgaG9zdEVuZCk7XG4gICAgfVxuXG4gICAgLy8gTm93IHdlIGhhdmUgYSBwb3J0aW9uIHdoaWNoIGlzIGRlZmluaXRlbHkgdGhlIGF1dGguXG4gICAgLy8gUHVsbCB0aGF0IG9mZi5cbiAgICBpZiAoYXRTaWduICE9PSAtMSkge1xuICAgICAgYXV0aCA9IHJlc3Quc2xpY2UoMCwgYXRTaWduKTtcbiAgICAgIHJlc3QgPSByZXN0LnNsaWNlKGF0U2lnbiArIDEpO1xuICAgICAgdGhpcy5hdXRoID0gZGVjb2RlVVJJQ29tcG9uZW50KGF1dGgpO1xuICAgIH1cblxuICAgIC8vIHRoZSBob3N0IGlzIHRoZSByZW1haW5pbmcgdG8gdGhlIGxlZnQgb2YgdGhlIGZpcnN0IG5vbi1ob3N0IGNoYXJcbiAgICBob3N0RW5kID0gLTE7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub25Ib3N0Q2hhcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBoZWMgPSByZXN0LmluZGV4T2Yobm9uSG9zdENoYXJzW2ldKTtcbiAgICAgIGlmIChoZWMgIT09IC0xICYmIChob3N0RW5kID09PSAtMSB8fCBoZWMgPCBob3N0RW5kKSlcbiAgICAgICAgaG9zdEVuZCA9IGhlYztcbiAgICB9XG4gICAgLy8gaWYgd2Ugc3RpbGwgaGF2ZSBub3QgaGl0IGl0LCB0aGVuIHRoZSBlbnRpcmUgdGhpbmcgaXMgYSBob3N0LlxuICAgIGlmIChob3N0RW5kID09PSAtMSlcbiAgICAgIGhvc3RFbmQgPSByZXN0Lmxlbmd0aDtcblxuICAgIHRoaXMuaG9zdCA9IHJlc3Quc2xpY2UoMCwgaG9zdEVuZCk7XG4gICAgcmVzdCA9IHJlc3Quc2xpY2UoaG9zdEVuZCk7XG5cbiAgICAvLyBwdWxsIG91dCBwb3J0LlxuICAgIHRoaXMucGFyc2VIb3N0KCk7XG5cbiAgICAvLyB3ZSd2ZSBpbmRpY2F0ZWQgdGhhdCB0aGVyZSBpcyBhIGhvc3RuYW1lLFxuICAgIC8vIHNvIGV2ZW4gaWYgaXQncyBlbXB0eSwgaXQgaGFzIHRvIGJlIHByZXNlbnQuXG4gICAgdGhpcy5ob3N0bmFtZSA9IHRoaXMuaG9zdG5hbWUgfHwgJyc7XG5cbiAgICAvLyBpZiBob3N0bmFtZSBiZWdpbnMgd2l0aCBbIGFuZCBlbmRzIHdpdGggXVxuICAgIC8vIGFzc3VtZSB0aGF0IGl0J3MgYW4gSVB2NiBhZGRyZXNzLlxuICAgIHZhciBpcHY2SG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lWzBdID09PSAnWycgJiZcbiAgICAgICAgdGhpcy5ob3N0bmFtZVt0aGlzLmhvc3RuYW1lLmxlbmd0aCAtIDFdID09PSAnXSc7XG5cbiAgICAvLyB2YWxpZGF0ZSBhIGxpdHRsZS5cbiAgICBpZiAoIWlwdjZIb3N0bmFtZSkge1xuICAgICAgdmFyIGhvc3RwYXJ0cyA9IHRoaXMuaG9zdG5hbWUuc3BsaXQoL1xcLi8pO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBob3N0cGFydHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBwYXJ0ID0gaG9zdHBhcnRzW2ldO1xuICAgICAgICBpZiAoIXBhcnQpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoIXBhcnQubWF0Y2goaG9zdG5hbWVQYXJ0UGF0dGVybikpIHtcbiAgICAgICAgICB2YXIgbmV3cGFydCA9ICcnO1xuICAgICAgICAgIGZvciAodmFyIGogPSAwLCBrID0gcGFydC5sZW5ndGg7IGogPCBrOyBqKyspIHtcbiAgICAgICAgICAgIGlmIChwYXJ0LmNoYXJDb2RlQXQoaikgPiAxMjcpIHtcbiAgICAgICAgICAgICAgLy8gd2UgcmVwbGFjZSBub24tQVNDSUkgY2hhciB3aXRoIGEgdGVtcG9yYXJ5IHBsYWNlaG9sZGVyXG4gICAgICAgICAgICAgIC8vIHdlIG5lZWQgdGhpcyB0byBtYWtlIHN1cmUgc2l6ZSBvZiBob3N0bmFtZSBpcyBub3RcbiAgICAgICAgICAgICAgLy8gYnJva2VuIGJ5IHJlcGxhY2luZyBub24tQVNDSUkgYnkgbm90aGluZ1xuICAgICAgICAgICAgICBuZXdwYXJ0ICs9ICd4JztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5ld3BhcnQgKz0gcGFydFtqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gd2UgdGVzdCBhZ2FpbiB3aXRoIEFTQ0lJIGNoYXIgb25seVxuICAgICAgICAgIGlmICghbmV3cGFydC5tYXRjaChob3N0bmFtZVBhcnRQYXR0ZXJuKSkge1xuICAgICAgICAgICAgdmFyIHZhbGlkUGFydHMgPSBob3N0cGFydHMuc2xpY2UoMCwgaSk7XG4gICAgICAgICAgICB2YXIgbm90SG9zdCA9IGhvc3RwYXJ0cy5zbGljZShpICsgMSk7XG4gICAgICAgICAgICB2YXIgYml0ID0gcGFydC5tYXRjaChob3N0bmFtZVBhcnRTdGFydCk7XG4gICAgICAgICAgICBpZiAoYml0KSB7XG4gICAgICAgICAgICAgIHZhbGlkUGFydHMucHVzaChiaXRbMV0pO1xuICAgICAgICAgICAgICBub3RIb3N0LnVuc2hpZnQoYml0WzJdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChub3RIb3N0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICByZXN0ID0gJy8nICsgbm90SG9zdC5qb2luKCcuJykgKyByZXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ob3N0bmFtZSA9IHZhbGlkUGFydHMuam9pbignLicpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaG9zdG5hbWUubGVuZ3RoID4gaG9zdG5hbWVNYXhMZW4pIHtcbiAgICAgIHRoaXMuaG9zdG5hbWUgPSAnJztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaG9zdG5hbWVzIGFyZSBhbHdheXMgbG93ZXIgY2FzZS5cbiAgICAgIHRoaXMuaG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgaWYgKCFpcHY2SG9zdG5hbWUpIHtcbiAgICAgIC8vIElETkEgU3VwcG9ydDogUmV0dXJucyBhIHB1bnljb2RlZCByZXByZXNlbnRhdGlvbiBvZiBcImRvbWFpblwiLlxuICAgICAgLy8gSXQgb25seSBjb252ZXJ0cyBwYXJ0cyBvZiB0aGUgZG9tYWluIG5hbWUgdGhhdFxuICAgICAgLy8gaGF2ZSBub24tQVNDSUkgY2hhcmFjdGVycywgaS5lLiBpdCBkb2Vzbid0IG1hdHRlciBpZlxuICAgICAgLy8geW91IGNhbGwgaXQgd2l0aCBhIGRvbWFpbiB0aGF0IGFscmVhZHkgaXMgQVNDSUktb25seS5cbiAgICAgIHRoaXMuaG9zdG5hbWUgPSBwdW55Y29kZS50b0FTQ0lJKHRoaXMuaG9zdG5hbWUpO1xuICAgIH1cblxuICAgIHZhciBwID0gdGhpcy5wb3J0ID8gJzonICsgdGhpcy5wb3J0IDogJyc7XG4gICAgdmFyIGggPSB0aGlzLmhvc3RuYW1lIHx8ICcnO1xuICAgIHRoaXMuaG9zdCA9IGggKyBwO1xuICAgIHRoaXMuaHJlZiArPSB0aGlzLmhvc3Q7XG5cbiAgICAvLyBzdHJpcCBbIGFuZCBdIGZyb20gdGhlIGhvc3RuYW1lXG4gICAgLy8gdGhlIGhvc3QgZmllbGQgc3RpbGwgcmV0YWlucyB0aGVtLCB0aG91Z2hcbiAgICBpZiAoaXB2Nkhvc3RuYW1lKSB7XG4gICAgICB0aGlzLmhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZS5zdWJzdHIoMSwgdGhpcy5ob3N0bmFtZS5sZW5ndGggLSAyKTtcbiAgICAgIGlmIChyZXN0WzBdICE9PSAnLycpIHtcbiAgICAgICAgcmVzdCA9ICcvJyArIHJlc3Q7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gbm93IHJlc3QgaXMgc2V0IHRvIHRoZSBwb3N0LWhvc3Qgc3R1ZmYuXG4gIC8vIGNob3Agb2ZmIGFueSBkZWxpbSBjaGFycy5cbiAgaWYgKCF1bnNhZmVQcm90b2NvbFtsb3dlclByb3RvXSkge1xuXG4gICAgLy8gRmlyc3QsIG1ha2UgMTAwJSBzdXJlIHRoYXQgYW55IFwiYXV0b0VzY2FwZVwiIGNoYXJzIGdldFxuICAgIC8vIGVzY2FwZWQsIGV2ZW4gaWYgZW5jb2RlVVJJQ29tcG9uZW50IGRvZXNuJ3QgdGhpbmsgdGhleVxuICAgIC8vIG5lZWQgdG8gYmUuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBhdXRvRXNjYXBlLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgdmFyIGFlID0gYXV0b0VzY2FwZVtpXTtcbiAgICAgIGlmIChyZXN0LmluZGV4T2YoYWUpID09PSAtMSlcbiAgICAgICAgY29udGludWU7XG4gICAgICB2YXIgZXNjID0gZW5jb2RlVVJJQ29tcG9uZW50KGFlKTtcbiAgICAgIGlmIChlc2MgPT09IGFlKSB7XG4gICAgICAgIGVzYyA9IGVzY2FwZShhZSk7XG4gICAgICB9XG4gICAgICByZXN0ID0gcmVzdC5zcGxpdChhZSkuam9pbihlc2MpO1xuICAgIH1cbiAgfVxuXG5cbiAgLy8gY2hvcCBvZmYgZnJvbSB0aGUgdGFpbCBmaXJzdC5cbiAgdmFyIGhhc2ggPSByZXN0LmluZGV4T2YoJyMnKTtcbiAgaWYgKGhhc2ggIT09IC0xKSB7XG4gICAgLy8gZ290IGEgZnJhZ21lbnQgc3RyaW5nLlxuICAgIHRoaXMuaGFzaCA9IHJlc3Quc3Vic3RyKGhhc2gpO1xuICAgIHJlc3QgPSByZXN0LnNsaWNlKDAsIGhhc2gpO1xuICB9XG4gIHZhciBxbSA9IHJlc3QuaW5kZXhPZignPycpO1xuICBpZiAocW0gIT09IC0xKSB7XG4gICAgdGhpcy5zZWFyY2ggPSByZXN0LnN1YnN0cihxbSk7XG4gICAgdGhpcy5xdWVyeSA9IHJlc3Quc3Vic3RyKHFtICsgMSk7XG4gICAgaWYgKHBhcnNlUXVlcnlTdHJpbmcpIHtcbiAgICAgIHRoaXMucXVlcnkgPSBxdWVyeXN0cmluZy5wYXJzZSh0aGlzLnF1ZXJ5KTtcbiAgICB9XG4gICAgcmVzdCA9IHJlc3Quc2xpY2UoMCwgcW0pO1xuICB9IGVsc2UgaWYgKHBhcnNlUXVlcnlTdHJpbmcpIHtcbiAgICAvLyBubyBxdWVyeSBzdHJpbmcsIGJ1dCBwYXJzZVF1ZXJ5U3RyaW5nIHN0aWxsIHJlcXVlc3RlZFxuICAgIHRoaXMuc2VhcmNoID0gJyc7XG4gICAgdGhpcy5xdWVyeSA9IHt9O1xuICB9XG4gIGlmIChyZXN0KSB0aGlzLnBhdGhuYW1lID0gcmVzdDtcbiAgaWYgKHNsYXNoZWRQcm90b2NvbFtsb3dlclByb3RvXSAmJlxuICAgICAgdGhpcy5ob3N0bmFtZSAmJiAhdGhpcy5wYXRobmFtZSkge1xuICAgIHRoaXMucGF0aG5hbWUgPSAnLyc7XG4gIH1cblxuICAvL3RvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gIGlmICh0aGlzLnBhdGhuYW1lIHx8IHRoaXMuc2VhcmNoKSB7XG4gICAgdmFyIHAgPSB0aGlzLnBhdGhuYW1lIHx8ICcnO1xuICAgIHZhciBzID0gdGhpcy5zZWFyY2ggfHwgJyc7XG4gICAgdGhpcy5wYXRoID0gcCArIHM7XG4gIH1cblxuICAvLyBmaW5hbGx5LCByZWNvbnN0cnVjdCB0aGUgaHJlZiBiYXNlZCBvbiB3aGF0IGhhcyBiZWVuIHZhbGlkYXRlZC5cbiAgdGhpcy5ocmVmID0gdGhpcy5mb3JtYXQoKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBmb3JtYXQgYSBwYXJzZWQgb2JqZWN0IGludG8gYSB1cmwgc3RyaW5nXG5mdW5jdGlvbiB1cmxGb3JtYXQob2JqKSB7XG4gIC8vIGVuc3VyZSBpdCdzIGFuIG9iamVjdCwgYW5kIG5vdCBhIHN0cmluZyB1cmwuXG4gIC8vIElmIGl0J3MgYW4gb2JqLCB0aGlzIGlzIGEgbm8tb3AuXG4gIC8vIHRoaXMgd2F5LCB5b3UgY2FuIGNhbGwgdXJsX2Zvcm1hdCgpIG9uIHN0cmluZ3NcbiAgLy8gdG8gY2xlYW4gdXAgcG90ZW50aWFsbHkgd29ua3kgdXJscy5cbiAgaWYgKHV0aWwuaXNTdHJpbmcob2JqKSkgb2JqID0gdXJsUGFyc2Uob2JqKTtcbiAgaWYgKCEob2JqIGluc3RhbmNlb2YgVXJsKSkgcmV0dXJuIFVybC5wcm90b3R5cGUuZm9ybWF0LmNhbGwob2JqKTtcbiAgcmV0dXJuIG9iai5mb3JtYXQoKTtcbn1cblxuVXJsLnByb3RvdHlwZS5mb3JtYXQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGF1dGggPSB0aGlzLmF1dGggfHwgJyc7XG4gIGlmIChhdXRoKSB7XG4gICAgYXV0aCA9IGVuY29kZVVSSUNvbXBvbmVudChhdXRoKTtcbiAgICBhdXRoID0gYXV0aC5yZXBsYWNlKC8lM0EvaSwgJzonKTtcbiAgICBhdXRoICs9ICdAJztcbiAgfVxuXG4gIHZhciBwcm90b2NvbCA9IHRoaXMucHJvdG9jb2wgfHwgJycsXG4gICAgICBwYXRobmFtZSA9IHRoaXMucGF0aG5hbWUgfHwgJycsXG4gICAgICBoYXNoID0gdGhpcy5oYXNoIHx8ICcnLFxuICAgICAgaG9zdCA9IGZhbHNlLFxuICAgICAgcXVlcnkgPSAnJztcblxuICBpZiAodGhpcy5ob3N0KSB7XG4gICAgaG9zdCA9IGF1dGggKyB0aGlzLmhvc3Q7XG4gIH0gZWxzZSBpZiAodGhpcy5ob3N0bmFtZSkge1xuICAgIGhvc3QgPSBhdXRoICsgKHRoaXMuaG9zdG5hbWUuaW5kZXhPZignOicpID09PSAtMSA/XG4gICAgICAgIHRoaXMuaG9zdG5hbWUgOlxuICAgICAgICAnWycgKyB0aGlzLmhvc3RuYW1lICsgJ10nKTtcbiAgICBpZiAodGhpcy5wb3J0KSB7XG4gICAgICBob3N0ICs9ICc6JyArIHRoaXMucG9ydDtcbiAgICB9XG4gIH1cblxuICBpZiAodGhpcy5xdWVyeSAmJlxuICAgICAgdXRpbC5pc09iamVjdCh0aGlzLnF1ZXJ5KSAmJlxuICAgICAgT2JqZWN0LmtleXModGhpcy5xdWVyeSkubGVuZ3RoKSB7XG4gICAgcXVlcnkgPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkodGhpcy5xdWVyeSk7XG4gIH1cblxuICB2YXIgc2VhcmNoID0gdGhpcy5zZWFyY2ggfHwgKHF1ZXJ5ICYmICgnPycgKyBxdWVyeSkpIHx8ICcnO1xuXG4gIGlmIChwcm90b2NvbCAmJiBwcm90b2NvbC5zdWJzdHIoLTEpICE9PSAnOicpIHByb3RvY29sICs9ICc6JztcblxuICAvLyBvbmx5IHRoZSBzbGFzaGVkUHJvdG9jb2xzIGdldCB0aGUgLy8uICBOb3QgbWFpbHRvOiwgeG1wcDosIGV0Yy5cbiAgLy8gdW5sZXNzIHRoZXkgaGFkIHRoZW0gdG8gYmVnaW4gd2l0aC5cbiAgaWYgKHRoaXMuc2xhc2hlcyB8fFxuICAgICAgKCFwcm90b2NvbCB8fCBzbGFzaGVkUHJvdG9jb2xbcHJvdG9jb2xdKSAmJiBob3N0ICE9PSBmYWxzZSkge1xuICAgIGhvc3QgPSAnLy8nICsgKGhvc3QgfHwgJycpO1xuICAgIGlmIChwYXRobmFtZSAmJiBwYXRobmFtZS5jaGFyQXQoMCkgIT09ICcvJykgcGF0aG5hbWUgPSAnLycgKyBwYXRobmFtZTtcbiAgfSBlbHNlIGlmICghaG9zdCkge1xuICAgIGhvc3QgPSAnJztcbiAgfVxuXG4gIGlmIChoYXNoICYmIGhhc2guY2hhckF0KDApICE9PSAnIycpIGhhc2ggPSAnIycgKyBoYXNoO1xuICBpZiAoc2VhcmNoICYmIHNlYXJjaC5jaGFyQXQoMCkgIT09ICc/Jykgc2VhcmNoID0gJz8nICsgc2VhcmNoO1xuXG4gIHBhdGhuYW1lID0gcGF0aG5hbWUucmVwbGFjZSgvWz8jXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQobWF0Y2gpO1xuICB9KTtcbiAgc2VhcmNoID0gc2VhcmNoLnJlcGxhY2UoJyMnLCAnJTIzJyk7XG5cbiAgcmV0dXJuIHByb3RvY29sICsgaG9zdCArIHBhdGhuYW1lICsgc2VhcmNoICsgaGFzaDtcbn07XG5cbmZ1bmN0aW9uIHVybFJlc29sdmUoc291cmNlLCByZWxhdGl2ZSkge1xuICByZXR1cm4gdXJsUGFyc2Uoc291cmNlLCBmYWxzZSwgdHJ1ZSkucmVzb2x2ZShyZWxhdGl2ZSk7XG59XG5cblVybC5wcm90b3R5cGUucmVzb2x2ZSA9IGZ1bmN0aW9uKHJlbGF0aXZlKSB7XG4gIHJldHVybiB0aGlzLnJlc29sdmVPYmplY3QodXJsUGFyc2UocmVsYXRpdmUsIGZhbHNlLCB0cnVlKSkuZm9ybWF0KCk7XG59O1xuXG5mdW5jdGlvbiB1cmxSZXNvbHZlT2JqZWN0KHNvdXJjZSwgcmVsYXRpdmUpIHtcbiAgaWYgKCFzb3VyY2UpIHJldHVybiByZWxhdGl2ZTtcbiAgcmV0dXJuIHVybFBhcnNlKHNvdXJjZSwgZmFsc2UsIHRydWUpLnJlc29sdmVPYmplY3QocmVsYXRpdmUpO1xufVxuXG5VcmwucHJvdG90eXBlLnJlc29sdmVPYmplY3QgPSBmdW5jdGlvbihyZWxhdGl2ZSkge1xuICBpZiAodXRpbC5pc1N0cmluZyhyZWxhdGl2ZSkpIHtcbiAgICB2YXIgcmVsID0gbmV3IFVybCgpO1xuICAgIHJlbC5wYXJzZShyZWxhdGl2ZSwgZmFsc2UsIHRydWUpO1xuICAgIHJlbGF0aXZlID0gcmVsO1xuICB9XG5cbiAgdmFyIHJlc3VsdCA9IG5ldyBVcmwoKTtcbiAgdmFyIHRrZXlzID0gT2JqZWN0LmtleXModGhpcyk7XG4gIGZvciAodmFyIHRrID0gMDsgdGsgPCB0a2V5cy5sZW5ndGg7IHRrKyspIHtcbiAgICB2YXIgdGtleSA9IHRrZXlzW3RrXTtcbiAgICByZXN1bHRbdGtleV0gPSB0aGlzW3RrZXldO1xuICB9XG5cbiAgLy8gaGFzaCBpcyBhbHdheXMgb3ZlcnJpZGRlbiwgbm8gbWF0dGVyIHdoYXQuXG4gIC8vIGV2ZW4gaHJlZj1cIlwiIHdpbGwgcmVtb3ZlIGl0LlxuICByZXN1bHQuaGFzaCA9IHJlbGF0aXZlLmhhc2g7XG5cbiAgLy8gaWYgdGhlIHJlbGF0aXZlIHVybCBpcyBlbXB0eSwgdGhlbiB0aGVyZSdzIG5vdGhpbmcgbGVmdCB0byBkbyBoZXJlLlxuICBpZiAocmVsYXRpdmUuaHJlZiA9PT0gJycpIHtcbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gaHJlZnMgbGlrZSAvL2Zvby9iYXIgYWx3YXlzIGN1dCB0byB0aGUgcHJvdG9jb2wuXG4gIGlmIChyZWxhdGl2ZS5zbGFzaGVzICYmICFyZWxhdGl2ZS5wcm90b2NvbCkge1xuICAgIC8vIHRha2UgZXZlcnl0aGluZyBleGNlcHQgdGhlIHByb3RvY29sIGZyb20gcmVsYXRpdmVcbiAgICB2YXIgcmtleXMgPSBPYmplY3Qua2V5cyhyZWxhdGl2ZSk7XG4gICAgZm9yICh2YXIgcmsgPSAwOyByayA8IHJrZXlzLmxlbmd0aDsgcmsrKykge1xuICAgICAgdmFyIHJrZXkgPSBya2V5c1tya107XG4gICAgICBpZiAocmtleSAhPT0gJ3Byb3RvY29sJylcbiAgICAgICAgcmVzdWx0W3JrZXldID0gcmVsYXRpdmVbcmtleV07XG4gICAgfVxuXG4gICAgLy91cmxQYXJzZSBhcHBlbmRzIHRyYWlsaW5nIC8gdG8gdXJscyBsaWtlIGh0dHA6Ly93d3cuZXhhbXBsZS5jb21cbiAgICBpZiAoc2xhc2hlZFByb3RvY29sW3Jlc3VsdC5wcm90b2NvbF0gJiZcbiAgICAgICAgcmVzdWx0Lmhvc3RuYW1lICYmICFyZXN1bHQucGF0aG5hbWUpIHtcbiAgICAgIHJlc3VsdC5wYXRoID0gcmVzdWx0LnBhdGhuYW1lID0gJy8nO1xuICAgIH1cblxuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBpZiAocmVsYXRpdmUucHJvdG9jb2wgJiYgcmVsYXRpdmUucHJvdG9jb2wgIT09IHJlc3VsdC5wcm90b2NvbCkge1xuICAgIC8vIGlmIGl0J3MgYSBrbm93biB1cmwgcHJvdG9jb2wsIHRoZW4gY2hhbmdpbmdcbiAgICAvLyB0aGUgcHJvdG9jb2wgZG9lcyB3ZWlyZCB0aGluZ3NcbiAgICAvLyBmaXJzdCwgaWYgaXQncyBub3QgZmlsZTosIHRoZW4gd2UgTVVTVCBoYXZlIGEgaG9zdCxcbiAgICAvLyBhbmQgaWYgdGhlcmUgd2FzIGEgcGF0aFxuICAgIC8vIHRvIGJlZ2luIHdpdGgsIHRoZW4gd2UgTVVTVCBoYXZlIGEgcGF0aC5cbiAgICAvLyBpZiBpdCBpcyBmaWxlOiwgdGhlbiB0aGUgaG9zdCBpcyBkcm9wcGVkLFxuICAgIC8vIGJlY2F1c2UgdGhhdCdzIGtub3duIHRvIGJlIGhvc3RsZXNzLlxuICAgIC8vIGFueXRoaW5nIGVsc2UgaXMgYXNzdW1lZCB0byBiZSBhYnNvbHV0ZS5cbiAgICBpZiAoIXNsYXNoZWRQcm90b2NvbFtyZWxhdGl2ZS5wcm90b2NvbF0pIHtcbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMocmVsYXRpdmUpO1xuICAgICAgZm9yICh2YXIgdiA9IDA7IHYgPCBrZXlzLmxlbmd0aDsgdisrKSB7XG4gICAgICAgIHZhciBrID0ga2V5c1t2XTtcbiAgICAgICAgcmVzdWx0W2tdID0gcmVsYXRpdmVba107XG4gICAgICB9XG4gICAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgcmVzdWx0LnByb3RvY29sID0gcmVsYXRpdmUucHJvdG9jb2w7XG4gICAgaWYgKCFyZWxhdGl2ZS5ob3N0ICYmICFob3N0bGVzc1Byb3RvY29sW3JlbGF0aXZlLnByb3RvY29sXSkge1xuICAgICAgdmFyIHJlbFBhdGggPSAocmVsYXRpdmUucGF0aG5hbWUgfHwgJycpLnNwbGl0KCcvJyk7XG4gICAgICB3aGlsZSAocmVsUGF0aC5sZW5ndGggJiYgIShyZWxhdGl2ZS5ob3N0ID0gcmVsUGF0aC5zaGlmdCgpKSk7XG4gICAgICBpZiAoIXJlbGF0aXZlLmhvc3QpIHJlbGF0aXZlLmhvc3QgPSAnJztcbiAgICAgIGlmICghcmVsYXRpdmUuaG9zdG5hbWUpIHJlbGF0aXZlLmhvc3RuYW1lID0gJyc7XG4gICAgICBpZiAocmVsUGF0aFswXSAhPT0gJycpIHJlbFBhdGgudW5zaGlmdCgnJyk7XG4gICAgICBpZiAocmVsUGF0aC5sZW5ndGggPCAyKSByZWxQYXRoLnVuc2hpZnQoJycpO1xuICAgICAgcmVzdWx0LnBhdGhuYW1lID0gcmVsUGF0aC5qb2luKCcvJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5wYXRobmFtZSA9IHJlbGF0aXZlLnBhdGhuYW1lO1xuICAgIH1cbiAgICByZXN1bHQuc2VhcmNoID0gcmVsYXRpdmUuc2VhcmNoO1xuICAgIHJlc3VsdC5xdWVyeSA9IHJlbGF0aXZlLnF1ZXJ5O1xuICAgIHJlc3VsdC5ob3N0ID0gcmVsYXRpdmUuaG9zdCB8fCAnJztcbiAgICByZXN1bHQuYXV0aCA9IHJlbGF0aXZlLmF1dGg7XG4gICAgcmVzdWx0Lmhvc3RuYW1lID0gcmVsYXRpdmUuaG9zdG5hbWUgfHwgcmVsYXRpdmUuaG9zdDtcbiAgICByZXN1bHQucG9ydCA9IHJlbGF0aXZlLnBvcnQ7XG4gICAgLy8gdG8gc3VwcG9ydCBodHRwLnJlcXVlc3RcbiAgICBpZiAocmVzdWx0LnBhdGhuYW1lIHx8IHJlc3VsdC5zZWFyY2gpIHtcbiAgICAgIHZhciBwID0gcmVzdWx0LnBhdGhuYW1lIHx8ICcnO1xuICAgICAgdmFyIHMgPSByZXN1bHQuc2VhcmNoIHx8ICcnO1xuICAgICAgcmVzdWx0LnBhdGggPSBwICsgcztcbiAgICB9XG4gICAgcmVzdWx0LnNsYXNoZXMgPSByZXN1bHQuc2xhc2hlcyB8fCByZWxhdGl2ZS5zbGFzaGVzO1xuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICB2YXIgaXNTb3VyY2VBYnMgPSAocmVzdWx0LnBhdGhuYW1lICYmIHJlc3VsdC5wYXRobmFtZS5jaGFyQXQoMCkgPT09ICcvJyksXG4gICAgICBpc1JlbEFicyA9IChcbiAgICAgICAgICByZWxhdGl2ZS5ob3N0IHx8XG4gICAgICAgICAgcmVsYXRpdmUucGF0aG5hbWUgJiYgcmVsYXRpdmUucGF0aG5hbWUuY2hhckF0KDApID09PSAnLydcbiAgICAgICksXG4gICAgICBtdXN0RW5kQWJzID0gKGlzUmVsQWJzIHx8IGlzU291cmNlQWJzIHx8XG4gICAgICAgICAgICAgICAgICAgIChyZXN1bHQuaG9zdCAmJiByZWxhdGl2ZS5wYXRobmFtZSkpLFxuICAgICAgcmVtb3ZlQWxsRG90cyA9IG11c3RFbmRBYnMsXG4gICAgICBzcmNQYXRoID0gcmVzdWx0LnBhdGhuYW1lICYmIHJlc3VsdC5wYXRobmFtZS5zcGxpdCgnLycpIHx8IFtdLFxuICAgICAgcmVsUGF0aCA9IHJlbGF0aXZlLnBhdGhuYW1lICYmIHJlbGF0aXZlLnBhdGhuYW1lLnNwbGl0KCcvJykgfHwgW10sXG4gICAgICBwc3ljaG90aWMgPSByZXN1bHQucHJvdG9jb2wgJiYgIXNsYXNoZWRQcm90b2NvbFtyZXN1bHQucHJvdG9jb2xdO1xuXG4gIC8vIGlmIHRoZSB1cmwgaXMgYSBub24tc2xhc2hlZCB1cmwsIHRoZW4gcmVsYXRpdmVcbiAgLy8gbGlua3MgbGlrZSAuLi8uLiBzaG91bGQgYmUgYWJsZVxuICAvLyB0byBjcmF3bCB1cCB0byB0aGUgaG9zdG5hbWUsIGFzIHdlbGwuICBUaGlzIGlzIHN0cmFuZ2UuXG4gIC8vIHJlc3VsdC5wcm90b2NvbCBoYXMgYWxyZWFkeSBiZWVuIHNldCBieSBub3cuXG4gIC8vIExhdGVyIG9uLCBwdXQgdGhlIGZpcnN0IHBhdGggcGFydCBpbnRvIHRoZSBob3N0IGZpZWxkLlxuICBpZiAocHN5Y2hvdGljKSB7XG4gICAgcmVzdWx0Lmhvc3RuYW1lID0gJyc7XG4gICAgcmVzdWx0LnBvcnQgPSBudWxsO1xuICAgIGlmIChyZXN1bHQuaG9zdCkge1xuICAgICAgaWYgKHNyY1BhdGhbMF0gPT09ICcnKSBzcmNQYXRoWzBdID0gcmVzdWx0Lmhvc3Q7XG4gICAgICBlbHNlIHNyY1BhdGgudW5zaGlmdChyZXN1bHQuaG9zdCk7XG4gICAgfVxuICAgIHJlc3VsdC5ob3N0ID0gJyc7XG4gICAgaWYgKHJlbGF0aXZlLnByb3RvY29sKSB7XG4gICAgICByZWxhdGl2ZS5ob3N0bmFtZSA9IG51bGw7XG4gICAgICByZWxhdGl2ZS5wb3J0ID0gbnVsbDtcbiAgICAgIGlmIChyZWxhdGl2ZS5ob3N0KSB7XG4gICAgICAgIGlmIChyZWxQYXRoWzBdID09PSAnJykgcmVsUGF0aFswXSA9IHJlbGF0aXZlLmhvc3Q7XG4gICAgICAgIGVsc2UgcmVsUGF0aC51bnNoaWZ0KHJlbGF0aXZlLmhvc3QpO1xuICAgICAgfVxuICAgICAgcmVsYXRpdmUuaG9zdCA9IG51bGw7XG4gICAgfVxuICAgIG11c3RFbmRBYnMgPSBtdXN0RW5kQWJzICYmIChyZWxQYXRoWzBdID09PSAnJyB8fCBzcmNQYXRoWzBdID09PSAnJyk7XG4gIH1cblxuICBpZiAoaXNSZWxBYnMpIHtcbiAgICAvLyBpdCdzIGFic29sdXRlLlxuICAgIHJlc3VsdC5ob3N0ID0gKHJlbGF0aXZlLmhvc3QgfHwgcmVsYXRpdmUuaG9zdCA9PT0gJycpID9cbiAgICAgICAgICAgICAgICAgIHJlbGF0aXZlLmhvc3QgOiByZXN1bHQuaG9zdDtcbiAgICByZXN1bHQuaG9zdG5hbWUgPSAocmVsYXRpdmUuaG9zdG5hbWUgfHwgcmVsYXRpdmUuaG9zdG5hbWUgPT09ICcnKSA/XG4gICAgICAgICAgICAgICAgICAgICAgcmVsYXRpdmUuaG9zdG5hbWUgOiByZXN1bHQuaG9zdG5hbWU7XG4gICAgcmVzdWx0LnNlYXJjaCA9IHJlbGF0aXZlLnNlYXJjaDtcbiAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgICBzcmNQYXRoID0gcmVsUGF0aDtcbiAgICAvLyBmYWxsIHRocm91Z2ggdG8gdGhlIGRvdC1oYW5kbGluZyBiZWxvdy5cbiAgfSBlbHNlIGlmIChyZWxQYXRoLmxlbmd0aCkge1xuICAgIC8vIGl0J3MgcmVsYXRpdmVcbiAgICAvLyB0aHJvdyBhd2F5IHRoZSBleGlzdGluZyBmaWxlLCBhbmQgdGFrZSB0aGUgbmV3IHBhdGggaW5zdGVhZC5cbiAgICBpZiAoIXNyY1BhdGgpIHNyY1BhdGggPSBbXTtcbiAgICBzcmNQYXRoLnBvcCgpO1xuICAgIHNyY1BhdGggPSBzcmNQYXRoLmNvbmNhdChyZWxQYXRoKTtcbiAgICByZXN1bHQuc2VhcmNoID0gcmVsYXRpdmUuc2VhcmNoO1xuICAgIHJlc3VsdC5xdWVyeSA9IHJlbGF0aXZlLnF1ZXJ5O1xuICB9IGVsc2UgaWYgKCF1dGlsLmlzTnVsbE9yVW5kZWZpbmVkKHJlbGF0aXZlLnNlYXJjaCkpIHtcbiAgICAvLyBqdXN0IHB1bGwgb3V0IHRoZSBzZWFyY2guXG4gICAgLy8gbGlrZSBocmVmPSc/Zm9vJy5cbiAgICAvLyBQdXQgdGhpcyBhZnRlciB0aGUgb3RoZXIgdHdvIGNhc2VzIGJlY2F1c2UgaXQgc2ltcGxpZmllcyB0aGUgYm9vbGVhbnNcbiAgICBpZiAocHN5Y2hvdGljKSB7XG4gICAgICByZXN1bHQuaG9zdG5hbWUgPSByZXN1bHQuaG9zdCA9IHNyY1BhdGguc2hpZnQoKTtcbiAgICAgIC8vb2NjYXRpb25hbHkgdGhlIGF1dGggY2FuIGdldCBzdHVjayBvbmx5IGluIGhvc3RcbiAgICAgIC8vdGhpcyBlc3BlY2lhbGx5IGhhcHBlbnMgaW4gY2FzZXMgbGlrZVxuICAgICAgLy91cmwucmVzb2x2ZU9iamVjdCgnbWFpbHRvOmxvY2FsMUBkb21haW4xJywgJ2xvY2FsMkBkb21haW4yJylcbiAgICAgIHZhciBhdXRoSW5Ib3N0ID0gcmVzdWx0Lmhvc3QgJiYgcmVzdWx0Lmhvc3QuaW5kZXhPZignQCcpID4gMCA/XG4gICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5ob3N0LnNwbGl0KCdAJykgOiBmYWxzZTtcbiAgICAgIGlmIChhdXRoSW5Ib3N0KSB7XG4gICAgICAgIHJlc3VsdC5hdXRoID0gYXV0aEluSG9zdC5zaGlmdCgpO1xuICAgICAgICByZXN1bHQuaG9zdCA9IHJlc3VsdC5ob3N0bmFtZSA9IGF1dGhJbkhvc3Quc2hpZnQoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmVzdWx0LnNlYXJjaCA9IHJlbGF0aXZlLnNlYXJjaDtcbiAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgICAvL3RvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgaWYgKCF1dGlsLmlzTnVsbChyZXN1bHQucGF0aG5hbWUpIHx8ICF1dGlsLmlzTnVsbChyZXN1bHQuc2VhcmNoKSkge1xuICAgICAgcmVzdWx0LnBhdGggPSAocmVzdWx0LnBhdGhuYW1lID8gcmVzdWx0LnBhdGhuYW1lIDogJycpICtcbiAgICAgICAgICAgICAgICAgICAgKHJlc3VsdC5zZWFyY2ggPyByZXN1bHQuc2VhcmNoIDogJycpO1xuICAgIH1cbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgaWYgKCFzcmNQYXRoLmxlbmd0aCkge1xuICAgIC8vIG5vIHBhdGggYXQgYWxsLiAgZWFzeS5cbiAgICAvLyB3ZSd2ZSBhbHJlYWR5IGhhbmRsZWQgdGhlIG90aGVyIHN0dWZmIGFib3ZlLlxuICAgIHJlc3VsdC5wYXRobmFtZSA9IG51bGw7XG4gICAgLy90byBzdXBwb3J0IGh0dHAucmVxdWVzdFxuICAgIGlmIChyZXN1bHQuc2VhcmNoKSB7XG4gICAgICByZXN1bHQucGF0aCA9ICcvJyArIHJlc3VsdC5zZWFyY2g7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5wYXRoID0gbnVsbDtcbiAgICB9XG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIGlmIGEgdXJsIEVORHMgaW4gLiBvciAuLiwgdGhlbiBpdCBtdXN0IGdldCBhIHRyYWlsaW5nIHNsYXNoLlxuICAvLyBob3dldmVyLCBpZiBpdCBlbmRzIGluIGFueXRoaW5nIGVsc2Ugbm9uLXNsYXNoeSxcbiAgLy8gdGhlbiBpdCBtdXN0IE5PVCBnZXQgYSB0cmFpbGluZyBzbGFzaC5cbiAgdmFyIGxhc3QgPSBzcmNQYXRoLnNsaWNlKC0xKVswXTtcbiAgdmFyIGhhc1RyYWlsaW5nU2xhc2ggPSAoXG4gICAgICAocmVzdWx0Lmhvc3QgfHwgcmVsYXRpdmUuaG9zdCB8fCBzcmNQYXRoLmxlbmd0aCA+IDEpICYmXG4gICAgICAobGFzdCA9PT0gJy4nIHx8IGxhc3QgPT09ICcuLicpIHx8IGxhc3QgPT09ICcnKTtcblxuICAvLyBzdHJpcCBzaW5nbGUgZG90cywgcmVzb2x2ZSBkb3VibGUgZG90cyB0byBwYXJlbnQgZGlyXG4gIC8vIGlmIHRoZSBwYXRoIHRyaWVzIHRvIGdvIGFib3ZlIHRoZSByb290LCBgdXBgIGVuZHMgdXAgPiAwXG4gIHZhciB1cCA9IDA7XG4gIGZvciAodmFyIGkgPSBzcmNQYXRoLmxlbmd0aDsgaSA+PSAwOyBpLS0pIHtcbiAgICBsYXN0ID0gc3JjUGF0aFtpXTtcbiAgICBpZiAobGFzdCA9PT0gJy4nKSB7XG4gICAgICBzcmNQYXRoLnNwbGljZShpLCAxKTtcbiAgICB9IGVsc2UgaWYgKGxhc3QgPT09ICcuLicpIHtcbiAgICAgIHNyY1BhdGguc3BsaWNlKGksIDEpO1xuICAgICAgdXArKztcbiAgICB9IGVsc2UgaWYgKHVwKSB7XG4gICAgICBzcmNQYXRoLnNwbGljZShpLCAxKTtcbiAgICAgIHVwLS07XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgdGhlIHBhdGggaXMgYWxsb3dlZCB0byBnbyBhYm92ZSB0aGUgcm9vdCwgcmVzdG9yZSBsZWFkaW5nIC4uc1xuICBpZiAoIW11c3RFbmRBYnMgJiYgIXJlbW92ZUFsbERvdHMpIHtcbiAgICBmb3IgKDsgdXAtLTsgdXApIHtcbiAgICAgIHNyY1BhdGgudW5zaGlmdCgnLi4nKTtcbiAgICB9XG4gIH1cblxuICBpZiAobXVzdEVuZEFicyAmJiBzcmNQYXRoWzBdICE9PSAnJyAmJlxuICAgICAgKCFzcmNQYXRoWzBdIHx8IHNyY1BhdGhbMF0uY2hhckF0KDApICE9PSAnLycpKSB7XG4gICAgc3JjUGF0aC51bnNoaWZ0KCcnKTtcbiAgfVxuXG4gIGlmIChoYXNUcmFpbGluZ1NsYXNoICYmIChzcmNQYXRoLmpvaW4oJy8nKS5zdWJzdHIoLTEpICE9PSAnLycpKSB7XG4gICAgc3JjUGF0aC5wdXNoKCcnKTtcbiAgfVxuXG4gIHZhciBpc0Fic29sdXRlID0gc3JjUGF0aFswXSA9PT0gJycgfHxcbiAgICAgIChzcmNQYXRoWzBdICYmIHNyY1BhdGhbMF0uY2hhckF0KDApID09PSAnLycpO1xuXG4gIC8vIHB1dCB0aGUgaG9zdCBiYWNrXG4gIGlmIChwc3ljaG90aWMpIHtcbiAgICByZXN1bHQuaG9zdG5hbWUgPSByZXN1bHQuaG9zdCA9IGlzQWJzb2x1dGUgPyAnJyA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmNQYXRoLmxlbmd0aCA/IHNyY1BhdGguc2hpZnQoKSA6ICcnO1xuICAgIC8vb2NjYXRpb25hbHkgdGhlIGF1dGggY2FuIGdldCBzdHVjayBvbmx5IGluIGhvc3RcbiAgICAvL3RoaXMgZXNwZWNpYWxseSBoYXBwZW5zIGluIGNhc2VzIGxpa2VcbiAgICAvL3VybC5yZXNvbHZlT2JqZWN0KCdtYWlsdG86bG9jYWwxQGRvbWFpbjEnLCAnbG9jYWwyQGRvbWFpbjInKVxuICAgIHZhciBhdXRoSW5Ib3N0ID0gcmVzdWx0Lmhvc3QgJiYgcmVzdWx0Lmhvc3QuaW5kZXhPZignQCcpID4gMCA/XG4gICAgICAgICAgICAgICAgICAgICByZXN1bHQuaG9zdC5zcGxpdCgnQCcpIDogZmFsc2U7XG4gICAgaWYgKGF1dGhJbkhvc3QpIHtcbiAgICAgIHJlc3VsdC5hdXRoID0gYXV0aEluSG9zdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0Lmhvc3QgPSByZXN1bHQuaG9zdG5hbWUgPSBhdXRoSW5Ib3N0LnNoaWZ0KCk7XG4gICAgfVxuICB9XG5cbiAgbXVzdEVuZEFicyA9IG11c3RFbmRBYnMgfHwgKHJlc3VsdC5ob3N0ICYmIHNyY1BhdGgubGVuZ3RoKTtcblxuICBpZiAobXVzdEVuZEFicyAmJiAhaXNBYnNvbHV0ZSkge1xuICAgIHNyY1BhdGgudW5zaGlmdCgnJyk7XG4gIH1cblxuICBpZiAoIXNyY1BhdGgubGVuZ3RoKSB7XG4gICAgcmVzdWx0LnBhdGhuYW1lID0gbnVsbDtcbiAgICByZXN1bHQucGF0aCA9IG51bGw7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0LnBhdGhuYW1lID0gc3JjUGF0aC5qb2luKCcvJyk7XG4gIH1cblxuICAvL3RvIHN1cHBvcnQgcmVxdWVzdC5odHRwXG4gIGlmICghdXRpbC5pc051bGwocmVzdWx0LnBhdGhuYW1lKSB8fCAhdXRpbC5pc051bGwocmVzdWx0LnNlYXJjaCkpIHtcbiAgICByZXN1bHQucGF0aCA9IChyZXN1bHQucGF0aG5hbWUgPyByZXN1bHQucGF0aG5hbWUgOiAnJykgK1xuICAgICAgICAgICAgICAgICAgKHJlc3VsdC5zZWFyY2ggPyByZXN1bHQuc2VhcmNoIDogJycpO1xuICB9XG4gIHJlc3VsdC5hdXRoID0gcmVsYXRpdmUuYXV0aCB8fCByZXN1bHQuYXV0aDtcbiAgcmVzdWx0LnNsYXNoZXMgPSByZXN1bHQuc2xhc2hlcyB8fCByZWxhdGl2ZS5zbGFzaGVzO1xuICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cblVybC5wcm90b3R5cGUucGFyc2VIb3N0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBob3N0ID0gdGhpcy5ob3N0O1xuICB2YXIgcG9ydCA9IHBvcnRQYXR0ZXJuLmV4ZWMoaG9zdCk7XG4gIGlmIChwb3J0KSB7XG4gICAgcG9ydCA9IHBvcnRbMF07XG4gICAgaWYgKHBvcnQgIT09ICc6Jykge1xuICAgICAgdGhpcy5wb3J0ID0gcG9ydC5zdWJzdHIoMSk7XG4gICAgfVxuICAgIGhvc3QgPSBob3N0LnN1YnN0cigwLCBob3N0Lmxlbmd0aCAtIHBvcnQubGVuZ3RoKTtcbiAgfVxuICBpZiAoaG9zdCkgdGhpcy5ob3N0bmFtZSA9IGhvc3Q7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaXNTdHJpbmc6IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiB0eXBlb2YoYXJnKSA9PT0gJ3N0cmluZyc7XG4gIH0sXG4gIGlzT2JqZWN0OiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gdHlwZW9mKGFyZykgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbiAgfSxcbiAgaXNOdWxsOiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gYXJnID09PSBudWxsO1xuICB9LFxuICBpc051bGxPclVuZGVmaW5lZDogZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIGFyZyA9PSBudWxsO1xuICB9XG59O1xuIiwiXG4vKipcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZGVwcmVjYXRlO1xuXG4vKipcbiAqIE1hcmsgdGhhdCBhIG1ldGhvZCBzaG91bGQgbm90IGJlIHVzZWQuXG4gKiBSZXR1cm5zIGEgbW9kaWZpZWQgZnVuY3Rpb24gd2hpY2ggd2FybnMgb25jZSBieSBkZWZhdWx0LlxuICpcbiAqIElmIGBsb2NhbFN0b3JhZ2Uubm9EZXByZWNhdGlvbiA9IHRydWVgIGlzIHNldCwgdGhlbiBpdCBpcyBhIG5vLW9wLlxuICpcbiAqIElmIGBsb2NhbFN0b3JhZ2UudGhyb3dEZXByZWNhdGlvbiA9IHRydWVgIGlzIHNldCwgdGhlbiBkZXByZWNhdGVkIGZ1bmN0aW9uc1xuICogd2lsbCB0aHJvdyBhbiBFcnJvciB3aGVuIGludm9rZWQuXG4gKlxuICogSWYgYGxvY2FsU3RvcmFnZS50cmFjZURlcHJlY2F0aW9uID0gdHJ1ZWAgaXMgc2V0LCB0aGVuIGRlcHJlY2F0ZWQgZnVuY3Rpb25zXG4gKiB3aWxsIGludm9rZSBgY29uc29sZS50cmFjZSgpYCBpbnN0ZWFkIG9mIGBjb25zb2xlLmVycm9yKClgLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIC0gdGhlIGZ1bmN0aW9uIHRvIGRlcHJlY2F0ZVxuICogQHBhcmFtIHtTdHJpbmd9IG1zZyAtIHRoZSBzdHJpbmcgdG8gcHJpbnQgdG8gdGhlIGNvbnNvbGUgd2hlbiBgZm5gIGlzIGludm9rZWRcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gYSBuZXcgXCJkZXByZWNhdGVkXCIgdmVyc2lvbiBvZiBgZm5gXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRlcHJlY2F0ZSAoZm4sIG1zZykge1xuICBpZiAoY29uZmlnKCdub0RlcHJlY2F0aW9uJykpIHtcbiAgICByZXR1cm4gZm47XG4gIH1cblxuICB2YXIgd2FybmVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGRlcHJlY2F0ZWQoKSB7XG4gICAgaWYgKCF3YXJuZWQpIHtcbiAgICAgIGlmIChjb25maWcoJ3Rocm93RGVwcmVjYXRpb24nKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICAgIH0gZWxzZSBpZiAoY29uZmlnKCd0cmFjZURlcHJlY2F0aW9uJykpIHtcbiAgICAgICAgY29uc29sZS50cmFjZShtc2cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS53YXJuKG1zZyk7XG4gICAgICB9XG4gICAgICB3YXJuZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBkZXByZWNhdGVkO1xufVxuXG4vKipcbiAqIENoZWNrcyBgbG9jYWxTdG9yYWdlYCBmb3IgYm9vbGVhbiB2YWx1ZXMgZm9yIHRoZSBnaXZlbiBgbmFtZWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29uZmlnIChuYW1lKSB7XG4gIC8vIGFjY2Vzc2luZyBnbG9iYWwubG9jYWxTdG9yYWdlIGNhbiB0cmlnZ2VyIGEgRE9NRXhjZXB0aW9uIGluIHNhbmRib3hlZCBpZnJhbWVzXG4gIHRyeSB7XG4gICAgaWYgKCFnbG9iYWwubG9jYWxTdG9yYWdlKSByZXR1cm4gZmFsc2U7XG4gIH0gY2F0Y2ggKF8pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIHZhbCA9IGdsb2JhbC5sb2NhbFN0b3JhZ2VbbmFtZV07XG4gIGlmIChudWxsID09IHZhbCkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gU3RyaW5nKHZhbCkudG9Mb3dlckNhc2UoKSA9PT0gJ3RydWUnO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBleHRlbmRcblxudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuZnVuY3Rpb24gZXh0ZW5kKCkge1xuICAgIHZhciB0YXJnZXQgPSB7fVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXVxuXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwga2V5KSkge1xuICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gc291cmNlW2tleV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXRcbn1cbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJuYW1lXCI6IFwicHJpc21pYy5pb1wiLFxuICBcImRlc2NyaXB0aW9uXCI6IFwiSmF2YVNjcmlwdCBkZXZlbG9wbWVudCBraXQgZm9yIHByaXNtaWMuaW9cIixcbiAgXCJsaWNlbnNlXCI6IFwiQXBhY2hlLTIuMFwiLFxuICBcInVybFwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS9wcmlzbWljaW8vamF2YXNjcmlwdC1raXRcIixcbiAgXCJrZXl3b3Jkc1wiOiBbXG4gICAgXCJwcmlzbWljXCIsXG4gICAgXCJwcmlzbWljLmlvXCIsXG4gICAgXCJjbXNcIixcbiAgICBcImNvbnRlbnRcIixcbiAgICBcImFwaVwiXG4gIF0sXG4gIFwidmVyc2lvblwiOiBcIjIuMC4wXCIsXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJhYmVsLXByZXNldC1lczIwMTVcIjogXCJeNi4zLjEzXCIsXG4gICAgXCJiYWJlbGlmeVwiOiBcIl43LjIuMFwiLFxuICAgIFwiYnJvd3NlcmlmeVwiOiBcIl4xMi4wLjFcIixcbiAgICBcImNoYWlcIjogXCIqXCIsXG4gICAgXCJjb2RlY2xpbWF0ZS10ZXN0LXJlcG9ydGVyXCI6IFwifjAuMC40XCIsXG4gICAgXCJndWxwXCI6IFwifjMuOS4wXCIsXG4gICAgXCJndWxwLWdoLXBhZ2VzXCI6IFwifjAuNS4wXCIsXG4gICAgXCJndWxwLWdpc3RcIjogXCJ+MS4wLjNcIixcbiAgICBcImd1bHAtanNkb2NcIjogXCJ+MC4xLjRcIixcbiAgICBcImd1bHAtanNoaW50XCI6IFwifjEuMTEuMlwiLFxuICAgIFwiZ3VscC1tb2NoYS1waGFudG9tanNcIjogXCJnaXQ6Ly9naXRodWIuY29tL2Vyd2FuL2d1bHAtbW9jaGEtcGhhbnRvbWpzLmdpdCNwaGFudG9tanMxOThcIixcbiAgICBcImd1bHAtc291cmNlbWFwc1wiOiBcIl4xLjYuMFwiLFxuICAgIFwiZ3VscC11Z2xpZnlcIjogXCJ+MS4yLjBcIixcbiAgICBcImd1bHAtdXRpbFwiOiBcIn4zLjAuNlwiLFxuICAgIFwibW9jaGFcIjogXCIqXCIsXG4gICAgXCJzb3VyY2UtbWFwLXN1cHBvcnRcIjogXCJeMC40LjBcIixcbiAgICBcInZpbnlsLWJ1ZmZlclwiOiBcIl4xLjAuMFwiLFxuICAgIFwidmlueWwtc291cmNlLXN0cmVhbVwiOiBcIl4xLjEuMFwiXG4gIH0sXG4gIFwicmVwb3NpdG9yeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiZ2l0XCIsXG4gICAgXCJ1cmxcIjogXCJodHRwOi8vZ2l0aHViLmNvbS9wcmlzbWljaW8vamF2YXNjcmlwdC1raXQuZ2l0XCJcbiAgfSxcbiAgXCJtYWluXCI6IFwibGliL2luZGV4LmpzXCIsXG4gIFwic2NyaXB0c1wiOiB7XG4gICAgXCJ0ZXN0XCI6IFwiZ3VscCB0ZXN0XCJcbiAgfVxufVxuIl19
