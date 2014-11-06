
/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.11 Copyright (c) 2010-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.1.11',
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        ap = Array.prototype,
        apsp = ap.splice,
        isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !isArray(value) && !isFunction(value) &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that is expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite and existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part, length = ary.length;
            for (i = 0; i < length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                        //End of the line. Keep at least one non-dot
                        //path segment at the front so it can be mapped
                        //correctly to disk. Otherwise, there is likely
                        //no path mapping for a path starting with '..'.
                        //This can still fail, but catches the most reasonable
                        //uses of ..
                        break;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI,
                baseParts = baseName && baseName.split('/'),
                normalizedBaseParts = baseParts,
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name && name.charAt(0) === '.') {
                //If have a base name, try to normalize against it,
                //otherwise, assume it is a top-level require that will
                //be relative to baseUrl in the end.
                if (baseName) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = name.split('/');
                    lastIndex = name.length - 1;

                    // If wanting node ID compatibility, strip .js from end
                    // of IDs. Have to do this here, and not in nameToUrl
                    // because node allows either .js or non .js to map
                    // to same file.
                    if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                        name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                    }

                    name = normalizedBaseParts.concat(name);
                    trimDots(name);
                    name = name.join('/');
                } else if (name.indexOf('./') === 0) {
                    // No baseName, so this is ID is resolved relative
                    // to baseUrl, pull off the leading dot.
                    name = name.substring(2);
                }
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // If the name points to a package's name, use
            // the package main instead.
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);
                context.require([id]);
                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        normalizedName = normalize(name, parentName, applyMap);
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                //Array splice in the values since the context code has a
                //local var ref to defQueue, so cannot just reassign the one
                //on context.
                apsp.apply(defQueue,
                           [defQueue.length, 0].concat(globalDefQueue));
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return (defined[mod.map.id] = mod.exports);
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            return  getOwn(config.config, mod.map.id) || {};
                        },
                        exports: mod.exports || (mod.exports = {})
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                var map = mod.map,
                    modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    this.fetch();
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            // Favor return value over exports. If node/cjs in play,
                            // then will not have a return value anyway. Favor
                            // module.exports assignment over exports object.
                            if (this.map.isDefine && exports === undefined) {
                                cjsModule = this.module;
                                if (cjsModule) {
                                    exports = cjsModule.exports;
                                } else if (this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                req.onResourceLoad(context, this.map, this.depMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        bundleId = getOwn(bundlesMap, this.map.id),
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    //If a paths config, then just load that file instead to
                    //resolve the plugin, as it is built into that paths layer.
                    if (bundleId) {
                        this.map.url = context.nameToUrl(bundleId);
                        this.load();
                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                //Save off the paths since they require special processing,
                //they are additive.
                var shim = config.shim,
                    objs = {
                        paths: true,
                        bundles: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (!config[prop]) {
                            config[prop] = {};
                        }
                        mixin(config[prop], value, true, true);
                    } else {
                        config[prop] = value;
                    }
                });

                //Reverse map the bundles
                if (cfg.bundles) {
                    eachProp(cfg.bundles, function (value, prop) {
                        each(value, function (v) {
                            if (v !== prop) {
                                bundlesMap[v] = prop;
                            }
                        });
                    });
                }

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location, name;

                        pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;

                        name = pkgObj.name;
                        location = pkgObj.location;
                        if (location) {
                            config.paths[name] = pkgObj.location;
                        }

                        //Save pointer to main module ID for pkg name.
                        //Remove leading dot in main, so main paths are normalized,
                        //and remove any trailing .js, since different package
                        //envs have different conventions: some use a module name,
                        //some use a file name.
                        config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                                     .replace(currDirRegExp, '')
                                     .replace(jsSuffixRegExp, '');
                    });
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        removeScript(id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        //Clean queued defines too. Go backwards
                        //in array so that the splices do not
                        //mess up the iteration.
                        eachReverse(defQueue, function(args, i) {
                            if(args[0] === id) {
                                defQueue.splice(i, 1);
                            }
                        });

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overridden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return context.nameToUrl(bundleId, ext, skipExt);
                }

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                                        ((url.indexOf('?') === -1 ? '?' : '&') +
                                         config.urlArgs) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/jrburke/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/jrburke/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation that a build has been done so that
                //only one script needs to be loaded anyway. This may need to be
                //reevaluated if other use cases become common.
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser && !cfg.skipDataMain) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one.
                if (!cfg.baseUrl) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                 //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, '')
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
    };

    define.amd = {
        jQuery: true
    };


    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this));

define("libs/requirejs/require.js", function(){});

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
define('text!tmpl/admin/auth.html',[],function () { return '';});

define('text!tmpl/admin/index.html',[],function () { return '';});

