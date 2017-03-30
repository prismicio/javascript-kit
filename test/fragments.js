/*eslint-env node, mocha */

var Prismic = require('../lib/prismic.js');
var chai = require('chai');

var assert = chai.assert,
    microRepository = 'https://micro.prismic.io/api',
    previewToken = 'MC5VcXBHWHdFQUFONDZrbWp4.77-9cDx6C3lgJu-_vXZafO-_vXPvv73vv73vv70777-9Ju-_ve-_vSLvv73vv73vv73vv70O77-977-9Me-_vQ';

function getLinkResolver(ref) {
  return function(doc, isBroken) {
    if (isBroken) return '#broken';
    return "/testing_url/" + doc.id + "/" + doc.slug + (ref ? ('?ref=' + ref) : '');
  };
}

describe('Document manipulation', function() {

  it('Render a document to Html', function () {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.form('everything').ref(Api.master()).submit().then(function (documents) {
        var first = documents.results[0];
        assert.isNotNull(first);
        first.asHtml(getLinkResolver());
      });
    });
  });

});

describe('Multiple fragment level global test', function() {

  it('getFirstImage in slice zone works', function (done) {
    var doc = Prismic.parseDoc({
      "id":"VQ_hV31Za5EAy02H",
      "uid":null,
      "type":"article",
      "href":"http://toto.wroom.dev/api/documents/search?ref=VQ_uWX1Za0oCy46m&q=%5B%5B%3Ad+%3D+at%28document.id%2C+%22VQ_hV31Za5EAy02H%22%29+%5D%5D",
      "tags":[],
      "slugs":["une-activite"],
      "linked_documents":[],
      "data":{
        "article":{
          "activities":{
            "type":"Group",
            "value":[{
              "title":{
                "type":"StructuredText",
                "value":[{
                  "type":"paragraph",
                  "text":"Une activité",
                  "spans":[]
                }]
              },
              "image":{
                "type":"Image",
                "value":{
                  "main":{
                    "url":"https://wroomdev.s3.amazonaws.com/toto/ce3f52b933c4934a13422e09ed0ff6ad03a29621_hsf_evilsquall.jpg",
                    "alt":"",
                    "copyright":"",
                    "dimensions":{"width":860,"height":640}
                  },
                  "views":{
                    "headline":{
                      "url":"https://wroomdev.s3.amazonaws.com/toto/5445d2dcd2b0c541b0406ca867ab3d07b309c944_hsf_evilsquall.jpg",
                      "alt":"",
                      "copyright":"",
                      "dimensions":{"width":570,"height":400}
                    }
                  }
                }
              },
              "body":{
                "type":"StructuredText",
                "value":[{
                  "type":"paragraph",
                  "text":"elle est bien",
                  "spans":[]
                }]
              }
            }]
          },
          "un_champ_texte":{
            "type":"Text",
            "value":"stuffgg"
          },
          "blocks":{
            "type":"SliceZone",
            "value":[{
              "type":"Slice",
              "slice_type": "features",
              "value":{
                "type":"Group",
                "value":[{
                  "illustration":{
                    "type":"Image",
                    "value":{
                      "main":{
                        "url":"https://wroomdev.s3.amazonaws.com/toto/db3775edb44f9818c54baa72bbfc8d3d6394b6ef_hsf_evilsquall_first_in_slice.jpg",
                        "alt":"",
                        "copyright":"",
                        "dimensions":{"width":4285,"height":709}
                      },
                      "views":{}
                    }
                  },
                  "title":{
                    "type":"Text",
                    "value":"c'est un bloc features"
                  }
                }]
              }
            },{
              "type":"Slice",
              "slice_type":"text",
              "value":{
                "type":"StructuredText",
                "value":[{
                  "type":"paragraph",
                  "text":"C'est un bloc content",
                  "spans":[]
                }]
              }
            }]
          }
        }
      }
    });
    var sliceSingleElem = Prismic.parseDoc({
      "id":"VQ_hV31Za5EAy02H",
      "uid":null,
      "type":"article",
      "href":"http://toto.wroom.dev/api/documents/search?ref=VQ_uWX1Za0oCy46m&q=%5B%5B%3Ad+%3D+at%28document.id%2C+%22VQ_hV31Za5EAy02H%22%29+%5D%5D",
      "tags":[],
      "slugs":["une-activite"],
      "linked_documents":[],
      "data":{
        "article":{
          "blocks":{
            "type":"SliceZone",
            "value":[{
              "type":"Slice",
              "slice_type": "features",
              "value": {
                "type":"Image",
                "value":{
                  "main":{
                    "url":"https://wroomdev.s3.amazonaws.com/toto/db3775edb44f9818c54baa72bbfc8d3d6394b6ef_hsf_evilsquall_slice_single.jpg",
                    "alt":"",
                    "copyright":"",
                    "dimensions":{"width":4285,"height":709}
                  },
                  "views":{}
                }
              }
            }]
          }
        }
      }
    });

    // Testing get First Image on doc level.
    assert.equal(doc.getFirstImage().getView('main').url, "https://wroomdev.s3.amazonaws.com/toto/ce3f52b933c4934a13422e09ed0ff6ad03a29621_hsf_evilsquall.jpg");


    // Testing get First Image on slice level.
    var slices = doc.getSliceZone('article.blocks');
    assert.equal(slices.getFirstImage().getView('main').url, "https://wroomdev.s3.amazonaws.com/toto/db3775edb44f9818c54baa72bbfc8d3d6394b6ef_hsf_evilsquall_first_in_slice.jpg");

    var slicesWithSingleElem = sliceSingleElem.getSliceZone('article.blocks');
    assert.equal(slicesWithSingleElem.getFirstImage().getView('main').url, "https://wroomdev.s3.amazonaws.com/toto/db3775edb44f9818c54baa72bbfc8d3d6394b6ef_hsf_evilsquall_slice_single.jpg");
    done();
  });

  it('getFirstTitle in slice zone works', function (done) {
    var doc = Prismic.parseDoc({
      "id":"VQ_hV31Za5EAy02H",
      "uid":null,
      "type":"article",
      "href":"http://toto.wroom.dev/api/documents/search?ref=VQ_uWX1Za0oCy46m&q=%5B%5B%3Ad+%3D+at%28document.id%2C+%22VQ_hV31Za5EAy02H%22%29+%5D%5D",
      "tags":[],
      "slugs":["une-activite"],
      "linked_documents":[],
      "data":{
        "article":{
          "blocks":{
            "type":"SliceZone",
            "value":[{
              "type":"Slice",
              "slice_type": "features",
              "value":{
                "type":"Group",
                "value":[{
                  "illustration":{
                    "type":"Image",
                    "value":{
                      "main":{
                        "url":"https://wroomdev.s3.amazonaws.com/toto/db3775edb44f9818c54baa72bbfc8d3d6394b6ef_hsf_evilsquall_first_in_slice.jpg",
                        "alt":"",
                        "copyright":"",
                        "dimensions":{"width":4285,"height":709}
                      },
                      "views":{}
                    }
                  },
                  "title":{
                    "type":"Text",
                    "value":"c'est un bloc features"
                  }
                }]
              }
            },{
              "type":"Slice",
              "slice_type":"text",
              "value":{
                "type":"StructuredText",
                "value":[{
                  type: "heading2",
                  text: "As seen by fine pastry as a field",
                  spans: []
                }, {
                  "type":"paragraph",
                  "text":"C'est un bloc content",
                  "spans":[]
                }]
              }
            }, {
              "type": "Slice",
              "slice_type": "ma-nouvelle-slice",
              "slice_label": null,
              "repeat": [
                {
                  "text": {
                    "type": "StructuredText",
                    "value": [
                      {
                        "type": "paragraph",
                        "text": "some text",
                        spans: []
                      }
                    ]
                  }
                }
              ],
              "non-repeat": {
                "text": {
                  "type": "StructuredText",
                  "value": [
                    {
                      "type": "heading2",
                      "text": "some other text",
                      spans: []
                    }
                  ]
                }
              }
            }]
          }
        }
      }
    });

    var sliceSingleElem = Prismic.parseDoc({
      "id":"VQ_hV31Za5EAy02H",
      "uid":null,
      "type":"article",
      "href":"http://toto.wroom.dev/api/documents/search?ref=VQ_uWX1Za0oCy46m&q=%5B%5B%3Ad+%3D+at%28document.id%2C+%22VQ_hV31Za5EAy02H%22%29+%5D%5D",
      "tags":[],
      "slugs":["une-activite"],
      "linked_documents":[],
      "data":{
        "article":{
          "blocks":{
            "type":"SliceZone",
            "value":[{
              "type":"Slice",
              "slice_type": "features",
              "value": {
                "type":"StructuredText",
                "value":[{
                  type: "heading2",
                  text: "As seen by fine pastry as a field",
                  spans: []
                }, {
                  "type":"paragraph",
                  "text":"C'est un bloc content",
                  "spans":[]
                }]
              }
            }]
          }
        }
      }
    });


    var sliceWithSingleComposite = Prismic.parseDoc({
      "id":"VQ_hV31Za5EAy02H",
      "uid":null,
      "type":"article",
      "href":"http://toto.wroom.dev/api/documents/search?ref=VQ_uWX1Za0oCy46m&q=%5B%5B%3Ad+%3D+at%28document.id%2C+%22VQ_hV31Za5EAy02H%22%29+%5D%5D",
      "tags":[],
      "slugs":["une-activite"],
      "linked_documents":[],
      "data":{
        "article":{
          "blocks":{
            "type":"SliceZone",
            "value":[{
              "type": "Slice",
              "slice_type": "ma-nouvelle-slice",
              "slice_label": null,
              "repeat": [
                {
                  "text": {
                    "type": "StructuredText",
                    "value": [
                      {
                        "type": "paragraph",
                        "text": "some text",
                        spans: []
                      }
                    ]
                  }
                }
              ],
              "non-repeat": {
                "text": {
                  "type": "StructuredText",
                  "value": [
                    {
                      "type": "heading2",
                      "text": "some other text",
                      spans: []
                    }
                  ]
                }
              }
            }]
          }
        }
      }
    });

    // Testing get First title on doc level.
    assert.equal(doc.getFirstTitle().text, "As seen by fine pastry as a field");

    var slices = doc.getSliceZone('article.blocks');
    assert.equal(slices.getFirstTitle().text, "As seen by fine pastry as a field");


    var slicesWithSingleElem = sliceSingleElem.getSliceZone('article.blocks');
    assert.equal(slicesWithSingleElem.getFirstTitle().text, "As seen by fine pastry as a field");

    var compositeSlice = sliceWithSingleComposite.getSliceZone('article.blocks');
    assert.equal(compositeSlice.getFirstTitle().text, "some other text");
    done();
  });


  it('getFirstParagraph in slice zone works', function (done) {
    var doc = Prismic.parseDoc({
      "id":"VQ_hV31Za5EAy02H",
      "uid":null,
      "type":"article",
      "href":"http://toto.wroom.dev/api/documents/search?ref=VQ_uWX1Za0oCy46m&q=%5B%5B%3Ad+%3D+at%28document.id%2C+%22VQ_hV31Za5EAy02H%22%29+%5D%5D",
      "tags":[],
      "slugs":["une-activite"],
      "linked_documents":[],
      "data":{
        "article":{
          "blocks":{
            "type":"SliceZone",
            "value":[{
              "type":"Slice",
              "slice_type": "features",
              "value":{
                "type":"Group",
                "value":[{
                  "illustration":{
                    "type":"Image",
                    "value":{
                      "main":{
                        "url":"https://wroomdev.s3.amazonaws.com/toto/db3775edb44f9818c54baa72bbfc8d3d6394b6ef_hsf_evilsquall_first_in_slice.jpg",
                        "alt":"",
                        "copyright":"",
                        "dimensions":{"width":4285,"height":709}
                      },
                      "views":{}
                    }
                  },
                  "title":{
                    "type":"Text",
                    "value":"c'est un bloc features"
                  }
                }]
              }
            },{
              "type":"Slice",
              "slice_type":"text",
              "value":{
                "type":"StructuredText",
                "value":[{
                  type: "heading2",
                  text: "As seen by fine pastry as a field",
                  spans: []
                }, {
                  "type":"paragraph",
                  "text":"C'est un bloc content",
                  "spans":[]
                }]
              }
            }]
          }
        }
      }
    });

    var sliceSingleElem = Prismic.parseDoc({
      "id":"VQ_hV31Za5EAy02H",
      "uid":null,
      "type":"article",
      "href":"http://toto.wroom.dev/api/documents/search?ref=VQ_uWX1Za0oCy46m&q=%5B%5B%3Ad+%3D+at%28document.id%2C+%22VQ_hV31Za5EAy02H%22%29+%5D%5D",
      "tags":[],
      "slugs":["une-activite"],
      "linked_documents":[],
      "data":{
        "article":{
          "blocks":{
            "type":"SliceZone",
            "value":[{
              "type":"Slice",
              "slice_type": "features",
              "value": {
                "type":"StructuredText",
                "value":[{
                  type: "heading2",
                  text: "As seen by fine pastry as a field",
                  spans: []
                }, {
                  "type":"paragraph",
                  "text":"C'est un bloc content",
                  "spans":[]
                }]
              }
            }]
          }
        }
      }
    });

    // Testing get First paragraph on doc level.
    assert.equal(doc.getFirstParagraph().text, "C'est un bloc content");

    var slices = doc.getSliceZone('article.blocks');
    assert.equal(slices.getFirstParagraph().text, "C'est un bloc content");
    var slicesWithSingleElem = sliceSingleElem.getSliceZone('article.blocks');
    assert.equal(slicesWithSingleElem.getFirstParagraph().text, "C'est un bloc content");
    done();
  });

});

