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
    sqPath, load, getMeta, exit,
    writeMigration, Promise;

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

/**
 * SqCmd - Sequelize command line utility for migrations.
 * @param {Sequelize} [sequelize] - instance of Sequelize
 * @param {object} [options] - migration options.
 * @param {function} [logger] - logger
 * @returns {SqCmd}
 * @constructor
 */
function SqCmd(sequelize, options, logger) {

	console.log('DEPRECATED: Note sequelize-cmd has been deprecated due to change in sequelize core. Please consider using Umzug: https://github.com/sequelize/umzug')

    var self = this,
        defaults, config, dbConf, migConf, cmds, validCommands;

    defaults = {
        integrated: false,                  // FUTURE: when true do not run commands only return instance.
        templates: p.join(__dirname, '/assets'), // root path for migration.js, model.js, seed.js and sqcmd.json
        db: {
            dialect: 'mysql',               // the dialect for Sequelize to connect to.
            host: 'localhost',              // server hostname or ip.
            port: 3306,                     // server port.
            username: 'root',               // authorized user.
            password: null                  // password or null.
        },
        migration: {
            migrations: '/migrations',     // location of migrations.
            models: '/models',             // location of models.
            seeds: '/seeds',               // location of seed files.
            filesFilter: /\.js$/,          // RegExp filter
            autoSeed: false,               // when true seeding will run after migrations. NOT TESTED.
            fileNames: undefined,          // file names converted to case (capitalize, lower, upper, camel, pascal, title, undefined).
            modelNames: 'capitalize',      // model names converted to case (capitalize, lower, upper, camel, pascal, title, undefined).
            typeVariable: 'types',         // the variable name for your datatypes.
            
            validAttributes: [
                'type',
                'allowNull',
                'defaultValue',
                'primaryKey',
                'unique',
                'comment',
                'get',
                'set',
                'validate',
                'values',
                'autoIncrement'
            ],

            excludeAttributes: [
                '_checkEnum'
            ],

            // the keys to include when parsing models for migration generation.
            validOptions: [
                'name',
                'indexes',
                'classMethods',
                'instanceMethods',
                'validate',
                'getterMethods',
                'setterMethods',
                'hooks',
                'tableName',
                'omitNull',
                'freezeTableName',
                'paranoid',
                'underscored',
                'createdAt',
                'updatedAt',
                'deletedAt'
            ]
        }
    };

    cmds = {
        init: { alias: ['initialize'], event: self.init },
        addModel: { alias: ['createModel', 'newModel', 'generateModel'], event: self.addModel },
        addMigration: { alias: ['createMigration', 'newMigration', 'generateMigration'], event: self.addMigration },
        addSeed: { alias: ['createSeed', 'newSeed', 'generateSeed'], event: self.addSeed },
        migrate: { alias: [], event: self.migrate },
        seed: { alias: [], event: self.seed },
        load: { alias: ['import'], event: self.import },
        find: { alias: ['lookup'], event: self.find },
        usage: { alias: [], event: self.usage }
    };

    // if a custom logger is passed
    // use it instead of the built in logger.
    // used only with API.
    // passes the log message and type ex: log('my message', 'info').
    // types are: 'info', 'warn', 'error', 'debug' (based on winston naming conventions).
    if(logger && _.isFunction(logger))
        log = logger;

    // add defaults for logs.
    defaults.db.logging = log;
    defaults.migration.logging = log;

    validCommands = _.functions(this);

    // apply context to helpers.
    helpers = utils.helpers.call(this, log);

    this.Sequelize = Sequelize;
    this.sequelize = sequelize || undefined;
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
           this.exit('Configuration file is required to use sequelize-cmd.\n      Use "sqcmd init" without quotes to initialize.', 'warn');
    }

    // merge the options.
    options = options || {};
    options.migration = options.migration || {};
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
    if(_.contains(['init', 'usage'], this.cmd)){

        if(!cli && this.cmd === 'init')
            return this.exit('Sequelize-cmd does not expose "init" or "usage" commands when using the API.', 'warn');
        runCmd();

    } else {

        // if not cli and no db or config return error.
        if(!cli && !this.sequelize && (!dbConf.database || dbConf.database == 'undefined'))
            this.exit('Sequelize db connection not provided or invalid configuration file.', 'error');

        // if is cli and no db is specified return error.
        if(cli && !dbConf.database || dbConf.database == 'undefined')
            this.exit('Unable to continue using database: ' + dbConf.database, 'error');


        // if no database connection create one.
        // then get the migInstance.
        if(!this.sequelize) {

            this.sequelize = new Sequelize(dbConf.database, dbConf.username, dbConf.password, dbConf);
            this.sequelize
                .authenticate()
                .complete(function(err) {
                    if(err)
                        return self.exit(err.stack || err.message || 'Unknown error occurred.', 'error');
                    self.getMigrator();
                    Promise = self.sequelize.Utils.Promise;
                    // only run cmd if called from cli
                    if(cli)
                        runCmd();
                });

        } else {

            this.getMigrator();
            Promise = this.sequelize.Utils.Promise;

            // only run cmd if called from cli
            if(cli)
                runCmd();

        }

    }

    return this;
}

