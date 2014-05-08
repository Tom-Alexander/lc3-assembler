"use strict";

var tasks = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        watch: {
            files: ['src/*.js'],
            tasks: ['browserify']
        },

        browserify: {
            dist: {
                files: {
                    'dist/lc3-assembler.js': ['src/*.js']
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-browserify');

};

module.exports = tasks;