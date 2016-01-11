/*eslint-env es6 */

var gulp = require('gulp'),
    babel = require('babelify'),
    browserify = require('browserify'),
    uglify = require('gulp-uglify'),
    sourcemaps = require('gulp-sourcemaps'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer');

gulp.task('build', () => {
  browserify('lib/browser.js', {debug: true })
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

gulp.task('minify', () => {
  browserify('lib/browser.js', {debug: true })
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

gulp.task('default', ['build', 'minify']);
