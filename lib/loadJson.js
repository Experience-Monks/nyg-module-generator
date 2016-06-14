var fs = require('fs');
var path = require('path');
var noop = require('no-op');
var chalk = require('chalk');

module.exports = function(filePath, cb) {
  cb = cb||noop;
  var cwd = process.cwd();
  filePath = filePath||path.join(cwd, 'package.json');
  fs.readFile(filePath, 'utf8', function(err, data) {
    if (err){
      console.warn(chalk.bgYellow("WARN"), chalk.magenta("could not open "+filePath));
      console.warn(chalk.dim(e.message));
      return cb(err);
    }
    try {
      data = JSON.parse(data)
    } catch (e) {
      console.warn(chalk.bgYellow("WARN"), chalk.magenta("could not open "+filePath));
      console.warn(chalk.dim(e.message));
      return cb(e)
    }
    cb(null, data)
  })
};