/**
 * Initialize the Sequelize command line interface.
 * @memberof SqCmd
 * @param {string} options - the migrations configuration options.
 */
SqCmd.prototype.init = function init(options){

    var migPath, modPath, seedPath;

    options = _.extend(this.migConf, options);
    options.path = options.path || '/migrations';
    options.models = options.models || '/migrations';
    options.seeds = options.seeds || '/migrations';

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
 * @memberof SqCmd
 * @param {string} [name] - the name of the model or migration.
 * @param {string|object} [properties] - properties and attributes for table.
 * @param {object} [options] - additional options such as associations, instances methods. Only available when API is used.
 * @param {string} [prefix] - a path to prefix relative to the defined migrations root path.
 * @param {string} [template} - the name of the template, same as file name without extension.
 */
SqCmd.prototype.addModel = function addModel(name, properties, options, prefix, template) {

    var targetPath,
        modelNames,
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
        this.exit('Generating a model requires a name.', 'warn');

    // load models.
    this.models = this.load('models', true);
    modelNames = Object.keys(this.models) || [];

    // normalize properties and target path.
    name = name.replace('.js', '');
    template = template.replace('.js', '');
    properties = properties || (commands[1] ? commands.splice(1, commands.length): []);
    targetPath = this.migConf.models;
    targetPath = p.join(cwd, targetPath, prefix, name + '.js');
    targetPath = helpers.strToCase(targetPath, this.migConf.fileNames);
    name = helpers.strToCase(name, this.migConf.modelNames);

    if((!flags.force && !flags.f) && utils.io.exists(targetPath))
        this.exit('The file ' + targetPath + ' already exists. Use --force or -f to overwrite.', 'warn');

    // make sure the model doesn't already exist.
    if(modelNames.indexOf(name) !== -1 && (!flags.force && !flags.f))
        this.exit('The model ' + name + ' already exists. Use --force or -f to overwrite.', 'warn');

    // parse the properties if any.
    parsed = helpers.formatProperties(properties);
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
 * Creates migrations based on pending models not present in last migration if any.
 * @priavte
 * @memberof SqCmd
 * @param {string} name - the name of the migration.
 * @param {string} [model] - a name of the model you wish to build the migration for.
 * @param {string} [template] - the name of the template to use.
 */
SqCmd.prototype.addMigration = function addMigration(name, model, template) {

    var self = this,
        compare = require('./compare'),
        up = '',
        down = '',
        targetPath;

    name = name || commands[0];
    template = template || flags.template || flags.t || 'migration';
    model = model || flags.m || flags.model || undefined;

    // make sure we have a valid name.
    if(!name)
        this.exit('Generating a migration requires a name.', 'warn');

    // requested empty stubbed out migration only.
    if(flags.s || flags.s)
        return writeMigration.call(self, name, template, up, down);

    // load metadata so we can compare state.
    this.getMeta().success(function (meta) {

        var len = Object.keys(self.models).length,
            ctr = 0,
            models = self.models,
            modelKeys = Object.keys(self.models),
            report = '',
            touched = [],
            touchedStr = '',
            newLine,
            baseTabs,
            previous;

        compare = compare.call(self);

        if(model)
            modelKeys = model.split(',');

        if(!modelKeys || !modelKeys.length)
            self.exit('Unable to create migration, models not defined or cannot be found.', 'warn');

        // check for previous snapshot of model data.
        if(meta && meta.data)
            previous = helpers.tryParseJSON(meta.data.toString('utf8'));

        // iterate the loaded models and build migration.
        _.forEach(self.models, function (v,k) {

            var compareResult,
                prevModel,
                upResult,
                dwnResult;

            if(modelKeys.indexOf(k) !== -1) {

                // compare to previous model for changes if any.
                prevModel = previous && previous[k] ? previous[k] : undefined;
                compareResult = compare(v, prevModel);

                // add results to collection.
                upResult = compareResult.up.toString();
                dwnResult = compareResult.down.toString();

                if(!upResult.length && !dwnResult.length)
                    return;

                // remove new line if last iteration.
                newLine = ctr < len -1 ? '\n' : '';
                baseTabs = ctr > 0 ? '\t\t' : '';

                if(upResult && upResult.length)
                    up += (baseTabs + upResult + newLine);

                if(dwnResult && dwnResult.length)
                    down += (baseTabs + dwnResult + newLine);

                touched.push(k);

                ctr +=1;

            }

        });

        // write the migration to file.
        touchedStr = touched.length ? 'Models touched: ' + touched.join(', ') : 'No changes detected, migration will NOT be generated.';
        report += touchedStr;
        report += '\n      Processed: ' + modelKeys.length + ' Touched: ' + touched.length;

        if(!touched.length)
            self.exit(report, 'warn');
        else
            writeMigration.call(self, name, template, up, down, report);

        //exit we're all done.
        self.exit();

    }).error(function (err) {
        self.exit(err.stack || err.message || 'Unknown error occurred.', 'error');
    });

};

/**
 * Run and revert migrations.
 * @memberof SqCmd
 * @param {string} name - the name of the migration to run.
 * @param {boolean} [undo] - when true the migration is undone.
 * @param {boolean} [seed] - when true seeds will be run after migration.
 */
SqCmd.prototype.migrate = function migrate(name, undo, seed) {

    var self = this,
        migrator = this.migInstance;

    undo = undo || flags.undo || flags.u || false;
    name = name || commands[0];
    seed = seed || flags.s || flags.seed || undefined;

    // get models.
    this.models = this.load('models');

    if(undo) {
        migrator.findOrCreateSequelizeMetaDAO().success(function(Meta) {
            Meta.find({ order: 'id DESC' }).success(function(meta) {
                if (meta) {
                    migrator = migrator.sequelize.getMigrator(_.extend(self.migConf, meta.values), true);
                    migrator.migrate({ method: 'down' }).success(function() {
                        if(!seed)
                            self.exit();
                        self.seed();
                    }).error(function (err) {
                       self.exit(err.stack || err.message || 'Unknown error occurred.', 'error');
                    });
                } else {
                    self.exit('There are no pending migrations.', 'warn');
                }
            });
        });
    } else {
        migrator.migrate().success(function() {
            if(!seed)
                self.exit();
            self.seed();
        }).error(function (err) {
            self.exit(err.stack || err.message || 'Unknown error occurred.', 'error');
        });
    }

};

/**
 * Stubbs out a new seed for data creation after migrations.
 * @param {string} name - the name of the seed file to be created.
 * @param {string} [prefix] - a prefix to be added to the file path.
 * @param {string} [template] - the template to use to create the seed.
 */
SqCmd.prototype.addSeed = function addSeed(name, prefix, template) {

    var targetPath;

    name = name || commands[0];
    template = template || flags.template || flags.t || 'seed';
    prefix = prefix || flags.p || flags.prefix || '';

    name = name.replace('.js', '');
    template = template.replace('.js', '');

    targetPath = this.migConf.seeds;
    targetPath = p.join(cwd, targetPath, prefix, name + '.js');
    targetPath = helpers.strToCase(targetPath, this.migConf.fileNames);
    template = utils.io.read(p.join(cwd, this.templates, '/' + template + '.js'));

    // should never exist but just in case.
    if((!flags.force && !flags.f) && utils.io.exists(targetPath))
       this.exit('The file ' + targetPath + ' already exists. Use --force or -f to overwrite.', 'warn');

    utils.io.write(targetPath, template);
    this.exit('The seed ' + name + ' was successfully created.', 'info');

};

/**
 * Runs seed files to populate tables. If a file name is not
 * used all seeds in the seeds directory are processed.
 * @memberof SqCmd
 * @param {string} [name] - the name of the seed to run.
 */
SqCmd.prototype.seed = function seed(name) {

    var self = this,
        Chance = require('chance'),
        promises = [],
        chance,
        seeds;

    name = name || commands[0] || flags.m || flags.model || undefined;
    seeds = reqeach(p.join(cwd, this.migConf.seeds));
    chance = new Chance();

    this.load('models');

    if(name) {
        if(!seeds[name])
            this.exit('Unable to find seed ' + name + ' from path ' + this.migConf.seeds, 'warn');
        seeds = { name: seeds[name] };
    }

    _.forEach(seeds, function (v, k) {
        var func = seeds[k].call(self, self.sequelize, DataTypes, chance);
        promises.push(func);
    });

    Promise.all(promises).then(function () {
        self.exit('Succesfully processed (' + promises.length + ') seeds.');
    });

};

/**
 * Displays help information.
 * @memberof SqCmd
 */
SqCmd.prototype.usage = function usage() {

    console.log(' ');
    console.log('Sequelize Command');
    console.log('============================================================================================');

    console.log(' ');
    console.log('Usage: sqcmd <command>');
    console.log(' ');

    console.log('init          initializes models, migrations, seeds and sqcmd.json');
    console.log('              flags: [--force, -f]');
    console.log('              example: sqcmd init');
    console.log(' ');

    console.log('addModel      adds a new model including passed in properties & options.');
    console.log('              when creating model properties type attributes are converted to uppercase.');
    console.log('              for example age:type=decimal will be properly converted to DECIMAL on output.');
    console.log('              multiple properties can be added each separated by a space. Each property attribute')
    console.log('              shold be separated with a colon :.');
    console.log('              flags: [--force, -f, --template, -t, --prefix, -p]');
    console.log('              example: sqcmd addModel User -p /account -t model_custom');
    console.log('              example2: sqcmd addModel User firstName lastName email age:type=decimal');
    console.log(' ');

    console.log('addMigration  adds a new migration stub to the migrations folder.');
    console.log('              flags: [--force, -f, --template, -t, --model, -m, -stub, -s]');
    console.log('              example: sqcmd addMigration user_create');
    console.log(' ');

    console.log('addSeed       adds a new seed stub to the seeds folder.');
    console.log('              flags: [--force, -f, --template, -t, --prefix, -p]');
    console.log('              example: sqcmd addSeed seed_users -t account_seed -p /account');
    console.log(' ');

    console.log('seed          seeds data into database from seeds folder.');
    console.log('              flags: [--force, -f]');
    console.log('              example: sqcmd seed');
    console.log(' ');

    console.log('migrate       migrates pending undone migrations.');
    console.log('              flags: [--undo, -u, -seed, -s]');
    console.log('              example: sqcmd migrate or sqcmd migrate -u or sqcmd migrate -s');

    process.exit(0);
};

/* Start Private Methods
************************************************/

/**
 * Writes out a generated migration.
 * @private
 * @param {string} name - the name of the migration.
 * @param {string} template - the template to use.
 * @param {string} up - the up actions to write to file.
 * @param {string} down - the down actions to write to file.
 * @param {string} report - the migration report.
 * @memberof SqCmd
 * @type {writeMigration}
 */
writeMigration = SqCmd.prototype.writeMigration = function (name, template, up, down, report) {

    var targetPath;

    name = name.replace('.js', '');
    template = template.replace('.js', '');
    name = moment().format('YYYYMMDDHHmmss') + '_' + name;
    targetPath = this.migConf.path;
    targetPath = p.join(targetPath, name + '.js');
    targetPath = helpers.strToCase(targetPath, this.migConf.fileNames);
    // TODO fix for custom templates.
    template = utils.io.read(this.templates + '/' + template + '.js');

    // should never exist but just in case.
    if((!flags.force && !flags.f) && utils.io.exists(targetPath))
        return this.exit('The file ' + targetPath + ' already exists. Use --force or -f to overwrite.', 'warn');

    template = template.replace('{{up}}', up || '// add migration commands.');
    template = template.replace('{{down}}', down || '// add migration commands.');
    utils.io.write(targetPath, template);
    log('The migration ' + name + ' was successfully created.\n      ' + report);


};

/**
 * Loads all models/migrations from the specified folder.
 * @private
 * @memberof SqCmd
 * @param {string} [type] - the type to get models or migrations.
 * @param {boolean} [raw] - when true returns only raw object models.
 * @returns {object}
 */
load = SqCmd.prototype.load = function load(type, raw) {

    var self = this,
        data = {},
        rawModels,
        typePath;

    type = type || commands[0].toLowerCase();

    if(!type)
        return this.exit('Get requires a type either models or migrations. ex: "sqcmd get models" without quotes.', 'warn')

    // use require each to load files.
    typePath = type === 'models' ? this.migConf.models : this.migConf.path;
    rawModels = reqeach(p.join(cwd, typePath));

    // models import to sequelize instance
    // so we can access all model properties.
    if(type === 'models'){

       _.forEach(rawModels, function (v,k){
           var model;
           if(_.isFunction(v)) {
               model = v(self.sequelize, DataTypes);
               data[model.name] = model;
           }
        });

        // only attach to sequelize instance
        // raw models are NOT requested.
        if(!raw){
            Object.keys(data).forEach(function(modelName) {
                // use try/catch in case unknown model
                // is specified in associations.
                if ('associate' in data[modelName])
                    try{
                        data[modelName].associate(data);
                    } catch(err) {
                        log('Association failed for model ' + modelName + '.\n     ' +
                            'Verify the model exists and that you have specified ' +
                            'the correct model name in your association.', 'warn');
                    }
            });

            // create simplified model
            // to capture current state.
            _.forEach(data, function (v,k) {
                data[k] = {
                    name: v.name,
                    attributes: helpers.normalizeAttributes(v.originalAttributes),
                    options: helpers.normalizeOptions(v.originalOptions, self.migConf.validOptions)
                };
            });
        }

    } else {
        data = rawModels;
    }

    return data;
};

/**
 * Gets current Sequelize metadata.
 * @private
 * @memberof SqCmd
 * @returns {promise}
 */
getMeta = SqCmd.prototype.getMeta = function getMeta() {

    var migrator = this.migInstance;

    // load models and migrations
    this.models = this.load('models');
    this.migrations = this.load('migrations');

    // return promise with metadata.
    return migrator.findOrCreateSequelizeMetaDAO()
        .then(function(SequelizeMeta) {
            return SequelizeMeta
                .find({ order: 'id DESC' }).then(function (meta) {
                    return meta;
                });
        }, function (err) {
            log(err.stack || err.message || 'Unknown error occurred.', 'error');
        });
}


/**
 * Exits sequelize-cmd with message if specified.
 * @private
 * @memberof SqCmd
 * @param {string} [msg] - message to display on exit.
 * @param {string} [type] - the message type.
 */
exit = SqCmd.prototype.exit = function exit(msg, type){
    var code = 0;
    type = type || 'info';
    if(_.contains(['error'], type))
        code = 1;
    if(msg)
        log(msg, type);
    process.exit(code);
};