define('text!tmpl/admin/layout.html',[],function () { return '<!-- BEGIN HEADER -->\r\n<div class="page-header navbar navbar-fixed-top">\r\n  <!-- BEGIN HEADER INNER -->\r\n  <div class="page-header-inner">\r\n    <!-- BEGIN LOGO -->\r\n    <div class="page-logo">\r\n      <a href="#" data-nav><img src="../img/logo.png" alt="logo" class="logo-default"/></a>\r\n      <div class="menu-toggler sidebar-toggler hide">\r\n        <!-- DOC: Remove the above "hide" to enable the sidebar toggler button on header -->\r\n      </div>\r\n    </div>\r\n    <!-- END LOGO -->\r\n    <!-- BEGIN RESPONSIVE MENU TOGGLER -->\r\n    <a href="javascript:;" class="menu-toggler responsive-toggler" data-toggle="collapse" data-target=".navbar-collapse">\r\n    </a>\r\n    <!-- END RESPONSIVE MENU TOGGLER -->\r\n    <!-- BEGIN TOP NAVIGATION MENU -->\r\n    <div class="top-menu">\r\n      <ul class="nav navbar-nav pull-right">\r\n        <!-- BEGIN NOTIFICATION DROPDOWN -->\r\n        <li class="dropdown dropdown-extended dropdown-notification" id="header_notification_bar">\r\n          <a href="#" class="dropdown-toggle" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n          <i class="icon-bell"></i>\r\n          <span class="badge badge-default">\r\n          7 </span>\r\n          </a>\r\n          <ul class="dropdown-menu">\r\n            <li>\r\n              <p>\r\n                 You have 14 new notifications\r\n              </p>\r\n            </li>\r\n            <li>\r\n              <ul class="dropdown-menu-list scroller" style="height: 250px;">\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="label label-sm label-icon label-success">\r\n                  <i class="fa fa-plus"></i>\r\n                  </span>\r\n                  New user registered. <span class="time">\r\n                  Just now </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="label label-sm label-icon label-danger">\r\n                  <i class="fa fa-bolt"></i>\r\n                  </span>\r\n                  Server #12 overloaded. <span class="time">\r\n                  15 mins </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="label label-sm label-icon label-warning">\r\n                  <i class="fa fa-bell-o"></i>\r\n                  </span>\r\n                  Server #2 not responding. <span class="time">\r\n                  22 mins </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="label label-sm label-icon label-info">\r\n                  <i class="fa fa-bullhorn"></i>\r\n                  </span>\r\n                  Application error. <span class="time">\r\n                  40 mins </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="label label-sm label-icon label-danger">\r\n                  <i class="fa fa-bolt"></i>\r\n                  </span>\r\n                  Database overloaded 68%. <span class="time">\r\n                  2 hrs </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="label label-sm label-icon label-danger">\r\n                  <i class="fa fa-bolt"></i>\r\n                  </span>\r\n                  2 user IP blocked. <span class="time">\r\n                  5 hrs </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="label label-sm label-icon label-warning">\r\n                  <i class="fa fa-bell-o"></i>\r\n                  </span>\r\n                  Storage Server #4 not responding. <span class="time">\r\n                  45 mins </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="label label-sm label-icon label-info">\r\n                  <i class="fa fa-bullhorn"></i>\r\n                  </span>\r\n                  System Error. <span class="time">\r\n                  55 mins </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="label label-sm label-icon label-danger">\r\n                  <i class="fa fa-bolt"></i>\r\n                  </span>\r\n                  Database overloaded 68%. <span class="time">\r\n                  2 hrs </span>\r\n                  </a>\r\n                </li>\r\n              </ul>\r\n            </li>\r\n            <li class="external">\r\n              <a href="#">\r\n              See all notifications <i class="m-icon-swapright"></i>\r\n              </a>\r\n            </li>\r\n          </ul>\r\n        </li>\r\n        <!-- END NOTIFICATION DROPDOWN -->\r\n        <!-- BEGIN INBOX DROPDOWN -->\r\n        <li class="dropdown dropdown-extended dropdown-inbox" id="header_inbox_bar">\r\n          <a href="#" class="dropdown-toggle" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n          <i class="icon-envelope-open"></i>\r\n          <span class="badge badge-default">\r\n          4 </span>\r\n          </a>\r\n          <ul class="dropdown-menu">\r\n            <li>\r\n              <p>\r\n                 You have 12 new messages\r\n              </p>\r\n            </li>\r\n            <li>\r\n              <ul class="dropdown-menu-list scroller" style="height: 250px;">\r\n                <li>\r\n                  <a href="inbox.html?a=view">\r\n                  <span class="photo">\r\n                  <img src="../../assets/admin/layout/img/avatar2.jpg" alt=""/>\r\n                  </span>\r\n                  <span class="subject">\r\n                  <span class="from">\r\n                  Lisa Wong </span>\r\n                  <span class="time">\r\n                  Just Now </span>\r\n                  </span>\r\n                  <span class="message">\r\n                  Vivamus sed auctor nibh congue nibh. auctor nibh auctor nibh... </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="inbox.html?a=view">\r\n                  <span class="photo">\r\n                  <img src="../../assets/admin/layout/img/avatar3.jpg" alt=""/>\r\n                  </span>\r\n                  <span class="subject">\r\n                  <span class="from">\r\n                  Richard Doe </span>\r\n                  <span class="time">\r\n                  16 mins </span>\r\n                  </span>\r\n                  <span class="message">\r\n                  Vivamus sed congue nibh auctor nibh congue nibh. auctor nibh auctor nibh... </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="inbox.html?a=view">\r\n                  <span class="photo">\r\n                  <img src="../../assets/admin/layout/img/avatar1.jpg" alt=""/>\r\n                  </span>\r\n                  <span class="subject">\r\n                  <span class="from">\r\n                  Bob Nilson </span>\r\n                  <span class="time">\r\n                  2 hrs </span>\r\n                  </span>\r\n                  <span class="message">\r\n                  Vivamus sed nibh auctor nibh congue nibh. auctor nibh auctor nibh... </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="inbox.html?a=view">\r\n                  <span class="photo">\r\n                    <img src="../img/avatar2.jpg" alt=""/>\r\n                  </span>\r\n                  <span class="subject">\r\n                    <span class="from">Lisa Wong </span>\r\n                    <span class="time">40 mins </span>\r\n                  </span>\r\n                  <span class="message">Vivamus sed auctor 40% nibh congue nibh... </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="inbox.html?a=view">\r\n                  <span class="photo"><img src="../img/avatar3.jpg" alt=""/></span>\r\n                  <span class="subject">\r\n                    <span class="from">Richard Doe </span>\r\n                    <span class="time">46 mins </span>\r\n                  </span>\r\n                  <span class="message">\r\n                  Vivamus sed congue nibh auctor nibh congue nibh. auctor nibh auctor nibh... </span>\r\n                  </a>\r\n                </li>\r\n              </ul>\r\n            </li>\r\n            <li class="external">\r\n              <a href="inbox.html">See all messages <i class="m-icon-swapright"></i></a>\r\n            </li>\r\n          </ul>\r\n        </li>\r\n        <!-- END INBOX DROPDOWN -->\r\n        <!-- BEGIN TODO DROPDOWN -->\r\n        <li class="dropdown dropdown-extended dropdown-tasks" id="header_task_bar">\r\n          <a href="#" class="dropdown-toggle" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n          <i class="icon-calendar"></i>\r\n          <span class="badge badge-default">3 </span>\r\n          </a>\r\n          <ul class="dropdown-menu extended tasks">\r\n            <li>\r\n              <p>You have 12 pending tasks</p>\r\n            </li>\r\n            <li>\r\n              <ul class="dropdown-menu-list scroller" style="height: 250px;">\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="task">\r\n                    <span class="desc">New release v1.2 </span>\r\n                    <span class="percent">30% </span>\r\n                  </span>\r\n                  <span class="progress">\r\n                  <span style="width: 40%;" class="progress-bar progress-bar-success" aria-valuenow="40" aria-valuemin="0" aria-valuemax="100">\r\n                  <span class="sr-only">40% Complete </span>\r\n                  </span>\r\n                  </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="task">\r\n                    <span class="desc">Application deployment </span>\r\n                    <span class="percent">65% </span>\r\n                  </span>\r\n                  <span class="progress progress-striped">\r\n                  <span style="width: 65%;" class="progress-bar progress-bar-danger" aria-valuenow="65" aria-valuemin="0" aria-valuemax="100">\r\n                  <span class="sr-only">65% Complete </span>\r\n                  </span>\r\n                  </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="task">\r\n                  <span class="desc">Mobile app release </span>\r\n                  <span class="percent">98% </span>\r\n                  </span>\r\n                  <span class="progress">\r\n                  <span style="width: 98%;" class="progress-bar progress-bar-success" aria-valuenow="98" aria-valuemin="0" aria-valuemax="100">\r\n                  <span class="sr-only">98% Complete </span>\r\n                  </span>\r\n                  </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="task">\r\n                  <span class="desc">Database migration </span>\r\n                  <span class="percent">10% </span>\r\n                  </span>\r\n                  <span class="progress progress-striped">\r\n                  <span style="width: 10%;" class="progress-bar progress-bar-warning" aria-valuenow="10" aria-valuemin="0" aria-valuemax="100">\r\n                  <span class="sr-only">10% Complete </span>\r\n                  </span>\r\n                  </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="task">\r\n                  <span class="desc">Web server upgrade </span>\r\n                  <span class="percent">58% </span>\r\n                  </span>\r\n                  <span class="progress progress-striped">\r\n                  <span style="width: 58%;" class="progress-bar progress-bar-info" aria-valuenow="58" aria-valuemin="0" aria-valuemax="100">\r\n                  <span class="sr-only">58% Complete </span>\r\n                  </span>\r\n                  </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="task">\r\n                  <span class="desc">Mobile development </span>\r\n                  <span class="percent">85% </span>\r\n                  </span>\r\n                  <span class="progress progress-striped">\r\n                  <span style="width: 85%;" class="progress-bar progress-bar-success" aria-valuenow="85" aria-valuemin="0" aria-valuemax="100">\r\n                  <span class="sr-only">85% Complete </span>\r\n                  </span>\r\n                  </span>\r\n                  </a>\r\n                </li>\r\n                <li>\r\n                  <a href="#">\r\n                  <span class="task">\r\n                  <span class="desc">New UI release </span>\r\n                  <span class="percent">18% </span>\r\n                  </span>\r\n                  <span class="progress progress-striped">\r\n                  <span style="width: 18%;" class="progress-bar progress-bar-important" aria-valuenow="18" aria-valuemin="0" aria-valuemax="100">\r\n                  <span class="sr-only">18% Complete </span>\r\n                  </span>\r\n                  </span>\r\n                  </a>\r\n                </li>\r\n              </ul>\r\n            </li>\r\n            <li class="external">\r\n              <a href="#">See all tasks <i class="m-icon-swapright"></i></a>\r\n            </li>\r\n          </ul>\r\n        </li>\r\n        <!-- END TODO DROPDOWN -->\r\n        <!-- BEGIN USER LOGIN DROPDOWN -->\r\n        <li class="dropdown dropdown-user">\r\n          <a href="#" class="dropdown-toggle" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n          <img alt="" class="img-circle" src="../img/avatar3_small.jpg"/>\r\n          <span class="username">Bob </span>\r\n          <i class="fa fa-angle-down"></i>\r\n          </a>\r\n          <ul class="dropdown-menu">\r\n            <li>\r\n              <a href="extra_profile.html">\r\n              <i class="icon-user"></i> My Profile </a>\r\n            </li>\r\n            <li>\r\n              <a href="page_calendar.html">\r\n              <i class="icon-calendar"></i> My Calendar </a>\r\n            </li>\r\n            <li>\r\n              <a href="inbox.html">\r\n              <i class="icon-envelope-open"></i> My Inbox \r\n              <span class="badge badge-danger">3 </span>\r\n              </a>\r\n            </li>\r\n            <li>\r\n              <a href="#">\r\n              <i class="icon-rocket"></i> My Tasks \r\n              <span class="badge badge-success">7 </span>\r\n              </a>\r\n            </li>\r\n            <li class="divider">\r\n            </li>\r\n            <li>\r\n              <a href="extra_lock.html">\r\n              <i class="icon-lock"></i> Lock Screen </a>\r\n            </li>\r\n            <li>\r\n              <a href="login.html">\r\n              <i class="icon-key"></i> Log Out </a>\r\n            </li>\r\n          </ul>\r\n        </li>\r\n        <!-- END USER LOGIN DROPDOWN -->\r\n        <!-- BEGIN QUICK SIDEBAR TOGGLER -->\r\n        <li class="dropdown dropdown-quick-sidebar-toggler">\r\n          <a href="javascript:;" class="dropdown-toggle">\r\n          <i class="icon-logout"></i>\r\n          </a>\r\n        </li>\r\n        <!-- END QUICK SIDEBAR TOGGLER -->\r\n      </ul>\r\n    </div>\r\n    <!-- END TOP NAVIGATION MENU -->\r\n  </div>\r\n  <!-- END HEADER INNER -->\r\n</div>\r\n<!-- END HEADER -->\r\n\r\n<div class="clearfix"></div>\r\n\r\n<!-- BEGIN CONTAINER -->\r\n<div class="page-container">\r\n  \r\n<!-- BEGIN SIDEBAR -->\r\n<div class="page-sidebar-wrapper">\r\n    \r\n</div>\r\n<!-- END SIDEBAR -->\r\n\r\n<!-- BEGIN CONTENT -->\r\n<div class="page-content-wrapper main">\r\n    \r\n</div>\r\n<!-- END CONTAINER -->\r\n\r\n<!-- BEGIN FOOTER -->\r\n<div class="page-footer">\r\n  <div class="page-footer-inner">2014 &copy; PICC Nigeria (Public Interest in Public Cases).</div>\r\n  <div class="page-footer-tools"><span class="go-top"><i class="fa fa-angle-up"></i></span></div>\r\n</div>\r\n<!-- END FOOTER -->';});

