(function (Global, undefined) {

    "use strict";

    /**
     * The kit's main entry point; initialize your API like this: Prismic.Api(url, callback, accessToken, maybeRequestHandler)
     *
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

    /**
     * The Api object you can manipulate, notably to perform queries in your repository.
     * Most useful fields: bookmarks, refs, types, tags, ...
     */

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
         */
        init: function(url, accessToken, maybeRequestHandler) {
            this.url = url + (accessToken ? (url.indexOf('?') > -1 ? '&' : '?') + 'access_token=' + accessToken : '');
            this.accessToken = accessToken;
            this.requestHandler = maybeRequestHandler || ajaxRequest() || nodeJSRequest() || (function() {throw new Error("No request handler available (tried XMLHttpRequest & NodeJS)")})();
            return this;
        },

        /**
         * @deprecated use form() now
         * Returns a useable form from its id, as described in the RESTful description of the API.
         */
        forms: function(formId) {
            return this.form(formId);
        },

        /**
         * Returns a useable form from its id, as described in the RESTful description of the API.
         * For instance: api.form("everything") works on every repository (as "everything" exists by default)
         * You can then chain the calls: api.form("everything").query('[[:d = at(document.id, "UkL0gMuvzYUANCpf")]]').ref(ref).submit()
         *
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
     * The array is often a single-element array, expect when the field is a multiple field.
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
     */
    function Documents(page, results_per_page, results_size, total_results_size, total_pages, next_page, prev_page, results) {
		this.page = page;
		this.results_per_page = results_per_page;
		this.results_size = results_size;
		this.total_results_size = total_results_size;
		this.total_pages = total_pages;
		this.next_page = next_page;
		this.prev_page = prev_page;
		this.results = results; // an array of Doc objects
    }

    /**
     * Embodies a document as returned by the API.
     * Most useful fields: id, type, tags, slug, slugs, ...
     */
    function Doc(id, type, href, tags, slugs, fragments) {

        this.id = id;
        this.type = type;
        this.href = href;
        this.tags = tags;
        this.slug = slugs ? slugs[0] : "-";
        this.slugs = slugs;
        this.fragments = fragments;
    }

    Doc.prototype = {
        /**
         * Gets the field in the current Document object. Since you most likely know the type
         * of this field, it is advised that you use a dedicated method, like get StructuredText() or getDate(),
         * for instance.
         *
         * @param {string} name - The name of the field to get, with its type; for instance, "blog-post.author"
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
         * Gets the image field in the current Document object, for further manipulation.
         * Typical use: document.getImage('blog-post.photo').asHtml(ctx)
         *
         * @param {string} field - The name of the field to get, with its type; for instance, "blog-post.photo"
         * @returns {Image} - The Image object to manipulate
         */
        getImage: function(field) {
            var img = this.get(field);
            if (img instanceof Global.Prismic.Fragments.Image) {
                return img;
            }
            if (img instanceof Global.Prismic.Fragments.StructuredText) {
                // find first image in st.
                return img
            }
            return null;
        },

        getAllImages: function(field) {
            var images = this.getAll(field);

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
         * Gets the view within the image field in the current Document object, for further manipulation.
         * Typical use: document.getImageView('blog-post.photo', 'large').asHtml(ctx)
         *
         * @param {string} field - The name of the field to get, with its type; for instance, "blog-post.photo"
         * @returns {ImageView} - The View object to manipulate
         */
        getImageView: function(field, view) {
            var fragment = this.get(field);
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

        getAllImageViews: function(field, view) {
            return this.getAllImages(field).map(function (image) {
                return image.getView(view);
            });
        },

        /**
         * Gets the date field in the current Document object, for further manipulation.
         * Typical use: document.getDate('blog-post.publicationdate').asHtml(ctx)
         *
         * @param {string} field - The name of the field to get, with its type; for instance, "blog-post.publicationdate"
         * @returns {Date} - The Date object to manipulate
         */
        getDate: function(field) {
            var fragment = this.get(field);

            if(fragment instanceof Global.Prismic.Fragments.Date) {
                return fragment.value;
            }
        },

        /**
         * Gets the boolean field in the current Document object, for further manipulation.
         * Typical use: document.getBoolean('blog-post.enableComments').asHtml(ctx).
         * This works great with a Select field. The Select values that are considered true are: 'yes', 'on', and 'true'.
         *
         * @param {string} field - The name of the field to get, with its type; for instance, "blog-post.enableComments"
         * @returns {boolean}
         */
        getBoolean: function(field) {
            var fragment = this.get(field);
            return fragment.value && (fragment.value.toLowerCase() == 'yes' || fragment.value.toLowerCase() == 'on' || fragment.value.toLowerCase() == 'true');
        },

        /**
         * Gets the text field in the current Document object, for further manipulation.
         * Typical use: document.getText('blog-post.label').asHtml(ctx).
         * The method works with StructuredText fields, Text fields, Number fields, Select fields and Color fields.
         *
         * @param {string} field - The name of the field to get, with its type; for instance, "blog-post.label"
         * @returns {object} - either StructuredText, or Text, or Number, or Select, or Color.
         */
        getText: function(field, after) {
            var fragment = this.get(field);

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
         * Gets the StructuredText field in the current Document object, for further manipulation.
         * Typical use: document.getStructuredText('blog-post.body').asHtml(ctx).
         *
         * @param {string} field - The name of the field to get, with its type; for instance, "blog-post.body"
         * @returns {StructuredText} - The StructuredText field to manipulate.
         */
        getStructuredText: function(field) {
            var fragment = this.get(field);

            if (fragment instanceof Global.Prismic.Fragments.StructuredText) {
                return fragment;
            }
        },

        /**
         * Gets the Number field in the current Document object, for further manipulation.
         * Typical use: document.getNumber('product.price').asHtml(ctx).
         *
         * @param {string} field - The name of the field to get, with its type; for instance, "product.price"
         * @returns {Number} - The Number field to manipulate.
         */
        getNumber: function(field) {
            var fragment = this.get(field);

            if (fragment instanceof Global.Prismic.Fragments.Number) {
                return fragment.value
            }
        },

        /**
         * Gets the Group field in the current Document object, for further manipulation.
         * Typical use: document.getGroup('product.gallery').asHtml(ctx).
         *
         * @param {string} field - The name of the field to get, with its type; for instance, "product.gallery"
         * @returns {Group} - The Group field to manipulate.
         */
        getGroup: function(field) {
            var fragment = this.get(field);

            if (fragment instanceof Global.Prismic.Fragments.Group) {
                return fragment;
            }
        },

        /**
         * Shortcut to get the HTML output of the field in the current document.
         * This is the same as writing document.get(field).asHtml(ctx);
         *
         * @param {string} field - The name of the field to get, with its type; for instance, "blog-post.body"
         * @param {function} ctx - The ctx object that contains the context: ctx.api, ctx.ref, ctx.maybeRef, ctx.oauth(), et ctx.linkResolver()
         * @returns {string} - The HTML output
         */
        getHtml: function(field, ctx) {
            var fragment = this.get(field);

            if(fragment && fragment.asHtml) {
                return fragment.asHtml(ctx);
            }
        },

        /**
         * Transforms the whole document as an HTML output. Each field is separated by a <section> tag,
         * with the attribute data-field="nameoffield"
         *
         * @param {object} ctx - The ctx object that contains the context: ctx.api, ctx.ref, ctx.maybeRef, ctx.oauth(), et ctx.linkResolver()
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
     * Embodies a prismic.io ref (a past or future point in time you can query  )
     */
    function Ref(ref, label, isMaster) {
        this.ref = ref;
        this.label = label;
        this.isMaster = isMaster;
    }
    Ref.prototype = {};

    // -- Export Globally

    Global.Prismic = {
        Api: prismic
    }

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));
