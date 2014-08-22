define ['cs!admin/plugins','underscore','backbone','cs!admin/templates','cs!frontend/models','cs!frontend/collections','cs!frontend/util'], ($, _, Backbone, templates, models, collections, util) ->
  
  _.extend Backbone.View::,
    serialize: (form) ->
      data = $(form).serializeArray()
      keys = _.pluck data, "name"
      values = _.pluck data, "value"
      _.object keys, values  

  Views = 
    SubViews: {}
    Modal: Backbone.View.extend
    Base: Backbone.View.extend
      initialize: (options) ->
        @on("attached", @onAttached, @) if @onAttached?
        @on("detached", @onDetached, @) if @onDetached?
        @on("rendered", @onRendered, @) if @onRendered?
        @beforeInit?()
        @init?(options)
        @collection.on("reset add remove", @render, @) if @isCollectionView?
        @model.on("change", @render, @) if @isModelView?
        @render()
      data: ->
        @collection?.toJSON() or @model?.toJSON() or {}
      render: ->
        @$el.html @template @data()
        @trigger "rendered"
        @  

  Views.Page = Views.Base.extend
    className: "container"
    beforeInit: ->
      if @title? 
        window.title = util.settings.siteTitle + " - " + @title
    
  Views.Index = Views.Page.extend
    title: "Home"
    template: templates.index
    init: ->
        
  Views.Case = Views.Page.extend
    template: templates.case_    

  Views.Cases = Views.Page.extend
    title: 'Cases'
    template: templates.cases
    init: ->
      @collection = new collections.Cases
    
  Backbone.View.extend
    el: "body"
    initialize: ->
    render: (view)->
      @view?.remove()
      @view = view
      @$el.html view.el
      @view.trigger "attached"

    renderIndex: ->
      @render new Views.Index

    renderDashboard: ->
      @render new Views.Index
        
    renderCases: ->
      @render new Views.Cases

    renderCase: (case_id) ->
      @render new Views.Case case_id: case_id

    renderStatic: (page) ->
      @render new Views.Static page: page
    
    renderInfographics: ->
      @render new Views.Infographics    