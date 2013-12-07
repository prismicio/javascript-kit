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
            return "<a></a>"; //Follows RFC /s
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
            blocks.forEach(function (block) {
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
            });

            groups.forEach(function (group) {
                if (group.tag) {
                    html.push("<" + group.tag + ">");
                    group.blocks.forEach(function (block) {
                        html.push(StructuredTextAsHtml(block));
                    });
                    html.push("</" + group.tag + ">");
                } else {
                    group.blocks.forEach(function (block) {
                        html.push(StructuredTextAsHtml(block));
                    });
                }
            });

        } else if (blocks.type) {
            if(blocks.type == "image") {
                html.push('<p><img src="' + blocks.url + '"></p>');
            } else {
                var final_string = []
                var tags = {}
                var span_spec = {
                    em: function(span, beginning) {
                        if (beginning){
                            return "<em>"
                        }
                        return "</em>"
                    },
                    strong: function(span, beginning) {
                        if (beginning){
                            return "<strong>"
                        }
                        return "</strong>"
                    },
                    hyperlink: function(span, beginning) {
                        var link_spec = span.data
                        if(link_spec.type === "Link.web"){
                            if(beginning){
                                return "<a href='"+link_spec.value.url+"'>" //Probably needs to be done in a safer way
                            } else {
                                return "</a>"
                            }
                        } else {
                            //There is no helping you now
                            return ""
                        }
                    },
                }
                blocks.spans.forEach(function(span){
                    if(tags[span.start] == null){
                        tags[span.start] = []
                    }
                    tags[span.start].push(span_spec[span.type](span, true))
                })
                blocks.spans.reverse().forEach(function(span){
                    if(tags[span.end] == null){
                        tags[span.end] = []
                    }
                    tags[span.end].push(span_spec[span.type](span, false))
                })

                for(var i=0;i<=blocks.text.length;i++){
                    if(tags[i]){
                        final_string.push(tags[i].join(""))
                    }
                    final_string.push(blocks.text[i])
                }

                if(blocks.type == "heading1") {
                    html.push('<h1>' + final_string.join("") + '</h1>');
                }
                if(blocks.type == "heading2") {
                    html.push('<h2>' + final_string.join("") + '</h2>');
                }
                if(blocks.type == "heading3") {
                    html.push('<h3>' + final_string.join("") + '</h3>');
                }
                if(blocks.type == "paragraph") {
                    html.push('<p>' + final_string.join("") + '</p>');
                }

            }
        }
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
