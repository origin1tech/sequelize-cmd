'use strict';

var _ = require('lodash');

var helpers = function (log){

    return {

        /**
         * Safely parse JSON
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
         * Parses passed in properties converting to formatted string for model.
         * @param {array} arr - the array to be parsed.
         * @returns {string|boolean}
         */
        parseProp: function parseProp(arr) {

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
                    result.push(prop + ': { type: DataTypes.STRING }');
                }

                // single property with defined data type.
                else if (propArr.length === 2 && propArr[1].indexOf('=') === -1) {
                    result.push(prop + ': { type: DataTypes.' + propArr[1].toUpperCase() + ' }');
                }

                // multiple property attributes are defined.
                else {
                    attrs = [];
                    propClone = _.clone(propArr).splice(1, propArr.length);
                    _.forEach(propClone, function (attr) {
                        attr = attr.split('=');
                        if (attr.length === 2) {
                            if (attr[0] === 'type')
                                attrs.push('type: DataTypes.' + attr[1].toUpperCase());
                            else
                                attrs.push(attr[0] + ': ' + attr[1]);
                        } else {
                            // assume DataType
                            attrs.push('type: DataTypes.' + attr[0].toUpperCase());
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
         * Converts the case of a string.
         * @param {string} str - the string to convert.
         * @param {string} casing - case to convert to ex: 'first', 'upper', 'title', 'camel', 'pascal'
         */
        strToCase: function strToCase(str, casing) {
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
        }
    }

};

module.exports = helpers;