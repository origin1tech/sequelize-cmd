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
    flags, sqcmd, log, cli,
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
log = function log(msg, type) {
    var types = { error: 'red', warn: 'yellow', info: 'green', debug: 'blue', verbose: 'magenta' },
        prefix;
    type = type || 'info';
        prefix = colors[types[type]](type);
    console.log(prefix + ': ' + msg);
};

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

function SqCmd(sequelize, options) {

    var self = this,
        defaults, config, dbConf, migConf, cmds, validCommands;

    defaults = {
        templates: p.join(__dirname, '/assets'), // root path for migration.js, model.js, seed.js and sqcmd.json
        db: {
            dialect: 'mysql',               // the dialect for Sequelize to connect to.
            host: 'localhost',              // server hostname or ip.
            port: 3306,                     // server port.
            username: 'root',               // authorized user.
            password: null,                 // password or null.
            logging: log                    // customize logger.
        },
        migration: {
            path: './migrations',           // location of migrations.
            filesFilter: /\.js$/,           // RegExp filter
            models: './models',             // location of models.
            seeds: './seeds',               // location of seed files.
            fileNames: 'lower',             // file names converted to this case (first, lower, upper, camel, pascal, title, null).
            modelNames: 'first'             // model names converted to this case (first, lower, upper, camel, pascal, title, null).
        }
    };

    cmds = {
        init: { alias: ['initialize'], event: self.init },
        add: { alias: ['create', 'new'], event: self.add },
        migrate: { alias: ['migrations', 'migration'], event: self.migrate },
        load: { alias: ['get', 'import'], event: self.import },
        find: { alias: ['lookup'], event: self.find },
        help: { alias: ['info', 'usage'], event: self.help }
    };

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

    if(!_.contains(validCommands, this.cmd))
        return log('The command ' + colors.yellow(cmd) + ' was not recognized see "sqlcmd help" without quotes.', 'warn');

    // if options are not specified
    // assume only options are passed
    // and no existing db connection is supplied.
    if(!options && !cli){
        options = sequelize;
        sequelize = undefined;
    }

    // get user config.
    config = p.join(cwd, '/sqcmd.json');
    
    // check if config file exists.
    if(fs.existsSync(config)){
        config = helpers.tryParseJSON(utils.io.read(config));
        // get the config for the current environment.
        options = config[process.env.NODE_ENV  || 'development'] || {};
    } else {
        if(cli && !_.contains(['help', 'init'], this.cmd))
           return log('Configuration file is required to use sequelize-cmd.\n      Use "sqcmd init" without quotes to initialize.', 'warn');
    }

    // merge the options.
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

    // if not calling migrate just run command.
    if(_.contains(['init', 'generate', 'help'], this.cmd))
        return runCmd();


    // if not cli and no db or config return error.
    if(!cli && !this.sequelize && (!dbConf.database || dbConf.database == 'undefined'))
        return log('Sequelize db connection not provided or invalid configuration file.', 'error');

    // if is cli and no db is specified return error.
    if(cli && !dbConf.database || dbConf.database == 'undefined')
       return log('Unable to continue using database: ' + dbConf.database, 'error');


    // if no database connection create one.
    // then get the migInstance.
    if(!this.sequelize) {
        this.sequelize = new Sequelize(dbConf.database, dbConf.username, dbConf.password, dbConf);
        this.sequelize
            .authenticate()
            .complete(function(err) {
                if(err) 
                    return log(err.message + '\n      ' + err.stack || '');
                self.getMigrator();
                self.models = self.load('models');
                self.migrations = self.load('migrations');
                runCmd();
            });
    } else {
        this.getMigrator();
        self.models = self.load('models');
        self.migrations = self.load('migrations');
        runCmd();
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
            return log('The path sqcmd.json configuration file already exists. Did you mean to overwrite with the --force flag?', 'warn');


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

    log('Sequelize command successfully initialized.');
};

/**
 * Generates models and migrations.
 * @param {string} [type] - the type of object to generate.
 * @param {string} [name] - the name of the model or migration.
 * @param {object} [properties] - model properties to be add to model.
 * @param {string} [path] - an alternate path to save generated model/migration.
 */
SqCmd.prototype.add = function add(type, name, properties, path, prefix) {

    var genCmd = type || commands[0],
        prefix,
        targetPath,
        template,
        parsed;


    genCmd = genCmd ? genCmd.toLowerCase() : undefined;
    name = name || commands[1];
    prefix = prefix || flags.prefix || flags.p || '';

    if(!name)
        return log('Generating a ' + genCmd + ' requires a name and properties');

    name = name.replace('.js', '');

    if(!_.contains(['model', 'migration'], genCmd))
        return log('The generation command ' + genCmd + ' is not valid.', 'error');



    // normalize properties and target path.
    properties = properties || (commands[2] ? commands.splice(2, commands.length): []);
    targetPath = genCmd === 'migration' ? this.migConf.path : this.migConf.models;
    targetPath = path || flags.path || flags.p || targetPath;

    if(genCmd === 'migration'){
        name = moment().format('YYYYMMDDHHmmss') + '_' + name;
        targetPath = p.join(cwd, targetPath, prefix, name + '.js');
        targetPath = helpers.strToCase(targetPath, this.migConf.fileNames);
        template = utils.io.read(p.join(this.templates, '/migration.js'));

        // should never exist but just in case.
        if((!flags.force && !flags.f) && utils.io.exists(targetPath))
            return log('The file ' + targetPath + ' already exists. Use --force or -f to overwrite.', 'warn');

        utils.io.write(targetPath, template);
        log('The migration ' + name + ' was successfully created.');
    }

    if(genCmd === 'model'){
        targetPath = p.join(cwd, targetPath, prefix, name + '.js');
        targetPath = helpers.strToCase(targetPath, this.migConf.fileNames);
        name = helpers.strToCase(name, this.migConf.modelNames);

        if((!flags.force && !flags.f) && utils.io.exists(targetPath))
            return log('The file ' + targetPath + ' already exists. Use --force or -f to overwrite.', 'warn');

        parsed = helpers.parseProp(properties);
        if(!parsed)
            log('No properties provided generating empty model.');
        template = utils.io.read(p.join(this.templates, '/model.js'));
        template = template.replace(/{{properties}}/, parsed || '');
        template = template.replace(/{{name}}/g, name);
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
 * Loads all models/migrations from the specified folder.
 * @param {string} [type] - the type to get models or migrations.
 * @param {boolean} [raw] - when true raw data is returned without any processing.
 * @returns {object}
 */
SqCmd.prototype.load = function load(type, raw) {
    var self = this,
        db = {},
        path, result;

    type = type || commands[0].toLowerCase();
    raw = raw || flags.raw || flags.r || false;
    if(!type)
        return log('Get requires a type either models or migrations. ex: "sqcmd get models" without quotes.', 'warn')

    // use require each to load files.
    result = type === 'models' ? reqeach(p.join(cwd, this.migConf.models)) : reqeach(this.migConf.path);

    // models import to sequelize instance
    // so we can access all model properties.
    if(type === 'models'){
        // if raw object request just return result.
        if(raw) {
            db = result;
        } else {
            _.forEach(result, function (v,k){
                var model = v(self.sequelize, DataTypes);
                db[model.name] = model;
            });
            Object.keys(db).forEach(function(modelName) {
                if ('associate' in db[modelName])
                    db[modelName].associate(db);
            });
            _.forEach(db, function (v, k) {
                db[k] = { attributes: v.rawAttributes, associations: v.associations };
            });
        }
    } else {
        db = result;
    }
    return db;
};

/**
 * Finds a migration by id.
 * @param {string] [id] - the id of the migration.
 * @returns {object|undefined}
 */
SqCmd.prototype.find = function find(id) {

    var keys = Object.keys(this.migrations),
        key;

    if(_.isEmpty(this.migrations))
        return log('There are no migrations loaded.\n      ' +
            'Verify you have created migrations and that the path is valid.', 'warn');

    id = id || commands[0];
    if(!id)
        return log('Cannot find migration by id of undefined.', 'error');

    key = keys.filter(function(v) {
        var k = v.split('_')[0];
        return id == k;
    })[0];
    if(key)
        return this.migrations[key]
    return undefined;
}

/**
 * Displays help information.
 */
SqCmd.prototype.help = function help() {

    console.log('Sequelize Command Help');
    console.log('========================================');

};
