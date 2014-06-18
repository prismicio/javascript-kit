(function(Prismic) {

  /* === TESTS ARE RUN OVER "LES BONNES CHOSES" EXAMPLE REPOSITORY === */

  var testRepository = 'https://lesbonneschoses.prismic.io/api',

      // This token allow to preview future releases of this repository (nothing secret ;)
      previewToken = 'MC5VbDdXQmtuTTB6Z0hNWHF3.c--_vVbvv73vv73vv73vv71EA--_vS_vv73vv70T77-9Ke-_ve-_vWfvv70ebO-_ve-_ve-_vQN377-9ce-_vRfvv70',

      microRepository = 'https://micro.prismic.io/api',

      ctx = {
        api: undefined,
        ref: { ref: 'XXXXX', label: 'Future release', isMaster: false },
        maybeRef: 'XXXXX',
        oauth: function() { },
        linkResolver: function(ctx, doc, isBroken) {
          if (isBroken) return '#broken';
          return "/testing_url/"+doc.id+"/"+doc.slug+( ctx.maybeRef ? '?ref=' + ctx.maybeRef : '' );
        }
      };

  module('Prismic.io', {
    setup: function() {}
  });

  /************************************/
  /* API document retrieval & parsing */
  /************************************/

  asyncTest('Retrieve the API', 2, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
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
      if (err) { console.log(err); return; }
      equal(Object.keys(Api.data.types).length, 6);
      equal(Api.data.tags.length, 4);
      start();
    });
  });

  asyncTest('Retrieve the API with master+releases privilege', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      equal(Api.data.refs.length, 3);
      start();
    }, previewToken);
  });

  /************************/
  /* API form submissions */
  /************************/

  asyncTest('Submit the `everything` form', 8, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 20);
        equal(documents.next_page, "https://lesbonneschoses.prismic.io/api/documents/search?ref=UkL0hcuvzYUANCrm&page=2&pageSize=20");
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
    Prismic.Api("https://micro.prismic.io/api", function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = any(document.type, ["doc","docchapter"])]]').ref(Api.master()).submit(function(err, response) {
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
      if (err) { console.log(err); return; }
      Api.form('everything').ref(Api.master()).orderings('[my.product.price desc]').submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 20);
        equal(documents.results[0].id, 'UkL0gMuvzYUANCpm');
        start();
      });
    });
  });

  asyncTest('Get page 2 of the `everything` form', 8, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').page(2).ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 20);
        equal(documents.next_page, null);
        equal(documents.page, 2);
        equal(documents.prev_page, "https://lesbonneschoses.prismic.io/api/documents/search?ref=UkL0hcuvzYUANCrm&page=1&pageSize=20");
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
      if (err) { console.log(err); return; }
      Api.form('everything').pageSize(10).ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 10);
        equal(documents.next_page, "https://lesbonneschoses.prismic.io/api/documents/search?ref=UkL0hcuvzYUANCrm&page=2&pageSize=10");
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
      if (err) { console.log(err); return; }
      Api.form('everything').pageSize(10).page(2).ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 10);
        equal(documents.next_page, "https://lesbonneschoses.prismic.io/api/documents/search?ref=UkL0hcuvzYUANCrm&page=3&pageSize=10");
        equal(documents.page, 2);
        equal(documents.prev_page, "https://lesbonneschoses.prismic.io/api/documents/search?ref=UkL0hcuvzYUANCrm&page=1&pageSize=10");
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
      if (err) { console.log(err); return; }
      Api.form('everything').ref(Api.master()).query("wrongpredicate").submit(function(err, _) {
        ok(err);
        equal(err.message, "Unexpected status code [400] on URL https://lesbonneschoses.prismic.io/api/documents/search?page=1&pageSize=20&ref=UkL0hcuvzYUANCrm&q=wrongpredicate");
        start();
      });
    });
  });

  asyncTest('Submit the `everything` form with a predicate', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').ref(Api.master()).query('[[:d = at(document.type, "product")]]').submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 16);
        start();
      });
    });
  });

  asyncTest('Submit the `everything` form with a predicate that give no results', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').ref(Api.master()).query('[[:d = at(document.type, "youhou")]]').submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 0);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('products').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 16);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form with a predicate', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('products').ref(Api.master()).query('[[:d = at(my.product.flavour, "Chocolate")]]').submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 5);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form with an empty query', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('products').ref(Api.master()).query('').submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 16);
        start();
      });
    });
  });

  asyncTest('Submit the `products` form in the future', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('products').ref(Api.ref('Announcement of new SF shop')).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results.length, 17);
        start();
      });
    }, previewToken);
  });

  /*************************/
  /* Document manipulation */
  /*************************/

  asyncTest('Stores and retrieves all document slugs well', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCpV")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        var doc = documents.results[0];
        equal(doc.slugs.length, 2);
        start();
      });
    });
  });

  asyncTest('Render a document to Html', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        var first = documents.results[0];
        notEqual(null, first);
        first.asHtml(ctx);
        start();
      });
    });
  });

  asyncTest('Render a document to Text', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCpr")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        function fix(s) {
          // remove dates and timezone
          return s.replace(/[A-Z][a-z]{2,4} [A-Z][a-z]{2,4} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4} \([^)]+\)/g, '<DATE>');
        }
        equal(fix(documents.results[0].asText(ctx)), fix("Get the right approach to ganache A lot of people touch base with us to know about one of our key ingredients, and the essential role it plays in our creations: ganache. Indeed, ganache is the macaron's softener, or else, macarons would be but tough biscuits; it is the cupcake's wrapper, or else, cupcakes would be but plain old cake. We even sometimes use ganache within our cupcakes, to soften the cake itself, or as a support to our pies' content. How to approach ganache Apart from the taste balance, which is always a challenge when it comes to pastry, the tough part about ganache is about thickness. It is even harder to predict through all the phases the ganache gets to meet (how long will it get melted? how long will it remain in the fridge?). Things get a hell of a lot easier to get once you consider that there are two main ways to get the perfect ganache: working from the top down: start with a thick, almost hard material, and soften it by manipulating it, or by mixing it with a more liquid ingredient (like milk) working from the bottom up: start from a liquid-ish state, and harden it by miwing it with thicker ingredients, or by leaving it in the fridge longer. We do hope this advice will empower you in your ganache-making skills. Let us know how you did with it! Ganache at Les Bonnes Choses We have a saying at Les Bonnes Choses: \"Once you can make ganache, you can make anything.\" As you may know, we like to give our workshop artists the ability to master their art to the top; that is why our Preparation Experts always start off as being Ganache Specialists for Les Bonnes Choses. That way, they're given an opportunity to focus on one exercise before moving on. Once they master their ganache, and are able to provide the most optimal delight to our customers, we consider they'll thrive as they work on other kinds of preparations. About the chocolate in our ganache Now, we've also had a lot of questions about how our chocolate gets made. It's true, as you might know, that we make it ourselves, from Columbian cocoa and French cow milk, with a process that much resembles the one in the following Discovery Channel documentary.Ganache is a tricky topic, but here's some guidance.Tue Jul 23 2013 17:00:00 GMT-0700 (PDT)Steve Adams, Ganache SpecialistDo it yourselfYes/testing_url/UkL0gMuvzYUANCpm/triple-chocolate-cupcake?ref=XXXXX/testing_url/UkL0gMuvzYUANCpn/tips-to-dress-a-pastry?ref=XXXXX"));
        start();
      });
    });
  });

  asyncTest('StructuredTexts asHtml handles embeds and lists', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCpr")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results[0].getStructuredText('blog-post.body').asHtml(), '<h1>Get the right approach to ganache</h1><p>A lot of people touch base with us to know about one of our key ingredients, and the essential role it plays in our creations: ganache.</p><p>Indeed, ganache is the macaron\'s softener, or else, macarons would be but tough biscuits; it is the cupcake\'s wrapper, or else, cupcakes would be but plain old cake. We even sometimes use ganache within our cupcakes, to soften the cake itself, or as a support to our pies\' content.</p><h2>How to approach ganache</h2><p><img src=\"https://prismic-io.s3.amazonaws.com/lesbonneschoses/ee7b984b98db4516aba2eabd54ab498293913c6c.jpg\" alt=\"\"></p><p>Apart from the taste balance, which is always a challenge when it comes to pastry, the tough part about ganache is about thickness. It is even harder to predict through all the phases the ganache gets to meet (how long will it get melted? how long will it remain in the fridge?). Things get a hell of a lot easier to get once you consider that there are two main ways to get the perfect ganache:</p><ul><li><strong>working from the top down</strong>: start with a thick, almost hard material, and soften it by manipulating it, or by mixing it with a more liquid ingredient (like milk)</li><li><strong>working from the bottom up</strong>: start from a liquid-ish state, and harden it by miwing it with thicker ingredients, or by leaving it in the fridge longer.</li></ul><p>We do hope this advice will empower you in your ganache-making skills. Let us know how you did with it!</p><h2>Ganache at <em>Les Bonnes Choses</em></h2><p>We have a saying at Les Bonnes Choses: \"Once you can make ganache, you can make anything.\"</p><p>As you may know, we like to give our workshop artists the ability to master their art to the top; that is why our Preparation Experts always start off as being Ganache Specialists for Les Bonnes Choses. That way, they\'re given an opportunity to focus on one exercise before moving on. Once they master their ganache, and are able to provide the most optimal delight to our customers, we consider they\'ll thrive as they work on other kinds of preparations.</p><h2>About the chocolate in our ganache</h2><p>Now, we\'ve also had a lot of questions about how our chocolate gets made. It\'s true, as you might know, that we make it ourselves, from Columbian cocoa and French cow milk, with a process that much resembles the one in the following Discovery Channel documentary.</p><div data-oembed=\"undefined\" data-oembed-type=\"embed\" data-oembed-provider=\"undefined\"><iframe width=\"459\" height=\"344\" src=\"http://www.youtube.com/embed/Ye78F3-CuXY?feature=oembed\" frameborder=\"0\" allowfullscreen></iframe></div>');
        start();
      });
    }, previewToken);
  });

  asyncTest('StructuredTexts asText works', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCpr")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results[0].getStructuredText('blog-post.body').asText(), "Get the right approach to ganache A lot of people touch base with us to know about one of our key ingredients, and the essential role it plays in our creations: ganache. Indeed, ganache is the macaron's softener, or else, macarons would be but tough biscuits; it is the cupcake's wrapper, or else, cupcakes would be but plain old cake. We even sometimes use ganache within our cupcakes, to soften the cake itself, or as a support to our pies' content. How to approach ganache Apart from the taste balance, which is always a challenge when it comes to pastry, the tough part about ganache is about thickness. It is even harder to predict through all the phases the ganache gets to meet (how long will it get melted? how long will it remain in the fridge?). Things get a hell of a lot easier to get once you consider that there are two main ways to get the perfect ganache: working from the top down: start with a thick, almost hard material, and soften it by manipulating it, or by mixing it with a more liquid ingredient (like milk) working from the bottom up: start from a liquid-ish state, and harden it by miwing it with thicker ingredients, or by leaving it in the fridge longer. We do hope this advice will empower you in your ganache-making skills. Let us know how you did with it! Ganache at Les Bonnes Choses We have a saying at Les Bonnes Choses: \"Once you can make ganache, you can make anything.\" As you may know, we like to give our workshop artists the ability to master their art to the top; that is why our Preparation Experts always start off as being Ganache Specialists for Les Bonnes Choses. That way, they're given an opportunity to focus on one exercise before moving on. Once they master their ganache, and are able to provide the most optimal delight to our customers, we consider they'll thrive as they work on other kinds of preparations. About the chocolate in our ganache Now, we've also had a lot of questions about how our chocolate gets made. It's true, as you might know, that we make it ourselves, from Columbian cocoa and French cow milk, with a process that much resembles the one in the following Discovery Channel documentary.");
        start();
      });
    }, previewToken);
  });

  asyncTest('StructuredTexts asHtml handles preformatted', 1, function() {
    Prismic.Api(microRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UrDejAEAAFwMyrW9")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results[0].getStructuredText('doc.content').asHtml(ctx), '<p>Meta-micro gets installed pretty much like any javascript library:</p><ol><li><a href=\"/testing_url/U0w8OwEAACoAQEvB/download-meta-micro?ref=XXXXX\">download</a> the .js file: get the minified one, unless the framework you\'re using minifies your .js files automatically.</li><li>add a link towards the file in your webpage\'s head.</li></ol><p>The link might look like this, anywhere inside your head tag:</p><pre><script type=\"text/javascript\" src=\"meta-micro.min.js\"></script></pre><p>You\'re all set!</p>');
        start();
      });
    });
  });

  asyncTest('StructuredTexts asHtml handles spans', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCps")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results[0].getStructuredText('blog-post.body').asHtml(), '<h1>The end of a chapter the beginning of a new one</h1><p><img src="https://prismic-io.s3.amazonaws.com/lesbonneschoses/8181933ff2f5032daff7d732e33a3beb6f57e09f.jpg" alt=\"\"></p><p>Jean-Michel Pastranova, the founder of <em>Les Bonnes Choses</em>, and creator of the whole concept of modern fine pastry, has decided to step down as the CEO and the Director of Workshops of <em>Les Bonnes Choses</em>, to focus on other projects, among which his now best-selling pastry cook books, but also to take on a primary role in a culinary television show to be announced later this year.</p><p>"I believe I\'ve taken the <em>Les Bonnes Choses</em> concept as far as it can go. <em>Les Bonnes Choses</em> is already an entity that is driven by its people, thanks to a strong internal culture, so I don\'t feel like they need me as much as they used to. I\'m sure they are greater ways to come, to innovate in pastry, and I\'m sure <em>Les Bonnes Choses</em>\'s coming innovation will be even more mind-blowing than if I had stayed longer."</p><p>He will remain as a senior advisor to the board, and to the workshop artists, as his daughter Selena, who has been working with him for several years, will fulfill the CEO role from now on.</p><p>"My father was able not only to create a revolutionary concept, but also a company culture that puts everyone in charge of driving the company\'s innovation and quality. That gives us years, maybe decades of revolutionary ideas to come, and there\'s still a long, wonderful path to walk in the fine pastry world."</p>');
        start();
      });
    }, previewToken);
  });

  asyncTest('StructuredTexts asHtml handles span Link.web', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCph")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results[0].getStructuredText('job-offer.profile').asHtml(), '<p>As a company whose marketing is very content-centric, we expect our Content Director to have a tremendous experience, both in content strategy, and in content writing. We expect our applicants to show off some of the content strategies they set up themselves, explaining their choices, and to provide amazing contents they personally wrote.</p><p>Our contents get flexibly powerfully shared on various supports: our site, our in-store printed magazine, our mobile apps, our mailings ... Our Content Director must have experience with all of those, and with using modern adaptive content managers such as <a href=\"http://prismic.io\">prismic.io</a>.</p>');
        start();
      });
    }, previewToken);
  });

  asyncTest('StructuredTexts asHtml handles span Link.document', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCpo")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results[0].getStructuredText('blog-post.body').asHtml(ctx), '<h1>Our world-famous Pastry Art Brainstorm event</h1><p><img src=\"https://prismic-io.s3.amazonaws.com/lesbonneschoses/c38f9e5a1a6c43aa7aae516c154013a2cee2bc75.jpg\" alt=\"\"></p><p>Each year, <em>Les Bonnes Choses</em> organizes a world-famous two-day event called the \"Pastry Art Brainstorm\", and which is the perfect excuse for every fine pastry artist in the world to exercise their art, and build their skills up. The event is a multiple win-win operation, at many levels: see what the event is, as seen by many point of views.</p><h2>As seen by the top pastry artists worldwide</h2><p>The event always starts with half a day of conference talks, given by the most insightful pastry artists in the world, selected for having made tremendous achievements in pastry that year. The list of invited guest speakers is decided jointly by the <em>Les Bonnes Choses</em> staff and the Fine Pastry Magazine editors.</p><p>This is great for the speakers, who get an occasion to share their work, and have people build up on it with them.</p><h2>As seen by the pastry professionals</h2><p>After half a day of thoughtful conference, the professionals will get to put what they learned to good use, and mingle with the best artists worldwide to make the most daring pastries together. There are no set rules about who does what during this giant innovation workshop, and many crazy ideas get created out of thin air. As a virtually infinite amount of ingredients is provided by the <em>Les Bonnes Choses</em> staff, many unexpected pastries happen on that day, and professionals taste each other\'s creations, and provide relevant feedback to each other. Most pieces get showcased to the amateur audience as well, who get invited to taste some of the pieces.</p><p>At noon on the second day, teams are expected to subscribe to our Pastry Art Challenge, during which they will make the best possible pastry,  judged on many aspects (originality, taste, looks, ...) by a jury of amateurs and professionals. The team members of the three winning pieces share a substantial prize, and their pastries may even join the Les Bonnes Choses catalogue, and be offered in all the <em>Les Bonnes Choses</em> shops worldwide!</p><h2>As seen by the pastry amateurs</h2><p>The conference is limited with a reasonable fee; but the showcase is open to everyone, although visitors are often expected to pay the pastry chefs for the pastries they taste. The educated amateurs spend their day tasting the most daring pieces, giving some appreciated feedback to their chefs, and challenging their own tastebuds. The novice amateurs usually get a once-in-a-lifetime experience, and often mention being blown away by how rich the fine pastry art can be. All in all, every one goes home with a smile on their faces!</p><h2>As seen by the Les Bonnes Choses interns</h2><p>Every year, we recruit a very limited amount of interns, who get aboard a <a href=\"/testing_url/UkL0gMuvzYUANCpp/les-bonnes-chosess-internship-a-testimony?ref=XXXXX\">life-defining adventure around fine pastries</a>, discovering <em>Les Bonnes Choses</em> during half a year, with part of this time spent in one of our shops abroad. We always manage to get them on board at a time when we know they will be able to attend a Fine Pastry Brainstorm, because we consider it is a very defining element in the experience of being part of <em>Les Bonnes Choses</em>.</p><p>Not only do we invite them to the event (whatever the country they are stationed in when the event happens), but we give them a front-row seat! They are part of the jury for the Fine Pastry Challenge, they are introduced to every speaker as the next generation of pastry (thus having the occasion to learn even more, directly from them).</p><h2>As seen by fine pastry as a field</h2><p>There wasn\'t really an international occasion for pastry artists to join and share, before <em>Les Bonnes Choses</em> came up with the first Fine Pastry Brainstorm, in 2006. Fine Pastry Magazine\'s first edition was out in 2004, and initiated the idea that pastry art needed to be shared better between professionals. But a proper event to meet up in person was missing, and <em>Les Bonnes Choses</em> is proud to be the one to have come up with it first.</p><p>Since then, more local initiatives have been started (notably in Argentina, and Canada), but none comes close to the size of <em>Les Bonnes Choses</em>\'s international Fine Pastry Brainstorm.</p><h2>As seen by <em>Les Bonnes Choses</em></h2><p>As the almost only sponsor of every edition of the event, <em>Les Bonnes Choses</em> makes sure enough ingredients are available for everyone, rents the premises, makes sure the speakers are as comfortable as possible, and takes care of the whole organization! But through the operation, <em>Les Bonnes Choses</em> gains much more than any sponsoring can buy: not only does it get to secure <em>Les Bonnes Choses</em> as the world reference in pastry arts, but it also allows them to claim rightfully that they do offer in their shops the best pastries, created by the world top artists indeed.</p>');
        start();
      });
    }, previewToken);
  });

  asyncTest('StructuredTexts getFirstImage works', 5, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCpo")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().url, "https://prismic-io.s3.amazonaws.com/lesbonneschoses/c38f9e5a1a6c43aa7aae516c154013a2cee2bc75.jpg");
        equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().alt, "");
        equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().height, 427);
        equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().width, 640);
        equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().asHtml(), '<img src=https://prismic-io.s3.amazonaws.com/lesbonneschoses/c38f9e5a1a6c43aa7aae516c154013a2cee2bc75.jpg width=640 height=427 alt="">');
        start();
      });
    }, previewToken);
  });

  asyncTest('StructuredTexts asHtml handles span Link.file', 1, function() {
    var jsonString = '{"type":"StructuredText","value":[{"type":"paragraph","text":"2012 Annual Report","spans":[{"start":0,"end":18,"type":"hyperlink","data":{"type":"Link.file","value":{"file":{"name":"2012_annual.report.pdf","kind":"document","url":"https://prismic-io.s3.amazonaws.com/annual.report.pdf","size":"1282484"}}}}]},{"type":"paragraph","text":"2012 Annual Budget","spans":[{"start":0,"end":18,"type":"hyperlink","data":{"type":"Link.file","value":{"file":{"name":"2012_smec.annual.budget.pdf","kind":"document","url":"https://prismic-io.s3.amazonaws.com/annual.budget.pdf","size":"59229"}}}}]},{"type":"paragraph","text":"2015 Vision & Strategic Plan","spans":[{"start":0,"end":28,"type":"hyperlink","data":{"type":"Link.file","value":{"file":{"name":"2015_vision.strategic.plan_.sm_.pdf","kind":"document","url":"https://prismic-io.s3.amazonaws.com/vision.strategic.plan_.sm_.pdf","size":"1969956"}}}}]}]}';
    var jsonObject = JSON.parse(jsonString);
    equal(Prismic.Fragments.initField(jsonObject).asHtml(), '<p><a href=\"https://prismic-io.s3.amazonaws.com/annual.report.pdf\">2012 Annual Report</a></p><p><a href=\"https://prismic-io.s3.amazonaws.com/annual.budget.pdf\">2012 Annual Budget</a></p><p><a href=\"https://prismic-io.s3.amazonaws.com/vision.strategic.plan_.sm_.pdf\">2015 Vision & Strategic Plan</a></p>');
    start();
  });

  asyncTest('Handles multiple fields', 1, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCpr")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results[0].getAll('blog-post.relatedpost')[0].asHtml(ctx), '<a href="/testing_url/UkL0gMuvzYUANCpn/tips-to-dress-a-pastry?ref=XXXXX">/testing_url/UkL0gMuvzYUANCpn/tips-to-dress-a-pastry?ref=XXXXX</a>');
        start();
      });
    }, previewToken);
  });

  asyncTest('ImageViews are well retrieved', 2, function() {
    Prismic.Api(testRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCpR")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        equal(documents.results[0].getImageView('product.image', 'main').asHtml(), '<img src=https://prismic-io.s3.amazonaws.com/lesbonneschoses/f606ad513fcc2a73b909817119b84d6fd0d61a6d.png width=500 height=500 alt="">');
        equal(documents.results[0].getImageView('product.image', 'icon').asHtml(), '<img src=https://prismic-io.s3.amazonaws.com/lesbonneschoses/fe4f9379ee325456992d48204b8d94aeb60cc976.png width=250 height=250 alt="">');
        start();
      });
    }, previewToken);
  });

  asyncTest('Block fragments are accessible, loopable, and serializable', 4, function() {
    Prismic.Api(microRepository, function(err, Api) {
      if (err) { console.log(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UrDndQEAALQMyrXF")]]').ref(Api.master()).submit(function(err, documents) {
        if (err) { console.log(err); return; }
        // Group fragments are accessible
        equal(documents.results[0].getGroup('docchapter.docs').toArray()[0]['linktodoc'].value.document.type, 'doc');
        // Group fragments are loopable
        var slugs = "";
        for (var i = 0; i<documents.results[0].getGroup('docchapter.docs').toArray().length; i++) {
          slugs += documents.results[0].getGroup('docchapter.docs').toArray()[i]['linktodoc'].value.document.slug + ' ';
        }
        equal(slugs.trim(), 'with-jquery with-bootstrap');
        // Group fragments are serializable when asHtml is called directly on them
        equal(documents.results[0].getGroup('docchapter.docs').asHtml(ctx), '<section data-field=\"linktodoc\"><a href=\"/testing_url/UrDofwEAALAdpbNH/with-jquery?ref=XXXXX\">/testing_url/UrDofwEAALAdpbNH/with-jquery?ref=XXXXX</a></section><section data-field=\"linktodoc\"><a href=\"/testing_url/UrDp8AEAAPUdpbNL/with-bootstrap?ref=XXXXX\">/testing_url/UrDp8AEAAPUdpbNL/with-bootstrap?ref=XXXXX</a></section>');
        // Group fragments are serializable when as Html is called on a document
        equal(documents.results[0].asHtml(ctx), '<section data-field=\"docchapter.title\"><h1>Using with other projects</h1></section><section data-field=\"docchapter.intro\"><p>As advertised, meta-micro knows how to stay out of the way of the rest of your application. Here are some cases of how to use it with some of the most used open-source projects in JavaScript.</p></section><section data-field=\"docchapter.priority\"><span>500</span></section><section data-field=\"docchapter.docs\"><section data-field=\"linktodoc\"><a href=\"/testing_url/UrDofwEAALAdpbNH/with-jquery?ref=XXXXX\">/testing_url/UrDofwEAALAdpbNH/with-jquery?ref=XXXXX</a></section><section data-field=\"linktodoc\"><a href=\"/testing_url/UrDp8AEAAPUdpbNL/with-bootstrap?ref=XXXXX\">/testing_url/UrDp8AEAAPUdpbNL/with-bootstrap?ref=XXXXX</a></section></section>');
        start();
      });
    });
  });

}(window.Prismic));
