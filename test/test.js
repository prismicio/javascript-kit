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

  asyncTest('StructuredTexts asHtml handles embeds and lists', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCpr")]]').ref(Api.master()).submit(function(results) {
        equal(results[0].getStructuredText('blog-post.body').asHtml(), '<h1>Get the right approach to ganache</h1><p>A lot of people touch base with us to know about one of our key ingredients, and the essential role it plays in our creations: ganache.</p><p>Indeed, ganache is the macaron\'s softener, or else, macarons would be but tough biscuits; it is the cupcake\'s wrapper, or else, cupcakes would be but plain old cake. We even sometimes use ganache within our cupcakes, to soften the cake itself, or as a support to our pies\' content.</p><h2>How to approach ganache</h2><p><img src=\"https://prismic-io.s3.amazonaws.com/lesbonneschoses/ee7b984b98db4516aba2eabd54ab498293913c6c.jpg\"></p><p>Apart from the taste balance, which is always a challenge when it comes to pastry, the tough part about ganache is about thickness. It is even harder to predict through all the phases the ganache gets to meet (how long will it get melted? how long will it remain in the fridge?). Things get a hell of a lot easier to get once you consider that there are two main ways to get the perfect ganache:</p><ul><li><strong>working from the top down</strong>: start with a thick, almost hard material, and soften it by manipulating it, or by mixing it with a more liquid ingredient (like milk)</li><li><strong>working from the bottom up</strong>: start from a liquid-ish state, and harden it by miwing it with thicker ingredients, or by leaving it in the fridge longer.</li></ul><p>We do hope this advice will empower you in your ganache-making skills. Let us know how you did with it!</p><h2>Ganache at <em>Les Bonnes Choses</em></h2><p>We have a saying at Les Bonnes Choses: \"Once you can make ganache, you can make anything.\"</p><p>As you may know, we like to give our workshop artists the ability to master their art to the top; that is why our Preparation Experts always start off as being Ganache Specialists for Les Bonnes Choses. That way, they\'re given an opportunity to focus on one exercise before moving on. Once they master their ganache, and are able to provide the most optimal delight to our customers, we consider they\'ll thrive as they work on other kinds of preparations.</p><h2>About the chocolate in our ganache</h2><p>Now, we\'ve also had a lot of questions about how our chocolate gets made. It\'s true, as you might know, that we make it ourselves, from Columbian cocoa and French cow milk, with a process that much resembles the one in the following Discovery Channel documentary.</p><div data-oembed=\"undefined\" data-oembed-type=\"embed\" data-oembed-provider=\"undefined\"><iframe width=\"459\" height=\"344\" src=\"http://www.youtube.com/embed/Ye78F3-CuXY?feature=oembed\" frameborder=\"0\" allowfullscreen></iframe></div>');
        start();
      });
    }, previewToken);
  });

  asyncTest('StructuredTexts asHtml handles spans', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCps")]]').ref(Api.master()).submit(function(results) {
        equal(results[0].getStructuredText('blog-post.body').asHtml(), '<h1>The end of a chapter the beginning of a new one</h1><p><img src="https://prismic-io.s3.amazonaws.com/lesbonneschoses/8181933ff2f5032daff7d732e33a3beb6f57e09f.jpg"></p><p>Jean-Michel Pastranova, the founder of <em>Les Bonnes Choses</em>, and creator of the whole concept of modern fine pastry, has decided to step down as the CEO and the Director of Workshops of <em>Les Bonnes Choses</em>, to focus on other projects, among which his now best-selling pastry cook books, but also to take on a primary role in a culinary television show to be announced later this year.</p><p>"I believe I\'ve taken the <em>Les Bonnes Choses</em> concept as far as it can go. <em>Les Bonnes Choses</em> is already an entity that is driven by its people, thanks to a strong internal culture, so I don\'t feel like they need me as much as they used to. I\'m sure they are greater ways to come, to innovate in pastry, and I\'m sure <em>Les Bonnes Choses</em>\'s coming innovation will be even more mind-blowing than if I had stayed longer."</p><p>He will remain as a senior advisor to the board, and to the workshop artists, as his daughter Selena, who has been working with him for several years, will fulfill the CEO role from now on.</p><p>"My father was able not only to create a revolutionary concept, but also a company culture that puts everyone in charge of driving the company\'s innovation and quality. That gives us years, maybe decades of revolutionary ideas to come, and there\'s still a long, wonderful path to walk in the fine pastry world."</p>');
        start();
      });
    }, previewToken);
  });

  asyncTest('StructuredTexts asHtml handles span Link.web', 1, function() {
    Prismic.Api(testRepository, function(Api) {
      Api.forms('everything').query('[[:d = at(document.id, "UkL0gMuvzYUANCph")]]').ref(Api.master()).submit(function(results) {
        equal(results[0].getStructuredText('job-offer.profile').asHtml(), '<p>As a company whose marketing is very content-centric, we expect our Content Director to have a tremendous experience, both in content strategy, and in content writing. We expect our applicants to show off some of the content strategies they set up themselves, explaining their choices, and to provide amazing contents they personally wrote.</p><p>Our contents get flexibly powerfully shared on various supports: our site, our in-store printed magazine, our mobile apps, our mailings ... Our Content Director must have experience with all of those, and with using modern adaptive content managers such as <a href=\"http://prismic.io\">prismic.io</a>.</p>');
        start();
      });
    }, previewToken);
  });

}(window.Prismic));