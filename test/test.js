/*eslint-env node, mocha */
/*eslint no-unused-vars: 0 */

var Prismic = require('../lib/prismic.js').Prismic;
var chai = require('chai');

var assert = chai.assert;

var microRepository = 'https://micro.cdn.prismic.io/api',
    accessToken = 'MC5VcXBHWHdFQUFONDZrbWp4.77-9cDx6C3lgJu-_vXZafO-_vXPvv73vv73vv70777-9Ju-_ve-_vSLvv73vv73vv73vv70O77-977-9Me-_vQ',
    Predicates = Prismic.Predicates;

describe('API retrieval and parsing', function(){

  it('Retrieve the API', function(done) {
    Prismic.api(microRepository, function(err, Api) {
      if (err) { done(err); return; }
      assert.operator(Api.data.refs.length, '>', 0, 'at least one reference');
      assert.equal(Api.url, microRepository);
      done();
    });
  });

  it('Retrieve the API with a Promise', function() {
    return Prismic.api(microRepository).then(function(api) {
      assert.operator(api.data.refs.length, '>', 0, 'at least one reference');
      assert.equal(api.url, microRepository);
    });
  });

  it('Correctly handles the error if the URL is wrong', function(done) {
    // We can't help it because whatever you do, the JS engine contains a "console.error" statement when this error occurs,
    // and we're exactly trying to test how the kit reacts when this error occurs.
    Prismic.api(microRepository+"/errormaker", function(err) {
      assert.match(err.message, /^Unexpected status code \[404\] on URL .+/);
      done();
    });
  });

  it('Parsing stores types', function() {
    return Prismic.api(microRepository).then(function(Api) {
      assert.isAtLeast(Object.keys(Api.data.types).length, 12, 'should be at least 12 types');
    });
  });

  it('Parsing stores tags', function() {
    return Prismic.api(microRepository).then(function(Api) {
      assert.isAtLeast(Api.data.tags.length, 1, 'should be at least 1 tag');
    });
  });

  it('Retrieve the API with master+releases privilege', function(done) {
    Prismic.api(microRepository, function(err, Api) {
      if (err) { done(err); return; }
      assert.isAtLeast(Api.data.refs.length, 3);
      done();
    }, accessToken);
  });
});

