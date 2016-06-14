'use strict';
var nyg = require('nyg');

var prompts = [
  {
    'type': 'confirm',
    'name': 'useDefaultDir',
    'message': 'Would you like a default directory for modules? You can override this later.',
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
  .on('postprompt',function() {
    var done = gen.async();
    console.log('useDefaultDir: ',gen.config.get('useDefaultDir'));
    if(gen.config.get('useDefaultDir')){
      gen.prompt({
        type: "input",
        name: "defaultDir",
        message: "What would you like your default directory to be?",
        default: process.cwd()
      },done);
    }else{
      gen.config.set('defaultDir',process.cwd());
      done();
      gen.end();
    }
  })
  .on('postcopy', function(){
    gen.end();
  })
  .run();
