define [], ->

  ###
  _.extend Backbone.View::,
    serialize: (form) ->
      data = $(form).serializeArray()
      keys = _.pluck data, "name"
      values = _.pluck data, "value"
      _.object keys, values
    
  BaseView: Backbone.View.extend
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
  ###

  root = (if /^10|localhost/.test(location.hostname) then "/picc/" else "/")

  errors:
    connectionError: "Could not connect to server"

  timeout: 3500 # i.e. 3.5s
  
  settings:
    siteTitle: "PICC - Public Interest in Corruption Cases"
    rootUrl: root
    apiUrl: root + "api/"

  regexps:
    email: /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,6}$/i
    phone: /^\d{11,13}$/
    username: /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,6}$/i
    website: /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,6}$/i
    password: /^\S{8,}$/
    code: /^\d{4,10}$/
  
  capitalize: (str) ->
    str.substr(0, 1).toUpperCase() + str.substr(1)

  loadScript: (scriptId, scriptUrl) ->
    ((d, s, id) ->
      js = undefined
      fjs = d.getElementsByTagName(s)[0]
      p = (if /^http:/.test(d.location) then "http" else "https")
      unless d.getElementById(id)
        js = d.createElement(s)
        js.id = id
        js.src = p + '://' + scriptUrl
        fjs.parentNode.insertBefore js, fjs
      return
    )(document, "script", scriptId)

  removeScript: (scriptId) ->
    ((d, s, id) ->
      if d.getElementById(id)
        d.removeElementById(id)          
      return
    )(document, "script", scriptId)
