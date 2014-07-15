# TODO: 
# bower install GMaps, or include it in main page 
# 
define ['cs!frontend/plugins','underscore','backbone','cs!frontend/templates','cs!frontend/models','cs!frontend/collections','cs!frontend/util','cs!frontend/ready','GMaps'], ($, _, Backbone, templates, models, collections, util, ready, GMaps) ->

  _.extend Backbone.View::,
    serialize: (form) ->
      data = $(form).serializeArray()
      keys = _.pluck data, "name"
      values = _.pluck data, "value"
      _.object keys, values

  Views = 

    SubViews: {}
    
    Base: Backbone.View.extend
      initialize: (options) ->
        @on("rendered", @onRendered, @) if @onRendered?
        @on("attached", @onAttached, @) if @onAttached?
        @on("detached", @onDetached, @) if @onDetached?
        @beforeInit?()
        @init?(options)
        @render()
      data: ->
        @collection?.toJSON() or @model?.toJSON() or {}
      render: ->
        @$el.html @template @data()
        @trigger "rendered"
        @

    Modal: Backbone.View.extend

  Views.Page = Views.Base.extend
    className: "container"
    beforeInit: ->
      if @title? 
        window.title = util.settings.siteTitle + " - " + @title
  
  Views.SubViews.Slider = Views.Base.extend
    template: templates.slider
    className: "page-slider margin-bottom-40"
    init: -> $("#main").before @$el
    onAttached: ->
      @$(".fullwidthbanner").revolution
        delay: 2000
        startheight: 417
        startwidth: 1150
        hideThumbs: 10
        thumbWidth: 100 # Thumb With and Height and Amount (only if navigation Tyope set to thumb !)
        thumbHeight: 50
        thumbAmount: 5
        navigationType: "bullet" # bullet, thumb, none
        navigationArrows: "solo" # nexttobullets, solo (old name verticalcentered), none
        navigationStyle: "round" # round,square,navbar,round-old,square-old,navbar-old, or any from the list in the docu (choose between 50+ different item), custom
        navigationHAlign: "center" # Vertical Align top,center,bottom
        navigationVAlign: "bottom" # Horizontal Align left,center,right
        navigationHOffset: 0
        navigationVOffset: 20
        soloArrowLeftHalign: "left"
        soloArrowLeftValign: "center"
        soloArrowLeftHOffset: 20
        soloArrowLeftVOffset: 0
        soloArrowRightHalign: "right"
        soloArrowRightValign: "center"
        soloArrowRightHOffset: 20
        soloArrowRightVOffset: 0
        touchenabled: "on" # Enable Swipe Function : on/off
        onHoverStop: "on" # Stop Banner Timet at Hover on Slide on/off
        stopAtSlide: -1
        stopAfterLoops: -1
        hideCaptionAtLimit: 0 # It Defines if a caption should be shown under a Screen Resolution ( Basod on The Width of Browser)
        hideAllCaptionAtLilmit: 0 # Hide all The Captions if Width of Browser is less then this value
        hideSliderAtLimit: 0 # Hide the whole slider, and stop also functions if Width of Browser is less than this value
        shadow: 1 #0 = no Shadow, 1,2,3 = 3 Different Art of Shadows  (No Shadow in Fullwidth Version !)
        fullWidth: "on" # Turns On or Off the Fullwidth Image Centering in FullWidth Modus

  Views.SubViews.FooterSubscriptionBox = Backbone.View.extend
    el: '.pre-footer-subscribe-box'
    initialize: ->
      @model = new models.Subscriber
      # @model.on "error"
      # @model.on "invalid"
      # @model.on "sync"
    
    events:
      "submit form":"submit"
    
    submit: (ev) ->
      ev.preventDefault()
      @model.create @serialize ev.currentTarget

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
      if @$(".fancybox-button").size() > 0
        @$(".fancybox-button").fancybox
          groupAttr: "data-rel"
          prevEffect: "none"
          nextEffect: "none"
          closeBtn: true
          helpers:
            title:
              type: "inside"
      @$(".mix-grid").mixItUp()

  Views.Index = Views.Page.extend
    title: "Home"
    template: templates.index
    init: ->
      @slider = new Views.SubViews.Slider
    onRendered: -> @slider.trigger "attached"
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
      marker = map.addMarker
        lat: -13.004333
        lng: -38.494333
        title: "A sample case title"
        infoWindow:
          content: "<b>A sample case title</b> At Federal High Court, Lagos"
      # marker.infoWindow.open map, marker    
      
  Views.Case = Views.Page.extend
    template: templates.case_
    init: ->
      # @title = @model.get ''

  Views.Cases = Views.Page.extend
    title: 'Cases'
    template: templates.cases
    init: ->
      @collection = new collections.Cases

  Views.BlogPost = Views.Page.extend
    template: templates.blog_post
    init: ->
      # @title = @model.get ''

  Views.Blog = Views.Page.extend
    title: 'PICC Blog'
    template: templates.blog
    init: ->
      @collection = new collections.BlogPosts

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
        lat: -13.004333
        lng: -38.494333      
      marker = map.addMarker
        lat: -13.004333
        lng: -38.494333
        title: "PICC Nigeria"
        infoWindow:
          content: "<b>PICC Nigeria</b> 264 Herbert Macaulay Way, Yaba<br>Lagos, Nigeria"      
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
    initialize: ->
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

    renderIndex: ->
      @render new Views.Index

    renderCaseMaps: ->
      @render new Views.CaseMaps
    
    renderCases: ->
      @render new Views.Cases

    renderCase: (case_id) ->
      @render new Views.Case case_id: case_id

    renderStatic: (page) ->
      @render new Views.Static page: page

    renderBlog: ->
      @render new Views.Blog

    renderBlogPost: (post) ->
      @render new Views.BlogPost

    renderInfographics: ->
      @render new Views.Infographics

    renderContact: ->
      @render new Views.Contact