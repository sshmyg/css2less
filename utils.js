/**
 * css2less - some handy utilities
 *
 * Converter of pure CSS into the structured LESS keeping all the imports & comments
 * and optionally extracting all the colors into variables.
 * Original code by Serhey Shmyg, continued and extended by Martin Bórik.
 */

const _ = require('lodash');

module.exports = {
	'stringSplitAndTrim': (str, del) => _.compact(
		str.split(del).map((item) => item.trim())
	),

	'repeatReplaceUntil': (haystack, needle, callback) => {
		let flags = {};
		do {
			flags.done = false;
			haystack = haystack.replace(needle,
				(m, ...found) => callback.apply(null, found.unshift(flags) && found)
			);
		} while (flags.done);

		return haystack;
	},

	'processFiles': (files, callback) => files.reduce((promise, file) => {
		return promise.then(() => callback(file));
	}, Promise.resolve()),

	'path2posix': (str) => str.replace(/\\/g, '/')
};
