(function(window, undefined) {

  "use strict";

  var prismic = function(url, onReady, accessToken) {
    var api = new prismic.fn.init(url, accessToken);
    onReady && api.get(onReady);
    return api;
  };

  prismic.fn = prismic.prototype = {

    constructor: prismic,
    data: null,

    get: function(cb) {
      var self = this;

      $.ajax({
        dataType: "json",
        url: this.url,
        success: function(data) {
          self.data = self.parse(data);
          self.bookmarks = self.data.bookmarks;
          if (cb) {
            cb(self, this);
          }
        }
      });
    },

    parse: function(data) {
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

          if (this.accessToken) {
            f.fields.accessToken = {
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

      refs = data.refs.map(function(r) {
        return new Ref(
          r.ref,
          r.label,
          r.isMasterRef
        );
      }) || [];

      master = refs.filter(function(r) {
        return r.isMaster === true;
      });

      if (master.length === 0) {
        throw ("No master ref.");
      }

      return {
        bookmarks: data.bookmarks || {},
        refs: refs,
        forms: forms,
        master: master[0],
        oauthInitiate: data.oauth_initiate,
        oauthToken: data.oauth_token
      };

    },

    init: function(url, accessToken) {
      this.url = url + (accessToken ? (url.indexOf('?') > -1 ? '&' : '?') + 'access_token=' + accessToken : '');
      this.accessToken = accessToken;
      return this;
    },

    forms: function(formId) {
      // For compatibility
      return this.form(formId);
    },

    form: function(formId) {
      var form = this.data.forms[formId];
      if (form) {
        return new SearchForm(this, form, {});
      }
    },

    master: function() {
      return this.data.master.ref;
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
    this.data = data || {};

    if (form.fields && form.fields.q) {
      for (var f in form.fields) {
        var val = this.data[f];
        if (!val) {
          this.data[f] = [];
        }
        // FIXME: only handle value "default"?
        if (f === "q") {
          this.query(form.fields[f].default);
        } else {
          this.data[f].push(form.fields[f].default);
        }
      }
    }

  }

  SearchForm.prototype = {

    ref: function(ref) {
      this.data.ref = ref;
      return this;
    },

    query: function(query) {

      function strip(q) {
        if (q === null) return "";
        if (q.indexOf("[") === 0 && q.lastIndexOf("]") === q.length - 1) {
          return q.substring(1, q.length - 1);
        }
        return q;
      }

      this.data.q = this.data.q || [];
      this.data.q.push(strip(query));

      return this;
    },

    submit: function(cb) {
      var self = this;

      var q = "[" + this.data.q.join("") + "]",
        ref = this.data.ref,
        params = {
          ref: ref
        };

      if (this.data.q.length === 1 && this.data.q[0] === "") {

      } else {
        params.q = q;
      }

      if (this.data.accessToken && this.data.accessToken.length) {
        params.access_token = this.data.accessToken[0];
      }

      $.getJSON(
        this.form.action + '#json',
        params,
        function(d) {
          var docs = d.map(function(doc) {
            var fragments = {};

            for (var field in doc.data[doc.type]) {
              fragments[doc.type + '.' + field] = doc.data[doc.type][field];
            }

            return new Doc(
              doc.id,
              doc.type,
              doc.href,
              doc.tags,
              doc.slugs,
              fragments
            );
          });

          if (cb && docs.length) {
            cb(docs);
          }
        }
      );
    }

  };

  (function() {

    function getFragments(field) {
      if (!this.fragments || !this.fragments[field]) {
        return [];
      }

      if (Array.isArray(this.fragments[field])) {
        return this.fragments[field];
      } else {
        return [this.fragments[field]];
      }

    }

    function Doc(id, type, href, tags, slugs, fragments) {
      this.id = id;
      this.type = type;
      this.href = href;
      this.tags = tags;
      this.slug = slugs ? slugs[0] : "-";
      this.fragments = fragments;
    }

    Doc.prototype = {

      get: function(field) {
        var frags = getFragments.call(this, field);
        return frags.length ? Prismic.Fragments.initField(frags[0]) : null;
      },

      getAll: function(field) {
        return getFragments.call(this, field).map(function(fragment) {
          return Prismic.Fragments.initField(fragment);
        }, this);
      },

      getImage: function(field) {
        var img = this.get(field);
        if (img instanceof Prismic.Fragments.Image) {
          return img;
        }
        if (img instanceof Prismic.Fragments.StructuredText) {
          // find first image in st.
          return img;
        }
        return null;
      },

      getAllImages: function(field) {
        var images = this.getAll(field);

        return images.map(function(image) {
          if (image instanceof Prismic.Fragments.Image) {
            return image;
          }
          if (image instanceof Prismic.Fragments.StructuredText) {
            throw new Error("Not done.");
          }
          return null;
        });
      },

      getImageView: function(field, view) {
        var fragment = this.get(field);
        if (fragment instanceof Prismic.Fragments.Image) {
          return fragment.getView(view);
        }
        if (fragment instanceof Prismic.Fragments.StructuredText) {
          for (var i = 0; i < fragment.blocks.length; i++) {
            if (fragment.blocks[i].type == 'image') {
              return fragment.blocks[i];
            }
          }
        }
        return null;
      },

      getAllImageViews: function(field, view) {
        return this.getAllImages(field).map(function(image) {
          return image.getView(view);
        });
      },

      getDate: function(field) {
        var fragment = this.get(field);
        if (fragment instanceof Prismic.Fragments.Date) {
          return fragment.value;
        }
      },

      getBoolean: function(field) {
        var fragment = this.get(field);
        return fragment.value && (fragment.value.toLowerCase() == 'yes' || fragment.value.toLowerCase() == 'on' || fragment.value.toLowerCase() == 'true');
      },

      getText: function(field, after) {
        var fragment = this.get(field);
        if (fragment instanceof Prismic.Fragments.StructuredText) {
          return fragment.blocks.map(function(block) {
            if (block.text) {
              return block.text + (after ? after : '');
            }
          }).join('\n');
        }

        if (fragment instanceof Prismic.Fragments.Text) {
          if (fragment.value) {
            return fragment.value + (after ? after : '');
          }
        }

        if (fragment instanceof Prismic.Fragments.Number) {
          if (fragment.value) {
            return fragment.value + (after ? after : '');
          }
        }

        if (fragment instanceof Prismic.Fragments.Select) {
          if (fragment.value) {
            return fragment.value + (after ? after : '');
          }
        }

        if (fragment instanceof Prismic.Fragments.Color) {
          if (fragment.value) {
            return fragment.value + (after ? after : '');
          }
        }
      },

      getStructuredText: function(field) {
        var fragment = this.get(field);

        if (fragment instanceof Prismic.Fragments.StructuredText) {
          return fragment;
        }
      },

      getNumber: function(field) {
        var fragment = this.get(field);

        if (fragment instanceof Prismic.Fragments.Number) {
          return fragment.value;
        }
      },

      getHtml: function(field, linkResolver) {
        var fragment = this.get(field);

        if (fragment && fragment.asHtml) {
          return fragment.asHtml(linkResolver);
        }
      },

      asHtml: function(linkResolver) {
        var htmls = [];
        for (var field in this.fragments) {
          var fragment = this.get(field);
          htmls.push(fragment && fragment.asHtml ? '<section data-field="' + field + '">' + fragment.asHtml(linkResolver) + '</section>' : '');
        }
        return htmls.join('');
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

  if (typeof window === "object" && typeof window.document === "object") {
    window.Prismic = {
      Api: prismic
    };
  }

}(window));
