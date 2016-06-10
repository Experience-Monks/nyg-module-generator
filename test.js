var nygModuleGenerator = require('./')
var test = require('tape')

test('A module generator script. If the current directory has a “package.json” file, the module will be created outside the current directory and a symlink will be created from the current directories “node_modules” folder to the generated module.', function(t) {
  
  t.end()
})