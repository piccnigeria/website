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

define('text!tmpl/index.html',[],function () { return '<div class="row service-box margin-bottom-40">\r\n  <div class="col-md-4 col-sm-4 text-center">\r\n    <div class="service-box-heading">\r\n      <h1><i class="fa fa-search"></i></h1>\r\n      <strong>Search for Cases</strong>\r\n      <p>Browse through the collection of cases in our database, or search for any specific case by the name of person involved or charges to view details of the case.</p>\r\n    </div>\r\n  </div>\r\n  <div class="col-md-4 col-sm-4 text-center">\r\n    <div class="service-box-heading">\r\n      <h1><i class="fa fa-bell-o"></i></h1>\r\n      <strong>Subscribe to Updates</strong>\r\n      <p>Find an interesting case you want to keep track of? Simply subscribe for updates on that particular case, and we\'d be prompt to email you with developments on that case.</p>\r\n    </div>\r\n  </div>\r\n  <div class="col-md-4 col-sm-4 text-center">\r\n    <div class="service-box-heading">\r\n      <h1><i class="fa fa-share-alt"></i></h1>\r\n      <strong>Share with friends</strong>\r\n      <p>Let your friends and networks know the cases you\'re following, so together we can keep the fight against corruption going, and ensure justice is served.</p>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="row recent-infographics margin-bottom-40">\r\n  <div class="col-md-3">\r\n    <h2>Infographics</h2>\r\n    <p>A picture is worth a thousand words. Therefore we use infographics that go viral to pass crucial information in a snapshot. Here are some of our recent infographics. <br><a href="#infographics" data-nav>See all</a></p>\r\n  </div>\r\n  <div class="col-md-9">\r\n    <div class="owl-carousel owl-carousel3">\r\n      <div class="recent-infographic-item">\r\n        <em>\r\n          <img src="img/infographics/img2_small.jpg" alt="Amazing Project" class="img-responsive">\r\n          <a href="img/infographics/img2.jpg" class="fancybox-button" title="Project Name #1" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\r\n        </em>\r\n        <a class="recent-infographic-description" href="#">\r\n          <strong>A Year in EFCC</strong>\r\n          <b>Profiles the efforts of the EFCC in 2013</b>\r\n        </a>\r\n      </div>\r\n      <div class="recent-infographic-item">\r\n        <em>\r\n          <img src="img/infographics/img3_small.jpg" alt="Amazing Project" class="img-responsive">\r\n          <a href="img/infographics/img3.jpg" class="fancybox-button" title="Project Name #2" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\r\n        </em>\r\n        <a class="recent-infographic-description" href="#">\r\n          <strong>Some Facts about Corruption Trials</strong>\r\n          <b>A "Did you know?" series</b>\r\n        </a>\r\n      </div>\r\n      <div class="recent-infographic-item">\r\n        <em>\r\n          <img src="img/infographics/img1_small.jpg" alt="Amazing Project" class="img-responsive">\r\n          <a href="img/infographics/img1.jpg" class="fancybox-button" title="Project Name #3" data-rel="fancybox-button"><i class="fa fa-search"></i></a>\r\n        </em>\r\n        <a class="recent-infographic-description" href="#">\r\n          <strong>Assets Recovery</strong>\r\n          <b>A "Did you know?" series</b>\r\n        </a>\r\n      </div>      \r\n    </div>       \r\n  </div>\r\n</div>\r\n\r\n<div class="row margin-bottom-40 partners">\r\n  <div class="col-md-3">\r\n    <h2>Supporters</h2>\r\n    <p>The PICC is proudly supported by the following organizations.</p>\r\n  </div>\r\n  <div class="col-md-9">\r\n    <div class="owl-carousel owl-carousel6-brands">\r\n      <div class="partner">\r\n        <a href="#">\r\n          <img src="img/partners/partner_1_gray.png" class="img-responsive" alt="">\r\n          <img src="img/partners/partner_1.png" class="color-img img-responsive" alt="">\r\n        </a>\r\n      </div>\r\n      <div class="partner">\r\n        <a href="#">\r\n          <img src="img/partners/partner_2_gray.png" class="img-responsive" alt="">\r\n          <img src="img/partners/partner_2.png" class="color-img img-responsive" alt="">\r\n        </a>\r\n      </div>\r\n      <div class="partner">\r\n        <a href="#">\r\n          <img src="img/partners/partner_3_gray.png" class="img-responsive" alt="">\r\n          <img src="img/partners/partner_3.png" class="color-img img-responsive" alt="">\r\n        </a>\r\n      </div>\r\n      <div class="partner">\r\n        <a href="#">\r\n          <img src="img/partners/partner_4_gray.png" class="img-responsive" alt="">\r\n          <img src="img/partners/partner_4.png" class="color-img img-responsive" alt="">\r\n        </a>\r\n      </div>              \r\n    </div>\r\n  </div>          \r\n</div>';});


define('text!tmpl/slider.html',[],function () { return '<div class="fullwidthbanner-container">\r\n  <div class="fullwidthbanner">\r\n    <div class="container">\r\n      <form name="top-level-search-box">\r\n\t    <div class="input-group">\r\n\t      <input type="text" name="search" placeholder="Search for cases by offender\'s name or charges" class="form-control">\r\n\t      <span class="input-group-btn">\r\n\t         <button class="btn btn-primary" type="submit">Search</button>\r\n\t      </span>\r\n\t    </div>\r\n\t  </form>\r\n   </div>\r\n  </div>\r\n</div>';});


