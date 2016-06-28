'use strict';

module.exports = function(prompts, globs, gen) {
	prompts = prompts || [];
	globs = globs || [];

	require('./lib/index')(prompts, globs, gen);
};
