(function (Global, undefined) {

    "use strict";

    function Text(data) {
        this.value = data;
    }
    Text.prototype = {
        asHtml: function () {
            return "<span>" + this.value + "</span>";
        }
    };

    function DocumentLink(data) {
        this.value = data;
        this.document = data.document;
        this.isBroken = data.isBroken;
    }
    DocumentLink.prototype = {
        asHtml: function () {
            return "<a></a>";
        }
    };

    function WebLink(data) {
        this.value = data;
    }
    WebLink.prototype = {
        asHtml: function () {
            return "<a href='"+this.value.url+"'>"+this.value.url+"</a>";
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
            return this.main.asHtml()
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

    function Group(tag, blocks) {
        this.tag = tag;
        this.blocks = blocks;
    }


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

        asHtml: function() {
            return StructuredTextAsHtml.call(this, this.blocks);
        }

    };

    function StructuredTextAsHtml (blocks, linkResolver) {

        var groups = [],
            group,
            block,
            html = [];

        if (Array.isArray(blocks)) {
            for(var i=0; i<blocks.length; i++) {
                block = blocks[i];

                if (block.type != "list-item" && block.type != "o-list-item") { // it's not a type that groups
                    group = new Group(block.type, []);
                    groups.push(group);
                }
                else if (group && group.tag != block.type) { // it's a new type
                    group = new Group(block.type, []);
                    groups.push(group);
                }
                // else: it's the same type as before, no touching group

                group.blocks.push(block);
            };

            groups.forEach(function (group) {

                if(group.tag == "heading1") {
                    html.push('<h1>' + insertSpans(group.blocks[0].text, group.blocks[0].spans) + '</h1>');
                }
                else if(group.tag == "heading2") {
                    html.push('<h2>' + insertSpans(group.blocks[0].text, group.blocks[0].spans) + '</h2>');
                }
                else if(group.tag == "heading3") {
                    html.push('<h3>' + insertSpans(group.blocks[0].text, group.blocks[0].spans) + '</h3>');
                }
                else if(group.tag == "paragraph") {
                    html.push('<p>' + insertSpans(group.blocks[0].text, group.blocks[0].spans) + '</p>');
                }
                else if(group.tag == "image") {
                    html.push('<p><img src="' + group.blocks[0].url + '"></p>');
                }
                else if(group.tag == "embed") {
                    html.push('<div data-oembed="'+ group.blocks[0].embed_url
                        + '" data-oembed-type="'+ group.blocks[0].type
                        + '" data-oembed-provider="'+ group.blocks[0].provider_name
                        + '">' + group.blocks[0].oembed.html+"</div>")
                }
                else if(group.tag == "list-item" || group.tag == "o-list-item") {
                    html.push(group.tag == "list-item"?'<ul>':"<ol>");
                    group.blocks.forEach(function(block){
                        html.push("<li>"+block.text+"</li>");
                    });
                    html.push(group.tag == "list-item"?'</ul>':"</ol>");
                }
                else throw new Error(group.tag+" not implemented");
            });

        }

        return html.join('');

    }

    function insertSpans(text, spans) {
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
            tags.push(span.type);
            cursor = span.end;
        });
        textBits.push(text);

        tags.forEach(function(tag, index){
            html.push(textBits.shift());
            html.push('<'+tag+'>');
            html.push(textBits.shift());
            html.push('</'+tag+'>');
        });
        html.push(textBits.shift());

        return html.join('');
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
                output = new StructuredText(field.value);
                break;

            case "Link.document":
                output = new DocumentLink(field.value);
                break;

            case "Link.web":
                output = new WebLink(field.value);
                break;

            default:
                console.log("Type not found:", field.type);
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
        initField: initField
    }

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));
