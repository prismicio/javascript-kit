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
        callback && api.get(callback);
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

        // Predicates: usable as the first element of a query array.
        AT: "at",
        ANY: "any",
        EVERYTHING: "everything",
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
                            cb && cb(error, null, xhr);
                        } else {
                            cb && cb(null, self.parse(data), xhr);
                        }
                    });
                },
                function done (error, api, xhr) {
                    if(error) {
                        callback && callback(error, null, xhr);
                    } else {
                        self.data = api;
                        self.bookmarks = api.bookmarks;
                        callback && callback(null, self, xhr);
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
                value != null && values.push(value);
            } else {
                values = value != null && [value];
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
         * You can pass an empty string, the method will simply not send that query.
         *
         * @param {string} query - The query to perform
         * @returns {SearchForm} - The SearchForm itself
         */
        query: function(query) {
            if (typeof query === 'string') {
                return this.set("q", query);
            } else {
                var predicates = (typeof query[0] === 'string')
                            ? [query]
                            : query;
                var stringQueries = [];
                predicates.forEach(function (predicate) {
                    var firstArg = (predicate[1].indexOf("my.") == 0 || predicate[1].indexOf("document.") == 0)
                        ? predicate[1]
                        : '"' + predicate[1] + '"';
                    stringQueries.push("[:d = " + predicate[0] + "(" + firstArg + ", " + (function() {
                        return predicate.slice(2).map(function(p) {
                            if (typeof p === 'string') {
                                return '"' + p + '"';
                            } else if(Array.isArray(p)) {
                                return "[" + p.map(function(e) {
                                    return '"' + e + '"';
                                }).join(',') + "]";
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

                var results = documents.results.map(function (doc) {

                    var linkedDocuments = [];
                    if(doc.linked_documents) {
                        linkedDocuments = doc.linked_documents.map(function(linkedDoc) {
                            return new LinkedDocument(linkedDoc['id'], linkedDoc['slug'], linkedDoc['type'], linkedDoc['tags']);
                        });
                    }

                    var fragments = {};
                    for(var field in doc.data[doc.type]) {
                        fragments[doc.type + '.' + field] = doc.data[doc.type][field];
                    }

                    return new Doc(
                        doc.id,
                        doc.type,
                        doc.href,
                        doc.tags,
                        doc.slugs,
                        linkedDocuments,
                        fragments
                    );
                });

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
     * An array of the fragments with the given fragment name.
     * The array is often a single-element array, expect when the fragment is a multiple fragment.
     * @private
     */
    function getFragments(name) {
        if (!this.fragments || !this.fragments[name]) {
            return [];
        }

        if (Array.isArray(this.fragments[name])) {
            return this.fragments[name];
        } else {
            return [this.fragments[name]];
        }

    }

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
     * Embodies a document as returned by the API.
     * Most useful fields: id, type, tags, slug, slugs
     * @constructor
     * @global
     * @alias Doc
     */
    function Doc(id, type, href, tags, slugs, linkedDocuments, fragments) {

        /**
         * The ID of the document
         * @type {string}
         */
        this.id = id;
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
         * Linked documents, as an array of {@link LinkedDocument}
         * @type {array}
         */
        this.linkedDocuments = linkedDocuments;
        this.fragments = fragments;
    }

    Doc.prototype = {
        /**
         * Gets the fragment in the current Document object. Since you most likely know the type
         * of this fragment, it is advised that you use a dedicated method, like get StructuredText() or getDate(),
         * for instance.
         *
         * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.author"
         * @returns {object} - The JavaScript Fragment object to manipulate
         */
        get: function(name) {
            var frags = getFragments.call(this, name);
            return frags.length ? Global.Prismic.Fragments.initField(frags[0]) : null;
        },

        /**
         * Builds an array of all the fragments in case they are multiple.
         *
         * @param {string} name - The name of the multiple fragment to get, with its type; for instance, "blog-post.author"
         * @returns {array} - An array of each JavaScript fragment object to manipulate.
         */
        getAll: function(name) {
            return getFragments.call(this, name).map(function (fragment) {
                return Global.Prismic.Fragments.initField(fragment);
            }, this);
        },

        /**
         * Gets the image fragment in the current Document object, for further manipulation.
         *
         * @example document.getImage('blog-post.photo').asHtml(ctx)
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
         * @example document.getImageView('blog-post.photo', 'large').asHtml(ctx)
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.photo"
         * @returns {ImageView} - The View object to manipulate
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
         * Gets the date fragment in the current Document object, for further manipulation.
         *
         * @example document.getDate('blog-post.publicationdate').asHtml(ctx)
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.publicationdate"
         * @returns {Date} - The Date object to manipulate
         */
        getDate: function(name) {
            var fragment = this.get(name);

            if(fragment instanceof Global.Prismic.Fragments.Date) {
                return fragment.value;
            }
        },

        /**
         * Gets a boolean value of the fragment in the current Document object, for further manipulation.
         * This works great with a Select fragment. The Select values that are considered true are (lowercased before matching): 'yes', 'on', and 'true'.
         *
         * @example if(document.getBoolean('blog-post.enableComments')) { ... }
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.enableComments"
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
         * @example document.getText('blog-post.label').asHtml(ctx).
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
         * @example document.getStructuredText('blog-post.body').asHtml(ctx).
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.body"
         * @returns {StructuredText} - The StructuredText fragment to manipulate.
         */
        getStructuredText: function(name) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.StructuredText) {
                return fragment;
            }
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
        },

        /**
         * Gets the Color fragment in the current Document object, for further manipulation.
         * @example document.getColor('product.color')
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "product.color"
         * @returns {string} - The string value of the Color fragment.
         */
        getColor: function(name) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.Color) {
                return fragment.value;
            }
        },

        /** Gets the GeoPoint fragment in the current Document object, for further manipulation.
         *
         * @example document.getGeoPoint('blog-post.location').asHtml(ctx)
         *
         * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.location"
         * @returns {GeoPoint} - The GeoPoint object to manipulate
         */
        getGeoPoint: function(name) {
            var fragment = this.get(name);

            if(fragment instanceof Global.Prismic.Fragments.GeoPoint) {
                return fragment;
            }
        },

        /**
         * Gets the Group fragment in the current Document object, for further manipulation.
         *
         * @example document.getGroup('product.gallery').asHtml(ctx).
         *
         * @param {string} name - The name of the fragment to get, with its type; for instance, "product.gallery"
         * @returns {Group} - The Group fragment to manipulate.
         */
        getGroup: function(name) {
            var fragment = this.get(name);

            if (fragment instanceof Global.Prismic.Fragments.Group) {
                return fragment;
            }
        },

        /**
         * Shortcut to get the HTML output of the fragment in the current document.
         * This is the same as writing document.get(fragment).asHtml(ctx);
         *
         * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.body"
         * @param {function} ctx - The ctx object that contains the context: ctx.api, ctx.ref, ctx.maybeRef, ctx.oauth(), and ctx.linkResolver()
         * @returns {string} - The HTML output
         */
        getHtml: function(name, ctx) {
            var fragment = this.get(name);

            if(fragment && fragment.asHtml) {
                return fragment.asHtml(ctx);
            }
        },

        /**
         * Transforms the whole document as an HTML output. Each fragment is separated by a &lt;section&gt; tag,
         * with the attribute data-field="nameoffragment"
         * Note that most of the time you will not use this method, but read fragment independently and generate
         * HTML output for {@link StructuredText} fragment with that class' asHtml method.
         *
         * @param {object} ctx - The ctx object that contains the context: ctx.api, ctx.ref, ctx.maybeRef, ctx.oauth(), and ctx.linkResolver()
         * @returns {string} - The HTML output
         */
        asHtml: function(ctx) {
            var htmls = [];
            for(var field in this.fragments) {
                var fragment = this.get(field);
                htmls.push(fragment && fragment.asHtml ? '<section data-field="' + field + '">' + fragment.asHtml(ctx) + '</section>' : '');
            }
            return htmls.join('');
        },

        /**
         * Turns the document into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function(ctx) {
            var texts = [];
            for(var field in this.fragments) {
                var fragment = this.get(field);
                texts.push(fragment && fragment.asText ? fragment.asText(ctx) : '');
            }
            return texts.join('');
         }

    };

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
                    done && done(error, value, xhr);
                });
            } else {
                done && done(null, found);
            }
        },

        isExpired: function(key) {
            var entry = this.cache[key];
            if(entry) {
                return entry.expiredIn != 0 && entry.expiredIn < Date.now();
            } else {
                return false;
            }
        },

        isInProgress: function(key) {
            return this.states[key] == 'progress';
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
        /**
         * @field
         * @description the document link's JSON object, exactly as is returned in the JSON responses (see API documentation: https://developers.prismic.io/documentation/UjBe8bGIJ3EKtgBZ/api-documentation#json-responses)
         */
        this.document = data.document;
        /**
         * @field
         * @description true if the link is broken, false otherwise
         */
        this.isBroken = data.isBroken;
    }

    DocumentLink.prototype = {
        /**
         * Turns the fragment into a useable HTML version of it.
         * If the native HTML code doesn't suit your design, this function is meant to be overriden.
         *
         * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
         * @returns {string} - basic HTML code for the fragment
         */
        asHtml: function (ctx) {
            return "<a href=\""+this.url(ctx)+"\">"+this.url(ctx)+"</a>";
        },
        /**
         * Returns the URL of the document link.
         *
         * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
         * @returns {string} - the proper URL to use
         */
        url: function (ctx) {
            return ctx.linkResolver(ctx, this.document, this.isBroken);
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function(ctx) {
            return this.url(ctx);
         }
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
    function GeoPoint(latitude, longitude) {
        /**
         * @field
         * @description the latitude of the geo point
         */
        this.latitude = latitude;
        /**
         * @field
         * @description the longitude of the geo point
         */
        this.longitude = longitude;
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
            return this.main.asHtml()
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
            return "<img src=" + this.url + " width=" + this.width + " height=" + this.height + " alt=\"" + this.alt + "\">";
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
      this.value = data;
    }
    Group.prototype = {
      /**
       * Turns the fragment into a useable HTML version of it.
       * If the native HTML code doesn't suit your design, this function is meant to be overriden.
       * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
       * @returns {string} - basic HTML code for the fragment
       */
      asHtml: function(ctx) {
        var output = "";
        for (var i=0; i<this.value.length; i++) {
          for (var fragmentName in this.value[i]) {
            output += '<section data-field="'+fragmentName+'">';
            output += this.value[i][fragmentName].asHtml(ctx);
            output += '</section>';
          }
        }
        return output;
      },
      /**
       * Turns the Group fragment into an array in order to access its items (groups of fragments),
       * or to loop through them.
       * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
       * @returns {array} - the array of groups, each group being a JSON object with subfragment name as keys, and subfragment as values
       */
       toArray: function(){
         return this.value;
       },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
         asText: function(ctx) {
            var output = "";
            for (var i=0; i<this.value.length; i++) {
              for (var fragmentName in this.value[i]) {
                output += this.value[i][fragmentName].asText(ctx);
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
                if(block.type.indexOf('heading') == 0) {
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
         * @params {object} ctx - mandatory ctx object, with a useable linkResolver function
         *      (please read prismic.io online documentation about this)
         * @params {function} htmlSerializer optional HTML serializer to customize the output
         * @returns {string} - basic HTML code for the fragment
         */
        asHtml: function(ctx, htmlSerializer) {
            var blockGroups = [],
                blockGroup,
                block,
                html = [];
            if (Array.isArray(this.blocks)) {

                for(var i=0; i < this.blocks.length; i++) {
                    block = this.blocks[i];

                    // Resolve image links
                    if (block.type == "image" && block.linkTo) {
                        var link = initField(block.linkTo);
                        block.linkUrl = link.url(ctx);
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
                        content = insertSpans(block.text, block.spans, ctx, htmlSerializer);
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
        return input && input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    /**
     * Parses a block that has spans, and inserts the proper HTML code.
     *
     * @param {string} text - the original text of the block
     * @param {object} spans - the spans as returned by the API
     * @param {object} ctx - the context object, containing the linkResolver function to build links that may be in the fragment (please read prismic.io's online documentation about this)
     * @param {function} htmlSerializer - optional serializer
     * @returns {string} - the HTML output
     */
    function insertSpans(text, spans, ctx, htmlSerializer) {
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
                    var innerHtml = serialize(tag.span, tag.text, htmlSerializer);
                    if (stack.length == 0) {
                        // The tag was top level
                        html += innerHtml;
                    } else {
                        // Add the content to the parent tag
                        stack[stack.length - 1].text += innerHtml;
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
                            url = fragment.url(ctx);
                        } else {
                            console && console.error && console.error('Impossible to convert span.data as a Fragment', span);
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
                if (stack.length == 0) {
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

        var output, img;

        switch (field.type) {

            case "Color":
                output = new Color(field.value);
                break;

            case "Number":
                output = new Num(field.value);
                break;

            case "Date":
                output = new DateFragment(field.value);
                break;

            case "Timestamp":
                output = new Timestamp(field.value);
                break;

            case "Text":
                output = new Text(field.value);
                break;

            case "Embed":
                output = new Embed(field.value);
                break;

            case "GeoPoint":
                output = new GeoPoint(field.value.latitude, field.value.longitude);
                break;

            case "Select":
                output = new Select(field.value);
                break;

            case "Image":
                img = field.value.main;
                output = new ImageEl(
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
                break;

            case "StructuredText":
                output = new StructuredText(field.value);
                break;

            case "Link.document":
                output = new DocumentLink(field.value);
                break;

            case "Link.web":
                output = new WebLink(field.value);
                break;

            case "Link.file":
                output = new FileLink(field.value);
                break;

            case "Link.image":
                output = new ImageLink(field.value);
                break;

            case "Group":
                var groups_array = [];
                // for each array of groups
                for (var i = 0; i < field.value.length; i++) {
                  var group = {}; // recreate groups with...
                  for (var fragmentName in field.value[i]) {
                    // ... the same fragment name as keys, but reinitalized fragments as values
                    group[fragmentName] = initField(field.value[i][fragmentName]);
                  }
                  groups_array.push(group);
                }
                output = new Group(groups_array);
                break;

            default:
                console && console.log && console.log("Fragment type not supported: ", field.type);
                break;
        }

        return output;

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
            return '<p class="block-img' + label + '">'
                + (element.linkUrl ? ('<a href="' + element.linkUrl + '">' + imgTag + '</a>') : imgTag)
                + '</p>';
        }

        if (element.type == "embed") {
            return '<div data-oembed="'+ element.embed_url
                + '" data-oembed-type="'+ element.type
                + '" data-oembed-provider="'+ element.provider_name
                + (element.label ? ('" class="' + label) : '')
                + '">' + element.oembed.html+"</div>";
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
    }

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));
