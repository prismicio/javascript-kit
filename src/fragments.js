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

        this.document = data.document;
        /**
         * @field
         * @description the linked document id
         */
        this.id = data.document.id;
        /**
         * @field
         * @description the linked document tags
         */
        this.tags = data.document.tags;
        /**
         * @field
         * @description the linked document slug
         */
        this.slug = data.document.slug;
        /**
         * @field
         * @description the linked document type
         */
        this.type = data.document.type;

        var fragments = {};
        if (data.document.data) {
            for (var field in data.document.data[data.document.type]) {
                fragments[data.document.type + '.' + field] = data.document.data[data.document.type][field];
            }
        }
        /**
         * @field
         * @description the fragment list, if the fetchLinks parameter was used in at query time
         */
        this.fragments = fragments;
        /**
         * @field
         * @description true if the link is broken, false otherwise
         */
        this.isBroken = data.isBroken;
    }

    DocumentLink.prototype = Object.create(Global.Prismic.WithFragments.prototype);

    /**
     * Turns the fragment into a useable HTML version of it.
     * If the native HTML code doesn't suit your design, this function is meant to be overriden.
     *
     * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
     * @returns {string} - basic HTML code for the fragment
     */
    DocumentLink.prototype.asHtml = function (ctx) {
        return "<a href=\""+this.url(ctx)+"\">"+this.url(ctx)+"</a>";
    };

    /**
     * Returns the URL of the document link.
     *
     * @params {object} linkResolver - mandatory linkResolver function (please read prismic.io online documentation about this)
     * @returns {string} - the proper URL to use
     */
    DocumentLink.prototype.url = function (linkResolver) {
        return linkResolver(this.document, this.isBroken);
    };

    /**
     * Turns the fragment into a useable text version of it.
     *
     * @returns {string} - basic text version of the fragment
     */
    DocumentLink.prototype.asText = function(linkResolver) {
        return this.url(linkResolver);
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
         *
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
    function GeoPoint(data) {
        /**
         * @field
         * @description the latitude of the geo point
         */
        this.latitude = data.latitude;
        /**
         * @field
         * @description the longitude of the geo point
         */
        this.longitude = data.longitude;
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
            return this.main.asHtml();
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
            return "<img src=\"" + this.url + "\" width=\"" + this.width + "\" height=\"" + this.height + "\" alt=\"" + this.alt + "\">";
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
        this.value = [];
        for (var i = 0; i < data.length; i++) {
            this.value.push(new Global.Prismic.GroupDoc(data[i]));
        }
    }
    Group.prototype = {
        /**
         * Turns the fragment into a useable HTML version of it.
         * If the native HTML code doesn't suit your design, this function is meant to be overriden.
         * @params {function} linkResolver - linkResolver function (please read prismic.io online documentation about this)
         * @returns {string} - basic HTML code for the fragment
         */
        asHtml: function(linkResolver) {
            var output = "";
            for (var i = 0; i < this.value.length; i++) {
                output += this.value[i].asHtml(linkResolver);
            }
            return output;
        },
        /**
         * Turns the Group fragment into an array in order to access its items (groups of fragments),
         * or to loop through them.
         * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
         * @returns {Array} - the array of groups, each group being a JSON object with subfragment name as keys, and subfragment as values
         */
        toArray: function(){
            return this.value;
        },

        /**
         * Turns the fragment into a useable text version of it.
         *
         * @returns {string} - basic text version of the fragment
         */
        asText: function(linkResolver) {
            var output = "";
            for (var i=0; i<this.value.length; i++) {
                for (var fragmentName in this.value[i]) {
                    output += this.value[i][fragmentName].asText(linkResolver);
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
                if(block.type.indexOf('heading') === 0) {
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
         * @params {function} linkResolver - please read prismic.io online documentation about link resolvers
         * @params {function} htmlSerializer optional HTML serializer to customize the output
         * @returns {string} - basic HTML code for the fragment
         */
        asHtml: function(linkResolver, htmlSerializer) {
            var blockGroups = [],
                blockGroup,
                block,
                html = [];
            if (!isFunction(linkResolver)) {
                // Backward compatibility with the old ctx argument
                var ctx = linkResolver;
                linkResolver = function(doc, isBroken) {
                    return ctx.linkResolver(ctx, doc, isBroken);
                };
            }
            if (Array.isArray(this.blocks)) {

                for(var i=0; i < this.blocks.length; i++) {
                    block = this.blocks[i];

                    // Resolve image links
                    if (block.type == "image" && block.linkTo) {
                        var link = initField(block.linkTo);
                        block.linkUrl = link.url(linkResolver);
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
                        content = insertSpans(block.text, block.spans, linkResolver, htmlSerializer);
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
        return input && input.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br>");
    }

    /**
     * Parses a block that has spans, and inserts the proper HTML code.
     *
     * @param {string} text - the original text of the block
     * @param {object} spans - the spans as returned by the API
     * @param {object} linkResolver - the function to build links that may be in the fragment (please read prismic.io's online documentation about this)
     * @param {function} htmlSerializer - optional serializer
     * @returns {string} - the HTML output
     */
    function insertSpans(text, spans, linkResolver, htmlSerializer) {
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
                    // Continue only if block contains content.
                    if (typeof tag !== 'undefined') {
                      var innerHtml = serialize(tag.span, tag.text, htmlSerializer);
                      if (stack.length === 0) {
                          // The tag was top level
                          html += innerHtml;
                      } else {
                          // Add the content to the parent tag
                          stack[stack.length - 1].text += innerHtml;
                      }
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
                            url = fragment.url(linkResolver);
                        } else {
                            if (console && console.error) console.error('Impossible to convert span.data as a Fragment', span);
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
                if (stack.length === 0) {
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

        var classForType = {
            "Color": Color,
            "Number": Num,
            "Date": DateFragment,
            "Timestamp": Timestamp,
            "Text": Text,
            "Embed": Embed,
            "GeoPoint": GeoPoint,
            "Select": Select,
            "StructuredText": StructuredText,
            "Link.document": DocumentLink,
            "Link.web": WebLink,
            "Link.file": FileLink,
            "Link.image": ImageLink,
            "Group": Group
        };

        if (classForType[field.type]) {
            return new classForType[field.type](field.value);
        }

        if (field.type === "Image") {
            var img = field.value.main;
            var output = new ImageEl(
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
            return output;
        }

        if (console && console.log) console.log("Fragment type not supported: ", field.type);

    }

    function isFunction(f) {
        var getType = {};
        return f && getType.toString.call(f) === '[object Function]';
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
            return '<p class="block-img' + label + '">' +
                (element.linkUrl ? ('<a href="' + element.linkUrl + '">' + imgTag + '</a>') : imgTag) +
                '</p>';
        }

        if (element.type == "embed") {
            return '<div data-oembed="'+ element.embed_url +
                '" data-oembed-type="'+ element.type +
                '" data-oembed-provider="'+ element.provider_name +
                (element.label ? ('" class="' + element.label) : '') +
                '">' + element.oembed.html+"</div>";
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
    };

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));