define('text!tmpl/admin/dashboard.html',[],function () { return '<div class="page-content">\r\n<!-- BEGIN SAMPLE PORTLET CONFIGURATION MODAL FORM-->\r\n      <div class="modal fade" id="portlet-config" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">\r\n        <div class="modal-dialog">\r\n          <div class="modal-content">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal" aria-hidden="true"></button>\r\n              <h4 class="modal-title">Modal title</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n               Widget settings form goes here\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn blue">Save changes</button>\r\n              <button type="button" class="btn default" data-dismiss="modal">Close</button>\r\n            </div>\r\n          </div>\r\n          <!-- /.modal-content -->\r\n        </div>\r\n        <!-- /.modal-dialog -->\r\n      </div>\r\n      <!-- /.modal -->\r\n      <!-- END SAMPLE PORTLET CONFIGURATION MODAL FORM-->\r\n      <!-- BEGIN STYLE CUSTOMIZER -->\r\n      <div class="theme-panel hidden-xs hidden-sm">\r\n        <div class="toggler">\r\n        </div>\r\n        <div class="toggler-close">\r\n        </div>\r\n        <div class="theme-options">\r\n          <div class="theme-option theme-colors clearfix">\r\n            <span>\r\n            THEME COLOR </span>\r\n            <ul>\r\n              <li class="color-default current tooltips" data-style="default" data-original-title="Default">\r\n              </li>\r\n              <li class="color-darkblue tooltips" data-style="darkblue" data-original-title="Dark Blue">\r\n              </li>\r\n              <li class="color-blue tooltips" data-style="blue" data-original-title="Blue">\r\n              </li>\r\n              <li class="color-grey tooltips" data-style="grey" data-original-title="Grey">\r\n              </li>\r\n              <li class="color-light tooltips" data-style="light" data-original-title="Light">\r\n              </li>\r\n              <li class="color-light2 tooltips" data-style="light2" data-html="true" data-original-title="Light 2">\r\n              </li>\r\n            </ul>\r\n          </div>\r\n          <div class="theme-option">\r\n            <span>\r\n            Layout </span>\r\n            <select class="layout-option form-control input-small">\r\n              <option value="fluid" selected="selected">Fluid</option>\r\n              <option value="boxed">Boxed</option>\r\n            </select>\r\n          </div>\r\n          <div class="theme-option">\r\n            <span>\r\n            Header </span>\r\n            <select class="page-header-option form-control input-small">\r\n              <option value="fixed" selected="selected">Fixed</option>\r\n              <option value="default">Default</option>\r\n            </select>\r\n          </div>\r\n          <div class="theme-option">\r\n            <span>\r\n            Sidebar </span>\r\n            <select class="sidebar-option form-control input-small">\r\n              <option value="fixed">Fixed</option>\r\n              <option value="default" selected="selected">Default</option>\r\n            </select>\r\n          </div>\r\n          <div class="theme-option">\r\n            <span>\r\n            Sidebar Position </span>\r\n            <select class="sidebar-pos-option form-control input-small">\r\n              <option value="left" selected="selected">Left</option>\r\n              <option value="right">Right</option>\r\n            </select>\r\n          </div>\r\n          <div class="theme-option">\r\n            <span>\r\n            Footer </span>\r\n            <select class="page-footer-option form-control input-small">\r\n              <option value="fixed">Fixed</option>\r\n              <option value="default" selected="selected">Default</option>\r\n            </select>\r\n          </div>\r\n        </div>\r\n      </div>\r\n      <!-- END STYLE CUSTOMIZER -->\r\n      <!-- BEGIN PAGE HEADER-->\r\n      <div class="row">\r\n        <div class="col-md-12">\r\n          <!-- BEGIN PAGE TITLE & BREADCRUMB-->\r\n          <h3 class="page-title">\r\n          Dashboard <small>statistics and more</small>\r\n          </h3>\r\n          <ul class="page-breadcrumb breadcrumb">\r\n            <li>\r\n              <i class="fa fa-home"></i>\r\n              <a href="index.html">Home</a>\r\n              <i class="fa fa-angle-right"></i>\r\n            </li>\r\n            <li>\r\n              <a href="#">Dashboard</a>\r\n            </li>\r\n            <li class="pull-right">\r\n              <div id="dashboard-report-range" class="dashboard-date-range tooltips" data-placement="top" data-original-title="Change dashboard date range">\r\n                <i class="icon-calendar"></i>\r\n                <span></span>\r\n                <i class="fa fa-angle-down"></i>\r\n              </div>\r\n            </li>\r\n          </ul>\r\n          <!-- END PAGE TITLE & BREADCRUMB-->\r\n        </div>\r\n      </div>\r\n      <!-- END PAGE HEADER-->\r\n      <!-- BEGIN DASHBOARD STATS -->\r\n      <div class="row">\r\n        <div class="col-lg-3 col-md-3 col-sm-6 col-xs-12">\r\n          <div class="dashboard-stat blue-madison">\r\n            <div class="visual">\r\n              <i class="fa fa-comments"></i>\r\n            </div>\r\n            <div class="details">\r\n              <div class="number">\r\n                 1349\r\n              </div>\r\n              <div class="desc">\r\n                 New Feedbacks\r\n              </div>\r\n            </div>\r\n            <a class="more" href="#">\r\n            View more <i class="m-icon-swapright m-icon-white"></i>\r\n            </a>\r\n          </div>\r\n        </div>\r\n        <div class="col-lg-3 col-md-3 col-sm-6 col-xs-12">\r\n          <div class="dashboard-stat red-intense">\r\n            <div class="visual">\r\n              <i class="fa fa-bar-chart-o"></i>\r\n            </div>\r\n            <div class="details">\r\n              <div class="number">\r\n                 12,5M$\r\n              </div>\r\n              <div class="desc">\r\n                 Total Profit\r\n              </div>\r\n            </div>\r\n            <a class="more" href="#">\r\n            View more <i class="m-icon-swapright m-icon-white"></i>\r\n            </a>\r\n          </div>\r\n        </div>\r\n        <div class="col-lg-3 col-md-3 col-sm-6 col-xs-12">\r\n          <div class="dashboard-stat green-haze">\r\n            <div class="visual">\r\n              <i class="fa fa-shopping-cart"></i>\r\n            </div>\r\n            <div class="details">\r\n              <div class="number">\r\n                 549\r\n              </div>\r\n              <div class="desc">\r\n                 New Orders\r\n              </div>\r\n            </div>\r\n            <a class="more" href="#">\r\n            View more <i class="m-icon-swapright m-icon-white"></i>\r\n            </a>\r\n          </div>\r\n        </div>\r\n        <div class="col-lg-3 col-md-3 col-sm-6 col-xs-12">\r\n          <div class="dashboard-stat purple-plum">\r\n            <div class="visual">\r\n              <i class="fa fa-globe"></i>\r\n            </div>\r\n            <div class="details">\r\n              <div class="number">\r\n                 +89%\r\n              </div>\r\n              <div class="desc">\r\n                 Brand Popularity\r\n              </div>\r\n            </div>\r\n            <a class="more" href="#">\r\n            View more <i class="m-icon-swapright m-icon-white"></i>\r\n            </a>\r\n          </div>\r\n        </div>\r\n      </div>\r\n      <!-- END DASHBOARD STATS -->\r\n      <div class="clearfix">\r\n      </div>\r\n      <div class="row">\r\n        <div class="col-md-6 col-sm-6">\r\n          <!-- BEGIN PORTLET-->\r\n          <div class="portlet solid bordered grey-cararra">\r\n            <div class="portlet-title">\r\n              <div class="caption">\r\n                <i class="fa fa-bar-chart-o"></i>Site Visits\r\n              </div>\r\n              <div class="tools">\r\n                <div class="btn-group" data-toggle="buttons">\r\n                  <label class="btn grey-steel btn-sm active">\r\n                  <input type="radio" name="options" class="toggle" id="option1">New</label>\r\n                  <label class="btn grey-steel btn-sm">\r\n                  <input type="radio" name="options" class="toggle" id="option2">Returning</label>\r\n                </div>\r\n              </div>\r\n            </div>\r\n            <div class="portlet-body">\r\n              <div id="site_statistics_loading">\r\n                <img src="../../assets/admin/layout/img/loading.gif" alt="loading"/>\r\n              </div>\r\n              <div id="site_statistics_content" class="display-none">\r\n                <div id="site_statistics" class="chart">\r\n                </div>\r\n              </div>\r\n            </div>\r\n          </div>\r\n          <!-- END PORTLET-->\r\n        </div>\r\n        <div class="col-md-6 col-sm-6">\r\n          <!-- BEGIN PORTLET-->\r\n          <div class="portlet solid grey-cararra bordered">\r\n            <div class="portlet-title">\r\n              <div class="caption">\r\n                <i class="fa fa-bullhorn"></i>Revenue\r\n              </div>\r\n              <div class="tools">\r\n                <div class="btn-group pull-right">\r\n                  <a href="" class="btn grey-steel btn-sm dropdown-toggle" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                  Filter <span class="fa fa-angle-down">\r\n                  </span>\r\n                  </a>\r\n                  <ul class="dropdown-menu pull-right">\r\n                    <li>\r\n                      <a href="javascript:;">\r\n                      Q1 2014 <span class="label label-sm label-default">\r\n                      past </span>\r\n                      </a>\r\n                    </li>\r\n                    <li>\r\n                      <a href="javascript:;">\r\n                      Q2 2014 <span class="label label-sm label-default">\r\n                      past </span>\r\n                      </a>\r\n                    </li>\r\n                    <li class="active">\r\n                      <a href="javascript:;">\r\n                      Q3 2014 <span class="label label-sm label-success">\r\n                      current </span>\r\n                      </a>\r\n                    </li>\r\n                    <li>\r\n                      <a href="javascript:;">\r\n                      Q4 2014 <span class="label label-sm label-warning">\r\n                      upcoming </span>\r\n                      </a>\r\n                    </li>\r\n                  </ul>\r\n                </div>\r\n              </div>\r\n            </div>\r\n            <div class="portlet-body">\r\n              <div id="site_activities_loading">\r\n                <img src="../../assets/admin/layout/img/loading.gif" alt="loading"/>\r\n              </div>\r\n              <div id="site_activities_content" class="display-none">\r\n                <div id="site_activities" style="height: 228px;">\r\n                </div>\r\n              </div>\r\n              <div style="margin: 20px 0 10px 30px">\r\n                <div class="row">\r\n                  <div class="col-md-3 col-sm-3 col-xs-6 text-stat">\r\n                    <span class="label label-sm label-success">\r\n                    Revenue: </span>\r\n                    <h3>$13,234</h3>\r\n                  </div>\r\n                  <div class="col-md-3 col-sm-3 col-xs-6 text-stat">\r\n                    <span class="label label-sm label-info">\r\n                    Tax: </span>\r\n                    <h3>$134,900</h3>\r\n                  </div>\r\n                  <div class="col-md-3 col-sm-3 col-xs-6 text-stat">\r\n                    <span class="label label-sm label-danger">\r\n                    Shipment: </span>\r\n                    <h3>$1,134</h3>\r\n                  </div>\r\n                  <div class="col-md-3 col-sm-3 col-xs-6 text-stat">\r\n                    <span class="label label-sm label-warning">\r\n                    Orders: </span>\r\n                    <h3>235090</h3>\r\n                  </div>\r\n                </div>\r\n              </div>\r\n            </div>\r\n          </div>\r\n          <!-- END PORTLET-->\r\n        </div>\r\n      </div>\r\n      <div class="clearfix">\r\n      </div>\r\n      <div class="row ">\r\n        <div class="col-md-6 col-sm-6">\r\n          <div class="portlet box blue-steel">\r\n            <div class="portlet-title">\r\n              <div class="caption">\r\n                <i class="fa fa-bell-o"></i>Recent Activities\r\n              </div>\r\n              <div class="actions">\r\n                <div class="btn-group">\r\n                  <a class="btn btn-sm btn-default" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                  Filter By <i class="fa fa-angle-down"></i>\r\n                  </a>\r\n                  <div class="dropdown-menu hold-on-click dropdown-checkboxes pull-right">\r\n                    <label><input type="checkbox"/> Finance</label>\r\n                    <label><input type="checkbox" checked=""/> Membership</label>\r\n                    <label><input type="checkbox"/> Customer Support</label>\r\n                    <label><input type="checkbox" checked=""/> HR</label>\r\n                    <label><input type="checkbox"/> System</label>\r\n                  </div>\r\n                </div>\r\n              </div>\r\n            </div>\r\n            <div class="portlet-body">\r\n              <div class="scroller" style="height: 300px;" data-always-visible="1" data-rail-visible="0">\r\n                <ul class="feeds">\r\n                  <li>\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-info">\r\n                            <i class="fa fa-check"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             You have 4 pending tasks. <span class="label label-sm label-warning ">\r\n                            Take action <i class="fa fa-share"></i>\r\n                            </span>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         Just now\r\n                      </div>\r\n                    </div>\r\n                  </li>\r\n                  <li>\r\n                    <a href="#">\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-success">\r\n                            <i class="fa fa-bar-chart-o"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             Finance Report for year 2013 has been released.\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         20 mins\r\n                      </div>\r\n                    </div>\r\n                    </a>\r\n                  </li>\r\n                  <li>\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-danger">\r\n                            <i class="fa fa-user"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             You have 5 pending membership that requires a quick review.\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         24 mins\r\n                      </div>\r\n                    </div>\r\n                  </li>\r\n                  <li>\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-info">\r\n                            <i class="fa fa-shopping-cart"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             New order received with <span class="label label-sm label-success">\r\n                            Reference Number: DR23923 </span>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         30 mins\r\n                      </div>\r\n                    </div>\r\n                  </li>\r\n                  <li>\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-success">\r\n                            <i class="fa fa-user"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             You have 5 pending membership that requires a quick review.\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         24 mins\r\n                      </div>\r\n                    </div>\r\n                  </li>\r\n                  <li>\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-default">\r\n                            <i class="fa fa-bell-o"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             Web server hardware needs to be upgraded. <span class="label label-sm label-default ">\r\n                            Overdue </span>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         2 hours\r\n                      </div>\r\n                    </div>\r\n                  </li>\r\n                  <li>\r\n                    <a href="#">\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-default">\r\n                            <i class="fa fa-briefcase"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             IPO Report for year 2013 has been released.\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         20 mins\r\n                      </div>\r\n                    </div>\r\n                    </a>\r\n                  </li>\r\n                  <li>\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-info">\r\n                            <i class="fa fa-check"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             You have 4 pending tasks. <span class="label label-sm label-warning ">\r\n                            Take action <i class="fa fa-share"></i>\r\n                            </span>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         Just now\r\n                      </div>\r\n                    </div>\r\n                  </li>\r\n                  <li>\r\n                    <a href="#">\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-danger">\r\n                            <i class="fa fa-bar-chart-o"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             Finance Report for year 2013 has been released.\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         20 mins\r\n                      </div>\r\n                    </div>\r\n                    </a>\r\n                  </li>\r\n                  <li>\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-default">\r\n                            <i class="fa fa-user"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             You have 5 pending membership that requires a quick review.\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         24 mins\r\n                      </div>\r\n                    </div>\r\n                  </li>\r\n                  <li>\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-info">\r\n                            <i class="fa fa-shopping-cart"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             New order received with <span class="label label-sm label-success">\r\n                            Reference Number: DR23923 </span>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         30 mins\r\n                      </div>\r\n                    </div>\r\n                  </li>\r\n                  <li>\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-success">\r\n                            <i class="fa fa-user"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             You have 5 pending membership that requires a quick review.\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         24 mins\r\n                      </div>\r\n                    </div>\r\n                  </li>\r\n                  <li>\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-warning">\r\n                            <i class="fa fa-bell-o"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             Web server hardware needs to be upgraded. <span class="label label-sm label-default ">\r\n                            Overdue </span>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         2 hours\r\n                      </div>\r\n                    </div>\r\n                  </li>\r\n                  <li>\r\n                    <a href="#">\r\n                    <div class="col1">\r\n                      <div class="cont">\r\n                        <div class="cont-col1">\r\n                          <div class="label label-sm label-info">\r\n                            <i class="fa fa-briefcase"></i>\r\n                          </div>\r\n                        </div>\r\n                        <div class="cont-col2">\r\n                          <div class="desc">\r\n                             IPO Report for year 2013 has been released.\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                    <div class="col2">\r\n                      <div class="date">\r\n                         20 mins\r\n                      </div>\r\n                    </div>\r\n                    </a>\r\n                  </li>\r\n                </ul>\r\n              </div>\r\n              <div class="scroller-footer">\r\n                <div class="btn-arrow-link pull-right">\r\n                    <a href="#">See All Records</a>\r\n                    <i class="icon-arrow-right"></i>\r\n                  </div>\r\n              </div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n        <div class="col-md-6 col-sm-6">\r\n          <div class="portlet box green-haze tasks-widget">\r\n            <div class="portlet-title">\r\n              <div class="caption">\r\n                <i class="fa fa-check"></i>Tasks\r\n              </div>\r\n              <div class="tools">\r\n                <a href="#portlet-config" data-toggle="modal" class="config">\r\n                </a>\r\n                <a href="" class="reload">\r\n                </a>\r\n              </div>\r\n              <div class="actions">\r\n                <div class="btn-group">\r\n                  <a class="btn btn-default btn-sm" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                  More <i class="fa fa-angle-down"></i>\r\n                  </a>\r\n                  <ul class="dropdown-menu pull-right">\r\n                    <li>\r\n                      <a href="#">\r\n                      <i class="i"></i> All Project </a>\r\n                    </li>\r\n                    <li class="divider">\r\n                    </li>\r\n                    <li>\r\n                      <a href="#">\r\n                      AirAsia </a>\r\n                    </li>\r\n                    <li>\r\n                      <a href="#">\r\n                      Cruise </a>\r\n                    </li>\r\n                    <li>\r\n                      <a href="#">\r\n                      HSBC </a>\r\n                    </li>\r\n                    <li class="divider">\r\n                    </li>\r\n                    <li>\r\n                      <a href="#">\r\n                      Pending <span class="badge badge-danger">\r\n                      4 </span>\r\n                      </a>\r\n                    </li>\r\n                    <li>\r\n                      <a href="#">\r\n                      Completed <span class="badge badge-success">\r\n                      12 </span>\r\n                      </a>\r\n                    </li>\r\n                    <li>\r\n                      <a href="#">\r\n                      Overdue <span class="badge badge-warning">\r\n                      9 </span>\r\n                      </a>\r\n                    </li>\r\n                  </ul>\r\n                </div>\r\n              </div>\r\n            </div>\r\n            <div class="portlet-body">\r\n              <div class="task-content">\r\n                <div class="scroller" style="height: 305px;" data-always-visible="1" data-rail-visible1="1">\r\n                  <!-- START TASK LIST -->\r\n                  <ul class="task-list">\r\n                    <li>\r\n                      <div class="task-checkbox">\r\n                        <input type="checkbox" class="liChild" value=""/>\r\n                      </div>\r\n                      <div class="task-title">\r\n                        <span class="task-title-sp">\r\n                        Present 2013 Year IPO Statistics at Board Meeting </span>\r\n                        <span class="label label-sm label-success">Company</span>\r\n                        <span class="task-bell">\r\n                        <i class="fa fa-bell-o"></i>\r\n                        </span>\r\n                      </div>\r\n                      <div class="task-config">\r\n                        <div class="task-config-btn btn-group">\r\n                          <a class="btn btn-xs default" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                          <i class="fa fa-cog"></i><i class="fa fa-angle-down"></i>\r\n                          </a>\r\n                          <ul class="dropdown-menu pull-right">\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-check"></i> Complete </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-pencil"></i> Edit </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-trash-o"></i> Cancel </a>\r\n                            </li>\r\n                          </ul>\r\n                        </div>\r\n                      </div>\r\n                    </li>\r\n                    <li>\r\n                      <div class="task-checkbox">\r\n                        <input type="checkbox" class="liChild" value=""/>\r\n                      </div>\r\n                      <div class="task-title">\r\n                        <span class="task-title-sp">\r\n                        Hold An Interview for Marketing Manager Position </span>\r\n                        <span class="label label-sm label-danger">Marketing</span>\r\n                      </div>\r\n                      <div class="task-config">\r\n                        <div class="task-config-btn btn-group">\r\n                          <a class="btn btn-xs default" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                          <i class="fa fa-cog"></i><i class="fa fa-angle-down"></i>\r\n                          </a>\r\n                          <ul class="dropdown-menu pull-right">\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-check"></i> Complete </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-pencil"></i> Edit </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-trash-o"></i> Cancel </a>\r\n                            </li>\r\n                          </ul>\r\n                        </div>\r\n                      </div>\r\n                    </li>\r\n                    <li>\r\n                      <div class="task-checkbox">\r\n                        <input type="checkbox" class="liChild" value=""/>\r\n                      </div>\r\n                      <div class="task-title">\r\n                        <span class="task-title-sp">\r\n                        AirAsia Intranet System Project Internal Meeting </span>\r\n                        <span class="label label-sm label-success">AirAsia</span>\r\n                        <span class="task-bell">\r\n                        <i class="fa fa-bell-o"></i>\r\n                        </span>\r\n                      </div>\r\n                      <div class="task-config">\r\n                        <div class="task-config-btn btn-group">\r\n                          <a class="btn btn-xs default" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                          <i class="fa fa-cog"></i><i class="fa fa-angle-down"></i>\r\n                          </a>\r\n                          <ul class="dropdown-menu pull-right">\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-check"></i> Complete </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-pencil"></i> Edit </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-trash-o"></i> Cancel </a>\r\n                            </li>\r\n                          </ul>\r\n                        </div>\r\n                      </div>\r\n                    </li>\r\n                    <li>\r\n                      <div class="task-checkbox">\r\n                        <input type="checkbox" class="liChild" value=""/>\r\n                      </div>\r\n                      <div class="task-title">\r\n                        <span class="task-title-sp">\r\n                        Technical Management Meeting </span>\r\n                        <span class="label label-sm label-warning">Company</span>\r\n                      </div>\r\n                      <div class="task-config">\r\n                        <div class="task-config-btn btn-group">\r\n                          <a class="btn btn-xs default" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                          <i class="fa fa-cog"></i><i class="fa fa-angle-down"></i>\r\n                          </a>\r\n                          <ul class="dropdown-menu pull-right">\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-check"></i> Complete </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-pencil"></i> Edit </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-trash-o"></i> Cancel </a>\r\n                            </li>\r\n                          </ul>\r\n                        </div>\r\n                      </div>\r\n                    </li>\r\n                    <li>\r\n                      <div class="task-checkbox">\r\n                        <input type="checkbox" class="liChild" value=""/>\r\n                      </div>\r\n                      <div class="task-title">\r\n                        <span class="task-title-sp">\r\n                        Kick-off Company CRM Mobile App Development </span>\r\n                        <span class="label label-sm label-info">Internal Products</span>\r\n                      </div>\r\n                      <div class="task-config">\r\n                        <div class="task-config-btn btn-group">\r\n                          <a class="btn btn-xs default" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                          <i class="fa fa-cog"></i><i class="fa fa-angle-down"></i>\r\n                          </a>\r\n                          <ul class="dropdown-menu pull-right">\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-check"></i> Complete </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-pencil"></i> Edit </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-trash-o"></i> Cancel </a>\r\n                            </li>\r\n                          </ul>\r\n                        </div>\r\n                      </div>\r\n                    </li>\r\n                    <li>\r\n                      <div class="task-checkbox">\r\n                        <input type="checkbox" class="liChild" value=""/>\r\n                      </div>\r\n                      <div class="task-title">\r\n                        <span class="task-title-sp">\r\n                        Prepare Commercial Offer For SmartVision Website Rewamp </span>\r\n                        <span class="label label-sm label-danger">SmartVision</span>\r\n                      </div>\r\n                      <div class="task-config">\r\n                        <div class="task-config-btn btn-group">\r\n                          <a class="btn btn-xs default" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                          <i class="fa fa-cog"></i><i class="fa fa-angle-down"></i>\r\n                          </a>\r\n                          <ul class="dropdown-menu pull-right">\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-check"></i> Complete </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-pencil"></i> Edit </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-trash-o"></i> Cancel </a>\r\n                            </li>\r\n                          </ul>\r\n                        </div>\r\n                      </div>\r\n                    </li>\r\n                    <li>\r\n                      <div class="task-checkbox">\r\n                        <input type="checkbox" class="liChild" value=""/>\r\n                      </div>\r\n                      <div class="task-title">\r\n                        <span class="task-title-sp">\r\n                        Sign-Off The Comercial Agreement With AutoSmart </span>\r\n                        <span class="label label-sm label-default">AutoSmart</span>\r\n                        <span class="task-bell">\r\n                        <i class="fa fa-bell-o"></i>\r\n                        </span>\r\n                      </div>\r\n                      <div class="task-config">\r\n                        <div class="task-config-btn btn-group">\r\n                          <a class="btn btn-xs default" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                          <i class="fa fa-cog"></i><i class="fa fa-angle-down"></i>\r\n                          </a>\r\n                          <ul class="dropdown-menu pull-right">\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-check"></i> Complete </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-pencil"></i> Edit </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-trash-o"></i> Cancel </a>\r\n                            </li>\r\n                          </ul>\r\n                        </div>\r\n                      </div>\r\n                    </li>\r\n                    <li>\r\n                      <div class="task-checkbox">\r\n                        <input type="checkbox" class="liChild" value=""/>\r\n                      </div>\r\n                      <div class="task-title">\r\n                        <span class="task-title-sp">\r\n                        Company Staff Meeting </span>\r\n                        <span class="label label-sm label-success">Cruise</span>\r\n                        <span class="task-bell">\r\n                        <i class="fa fa-bell-o"></i>\r\n                        </span>\r\n                      </div>\r\n                      <div class="task-config">\r\n                        <div class="task-config-btn btn-group">\r\n                          <a class="btn btn-xs default" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                          <i class="fa fa-cog"></i><i class="fa fa-angle-down"></i>\r\n                          </a>\r\n                          <ul class="dropdown-menu pull-right">\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-check"></i> Complete </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-pencil"></i> Edit </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-trash-o"></i> Cancel </a>\r\n                            </li>\r\n                          </ul>\r\n                        </div>\r\n                      </div>\r\n                    </li>\r\n                    <li class="last-line">\r\n                      <div class="task-checkbox">\r\n                        <input type="checkbox" class="liChild" value=""/>\r\n                      </div>\r\n                      <div class="task-title">\r\n                        <span class="task-title-sp">\r\n                        KeenThemes Investment Discussion </span>\r\n                        <span class="label label-sm label-warning">KeenThemes </span>\r\n                      </div>\r\n                      <div class="task-config">\r\n                        <div class="task-config-btn btn-group">\r\n                          <a class="btn btn-xs default" href="#" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                          <i class="fa fa-cog"></i><i class="fa fa-angle-down"></i>\r\n                          </a>\r\n                          <ul class="dropdown-menu pull-right">\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-check"></i> Complete </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-pencil"></i> Edit </a>\r\n                            </li>\r\n                            <li>\r\n                              <a href="#">\r\n                              <i class="fa fa-trash-o"></i> Cancel </a>\r\n                            </li>\r\n                          </ul>\r\n                        </div>\r\n                      </div>\r\n                    </li>\r\n                  </ul>\r\n                  <!-- END START TASK LIST -->\r\n                </div>\r\n              </div>\r\n              <div class="task-footer">\r\n                <div class="btn-arrow-link pull-right">\r\n                    <a href="#">See All Records</a>\r\n                    <i class="icon-arrow-right"></i>\r\n                  </div>\r\n              </div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n      </div>\r\n      <div class="clearfix">\r\n      </div>\r\n      <div class="row ">\r\n        <div class="col-md-6 col-sm-6">\r\n          <div class="portlet box purple-wisteria">\r\n            <div class="portlet-title">\r\n              <div class="caption">\r\n                <i class="fa fa-calendar"></i>General Stats\r\n              </div>\r\n              <div class="actions">\r\n                <a href="javascript:;" class="btn btn-sm btn-default easy-pie-chart-reload">\r\n                <i class="fa fa-repeat"></i> Reload </a>\r\n              </div>\r\n            </div>\r\n            <div class="portlet-body">\r\n              <div class="row">\r\n                <div class="col-md-4">\r\n                  <div class="easy-pie-chart">\r\n                    <div class="number transactions" data-percent="55">\r\n                      <span>\r\n                      +55 </span>\r\n                      %\r\n                    </div>\r\n                    <a class="title" href="#">\r\n                    Transactions <i class="icon-arrow-right"></i>\r\n                    </a>\r\n                  </div>\r\n                </div>\r\n                <div class="margin-bottom-10 visible-sm">\r\n                </div>\r\n                <div class="col-md-4">\r\n                  <div class="easy-pie-chart">\r\n                    <div class="number visits" data-percent="85">\r\n                      <span>\r\n                      +85 </span>\r\n                      %\r\n                    </div>\r\n                    <a class="title" href="#">\r\n                    New Visits <i class="icon-arrow-right"></i>\r\n                    </a>\r\n                  </div>\r\n                </div>\r\n                <div class="margin-bottom-10 visible-sm">\r\n                </div>\r\n                <div class="col-md-4">\r\n                  <div class="easy-pie-chart">\r\n                    <div class="number bounce" data-percent="46">\r\n                      <span>\r\n                      -46 </span>\r\n                      %\r\n                    </div>\r\n                    <a class="title" href="#">\r\n                    Bounce <i class="icon-arrow-right"></i>\r\n                    </a>\r\n                  </div>\r\n                </div>\r\n              </div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n        <div class="col-md-6 col-sm-6">\r\n          <div class="portlet box red-sunglo">\r\n            <div class="portlet-title">\r\n              <div class="caption">\r\n                <i class="fa fa-calendar"></i>Server Stats\r\n              </div>\r\n              <div class="tools">\r\n                <a href="" class="collapse">\r\n                </a>\r\n                <a href="#portlet-config" data-toggle="modal" class="config">\r\n                </a>\r\n                <a href="" class="reload">\r\n                </a>\r\n                <a href="" class="remove">\r\n                </a>\r\n              </div>\r\n            </div>\r\n            <div class="portlet-body">\r\n              <div class="row">\r\n                <div class="col-md-4">\r\n                  <div class="sparkline-chart">\r\n                    <div class="number" id="sparkline_bar">\r\n                    </div>\r\n                    <a class="title" href="#">\r\n                    Network <i class="icon-arrow-right"></i>\r\n                    </a>\r\n                  </div>\r\n                </div>\r\n                <div class="margin-bottom-10 visible-sm">\r\n                </div>\r\n                <div class="col-md-4">\r\n                  <div class="sparkline-chart">\r\n                    <div class="number" id="sparkline_bar2">\r\n                    </div>\r\n                    <a class="title" href="#">\r\n                    CPU Load <i class="icon-arrow-right"></i>\r\n                    </a>\r\n                  </div>\r\n                </div>\r\n                <div class="margin-bottom-10 visible-sm">\r\n                </div>\r\n                <div class="col-md-4">\r\n                  <div class="sparkline-chart">\r\n                    <div class="number" id="sparkline_line">\r\n                    </div>\r\n                    <a class="title" href="#">\r\n                    Load Rate <i class="icon-arrow-right"></i>\r\n                    </a>\r\n                  </div>\r\n                </div>\r\n              </div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n      </div>\r\n      <div class="clearfix">\r\n      </div>\r\n      <div class="row ">\r\n        <div class="col-md-6 col-sm-6">\r\n          <!-- BEGIN REGIONAL STATS PORTLET-->\r\n          <div class="portlet">\r\n            <div class="portlet-title">\r\n              <div class="caption">\r\n                <i class="fa fa-globe"></i>Regional Stats\r\n              </div>\r\n              <div class="tools">\r\n                <a href="" class="collapse">\r\n                </a>\r\n                <a href="#portlet-config" data-toggle="modal" class="config">\r\n                </a>\r\n                <a href="" class="reload">\r\n                </a>\r\n                <a href="" class="remove">\r\n                </a>\r\n              </div>\r\n            </div>\r\n            <div class="portlet-body">\r\n              <div id="region_statistics_loading">\r\n                <img src="../../assets/admin/layout/img/loading.gif" alt="loading"/>\r\n              </div>\r\n              <div id="region_statistics_content" class="display-none">\r\n                <div class="btn-toolbar margin-bottom-10">\r\n                  <div class="btn-group" data-toggle="buttons">\r\n                    <a href="" class="btn default btn-sm active">\r\n                    Users </a>\r\n                    <a href="" class="btn default btn-sm">\r\n                    Orders </a>\r\n                  </div>\r\n                  <div class="btn-group pull-right">\r\n                    <a href="" class="btn default btn-sm dropdown-toggle" data-toggle="dropdown" data-hover="dropdown" data-close-others="true">\r\n                    Select Region <span class="fa fa-angle-down">\r\n                    </span>\r\n                    </a>\r\n                    <ul class="dropdown-menu pull-right">\r\n                      <li>\r\n                        <a href="javascript:;" id="regional_stat_world">\r\n                        World </a>\r\n                      </li>\r\n                      <li>\r\n                        <a href="javascript:;" id="regional_stat_usa">\r\n                        USA </a>\r\n                      </li>\r\n                      <li>\r\n                        <a href="javascript:;" id="regional_stat_europe">\r\n                        Europe </a>\r\n                      </li>\r\n                      <li>\r\n                        <a href="javascript:;" id="regional_stat_russia">\r\n                        Russia </a>\r\n                      </li>\r\n                      <li>\r\n                        <a href="javascript:;" id="regional_stat_germany">\r\n                        Germany </a>\r\n                      </li>\r\n                    </ul>\r\n                  </div>\r\n                </div>\r\n                <div id="vmap_world" class="vmaps display-none">\r\n                </div>\r\n                <div id="vmap_usa" class="vmaps display-none">\r\n                </div>\r\n                <div id="vmap_europe" class="vmaps display-none">\r\n                </div>\r\n                <div id="vmap_russia" class="vmaps display-none">\r\n                </div>\r\n                <div id="vmap_germany" class="vmaps display-none">\r\n                </div>\r\n              </div>\r\n            </div>\r\n          </div>\r\n          <!-- END REGIONAL STATS PORTLET-->\r\n        </div>\r\n        <div class="col-md-6 col-sm-6">\r\n          <!-- BEGIN PORTLET-->\r\n          <div class="portlet paddingless">\r\n            <div class="portlet-title line">\r\n              <div class="caption">\r\n                <i class="fa fa-bell-o"></i>Feeds\r\n              </div>\r\n              <div class="tools">\r\n                <a href="" class="collapse">\r\n                </a>\r\n                <a href="#portlet-config" data-toggle="modal" class="config">\r\n                </a>\r\n                <a href="" class="reload">\r\n                </a>\r\n                <a href="" class="remove">\r\n                </a>\r\n              </div>\r\n            </div>\r\n            <div class="portlet-body">\r\n              <!--BEGIN TABS-->\r\n              <div class="tabbable tabbable-custom">\r\n                <ul class="nav nav-tabs">\r\n                  <li class="active">\r\n                    <a href="#tab_1_1" data-toggle="tab">\r\n                    System </a>\r\n                  </li>\r\n                  <li>\r\n                    <a href="#tab_1_2" data-toggle="tab">\r\n                    Activities </a>\r\n                  </li>\r\n                  <li>\r\n                    <a href="#tab_1_3" data-toggle="tab">\r\n                    Recent Users </a>\r\n                  </li>\r\n                </ul>\r\n                <div class="tab-content">\r\n                  <div class="tab-pane active" id="tab_1_1">\r\n                    <div class="scroller" style="height: 290px;" data-always-visible="1" data-rail-visible="0">\r\n                      <ul class="feeds">\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   You have 4 pending tasks. <span class="label label-sm label-danger ">\r\n                                  Take action <i class="fa fa-share"></i>\r\n                                  </span>\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               Just now\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <a href="#">\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New version v1.4 just lunched!\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               20 mins\r\n                            </div>\r\n                          </div>\r\n                          </a>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-danger">\r\n                                  <i class="fa fa-bolt"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   Database server #12 overloaded. Please fix the issue.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               24 mins\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-info">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               30 mins\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               40 mins\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-warning">\r\n                                  <i class="fa fa-plus"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New user registered.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               1.5 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   Web server hardware needs to be upgraded. <span class="label label-sm label-default ">\r\n                                  Overdue </span>\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               2 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-default">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               3 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-warning">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               5 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-info">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               18 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-default">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               21 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-info">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               22 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-default">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               21 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-info">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               22 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-default">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               21 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-info">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               22 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-default">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               21 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-info">\r\n                                  <i class="fa fa-bullhorn"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received. Please take care of it.\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               22 hours\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                      </ul>\r\n                    </div>\r\n                  </div>\r\n                  <div class="tab-pane" id="tab_1_2">\r\n                    <div class="scroller" style="height: 290px;" data-always-visible="1" data-rail-visible1="1">\r\n                      <ul class="feeds">\r\n                        <li>\r\n                          <a href="#">\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New user registered\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               Just now\r\n                            </div>\r\n                          </div>\r\n                          </a>\r\n                        </li>\r\n                        <li>\r\n                          <a href="#">\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New order received\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               10 mins\r\n                            </div>\r\n                          </div>\r\n                          </a>\r\n                        </li>\r\n                        <li>\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-danger">\r\n                                  <i class="fa fa-bolt"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   Order #24DOP4 has been rejected. <span class="label label-sm label-danger ">\r\n                                  Take action <i class="fa fa-share"></i>\r\n                                  </span>\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               24 mins\r\n                            </div>\r\n                          </div>\r\n                        </li>\r\n                        <li>\r\n                          <a href="#">\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New user registered\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               Just now\r\n                            </div>\r\n                          </div>\r\n                          </a>\r\n                        </li>\r\n                        <li>\r\n                          <a href="#">\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New user registered\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               Just now\r\n                            </div>\r\n                          </div>\r\n                          </a>\r\n                        </li>\r\n                        <li>\r\n                          <a href="#">\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New user registered\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               Just now\r\n                            </div>\r\n                          </div>\r\n                          </a>\r\n                        </li>\r\n                        <li>\r\n                          <a href="#">\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New user registered\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               Just now\r\n                            </div>\r\n                          </div>\r\n                          </a>\r\n                        </li>\r\n                        <li>\r\n                          <a href="#">\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New user registered\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               Just now\r\n                            </div>\r\n                          </div>\r\n                          </a>\r\n                        </li>\r\n                        <li>\r\n                          <a href="#">\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New user registered\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               Just now\r\n                            </div>\r\n                          </div>\r\n                          </a>\r\n                        </li>\r\n                        <li>\r\n                          <a href="#">\r\n                          <div class="col1">\r\n                            <div class="cont">\r\n                              <div class="cont-col1">\r\n                                <div class="label label-sm label-success">\r\n                                  <i class="fa fa-bell-o"></i>\r\n                                </div>\r\n                              </div>\r\n                              <div class="cont-col2">\r\n                                <div class="desc">\r\n                                   New user registered\r\n                                </div>\r\n                              </div>\r\n                            </div>\r\n                          </div>\r\n                          <div class="col2">\r\n                            <div class="date">\r\n                               Just now\r\n                            </div>\r\n                          </div>\r\n                          </a>\r\n                        </li>\r\n                      </ul>\r\n                    </div>\r\n                  </div>\r\n                  <div class="tab-pane" id="tab_1_3">\r\n                    <div class="scroller" style="height: 290px;" data-always-visible="1" data-rail-visible1="1">\r\n                      <div class="row">\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Robert Nilson </a>\r\n                              <span class="label label-sm label-success label-mini">\r\n                              Approved </span>\r\n                            </div>\r\n                            <div>\r\n                               29 Jan 2013 10:45AM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Lisa Miller </a>\r\n                              <span class="label label-sm label-info">\r\n                              Pending </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 10:45AM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                      <div class="row">\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Eric Kim </a>\r\n                              <span class="label label-sm label-info">\r\n                              Pending </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 12:45PM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Lisa Miller </a>\r\n                              <span class="label label-sm label-danger">\r\n                              In progress </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 11:55PM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                      <div class="row">\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Eric Kim </a>\r\n                              <span class="label label-sm label-info">\r\n                              Pending </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 12:45PM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Lisa Miller </a>\r\n                              <span class="label label-sm label-danger">\r\n                              In progress </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 11:55PM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                      <div class="row">\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Eric Kim </a>\r\n                              <span class="label label-sm label-info">\r\n                              Pending </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 12:45PM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Lisa Miller </a>\r\n                              <span class="label label-sm label-danger">\r\n                              In progress </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 11:55PM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                      <div class="row">\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Eric Kim </a>\r\n                              <span class="label label-sm label-info">\r\n                              Pending </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 12:45PM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Lisa Miller </a>\r\n                              <span class="label label-sm label-danger">\r\n                              In progress </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 11:55PM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                      <div class="row">\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Eric Kim </a>\r\n                              <span class="label label-sm label-info">\r\n                              Pending </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 12:45PM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                        <div class="col-md-6 user-info">\r\n                          <img alt="" src="../../assets/admin/layout/img/avatar.png" class="img-responsive"/>\r\n                          <div class="details">\r\n                            <div>\r\n                              <a href="#">\r\n                              Lisa Miller </a>\r\n                              <span class="label label-sm label-danger">\r\n                              In progress </span>\r\n                            </div>\r\n                            <div>\r\n                               19 Jan 2013 11:55PM\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                      </div>\r\n                    </div>\r\n                  </div>\r\n                </div>\r\n              </div>\r\n              <!--END TABS-->\r\n            </div>\r\n          </div>\r\n          <!-- END PORTLET-->\r\n        </div>\r\n      </div>\r\n      <div class="clearfix">\r\n      </div>\r\n      <div class="row ">\r\n        <div class="col-md-6 col-sm-6">\r\n          <!-- BEGIN PORTLET-->\r\n          <div class="portlet box blue-madison calendar">\r\n            <div class="portlet-title">\r\n              <div class="caption">\r\n                <i class="fa fa-calendar"></i>Calendar\r\n              </div>\r\n            </div>\r\n            <div class="portlet-body light-grey">\r\n              <div id="calendar">\r\n              </div>\r\n            </div>\r\n          </div>\r\n          <!-- END PORTLET-->\r\n        </div>\r\n        <div class="col-md-6 col-sm-6">\r\n          <!-- BEGIN PORTLET-->\r\n          <div class="portlet">\r\n            <div class="portlet-title line">\r\n              <div class="caption">\r\n                <i class="fa fa-comments"></i>Chats\r\n              </div>\r\n              <div class="tools">\r\n                <a href="" class="collapse">\r\n                </a>\r\n                <a href="#portlet-config" data-toggle="modal" class="config">\r\n                </a>\r\n                <a href="" class="reload">\r\n                </a>\r\n                <a href="" class="remove">\r\n                </a>\r\n              </div>\r\n            </div>\r\n            <div class="portlet-body" id="chats">\r\n              <div class="scroller" style="height: 435px;" data-always-visible="1" data-rail-visible1="1">\r\n                <ul class="chats">\r\n                  <li class="in">\r\n                    <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar1.jpg"/>\r\n                    <div class="message">\r\n                      <span class="arrow">\r\n                      </span>\r\n                      <a href="#" class="name">\r\n                      Bob Nilson </a>\r\n                      <span class="datetime">\r\n                      at 20:09 </span>\r\n                      <span class="body">\r\n                      Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. </span>\r\n                    </div>\r\n                  </li>\r\n                  <li class="out">\r\n                    <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar2.jpg"/>\r\n                    <div class="message">\r\n                      <span class="arrow">\r\n                      </span>\r\n                      <a href="#" class="name">\r\n                      Lisa Wong </a>\r\n                      <span class="datetime">\r\n                      at 20:11 </span>\r\n                      <span class="body">\r\n                      Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. </span>\r\n                    </div>\r\n                  </li>\r\n                  <li class="in">\r\n                    <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar1.jpg"/>\r\n                    <div class="message">\r\n                      <span class="arrow">\r\n                      </span>\r\n                      <a href="#" class="name">\r\n                      Bob Nilson </a>\r\n                      <span class="datetime">\r\n                      at 20:30 </span>\r\n                      <span class="body">\r\n                      Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. </span>\r\n                    </div>\r\n                  </li>\r\n                  <li class="out">\r\n                    <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar3.jpg"/>\r\n                    <div class="message">\r\n                      <span class="arrow">\r\n                      </span>\r\n                      <a href="#" class="name">\r\n                      Richard Doe </a>\r\n                      <span class="datetime">\r\n                      at 20:33 </span>\r\n                      <span class="body">\r\n                      Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. </span>\r\n                    </div>\r\n                  </li>\r\n                  <li class="in">\r\n                    <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar3.jpg"/>\r\n                    <div class="message">\r\n                      <span class="arrow">\r\n                      </span>\r\n                      <a href="#" class="name">\r\n                      Richard Doe </a>\r\n                      <span class="datetime">\r\n                      at 20:35 </span>\r\n                      <span class="body">\r\n                      Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. </span>\r\n                    </div>\r\n                  </li>\r\n                  <li class="out">\r\n                    <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar1.jpg"/>\r\n                    <div class="message">\r\n                      <span class="arrow">\r\n                      </span>\r\n                      <a href="#" class="name">\r\n                      Bob Nilson </a>\r\n                      <span class="datetime">\r\n                      at 20:40 </span>\r\n                      <span class="body">\r\n                      Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. </span>\r\n                    </div>\r\n                  </li>\r\n                  <li class="in">\r\n                    <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar3.jpg"/>\r\n                    <div class="message">\r\n                      <span class="arrow">\r\n                      </span>\r\n                      <a href="#" class="name">\r\n                      Richard Doe </a>\r\n                      <span class="datetime">\r\n                      at 20:40 </span>\r\n                      <span class="body">\r\n                      Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. </span>\r\n                    </div>\r\n                  </li>\r\n                  <li class="out">\r\n                    <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar1.jpg"/>\r\n                    <div class="message">\r\n                      <span class="arrow">\r\n                      </span>\r\n                      <a href="#" class="name">\r\n                      Bob Nilson </a>\r\n                      <span class="datetime">\r\n                      at 20:54 </span>\r\n                      <span class="body">\r\n                      Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. sed diam nonummy nibh euismod tincidunt ut laoreet. </span>\r\n                    </div>\r\n                  </li>\r\n                </ul>\r\n              </div>\r\n              <div class="chat-form">\r\n                <div class="input-cont">\r\n                  <input class="form-control" type="text" placeholder="Type a message here..."/>\r\n                </div>\r\n                <div class="btn-cont">\r\n                  <span class="arrow">\r\n                  </span>\r\n                  <a href="" class="btn blue icn-only">\r\n                  <i class="fa fa-check icon-white"></i>\r\n                  </a>\r\n                </div>\r\n              </div>\r\n            </div>\r\n          </div>\r\n          <!-- END PORTLET-->\r\n        </div>\r\n      </div>\r\n    </div>\r\n  </div>\r\n  <!-- END CONTENT -->\r\n  <!-- BEGIN QUICK SIDEBAR -->\r\n    <a href="javascript:;" class="page-quick-sidebar-toggler"><i class="icon-close"></i></a>\r\n    <div class="page-quick-sidebar-wrapper">\r\n        <div class="page-quick-sidebar">            \r\n            <div class="nav-justified">\r\n                <ul class="nav nav-tabs nav-justified">\r\n                    <li class="active">\r\n                        <a href="#quick_sidebar_tab_1" data-toggle="tab">\r\n                        Users <span class="badge badge-danger">2</span>\r\n                        </a>\r\n                    </li>\r\n                    <li>\r\n                        <a href="#quick_sidebar_tab_2" data-toggle="tab">\r\n                        Alerts <span class="badge badge-success">7</span>\r\n                        </a>\r\n                    </li>\r\n                    <li class="dropdown">\r\n                        <a href="#" class="dropdown-toggle" data-toggle="dropdown">\r\n                        More<i class="fa fa-angle-down"></i>\r\n                        </a>\r\n                        <ul class="dropdown-menu pull-right" role="menu">\r\n                            <li>\r\n                                <a href="#quick_sidebar_tab_3" data-toggle="tab">\r\n                                <i class="icon-bell"></i> Alerts </a>\r\n                            </li>\r\n                            <li>\r\n                                <a href="#quick_sidebar_tab_3" data-toggle="tab">\r\n                                <i class="icon-info"></i> Notifications </a>\r\n                            </li>\r\n                            <li>\r\n                                <a href="#quick_sidebar_tab_3" data-toggle="tab">\r\n                                <i class="icon-speech"></i> Activities </a>\r\n                            </li>\r\n                            <li class="divider">\r\n                            </li>\r\n                            <li>\r\n                                <a href="#quick_sidebar_tab_3" data-toggle="tab">\r\n                                <i class="icon-settings"></i> Settings </a>\r\n                            </li>\r\n                        </ul>\r\n                    </li>\r\n                </ul>\r\n                <div class="tab-content">\r\n                    <div class="tab-pane active page-quick-sidebar-chat" id="quick_sidebar_tab_1">\r\n                        <div class="page-quick-sidebar-chat-users" data-rail-color="#ddd" data-wrapper-class="page-quick-sidebar-list">\r\n                            <h3 class="list-heading">Staff</h3>\r\n                            <ul class="media-list list-items">\r\n                                <li class="media">\r\n                                    <div class="media-status">\r\n                                        <span class="badge badge-success">8</span>\r\n                                    </div>\r\n                                    <img class="media-object" src="../../assets/admin/layout/img/avatar3.jpg" alt="...">\r\n                                    <div class="media-body">\r\n                                        <h4 class="media-heading">Bob Nilson</h4>\r\n                                        <div class="media-heading-sub">\r\n                                             Project Manager\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li class="media">\r\n                                    <img class="media-object" src="../../assets/admin/layout/img/avatar1.jpg" alt="...">\r\n                                    <div class="media-body">\r\n                                        <h4 class="media-heading">Nick Larson</h4>\r\n                                        <div class="media-heading-sub">\r\n                                             Art Director\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li class="media">\r\n                                    <div class="media-status">\r\n                                        <span class="badge badge-danger">3</span>\r\n                                    </div>\r\n                                    <img class="media-object" src="../../assets/admin/layout/img/avatar4.jpg" alt="...">\r\n                                    <div class="media-body">\r\n                                        <h4 class="media-heading">Deon Hubert</h4>\r\n                                        <div class="media-heading-sub">\r\n                                             CTO\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li class="media">\r\n                                    <img class="media-object" src="../../assets/admin/layout/img/avatar2.jpg" alt="...">\r\n                                    <div class="media-body">\r\n                                        <h4 class="media-heading">Ella Wong</h4>\r\n                                        <div class="media-heading-sub">\r\n                                             CEO\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                            </ul>\r\n                            <h3 class="list-heading">Customers</h3>\r\n                            <ul class="media-list list-items">\r\n                                <li class="media">\r\n                                    <div class="media-status">\r\n                                        <span class="badge badge-warning">2</span>\r\n                                    </div>\r\n                                    <img class="media-object" src="../../assets/admin/layout/img/avatar6.jpg" alt="...">\r\n                                    <div class="media-body">\r\n                                        <h4 class="media-heading">Lara Kunis</h4>\r\n                                        <div class="media-heading-sub">\r\n                                             CEO, Loop Inc\r\n                                        </div>\r\n                                        <div class="media-heading-small">\r\n                                             Last seen 03:10 AM\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li class="media">\r\n                                    <div class="media-status">\r\n                                        <span class="label label-sm label-success">new</span>\r\n                                    </div>\r\n                                    <img class="media-object" src="../../assets/admin/layout/img/avatar7.jpg" alt="...">\r\n                                    <div class="media-body">\r\n                                        <h4 class="media-heading">Ernie Kyllonen</h4>\r\n                                        <div class="media-heading-sub">\r\n                                             Project Manager,<br>\r\n                                             SmartBizz PTL\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li class="media">\r\n                                    <img class="media-object" src="../../assets/admin/layout/img/avatar8.jpg" alt="...">\r\n                                    <div class="media-body">\r\n                                        <h4 class="media-heading">Lisa Stone</h4>\r\n                                        <div class="media-heading-sub">\r\n                                             CTO, Keort Inc\r\n                                        </div>\r\n                                        <div class="media-heading-small">\r\n                                             Last seen 13:10 PM\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li class="media">\r\n                                    <div class="media-status">\r\n                                        <span class="badge badge-success">7</span>\r\n                                    </div>\r\n                                    <img class="media-object" src="../../assets/admin/layout/img/avatar9.jpg" alt="...">\r\n                                    <div class="media-body">\r\n                                        <h4 class="media-heading">Deon Portalatin</h4>\r\n                                        <div class="media-heading-sub">\r\n                                             CFO, H&D LTD\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li class="media">\r\n                                    <img class="media-object" src="../../assets/admin/layout/img/avatar10.jpg" alt="...">\r\n                                    <div class="media-body">\r\n                                        <h4 class="media-heading">Irina Savikova</h4>\r\n                                        <div class="media-heading-sub">\r\n                                             CEO, Tizda Motors Inc\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li class="media">\r\n                                    <div class="media-status">\r\n                                        <span class="badge badge-danger">4</span>\r\n                                    </div>\r\n                                    <img class="media-object" src="../../assets/admin/layout/img/avatar11.jpg" alt="...">\r\n                                    <div class="media-body">\r\n                                        <h4 class="media-heading">Maria Gomez</h4>\r\n                                        <div class="media-heading-sub">\r\n                                             Manager, Infomatic Inc\r\n                                        </div>\r\n                                        <div class="media-heading-small">\r\n                                             Last seen 03:10 AM\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                            </ul>\r\n                        </div>\r\n                        <div class="page-quick-sidebar-item">\r\n                            <div class="page-quick-sidebar-chat-user">\r\n                                <div class="page-quick-sidebar-nav">\r\n                                    <a href="javascript:;" class="page-quick-sidebar-back-to-list"><i class="icon-arrow-left"></i>Back</a>\r\n                                </div>\r\n                                <div class="page-quick-sidebar-chat-user-messages">\r\n                                    <div class="post out">\r\n                                        <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar3.jpg"/>\r\n                                        <div class="message">\r\n                                            <span class="arrow"></span>\r\n                                            <a href="#" class="name">Bob Nilson</a>\r\n                                            <span class="datetime">20:15</span>\r\n                                            <span class="body">\r\n                                            When could you send me the report ? </span>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="post in">\r\n                                        <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar2.jpg"/>\r\n                                        <div class="message">\r\n                                            <span class="arrow"></span>\r\n                                            <a href="#" class="name">Ella Wong</a>\r\n                                            <span class="datetime">20:15</span>\r\n                                            <span class="body">\r\n                                            Its almost done. I will be sending it shortly </span>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="post out">\r\n                                        <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar3.jpg"/>\r\n                                        <div class="message">\r\n                                            <span class="arrow"></span>\r\n                                            <a href="#" class="name">Bob Nilson</a>\r\n                                            <span class="datetime">20:15</span>\r\n                                            <span class="body">\r\n                                            Alright. Thanks! :) </span>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="post in">\r\n                                        <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar2.jpg"/>\r\n                                        <div class="message">\r\n                                            <span class="arrow"></span>\r\n                                            <a href="#" class="name">Ella Wong</a>\r\n                                            <span class="datetime">20:16</span>\r\n                                            <span class="body">\r\n                                            You are most welcome. Sorry for the delay. </span>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="post out">\r\n                                        <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar3.jpg"/>\r\n                                        <div class="message">\r\n                                            <span class="arrow"></span>\r\n                                            <a href="#" class="name">Bob Nilson</a>\r\n                                            <span class="datetime">20:17</span>\r\n                                            <span class="body">\r\n                                            No probs. Just take your time :) </span>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="post in">\r\n                                        <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar2.jpg"/>\r\n                                        <div class="message">\r\n                                            <span class="arrow"></span>\r\n                                            <a href="#" class="name">Ella Wong</a>\r\n                                            <span class="datetime">20:40</span>\r\n                                            <span class="body">\r\n                                            Alright. I just emailed it to you. </span>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="post out">\r\n                                        <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar3.jpg"/>\r\n                                        <div class="message">\r\n                                            <span class="arrow"></span>\r\n                                            <a href="#" class="name">Bob Nilson</a>\r\n                                            <span class="datetime">20:17</span>\r\n                                            <span class="body">\r\n                                            Great! Thanks. Will check it right away. </span>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="post in">\r\n                                        <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar2.jpg"/>\r\n                                        <div class="message">\r\n                                            <span class="arrow"></span>\r\n                                            <a href="#" class="name">Ella Wong</a>\r\n                                            <span class="datetime">20:40</span>\r\n                                            <span class="body">\r\n                                            Please let me know if you have any comment. </span>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="post out">\r\n                                        <img class="avatar" alt="" src="../../assets/admin/layout/img/avatar3.jpg"/>\r\n                                        <div class="message">\r\n                                            <span class="arrow"></span>\r\n                                            <a href="#" class="name">Bob Nilson</a>\r\n                                            <span class="datetime">20:17</span>\r\n                                            <span class="body">\r\n                                            Sure. I will check and buzz you if anything needs to be corrected. </span>\r\n                                        </div>\r\n                                    </div>\r\n                                </div>\r\n                                <div class="page-quick-sidebar-chat-user-form">\r\n                                    <div class="input-group">\r\n                                        <input type="text" class="form-control" placeholder="Type a message here...">\r\n                                        <div class="input-group-btn">\r\n                                            <button type="button" class="btn blue"><i class="icon-paper-clip"></i></button>\r\n                                        </div>\r\n                                    </div>\r\n                                </div>\r\n                            </div>\r\n                        </div>\r\n                    </div>\r\n                    <div class="tab-pane page-quick-sidebar-alerts" id="quick_sidebar_tab_2">\r\n                        <div class="page-quick-sidebar-alerts-list">\r\n                            <h3 class="list-heading">General</h3>\r\n                            <ul class="feeds list-items">\r\n                                <li>\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-info">\r\n                                                    <i class="fa fa-check"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     You have 4 pending tasks. <span class="label label-sm label-warning ">\r\n                                                    Take action <i class="fa fa-share"></i>\r\n                                                    </span>\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             Just now\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li>\r\n                                    <a href="#">\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-success">\r\n                                                    <i class="fa fa-bar-chart-o"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     Finance Report for year 2013 has been released.\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             20 mins\r\n                                        </div>\r\n                                    </div>\r\n                                    </a>\r\n                                </li>\r\n                                <li>\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-danger">\r\n                                                    <i class="fa fa-user"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     You have 5 pending membership that requires a quick review.\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             24 mins\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li>\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-info">\r\n                                                    <i class="fa fa-shopping-cart"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     New order received with <span class="label label-sm label-success">\r\n                                                    Reference Number: DR23923 </span>\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             30 mins\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li>\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-success">\r\n                                                    <i class="fa fa-user"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     You have 5 pending membership that requires a quick review.\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             24 mins\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li>\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-info">\r\n                                                    <i class="fa fa-bell-o"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     Web server hardware needs to be upgraded. <span class="label label-sm label-warning">\r\n                                                    Overdue </span>\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             2 hours\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li>\r\n                                    <a href="#">\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-default">\r\n                                                    <i class="fa fa-briefcase"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     IPO Report for year 2013 has been released.\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             20 mins\r\n                                        </div>\r\n                                    </div>\r\n                                    </a>\r\n                                </li>\r\n                            </ul>\r\n                            <h3 class="list-heading">System</h3>\r\n                            <ul class="feeds list-items">\r\n                                <li>\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-info">\r\n                                                    <i class="fa fa-check"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     You have 4 pending tasks. <span class="label label-sm label-warning ">\r\n                                                    Take action <i class="fa fa-share"></i>\r\n                                                    </span>\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             Just now\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li>\r\n                                    <a href="#">\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-danger">\r\n                                                    <i class="fa fa-bar-chart-o"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     Finance Report for year 2013 has been released.\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             20 mins\r\n                                        </div>\r\n                                    </div>\r\n                                    </a>\r\n                                </li>\r\n                                <li>\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-default">\r\n                                                    <i class="fa fa-user"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     You have 5 pending membership that requires a quick review.\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             24 mins\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li>\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-info">\r\n                                                    <i class="fa fa-shopping-cart"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     New order received with <span class="label label-sm label-success">\r\n                                                    Reference Number: DR23923 </span>\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             30 mins\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li>\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-success">\r\n                                                    <i class="fa fa-user"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     You have 5 pending membership that requires a quick review.\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             24 mins\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li>\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-warning">\r\n                                                    <i class="fa fa-bell-o"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     Web server hardware needs to be upgraded. <span class="label label-sm label-default ">\r\n                                                    Overdue </span>\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             2 hours\r\n                                        </div>\r\n                                    </div>\r\n                                </li>\r\n                                <li>\r\n                                    <a href="#">\r\n                                    <div class="col1">\r\n                                        <div class="cont">\r\n                                            <div class="cont-col1">\r\n                                                <div class="label label-sm label-info">\r\n                                                    <i class="fa fa-briefcase"></i>\r\n                                                </div>\r\n                                            </div>\r\n                                            <div class="cont-col2">\r\n                                                <div class="desc">\r\n                                                     IPO Report for year 2013 has been released.\r\n                                                </div>\r\n                                            </div>\r\n                                        </div>\r\n                                    </div>\r\n                                    <div class="col2">\r\n                                        <div class="date">\r\n                                             20 mins\r\n                                        </div>\r\n                                    </div>\r\n                                    </a>\r\n                                </li>\r\n                            </ul>\r\n                        </div>\r\n                    </div>\r\n                    <div class="tab-pane page-quick-sidebar-settings" id="quick_sidebar_tab_3">\r\n                        <div class="page-quick-sidebar-settings-list">\r\n                            <h3 class="list-heading">General Settings</h3>\r\n                            <ul class="list-items borderless">\r\n                                <li>\r\n                                     Enable Notifications <input type="checkbox" class="make-switch" checked data-size="small" data-on-color="success" data-on-text="ON" data-off-color="default" data-off-text="OFF">\r\n                                </li>\r\n                                <li>\r\n                                     Allow Tracking <input type="checkbox" class="make-switch" data-size="small" data-on-color="info" data-on-text="ON" data-off-color="default" data-off-text="OFF">\r\n                                </li>\r\n                                <li>\r\n                                     Log Errors <input type="checkbox" class="make-switch" checked data-size="small" data-on-color="danger" data-on-text="ON" data-off-color="default" data-off-text="OFF">\r\n                                </li>\r\n                                <li>\r\n                                     Auto Sumbit Issues <input type="checkbox" class="make-switch" data-size="small" data-on-color="warning" data-on-text="ON" data-off-color="default" data-off-text="OFF">\r\n                                </li>\r\n                                <li>\r\n                                     Enable SMS Alerts <input type="checkbox" class="make-switch" checked data-size="small" data-on-color="success" data-on-text="ON" data-off-color="default" data-off-text="OFF">\r\n                                </li>\r\n                            </ul>\r\n                            <h3 class="list-heading">System Settings</h3>\r\n                            <ul class="list-items borderless">\r\n                                <li>\r\n                                     Security Level\r\n                                    <select class="form-control input-inline input-sm input-small">\r\n                                        <option value="1">Normal</option>\r\n                                        <option value="2" selected>Medium</option>\r\n                                        <option value="e">High</option>\r\n                                    </select>\r\n                                </li>\r\n                                <li>\r\n                                     Failed Email Attempts <input class="form-control input-inline input-sm input-small" value="5"/>\r\n                                </li>\r\n                                <li>\r\n                                     Secondary SMTP Port <input class="form-control input-inline input-sm input-small" value="3560"/>\r\n                                </li>\r\n                                <li>\r\n                                     Notify On System Error <input type="checkbox" class="make-switch" checked data-size="small" data-on-color="danger" data-on-text="ON" data-off-color="default" data-off-text="OFF">\r\n                                </li>\r\n                                <li>\r\n                                     Notify On SMTP Error <input type="checkbox" class="make-switch" checked data-size="small" data-on-color="warning" data-on-text="ON" data-off-color="default" data-off-text="OFF">\r\n                                </li>\r\n                            </ul>\r\n                            <div class="inner-content">\r\n                                <button class="btn btn-success"><i class="icon-settings"></i> Save Changes</button>\r\n                            </div>\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n        </div>\r\n</div>\r\n';});

