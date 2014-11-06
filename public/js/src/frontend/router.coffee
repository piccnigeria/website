define ['jquery','backbone','cs!frontend/views', 'cs!frontend/util'], ($, Backbone, MainView, util) ->
  (->        
    Router = Backbone.Router.extend(
      routes:
        "": "index"
        "about(/:page)": "about"
        faqs: "faqs"
        cases: "cases"
        # "cases(/id/:id)": "cases"
        "case-maps":"case_maps"
        contact: "contact"
        infographics: "infographics"
        blog: "blog"
        # "blog(/post/:slug)":"blog"

      initialize: ->
        $ =>
          @appView = new MainView(router: @)
          Backbone.history.start
            pushState: true
            root: util.settings.rootUrl

        $(document).on "click", "a[data-nav]", (ev) =>
          href = ev.currentTarget.href
          if href and href.indexOf("#")
            ev.preventDefault()
            @navigate href.split("#")[1], true

      index: ->
        @appView.renderIndex()

      about: (page) ->
        @appView.renderStatic page

      faqs: ->
        @appView.renderStatic "faqs"

      cases: (id) ->
        @appView.renderCases(id)

      case_maps: ->
        @appView.renderCaseMaps()

      contact: ->
        @appView.renderContact()

      infographics: ->
        @appView.renderInfographics()
        
      blog: (slug) ->
        @appView.renderBlog(slug)

    )
    instance = null
    getInstance: ->
      instance = new Router  unless instance?
      instance
  )()