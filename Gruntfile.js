module.exports = function(grunt) {

  grunt.initConfig({

    VERSION: grunt.file.readJSON('bower.json').version,

    pkg: grunt.file.readJSON('package.json'),

    qunit: {
      files: ['test/**/*.html']
    },
    
    clean: {
      src: ['dist']
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
        dest: 'dist/prismic.io-<%= VERSION %>.min.js'
      }
    },

    bump: {
      options: {
          files: ['package.json', 'bower.json'],
          updateConfigs: [],
          commit: false,
          commitMessage: 'Release v%VERSION%',
          commitFiles: ['-a'], // '-a' for all files
          createTag: true,
          tagName: 'v%VERSION%',
          tagMessage: 'Version %VERSION%',
          push: false,
          pushTo: 'upstream',
          gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d' // options to use with '$ git describe'
      }
    }

  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-bump');

  // Default task.
  grunt.registerTask('default', ['qunit', 'clean', 'concat', 'uglify']);

  //bump task to increment version numbers in bower.json and package.json, and create a git tag. Remember to push your tag if you want a release available on bower.
  grunt.registerTask('bump', ['bump']);

};