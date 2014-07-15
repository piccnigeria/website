Layout = ->
  
  # IE mode
  # detect IE10 version
  # detect IE11 version
  
  # Handles portlet tools & actions 
  
  # for demo purpose
  
  # load ajax data on page init
  
  # runs callback functions set by App.addResponsiveHandler().
  
  # reinitialize other subscribed elements
  
  # handle the layout reinitialization on window resize
  #quite event since only body resized not window.
  # wait 50ms until window resize finishes.                
  # store last body client height
  # wait 50ms until window resize finishes.
  
  #fix html5 placeholder attribute for ie7 & ie8
  # ie8 & ie9
  # this is html5 placeholder fix for inputs, inputs with placeholder-no-fix class will be skipped(e.g: we need this for password fields)
  
  # Handles scrollable contents using jQuery SlimScroll plugin.
  # allow page scroll when the element scroll is ended
  
  # close search box on body click
  handleDifInits = ->
    $(".header .navbar-toggle span:nth-child(2)").addClass "short-icon-bar"
    $(".header .navbar-toggle span:nth-child(4)").addClass "short-icon-bar"
    
  handleUniform = ->
    return  unless jQuery().uniform
    test = $("input[type=checkbox]:not(.toggle), input[type=radio]:not(.toggle, .star)")
    if test.size() > 0
      test.each ->
        if $(this).parents(".checker").size() is 0
          $(this).show()
          $(this).uniform()        

  isRTL = false
  isIE8 = false
  isIE9 = false
  isIE10 = false
  isIE11 = false
  responsive = true
  responsiveHandlers = []

  handleInit = ->
    isRTL = true  if $("body").css("direction") is "rtl"
    isIE8 = !!navigator.userAgent.match(/MSIE 8.0/)
    isIE9 = !!navigator.userAgent.match(/MSIE 9.0/)
    isIE10 = !!navigator.userAgent.match(/MSIE 10.0/)
    isIE11 = !!navigator.userAgent.match(/MSIE 11.0/)
    jQuery("html").addClass "ie10"  if isIE10
    jQuery("html").addClass "ie11"  if isIE11    

  handlePortletTools = ->
    jQuery("body").on "click", ".portlet > .portlet-title > .tools > a.remove", (e) ->
      e.preventDefault()
      jQuery(this).closest(".portlet").remove()      

    jQuery("body").on "click", ".portlet > .portlet-title > .tools > a.reload", (e) ->
      e.preventDefault()
      el = jQuery(this).closest(".portlet").children(".portlet-body")
      url = jQuery(this).attr("data-url")
      error = $(this).attr("data-error-display")
      if url
        Metronic.blockUI
          target: el
          iconOnly: true

        $.ajax
          type: "GET"
          cache: false
          url: url
          dataType: "html"
          success: (res) ->
            Metronic.unblockUI el
            el.html res
            return

          error: (xhr, ajaxOptions, thrownError) ->
            Metronic.unblockUI el
            msg = "Error on reloading the content. Please check your connection and try again."
            if error is "toastr" and toastr
              toastr.error msg
            else if error is "notific8" and $.notific8
              $.notific8 "zindex", 11500
              $.notific8 msg,
                theme: "ruby"
                life: 3000

            else
              alert msg
            return

      else
        Metronic.blockUI
          target: el
          iconOnly: true

        window.setTimeout (->
          Metronic.unblockUI el
          return
        ), 1000
      return

    $(".portlet .portlet-title a.reload[data-load=\"true\"]").click()
    jQuery("body").on "click", ".portlet > .portlet-title > .tools > .collapse, .portlet .portlet-title > .tools > .expand", (e) ->
      e.preventDefault()
      el = jQuery(this).closest(".portlet").children(".portlet-body")
      if jQuery(this).hasClass("collapse")
        jQuery(this).removeClass("collapse").addClass "expand"
        el.slideUp 200
      else
        jQuery(this).removeClass("expand").addClass "collapse"
        el.slideDown 200      
  
  handleIEFixes = ->
    if isIE8 or isIE9
      jQuery("input[placeholder]:not(.placeholder-no-fix), textarea[placeholder]:not(.placeholder-no-fix)").each ->
        input = jQuery(this)
        input.addClass("placeholder").val input.attr("placeholder")  if input.val() is "" and input.attr("placeholder") isnt ""
        input.focus ->
          input.val ""  if input.val() is input.attr("placeholder")
        input.blur ->
          input.val input.attr("placeholder")  if input.val() is "" or input.val() is input.attr("placeholder")          

  handleScrollers = ->
    $(".scroller").each ->
      height = undefined
      if $(this).attr("data-height")
        height = $(this).attr("data-height")
      else
        height = $(this).css("height")
      $(this).slimScroll
        allowPageScroll: true
        size: "7px"
        color: ((if $(this).attr("data-handle-color") then $(this).attr("data-handle-color") else "#bbb"))
        railColor: ((if $(this).attr("data-rail-color") then $(this).attr("data-rail-color") else "#eaeaea"))
        position: (if isRTL then "left" else "right")
        height: height
        alwaysVisible: ((if $(this).attr("data-always-visible") is "1" then true else false))
        railVisible: ((if $(this).attr("data-rail-visible") is "1" then true else false))
        disableFadeOut: true      

  handleMenu = ->
    $(".header .navbar-toggle").click ->
      if $(".header .navbar-collapse").hasClass("open")
        $(".header .navbar-collapse").slideDown(300).removeClass "open"
      else
        $(".header .navbar-collapse").slideDown(300).addClass "open"      

  handleSubMenuExt = ->
    $(".header-navigation .dropdown").on "hover", ->
      $(".header-navigation-description").css "height", $(".header-navigation-content-ext").height() + 22  if $(".header-navigation-content-ext").height() >= $(".header-navigation-description").height()  if $(this).children(".header-navigation-content-ext").show()
      return

    return

  handleSidebarMenu = ->
    $(".sidebar .dropdown a i").click (event) ->
      event.preventDefault()
      if $(this).parent("a").hasClass("collapsed") is false
        $(this).parent("a").addClass "collapsed"
        $(this).parent("a").siblings(".dropdown-menu").slideDown 300
      else
        $(this).parent("a").removeClass "collapsed"
        $(this).parent("a").siblings(".dropdown-menu").slideUp 300

  
  # Handles Bootstrap Accordions.
  handleAccordions = ->
    jQuery("body").on "shown.bs.collapse", ".accordion.scrollable", (e) ->
      Layout.scrollTo $(e.target), -100
      return

    return

  
  # Handles Bootstrap Tabs.
  handleTabs = ->
    
    # fix content height on tab click
    $("body").on "shown.bs.tab", ".nav.nav-tabs", ->
      handleSidebarAndContentHeight()
      return

    
    #activate tab if tab id provided in the URL
    if location.hash
      tabid = location.hash.substr(1)
      $("a[href=\"#" + tabid + "\"]").click()
    return

  handleMobiToggler = ->
    $(".mobi-toggler").on "click", (event) ->
      event.preventDefault() #the default action of the event will not be triggered
      $(".header").toggleClass "menuOpened"
      $(".header").find(".header-navigation").toggle 300
      return

    return
  
  init: ->    
    # init core variables
    # handleInit()
    # handleResponsiveOnResize()
    handleIEFixes()
    # handleSearch()
    # handleFancybox()
    handleDifInits()
    handleSidebarMenu()
    handleAccordions()
    handleMenu()
    handleScrollers()
    handleSubMenuExt()
    handleMobiToggler()
    handlePortletTools()    

  initUniform: (els) ->
    if els
      jQuery(els).each ->
        if $(this).parents(".checker").size() is 0
          $(this).show()
          $(this).uniform()
        return
    else
      handleUniform()
    return

  initTouchspin: ->
    $(".product-quantity .form-control").TouchSpin
      buttondown_class: "btn quantity-down"
      buttonup_class: "btn quantity-up"

    $(".quantity-down").html "<i class='fa fa-angle-down'></i>"
    $(".quantity-up").html "<i class='fa fa-angle-up'></i>"
    return
  
  initNavScrolling: ->
    NavScrolling = ->
      if jQuery(window).scrollTop() > 60
        jQuery(".header").addClass "reduce-header"
      else
        jQuery(".header").removeClass "reduce-header"
      return
    NavScrolling()
    jQuery(window).scroll ->
      NavScrolling()
      return

    return

  initOWL: ->
    $(".owl-carousel6-brands").owlCarousel
      pagination: false
      navigation: true
      items: 6
      addClassActive: true
      itemsCustom: [
        [
          0
          1
        ]
        [
          320
          1
        ]
        [
          480
          2
        ]
        [
          700
          3
        ]
        [
          975
          5
        ]
        [
          1200
          6
        ]
        [
          1400
          6
        ]
        [
          1600
          6
        ]
      ]

    $(".owl-carousel5").owlCarousel
      pagination: false
      navigation: true
      items: 5
      addClassActive: true
      itemsCustom: [
        [
          0
          1
        ]
        [
          320
          1
        ]
        [
          480
          2
        ]
        [
          660
          2
        ]
        [
          700
          3
        ]
        [
          768
          3
        ]
        [
          992
          4
        ]
        [
          1024
          4
        ]
        [
          1200
          5
        ]
        [
          1400
          5
        ]
        [
          1600
          5
        ]
      ]

    $(".owl-carousel4").owlCarousel
      pagination: false
      navigation: true
      items: 4
      addClassActive: true

    $(".owl-carousel3").owlCarousel
      pagination: false
      navigation: true
      items: 3
      addClassActive: true
      itemsCustom: [
        [
          0
          1
        ]
        [
          320
          1
        ]
        [
          480
          2
        ]
        [
          700
          3
        ]
        [
          768
          2
        ]
        [
          1024
          3
        ]
        [
          1200
          3
        ]
        [
          1400
          3
        ]
        [
          1600
          3
        ]
      ]

    $(".owl-carousel2").owlCarousel
      pagination: false
      navigation: true
      items: 2
      addClassActive: true
      itemsCustom: [
        [
          0
          1
        ]
        [
          320
          1
        ]
        [
          480
          2
        ]
        [
          700
          3
        ]
        [
          975
          2
        ]
        [
          1200
          2
        ]
        [
          1400
          2
        ]
        [
          1600
          2
        ]
      ]

    return

  initImageZoom: ->
    $(".product-main-image").zoom url: $(".product-main-image img").attr("data-BigImgSrc")
    return

  initSliderRange: ->
    $("#slider-range").slider
      range: true
      min: 0
      max: 500
      values: [
        50
        250
      ]
      slide: (event, ui) ->
        $("#amount").val "$" + ui.values[0] + " - $" + ui.values[1]
        return

    $("#amount").val "$" + $("#slider-range").slider("values", 0) + " - $" + $("#slider-range").slider("values", 1)
    return

  
  # wrapper function to scroll(focus) to an element
  scrollTo: (el, offeset) ->
    pos = (if (el and el.size() > 0) then el.offset().top else 0)
    if el
      pos = pos - $(".header").height()  if $("body").hasClass("page-header-fixed")
      pos = pos + ((if offeset then offeset else -1 * el.height()))
    jQuery("html,body").animate
      scrollTop: pos
    , "slow"
    return

  
  #public function to add callback a function which will be called on window resize
  addResponsiveHandler: (func) ->
    responsiveHandlers.push func
    return

  scrollTop: ->
    App.scrollTo()
    return

  gridOption1: ->
    $ ->
      $(".grid-v1").mixitup()
      return

    return
()
