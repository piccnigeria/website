define [
  'handlebars'
  'text!tmpl/index.html'
  'text!tmpl/contact-us.html'
  'text!tmpl/index-slider.html',
  'text!tmpl/infographics.html'
  ],
  (
    Handlebars,
    indexTmpl,
    contactTmpl,
    indexSliderTmpl,
    infographicsTmpl
  ) ->

    index: Handlebars.compile indexTmpl
    infographics: Handlebars.compile infographicsTmpl
    index_slider: Handlebars.compile indexSliderTmpl
    contact: Handlebars.compile contactTmpl  