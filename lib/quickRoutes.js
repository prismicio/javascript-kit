
var Kind = {
  Dynamic: 'dynamic',
  Static: 'static'
};

var Condition = {
  ID: 'withId',
  UID: 'withUid',
  Singleton: 'singleton'
};

function toUrl(route, doc) {
  if(!route.fragments || route.fragments.length == 0) {
    return '/';
  } else {
    return route.fragments.reduce(function (acc, f) {
      switch(f.kind) {
      case Kind.Dynamic:
        if (doc)
          return acc + '/' + getFragmentValue(f, doc);
        else
          return acc + '/:' + toKey(f.key);

      case Kind.Static:
        return acc + '/' + f.value;

      default:
        return acc;
      }
    }, '');
  }
}

function getFragmentValue(fragment, doc) {
  var steps = fragment.key.split('.');
  if (steps[0] == doc.type) {
    switch(steps[1]) {
    case 'uid':
      return doc.uid;
    case 'id':
      return doc.id;
    default:
      throw Error("Unsupported dynamic fragment: " + fragment);
    }
  } else {
    throw Error("Wrong doc type error: got " + doc.type + ", expected " + steps[0]);
  }
}


function toKey(dotty) {
  return dotty.split('.').join('_');
}

function fetchData(req, res, fetchers) {
  return new Promise(function(resolve, reject) {
    var pData = fetchers.map(function(f) {
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



function makeLinkResolver(dynRoutes, linkResolver) {
  return function(doc) {
    var docRoute = dynRoutes.find(function(dr) {
      return dr.forMask === doc.type;
    });
    if(docRoute) return toUrl(docRoute, doc);
    else return linkResolver(doc);
  };
}

module.exports = {
  toUrl: toUrl,
  makeLinkResolver: makeLinkResolver,
  fetchData: fetchData
};
