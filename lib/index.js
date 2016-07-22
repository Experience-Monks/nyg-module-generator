var Promise = require('bluebird');
var semver = require('semver');
var conf = require('npmconf');
var npmConfLoad = Promise.promisify(conf.load);
var chalk = require('chalk');
var nyg = require('nyg');
var varName = require('variable-name');
var path = require('path');
var npm = require('npm');
var fs = require('fs');
var xtend = require('xtend');
var loadJson = Promise.promisify(require('./loadJson'));
var spawn = require('npm-execspawn');
var open = require('opn');

var argv = require('yargs')
  .alias('t', 'test')
  .alias('u', 'user')
  .describe('t', 'generate index.js and test.js files')
  .describe('u', 'an organization override for GitHub URLs')
  .argv;

var target = process.cwd();

var usePkgJson = false;
var useNygConf = false;

var hasPkgJson = false;
var hasNygConf = false;

function hasFile(file) {
  try {
    fs.statSync(file);
    return true;
  } catch (e) {
    return false;
  }
}

hasPkgJson = hasFile(target + "/package.json");

var configs = {
  nyg: {
    configPath: path.join(__dirname, '../', 'nyg-cfg.json')
  },
  pkg: {
    configPath: target + '/package.json'
  },
  npm: {},
  git: {}
};

var modulePrompts = [
  {
    'name': 'location'
    , 'message': 'Where would you like to put the module?'
    , 'default': path.basename(target)
  },
  {
    'name': 'name'
    , 'message': 'Module name:'
    , 'default': path.basename(target)
  },
  {
    'name': 'description'
    , 'message': 'Module description:'
  },
  {
    'name': 'tags'
    , 'message': 'Module tags:'
  },
  {
    'name': 'stability',
    'type': 'list',
    'message': 'Module stability:',
    'default': 'experimental',
    'choices': [
      'deprecated',
      'experimental',
      'unstable',
      'stable',
      'frozen',
      'locked',
    ],
  }
];

function getNygConfig() {
  return loadJson(configs.nyg.configPath)
    .then(function (data) {
      configs.nyg = xtend(configs.nyg, data);
      return configs;
    })
    .catch(function (err) {
      'use strict';
      console.warn(chalk.bgYellow("WARN"), chalk.magenta("Could not open " + configs.nyg.configPath));
      console.warn(chalk.dim(err.message));
    })
}

function getPkgJson() {
  if (!hasPkgJson) return {};
  return loadJson(configs.pkg.configPath)
    .then(function (data) {
      configs.pkg = xtend(configs.pkg, data);
      return configs;
    })
    .catch(function (err) {
      'use strict';
      console.warn(chalk.bgYellow("WARN"), chalk.magenta("could not open " + configs.pkg.configPath));
      console.warn(chalk.dim(err.message));
    })
}

function getNpmConfig() {
  return npmConfLoad({})
    .then(function (config) {
      var data = {
        user: {
          name: config.get('init.author.name'),
          site: config.get('init.author.url') || '',
          email: config.get('init.author.email'),
          github: config.get('init.author.github'),
          username: config.get('username'),
        }
      };

      if (typeof argv.u === 'string') {
        data.org = {name: argv.u, github: argv.u};
        console.log(chalk.green('Creating module under organization ' + chalk.bold(data.org.name)))
      } else if (argv.u) {
        return done('--user specified, but without an organization!')
      }

      if (!data.user.name) return bail('npm config set init.author.name "Your Name"');
      if (!data.user.email) return bail('npm config set init.author.email "me@example.com"');
      if (!data.user.github) return bail('npm config set init.author.github "your-github-handle"');

      //default org to user
      if (!data.org) {
        data.org = {
          name: data.user.name,
          github: data.user.github
        }
      }

      if (!data.user.url) {
        data.user.url = 'https://github.com/' + data.user.github
      }

      configs.npm = xtend(configs.npm, data);

      return configs;
    })
    .catch(function (err) {
      'use strict';
      console.warn(chalk.bgYellow("WARN"), chalk.magenta("could not open npm config"));
      console.warn(chalk.dim(err.message));
    })
}

module.exports = function (opts) {
  if (opts.prompts) {
    modulePrompts = modulePrompts.concat(opts.prompts);
  }

  Promise.all([getNygConfig(), getPkgJson(), getNpmConfig()])
    .then(function (data) {
      if (configs.nyg.useDefaultDir) {
        modulePrompts[0].default = configs.nyg.defaultDir;
      } else if (!configs.nyg.useDefaultDir && hasPkgJson) {
        modulePrompts[0].default = process.cwd().replace(path.basename(process.cwd()), '');
      } else {
        modulePrompts[0].default = process.cwd();
      }
      startPrompts(configs, opts);
    })
};

