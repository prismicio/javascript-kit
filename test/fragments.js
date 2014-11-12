(function(Prismic) {

    var assert = chai.assert,
        testRepository = 'https://lesbonneschoses.prismic.io/api',
        previewToken = 'MC5VbDdXQmtuTTB6Z0hNWHF3.c--_vVbvv73vv73vv73vv71EA--_vS_vv73vv70T77-9Ke-_ve-_vWfvv70ebO-_ve-_ve-_vQN377-9ce-_vRfvv70',
        microRepository = 'https://micro.prismic.io/api',
        Predicates = Prismic.Predicates;

    function getLinkResolver(ref) {
        return function(doc, isBroken) {
            if (isBroken) return '#broken';
            return "/testing_url/" + doc.id + "/" + doc.slug + (ref ? ('?ref=' + ref) : '');
        }
    }

    describe('Document manipulation', function() {

        it('Stores and retrieves all document slugs well', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbg")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    var doc = documents.results[0];
                    assert.equal(doc.slugs.length, 2);
                    done();
                });
            });
        });

        it('Render a document to Html', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    var first = documents.results[0];
                    assert.notEqual(null, first);
                    first.asHtml(getLinkResolver());
                    done();
                });
            });
        });

        it('Render a document to Text', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbX")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    function fix(s) {
                        // remove dates and timezone
                        return s.replace(/[A-Z][a-z]{2,4} [A-Z][a-z]{2,4} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4} \([^)]+\)/g, '<DATE>');
                    }

                    assert.equal(fix(documents.results[0].asText(getLinkResolver('XXXXX'))), fix("Get the right approach to ganache A lot of people touch base with us to know about one of our key ingredients, and the essential role it plays in our creations: ganache. Indeed, ganache is the macaron's softener, or else, macarons would be but tough biscuits; it is the cupcake's wrapper, or else, cupcakes would be but plain old cake. We even sometimes use ganache within our cupcakes, to soften the cake itself, or as a support to our pies' content. How to approach ganache Apart from the taste balance, which is always a challenge when it comes to pastry, the tough part about ganache is about thickness. It is even harder to predict through all the phases the ganache gets to meet (how long will it get melted? how long will it remain in the fridge?). Things get a hell of a lot easier to get once you consider that there are two main ways to get the perfect ganache: working from the top down: start with a thick, almost hard material, and soften it by manipulating it, or by mixing it with a more liquid ingredient (like milk) working from the bottom up: start from a liquid-ish state, and harden it by miwing it with thicker ingredients, or by leaving it in the fridge longer. We do hope this advice will empower you in your ganache-making skills. Let us know how you did with it! Ganache at Les Bonnes Choses We have a saying at Les Bonnes Choses: \"Once you can make ganache, you can make anything.\" As you may know, we like to give our workshop artists the ability to master their art to the top; that is why our Preparation Experts always start off as being Ganache Specialists for Les Bonnes Choses. That way, they're given an opportunity to focus on one exercise before moving on. Once they master their ganache, and are able to provide the most optimal delight to our customers, we consider they'll thrive as they work on other kinds of preparations. About the chocolate in our ganache Now, we've also had a lot of questions about how our chocolate gets made. It's true, as you might know, that we make it ourselves, from Columbian cocoa and French cow milk, with a process that much resembles the one in the following Discovery Channel documentary.Ganache is a tricky topic, but here's some guidance.Tue Jul 23 2013 17:00:00 GMT-0700 (PDT)Steve Adams, Ganache SpecialistDo it yourselfYes/testing_url/UlfoxUnM0wkXYXbj/triple-chocolate-cupcake?ref=XXXXX/testing_url/UlfoxUnM0wkXYXbm/tips-to-dress-a-pastry?ref=XXXXX"));
                    done();
                });
            });
        });

    });

    describe('StructuredText', function() {

        it('asHtml handles embeds and lists', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbX")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    assert.equal(documents.results[0].getStructuredText('blog-post.body').asHtml(), '<h1>Get the right approach to ganache</h1><p>A lot of people touch base with us to know about one of our key ingredients, and the essential role it plays in our creations: ganache.</p><p>Indeed, ganache is the macaron\'s softener, or else, macarons would be but tough biscuits; it is the cupcake\'s wrapper, or else, cupcakes would be but plain old cake. We even sometimes use ganache within our cupcakes, to soften the cake itself, or as a support to our pies\' content.</p><h2>How to approach ganache</h2><p class=\"block-img\"><img src=\"https://prismic-io.s3.amazonaws.com/lesbonneschoses/ee7b984b98db4516aba2eabd54ab498293913c6c.jpg\" alt=\"\"></p><p>Apart from the taste balance, which is always a challenge when it comes to pastry, the tough part about ganache is about thickness. It is even harder to predict through all the phases the ganache gets to meet (how long will it get melted? how long will it remain in the fridge?). Things get a hell of a lot easier to get once you consider that there are two main ways to get the perfect ganache:</p><ul><li><strong>working from the top down</strong>: start with a thick, almost hard material, and soften it by manipulating it, or by mixing it with a more liquid ingredient (like milk)</li><li><strong>working from the bottom up</strong>: start from a liquid-ish state, and harden it by miwing it with thicker ingredients, or by leaving it in the fridge longer.</li></ul><p>We do hope this advice will empower you in your ganache-making skills. Let us know how you did with it!</p><h2>Ganache at <em>Les Bonnes Choses</em></h2><p>We have a saying at Les Bonnes Choses: \"Once you can make ganache, you can make anything.\"</p><p>As you may know, we like to give our workshop artists the ability to master their art to the top; that is why our Preparation Experts always start off as being Ganache Specialists for Les Bonnes Choses. That way, they\'re given an opportunity to focus on one exercise before moving on. Once they master their ganache, and are able to provide the most optimal delight to our customers, we consider they\'ll thrive as they work on other kinds of preparations.</p><h2>About the chocolate in our ganache</h2><p>Now, we\'ve also had a lot of questions about how our chocolate gets made. It\'s true, as you might know, that we make it ourselves, from Columbian cocoa and French cow milk, with a process that much resembles the one in the following Discovery Channel documentary.</p><div data-oembed=\"undefined\" data-oembed-type=\"embed\" data-oembed-provider=\"undefined\"><iframe width=\"459\" height=\"344\" src=\"http://www.youtube.com/embed/Ye78F3-CuXY?feature=oembed\" frameborder=\"0\" allowfullscreen></iframe></div>');
                    done();
                });
            }, previewToken);
        });

        it('asText works', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbX")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    assert.equal(documents.results[0].getStructuredText('blog-post.body').asText(), "Get the right approach to ganache A lot of people touch base with us to know about one of our key ingredients, and the essential role it plays in our creations: ganache. Indeed, ganache is the macaron's softener, or else, macarons would be but tough biscuits; it is the cupcake's wrapper, or else, cupcakes would be but plain old cake. We even sometimes use ganache within our cupcakes, to soften the cake itself, or as a support to our pies' content. How to approach ganache Apart from the taste balance, which is always a challenge when it comes to pastry, the tough part about ganache is about thickness. It is even harder to predict through all the phases the ganache gets to meet (how long will it get melted? how long will it remain in the fridge?). Things get a hell of a lot easier to get once you consider that there are two main ways to get the perfect ganache: working from the top down: start with a thick, almost hard material, and soften it by manipulating it, or by mixing it with a more liquid ingredient (like milk) working from the bottom up: start from a liquid-ish state, and harden it by miwing it with thicker ingredients, or by leaving it in the fridge longer. We do hope this advice will empower you in your ganache-making skills. Let us know how you did with it! Ganache at Les Bonnes Choses We have a saying at Les Bonnes Choses: \"Once you can make ganache, you can make anything.\" As you may know, we like to give our workshop artists the ability to master their art to the top; that is why our Preparation Experts always start off as being Ganache Specialists for Les Bonnes Choses. That way, they're given an opportunity to focus on one exercise before moving on. Once they master their ganache, and are able to provide the most optimal delight to our customers, we consider they'll thrive as they work on other kinds of preparations. About the chocolate in our ganache Now, we've also had a lot of questions about how our chocolate gets made. It's true, as you might know, that we make it ourselves, from Columbian cocoa and French cow milk, with a process that much resembles the one in the following Discovery Channel documentary.");
                    done();
                });
            }, previewToken);
        });

        it('asHtml handles preformatted', function (done) {
            Prismic.Api(microRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UrDejAEAAFwMyrW9")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    assert.equal(
                        documents.results[0].getStructuredText('doc.content').asHtml(getLinkResolver()),
                        '<p>Meta-micro gets installed pretty much like any javascript library:</p><ol><li><a href=\"/testing_url/U0w8OwEAACoAQEvB/download-meta-micro\">download</a> the .js file: get the minified one, unless the framework you\'re using minifies your .js files automatically.</li><li>add a link towards the file in your webpage\'s head.</li></ol><p>The link might look like this, anywhere inside your head tag:</p><pre>&lt;script type=\"text/javascript\" src=\"meta-micro.min.js\"&gt;&lt;/script&gt;</pre><p>You\'re all set!</p>');
                    done();
                });
            });
        });

        it('Test backward-compatibility with passing a ctx instead of just a linkResolver', function (done) {
            Prismic.Api(microRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UrDejAEAAFwMyrW9")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    assert.equal(
                        documents.results[0].getStructuredText('doc.content').asHtml({
                            api: undefined,
                            ref: { ref: 'XXXXX', label: 'Future release', isMaster: false },
                            maybeRef: 'XXXXX',
                            oauth: function () {
                            },
                            linkResolver: function (ctx, doc, isBroken) {
                                if (isBroken) return '#broken';
                                return "/testing_url/" + doc.id + "/" + doc.slug + ( ctx.maybeRef ? '?ref=' + ctx.maybeRef : '' );
                            }
                        }),
                        '<p>Meta-micro gets installed pretty much like any javascript library:</p><ol><li><a href=\"/testing_url/U0w8OwEAACoAQEvB/download-meta-micro?ref=XXXXX\">download</a> the .js file: get the minified one, unless the framework you\'re using minifies your .js files automatically.</li><li>add a link towards the file in your webpage\'s head.</li></ol><p>The link might look like this, anywhere inside your head tag:</p><pre>&lt;script type=\"text/javascript\" src=\"meta-micro.min.js\"&gt;&lt;/script&gt;</pre><p>You\'re all set!</p>');
                    done();
                });
            });
        });

        it('asHtml handles spans', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbt")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    assert.equal(documents.results[0].getStructuredText('blog-post.body').asHtml(), '<h1>The end of a chapter the beginning of a new one</h1><p class="block-img"><img src="https://prismic-io.s3.amazonaws.com/lesbonneschoses/8181933ff2f5032daff7d732e33a3beb6f57e09f.jpg" alt=\"\"></p><p>Jean-Michel Pastranova, the founder of <em>Les Bonnes Choses</em>, and creator of the whole concept of modern fine pastry, has decided to step down as the CEO and the Director of Workshops of <em>Les Bonnes Choses</em>, to focus on other projects, among which his now best-selling pastry cook books, but also to take on a primary role in a culinary television show to be announced later this year.</p><p>"I believe I\'ve taken the <em>Les Bonnes Choses</em> concept as far as it can go. <em>Les Bonnes Choses</em> is already an entity that is driven by its people, thanks to a strong internal culture, so I don\'t feel like they need me as much as they used to. I\'m sure they are greater ways to come, to innovate in pastry, and I\'m sure <em>Les Bonnes Choses</em>\'s coming innovation will be even more mind-blowing than if I had stayed longer."</p><p>He will remain as a senior advisor to the board, and to the workshop artists, as his daughter Selena, who has been working with him for several years, will fulfill the CEO role from now on.</p><p>"My father was able not only to create a revolutionary concept, but also a company culture that puts everyone in charge of driving the company\'s innovation and quality. That gives us years, maybe decades of revolutionary ideas to come, and there\'s still a long, wonderful path to walk in the fine pastry world."</p>');
                    done();
                });
            }, previewToken);
        });

        it('asHtml handles span Link.web', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbW")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    assert.equal(documents.results[0].getStructuredText('job-offer.profile').asHtml(), '<p>As a company whose marketing is very content-centric, we expect our Content Director to have a tremendous experience, both in content strategy, and in content writing. We expect our applicants to show off some of the content strategies they set up themselves, explaining their choices, and to provide amazing contents they personally wrote.</p><p>Our contents get flexibly powerfully shared on various supports: our site, our in-store printed magazine, our mobile apps, our mailings ... Our Content Director must have experience with all of those, and with using modern adaptive content managers such as <a href=\"http://prismic.io\">prismic.io</a>.</p>');
                    done();
                });
            }, previewToken);
        });

        it('asHtml handles span Link.document', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbl")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    assert.equal(documents.results[0].getStructuredText('blog-post.body').asHtml(getLinkResolver('XXXXX')), '<h1>Our world-famous Pastry Art Brainstorm event</h1><p class=\"block-img\"><img src=\"https://prismic-io.s3.amazonaws.com/lesbonneschoses/c38f9e5a1a6c43aa7aae516c154013a2cee2bc75.jpg\" alt=\"\"></p><p>Each year, <em>Les Bonnes Choses</em> organizes a world-famous two-day event called the \"Pastry Art Brainstorm\", and which is the perfect excuse for every fine pastry artist in the world to exercise their art, and build their skills up. The event is a multiple win-win operation, at many levels: see what the event is, as seen by many point of views.</p><h2>As seen by the top pastry artists worldwide</h2><p>The event always starts with half a day of conference talks, given by the most insightful pastry artists in the world, selected for having made tremendous achievements in pastry that year. The list of invited guest speakers is decided jointly by the <em>Les Bonnes Choses</em> staff and the Fine Pastry Magazine editors.</p><p>This is great for the speakers, who get an occasion to share their work, and have people build up on it with them.</p><h2>As seen by the pastry professionals</h2><p>After half a day of thoughtful conference, the professionals will get to put what they learned to good use, and mingle with the best artists worldwide to make the most daring pastries together. There are no set rules about who does what during this giant innovation workshop, and many crazy ideas get created out of thin air. As a virtually infinite amount of ingredients is provided by the <em>Les Bonnes Choses</em> staff, many unexpected pastries happen on that day, and professionals taste each other\'s creations, and provide relevant feedback to each other. Most pieces get showcased to the amateur audience as well, who get invited to taste some of the pieces.</p><p>At noon on the second day, teams are expected to subscribe to our Pastry Art Challenge, during which they will make the best possible pastry,  judged on many aspects (originality, taste, looks, ...) by a jury of amateurs and professionals. The team members of the three winning pieces share a substantial prize, and their pastries may even join the Les Bonnes Choses catalogue, and be offered in all the <em>Les Bonnes Choses</em> shops worldwide!</p><h2>As seen by the pastry amateurs</h2><p>The conference is limited with a reasonable fee; but the showcase is open to everyone, although visitors are often expected to pay the pastry chefs for the pastries they taste. The educated amateurs spend their day tasting the most daring pieces, giving some appreciated feedback to their chefs, and challenging their own tastebuds. The novice amateurs usually get a once-in-a-lifetime experience, and often mention being blown away by how rich the fine pastry art can be. All in all, every one goes home with a smile on their faces!</p><h2>As seen by the Les Bonnes Choses interns</h2><p>Every year, we recruit a very limited amount of interns, who get aboard a <a href=\"/testing_url/UlfoxUnM0wkXYXbu/les-bonnes-chosess-internship-a-testimony?ref=XXXXX\">life-defining adventure around fine pastries</a>, discovering <em>Les Bonnes Choses</em> during half a year, with part of this time spent in one of our shops abroad. We always manage to get them on board at a time when we know they will be able to attend a Fine Pastry Brainstorm, because we consider it is a very defining element in the experience of being part of <em>Les Bonnes Choses</em>.</p><p>Not only do we invite them to the event (whatever the country they are stationed in when the event happens), but we give them a front-row seat! They are part of the jury for the Fine Pastry Challenge, they are introduced to every speaker as the next generation of pastry (thus having the occasion to learn even more, directly from them).</p><h2>As seen by fine pastry as a field</h2><p>There wasn\'t really an international occasion for pastry artists to join and share, before <em>Les Bonnes Choses</em> came up with the first Fine Pastry Brainstorm, in 2006. Fine Pastry Magazine\'s first edition was out in 2004, and initiated the idea that pastry art needed to be shared better between professionals. But a proper event to meet up in person was missing, and <em>Les Bonnes Choses</em> is proud to be the one to have come up with it first.</p><p>Since then, more local initiatives have been started (notably in Argentina, and Canada), but none comes close to the size of <em>Les Bonnes Choses</em>\'s international Fine Pastry Brainstorm.</p><h2>As seen by <em>Les Bonnes Choses</em></h2><p>As the almost only sponsor of every edition of the event, <em>Les Bonnes Choses</em> makes sure enough ingredients are available for everyone, rents the premises, makes sure the speakers are as comfortable as possible, and takes care of the whole organization! But through the operation, <em>Les Bonnes Choses</em> gains much more than any sponsoring can buy: not only does it get to secure <em>Les Bonnes Choses</em> as the world reference in pastry arts, but it also allows them to claim rightfully that they do offer in their shops the best pastries, created by the world top artists indeed.</p>');
                    done();
                });
            }, previewToken);
        });

        it('asHtml with custom serializer', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbl")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    var htmlSerializer = function (element, content) {
                        if (element.type == "image") {
                            return '<img src="' + element.url + '" alt="' + element.alt + '">';
                        }

                        if (element.type == "hyperlink") {
                            return '<a class="some-link" href="' + element.url + '">' + content + '</a>';
                        }

                        return null;
                    };
                    assert.equal(documents.results[0].getStructuredText('blog-post.body').asHtml(getLinkResolver(), htmlSerializer),
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
                    done();
                });
            }, previewToken);
        });

        it('getFirstImage works', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbl")]]').ref(Api.master()).submit(function (err, documents) {
                    assert.equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().url, "https://prismic-io.s3.amazonaws.com/lesbonneschoses/c38f9e5a1a6c43aa7aae516c154013a2cee2bc75.jpg");
                    assert.equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().alt, "");
                    assert.equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().height, 427);
                    assert.equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().width, 640);
                    assert.equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().asHtml(),
                        '<img src="https://prismic-io.s3.amazonaws.com/lesbonneschoses/c38f9e5a1a6c43aa7aae516c154013a2cee2bc75.jpg" width="640" height="427" alt="">');
                    done();
                });
            }, previewToken);
        });

        it('asHtml handles span Link.file', function () {
            var jsonString = '{"type":"StructuredText","value":[{"type":"paragraph","text":"2012 Annual Report","spans":[{"start":0,"end":18,"type":"hyperlink","data":{"type":"Link.file","value":{"file":{"name":"2012_annual.report.pdf","kind":"document","url":"https://prismic-io.s3.amazonaws.com/annual.report.pdf","size":"1282484"}}}}]},{"type":"paragraph","text":"2012 Annual Budget","spans":[{"start":0,"end":18,"type":"hyperlink","data":{"type":"Link.file","value":{"file":{"name":"2012_smec.annual.budget.pdf","kind":"document","url":"https://prismic-io.s3.amazonaws.com/annual.budget.pdf","size":"59229"}}}}]},{"type":"paragraph","text":"2015 Vision & Strategic Plan","spans":[{"start":0,"end":28,"type":"hyperlink","data":{"type":"Link.file","value":{"file":{"name":"2015_vision.strategic.plan_.sm_.pdf","kind":"document","url":"https://prismic-io.s3.amazonaws.com/vision.strategic.plan_.sm_.pdf","size":"1969956"}}}}]}]}';
            var jsonObject = JSON.parse(jsonString);
            assert.equal(Prismic.Fragments.initField(jsonObject).asHtml(), '<p><a href=\"https://prismic-io.s3.amazonaws.com/annual.report.pdf\">2012 Annual Report</a></p><p><a href=\"https://prismic-io.s3.amazonaws.com/annual.budget.pdf\">2012 Annual Budget</a></p><p><a href=\"https://prismic-io.s3.amazonaws.com/vision.strategic.plan_.sm_.pdf\">2015 Vision &amp; Strategic Plan</a></p>');
        });

        it('Proper escaping in asHtml', function (done) {
            var jsonString = "{ \"type\": \"StructuredText\", \"value\": [ { \"type\": \"paragraph\", \"text\": \"<not a real tag>\\nsome text\", \"spans\": [] } ]}";
            var jsonObject = JSON.parse(jsonString);
            var text = Prismic.Fragments.initField(jsonObject);
            assert.equal(
                text.asHtml(),
                "<p>&lt;not a real tag&gt;<br>some text</p>"
            );
            done();
        });

    });

    describe('Various fragment types', function() {

        it('Handles multiple fields', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbX")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    assert.equal(documents.results[0].getAll('blog-post.relatedpost')[0].asHtml(getLinkResolver()), '<a href="/testing_url/UlfoxUnM0wkXYXbm/tips-to-dress-a-pastry">/testing_url/UlfoxUnM0wkXYXbm/tips-to-dress-a-pastry</a>');
                    done();
                });
            }, previewToken);
        });

        it('ImageViews are well retrieved', function (done) {
            Prismic.Api(testRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbO")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    assert.equal(documents.results[0].getImageView('product.image', 'main').asHtml(), '<img src="https://prismic-io.s3.amazonaws.com/lesbonneschoses/f606ad513fcc2a73b909817119b84d6fd0d61a6d.png" width="500" height="500" alt="">');
                    assert.equal(documents.results[0].getImageView('product.image', 'icon').asHtml(), '<img src="https://prismic-io.s3.amazonaws.com/lesbonneschoses/fe4f9379ee325456992d48204b8d94aeb60cc976.png" width="250" height="250" alt="">');
                    done();
                });
            }, previewToken);
        });

        it('GeoPoint is retrieved', function (done) {
            Prismic.Api(microRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "U9pjvjQAADAAehbf")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    var html = '<div class="geopoint"><span class="latitude">48.87687670000001</span><span class="longitude">2.3338801999999825</span></div>';
                    assert.equal(documents.results[0].getGeoPoint('contributor.location').asHtml(), html);
                    done();
                });
            });
        });

        it('Date and Timestamp are parsed correctly', function () {
            var json = JSON.parse('{ "id": "UlfoxUnM0wkXYXbm", "type": "blog-post", "href": "https://lesbonneschoses-vcerzcwaaohojzo.prismic.io/api/documents/...",' +
                '"tags": [], "slugs": [], "linked_documents": [],' +
                '"data": { "blog-post": {' +
                '"date": { "type": "Date", "value": "2013-08-17" },' +
                '"timestamp": { "type": "Timestamp", "value": "2014-10-06T12:24:36+0000" } ' +
                '}}}');
            var doc = Prismic.Api("").parseDoc(json);
            var date = doc.getDate("blog-post.date");
            assert.equal(date.getFullYear(), 2013);
            var ts = doc.getTimestamp("blog-post.timestamp");
            assert.equal(ts.getFullYear(), 2014);
        });

        it('Block fragments are accessible, loopable, and serializable', function (done) {
            Prismic.Api(microRepository, function (err, Api) {
                if (err) throw err;
                Api.form('everything').query('[[:d = at(document.id, "UrDndQEAALQMyrXF")]]').ref(Api.master()).submit(function (err, documents) {
                    if (err) throw err;
                    // Group fragments are accessible
                    assert.equal(documents.results[0].getGroup('docchapter.docs').toArray()[0].getLink('linktodoc').value.document.type, 'doc');
                    // Group fragments are loopable
                    var slugs = "";
                    for (var i = 0; i < documents.results[0].getGroup('docchapter.docs').toArray().length; i++) {
                        slugs += documents.results[0].getGroup('docchapter.docs').toArray()[i].getLink('linktodoc').value.document.slug + ' ';
                    }
                    assert.equal(slugs.trim(), 'with-jquery with-bootstrap');
                    // Group fragments are serializable when asHtml is called directly on them
                    assert.equal(documents.results[0].getGroup('docchapter.docs').asHtml(getLinkResolver()),
                            '<section data-field=\"linktodoc\"><a href=\"/testing_url/UrDofwEAALAdpbNH/with-jquery\">/testing_url/UrDofwEAALAdpbNH/with-jquery</a></section>' +
                            '<section data-field=\"linktodoc\"><a href=\"/testing_url/UrDp8AEAAPUdpbNL/with-bootstrap\">/testing_url/UrDp8AEAAPUdpbNL/with-bootstrap</a></section>');
                    // Group fragments are serializable when as Html is called on a document
                    assert.equal(documents.results[0].asHtml(getLinkResolver()),
                            '<section data-field=\"docchapter.title\"><h1>Using with other projects</h1></section>' +
                            '<section data-field=\"docchapter.intro\"><p>As advertised, meta-micro knows how to stay out of the way of the rest of your application. Here are some cases of how to use it with some of the most used open-source projects in JavaScript.</p></section>' +
                            '<section data-field=\"docchapter.priority\"><span>500</span></section>' +
                            '<section data-field=\"docchapter.docs\">' +
                            '<section data-field=\"linktodoc\"><a href=\"/testing_url/UrDofwEAALAdpbNH/with-jquery\">/testing_url/UrDofwEAALAdpbNH/with-jquery</a></section>' +
                            '<section data-field=\"linktodoc\"><a href=\"/testing_url/UrDp8AEAAPUdpbNL/with-bootstrap">/testing_url/UrDp8AEAAPUdpbNL/with-bootstrap</a></section>' +
                            '</section>');
                    done();
                });
            });
        });

    });

}(window.Prismic));
