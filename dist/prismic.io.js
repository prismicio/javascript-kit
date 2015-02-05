(function() {

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

})();
(function (Global, undefined) {

    "use strict";

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
    var prismic = function(url, callback, maybeAccessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL) {
        var api = new prismic.fn.init(url, maybeAccessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL);
        //Use cached api data if available
        api.get(function (err, data) {
            if (callback && err) { return callback(err); }

            if (data) {
                api.data = data;
                api.bookmarks = data.bookmarks;
                api.experiments = new Global.Prismic.Experiments(data.experiments);
            }

            if (callback) { return callback(null, api); }
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
        get: function(callback) {
            var self = this;
            var cacheKey = this.apiCacheKey;

            this.apiCache.get(cacheKey, function (err, value) {
                if (err) { return callback(err); }
                if (value) { return callback(null, value); }

                self.requestHandler(self.url, function(err, data, xhr, ttl) {
                    if (err) { return callback(err, null, xhr); }

                    var parsed = self.parse(data);
                    ttl = ttl | self.apiDataTTL;

                    self.apiCache.set(cacheKey, parsed, ttl, function (err) {
                        if (err) { return callback(err, null, xhr); }
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
        refresh: function (callback) {
            var self = this;
            var cacheKey = this.apiCacheKey;

            this.apiCache.remove(cacheKey, function (err) {
                if (callback && err) { return callback(err); }
                if (!callback && err) { throw err; }

                self.get(function (err, data, xhr) {
                    if (callback && err) { return callback(err); }
                    if (!callback && err) { throw err; }

                    self.data = data;
                    self.bookmarks = data.bookmarks;
                    self.experiments = new Global.Prismic.Experiments(data.experiments);

                    if (callback) { return callback(); }
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
        parse: function(data) {
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

                    if(this.accessToken) {
                        f.fields['access_token'] = {};
                        f.fields['access_token']['type'] = 'string';
                        f.fields['access_token']['default'] = this.accessToken;
                    }

                    form = new Form(
                        f.name,
                        f.fields,
                        f.form_method,
                        f.rel,
                        f.enctype,
                        f.action
                    );

                    forms[i] = form;
                }
            }

            refs = data.refs.map(function (r) {
                return new Ref(
                    r.ref,
                    r.label,
                    r.isMasterRef,
                    r.scheduledAt,
                    r.id
                );
            }) || [];

            master = refs.filter(function (r) {
                return r.isMaster === true;
            });

            types = data.types;

            tags = data.tags;

            if (master.length === 0) {
                throw ("No master ref.");
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
        init: function(url, accessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL) {
            this.url = url + (accessToken ? (url.indexOf('?') > -1 ? '&' : '?') + 'access_token=' + accessToken : '');
            this.accessToken = accessToken;
            this.requestHandler = maybeRequestHandler || Global.Prismic.Utils.request();
            this.apiCache = maybeApiCache || new ApiCache();
            this.apiCacheKey = this.url + (this.accessToken ? ('#' + this.accessToken) : '');
            this.apiDataTTL = maybeApiDataTTL || 5;
            return this;
        },

        /**
         * @deprecated use form() now
         * @param {string} formId - The id of a form, like "everything", or "products"
         * @returns {SearchForm} - the SearchForm that can be used.
         */
        forms: function(formId) {
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
        form: function(formId) {
            var form = this.data.forms[formId];
            if(form) {
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
        master: function() {
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
        ref: function(label) {
            for(var i=0; i<this.data.refs.length; i++) {
                if(this.data.refs[i].label == label) {
                    return this.data.refs[i].ref;
                }
            }
        },

        /**
         * The current experiment, or null
         * @returns {Experiment}
         */
        currentExperiment: function() {
            return this.experiments.current();
        },

        /**
         * Parse json as a document
         *
         * @returns {Document}
         */
        parseDoc: function(json) {
            var fragments = {};
            for(var field in json.data[json.type]) {
                fragments[json.type + '.' + field] = json.data[json.type][field];
            }

            var slugs = [];
            if (json.slugs !== undefined) {
                for (var i = 0; i < json.slugs.length; i++) {
                    slugs.push(decodeURIComponent(json.slugs[i]));
                }
            }

            return new Global.Prismic.Document(
                json.id,
                json.uid || null,
                json.type,
                json.href,
                json.tags,
                slugs,
                fragments
            );
        },

        /**
         * Return the URL to display a given preview
         * @param {string} token as received from Prismic server to identify the content to preview
         * @param {function} linkResolver the link resolver to build URL for your site
         * @param {string} defaultUrl the URL to default to return if the preview doesn't correspond to a document
         *                (usually the home page of your site)
         * @param {function} callback to get the resulting URL
         */
        previewSession: function(token, linkResolver, defaultUrl, callback) {
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
                        api.form("everything").query(Predicates.at("document.id", mainDocumentId)).ref(token).submit(function(err, response) {
                            if (response.results.length === 0) {
                                callback(null, defaultUrl, xhr);
                            } else {
                                callback(null, linkResolver(response.results[0]), xhr);
                            }
                        });
                    }
                } catch (e) {
                    console.log("Caught e ", e);
                    callback(e, defaultUrl, xhr);
                }
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

        for(var field in form.fields) {
            if(form.fields[field]['default']) {
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
        set: function(field, value) {
            var fieldDesc = this.form.fields[field];
            if(!fieldDesc) throw new Error("Unknown field " + field);
            var values= this.data[field] || [];
            if(value === '' || value === undefined) {
                // we must compare value to null because we want to allow 0
                value = null;
            }
            if(fieldDesc.multiple) {
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
        ref: function(ref) {
            return this.set("ref", ref);
        },

        /**
         * Sets a predicate-based query for this SearchForm. This is where you
         * paste what you compose in your prismic.io API browser.
         *
         * @example form.query(Prismic.Predicates.at("document.id", "foobar"))
         * @param {string|...array} query - Either a query as a string, or as many predicates as you want. See Prismic.Predicates.
         * @returns {SearchForm} - The SearchForm itself
         */
        query: function(query) {
            if (typeof query === 'string') {
                return this.set("q", query);
            } else {
                var predicates = [].slice.apply(arguments); // Convert to a real JS array
                var stringQueries = [];
                predicates.forEach(function (predicate) {
                    var firstArg = (predicate[1].indexOf("my.") === 0 || predicate[1].indexOf("document.") === 0) ? predicate[1]
                        : '"' + predicate[1] + '"';
                    stringQueries.push("[:d = " + predicate[0] + "(" + firstArg + ", " + (function() {
                        return predicate.slice(2).map(function(p) {
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
        pageSize: function(size) {
            return this.set("pageSize", size);
        },

        /**
         * Restrict the results document to the specified fields
         *
         * @param {string|array} fields - The list of fields, array or comma separated string
         * @returns {SearchForm} - The SearchForm itself
         */
        fetch: function(fields) {
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
        fetchLinks: function(fields) {
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
        page: function(p) {
            return this.set("page", p);
        },

        /**
         * Sets the orderings to query for this SearchForm. This is an optional method.
         *
         * @param {array} orderings - Array of string: list of fields, optionally followed by space and desc. Example: ['my.product.price desc', 'my.product.date']
         * @returns {SearchForm} - The SearchForm itself
         */
        orderings: function(orderings) {
            if (typeof orderings === 'string') {
                // Backward compatibility
                return this.set("orderings", orderings);
            } else if (!orderings) {
                // Noop
                return this;
            } else {
                // Normal usage
                return this.set("orderings", "[" + orderings.join(",") + "]");
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
        submit: function(callback) {
            var url = this.form.action;

            if (this.data) {
                var sep = (url.indexOf('?') > -1 ? '&' : '?');
                for(var key in this.data) {
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

            var cacheKey = url + (this.api.accessToken ? ('#' + this.api.accessToken) : '');
            var cache = this.api.apiCache;
            var self = this;

            cache.get(cacheKey, function (err, value) {
                if (err) { return callback(err); }
                if (value) { return callback(null, value); }

                // The cache isn't really useful for in-browser usage because we already have the browser cache,
                // but it is there for Node.js and other server-side implementations
                self.api.requestHandler(url, function (err, documents, xhr, ttl) {
                    if (err) { callback(err, null, xhr); return; }
                    var results = documents.results.map(prismic.fn.parseDoc);
                    var response = new Response(
                            documents.page,
                            documents.results_per_page,
                            documents.results_size,
                            documents.total_results_size,
                            documents.total_pages,
                            documents.next_page,
                            documents.prev_page,
                                results || []);

                    if (ttl) {
                        cache.set(cacheKey, response, ttl, function (err) {
                            if (err) { return callback(err); }
                            return callback(null, response);
                        });
                    } else {
                        return callback(null, response);
                    }
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

    /**
     * Api cache
     */
    function ApiCache() {
        this.cache = {};
        this.states = {};
    }

    ApiCache.prototype = {

        get: function(key, cb) {
            var maybeEntry = this.cache[key];
            if(maybeEntry && !this.isExpired(key)) {
                return cb(null, maybeEntry.data);
            }
            return cb();
        },

        set: function(key, value, ttl, cb) {
            this.cache[key] = {
                data: value,
                expiredIn: ttl ? (Date.now() + (ttl * 1000)) : 0
            };

            return cb();
        },

        isExpired: function(key) {
            var entry = this.cache[key];
            if(entry) {
                return entry.expiredIn !== 0 && entry.expiredIn < Date.now();
            } else {
                return false;
            }
        },

        remove: function(key, cb) {
            delete this.cache[key];
            return cb();
        },

        clear: function(key, cb) {
            this.cache = {};
            return cb();
        }
    };

    // -- Export Globally

    Global.Prismic = {
        experimentCookie: "io.prismic.experiment",
        previewCookie: "io.prismic.preview",
        Api: prismic
    };

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));

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

(function (Global, undefined) {

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
        get: function(name) {
            var frags = this._getFragments(name);
            return frags.length ? Global.Prismic.Fragments.initField(frags[0]) : null;
        },

        /**
         * Builds an array of all the fragments in case they are multiple.
         *
         * @param {string} name - The name of the multiple fragment to get, with its type; for instance, "blog-post.author"
         * @returns {array} - An array of each JavaScript fragment object to manipulate.
         */
        getAll: function(name) {
            return this._getFragments(name).map(function (fragment) {
                return Global.Prismic.Fragments.initField(fragment);
            }, this);
        },

        /**
         * Gets the image fragment in the current Document object, for further manipulation.
         *
         * @example document.getImage('blog-post.photo').asHtml(linkResolver)
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.photo"
         * @returns {ImageEl} - The Image object to manipulate
         */
        getImage: function(fragment) {
            var img = this.get(fragment);
            if (img instanceof Global.Prismic.Fragments.Image) {
                return img;
            }
            if (img instanceof Global.Prismic.Fragments.StructuredText) {
                // find first image in st.
                return img;
            }
            return null;
        },

        // Useful for obsolete multiples
        getAllImages: function(fragment) {
            var images = this.getAll(fragment);

            return images.map(function (image) {
                if (image instanceof Global.Prismic.Fragments.Image) {
                    return image;
                }
                if (image instanceof Global.Prismic.Fragments.StructuredText) {
                    throw new Error("Not done.");
                }
                return null;
            });
        },

        /**
         * Gets the view within the image fragment in the current Document object, for further manipulation.
         *
         * @example document.getImageView('blog-post.photo', 'large').asHtml(linkResolver)
         *
         * @param {string} name- The name of the fragment to get, with its type; for instance, "blog-post.photo"
         * @returns {ImageView} view - The View object to manipulate
         */
        getImageView: function(name, view) {
            var fragment = this.get(name);
            if (fragment instanceof Global.Prismic.Fragments.Image) {
                return fragment.getView(view);
            }
            if (fragment instanceof Global.Prismic.Fragments.StructuredText) {
                for(var i=0; i<fragment.blocks.length; i++) {
                    if(fragment.blocks[i].type == 'image') {
                        return fragment.blocks[i];
                    }
                }
            }
            return null;
        },

        // Useful for obsolete multiples
        getAllImageViews: function(name, view) {
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
        getTimestamp: function(name) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.Timestamp) {
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
        getDate: function(name) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.Date) {
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
        getBoolean: function(name) {
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
        getText: function(name, after) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.StructuredText) {
                return fragment.blocks.map(function(block) {
                    if(block.text) {
                        return block.text + (after ? after : '');
                    }
                }).join('\n');
            }

            if (fragment instanceof Global.Prismic.Fragments.Text) {
                if(fragment.value) {
                    return fragment.value + (after ? after : '');
                }
            }

            if (fragment instanceof Global.Prismic.Fragments.Number) {
                if(fragment.value) {
                    return fragment.value + (after ? after : '');
                }
            }

            if (fragment instanceof Global.Prismic.Fragments.Select) {
                if(fragment.value) {
                    return fragment.value + (after ? after : '');
                }
            }

            if (fragment instanceof Global.Prismic.Fragments.Color) {
                if(fragment.value) {
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
        getStructuredText: function(name) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.StructuredText) {
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
        getLink: function(name) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.WebLink ||
                fragment instanceof Global.Prismic.Fragments.DocumentLink ||
                fragment instanceof Global.Prismic.Fragments.ImageLink) {
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
        getNumber: function(name) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.Number) {
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
        getColor: function(name) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.Color) {
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
        getGeoPoint: function(name) {
            var fragment = this.get(name);

            if(fragment instanceof Global.Prismic.Fragments.GeoPoint) {
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
        getGroup: function(name) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.Group) {
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
        getHtml: function(name, linkResolver) {
            if (!isFunction(linkResolver)) {
                // Backward compatibility with the old ctx argument
                var ctx = linkResolver;
                linkResolver = function(doc, isBroken) {
                    return ctx.linkResolver(ctx, doc, isBroken);
                };
            }
            var fragment = this.get(name);

            if(fragment && fragment.asHtml) {
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
        asHtml: function(linkResolver) {
            if (!isFunction(linkResolver)) {
                // Backward compatibility with the old ctx argument
                var ctx = linkResolver;
                linkResolver = function(doc, isBroken) {
                    return ctx.linkResolver(ctx, doc, isBroken);
                };
            }
            var htmls = [];
            for(var field in this.fragments) {
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
         asText: function(linkResolver) {
            if (!isFunction(linkResolver)) {
                // Backward compatibility with the old ctx argument
                var ctx = linkResolver;
                linkResolver = function(doc, isBroken) {
                    return ctx.linkResolver(ctx, doc, isBroken);
                };
            }
            var texts = [];
            for(var field in this.fragments) {
                var fragment = this.get(field);
                texts.push(fragment && fragment.asText ? fragment.asText(linkResolver) : '');
            }
            return texts.join('');
         },


        /**
         * Linked documents, as an array of {@link DocumentLink}
         * @returns {Array}
         */
        linkedDocuments: function() {
            var i, j, link;
            var result = [];
            for (var field in this.fragments) {
                var fragment = this.get(field);
                if (fragment instanceof Global.Prismic.Fragments.DocumentLink) {
                    result.push(fragment);
                }
                if (fragment instanceof Global.Prismic.Fragments.StructuredText) {
                    for (i = 0; i < fragment.blocks.length; i++) {
                        var block = fragment.blocks[i];
                        if (block.type == "image" && block.linkTo) {
                            link = Global.Prismic.Fragments.initField(block.linkTo);
                            if (link instanceof DocumentLink) {
                                result.push(link);
                            }
                        }
                        var spans = block.spans || [];
                        for (j = 0; j < spans.length; j++) {
                            var span = spans[j];
                            if (span.type == "hyperlink") {
                                link = Global.Prismic.Fragments.initField(span.data);
                                if (link instanceof Global.Prismic.Fragments.DocumentLink) {
                                    result.push(link);
                                }
                            }
                        }
                    }
                }
                if (fragment instanceof Global.Prismic.Fragments.Group) {
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
        _getFragments: function(name) {
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
    function Document(id, uid, type, href, tags, slugs, fragments) {

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

        this.fragments = fragments;
    }

    Document.prototype = Object.create(WithFragments.prototype);

    function GroupDoc(fragments) {
        this.fragments = fragments;
    }

    GroupDoc.prototype = Object.create(WithFragments.prototype);

    // -- Private helpers

    function isFunction(f) {
        var getType = {};
        return f && getType.toString.call(f) === '[object Function]';
    }

    // -- Export globally

    Global.Prismic.WithFragments = WithFragments;
    Global.Prismic.Document = Document;
    Global.Prismic.GroupDoc = GroupDoc;


}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));

(function (Global, undefined) {

    "use strict";

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
        asHtml: function () {
            return "<span>" + this.value + "</span>";
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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

        var fragments = {};
        if (data.document.data) {
            for (var field in data.document.data[data.document.type]) {
                fragments[data.document.type + '.' + field] = data.document.data[data.document.type][field];
            }
        }
        /**
         * @field
         * @description the fragment list, if the fetchLinks parameter was used in at query time
         */
        this.fragments = fragments;
        /**
         * @field
         * @description true if the link is broken, false otherwise
         */
        this.isBroken = data.isBroken;
    }

    DocumentLink.prototype = Object.create(Global.Prismic.WithFragments.prototype);

    /**
     * Turns the fragment into a useable HTML version of it.
     * If the native HTML code doesn't suit your design, this function is meant to be overriden.
     *
     * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
     * @returns {string} - basic HTML code for the fragment
     */
    DocumentLink.prototype.asHtml = function (ctx) {
        return "<a href=\""+this.url(ctx)+"\">"+this.url(ctx)+"</a>";
    };

    /**
     * Returns the URL of the document link.
     *
     * @params {object} linkResolver - mandatory linkResolver function (please read prismic.io online documentation about this)
     * @returns {string} - the proper URL to use
     */
    DocumentLink.prototype.url = function (linkResolver) {
        return linkResolver(this.document, this.isBroken);
    };

    /**
     * Turns the fragment into a useable text version of it.
     *
     * @returns {string} - basic text version of the fragment
     */
    DocumentLink.prototype.asText = function(linkResolver) {
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
        asHtml: function () {
            return "<a href=\""+this.url()+"\">"+this.url()+"</a>";
        },
        /**
         * Returns the URL of the link.
         *
         * @returns {string} - the proper URL to use
         */
        url: function() {
            return this.value.url;
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        asHtml: function () {
            return "<a href=\""+this.url()+"\">"+this.value.file.name+"</a>";
        },
        /**
         * Returns the URL of the link.
         *
         * @returns {string} - the proper URL to use
         */
        url: function() {
            return this.value.file.url;
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        asHtml: function () {
            return "<a href=\""+this.url()+"\"><img src=\""+this.url()+"\" alt=\"" + this.alt + "\"></a>";
        },
        /**
         * Returns the URL of the link.
         *
         * @returns {string} - the proper URL to use
         */
        url: function() {
            return this.value.image.url;
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        asHtml: function () {
            return "<span>" + this.value + "</span>";
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        asHtml: function () {
            return "<span>" + this.value + "</span>";
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        asHtml: function () {
            return '<div class="geopoint"><span class="latitude">' + this.latitude + '</span><span class="longitude">' + this.longitude + '</span></div>';
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
        asText: function() {
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
        asHtml: function () {
            return "<span>" + this.value + "</span>";
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        asHtml: function () {
            return "<time>" + this.value + "</time>";
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        var correctIso8601Date = (data.length == 24) ? data.substring(0, 22) + ':' + data.substring(22, 24) : data;
        this.value = new Date(correctIso8601Date);
    }

    Timestamp.prototype = {
        /**
         * Turns the fragment into a useable HTML version of it.
         * If the native HTML code doesn't suit your design, this function is meant to be overriden.
         *
         * @returns {string} - basic HTML code for the fragment
         */
        asHtml: function () {
            return "<time>" + this.value + "</time>";
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        asHtml: function () {
            return this.value.oembed.html;
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        getView: function(name) {
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
        asHtml: function () {
            return this.main.asHtml();
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        ratio: function () {
            return this.width / this.height;
        },
        /**
         * Turns the fragment into a useable HTML version of it.
         * If the native HTML code doesn't suit your design, this function is meant to be overriden.
         *
         * @returns {string} - basic HTML code for the fragment
         */
        asHtml: function () {
            return "<img src=\"" + this.url + "\" width=\"" + this.width + "\" height=\"" + this.height + "\" alt=\"" + this.alt + "\">";
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function() {
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
        asHtml: function(linkResolver) {
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
        toArray: function(){
            return this.value;
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
        asText: function(linkResolver) {
            var output = "";
            for (var i=0; i<this.value.length; i++) {
                for (var fragmentName in this.value[i]) {
                    output += this.value[i][fragmentName].asText(linkResolver);
                }
            }
            return output;
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
        getTitle: function () {
            for(var i=0; i<this.blocks.length; i++) {
                var block = this.blocks[i];
                if(block.type.indexOf('heading') === 0) {
                    return block;
                }
            }
        },

        /**
         * @returns {object} the first block of type paragraph
         */
        getFirstParagraph: function() {
            for(var i=0; i<this.blocks.length; i++) {
                var block = this.blocks[i];
                if(block.type == 'paragraph') {
                    return block;
                }
            }
        },

        /**
         * @returns {array} all paragraphs
         */
        getParagraphs: function() {
            var paragraphs = [];
            for(var i=0; i<this.blocks.length; i++) {
                var block = this.blocks[i];
                if(block.type == 'paragraph') {
                    paragraphs.push(block);
                }
            }
            return paragraphs;
        },

        /**
         * @returns {object} the nth paragraph
         */
        getParagraph: function(n) {
            return this.getParagraphs()[n];
        },

        /**
         * @returns {object}
         */
        getFirstImage: function() {
            for(var i=0; i<this.blocks.length; i++) {
                var block = this.blocks[i];
                if(block.type == 'image') {
                    return new ImageView(
                        block.url,
                        block.dimensions.width,
                        block.dimensions.height,
                        block.alt
                    );
                }
            }
        },

        /**
         * Turns the fragment into a useable HTML version of it.
         * If the native HTML code doesn't suit your design, this function is meant to be overriden.
         * @params {function} linkResolver - please read prismic.io online documentation about link resolvers
         * @params {function} htmlSerializer optional HTML serializer to customize the output
         * @returns {string} - basic HTML code for the fragment
         */
        asHtml: function(linkResolver, htmlSerializer) {
            var blockGroups = [],
                blockGroup,
                block,
                html = [];
            if (!isFunction(linkResolver)) {
                // Backward compatibility with the old ctx argument
                var ctx = linkResolver;
                linkResolver = function(doc, isBroken) {
                    return ctx.linkResolver(ctx, doc, isBroken);
                };
            }
            if (Array.isArray(this.blocks)) {

                for(var i=0; i < this.blocks.length; i++) {
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
                    } else if (!blockGroup || blockGroup.type != ("group-" + block.type)) {
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

                var blockContent = function(block) {
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
         asText: function() {
            var output = [];
            for(var i=0; i<this.blocks.length; i++) {
                var block = this.blocks[i];
                if (block.text) {
                    output.push(block.text);
                }
            }
            return output.join(' ');
         }

    };

    function htmlEscape(input) {
        return input && input.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br>");
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
            if (!tagsStart[span.start]) { tagsStart[span.start] = []; }
            if (!tagsEnd[span.end]) { tagsEnd[span.end] = []; }

            tagsStart[span.start].push(span);
            tagsEnd[span.end].unshift(span);
        });

        var c;
        var html = "";
        var stack = [];
        for (var pos = 0, len = text.length + 1; pos < len; pos++) { // Looping to length + 1 to catch closing tags
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
                    return (b.end - b.start) - (a.end - a.start);
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
                            return '';
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
            "Group": Group
        };

        if (classForType[field.type]) {
            return new classForType[field.type](field.value);
        }

        if (field.type === "Image") {
            var img = field.value.main;
            var output = new ImageEl(
                new ImageView(
                    img.url,
                    img.dimensions.width,
                    img.dimensions.height,
                    img.alt
                ),
                {}
            );
            for (var name in field.value.views) {
                img = field.value.views[name];
                output.views[name] = new ImageView(
                    img.url,
                    img.dimensions.width,
                    img.dimensions.height,
                    img.alt
                );
            }
            return output;
        }

        if (console && console.log) console.log("Fragment type not supported: ", field.type);

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
            var classCode = element.label ? (' class="' + element.label + '"') : '';
            return '<' + name + classCode + '>' + content + '</' + name + '>';
        }

        if (element.type == "image") {
            var label = element.label ? (" " + element.label) : "";
            var imgTag = '<img src="' + element.url + '" alt="' + element.alt + '">';
            return '<p class="block-img' + label + '">' +
                (element.linkUrl ? ('<a href="' + element.linkUrl + '">' + imgTag + '</a>') : imgTag) +
                '</p>';
        }

        if (element.type == "embed") {
            return '<div data-oembed="'+ element.embed_url +
                '" data-oembed-type="'+ element.type +
                '" data-oembed-provider="'+ element.provider_name +
                (element.label ? ('" class="' + element.label) : '') +
                '">' + element.oembed.html+"</div>";
        }

        if (element.type === 'hyperlink') {
            return '<a href="' + element.url + '">' + content + '</a>';
        }

        if (element.type === 'label') {
            return '<span class="' + element.data.label + '">' + content + '</span>';
        }

        return "<!-- Warning: " + element.type + " not implemented. Upgrade the Developer Kit. -->" + content;
    }

    Global.Prismic.Fragments = {
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
        initField: initField,
        insertSpans: insertSpans
    };

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));

(function (Global, undefined) {

    "use strict";

    /**
     * @global
     * @namespace
     * @alias Predicates
     */
    var predicates = {

        /**
         * Build an "at" predicate: equality of a fragment to a value.
         *
         * @example Predicates.at("document.type", "article")
         * @param fragment {String}
         * @param value {String}
         * @returns {Array} an array corresponding to the predicate
         */
        at: function(fragment, value) { return ["at", fragment, value]; },

        /**
         * Build an "any" predicate: equality of a fragment to a value.
         *
         * @example Predicates.any("document.type", ["article", "blog-post"])
         * @param fragment {String}
         * @param values {Array}
         * @returns {Array} an array corresponding to the predicate
         */
        any: function(fragment, values) { return ["any", fragment, values]; },

        /**
         * Build a "fulltext" predicate: fulltext search in a fragment.
         *
         * @example Predicates.fulltext("my.article.body", "sausage"])
         * @param fragment {String}
         * @param value {String} the term to search
         * @returns {Array} an array corresponding to the predicate
         */
        fulltext: function(fragment, value) { return ["fulltext", fragment, value]; },

        /**
         * Build a "similar" predicate.
         *
         * @example Predicates.similar("UXasdFwe42D", 10)
         * @param documentId {String} the document id to retrieve similar documents to.
         * @param maxResults {Number} the maximum number of results to return
         * @returns {Array} an array corresponding to the predicate
         */
        similar: function(documentId, maxResults) { return ["similar", documentId, maxResults]; },

        /**
         * Build a "number.gt" predicate: documents where the fragment field is greater than the given value.
         *
         * @example Predicates.gt("my.product.price", 10)
         * @param fragment {String} the name of the field - must be a number.
         * @param value {Number} the lower bound of the predicate
         * @returns {Array} an array corresponding to the predicate
         */
        gt: function(fragment, value) { return ["number.gt", fragment, value]; },

        /**
         * Build a "number.lt" predicate: documents where the fragment field is lower than the given value.
         *
         * @example Predicates.lt("my.product.price", 20)
         * @param fragment {String} the name of the field - must be a number.
         * @param value {Number} the upper bound of the predicate
         * @returns {Array} an array corresponding to the predicate
         */
        lt: function(fragment, value) { return ["number.lt", fragment, value]; },

        /**
         * Build a "number.inRange" predicate: combination of lt and gt.
         *
         * @example Predicates.inRange("my.product.price", 10, 20)
         * @param fragment {String} the name of the field - must be a number.
         * @param before {Number}
         * @param after {Number}
         * @returns {Array} an array corresponding to the predicate
         */
        inRange: function(fragment, before, after) { return ["number.inRange", fragment, before, after]; },

        /**
         * Build a "date.before" predicate: documents where the fragment field is before the given date.
         *
         * @example Predicates.dateBefore("my.product.releaseDate", new Date(2014, 6, 1))
         * @param fragment {String} the name of the field - must be a date or timestamp field.
         * @param before {Date}
         * @returns {Array} an array corresponding to the predicate
         */
        dateBefore: function(fragment, before) { return ["date.before", fragment, before]; },

        /**
         * Build a "date.after" predicate: documents where the fragment field is after the given date.
         *
         * @example Predicates.dateAfter("my.product.releaseDate", new Date(2014, 1, 1))
         * @param fragment {String} the name of the field - must be a date or timestamp field.
         * @param after {Date}
         * @returns {Array} an array corresponding to the predicate
         */
        dateAfter: function(fragment, after) { return ["date.after", fragment, after]; },

        /**
         * Build a "date.between" predicate: combination of dateBefore and dateAfter
         *
         * @example Predicates.dateBetween("my.product.releaseDate", new Date(2014, 1, 1), new Date(2014, 6, 1))
         * @param fragment {String} the name of the field - must be a date or timestamp field.
         * @param before {Date}
         * @param after {Date}
         * @returns {Array} an array corresponding to the predicate
         */
        dateBetween: function(fragment, before, after) { return ["date.between", fragment, before, after]; },

        /**
         *
         * @example Predicates.dayOfMonth("my.product.releaseDate", 14)
         * @param fragment
         * @param day {Number} between 1 and 31
         * @returns {Array}
         */
        dayOfMonth: function(fragment, day) { return ["date.day-of-month", fragment, day]; },

        /**
         *
         * @example Predicates.dayOfMonthAfter("my.product.releaseDate", 14)
         * @param fragment
         * @param day {Number} between 1 and 31
         * @returns {Array}
         */
        dayOfMonthAfter: function(fragment, day) { return ["date.day-of-month-after", fragment, day]; },

        /**
         *
         * @example Predicates.dayOfMonthBefore("my.product.releaseDate", 14)
         * @param fragment
         * @param day {Number} between 1 and 31
         * @returns {Array}
         */
        dayOfMonthBefore: function(fragment, day) { return ["date.day-of-month-before", fragment, day]; },

        /**
         *
         * @example Predicates.dayOfWeek("my.product.releaseDate", 14)
         * @param fragment
         * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
         * @returns {Array}
         */
        dayOfWeek: function(fragment, day) { return ["date.day-of-week", fragment, day]; },

        /**
         *
         * @example Predicates.dayOfWeekAfter("my.product.releaseDate", "Wednesday")
         * @param fragment
         * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
         * @returns {Array}
         */
        dayOfWeekAfter: function(fragment, day) { return ["date.day-of-week-after", fragment, day]; },

        /**
         *
         * @example Predicates.dayOfWeekBefore("my.product.releaseDate", "Wednesday")
         * @param fragment
         * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
         * @returns {Array}
         */
        dayOfWeekBefore: function(fragment, day) { return ["date.day-of-week-before", fragment, day]; },

        /**
         *
         * @example Predicates.month("my.product.releaseDate", "June")
         * @param fragment
         * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
         * @returns {Array}
         */
        month: function(fragment, month) { return ["date.month", fragment, month]; },

        /**
         *
         * @example Predicates.monthBefore("my.product.releaseDate", "June")
         * @param fragment
         * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
         * @returns {Array}
         */
        monthBefore: function(fragment, month) { return ["date.month-before", fragment, month]; },

        /**
         *
         * @example Predicates.monthAfter("my.product.releaseDate", "June")
         * @param fragment
         * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
         * @returns {Array}
         * @returns {Array}
         */
        monthAfter: function(fragment, month) { return ["date.month-after", fragment, month]; },

        /**
         *
         * @example Predicates.year("my.product.releaseDate", 2014)
         * @param fragment
         * @param year {Number}
         * @returns {Array}
         */
        year: function(fragment, year) { return ["date.year", fragment, year]; },

        /**
         *
         * @example Predicates.hour("my.product.releaseDate", 12)
         * @param fragment
         * @param hour {Number}
         * @returns {Array}
         */
        hour: function(fragment, hour) { return ["date.hour", fragment, hour]; },

        /**
         *
         * @example Predicates.hourBefore("my.product.releaseDate", 12)
         * @param fragment
         * @param hour {Number}
         * @returns {Array}
         */
        hourBefore: function(fragment, hour) { return ["date.hour-before", fragment, hour]; },

        /**
         *
         * @example Predicates.hourAfter("my.product.releaseDate", 12)
         * @param fragment
         * @param hour {Number}
         * @returns {Array}
         */
        hourAfter: function(fragment, hour) { return ["date.hour-after", fragment, hour]; },

        /**
         *
         * @example Predicates.near("my.store.location", 48.8768767, 2.3338802, 10)
         * @param fragment
         * @param latitude {Number}
         * @param longitude {Number}
         * @param radius {Number} in kilometers
         * @returns {Array}
         */
        near: function(fragment, latitude, longitude, radius) { return ["geopoint.near", fragment, latitude, longitude, radius]; }

    };

    Global.Prismic.Predicates = predicates;

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));

(function (Global, undefined) {

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

    Experiments.prototype.current = function() {
        return this.running.length > 0 ? this.running[0] : null;
    };

    /**
     * Get the current running experiment variation ref from a cookie content
     */
    Experiments.prototype.refFromCookie = function(cookie) {
        if (!cookie || cookie.trim() === "") return null;
        var splitted = cookie.trim().split(" ");
        if (splitted.length < 2) return null;
        var expId = splitted[0];
        var varIndex = parseInt(splitted[1], 10);
        var exp = this.running.filter(function(exp) {
          return exp.googleId() == expId && exp.variations.length > varIndex;
        })[0];
        return exp ? exp.variations[varIndex].ref() : null;
    };

    function Experiment(data) {
        this.data = data;
        var variations = [];
        data.variations && data.variations.forEach(function(v) {
            variations.push(new Variation(v));
        });
        this.variations = variations;
    }

    Experiment.prototype.id = function() {
        return this.data.id;
    };

    Experiment.prototype.googleId = function() {
        return this.data.googleId;
    };

    Experiment.prototype.name = function() {
        return this.data.name;
    };

    function Variation(data) {
        this.data = data;
    }

    Variation.prototype.id = function() {
        return this.data.id;
    };

    Variation.prototype.ref = function() {
        return this.data.ref;
    };

    Variation.prototype.label = function() {
        return this.data.label;
    };

    Global.Prismic.Experiments = Experiments;
    Global.Prismic.Experiment = Experiment;
    Global.Prismic.Variation = Variation;

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));

(function (Global, undefined) {Global.Prismic.version = '1.0.30';}(typeof exports === 'object' && exports ? exports : (typeof module === 'object' && module && typeof module.exports === 'object' ? module.exports : window)));
