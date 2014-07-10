'use strict';

var fs = require('fs');

module.exports = RequireEach;

/**
 * Requires all modules in a directory.
 * @param {string|object} [options] - string or object of options descriptions below.
 * @returns {object}
 * @constructor
 *
 * dirname - the directory to stat.
 * filter - the expression for filtering files.
 * pathFilter - filter by full path.
 * excluded - the excluded files if any.
 * required - if true error is throw if not found.
 * memory - cache the module
 * mark - mark as directory.
 * flatten - flatten directories
 *
 * module based on the awesome work from:
 *
 * https://github.com/felixge/node-require-all
 * https://github.com/balderdashy/include-all
 *
 *
 */
function RequireEach(options) {

    var files;
    var modules = {};
    // enables passing only path.
    if(typeof(options) === 'string')
    {
        var dir = options;
        options = {
            dirname: dir,
            filter: /(.+)\.js$/i
        };
    }else {
        options = options || {};
    }

    if (typeof(options.required) == 'undefined')
        options.required = false;

    // default filter option.
    if (!options.filter)
        options.filter = /(.*)/;

    // reset counter.
    if (typeof options._depth === 'undefined')
        options._depth = 0;

    // flatten by default
    if (typeof options.flatten === 'undefined')
        options.flatten = true;

    // Bail out if our counter has reached the desired depth
    // indicated by the user in options.depth
    if (typeof options.depth !== 'undefined' &&
        options._depth >= options.depth)
        return;

    // store starting dir
    if (!options.startDir)
        options.startDir = options.dirname;
    try {
        files = fs.readdirSync(options.dirname);
    } catch (e) {
        if (!options.required)
            return {};
        throw new Error('Directory not found: ' + options.dirname);
    }

    files.forEach(function(file) {

        var filepath = options.dirname + '/' + file;
        // iterate dirs recursively.

        if (fs.statSync(filepath).isDirectory()) {

            // ignore excluded dirs.
            if (excludeDirectory(file)) return;
            // call require on each dir.

            modules[file] = RequireEach({
                dirname: filepath,
                filter: options.filter,
                pathFilter: options.pathFilter,
                excluded: options.excluded,
                startDir: options.startDir,
                memory: options.memory,
                mark: options.mark,
                flatten: options.flatten,
                keepPath: options.keepPath,
                required: options.required,
                // track depth of iteration.
                _depth: options._depth+1,
                depth: options.depth
            });

            if (options.mark || options.flatten) {
                modules[file].isDirectory = true;
            }

            if (options.flatten) {

                modules = (function flatten(modules, accum, path) {
                    accum = accum || {};
                    Object.keys(modules).forEach(function(identity) {
                        if (typeof(modules[identity]) !== 'object' && typeof(modules[identity]) !== 'function') {
                            return;
                        }
                        if (modules[identity].isDirectory) {
                            flatten(modules[identity], accum, path ? path + '/' + identity : identity );
                        } else {
                            accum[options.keepPath ? (path ? path + '/' + identity : identity) : identity] = modules[identity];
                        }
                    });
                    return accum;
                })(modules);
            }

        }
        // process file.
        else {

            // module key
            var identity;

            // filename filter
            if (options.filter) {
                var match = file.match(options.filter);
                if (!match) return;
                identity = match[1];
            }

            // relative path filter
            if (options.pathFilter) {
                // remove relative path
                var path = filepath.replace(options.startDir, '');
                // make sure path starts with leading slash.
                path = '/' + ltrim(path, '/');
                var pathMatch = path.match(options.pathFilter);
                if (!pathMatch) return;
                identity = pathMatch[2];
            }

            // check if should load into memory/cache.
            if (options.memory) {
                modules[identity] = true;
            } else {
                if (options.required) {
                    var resolved = require.resolve(filepath);
                    if (require.cache[resolved]) delete require.cache[resolved];
                }
                modules[identity] = require(filepath);
            }

        }

    });

    return modules;

    /**
     * Helper to exclude directory by name.
     * @private
     * @param {string} dirname - the name to exclude.
     * @returns {boolean}
     */
    function excludeDirectory(dirname) {
        return options.excluded && dirname.match(options.excluded);
    }
}