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
    return frags.length ? frags[0] : null;
  },

  /**
   * Builds an array of all the fragments in case they are multiple.
   *
   * @param {string} name - The name of the multiple fragment to get, with its type; for instance, "blog-post.author"
   * @returns {array} - An array of each JavaScript fragment object to manipulate.
   */
  getAll: function(name) {
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
  getImage: function(fragment) {
    var Fragments = require('./fragments');
    var img = this.get(fragment);
    if (img instanceof Fragments.Image) {
      return img;
    }
    if (img instanceof Fragments.StructuredText) {
      // find first image in st.
      return img;
    }
    return null;
  },

  // Useful for obsolete multiples
  getAllImages: function(fragment) {
    var Fragments = require('./fragments');
    var images = this.getAll(fragment);

    return images.map(function (image) {
      if (image instanceof Fragments.Image) {
        return image;
      }
      if (image instanceof Fragments.StructuredText) {
        throw new Error("Not done.");
      }
      return null;
    });
  },


  getFirstImage: function() {
    var Fragments = require('./fragments');
    var fragments = this.fragments;

    var firstImage = Object.keys(fragments).reduce(function(image, key) {
      if (image) {
        return image;
      } else {
        var element = fragments[key];
        if(typeof element.getFirstImage === "function") {
          return element.getFirstImage();
        } else if (element instanceof Fragments.Image) {
          return element;

        } else return null;
      }
    }, null);
    return firstImage;
  },

  getFirstTitle: function() {
    var Fragments = require('./fragments');
    var fragments = this.fragments;

    var firstTitle = Object.keys(fragments).reduce(function(st, key) {
      if (st) {
        return st;
      } else {
        var element = fragments[key];
        if(typeof element.getFirstTitle === "function") {
          return element.getFirstTitle();
        } else if (element instanceof Fragments.StructuredText) {
          return element.getTitle();
        } else return null;
      }
    }, null);
    return firstTitle;
  },

  getFirstParagraph: function() {
    var fragments = this.fragments;

    var firstParagraph = Object.keys(fragments).reduce(function(st, key) {
      if (st) {
        return st;
      } else {
        var element = fragments[key];
        if(typeof element.getFirstParagraph === "function") {
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
  getImageView: function(name, view) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);
    if (fragment instanceof Fragments.Image) {
      return fragment.getView(view);
    }
    if (fragment instanceof Fragments.StructuredText) {
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
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Timestamp) {
      return fragment.value;
    }
    return null;
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
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Date) {
      return fragment.value;
    }
    return null;
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
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.StructuredText) {
      return fragment.blocks.map(function(block) {
        if (block.text) {
          return block.text + (after ? after : '');
        }
        return '';
      }).join('\n');
    }

    if (fragment instanceof Fragments.Text) {
      if(fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }

    if (fragment instanceof Fragments.Number) {
      if(fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }

    if (fragment instanceof Fragments.Select) {
      if(fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }

    if (fragment instanceof Fragments.Color) {
      if(fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }

    return null;
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

    if (fragment instanceof require('./fragments').StructuredText) {
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
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.WebLink ||
        fragment instanceof Fragments.DocumentLink ||
        fragment instanceof Fragments.FileLink ||
        fragment instanceof Fragments.ImageLink) {
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
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Number) {
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
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Color) {
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
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if(fragment instanceof Fragments.GeoPoint) {
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

    if (fragment instanceof require('./fragments').Group) {
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
    var Fragments = require('./fragments');
    for (var field in this.data) {
      var fragment = this.get(field);
      if (fragment instanceof Fragments.DocumentLink) {
        result.push(fragment);
      }
      if (fragment instanceof Fragments.StructuredText) {
        for (i = 0; i < fragment.blocks.length; i++) {
          var block = fragment.blocks[i];
          if (block.type == "image" && block.linkTo) {
            link = Fragments.initField(block.linkTo);
            if (link instanceof Fragments.DocumentLink) {
              result.push(link);
            }
          }
          var spans = block.spans || [];
          for (j = 0; j < spans.length; j++) {
            var span = spans[j];
            if (span.type == "hyperlink") {
              link = Fragments.initField(span.data);
              if (link instanceof Fragments.DocumentLink) {
                result.push(link);
              }
            }
          }
        }
      }
      if (fragment instanceof Fragments.Group) {
        for (i = 0; i < fragment.value.length; i++) {
          result = result.concat(fragment.value[i].linkedDocuments());
        }
      }
      if (fragment instanceof Fragments.SliceZone) {
        for (i = 0; i < fragment.value.length; i++) {
          var slice = fragment.value[i];
          if (slice.value instanceof Fragments.DocumentLink) {
            result.push(slice.value);
          }
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
function Document(id, uid, type, href, tags, slugs, firstPublicationDate, lastPublicationDate, data) {
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
   * The first publication date of the document
   */
  this.firstPublicationDate = firstPublicationDate ? new Date(firstPublicationDate) : null;
  /**
   * The last publication date of the document
   */
  this.lastPublicationDate = lastPublicationDate ? new Date(lastPublicationDate) : null;
  /**
   * Fragments, converted to business objects
   */
  this.fragments = require('./fragments').parseFragments(data);
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
Document.prototype.getSliceZone = function(name) {
  var fragment = this.get(name);

  if (fragment instanceof require('./fragments').SliceZone) {
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
  this.fragments = require('./fragments').parseFragments(data);
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
