(function(Prismic) {
  /*
    ======== A Handy Little QUnit Reference ========
    http://api.qunitjs.com/

    Test methods:
      module(name, {[setup][ ,teardown]})
      test(name, callback)
      expect(numberOfAssertions)
      stop(increment)
      start(decrement)
    Test assertions:
      ok(value, [message])
      equal(actual, expected, [message])
      notEqual(actual, expected, [message])
      deepEqual(actual, expected, [message])
      notDeepEqual(actual, expected, [message])
      strictEqual(actual, expected, [message])
      notStrictEqual(actual, expected, [message])
      throws(block, [expected], [message])
  */

  module('Prismic.io', {
    setup: function() {}
  });

  asyncTest('Retrieve the API', 1, function() {
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function(Api) {
      equal(Api.url, 'https://lesbonneschoses.prismic.io/api');
      start();
    });
  });

  asyncTest('Submit the `everything` form', 1, function() {
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function(Api) {
      Api.forms('everything').ref(Api.master()).submit(function(results) {
        equal(results.length, 20);
        start();
      });
    });
  });

  asyncTest('Render a document to Html', 1, function() {
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function(Api) {
      Api.forms('everything').ref(Api.master()).submit(function(results) {
        var first = results[0];
        notEqual(null, first);
        first.asHtml();
        start();
      });
    });
  });

}(window.Prismic));