define [
  'jquery'
  'underscore'
  'backbone'
  'cs!frontend/templates'
  'cs!frontend/models'
  'cs!frontend/collections'
  'cs!frontend/util'
  'cs!frontend/ready'  
  'GMaps'
  ], ($, _, Backbone, templates, models, collections, util, ready, GMaps) ->

  router = null

  scrollToTop = -> $("body,html").animate scrollTop: 0, 800
  
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
    afterInit: ->
      if @title? 
        window.title = util.settings.siteTitle + " - " + @title
  
  Views.SubViews.Slider = Views.Base.extend
    template: templates.slider
    className: "page-slider margin-bottom-40"
    init: -> $("#main").before @$el

  Views.SubViews.FooterSubscriptionBox = Backbone.View.extend
    el: '.pre-footer-subscribe-box'
    initialize: ->
      @model = new models.Subscriber
      @model.on "error invalid", @alert, @
    events:
      "submit form":"submit"
    submit: (ev) ->
      ev.preventDefault()
      @model.create @serialize(ev.currentTarget), =>
        alert "You are now subscribed to our newsletter"
        @model.clear()
        ev.currentTarget.reset()
    alert: -> alert @model.xhrError or @model.validationError

  Views.SubViews.MenuSearch = Backbone.View.extend
    el: "li.menu-search"
    initialize: ->
      @$btn = @$ '.search-btn'
      @$box = @$ '.search-box'
      # unless @$btn.size() is 0
      # $('body').on 'click', @hide, @

    events:
      "click .search-btn":"reveal"
      # "click": (ev) -> ev.stopImmediatePropagation()
      "submit form":"submit"

    hide: ->
      if @$btn.hasClass("show-search-icon")
        @$btn.removeClass "show-search-icon"
        @$box.fadeOut 300

    reveal: (ev) ->
      ev.stopImmediatePropagation()
      if @$btn.hasClass("show-search-icon")
        if $(window).width() > 767
          @$box.fadeOut 300
        else
          @$box.fadeOut 0
        @$btn.removeClass "show-search-icon"
      else
        if $(window).width() > 767
          @$box.fadeIn 300
        else
          @$box.fadeIn 0
        @$btn.addClass "show-search-icon"
    
    submit: (ev) ->
      ev.preventDefault()
      @model.create @serialize ev.currentTarget
        
  Views.Infographics = Views.Page.extend
    title: "Infographics"
    template: templates.infographics
    init: ->
      @collection = new collections.Infographics
    onAttached: ->
      @$(".fancybox-fast-view").fancybox()      
      @$(".fancybox-button").fancybox
        groupAttr: "data-rel"
        prevEffect: "none"
        nextEffect: "none"
        helpers:
          title:
            type: "inside"
      #@$(".mix-grid").mixItUp()

  Views.Index = Views.Page.extend
    title: "Home"
    template: templates.index
    init: ->
      @slider = new Views.SubViews.Slider
    onRendered: -> @slider.trigger "attached"
    onAttached: ->
      # initializes the partners' logos scroller
      @$(".owl-carousel6-brands").owlCarousel
        pagination: false
        navigation: true
        items: 4
        addClassActive: true
        itemsCustom: [
          [0,1]
          [320,1]
          [480,2]
          [700,3]
          [975,4]
          [1200,4]
          [1400,4]
          [1600,4]
        ]

      # initializes the infographics' images scroller
      @$(".owl-carousel3").owlCarousel
        pagination: false
        navigation: true
        items: 3
        addClassActive: true
        itemsCustom: [
          [0,1]
          [320,1]
          [480,2]
          [700,3]
          [768,2]
          [1024,3]
          [1200,3]
          [1400,3]
          [1600,3]
        ]
      
      @$(".fancybox-fast-view").fancybox()
      @$(".fancybox-button").fancybox
        groupAttr: "data-rel"
        prevEffect: "none"
        nextEffect: "none"
        helpers:
          title:
            type: "inside"

    remove: ->
      @slider.remove()
      @$el.remove()

  Views.Static = Views.Page.extend
    init: (options) ->      
      @template = templates[options.page]
      switch options.page
        when 'faqs'
          @title = "Frequently Asked Questions"
        when 'terms'
          @title = "Our Terms of Service"
        when 'policy'
          @title = "Our Privacy Policy"
        when 'about'
          @title = "About Us"

  Views.CaseMaps = Views.Page.extend
    title: "Case Maps"
    template: templates.case_maps
    init: ->
      @collection = new collections.Cases
    onAttached: ->
      map = new GMaps
        div: "#map"
        lat: -13.004333
        lng: -38.494333
      map.addMarker
        lat: -13.004333
        lng: -38.494333
        title: "A sample case title"
        infoWindow:
          content: "<b>A sample case title</b> At Federal High Court, Lagos"
      
  Views.Case = Views.Page.extend
    template: templates.case_
    isModelView: true
    init: ->
      @title = @model.get 'title'

  Views.Cases = Views.Page.extend
    title: 'Corruption Cases'
    template: templates.cases
    isCollectionView: true
    init: ->
      @collection = new collections.Cases
    events: 
      "click .cases a[data-nav]":"show_case"
    show_case: (ev) ->
      model = @collection.get ev.currentTarget.id
      router.appView.render new Views.Case model: model

  Views.BlogPost = Views.Page.extend
    template: templates.blog_post
    isModelView: true
    init: ->
      @title = @model.get 'title'

  Views.BlogIndex = Views.Page.extend
    title: 'PICC Blog'
    template: templates.blog
    isCollectionView: true
    init: ->
      @collection = new collections.BlogPosts
    events:
      "click .posts a[data-nav]":"show_blog_post"
    show_blog_post: (ev) ->
      model = @collection.get ev.currentTarget.id
      router.appView.render new Views.BlogPost model: model

  Views.Contact = Views.Page.extend
    title: "Contact Us"
    template: templates.contact
    init: ->
      @model = new models.Feedback
      @model.on "invalid error", @alert, @      
    alert: ->
      alert @model.validationError or @model.xhrError
    onAttached: ->      
      map = new GMaps
        div: "#map"
        lat: 6.504098
        lng: 3.377853
      marker = map.addMarker
        lat: 6.504098
        lng: 3.377853
        title: "PICC Nigeria"
        infoWindow:
          content: "<b>PICC Nigeria</b><br>Co-Creation Hub<br>294 Herbert Macaulay Way, Yaba<br>Lagos, Nigeria"
      marker.infoWindow.open map, marker
    events: 
      "submit form": "submit"
    submit: (ev) ->
      ev.preventDefault()
      @model.create @serialize(ev.currentTarget), ->
        alert "Message sent! We'll get back to you shortly."
        ev.currentTarget.reset()

  Backbone.View.extend
    el: "#main"
    initialize: (options) ->
      router = options.router
      ready.initResponsive()
      ready.initScrollToTop()
      new Views.SubViews.MenuSearch
      new Views.SubViews.FooterSubscriptionBox
      util.loadScript 'twitter-wjs', 'platform.twitter.com/widgets.js'
    
    render: (view)->
      @view?.remove()
      @view = view
      @$el.html view.el
      @view.trigger "attached"
      scrollToTop()

    renderIndex: -> @render new Views.Index

    renderCaseMaps: -> @render new Views.CaseMaps
    
    renderCases: (case_id) ->
      unless case_id? then @render new Views.Cases
      else @render new Views.Case case_id: case_id

    renderStatic: (page="about") -> @render new Views.Static page: page

    renderBlog: (post) ->
      if post? then @render new Views.BlogPost
      else @render new Views.BlogIndex

    renderInfographics: -> @render new Views.Infographics

    renderContact: -> @render new Views.Contact