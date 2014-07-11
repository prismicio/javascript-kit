(function(Prismic) {
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

  module('Prismic.io', {
    setup: function() {}
  });

  test('should init and render StructuredText', function () {
    var html = '<p><strong>Hi <em>everyone</em></strong>, <strong>I am</strong><em> an awesome</em> text!</p>';
    var fragment = Prismic.Fragments.initField(structuredText);

    equal(html, fragment.asHtml());
  });
})(window.Prismic)
