define [
  'handlebars'
  'text!tmpl/index.html'
  'text!tmpl/slider.html'
  'text!tmpl/infographics.html'
  'text!tmpl/about.html'
  'text!tmpl/case.html'
  'text!tmpl/case-maps.html'
  'text!tmpl/cases.html'
  'text!tmpl/contact-us.html'
  'text!tmpl/faqs.html'
  'text!tmpl/terms.html'
  'text!tmpl/policy.html'
  ],
  (
    Handlebars,
    indexTmpl,
    sliderTmpl,
    infographicsTmpl,
    aboutTmpl,
    caseTmpl,
    caseMapsTmpl,
    casesTmpl,    
    contactTmpl,
    faqsTmpl,
    termsTmpl,
    policyTmpl    
  ) ->

    index: Handlebars.compile indexTmpl
    slider: Handlebars.compile sliderTmpl
    infographics: Handlebars.compile infographicsTmpl
    about: Handlebars.compile aboutTmpl
    case_: Handlebars.compile caseTmpl
    cases: Handlebars.compile casesTmpl
    case_maps: Handlebars.compile caseMapsTmpl
    contact: Handlebars.compile contactTmpl
    faqs: Handlebars.compile faqsTmpl
    terms: Handlebars.compile termsTmpl
    policy: Handlebars.compile policyTmpl