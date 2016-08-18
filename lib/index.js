var Promise = require('bluebird');
var semver = require('semver');
var conf = require('npmconf');
var npmConfLoad = Promise.promisify(conf.load);
var chalk = require('chalk');
var nyg = require('nyg');
var varName = require('variable-name');
var path = require('path');
var npm = require('npm');
var fs = require('fs.extra');
var xtend = require('xtend');
var loadJson = Promise.promisify(require('./loadJson'));
var spawn = require('npm-execspawn');
var execSync = require('child_process').execSync;
var open = require('opn');
var promptSync = require('prompt-sync')();
var args = require('args');
var flags;

args
  .option('name', 'Module name')
  .option('description', 'Module description')
  .option(['t', 'tags'], 'Module tags')
  .option('location', 'Where would you like to put the module')
  .option(['T', 'test'], 'generate index.js and test.js files')
  .option('user', 'an organization override for GitHub URLs')
  .option('stability', 'Module stability');

flags = args.parse(process.argv);

var target = process.cwd();
var hasPkgJson = false;

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

var promptName = {
  'name': 'location',
  'message': 'Where would you like to put the module?',
  'default': path.basename(target)
};
var promptLocation = {
  'name': 'name',
  'message': 'Module name:',
  'default': path.basename(target)
};

var modulePromptsInitial = [promptName, promptLocation];

var modulePromptOverwrite = [
  {
    'name': 'overwrite',
    'type': 'list',
    'message': 'Module directory exists. Overwrite?',
    'default': 'No',
    'choices': [
      'Yes',
      'No'
    ],
  }
];

var modulePromptConfirm = [{
  'name': 'confirm',
  'type': 'list',
  'message': 'Are you sure you want to overwrite this directory?',
  'default': 'No',
  'choices': [
    'Yes',
    'No'
  ]
}];

var promptDescription = {
  'name': 'description'
  , 'message': 'Module description:'
};
var promptTags = {
  'name': 'tags'
  , 'message': 'Module tags:'
};
var stabilityFlags = [
  'deprecated',
  'experimental',
  'unstable',
  'stable',
  'frozen',
  'locked'
]
var promptStability = {
  'name': 'stability',
  'type': 'list',
  'message': 'Module stability:',
  'default': 'experimental',
  'choices': stabilityFlags,
};

var modulePromptDetails = [promptDescription, promptTags, promptStability];

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
    });
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
    });
}

function setNpmConfig(data) {
  if (!data.name || data.name.length <= 0) {
    data.name = promptSync('please set your init.author.name: ');
    execSync('npm config set init.author.name ' + data.name);
  }
  if (!data.email || data.email.length <= 0) {
    data.email = promptSync('please set your init.author.email: ');
    execSync('npm config set init.author.email ' + data.email);
  }
  if (!data.github || data.github.length <= 0) {
    data.github = promptSync('please set your init.author.github handle: ');
    execSync('npm config set init.author.github ' + data.github);
  }
  if (!data.username || data.username.length <= 0) {
    data.github = promptSync('please set your init.author.username: ');
    execSync('npm config set init.author.username ' + data.username);
  }
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

      if (typeof flags.user === 'string') {
        data.org = {name: flags.user, github: flags.user};
        console.log(chalk.green('Creating module under organization ' + chalk.bold(data.org.name)))
      } else if (flags.user) {
        return done('--user specified, but without an organization!');
      }

      if (!data.user.name || !data.user.email || !data.user.github) {
        setNpmConfig(data.user);
      }

      //default org to user
      if (!data.org) {
        data.org = {
          name: data.user.name,
          github: data.user.github
        };
      }

      if (!data.user.url) {
        data.user.url = 'https://github.com/' + data.user.github;
      }

      configs.npm = xtend(configs.npm, data);

      return configs;
    })
    .catch(function (err) {
      'use strict';
      console.warn(chalk.bgYellow("WARN"), chalk.magenta("could not open npm config"));
      console.warn(chalk.dim(err.message));
    });
}

module.exports = function (opts) {
  Promise.all([getNygConfig(), getPkgJson(), getNpmConfig()])
    .then(function (data) {
      if (configs.nyg.useDefaultDir) {
        modulePromptsInitial[0].default = configs.nyg.defaultDir;
      } else if (!configs.nyg.useDefaultDir && hasPkgJson) {
        modulePromptsInitial[0].default = process.cwd().replace(path.basename(process.cwd()), '');
      } else {
        modulePromptsInitial[0].default = process.cwd();
      }
      startPrompts(configs, opts);
    });
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
    globs.forEach(function (g) {
      g.base = path.relative(__dirname, g.base)
    });
  } else {
    globs = [
      {base: '../templates/', glob: '*'},
      {base: '../templates/test', glob: '*', output: '/test'}
    ];
  }
  if (extraGlobs) {
    // assign relative path to base
    extraGlobs.forEach(function (g) {
      g.base = path.relative(__dirname, g.base)
    });
    globs = globs.concat(extraGlobs);
  }

  if (flags.location || flags.name) {
    if (!flags.location) modulePromptsInitial = [promptName];
    else if (!flags.name) modulePromptsInitial = [promptLocation];
    else modulePromptsInitial = [];
  }
  if (modulePromptsInitial.length > 0) {
    if (opts.prompts) modulePromptsInitial = modulePromptsInitial.concat(opts.prompts);
    nygAction(modulePromptsInitial, opts, globs, cb);
  }
  else {
    var prompts = [];
    if (opts.prompts) prompts = prompts.concat(opts.prompts);
    nygAction(prompts, opts, globs, cb);
  }
}

