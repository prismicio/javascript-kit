module.exports = function(grunt) {

  /**
   * To bump:
   *  * you need to be on the master branch and have a clean working tree
   *  * edit changelog.md with what is new
   *  * run `grunt`
   *  * run `grunt bump` / if doesn't work:
   *    * change version number in package.json, bower.json, and README.md
   *    * git commit -am "Release vx.x.x"
   *    * git tag x.x.x
   *  * run `grunt copy`, or if it doesn't work, `cp dist/prismic.io.min.js dist/prismic.io-x.x.x.min.js`
   *  * run `git add . && git commit -m "Freezing minified file on the master branch"`
   *  * run `git push prismicio master --tags`
   *  * update on npm and bower
   */

  grunt.initConfig({

    VERSION: grunt.file.readJSON('bower.json').version,
    pkg: grunt.file.readJSON('package.json'),

    qunit: {
      files: ['test/**/*.html']
    },
    
    clean: {
      src: ['dist/prismic.io.js','dist/prismic.io.min.js']
    },

    concat: {
      dist: {
        src: ['src/api.js', 'src/fragments.js'],
        dest: 'dist/prismic.io.js'
      }
    },
    
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= VERSION %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
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

  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-bump');

  // Default task.
  grunt.registerTask('default', ['qunit', 'clean', 'concat', 'uglify']);

  // bump task to increment version numbers in bower.json and package.json, and create a git tag. Remember to push your tag if you want a release available on bower.
  grunt.registerTask('bump', ['bump']);

  // copying the minified file to freeze it as this version on the master (can not be done before bump)
  grunt.registerTask('copy', ['copy']);

};