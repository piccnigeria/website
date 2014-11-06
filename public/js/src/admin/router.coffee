define ['jquery','backbone','cs!admin/views','cs!frontend/util'], ($, Backbone, MainView, util) ->
  (->
    
    Router = Backbone.Router.extend
      routes:
        "": "index"
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

      index: ->
        @appView.renderIndex()

      home: ->
        @appView.renderDashboard()

    instance = null
    getInstance: ->
      instance = new Router  unless instance?
      instance

  )()