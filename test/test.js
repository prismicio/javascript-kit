/*eslint-env node, mocha */
/*eslint no-unused-vars: 0 */

var Prismic = require('../lib/prismic.js').Prismic;
var chai = require('chai');

var assert = chai.assert;

/* === TESTS ARE RUN OVER "LES BONNES CHOSES" EXAMPLE REPOSITORY === */

var testRepository = 'https://lesbonneschoses.cdn.prismic.io/api',
    previewToken = 'MC5VbDdXQmtuTTB6Z0hNWHF3.c--_vVbvv73vv73vv73vv71EA--_vS_vv73vv70T77-9Ke-_ve-_vWfvv70ebO-_ve-_ve-_vQN377-9ce-_vRfvv70',
    microRepository = 'https://micro.prismic.io/api',
    Predicates = Prismic.Predicates;

describe('API retrieval and parsing', function(){

  it('Retrieve the API', function(done) {
    Prismic.api(testRepository, function(err, Api) {
      if (err) throw err;
      assert.operator(Api.data.refs.length, '>', 0, 'at least one reference');
      assert.equal(Api.url, testRepository);
      done();
    });
  });

  it('Retrieve the API with a Promise', function(done) {
    Prismic.api(testRepository).then(function(api) {
      assert.operator(api.data.refs.length, '>', 0, 'at least one reference');
      assert.equal(api.url, testRepository);
      done();
    }, function(err) {
      throw err;
    });
  });

  it('Correctly handles the error if the URL is wrong', function(done) {
    console.log('\n*** Note by tester: The following error is a "normal" error (see note in test.js): ');
    // We can't help it because whatever you do, the JS engine contains a "console.error" statement when this error occurs,
    // and we're exactly trying to test how the kit reacts when this error occurs.
    Prismic.api(testRepository+"/errormaker", function(err, Api) {
      assert.equal(err.message, "Unexpected status code [404] on URL https://lesbonneschoses.cdn.prismic.io/api/errormaker");
      done();
    });
  });

  it('Parsing stores types and tags', function(done) {
    Prismic.api(testRepository, function(err, Api) {
      if (err) throw err;
      assert.equal(Object.keys(Api.data.types).length, 6);
      assert.equal(Api.data.tags.length, 4);
      done();
    });
  });

  it('Retrieve the API with master+releases privilege', function(done) {
    Prismic.api(testRepository, function(err, Api) {
      if (err) throw err;
      assert.equal(Api.data.refs.length, 3);
      done();
    }, previewToken);
  });
});

