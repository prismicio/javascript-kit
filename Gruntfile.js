module.exports = function(grunt) {

  /**
   * Ideally, someday, it would be good to bump like that:
   * > grunt
   * > grunt bump
   * > grunt copy
   * > git push prismicio master --tags
   * But grunt bump doesn't quite work, so for now:
   * * change version number in package.json, bower.json, and README.md
   * * run `grunt`
   * * run `cp dist/prismic.io.min.js dist/prismic.io-x.x.x.min.js` to freeze the right minified version
   * * run `git add .` then `git commit -m "Release vx.x.x"` and finally `git tag x.x.x`
   * * run `git push https://github.com/prismicio/javascript-kit.git master --tags`
   * Once you're done, update npm and bower, and update the release's description if needed
   */

  grunt.initConfig({

    VERSION: grunt.file.readJSON('bower.json').version,
    pkg: grunt.file.readJSON('package.json'),

    qunit: {
      local: ['./test/**/*.html'],
      int: { options: { urls: ['http://localhost:8888/test/test.html'] }},
      unit: { options: { urls: ['http://localhost:8888/test/unit.html'] }}
    },

    clean: {
      src: ['dist/prismic.io.js','dist/prismic.io.min.js', 'doc']
    },

    concat: {
      dist: {
        src: ['src/api.js', 'src/fragments.js'],
        dest: 'dist/prismic.io.js'
      }
    },

    uglify: {
      options: {
        banner: '/*!\n * <%= pkg.name %> <%= VERSION %>\n * See release notes: https://github.com/prismicio/javascript-kit/releases\n */\n'
      },
      build: {
        src: 'dist/prismic.io.js',
        dest: 'dist/prismic.io.min.js'
      }
    },

    copy: {
      main: {
        src: 'dist/prismic.io.min.js',
        dest: 'dist/prismic.io-<%= VERSION %>.min.js'
      }
    },

    bump: {
      options: {
          files: ['package.json', 'bower.json', 'README.md'],
          updateConfigs: [],
          commit: false,
          commitMessage: 'Release v%VERSION%',
          commitFiles: ['-a'], // '-a' for all files
          createTag: true,
          tagName: '%VERSION%',
          tagMessage: 'Version %VERSION%',
          push: false,
          pushTo: 'upstream',
          gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d' // options to use with '$ git describe'
      }
    },

    jsdoc : {
        dist : {
            src: ['src/*.js', 'README.md'],
            options: {
                destination: 'doc'
            }
        }
    },

    connect: {
      options: {
        hostname: 'localhost',
        port: 8888,
        base: '.',
      },
      testAuto: {},
      test: {
        options: {
          keepalive: true
        }
      }
    }

  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-bump');
  grunt.loadNpmTasks('grunt-jsdoc');

  // Default task.
  grunt.registerTask('default', ['qunit', 'clean', 'concat', 'uglify']);

  // bump task to increment version numbers in bower.json and package.json, and create a git tag. Remember to push your tag if you want a release available on bower.
  grunt.registerTask('bump', ['bump']);

  // copying the minified file to freeze it as this version on the master (can not be done before bump)
  grunt.registerTask('copy', ['copy']);

  // Launch a local test server and run the tests on it
  // or keep the server running so you can debug on your browser
  grunt.registerTask('test', ['connect:testAuto', 'qunit:int', 'qunit:unit']);

  grunt.registerTask('test:local', ['qunit:local']);
  grunt.registerTask('test:int', ['connect:testAuto', 'qunit:int']);
  grunt.registerTask('test:unit', ['connect:testAuto', 'qunit:unit']);
  grunt.registerTask('test:browser', ['connect:test']);

};
