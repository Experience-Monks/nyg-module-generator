'use strict';

module.exports = function(prompts, globs) {
	prompts = prompts || [];
	globs = globs || [];

	require('./lib/index')(prompts, globs);
};