define('text!tmpl/infographics.html',[],function () { return '<ul class="breadcrumb">\r\n  <li><a href="#" data-nav>Home</a></li>\r\n  <li class="active">Infographics</li>\r\n</ul>\r\n\r\n<div class="row margin-bottom-40">\r\n  <div class="col-md-12 col-sm-12">\r\n    <h1>Infographics</h1>\r\n    <div class="content-page">\r\n      <div class="filter-v1">\r\n        <ul class="mix-filter">\r\n          <li data-filter="all" class="filter active">All</li>\r\n          <li data-filter="category_1" class="filter">Did You Know?</li>\r\n          <li data-filter="category_2" class="filter"></li>\r\n          <li data-filter="category_3" class="filter"></li>\r\n        </ul>\r\n\r\n        <div class="row mix-grid thumbnails">\r\n          \r\n          <div class="col-md-4 col-sm-6 mix category_1 mix_all" style="display:block;opacity:1;">\r\n            <div class="mix-inner">\r\n              <img alt="" src="img/infographics/img2.jpg" class="img-responsive">\r\n              <div class="mix-details">\r\n                <h4>A Year in EFCC</h4>\r\n                <p>This infographic was created to profile the effort and accomplishment of the Economic and Financial Crimes Commission, EFFC, in their fight against corruption in the year 2013.</p>\r\n                <a class="mix-link"><i class="fa fa-link"></i></a>\r\n                <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img2.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>\r\n              </div>           \r\n            </div>                       \r\n          </div>\r\n          \r\n          <div class="col-md-4 col-sm-6 mix category_2 mix_all" style="display:block;opacity:1;">\r\n            <div class="mix-inner">\r\n              <img alt="" src="img/infographics/img1.jpg" class="img-responsive">\r\n              <div class="mix-details">\r\n                <h4>Assets Recovery</h4>\r\n                <p>This infographic shows the monetary valuation of assets recovered from all cases prosecuted by the EFCC in 2013 alone. This is part of our "Did You Know?" series created to educate the public on facts about corruption. </p>\r\n                <a class="mix-link"><i class="fa fa-link"></i></a>\r\n                <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img1.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>\r\n              </div>               \r\n            </div>                    \r\n          </div>\r\n          \r\n          <div class="col-md-4 col-sm-6 mix category_3 mix_all" style="display:block;opacity:1;">\r\n            <div class="mix-inner">\r\n              <img alt="" src="img/infographics/img3.jpg" class="img-responsive">\r\n              <div class="mix-details">\r\n                <h4>Some Facts about Corruption Trials</h4>\r\n                <p>Developed from crunching the data we have on corruption cases in Nigeria since 2005, this infographic tells how serious the fight against corruption should be because of its impact on the country\'s economy.</p>\r\n                <a class="mix-link"><i class="fa fa-link"></i></a>\r\n                <a data-rel="fancybox-button" title="Project Name" href="img/infographics/img3.jpg" class="mix-preview fancybox-button"><i class="fa fa-search"></i></a>\r\n              </div>              \r\n            </div>      \r\n          </div>\r\n          \r\n        </div>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>';});


define('text!tmpl/about.html',[],function () { return '<ul class="breadcrumb">\r\n    <li><a href="#" data-nav>Home</a></li>\r\n    <li class="active">About Us</li>\r\n</ul>\r\n\r\n<div class="row margin-bottom-40">  \r\n  <div class="col-md-12 col-sm-12">\r\n    <h1>About Us</h1>\r\n    <div class="content-page">\r\n      <div class="row margin-bottom-30">\r\n        <div class="col-md-8">\r\n          <p>Public Interest In Corruption Cases (PICC) is an idea conceptualized and hacked at the Civic Codeathon a 3-days event organized by BudgIT and sponsored by United States Department of State Bureau of International Narcotics and Law Enforcement Affairs (INL) in may 2014.</p>\r\n\r\n          <p>PICC is aimed at citizen participation in governance and understanding the dynamics of corruption within the Nigerian State.</p>\r\n\r\n          <p>Corruption costs the state and citizens millions every year in lost funds for economic and social development. While new institutions have been set up to root out corruption and cases are going to trial there seems to be lack of interest in corruption cases after the initial charge and arraignment of suspects. With slow justice system, news reports of corruption cases lose steam and journalists and the general public quickly moves on to other news.</p>\r\n\r\n          <p>PICC seeks to be the one-stop reference portal for current as well as archived information on corruption cases in Nigeria. </p>\r\n\r\n          <p>The PICC portal will help in: </p>\r\n          <ul>\r\n            <li>raising the interest of Nigerians in the prosecution of corruption, </li>\r\n            <li>increasing public confidence and awareness on efficiency of the judicial system, </li>\r\n            <li>serving as a reference point for information on corruption prosecution, </li>\r\n            <li>providing a timeline for following progress on corruption cases, </li>\r\n            <li>providing timely information and feedback on the progress of cases, </li>\r\n            <li>indicating possible opportunities for justiciable grounds in each case, </li>\r\n            <li>allowing people’s opinion on the development of corruption cases. </li>\r\n          </ul>\r\n\r\n          <p>The tool will be targeting civil society groups, lawyers, literate citizens and concentrated groups in order to fight judicial corruption, engage everyday citizens in these processes by giving them access to information and to make a more transparent government environment in Nigeria.</p>\r\n        </div>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>';});


define('text!tmpl/case.html',[],function () { return '<ul class="breadcrumb">\r\n    <li><a href="#" data-nav>Home</a></li>\r\n    <li><a href="#cases" data-nav>Cases</a></li>\r\n    <li class="active">Case</li>\r\n</ul>\r\n\r\n<div class="row margin-bottom-40">\r\n  <div class="col-md-12 col-sm-12">\r\n    <h1>{{{title}}}</h1>\r\n    <div class="content-page">\r\n      <div class="row margin-bottom-30">\r\n        <div class="col-md-7">\r\n          <h2 class="no-top-space">Vero eos et accusamus</h2>\r\n          <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi.</p> \r\n          <p>Idest laborum et dolorum fuga. Et harum quidem rerum et quas molestias excepturi sint occaecati facilis est et expedita distinctio lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero consectetur adipiscing elit magna. Sed et quam lacus.</p>\r\n          \r\n        </div>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>';});


define('text!tmpl/case-maps.html',[],function () { return '<ul class="breadcrumb">\r\n    <li><a href="#" data-nav>Home</a></li>\r\n    <li class="active">Case Maps</li>\r\n</ul>\r\n<!-- BEGIN SIDEBAR & CONTENT -->\r\n<div class="row margin-bottom-40">\r\n  <!-- BEGIN CONTENT -->\r\n  <div class="col-md-12 col-sm-12">\r\n    <div id="map" class="gmaps margin-bottom-40"></div>\r\n  </div>\r\n  <!-- END CONTENT -->\r\n</div>\r\n<!-- END SIDEBAR & CONTENT -->';});


