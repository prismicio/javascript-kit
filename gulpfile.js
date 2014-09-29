var gulp = require('gulp'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    qunit = require('gulp-qunit'),
    jsdoc = require('gulp-jsdoc'),
    jshint = require('gulp-jshint'),
    deploy = require("gulp-gh-pages");

var SOURCES = ['src/api.js', 'src/fragments.js', 'src/predicates.js'];

var pkg = require('./package.json');

gulp.task('concat', function() {
    gulp.src(SOURCES)
        .pipe(concat('prismic.io.js'))
        .pipe(gulp.dest('dist'))
});

gulp.task('minify', function() {
    gulp.src(SOURCES)
        .pipe(concat('prismic.io.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('dist'))
});

gulp.task('copy', function() {
    gulp.src(SOURCES)
        .pipe(concat('prismic.io-%VERSION%.min.js'.replace('%VERSION%', pkg.version)))
        .pipe(uglify())
        .pipe(gulp.dest('dist'))
});

gulp.task('doc', function() {
    gulp.src(SOURCES.concat(['README.md']))
        .pipe(jsdoc('doc'))
});

gulp.task('deploy-doc', function () {
    gulp.src("./doc/**/*")
        .pipe(deploy());
});

gulp.task('jshint', function() {
    gulp.src(SOURCES)
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(jshint.reporter('fail'))
});

gulp.task('test:int', function() {
    return gulp.src('./test/test.html')
        .pipe(qunit())
});

gulp.task('test:unit', function() {
    return gulp.src('./test/unit.html')
               .pipe(qunit())
});

gulp.task('test', ['jshint', 'test:int', 'test:unit']);

gulp.task('default', ['doc', 'concat', 'minify']);

gulp.task('dist', ['default']);
