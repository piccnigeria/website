({  
  mainConfigFile:'configuration.js',
  name:'frontend/index',
  preserveLicenseComments: false,
  generateSourceMaps: true,
  out:'../script.min.js',
  include:'libs/requirejs/require.js',
  optimize:'uglify2'
})