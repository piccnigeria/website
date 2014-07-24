define ['jquery','underscore','backbone', 'cs!admin/views', 'cs!frontend/util'], ($, _, Backbone, MainView, util) ->
  (->        
    Router = Backbone.Router.extend(
      routes:
        "": "login"
        home: "home"        

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

      login: ->
        @appView.renderIndex()

      home: ->
        @appView.renderDashboard()

    )
    instance = null
    getInstance: ->
      instance = new Router  unless instance?
      instance
  )()