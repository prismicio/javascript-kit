(function (window, undefined) {

    "use strict";

    var prismic = function(url) {

            return new prismic.fn.init(url);

        };

    prismic.fn = prismic.prototype = {

        constructor: prismic,
        data: null,

        get: function (cb) {

            var self = this;

            // Note: jQuery only used for testing
            $.getJSON(this.url, function (data) {

                self.data = self.parse(data);
                if (cb) {
                    cb(this);
                }

            });
        },

        parse: function (data) {

            var refs,
                master,
                forms = {},
                form,
                f,
                i;

            // Parse the forms
            for (i in data.forms) {
                if (data.forms.hasOwnProperty(i)) {
                    f = data.forms[i];
                    form = new Form(
                        f.name,
                        f.fields,
                        f.form_method,
                        f.rel,
                        f.enctype,
                        f.action
                    );

                    // Init the search form
                    forms[i] = new SearchForm(this, form, {});
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

            if (master.length === 0) {
                throw ("No master ref.");
            }

            return {
                bookmarks: data.bookmarks || [],
                refs: refs,
                forms: forms,
                master: master[0]
            };

        },

        init: function (url) {

            this.url = url;

            return this;

        },

        forms: function (formId) {

            return this.data.forms[formId];

        },

        bookmarks: function () {

            return this.data.bookmarks;

        }

    };
    prismic.fn.init.prototype = prismic.fn;


    function Form(name, fields, form_method, rel, enctype, action) {

        this.name = name;
        this.fields = fields;
        this.form_method = form_method;
        this.rel = rel;
        this.enctype = enctype;
        this.action = action;

    }
    Form.prototype = {};


    function SearchForm(api, form, data) {

        this.api = api;
        this.form = form;
        this.data = data;

    }
    SearchForm.prototype = {

        ref: function (ref) {

            this.data.ref = ref;
            return this;

        },

        query: function (query) {

            this.data.q = "[${" + (this.form.fields.q || "") + "}${" + query + "}]";
            return this;

        },

        submit: function (cb) {

            var self = this;

            // Simulate queryin' async
            setTimeout(function () {

                console.log("LOADING [ref/form]:", self.data.ref, self.form);
                if (cb) {
                    cb([new Doc(), new Doc()]);
                }

            }, 200);

        }

    };

    function Doc(id, type, href, tags, slugs, fragments) {

        this.id = id;
        this.type = type;
        this.href = href;
        this.tags = tags;
        this.slugs = slugs;
        this.fragments = fragments;

    }
    Doc.prototype = {

        slug: function () {

            return this.slugs ? this.slugs[0] : "-";

        },

        get: function (field) {

            return this.fragments.filter(function (f) {

                return f === field;

            });

        },

        getAll: function (field) {

            return this.fragments.length ? this.fragments[0] : [];

        }

    };

    function Field(type, def) {

        this.type = type;
        this.def = def;

    }
    Field.prototype = {};


    function Ref(ref, label, isMaster) {

        this.ref = ref;
        this.label = label;
        this.isMaster = isMaster;

    }
    Ref.prototype = {};


    if (typeof window === "object" && typeof window.document === "object") {
        window.prismic = prismic;
    }

}(window));
