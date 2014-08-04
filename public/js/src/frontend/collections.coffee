define ['underscore','jquery','backbone','cs!frontend/models'], (_,$,Backbone,models) ->
  
  Collections =
    Base: Backbone.Collection.extend
      model: Backbone.Model
      fetchOnInitialize: true
      initialize: (models, options) ->
        @init? options
        do @fetch if @fetchOnInitialize?
      resort: (criteria) ->
        if criteria is @currentSortCriteria then return
        # rewrite the comparator && resort the collection
        @comparator = (model) -> model.get criteria
        @sort()

  Collections.Infographics = Collections.Base.extend
    model: models.Infographic
    url: "infographics"

  Collections.Cases = Collections.Base.extend
    model: models.Case
    url: "cases"

  Collections.Offenders = Collections.Base.extend
    model: models.Offender
    url: "offenders"

  Collections.BlogPosts = Collections.Base.extend
    model: models.BlogPost
    url: "posts" # path to the WP restful backend

  Collections