define ['jquery','underscore','backbone', 'cs!frontend/views', 'cs!frontend/util'], ($, _, Backbone, MainView, util) ->
  (->        
    Router = Backbone.Router.extend(
      routes:
        "": "index"
        about: "about"
        "about/:page": "about"
        faqs: "faqs"
        cases: "cases"
        "case-maps":"case_maps"
        contact: "contact"
        infographics: "infographics"
        blog: "blog"
        "blog/:post":"blog_post"

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
        @appView.renderStatic page or "about"

      faqs: ->
        @appView.renderStatic "faqs"

      cases: ->
        @appView.renderCases()

      case_maps: ->
        @appView.renderCaseMaps()

      contact: ->
        @appView.renderContact()

      infographics: ->
        @appView.renderInfographics()

      blog: ->
        @appView.renderBlog()

      blog_post: (post) ->
        @appView.renderBlogPost(post: post)

    )
    instance = null
    getInstance: ->
      instance = new Router  unless instance?
      instance
  )()