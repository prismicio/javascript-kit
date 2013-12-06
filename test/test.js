(function(Prismic) {

  /* === TESTS ARE RUN OVER "LES BONNES CHOSES" EXAMPLE REPOSITORY === */

  var testRepository = 'https://lesbonneschoses.prismic.io/api',

      // This token allow to preview future releases of this repository (nothing secret ;)
      previewToken = 'MC5VbDdXQmtuTTB6Z0hNWHF3.c--_vVbvv73vv73vv73vv71EA--_vS_vv73vv70T77-9Ke-_ve-_vWfvv70ebO-_ve-_ve-_vQN377-9ce-_vRfvv70';

  module('Prismic.io', {
    setup: function() {}
  });

  asyncTest('Retrieve the API', 2, function() {
    Prismic.Api(testRepository, function(Api) {
      equal(Api.data.refs.length, 1);
      equal(Api.url, testRepository);
      start();
    });
  });

  asyncTest('Submit the `everything` form', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('everything').ref(Api.master()).submit(function(results) {
        equal(results.length, 20);
        start();
      });
    });
  });

  asyncTest('Submit the `everything` form with a predicate', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('everything').ref(Api.master()).query('[[:d = at(document.type, "product")]]').submit(function(results) {
        equal(results.length, 16);
        start();
      });
    });
  });

  asyncTest('Submit the `everything` form with a predicate that give no results', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('everything').ref(Api.master()).query('[[:d = at(document.type, "youhou")]]').submit(function(results) {
        equal(results.length, 0);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('products').ref(Api.master()).submit(function(results) {
        equal(results.length, 16);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form with a predicate', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('products').ref(Api.master()).query('[[:d = at(my.product.flavour, "Chocolate")]]').submit(function(results) {
        equal(results.length, 5);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form with an empty predicate', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('products').ref(Api.master()).query('').submit(function(results) {
        equal(results.length, 16);
        start();
      });
    });
  });

  asyncTest('Render a document to Html', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('everything').ref(Api.master()).submit(function(results) {
        var first = results[0];
        notEqual(null, first);
        first.asHtml();
        start();
      });
    });
  });

  asyncTest('Retrieve the API with master+releases privilege', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      equal(Api.data.refs.length, 3);
      start();
    }, previewToken);
  });

  asyncTest('Submit the `products` form in the future', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('products').ref(Api.ref('Announcement of new SF shop')).submit(function(results) {
        equal(results.length, 17);
        start();
      });
    }, previewToken);
  });

}(window.Prismic));