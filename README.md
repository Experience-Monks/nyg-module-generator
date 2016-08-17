# nyg-module-generator

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

A module generator script. If the current directory has a “package.json” file, the module will be created outside the current directory and a symlink will be created from the current directories “node_modules” folder to the generated module.

## Usage

[![NPM](https://nodei.co/npm/nyg-module-generator.png)](https://www.npmjs.com/package/nyg-module-generator)

## Arguments
You can pass in command line arguments to skip some or all of the prompts
```shell
 Usage: nyg [options] [command]
  
  Commands:
  
    help  Display help
  
  Options:
  
    -d, --description  Module description
    -h, --help         Output usage information
    -l, --location     Where would you like to put the module
    -n, --name         Module name
    -s, --stability    Module stability
    -t, --tags         Module tags
    -T, --test         generate index.js and test.js files
    -u, --user         an organization override for GitHub URLs
    -v, --version      Output the version number
```
## License

MIT, see [LICENSE.md](http://github.com/JAM3/nyg-module-generator/blob/master/LICENSE.md) for details.
