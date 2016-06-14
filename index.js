console.log('I am nyg-module-generator-b');
var Promise = require('bluebird');
var semver = require('semver');
var npmConfLoad = Promise.promisify(require('npmconf').load);
var chalk = require('chalk');
var nyg = require('nyg');
var varName = require('variable-name');
var path = require('path');
var npm = require('npm');
var fs = require('fs');
var xtend = require('xtend');
var loadJson = Promise.promisify(require('./lib/loadJson'));

var argv = require('yargs')
  .alias('t', 'test')
  .alias('u', 'user')
  .describe('t', 'generate index.js and test.js files')
  .describe('u', 'an organization override for GitHub URLs')
  .argv;

var TEST_RUNNER = 'tape';
var target = process.cwd();

var usePkgJson = false;
var useNygConf = false;

var hasPkgJson = false;
var hasNygConf = false;

/*function getPackage(cb) {
  console.log('getPackage');
  return loadJson(function(err, data){
    'use strict';
    if(err){
      console.warn(chalk.bgYellow("WARN"), chalk.magenta("could not open package.json"));
      hasPkgJson = false;
      if(cb)  cb("could not open package.json", null);
      return {};
    }
    if(data){
      console.log('package.json: ',data);
      hasPkgJson = true;
      if(cb)  cb(null, data);
      return data;
    }
  });
}*/

var configs = {
  nyg: {
    configPath: path.join(__dirname, 'nyg-cfg.json')
  },
  pkg: {
    configPath: process.cwd()+'/package.json'
  },
  npm: {
  },
  git: {

  }
};

function getNygConfig() {
  return loadJson(configs.nyg.configPath)
    .then(function(data) {
      configs.nyg = xtend(configs.nyg, data);
      return configs;
    })
    .catch(function(err){
      'use strict';
      console.warn(chalk.bgYellow("WARN"), chalk.magenta("could not open "+configs.nyg.configPath));
      console.warn(chalk.dim(err.message));
    })
}

function getPkgJson() {
  return loadJson(configs.pkg.configPath)
    .then(function(data) {
      configs.pkg = xtend(configs.pkg, data);
      return configs;
    })
    .catch(function(err){
      'use strict';
      console.warn(chalk.bgYellow("WARN"), chalk.magenta("could not open "+configs.pkg.configPath));
      console.warn(chalk.dim(err.message));
    })
}

function getNpmConfig() {
  return npmConfLoad({})
    .then(function(data) {
      configs.npm = xtend(configs.npm, data);
      return configs;
    })
  .catch(function(err){
    'use strict';
    console.warn(chalk.bgYellow("WARN"), chalk.magenta("could not open npm config"));
    console.warn(chalk.dim(err.message));
  })
}

getNygConfig()
  .then(getPkgJson)
  .then(getNpmConfig)
  .then(function(data){
    'use strict';
    console.log('done, configs: ',data);
  });


return;

function getNygConfigb(cb) {
  console.log('getNygConfig');
  var nygConfigPath = path.join(__dirname, 'nyg-cfg.json');
  return loadJson(nygConfigPath, function(err, data){
    'use strict';
    if(err){
      console.warn(chalk.bgYellow("WARN"), chalk.magenta("could not open package.json"))
      hasNygConf = false;
      useNygConf = false;
      if(cb)  cb("could not open nyg-conf.json", null);
      return {};
    }
    if(data){
      console.log('nyg-conf: ',data);
      hasNygConf = true;
      useNygConf = true;
      if(cb)  cb(null, data);
      return data;
    }
  });
}

var nygConf = getNygConfig();
console.log('nygConf: ',nygConf);

function getParams(done) {
  console.log('getParams()');
  conf.load({}, function(err, config) {
    if (err) return done(err);
    console.log('conf: ',conf);
    var data = {
      user: {
        name: config.get('init.author.name')
        , site: config.get('init.author.url')||''
        , email: config.get('init.author.email')
        , github: config.get('init.author.github')
        , username: config.get('username')
      }
    };

    if (typeof argv.u === 'string') {
      data.org = { name: argv.u, github: argv.u };
      console.log(chalk.green('Creating module under organization '+chalk.bold(data.org.name)))
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
      data.user.url = 'https://github.com/'+data.user.github
    }

    var prompts = [
      {
        'name': 'name'
        , 'message': 'Module name'
        , 'default': path.basename(target)
      },
      {
        'name': 'description'
        , 'message': 'Module description'
      },
      {
        'name': 'tags'
        , 'message': 'Module tags:'
      },
      {
        'name': 'stability'
        , 'type': 'list'
        , 'message': 'Module stability:'
        , 'default': 'experimental'
        , 'choices': [
        'deprecated'
        , 'experimental'
        , 'unstable'
        , 'stable'
        , 'frozen'
        , 'locked'
      ]
      }
    ];

    var globs = [{ base: 'templates/', glob: '*' }];

    var gen = nyg(prompts,globs)
      .on('postprompt',function() {
        gen.config.set('name', dequote(gen.config.get('name')));
        gen.config.set('testDescription', escape(gen.config.get('description')).replace(/\\"+/g, '\"'));
        gen.config.set('description', dequote(gen.config.get('description')));
        gen.config.set('varName', varName(gen.config.get('name')));
        gen.config.set('tags', JSON.stringify(gen.config.get('tags').split(' ').map(function(str) {
          return dequote(str).trim();
        }).filter(Boolean), null, 2));

        gen.config.set('devDependencies', '{\n    "tape": "*"\n  }');
      })
      .run();

  })
}

getParams(function(err, params) {
  console.log('getParams()')
  if (err) throw err;
  console.log('params: ',params);

  // readdirp({
  //   root: path.join(__dirname, 'templates')
  // }).on('data', function(file) {
  //   var dest = path.resolve(target, file.path)
  //
  //   if (!argv.t) {
  //     if (file.path === 'index.js' || file.path === '_test.js')
  //       return
  //   }
  //
  //   if (fs.existsSync(dest)) {
  //     return console.log('ignoring: ' + file.path)
  //   }
  //
  //   fs.readFile(file.fullPath, 'utf8', function(err, content) {
  //     if (err) throw err
  //
  //     content = render(content, params)
  //
  //     if (file.name.match(/\.json$/g)) {
  //       content = JSON.stringify(JSON.parse(content), null, 2)
  //     }
  //
  //     if (file.name.match(/\_\.gitignore$/g))
  //       dest = dest.replace('_.gitignore', '.gitignore')
  //     else if (file.name.match(/\_\.npmignore$/g))
  //       dest = dest.replace('_.npmignore', '.npmignore')
  //     else if (file.name === '_test.js')
  //       dest = dest.replace('_test.js', 'test.js')
  //
  //     fs.writeFile(dest, content)
  //   })
  // })
});

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