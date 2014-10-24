(function(Prismic) {

  // Test snippets for the documentation, and keep them in sync with Gist

  var testRepository = 'https://lesbonneschoses.prismic.io/api',
    Predicates = Prismic.Predicates;

  function getLinkResolver(ref) {
    return function(doc, isBroken) {
      if (isBroken) return '#broken';
      return "/testing_url/" + doc.id + "/" + doc.slug + (ref ? ('?ref=' + ref) : '');
    }
  }

  module('Prismic.io', {
    setup: function() {}
  });

  asyncTest('prismic-api.js', 1, function(){
    // startgist:b253d8fddfdd4cceef7a:prismic-api.js
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function(err, Api) {
      if (err) { console.log(err); start(); } // gisthide
      // You can use the Api object inside this block
      console.log("References: ", Api.data.refs);
      equal(Api.data.refs.length, 1); // gisthide
      start(); // gisthide
    });
    // endgist
  });

  asyncTest('prismic-apiPrivate.js', 1, function(){
    // startgist:1b2552233271e329b785:prismic-apiPrivate.js
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function(err, Api) {
      // This will fail because the token is invalid, but this is how to access a private API
      equal(err.message, "Unexpected status code [401] on URL https://lesbonneschoses.prismic.io/api?access_token=MC5-XXXXXXX-vRfvv70"); // gisthide
      start(); // gisthide
    }, "MC5-XXXXXXX-vRfvv70");
    // endgist
  });

  asyncTest('prismic-references.js', 1, function(){
    // startgist:11cb93472bc660d423f6:prismic-references.js
    var previewToken = 'MC5VbDdXQmtuTTB6Z0hNWHF3.c--_vVbvv73vv73vv73vv71EA--_vS_vv73vv70T77-9Ke-_ve-_vWfvv70ebO-_ve-_ve-_vQN377-9ce-_vRfvv70';
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function(err, Api) {
      if (err) { console.log(err); start(); } // gisthide
      var stPatrickRef = Api.ref("St-Patrick specials");
      // Now we'll use this reference for all our calls
      Api.form('everything')
         .ref(stPatrickRef)
         .query(Prismic.Predicates.at("document.type", "product")).submit(function(err, response) {
           if (err) { console.log(err); start(); } // gisthide
           // The documents object contains a Response object with all documents of type "product"
           // including the new "Saint-Patrick's Cupcake"
           equal(response.results.length, 17); // gisthide
           start(); // gisthide
         });
    }, previewToken);
    // endgist
  });

  asyncTest('prismic-simplequery.js', 2, function(){
    // startgist:f3f7d4b970e964131271:prismic-simplequery.js
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function(err, Api) {
      if (err) { console.log(err); start(); } // gisthide
      Api.form('everything')
        .ref(Api.master())
        .query(Prismic.Predicates.at("document.type", "product")).submit(function(err, response) {
          if (err) { console.log(err); start(); } // gisthide
          // The documents object contains a Response object with all documents of type "product".
          var page = response.page; // The current page number, the first one being 1
          equal(page, 1); // gisthide
          var results = response.results; // An array containing the results of the current page;
                                          // you may need to retrieve more pages to get all results
          equal(results.length, 16); // gisthide
          var prev_page = response.prev_page; // the URL of the previous page (may be null)
          var next_page = response.next_page; // the URL of the next page (may be null)
          var results_per_page = response.results_per_page; // max number of results per page
          var results_size = response.results_size; // the size of the current page
          var total_pages = response.total_pages; // the number of pages
          var total_results_size = response.total_results_size; // the total size of results across all pages
          start(); // gisthide
        });
    });
    // endgist
  });

  asyncTest('prismic-orderings.js', 1, function(){
    // startgist:55eb59485855e40680c9:prismic-orderings.js
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function(err, Api) {
      if (err) { console.log(err); start(); } // gisthide
      Api.form('everything')
        .ref(Api.master())
        .query(Prismic.Predicates.at("document.type", "product"))
        .pageSize(100)
        .orderings('[my.product.price desc]')
        .submit(function(err, response) {
          // The products are now ordered by price, highest first
          var results = response.results;
          equal(response.results_per_page, 100); // gisthide
          start(); // gisthide
        });
    });
    // endgist
  });

  asyncTest('prismic-predicates.js', 1, function() {
    // startgist:2bdf83055d57f35d5d85:prismic-predicates.js
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function(err, Api) {
      if (err) { console.log(err); start(); } // gisthide
      Api.form('everything').ref(Api.master()).query(
        Predicates.at("document.type", "blog-post"),
        Predicates.dateAfter("my.blog-post.date", new Date(2014, 6, 1))
      ).submit(function(err, response) {
          if (err) { console.log(err); start(); } // gisthide
          // All documents of type "product", updated after June 1st, 2014
          equal(response.results.length, 0); // gisthide
          start(); // gisthide
        });
    });
    // endgist
  });

  test('prismic-allPredicates.js', 2, function() {
    // startgist:ebec155a66db3c1a29b6:prismic-allPredicates.js
    // "at" predicate: equality of a fragment to a value.
    var at = Predicates.at("document.type", "article");
    deepEqual(at, ["at", "document.type", "article"]); // gisthide
    // "any" predicate: equality of a fragment to a value.
    var any = Predicates.any("document.type", ["article", "blog-post"]);
    deepEqual(any, ["any", "document.type", ["article", "blog-post"]]); // gisthide

    // "fulltext" predicate: fulltext search in a fragment.
    var fulltext = Predicates.fulltext("my.article.body", "sausage");

    // "similar" predicate, with a document id as reference
    var similar = Predicates.similar("UXasdFwe42D", 10);
    // endgist
  });

  asyncTest('prismic-htmlSerializer.js', 1, function() {
    Prismic.Api(testRepository, function (err, Api) {
      if (err) { console.log(err); start(); } // gisthide
      Api.form('everything').query(Predicates.at("document.id", "UlfoxUnM0wkXYXbl"))
         .ref(Api.master()).submit(function (err, documents) {
        if (err) { console.log(err); start(); }
        var doc = documents.results[0];
        // startgist:3e125676868b16fa91b9:prismic-htmlSerializer.js
        var htmlSerializer = function (element, content) {
          // Don't wrap images in a <p> tag
          if (element.type == "image") {
            return '<img src="' + element.url + '" alt="' + element.alt + '">';
          }

          // Add a class to hyperlinks
          if (element.type == "hyperlink") {
            return '<a class="some-link" href="' + element.url + '">' + content + '</a>';
          }

          // Return null to stick with the default behavior
          return null;
        };
        var html = doc.getStructuredText('blog-post.body').asHtml(getLinkResolver(), htmlSerializer);
        // endgist
        equal(html,
            '<h1>Our world-famous Pastry Art Brainstorm event</h1>' +
            '<img src=\"https://prismic-io.s3.amazonaws.com/lesbonneschoses/c38f9e5a1a6c43aa7aae516c154013a2cee2bc75.jpg\" alt=\"\">' +
              '<p>Each year, <em>Les Bonnes Choses</em> organizes a world-famous two-day event called the \"Pastry Art Brainstorm\", and which is the perfect excuse for every fine pastry artist in the world to exercise their art, and build their skills up. The event is a multiple win-win operation, at many levels: see what the event is, as seen by many point of views.</p>' +
              '<h2>As seen by the top pastry artists worldwide</h2>' +
              '<p>The event always starts with half a day of conference talks, given by the most insightful pastry artists in the world, selected for having made tremendous achievements in pastry that year. The list of invited guest speakers is decided jointly by the <em>Les Bonnes Choses</em> staff and the Fine Pastry Magazine editors.</p>' +
              '<p>This is great for the speakers, who get an occasion to share their work, and have people build up on it with them.</p>' +
              '<h2>As seen by the pastry professionals</h2>' +
              '<p>After half a day of thoughtful conference, the professionals will get to put what they learned to good use, and mingle with the best artists worldwide to make the most daring pastries together. There are no set rules about who does what during this giant innovation workshop, and many crazy ideas get created out of thin air. As a virtually infinite amount of ingredients is provided by the <em>Les Bonnes Choses</em> staff, many unexpected pastries happen on that day, and professionals taste each other\'s creations, and provide relevant feedback to each other. Most pieces get showcased to the amateur audience as well, who get invited to taste some of the pieces.</p>' +
              '<p>At noon on the second day, teams are expected to subscribe to our Pastry Art Challenge, during which they will make the best possible pastry,  judged on many aspects (originality, taste, looks, ...) by a jury of amateurs and professionals. The team members of the three winning pieces share a substantial prize, and their pastries may even join the Les Bonnes Choses catalogue, and be offered in all the <em>Les Bonnes Choses</em> shops worldwide!</p>' +
              '<h2>As seen by the pastry amateurs</h2>' +
              '<p>The conference is limited with a reasonable fee; but the showcase is open to everyone, although visitors are often expected to pay the pastry chefs for the pastries they taste. The educated amateurs spend their day tasting the most daring pieces, giving some appreciated feedback to their chefs, and challenging their own tastebuds. The novice amateurs usually get a once-in-a-lifetime experience, and often mention being blown away by how rich the fine pastry art can be. All in all, every one goes home with a smile on their faces!</p>' +
              '<h2>As seen by the Les Bonnes Choses interns</h2>' +
              '<p>Every year, we recruit a very limited amount of interns, who get aboard a <a class="some-link" href=\"/testing_url/UlfoxUnM0wkXYXbu/les-bonnes-chosess-internship-a-testimony\">life-defining adventure around fine pastries</a>, discovering <em>Les Bonnes Choses</em> during half a year, with part of this time spent in one of our shops abroad. We always manage to get them on board at a time when we know they will be able to attend a Fine Pastry Brainstorm, because we consider it is a very defining element in the experience of being part of <em>Les Bonnes Choses</em>.</p>' +
              '<p>Not only do we invite them to the event (whatever the country they are stationed in when the event happens), but we give them a front-row seat! They are part of the jury for the Fine Pastry Challenge, they are introduced to every speaker as the next generation of pastry (thus having the occasion to learn even more, directly from them).</p>' +
              '<h2>As seen by fine pastry as a field</h2>' +
              '<p>There wasn\'t really an international occasion for pastry artists to join and share, before <em>Les Bonnes Choses</em> came up with the first Fine Pastry Brainstorm, in 2006. Fine Pastry Magazine\'s first edition was out in 2004, and initiated the idea that pastry art needed to be shared better between professionals. But a proper event to meet up in person was missing, and <em>Les Bonnes Choses</em> is proud to be the one to have come up with it first.</p>' +
              '<p>Since then, more local initiatives have been started (notably in Argentina, and Canada), but none comes close to the size of <em>Les Bonnes Choses</em>\'s international Fine Pastry Brainstorm.</p>' +
              '<h2>As seen by <em>Les Bonnes Choses</em></h2>' +
              '<p>As the almost only sponsor of every edition of the event, <em>Les Bonnes Choses</em> makes sure enough ingredients are available for everyone, rents the premises, makes sure the speakers are as comfortable as possible, and takes care of the whole organization! But through the operation, <em>Les Bonnes Choses</em> gains much more than any sponsoring can buy: not only does it get to secure <em>Les Bonnes Choses</em> as the world reference in pastry arts, but it also allows them to claim rightfully that they do offer in their shops the best pastries, created by the world top artists indeed.</p>');

        start();
      });
    });
  });

  asyncTest('prismic-getText.js', 1, function() {
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function (err, Api) {
      if (err) { console.log(err); start(); } // gisthide
      Api.form('everything').query(Predicates.at("document.id", "UlfoxUnM0wkXYXbl")).ref(Api.master()).submit(function (err, documents) {
        if (err) { console.log(err); start(); } // gisthide
        var doc = documents.results[0];
        // startgist:897048416603f89272bf:prismic-getText.js
        var author = doc.getText("blog-post.author");
        if (!author) author = "Anonymous";
        equal(author, "John M. Martelle, Fine Pastry Magazine"); // gisthide
        // endgist
        start();
      });
    });
  });

  asyncTest('prismic-getNumber.js', 1, function() {
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function (err, Api) {
      if (err) { console.log(err); start(); } // gisthide
      Api.form('everything').query(Predicates.at("document.id", "UlfoxUnM0wkXYXbO")).ref(Api.master()).submit(function (err, documents) {
        if (err) { console.log(err); start(); } // gisthide
        var doc = documents.results[0];
        // startgist:ea2f95a70621f3e83032:prismic-getNumber.js
        // Number predicates
        var gt = Predicates.gt("my.product.price", 10);
        var lt = Predicates.lt("my.product.price", 20);
        var inRange = Predicates.inRange("my.product.price", 10, 20);

        // Accessing number fields
        var price = doc.getNumber("product.price");
        equal(price, 2.5); // gisthide
        // endgist
        start();
      });
    });
  });

  asyncTest('prismic-dateTimestamp.js', 1, function() {
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function (err, Api) {
      if (err) { console.log(err); start(); } // gisthide
      Api.form('everything').query(Predicates.at("document.id", "UlfoxUnM0wkXYXbl")).ref(Api.master()).submit(function (err, documents) {
        if (err) { console.log(err); start(); } // gisthide
        var doc = documents.results[0];
        // startgist:812b109562731b03cb58:prismic-dateTimestamp.js
        // Date and Timestamp predicates
        var dateBefore = Predicates.dateBefore("my.product.releaseDate", new Date(2014, 6, 1));
        var dateAfter = Predicates.dateAfter("my.product.releaseDate", new Date(2014, 1, 1));
        var dateBetween = Predicates.dateBetween("my.product.releaseDate", new Date(2014, 1, 1), new Date(2014, 6, 1));
        var dayOfMonth = Predicates.dayOfMonth("my.product.releaseDate", 14);
        var dayOfMonthAfter = Predicates.dayOfMonthAfter("my.product.releaseDate", 14);
        var dayOfMonthBefore = Predicates.dayOfMonthBefore("my.product.releaseDate", 14);
        var dayOfWeek = Predicates.dayOfWeek("my.product.releaseDate", "Tuesday");
        var dayOfWeekAfter = Predicates.dayOfWeekAfter("my.product.releaseDate", "Wednesday");
        var dayOfWeekBefore = Predicates.dayOfWeekBefore("my.product.releaseDate", "Wednesday");
        var month = Predicates.month("my.product.releaseDate", "June");
        var monthBefore = Predicates.monthBefore("my.product.releaseDate", "June");
        var monthAfter = Predicates.monthAfter("my.product.releaseDate", "June");
        var year = Predicates.year("my.product.releaseDate", 2014);
        var hour = Predicates.hour("my.product.releaseDate", 12);
        var hourBefore = Predicates.hourBefore("my.product.releaseDate", 12);
        var hourAfter = Predicates.hourAfter("my.product.releaseDate", 12);

        // Accessing Date and Timestamp fields
        var date = doc.getDate("blog-post.date");
        var year = date ? date.getFullYear() : null;
        var updateTime = doc.getTimestamp("blog-post.update");
        var hour = updateTime ? updateTime.getHours() : 0;
        equal(year, 2013); // gisthide
        // endgist
        start();
      });
    });
  });

  test('prismic-group.js', 1, function() {
    var doc = Prismic.Api("").parseDoc({
      id: "abcd",
      type: "article",
      data: {
        article: {
          documents: {
            type: "Group",
            "value": [
              {
                "linktodoc": {
                  "type": "Link.document",
                  "value": {
                    "document": {
                      "id": "UrDejAEAAFwMyrW9",
                      "type": "doc",
                      "tags": [ ],
                      "slug": "installing-meta-micro"
                    },
                    "isBroken": false
                  }
                },
                "desc": {
                  "type": "StructuredText",
                  "value": [
                    {
                      "type": "paragraph",
                      "text": "A detailed step by step point of view on how installing happens.",
                      "spans": []
                    }
                  ]
                }
              },
              {
                "linktodoc": {
                  "type": "Link.document",
                  "value": {
                    "document": {
                      "id": "UrDmKgEAALwMyrXA",
                      "type": "doc",
                      "tags": [ ],
                      "slug": "using-meta-micro"
                    },
                    "isBroken": false
                  }
                }
              }
            ]
          }
        }
      }
    });
    // startgist:fa204a2784c0747d552b:prismic-group.js
    var group = doc.getGroup("article.documents");
    var docs = group ? group.toArray() : [];
    for (var i = 0; i < docs.length; i++) {
      // Desc and Link are Fragments, their type depending on what's declared in the Document Mask
      var desc = docs[i].getStructuredText("desc");
      var link = docs[i].getLink("linktodoc");
    }
    // endgist
    equal(docs[0].getStructuredText("desc").asHtml(), "<p>A detailed step by step point of view on how installing happens.</p>");
  });

  test('prismic-link.js', 1, function() {
    var doc = Prismic.Api("").parseDoc({
      id: "abcd",
      type: "article",
      data: {
        article: {
          source: {
            type: "Link.document",
            value: {
              document: {
                id: "UlfoxUnM0wkXYXbE",
                type: "product",
                tags: ["Macaron"],
                slug: "dark-chocolate-macaron"
              },
              isBroken: false
            }
          }
        }
      }
    });
    // startgist:fa26d9095df192027edf:prismic-link.js
    var resolver = function (doc, isBroken) {
      if (isBroken) return '#broken';
      return "/testing_url/" + doc.id + "/" + doc.slug;
    };
    var source = doc.getLink("article.source");
    var url = source ? source.url(resolver) : null;
    // endgist
    equal(url, "/testing_url/UlfoxUnM0wkXYXbE/dark-chocolate-macaron");
  });

  test('prismic-embed.js', 1, function() {
    var doc = Prismic.Api("").parseDoc({
      id: "abcd",
      type: "article",
      data: {
        article: {
          "video" : {
            "type" : "Embed",
            "value" : {
              "oembed" : {
                "provider_url" : "http://www.youtube.com/",
                "type" : "video",
                "thumbnail_height" : 360,
                "height" : 270,
                "thumbnail_url" : "http://i1.ytimg.com/vi/baGfM6dBzs8/hqdefault.jpg",
                "width" : 480,
                "provider_name" : "YouTube",
                "html" : "<iframe width=\"480\" height=\"270\" src=\"http://www.youtube.com/embed/baGfM6dBzs8?feature=oembed\" frameborder=\"0\" allowfullscreen></iframe>",
                "author_name" : "Siobhan Wilson",
                "version" : "1.0",
                "author_url" : "http://www.youtube.com/user/siobhanwilsonsongs",
                "thumbnail_width" : 480,
                "title" : "Siobhan Wilson - All Dressed Up",
                "embed_url" : "https://www.youtube.com/watch?v=baGfM6dBzs8"
              }
            }
          }
        }
      }
    });
    // startgist:67b2d5f4094c54f3f5c0:prismic-embed.js
    var video = doc.get("article.video");
    // Html is the code to include to embed the object, and depends on the embedded service
    var html = video ? video.asHtml() : "";
    // endgist
    equal(html, "<iframe width=\"480\" height=\"270\" src=\"http://www.youtube.com/embed/baGfM6dBzs8?feature=oembed\" frameborder=\"0\" allowfullscreen></iframe>");
  });

  test('prismic-color.js', 1, function() {
    var doc = Prismic.Api("").parseDoc({
      id: "abcd",
      type: "article",
      data: {
        article: {
          "background" : {
            "type" : "Color",
            "value": "#000000"
          }
        }
      }
    });
    var $ = function(x) {
      return { css: function (y, z) {} };
    };
    // startgist:9f56474f0946af8ff135:prismic-color.js
    var bgcolor = doc.getColor("article.background");
    $("#article").css("background-color", bgcolor);
    // endgist
    equal(bgcolor, "#000000");
  });

  test('prismic-geopoint.js', 1, function() {
    var doc = Prismic.Api("").parseDoc({
      id: "abcd",
      type: "article",
      data: {
        article: {
          "location" : {
            "type" : "GeoPoint",
            "value" : {
              "latitude" : 48.877108,
              "longitude": 2.3338790
            }
          }
        }
      }
    });
    // startgist:1cf4d536f00bb13f1178:prismic-geopoint.js
    // "near" predicate for GeoPoint fragments
    var near = Predicates.near("my.store.location", 48.8768767, 2.3338802, 10);

    // Accessing GeoPoint fragments
    var place = doc.getGeoPoint("article.location");
    var coordinates;
    if (place) {
      coordinates = place.latitude + "," + place.longitude;
    }
    // endgist
    equal(coordinates, "48.877108,2.333879");
  });

  asyncTest('prismic-asHtml.js', 1, function() {
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function (err, Api) {
      if (err) { console.log(err); start(); }
      Api.form('everything').ref(Api.master()).query(Prismic.Predicates.at("document.id", "UlfoxUnM0wkXYXbX")).submit(function (err, response) {
        if (err) { console.log(err); start(); }
        // startgist:63183c7f26038f884f45:prismic-asHtml.js
        var doc = response.results[0];
        var html = doc.getStructuredText('blog-post.body').asHtml({
          linkResolver: function (ctx, doc, isBroken) {
            if (isBroken) return '#broken';
            return "/testing_url/" + doc.id + "/" + doc.slug + ( ctx.maybeRef ? '?ref=' + ctx.maybeRef : '' );
          }
        });
        // endgist
        equal(html, '<h1>Get the right approach to ganache</h1><p>A lot of people touch base with us to know about one of our key ingredients, and the essential role it plays in our creations: ganache.</p><p>Indeed, ganache is the macaron\'s softener, or else, macarons would be but tough biscuits; it is the cupcake\'s wrapper, or else, cupcakes would be but plain old cake. We even sometimes use ganache within our cupcakes, to soften the cake itself, or as a support to our pies\' content.</p><h2>How to approach ganache</h2><p class=\"block-img\"><img src=\"https://prismic-io.s3.amazonaws.com/lesbonneschoses/ee7b984b98db4516aba2eabd54ab498293913c6c.jpg\" alt=\"\"></p><p>Apart from the taste balance, which is always a challenge when it comes to pastry, the tough part about ganache is about thickness. It is even harder to predict through all the phases the ganache gets to meet (how long will it get melted? how long will it remain in the fridge?). Things get a hell of a lot easier to get once you consider that there are two main ways to get the perfect ganache:</p><ul><li><strong>working from the top down</strong>: start with a thick, almost hard material, and soften it by manipulating it, or by mixing it with a more liquid ingredient (like milk)</li><li><strong>working from the bottom up</strong>: start from a liquid-ish state, and harden it by miwing it with thicker ingredients, or by leaving it in the fridge longer.</li></ul><p>We do hope this advice will empower you in your ganache-making skills. Let us know how you did with it!</p><h2>Ganache at <em>Les Bonnes Choses</em></h2><p>We have a saying at Les Bonnes Choses: \"Once you can make ganache, you can make anything.\"</p><p>As you may know, we like to give our workshop artists the ability to master their art to the top; that is why our Preparation Experts always start off as being Ganache Specialists for Les Bonnes Choses. That way, they\'re given an opportunity to focus on one exercise before moving on. Once they master their ganache, and are able to provide the most optimal delight to our customers, we consider they\'ll thrive as they work on other kinds of preparations.</p><h2>About the chocolate in our ganache</h2><p>Now, we\'ve also had a lot of questions about how our chocolate gets made. It\'s true, as you might know, that we make it ourselves, from Columbian cocoa and French cow milk, with a process that much resembles the one in the following Discovery Channel documentary.</p><div data-oembed=\"undefined\" data-oembed-type=\"embed\" data-oembed-provider=\"undefined\"><iframe width=\"459\" height=\"344\" src=\"http://www.youtube.com/embed/Ye78F3-CuXY?feature=oembed\" frameborder=\"0\" allowfullscreen></iframe></div>');
        start();
      });
    });
  });

