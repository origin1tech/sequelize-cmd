'use strict';

var _ = require('lodash');

/**
 * Helpers class.
 * @returns {{tryParseJSON: tryParseJSON, strToCase: strToCase, camelToUnderscore: camelToUnderscore, formatProperties: formatProperties, normalizeAttributes: normalizeAttributes, normalizeOptions: normalizeOptions, normalizeAssociations: normalizeAssociations}}
 * @constructor
 */
function Helpers(){

    return {

        /**
         * Safely parse JSON
         * @memberof Helpers
         * @param {string} json - the JSON string to parse
         * @returns {object|boolean}
         */
        tryParseJSON: function tryParseJSON(json) {
            try {
                return JSON.parse(json);
            } catch (e) {
                return false;
            }
        },


        /**
         * Converts the case of a string.
         * @memberof Helpers
         * @param {string} str - the string to convert.
         * @param {string} casing - case to convert to ex: 'first', 'upper', 'title', 'camel', 'pascal'
         */
        strToCase: function strToCase(str, casing) {

            casing = casing === 'capitalize' ? 'first' : casing;

            if (!casing) return str;
            casing = casing || 'first';
            if (casing === 'lower')
                return str.toLowerCase();
            if (casing === 'upper')
                return str.toUpperCase();
            if (casing == 'title')
                return str.replace(/\w\S*/g, function (txt) {
                    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                });
            if (casing == 'first')
                return str.charAt(0).toUpperCase() + str.slice(1);
            if (casing == 'camel') {
                return str.toLowerCase().replace(/-(.)/g, function (match, group1) {
                    return group1.toUpperCase();
                });
            }
            if (casing == 'pascal')
                return str.replace(/\w+/g, function (w) {
                    return w[0].toUpperCase() + w.slice(1).toLowerCase();
                });
            return str;
        },

        /**
         * Converts camel case string to underscore.
         * @param {string} str - the string to convert.
         * @returns {string}
         */
        camelToUnderscore: function camelToUnderscore(str) {
            return s.split(/(?=[A-Z])/).map(function (p) {
                return p.charAt(0).toUpperCase() + p.slice(1);
            }).join('_');
        },

        /**
         * Parses passed in properties converting to formatted string for model.
         * @memberof Helpers
         * @param {array} arr - the array to be parsed.
         * @returns {string|boolean}
         */
        formatProperties: function formatProperties(arr) {

            var result = [];
            _.forEach(arr, function (v,k) {

                var propArr,
                    propClone,
                    prop,
                    attrs,
                    attr;

                // strip DataType. in case user defined it.
                v.replace(/DataTypes\./gi, '');

                // create properties array.
                propArr = v.split(':');
                prop = propArr[0];

                // prop with not type assign default STRING
                if (propArr.length === 1) {
                    result.push(prop + ': { type: types.STRING }');
                }

                // single property with defined data type.
                else if (propArr.length === 2 && propArr[1].indexOf('=') === -1) {
                    result.push(prop + ': { type: types.' + propArr[1].toUpperCase() + ' }');
                }

                // multiple property attributes are defined.
                else {
                    attrs = [];
                    propClone = _.clone(propArr).splice(1, propArr.length);
                    _.forEach(propClone, function (attr) {
                        attr = attr.split('=');
                        if (attr.length === 2) {
                            if (attr[0] === 'type')
                                attrs.push('type: types.' + attr[1].toUpperCase());
                            else
                                attrs.push(attr[0] + ': ' + attr[1]);
                        } else {
                            // assume DataType
                            attrs.push('type: types.' + attr[0].toUpperCase());
                        }
                    });

                    result.push(prop + ': { ' + attrs.join(', ') + ' }');

                }

            });

            if(result.length)
                return result.join(',\n        ');
            else
                return false;

        },


        /**
         * Normalize property attributes.
         * @memberof Helpers
         * @param {object} attrs - the attributes to be parsed.
         * @returns {object}
         */
        normalizeAttributes: function normalizeAttributes(attrs, strip) {

            // map for converting SQL types to Sequelize DataTypes.
            var map = {
                    TINYINT: 'BOOLEAN',
                    DATETIME: 'DATE',
                    TIMESTAMP: 'DATE',
                    'VARCHAR BINARY': 'STRING.BINARY',
                    'TINYBLOB': 'BLOB',
                    VARCHAR: 'STRING[LEN]',
                    'INTEGER UNSIGNED ZEORFILL': 'INTEGER[LEN].UNSIGNED.ZEROFILL',
                    'INTEGER UNSIGNED': 'INTEGER[LEN].UNSIGNED',
                    'INTEGER ZEROFILL': 'INTEGER[LEN].ZEROFILL',
                    INTEGER: 'INTEGER[LEN]',
                    'FLOAT UNSIGNED ZEORFILL': 'FLOAT[LEN].UNSIGNED.ZEROFILL',
                    'FLOAT ZEROFILL': 'FLOAT[LEN].ZEROFILL',
                    'FLOAT UNSIGNED': 'FLOAT[LEN].UNSIGNED',
                    FLOAT: 'FLOAT[LEN]',
                    'BIGINT UNSIGNED ZEORFILL': 'BIGINT[LEN].UNSIGNED.ZEROFILL',
                    'BIGINT ZEROFILL': 'BIGINT[LEN].ZEROFILL',
                    'BIGINT UNSIGNED': 'BIGINT[LEN].UNSIGNED',
                    BIGINT: 'BIGINT[LEN]',
                    DECIMAL: 'DECIMAL[LEN]',
                    ENUM: 'ENUM'
                },
                mapKeys = Object.keys(map);

            strip = strip || [];
            strip.push('Model');

            // convert and format to Sequelize Model Type.
            function getType(type, len, name) {

                if(!type) return undefined;
                type = type.split('(')[0];

                if(map[type]){
                    var tmp = map[type];
                    if(len && !_.contains([255, 11], len)) len = '(' + len + ')';
                    else len = '';
                    type = tmp.replace('[LEN]', len);
                }

                return type;
            }

            // iterate properties.
            for(var prop in attrs) {

                if(attrs.hasOwnProperty(prop)){

                    var attr = attrs[prop],
                        type = attr.type,
                        prec = type._precision && type._scale ? type._precision + ',' + type._scale : false,
                        len = prec ? prec : type._length || false;

                    // strip properties.
                    strip.forEach(function (s) {
                        if(attr[s]) delete attr[s];
                    });

                    if(attr.validate && attr.validate._checkEnum)
                        type = 'ENUM';

                    if(!type._binary && type._length)
                        type = 'VARCHAR';

                    if(type._binary)
                        type = 'VARCHAR BINARY';

                    if(_.contains(['INTEGER', 'FLOAT', 'BIGINT'], type._typeName)){
                        var tmp = '';
                        tmp = type._unsigned ? tmp += ' UNSIGNED' : tmp;
                        tmp = type._zerofill ? tmp += ' ZEROFILL' : tmp;
                        type = type._typeName + tmp;

                    }

                    if(_.isObject(type))
                        type = type._typeName;

                    attrs[prop].type = getType(type, len, attr.fieldName);

                }

            }

            return attrs;
        },

        /**
         * Add only the options properties defined by array of keys.
         * @memberof Helpers
         * @param {object} opts - the options object.
         * @param {array} keys - the keys to find within the object.
         * @returns {object}
         */
        normalizeOptions: function normalizeOptions(opts, keys) {
            var result = {};
            for(var prop in opts) {
                if(opts.hasOwnProperty(prop)){
                    if(keys.indexOf(prop) !== -1){
                        result[prop] = opts[prop];
                    }
                }
            }
            return result;
        },

        /**
         * Remove circular reference properties that are not needed.
         * @memberof Helpers
         * @param {object} assoc - the associations object to be parsed.
         * @returns {object}
         */
        normalizeAssociations: function normalizeAssociations(assoc) {
            if(!assoc) return;
            _.forEach(assoc, function(v,k) {
                delete v.source;
                delete v.target;
                delete v.sequelize;
                delete v.options;
            });
            return assoc;
        }
    }

};

module.exports = Helpers;