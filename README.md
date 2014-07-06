#Sequelize-cmd

A command line interface for Sequelize. Largely based on sequelize-cli "cmd" adds advanced features that provide
auto generated migrations based on previous model sets. The goal is to compare the current models state compared to
the previous thereby enabling a diff for a lack of a better term. This diff is then used to stubb out the changes
in your migration.

Sequelize-cmd also allows passing an existing db connection as well as connecting via configuration params.

##Pre-Release Not for Production Use

Sequelize-cmd is very young and not ready for production use. 