define('text!tmpl/cases.html',[],function () { return '<ul class="breadcrumb">\r\n    <li><a href="#" data-nav>Home</a></li>\r\n    <li class="active">Cases</li>\r\n</ul>\r\n<div class="row margin-bottom-40">\r\n  <div class="col-md-12 col-sm-12">\r\n    <h1>Cases</h1>\r\n    <div class="content-page">\r\n      <div class="row margin-bottom-30">\r\n        <div class="col-md-9 col-sm-9">\r\n          <form name="" class="content-search-view2">\r\n            <div class="input-group">\r\n              <input type="text" class="form-control" placeholder="Search...">\r\n              <span class="input-group-btn">\r\n                <button type="submit" class="btn btn-primary">Search</button>\r\n              </span>\r\n            </div>\r\n          </form>\r\n          {{#each this}}\r\n          <div class="search-result-item">\r\n            <h4><a href="#case">{{{title}}}</a></h4>\r\n            <p>{{{description}}}</p>\r\n            <ul class="blog-info">\r\n              <li><i class="fa fa-gavel"></i> {{charge_number}}</li>\r\n              <li><i class="fa fa-calendar"></i> {{charge_date}}</li>\r\n              <li><i class="fa fa-map-marker"></i> {{court_state}}</li>\r\n              <li><i class="fa fa-tags"></i> {{tags}}</li>\r\n            </ul>\r\n          </div>\r\n          {{/each}}\r\n          <div class="row">\r\n            <div class="col-md-4 col-sm-4 items-info">Cases 1 to 9 of 10 total</div>\r\n            <div class="col-md-8 col-sm-8">\r\n              <ul class="pagination pull-right">\r\n                <li><a href="#">«</a></li>\r\n                <li><a href="#">1</a></li>\r\n                <li><span>2</span></li>\r\n                <li><a href="#">3</a></li>\r\n                <li><a href="#">4</a></li>\r\n                <li><a href="#">5</a></li>\r\n                <li><a href="#">»</a></li>\r\n              </ul>\r\n            </div>\r\n          </div>\r\n        </div>\r\n        <div class="col-md-3 col-sm-3 blog-sidebar">\r\n          <div class="blog-tags margin-bottom-20">\r\n            <h2>Tags</h2>\r\n            <ul>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Money laundering</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Forgery</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Stealing</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Counterfeiting</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Impersonation</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Misappropriation</a></li>              \r\n            </ul>\r\n          </div>\r\n        </div>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>';});


define('text!tmpl/contact.html',[],function () { return '<ul class="breadcrumb">\r\n    <li><a href="#" data-nav>Home</a></li>\r\n    <li class="active">Contact Us</li>\r\n</ul>\r\n<div class="row margin-bottom-40">\r\n  <div class="col-md-12">\r\n    <h1>Contacts</h1>\r\n    <div class="content-page">\r\n      <div class="row">\r\n        <div class="col-md-12">\r\n          <div id="map" class="gmaps margin-bottom-40" style="height:400px;"></div>\r\n        </div>\r\n        <div class="col-md-9 col-sm-9">\r\n          <h2>Contact Form</h2>\r\n          <p>Whether you are looking to say hi, or want to find out about our services, we love to hear from you.</p>\r\n          <form role="form">\r\n            <div class="form-group">\r\n              <label for="contacts-name">Name</label>\r\n              <input name="name" type="text" class="form-control" id="contacts-name">\r\n            </div>\r\n            <div class="form-group">\r\n              <label for="contacts-email">Email</label>\r\n              <input name="email" type="email" class="form-control" id="contacts-email">\r\n            </div>\r\n            <div class="form-group">\r\n              <label for="contacts-message">Message</label>\r\n              <textarea name="message" class="form-control" rows="5" id="contacts-message"></textarea>\r\n            </div>\r\n            <button type="submit" class="btn btn-primary"><i class="icon-ok"></i> Send</button>\r\n            <button type="button" class="btn btn-default">Cancel</button>\r\n          </form>\r\n        </div>\r\n\r\n        <div class="col-md-3 col-sm-3 sidebar2">\r\n          <h4>Our Contacts</h4>\r\n          <address>\r\n            <strong>PICC Nigeria</strong><br>\r\n            294 Herbert Macaulay Way, Yaba<br>\r\n            Lagos, Nigeria<br>\r\n            <abbr title="Phone">P:</abbr> (234) 703 6188 527\r\n          </address>\r\n          <address>\r\n            <strong>Email</strong><br>\r\n            <a href="mailto:info@picc.com.ng">info@picc.com.ng</a><br>\r\n            <a href="mailto:subscribe@example.com">subscribe@picc.com.ng</a>\r\n          </address>\r\n          <ul class="social-icons margin-bottom-40">\r\n            <li><a href="http://facebook.com/piccnigeria" target="_blank" data-original-title="facebook" class="facebook"></a></li>\r\n            <li><a href="http://twitter.com/piccnigeria" target="_blank" data-original-title="twitter" class="twitter"></a></li>\r\n            <li><a href="http://google.com/+PICCNigeria" target="_blank" data-original-title="Google+" class="googleplus"></a></li>\r\n            <li><a href="http://github.com/piccnigeria" target="_blank" data-original-title="github" class="github"></a></li>\r\n          </ul>\r\n        </div>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>';});


define('text!tmpl/faqs.html',[],function () { return '        <ul class="breadcrumb">\r\n            <li><a href="#" data-nav>Home</a></li>\r\n            <li><a href="#about" data-nav>About Us</a></li>\r\n            <li class="active">FAQs</li>\r\n        </ul>\r\n        <!-- BEGIN SIDEBAR & CONTENT -->\r\n        <div class="row margin-bottom-40">\r\n          <!-- BEGIN CONTENT -->\r\n          <div class="col-md-12 col-sm-12">\r\n            <h1>Frequently Asked Questions</h1>\r\n            <div class="content-page">\r\n              <div class="row margin-bottom-30">\r\n                <!-- BEGIN INFO BLOCK -->               \r\n                <div class="col-md-7">\r\n                  <h2 class="no-top-space">Vero eos et accusamus</h2>\r\n                  <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi.</p> \r\n                  <p>Idest laborum et dolorum fuga. Et harum quidem rerum et quas molestias excepturi sint occaecati facilis est et expedita distinctio lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero consectetur adipiscing elit magna. Sed et quam lacus.</p>\r\n                  <!-- BEGIN LISTS -->\r\n                  <div class="row front-lists-v1">\r\n                    <div class="col-md-6">\r\n                      <ul class="list-unstyled margin-bottom-20">\r\n                        <li><i class="fa fa-check"></i> Officia deserunt molliti</li>\r\n                        <li><i class="fa fa-check"></i> Consectetur adipiscing </li>\r\n                        <li><i class="fa fa-check"></i> Deserunt fpicia</li>\r\n                      </ul>\r\n                    </div>\r\n                    <div class="col-md-6">\r\n                      <ul class="list-unstyled">\r\n                        <li><i class="fa fa-check"></i> Officia deserunt molliti</li>\r\n                        <li><i class="fa fa-check"></i> Consectetur adipiscing </li>\r\n                        <li><i class="fa fa-check"></i> Deserunt fpicia</li>\r\n                      </ul>\r\n                    </div>\r\n                  </div>\r\n                  <!-- END LISTS -->\r\n                </div>\r\n                <!-- END INFO BLOCK -->\r\n                \r\n              </div>\r\n\r\n            </div>\r\n          </div>\r\n          <!-- END CONTENT -->\r\n        </div>\r\n        <!-- END SIDEBAR & CONTENT -->';});


