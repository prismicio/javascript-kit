(function(Prismic) {

  /* === TESTS ARE RUN OVER "LES BONNES CHOSES" EXAMPLE REPOSITORY === */

  var testRepository = 'https://lesbonneschoses.prismic.io/api',

      previewToken = 'MC5VbDdXQmtuTTB6Z0hNWHF3.c--_vVbvv73vv73vv73vv71EA--_vS_vv73vv70T77-9Ke-_ve-_vWfvv70ebO-_ve-_ve-_vQN377-9ce-_vRfvv70',

      microRepository = 'https://micro.prismic.io/api',

      Predicates = Prismic.Predicates;

  module('Prismic.io', {
    setup: function() {}
  });

  /************************************/
  /* API document retrieval & parsing */
  /************************************/

  asyncTest('Retrieve the API', 2, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      equal(Api.data.refs.length, 1);
      equal(Api.url, testRepository);
      start();
    });
  });

  asyncTest('Correctly handles the error if the URL is wrong', 2, function() {
    console.log('\n*** Note by tester: The following error is a "normal" error (see note in test.js): ');
    // We can't help it because whatever you do, the JS engine contains a "console.error" statement when this error occurs,
    // and we're exactly trying to test how the kit reacts when this error occurs.
    Prismic.Api(testRepository+"/errormaker", function(err, Api) {
      ok(err);
      equal(err.message, "Unexpected status code [0] on URL https://lesbonneschoses.prismic.io/api/errormaker");
      start();
    });
  });

  asyncTest('Parsing stores types and tags', 2, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      equal(Object.keys(Api.data.types).length, 6);
      equal(Api.data.tags.length, 4);
      start();
    });
  });

  asyncTest('Retrieve the API with master+releases privilege', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      equal(Api.data.refs.length, 3);
      start();
    }, previewToken);
  });

  /************************/
  /* API form submissions */
  /************************/

  asyncTest('Submit the `everything` form', 8, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 20);
        equal(documents.next_page, "https://lesbonneschoses.prismic.io/api/documents/search?ref=UlfoxUnM08QWYXdl&page=2&pageSize=20");
        equal(documents.page, 1);
        equal(documents.prev_page, null);
        equal(documents.results_per_page, 20);
        equal(documents.results_size, 20);
        equal(documents.total_pages, 2);
        equal(documents.total_results_size, 40);
        start();
      });
    });
  });

  asyncTest('Get linked documents', 2, function() {
    Prismic.Api(microRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').query('[[:d = any(document.type, ["doc","docchapter"])]]').ref(Api.master()).submit(function(err, response) {
        if (err) { console.log(err); return; }
        var document = response.results[0];
        equal(document.linkedDocuments.length, 1);
        equal(document.linkedDocuments[0].id, 'U0w8OwEAACoAQEvB');
        start();
      });
    });
  });

  asyncTest('Use an Array to query', 2, function() {
    Prismic.Api(microRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything')
         .query(Predicates.any("document.type", ["doc", "docchapter"]))
         .ref(Api.master())
         .submit(function(err, response) {
        if (err) { console.log(err); return; }
        var document = response.results[0];
        equal(document.linkedDocuments.length, 1);
        equal(document.linkedDocuments[0].id, 'U0w8OwEAACoAQEvB');
        start();
      });
    });
  });

  asyncTest('Submit the `everything` form with an ordering', 2, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').ref(Api.master()).orderings('[my.product.price desc]').submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 20);
        equal(documents.results[0].id, 'UlfoxUnM0wkXYXbj');
        start();
      });
    });
  });

  asyncTest('Get page 2 of the `everything` form', 8, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').page(2).ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 20);
        equal(documents.next_page, null);
        equal(documents.page, 2);
        equal(documents.prev_page, "https://lesbonneschoses.prismic.io/api/documents/search?ref=UlfoxUnM08QWYXdl&page=1&pageSize=20");
        equal(documents.results_per_page, 20);
        equal(documents.results_size, 20);
        equal(documents.total_pages, 2);
        equal(documents.total_results_size, 40);
        start();
      });
    });
  });

  asyncTest('Get page 1 of the `everything` form with pagination set at 10', 8, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').pageSize(10).ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 10);
        equal(documents.next_page, "https://lesbonneschoses.prismic.io/api/documents/search?ref=UlfoxUnM08QWYXdl&page=2&pageSize=10");
        equal(documents.page, 1);
        equal(documents.prev_page, null);
        equal(documents.results_per_page, 10);
        equal(documents.results_size, 10);
        equal(documents.total_pages, 4);
        equal(documents.total_results_size, 40);
        start();
      });
    });
  });

  asyncTest('Get page 2 of the `everything` form with pagination set at 10', 8, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').pageSize(10).page(2).ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 10);
        equal(documents.next_page, "https://lesbonneschoses.prismic.io/api/documents/search?ref=UlfoxUnM08QWYXdl&page=3&pageSize=10");
        equal(documents.page, 2);
        equal(documents.prev_page, "https://lesbonneschoses.prismic.io/api/documents/search?ref=UlfoxUnM08QWYXdl&page=1&pageSize=10");
        equal(documents.results_per_page, 10);
        equal(documents.results_size, 10);
        equal(documents.total_pages, 4);
        equal(documents.total_results_size, 40);
        start();
      });
    });
  });

  asyncTest('Correctly handles the error if wrong submission', 2, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').ref(Api.master()).query("wrongpredicate").submit(function(err, _) {
        ok(err);
        equal(err.message, "Unexpected status code [400] on URL https://lesbonneschoses.prismic.io/api/documents/search?page=1&pageSize=20&ref=UlfoxUnM08QWYXdl&q=wrongpredicate");
        start();
      });
    });
  });

  asyncTest('Submit the `everything` form with a predicate', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').ref(Api.master()).query(["at", "document.type", "product"]).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 16);
        start();
      });
    });
  });

  asyncTest('Submit the `everything` form with a predicate that give no results', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').ref(Api.master()).query('[[:d = at(document.type, "youhou")]]').submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 0);
        start();
      });
    });
  });

  asyncTest('Group fragments', 1, function() {
    Prismic.Api(microRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').ref(Api.master()).query(["at", "document.id", "UrOaNwEAAM2OpbPy"]).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        var links = documents.results[0].getGroup("contributor.links");
        equal(links.toArray().length, 2);
        start();
      });
    });
  });

  asyncTest('Similarity search', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').ref(Api.master()).query(["similar", "U9pjvjQAADAAehbf", 10]).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 0);
        start();
      });
    });
  });

  asyncTest('Multiple predicates', 1, function() {
    Prismic.Api(microRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').ref(Api.master()).query(
        Predicates.at("document.type", "article"),
        Predicates.fulltext("my.article.title", "meta")
      ).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 1);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('products').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 16);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form with a predicate', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('products').ref(Api.master()).query('[[:d = at(my.product.flavour, "Chocolate")]]').submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 5);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form with an empty query', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('products').ref(Api.master()).query('').submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 16);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form in the future', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('products').ref(Api.ref('Announcement of new SF shop')).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 17);
        start();
      });
    }, previewToken);
  });

}(window.Prismic));
