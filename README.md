## JavaScript development kit for prismic.io

[![npm version](https://badge.fury.io/js/prismic.io.svg)](http://badge.fury.io/js/prismic.io)
[![Build Status](https://api.travis-ci.org/prismicio/javascript-kit.png)](https://travis-ci.org/prismicio/javascript-kit)
[![Code Climate](https://codeclimate.com/github/prismicio/javascript-kit.png)](https://codeclimate.com/github/prismicio/javascript-kit)
[![Test Coverage](https://codeclimate.com/github/prismicio/javascript-kit/badges/coverage.svg)](https://codeclimate.com/github/prismicio/javascript-kit/coverage)

* The [source code](https://github.com/prismicio/javascript-kit) is on Github.
* The [Changelog](https://github.com/prismicio/javascript-kit/releases) is on Github's releases tab.

### Installation

#### NPM

```sh
npm install prismic.io --save
```

#### CDN

```
https://unpkg.com/prismic.io/dist/prismic.io.min.js
```

(You may need to adapt the version number)

#### Downloadable version

On our release page: [https://github.com/prismicio/javascript-kit/releases](https://github.com/prismicio/javascript-kit/releases).

The kit is universal, it can be used:

* Server-side with NodeJS
* Client-side as part of your build with Browserify, Webpack (you need a [Promise polyfill](https://github.com/jakearchibald/es6-promise) to support IE11 and below)
* Client-side with a simple script tag

### Starter kits

For new project, you can start from a sample project:

* [Node.js project](https://github.com/prismicio/nodejs-sdk)
* [Node.js blog](https://github.com/prismicio/nodejs-blog)

### Usage

To fetch documents from your repository, you need to fetch the Api data first.

```javascript
var Prismic = require('prismic.io');

Prismic.api("http://your_repository_name.prismic.io/api", function(error, api) {
  var options = {}; // In Node.js, pass the request as 'req' to read the reference from the cookies
  api.query("", options, function(error, response) { // An empty query will return all the documents
    if (error) {
      console.log("Something went wrong: ", err);
    }
    console.log("Documents: ", response.documents);
  });
});
```

All asynchronous calls return ES2015 promises, so alternatively you can use them instead of callbacks.

```javascript
var Prismic = require('prismic.io');

Prismic.api("https://lesbonneschoses.prismic.io/api").then(function(api) {
  return api.query(""); // An empty query will return all the documents
}).then(function(response) {
  console.log("Documents: ", response.results);
}, function(err) {
  console.log("Something went wrong: ", err);
});
```

See the [developer documentation](https://prismic.io/docs) or the [API documentation](http://prismicio.github.io/javascript-kit/) for more details on how to use it.

### Contribute to the kit

Contribution is open to all developer levels, read our "[Contribute to the official kits](https://developers.prismic.io/documentation/UszOeAEAANUlwFpp/contribute-to-the-official-kits)" documentation to learn more.

#### Install the kit locally

Source files are in the `lib/` directory. You only need [Node.js and npm](http://www.joyent.com/blog/installing-node-and-npm/)
to work on the codebase.

```
npm install
npm test
```

#### Documentation

Please document any new feature or bugfix using the [JSDoc](http://usejsdoc.org/) syntax. You don't need to generate the documentation, we'll do that.

If you feel an existing area of code is lacking documentation, feel free to write it; but please do so on its own branch and pull-request.

If you find existing code that is not optimally documented and wish to make it better, we really appreciate it; but you should document it on its own branch and its own pull request.

### License

This software is licensed under the Apache 2 license, quoted below.

Copyright 2013-2016 Zengularity (http://www.zengularity.com).

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this project except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
