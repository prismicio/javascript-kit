/*eslint-env node, mocha */
/*eslint no-unused-vars: 0 */

var Prismic = require('../lib/prismic.js').Prismic;
var chai = require('chai');

var assert = chai.assert;

/* === TESTS ARE RUN OVER "LES BONNES CHOSES" EXAMPLE REPOSITORY === */

var microRepository = 'https://micro.prismic.io/api',
    previewToken = 'MC5VcXBHWHdFQUFONDZrbWp4.77-9cDx6C3lgJu-_vXZafO-_vXPvv73vv73vv70777-9Ju-_ve-_vSLvv73vv73vv73vv70O77-977-9Me-_vQ',
    Predicates = Prismic.Predicates;

describe('API retrieval and parsing', function(){

  it('Retrieve the API', function(done) {
    Prismic.api(microRepository, function(err, Api) {
      if (err) {
        done(err);
        return;
      }
      assert.operator(Api.data.refs.length, '>', 0, 'at least one reference');
      assert.equal(Api.url, microRepository);
      done();
    });
  });

  it('Retrieve the API with a Promise', function(done) {
    Prismic.api(microRepository).then(function(api) {
      assert.operator(api.data.refs.length, '>', 0, 'at least one reference');
      assert.equal(api.url, microRepository);
      done();
    }, function(err) {
      throw err;
    });
  });

  it('Correctly handles the error if the URL is wrong', function(done) {
    console.log('\n*** Note by tester: The following error is a "normal" error (see note in test.js): ');
    // We can't help it because whatever you do, the JS engine contains a "console.error" statement when this error occurs,
    // and we're exactly trying to test how the kit reacts when this error occurs.
    Prismic.api(microRepository+"/errormaker", function(err, Api) {
      assert.equal(err.message, "Unexpected status code [404] on URL https://micro.prismic.io/api/errormaker");
      done();
    });
  });

  it('Parsing stores types and tags', function(done) {
    Prismic.api(microRepository).then(function(Api) {
      assert.equal(Object.keys(Api.data.types).length, 11);
      assert.equal(Api.data.tags.length, 1);
      done();
    }, function(err) {
      done(err);
    });
  });

  it('Retrieve the API with master+releases privilege', function(done) {
    Prismic.api(microRepository, function(err, Api) {
      if (err) throw err;
      assert.equal(Api.data.refs.length, 3);
      done();
    }, previewToken);
  });
});

