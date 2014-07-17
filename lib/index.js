'use strict';

var optimist = require('optimist'),
    _ = require('lodash'),
    p = require('path'),
    colors = require('cli-color'),
    fs = require('fs'),
    utils = require('./utils'),
    reqeach = utils.reqeach,
    cwd = process.cwd(),
    argv = optimist.argv,
    args = _.clone(argv),
    cmd = argv._[0],
    commands = argv._ || [],
    flags, sqcmd, defaultLog,  log, cli,
    helpers, Sequelize, DataTypes, moment,
    sqPath;

// strip cmd from commands.
if(commands[0])
    commands = commands.splice(1, commands.length);

// delete p & commands leave flags.
delete args._;
delete args.$0;
flags = args || {};

// create a pretty logger, nothing special here.
defaultLog = function log(msg, type) {
    var types = { error: 'red', warn: 'yellow', info: 'green', debug: 'blue', verbose: 'magenta' },
        prefix;
    type = type || 'info';
        prefix = colors[types[type]](type);
    console.log(prefix + ': ' + msg);
};

log = defaultLog;

// resolve Sequelize and its path.
if(require.resolve('Sequelize')){
    Sequelize = require('Sequelize');
    sqPath = p.join(cwd, '/node_modules/sequelize');
} else {
    Sequelize = require(p.join(cwd, '../sequelize'));
    sqPath = p.join(cwd, '../sequelize');
}

moment = require(p.join(sqPath, '/node_modules/moment'));
DataTypes = require(p.join(sqPath, '/lib/data-types'));

// export the module
module.exports = SqCmd;

