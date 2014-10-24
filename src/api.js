(function (Global, undefined) {

    "use strict";

    /**
     * The kit's main entry point; initialize your API like this: Prismic.Api(url, callback, accessToken, maybeRequestHandler)
     *
     * @global
     * @alias Api
     * @constructor
     * @param {string} url - The mandatory URL of the prismic.io API endpoint (like: https://lesbonneschoses.prismic.io/api)
     * @param {function} callback - Optional callback function that is called after the API was retrieved, to which you may pass three parameters: a potential error (null if no problem), the API object, and the XMLHttpRequest
     * @param {string} accessToken - The optional accessToken for the OAuth2 connection
     * @param {function} maybeRequestHandler - The kit knows how to handle the HTTP request in Node.js and in the browser (with Ajax); you will need to pass a maybeRequestHandler if you're in another JS environment
     * @returns {Api} - The Api object that can be manipulated
     */
    var prismic = function(url, callback, accessToken, maybeRequestHandler, maybeApiCache) {
        var api = new prismic.fn.init(url, accessToken, maybeRequestHandler, maybeApiCache);
        if (callback) {
            api.get(callback);
        }
        return api;
    };
    // note that the prismic variable is later affected as "Api" while exporting

    // -- Request handlers

    var ajaxRequest = (function() {
        if(typeof XMLHttpRequest != 'undefined' && 'withCredentials' in new XMLHttpRequest()) {
            return function(url, callback) {

                var xhr = new XMLHttpRequest();

                // Called on success
                var resolve = function() {
                    callback(null, JSON.parse(xhr.responseText), xhr);
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
                    callback(null, JSON.parse(xdr.responseText), xdr);
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
                    reject("Unexpected status code on URL "+url);
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
            var requestsCache = {},
                http = require('http'),
                https = require('https'),
                url = require('url'),
                querystring = require('querystring'),
                pjson = require('../package.json');

            return function(requestUrl, callback) {
                if(requestsCache[requestUrl]) {
                    callback(null, requestsCache[requestUrl]);
                } else {

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
                              var cacheControl = response.headers['cache-control'],
                                  maxAge = cacheControl && /max-age=(\d+)/.test(cacheControl) ? parseInt(/max-age=(\d+)/.exec(cacheControl)[1]) : undefined,
                                  json = JSON.parse(jsonStr);

                              if(maxAge) {
                                  requestsCache[requestUrl] = json;
                              }

                              callback(null, json, response);
                            });
                        } else {
                            callback(new Error("Unexpected status code [" + response.statusCode + "] on URL "+requestUrl), null, response);
                        }
                    });

                }

            };
        }
    });

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
         * Requests (with the proper handler), parses, and returns the /api document.
         * This is for internal use, from outside this kit, you should call Prismic.Api()
         *
         * @param {function} callback - Optional callback function that is called after the query is made, to which you may pass three parameters: a potential error (null if no problem), the API object, and the XMLHttpRequest
         * @returns {Api} - The Api object that can be manipulated
         */
        get: function(callback) {
            var self = this;
            var cacheKey = this.url + (this.accessToken ? ('#' + this.accessToken) : '');
            this.apiCache.getOrSet(
                cacheKey,
                5, // ttl
                function fetchApi (cb) {
                    self.requestHandler(self.url, function(error, data, xhr) {
                        if (error) {
                            if (cb) cb(error, null, xhr);
                        } else {
                            if (cb) cb(null, self.parse(data), xhr);
                        }
                    });
                },
                function done (error, api, xhr) {
                    if (error) {
                        if (callback) callback(error, null, xhr);
                    } else {
                        self.data = api;
                        self.bookmarks = api.bookmarks;
                        self.experiments = new Global.Prismic.Experiments(api.experiments);
                        if (callback) callback(null, self, xhr);
                    }
                }
            );
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
                oauthInitiate: data['oauth_initiate'],
                oauthToken: data['oauth_token']
            };

        },

        /**
         * Initialisation of the API object.
         * This is for internal use, from outside this kit, you should call Prismic.Api()
         * @private
         */
        init: function(url, accessToken, maybeRequestHandler, maybeApiCache) {
            this.url = url + (accessToken ? (url.indexOf('?') > -1 ? '&' : '?') + 'access_token=' + accessToken : '');
            this.accessToken = accessToken;
            this.requestHandler = maybeRequestHandler || ajaxRequest() || xdomainRequest() || nodeJSRequest() || (function() {throw new Error("No request handler available (tried XMLHttpRequest & NodeJS)");})();
            this.apiCache = maybeApiCache || new ApiCache();
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
            var linkedDocuments = [];
            if(json.linked_documents) {
                linkedDocuments = json.linked_documents.map(function(linkedDoc) {
                    return new LinkedDocument(linkedDoc['id'], linkedDoc['slug'], linkedDoc['type'], linkedDoc['tags']);
                });
            }

            var fragments = {};
            for(var field in json.data[json.type]) {
                fragments[json.type + '.' + field] = json.data[json.type][field];
            }

            return new Global.Prismic.Document(
                json.id,
                json.type,
                json.href,
                json.tags,
                json.slugs,
                linkedDocuments,
                fragments
            );
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
         * @param {number} pageSize - The page size
         * @returns {SearchForm} - The SearchForm itself
         */
        pageSize: function(size) {
            return this.set("pageSize", size);
        },

        /**
         * Sets the page number to query for this SearchForm. This is an optional method.
         *
         * @param {number} page - The page number
         * @returns {SearchForm} - The SearchForm itself
         */
        page: function(p) {
            return this.set("page", p);
        },

        /**
         * Sets the orderings to query for this SearchForm. This is an optional method.
         *
         * @param {string} orderings - The orderings
         * @returns {SearchForm} - The SearchForm itself
         */
        orderings: function(orderings) {
            return this.set("orderings", orderings);
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
            var self = this,
                url = this.form.action;

            if(this.data) {
                var sep = (url.indexOf('?') > -1 ? '&' : '?');
                for(var key in this.data) {
                    var values = this.data[key];
                    if(values) {
                        for(var i=0; i<values.length; i++) {
                            url += sep + key + '=' + encodeURIComponent(values[i]);
                            sep = '&';
                        }
                    }
                }
            }

            this.api.requestHandler(url, function (err, documents, xhr) {

                if (err) { callback(err, null, xhr); return; }

                var results = documents.results.map(prismic.fn.parseDoc);

                callback(null, new Response(
                    documents.page,
                    documents.results_per_page,
                    documents.results_size,
                    documents.total_results_size,
                    documents.total_pages,
                    documents.next_page,
                    documents.prev_page,
                    results || []), xhr
                );
            });

        }

    };


    /**
     * Embodies the response of a SearchForm query as returned by the API.
     * It includes all the fields that are useful for pagination (page, total_pages, total_results_size, ...),
     * as well as the field "results", which is an array of {@link Doc} objects, the documents themselves.
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
         * Array of {@link Doc} for the current page
         * @type {Array}
         */
        this.results = results;
    }

    /**
     * A link to a document as in "related document" (not a hyperlink).
     * @constructor
     * @global
     */
    function LinkedDocument(id, slug, type, tags) {
        /**
         * @type {string}
         */
        this.id = id;
        /**
         * @type {string}
         */
        this.slug = slug;
        /**
         * @type {string}
         */
        this.type = type;
        /**
         * @type {Array}
         */
        this.tags = tags;
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

        get: function(key) {
            var maybeEntry = this.cache[key];
            if(maybeEntry && (!this.isExpired(key) || (this.isExpired(key) && this.isInProgress(key)))) {
                return maybeEntry.data;
            } else return null;
        },

        set: function(key, value, ttl) {
            this.cache[key] = {
                data: value,
                expiredIn: ttl ? (Date.now() + (ttl * 1000)) : 0
            };
        },

        getOrSet: function(key, ttl, fvalue, done) {
            var found = this.get(key);
            var self = this;
            if(!found) {
                this.states[key] = 'progress';
                var value =  fvalue(function(error, value, xhr) {
                    self.set(key, value, ttl);
                    delete self.states[key];
                    if (done) done(error, value, xhr);
                });
            } else {
                if (done) done(null, found);
            }
        },

        isExpired: function(key) {
            var entry = this.cache[key];
            if(entry) {
                return entry.expiredIn !== 0 && entry.expiredIn < Date.now();
            } else {
                return false;
            }
        },

        isInProgress: function(key) {
            return this.states[key] === 'progress';
        },

        exists: function(key) {
            return !!this.cache[key];
        },

        remove: function(key) {
            return delete this.cache[key];
        },

        clear: function(key) {
            this.cache = {};
        }
    };

    // -- Export Globally

    Global.Prismic = {
        Api: prismic
    };

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));
