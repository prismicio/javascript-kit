(function(Prismic) {

    var assert = chai.assert;

    var structuredText = {
        type: 'StructuredText',
        value: [{
            type: 'paragraph',
            text: 'Hi everyone, I am an awesome text!',
            spans: [{
                start: 0,
                end: 11,
                type: 'strong'
            },{
                start: 3,
                end: 11,
                type: 'em'
            },{
                start: 13,
                end: 17,
                type: 'strong'
            },{
                start: 17,
                end: 28,
                type: 'em'
            }]
        }]
    };

    function getLinkResolver(ref) {
        return function(doc, isBroken) {
            if (isBroken) return '#broken';
            return "/testing_url/" + doc.id + "/" + doc.slug + (ref ? ('?ref=' + ref) : '');
        }
    }

    describe("Unit tests", function() {

        it('should init and render StructuredText', function () {
            var html = '<p><strong>Hi <em>everyone</em></strong>, <strong>I am</strong><em> an awesome</em> text!</p>';
            var fragment = Prismic.Fragments.initField(structuredText);

            assert.equal(html, fragment.asHtml());
        });

    });

    describe("HTML content", function() {

        it('2 spans on the same text - one bigger 1', function() {
            var text  = 'abcdefghijklmnopqrstuvwxyz';
            var spans = [{
                "type": "em",
                "start": 2,
                "end": 6
            }, {
                "type": "strong",
                "start": 2,
                "end": 4
            }];
            var html = Prismic.Fragments.insertSpans(text, spans, {});
            assert.equal(html, 'ab<em><strong>cd</strong>ef</em>ghijklmnopqrstuvwxyz');
        });

        it('2 spans on the same text - one bigger 2', function() {
            var text  = 'abcdefghijklmnopqrstuvwxyz';
            var spans = [{
                "type": "em",
                "start": 2,
                "end": 4
            }, {
                "type": "strong",
                "start": 2,
                "end": 6
            }];
            var html = Prismic.Fragments.insertSpans(text, spans, {});
            assert.equal(html, 'ab<strong><em>cd</em>ef</strong>ghijklmnopqrstuvwxyz');
        });

        it ("with span labels", function() {
            var text  = 'abcdefghijklmnopqrstuvwxyz';
            var spans = [{
                "type": "label",
                "start": 2,
                "end": 6,
                "data": {
                    "label": "tip"
                }
            }];
            var html = Prismic.Fragments.insertSpans(text, spans, {});
            assert.equal(html, 'ab<span class="tip">cdef</span>ghijklmnopqrstuvwxyz');
        });

    });

    it('List items are correctly grouped', function() {
        var jsonString = '{ "type":"StructuredText", "value":[ { "spans":[], "text":"Here is some introductory text.", "type":"paragraph" }, { "spans":[], "text":"first item", "type":"list-item" }, { "spans":[], "text":"second item", "type":"list-item" },  { "spans":[], "text":"The following image is linked.", "type":"paragraph" }, { "spans":[], "text":"first item 2", "type":"list-item" }, { "spans":[], "text":"second item 2", "type":"list-item" }  ] }';
        var jsonObject = JSON.parse(jsonString);
        var text = Prismic.Fragments.initField(jsonObject);
        assert.equal(text.asHtml(getLinkResolver()), '<p>Here is some introductory text.</p><ul><li>first item</li><li>second item</li></ul><p>The following image is linked.</p><ul><li>first item 2</li><li>second item 2</li></ul>');
    });


    it('Dates are well retrieved', function() {
        var timestampHtml = Prismic.Fragments.initField({"type" : "Date", "value" : "2014-04-01"}).asHtml();
        assert.equal(
            (new RegExp('<time>... ... \\d\\d 2014 \\d\\d:00:00 GMT[-+]\\d\\d00 \\(.+\\)</time>')).test(timestampHtml),
            true
        );
    });

    it('Timestamps are well retrieved', function() {
        var timestampHtml = Prismic.Fragments.initField({"type" : "Timestamp", "value" : "2014-06-18T15:30:00+0000"}).asHtml();
        assert.equal(
            (new RegExp('<time>... ... \\d\\d 2014 \\d\\d:30:00 GMT[-+]\\d\\d00 \\(.+\\)</time>')).test(timestampHtml),
            true,
            timestampHtml
        );
    });

    it('Link in images are parsed', function() {
        var jsonString = '{ "type": "StructuredText", "value": [ { "spans": [], "text": "Here is some introductory text.", "type": "paragraph" }, { "spans": [], "text": "The following image is linked.", "type": "paragraph" }, { "alt": "", "copyright": "", "dimensions": { "height": 129, "width": 260 }, "linkTo": { "type": "Link.web", "value": { "url": "http://google.com/" } }, "type": "image", "url": "http://fpoimg.com/129x260" }, { "spans": [ { "end": 20, "start": 0, "type": "strong" } ], "text": "More important stuff", "type": "paragraph" }, { "spans": [], "text": "The next is linked to a valid document:", "type": "paragraph" }, { "alt": "", "copyright": "", "dimensions": { "height": 400, "width": 400 }, "linkTo": { "type": "Link.document", "value": { "document": { "id": "UxCQFFFFFFFaaYAH", "slug": "something-fantastic", "type": "lovely-thing" }, "isBroken": false } }, "type": "image", "url": "http://fpoimg.com/400x400" }, { "spans": [], "text": "The next is linked to a broken document:", "type": "paragraph" }, { "alt": "", "copyright": "", "dimensions": { "height": 250, "width": 250 }, "linkTo": { "type": "Link.document", "value": { "document": { "id": "UxERPAEAAHQcsBUH", "slug": "-", "type": "event-calendar" }, "isBroken": true } }, "type": "image", "url": "http://fpoimg.com/250x250" }, { "spans": [], "text": "One more image, this one is not linked:", "type": "paragraph" }, { "alt": "", "copyright": "", "dimensions": { "height": 199, "width": 300 }, "type": "image", "url": "http://fpoimg.com/199x300" } ] }';
        var jsonObject = JSON.parse(jsonString);
        var text = Prismic.Fragments.initField(jsonObject);
        assert.equal(text.asHtml(getLinkResolver()), '<p>Here is some introductory text.</p><p>The following image is linked.</p><p class=\"block-img\"><a href=\"http://google.com/\"><img src=\"http://fpoimg.com/129x260\" alt=\"\"></a></p><p><strong>More important stuff</strong></p><p>The next is linked to a valid document:</p><p class=\"block-img\"><a href=\"/testing_url/UxCQFFFFFFFaaYAH/something-fantastic\"><img src=\"http://fpoimg.com/400x400\" alt=\"\"></a></p><p>The next is linked to a broken document:</p><p class=\"block-img\"><a href=\"#broken\"><img src=\"http://fpoimg.com/250x250\" alt=\"\"></a></p><p>One more image, this one is not linked:</p><p class=\"block-img\"><img src=\"http://fpoimg.com/199x300\" alt=\"\"></p>');
    });

})(window.Prismic);