describe('API form submissions', function() {

  it('Submit the `everything` form', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) {
        console.log(err);
        done();
      }
      Api.form('everything').ref(Api.master()).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 20);
        assert.equal(documents.page, 1);
        assert.equal(documents.prev_page, null);
        assert.equal(documents.results_per_page, 20);
        assert.equal(documents.results_size, 20);
        assert.equal(documents.total_pages, 2);
        assert.equal(documents.total_results_size, 40);
        done();
      });
    });
  });

  it('Get linked documents', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) {
        console.log(err);
        done();
      }
      Api.form('everything').query('[[:d = any(document.type, ["doc","docchapter"])]]').ref(Api.master()).submit(function (err, response) {
        if (err) {
          console.log(err);
          return;
        }
        var document = response.results[0];
        assert.equal(document.linkedDocuments().length, 1);
        assert.equal(document.linkedDocuments()[0].id, 'U0w8OwEAACoAQEvB');
        done();
      });
    });
  });

  it('Use an Array to query', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) {
        console.log(err);
        done();
      }
      Api.form('everything')
        .query(Predicates.any("document.type", ["doc", "docchapter"]))
        .ref(Api.master())
        .submit(function (err, response) {
          if (err) {
            console.log(err);
          }
          var document = response.results[0];
          assert.equal(document.linkedDocuments().length, 1);
          assert.equal(document.linkedDocuments()[0].id, 'U0w8OwEAACoAQEvB');
          done();
        });
    });
  });

  it('Use getByID', function(done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.getByID('UlfoxUnM0wkXYXbt', {}, function (err, document) {
        assert.equal(document.id, 'UlfoxUnM0wkXYXbt');
        done();
      });
    });
  });

  it('Use getByIDs', function(done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.getByIDs(['UlfoxUnM0wkXYXbt', 'UlfoxUnM0wkXYXbj'], {}, function (err, res) {
        assert.equal(res.results.length, 2);
        done();
      });
    });
  });

  it('Submit the `everything` form with an ordering', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) {
        console.log(err);
        done();
      }
      Api.form('everything').ref(Api.master()).orderings('[my.product.price desc]').submit(function (err, documents) {
        if (err) { console.log(err); }
        assert.equal(documents.results.length, 20);
        assert.equal(documents.results[0].id, 'UlfoxUnM0wkXYXbj');
        done();
      });
    });
  });

  it('Submit with an ordering array', function(done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) {
        console.log(err);
        done();
      }
      Api.form('everything').ref(Api.master()).orderings(['my.product.price desc']).submit(function (err, documents) {
        if (err) {
          console.log(err);
        }
        assert.equal(documents.results.length, 20);
        assert.equal(documents.results[0].id, 'UlfoxUnM0wkXYXbj');
        done();
      });
    });
  });

  it('Get page 2 of the `everything` form', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) {
        console.log(err);
        done();
      }
      Api.form('everything').page(2).ref(Api.master()).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 20);
        assert.equal(documents.next_page, null);
        assert.equal(documents.page, 2);
        assert.equal(documents.prev_page, "https://d2aw36oac6sa9o.cloudfront.net/api/documents/search?ref=UlfoxUnM08QWYXdl&page=1&pageSize=20");
        assert.equal(documents.results_per_page, 20);
        assert.equal(documents.results_size, 20);
        assert.equal(documents.total_pages, 2);
        assert.equal(documents.total_results_size, 40);
        done();
      });
    });
  });

  it('Get page 1 of the `everything` form with pagination set at 10', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) {
        console.log(err);
        done();
      }
      Api.form('everything').pageSize(10).ref(Api.master()).submit(function (err, documents) {
        if (err) throw err;
        assert.equal(documents.results.length, 10);
        assert.equal(documents.next_page, "https://d2aw36oac6sa9o.cloudfront.net/api/documents/search?ref=UlfoxUnM08QWYXdl&page=2&pageSize=10");
        assert.equal(documents.page, 1);
        assert.equal(documents.prev_page, null);
        assert.equal(documents.results_per_page, 10);
        assert.equal(documents.results_size, 10);
        assert.equal(documents.total_pages, 4);
        assert.equal(documents.total_results_size, 40);
        done();
      });
    });
  });

  it('Get page 2 of the `everything` form with pagination set at 10', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').pageSize(10).page(2).ref(Api.master()).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 10);
        assert.equal(documents.next_page, "https://d2aw36oac6sa9o.cloudfront.net/api/documents/search?ref=UlfoxUnM08QWYXdl&page=3&pageSize=10");
        assert.equal(documents.page, 2);
        assert.equal(documents.prev_page, "https://d2aw36oac6sa9o.cloudfront.net/api/documents/search?ref=UlfoxUnM08QWYXdl&page=1&pageSize=10");
        assert.equal(documents.results_per_page, 10);
        assert.equal(documents.results_size, 10);
        assert.equal(documents.total_pages, 4);
        assert.equal(documents.total_results_size, 40);
        done();
      });
    });
  });

  it('Correctly handles the error if wrong submission', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').ref(Api.master()).query("wrongpredicate").submit(function (err, _) {
        assert.equal(err.message, "Unexpected status code [400] on URL https://d2aw36oac6sa9o.cloudfront.net/api/documents/search?page=1&pageSize=20&ref=UlfoxUnM08QWYXdl&q=wrongpredicate");
        done();
      });
    });
  });

  it('Submit the `everything` form with a predicate', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').ref(Api.master()).query(["at", "document.type", "product"]).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 16);
        done();
      });
    });
  });

  it('Submit the `everything` form with a predicate that give no results', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').ref(Api.master()).query('[[:d = at(document.type, "youhou")]]').submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 0);
        done();
      });
    });
  });

  it('Fetch additional fields in links with fetchLinks', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything')
        .ref(Api.master())
        .fetchLinks('blog-post.author')
        .query(Predicates.at('document.id', 'UlfoxUnM0wkXYXbt'))
        .submit(function (err, response) {
          var links = response.results[0].getAll('blog-post.relatedpost');
          assert.equal(links[0].getText('blog-post.author'), 'John M. Martelle, Fine Pastry Magazine');
          done();
        });
    });
  });
});

describe('Fragments', function() {

  it('Group fragments', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').ref(Api.master()).query(["at", "document.id", "UrOaNwEAAM2OpbPy"]).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        var links = documents.results[0].getGroup("contributor.links");
        assert.equal(links.toArray().length, 2);
        done();
      });
    });
  });

  it('Similarity search', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').ref(Api.master()).query(["similar", "U9pjvjQAADAAehbf", 10]).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(0, documents.results.length);
        done();
      });
    });
  });

  it('"has" predicates', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').ref(Api.master()).query(
        Predicates.has("my.doc.title")
      ).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(0, documents.results.length);
        done();
      });
    });
  });

  it('Multiple predicates', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').ref(Api.master()).query(
        Predicates.at("document.type", "article"),
        Predicates.fulltext("my.article.title", "meta")
      ).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 1);
        done();
      });
    });
  });

  it('Submit the `products` form', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.form('products').ref(Api.master()).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 16);
        done();
      });
    });
  });

  it('Submit the `products` form with a predicate', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.form('products').ref(Api.master()).query('[[:d = at(my.product.flavour, "Chocolate")]]').submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 5);
        done();
      });
    });
  });

  it('Submit the `products` form with an empty query', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.form('products').ref(Api.master()).query('').submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 16);
        done();
      });
    });
  });

  it('Submit the `products` form in the future', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) throw err;
      Api.form('products').ref(Api.ref('Announcement of new SF shop')).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 17);
        done();
      });
    }, previewToken);
  });

  it('Test cache', function (done) {
    Prismic.api(testRepository, function (err, Api) {
      if (err) { done(err); return; }
      var form = Api.form('products').ref(Api.master()).query('[[:d = at(my.product.flavour, "Caramel")]]');
      var olderKeys = Api.apiCache.lru.keys();
      form.submit(function (err, response) {
        if (err) {
          console.log(err);
          done(err);
          return;
        }

        var key = null;
        Api.apiCache.lru.keys().forEach(function (candidate) {
          if (olderKeys.indexOf(candidate) == -1) {
            key = candidate;
          }
        });

        Api.apiCache.get(key, function (err, value) {
          assert.equal(value.results.length, response.results.length);
          done();
        });
      });
    });
  });

});