describe('API form submissions', function() {

  it('Submit the `everything` form', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results.length, 20);
        assert.equal(documents.page, 1);
        assert.isNull(documents.prev_page);
        assert.equal(documents.results_per_page, 20);
        assert.equal(documents.results_size, 20);
        assert.isAtLeast(documents.total_pages, 1);
        assert.isAtLeast(documents.total_results_size, 20);
        done();
      });
    });
  });

  it('Get linked documents', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').query('[[:d = any(document.type, ["doc","docchapter"])]]').ref(Api.master()).submit(function (err, response) {
        if (err) { done(err); return; }
        var document = response.results[0];
        assert.equal(document.linkedDocuments().length, 1);
        done();
      });
    });
  });

  it('Get linked documents from within slices', function (done) {
    Prismic.api(microRepository, function (err, api) {
      if (err) { done(err); return; }
      api.getByUID('page', 'page-with-slices', function(err, document) {
        if (err) { done(err); return; }
        if (!document) chai.fail('Missing document page-with-slices');
        assert.equal(document.linkedDocuments().length, 2);
        done();
      });
    });
  });

  it('Use an Array of String to query', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything')
        .query(Predicates.any("document.type", ["doc", "docchapter"]))
        .ref(Api.master())
        .submit(function (err, response) {
          if (err) { done(err); return; }
          var document = response.results[0];
          assert.equal(document.linkedDocuments().length, 1);
          done();
        });
    });
  });

  it('Use an Array of Number to query', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything')
        .query(Predicates.any('my.argument.priority', [1000, 600]))
        .ref(Api.master())
        .submit(function (err, response) {
          if (err) { done(err); return; }
          assert.equal(response.results.length, 2);
          done();
        });
    });
  });

  it('Use query', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.query(Predicates.at('document.id', 'UrDejAEAAFwMyrW9'), function (err, resp) {
        if (err) { done(err); return; }
        assert.equal(resp.results[0].id, 'UrDejAEAAFwMyrW9');
        done();
      });
    });
  });

  it('Use query with a Promise', function() {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.query(Predicates.at('document.id', 'UrDejAEAAFwMyrW9')).then(function (resp) {
        assert.equal(resp.results[0].id, 'UrDejAEAAFwMyrW9');
      });
    });
  });

  it('Use query without q with a Promise', function() {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.query().then(function (resp) {
        assert.isAbove(resp.results_size, 1);
      });
    });
  });

  it('Use queryFirst', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.queryFirst(Predicates.at('document.id', 'UrDejAEAAFwMyrW9'), function (err, document) {
        if (err) { done(err); return; }
        assert.equal(document.id, 'UrDejAEAAFwMyrW9');
        done();
      });
    });
  });

  it('Use queryFirst with a Promise', function() {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.queryFirst(Predicates.at('document.id', 'UrDejAEAAFwMyrW9')).then(function (document) {
        assert.equal(document.id, 'UrDejAEAAFwMyrW9');
      });
    });
  });

  it('Use getByID', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.getByID('UrDejAEAAFwMyrW9', function (err, document) {
        if (err) { done(err); return; }
        assert.equal(document.id, 'UrDejAEAAFwMyrW9');
        done();
      });
    });
  });

  it('Use getByID with a Promise', function() {
    return Prismic.api(microRepository).then(function(Api) {
      return Api.getByID('UrDejAEAAFwMyrW9').then(function(document) {
        assert.equal(document.id, 'UrDejAEAAFwMyrW9');
      });
    });
  });

  it('Use getByUID', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.getByUID('with-uid', 'demo', function (err, document) {
        if (err) { done(err); return; }
        assert.equal(document.id, 'V_OoLCYAAFv84agw');
        done();
      });
    });
  });

  it('Use getByUID with a Promise', function() {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.getByUID('with-uid', 'demo').then(function (document) {
        assert.equal(document.id, 'V_OoLCYAAFv84agw');
      });
    });
  });

  it('Use getSingle', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.getSingle('single', function (err, document) {
        if (err) { done(err); return; }
        assert.equal(document.id, 'V_OplCUAACQAE0lA');
        done();
      });
    });
  });


  it('Use getSingle with a Promise', function() {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.getSingle('single').then(function (document) {
        assert.equal(document.id, 'V_OplCUAACQAE0lA');
      });
    });
  });

  it('Use getByIDs', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.getByIDs(['UrDejAEAAFwMyrW9', 'V2OokCUAAHSZcOUP'], function (err, res) {
        if (err) { done(err); return; }
        assert.equal(res.results.length, 2);
        done();
      });
    });
  });

  it('Use getByIDs with a Promise', function() {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.getByIDs(['UrDejAEAAFwMyrW9', 'V2OokCUAAHSZcOUP']).then(function (res) {
        assert.equal(res.results.length, 2);
      });
    });
  });

  it('Submit the `everything` form with an ordering', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').ref(Api.master()).orderings('[my.all.number desc]').submit(function (err, documents) {
        if (err) { console.log(err); }
        assert.equal(documents.results[0].uid, 'all21');
        done();
      });
    });
  });

  it('Submit with an ordering array', function(done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').ref(Api.master()).orderings(['my.doc.title desc']).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results.length, 20);
        assert.equal(documents.results[0].id, 'UrDofwEAALAdpbNH');
        done();
      });
    });
  });

  it('Get page 1 of the `everything` form with pagination set at 10', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').pageSize(10).ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results.length, 10);
        assert.isNotNull(documents.next_page);
        assert.equal(documents.page, 1);
        assert.equal(documents.prev_page, null);
        assert.equal(documents.results_per_page, 10);
        assert.equal(documents.results_size, 10);
        assert.isAtLeast(documents.total_pages, 2);
        assert.isAtLeast(documents.total_results_size, 20);
        done();
      });
    });
  });

  it('Get page 2 of the `everything` form with pagination set at 10', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').pageSize(10).page(2).ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results.length, 10);
        assert.equal(documents.page, 2);
        assert.isNotNull(documents.prev_page);
        assert.equal(documents.results_per_page, 10);
        assert.equal(documents.results_size, 10);
        assert.isAtLeast(documents.total_pages, 2);
        assert.isAtLeast(documents.total_results_size, 20);
        done();
      });
    });
  });

  it('Get next page by hand', function () {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.query(undefined, {pageSize: 1}).then(function (page1) {
        assert.isNotNull(page1.next_page);
        return Api.request(page1.next_page).then(function (page2) {
          assert.isNotNull(page2.previous_page);
        });
      });
    });
  });

  it('Get next page with access token by hand', function () {
    return Prismic.api(microRepository, accessToken).then(function (Api) {
      return Api.query(undefined, {pageSize: 1, ref: Api.ref('myrelease')}).then(function (page1) {
        assert.isNotNull(page1.next_page);
        console.log('next_page: ', page1.next_page);
        return Api.request(page1.next_page + '&access_token=' + accessToken).then(function (page2) {
          assert.isNotNull(page2.previous_page);
        });
      });
    });
  });

  it('Use getNextPage', function () {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.query(undefined, {pageSize: 1}).then(function (page1) {
        assert.isNotNull(page1.next_page);
        return Api.getNextPage(page1.next_page).then(function (page2) {
          assert.isNotNull(page2.previous_page);
        });
      });
    });
  });

  it('Use getNextPage with access token', function () {
    return Prismic.api(microRepository, accessToken).then(function (Api) {
      return Api.query(undefined, {pageSize: 1, ref: Api.ref('myrelease')}).then(function (page1) {
        assert.isNotNull(page1.next_page);
        return Api.getNextPage(page1.next_page).then(function (page2) {
          assert.isNotNull(page2.previous_page);
        });
      });
    });
  });

  it('Correctly handles the error if wrong submission', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').ref(Api.master()).query("wrongpredicate").submit(function (err) {
        // no if(err)done(err) since this error is expected
        assert.match(err.message, /^Unexpected status code \[400\] on URL .+/);
        done();
      });
    });
  });

  it('Submit the `everything` form with a predicate', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').ref(Api.master()).query(["at", "document.type", "doc"]).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results.length, 4);
        done();
      });
    });
  });

  it('Submit the `everything` form with a predicate that give no results', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').ref(Api.master()).query('[[:d = at(document.type, "youhou")]]').submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results.length, 0);
        done();
      });
    });
  });

});