define('text!tmpl/terms.html',[],function () { return '<ul class="breadcrumb">\r\n  <li><a href="#" data-nav>Home</a></li>\r\n  <li><a href="#about" data-nav>About Us</a></li>\r\n  <li class="active">Terms of Service</li>\r\n</ul>\r\n\r\n<div class="row margin-bottom-40">\r\n  <div class="col-md-12 col-sm-12">\r\n    <h1>Terms of Service</h1>\r\n    <div class="content-page">\r\n      <div class="row margin-bottom-30">\r\n        <div class="col-md-8">\r\n          <h4 class="text-highlight">Introduction</h4>\r\n          <p>\r\n            These terms and conditions govern your use of this website; by using this website, you accept these terms and conditions in full. If you disagree with these terms and conditions or any part of these terms and conditions, you must not use this website.\r\n          </p>\r\n          <p>\r\n            You must be at least 18 years of age to use this website. By using this website and by agreeing to these terms and conditions you warrant and represent that you are at least 18 years of age.\r\n          </p>\r\n          <p>\r\n            This website uses cookies. By using this website and agreeing to these terms and conditions, you consent to our PICC\'s use of cookies in accordance with the terms of PICC\'s privacy policy.\r\n          </p>\r\n          <h4 class="text-highlight">License to use website</h4>\r\n          <p>\r\n            Unless otherwise stated, PICC and/or its licensors own the intellectual property rights in the website and material on the website. Subject to the license below, all these intellectual property rights are reserved.\r\n          </p>\r\n          <p>\r\n            You may view, download for caching purposes only, and print pages from the website for your own personal use, subject to the restrictions set out below and elsewhere in these terms and conditions.\r\n          </p>\r\n          <p>\r\n              You must not:\r\n          </p>\r\n          <ul>\r\n              <li>republish material from this website (including republication on another website);</li>\r\n              <li>sell, rent or sub-license material from the website;</li>\r\n              <li>show any material from the website in public;</li>\r\n              <li>reproduce, duplicate, copy or otherwise exploit material on this website for a commercial purpose;</li>\r\n              <li>edit or otherwise modify any material on the website; or</li>\r\n              <li>redistribute material from this website except for content specifically and expressly made available for redistribution.</li>\r\n          </ul>\r\n          <p>Where content is specifically made available for redistribution, it may only be redistributed [within your organisation.\r\n          </p>\r\n          <h4 class="text-highlight">Acceptable use</h4>\r\n          <p>\r\n            You must not use this website in any way that causes, or may cause, damage to the website or impairment of the availability or accessibility of the website; or in any way which is unlawful, illegal, fraudulent or harmful, or in connection with any unlawful, illegal, fraudulent or harmful purpose or activity.\r\n          </p>\r\n          <p>\r\n            You must not use this website to copy, store, host, transmit, send, use, publish or distribute any material which consists of (or is linked to) any spyware, computer virus, Trojan horse, worm, keystroke logger, rootkit or other malicious computer software.\r\n          </p>\r\n          <p>\r\n            You must not conduct any systematic or automated data collection activities (including without limitation scraping, data mining, data extraction and data harvesting) on or in relation to this website without PICC\'s express written consent.\r\n          </p>\r\n          <p>\r\n              You must not use this website to transmit or send unsolicited commercial communications.\r\n          </p>\r\n          <p>\r\n              You must not use this website for any purposes related to marketing without PICC\'s express written consent.\r\n          </p>\r\n          <h4>Restricted access</h4>\r\n          <p>\r\n              Access to certain areas of this website is restricted. PICC reserves the right to restrict access to areas of this website, or indeed this entire website, at PICC\'s discretion.\r\n          </p>\r\n          <p>\r\n              If PICC provides you with a user ID and password to enable you to access restricted areas of this website or other content or services, you must ensure that the user ID and password are kept confidential.\r\n          </p>\r\n          <p>\r\n              PICC may disable your user ID and password in PICC\'s sole discretion without notice or explanation.\r\n          </p>\r\n          <h4 class="text-highlight">User content</h4>\r\n          <p>\r\n              In these terms and conditions, “your user content” means material (including without limitation text, images, audio material, video material and audio-visual material) that you submit to this website, for whatever purpose.\r\n          </p>\r\n          <p>\r\n              You grant to PICC a worldwide, irrevocable, non-exclusive, royalty-free license to use, reproduce, adapt, publish, translate and distribute your user content in any existing or future media. You also grant to PICC the right to sub-license these rights, and the right to bring an action for infringement of these rights.\r\n          </p>\r\n          <p>\r\n              Your user content must not be illegal or unlawful, must not infringe any third party\'s legal rights, and must not be capable of giving rise to legal action whether against you or PICC or a third party (in each case under any applicable law).\r\n          </p>\r\n          <p>\r\n              You must not submit any user content to the website that is or has ever been the subject of any threatened or actual legal proceedings or other similar complaint.\r\n          </p>\r\n          <p>\r\n              PICC reserves the right to edit or remove any material submitted to this website, or stored on PICC\'s servers, or hosted or published upon this website.\r\n          </p>\r\n          <p>\r\n              Notwithstanding PICC\'s rights under these terms and conditions in relation to user content, PICC does not undertake to monitor the submission of such content to, or the publication of such content on, this website.\r\n          </p>\r\n          <h4 class="text-highlight">No warranties</h4>\r\n          <p>\r\n              This website is provided “as is” without any representations or warranties, express or implied. PICC makes no representations or warranties in relation to this website or the information and materials provided on this website.\r\n          </p>\r\n          <p>\r\n              Without prejudice to the generality of the foregoing paragraph, PICC does not warrant that:\r\n          </p>\r\n          <ul>\r\n              <li>this website will be constantly available, or available at all; or</li>\r\n              <li>the information on this website is complete, true, accurate or non-misleading.</li>\r\n          </ul>\r\n          <p>\r\n              Nothing on this website constitutes, or is meant to constitute, advice of any kind. If you require advice in relation to any legal, financial or medical matter you should consult an appropriate professional.\r\n          </p>\r\n          <h4 class="text-highlight">Limitations of liability</h4>\r\n          <p>\r\n              PICC will not be liable to you (whether under the law of contact, the law of torts or otherwise) in relation to the contents of, or use of, or otherwise in connection with, this website:\r\n          </p>\r\n          <ul>\r\n              <li>to the extent that the website is provided free-of-charge, for any direct loss;</li>\r\n              <li>for any indirect, special or consequential loss; or\r\n              <li>for any business losses, loss of revenue, income, profits or anticipated savings, loss of contracts or business relationships, loss of reputation or goodwill, or loss or corruption of information or data.</li>\r\n          </ul>\r\n          <p>\r\n              These limitations of liability apply even if PICC has been expressly advised of the potential loss.\r\n          </p>\r\n          <h4 class="text-highlight">Exceptions</h4>\r\n          <p>\r\n            Nothing in this website disclaimer will exclude or limit any warranty implied by law that it would be unlawful to exclude or limit; and nothing in this website disclaimer will exclude or limit PICC\'s liability in respect of any:\r\n          </p>\r\n          <ul>\r\n            <li>death or personal injury caused by PICC\'s negligence;</li>\r\n            <li>fraud or fraudulent misrepresentation on the part of PICC; or</li>\r\n            <li>matter which it would be illegal or unlawful for PICC to exclude or limit, or to attempt or purport to exclude or limit, its liability.</li>\r\n          </ul>\r\n          <h4 class="text-highlight">Reasonableness</h4>\r\n          <p>\r\n            By using this website, you agree that the exclusions and limitations of liability set out in this website disclaimer are reasonable.\r\n          </p>\r\n          <p>\r\n            If you do not think they are reasonable, you must not use this website.\r\n          </p>\r\n          <h4 class="text-highlight">Other parties</h4>\r\n          <p>\r\n              You accept that, as a limited liability entity, PICC has an interest in limiting the personal liability of its officers and employees. You agree that you will not bring any claim personally against PICC\'s officers or employees in respect of any losses you suffer in connection with the website.\r\n          </p>\r\n          <p>\r\n              Without prejudice to the foregoing paragraph, you agree that the limitations of warranties and liability set out in this website disclaimer will protect PICC\'s officers, employees, agents, subsidiaries, successors, assigns and sub-contractors as well as PICC.\r\n          </p>\r\n          <h4 class="text-highlight">Unenforceable provisions</h4>\r\n          <p>\r\n              If any provision of this website disclaimer is, or is found to be, unenforceable under applicable law, that will not affect the enforceability of the other provisions of this website disclaimer.\r\n          </p>\r\n          <h4 class="text-highlight">Indemnity</h4>\r\n          <p>\r\n              You hereby indemnify PICC and undertake to keep PICC indemnified against any losses, damages, costs, liabilities and expenses (including without limitation legal expenses and any amounts paid by PICC to a third party in settlement of a claim or dispute on the advice of PICC\'s legal advisers) incurred or suffered by PICC arising out of any breach by you of any provision of these terms and conditions, or arising out of any claim that you have\r\n              breached any provision of these terms and conditions.\r\n          </p>\r\n          <h4 class="text-highlight">Breaches of these terms and conditions</h4>\r\n          <p>\r\n            Without prejudice to PICC\'s other rights under these terms and conditions, if you breach these terms and conditions in any way, PICC may take such action as PICC deems appropriate to deal with the breach, including suspending your access to the website, prohibiting you from accessing the website, blocking computers using your IP address from accessing the website, contacting your internet service provider to request that they block your access to the website and/or bringing court proceedings against you.\r\n          </p>\r\n          <h4 class="text-highlight">Variation</h4>\r\n          <p>\r\n            PICC may revise these terms and conditions from time-to-time. Revised terms and conditions will apply to the use of this website from the date of the publication of the revised terms and conditions on this website. Please check this page regularly to ensure you are familiar with the current version.\r\n          </p>\r\n          <h4 class="text-highlight">Assignment</h4>\r\n          <p>\r\n            PICC may transfer, sub-contract or otherwise deal with PICC\'s rights and/or obligations under these terms and conditions without notifying you or obtaining your consent.\r\n          </p>\r\n          <p>\r\n            You may not transfer, sub-contract or otherwise deal with your rights and/or obligations under these terms and conditions.\r\n          </p>\r\n          <h4 class="text-highlight">Severability</h4>\r\n          <p>\r\n            If a provision of these terms and conditions is determined by any court or other competent authority to be unlawful and/or unenforceable, the other provisions will continue in effect. If any unlawful and/or unenforceable provision would be lawful or enforceable if part of it were deleted, that part will be deemed to be deleted, and the rest of the provision will continue in effect.\r\n          </p>\r\n          <h4 class="text-highlight">Entire agreement</h4>\r\n          <p>\r\n            These terms and conditions, together with the privacy policy, constitute the entire agreement between you and PICC in relation to your use of this website, and supersede all previous agreements in respect of your use of this website.\r\n          </p>\r\n          <h4 class="text-highlight">Law and jurisdiction</h4>\r\n          <p>\r\n              These terms and conditions will be governed by and construed in accordance with [GOVERNING LAW], and any disputes relating to these terms and conditions\r\n              will be subject to the [non-]exclusive jurisdiction of the courts of [JURISDICTION].\r\n          </p>\r\n          <h4 class="text-highlight">Registrations and authorisations</h4>\r\n          <p>\r\n            PICC is registered with the Corporate Affairs Corporation in Nigeria. PICC\'s registration number is [RC].\r\n          </p>\r\n          <p>\r\n              [PICC subscribes to the following code[s] of conduct: [CODE(S) OF CONDUCT]. [These codes/this code] can be consulted electronically at [URL(S)].\r\n          </p>\r\n          <p>\r\n              [PICC\'s [TAX] number is [NUMBER].]]\r\n          </p>\r\n          <h4 class="text-highlight">PICC\'s details</h4>\r\n          <p>\r\n              The full name of PICC is Public Interest in Corruption Cases.\r\n          </p>\r\n          <p>\r\n              PICC\'s address is 294 Herbert Marcaulay Way, Yaba, Lagos.\r\n          </p>\r\n          <p>\r\n              You can contact PICC by email to info@picc.com.ng.\r\n          </p>\r\n          <div class="well well-sm">\r\n            <h4 class="text-highlight">Credit</h4>\r\n            <p>\r\n                This document was created using a Contractology template available at <a href="http://www.freenetlaw.com/">http://www.freenetlaw.com</a>.\r\n            </p>\r\n          </div>\r\n        </div>\r\n\r\n        <div class="col-md-4 col-sm-4 sidebar2">\r\n          <h4>Our Contacts</h4>\r\n          <address>\r\n            <strong>PICC Nigeria</strong><br>\r\n            294 Herbert Macaulay Way, Yaba<br>\r\n            Lagos, Nigeria<br>\r\n            <abbr title="Phone">P:</abbr> (234) 703 6188 527\r\n          </address>\r\n          <address>\r\n            <strong>Email</strong><br>\r\n            <a href="mailto:info@picc.com.ng">info@picc.com.ng</a><br>\r\n            <a href="mailto:subscribe@example.com">subscribe@picc.com.ng</a>\r\n          </address>\r\n          <ul class="social-icons margin-bottom-40">\r\n            <li><a href="http://facebook.com/piccnigeria" target="_blank" data-original-title="facebook" class="facebook"></a></li>\r\n            <li><a href="http://twitter.com/piccnigeria" target="_blank" data-original-title="twitter" class="twitter"></a></li>\r\n            <li><a href="http://google.com/+PICCNigeria" target="_blank" data-original-title="Google+" class="googleplus"></a></li>\r\n            <li><a href="http://github.com/piccnigeria" target="_blank" data-original-title="github" class="github"></a></li>\r\n          </ul>\r\n        </div>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>';});


