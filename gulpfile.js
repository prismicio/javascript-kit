var gulp = require('gulp'),
    gutil = require('gulp-util'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    qunit = require('gulp-qunit'),
    jsdoc = require('gulp-jsdoc'),
    jshint = require('gulp-jshint'),
    gist = require('gulp-gist'),
    deploy = require("gulp-gh-pages");

var SOURCES = ['src/api.js', 'src/fragments.js', 'src/predicates.js'];

var pkg = require('./package.json');

function string_src(filename, string) {
    var src = require('stream').Readable({ objectMode: true });
    src._read = function () {
        this.push(new gutil.File({ cwd: "", base: "", path: filename, contents: new Buffer(string) }));
        this.push(null)
    };
    return src
}

gulp.task('version', function () {
    return string_src("version.js", "Global.Prismic.version = '" + pkg.version + "';\n")
        .pipe(gulp.dest('src/'));
});

gulp.task('concat', ['version'], function() {
    gulp.src(SOURCES.concat('src/version.js'))
        .pipe(concat('prismic.io.js'))
        .pipe(gulp.dest('dist'))
});

gulp.task('minify', ['version'], function() {
    gulp.src(SOURCES.concat('src/version.js'))
        .pipe(concat('prismic.io.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('dist'))
});

gulp.task('copy', ['test', 'version'], function() {
    gulp.src(SOURCES.concat('src/version.js'))
        .pipe(concat('prismic.io-%VERSION%.min.js'.replace('%VERSION%', pkg.version)))
        .pipe(uglify())
        .pipe(gulp.dest('dist'))
});

gulp.task('doc', function() {
    gulp.src(SOURCES.concat(['README.md']))
        .pipe(jsdoc('doc'))
});

gulp.task('deploy:doc', ['doc'], function () {
    gulp.src("./doc/**/*")
        .pipe(deploy());
});

gulp.task('deploy:gist', ['test:doc'], function () {

    gulp.src("./test/doc.js")
        .pipe(gist());
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

gulp.task('test:doc', function() {
    return gulp.src('./test/doc.html')
        .pipe(qunit())
});

gulp.task('default', ['test']);

gulp.task('test', ['jshint', 'test:int', 'test:unit', 'test:doc']);

gulp.task('dist', ['doc', 'concat', 'minify', 'copy']);
