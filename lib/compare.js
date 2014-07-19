'use strict';

var _ = require('lodash');

module.exports = Compare;

/**
 * Compare models using previous migration model snapshots.
 * @param {object} current - the current loaded model.
 * @param {object} previous - the previous model
 * @returns {string}
 * @constructor
 */
function Compare (current, previous) {

    // all up/down properties are arrays of string.
    var validAttrs = [
            'type',
            'allowNull',
            'defaultValue',
            'primaryKey',
            'unique',
            'comment',
            'get',
            'set',
            'validate',
            'values',
            'autoIncrement'
        ],
        build = {
            up: {
                createTable: [],
                dropTable: [],
                dropTables: [],
                renameTable: [],
                addColumn: [],
                changeColumn: [],
                removeColumn: [],
                renameColumn: []
            },
            down: {
                createTable: [],
                dropTable: [],
                dropTables: [],
                renameTable: [],
                addColumn: [],
                changeColumn: [],
                removeColumn: [],
                renameColumn: []
            },
            options: []
        },
        modelName = current.name;


    /**
     * Converts a property's atttributes to string.
     * @param {object} obj - the object of attributes.
     * @param {object} prevObj - the previous object of attributes from last snapshot.
     * @returns {string}
     */
    function attributesToString(obj, prevObj) {
        var attrs = '',
            prefix = '',
            ctr = 0;
        _.forEach(obj, function (v, k) {
            if(validAttrs.indexOf(k) !== -1){
                var prevVal = prevObj && prevObj[k] ? prevObj[k] : undefined;
                prefix = ctr > 0 ? ',\n' : '';
                if(prevVal){
                    // compare attributes against previous property.
                    if(prevVal !== v)
                        attrs += (prefix + '\t' + k + ': ' + v);
                } else {
                    attrs += (prefix + '\t' + k + ': ' + v);
                }
                ctr += 1;
            }
        });
        return attrs;
    }

    /**
     * Parse options for create model migrations.
     * @private
     * @memberof Compare
     * @returns {string}
     */
    function parseOptions(obj, ctr) {

        var prefix = '';
        ctr = ctr || 0;

        function parseChild(obj) {
            var pre = '',
                cctr = 0,
                opt;
            _.forEach(obj, function (v,k) {
                prefix = cctr > 0 ? ',\n' : '';
                if(_.isObject(v)){
                    if(_.isArray(v) || _.isFunction(v)) {
                        if(_.isArray(v)){
                            var val = v.toString();
                            opt = (prefix + k + ': ' + v);
                        } else{
                            opt = (prefix + k + ': ' + v.toString() || '');
                        }
                    } else {
                        if(!_.isEmpty(v))
                            opt = (prefix + k + ': { ' + parseChild(v) + ' }');
                        else
                            opt = '';
                    }
                } else {
                    opt = (prefix + k + ': ' + v.toString());
                }
                cctr +=1;
            });
            return opt;
        }

        _.forEach(obj, function (v, k) {
            var opt;
            prefix = ctr > 0 ? ',\n' : '';
           if(_.isObject(v)){
               if(_.isArray(v) || _.isFunction(v)){
                   if(_.isArray(v)){
                       var val = v.toString();
                       opt = (prefix + k + ': ' + v);
                   } else{
                       opt = (prefix + k + ': ' + v.toString() || '');
                   }
               } else {
                   if(!_.isEmpty(v))
                       opt = (prefix + k + ': { ' + parseChild(v) + ' }');
               }
           } else {
               opt = (prefix + k + ': ' + v.toString());
           }
           if(opt && opt.length)
              build.options.push(opt);
           ctr += 1;
        });


    }

    /**
     * Iterate table/model properties.
     * @private
     * @memberof Compare
     */
    function parseProperties(){

        // the model/table already exists.
        if(previous){

            // compare to previous table checking for
            // any dropped columns.
            _.forEach(previous.attributes, function (v,k) {
                if (v._modelAttribute) {
                    var curCol = current && current.attributes ? current.attributes[k] : undefined,
                        removeAttrs;
                    // if curCol is undefined it was removed.
                    if(!curCol){
                        removeAttrs = attributesToString(v);
                        if(removeAttrs) {
                            build.up.removeColumn.push('migration.removeColumn(' + modelName + ', ' + k + ')');
                            build.down.addColumn.push(
                                    'migration.addColumn(' + modelName + ', ' + k + ', ' +
                                    '\n{' + removeAttrs + '\n})'
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
                    var prevCol = previous && previous.attributes ? previous.attributes[k] : undefined,
                        prevAttrs, curAttrs;
                    if(prevCol){
                        prevAttrs = attributesToString(prevCol, v);
                        curAttrs = attributesToString(v, prevCol);
                        if(curAttrs) {
                            build.up.changeColumn.push(
                                    'migration.changeColumn(' + modelName + ', ' + k + ', ' +
                                    '\n{' + curAttrs + '\n})'
                            );
                        }
                        if(prevAttrs) {
                            build.down.changeColumn.push(
                                    'migration.changeColumn(' + modelName + ', ' + k + ', ' +
                                    '\n{' + prevAttrs + '\n})'
                            );
                        }
                    } else {
                        curAttrs = attributesToString(v);
                        // column needs to be added.
                        if(curAttrs) {
                            build.up.addColumn.push(
                                    'migration.addColumn(' + modelName + ', ' + k + ', ' +
                                    '\n{' + curAttrs + '\n})'
                            );
                            build.down.removeColumn.push('migration.removeColumn(' + modelName + ', ' + k + ')');
                        }
                    }
                }
            });

        }
        
        // this is a new model/table. 
        else {

            var newOpts;

            _.forEach(current.options, function (v, k){
                console.log(v);
            });

            _.forEach(current.attributes, function (v,k) {
                if (v._modelAttribute) {
                    var curCol = current && current.attributes ? current.attributes[k] : undefined;
                    // if curCol is undefined it was removed.
                    if(!curCol){
                        var newAttrs = attributesToString(v);
                        if(newAttrs) {
                            build.up.createTable.push(
                                    'migration.createTable(' + modelName + ', ' +
                                    '\n{' + newAttrs + '\n}, ' +
                                    '\n{' + newOpts || ' ' + '\n})'
                            );
                            build.down.dropTable.push('migration.dropTable(' + modelName + ')');
                        }
                    }
                }
            });
            
        }

    }

    // parse the properties and options.
    parseProperties();
    parseOptions(current.options);

    // build the output string for up.
    _.forEach(build.up, function (v,k) {
        if(v.length){

        }
    });

    // build the output string for down.
    _.forEach(build.down, function (v,k) {
        if(v.length){

        }
    });

   console.log(build.options);


    return build;

};