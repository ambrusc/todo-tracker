module.exports = function(grunt) {
 
  grunt.registerTask('watch', [ 'watch' ]);
  grunt.registerTask('build', [ 'coffee:build', 'sass:build', 'jade:build' ]);
 
  grunt.initConfig({
    coffee: {
      build: {
        expand: true,
        // flatten: true,
        cwd: './',
        src: ['**/*.coffee'],
        dest: './',
        ext: '.js'
      }
    },
    jade: {
      build: {
        expand: true,
        // flatten: true,
        cwd: './',
        src: ['**/*.jade'],
        dest: './',
        ext: '.html'
      }
    },
    sass: {
      build: {
        expand: true,
        // flatten: true,
        cwd: './',
        src: ['**/*.sass'],
        dest: './',
        ext: '.css'
      }
    },
    watch: {
      web: {
        files: ['*.html', '*.css', '*.js'],
        options: {
          livereload: true,
        }
      },
      coffee: {
        files: ['**/*.coffee'],
        tasks: ['coffee:build']
      },
      jade: {
        files: ['**/*.jade'],
        tasks: ['jade:build']
      },
      sass: {
        files: ['**/*.sass'],
        tasks: ['sass:build']
      }
    }
  });
 
  grunt.loadNpmTasks('grunt-contrib-coffee');
  grunt.loadNpmTasks('grunt-contrib-jade');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');
 
};
