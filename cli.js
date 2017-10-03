#!/usr/bin/env node
/**
 * css2less - entry point - command line interface
 *
 * Converter of pure CSS into the structured LESS keeping all the imports & comments
 * and optionally extracting all the colors into variables.
 * Original code by Serhey Shmyg, continued and extended by Martin Bórik.
 */

const appname = 'css2less';

const fs = require('fs');
const path = require('path');
const meow = require('meow');
const promisePipe = require("promisepipe");

const css2less = require('./index.js');
const utils = require('./utils.js');

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

const cwd = process.cwd();
const opt = Object.assign({ filePathway: [] }, cli.flags);

utils.processFiles(cli.input, file => {
	const filePath = path.resolve(cwd, file);

	try {
		if (!fs.statSync(filePath).isFile()) {
			throw new Error('ENOTFILE');
		}
	}
	catch (err) {
		return Promise.reject(
			new Error(`Invalid file: '${file}' (${err.message || err.code})`)
		);
	}

	const ext = path.extname(file);
	if (ext.toLowerCase() !== '.css') {
		return Promise.reject(
			new Error(`Invalid file: '${file}': Not a proper extension!`)
		);
	}

	const fileDir = path.dirname(filePath);
	const fileBaseName = path.basename(file, ext);
	const lessFile = path.join(fileDir, fileBaseName + '.less');

	opt.absFilePath = opt.absBasePath = utils.path2posix(path.resolve(fileDir));

	if (opt.variablesPath) {
		const varDir = path.dirname(opt.variablesPath);
		const varRelPath = path.relative(varDir, fileDir);

		if (varRelPath.length > 0) {
			opt.filePathway = varRelPath.split(path.sep);
		}

		opt.filePathway.push(fileBaseName);
		opt.absBasePath = utils.path2posix(path.resolve(varDir));
	}

	console.log(`Converting '${file}'...`);
	return promisePipe(
		fs.createReadStream(filePath),
		new css2less(opt),
		fs.createWriteStream(lessFile)
	).then(stream => {
		console.log(`> stored into '${lessFile}'.`);
	}, err => {
		console.error("> error: ", err.originalError);
		fs.unlinkSync(lessFile);
	});
});
