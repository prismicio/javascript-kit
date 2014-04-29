(function (Global, undefined) {

    "use strict";

    /**
     * The kit's main entry point; initialize your API like this: Prismic.Api(url, callback, accessToken, maybeRequestHandler)
     *
     * @global
     * @alias Api
     * @constructor
     * @param {string} url - The mandatory URL of the prismic.io API endpoint (like: https://lesbonneschoses.prismic.io/api)
     * @param {function} callback - Optional callback function that is called after the API was retrieved, to which you may pass two parameters: a potential error (null if no problem), and the API object
     * @param {string} accessToken - The optional accessToken for the OAuth2 connection
     * @param {function} maybeRequestHandler - The kit knows how to handle the HTTP request in Node.js and in the browser (with Ajax); you will need to pass a maybeRequestHandler if you're in another JS environment
     * @returns {Api} - The Api object that can be manipulated
     */
    var prismic = function(url, callback, accessToken, maybeRequestHandler) {
        var api = new prismic.fn.init(url, accessToken, maybeRequestHandler);
        callback && api.get(callback);
        return api;
    };
    // note that the prismic variable is later affected as "Api" while exporting

    // -- Request handlers

    var ajaxRequest = (function() {
        if(typeof XMLHttpRequest != 'undefined') {
            return function(url, callback) {

                var xhr = new XMLHttpRequest();

                // Called on success
                var resolve = function() {
                    callback(null, JSON.parse(xhr.responseText));
                }

                // Called on error
                var reject = function() {
                    var status = xhr.status;
                    callback(new Error("Unexpected status code [" + status + "] on URL "+url));
                }

                // Bind the XHR finished callback
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if(xhr.status && xhr.status == 200) {
                            resolve(xhr);
                        } else {
                            reject(xhr);
                        }
                    }
                };

                // Open the XHR
                xhr.open('GET', url, true);

                // Json request
                xhr.setRequestHeader('Accept', 'application/json');

                // Send the XHR
                xhr.send();
            }
        }
    });

    var nodeJSRequest = (function() {
        if(typeof require == 'function' && require('http')) {
            var requestsCache = {},
                http = require('http'),
                https = require('https'),
                url = require('url'),
                querystring = require('querystring');

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
                            headers: { 'Accept': 'application/json' }
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

                              callback(null, json);
                            });
                        } else {
                            callback(new Error("Unexpected status code [" + response.statusCode + "] on URL "+requestUrl));
                        }
                    });

                }

            };
        }
    });

    // Defining Api's instance methods; note that the prismic variable is later affected as "Api" while exporting
    prismic.fn = prismic.prototype = {

        constructor: prismic,
        data: null,

        /**
         * Requests (with the proper handler), parses, and returns the /api document.
         * This is for internal use, from outside this kit, you should call Prismic.Api()
         *
         * @param {function} callback - Optional callback function that is called after the query is made, to which you may pass two parameters: a potential error (null if no problem), and the API object
         * @returns {Api} - The Api object that can be manipulated
         */
        get: function(callback) {
            var self = this;

            this.requestHandler(this.url, function(error, data) {
                if (error) {
                    callback(error);
                } else {
                    self.data = self.parse(data);
                    self.bookmarks = self.data.bookmarks;
                    callback(null, self, this);
                }
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
                        f.fields['accessToken'] = {
                            type: 'string',
                            default: this.accessToken
                        };
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
                    r.isMasterRef
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
        init: function(url, accessToken, maybeRequestHandler) {
            this.url = url + (accessToken ? (url.indexOf('?') > -1 ? '&' : '?') + 'access_token=' + accessToken : '');
            this.accessToken = accessToken;
            this.requestHandler = maybeRequestHandler || ajaxRequest() || nodeJSRequest() || (function() {throw new Error("No request handler available (tried XMLHttpRequest & NodeJS)")})();
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
            if(form.fields[field].default) {
                this.data[field] = [form.fields[field].default];
            }
        }
    };

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
            return this.set("q", query);
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
         * to which you may pass two parameters: a potential error (null if no problem),
         * and a Documents object (containing all the pagination specifics + the array of Docs)
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

            this.api.requestHandler(url, function (err, documents) {

                if (err) { callback(err); return; }

                var results = documents.results.map(function (doc) {
                    var fragments = {}

                    for(var field in doc.data[doc.type]) {
                        fragments[doc.type + '.' + field] = doc.data[doc.type][field]
                    }

                    return new Doc(
                        doc.id,
                        doc.type,
                        doc.href,
                        doc.tags,
                        doc.slugs,
                        fragments
                    )
                });

                callback(null, new Documents(
					documents.page,
					documents.results_per_page,
					documents.results_size,
					documents.total_results_size,
					documents.total_pages,
					documents.next_page,
					documents.prev_page,
					results || [])
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

    };

    /**
     * Embodies the result of a SearchForm query as returned by the API.
     * It includes all the fields that are useful for pagination (page, total_pages, total_results_size, ...),
     * as well as the field "results", which is an array of Doc objects, the documents themselves.
     * @constructor
     * @global
     */
    function Documents(page, results_per_page, results_size, total_results_size, total_pages, next_page, prev_page, results) {
        /**
         * @field
         * @description the current page number
         */
		this.page = page;
        /**
         * @field
         * @description the number of results per page
         */
		this.results_per_page = results_per_page;
        /**
         * @field
         * @description the size of the current page
         */
		this.results_size = results_size;
        /**
         * @field
         * @description the total size of results across all pages
         */
		this.total_results_size = total_results_size;
        /**
         * @field
         * @description the total number of pages
         */
		this.total_pages = total_pages;
        /**
         * @field
         * @description the URL of the next page in the API
         */
		this.next_page = next_page;
        /**
         * @field
         * @description the URL of the previous page in the API
         */
		this.prev_page = prev_page;
        /**
         * @field
         * @description the array of the {Doc} objects
         */
		this.results = results;
    }

    /**
     * Embodies a document as returned by the API.
     * Most useful fields: id, type, tags, slug, slugs, ...
     * @constructor
     * @global
     * @alias Doc
     */
    function Doc(id, type, href, tags, slugs, fragments) {

        /**
         * @field
         * @description the ID of the document
         */
        this.id = id;
        /**
         * @field
         * @description the type of the document
         */
        this.type = type;
        /**
         * @field
         * @description the URL of the document in the API
         */
        this.href = href;
        /**
         * @field
         * @description the tags of the document
         */
        this.tags = tags;
        /**
         * @field
         * @description the current slug of the document
         */
        this.slug = slugs ? slugs[0] : "-";
        /**
         * @field
         * @description all the slugs that were ever used by this document (including the current one, at the head)
         */
        this.slugs = slugs;
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
         * Typical use: document.getImage('blog-post.photo').asHtml(ctx)
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
                return img
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
         * Typical use: document.getImageView('blog-post.photo', 'large').asHtml(ctx)
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.photo"
         * @returns {ImageView} - The View object to manipulate
         */
        getImageView: function(fragment, view) {
            var fragment = this.get(fragment);
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
        getAllImageViews: function(fragment, view) {
            return this.getAllImages(fragment).map(function (image) {
                return image.getView(view);
            });
        },

        /**
         * Gets the date fragment in the current Document object, for further manipulation.
         * Typical use: document.getDate('blog-post.publicationdate').asHtml(ctx)
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.publicationdate"
         * @returns {Date} - The Date object to manipulate
         */
        getDate: function(fragment) {
            var fragment = this.get(fragment);

            if(fragment instanceof Global.Prismic.Fragments.Date) {
                return fragment.value;
            }
        },

        /**
         * Gets a boolean value of the fragment in the current Document object, for further manipulation.
         * Typical use: if(document.getBoolean('blog-post.enableComments')) { ... }
         * This works great with a Select fragment. The Select values that are considered true are (lowercased before matching): 'yes', 'on', and 'true'.
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.enableComments"
         * @returns {boolean} - The boolean value of the fragment
         */
        getBoolean: function(fragment) {
            var fragment = this.get(fragment);
            return fragment.value && (fragment.value.toLowerCase() == 'yes' || fragment.value.toLowerCase() == 'on' || fragment.value.toLowerCase() == 'true');
        },

        /**
         * Gets the text fragment in the current Document object, for further manipulation.
         * Typical use: document.getText('blog-post.label').asHtml(ctx).
         * The method works with StructuredText fragments, Text fragments, Number fragments, Select fragments and Color fragments.
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.label"
         * @param {string} after - a suffix that will be appended to the value
         * @returns {object} - either StructuredText, or Text, or Number, or Select, or Color.
         */
        getText: function(fragmentName, after) {
            var fragment = this.get(fragmentName);

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
         * Typical use: document.getStructuredText('blog-post.body').asHtml(ctx).
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.body"
         * @returns {StructuredText} - The StructuredText fragment to manipulate.
         */
        getStructuredText: function(fragment) {
            var fragment = this.get(fragment);

            if (fragment instanceof Global.Prismic.Fragments.StructuredText) {
                return fragment;
            }
        },

        /**
         * Gets the Number fragment in the current Document object, for further manipulation.
         * Typical use: document.getNumber('product.price')
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "product.price"
         * @returns {number} - The number value of the fragment.
         */
        getNumber: function(fragment) {
            var fragment = this.get(fragment);

            if (fragment instanceof Global.Prismic.Fragments.Number) {
                return fragment.value;
            }
        },

        /**
         * Gets the Color fragment in the current Document object, for further manipulation.
         * Typical use: document.getColor('product.color')
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "product.color"
         * @returns {string} - The string value of the Color fragment.
         */
        getColor: function(fragment) {
            var fragment = this.get(fragment);

            if (fragment instanceof Global.Prismic.Fragments.Color) {
                return fragment.value;
            }
        },

        /**
         * Gets the Group fragment in the current Document object, for further manipulation.
         * Typical use: document.getGroup('product.gallery').asHtml(ctx).
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "product.gallery"
         * @returns {Group} - The Group fragment to manipulate.
         */
        getGroup: function(fragment) {
            var fragment = this.get(fragment);

            if (fragment instanceof Global.Prismic.Fragments.Group) {
                return fragment;
            }
        },

        /**
         * Shortcut to get the HTML output of the fragment in the current document.
         * This is the same as writing document.get(fragment).asHtml(ctx);
         *
         * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.body"
         * @param {function} ctx - The ctx object that contains the context: ctx.api, ctx.ref, ctx.maybeRef, ctx.oauth(), and ctx.linkResolver()
         * @returns {string} - The HTML output
         */
        getHtml: function(fragment, ctx) {
            var fragment = this.get(fragment);

            if(fragment && fragment.asHtml) {
                return fragment.asHtml(ctx);
            }
        },

        /**
         * Transforms the whole document as an HTML output. Each fragment is separated by a <section> tag,
         * with the attribute data-field="nameoffragment"
         *
         * @param {object} ctx - The ctx object that contains the context: ctx.api, ctx.ref, ctx.maybeRef, ctx.oauth(), and ctx.linkResolver()
         * @returns {string} - The HTML output
         */
        asHtml: function(ctx) {
            var htmls = [];
            for(var field in this.fragments) {
                var fragment = this.get(field)
                htmls.push(fragment && fragment.asHtml ? '<section data-field="' + field + '">' + fragment.asHtml(ctx) + '</section>' : '')
            }
            return htmls.join('')
        }

    };

    /**
     * Embodies a prismic.io ref (a past or future point in time you can query)
     * @constructor
     * @global
     */
    function Ref(ref, label, isMaster) {
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
    }
    Ref.prototype = {};

    // -- Export Globally

    Global.Prismic = {
        Api: prismic
    }

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
            return "<a href=\""+this.url()+"\"><img src=\""+this.url()+"\"</a>";
        },
        /**
         * Returns the URL of the link.
         *
         * @returns {string} - the proper URL to use
         */
        url: function() {
            return this.value.image.url;
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
        }
    };

    /**
     * Embodies a DateTime fragment
     * @constructor
     * @global
     * @alias Fragments:DateTime
     */
    function DateTime(data) {
        /**
         * @field
         * @description the Date value of the fragment (as a regular JS Date object)
         */
        this.value = new Date(data);
    }

    DateTime.prototype = {
        asText: function (pattern) {
            throw new Error("not implemented");
        },
        /**
         * Turns the fragment into a useable HTML version of it.
         * If the native HTML code doesn't suit your design, this function is meant to be overriden.
         *
         * @returns {string} - basic HTML code for the fragment
         */
        asHtml: function () {
            return "<time>" + this.value + "</time>";
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
        }
    };

    /**
     * Embodies an image view (an image in prismic.io can be defined with several different thumbnail sizes, each size is called a "view")
     * @constructor
     * @global
     * @alias Fragments:ImageView
     */
    function ImageView(url, width, height) {
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
            return "<img src=" + this.url + " width=" + this.width + " height=" + this.height + ">";
        }
    }

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
       }
    }


    /**
     * Embodies a group of text blocks in a structured text fragment, like a group of list items.
     * This is only used in the serialization into HTML of structured text fragments.
     * @constructor
     * @private
     */
    function BlockGroup(tag, blocks) {
        this.tag = tag;
        this.blocks = blocks;
    }

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

        getTitle: function () {
            for(var i=0; i<this.blocks.length; i++) {
                var block = this.blocks[i];
                if(block.type.indexOf('heading') == 0) {
                    return block;
                }
            }
        },

        getFirstParagraph: function() {
            for(var i=0; i<this.blocks.length; i++) {
                var block = this.blocks[i];
                if(block.type == 'paragraph') {
                    return block;
                }
            }
        },

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

        getParagraph: function(n) {
            return this.getParagraphs()[n];
        },

        getFirstImage: function() {
            for(var i=0; i<this.blocks.length; i++) {
                var block = this.blocks[i];
                if(block.type == 'image') {
                    return new ImageView(
                        block.url,
                        block.dimensions.width,
                        block.dimensions.height
                    );
                }
            }
        },

        /**
         * Turns the fragment into a useable HTML version of it.
         * If the native HTML code doesn't suit your design, this function is meant to be overriden.
         * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
         * @returns {string} - basic HTML code for the fragment
         */
        asHtml: function(ctx) {
            return StructuredTextAsHtml.call(this, this.blocks, ctx);
        }

    };

    /**
     * Transforms a list of blocks as proper HTML.
     *
     * @private
     * @param {array} blocks - the array of blocks to deal with
     * @param {object} ctx - the context object, containing the linkResolver function to build links that may be in the fragment (please read prismic.io's online documentation about this)
     * @returns {string} - the HTML output
     */
    function StructuredTextAsHtml (blocks, ctx) {

        var blockGroups = [],
            blockGroup,
            block,
            html = [];

        if (Array.isArray(blocks)) {
            for(var i=0; i<blocks.length; i++) {
                block = blocks[i];

                if (block.type != "list-item" && block.type != "o-list-item") { // it's not a type that groups
                    blockGroup = new BlockGroup(block.type, []);
                    blockGroups.push(blockGroup);
                }
                else if (blockGroup && blockGroup.tag != block.type) { // it's a new type
                    blockGroup = new BlockGroup(block.type, []);
                    blockGroups.push(blockGroup);
                }
                // else: it's the same type as before, no touching group

                blockGroup.blocks.push(block);
            };

            blockGroups.forEach(function (blockGroup) {

                if(blockGroup.tag == "heading1") {
                    html.push('<h1>' + insertSpans(blockGroup.blocks[0].text, blockGroup.blocks[0].spans, ctx) + '</h1>');
                }
                else if(blockGroup.tag == "heading2") {
                    html.push('<h2>' + insertSpans(blockGroup.blocks[0].text, blockGroup.blocks[0].spans, ctx) + '</h2>');
                }
                else if(blockGroup.tag == "heading3") {
                    html.push('<h3>' + insertSpans(blockGroup.blocks[0].text, blockGroup.blocks[0].spans, ctx) + '</h3>');
                }
                else if(blockGroup.tag == "paragraph") {
                    html.push('<p>' + insertSpans(blockGroup.blocks[0].text, blockGroup.blocks[0].spans, ctx) + '</p>');
                }
                else if(blockGroup.tag == "preformatted") {
                    html.push('<pre>' + blockGroup.blocks[0].text + '</pre>');
                }
                else if(blockGroup.tag == "image") {
                    html.push('<p><img src="' + blockGroup.blocks[0].url + '"></p>');
                }
                else if(blockGroup.tag == "embed") {
                    html.push('<div data-oembed="'+ blockGroup.blocks[0].embed_url
                        + '" data-oembed-type="'+ blockGroup.blocks[0].type
                        + '" data-oembed-provider="'+ blockGroup.blocks[0].provider_name
                        + '">' + blockGroup.blocks[0].oembed.html+"</div>")
                }
                else if(blockGroup.tag == "list-item" || blockGroup.tag == "o-list-item") {
                    html.push(blockGroup.tag == "list-item"?'<ul>':"<ol>");
                    blockGroup.blocks.forEach(function(block){
                        html.push("<li>"+insertSpans(block.text, block.spans, ctx)+"</li>");
                    });
                    html.push(blockGroup.tag == "list-item"?'</ul>':"</ol>");
                }
                else throw new Error(blockGroup.tag+" not implemented");
            });

        }

        return html.join('');

    }

    /**
     * Parses a block that has spans, and inserts the proper HTML code.
     *
     * @private
     * @param {string} text - the original text of the block
     * @param {object} span - the spans as returned by the API
     * @param {object} ctx - the context object, containing the linkResolver function to build links that may be in the fragment (please read prismic.io's online documentation about this)
     * @returns {string} - the HTML output
     */
    function insertSpans(text, spans, ctx) {
        var textBits = [];
        var tags = [];
        var cursor = 0;
        var html = [];

        /* checking the spans are following each other, or else not doing anything */
        spans.forEach(function(span){
            if (span.end < span.start) return text;
            if (span.start < cursor) return text;
            cursor = span.end;
        });

        cursor = 0;

        spans.forEach(function(span){
            textBits.push(text.substring(0, span.start-cursor));
            text = text.substring(span.start-cursor);
            cursor = span.start;
            textBits.push(text.substring(0, span.end-cursor));
            text = text.substring(span.end-cursor);
            tags.push(span);
            cursor = span.end;
        });
        textBits.push(text);

        tags.forEach(function(tag, index){
            html.push(textBits.shift());
            if(tag.type == "hyperlink"){
                // Since the content of tag.data is similar to a link fragment, we can initialize it just like a fragment.
                html.push('<a href="'+ initField(tag.data).url(ctx) +'">');
                html.push(textBits.shift());
                html.push('</a>');
            } else {
                html.push('<'+tag.type+'>');
                html.push(textBits.shift());
                html.push('</'+tag.type+'>');
            }
        });
        html.push(textBits.shift());

        return html.join('');
    }

    /**
     * From a fragment's name, casts it into the proper object type (like Prismic.Fragments.StructuredText)
     *
     * @private
     * @param {string} field - the fragment's name
     * @returns {object} - the object of the proper Fragments type.
     */
    function initField(field) {

        var output,
            img;

        switch (field.type) {

            case "Color":
                output = new Color(field.value);
                break;

            case "Number":
                output = new Num(field.value);
                break;

            case "Date":
                output = new DateTime(field.value);
                break;

            case "Text":
                output = new Text(field.value);
                break;

            case "Embed":
                output = new Embed(field.value);
                break;

            case "Select":
                output = new Select(field.value);
                break;

            case "Image":
                var img = field.value.main;
                output = new ImageEl(
                    new ImageView(
                        img.url,
                        img.dimensions.width,
                        img.dimensions.height
                    ),
                    {}
                );
                for (var name in field.value.views) {
                    var img = field.value.views[name];
                    output.views[name] = new ImageView(
                        img.url,
                        img.dimensions.width,
                        img.dimensions.height
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
                console.log("Fragment type not supported: ", field.type);
                break;
        }

        return output;

    }

    Global.Prismic.Fragments = {
        Image: ImageEl,
        ImageView: ImageView,
        Text: Text,
        Number: Num,
        Date: DateTime,
        Select: Select,
        Color: Color,
        StructuredText: StructuredText,
        WebLink: WebLink,
        DocumentLink: DocumentLink,
        ImageLink: ImageLink,
        FileLink: FileLink,
        Group: Group,
        initField: initField
    }

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));
