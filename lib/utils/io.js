'use strict';

var fs = require('fs-extra'),
    p = require('path'),
    io;

io = {

    exists: function exists(path, cb){
        if(cb) {
            fs.exists(path, function (exists) {
                cb(exists);
            });
        } else {
            return fs.existsSync(path);
        }
    },

    resolve: function resolve(path) {
        return p.resolve(path);
    },

    read: function read(path, options, cb) {
        if(!path || !this.exists(path))
            throw new Error ('The requested path could not be found.');
        if(typeof(options) == 'function'){
            cb = options;
            options = undefined;
        }
        options = options || 'utf8';
        if(cb) {
            fs.readFile(path, options, function (err, data) {
                if(err) cb(err);
                else cb(null, data);
            });
        } else {
            return fs.readFileSync(path, options);
        }
    },

    write: function write (path, data, options, cb){
        if(typeof(options) == 'function'){
            cb = options;
            options = undefined;
        }
        options = options || 'utf8';
        if(cb) {
            fs.writeFile(path, data, options, function (err) {
                if(err) cb(err);
                else cb(null);
            });
        } else {
            fs.writeFileSync(path, data, options);
            return true;
        }
    },

    copy: function copy(path, dest, filter, cb) {
        if(_.isFunction(filter)){
            cb = filter;
            filter = undefined;
        }
        if(cb){
            fs.copy(path, dest, filter, cb);
        } else {
            fs.writeFileSync(dest, fs.readFileSync(path));
        }
    },

    mkdir: function mkdir(path, mode, cb) {
        if(typeof(mode) == 'function'){
            cb = mode;
            mode = undefined;
        }
        mode = mode || '0777';
        if(cb) {
            fs.mkdir(path, mode, function (err) {
                if(err) cb(err);
                else cb(null, true);
            });
        } else {
            fs.mkdirSync(path, mode);
            return true;
        }
    },

    rename: function rename(path, dest, cb){
        if(cb) {
            fs.rename(path, dest, function (err) {
                if(err) cb(err);
                else cb(null, true);
            });
        } else {
            fs.rename(path, dest);
            return true;
        }
    },

    remove: function remove(path, cb) {
        if(cb) {
            fs.remove(path, function(err) {
                if(err) cb(err);
                else cb(null, true);
            });
        } else {
            fs.removeSync(path);
            return true;
        }
    },

    removeFiles: function removeFiles(dirPath) {
        try { var files = fs.readdirSync(dirPath); }
        catch(e) { return; }
        if (files.length > 0)
            for (var i = 0; i < files.length; i++) {
                var filePath = dirPath + '/' + files[i];
                if (fs.statSync(filePath).isFile())
                    fs.unlinkSync(filePath);
                else
                    io.removeFiles(filePath);
            }
        try{ fs.rmdirSync(dirPath);	}
        catch(e) { return e;}
    }
};

module.exports = io;