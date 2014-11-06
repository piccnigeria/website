({  
  mainConfigFile:'configuration.js',
  name:'admin/index',
  preserveLicenseComments: false,
  generateSourceMaps: true,
  out:'../admin/script.min.js',
  include:'libs/requirejs/require.js',
  optimize:'uglify2',
  stubModules: ['text', 'bar', 'cs'],
  exclude:['coffee-script'],
  paths:{  	
  	jquery:'empty:',
  	underscore:'empty:',
    handlebars:'empty:',
    GMaps:'empty:'
  }
})