define('text!tmpl/policy.html',[],function () { return '<ul class="breadcrumb">\r\n  <li><a href="#" data-nav>Home</a></li>\r\n  <li><a href="#about" data-nav>About Us</a></li>\r\n  <li class="active">Privacy Policy</li>\r\n</ul>\r\n\r\n<div class="row margin-bottom-40">\r\n  <div class="col-md-12 col-sm-12">\r\n    <h1>Privacy Policy</h1>\r\n    <div class="content-page">\r\n      <div class="row margin-bottom-30">\r\n        <div class="col-md-8">\r\n          <p>\r\n            Your privacy is important to PICC. This privacy statement provides information about the personal information that PICC collects, and the ways in which PICC uses that personal information.\r\n          </p>\r\n\r\n          <div class="well well-sm">\r\n            <h4 class="text-highlight">Credit</h4>\r\n            <p>\r\n              This document was created using a Contractology template available at <a href="http://www.freenetlaw.com/" target="_blank">http://www.freenetlaw.com</a>.\r\n            </p>\r\n          </div>\r\n\r\n          <h4 class="text-highlight">Personal information collection</h4>\r\n          <p>\r\n            PICC may collect and use the following kinds of personal information:\r\n          </p>\r\n          <ul>\r\n              <li>information about your use of this website (including [INSERT DETAILS]);</li>\r\n              <li>information that you provide using for the purpose of registering with the website (including [INSERT DETAILS]);</li>\r\n              <li>information about transactions carried out over this website (including [INSERT DETAILS]);</li>\r\n              <li>information that you provide for the purpose of subscribing to the website services (including [INSERT DETAILS]); and</li>\r\n              <li>any other information that you send to PICC.</li>\r\n          </ul>\r\n\r\n          <h4 class="text-highlight">Using personal information</h4>\r\n          <p>\r\n              PICC may use your personal information to:\r\n          </p>\r\n          <ul>\r\n            <li>administer this website;</li>\r\n            <li>personalize the website for you;</li>\r\n            <li>enable your access to and use of the website services;</li>\r\n            <li>publish information about you on the website;</li>\r\n          </ul>\r\n          <p>\r\n            Where PICC discloses your personal information to its agents or sub-contractors for these purposes, the agent or sub-contractor in question will be obligated to use that personal information in accordance with the terms of this privacy statement.\r\n          </p>\r\n          <p>\r\n            In addition to the disclosures reasonably necessary for the purposes identified elsewhere above, PICC may disclose your personal information to the extent that it is required to do so by law, in connection with any legal proceedings or prospective legal proceedings, and in order to establish, exercise or defend its legal rights.\r\n          </p>\r\n          <h4 class="text-highlight">Securing your data</h4>\r\n          <p>\r\n            PICC will take reasonable technical and organisational precautions to prevent the loss, misuse or alteration of your personal information.\r\n          </p>\r\n          <p>\r\n            PICC will store all the personal information you provide [on its secure servers].\r\n          </p>\r\n          <p>\r\n            Information relating to electronic transactions entered into via this website will be protected by encryption technology.\r\n          </p>\r\n\r\n          <h4 class="text-highlight">Cross-border data transfers</h4>\r\n          <p>\r\n            Information that PICC collects may be stored and processed in and transferred between any of the countries in which PICC operates to enable the use of\r\n              the information in accordance with this privacy policy.\r\n          </p>\r\n          <p>\r\n              [In addition, personal information that you submit for publication on the website will be published on the internet and may be available around the world.]\r\n          </p>\r\n          <p>\r\n              You agree to such cross-border transfers of personal information.\r\n          </p>\r\n\r\n          <h4 class="text-highlight">Updating this statement</h4>\r\n          <p>\r\n              PICC may update this privacy policy by posting a new version on this website.\r\n          </p>\r\n          <p>\r\n              You should check this page occasionally to ensure you are familiar with any changes.\r\n          </p>\r\n          <h4 class="text-highlight">Other websites</h4>\r\n          <p>\r\n              This website contains links to other websites.\r\n          </p>\r\n        </div>\r\n\r\n        <div class="col-md-4 col-sm-4 sidebar2">\r\n          <h4>Our Contacts</h4>\r\n          <address>\r\n            <strong>PICC Nigeria</strong><br>\r\n            294 Herbert Macaulay Way, Yaba<br>\r\n            Lagos, Nigeria<br>\r\n            <abbr title="Phone">P:</abbr> (234) 703 6188 527\r\n          </address>\r\n          <address>\r\n            <strong>Email</strong><br>\r\n            <a href="mailto:info@picc.com.ng">info@picc.com.ng</a><br>\r\n            <a href="mailto:subscribe@example.com">subscribe@picc.com.ng</a>\r\n          </address>\r\n          <ul class="social-icons margin-bottom-40">\r\n            <li><a href="http://facebook.com/piccnigeria" target="_blank" data-original-title="facebook" class="facebook"></a></li>\r\n            <li><a href="http://twitter.com/piccnigeria" target="_blank" data-original-title="twitter" class="twitter"></a></li>\r\n            <li><a href="http://google.com/+PICCNigeria" target="_blank" data-original-title="Google+" class="googleplus"></a></li>\r\n            <li><a href="http://github.com/piccnigeria" target="_blank" data-original-title="github" class="github"></a></li>\r\n          </ul>\r\n        </div>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>';});