describe('API form submissions', function() {

  it('Submit the `everything` form', function (done) {
    Prismic.api(microRepository, function (err, Api) {
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
        assert.equal(documents.total_pages, 1);
        assert.equal(documents.total_results_size, 20);
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

  it('Get linked documents from within slices', function (done) {
    Prismic.api(microRepository, function (err, api) {
      api.getByUID('page', 'page-with-slices', function(err, document) {
        if (!document) {
          chai.fail('Missing document page-with-slices');
        } else {
          assert.equal(document.linkedDocuments().length, 2);
        }
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
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.getByID('UrDejAEAAFwMyrW9', {}, function (err, document) {
        assert.equal(document.id, 'UrDejAEAAFwMyrW9');
        done();
      });
    });
  });

  it('Use getByUID', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.getByUID('with-uid', 'demo', {}, function (err, document) {
        assert.equal(document.id, 'V_OoLCYAAFv84agw');
        done();
      });
    });
  });

  it('Use getSingle', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.getSingle('single', {}, function (err, document) {
        assert.equal(document.id, 'V_OplCUAACQAE0lA');
        done();
      });
    });
  });

  it('Use getByIDs', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.getByIDs(['UrDejAEAAFwMyrW9', 'V2OokCUAAHSZcOUP'], {}, function (err, res) {
        assert.equal(res.results.length, 2);
        done();
      });
    });
  });

  it('Submit the `everything` form with an ordering', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) {
        console.log(err);
        done();
      }
      Api.form('everything').ref(Api.master()).orderings('[my.product.price desc]').submit(function (err, documents) {
        if (err) { console.log(err); }
        assert.equal(documents.results.length, 20);
        assert.equal(documents.results[0].id, 'V_OplCUAACQAE0lA');
        done();
      });
    });
  });

  it('Submit with an ordering array', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) {
        console.log(err);
        done();
      }
      Api.form('everything').ref(Api.master()).orderings(['my.doc.title desc']).submit(function (err, documents) {
        if (err) {
          console.log(err);
        }
        assert.equal(documents.results.length, 20);
        assert.equal(documents.results[0].id, 'UrDofwEAALAdpbNH');
        done();
      });
    });
  });

  it('Get page 1 of the `everything` form with pagination set at 10', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) {
        console.log(err);
        done();
      }
      Api.form('everything').pageSize(10).ref(Api.master()).submit(function (err, documents) {
        if (err) throw err;
        assert.equal(documents.results.length, 10);
        assert.equal(documents.next_page, "https://micro.prismic.io/api/documents/search?ref=V_OpmSUAACcAE0lS&page=2&pageSize=10");
        assert.equal(documents.page, 1);
        assert.equal(documents.prev_page, null);
        assert.equal(documents.results_per_page, 10);
        assert.equal(documents.results_size, 10);
        assert.equal(documents.total_pages, 2);
        assert.equal(documents.total_results_size, 20);
        done();
      });
    });
  });

  it('Get page 2 of the `everything` form with pagination set at 10', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').pageSize(10).page(2).ref(Api.master()).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 10);
        assert.isNull(documents.next_page);
        assert.equal(documents.page, 2);
        assert.equal(documents.prev_page, "https://micro.prismic.io/api/documents/search?ref=V_OpmSUAACcAE0lS&page=1&pageSize=10");
        assert.equal(documents.results_per_page, 10);
        assert.equal(documents.results_size, 10);
        assert.equal(documents.total_pages, 2);
        assert.equal(documents.total_results_size, 20);
        done();
      });
    });
  });

  it('Correctly handles the error if wrong submission', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').ref(Api.master()).query("wrongpredicate").submit(function (err, _) {
        assert.equal(err.message, "Unexpected status code [400] on URL https://micro.prismic.io/api/documents/search?page=1&pageSize=20&ref=V_OpmSUAACcAE0lS&q=wrongpredicate");
        done();
      });
    });
  });

  it('Submit the `everything` form with a predicate', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').ref(Api.master()).query(["at", "document.type", "doc"]).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 4);
        done();
      });
    });
  });

  it('Submit the `everything` form with a predicate that give no results', function (done) {
    Prismic.api(microRepository, function (err, Api) {
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
    Prismic.api(microRepository, function (err, Api) {
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
        assert.equal(4, documents.results.length);
        done();
      });
    });
  });

  it('Multiple predicates', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.form('everything').ref(Api.master()).query(
        Predicates.at("document.type", "doc"),
        Predicates.fulltext("my.doc.title", "meta")
      ).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 2);
        done();
      });
    });
  });

  it('Submit the `doc` form', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.form('doc').ref(Api.master()).submit(function (err, documents) {
        if (err) {
          console.log(err);
          return;
        }
        assert.equal(documents.results.length, 6);
        done();
      });
    });
  });

  it('Submit the `doc` form with a predicate', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) throw err;
      Api.form('doc').ref(Api.master()).query('[[:d = fulltext(my.doc.title, "meta")]]').submit(function (err, documents) {
        if (err) {
          done(err);
          return;
        }
        assert.equal(documents.results.length, 2);
        done();
      });
    });
  });

  it('Submit the `doc` form with an empty query', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) {
        done(err);
        return;
      }
      Api.form('doc').ref(Api.master()).query('').submit(function (err, documents) {
        if (err) {
          done(err);
          return;
        }
        assert.equal(documents.results.length, 6);
        done();
      });
    });
  });

  it('Test cache', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      var form = Api.form('doc').ref(Api.master()).query('[[:d = fulltext(my.doc.title, "Download")]]');
      var olderKeys = Api.apiCache.lru.keys();
      form.submit(function (err, response) {
        if (err) { done(err); return; }

        var key = null;
        Api.apiCache.lru.keys().forEach(function (candidate) {
          if (olderKeys.indexOf(candidate) == -1) {
            key = candidate;
          }
        });

        Api.apiCache.get(key, function (err, value) {
          if (err) { done(err); return; }
          assert.equal(value.results.length, response.results.length);
          done();
        });
      });
    });
  });

});