define('text!tmpl/admin/infographics.html',[],function () { return '';});

define('text!tmpl/admin/cases.html',[],function () { return '';});

define('text!tmpl/admin/users.html',[],function () { return '';});

define('text!tmpl/admin/agencies.html',[],function () { return '';});

define('text!tmpl/admin/courts.html',[],function () { return '';});

define('text!tmpl/admin/csos.html',[],function () { return '';});

define('text!tmpl/admin/offenders.html',[],function () { return '';});

define('text!tmpl/admin/subscribers.html',[],function () { return '';});

define('text!tmpl/admin/judges.html',[],function () { return '';});

(function() {

  define('cs!admin/templates',['handlebars', 'text!tmpl/admin/auth.html', 'text!tmpl/admin/index.html', 'text!tmpl/admin/layout.html', 'text!tmpl/admin/dashboard.html', 'text!tmpl/admin/infographics.html', 'text!tmpl/admin/cases.html', 'text!tmpl/admin/users.html', 'text!tmpl/admin/agencies.html', 'text!tmpl/admin/courts.html', 'text!tmpl/admin/csos.html', 'text!tmpl/admin/offenders.html', 'text!tmpl/admin/subscribers.html', 'text!tmpl/admin/judges.html'], function(Handlebars, authTmpl, indexTmpl, layoutTmpl, dashboardTmpl, infographicsTmpl, casesTmpl, usersTmpl, agenciesTmpl, courtsTmpl, csosTmpl, offendersTmpl, subscribersTmpl, judgesTmpl) {
    return {
      layout: Handlebars.compile(layoutTmpl),
      auth: Handlebars.compile(authTmpl),
      index: Handlebars.compile(indexTmpl),
      dashboard: Handlebars.compile(dashboardTmpl),
      infographics: Handlebars.compile(infographicsTmpl),
      cases: Handlebars.compile(casesTmpl),
      users: Handlebars.compile(usersTmpl),
      agencies: Handlebars.compile(agenciesTmpl),
      courts: Handlebars.compile(courtsTmpl),
      csos: Handlebars.compile(csosTmpl),
      offenders: Handlebars.compile(offendersTmpl),
      subscribers: Handlebars.compile(subscribersTmpl),
      judges: Handlebars.compile(judgesTmpl)
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
      url: "posts",
      parse: function(response) {
        return response.posts;
      }
    });
    return Collections;
  });

}).call(this);