define('text!tmpl/blog.html',[],function () { return '<ul class="breadcrumb">\r\n    <li><a href="#" data-nav>Home</a></li>\r\n    <li class="active">Blog</li>\r\n</ul>\r\n\r\n<!-- BEGIN SIDEBAR & CONTENT -->\r\n<div class="row margin-bottom-40">\r\n  <!-- BEGIN CONTENT -->\r\n  <div class="col-md-12 col-sm-12">\r\n    <h1>PICC Blog</h1>\r\n    <div class="content-page">\r\n      <div class="row">\r\n        <!-- BEGIN LEFT SIDEBAR -->            \r\n        <div class="col-md-9 col-sm-9 blog-posts">\r\n          \r\n          {{#each this}}\r\n\r\n          <div class="row">\r\n            <div class="col-md-4 col-sm-4">\r\n              <img class="img-responsive" alt="" src="{{post_image_thumbnail}}">\r\n            </div>\r\n            <div class="col-md-8 col-sm-8">\r\n              <h2><a href="#blog/post" data-nav>{{{post_title}}}</a></h2>\r\n              <ul class="blog-info">\r\n                <li><i class="fa fa-calendar"></i> {{post_date}}</li>\r\n                <li><i class="fa fa-comments"></i> 17</li>\r\n                <li><i class="fa fa-tags"></i> {{tags}}</li>\r\n              </ul>\r\n              <p>{{summarize post_body}}</p>\r\n              <a href="#blog/post" data-nav class="more">Read more <i class="icon-angle-right"></i></a>\r\n            </div>\r\n          </div>\r\n          <hr class="blog-post-sep">\r\n\r\n          {{/each}}\r\n                            \r\n          <ul class="pagination">\r\n            <li><a href="#">Prev</a></li>\r\n            <li><a href="#">1</a></li>\r\n            <li><a href="#">2</a></li>\r\n            <li class="active"><a href="#">3</a></li>\r\n            <li><a href="#">4</a></li>\r\n            <li><a href="#">5</a></li>\r\n            <li><a href="#">Next</a></li>\r\n          </ul>               \r\n        </div>\r\n        <!-- END LEFT SIDEBAR -->\r\n\r\n        <!-- BEGIN RIGHT SIDEBAR -->            \r\n        <div class="col-md-3 col-sm-3 blog-sidebar">\r\n          <h2>Recent News</h2>\r\n          <div class="recent-news margin-bottom-10">\r\n            {{#each recent_posts}}\r\n            <div class="row margin-bottom-10">\r\n              <div class="col-md-3">\r\n                <img class="img-responsive" alt="" src="img/people/img2-large.jpg">                        \r\n              </div>\r\n              <div class="col-md-9 recent-news-inner">\r\n                <h3><a href="#blog/post" data-nav>{{{post_title}}}</a></h3>\r\n                <p>{{{summarize post_body}}}</p>\r\n              </div>                        \r\n            </div>\r\n            {{/each}}\r\n          </div>\r\n\r\n          <div class="blog-tags margin-bottom-20">\r\n            <h2>Tags</h2>\r\n            <ul>\r\n              <li><a href="#"><i class="fa fa-tags"></i>EFCC</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>ICPC</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>SFU</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>NDLEA</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Court</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Trials</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Judges</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>High Profile Cases</a></li>\r\n            </ul>\r\n          </div>\r\n        </div>\r\n                    \r\n      </div>\r\n    </div>\r\n  </div>\r\n  <!-- END CONTENT -->\r\n</div>\r\n<!-- END SIDEBAR & CONTENT -->';});


