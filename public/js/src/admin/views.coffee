define ['jquery','underscore','backbone','cs!admin/templates','cs!frontend/models','cs!frontend/collections','cs!frontend/util'], ($, _, Backbone, templates, models, collections, util) ->
  
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
        @afterInit?()
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
    title: "PICC | Admin Dashboard"
    template: templates.index
    init: ->

  Views.Auth = Views.Page.extend
    title: "PICC | Admin Login"
    template: templates.auth
    init: ->
    events:
      'click #register-btn':'showRegistrationForm'
      'click #forget-btn':'showForgetForm'
      'click #register-back-btn,#back-btn':'showLoginForm'
      'keypress form input':'onEnterSubmit'
      'submit form[name="login-form"]':'login'
      'submit form[name="register-form"]':'register'
      'submit form[name="forget-form"]':'forget'
    
    showRegistrationForm: ->
      @$('.login-form').hide()
      @$('.register-form').show()

    showForgetForm: ->
      @$('.login-form').hide()
      @$('.forget-form').show()

    showLoginForm: ->
      @$('.register-form,.forget-form').hide()
      @$('.login-form').show()

    onEnterSubmit: (ev) ->
      if ev.which is 13
        if @$('form:visible').validate().form()
          @$('form:visible').submit() #form validation success, call ajax form submit
        return false

    login: (ev) ->
      ev.preventDefault()
      console.log @serialize ev.currentTarget

    register: (ev) ->
      ev.preventDefault()
      console.log @serialize ev.currentTarget

    forget: (ev) ->
      ev.preventDefault()
      console.log @serialize ev.currentTarget
    
  Backbone.View.extend
    el: "body > div"
    initialize: ->
    render: (view)->
      @view?.remove()
      @view = view
      @$el.html view.el
      @view.trigger "attached"

    renderIndex: ->
      @render new Views.Auth

    renderDashboard: ->
      @render new Views.Index