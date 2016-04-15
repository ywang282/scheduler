var autoprefixer    = require('gulp-autoprefixer');
var concat          = require('gulp-concat');
var cssnano         = require('gulp-cssnano');
var decomment       = require('gulp-strip-comments');
var del             = require('del');
var filter          = require('gulp-filter');
var gulp            = require('gulp');
var gulpif          = require('gulp-if');
var livereload      = require('gulp-livereload');
var plumber         = require('gulp-plumber');
var preprocess      = require('gulp-preprocess');
var replace         = require('gulp-replace');
var rev             = require('gulp-rev');
var revReplace      = require("gulp-rev-replace");
var runSequence     = require('run-sequence');
var sass            = require('gulp-sass');
var sourcemaps      = require('gulp-sourcemaps');
var streamqueue     = require('streamqueue');
var uglify          = require('gulp-uglify');
var watch           = require('gulp-watch');

//environment variable to be used by gulp-if plugin
// for build tasks.  determines whether minification tasks
// will run or not
var production;

//default task for production. creates dev build and 
//starts watches
gulp.task( 'default', [ 'build:dev', 'watch' ] );

// build task for production.  sets production variable
// to true which triggers conditionals that minify js, css,
// decomments html, and versions css and js references in 
// head and footer
gulp.task( 'build:prod', function(cb) {
  production = true;
  runSequence( 'clean', copyArray, 'style', 'script', 'header-footer-rev-replace' );
});

// build task for development. sets production variable to false
// which triggers conditional to creat sourcemaps for css but 
// does not minify, uglify or version css and js. 
gulp.task( 'build:dev', function(cb) {
  production = false;
  runSequence( 'clean', copyArray, 'style', 'script', 'header-footer-rev-replace' );
});

//task to run for creating alert-training dist version.
//updates alert proxy to point to dev machine. 
//run after build:prod task
gulp.task( 'alert-training', function() {
  return gulp.src( './dist/proxies/alertproxy.php' )
  .pipe(replace( 'status.uillinois.edu', 'status-dev.uillinois.edu' ))
  .pipe(gulp.dest( './dist/proxies'));
});

gulp.task('watch', function () {
  //production = false;
  livereload.listen();
  gulp.watch('./src/css/*.css', [ 'style' ] );
  gulp.watch('./src/js/*.js', [ 'scripts' ] );
  gulp.watch('./src/sass/**/*.scss', [ 'style' ] );
  gulp.watch('./shared_content/js/*.js', [ 'scripts' ] );
  gulp.watch('./shared_content/php/*', [ 'header-footer-rev-replace' ] );
  gulp.watch('./shared_content/php/*', [ 'header-footer-rev-replace' ] );
  gulp.watch('./shared_content/sass/**/*.scss', [ 'style' ] );
  gulp.watch('./src/php/*.php', [ 'header-footer-rev-replace' ]);
  gulp.watch('./src/preprocess/*.php', [ 'header-footer-rev-replace' ]);
  gulp.watch('./src/preprocess/*.php', [ 'header-footer-rev-replace' ]);
});

//tasks that copy necessary assets to dist directory
var copyArray = [ 
'copy:fonts', 
'copy:shared-images', 
'copy:src'
];

gulp.task( 'copy:fonts', function() {
  return gulp.src( './shared_content/bower_components/font-awesome/fonts/*' )
  .pipe(gulp.dest( './dist/assets/fonts' ));
});
gulp.task( 'copy:shared-images', function() {
  return gulp.src( './shared_content/assets/images/*' )
  .pipe(gulp.dest( './dist/assets/images' ));
});
gulp.task( 'copy:src', function() {
  return gulp.src( [ './src/static/**/*' ], { base: './src/static' } )
  .pipe(gulp.dest( './dist' ));
});


//clean:dist tasks deletes all contents of /dist 
//directory before build to prevent files 
//that have been deleted from  source directories 
//remaining in the dist directory
gulp.task( 'clean', function() {
  return del(['./dist/*', './unmin/*']);
});

