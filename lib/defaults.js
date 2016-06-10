'use strict';
var nyg = require('nyg');
console.log('poopy pants');

var prompts = [
  {
    'type': 'confirm',
    'name': 'useDefaultDir',
    'message': 'Would you like to specify a default directory for generated modules? You can override this later.',
    'default': true,
    'filter': function(input){
      if(input === 'y') return 'yes';
      if(input === 'n') return 'no';
    },
    'validate': function(input){
      input = input.toLowerCase();
      if(input !== 'y' || input !== 'yes') return false;
      if(input !== 'n' || input !== 'no') return false;
      return true
    }
  }
];

var gen = nyg(prompts,[])
  .on('postinstall',function() {
    /*var done = gen.async();
    if(gen.config.get('useDefaultDir')){
      gen.prompt({
        type: "input",
        name: "defaultDir",
        message: "What directory would you like your default modules directory to be?",
        default: process.cwd()
      },done);
    }else{
      gen.config.set('defaultDir',process.cwd());
      done();
    }*/

    /*gen.config.set('name', dequote(gen.config.get('name')));
    gen.config.set('testDescription', escape(gen.config.get('description')).replace(/\\"+/g, '\"'));
    gen.config.set('description', dequote(gen.config.get('description')));
    gen.config.set('varName', varName(gen.config.get('name')));
    gen.config.set('tags', JSON.stringify(gen.config.get('tags').split(' ').map(function(str) {
      return dequote(str).trim();
    }).filter(Boolean), null, 2));

    gen.config.set('devDependencies', '{\n    "tape": "*"\n  }');*/
  })
  .run();