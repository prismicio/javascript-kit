(function (Global, undefined) {

    "use strict";

    /**
     * Embodies a plain text fragment (beware: not a structured text)
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
     */
    function DocumentLink(data) {
        this.value = data;
        this.document = data.document;
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
     */
    function WebLink(data) {
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
     */
    function FileLink(data) {
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
     */
    function ImageLink(data) {
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
     */
    function Select(data) {
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
     */
    function Color(data) {
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
     */
    function Num(data) {
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
     */
    function DateTime(data) {
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
     */
    function Embed(data) {
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
     */
    function ImageEl(main, views) {
        this.main = main;
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
     */
    function ImageView(url, width, height) {
        this.url = url;
        this.width = width;
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
     */
    function Group(data) {
      this.value = data;
    }
    Group.prototype = {
      /**
       * Turns the fragment into a useable HTML version of it.
       * If the native HTML code doesn't suit your design, this function is meant to be overriden.
       *
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
       */
       toArray: function(){
         return this.value;
       }
    }


    /**
     * Embodies a group of text blocks in a structured text fragment, like a group of list items.
     * This is only used in the serialization into HTML of structured text fragments.
     */
    function BlockGroup(tag, blocks) {
        this.tag = tag;
        this.blocks = blocks;
    }

    /**
     * Embodies a structured text fragment
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
                        block.data.url,
                        block.data.dimensions.width,
                        block.data.dimensions.height
                    );
                }
            }
        },

        /**
         * Turns the fragment into a useable HTML version of it.
         * If the native HTML code doesn't suit your design, this function is meant to be overriden.
         *
         * @returns {string} - basic HTML code for the fragment
         */
        asHtml: function(ctx) {
            return StructuredTextAsHtml.call(this, this.blocks, ctx);
        }

    };

    /**
     * Transforms a list of blocks as proper HTML.
     *
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
