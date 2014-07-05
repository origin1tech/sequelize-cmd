'use strict';

/**
 * Sequelize database migration.
 * @type {{up: up, down: down}}
 */
module.exports = {

    /**
     * Alter, Create, Modify table and columns.
     * @param {object} migration - injected migration object.
     * @param {object} DataTypes - Sequelize data types.
     * @param {function} done - callback function on done.
     */
    up: function(migration, DataTypes, done) {
        // add altering commands here, calling 'done' when finished
        done()
    },

    /**
     * Drop tables remove columns.
     * @param {object} migration - injected migration object.
     * @param {object} DataTypes - Sequelize data types.
     * @param {function} done - callback function on done.
     */
    down: function(migration, DataTypes, done) {
        // add reverting commands here, calling 'done' when finished
        done()
    }

};
