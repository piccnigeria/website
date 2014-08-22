
//     Backbone.js 1.1.2

//     (c) 2010-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(root, factory) {

  // Set up Backbone appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define('backbone',['underscore', 'jquery', 'exports'], function(_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      root.Backbone = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore');
    factory(root, exports, _);

  // Finally, as a browser global.
  } else {
    root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(this, function(root, Backbone, _, $) {

  // Initial Setup
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create local references to array methods we'll want to use later.
  var array = [];
  var push = array.push;
  var slice = array.slice;
  var splice = array.splice;

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '1.1.2';

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = $;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = void 0;
        return this;
      }
      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeningTo = this._listeningTo;
      if (!listeningTo) return this;
      var remove = !name && !callback;
      if (!callback && typeof name === 'object') callback = this;
      if (obj) (listeningTo = {})[obj._listenId] = obj;
      for (var id in listeningTo) {
        obj = listeningTo[id];
        obj.off(name, callback, this);
        if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeningTo = this._listeningTo || (this._listeningTo = {});
      var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
      listeningTo[id] = obj;
      if (!callback && typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId('c');
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function(key, val, options) {
      var attr, attrs, unset, changes, silent, changing, prev, current;
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      unset           = options.unset;
      silent          = options.silent;
      changes         = [];
      changing        = this._changing;
      this._changing  = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }
      current = this.attributes, prev = this._previousAttributes;

      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // For each `set` attribute, update or delete the current value.
      for (attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          this.changed[attr] = val;
        } else {
          delete this.changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0, l = changes.length; i < l; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var val, changed = false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      for (var attr in diff) {
        if (_.isEqual(old[attr], (val = diff[attr]))) continue;
        (changed || (changed = {}))[attr] = val;
      }
      return changed;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server. If the server's representation of the
    // model differs from its current attributes, they will be overridden,
    // triggering a `"change"` event.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        if (!model.set(model.parse(resp, options), options)) return false;
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      var attrs, method, xhr, attributes = this.attributes;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true}, options);

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !options.wait) {
        if (!this.set(attrs, options)) return false;
      } else {
        if (!this._validate(attrs, options)) return false;
      }

      // Set temporary attributes if `{wait: true}`.
      if (attrs && options.wait) {
        this.attributes = _.extend({}, attributes, attrs);
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = model.parse(resp, options);
        if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
        if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
          return false;
        }
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch') options.attrs = attrs;
      xhr = this.sync(method, this, options);

      // Restore attributes.
      if (attrs && options.wait) this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;

      var destroy = function() {
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (options.wait || model.isNew()) destroy();
        if (success) success(model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      if (this.isNew()) {
        options.success();
        return false;
      }
      wrapError(this, options);

      var xhr = this.sync('delete', this, options);
      if (!options.wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base;
      return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(this.id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.extend(options || {}, { validate: true }));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model.
  var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  _.each(modelMethods, function(method) {
    Model.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.attributes);
      return _[method].apply(_, args);
    };
  });

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analagous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model){ return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set.
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      var singular = !_.isArray(models);
      models = singular ? [models] : _.clone(models);
      options || (options = {});
      var i, l, index, model;
      for (i = 0, l = models.length; i < l; i++) {
        model = models[i] = this.get(models[i]);
        if (!model) continue;
        delete this._byId[model.id];
        delete this._byId[model.cid];
        index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;
        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }
        this._removeReference(model, options);
      }
      return singular ? models[0] : models;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      options = _.defaults({}, options, setOptions);
      if (options.parse) models = this.parse(models, options);
      var singular = !_.isArray(models);
      models = singular ? (models ? [models] : []) : _.clone(models);
      var i, l, id, model, attrs, existing, sort;
      var at = options.at;
      var targetModel = this.model;
      var sortable = this.comparator && (at == null) && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;
      var toAdd = [], toRemove = [], modelMap = {};
      var add = options.add, merge = options.merge, remove = options.remove;
      var order = !sortable && add && remove ? [] : false;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      for (i = 0, l = models.length; i < l; i++) {
        attrs = models[i] || {};
        if (attrs instanceof Model) {
          id = model = attrs;
        } else {
          id = attrs[targetModel.prototype.idAttribute || 'id'];
        }

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        if (existing = this.get(id)) {
          if (remove) modelMap[existing.cid] = true;
          if (merge) {
            attrs = attrs === model ? model.attributes : attrs;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
          }
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(attrs, options);
          if (!model) continue;
          toAdd.push(model);
          this._addReference(model, options);
        }

        // Do not add multiple models with the same `id`.
        model = existing || model;
        if (order && (model.isNew() || !modelMap[model.id])) order.push(model);
        modelMap[model.id] = true;
      }

      // Remove nonexistent models if appropriate.
      if (remove) {
        for (i = 0, l = this.length; i < l; ++i) {
          if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
        }
        if (toRemove.length) this.remove(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      if (toAdd.length || (order && order.length)) {
        if (sortable) sort = true;
        this.length += toAdd.length;
        if (at != null) {
          for (i = 0, l = toAdd.length; i < l; i++) {
            this.models.splice(at + i, 0, toAdd[i]);
          }
        } else {
          if (order) this.models.length = 0;
          var orderedModels = order || toAdd;
          for (i = 0, l = orderedModels.length; i < l; i++) {
            this.models.push(orderedModels[i]);
          }
        }
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort events.
      if (!options.silent) {
        for (i = 0, l = toAdd.length; i < l; i++) {
          (model = toAdd[i]).trigger('add', model, this, options);
        }
        if (sort || (order && order.length)) this.trigger('sort', this, options);
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options || (options = {});
      for (var i = 0, l = this.models.length; i < l; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      this.remove(model, options);
      return model;
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      this.remove(model, options);
      return model;
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id.
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj] || this._byId[obj.id] || this._byId[obj.cid];
    },

    // Get the model at the given index.
    at: function(index) {
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      if (_.isEmpty(attrs)) return first ? void 0 : [];
      return this[first ? 'find' : 'filter'](function(model) {
        for (var key in attrs) {
          if (attrs[key] !== model.get(key)) return false;
        }
        return true;
      });
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      // Run sort based on type of `comparator`.
      if (_.isString(this.comparator) || this.comparator.length === 1) {
        this.models = this.sortBy(this.comparator, this);
      } else {
        this.models.sort(_.bind(this.comparator, this));
      }

      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return _.invoke(this.models, 'get', attr);
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success(collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      if (!(model = this._prepareModel(model, options))) return false;
      if (!options.wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(model, resp) {
        if (options.wait) collection.add(model, options);
        if (success) success(model, resp, options);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models);
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (attrs instanceof Model) return attrs;
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      if (model.id != null) this._byId[model.id] = model;
      if (!model.collection) model.collection = this;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model, options) {
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      if (model && event === 'change:' + model.idAttribute) {
        delete this._byId[model.previous(model.idAttribute)];
        if (model.id != null) this._byId[model.id] = model;
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
    'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
    'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
    'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
    'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
    'lastIndexOf', 'isEmpty', 'chain', 'sample'];

  // Mix in each Underscore method as a proxy to `Collection#models`.
  _.each(methods, function(method) {
    Collection.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.models);
      return _[method].apply(_, args);
    };
  });

  // Underscore methods that take a property name as an argument.
  var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];

  // Use attributes instead of properties.
  _.each(attributeMethods, function(method) {
    Collection.prototype[method] = function(value, context) {
      var iterator = _.isFunction(value) ? value : function(model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    options || (options = {});
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
    this.delegateEvents();
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be merged as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this.$el.remove();
      this.stopListening();
      return this;
    },

    // Change the view's element (`this.el` property), including event
    // re-delegation.
    setElement: function(element, delegate) {
      if (this.$el) this.undelegateEvents();
      this.$el = element instanceof Backbone.$ ? element : Backbone.$(element);
      this.el = this.$el[0];
      if (delegate !== false) this.delegateEvents();
      return this;
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    // This only works for delegate-able events: not `focus`, `blur`, and
    // not `change`, `submit`, and `reset` in Internet Explorer.
    delegateEvents: function(events) {
      if (!(events || (events = _.result(this, 'events')))) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[events[key]];
        if (!method) continue;

        var match = key.match(delegateEventSplitter);
        var eventName = match[1], selector = match[2];
        method = _.bind(method, this);
        eventName += '.delegateEvents' + this.cid;
        if (selector === '') {
          this.$el.on(eventName, method);
        } else {
          this.$el.on(eventName, selector, method);
        }
      }
      return this;
    },

    // Clears all callbacks previously bound to the view with `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        var $el = Backbone.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
        this.setElement($el, false);
      } else {
        this.setElement(_.result(this, 'el'), false);
      }
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // If we're sending a `PATCH` request, and we're in an old Internet Explorer
    // that still has ActiveX enabled by default, override jQuery to use that
    // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
    if (params.type === 'PATCH' && noXhrPatch) {
      params.xhr = function() {
        return new ActiveXObject("Microsoft.XMLHTTP");
      };
    }

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  var noXhrPatch =
    typeof window !== 'undefined' && !!window.ActiveXObject &&
      !(window.XMLHttpRequest && (new XMLHttpRequest).dispatchEvent);

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch':  'PATCH',
    'delete': 'DELETE',
    'read':   'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        router.execute(callback, args);
        router.trigger.apply(router, ['route:' + name].concat(args));
        router.trigger('route', name, args);
        Backbone.history.trigger('route', router, name, args);
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    execute: function(callback, args) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    _.bindAll(this, 'checkUrl');

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for detecting MSIE.
  var isExplorer = /msie [\w.]+/;

  // Cached regex for removing a trailing slash.
  var trailingSlash = /\/$/;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Are we at the app root?
    atRoot: function() {
      return this.location.pathname.replace(/[^\/]$/, '$&/') === this.root;
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the cross-browser normalized URL fragment, either from the URL,
    // the hash, or the override.
    getFragment: function(fragment, forcePushState) {
      if (fragment == null) {
        if (this._hasPushState || !this._wantsHashChange || forcePushState) {
          fragment = decodeURI(this.location.pathname + this.location.search);
          var root = this.root.replace(trailingSlash, '');
          if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error("Backbone.history has already been started");
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.options.pushState && this.history && this.history.pushState);
      var fragment          = this.getFragment();
      var docMode           = document.documentMode;
      var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      if (oldIE && this._wantsHashChange) {
        var frame = Backbone.$('<iframe src="javascript:0" tabindex="-1">');
        this.iframe = frame.hide().appendTo('body')[0].contentWindow;
        this.navigate(fragment);
      }

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._hasPushState) {
        Backbone.$(window).on('popstate', this.checkUrl);
      } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
        Backbone.$(window).on('hashchange', this.checkUrl);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      // Determine if we need to change the base url, for a pushState link
      // opened by a non-pushState browser.
      this.fragment = fragment;
      var loc = this.location;

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          this.fragment = this.getFragment(null, true);
          this.location.replace(this.root + '#' + this.fragment);
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot() && loc.hash) {
          this.fragment = this.getHash().replace(routeStripper, '');
          this.history.replaceState({}, document.title, this.root + this.fragment);
        }

      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      Backbone.$(window).off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();
      if (current === this.fragment && this.iframe) {
        current = this.getFragment(this.getHash(this.iframe));
      }
      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      fragment = this.fragment = this.getFragment(fragment);
      return _.any(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};

      var url = this.root + (fragment = this.getFragment(fragment || ''));

      // Strip the hash for matching.
      fragment = fragment.replace(pathStripper, '');

      if (this.fragment === fragment) return;
      this.fragment = fragment;

      // Don't include a trailing slash on the root.
      if (fragment === '' && url !== '/') url = url.slice(0, -1);

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._hasPushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if(!options.replace) this.iframe.document.open().close();
          this._updateHash(this.iframe.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error(model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;

}));

define('cs',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});
define('text',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});
define('text!tmpl/index.html',[],function () { return '<!-- BEGIN SERVICE BOX -->\n<div class="row service-box margin-bottom-40">\n  <div class="col-md-4 col-sm-4">\n    <div class="service-box-heading">\n      <em><i class="fa fa-search"></i></em>\n      <span>Search for Cases</span>\n    </div>\n    <p>Lorem ipsum dolor sit amet, dolore eiusmod quis tempor incididunt ut et dolore Ut veniam unde nostrudlaboris. Sed unde omnis iste natus error sit voluptatem.</p>\n  </div>\n  <div class="col-md-4 col-sm-4">\n    <div class="service-box-heading">\n      <em><i class="fa fa-rss"></i></em>\n      <span>Subscribe to Updates</span>\n    </div>\n    <p>Lorem ipsum dolor sit amet, dolore eiusmod quis tempor incididunt ut et dolore Ut veniam unde nostrudlaboris. Sed unde omnis iste natus error sit voluptatem.</p>\n  </div>\n  <div class="col-md-4 col-sm-4">\n    <div class="service-box-heading">\n      <em><i class="fa fa-share"></i></em>\n      <span>Share with friends</span>\n    </div>\n    <p>Lorem ipsum dolor sit amet, dolore eiusmod quis tempor incididunt ut et dolore Ut veniam unde nostrudlaboris. Sed unde omnis iste natus error sit voluptatem.</p>\n  </div>\n</div>\n<!-- END SERVICE BOX -->\n\n<!-- BEGIN RECENT WORKS -->\n<div class="row recent-infographics margin-bottom-40">\n  <div class="col-md-3">\n    <h2>Infographics</h2>\n    <p>A picture is worth a thousand words. Therefore we use infographics that go viral to pass crucial information in a snapshot. Here are some of our recent infographics. <a href="#infographics" data-nav>See all</a></p>\n  </div>\n  <div class="col-md-9">\n    <div class="owl-carousel owl-carousel3">\n      <div class="recent-infographic-item">\n        <em>\n          <img src="img/infographics/img1.jpg" alt="Amazing Project" class="img-responsive">\n          <a href="img/infographics/img1.jpg" class="fancybox-button" title="Project Name #1" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\n        </em>\n        <a class="recent-infographic-description" href="#">\n          <strong>A Year in EFCC</strong>\n          <b>Profiles the efforts of the EFCC in 2013</b>\n        </a>\n      </div>\n      <div class="recent-infographic-item">\n        <em>\n          <img src="img/infographics/img2.jpg" alt="Amazing Project" class="img-responsive">\n          <a href="img/infographics/img2.jpg" class="fancybox-button" title="Project Name #2" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\n        </em>\n        <a class="recent-infographic-description" href="#">\n          <strong>Some Facts about Corruption Trials</strong>\n          <b>A "Did you know?" series</b>\n        </a>\n      </div>\n      <div class="recent-infographic-item">\n        <em>\n          <img src="img/infographics/img3.jpg" alt="Amazing Project" class="img-responsive">\n          <a href="img/infographics/img3.jpg" class="fancybox-button" title="Project Name #3" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\n        </em>\n        <a class="recent-infographic-description" href="#">\n          <strong>Assets Recovery</strong>\n          <b>A "Did you know?" series</b>\n        </a>\n      </div>\n      <!--div class="recent-infographic-item">\n        <em>\n          <img src="img/infographics/img4.jpg" alt="Amazing Project" class="img-responsive">          \n          <a href="img/infographics/img4.jpg" class="fancybox-button" title="Project Name #4" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\n        </em>\n        <a class="recent-infographic-description" href="#">\n          <strong>Amazing Project</strong>\n          <b>Agenda corp.</b>\n        </a>\n      </div>\n      <div class="recent-infographic-item">\n        <em>\n          <img src="img/infographics/img5.jpg" alt="Amazing Project" class="img-responsive">          \n          <a href="img/infographics/img5.jpg" class="fancybox-button" title="Project Name #5" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\n        </em>\n        <a class="recent-infographic-description" href="#">\n          <strong>Amazing Project</strong>\n          <b>Agenda corp.</b>\n        </a>\n      </div>\n      <div class="recent-infographic-item">\n        <em>\n          <img src="img/infographics/img6.jpg" alt="Amazing Project" class="img-responsive">          \n          <a href="img/infographics/img6.jpg" class="fancybox-button" title="Project Name #6" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\n        </em>\n        <a class="recent-infographic-description" href="#">\n          <strong>Amazing Project</strong>\n          <b>Agenda corp.</b>\n        </a>\n      </div>\n      <div class="recent-infographic-item">\n        <em>\n          <img src="img/infographics/img3.jpg" alt="Amazing Project" class="img-responsive">          \n          <a href="img/infographics/img3.jpg" class="fancybox-button" title="Project Name #3" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\n        </em>\n        <a class="recent-infographic-description" href="#">\n          <strong>Amazing Project</strong>\n          <b>Agenda corp.</b>\n        </a>\n      </div>\n      <div class="recent-infographic-item">\n        <em>\n          <img src="img/infographics/img4.jpg" alt="Amazing Project" class="img-responsive">          \n          <a href="img/infographics/img4.jpg" class="fancybox-button" title="Project Name #4" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\n        </em>\n        <a class="recent-infographic-description" href="#">\n          <strong>Amazing Project</strong>\n          <b>Agenda corp.</b>\n        </a>\n      </div-->\n    </div>       \n  </div>\n</div>   \n<!-- END RECENT WORKS -->\n\n<!-- BEGIN TABS AND TESTIMONIALS -->\n<div class="row mix-block margin-bottom-40">\n\n  <div class="col-md-3">\n    <h2>Testimonials</h2>\n    <p>What some influential people say about the efforts and objectives of the PICC.</p>\n  </div>\n\n  <!-- TESTIMONIALS -->\n  <div class="col-md-5 testimonials">\n    <div id="myCarousel" class="carousel slide">\n      <!-- Carousel items -->\n      <div class="carousel-inner">\n        <div class="active item">\n          <blockquote><p>Denim you probably haven\'t heard of. Lorem ipsum dolor met consectetur adipisicing sit amet, consectetur adipisicing elit, of them jean shorts sed magna aliqua. Lorem ipsum dolor met.</p></blockquote>\n          <div class="carousel-info">\n            <img class="pull-left" src="img/people/img1-small.jpg" alt="">\n            <div class="pull-left">\n              <span class="testimonials-name">Seun Onigbinde</span>\n              <span class="testimonials-post">Co-Founder, BudgIT</span>\n            </div>\n          </div>\n        </div>\n        <div class="item">\n          <blockquote><p>Raw denim you Mustache cliche tempor, williamsburg carles vegan helvetica probably haven\'t heard of them jean shorts austin. Nesciunt tofu stumptown aliqua, retro synth master cleanse. Mustache cliche tempor, williamsburg carles vegan helvetica.</p></blockquote>\n          <div class="carousel-info">\n            <img class="pull-left" src="img/people/img5-small.jpg" alt="">\n            <div class="pull-left">\n              <span class="testimonials-name">Nengak Daniel</span>\n              <span class="testimonials-post">Director, Cleen Foundation, Lagos</span>\n            </div>\n          </div>\n        </div>\n        <div class="item">\n          <blockquote><p>Reprehenderit butcher stache cliche tempor, williamsburg carles vegan helvetica.retro keffiyeh dreamcatcher synth. Cosby sweater eu banh mi, qui irure terry richardson ex squid Aliquip placeat salvia cillum iphone.</p></blockquote>\n          <div class="carousel-info">\n            <img class="pull-left" src="img/people/img2-small.jpg" alt="">\n            <div class="pull-left">\n              <span class="testimonials-name">Jake Witson</span>\n              <span class="testimonials-post">Commercial Director</span>\n            </div>\n          </div>\n        </div>\n      </div>\n\n      <!-- Carousel nav -->\n      <a class="left-btn" href="#myCarousel" data-slide="prev"></a>\n      <a class="right-btn" href="#myCarousel" data-slide="next"></a>\n    </div>\n  </div>\n  <!-- END TESTIMONIALS -->\n\n  <!-- TABS -->\n  <div class="col-md-4">\n\n  </div>\n  <!-- End TABS -->\n\n</div>                \n<!-- END TABS AND TESTIMONIALS -->\n\n<!-- BEGIN CLIENTS -->\n<div class="row margin-bottom-40 partners">\n  <div class="col-md-3">\n    <h2>Supporters</h2>\n    <p>The PICC is proudly supported by the following organizations.</p>\n  </div>\n  <div class="col-md-9">\n    <div class="owl-carousel owl-carousel6-brands">\n      <div class="partner">\n        <a href="#">\n          <img src="img/partners/partner_1_gray.png" class="img-responsive" alt="">\n          <img src="img/partners/partner_1.png" class="color-img img-responsive" alt="">\n        </a>\n      </div>\n      <div class="partner">\n        <a href="#">\n          <img src="img/partners/partner_2_gray.png" class="img-responsive" alt="">\n          <img src="img/partners/partner_2.png" class="color-img img-responsive" alt="">\n        </a>\n      </div>\n      <div class="partner">\n        <a href="#">\n          <img src="img/partners/partner_3_gray.png" class="img-responsive" alt="">\n          <img src="img/partners/partner_3.png" class="color-img img-responsive" alt="">\n        </a>\n      </div>\n      <div class="partner">\n        <a href="#">\n          <img src="img/partners/partner_4_gray.png" class="img-responsive" alt="">\n          <img src="img/partners/partner_4.png" class="color-img img-responsive" alt="">\n        </a>\n      </div>              \n    </div>\n  </div>          \n</div>\n<!-- END CLIENTS -->';});

define('text!tmpl/slider.html',[],function () { return '<!-- BEGIN SLIDER -->    \n      <div class="fullwidthbanner-container revolution-slider">\n        <div class="fullwidthbanner">\n          <ul id="revolutionul">\n            <!-- THE NEW SLIDE -->\n            <li data-transition="fade" data-slotamount="8" data-masterspeed="700" data-delay="9400" data-thumb="img/revolutionslider/thumbs/thumb2.jpg">\n              <!-- THE MAIN IMAGE IN THE FIRST SLIDE -->\n              <img src="img/revolutionslider/bg9.jpg" alt="">\n              \n              <div class="caption lft slide_title_white slide_item_left"\n                data-x="30"\n                data-y="90"\n                data-speed="400"\n                data-start="1500"\n                data-easing="easeOutExpo">\n                Explore the Power<br><span class="slide_title_white_bold">of Metronic</span>\n              </div>\n              <div class="caption lft slide_subtitle_white slide_item_left"\n                data-x="87"\n                data-y="245"\n                data-speed="400"\n                data-start="2000"\n                data-easing="easeOutExpo">\n                This is what you were looking for\n              </div>\n              <a class="caption lft btn dark slide_btn slide_item_left" href="http://themeforest.net/item/metronic-responsive-admin-dashboard-template/4021469?ref=keenthemes"\n                data-x="187"\n                data-y="315"\n                data-speed="400"\n                data-start="3000"\n                data-easing="easeOutExpo">\n                Purchase Now!\n              </a>                        \n              <div class="caption lfb"\n                data-x="640" \n                data-y="0" \n                data-speed="700" \n                data-start="1000" \n                data-easing="easeOutExpo">\n                <img src="img/revolutionslider/lady.png" alt="Image 1">\n              </div>\n            </li>    \n\n            <!-- THE FIRST SLIDE -->\n            <li data-transition="fade" data-slotamount="8" data-masterspeed="700" data-delay="9400" data-thumb="img/revolutionslider/thumbs/thumb2.jpg">\n              <!-- THE MAIN IMAGE IN THE FIRST SLIDE -->\n              <img src="img/revolutionslider/bg1.jpg" alt="">\n                            \n              <div class="caption lft slide_title slide_item_left"\n                data-x="30"\n                data-y="105"\n                data-speed="400"\n                data-start="1500"\n                data-easing="easeOutExpo">\n                Need a website design? \n              </div>\n              <div class="caption lft slide_subtitle slide_item_left"\n                data-x="30"\n                data-y="180"\n                data-speed="400"\n                data-start="2000"\n                data-easing="easeOutExpo">\n                This is what you were looking for\n              </div>\n              <div class="caption lft slide_desc slide_item_left"\n                data-x="30"\n                data-y="220"\n                data-speed="400"\n                data-start="2500"\n                data-easing="easeOutExpo">\n                Lorem ipsum dolor sit amet, dolore eiusmod<br> quis tempor incididunt. Sed unde omnis iste.\n              </div>\n              <a class="caption lft btn green slide_btn slide_item_left" href="http://themeforest.net/item/metronic-responsive-admin-dashboard-template/4021469?ref=keenthemes"\n                data-x="30"\n                data-y="290"\n                data-speed="400"\n                data-start="3000"\n                data-easing="easeOutExpo">\n                Purchase Now!\n              </a>                        \n              <div class="caption lfb"\n                data-x="640" \n                data-y="55" \n                data-speed="700" \n                data-start="1000" \n                data-easing="easeOutExpo">\n                <img src="img/revolutionslider/man-winner.png" alt="Image 1">\n              </div>\n            </li>\n\n            <!-- THE SECOND SLIDE -->\n            <li data-transition="fade" data-slotamount="7" data-masterspeed="300" data-delay="9400" data-thumb="img/revolutionslider/thumbs/thumb2.jpg">                        \n              <img src="img/revolutionslider/bg2.jpg" alt="">\n              <div class="caption lfl slide_title slide_item_left"\n                data-x="30"\n                data-y="125"\n                data-speed="400"\n                data-start="3500"\n                data-easing="easeOutExpo">\n                Powerfull &amp; Clean\n              </div>\n              <div class="caption lfl slide_subtitle slide_item_left"\n                data-x="30"\n                data-y="200"\n                data-speed="400"\n                data-start="4000"\n                data-easing="easeOutExpo">\n                Responsive Admin &amp; Website Theme\n              </div>\n              <div class="caption lfl slide_desc slide_item_left"\n                data-x="30"\n                data-y="245"\n                data-speed="400"\n                data-start="4500"\n                data-easing="easeOutExpo">\n                Lorem ipsum dolor sit amet, consectetuer elit sed diam<br> nonummy amet euismod dolore.\n              </div>                        \n              <div class="caption lfr slide_item_right" \n                data-x="635" \n                data-y="105" \n                data-speed="1200" \n                data-start="1500" \n                data-easing="easeOutBack">\n                <img src="img/revolutionslider/mac.png" alt="Image 1">\n              </div>\n              <div class="caption lfr slide_item_right" \n                data-x="580" \n                data-y="245" \n                data-speed="1200" \n                data-start="2000" \n                data-easing="easeOutBack">\n                <img src="img/revolutionslider/ipad.png" alt="Image 1">\n              </div>\n              <div class="caption lfr slide_item_right" \n                data-x="735" \n                data-y="290" \n                data-speed="1200" \n                data-start="2500" \n                data-easing="easeOutBack">\n                <img src="img/revolutionslider/iphone.png" alt="Image 1">\n              </div>\n              <div class="caption lfr slide_item_right" \n                data-x="835" \n                data-y="230" \n                data-speed="1200" \n                data-start="3000" \n                data-easing="easeOutBack">\n                <img src="img/revolutionslider/macbook.png" alt="Image 1">\n              </div>\n              <div class="caption lft slide_item_right" \n                data-x="865" \n                data-y="45" \n                data-speed="500" \n                data-start="5000" \n                data-easing="easeOutBack">\n                <img src="img/revolutionslider/hint1-red.png" id="rev-hint1" alt="Image 1">\n              </div>                        \n              <div class="caption lfb slide_item_right" \n                data-x="355" \n                data-y="355" \n                data-speed="500" \n                data-start="5500" \n                data-easing="easeOutBack">\n                <img src="img/revolutionslider/hint2-red.png" id="rev-hint2" alt="Image 1">\n              </div>\n            </li>\n                        \n            <!-- THE THIRD SLIDE -->\n            <li data-transition="fade" data-slotamount="8" data-masterspeed="700" data-delay="9400" data-thumb="img/revolutionslider/thumbs/thumb2.jpg">\n              <img src="img/revolutionslider/bg3.jpg" alt="">\n              <div class="caption lfl slide_item_left" \n                data-x="30" \n                data-y="95" \n                data-speed="400" \n                data-start="1500" \n                data-easing="easeOutBack">\n                <iframe src="http://player.vimeo.com/video/56974716?portrait=0" width="420" height="240" style="border:0" allowFullScreen></iframe> \n              </div>\n              <div class="caption lfr slide_title"\n                data-x="470"\n                data-y="100"\n                data-speed="400"\n                data-start="2000"\n                data-easing="easeOutExpo">\n                Responsive Video Support\n              </div>\n              <div class="caption lfr slide_subtitle"\n                data-x="470"\n                data-y="170"\n                data-speed="400"\n                data-start="2500"\n                data-easing="easeOutExpo">\n                Youtube, Vimeo and others.\n              </div>\n              <div class="caption lfr slide_desc"\n                data-x="470"\n                data-y="220"\n                data-speed="400"\n                data-start="3000"\n                data-easing="easeOutExpo">\n                Lorem ipsum dolor sit amet, consectetuer elit sed diam<br> nonummy amet euismod dolore.\n              </div>\n              <a class="caption lfr btn yellow slide_btn" href=""\n                data-x="470"\n                data-y="280"\n                                 data-speed="400"\n                                 data-start="3500"\n                                 data-easing="easeOutExpo">\n                                 Watch more Videos!\n                            </a>\n                        </li>               \n                        \n                        <!-- THE FORTH SLIDE -->\n                        <li data-transition="fade" data-slotamount="8" data-masterspeed="700" data-delay="9400" data-thumb="img/revolutionslider/thumbs/thumb2.jpg">\n                            <!-- THE MAIN IMAGE IN THE FIRST SLIDE -->\n                            <img src="img/revolutionslider/bg4.jpg" alt="">                        \n                             <div class="caption lft slide_title"\n                                 data-x="30"\n                                 data-y="105"\n                                 data-speed="400"\n                                 data-start="1500"\n                                 data-easing="easeOutExpo">\n                                 What else included ?\n                            </div>\n                            <div class="caption lft slide_subtitle"\n                                 data-x="30"\n                                 data-y="180"\n                                 data-speed="400"\n                                 data-start="2000"\n                                 data-easing="easeOutExpo">\n                                 The Most Complete Admin Theme\n                            </div>\n                            <div class="caption lft slide_desc"\n                                 data-x="30"\n                                 data-y="225"\n                                 data-speed="400"\n                                 data-start="2500"\n                                 data-easing="easeOutExpo">\n                                 Lorem ipsum dolor sit amet, consectetuer elit sed diam<br> nonummy amet euismod dolore.\n                            </div>\n                            <a class="caption lft slide_btn btn red slide_item_left" href="http://www.keenthemes.com/preview/index.php?theme=metronic_admin" target="_blank" \n                                 data-x="30"\n                                 data-y="300"\n                                 data-speed="400"\n                                 data-start="3000"\n                                 data-easing="easeOutExpo">\n                                 Learn More!\n                            </a>                        \n                            <div class="caption lft start"  \n                                 data-x="670" \n                                 data-y="55" \n                                 data-speed="400" \n                                 data-start="2000" \n                                 data-easing="easeOutBack"  >\n                                 <img src="img/revolutionslider/iphone_left.png" alt="Image 2">\n                            </div>\n                            \n                            <div class="caption lft start"  \n                                 data-x="850" \n                                 data-y="55" \n                                 data-speed="400" \n                                 data-start="2400" \n                                 data-easing="easeOutBack"  >\n                                 <img src="img/revolutionslider/iphone_right.png" alt="Image 3">\n                            </div>                        \n                        </li>\n                </ul>\n                <div class="tp-bannertimer tp-bottom"></div>\n            </div>\n        </div>\n    \n    <!-- END SLIDER -->';});

define('text!tmpl/infographics.html',[],function () { return '<ul class="breadcrumb">\n  <li><a href="#" data-nav>Home</a></li>\n  <li class="active">Infographics</li>\n</ul>\n\n<!-- BEGIN SIDEBAR & CONTENT -->\n<div class="row margin-bottom-40">\n  <!-- BEGIN CONTENT -->\n  <div class="col-md-12 col-sm-12">\n    <h1>Infographics</h1>\n    <div class="content-page">\n      <div class="filter-v1">\n        <ul class="mix-filter">\n                <li data-filter="all" class="filter active">All</li>\n                <li data-filter="category_1" class="filter">UI Design</li>\n                <li data-filter="category_2" class="filter">Web Development</li>\n                <li data-filter="category_3" class="filter">Photography</li>\n                <li data-filter="category_3 category_1" class="filter">Wordpress and Logo</li>\n        </ul>\n\n        <div class="row mix-grid thumbnails">\n          \n          <div class="col-md-6 col-sm-6 mix category_1 mix_all" style="display:block;opacity:1;">\n            <div class="mix-inner">\n              <img alt="" src="img/infographics/img1.jpg" class="img-responsive">\n              <div class="mix-details">\n                      <h4>Cascusamus et iusto odio</h4>\n                      <p>At vero eos et accusamus et iusto odio digniss imos duc sasdimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores.</p>\n                      <a class="mix-link"><i class="fa fa-link"></i></a>\n                      <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img1.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>\n              </div>           \n            </div>                       \n          </div>\n          \n          <div class="col-md-6 col-sm-6 mix category_2 mix_all" style="display:block;opacity:1;">\n                 <div class="mix-inner">\n                  <img alt="" src="img/infographics/img2.jpg" class="img-responsive">\n                  <div class="mix-details">\n                   <h4>Cascusamus et iusto odio</h4>\n                   <p>At vero eos et accusamus et iusto odio digniss imos duc sasdimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores.</p>\n                   <a class="mix-link"><i class="fa fa-link"></i></a>\n                   <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img2.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>\n                 </div>               \n               </div>                    \n          </div>\n          \n          <div class="col-md-6 col-sm-6 mix category_3 mix_all" style="display:block;opacity:1;">\n            <div class="mix-inner">\n                <img alt="" src="img/infographics/img3.jpg" class="img-responsive">\n                <div class="mix-details">\n                 <h4>Cascusamus et iusto odio</h4>\n                 <p>At vero eos et accusamus et iusto odio digniss imos duc sasdimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores.</p>\n                 <a class="mix-link"><i class="fa fa-link"></i></a>\n                 <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img3.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>\n               </div>              \n            </div>      \n          </div>\n          \n          <div class="col-md-6 col-sm-6 mix category_1 category_2 mix_all" style="display:block;opacity:1;">\n             <div class="mix-inner">\n               <img alt="" src="img/infographics/img4.jpg" class="img-responsive">\n               <div class="mix-details">\n                 <h4>Cascusamus et iusto odio</h4>\n                 <p>At vero eos et accusamus et iusto odio digniss imos duc sasdimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores.</p>\n                 <a class="mix-link"><i class="fa fa-link"></i></a>\n                 <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img4.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>                            \n               </div>                  \n             </div>                      \n          </div>\n          \n          <div class="col-md-6 col-sm-6 mix category_2 category_1 mix_all" style="display:block;opacity:1;">\n            <div class="mix-inner">\n              <img alt="" src="img/infographics/img5.jpg" class="img-responsive">\n              <div class="mix-details">\n                <h4>Cascusamus et iusto odio</h4>\n                <p>At vero eos et accusamus et iusto odio digniss imos duc sasdimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores.</p>\n                <a class="mix-link"><i class="fa fa-link"></i></a>\n                <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img5.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>                            \n              </div>     \n            </div>                                   \n          </div>\n          \n          <div class="col-md-6 col-sm-6 mix category_1 category_2 mix_all" style="display:block;opacity:1;">\n            <div class="mix-inner">\n              <img alt="" src="img/infographics/img6.jpg" class="img-responsive">\n              <div class="mix-details">\n                <h4>Cascusamus et iusto odio</h4>\n                <p>At vero eos et accusamus et iusto odio digniss imos duc sasdimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores.</p>\n                <a class="mix-link"><i class="fa fa-link"></i></a>\n                <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img6.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>                            \n              </div>     \n            </div>                                   \n          </div>\n          \n          <div class="col-md-6 col-sm-6 mix category_2 category_3 mix_all" style="display:block;opacity:1;">\n            <div class="mix-inner">\n              <img alt="" src="img/infographics/img1.jpg" class="img-responsive">\n              <div class="mix-details">\n                <h4>Cascusamus et iusto odio</h4>\n                <p>At vero eos et accusamus et iusto odio digniss imos duc sasdimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores.</p>\n                <a class="mix-link"><i class="fa fa-link"></i></a>\n                <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img1.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>                            \n              </div>    \n            </div>                                    \n          </div>\n          \n          <div class="col-md-6 col-sm-6 mix category_1 category_2 mix_all" style="display:block;opacity:1;">\n            <div class="mix-inner">\n              <img alt="" src="img/infographics/img2.jpg" class="img-responsive">\n              <div class="mix-details">\n                <h4>Cascusamus et iusto odio</h4>\n                <p>At vero eos et accusamus et iusto odio digniss imos duc sasdimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores.</p>\n                <a class="mix-link"><i class="fa fa-link"></i></a>\n                <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img2.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>                            \n              </div>   \n            </div>                                     \n          </div>\n          \n          <div class="col-md-6 col-sm-6 mix category_3 mix_all" style="display:block;opacity:1;">\n            <div class="mix-inner">\n              <img alt="" src="img/infographics/img4.jpg" class="img-responsive">\n              <div class="mix-details">\n                <h4>Cascusamus et iusto odio</h4>\n                <p>At vero eos et accusamus et iusto odio digniss imos duc sasdimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores.</p>\n                <a class="mix-link"><i class="fa fa-link"></i></a>\n                <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img4.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>                            \n              </div>    \n            </div>                                    \n          </div>\n\n        </div>\n      </div>\n    </div>\n  </div>\n<!-- END CONTENT -->\n</div>\n<!-- END SIDEBAR & CONTENT -->';});

define('text!tmpl/about.html',[],function () { return '<ul class="breadcrumb">\n    <li><a href="#" data-nav>Home</a></li>\n    <li class="active">About Us</li>\n</ul>\n\n<div class="row margin-bottom-40">  \n  <div class="col-md-12 col-sm-12">\n    <h1>About Us</h1>\n    <div class="content-page">\n      <div class="row margin-bottom-30">\n        <div class="col-md-7">\n          <h2 class="no-top-space">About the PICC</h2>\n          <p>Public Interest In Corruption Cases (PICC) is an idea conceptualized and hacked at the Civic Codeathon a 3-days event organized by BudgIT and sponsored by United States Department of State Bureau of International Narcotics and Law Enforcement Affairs (INL) in may 2014.</p>\n\n          <p>PICC is aimed at citizen participation in governance and understanding the dynamics of corruption within the Nigerian State.</p>\n\n          <p>Corruption costs the state and citizens millions every year in lost funds for economic and social development. While new institutions have been set up to root out corruption and cases are going to trial there seems to be lack of interest in corruption cases after the initial charge and arraignment of suspects. With slow justice system, news reports of corruption cases lose steam and journalists and the general public quickly moves on to other news.</p>\n\n          <p>PICC seeks to be the one-stop reference portal for current as well as archived information on corruption cases in Nigeria. The PICC portal will help in: raising the interest of Nigerians in the prosecution of corruption, increasing public confidence and awareness on efficiency of the judicial system, serving as a reference point for information on corruption prosecution, providing a timeline for following progress on corruption cases, providing timely information and feedback on the progress of cases, indicating possible opportunities for justiciable grounds in each case, allowing people’s opinion on the development of corruption cases. The tool will be targeting civil society groups, lawyers, literate citizens and concentrated groups in order to fight judicial corruption, engage everyday citizens in these processes by giving them access to information and to make a more transparent government environment in Nigeria.</p>\n        </div>\n      </div>\n    </div>\n  </div>\n</div>';});

define('text!tmpl/case.html',[],function () { return '<ul class="breadcrumb">\n    <li><a href="#" data-nav>Home</a></li>\n    <li><a href="#cases" data-nav>Cases</a></li>\n    <li class="active">Case</li>\n</ul>\n\n<!-- BEGIN SIDEBAR & CONTENT -->\n<div class="row margin-bottom-40">\n\n  <!-- BEGIN CONTENT -->\n  <div class="col-md-12 col-sm-12">            \n    \n    <h1>{{{title}}}</h1>\n    <div class="content-page">\n      <div class="row margin-bottom-30">\n        \n        <!-- BEGIN INFO BLOCK -->\n        <div class="col-md-7">\n          <h2 class="no-top-space">Vero eos et accusamus</h2>\n          <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi.</p> \n          <p>Idest laborum et dolorum fuga. Et harum quidem rerum et quas molestias excepturi sint occaecati facilis est et expedita distinctio lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero consectetur adipiscing elit magna. Sed et quam lacus.</p>\n          <!-- BEGIN LISTS -->\n          <div class="row front-lists-v1">\n            <div class="col-md-6">\n              <ul class="list-unstyled margin-bottom-20">\n                <li><i class="fa fa-check"></i> Officia deserunt molliti</li>\n                <li><i class="fa fa-check"></i> Consectetur adipiscing </li>\n                <li><i class="fa fa-check"></i> Deserunt fpicia</li>\n              </ul>\n            </div>\n            <div class="col-md-6">\n              <ul class="list-unstyled">\n                <li><i class="fa fa-check"></i> Officia deserunt molliti</li>\n                <li><i class="fa fa-check"></i> Consectetur adipiscing </li>\n                <li><i class="fa fa-check"></i> Deserunt fpicia</li>\n              </ul>\n            </div>\n          </div>\n          <!-- END LISTS -->\n        </div>\n        <!-- END INFO BLOCK -->\n        \n      </div>\n\n    </div>\n  </div>\n  <!-- END CONTENT -->\n</div>\n<!-- END SIDEBAR & CONTENT -->';});

define('text!tmpl/case-maps.html',[],function () { return '<ul class="breadcrumb">\n    <li><a href="#" data-nav>Home</a></li>\n    <li class="active">Case Maps</li>\n</ul>\n<!-- BEGIN SIDEBAR & CONTENT -->\n<div class="row margin-bottom-40">\n  <!-- BEGIN CONTENT -->\n  <div class="col-md-12 col-sm-12">\n    <div id="map" class="gmaps margin-bottom-40"></div>\n  </div>\n  <!-- END CONTENT -->\n</div>\n<!-- END SIDEBAR & CONTENT -->';});

define('text!tmpl/cases.html',[],function () { return '<ul class="breadcrumb">\n    <li><a href="#" data-nav>Home</a></li>\n    <li class="active">Cases</li>\n</ul>\n<!-- BEGIN SIDEBAR & CONTENT -->\n<div class="row margin-bottom-40">\n  <!-- BEGIN CONTENT -->\n  <div class="col-md-12 col-sm-12">\n    <h1>Cases</h1>\n    <div class="content-page">\n      <div class="row margin-bottom-30">\n        \n        <!-- BEGIN INFO BLOCK -->\n        <div class="col-md-9 col-sm-9">\n          \n          <form action="#" class="content-search-view2">\n            <div class="input-group">\n              <input type="text" class="form-control" placeholder="Search...">\n              <span class="input-group-btn">\n                <button type="submit" class="btn btn-primary">Search</button>\n              </span>\n            </div>\n          </form>\n\n          <!-- BEGIN LISTS -->\n          {{#each this}}\n          <div class="search-result-item">\n            <h4><a href="#">{{{title}}}</a></h4>\n            <p>Metronic is a responsive admin dashboard template powered with Twitter Bootstrap Framework for admin and backend applications. Metronic has a clean and intuitive metro style design which makes your next project look awesome and yet user friendly..</p>\n            <ul class="blog-info">\n              <li><i class="fa fa-gavel"></i> {{charge_number}}</li>\n              <li><i class="fa fa-calendar"></i> {{charge_date}}</li>\n              <li><i class="fa fa-map-marker"></i> {{court_state}}</li>\n              <li><i class="fa fa-tags"></i> tags</li>\n            </ul>\n            <a class="search-link" href="#">http://www.keenthemes.com</a>\n          </div>\n          {{/each}}                  \n          <!-- END LISTS -->\n\n          <div class="row">\n            <div class="col-md-4 col-sm-4 items-info">Cases 1 to 9 of 10 total</div>\n            <div class="col-md-8 col-sm-8">\n              <ul class="pagination pull-right">\n                <li><a href="#">«</a></li>\n                <li><a href="#">1</a></li>\n                <li><span>2</span></li>\n                <li><a href="#">3</a></li>\n                <li><a href="#">4</a></li>\n                <li><a href="#">5</a></li>\n                <li><a href="#">»</a></li>\n              </ul>\n            </div>\n          </div>\n\n        </div>\n\n        <!-- END INFO BLOCK -->\n\n        <div class="col-md-3 col-sm-3 blog-sidebar">\n\n          <h2 class="no-top-space">Categories</h2>\n          <ul class="nav sidebar-categories margin-bottom-40">\n            <li><a href="#">London (18)</a></li>\n            <li><a href="#">Moscow (5)</a></li>\n            <li class="active"><a href="#">Paris (12)</a></li>\n            <li><a href="#">Berlin (7)</a></li>\n            <li><a href="#">Istanbul (3)</a></li>\n          </ul>\n\n          <div class="blog-tags margin-bottom-20">\n            <h2>Tags</h2>\n            <ul>\n              <li><a href="#"><i class="fa fa-tags"></i>Money laundering</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Forgery</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Stealing</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Counterfeiting</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Impersonation</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Misappropriation</a></li>              \n            </ul>\n          </div>\n          \n        </div>\n        \n      </div>\n\n    </div>\n  </div>\n  <!-- END CONTENT -->\n</div>\n<!-- END SIDEBAR & CONTENT -->';});

define('text!tmpl/contact.html',[],function () { return '        <ul class="breadcrumb">\n            <li><a href="#" data-nav>Home</a></li>\n            <li class="active">Contact Us</li>\n        </ul>\n        <div class="row margin-bottom-40">\n          <!-- BEGIN CONTENT -->\n          <div class="col-md-12">\n            <h1>Contacts</h1>\n            <div class="content-page">\n              <div class="row">\n                <div class="col-md-12">\n                  <div id="map" class="gmaps margin-bottom-40" style="height:400px;"></div>\n                </div>\n                <div class="col-md-9 col-sm-9">\n                  <h2>Contact Form</h2>\n                  <p>Lorem ipsum dolor sit amet, Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat consectetuer adipiscing elit, sed diam nonummy nibh euismod tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat.</p>\n                  \n                  <!-- BEGIN FORM-->\n                  <form role="form">\n                    <div class="form-group">\n                      <label for="contacts-name">Name</label>\n                      <input name="name" type="text" class="form-control" id="contacts-name">\n                    </div>\n                    <div class="form-group">\n                      <label for="contacts-email">Email</label>\n                      <input name="email" type="email" class="form-control" id="contacts-email">\n                    </div>\n                    <div class="form-group">\n                      <label for="contacts-message">Message</label>\n                      <textarea name="message" class="form-control" rows="5" id="contacts-message"></textarea>\n                    </div>\n                    <button type="submit" class="btn btn-primary"><i class="icon-ok"></i> Send</button>\n                    <button type="button" class="btn btn-default">Cancel</button>\n                  </form>\n                  <!-- END FORM-->\n                </div>\n\n                <div class="col-md-3 col-sm-3 sidebar2">\n                  <h2>Our Contacts</h2>\n                  <address>\n                    <strong>PICC Nigeria</strong><br>\n                    294 Herbert Macaulay Way, Yaba<br>\n                    Lagos, Nigeria<br>\n                    <abbr title="Phone">P:</abbr> (234) 703 6188 527\n                  </address>\n                  <address>\n                    <strong>Email</strong><br>\n                    <a href="mailto:info@picc.com.ng">info@picc.com.ng</a><br>\n                    <a href="mailto:subscribe@example.com">subscribe@picc.com.ng</a>\n                  </address>\n                  <ul class="social-icons margin-bottom-40">\n                    <li><a href="http://facebook.com/piccnigeria" target="_blank" data-original-title="facebook" class="facebook"></a></li>\n                    <li><a href="http://twitter.com/piccnigeria" target="_blank" data-original-title="twitter" class="twitter"></a></li>                    \n                    <li><a href="http://google.com/+PICCNigeria" target="_blank" data-original-title="Google+" class="googleplus"></a></li>\n                    <li><a href="http://github.com/piccnigeria" target="_blank" data-original-title="github" class="github"></a></li>                    \n                  </ul>                  \n                </div>\n              </div>\n            </div>\n          </div>\n          <!-- END CONTENT -->\n        </div>';});

define('text!tmpl/faqs.html',[],function () { return '        <ul class="breadcrumb">\n            <li><a href="#" data-nav>Home</a></li>\n            <li><a href="#about" data-nav>About Us</a></li>\n            <li class="active">FAQs</li>\n        </ul>\n        <!-- BEGIN SIDEBAR & CONTENT -->\n        <div class="row margin-bottom-40">\n          <!-- BEGIN CONTENT -->\n          <div class="col-md-12 col-sm-12">\n            <h1>Frequently Asked Questions</h1>\n            <div class="content-page">\n              <div class="row margin-bottom-30">\n                <!-- BEGIN INFO BLOCK -->               \n                <div class="col-md-7">\n                  <h2 class="no-top-space">Vero eos et accusamus</h2>\n                  <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi.</p> \n                  <p>Idest laborum et dolorum fuga. Et harum quidem rerum et quas molestias excepturi sint occaecati facilis est et expedita distinctio lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero consectetur adipiscing elit magna. Sed et quam lacus.</p>\n                  <!-- BEGIN LISTS -->\n                  <div class="row front-lists-v1">\n                    <div class="col-md-6">\n                      <ul class="list-unstyled margin-bottom-20">\n                        <li><i class="fa fa-check"></i> Officia deserunt molliti</li>\n                        <li><i class="fa fa-check"></i> Consectetur adipiscing </li>\n                        <li><i class="fa fa-check"></i> Deserunt fpicia</li>\n                      </ul>\n                    </div>\n                    <div class="col-md-6">\n                      <ul class="list-unstyled">\n                        <li><i class="fa fa-check"></i> Officia deserunt molliti</li>\n                        <li><i class="fa fa-check"></i> Consectetur adipiscing </li>\n                        <li><i class="fa fa-check"></i> Deserunt fpicia</li>\n                      </ul>\n                    </div>\n                  </div>\n                  <!-- END LISTS -->\n                </div>\n                <!-- END INFO BLOCK -->\n                \n              </div>\n\n            </div>\n          </div>\n          <!-- END CONTENT -->\n        </div>\n        <!-- END SIDEBAR & CONTENT -->';});

define('text!tmpl/terms.html',[],function () { return '        <ul class="breadcrumb">\n            <li><a href="#" data-nav>Home</a></li>\n            <li><a href="#about" data-nav>About Us</a></li>\n            <li class="active">Terms of Service</li>\n        </ul>\n        <!-- BEGIN SIDEBAR & CONTENT -->\n        <div class="row margin-bottom-40">\n          <!-- BEGIN CONTENT -->\n          <div class="col-md-12 col-sm-12">\n            <h1>Terms of Service</h1>\n            <div class="content-page">\n              <div class="row margin-bottom-30">\n                <!-- BEGIN INFO BLOCK -->               \n                <div class="col-md-7">\n                  <h2 class="no-top-space">Vero eos et accusamus</h2>\n                  <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi.</p> \n                  <p>Idest laborum et dolorum fuga. Et harum quidem rerum et quas molestias excepturi sint occaecati facilis est et expedita distinctio lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero consectetur adipiscing elit magna. Sed et quam lacus.</p>\n                  <!-- BEGIN LISTS -->\n                  <div class="row front-lists-v1">\n                    <div class="col-md-6">\n                      <ul class="list-unstyled margin-bottom-20">\n                        <li><i class="fa fa-check"></i> Officia deserunt molliti</li>\n                        <li><i class="fa fa-check"></i> Consectetur adipiscing </li>\n                        <li><i class="fa fa-check"></i> Deserunt fpicia</li>\n                      </ul>\n                    </div>\n                    <div class="col-md-6">\n                      <ul class="list-unstyled">\n                        <li><i class="fa fa-check"></i> Officia deserunt molliti</li>\n                        <li><i class="fa fa-check"></i> Consectetur adipiscing </li>\n                        <li><i class="fa fa-check"></i> Deserunt fpicia</li>\n                      </ul>\n                    </div>\n                  </div>\n                  <!-- END LISTS -->\n                </div>\n                <!-- END INFO BLOCK -->\n                \n              </div>\n\n            </div>\n          </div>\n          <!-- END CONTENT -->\n        </div>\n        <!-- END SIDEBAR & CONTENT -->';});

define('text!tmpl/policy.html',[],function () { return '        <ul class="breadcrumb">\n            <li><a href="#" data-nav>Home</a></li>\n            <li><a href="#about" data-nav>About Us</a></li>\n            <li class="active">Privacy Policy</li>\n        </ul>\n        <!-- BEGIN SIDEBAR & CONTENT -->\n        <div class="row margin-bottom-40">\n          <!-- BEGIN CONTENT -->\n          <div class="col-md-12 col-sm-12">\n            <h1>Privacy Policy</h1>\n            <div class="content-page">\n              <div class="row margin-bottom-30">\n                <!-- BEGIN INFO BLOCK -->               \n                <div class="col-md-7">\n                  <h2 class="no-top-space">Vero eos et accusamus</h2>\n                  <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi.</p> \n                  <p>Idest laborum et dolorum fuga. Et harum quidem rerum et quas molestias excepturi sint occaecati facilis est et expedita distinctio lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero consectetur adipiscing elit magna. Sed et quam lacus.</p>\n                  <!-- BEGIN LISTS -->\n                  <div class="row front-lists-v1">\n                    <div class="col-md-6">\n                      <ul class="list-unstyled margin-bottom-20">\n                        <li><i class="fa fa-check"></i> Officia deserunt molliti</li>\n                        <li><i class="fa fa-check"></i> Consectetur adipiscing </li>\n                        <li><i class="fa fa-check"></i> Deserunt fpicia</li>\n                      </ul>\n                    </div>\n                    <div class="col-md-6">\n                      <ul class="list-unstyled">\n                        <li><i class="fa fa-check"></i> Officia deserunt molliti</li>\n                        <li><i class="fa fa-check"></i> Consectetur adipiscing </li>\n                        <li><i class="fa fa-check"></i> Deserunt fpicia</li>\n                      </ul>\n                    </div>\n                  </div>\n                  <!-- END LISTS -->\n                </div>\n                <!-- END INFO BLOCK -->\n                \n              </div>\n\n            </div>\n          </div>\n          <!-- END CONTENT -->\n        </div>\n        <!-- END SIDEBAR & CONTENT -->';});

define('text!tmpl/blog.html',[],function () { return '<ul class="breadcrumb">\n    <li><a href="#" data-nav>Home</a></li>\n    <li class="active">Blog</li>\n</ul>\n\n<!-- BEGIN SIDEBAR & CONTENT -->\n<div class="row margin-bottom-40">\n  <!-- BEGIN CONTENT -->\n  <div class="col-md-12 col-sm-12">\n    <h1>PICC Blog</h1>\n    <div class="content-page">\n      <div class="row">\n        <!-- BEGIN LEFT SIDEBAR -->            \n        <div class="col-md-9 col-sm-9 blog-posts">\n          \n          {{#each this}}\n\n          <div class="row">\n            <div class="col-md-4 col-sm-4">\n              <img class="img-responsive" alt="" src="{{post_image_thumbnail}}">\n            </div>\n            <div class="col-md-8 col-sm-8">\n              <h2><a href="#blog/post" data-nav>{{{post_title}}}</a></h2>\n              <ul class="blog-info">\n                <li><i class="fa fa-calendar"></i> {{post_date}}</li>\n                <li><i class="fa fa-comments"></i> 17</li>\n                <li><i class="fa fa-tags"></i> {{tags}}</li>\n              </ul>\n              <p>{{summarize post_body}}</p>\n              <a href="#blog/post" data-nav class="more">Read more <i class="icon-angle-right"></i></a>\n            </div>\n          </div>\n          <hr class="blog-post-sep">\n\n          {{/each}}\n                            \n          <ul class="pagination">\n            <li><a href="#">Prev</a></li>\n            <li><a href="#">1</a></li>\n            <li><a href="#">2</a></li>\n            <li class="active"><a href="#">3</a></li>\n            <li><a href="#">4</a></li>\n            <li><a href="#">5</a></li>\n            <li><a href="#">Next</a></li>\n          </ul>               \n        </div>\n        <!-- END LEFT SIDEBAR -->\n\n        <!-- BEGIN RIGHT SIDEBAR -->            \n        <div class="col-md-3 col-sm-3 blog-sidebar">\n          <!-- CATEGORIES START -->\n          <h2 class="no-top-space">Categories</h2>\n          <ul class="nav sidebar-categories margin-bottom-40">\n            <li><a href="#">London (18)</a></li>\n            <li><a href="#">Moscow (5)</a></li>\n            <li class="active"><a href="#">Paris (12)</a></li>\n            <li><a href="#">Berlin (7)</a></li>\n            <li><a href="#">Istanbul (3)</a></li>\n          </ul>\n          <!-- CATEGORIES END -->\n\n          <!-- BEGIN RECENT NEWS -->\n          <h2>Recent News</h2>\n          <div class="recent-news margin-bottom-10">\n            {{#each recent_posts}}\n            <div class="row margin-bottom-10">\n              <div class="col-md-3">\n                <img class="img-responsive" alt="" src="img/people/img2-large.jpg">                        \n              </div>\n              <div class="col-md-9 recent-news-inner">\n                <h3><a href="#blog/post" data-nav>{{{post_title}}}</a></h3>\n                <p>{{{summarize post_body}}}</p>\n              </div>                        \n            </div>\n            {{/each}}\n          </div>\n          <!-- END RECENT NEWS -->\n\n          <!-- BEGIN BLOG TAGS -->\n          <div class="blog-tags margin-bottom-20">\n            <h2>Tags</h2>\n            <ul>\n              <li><a href="#"><i class="fa fa-tags"></i>OS</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Metronic</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Dell</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Conquer</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>MS</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Google</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Keenthemes</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Twitter</a></li>\n            </ul>\n          </div>\n          <!-- END BLOG TAGS -->\n        </div>\n        <!-- END RIGHT SIDEBAR -->            \n      </div>\n    </div>\n  </div>\n  <!-- END CONTENT -->\n</div>\n<!-- END SIDEBAR & CONTENT -->';});

define('text!tmpl/blog-post.html',[],function () { return '<ul class="breadcrumb">\n    <li><a href="#" data-nav>Home</a></li>\n    <li><a href="#blog" data-nav>Blog</a></li>\n    <li class="active">Blog Post</li>\n</ul>\n<!-- BEGIN SIDEBAR & CONTENT -->\n<div class="row margin-bottom-40">\n  <!-- BEGIN CONTENT -->\n  <div class="col-md-12 col-sm-12">\n    <h1>Blog Post</h1>\n    <div class="content-page">\n      <div class="row">\n        <!-- BEGIN LEFT SIDEBAR -->            \n        <div class="col-md-9 col-sm-9 blog-item">\n          <div class="blog-item-img">\n            <!-- BEGIN CAROUSEL -->            \n            <div class="front-carousel">\n              <div id="myCarousel" class="carousel slide">\n                <!-- Carousel items -->\n                <div class="carousel-inner">\n                  <div class="item">\n                    <img src="img/posts/img1.jpg" alt="">\n                  </div>\n                  <div class="item">\n                    <!-- BEGIN VIDEO -->   \n                    <iframe src="http://player.vimeo.com/video/56974716?portrait=0" style="width:100%; border:0" allowfullscreen="" height="259"></iframe>\n                    <!-- END VIDEO -->   \n                  </div>\n                  <div class="item active">\n                    <img src="img/posts/img3.jpg" alt="">\n                  </div>\n                </div>\n                <!-- Carousel nav -->\n                <a class="carousel-control left" href="#myCarousel" data-slide="prev">\n                  <i class="fa fa-angle-left"></i>\n                </a>\n                <a class="carousel-control right" href="#myCarousel" data-slide="next">\n                  <i class="fa fa-angle-right"></i>\n                </a>\n              </div>                \n            </div>\n            <!-- END CAROUSEL -->             \n          </div>\n          <h2><a href="#">Corrupti quos dolores etquas</a></h2>\n          <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non eleifend enim a feugiat. Pellentesque viverra vehicula sem ut volutpat. Lorem ipsum dolor sit amet, consectetur adipiscing condimentum eleifend enim a feugiat.</p>\n          <blockquote>\n            <p>Pellentesque ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante Integer posuere erat a ante.</p>\n            <small>Someone famous <cite title="Source Title">Source Title</cite></small>\n          </blockquote>                \n          <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero consectetur adipiscing elit magna. Sed et quam lacus. Fusce condimentum eleifend enim a feugiat. Pellentesque viverra vehicula sem ut volutpat. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero magna. Sed et quam lacus. Fusce condimentum eleifend enim a feugiat.</p>\n          <p>Culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero consectetur adipiscing elit magna. Sed et quam lacus. Fusce condimentum eleifend enim a feugiat. Pellentesque viverra vehicula sem ut volutpat. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero magna. Sed et quam lacus. Fusce condimentum eleifend enim a feugiat.</p>\n          <ul class="blog-info">\n            <li><i class="fa fa-user"></i> By admin</li>\n            <li><i class="fa fa-calendar"></i> 25/07/2013</li>\n            <li><i class="fa fa-comments"></i> 17</li>\n            <li><i class="fa fa-tags"></i> Metronic, Keenthemes, UI Design</li>\n          </ul>\n\n          <h2>Comments</h2>\n          <div class="comments">\n                                                          \n          </div>\n\n          <div class="post-comment padding-top-40">\n            <h3>Leave a Comment</h3>\n            <form role="form">\n              <div class="form-group">\n                <label>Name</label>\n                <input class="form-control" type="text">\n              </div>\n\n              <div class="form-group">\n                <label>Email <span class="color-red">*</span></label>\n                <input class="form-control" type="text">\n              </div>\n\n              <div class="form-group">\n                <label>Message</label>\n                <textarea class="form-control" rows="8"></textarea>\n              </div>\n              <p><button class="btn btn-primary" type="submit">Post a Comment</button></p>\n            </form>\n          </div>                      \n        </div>\n        <!-- END LEFT SIDEBAR -->\n\n        <!-- BEGIN RIGHT SIDEBAR -->            \n        <div class="col-md-3 col-sm-3 blog-sidebar">\n          <!-- CATEGORIES START -->\n          <h2 class="no-top-space">Categories</h2>\n          <ul class="nav sidebar-categories margin-bottom-40">\n            <li><a href="#">London (18)</a></li>\n            <li><a href="#">Moscow (5)</a></li>\n            <li class="active"><a href="#">Paris (12)</a></li>\n            <li><a href="#">Berlin (7)</a></li>\n            <li><a href="#">Istanbul (3)</a></li>\n          </ul>\n          <!-- CATEGORIES END -->\n\n          <!-- BEGIN RECENT NEWS -->                            \n          <h2>Recent News</h2>\n          <div class="recent-news margin-bottom-10">\n            <div class="row margin-bottom-10">\n              <div class="col-md-3">\n                <img class="img-responsive" alt="" src="img/people/img2-large.jpg">                        \n              </div>\n              <div class="col-md-9 recent-news-inner">\n                <h3><a href="#">Letiusto gnissimos</a></h3>\n                <p>Decusamus tiusto odiodig nis simos ducimus qui sint</p>\n              </div>                        \n            </div>\n            <div class="row margin-bottom-10">\n              <div class="col-md-3">\n                <img class="img-responsive" alt="" src="img/people/img1-large.jpg">                        \n              </div>\n              <div class="col-md-9 recent-news-inner">\n                <h3><a href="#">Deiusto anissimos</a></h3>\n                <p>Decusamus tiusto odiodig nis simos ducimus qui sint</p>\n              </div>                        \n            </div>\n            <div class="row margin-bottom-10">\n              <div class="col-md-3">\n                <img class="img-responsive" alt="" src="img/people/img3-large.jpg">                        \n              </div>\n              <div class="col-md-9 recent-news-inner">\n                <h3><a href="#">Tesiusto baissimos</a></h3>\n                <p>Decusamus tiusto odiodig nis simos ducimus qui sint</p>\n              </div>                        \n            </div>\n          </div>\n          <!-- END RECENT NEWS -->                            \n          \n          <!-- BEGIN BLOG TAGS -->\n          <div class="blog-tags margin-bottom-20">\n            <h2>Tags</h2>\n            <ul>\n              <li><a href="#"><i class="fa fa-tags"></i>OS</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Metronic</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Dell</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Conquer</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>MS</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Google</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Keenthemes</a></li>\n              <li><a href="#"><i class="fa fa-tags"></i>Twitter</a></li>\n            </ul>\n          </div>\n          <!-- END BLOG TAGS -->\n        </div>\n        <!-- END RIGHT SIDEBAR -->            \n      </div>\n    </div>\n  </div>\n  <!-- END CONTENT -->\n</div>\n<!-- END SIDEBAR & CONTENT -->';});

(function() {

  define('cs!frontend/templates',['handlebars', 'text!tmpl/index.html', 'text!tmpl/slider.html', 'text!tmpl/infographics.html', 'text!tmpl/about.html', 'text!tmpl/case.html', 'text!tmpl/case-maps.html', 'text!tmpl/cases.html', 'text!tmpl/contact.html', 'text!tmpl/faqs.html', 'text!tmpl/terms.html', 'text!tmpl/policy.html', 'text!tmpl/blog.html', 'text!tmpl/blog-post.html'], function(Handlebars, indexTmpl, sliderTmpl, infographicsTmpl, aboutTmpl, caseTmpl, caseMapsTmpl, casesTmpl, contactTmpl, faqsTmpl, termsTmpl, policyTmpl, blogTmpl, blogPostTmpl) {
    return {
      index: Handlebars.compile(indexTmpl),
      slider: Handlebars.compile(sliderTmpl),
      infographics: Handlebars.compile(infographicsTmpl),
      about: Handlebars.compile(aboutTmpl),
      case_: Handlebars.compile(caseTmpl),
      cases: Handlebars.compile(casesTmpl),
      case_maps: Handlebars.compile(caseMapsTmpl),
      contact: Handlebars.compile(contactTmpl),
      faqs: Handlebars.compile(faqsTmpl),
      terms: Handlebars.compile(termsTmpl),
      policy: Handlebars.compile(policyTmpl),
      blog: Handlebars.compile(blogTmpl),
      blog_post: Handlebars.compile(blogPostTmpl)
    };
  });

}).call(this);

(function() {

  define('cs!frontend/util',[], function() {
    /*
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
    */

    var root;
    root = (/^10|localhost/.test(location.hostname) ? "/picc/" : "/");
    return {
      errors: {
        connectionError: "Could not connect to server"
      },
      timeout: 3500,
      settings: {
        siteTitle: "PICC - Public Interest in Corruption Cases",
        rootUrl: root,
        apiUrl: root + "api/"
      },
      regexps: {
        email: /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,6}$/i,
        phone: /^\d{11,13}$/,
        username: /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,6}$/i,
        website: /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,6}$/i,
        password: /^\S{8,}$/,
        code: /^\d{4,10}$/
      },
      capitalize: function(str) {
        return str.substr(0, 1).toUpperCase() + str.substr(1);
      },
      loadScript: function(scriptId, scriptUrl) {
        return (function(d, s, id) {
          var fjs, js, p;
          js = void 0;
          fjs = d.getElementsByTagName(s)[0];
          p = (/^http:/.test(d.location) ? "http" : "https");
          if (!d.getElementById(id)) {
            js = d.createElement(s);
            js.id = id;
            js.src = p + '://' + scriptUrl;
            fjs.parentNode.insertBefore(js, fjs);
          }
        })(document, "script", scriptId);
      },
      removeScript: function(scriptId) {
        return (function(d, s, id) {
          if (d.getElementById(id)) {
            d.removeElementById(id);
          }
        })(document, "script", scriptId);
      }
    };
  });

}).call(this);

(function() {

  define('cs!frontend/models',['underscore', 'jquery', 'backbone', 'cs!frontend/util'], function(_, $, Backbone, util) {
    var Models;
    Models = {
      Base: Backbone.Model.extend({
        saveToLocalStorage: false,
        saveToSessionStorage: false,
        idAttribute: "_id",
        initialize: function(attrs, options) {
          this.on("error", this.__error, this);
          this.on("invalid", this.__invalid, this);
          this.on("sync", this.__sync, this);
          return typeof this.init === "function" ? this.init(options) : void 0;
        },
        namespace: function() {
          return this._namespace + ":" + this.id;
        },
        __sync: function(model, resp, options) {
          if (this.saveToLocalStorage) {
            localStorage.removeItem(this._namespace);
            if (resp._id) {
              return localStorage.setItem(this._namespace, JSON.stringify(this.attributes));
            }
          }
        },
        __error: function(model, xhr, options) {
          var _ref;
          delete this.validationError;
          this.xhrError = xhr.responseJSON || xhr.responseText || util.errors.connectionError;
          if ((_ref = this.collection) != null) {
            _ref.trigger("error", model, xhr, options);
          }
          return console.log(this.xhrError);
        },
        __invalid: function(model, error, options) {
          var _ref;
          delete this.xhrError;
          if ((_ref = this.collection) != null) {
            _ref.trigger("invalid", model, error, options);
          }
          return console.log(this.validationError);
        },
        create: function(attrs, callback) {
          if (this.id) {
            throw "Model already exists";
          }
          return this.save(attrs, {
            wait: true,
            success: callback
          });
        },
        update: function(attrs, callback) {
          if (!this.id) {
            throw "Model must be created first";
          }
          this.set(attrs);
          return this.save(this.changedAttributes, {
            wait: true,
            patch: true,
            success: callback
          });
        }
      })
    };
    Models.Agency = Models.Base.extend({
      urlRoot: "agencies"
    });
    Models.Court = Models.Base.extend({
      urlRoot: "courts"
    });
    Models.Case = Models.Base.extend({
      urlRoot: "cases"
    });
    Models.Judge = Models.Base.extend({
      urlRoot: "judges"
    });
    Models.Offender = Models.Base.extend({
      urlRoot: "offenders"
    });
    Models.Trial = Models.Base.extend({
      urlRoot: "trials"
    });
    Models.CaseSubscription = Models.Base.extend({
      urlRoot: "subscriptions",
      validate: function(attrs, options) {
        if (!attrs.case_id) {
          return "Case is required";
        }
        if (!attrs.email) {
          return "Your email address is required";
        }
        if (!util.regexps.email.test(attrs.email)) {
          return "Kindly enter a valid email address";
        }
      }
    });
    Models.Subscriber = Models.Base.extend({
      urlRoot: "subscribers",
      validate: function(attrs, options) {
        if (!attrs.email) {
          return "Your email address is required";
        }
        if (!util.regexps.email.test(attrs.email)) {
          return "Kindly enter a valid email address";
        }
      }
    });
    Models.Feedback = Models.Base.extend({
      urlRoot: "feedbacks",
      validate: function(attrs, options) {
        if (!attrs.name) {
          return "Your name is required";
        }
        if (!(attrs.name.length >= 6)) {
          return "Kindly enter your full name";
        }
        if (!attrs.email) {
          return "Your email address is required";
        }
        if (!util.regexps.email.test(attrs.email)) {
          return "Kindly enter a valid email address";
        }
        if (!attrs.message) {
          return "Your message is required";
        }
      }
    });
    Models.Infographic = Models.Base.extend({
      urlRoot: "infographics"
    });
    Models.BlogPost = Models.Base.extend({
      urlRoot: "posts"
    });
    return Models;
  });

}).call(this);

(function() {

  define('cs!frontend/collections',['backbone', 'cs!frontend/models'], function(Backbone, models) {
    var Collections;
    Collections = {
      Base: Backbone.Collection.extend({
        model: Backbone.Model,
        fetchOnInitialize: true,
        initialize: function(models, options) {
          if (typeof this.init === "function") {
            this.init(options);
          }
          if (this.fetchOnInitialize != null) {
            return this.fetch();
          }
        },
        resort: function(criteria) {
          if (criteria === this.currentSortCriteria) {
            return;
          }
          this.comparator = function(model) {
            return model.get(criteria);
          };
          return this.sort();
        }
      })
    };
    Collections.Infographics = Collections.Base.extend({
      model: models.Infographic,
      url: "infographics"
    });
    Collections.Cases = Collections.Base.extend({
      model: models.Case,
      url: "cases"
    });
    Collections.Offenders = Collections.Base.extend({
      model: models.Offender,
      url: "offenders"
    });
    Collections.BlogPosts = Collections.Base.extend({
      model: models.BlogPost,
      url: "posts"
    });
    return Collections;
  });

}).call(this);

(function() {

  define('cs!frontend/ready',['jquery'], function($) {
    var handleInit, handleResponsiveOnResize, handleScrollToTop, isIE10, isIE11, isIE8, isIE9, responsive, responsiveHandlers, runResponsiveHandlers, scrolltotop;
    isIE8 = false;
    isIE9 = false;
    isIE10 = false;
    isIE11 = false;
    responsive = true;
    responsiveHandlers = [];
    handleInit = function() {
      isIE8 = !!navigator.userAgent.match(/MSIE 8.0/);
      isIE9 = !!navigator.userAgent.match(/MSIE 9.0/);
      isIE10 = !!navigator.userAgent.match(/MSIE 10.0/);
      isIE11 = !!navigator.userAgent.match(/MSIE 11.0/);
      if (isIE10) {
        $("html").addClass("ie10");
      }
      if (isIE11) {
        return $("html").addClass("ie11");
      }
    };
    runResponsiveHandlers = function() {
      var each, i;
      for (i in responsiveHandlers) {
        each = responsiveHandlers[i];
        each.call();
      }
    };
    handleResponsiveOnResize = function() {
      var currheight, resize;
      resize = void 0;
      if (isIE8) {
        currheight = void 0;
        return $(window).resize(function() {
          if (currheight === document.documentElement.clientHeight) {
            return;
          }
          if (resize) {
            clearTimeout(resize);
          }
          resize = setTimeout(function() {
            runResponsiveHandlers();
          }, 50);
          currheight = document.documentElement.clientHeight;
        });
      } else {
        return $(window).resize(function() {
          if (resize) {
            clearTimeout(resize);
          }
          return resize = setTimeout(function() {
            runResponsiveHandlers();
          }, 50);
        });
      }
    };
    scrolltotop = {
      setting: {
        startline: 100,
        scrollto: 0,
        scrollduration: 1000,
        fadeduration: [500, 100]
      },
      controlHTML: "<img src=\"img/up.png\" style=\"width:40px; height:40px\" />",
      controlattrs: {
        offsetx: 10,
        offsety: 10
      },
      anchorkeyword: "#top",
      state: {
        isvisible: false,
        shouldvisible: false
      },
      scrollup: function() {
        var dest;
        if (!this.cssfixedsupport) {
          this.$control.css({
            opacity: 0
          });
        }
        dest = (isNaN(this.setting.scrollto) ? this.setting.scrollto : parseInt(this.setting.scrollto));
        if (typeof dest === "string" && $("#" + dest).length === 1) {
          dest = $("#" + dest).offset().top;
        } else {
          dest = 0;
        }
        this.$body.animate({
          scrollTop: dest
        }, this.setting.scrollduration);
      },
      keepfixed: function() {
        var $window, controlx, controly;
        $window = $(window);
        controlx = $window.scrollLeft() + $window.width() - this.$control.width() - this.controlattrs.offsetx;
        controly = $window.scrollTop() + $window.height() - this.$control.height() - this.controlattrs.offsety;
        this.$control.css({
          left: controlx + "px",
          top: controly + "px"
        });
      },
      togglecontrol: function() {
        var scrolltop;
        scrolltop = $(window).scrollTop();
        if (!this.cssfixedsupport) {
          this.keepfixed();
        }
        this.state.shouldvisible = (scrolltop >= this.setting.startline ? true : false);
        if (this.state.shouldvisible && !this.state.isvisible) {
          this.$control.stop().animate({
            opacity: 1
          }, this.setting.fadeduration[0]);
          this.state.isvisible = true;
        } else if (this.state.shouldvisible === false && this.state.isvisible) {
          this.$control.stop().animate({
            opacity: 0
          }, this.setting.fadeduration[1]);
          this.state.isvisible = false;
        }
      }
    };
    handleScrollToTop = function() {
      var iebrws, mainobj;
      mainobj = scrolltotop;
      iebrws = document.all;
      mainobj.cssfixedsupport = !iebrws || iebrws && document.compatMode === "CSS1Compat" && window.XMLHttpRequest;
      mainobj.$body = (window.opera ? (document.compatMode === "CSS1Compat" ? $("html") : $("body")) : $("html,body"));
      mainobj.$control = $("<div id=\"topcontrol\">" + mainobj.controlHTML + "</div>").css({
        position: (mainobj.cssfixedsupport ? "fixed" : "absolute"),
        bottom: mainobj.controlattrs.offsety,
        right: mainobj.controlattrs.offsetx,
        opacity: 0,
        cursor: "pointer"
      }).attr({
        title: "Scroll Back to Top"
      }).click(function() {
        mainobj.scrollup();
        return false;
      }).appendTo("body");
      if (document.all && !window.XMLHttpRequest && mainobj.$control.text() !== "") {
        mainobj.$control.css({
          width: mainobj.$control.width()
        });
      }
      mainobj.togglecontrol();
      $("a[href=\"" + mainobj.anchorkeyword + "\"]").click(function() {
        mainobj.scrollup();
        return false;
      });
      return $(window).bind("scroll resize", function(e) {
        return mainobj.togglecontrol();
      });
    };
    return {
      initResponsive: function() {
        handleInit();
        return handleResponsiveOnResize();
      },
      addResponsiveHandler: function(func) {
        return responsiveHandlers.push(func);
      },
      initScrollToTop: function() {
        return handleScrollToTop();
      }
    };
  });

}).call(this);

(function() {

  define('cs!frontend/views',['jquery', 'underscore', 'backbone', 'cs!frontend/templates', 'cs!frontend/models', 'cs!frontend/collections', 'cs!frontend/util', 'cs!frontend/ready', 'GMaps'], function($, _, Backbone, templates, models, collections, util, ready, GMaps) {
    var Views;
    _.extend(Backbone.View.prototype, {
      serialize: function(form) {
        var data, keys, values;
        data = $(form).serializeArray();
        keys = _.pluck(data, "name");
        values = _.pluck(data, "value");
        return _.object(keys, values);
      }
    });
    Views = {
      SubViews: {},
      Modal: Backbone.View.extend,
      Base: Backbone.View.extend({
        initialize: function(options) {
          if (this.onAttached != null) {
            this.on("attached", this.onAttached, this);
          }
          if (this.onDetached != null) {
            this.on("detached", this.onDetached, this);
          }
          if (this.onRendered != null) {
            this.on("rendered", this.onRendered, this);
          }
          if (typeof this.beforeInit === "function") {
            this.beforeInit();
          }
          if (typeof this.init === "function") {
            this.init(options);
          }
          if (this.isCollectionView != null) {
            this.collection.on("reset add remove", this.render, this);
          }
          if (this.isModelView != null) {
            this.model.on("change", this.render, this);
          }
          return this.render();
        },
        data: function() {
          var _ref, _ref1;
          return ((_ref = this.collection) != null ? _ref.toJSON() : void 0) || ((_ref1 = this.model) != null ? _ref1.toJSON() : void 0) || {};
        },
        render: function() {
          this.$el.html(this.template(this.data()));
          this.trigger("rendered");
          return this;
        }
      })
    };
    Views.Page = Views.Base.extend({
      className: "container",
      beforeInit: function() {
        if (this.title != null) {
          return window.title = util.settings.siteTitle + " - " + this.title;
        }
      }
    });
    Views.SubViews.Slider = Views.Base.extend({
      template: templates.slider,
      className: "page-slider margin-bottom-40",
      init: function() {
        return $("#main").before(this.$el);
      },
      onAttached: function() {
        return this.$(".fullwidthbanner").revolution({
          delay: 2000,
          startheight: 417,
          startwidth: 1150,
          hideThumbs: 10,
          thumbAmount: 5,
          shadow: 1,
          fullWidth: "on"
        });
      }
    });
    Views.SubViews.FooterSubscriptionBox = Backbone.View.extend({
      el: '.pre-footer-subscribe-box',
      initialize: function() {
        return this.model = new models.Subscriber;
      },
      events: {
        "submit form": "submit"
      },
      submit: function(ev) {
        ev.preventDefault();
        return this.model.create(this.serialize(ev.currentTarget));
      }
    });
    Views.SubViews.MenuSearch = Backbone.View.extend({
      el: "li.menu-search",
      initialize: function() {
        this.$btn = this.$('.search-btn');
        return this.$box = this.$('.search-box');
      },
      events: {
        "click .search-btn": "reveal",
        "submit form": "submit"
      },
      hide: function() {
        if (this.$btn.hasClass("show-search-icon")) {
          this.$btn.removeClass("show-search-icon");
          return this.$box.fadeOut(300);
        }
      },
      reveal: function(ev) {
        ev.stopImmediatePropagation();
        if (this.$btn.hasClass("show-search-icon")) {
          if ($(window).width() > 767) {
            this.$box.fadeOut(300);
          } else {
            this.$box.fadeOut(0);
          }
          return this.$btn.removeClass("show-search-icon");
        } else {
          if ($(window).width() > 767) {
            this.$box.fadeIn(300);
          } else {
            this.$box.fadeIn(0);
          }
          return this.$btn.addClass("show-search-icon");
        }
      },
      submit: function(ev) {
        ev.preventDefault();
        return this.model.create(this.serialize(ev.currentTarget));
      }
    });
    Views.Infographics = Views.Page.extend({
      title: "Infographics",
      template: templates.infographics,
      init: function() {
        return this.collection = new collections.Infographics;
      },
      onAttached: function() {
        this.$(".fancybox-fast-view").fancybox();
        this.$(".fancybox-button").fancybox({
          groupAttr: "data-rel",
          prevEffect: "none",
          nextEffect: "none",
          helpers: {
            title: {
              type: "inside"
            }
          }
        });
        return this.$(".mix-grid").mixItUp();
      }
    });
    Views.Index = Views.Page.extend({
      title: "Home",
      template: templates.index,
      init: function() {
        return this.slider = new Views.SubViews.Slider;
      },
      onRendered: function() {
        return this.slider.trigger("attached");
      },
      onAttached: function() {
        this.$(".owl-carousel6-brands").owlCarousel({
          pagination: false,
          navigation: true,
          items: 4,
          addClassActive: true,
          itemsCustom: [[0, 1], [320, 1], [480, 2], [700, 3], [975, 4], [1200, 4], [1400, 4], [1600, 4]]
        });
        this.$(".owl-carousel3").owlCarousel({
          pagination: false,
          navigation: true,
          items: 3,
          addClassActive: true,
          itemsCustom: [[0, 1], [320, 1], [480, 2], [700, 3], [768, 2], [1024, 3], [1200, 3], [1400, 3], [1600, 3]]
        });
        return this.$(".fancybox-button").fancybox({
          groupAttr: "data-rel",
          prevEffect: "none",
          nextEffect: "none",
          helpers: {
            title: {
              type: "inside"
            }
          }
        });
      },
      remove: function() {
        this.slider.remove();
        return this.$el.remove();
      }
    });
    Views.Static = Views.Page.extend({
      init: function(options) {
        this.template = templates[options.page];
        switch (options.page) {
          case 'faqs':
            return this.title = "Frequently Asked Questions";
          case 'terms':
            return this.title = "Our Terms of Service";
          case 'policy':
            return this.title = "Our Privacy Policy";
          case 'about':
            return this.title = "About Us";
        }
      }
    });
    Views.CaseMaps = Views.Page.extend({
      title: "Case Maps",
      template: templates.case_maps,
      init: function() {
        return this.collection = new collections.Cases;
      },
      onAttached: function() {
        /*
        map = new GMaps
          div: "#map"
          lat: -13.004333
          lng: -38.494333      
        marker = map.addMarker
          lat: -13.004333
          lng: -38.494333
          title: "A sample case title"
          infoWindow:
            content: "<b>A sample case title</b> At Federal High Court, Lagos"
        marker.infoWindow.open map, marker
        */

      }
    });
    Views.Case = Views.Page.extend({
      template: templates.case_,
      isModelView: true,
      init: function() {}
    });
    Views.Cases = Views.Page.extend({
      title: 'Cases',
      template: templates.cases,
      isCollectionView: true,
      init: function() {
        return this.collection = new collections.Cases;
      }
    });
    Views.BlogPost = Views.Page.extend({
      template: templates.blog_post,
      isModelView: true,
      init: function() {}
    });
    Views.Blog = Views.Page.extend({
      title: 'PICC Blog',
      template: templates.blog,
      isCollectionView: true,
      init: function() {
        return this.collection = new collections.BlogPosts;
      }
    });
    Views.Contact = Views.Page.extend({
      title: "Contact Us",
      template: templates.contact,
      init: function() {
        this.model = new models.Feedback;
        return this.model.on("invalid error", this.alert, this);
      },
      alert: function() {
        return alert(this.model.validationError || this.model.xhrError);
      },
      onAttached: function() {
        var map, marker;
        map = new GMaps({
          div: "#map",
          lat: 6.504098,
          lng: 3.377853
        });
        marker = map.addMarker({
          lat: 6.504098,
          lng: 3.377853,
          title: "PICC Nigeria",
          infoWindow: {
            content: "<b>PICC Nigeria</b><br>Co-Creation Hub<br>294 Herbert Macaulay Way, Yaba<br>Lagos, Nigeria"
          }
        });
        return marker.infoWindow.open(map, marker);
      },
      events: {
        "submit form": "submit"
      },
      submit: function(ev) {
        ev.preventDefault();
        return this.model.create(this.serialize(ev.currentTarget), function() {
          alert("Message sent! We'll get back to you shortly.");
          return ev.currentTarget.reset();
        });
      }
    });
    return Backbone.View.extend({
      el: "#main",
      initialize: function() {
        ready.initResponsive();
        ready.initScrollToTop();
        new Views.SubViews.MenuSearch;
        new Views.SubViews.FooterSubscriptionBox;
        return util.loadScript('twitter-wjs', 'platform.twitter.com/widgets.js');
      },
      render: function(view) {
        var _ref;
        if ((_ref = this.view) != null) {
          _ref.remove();
        }
        this.view = view;
        this.$el.html(view.el);
        return this.view.trigger("attached");
      },
      renderIndex: function() {
        return this.render(new Views.Index);
      },
      renderCaseMaps: function() {
        return this.render(new Views.CaseMaps);
      },
      renderCases: function() {
        return this.render(new Views.Cases);
      },
      renderCase: function(case_id) {
        return this.render(new Views.Case({
          case_id: case_id
        }));
      },
      renderStatic: function(page) {
        return this.render(new Views.Static({
          page: page
        }));
      },
      renderBlog: function() {
        return this.render(new Views.Blog);
      },
      renderBlogPost: function(post) {
        return this.render(new Views.BlogPost);
      },
      renderInfographics: function() {
        return this.render(new Views.Infographics);
      },
      renderContact: function() {
        return this.render(new Views.Contact);
      }
    });
  });

}).call(this);

(function() {

  define('cs!frontend/router',['jquery', 'underscore', 'backbone', 'cs!frontend/views', 'cs!frontend/util'], function($, _, Backbone, MainView, util) {
    return (function() {
      var Router, instance;
      Router = Backbone.Router.extend({
        routes: {
          "": "index",
          about: "about",
          "about/:page": "about",
          faqs: "faqs",
          cases: "cases",
          "case-maps": "case_maps",
          contact: "contact",
          infographics: "infographics",
          blog: "blog",
          "blog/:post": "blog_post"
        },
        initialize: function() {
          var _this = this;
          $(function() {
            _this.appView = new MainView({
              router: _this
            });
            return Backbone.history.start({
              pushState: true,
              root: util.settings.rootUrl
            });
          });
          return $(document).on("click", "a[data-nav]", function(ev) {
            var href;
            href = ev.currentTarget.href;
            if (href && href.indexOf("#")) {
              ev.preventDefault();
              return _this.navigate(href.split("#")[1], true);
            }
          });
        },
        index: function() {
          return this.appView.renderIndex();
        },
        about: function(page) {
          return this.appView.renderStatic(page || "about");
        },
        faqs: function() {
          return this.appView.renderStatic("faqs");
        },
        cases: function() {
          return this.appView.renderCases();
        },
        case_maps: function() {
          return this.appView.renderCaseMaps();
        },
        contact: function() {
          return this.appView.renderContact();
        },
        infographics: function() {
          return this.appView.renderInfographics();
        },
        blog: function() {
          return this.appView.renderBlog();
        },
        blog_post: function(post) {
          return this.appView.renderBlogPost({
            post: post
          });
        }
      });
      instance = null;
      return {
        getInstance: function() {
          if (instance == null) {
            instance = new Router;
          }
          return instance;
        }
      };
    })();
  });

}).call(this);

require(['backbone','cs!frontend/router','cs!frontend/util'],function(Backbone,Router,util){
  Backbone.$.ajaxPrefilter(function(options, originalOptions, jqXhr) {
    options.url = util.settings.apiUrl + options.url;
  });
  Router.getInstance();
});
define("frontend/index", function(){});
