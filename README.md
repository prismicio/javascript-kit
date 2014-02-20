## JavaScript development kit for prismic.io

### Getting started

#### Install the kit

You can find the minified latest (unstable) version of the library at:

```
https://raw.github.com/prismicio/javascript-kit/master/dist/prismic.io-1.0.9.min.js
```

You can install a stable version using __npm__:

```sh
npm install prismic.io
```

Or using __bower__:

```sh
bower install prismic.io
```


#### Get started with prismic.io

You can find out [how to get started with prismic.io](https://developers.prismic.io/documentation/UjBaQsuvzdIHvE4D/getting-started) on our [prismic.io developer's portal](https://developers.prismic.io/).

#### Get started using the kit

Also on our [prismic.io developer's portal](https://developers.prismic.io/), on top of our full documentation, you will:
 * get a thorough introduction of [how to use prismic.io kits](https://developers.prismic.io/documentation/UjBe8bGIJ3EKtgBZ/api-documentation#kits-and-helpers), including this one.
 * see [what else is available for Javascript](https://developers.prismic.io/technologies/UjBh28uvzeMJvE4i/javascript): starter projects, examples, ...

 You can also browse the [full documentation of the JS development kit](http://prismicio.github.io/javascript-kit/) (there is currently a known [issue](#10) about it)

### Changelog

Need to see what changed, or to upgrade your kit? We keep our changelog on [this repository's "Releases" tab](https://github.com/prismicio/javascript-kit/releases).

### Contribute to the kit

Contribution is open to all developer levels, read our "[Contribute to the official kits](https://developers.prismic.io/documentation/UszOeAEAANUlwFpp/contribute-to-the-official-kits)" documentation to learn more.

#### Install the kit locally

You can simply execute this JavaScript kit with a web browser, but before committing, we kindly ask you to run the ```grunt``` command (it will make sure all tests still pass, and concatenate/minify your changes).

To install grunt and other required packages: [install Node.js and npm](http://www.joyent.com/blog/installing-node-and-npm/), and then run this from your kit's repository, as an administrator:
```
npm install -g grunt
npm install
```

#### Test

Please write tests in [test/test.js](test/test.js) for any bugfix or new feature, following the [very simple QUnit syntax](http://qunitjs.com/).

Execute the tests either by opening [test/test.html](test/test.html) in a browser, or by running ```grunt qunit```.

If you find existing code that is not optimally tested and wish to make it better, we really appreciate it; but you should document it on its own branch and its own pull request.

#### Documentation

Please document any new feature or bugfix using the [JSDoc](http://usejsdoc.org/) syntax. You don't need to generate the documentation, we'll do that.

If you feel an existing area of code is lacking documentation, feel free to write it; but please do so on its own branch and pull-request.

If you find existing code that is not optimally documented and wish to make it better, we really appreciate it; but you should document it on its own branch and its own pull request.

### Licence

This software is licensed under the Apache 2 license, quoted below.

Copyright 2013 Zengularity (http://www.zengularity.com).

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this project except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