define('text!tmpl/blog-post.html',[],function () { return '<ul class="breadcrumb">\r\n    <li><a href="#" data-nav>Home</a></li>\r\n    <li><a href="#blog" data-nav>Blog</a></li>\r\n    <li class="active">Blog Post</li>\r\n</ul>\r\n<!-- BEGIN SIDEBAR & CONTENT -->\r\n<div class="row margin-bottom-40">\r\n  <!-- BEGIN CONTENT -->\r\n  <div class="col-md-12 col-sm-12">\r\n    <h1>Blog Post</h1>\r\n    <div class="content-page">\r\n      <div class="row">\r\n        <!-- BEGIN LEFT SIDEBAR -->            \r\n        <div class="col-md-9 col-sm-9 blog-item">\r\n          <div class="blog-item-img">\r\n            <!-- BEGIN CAROUSEL -->            \r\n            <div class="front-carousel">\r\n              <div id="myCarousel" class="carousel slide">\r\n                <!-- Carousel items -->\r\n                <div class="carousel-inner">\r\n                  <div class="item">\r\n                    <img src="img/posts/img1.jpg" alt="">\r\n                  </div>\r\n                  <div class="item">\r\n                    <!-- BEGIN VIDEO -->   \r\n                    <iframe src="http://player.vimeo.com/video/56974716?portrait=0" style="width:100%; border:0" allowfullscreen="" height="259"></iframe>\r\n                    <!-- END VIDEO -->   \r\n                  </div>\r\n                  <div class="item active">\r\n                    <img src="img/posts/img3.jpg" alt="">\r\n                  </div>\r\n                </div>\r\n                <!-- Carousel nav -->\r\n                <a class="carousel-control left" href="#myCarousel" data-slide="prev">\r\n                  <i class="fa fa-angle-left"></i>\r\n                </a>\r\n                <a class="carousel-control right" href="#myCarousel" data-slide="next">\r\n                  <i class="fa fa-angle-right"></i>\r\n                </a>\r\n              </div>                \r\n            </div>\r\n            <!-- END CAROUSEL -->             \r\n          </div>\r\n          <h2><a href="#">Corrupti quos dolores etquas</a></h2>\r\n          <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui sint blanditiis prae sentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non eleifend enim a feugiat. Pellentesque viverra vehicula sem ut volutpat. Lorem ipsum dolor sit amet, consectetur adipiscing condimentum eleifend enim a feugiat.</p>\r\n          <blockquote>\r\n            <p>Pellentesque ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante Integer posuere erat a ante.</p>\r\n            <small>Someone famous <cite title="Source Title">Source Title</cite></small>\r\n          </blockquote>                \r\n          <p>At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero consectetur adipiscing elit magna. Sed et quam lacus. Fusce condimentum eleifend enim a feugiat. Pellentesque viverra vehicula sem ut volutpat. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero magna. Sed et quam lacus. Fusce condimentum eleifend enim a feugiat.</p>\r\n          <p>Culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero consectetur adipiscing elit magna. Sed et quam lacus. Fusce condimentum eleifend enim a feugiat. Pellentesque viverra vehicula sem ut volutpat. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut non libero magna. Sed et quam lacus. Fusce condimentum eleifend enim a feugiat.</p>\r\n          <ul class="blog-info">\r\n            <li><i class="fa fa-user"></i> By admin</li>\r\n            <li><i class="fa fa-calendar"></i> 25/07/2013</li>\r\n            <li><i class="fa fa-comments"></i> 17</li>\r\n            <li><i class="fa fa-tags"></i> Metronic, Keenthemes, UI Design</li>\r\n          </ul>\r\n\r\n          <h2>Comments</h2>\r\n          <div class="comments">\r\n                                                          \r\n          </div>\r\n\r\n          <div class="post-comment padding-top-40">\r\n            <h3>Leave a Comment</h3>\r\n            <form role="form">\r\n              <div class="form-group">\r\n                <label>Name</label>\r\n                <input class="form-control" type="text">\r\n              </div>\r\n\r\n              <div class="form-group">\r\n                <label>Email <span class="color-red">*</span></label>\r\n                <input class="form-control" type="text">\r\n              </div>\r\n\r\n              <div class="form-group">\r\n                <label>Message</label>\r\n                <textarea class="form-control" rows="8"></textarea>\r\n              </div>\r\n              <p><button class="btn btn-primary" type="submit">Post a Comment</button></p>\r\n            </form>\r\n          </div>                      \r\n        </div>\r\n        <!-- END LEFT SIDEBAR -->\r\n\r\n        <!-- BEGIN RIGHT SIDEBAR -->            \r\n        <div class="col-md-3 col-sm-3 blog-sidebar">\r\n          <!-- CATEGORIES START -->\r\n          <h2 class="no-top-space">Categories</h2>\r\n          <ul class="nav sidebar-categories margin-bottom-40">\r\n            <li><a href="#">London (18)</a></li>\r\n            <li><a href="#">Moscow (5)</a></li>\r\n            <li class="active"><a href="#">Paris (12)</a></li>\r\n            <li><a href="#">Berlin (7)</a></li>\r\n            <li><a href="#">Istanbul (3)</a></li>\r\n          </ul>\r\n          <!-- CATEGORIES END -->\r\n\r\n          <!-- BEGIN RECENT NEWS -->                            \r\n          <h2>Recent News</h2>\r\n          <div class="recent-news margin-bottom-10">\r\n            <div class="row margin-bottom-10">\r\n              <div class="col-md-3">\r\n                <img class="img-responsive" alt="" src="img/people/img2-large.jpg">                        \r\n              </div>\r\n              <div class="col-md-9 recent-news-inner">\r\n                <h3><a href="#">Letiusto gnissimos</a></h3>\r\n                <p>Decusamus tiusto odiodig nis simos ducimus qui sint</p>\r\n              </div>                        \r\n            </div>\r\n            <div class="row margin-bottom-10">\r\n              <div class="col-md-3">\r\n                <img class="img-responsive" alt="" src="img/people/img1-large.jpg">                        \r\n              </div>\r\n              <div class="col-md-9 recent-news-inner">\r\n                <h3><a href="#">Deiusto anissimos</a></h3>\r\n                <p>Decusamus tiusto odiodig nis simos ducimus qui sint</p>\r\n              </div>                        \r\n            </div>\r\n            <div class="row margin-bottom-10">\r\n              <div class="col-md-3">\r\n                <img class="img-responsive" alt="" src="img/people/img3-large.jpg">                        \r\n              </div>\r\n              <div class="col-md-9 recent-news-inner">\r\n                <h3><a href="#">Tesiusto baissimos</a></h3>\r\n                <p>Decusamus tiusto odiodig nis simos ducimus qui sint</p>\r\n              </div>                        \r\n            </div>\r\n          </div>\r\n          <!-- END RECENT NEWS -->                            \r\n          \r\n          <!-- BEGIN BLOG TAGS -->\r\n          <div class="blog-tags margin-bottom-20">\r\n            <h2>Tags</h2>\r\n            <ul>\r\n              <li><a href="#"><i class="fa fa-tags"></i>OS</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Metronic</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Dell</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Conquer</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>MS</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Google</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Keenthemes</a></li>\r\n              <li><a href="#"><i class="fa fa-tags"></i>Twitter</a></li>\r\n            </ul>\r\n          </div>\r\n          <!-- END BLOG TAGS -->\r\n        </div>\r\n        <!-- END RIGHT SIDEBAR -->            \r\n      </div>\r\n    </div>\r\n  </div>\r\n  <!-- END CONTENT -->\r\n</div>\r\n<!-- END SIDEBAR & CONTENT -->';});