describe('Fragments', function() {

  it('Group fragments', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').ref(Api.master()).query(["at", "document.id", "UrOaNwEAAM2OpbPy"]).submit(function (err, documents) {
        if (err) { done(err); return; }
        var links = documents.results[0].getGroup("contributor.links");
        assert.equal(links.toArray().length, 2);
        done();
      });
    });
  });

  it('Similarity search', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').ref(Api.master()).query(["similar", "U9pjvjQAADAAehbf", 10]).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(0, documents.results.length);
        done();
      });
    });
  });

  it('"has" predicates', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').ref(Api.master()).query(
        Predicates.has("my.doc.title")
      ).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(4, documents.results.length);
        done();
      });
    });
  });

  it('Multiple predicates', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').ref(Api.master()).query(
        Predicates.at("document.type", "doc"),
        Predicates.fulltext("my.doc.title", "meta")
      ).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results.length, 2);
        done();
      });
    });
  });

  it('Submit the `doc` form', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('doc').ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results.length, 6);
        done();
      });
    });
  });

  it('Submit the `doc` form with a predicate', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('doc').ref(Api.master()).query('[[:d = fulltext(my.doc.title, "meta")]]').submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results.length, 2);
        done();
      });
    });
  });

  it('Submit the `doc` form with an empty query', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('doc').ref(Api.master()).query('').submit(function (err, documents) {
        if (err) { done(err); return; }
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