function startPrompts(data, opts) {
  var extraGlobs = opts.globs;
  var cb = opts.callback;
  var isPostPublish = opts.isPostPublish;
  var globs;

  if (isPostPublish) {
    var currPath = process.cwd();
    globs = [
      {base: '../templates/', glob: '*'},
      {base: currPath, glob: '*', output: '/'}
    ];
    globs.forEach((g) => g.base = path.relative(__dirname, g.base));
  } else {
    globs = [
      {base: '../templates/', glob: '*'},
      {base: '../templates/test', glob: '*', output: '/test'}
    ];
  }

  if (extraGlobs) {
    // assign relative path to base
    extraGlobs.forEach((g) => g.base = path.relative(__dirname, g.base));
    globs = globs.concat(extraGlobs);
  }

  var gen = nyg(modulePrompts, globs)
    .on('postprompt', function () {
      var done = gen.async();

      if (isPostPublish) {
        gen.config.set('type', opts.type);
      }

      configs.outputDir = path.join(gen.config.get('location'), gen.config.get('name'));

      // check if directory exists
      fs.access(configs.outputDir, function (err) {
        if (!err) {
          var contents = fs.readdirSync(configs.outputDir);
          contents.forEach(function (item, index) {
            (item.indexOf('.') === 0) && contents.splice(index, 1);
          });
          if (contents.length) {
            console.warn(chalk.bgRed('ERROR:'), chalk.red(`Directory ${configs.outputDir} already exists and is not empty.`));
            gen.end();
          } else {
            gen.chdir(configs.outputDir);
            done();
          }

        } else {
          fs.mkdir(configs.outputDir, function () {
            console.log(chalk.bgYellow('CREATED DIRECTORY:'), chalk.yellow(configs.outputDir));
            gen.chdir(configs.outputDir);
            done();
          })
        }

        gen.config.set('name', dequote(gen.config.get('name')));
        gen.config.set('testDescription', escape(gen.config.get('description')).replace(/\\"+/g, '\"'));
        gen.config.set('description', dequote(gen.config.get('description')));
        gen.config.set('varName', varName(gen.config.get('name')));
        gen.config.set('tags', JSON.stringify(gen.config.get('tags').split(' ').map(function (str) {
          return dequote(str).trim();
        }).filter(Boolean), null, 2));
        gen.config.set('devDependencies', '{\n    "tape": "*"\n  }');
        gen.config.set('user', {
          "name": configs.npm.user.name,
          "email": configs.npm.user.email,
          "url": configs.npm.user.email
        });
        gen.config.set('org', configs.npm.org);
      });
    })
    .on('postinstall', function () {
      open(configs.outputDir);
      cb && cb(configs.outputDir);

      var cmd = 'ghrepo --color';
      var child = spawn(cmd, {cwd: configs.outputDir, stdio: 'inherit'});
      child.on('exit', function (err) {
        if (err === 0) {
          var location = gen.config.get('location');
          gen.prompt({
            type: "confirm",
            name: "doInstall",
            message: "Would you like to install this module in an existing project?",
            default: true
          }, function (data) {
            if (data.doInstall) {
              gen.prompt({
                'name': 'installLocation'
                , 'message': 'Where would you like to install it?'  //where would you like the module to live?
                , 'default': process.cwd()
              }, function (answers) {
                var cmd = 'npm install git+' + configs.npm.user.url + '/' + gen.config.get('name') + ' --save';
                var installProc = spawn(cmd, {cwd: answers.installLocation});
                installProc.on('exit', function (err) {
                  process.exit(0);
                });
                installProc.stdout.pipe(process.stdout);
                installProc.stderr.pipe(process.stderr);
                process.stdin.pipe(installProc.stdin);
              });
            } else {
              process.exit(0);
            }
          });

        } else {
          console.log('git command failed');
          process.exit(1)
        }
      });
    })
    .run();
}

function bail(cmd) {
  console.log('');
  console.log('Missing configuration option, please run the following using your own value:');
  console.log('');
  console.log('  > ' + cmd);
  console.log('');
}

function dequote(str) {
  return str.replace(/\"+/g, '\\"');
}