define ['backbone','cs!frontend/util'], (Backbone, util) ->
  
  Models = 
    Base: Backbone.Model.extend
      saveToLocalStorage: false
      saveToSessionStorage: false
      idAttribute: "_id"
      initialize: (attrs, options) ->
        @on "error", @__error, @
        @on "invalid", @__invalid, @
        @on "sync", @__sync, @
        @init? options

      namespace: -> @_namespace + ":" + @id

      __sync: (model, resp, options) ->
        if @saveToLocalStorage
          localStorage.removeItem @_namespace
          localStorage.setItem @_namespace, JSON.stringify(@attributes)  if resp._id

      __error: (model, xhr, options) ->
        delete @validationError
        @xhrError = xhr.responseJSON or xhr.responseText or util.errors.connectionError
        @collection?.trigger "error", model, xhr, options
        console.log @xhrError

      __invalid: (model, error, options) ->
        delete @xhrError
        @collection?.trigger "invalid", model, error, options
        console.log @validationError

      create: (attrs, callback) ->
        throw "Model already exists"  if @id
        @save attrs,
          wait: true
          success: callback

      update: (attrs, callback) ->
        throw "Model must be created first"  unless @id
        @set attrs
        @save @changedAttributes,
          wait: true
          patch: true
          success: callback

  Models.Agency = Models.Base.extend
    urlRoot: "agencies"
  
  Models.Court = Models.Base.extend
    urlRoot: "courts"
  
  Models.Case = Models.Base.extend
    urlRoot: "cases"
  
  Models.Judge = Models.Base.extend
    urlRoot: "judges"
  
  Models.Offender = Models.Base.extend
    urlRoot: "offenders"
  
  Models.Trial = Models.Base.extend
    urlRoot: "trials"

  Models.CaseSubscription = Models.Base.extend
    urlRoot: "subscriptions"
    validate: (attrs, options) ->
      return "Case is required"  unless attrs.case_id
      return "Your email address is required"  unless attrs.email
      "Kindly enter a valid email address"  unless util.regexps.email.test(attrs.email)

  Models.Subscriber = Models.Base.extend
    urlRoot: "subscribers"
    validate: (attrs, options) ->
      return "Your email address is required"  unless attrs.email
      "Kindly enter a valid email address"  unless util.regexps.email.test(attrs.email)

  Models.Feedback = Models.Base.extend
    urlRoot: "feedbacks"
    validate: (attrs, options) ->
      return "Your name is required"  unless attrs.name
      return "Kindly enter your full name"  unless attrs.name.length >= 6
      return "Your email address is required"  unless attrs.email
      return "Kindly enter a valid email address"  unless util.regexps.email.test(attrs.email)
      "Your message is required"  unless attrs.message

  Models.Infographic = Models.Base.extend
    urlRoot: "infographics"

  Models.BlogPost = Models.Base.extend
    urlRoot: "posts"

  Models