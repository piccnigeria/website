({  
  mainConfigFile:'configuration.js',
  name:'frontend/index',
  preserveLicenseComments: false,
  generateSourceMaps: true,
  out:'../script.min.js',
  // include:'libs/requirejs/require.js',
  optimize:'uglify2',
  paths:{
  	/*  	
  	cs:'empty:',
  	text:'empty:',
  	Handlebars:'empty:',
  	*/
  	jquery:'empty:',
  	underscore:'empty:'
  	/*bootstrap:'empty:',
  	GMaps:'empty:',
  	owl:'empty:',
  	uniform:'empty:',
  	fancybox:'empty:',
  	mixitup:'empty:'*/
  }
})