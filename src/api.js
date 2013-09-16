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

            $.ajax({
                dataType: "json",
                url: this.url,
                success: function (data) {
                    self.data = self.parse(data);
                    if (cb) {
                        cb(this);
                    }
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

            $.getJSON(
                this.form.action,
                { ref: self.data.ref.ref },
                function (d) {
                    var docs = d.map(function (doc) {
                        return new Doc(
                            doc.id,
                            doc.type,
                            doc.href,
                            doc.tags,
                            doc.slugs,

                            // Fixme: could be anything.
                            doc.data.product
                        )
                    });

                    if (cb && docs.length) {
                        cb(docs);
                    }
                }
            );
        }

    };

    (function () {

        function getFragments(field) {
            if (!this.fragments || !this.fragments[field]) {
                return [];
            }

            if (Array.isArray(this.fragments[field])) {
                return this.fragments[field];
            } else {
                return [this.fragments[field]];
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
                var fragments = getFragments.call(this, field);
                return fragments.length ? initField(fragments[0]) : null;
            },

            getAll: function (field) {
                return getFragments.call(this, field).map(function (fragment) {
                    return initField(fragment);
                }, this);
            },

            getImage: function (field) {
                var img = this.get(field);
                if (img instanceof ImageEl) {
                    return img;
                }
                if (img instanceof StructuredText) {
                    // find first image in st.
                    return img
                }
                return null;
            },

            getAllImages: function (field) {
                var images = this.getAll(field);

                return images.map(function (image) {
                    if (image instanceof ImageEl) {
                        return image;
                    }
                    if (image instanceof StructuredText) {
                        throw new Error("Not done.");
                    }
                    return null;
                });
            },

            getImageView: function (field, view) {
                var img = this.get(field);
                if (img instanceof ImageEl) {
                    return img.getView(view);
                }
                if (img instanceof StructuredText) {
                    throw new Error("Not done.");
                }
                return null;
            },

            getAllImageViews: function (field, view) {
                return this.getAllImages(field).map(function (image) {
                    return image.getView(view);
                });

            }

        };

        window.Doc = Doc;

    }());

    function Ref(ref, label, isMaster) {
        this.ref = ref;
        this.label = label;
        this.isMaster = isMaster;
    }
    Ref.prototype = {};



    function Group(tag, blocks) {
        this.tag = tag;
        this.blocks = blocks;
    }


    function StructuredText(blocks) {

        this.blocks = blocks;

    }

    StructuredText.prototype = {

        getTitle: function () {

        },

        getFirstParagraph: function() {


        },

        getFirstImage: function() {


        },

        asHtml: function(blocks, linkResolver) {

            var groups = [],
                group,
                block;

            for (block in blocks) {
                if (groups.length > 0) {
                    var lastGroup = groups[groups.length - 1];

                    group = new Group(null, []);
                    group.blocks.push(block);
                    groups.push(group);
                } else {
                    group = new Group(null, []);
                    group.blocks.push(block);
                    groups.push(group);
                }

            }

            var html = [];
            for (group in groups) {
                if (group.tag) {
                    html.push("<" + group.tag + ">");
                    for (block in group.blocks) {
                        html.push(this.asHtml(block));
                    }
                    html.push("</" + group.tag + ">");
                } else {
                    for (block in group.blocks) {
                        html.push(this.asHtml(block));
                    }
                }
            }
            return html.join();

        }

    };

    function Image(data) {

        this.main = 1

        this.views =1

    }

    function Text(data) {
        this.value = data;
    }
    Text.prototype = {
        asHtml: function () {
            return "<span>" + this.value + "</span>";
        }
    };

    function Select(data) {
        this.value = data;
    }
    Select.prototype = {
        asHtml: function () {
            return "<span>" + this.value + "</span>";
        }
    };

    function Color(data) {
        this.value = data;
    }
    Color.prototype = {
        asHtml: function () {
            return "<span>" + this.value + "</span>";
        }
    };

    function Num(data) {
        this.value = data;
    }
    Num.prototype = {
        asHtml: function () {
            return "<span>" + this.value + "</span>";
        }
    };

    function DateTime(data) {
        this.value = new Date(data);
    }

    DateTime.prototype = {
        asText: function (pattern) {
            throw new Error("not implemented");
        },

        asHtml: function () {
            return "<time>" + this.value + "</time>";
        }
    };

    function Embed(data) {
        this.value = data;
    }

    Embed.prototype = {
        asHtml: function () {
            return "<span>" + this.value + "</span>";
        }
    };

    function ImageEl(main, views) {
        this.main = main;
        this.views = views || {};
    }
    ImageEl.prototype = {
        getView: function (key) {
            if (key === "main") {
                return this.main;
            } else {
                return this.views[key];
            }
        },
        asHtml: function () {
            return main.asHtml()
        }
    };

    function ImageView(url, width, height) {
        this.url = url;
        this.width = width;
        this.height = height;
    }
    ImageView.prototype = {
        ratio: function () {
            return this.width / this.height;
        },

        asHtml: function () {
            return "<img src=" + this.url + " width=" + this.width + " height=" + this.height + ">";
        }
    }

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
                throw new Error("not implemented");
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
                    field.value.views
                );
                break;

            case "StructuredText":
                throw new Error("not implemented");
                break;

            case "Link.Document":
                throw new Error("not implemented");
                break;

            case "Link.Web":
                throw new Error("not implemented");
                break;

            default:
                console.log("Type not found:", field.type);
                break;
        }

        return output;

    }


    if (typeof window === "object" && typeof window.document === "object") {
        window.prismic = prismic;
    }

}(window));
