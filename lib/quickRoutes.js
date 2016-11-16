
var Kind = {
  Dynamic: 'dynamic',
  Static: 'static'
};

var Condition = {
  ID: 'withId',
  UID: 'withUid',
  Singleton: 'singleton'
};

function buildURL(fragments) {
  if(!fragments || fragments.length == 0) {
    return '/';
  } else {
    return fragments.reduce(function (acc, f) {
      switch(f.kind) {
      case Kind.Dynamic:
        return acc + '/:' + toKey(f.key);

      case Kind.Static:
        return acc + '/' + f.value;

      default:
        return acc;
      }
    }, '');
  }
}

function toKey(dotty) {
  return dotty.split('.').join('_');
}

function fetchData(req, res, fetchers) {
  return new Promise((resolve, reject) => {
    var pData = fetchers.map(function(f, index) {
      return fetcherAction(f, req)
        .then(function(doc) {
          return { name: f.name, doc: doc };
        })
        .catch(function(err) {
          reject(err);
        });
    });

    Promise.all(pData).then(function(results) {
      var data = {};
      results.forEach(function(result) {
        data[result.name] = result.doc;
      });
      resolve(data);
    });
  });
}

function fetcherAction(f, req) {
  switch(f.condition.kind) {
  case Condition.ID:
    return req.prismic.api.getByID(f.mask, req.params[toKey(f.condition.key)]);

  case Condition.UID:
    return req.prismic.api.getByUID(f.mask, req.params[toKey(f.condition.key)]);

  case Condition.Singleton:
    return req.prismic.api.getSingle(f.mask);

  default:
    return Promise.reject(new Error("Unknown fetcher condition: " + f.condition.kind));
  }
}



function buildReverseRouter(dynRoutes, linkResolver) {
  return function(doc) {
    var docRoute = dynRoutes.find(function(dr) {
      return dr.forMask === doc.type;
    });
    if(docRoute) return buildURL(docRoute.fragments);
    else return linkResolver(doc);
  };
}

module.exports = {
  buildURL: buildURL,
  buildReverseRouter: buildReverseRouter,
  fetchData: fetchData
};
