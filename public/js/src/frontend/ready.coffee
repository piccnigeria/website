#** Merged with $ Scroll to Top Control script- (c) Dynamic Drive DHTML code library: http://www.dynamicdrive.com.
#** Available/ usage terms at http://www.dynamicdrive.com (March 30th, 09')
#** v1.1 (April 7th, 09'):
#** 1) Adds ability to scroll to an absolute position (from top of page) or specific element on the page instead.
#** 2) Fixes scroll animation not working in Opera. 

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

  scrolltotop =
    
    #startline: Integer. Number of pixels from top of doc scrollbar is scrolled before showing control
    #scrollto: Keyword (Integer, or "Scroll_to_Element_ID"). How far to scroll document up when control is clicked on (0=top).
    setting:
      startline: 100
      scrollto: 0
      scrollduration: 1000
      fadeduration: [
        500
        100
      ]

    controlHTML: "<img src=\"img/up.png\" style=\"width:40px; height:40px\" />" #HTML for control, which is auto wrapped in DIV w/ ID="topcontrol"
    controlattrs: #offset of control relative to right/ bottom of window corner
      offsetx: 10
      offsety: 10

    anchorkeyword: "#top" #Enter href value of HTML anchors on the page that should also act as "Scroll Up" links
    state:
      isvisible: false
      shouldvisible: false

    scrollup: ->
      #if control is positioned using JavaScript
      @$control.css opacity: 0  unless @cssfixedsupport #hide control immediately after clicking it
      dest = (if isNaN(@setting.scrollto) then @setting.scrollto else parseInt(@setting.scrollto))
      if typeof dest is "string" and $("#" + dest).length is 1 #check element set by string exists
        dest = $("#" + dest).offset().top
      else
        dest = 0
      @$body.animate
        scrollTop: dest
      , @setting.scrollduration
      return

    keepfixed: ->
      $window = $(window)
      controlx = $window.scrollLeft() + $window.width() - @$control.width() - @controlattrs.offsetx
      controly = $window.scrollTop() + $window.height() - @$control.height() - @controlattrs.offsety
      @$control.css
        left: controlx + "px"
        top: controly + "px"
      return

    togglecontrol: ->
      scrolltop = $(window).scrollTop()
      @keepfixed()  unless @cssfixedsupport
      @state.shouldvisible = (if (scrolltop >= @setting.startline) then true else false)
      if @state.shouldvisible and not @state.isvisible
        @$control.stop().animate
          opacity: 1
        , @setting.fadeduration[0]
        @state.isvisible = true
      else if @state.shouldvisible is false and @state.isvisible
        @$control.stop().animate
          opacity: 0
        , @setting.fadeduration[1]
        @state.isvisible = false
      return

  handleScrollToTop = ->
    mainobj = scrolltotop
    iebrws = document.all
    mainobj.cssfixedsupport = not iebrws or iebrws and document.compatMode is "CSS1Compat" and window.XMLHttpRequest #not IE or IE7+ browsers in standards mode
    mainobj.$body = (if (window.opera) then ((if document.compatMode is "CSS1Compat" then $("html") else $("body"))) else $("html,body"))
    mainobj.$control = $("<div id=\"topcontrol\">" + mainobj.controlHTML + "</div>").css(
      position: (if mainobj.cssfixedsupport then "fixed" else "absolute")
      bottom: mainobj.controlattrs.offsety
      right: mainobj.controlattrs.offsetx
      opacity: 0
      cursor: "pointer"
    ).attr(title: "Scroll Back to Top").click(->
      mainobj.scrollup()
      false
    ).appendTo("body")
    #loose check for IE6 and below, plus whether control contains any text
    mainobj.$control.css width: mainobj.$control.width()  if document.all and not window.XMLHttpRequest and mainobj.$control.text() isnt "" #IE6- seems to require an explicit width on a DIV containing text
    mainobj.togglecontrol()
    $("a[href=\"" + mainobj.anchorkeyword + "\"]").click ->
      mainobj.scrollup()
      false
    $(window).bind "scroll resize", (e) ->
      mainobj.togglecontrol()
  
  
  initResponsive: ->
    handleInit()
    handleResponsiveOnResize()

  addResponsiveHandler: (func) ->
    responsiveHandlers.push func

  initScrollToTop: ->
    handleScrollToTop()