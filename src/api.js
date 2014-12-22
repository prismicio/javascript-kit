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
