module.exports = function(grunt) {

  grunt.initConfig({

    VERSION: '1.0.1',

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
    }

  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // Default task.
  grunt.registerTask('default', ['qunit', 'clean', 'concat', 'uglify']);

};