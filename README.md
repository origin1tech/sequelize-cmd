#Sequelize-cmd

A command line interface for Sequelize. Largely based on sequelize-cli "cmd" adds advanced features that provide
auto generated migrations based on previous model states. Up and Down migration events are then stubbed out
accordingly.

Sequelize-cmd also allows passing an existing db connection as well as connecting via configuration params.

##Pre-Release Not for Production Use

Sequelize-cmd is very young and not ready for production use. 

##Installation

```
npm install sequelize-cmd -g
```

After installing with the above, navigate to your project directory and run:

```
sqcmd init
```

##Add Model

Adding a model only requires a name, in your sqcmd.json file you can configure
models to auto capitalize or filenames to auto lower etc. Valid casing options are:

capitalize, lower, upper, camel, pascal, undefined.

You may add properties when generating a model. Each property may have multiple attributes.
Each property should be separated with a space. Each attribute for a property should be 
separated by a :. An attribute is specified as key=value.

```
sqcmd addModel user firstName lastName email:type=string:allowNull:false
```

##Add Migration

To add a migration you need only specify the migration name. Migrations are prefixed with a timestamp.
The migration will be generated based on a comparison from the previous state of the models. To stub out
a migration with no auto generated values use the -s or --stub flag.

```
sqcmd addMigration create_user
```

##Add Seed

Seeds are used to populate tables after a migration. Seed files are passed the sequelize instance, sequelize DataTypes
and an instance of the [http://chancejs.com/](http://chancejs.com/) library. Chance assists in generating mock data.

```
sqcmd addSeed users
```

####Example Seed

```js
'use strict';

module.exports = function (db, types, chance) {

    var model = db.models.User,
        models = [],
        count = 10;

    function generateUser(){
        var user = {
            first_name: chance.first(),
            last_name: chance.last(),
            email: chance.email()
        };
       return user;
    }

    for(var i = 0; i < count; i++){
        models.push(generateUser());
    }

    // create the rows using our generated models.
    return model.bulkCreate(models);

};
```

##Migrate

When migrating any non-processed migrations will be run based on timestamps withing the sequelize meta table. To
undo a migration simply run the command with -u or --undo.

```
sqcmd migrate
```

##Seed

If a seed name is not specified all seeds are run.

```
sqcmd seed users
```

##Usage

For a full list of commands and optional flags run:

```
sqcmd usage
```

##Options

Within your sqcmd.json file there are several options. Key options are explained below.

```js
{
    templates: '/path/to/templates', // where the seed, model and migration custom templates are stored [optional]
    db: {
        // typical Sequelize connection properties.
    }, 
    migration: {
        migrations: '/path/to/migrations/folder',
        models: '/path/to/models/folder',
        seeds: '/path/to/seeds/folder',
        typeVariable: 'types' // by default property types are defined 'types.STRING' you may wish to use 'DataTypes.STRING'
    }
}
```

##Overwriting, Specify Path or Template

To overwrite an existing file of the same name use:

```
sqcmd addModel user -f or --force
```

To save a model or seed to a specific path you may add a prefix. This prefix is appended to the location of your model
or seed folder if your models were located at **/models** and you added a prefix of **/accounts** for the model **user**
the model would be saved to **/models/accounts/user.js**. Note you may need to wrap your prefix in quotes if the path
contains spaces.

```
sqcmd addSeed users -p or --prefix /accounts 
```

To use a specific tempalte when generating a model, migration or seed you can use the -t or --template flag. This is 
useful when you have a certain type/category of model that is similar to others. Rather than having only one template
you can make as many as you like and simply specify it by name.

```
sqcmd addSeed -t seed_timestamps // or some suffix that indicates its contents.
```



