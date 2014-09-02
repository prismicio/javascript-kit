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
     * Embodies a group of text blocks in a structured text fragment, like a group of list items.
     * This is only used in the serialization into HTML of structured text fragments.
     * @constructor
     * @private
     */
    function BlockGroup(tag, blocks, label) {
        this.tag = tag;
        this.blocks = blocks;
        this.label = label;
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
                        block.dimensions.height,
                        block.alt
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
                    blockGroup = new BlockGroup(block.type, [], block.label);
                    blockGroups.push(blockGroup);
                }
                else if (!blockGroup || blockGroup.tag != block.type) { // it's a new type or no BlockGroup was set so far
                    blockGroup = new BlockGroup(block.type, [], block.label);
                    blockGroups.push(blockGroup);
                }
                // else: it's the same type as before, no touching blockGroup

                blockGroup.blocks.push(block);
            }

            var TAG_NAMES = {
                "heading1": "h1",
                "heading2": "h2",
                "heading3": "h3",
                "heading4": "h4",
                "heading5": "h5",
                "heading6": "h6",
                "paragraph": "p"
            };

            blockGroups.forEach(function (blockGroup) {
                var classCode = blockGroup.label ? ' class ="' + blockGroup.label + '"' : '';
                if (TAG_NAMES[blockGroup.tag]) {
                    var name = TAG_NAMES[blockGroup.tag];
                    html.push('<' + name + classCode + '>'
                      + insertSpans(blockGroup.blocks[0].text, blockGroup.blocks[0].spans, ctx)
                      + '</' + name + '>');
                }
                else if(blockGroup.tag == "preformatted") {
                    html.push('<pre' + classCode + '>' + blockGroup.blocks[0].text + '</pre>');
                }
                else if(blockGroup.tag == "image") {
                    html.push('<p' + classCode + '><img src="' + blockGroup.blocks[0].url + '" alt="' + blockGroup.blocks[0].alt + '"></p>');
                }
                else if(blockGroup.tag == "embed") {
                    html.push('<div data-oembed="'+ blockGroup.blocks[0].embed_url
                        + '" data-oembed-type="'+ blockGroup.blocks[0].type
                        + '" data-oembed-provider="'+ blockGroup.blocks[0].provider_name
                        + classCode
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
     * @param {string} text - the original text of the block
     * @param {object} spans - the spans as returned by the API
     * @param {object} ctx - the context object, containing the linkResolver function to build links that may be in the fragment (please read prismic.io's online documentation about this)
     * @returns {string} - the HTML output
     */
    function insertSpans(text, spans, ctx) {
        function getTag(span, isStart) {
            if (span.type === 'hyperlink') {
                var fragment = initField(span.data);
                if (fragment) {
                    return (isStart ? '<a href="' + fragment.url(ctx) + '">' : '</a>');
                } else {
                    console && console.error && console.error('Impossible to convert span.data as a Fragment', span);
                    return '';
                }
            }
            if (span.type === 'label') {
                return (isStart ? '<span class="' + span.data.label + '">' : '</span>');
            }
            return '<' + (isStart ? '': '/') + span.type + '>'
        }

        // Ultimate optimization!
        // You know... doing nothing when there is nothing to be done
        if (!spans || !spans.length) {
            return text;
        }

        var positions = [];
        var tagsStart = {};
        var tagsEnd = {};

        spans.forEach(function (span) {
            if (!tagsStart[span.start]) { tagsStart[span.start] = []; }
            if (!tagsEnd[span.end]) { tagsEnd[span.end] = []; }

            tagsStart[span.start].push(getTag(span, true));
            tagsEnd[span.end].unshift(getTag(span, false));

            positions.push(span.start, span.end);
        });

        positions = positions.filter(function (elem, index, self) {
            return self.indexOf(elem) === index;
        }).sort(function(a, b) {
            return a - b;
        });

        var html = [];
        var cursor = 0;

        positions.forEach(function (pos) {
            html.push(text.substring(cursor, pos));
            html = html.concat(tagsEnd[pos] || []);
            html = html.concat(tagsStart[pos] || []);
            cursor = pos;
        });

        html.push(text.substring(cursor));

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
