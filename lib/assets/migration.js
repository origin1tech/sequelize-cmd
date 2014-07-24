'use strict';

/**
 * Sequelize database migration.
 * @type {{up: up, down: down}}
 */
module.exports = {

    /**
     * Alter, Create, Modify table and columns.
     * @param {object} migration - injected migrations object.
     * @param {object} types - Sequelize data types.
     * @param {function} done - function to call to trigger done.
     */
    up: function(migration, types, done) {
        {{up}}
        done();
    },

    /**
     * Drop tables remove columns.
     * @param {object} migration - injected migrations object.
     * @param {object} types - Sequelize data types.
     * @param {function} done - function to call to trigger done.
     */
    down: function(migration, types, done) {
        {{down}}
        done();
    }

};