function SqCmd(sequelize, options, logger) {

    var self = this,
        defaults, config, dbConf, migConf, cmds, validCommands;

    defaults = {
        templates: p.join(__dirname, '/assets'), // root path for migration.js, model.js, seed.js and sqcmd.json
        db: {
            dialect: 'mysql',               // the dialect for Sequelize to connect to.
            host: 'localhost',              // server hostname or ip.
            port: 3306,                     // server port.
            username: 'root',               // authorized user.
            password: null                 // password or null.
        },
        migration: {
            migrations: '/migrations',     // location of migrations.
            models: '/models',             // location of models.
            seeds: '/seeds',               // location of seed files.
            filesFilter: /\.js$/,          // RegExp filter
            fileNames: undefined,          // file names converted to case (capitalize, lower, upper, camel, pascal, title, undefined).
            modelNames: 'capitalize'       // model names converted to case (capitalize, lower, upper, camel, pascal, title, undefined).
        }
    };

    cmds = {
        init: { alias: ['initialize'], event: self.init },
        addModel: { alias: ['createModel', 'newModel', 'generateModel'], event: self.addModel },
        addMigration: { alias: ['createMigration', 'newMigration', 'generateMigration'], event: self.addMigration },
        migrate: { alias: ['migrations', 'migration'], event: self.migrate },
        load: { alias: ['get', 'import'], event: self.import },
        find: { alias: ['lookup'], event: self.find },
        usage: { alias: ['info', 'help'], event: self.usage }
    };

    // if a custom logger is passed
    // use it instead of the built in logger.
    // used only with API.
    if(logger){

        // logger uses winston like log types
        // if type is present it will try to call it otherwise
        // it will call the function directly or fallback to default logger.
        log = function (msg, type){
            if(logger[type] && _.isFunction(logger[type]))
                logger[type](msg);
            else if(logger.info && _.isFunction(logger.info))
                logger.info(msg);
            else
                if(_.isFunction(logger))
                    logger(msg);
                else
                    defaultLog(msg, type);
        }

    }

    // add defaults for logs.
    defaults.db.logging = log;
    defaults.migration.logging = log;

    validCommands = _.functions(this);

    // apply context to helpers.
    helpers = utils.helpers.call(this, log);

    this.Sequelize = Sequelize;
    this.moment = moment;
    this.sqPath = sqPath;
    this.DataTypes = DataTypes;

    this.getMigrator = function getMigrator(force) {
       self.migConf.filesFilter = new RegExp(self.migConf.filesFilter);
        self.migConf.path = p.join(cwd, self.migConf.path);
        var Migrator = require('./migrator');
        Migrator = Migrator.call(self);

        if (force)
            self.migInstance = new Migrator(self.sequelize, self.migConf);
         else
            self.migInstance = self.migInstance || new Migrator(self.sequelize, self.migConf);
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

    function runCmd() {
        cmds[self.cmd].event.call(self);
    }

    // if boolean is passed cli is calling.
    if(sequelize === true){
        cli = true;
        sequelize = undefined;
        options = undefined;
    }

    // check if command alias was used.
    this.cmd = lookupCmd(cmd);

    if(!_.contains(validCommands, this.cmd)) return;

    // if options are not specified
    // assume only options are passed
    // and no existing db connection is supplied.
    if(!options && !cli){
        options = sequelize;
        sequelize = undefined;
    }

    // get user config path.
    config = p.join(cwd, '/sqcmd.json');
    
    // check if config file exists.
    if(fs.existsSync(config)){
        config = helpers.tryParseJSON(utils.io.read(config));
        // get the config for the current environment.
        options = config[process.env.NODE_ENV  || 'development'] || {};
    } else {
        if(cli && !_.contains(['usage', 'init'], this.cmd))
           return this.exit('Configuration file is required to use sequelize-cmd.\n      Use "sqcmd init" without quotes to initialize.', 'warn');
    }

    // merge the options.
    options.migration.path = options.migration.path || options.migration.migrations;
    options = _.merge(defaults, options);
    dbConf = _.extend(options.db, flags);
    migConf = _.extend(options.migration, flags);


    // we need to specify the path the dialect module in use.
    dbConf.dialectModulePath = dbConf.dialectModulePath || p.join(cwd, '/node_modules/' + dbConf.dialect);

    // check if custom logger is used for db if so use it.
    if(dbConf.logger)
        log = dbConf.logger;

    // set instance db object.
    this.sequelize = sequelize;
    this.dbConf = dbConf;
    this.migConf = migConf;
    this.templates = options.templates;
    this.migrations = {};
    this.models = {};

    // if init don't create db connection.
    if(_.contains(['init', 'usage'], this.cmd) && cli){

        if(this.cmd === 'usage')
            return runCmd();

        if(this.cmd === 'init')
            return runCmd();

    } else {

        // if not cli and no db or config return error.
        if(!cli && !this.sequelize && (!dbConf.database || dbConf.database == 'undefined'))
            return this.exit('Sequelize db connection not provided or invalid configuration file.', 'error');

        // if is cli and no db is specified return error.
        if(cli && !dbConf.database || dbConf.database == 'undefined')
            return this.exit('Unable to continue using database: ' + dbConf.database, 'error');


        // if no database connection create one.
        // then get the migInstance.
        if(!this.sequelize) {

            this.sequelize = new Sequelize(dbConf.database, dbConf.username, dbConf.password, dbConf);
            this.sequelize
                .authenticate()
                .complete(function(err) {
                    if(err)
                        return self.exit(err.message + '\n      ' + err.stack || '');
                    self.getMigrator();

                    // only run cmd if called from cli
                    if(cli)
                        runCmd();
                });

        } else {

            this.getMigrator();

            // only run cmd if called from cli
            if(cli)
                runCmd();

        }

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

    migPath = p.join(cwd, options.path);
    modPath = p.join(cwd, options.models);
    seedPath = p.join(cwd, options.seeds);

    // make sure paths do not exist.
    if(!flags.force && !flags.f)
        if(utils.io.exists(cwd + '/sqcmd.json'))
            return this.exit('The path sqcmd.json configuration file already exists. Did you mean to overwrite with the --force flag?', 'warn');


    // add conf and directories.
    utils.io.copy(p.join(this.templates, '/sqcmd.json'), p.join(cwd, '/sqcmd.json'));

    // add migrations directory.
    if(!utils.io.exists(migPath))
        utils.io.mkdir(migPath);

    // add models directory.
    if(!utils.io.exists(modPath))
        utils.io.mkdir(modPath);

    // add seeds directory.
    if(!utils.io.exists(seedPath))
        utils.io.mkdir(seedPath);

    this.exit('Sequelize command successfully initialized.');
};

/**
 * Generates a model.
 * @param {string} [name] - the name of the model or migration.
 * @param {string|object} [properties] - properties and attributes for table.
 * @param {object} [options] - additional options such as associations, instances methods. Only available when API is used.
 * @param {string} [prefix] - a path to prefix relative to the defined migrations root path.
 * @param {string} [template} - the name of the template, same as file name without extension.
 */
SqCmd.prototype.addModel = function addModel(name, properties, options, prefix, template) {

    var targetPath,
        parsed;

    name = name || commands[0];
    template = template || flags.template || flags.t || 'model';

    // enables passing vars into signature
    // as name, properties, prefix, template.
    if(_.isString(options)){
        if(_.isString(prefix)){
            template = prefix;
            prefix = options;
            options = undefined;
        } else {
            prefix = options;
            options = undefined;
        }
    }

    // check for a prefix to be added to the path.
    prefix = prefix || flags.prefix || flags.p || '';

    // if we don't have options be sure to use empty string.
    options = options || '';

    if(!name)
        return this.exit('Generating a model requires a name.', 'warn');

    // load models.
    this.models = this.load('models');

    // normalize properties and target path.
    name = name.replace('.js', '');
    template = template.replace('.js', '');
    properties = properties || (commands[1] ? commands.splice(1, commands.length): []);
    targetPath = this.migConf.models;
    targetPath = p.join(cwd, targetPath, prefix, name + '.js');
    targetPath = helpers.strToCase(targetPath, this.migConf.fileNames);
    name = helpers.strToCase(name, this.migConf.modelNames);

    if((!flags.force && !flags.f) && utils.io.exists(targetPath))
        return this.exit('The file ' + targetPath + ' already exists. Use --force or -f to overwrite.', 'warn');

    // parse the properties if any.
    parsed = helpers.parseProp(properties);
    if(!parsed)
        this.exit('No properties provided generating empty model.', 'warn');
    template = utils.io.read(p.join(cwd, this.templates, '/' + template + '.js'));
    template = template.replace(/{{properties}}/, parsed || '// add properties');
    template = template.replace(/{{name}}/g, name);
    template = template.replace(/{{options}}/, options || '// add getters, setters, assoc. etc.');
    utils.io.write(targetPath, template);
    log('The model ' + name + ' was successfully created.');
    this.exit();

};

/**
 * Generates a migration.
 * @param {string} [name] - the name of the model or migration.
 * @param {string} [model] - an existing model (not the file name) to create the migration from.
 * @param {string} [prefix] - a path to prefix relative to the defined migrations root path.
 * @param {string} [template] - the name of the template, same as file name without ext.
 */
SqCmd.prototype.addMigration = function addMigration(name, model, prefix, template) {

    var self = this,
        targetPath, up, down;

    name = name || commands[0];
    prefix = prefix || flags.prefix || flags.p || '';
    template = template || flags.template || flags.t || 'migration';
    model = model || flags.model || flags.m || undefined;

    if(!name)
        return this.exit('Generating a migration requires a name.', 'warn');

    // load metadata so we can compare state.
    this.getMeta().success(function (meta) {

        // check if model was specified.
        if(model && self.models[model]){
            model = self.models[model];
        }

        name = name.replace('.js', '');
        template = template.replace('.js', '');
        name = moment().format('YYYYMMDDHHmmss') + '_' + name;
        targetPath = self.migConf.path;
        targetPath = p.join(targetPath, prefix, name + '.js');
        targetPath = helpers.strToCase(targetPath, self.migConf.fileNames);
        template = utils.io.read(p.join(cwd, self.templates, '/' + template + '.js'));

        // should never exist but just in case.
        if((!flags.force && !flags.f) && utils.io.exists(targetPath))
            return self.exit('The file ' + targetPath + ' already exists. Use --force or -f to overwrite.', 'warn');

        template = template.replace('{{up}}', up || '// add alter commands.');
        template = template.replace('{{down}}', down || '// add alter commands.');
        utils.io.write(targetPath, template);
        log('The migration ' + name + ' was successfully created.');
        self.exit();

    }).error(function (err) {
        self.exit(err.message, '\n' + err.stack);
    });

};

/**
 * Run and revert migrations.
 * @param {string} name - the name of the migration to run.
 * @param {boolean} undo - when true the migration is undone.
 */
SqCmd.prototype.migrate = function migrate(name, undo) {

    var self = this,
        migrator = this.migInstance,
        snapshot;

    undo = undo || flags.undo || flags.u || false;

    if(undo) {
        migrator.findOrCreateSequelizeMetaDAO().success(function(Meta) {
            Meta.find({ order: 'id DESC' }).success(function(meta) {
                if (meta) {
                    migrator = migrator.sequelize.getMigrator(_.extend(self.migConf, meta.values), true);
                    migrator.migrate({ method: 'down' }).success(function() {
                        self.exit();
                    })
                } else {
                    console.log("There are no pending migrations.");
                    self.exit();
                }
            });
        });
    } else {
        migrator.migrate().success(function() {
            self.exit();
        });
    }

};

/**
 * Loads all models/migrations from the specified folder.
 * @param {string} [type] - the type to get models or migrations.
 * @param {boolean} [raw] - when true raw data is returned without any processing.
 * @returns {object}
 */
SqCmd.prototype.load = function load(type, raw) {
    var self = this,
        data = {},
        path, result;

    type = type || commands[0].toLowerCase();
    raw = raw || flags.raw || flags.r || false;
    if(!type)
        return this.exit('Get requires a type either models or migrations. ex: "sqcmd get models" without quotes.', 'warn')

    // use require each to load files.
    result = type === 'models' ? reqeach(p.join(cwd, this.migConf.models)) : reqeach(p.join(cwd, this.migConf.path));

    // models import to sequelize instance
    // so we can access all model properties.
    if(type === 'models'){
        // if raw object request just return result.
        if(raw) {
            data = result;
        } else {
            _.forEach(result, function (v,k){
                var model = v(self.sequelize, DataTypes);
                data[model.name] = model;
            });
            Object.keys(data).forEach(function(modelName) {
                // use try/catch in case unknown model
                // is specified in associations.
                if ('associate' in data[modelName])
                    try{
                        data[modelName].associate(data);
                    } catch(err) {
                        log(err.message, 'warn');
                    }
            });
            var obj = {};
            // create simplified model
            _.forEach(data, function (v,k) {
                console.log(v);
                obj[k] = {
                    name: v.name,
                    tableName: v.tableName,
                    primaryKeys: v.primaryKeys,
                    rawAttributes: v.rawAttributes,
                    associations: v.associations,
                    //tableAttributes: v.tableAttributes,
                    //attributes: v.attributes,
                    //options: v.options
                };
            });
            data = obj;
        }
    } else {
        data = result;
    }
    return data;
};

/**
 * Gets current Sequelize metadata.
 * @returns {promise}
 */
SqCmd.prototype.getMeta = function getMeta() {

    var migrator = this.migInstance;

    // load models and migrations
    this.models = this.load('models');
    this.migrations = this.load('migrations');

    // return promise with metadata.
    return migrator.findOrCreateSequelizeMetaDAO();
}

/**
 * Finds a migration by id.
 * @param {string] [id] - the id of the migration.
 * @returns {object|undefined}
 */
SqCmd.prototype.find = function find(id) {

    self.load('migrations');

    var keys = Object.keys(this.migrations),
        key;

    if(_.isEmpty(this.migrations))
        return this.exit('There are no migrations loaded.\n      ' +
            'Verify you have created migrations and that the path is valid.', 'warn');

    if(!id)
        return this.exit('Cannot find migration by id of undefined.', 'error');

    key = keys.filter(function(v) {
        var k = v.split('_')[0];
        return id == k;
    })[0];
    if(key)
        return this.migrations[key];
    return undefined;
}

/**
 * Displays help information.
 */
SqCmd.prototype.usage = function usage() {

    console.log(' ');
    console.log('Sequelize Command');
    console.log('========================================');
    console.log(' ');
    console.log('Usage: sqcmd <command>');
    console.log(' ');
    console.log('Method        Description');
    console.log('init          initializes model, migration and sqcmd.json');
    console.log('              flags: [--force, -f] ');
    console.log('addModel      adds a new model including passed in properties & options.');
    console.log('              flags: [--force, -f, --template, -t, --prefix, -p]');
    console.log('addMigration  adds a new migration stub to the migrations folder.');
    console.log('              flags: [--force, -f, --template, -t]');
    console.log('migrate       migrates pending undone migrations.');
    console.log('              flags: [--undo, -u]');
    console.log('load          loads models or migrations specified by type. API ONLY');
    console.log('              flags: none');
    console.log('find          finds a migration by id. API ONLY');
    console.log('              flags: none');
};

/**
 * Exits sequelize-cmd with message if specified.
 * @param {string} [msg] - message to display on exit.
 * @param {string} [type] - the message type.
 */
SqCmd.prototype.exit = function exit(msg, type){
    var code = 0;
    if(_.contains(['error'], type))
        code = 1;
    if(msg)
        log(msg, type);
    process.exit(code);
};
