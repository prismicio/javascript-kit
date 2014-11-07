## JavaScript development kit for prismic.io

[![npm version](https://badge.fury.io/js/prismic.io.svg)](http://badge.fury.io/js/prismic.io)
[![Build Status](https://api.travis-ci.org/prismicio/javascript-kit.png)](https://travis-ci.org/prismicio/javascript-kit)
[![Code Climate](https://codeclimate.com/github/prismicio/javascript-kit.png)](https://codeclimate.com/github/prismicio/javascript-kit)

* The [source code](https://github.com/prismicio/javascript-kit) is on Github.
* The [Changelog](https://github.com/prismicio/javascript-kit/releases) is on Github's releases tab.

### Installation

You can install a stable version using __npm__:

```sh
npm install prismic.io
```

Or using __bower__:

```sh
bower install prismic.io
```

Finally, you can find downloadable versions of the kit on our release page: [https://github.com/prismicio/javascript-kit/releases](https://github.com/prismicio/javascript-kit/releases).

### Usage

If you don't have a Prismic.io repository yet, find out [how to get one](https://developers.prismic.io/documentation/UjBaQsuvzdIHvE4D/getting-started).

Once your repository is ready, you can use the Javascript kit server-side with Node.js, or client-side without needing and specific technology server-side. We provide various starter kits depending on your choice:

* [jQuery starter kit](https://github.com/prismicio/javascript-jquery-starter)
* [Node.js starter kit](https://github.com/prismicio/javascript-nodejs-starter)
* [Single page starter kit](https://github.com/prismicio/javascript-singlepage)
* [Static pages generation with baked.js](https://github.com/prismicio/baked.js)

We're working hard to keep all the starter kit up-to-date, but it's always a good idea to check on this page if you're on the
latest version of the kit. We're constantly adding new features to Prismic.io, and it is necessary to have the latest version
to use all of them.

You can then read the documentation from the [Developer's Portal](https://developers.prismic.io/) for more details on how to use

### Contribute to the kit

Contribution is open to all developer levels, read our "[Contribute to the official kits](https://developers.prismic.io/documentation/UszOeAEAANUlwFpp/contribute-to-the-official-kits)" documentation to learn more.

#### Install the kit locally

You can simply execute this JavaScript kit with a web browser, but before committing, we kindly ask you to run the ```gulp``` command (it will make sure all tests still pass, and concatenate/minify your changes).

To install gulp and other required packages: [install Node.js and npm](http://www.joyent.com/blog/installing-node-and-npm/), and then run this from your kit's repository, as an administrator:
```
npm install -g gulp
npm install
```

#### Test

Please write tests in [test/test.js](test/test.js) for any bugfix or new feature, following the [very simple QUnit syntax](http://qunitjs.com/), if you need to test with a real Prismic.io repository. Otherwise use [test/unit.js](test/unit.js) for unit testing features.

Execute the tests either by opening [test/test.html](test/test.html) or [test/unit.html](test/unit.html) in a browser, or by using Gulp:

* ```gulp jshint``` will run jshint to check for syntax errors or bad practice in the code
* ```gulp test``` will run jshint, all the tests and display the result on your shell
* ```gulp test:int``` will run all integration tests (the ones from [test/test.html](test/test.html))
* ```gulp test:unit``` will run all unit tests (the ones from [test/unit.html](test/unit.html))
* ```gulp test:doc``` will run all tests related to the code snippets from the documentation (the ones from [test/doc.html](test/doc.html))

If you find existing code that is not optimally tested and wish to make it better, we really appreciate it; but you should document it on its own branch and its own pull request.

#### Documentation

Please document any new feature or bugfix using the [JSDoc](http://usejsdoc.org/) syntax. You don't need to generate the documentation, we'll do that.

If you feel an existing area of code is lacking documentation, feel free to write it; but please do so on its own branch and pull-request.

If you find existing code that is not optimally documented and wish to make it better, we really appreciate it; but you should document it on its own branch and its own pull request.

### Licence

This software is licensed under the Apache 2 license, quoted below.

Copyright 2013-2014 Zengularity (http://www.zengularity.com).

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this project except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
