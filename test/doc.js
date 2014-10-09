(function(Prismic) {

    // Test snippets for the documentation, and keep them in sync with Gist

    var testRepository = 'https://lesbonneschoses.prismic.io/api',
        previewToken = 'MC5VbDdXQmtuTTB6Z0hNWHF3.c--_vVbvv73vv73vv73vv71EA--_vS_vv73vv70T77-9Ke-_ve-_vWfvv70ebO-_ve-_ve-_vQN377-9ce-_vRfvv70',
        microRepository = 'https://micro.prismic.io/api',
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

    asyncTest('prismic-htmlSerializer.js', 1, function() {
        Prismic.Api(testRepository, function (err, Api) {
            Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbl")]]').ref(Api.master()).submit(function (err, documents) {
                if (err) {
                    console.log(err);
                    return;
                }
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

    asyncTest('prismic-api.js', 1, function(){
// startgist:b253d8fddfdd4cceef7a:prismic-api.js
        Prismic.Api('https://lesbonneschoses.prismic.io/api', function(err, Api) {
            // You can use the Api object inside this block
            console.log("References: ", Api.data.refs);
            equal(Api.data.refs.length, 1); // gisthide
            start(); // gisthide
        });
// endgist
    });

    asyncTest('prismic-simplequery.js', 1, function(){
// startgist:f3f7d4b970e964131271:prismic-simplequery.js
        Prismic.Api('https://lesbonneschoses.prismic.io/api', function(err, Api) {
            Api.form('everything')
                .ref(Api.master())
                .query(Prismic.Predicates.at("document.type", "product")).submit(function(err, response) {
                    // The documents object contains a Response object with all documents of type "product"
                    equal(response.results.length, 16); // gisthide
                    start(); // gisthide
                });
        });
// endgist
    });

    asyncTest('prismic-predicates.js', 1, function() {
// startgist:2bdf83055d57f35d5d85:prismic-predicates.js
      Prismic.Api('https://lesbonneschoses.prismic.io/api', function(err, Api) {
        Api.form('everything').ref(Api.master()).query(
          Predicates.at("document.type", "blog-post"),
          Predicates.dateAfter("my.blog-post.date", new Date(2014, 6, 1))
        ).submit(function(err, response) {
            // All documents of type "product", updated after June 1st, 2014
            equal(response.results.length, 0); // gisthide
            start(); // gisthide
          });
      });
// endgist
    });

    asyncTest('prismic-asHtml.js', 1, function() {
      Prismic.Api('https://lesbonneschoses.prismic.io/api', function (err, Api) {
        Api.form('everything').ref(Api.master()).query(Prismic.Predicates.at("document.id", "UlfoxUnM0wkXYXbX")).submit(function (err, response) {
          if (err) { console.log(err); return; }
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

}(window.Prismic));
