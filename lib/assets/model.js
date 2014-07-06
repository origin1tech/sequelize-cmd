'use strict';

module.exports = Model;

/**
 * Model template.
 * @param {object} sequelize - injected instance of Sequelize
 * @param {object} DataTypes - injected Sequelize data types.
 * @see - http://sequelizejs.com/docs/latest/models#definition
 * @returns {Model}
 * @constructor
 */
function Model(sequelize, DataTypes) {

    var properties, options;

    // model properties.
    properties = {

    };

    // model classMethods, getterMethods, setterMethods and options.
    options = {

        // Defines getters for model properties.
        //getterMethods: {},

        // Defines setters for model properties.
        //setterMethods: {},

        // Defines associations and class methods.
        //classMethods: { associate: function (models) { } },

        // Defines methods for "this" instance of the model.
        //instanceMethods: {},

        // Defines before/after hooks for a model.
        // NOTE the below hooks all have "Bulk" counter parts
        // Hooks: beforeCreate, afterCreate, beforeUpdate, afterUpdate,
        //        beforeValidate, afterValidate, beforeDestroy, afterDestroy
        //hooks: {}

    };

    return sequelize.define('{{name}}', properties, options);
}
