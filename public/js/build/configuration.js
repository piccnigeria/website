require.config({
  baseUrl:'../src/',
  paths:{

    // Core libs
    backbone:'libs/backbone/backbone',
    handlebars: "//cdnjs.cloudflare.com/ajax/libs/handlebars.js/2.0.0-alpha.4/handlebars.min",
    jquery: "//cdnjs.cloudflare.com/ajax/libs/jquery/2.1.1/jquery.min", //'libs/jquery/dist/jquery',
    underscore:"//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.6.0/underscore-min", //'libs/underscore/underscore',
    moment:'libs/moment/moment',    
  
    // Require libs    
    cs: 'libs/require-cs/cs',
    'coffee-script': 'libs/coffee-script/index',    
    text:'libs/text/text',

    // Template Path
    tmpl:'../../templates',

    // Others
    GMaps:"//cdnjs.cloudflare.com/ajax/libs/gmaps.js/0.4.12/gmaps.min",
    //GMaps:'libs/gmaps/gmaps',
    respond:'libs/respond/src/respond',
    dropzone:'libs/dropzone/downloads/dropzone',
    
    // jQuery Plugins
    '$.fileupload':'libs/jquery-file-upload/js/jquery.fileupload',        
    '$.datatables':'libs/datatables/media/js/jquery.dataTables',    
    '$.multiselect':'libs/jquery-multiselect/jquery.multiselect',
    '$.easing':'libs/jquery.easing/js/jquery.easing',
    '$.flot':'libs/flot/jquery.flot',
    '$.pulsate':'libs/jquery.pulsate/jquery.pulsate',
    '$.select2':'libs/select2/select2',
    '$.maxlength':'libs/bootstrap-maxlength/bootstrap-maxlength',
    '$.easypie':'libs/easypie/dist/jquery.easypiechart',
    '$.gritter':'libs/jquery.gritter/js/jquery.gritter',
    '$.toastr':'libs/toastr/toastr',
    '$.slimscroll':'libs/slimScroll/jquery.slimscroll',
    '$.ui':'libs/jquery-ui/jquery-ui',    
    
    // Bootstrap/jQuery Plugins    
    '$.bootstrapWizard':'libs/twitter-bootstrap-wizard/jquery.bootstrap.wizard',
    '$.typeahead':'libs/typeahead/dist/typeahead.jquery',
    '$.wysihtml5':'libs/bootstrap-wysihtml5/dist/bootstrap-wysihtml5-0.0.2',
    
    // Test libs
    jasmine: 'libs/jasmine/lib/jasmine-core/jasmine',
    'jasmine-html': 'libs/jasmine/lib/jasmine-core/jasmine-html'
  },
  shim:{
    backbone:{
      deps:['underscore','jquery'],
      exports:'Backbone'
    },/*    
    Handlebars:{
      exports:'Handlebars'
    },    
    underscore:{
      exports:'_'
    },*/
    // Testing
    jasmine: {
      exports: 'jasmine'
    },
    'jasmine-html': {
      deps: ['jasmine'],
      exports: 'jasmine'
    }
  }
})