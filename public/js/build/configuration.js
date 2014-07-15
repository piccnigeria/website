require.config({
  baseUrl:'../src/',
  paths:{

    // Core libs
    backbone:'libs/backbone/backbone',
    bootstrap: 'libs/bootstrap/dist/js/bootstrap',
    handlebars:'libs/handlebars/handlebars',
    jquery:'libs/jquery/dist/jquery',
    moment:'libs/moment/moment',
    underscore:'libs/underscore/underscore',

    // Require libs
    cs: 'libs/require-cs/cs',
    'coffee-script': 'libs/coffee-script/index',
    text:'libs/text/text',

    // Template Path
    tmpl:'../../templates',

    // Others
    GMaps:'libs/gmaps/gmaps',
    respond:'libs/respond/src/respond',
    dropzone:'libs/dropzone/downloads/dropzone',
    
    // jQuery Plugins
    '$.fancybox':'libs/fancybox/source/jquery.fancybox',    
    '$.uniform':'libs/jquery.uniform/jquery.uniform',    
    '$.datatables':'libs/datatables/media/js/jquery.dataTables',
    '$.mixitup':'libs/bower-mixitup/src/jquery.mixitup',
    '$.multiselect':'libs/jquery-multiselect/jquery.multiselect',
    '$.fileupload':'libs/jquery-file-upload/js/jquery.fileupload',
    '$.easing':'libs/jquery.easing/js/jquery.easing',
    '$.flot':'libs/flot/jquery.flot',
    '$.pulsate':'libs/pulsate/jquery.pulsate',
    '$.select2':'libs/select2/select2',
    '$.owlcarousel':'libs/owl-carousel/owl-carousel/owl.carousel',
    
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
    },    
    handlebars:{
      exports:'Handlebars'
    },    
    underscore:{
      exports:'_'
    },

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