require.config({
  baseUrl:'../src/',
  paths:{

    // Core libs
    backbone:'libs/backbone/backbone',
    //bootstrap: "//cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.2.0/js/bootstrap.min", //
    //bootstrap: 'libs/bootstrap/dist/js/bootstrap',
    //Handlebars: "//cdnjs.cloudflare.com/ajax/libs/handlebars.js/2.0.0-alpha.4/handlebars.min", //
    Handlebars:'libs/handlebars/handlebars',
    jquery: "//cdnjs.cloudflare.com/ajax/libs/jquery/2.1.1/jquery.min", //'libs/jquery/dist/jquery',
    moment:'libs/moment/moment',
    underscore:"//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.6.0/underscore-min", //'libs/underscore/underscore',
  
    // Require libs
    //cs: "//cdnjs.cloudflare.com/ajax/libs/require-cs/0.4.2/cs",
    cs: 'libs/require-cs/cs',
    'coffee-script': 'libs/coffee-script/index',
    //text: "//cdnjs.cloudflare.com/ajax/libs/require-text/2.0.12/text",
    text:'libs/text/text',

    // Template Path
    tmpl:'../../templates',

    // Others
    //GMaps:"//cdnjs.cloudflare.com/ajax/libs/gmaps.js/0.4.12/gmaps.min", //
    GMaps:'libs/gmaps/gmaps',
    respond:'libs/respond/src/respond',
    dropzone:'libs/dropzone/downloads/dropzone',
    
    // jQuery Plugins
    
    fancybox:'libs/fancybox/source/jquery.fancybox',
    //fancybox:"//cdnjs.cloudflare.com/ajax/libs/fancybox/2.1.5/jquery.fancybox.pack",

    '$.fileupload':'libs/jquery-file-upload/js/jquery.fileupload',
    
    uniform:'libs/jquery.uniform/jquery.uniform',
    //uniform:"//cdnjs.cloudflare.com/ajax/libs/Uniform.js/2.1.2/jquery.uniform.min",
    
    '$.datatables':'libs/datatables/media/js/jquery.dataTables',
    
    mixitup:'libs/bower-mixitup/src/jquery.mixitup',
    //mixitup:"//cdnjs.cloudflare.com/ajax/libs/mixitup/1.5.6/jquery.mixitup.min",

    '$.multiselect':'libs/jquery-multiselect/jquery.multiselect',
    '$.easing':'libs/jquery.easing/js/jquery.easing',
    '$.flot':'libs/flot/jquery.flot',
    '$.pulsate':'libs/jquery.pulsate/jquery.pulsate',
    '$.select2':'libs/select2/select2',
    
    owl:'libs/owl-carousel/owl-carousel/owl.carousel',
    //owl:"//cdnjs.cloudflare.com/ajax/libs/owl-carousel/1.3.2/owl.carousel.min",
    
    '$.maxlength':'libs/bootstrap-maxlength/bootstrap-maxlength',
    '$.easypie':'libs/easypie/dist/jquery.easypiechart',
    '$.gritter':'libs/jquery.gritter/js/jquery.gritter',
    '$.toastr':'libs/toastr/toastr',
    '$.slimscroll':'libs/slimScroll/jquery.slimscroll',
    '$.ui':'libs/jquery-ui/jquery-ui',

    // Revolution slider
    '$.rs':'libs/slider-revolution-slider/rs-plugin/js/jquery.themepunch.plugins.min',
    '$.revolution':'libs/slider-revolution-slider/rs-plugin/js/jquery.themepunch.revolution',
    
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
    Handlebars:{
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