define ['jquery','underscore','backbone', 'cs!frontend/views', 'cs!frontend/util'], ($, _, Backbone, MainView, util) ->
  (->        
    Router = Backbone.Router.extend(
      routes:
        "": "index"
        about: "about"
        "about/:page": "about"
        cases: "cases"
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
        @appView.renderAbout page or "About"

      cases: ->
        @appView.renderCases()

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