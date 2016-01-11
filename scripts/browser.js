#!/usr/bin/env node

/*eslint-env es6 */

var fs = require("fs");
var browserify = require("browserify");

browserify("./lib/browser.js")
  .transform("babelify", {presets: ["es2015"]})
  .bundle()
  .pipe(fs.createWriteStream("dist/prismic.io.js"));
