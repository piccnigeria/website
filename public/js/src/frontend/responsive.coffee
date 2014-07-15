define ['jquery'], ($) ->

  # isRTL = false
  isIE8 = false
  isIE9 = false
  isIE10 = false
  isIE11 = false
  responsive = true
  responsiveHandlers = []

  handleInit = ->
    # isRTL = true  if $("body").css("direction") is "rtl"
    isIE8 = !!navigator.userAgent.match(/MSIE 8.0/)
    isIE9 = !!navigator.userAgent.match(/MSIE 9.0/)
    isIE10 = !!navigator.userAgent.match(/MSIE 10.0/)
    isIE11 = !!navigator.userAgent.match(/MSIE 11.0/)
    $("html").addClass "ie10"  if isIE10
    $("html").addClass "ie11"  if isIE11

  runResponsiveHandlers = ->
    for i of responsiveHandlers
      each = responsiveHandlers[i]
      each.call()
    return

  handleResponsiveOnResize = ->
    resize = undefined
    if isIE8
      currheight = undefined
      $(window).resize ->
        return  if currheight is document.documentElement.clientHeight
        clearTimeout resize  if resize
        resize = setTimeout(->
          runResponsiveHandlers()
          return
        , 50)
        currheight = document.documentElement.clientHeight
        return

    else
      $(window).resize ->
        clearTimeout resize  if resize
        resize = setTimeout(->
          runResponsiveHandlers()
          return
        , 50)

  init: ->
    handleInit()
    handleResponsiveOnResize()

  addResponsiveHandler: (func) ->
    responsiveHandlers.push func