// task stitches together php pages for dist; index, hours, and
// search.  if production variable is true this is
// when hashed versions of css and js filenames 
// replace unversioned filenames in php and html comments removed.  
gulp.task( 'header-footer-rev-replace', function() {
  if ( production === true ) {
    var manifest = gulp.src( './unmin/rev-manifest.json' );
  }
  return gulp.src( './src/php/*' )
  .pipe(preprocess(
    {context: 
        { 
          ENV_VAR: 'gateway', 
          SEARCH_ACTION: 'search.php',
          IMAGE_DIR: './assets/images/',
          DEBUG: true
        }
      }))
  .pipe(gulpif( production, decomment({ safe: true })))
  .pipe(gulpif( production, revReplace({ 
    manifest: manifest,
    replaceInExtensions: '.php'
    })))
  .pipe(gulp.dest( './dist'))
  .pipe( livereload() );
});

// style task queues two streams, first one is sass file, second
// is array of css.  sass file has sourcemaps inserted if
// production variable is false. the two are concatenated.
// depending on production variable the resulting file is
// minified and versioned and a manifest created. style task
// must be run prior to script in a build as this tasks
// rev.manifest will replace the existing manifest and scripts
// is set to merge. 
gulp.task( 'style', function() {
  return streamqueue( { objectMode: true }, 
    gulp.src( './src/sass/style.scss' )
    .pipe(plumber( { errorHandler: onError }))
    .pipe(gulpif( !production, sourcemaps.init()))
    .pipe(sass())
    .pipe(autoprefixer())
    .pipe(gulpif( !production, sourcemaps.write())),

    //fa-replace rewrites the file paths in the
    // font-awesome css file to refer to the correct
    // fonts path relative to wordpress style.css
    gulp.src( css_array )
  )
  .pipe(concat('style.css'))
  .pipe(gulp.dest( './unmin' ))
  .pipe(gulpif( production, cssnano()))
  .pipe(gulpif( production, rev()))
  .pipe(gulp.dest( './dist/assets/css'))
  .pipe(gulpif( production, rev.manifest()))
  .pipe(gulpif( production, gulp.dest('./unmin')))
  .pipe( livereload() );
});

// task to concat various javascript files. if production
// variable is true then files are uglified and versioned. 
// for versioning this task must be run after style as 
// the style task's manifest will replace existing manifest
// and this tasks's manifest will merge with existing manifest.
gulp.task( 'script', function() {
  return gulp.src( script_array )
  .pipe(concat( 'script.js'))
  .pipe(gulp.dest( './unmin' ))
  .pipe(gulpif( production, uglify()))
  .pipe(gulpif( production, rev()))
  .pipe(gulp.dest( './dist/assets/js' ))
  .pipe(gulpif( production, rev.manifest( './unmin/rev-manifest.json', {
    base: './unmin',
    merge: true 
  })))
  .pipe(gulpif( production, gulp.dest('./unmin')))
  .pipe( livereload() );
});


var script_array = [
  './src/js/utilities.js',
  './src/js/alert.js', 
  './shared_content/bower_components/bootstrap-sass/assets/javascripts/bootstrap.js',
  './src/js/bootstrap-accessibility.js',
  './src/js/jquery-ui.min.js',
  './src/js/off-canvas.js',
  './src/js/roomreserve.js',
  './src/js/hours.js',
  './src/js/bourbon-accordion-tabs.js',
  './src/js/orange_bar_scroll.js', 
  './src/js/jquery.fracs-0.15.0.min.js',
  './src/js/easy_search_text.js',
  './src/js/easy-search-form-select.js',
  './src/js/libguide-search.js',
  './src/js/news-events.js',
  './src/js/loan-tech.js',
  './src/js/accordion-tab-support.js',
  './src/js/global-access.js',
  './src/js/fix_emergency_alert.js',
  './src/js/hours_page.js'
  ];


var css_array = [
  //'./bower_components/normalize.css/normalize.css',
  './src/css/jquery-ui.min.css',
  './src/css/bootstrap-accessibility.css',
  './src/css/columnselect.css',
  './shared_content/bower_components/font-awesome/css/font-awesome.css',
  './src/css/fix_emergency_alert.css',
  './src/css/hours_page.css'
  ];

//error variable for plumber
var onError = function( err ) {
  console.log( 'An error occurred:', err.message );
  this.emit( 'end' );
};