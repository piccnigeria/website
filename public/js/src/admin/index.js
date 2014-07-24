require(['backbone','cs!admin/router','cs!frontend/util'],function(Backbone,Router,util){
  Backbone.$.ajaxPrefilter(function(options, originalOptions, jqXhr) {
    options.url = util.settings.apiUrl + options.url;
  });
  Router.getInstance();
})