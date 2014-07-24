define [
  'handlebars'
  'text!tmpl/admin/index.html'
  'text!tmpl/admin/layout.html'
  'text!tmpl/admin/dashboard.html'  
  'text!tmpl/admin/infographics.html'  
  'text!tmpl/admin/cases.html'  
  'text!tmpl/admin/users.html'
  'text!tmpl/admin/agencies.html'
  'text!tmpl/admin/courts.html'
  'text!tmpl/admin/csos.html'
  'text!tmpl/admin/offenders.html'
  'text!tmpl/admin/subscribers.html'
  'text!tmpl/admin/judges.html'
  ],
  (
    Handlebars,
    indexTmpl,
    layoutTmpl,
    dashboardTmpl,
    infographicsTmpl,    
    casesTmpl,    
    usersTmpl,
    agenciesTmpl,
    courtsTmpl,
    csosTmpl,
    offendersTmpl,
    subscribersTmpl,
    judgesTmpl
  ) ->

    layout: Handlebars.compile layoutTmpl
    index: Handlebars.compile indexTmpl
    dashboard: Handlebars.compile dashboardTmpl
    infographics: Handlebars.compile infographicsTmpl
    cases: Handlebars.compile casesTmpl
    users: Handlebars.compile usersTmpl
    agencies: Handlebars.compile agenciesTmpl
    courts: Handlebars.compile courtsTmpl
    csos: Handlebars.compile csosTmpl
    offenders: Handlebars.compile offendersTmpl
    subscribers: Handlebars.compile subscribersTmpl
    judges: Handlebars.compile judgesTmpl