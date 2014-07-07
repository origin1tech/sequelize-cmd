#Sequelize-cmd

A command line interface for Sequelize. Largely based on sequelize-cli "cmd" adds advanced features that provide
auto generated migrations based on previous model sets. The goal is to compare the current models state compared to
the previous thereby enabling a diff for a lack of a better term. This diff is then used to stubb out the changes
in your migration.

Sequelize-cmd also allows passing an existing db connection as well as connecting via configuration params.

##Pre-Release Not for Production Use

Sequelize-cmd is very young and not ready for production use. 

##Available Commands

Below you will find the command options for "sequelize-cmd" along with various flag options.

####sqcmd init
- Initializes the application to prepare it for using Sequelize with migrations.
- Creates the sqcmd.json configuration, models, migrations and seed files.
- Optional Flags
    + --force
    + -f

       

##Generated Migration Example

Simple example of creating a table then dropping on down (ex; sqcmd migrate --undo or -u);

```js
module.exports = {

    up: function(migration, DataTypes, done) {
        migration.createTable('User', {
            firstName: { type: DataTypes.STRING },
            lastName: { type: DataTypes.STRING }
        },
        {
            // class/instance methods and model options here.
            // see: http://sequelizejs.com/docs/latest/models#block-22-line-0
        }
        done()
    },

    down: function(migration, DataTypes, done) {
        migration.dropTable('User');
        done()
    }

};
```

##Generated Model Example

**Basic model example:**

```js
var Model = sequelize.define('User', { 
        firstName: { type: DataTypes.STRING },
        lastName: { type: DataTypes.STRING }
    },
    {
        // class/instance methods and model options here.
        // see: http://sequelizejs.com/docs/latest/models#block-22-line-0  
    }
```

**Import model example:**

```js
var Models = sequelize.import('/path/to/models');
```

**Models file:**

```js
module.exports = function(sequelize, DataTypes) {
    return sequelize.define('User', {
           firstName: { type: DataTypes.STRING },
           lastName: { type: DataTypes.STRING }
       },
       {
           // class/instance methods and model options here.
           // see: http://sequelizejs.com/docs/latest/models#block-22-line-0  
       }
};
```