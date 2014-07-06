'use strict';

var optimist = require('optimist'),
    path = require('path'),
    _ = require('lodash'),
    colors = require('cli-color'),
    fs = require('fs'),
    Sequelize = require('Sequelize'),
    utils = require('./utils'),
    cwd = process.cwd(),
    argv = optimist.argv,
    args = _.clone(argv),
    cmd = argv._[0],
    commands = argv._ || [],
    flags, sqcmd, log, cli;

// delete path & commands leave flags.
delete args._;
delete args.$0;
flags = args || {};

// create a pretty logger, nothing special here.
log = function log(msg, type) {
    var types = { error: 'red', warn: 'yellow', info: 'green', debug: 'blue', verbose: 'magenta' },
        prefix;
    type = type || 'info';
        prefix = colors[types[type]](type);
    console.log(prefix + ': ' + msg);
};

// export the module
module.exports = SqCmd;

function SqCmd(db, options) {

    var self = this,
        defaults, config, dbConf, migConf, cmds, validCommands;

    defaults = {
        db: {
            host: 'localhost',              // server hostname or ip.
            port: 3306,                     // server port.
            database: 'undefined',          // database name.
            username: 'root',               // authorized user.
            password: null                  // password or null.
        },
        migration: {
            path: './migrations',           // location of migrations.
            filesFilter: /\.js$/,           // RegExp filter
            models: './models',             // location of models.
            seeds: './seeds',               // location of seed files.
            comments: true                  // when false removes helper comments from templates.
        }
    };

    cmds = {
        init: { alias: ['initialize'], event: self.init },
        generate: { alias: ['create', 'new'], event: self.generate },
        migrate: { alias: ['migrations', 'migration'], event: self.migrate },
        help: { alias: ['info', 'usage'], event: self.help }
    };

    validCommands = _.functions(this);

    // safely parse JSON.
    function tryParseJSON(obj) {
        try{
           return JSON.parse(obj); 
        } catch(e){
            return false;
        }
    }

    function getMigrator() {
        // finally populate the migrator.
        self.migrator = self.db.getMigrator(migConf);
    }

    function lookupCmd(c) {
        var result;
        if(cmds[c]) return c;
        _.forEach(cmds, function (v,k) {
            if(result) return;
            if(_.contains(v.alias, c))
                result = k;
        });
        return result;
    }

    function valid(c) {
        return validCommands.indexOf(c) !== -1;
    }

    // check if command alias was used.
    this.cmd = lookupCmd(cmd);

    if(!valid(this.cmd))
        return log('The command ' + colors.yellow(cmd) + ' was not recognized see "sqlcmd help" without quotes.', 'warn');

    // if boolean is passed cli is calling.
    if(db === true){
        cli = true;
        db = undefined;
        options = undefined;
    }

    // if options are not specified
    // assume only options are passed
    // and no existing db connection is supplied.
    if(!options){
        options = db;
        db = undefined;
    }

    // get user config.
    config = path.join(cwd, '/sqcmd.json');
    
    // check if config file exists.
    if(fs.existsSync(config)){
        config = tryParseJSON(this.config);
        // get the config for the current environment.
        config = config[process.env || 'development'] || {};
    } else {
        if(cli && !_.contains(['help', 'init'], this.cmd))
           return log('Configuration file is required to use sequelize-cmd.\n      Use "sqcmd init" without quotes to initialize.', 'warn');
    }

    // merge the options.
    options = _.merge(defaults, options);
    dbConf = _.extend(options.db, flags);
    migConf = _.extend(options.migrations, flags);

    // check if custom logger is used for db if so use it.
    if(dbConf.logger)
        log = dbConf.logger;

    // set instance db object.
    this.db = db;
    this.dbConf = dbConf;
    this.migConf = migConf;

    // if not calling migrate just run command.
    if(this.cmd !== 'migrate')
        return cmds[this.cmd].event.apply(this, arguments);

    // if not cli and no db or config return error.
    if(!cli && !this.db && (!dbConf.database || dbConf.database == 'undefined'))
        return log('Sequelize db connection not provided or invalid configuration file.', 'error');

    // if is cli and no db is specified return error.
    if(cli && !dbConf.database || dbConf.database == 'undefined')
       return log('Unable to continue using database: ' + dbConf.database, 'error');

    // if no database connection create one.
    // then get the migrator.
    if(!this.db) {
        this.db = new Sequelize(dbConf.database, dbConf.username, dbConf.password, dbConf);
        this.db
            .authenticate()
            .complete(function(err) {
                if(err) 
                    return log(err.message + '\n      ' + err.stack || '');
                getMigrator();
            });
    } else {
        getMigrator();
    }

    return this;
}

/**
 * Initialize the Sequelize command line interface.
 * @param {string} options - the migration configuration options.
 */
SqCmd.prototype.init = function init(options){

    var migPath, modPath, seedPath;

    options = _.extend(this.migConf, options);

    migPath = path.join(cwd, options.path);
    modPath = path.join(cwd, options.models);
    seedPath = path.join(cwd, options.seeds);

    // make sure paths do not exist.
    if(!this.flags.force){

        // make sure dirs don't exist.
        if(utils.io.exists(migPath))
            return log('The path ' + migPath + ' already exists. Did you mean to overwrite with the --force flag?', 'warn');

        if(utils.io.exists(modPath))
            return log('The path ' + modPath + ' already exists. Did you mean to overwrite with the --force flag?', 'warn');

        if(utils.io.exists(seedPath))
            return log('The path ' + seedPath + ' already exists. Did you mean to overwrite with the --force flag?', 'warn');

        if(utils.io.exists(cwd + '/sqcmd.json'))
            return log('The path sqcmd.json configuration file already exists. Did you mean to overwrite with the --force flag?', 'warn');
    }

    // add conf and directories.
    utils.io.copy('../assets/sqcmd.json', cwd);

};

/**
 * Generates models and migrations.
 * @param {string} type - the type of object to generate.
 */
SqCmd.prototype.generate = function generate(type) {



};

/**
 * Create, run and undo migrations.
 */
SqCmd.prototype.migrate = function migrate(undo) {
    undo = undo || this.flags.undo || this.flags.u || false;
    if(undo) {

    } else {

    }
};

/**
 * Displays help information.
 */
SqCmd.prototype.help = function help() {

    console.log('Sequelize Command Help');
    console.log('========================================');

};