(function() {

  define('cs!admin/views',['jquery', 'underscore', 'backbone', 'cs!admin/templates', 'cs!frontend/models', 'cs!frontend/collections', 'cs!frontend/util'], function($, _, Backbone, templates, models, collections, util) {
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
    Views.Index = Views.Page.extend({
      title: "Home",
      template: templates.index,
      init: function() {}
    });
    Views.Case = Views.Page.extend({
      template: templates.case_
    });
    Views.Cases = Views.Page.extend({
      title: 'Cases',
      template: templates.cases,
      init: function() {
        return this.collection = new collections.Cases;
      }
    });
    return Backbone.View.extend({
      el: "body",
      initialize: function() {},
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
      renderDashboard: function() {
        return this.render(new Views.Index);
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
      renderInfographics: function() {
        return this.render(new Views.Infographics);
      }
    });
  });

}).call(this);

(function() {

  define('cs!admin/router',['jquery', 'underscore', 'backbone', 'cs!admin/views', 'cs!frontend/util'], function($, _, Backbone, MainView, util) {
    return (function() {
      var Router, instance;
      Router = Backbone.Router.extend({
        routes: {
          "": "login",
          home: "home"
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
        login: function() {
          return this.appView.renderIndex();
        },
        home: function() {
          return this.appView.renderDashboard();
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

require(['backbone','cs!admin/router','cs!frontend/util'],function(Backbone,Router,util){
  Backbone.$.ajaxPrefilter(function(options, originalOptions, jqXhr) {
    options.url = util.settings.apiUrl + options.url;
  });
  Router.getInstance();
});
define("admin/index", function(){});
