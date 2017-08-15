#!/usr/bin/env node
'use strict';

const appname = 'css2less';

const fs = require('fs');
const path = require('path');
const meow = require('meow');
const css2less = require('./index.js');

let cli = meow(`
	Usage:
		$ ${appname} [options] <input.css...>

	Options:
		--indent-size           Indent size (default 1)
		--indent-symbol         Indentation symbol (default: tab character)
		--selector-separator    String separator between selectors (default: comma and newline)
		--block-separator       Separator between blocks (default: newline character)
		--block-on-newline      Start first '{' from the newline after selector.
		--update-colors         Create variables for colors.
		--vendor-mixins         Create function for vendor styles.
		-var, --variables-path  Path to 'variables.less' file where will be all colors stored.
							    Defaultly was colors stored on the top of each file, but with
							    this given path will be generated with name prepended by
							    relative path where 'variables.less' was stored.

		-h, --help              Show help
		-v, --version           Version number
`, {
	string:  [ 'variables-path', 'indent-symbol', 'selector-separator', 'block-separator' ],
	boolean: [ 'update-colors', 'vendor-mixins' ],
	default: {
		updateColors: true,
		vendorMixins: false
	},
	stopEarly: true,
	alias: {
		var: 'variables-path',
		h: 'help',
		v: 'version'
	}
});

if (!cli.input.length)
	cli.showHelp();

cli.input.forEach(function (file) {
	let cwd = process.cwd();
	let filePath = path.resolve(cwd, file);

	try {
		if (!fs.statSync(filePath).isFile()) {
			throw new Error("ENOTFILE");
		}
	}
	catch (err) {
		console.error('Invalid file: "%s" (%s)', filePath,
			(err.code || err.message || err));
		return;
	}

	let ext = path.extname(file);
	if (ext.toLowerCase() !== '.css') {
		console.warn("%s hasn't proper extension, you've been warned!", file);
		return;
	}

	let fileDir = path.dirname(filePath);
	let fileBaseName = path.basename(file, ext);
	let lessFile = path.join(fileDir, fileBaseName + '.less');

	if (cli.flags.variablesPath) {
		let varDir = path.dirname(cli.flags.variablesPath);
		let varRelPath = path.relative(varDir, fileDir);

		cli.flags.filePathway = [];
		if (varRelPath.length > 0) {
			cli.flags.filePathway = varRelPath.split(path.sep);
		}
		cli.flags.filePathway.push(fileBaseName);
	}

	fs.createReadStream(filePath)
		.pipe(new css2less(cli.flags))
		.pipe(fs.createWriteStream(lessFile));
});
