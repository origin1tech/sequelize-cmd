'use strict';

var optimist = require('optimist'),
    p = require('path'),
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

// strip cmd from commands.
if(commands[0])
    commands = commands.splice(1, commands.length);

// delete p & commands leave flags.
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
            fileNames: 'lower',             // file names converted to this case (first, lower, upper, camel, pascal, title).
            modelNames: 'first',             // model names converted to this case (first, lower, upper, camel, pascal, title).
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

    // check if command alias was used.
    this.cmd = lookupCmd(cmd);

    if(!_.contains(validCommands, this.cmd))
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
    if(!options && !cli){
        options = db;
        db = undefined;
    }

    // get user config.
    config = p.join(cwd, '/sqcmd.json');
    
    // check if config file exists.
    if(fs.existsSync(config)){
        config = utils.helpers.tryParseJSON(config);
        // get the config for the current environment.
        config = config[process.env || 'development'] || {};
    } else {
        if(cli && !_.contains(['help', 'init'], this.cmd))
           return log('Configuration file is required to use sequelize-cmd.\n      Use "sqcmd init" without quotes to initialize.', 'warn');
    }

    // merge the options.
    options = _.merge(defaults, options);
    dbConf = _.extend(options.db, flags);
    migConf = _.extend(options.migration, flags);

    // check if custom logger is used for db if so use it.
    if(dbConf.logger)
        log = dbConf.logger;

    // set instance db object.
    this.db = db;
    this.dbConf = dbConf;
    this.migConf = migConf;

    // if not calling migrate just run command.
    if(this.cmd !== 'migrate')
        return cmds[this.cmd].event.call(this);

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
 * @param {string} options - the migrations configuration options.
 */
SqCmd.prototype.init = function init(options){

    var migPath, modPath, seedPath;

    options = _.extend(this.migConf, options);
    console.log(options);

    migPath = p.join(cwd, options.path);
    modPath = p.join(cwd, options.models);
    seedPath = p.join(cwd, options.seeds);

    // make sure paths do not exist.
    if(!flags.force || !flags.f)
        if(utils.io.exists(cwd + '/sqcmd.json'))
            return log('The p sqcmd.json configuration file already exists. Did you mean to overwrite with the --force flag?', 'warn');


    // add conf and directories.
    utils.io.copy(p.join(__dirname, '/assets/sqcmd.json'), p.join(cwd, '/sqcmd.json'));

    // add migrations directory.
    if(!utils.io.exists(migPath))
        utils.io.mkdir(migPath);

    // add models directory.
    if(!utils.io.exists(modPath))
        utils.io.mkdir(modPath);

    // add seeds directory.
    if(!utils.io.exists(seedPath))
        utils.io.mkdir(seedPath);

    log('Sequelize command successfully initialized.');
};

/**
 * Generates models and migrations.
 * @param {string} [type] - the type of object to generate.
 * @param {string} [name] - the name of the model or migration.
 * @param {object} [properties] - model properties to be add to model.
 * @param {string} [path] - an alternate path to save generated model/migration.
 */
SqCmd.prototype.generate = function generate(type, name, properties, path) {

    var genCmd = type || commands[0],
        DataTypes = Sequelize,
        targetPath,
        template;


    genCmd = genCmd ? genCmd.toLowerCase() : undefined;
    name = name || commands[1];

    if(!_.contains(['model', 'migration'], genCmd))
        return log('The generation command ' + genCmd + ' is not valid.', 'error');

    if(!name)
        return log('Generating a ' + genCmd + ' requires a name and properties');

    // normalize properties and target path.
    properties = properties || (commands[2] ? commands.splice(2, commands.length): []);
    targetPath = genCmd === 'migration' ? this.migConf.path : this.migConf.models;
    targetPath = path || flags.path || flags.p || targetPath;

    if(genCmd === 'migration'){
        targetPath = p.join(cwd, targetPath + '/' + name + '.js');
        template = p.join(__dirname, '/assets/migration.js');
    }

    if(genCmd === 'model'){
        targetPath = p.join(cwd, targetPath + '/' + name + '.js');
        targetPath = utils.helpers.strToCase(targetPath, this.migConf.fileNames);
        name = utils.helpers.strToCase(name, this.migConf.modelNames);

        if((!flags.force && !flags.f) && utils.io.exists(targetPath))
            return log('The file ' + targetPath + ' already exists. Use --force or -f to overwrite.', 'warn');

        template = utils.io.read(p.join(__dirname, '/assets/model.js'));
        template = template.replace(/{{properties}}/, utils.helpers.parseProp(properties));
        template = template.replace(/{{name}}/, name);
        utils.io.write(targetPath, template);
        log('The model ' + name + ' was successfully created.');
    }

};

/**
 * Run and revert migrations.
 * @param {string} name - the name of the migration to run.
 * @param {boolean} undo - when true the migration is undone.
 */
SqCmd.prototype.migrate = function migrate(name, undo) {
    var migrator = this.migrator;
    undo = undo || flags.undo || flags.u || false;
    if(undo) {
        migrator.findOrCreateSequelizeMetaDAO().success(function(Meta) {
            Meta.find({ order: 'id DESC' }).success(function(meta) {
                if (meta) {
                   migrator = migrator.sequelize.getMigrator(_.extend(migratorOptions, meta.values), true);
                    migrator.migrate({ method: 'down' }).success(function() {
                        process.exit(0);
                    })
                } else {
                    console.log("There are no pending migrations.");
                    process.exit(0);
                }
            });
        });
    } else {
        migrator.migrate().success(function() {
            process.exit(0);
        });
    }
};

/**
 * Displays help information.
 */
SqCmd.prototype.help = function help() {

    console.log('Sequelize Command Help');
    console.log('========================================');

};
