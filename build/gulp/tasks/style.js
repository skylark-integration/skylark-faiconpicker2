var gulp = require('gulp'),
    util = require('../utils');

module.exports = function() {
    var p =  new Promise(function(resolve, reject) {
	    gulp.src(util.src + 'fonts/**//*.*')
    	    .pipe(gulp.dest(util.dest+'fonts/'))
    	    .on("end",resolve);

   	});
   	return p.then(function(){
	    return gulp.src(util.src + 'css/**//*.*')
    	    .pipe(gulp.dest(util.dest+'css/'));

   	});
};
