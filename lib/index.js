'use strict';

var optimist = require('optimist');
    path = require('path'),
    _ = require('lodash'),
    fs = require('fs'),
    argv = optimist.argv,
    cli = /cli.js/.test(args.$0),
    args = _.clone(argv) || {},
    cmd = argv._[0] || undefined,
    commands = argv._ || [],
    sqcmd;

    // delete path & commands leave flags.
    delete args._;
    delete args.$0;
    flags = args || {};

module.exports = new SqCmd;

function SqCmd(db, options) {

    var defaults = {
            db: {
                host: 'localhost',              // server hostname or ip.                           
                port: 3306,                     // server port.                        
                database: 'undefined',          // database name.                                 
                username: 'root',               // authorized user.                            
                password: null,                 // password or null.
                logging: function(str) {
                    
                }                                
            },
            migration: {
                path: './migrations',           // location of migrations.
                filesFilter: /\.js$/,           // RegExp filter                         
                models: './models',             // location of models.  
                seeds: './seeds',               // location of seed files.  
                comments: true                  // when false removes helper comments from templates.                                                                             
            }
        },
        config, dbConf, migConf;
    
    function tryParseJSON(obj) {
        try{
           return JSON.parse(obj); 
        } catch(e){
            return false;
        }
    }


    // if options are not specified
    // assume only options are passed
    // and no existing db connection is supplied.
    if(!options){
        options = db;
        db = undefined;
    }

    // get user config.
    config = path.join(process.cwd(), '/sqcmd.json');    
    
    // check if config file exists.
    if(fs.existsSync(this.config)){
        config = tryParseJSON(this.config);
        // get the config for the current environment.
        config = config[process.env || 'development'] || {};
    }

    // merge the options.
    options = _.merge(defaults, options);
    dbConf = _.extend(options.db, flags);
    migConf = _.extend(options.migrations, flags);

    this.db = db;
        
    // if no database connection create one.
    if(!this.db) {
        this.db = new Sequelize(dbConf.database, dbConf.username, dbConf.password, dbConf);
        this.db
            .authenticate()
            .complete(function(err) {
                if(err) 
                    throw err;

            });
    } else {


    }

    this.migrator = this.db.connection.getMigrator(migConf);

}


// if is cli then create instance of SqCmd;
if(cli) 
    sqcmd = new SqCmd();
