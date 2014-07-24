'use strict';

var _ = require('lodash');

module.exports = Compare;

/**
 * Compare models using previous migration model snapshots.
 * @returns {function}
 * @constructor
 */
function Compare () {

    var self = this;

    function compare (current, previous) {

        // all up/down properties are arrays of string.
        var build = {
                up: {
                    createTable: [],
                    dropTable: [],
                    dropTables: [],
                    addColumn: [],
                    changeColumn: [],
                    removeColumn: []
                    //renameTable: [],  // TODO future feature.
                    //renameColumn: [], // TODO future feature.
                    //addIndex: [],     // TODO future feature.
                    //removeIndex: []   // TODO future feature.
                },
                down: {
                    createTable: [],
                    dropTable: [],
                    dropTables: [],
                    addColumn: [],
                    changeColumn: [],
                    removeColumn: []
                    //renameTable: [],  // TODO future feature.
                    //renameColumn: [], // TODO future feature.
                    //addIndex: [],     // TODO future feature.
                    //removeIndex: []   // TODO future feature.
                },
                options: []
            },
            validAttrs = self.migConf.validAttributes,
            excludeAttrs = self.migConf.excludeAttributes,
            typeVariable = self.migConf.typeVariable || 'types',
            modelName = current.name,
            baseTabs = 2;

        function getTabs(int, addBase) {
            var tabs = '';
            if(addBase)
                int += baseTabs;
            while(int){
                tabs += '\t';
                --int;
            }
            return tabs;
        }

        function isValid(attr) {
            return validAttrs.indexOf(attr) !== -1;
        }

        function qwrap(str) {
            return "'" + str + "'";
        }

        function getActions(type) {
            var actions = [];
            _.forEach(type, function (v) {
                if(v.length) actions.push(v);
            });
            return actions;
        }

        function filterAttributes(obj) {
            var clone = _.clone(obj);
            _.forEach(clone, function (v,k) {
                if(!isValid(k))
                delete clone[k];
            });
            return clone;
        }

        function arrayToString(arr, def) {
            var val = '[';
            def = def || undefined;
            if(!arr || !arr.length)
                return def;
            if(!_.isString(arr[0])){
                val += arr.join(',');
            }else {
                _.forEach(arr, function (v) {
                    val += qwrap(v) + ',';
                });
                val = val.slice(0, val.length -1);
            }
            val += ']';
           return val;
        }

        function funcToString(func, level) {
            var split = func.split('\n'),
                tmp = [];
            _.forEach(split, function (v, k) {
                v = v.replace(/^\s+/, '').replace('\r', '');
                if(k +1 === split.length)
                    tmp.push(getTabs(level + 1, true) + v);
                else if(k > 0)
                    tmp.push(getTabs(level + 2, true) + v);
                else tmp.push(v);
            });
            return tmp.join('\n');
        }

        /**
         * Concats all up migration events to string.
         * @private
         * @memberof Compare
         * @returns {string}
         */
        function upToString() {
            var upStr = '',
                ctr = 0,
                items = getActions(build.up),
                tab,
                suffix;
            // build the output string for up.
            _.forEach(items, function (v,k) {
                _.forEach(v, function(item, key){
                    suffix = (ctr < v.length -1) || (k+1 < items.length) ? '\n' : '';
                    tab = ctr > 0 ? getTabs(0, true) : '';
                    upStr += (tab + item + suffix);
                    ctr += 1;
                });
            });
            return upStr;
        }

        /**
         * Concats all down migration events to string.
         * @private
         * @memberof Compare
         * @returns {string}
         */
        function downToString() {
            var dwnStr = '',
                ctr = 0,
                items = getActions(build.down),
                tab,
                suffix;
            // build the output string for down.
            _.forEach(items, function (v,k) {
                _.forEach(v, function(item, key){
                    suffix = (ctr < v.length -1) || (k+1 < items.length) ? '\n' : '';
                    tab = ctr > 0 ? getTabs(0, true) : '';
                    dwnStr += (tab + item + suffix);
                    ctr += 1;
                });
            });
            return dwnStr;
        }

        /**
         * Recurse child options concat to string.
         * @private
         * @memberof Compare
         * @param {object} obj - the child object.
         * @returns {string}
         */
        function recurseChildOptions(obj, level){
            var child = '',
                len = Object.keys(obj).length,
                ctr = 0,
                prefix;
            level = level || 1;
            for(var prop in obj) {
                if(obj.hasOwnProperty(prop)){
                    var tab = getTabs(level +1, true),
                        val;
                    prefix = ctr > 0 ? ',\n' : '';
                    if(_.isPlainObject(obj[prop])){
                        if(!_.isEmpty(obj[prop])){
                            var subChild = recurseChildOptions(obj[prop], level + 1);
                            if(subChild && subChild.length)
                                child += (tab + prop + ': { \n' + subChild + '\n' + tab + '}');
                        }
                    } else {
                        if(_.isArray(obj[prop])){
                            val = arrayToString(obj[prop]);
                            if(val){
                                tab = ctr === 0 ? getTabs(level) : getTabs(level +1, true);
                                child += (prefix + tab + prop + ': ' + arrayToString(obj[prop]));
                            }
                        } else {
                            var isFunc;
                            val = obj[prop];
                            isFunc = _.isFunction(val);
                            if(_.isString(val)){
                                val = "'" + val.toString() + "'";
                            } else {
                                val = val.toString();
                                if(isFunc)
                                    val = funcToString(val, level);
                            }
                            child += (prefix + tab + prop + ': ' + val);
                        }
                    }
                    ctr +=1;
                }
            }
            return child;
        }

        /**
         * Parse options for create model migrations.
         * @private
         * @memberof Compare
         * @param {object} obj - the object of options.
         */
        function parseOptions(obj) {
            var ctr = 0,
                tab = getTabs(1, true);
            for(var prop in obj) {
                if(obj.hasOwnProperty(prop)){
                    if(_.isPlainObject(obj[prop])){
                        if(!_.isEmpty(obj[prop])){
                            var child = recurseChildOptions(obj[prop]);
                            if(child && child.length)
                                build.options.push(tab + prop + ': { \n' + child + ' \n' + tab + '}');
                        }
                    } else {
                        if(_.isArray(obj[prop])){
                            build.options.push(tab + prop + ': ' + arrayToString(obj[prop]));
                        } else {
                            var val = obj[prop];
                            if(_.isString(val))
                                val = qwrap(val);
                            else
                                val = val.toString();
                            build.options.push(tab + prop + ': ' + val);
                        }
                    }
                }
                ctr +=1;
            }

        }

        /**
         * Converts a property's atttributes to string.
         * @private
         * @memberof Compare
         * @param {object} obj - the object of attributes.
         * @param {object} prevObj - the previous object of attributes from last snapshot.
         * @returns {string}
         */
        function attributesToString(obj, prevObj, level) {
            var attrs = '',
                prefix,
                tab;
            level = level || 1;
            tab = getTabs(level, true);
            _.forEach(obj, function (v, k) {
                if(excludeAttrs.indexOf(k) === -1){
                    var prev = prevObj && prevObj[k] !== undefined ? prevObj[k] : undefined;
                    prefix = attrs.length ? ',\n' : '';
                    if(_.isPlainObject(v)){
                        var subAttr = attributesToString(v, prev, level +1);
                        if(subAttr && subAttr.length)
                            attrs += (prefix + tab + k + ': {\n' + subAttr + '\n' + tab + '}');
                    } else {
                        if(prev !== v){
                            var val = k === 'type' ? 'types.' + v : v;
                            if(_.isArray(val))
                                val = arrayToString(val);
                            if(_.isFunction(val)){
                                val = funcToString(val.toString(), 2);
                            }
                            attrs += (prefix + tab + k + ': ' + val);
                        }
                    }
                }
            });

            return attrs;
        }

        /**
         * Iterate table/model properties and compare or create new.
         * @private
         * @memberof Compare
         */
        function compareMigration(){

            var tab

            // the model/table already exists.
            if(previous){

                tab = getTabs(0, true),

                // compare to previous table checking for
                // any dropped columns.
                _.forEach(previous.attributes, function (v,k) {
                    if (v._modelAttribute) {
                        var curCol = current && current.attributes ? current.attributes[k] : undefined,
                            removeAttrs;
                        // if curCol is undefined it was removed.
                        if(!curCol){
                            removeAttrs = attributesToString(filterAttributes(v));
                            if(removeAttrs) {
                                build.up.removeColumn.push(
                                        'migration.removeColumn(' + qwrap(modelName) + ', ' + qwrap(k) + ');'
                                );
                                build.down.addColumn.push(
                                        'migration.addColumn(' + qwrap(modelName) + ', ' + qwrap(k) + ',\n' +
                                        tab + '{\n'+ removeAttrs + '\n' + tab + '});'
                                );
                            }
                        }
                    }

                });

                // iterate current defined attrs
                // looking for adds & changes.
                _.forEach(current.attributes, function (v,k) {


                    if(v._modelAttribute){
                        // check if is new column or existing.
                        var prevCol = previous.attributes ? previous.attributes[k] : undefined,
                            prevAttrs, curAttrs;

                        if(prevCol){

                            curAttrs = attributesToString(filterAttributes(v), filterAttributes(prevCol));
                            prevAttrs = attributesToString(filterAttributes(prevCol), filterAttributes(v));

                            if(curAttrs) {
                                build.up.changeColumn.push(
                                        'migration.changeColumn(' + qwrap(modelName) + ', ' + qwrap(k) + ',\n' +
                                        tab + '{\n' + curAttrs + '\n' + tab + '});'
                                );
                            }

                            if(prevAttrs) {
                                build.down.changeColumn.push(
                                        'migration.changeColumn(' + qwrap(modelName) + ', ' + qwrap(k) + ',\n' +
                                        tab + '{\n' +  prevAttrs + '\n' + tab +'});'
                                );
                            }

                        } else {

                            curAttrs = attributesToString(filterAttributes(v));
                            // column needs to be added.

                            if(curAttrs) {
                                build.up.addColumn.push(
                                        'migration.addColumn(' + qwrap(modelName) + ', ' + qwrap(k) + ',\n' +
                                        '{\n' + curAttrs + '\n' + tab + '});'
                                );
                                build.down.removeColumn.push(
                                        'migration.removeColumn(' + qwrap(modelName) + ', ' + qwrap(k) + ');'
                                );
                            }

                        }
                    }

                    ctr += 1;

                });

            }

            // this is a new model/table.
            else {

                // this is a new table so we need to parse options.
                var newAttrs = [],
                    ctr = 0,
                    attrTab = getTabs(1, true),
                    newOpts;

                tab = getTabs(0, true);

                parseOptions(current.options);
                newOpts = build.options.join(',\n')

                _.forEach(current.attributes, function (v,k) {
                    if (v._modelAttribute) {
                        var attrs = attributesToString(filterAttributes(v), null, 2);
                        if(attrs) newAttrs.push(attrTab + k + ': {\n' + attrs + '\n' + attrTab + '}');
                    }
                    ctr +=1;
                });

                build.up.createTable.push(
                        'migration.createTable(' + qwrap(modelName) + ',\n' +
                        tab + '{\n' + newAttrs.join(',\n') + '\n' + tab + '},\n' +
                        tab + '{\n' + newOpts + '\n' + tab + '});'
                );
                build.down.dropTable.push('migration.dropTable(' + qwrap(modelName) + ');');

            }

            build.up.toString = upToString;
            build.down.toString = downToString;
        }

        // parse properties attributes & options.
        compareMigration();

        return build;

    };

    return compare;

};