(function() {

  define('cs!frontend/templates',['handlebars', 'text!tmpl/index.html', 'text!tmpl/slider.html', 'text!tmpl/infographics.html', 'text!tmpl/about.html', 'text!tmpl/case.html', 'text!tmpl/case-maps.html', 'text!tmpl/cases.html', 'text!tmpl/contact.html', 'text!tmpl/faqs.html', 'text!tmpl/terms.html', 'text!tmpl/policy.html', 'text!tmpl/blog.html', 'text!tmpl/blog-post.html'], function(Handlebars, indexTmpl, sliderTmpl, infographicsTmpl, aboutTmpl, caseTmpl, caseMapsTmpl, casesTmpl, contactTmpl, faqsTmpl, termsTmpl, policyTmpl, blogTmpl, blogPostTmpl) {
    Handlebars.registerHelper('summarize', function(post_body) {
      return new Handlebars.SafeString(post_body.substring(0, 200));
    });
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
      }
    };
  });

}).call(this);


(function() {

  define('cs!frontend/models',['backbone', 'cs!frontend/util'], function(Backbone, util) {
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
    var Views, scrollToTop;
    scrollToTop = function() {
      return $("body,html").animate({
        scrollTop: 0
      }, 800);
    };
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
          if (typeof this.afterInit === "function") {
            this.afterInit();
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
      afterInit: function() {
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
      }
    });
    Views.SubViews.FooterSubscriptionBox = Backbone.View.extend({
      el: '.pre-footer-subscribe-box',
      initialize: function() {
        this.model = new models.Subscriber;
        return this.model.on("error invalid", this.alert, this);
      },
      events: {
        "submit form": "submit"
      },
      submit: function(ev) {
        var _this = this;
        ev.preventDefault();
        return this.model.create(this.serialize(ev.currentTarget), function() {
          alert("You are now subscribed to our newsletter");
          _this.model.clear();
          return ev.currentTarget.reset();
        });
      },
      alert: function() {
        return alert(this.model.xhrError || this.model.validationError);
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
        this.$(".fancybox-fast-view").fancybox();
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
        this.view.trigger("attached");
        return scrollToTop();
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
        if (page == null) {
          page = "about";
        }
        return this.render(new Views.Static({
          page: page
        }));
      },
      renderBlog: function(post) {
        if (post != null) {
          return this.render(new Views.BlogPost);
        } else {
          return this.render(new Views.Blog);
        }
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

  define('cs!frontend/router',['jquery', 'backbone', 'cs!frontend/views', 'cs!frontend/util'], function($, Backbone, MainView, util) {
    return (function() {
      var Router, instance;
      Router = Backbone.Router.extend({
        routes: {
          "": "index",
          "about(/:page)": "about",
          faqs: "faqs",
          cases: "cases",
          "case-maps": "case_maps",
          contact: "contact",
          infographics: "infographics",
          "blog(/:post)": "blog"
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
          return this.appView.renderStatic(page);
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
        blog: function(post) {
          return this.appView.renderBlog(post);
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