function setConfigFromFlags(gen) {
  if (flags.name || flags.description || flags.location || flags.tags || flags.stability) {
    if (flags.name) gen.config.set('name', flags.name);
    if (flags.description) gen.config.set('description', flags.description);
    if (flags.location) gen.config.set('location', flags.location);
    if (flags.tags) gen.config.set('tags', flags.tags);
    if (flags.stability) {
      if (stabilityFlags.indexOf(flags.stability) === -1) {
        console.warn(chalk.bgYellow('Stabilty flag must be one of ' + stabilityFlags));
        process.exit(1);
      }
      else gen.config.set('stability', flags.stability);
    }
  }
}

function nygAction(prompts, opts, globs, cb) {
  var isPostPublish = opts.isPostPublish;
  var gen = nyg(prompts, globs)
    .on('postprompt', function () {
      var done = gen.async();
      if (isPostPublish) {
        gen.config.set('type', opts.type);
        gen.config.set('rename', opts.rename);
      }
      setConfigFromFlags(gen);
      gen.config.set('isModule', true);
      configs.outputDir = path.join(gen.config.get('location'), gen.config.get('name'));
      // check if directory exists
      fs.access(configs.outputDir, function (err) {
        if (!err) {
          var contents = fs.readdirSync(configs.outputDir);
          var length = 0;

          contents.forEach(function (item, index) {
            (item.indexOf('.') !== 0 && item.indexOf('nyg-cfg') === -1) && length++;
          });

          if (length) {
            gen.prompt(modulePromptOverwrite,
              function () {
                if (gen.config.get('overwrite') === 'Yes') {
                  gen.prompt(modulePromptConfirm, function () {
                    if (gen.config.get('confirm') === 'Yes') {
                      console.log('Overwriting module directory');
                      fs.rmrfSync(configs.outputDir);
                      modulePromptDetails = setDetailPrompts();
                      makeModuleDirectory(gen, done);
                    }
                    else {
                      // todo rename module action
                      console.log('Exiting');
                      gen.end();
                    }
                  })

                }
                else {
                  // todo rename module action
                  console.log('Exiting');
                  gen.end();
                }
              });
          } else {
            modulePromptDetails = setDetailPrompts();
            gen.prompt(modulePromptDetails,
              function () {
                gen.chdir(configs.outputDir);
                setGenConfig(gen);
                done();
              });
          }
        } else {
          modulePromptDetails = setDetailPrompts();
          makeModuleDirectory(gen, done);
        }
      });
    })
    .on('postcopy', function () {
      if (isPostPublish) {
        opts.postCopyCallback && opts.postCopyCallback(opts.depsData.localImports, opts.depsData.localImportsDir, configs.outputDir);
      }
    })
    .on('postinstall', function () {
      if (isPostPublish) {
        opts.depsData && opts.depsData.modules.forEach(function (dep, i) {
          var cmd = 'npm i ' + dep + ' --save';
          var child = spawn(cmd, {cwd: configs.outputDir});
          child.on('exit', function (err) {
            (i == opts.depsData.modules.length - 1) && publishModule(gen, cb);
          });
        });
      } else {
        publishModule(gen, cb);
      }
    })
    .run();
}

function setGenConfig(gen) {
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
}

function makeModuleDirectory(gen, done) {
  fs.mkdirp(configs.outputDir, function (err) {
    if (err) {
      console.warn(chalk.bgRed('Failed to create directory'));
      done();
    }
    console.log(chalk.bgYellow('CREATED DIRECTORY:'), chalk.yellow(configs.outputDir));
    gen.prompt(modulePromptDetails,
      function () {
        gen.chdir(configs.outputDir);
        setGenConfig(gen);
        done();
      });
  });
}

function setDetailPrompts() {
  if (flags.description || flags.tags || flags.stability) {
    modulePromptDetails = [];
    if (!flags.description) modulePromptDetails.push(promptDescription);
    if (!flags.tags) modulePromptDetails.push(promptTags);
    if (!flags.stability) modulePromptDetails.push(promptStability);
    return modulePromptDetails;
  }
  else return modulePromptDetails;
}

function publishModule(gen, cb) {
  open(configs.outputDir);
  cb && cb(configs.outputDir);

  // publish GitHub repo
  var cmd = 'ghrepo --color';
  var child = spawn(cmd, {cwd: configs.outputDir, stdio: 'inherit'});
  child.on('exit', function (err) {
    if (err === 0) {
      // publish on npm
      gen.prompt({
        type: "confirm",
        name: "npmPublish",
        message: "Would you like to publish this module on npm?",
        default: false
      }, function (data) {
        data.npmPublish && spawn('npm publish', {cwd: configs.outputDir});
        //installModule(gen);

        process.exit(0);  // remove this if calling 'installModule' above
      });

    } else {
      console.log('git command failed');
      process.exit(1);
    }
  });
}

function installModule(gen) {
  var location = gen.config.get('location');
  gen.prompt({
    type: "confirm",
    name: "doInstall",
    message: "Would you like to install this module in an existing project?",
    default: true
  }, function (data) {
    if (data.doInstall) {
      gen.prompt({
        'name': 'installLocation',
        'message': 'Where would you like to install it?',
        'default': process.cwd()
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
}

function dequote(str) {
  return str.replace(/\"+/g, '\\"');
}