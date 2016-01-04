var gulp = require('gulp'),
    gutil = require('gulp-util'),
    babel = require('babelify'),
    browserify = require('browserify'),
    uglify = require('gulp-uglify'),
    mocha = require('gulp-mocha-phantomjs'),
    jsdoc = require('gulp-jsdoc'),
    jshint = require('gulp-jshint'),
    gist = require('gulp-gist'),
    sourcemaps = require('gulp-sourcemaps'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    deploy = require("gulp-gh-pages");

var pkg = require('./package.json');

function string_src(filename, string) {
    var src = require('stream').Readable({ objectMode: true });
    src._read = function () {
        this.push(new gutil.File({ cwd: "", base: "", path: filename, contents: new Buffer(string) }));
        this.push(null);
    };
    return src;
}

/**
 * Build
 */

gulp.task('version', function () {
    return string_src("version.js", "(function (Global, undefined) {" +
        "Global.Prismic.version = '" + pkg.version + "';" +
        "}(typeof exports === 'object' && exports ? exports : (typeof module === 'object' && module && typeof module.exports === 'object' ? module.exports : window)));\n")
        .pipe(gulp.dest('src/'));
});

gulp.task('build', function () {
  browserify('src/api.js', {debug: true })
    .transform(babel, {presets: ["es2015"]})
    .bundle()
    .on('error', function(err) {
      console.log(err.message);
      process.exit(1);
    })
    .pipe(source('./prismic.io.js'))
    .pipe(buffer())
    .pipe(gulp.dest('./dist'));
});

gulp.task('minify', function() {
  browserify('src/api.js', {debug: true })
    .transform(babel, {presets: ["es2015"]})
    .bundle()
    .on('error', function(err) {
      console.log(err.message);
      process.exit(1);
    })
    .pipe(source('./prismic.io.min.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true})) // loads map from browserify file
    .pipe(uglify())
    .pipe(sourcemaps.write('./')) // writes .map file
    .pipe(gulp.dest('./dist'));
});

gulp.task('doc', ['build'], function() {
    return gulp.src('./dist/prismic.io.js')
        .pipe(jsdoc('doc'));
});

gulp.task('deploy:doc', ['doc'], function () {
    return gulp.src("./doc/**/*")
        .pipe(deploy());
});

gulp.task('deploy:gist', ['test:doc'], function (cb) {
    return gulp.src("./test/doc.js")
        .pipe(gist());
});

gulp.task('dist', ['build', 'minify']);

/**
 * Tests
 */

var mocha_options = {
    timeout: 30000
};

gulp.task('jshint', function() {
    return gulp.src(SOURCES)
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(jshint.reporter('fail'));
});

gulp.task('test:int', ['build'], function() {
    return gulp.src('./test/test.js')
        .pipe(mocha(mocha_options));
});

gulp.task('test:unit', ['build'], function() {
    return gulp.src('./test/unit.js')
        .pipe(mocha(mocha_options));
});

gulp.task('test:fragments', ['build'], function() {
    return gulp.src('./test/fragments.js')
        .pipe(mocha(mocha_options));
});

gulp.task('test:doc', ['build'], function() {
    return gulp.src('./test/doc.js')
        .pipe(mocha(mocha_options));
});


gulp.task('test', ['test:int', 'test:unit', 'test:doc', 'test:fragments']);

/**
 * Default task
 */

gulp.task('default', ['test']);