describe('StructuredText', function() {

  it('asHtml handles embeds and lists', function () {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.getByID('WHx-gSYAAMkyXYX_').then(function (doc) {
        assert.equal(
          doc.getStructuredText('all.stext').asHtml(getLinkResolver()).slice(0, 100),
          '<p>normal <strong>b</strong> <em>i</em> <strong><em>bi</em></strong> <a href="http://prismic.io">lin'
        );
      });
    });
  });

  it('asText works', function () {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.getByID('WHx-gSYAAMkyXYX_').then(function (doc) {
        assert.equal(
          doc.getStructuredText('all.stext').asText().slice(0, 100),
          "normal b i bi linkweb linkdoc linkmedia preformatted h1 h2 h3 h4 h5 h6"
        );
      });
    });
  });
/*
  it('asHtml handles preformatted', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UrDejAEAAFwMyrW9")]]').ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(
          documents.results[0].getStructuredText('doc.content').asHtml(getLinkResolver()),
          '<p>Meta-micro gets installed pretty much like any javascript library:</p><ol><li><a href=\"/testing_url/U0w8OwEAACoAQEvB/download-meta-micro\">download</a> the .js file: get the minified one, unless the framework you\'re using minifies your .js files automatically.</li><li>add a link towards the file in your webpage\'s head.</li></ol><p>The link might look like this, anywhere inside your head tag:</p><pre>&lt;script type=\"text/javascript\" src=\"meta-micro.min.js\"&gt;&lt;/script&gt;</pre><p>You\'re all set!</p>'
        );
        done();
      });
    });
  });

  it('Test backward-compatibility with passing a ctx instead of just a linkResolver', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UrDejAEAAFwMyrW9")]]').ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(
          documents.results[0].getStructuredText('doc.content').asHtml({
            api: undefined,
            ref: { ref: 'XXXXX', label: 'Future release', isMaster: false },
            maybeRef: 'XXXXX',
            oauth: function () {},
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
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbt")]]').ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results[0].getStructuredText('blog-post.body').asHtml(), '<h1>The end of a chapter the beginning of a new one</h1><p class="block-img"><img src="https://prismic-io.s3.amazonaws.com/lesbonneschoses/8181933ff2f5032daff7d732e33a3beb6f57e09f.jpg" alt=\"\"></p><p>Jean-Michel Pastranova, the founder of <em>Les Bonnes Choses</em>, and creator of the whole concept of modern fine pastry, has decided to step down as the CEO and the Director of Workshops of <em>Les Bonnes Choses</em>, to focus on other projects, among which his now best-selling pastry cook books, but also to take on a primary role in a culinary television show to be announced later this year.</p><p>"I believe I\'ve taken the <em>Les Bonnes Choses</em> concept as far as it can go. <em>Les Bonnes Choses</em> is already an entity that is driven by its people, thanks to a strong internal culture, so I don\'t feel like they need me as much as they used to. I\'m sure they are greater ways to come, to innovate in pastry, and I\'m sure <em>Les Bonnes Choses</em>\'s coming innovation will be even more mind-blowing than if I had stayed longer."</p><p>He will remain as a senior advisor to the board, and to the workshop artists, as his daughter Selena, who has been working with him for several years, will fulfill the CEO role from now on.</p><p>"My father was able not only to create a revolutionary concept, but also a company culture that puts everyone in charge of driving the company\'s innovation and quality. That gives us years, maybe decades of revolutionary ideas to come, and there\'s still a long, wonderful path to walk in the fine pastry world."</p>');
        done();
      });
    }, previewToken);
  });

  it('asHtml handles span Link.web', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbW")]]').ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results[0].getStructuredText('job-offer.profile').asHtml(), '<p>As a company whose marketing is very content-centric, we expect our Content Director to have a tremendous experience, both in content strategy, and in content writing. We expect our applicants to show off some of the content strategies they set up themselves, explaining their choices, and to provide amazing contents they personally wrote.</p><p>Our contents get flexibly powerfully shared on various supports: our site, our in-store printed magazine, our mobile apps, our mailings ... Our Content Director must have experience with all of those, and with using modern adaptive content managers such as <a href=\"http://prismic.io\">prismic.io</a>.</p>');
        done();
      });
    }, previewToken);
  });

  it('asHtml handles span Link.document', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbl")]]').ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results[0].getStructuredText('blog-post.body').asHtml(getLinkResolver('XXXXX')), '<h1>Our world-famous Pastry Art Brainstorm event</h1><p class=\"block-img\"><img src=\"https://prismic-io.s3.amazonaws.com/lesbonneschoses/c38f9e5a1a6c43aa7aae516c154013a2cee2bc75.jpg\" alt=\"\"></p><p>Each year, <em>Les Bonnes Choses</em> organizes a world-famous two-day event called the \"Pastry Art Brainstorm\", and which is the perfect excuse for every fine pastry artist in the world to exercise their art, and build their skills up. The event is a multiple win-win operation, at many levels: see what the event is, as seen by many point of views.</p><h2>As seen by the top pastry artists worldwide</h2><p>The event always starts with half a day of conference talks, given by the most insightful pastry artists in the world, selected for having made tremendous achievements in pastry that year. The list of invited guest speakers is decided jointly by the <em>Les Bonnes Choses</em> staff and the Fine Pastry Magazine editors.</p><p>This is great for the speakers, who get an occasion to share their work, and have people build up on it with them.</p><h2>As seen by the pastry professionals</h2><p>After half a day of thoughtful conference, the professionals will get to put what they learned to good use, and mingle with the best artists worldwide to make the most daring pastries together. There are no set rules about who does what during this giant innovation workshop, and many crazy ideas get created out of thin air. As a virtually infinite amount of ingredients is provided by the <em>Les Bonnes Choses</em> staff, many unexpected pastries happen on that day, and professionals taste each other\'s creations, and provide relevant feedback to each other. Most pieces get showcased to the amateur audience as well, who get invited to taste some of the pieces.</p><p>At noon on the second day, teams are expected to subscribe to our Pastry Art Challenge, during which they will make the best possible pastry,  judged on many aspects (originality, taste, looks, ...) by a jury of amateurs and professionals. The team members of the three winning pieces share a substantial prize, and their pastries may even join the Les Bonnes Choses catalogue, and be offered in all the <em>Les Bonnes Choses</em> shops worldwide!</p><h2>As seen by the pastry amateurs</h2><p>The conference is limited with a reasonable fee; but the showcase is open to everyone, although visitors are often expected to pay the pastry chefs for the pastries they taste. The educated amateurs spend their day tasting the most daring pieces, giving some appreciated feedback to their chefs, and challenging their own tastebuds. The novice amateurs usually get a once-in-a-lifetime experience, and often mention being blown away by how rich the fine pastry art can be. All in all, every one goes home with a smile on their faces!</p><h2>As seen by the Les Bonnes Choses interns</h2><p>Every year, we recruit a very limited amount of interns, who get aboard a <a href=\"/testing_url/UlfoxUnM0wkXYXbu/les-bonnes-chosess-internship-a-testimony?ref=XXXXX\">life-defining adventure around fine pastries</a>, discovering <em>Les Bonnes Choses</em> during half a year, with part of this time spent in one of our shops abroad. We always manage to get them on board at a time when we know they will be able to attend a Fine Pastry Brainstorm, because we consider it is a very defining element in the experience of being part of <em>Les Bonnes Choses</em>.</p><p>Not only do we invite them to the event (whatever the country they are stationed in when the event happens), but we give them a front-row seat! They are part of the jury for the Fine Pastry Challenge, they are introduced to every speaker as the next generation of pastry (thus having the occasion to learn even more, directly from them).</p><h2>As seen by fine pastry as a field</h2><p>There wasn\'t really an international occasion for pastry artists to join and share, before <em>Les Bonnes Choses</em> came up with the first Fine Pastry Brainstorm, in 2006. Fine Pastry Magazine\'s first edition was out in 2004, and initiated the idea that pastry art needed to be shared better between professionals. But a proper event to meet up in person was missing, and <em>Les Bonnes Choses</em> is proud to be the one to have come up with it first.</p><p>Since then, more local initiatives have been started (notably in Argentina, and Canada), but none comes close to the size of <em>Les Bonnes Choses</em>\'s international Fine Pastry Brainstorm.</p><h2>As seen by <em>Les Bonnes Choses</em></h2><p>As the almost only sponsor of every edition of the event, <em>Les Bonnes Choses</em> makes sure enough ingredients are available for everyone, rents the premises, makes sure the speakers are as comfortable as possible, and takes care of the whole organization! But through the operation, <em>Les Bonnes Choses</em> gains much more than any sponsoring can buy: not only does it get to secure <em>Les Bonnes Choses</em> as the world reference in pastry arts, but it also allows them to claim rightfully that they do offer in their shops the best pastries, created by the world top artists indeed.</p>');
        done();
      });
    }, previewToken);
  });

  it('asHtml with custom serializer', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbl")]]').ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        var htmlSerializer = function (element, content) {
          if (element.type == "image") {
            return '<img src="' + element.url + '" alt="' + (element.alt || "") + '">';
          }

          if (element.type == "hyperlink") {
            return '<a class="some-link" href="' + element.url + '">' + content + '</a>';
          }

          return null;
        };
        assert.equal(
          documents.results[0].getStructuredText('blog-post.body').asHtml(getLinkResolver(), htmlSerializer),
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
            '<p>As the almost only sponsor of every edition of the event, <em>Les Bonnes Choses</em> makes sure enough ingredients are available for everyone, rents the premises, makes sure the speakers are as comfortable as possible, and takes care of the whole organization! But through the operation, <em>Les Bonnes Choses</em> gains much more than any sponsoring can buy: not only does it get to secure <em>Les Bonnes Choses</em> as the world reference in pastry arts, but it also allows them to claim rightfully that they do offer in their shops the best pastries, created by the world top artists indeed.</p>'
        );
        done();
      });
    }, previewToken);
  });

  it('getFirstImage works', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UlfoxUnM0wkXYXbl")]]').ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
        assert.equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().url, "https://prismic-io.s3.amazonaws.com/lesbonneschoses/c38f9e5a1a6c43aa7aae516c154013a2cee2bc75.jpg");
        assert.equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().alt, null);
        assert.equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().height, 427);
        assert.equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().width, 640);
        assert.equal(documents.results[0].getStructuredText('blog-post.body').getFirstImage().asHtml(),
          '<img src="https://prismic-io.s3.amazonaws.com/lesbonneschoses/c38f9e5a1a6c43aa7aae516c154013a2cee2bc75.jpg" width="640" height="427" alt="">');
        done();
      });
    }, previewToken);
  });
*/
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

  // it('Handles multiple fields', function () {
  //   return Prismic.api(microRepository, previewToken).then(function (Api) {
  //     return Api.getByID('WHx-gSYAAMkyXYX_').then(function (doc) {
  //       assert.equal(doc.getAll('all.slices.link_document')[0].asHtml(getLinkResolver()), '<a href="/testing_url/UlfoxUnM0wkXYXbm/tips-to-dress-a-pastry">/testing_url/UlfoxUnM0wkXYXbm/tips-to-dress-a-pastry</a>');
  //       done();
  //     });
  //   });
  // });

  it('ImageViews are well retrieved', function () {
    return Prismic.api(microRepository, previewToken).then(function (Api) {
      return Api.getByID('WHx-gSYAAMkyXYX_').then(function (doc) {
        assert.equal(doc.getImageView('all.image', 'main').asHtml(), '<img src="https://prismic-io.s3.amazonaws.com/micro/e185bb021862c2c03a96bea92e170830908c39a3_thermometer.png" width="600" height="600" alt="" copyright="">');
        assert.equal(doc.getImageView('all.image', 'small').asHtml(), '<img src="https://prismic-io.s3.amazonaws.com/micro/5f4a19be1fd2edeaf7bc8123a3d67ee87a8446ef_thermometer.png" width="128" height="128" alt="" copyright="">');
      });
    });
  });

  it('GeoPoint is retrieved', function () {
    return Prismic.api(microRepository).then(function (Api) {
      return Api.getByID('WHx-gSYAAMkyXYX_').then(function (doc) {
        var html = '<div class="geopoint"><span class="latitude">48.87369154037622</span><span class="longitude">2.3618245124816895</span></div>';
        assert.equal(doc.getGeoPoint('all.geopoint').asHtml(), html);
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
    var doc = Prismic.parseDoc(json);
    var date = doc.getDate("blog-post.date");
    assert.equal(date.getFullYear(), 2013);
    var ts = doc.getTimestamp("blog-post.timestamp");
    assert.equal(ts.getFullYear(), 2014);
  });

  it('Block fragments are accessible, loopable, and serializable', function (done) {
    Prismic.api(microRepository, function (err, Api) {
      if (err) { done(err); return; }
      Api.form('everything').query('[[:d = at(document.id, "UrDndQEAALQMyrXF")]]').ref(Api.master()).submit(function (err, documents) {
        if (err) { done(err); return; }
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

  it('Slices correctly parsed and serializable', function () {
    var doc = Prismic.parseDoc({
      "id":"VQ_hV31Za5EAy02H",
      "uid":null,
      "type":"article",
      "href":"http://toto.wroom.dev/api/documents/search?ref=VQ_uWX1Za0oCy46m&q=%5B%5B%3Ad+%3D+at%28document.id%2C+%22VQ_hV31Za5EAy02H%22%29+%5D%5D",
      "tags":[],
      "slugs":["une-activite"],
      "linked_documents":[],
      "data":{
        "article":{
          "activities":{
            "type":"Group",
            "value":[{
              "title":{
                "type":"StructuredText",
                "value":[{
                  "type":"paragraph",
                  "text":"Une activité",
                  "spans":[]
                }]
              },
              "image":{
                "type":"Image",
                "value":{
                  "main":{
                    "url":"https://wroomdev.s3.amazonaws.com/toto/ce3f52b933c4934a13422e09ed0ff6ad03a29621_hsf_evilsquall.jpg",
                    "alt":"",
                    "copyright":"",
                    "dimensions":{"width":860,"height":640}
                  },
                  "views":{
                    "headline":{
                      "url":"https://wroomdev.s3.amazonaws.com/toto/5445d2dcd2b0c541b0406ca867ab3d07b309c944_hsf_evilsquall.jpg",
                      "alt":"",
                      "copyright":"",
                      "dimensions":{"width":570,"height":400}
                    }
                  }
                }
              },
              "body":{
                "type":"StructuredText",
                "value":[{
                  "type":"paragraph",
                  "text":"elle est bien",
                  "spans":[]
                }]
              }
            }]
          },
          "un_champ_texte":{
            "type":"Text",
            "value":"stuffgg"
          },
          "blocks":{
            "type":"SliceZone",
            "value":[{
              "type":"Slice",
              "slice_type": "features",
              "value":{
                "type":"Group",
                "value":[{
                  "illustration":{
                    "type":"Image",
                    "value":{
                      "main":{
                        "url":"https://wroomdev.s3.amazonaws.com/toto/db3775edb44f9818c54baa72bbfc8d3d6394b6ef_hsf_evilsquall.jpg",
                        "alt":"",
                        "copyright":"",
                        "dimensions":{"width":4285,"height":709}
                      },
                      "views":{}
                    }
                  },
                  "title":{
                    "type":"Text",
                    "value":"c'est un bloc features"
                  }
                }]
              }
            },{
              "type":"Slice",
              "slice_type":"text",
              "value":{
                "type":"StructuredText",
                "value":[{
                  "type":"paragraph",
                  "text":"C'est un bloc content",
                  "spans":[]
                }]
              }
            }, {
              "type": "Slice",
              "slice_type": "ma-nouvelle-slice",
              "slice_label": null,
              "repeat": [
                {
                  "text": {
                    "type": "StructuredText",
                    "value": [
                      {
                        "type": "paragraph",
                        "text": "C'est du repeat",
                        spans: []
                      }
                    ]
                  }
                }
              ],
              "non-repeat": {
                "text": {
                  "type": "StructuredText",
                  "value": [
                    {
                      "type": "heading2",
                      "text": "C'est du non repeat",
                      spans: []
                    }
                  ]
                }
              }
            }]
          }
        }
      }
    });
    var slices = doc.getSliceZone('article.blocks');
    assert.equal(slices.asText(getLinkResolver()), "c'est un bloc features\n\nC'est un bloc content\nC\'est du non repeat\nC\'est du repeat\n\n");
    assert.equal(slices.asHtml(getLinkResolver()), '<div data-slicetype="features" class="slice"><section data-field="illustration"><img src="https://wroomdev.s3.amazonaws.com/toto/db3775edb44f9818c54baa72bbfc8d3d6394b6ef_hsf_evilsquall.jpg" width="4285" height="709" alt="" copyright=""></section><section data-field="title"><span>c\'est un bloc features</span></section></div><div data-slicetype="text" class="slice"><p>C\'est un bloc content</p></div><div data-slicetype="ma-nouvelle-slice" class="slice"><h2>C\'est du non repeat</h2><section data-field="text"><p>C\'est du repeat</p></section></div>');
  });


  it('Slices correctly handle document links when rendering as text', function () {
    var doc = Prismic.parseDoc({
      "id":"VQ_hV31Za5EAy02H",
      "uid":null,
      "type":"article",
      "href":"http://toto.wroom.dev/api/documents/search?ref=VQ_uWX1Za0oCy46m&q=%5B%5B%3Ad+%3D+at%28document.id%2C+%22VQ_hV31Za5EAy02H%22%29+%5D%5D",
      "tags":[],
      "slugs":["une-activite"],
      "linked_documents":[],
      "data":{
        "article":{
          "blocks":{
            "type":"SliceZone",
            "value":[{
              "type":"Slice",
              "slice_type": "link",
              "value":{
                "type":"Link.document",
                "value": {
                  "document": {
                    "id": "UrDejAEAAFwMyrW9",
                    "type": "doc",
                    "tags": [],
                    "slug": "installing-meta-micro"
                  },
                  "isBroken": false
                }
              }
            },{
              "type":"Slice",
              "slice_type":"text",
              "value":{
                "type":"StructuredText",
                "value":[{
                  "type":"paragraph",
                  "text":"C'est un bloc content",
                  "spans":[]
                }]
              }
            }]
          }
        }
      }
    });
    var slices = doc.getSliceZone('article.blocks');
    assert.equal(slices.asText(getLinkResolver()), "/testing_url/UrDejAEAAFwMyrW9/installing-meta-micro\nC'est un bloc content\n");
  });

  it('Number correctly null content when rendering as text', function () {
    var doc = Prismic.parseDoc({
      "id":"VQ_hV31Za5EAy02H",
      "uid":null,
      "type":"article",
      "href":"http://toto.wroom.dev/api/documents/search?ref=VQ_uWX1Za0oCy46m&q=%5B%5B%3Ad+%3D+at%28document.id%2C+%22VQ_hV31Za5EAy02H%22%29+%5D%5D",
      "tags":[],
      "slugs":["une-activite"],
      "linked_documents":[],
      "data":{
        "article":{
          "number":{
            "type":"Number",
            "value":null
          }
        }
      }
    });
    assert.equal(doc.asText(getLinkResolver()), "");
  });
});