/* Temporary deactivate because problem with PhantomJS
  asyncTest('prismic-cache.js', 1, function(){
    // startgist:647bde5c458c44af0981:prismic-cache.js
    var cache = {
      get: function (key) {
        // Retrieve a value from the key
        return null;
      },

      set: function (key, value, ttl) {
        // Save a value to the cache
        // ttl is the time to live, or expiration in seconds
      },

      getOrSet: function (key, ttl, fvalue, done) {
        // Retrieve the value if present, otherwise use the fvalue callback to calculate the value,
        // save it then return it by calling the "done" callback.
        // The done callback takes 2 parameters: error and result.
        fvalue(function (error, result, hdr) {
          done(null, result);
        });
      },

      isExpired: function (key) {
        // Return true if the key exists and is expired, false if the value is either absent or not expired
        return false;
      },

      isInProgress: function (key) {
        // Return true if the value is being saved currently
        return false;
      },

      exists: function (key) {
        // Return true if the value for the key exists
        return false;
      },

      remove: function (key) {
        // Remove a value
      },

      clear: function (key) {
        // Clear the whole cache
      }
    };
    Prismic.Api('https://lesbonneschoses.prismic.io/api', function (err, Api) {
      if (err) {
        console.log(err);
        start();
      } // gisthide
      // The Api in this block will use the custom cache object
      notEqual(Api, null); // gisthide
      start(); // gisthide
    }, null, null, cache);
    // endgist
  });
*/
}(window.Prismic));
