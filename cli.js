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
		--indentSize         Indent size (default 1)
		--indentSymbol       Indentation symbol (default: tab character)
		--selectorSeparator  String separator between selectors (default: comma and newline)
		--blockSeparator     Separator between blocks (default: newline character)
		--blockFromNewLine   Start first '{' from the newline after selector.
		--updateColors       Create variables for colors.
		--vendorMixins       Create function for vendor styles.

		-h, --help           Show help
		-v, --version        Version number
`, {
	string:  [ 'indentSymbol', 'selectorSeparator', 'blockSeparator' ],
	boolean: [ 'updateColors', 'vendorMixins' ],
	default: {
		updateColors: true,
		vendorMixins: false
	},
	stopEarly: true,
	alias: {
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

	// linton specific path rule
	let lintonCssPathRule = fileDir.indexOf('linton' + path.sep + 'css');
	if (~lintonCssPathRule)
		fileDir = fileDir.substr(lintonCssPathRule + 11);

	cli.flags.filePathway = fileDir.split(path.sep).concat(fileBaseName);

	fs.createReadStream(filePath)
		.pipe(new css2less(cli.flags))
		.pipe(fs.createWriteStream(lessFile));
});
