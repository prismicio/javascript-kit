var gulp = require('gulp'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    qunit = require('gulp-qunit'),
    jsdoc = require('gulp-jsdoc'),
    jshint = require('gulp-jshint'),
    map = require('vinyl-map'),
    https = require('https'),
    fs = require('fs'),
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

gulp.task('copy', ['test'], function() {
    gulp.src(SOURCES)
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

// TODO: "throw" doesn't give a good error message
// TODO: Move to a plugin to use it in other kits
gulp.task('deploy:gist', ['test:doc'], function () {

    // Remove indent from the left, aligning everything with the first line
    function leftAlign(lines) {
        if (lines.length == 0) return lines;
        var distance = lines[0].match(/^\s*/)[0].length;
        var result = [];
        lines.forEach(function(line){
            result.push(line.slice(Math.min(distance, line.match(/^\s*/)[0].length)));
        });
        return result;
    }

    function getUserHome() {
        return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
    }

    var pushgists = map(function(code, filename) {
        var lines = code.toString().split("\n");
        var gists = [];
        var currentGist = null;
        var lineNo = 0;
        lines.forEach(function(line) {
            if (line.indexOf("// startgist:") === 0) {
                console.log("startgist");
                if (currentGist) {
                    throw "L" + lineNo + ": Unexpected startgist: a previous gist was not closed";
                }
                currentGist = {
                    "id": line.split(":")[1].trim(),
                    "filename": line.split(":")[2].trim(),
                    "lines": []
                };
            } else if (line.indexOf("// endgist") === 0) {
                console.log("endgist");
                if (!currentGist) {
                    throw "L" + lineNo + ": Unexpected endgist: missing startgist earlier";
                }
                gists.push(currentGist);
                currentGist = null;
            } else if (currentGist) {
                currentGist.lines.push(line);
            }
        });
        if (currentGist) {
            throw "Reached end of file but gist is still open";
        }
        fs.readFile(getUserHome() + '/.gistauth', 'utf8', function (err, auth) {
            gists.forEach(function (gist) {
                console.log("Gist id = " + gist.id);
                console.log(leftAlign(gist.lines));
                var json = {
                    files: {}
                };
                json.files[gist.filename] = {
                    'content': leftAlign(gist.lines).join("\n")
                };
                console.log(json);
                var data = JSON.stringify(json);
                var req = https.request({
                    "host": "api.github.com",
                    "path": "/gists/" + gist.id,
                    "method": "PATCH",
                    "headers": {
                        'User-Agent': 'erwan',
                        'Authorization': 'Basic ' + new Buffer(auth).toString('base64'),
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': data.length
                    }
                }, function (res) {
                    console.log('STATUS: ' + res.statusCode);
                    console.log('HEADERS: ' + JSON.stringify(res.headers));
                    res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                        console.log('BODY: ' + chunk);
                    });
                });
                req.write(data);
                req.end();
            });
        });
    });

    gulp.src("./test/doc.js")
        .pipe(pushgists);
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
