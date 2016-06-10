'use strict';
var nyg = require('nyg');
console.log('poopy pants');

var prompts = [
  {
    'name': 'moduledir'
    , 'message': 'Modules default directory'
    , 'default': process.cwd()
  }
];

var gen = nyg(prompts,globs)
  .on('postprompt',function() {
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