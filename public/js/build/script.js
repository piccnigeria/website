({  
  stubModules: ['text', 'bar', 'cs'],
  mainConfigFile:'configuration.js',
  name:'frontend/index',
  exclude:['coffee-script'],
  preserveLicenseComments: false,
  generateSourceMaps: true,
  out:'../script.min.js',  
  optimize:'uglify2',
  paths:{  	
  	jquery:'empty:',
  	underscore:'empty:',
    handlebars:'empty:',
    GMaps:'empty:'
  }
})