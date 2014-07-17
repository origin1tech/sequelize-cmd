'use strict';

/**
 * Sequelize database migration.
 * @type {{up: up, down: down}}
 */
module.exports = {

    /**
     * Alter, Create, Modify table and columns.
     * @param {object} migration - injected migrations object.
     * @param {object} DataTypes - Sequelize data types.
     * @param {function} done - function to call to trigger done.
     */
    up: function(migration, types, done) {
        // add altering commands here, calling 'done' when finished
        done()
    },

    /**
     * Drop tables remove columns.
     * @param {object} migration - injected migrations object.
     * @param {object} DataTypes - Sequelize data types.
     * @param {function} done - function to call to trigger done.
     */
    down: function(migration, types, done) {
        // add reverting commands here, calling 'done' when finished
        done()
    }

};
