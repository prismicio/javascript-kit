
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
  console.log("buildURL");
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

function mergeJson(obj, part) {
  var res = Object.assign({}, obj);
  Object.keys(part).forEach(function (key) {
    return res[key] = part[key];
  });
  return res;
}

function fetchData(req, res, fetchers) {
  return new Promise((resolve, reject) => {
    var pData = fetchers.map(function(f, index) {
      return fetcherAction(f, req)
        .then(function(doc) {
          var obj = {};
          obj[f.name] = doc;
          return obj;
        })
        .catch(function(err) {
          reject(err);
        });
    });

    Promise.all(pData).then(function(results) {
      resolve(results.reduce(function(acc, res) {
        return mergeJson(acc, res);
      }, {}));
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
