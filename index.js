/**
 * css2less - main code of the converter implemented into transform stream
 *
 * Converter of pure CSS into the structured LESS keeping all the imports & comments
 * and optionally extracting all the colors into variables.
 * Original code by Serhey Shmyg, continued and extended by Martin Bórik.
 */

const _ = require('lodash');
const stream = require('stream');
const path = require('path');
const fs = require('fs');

const cssc = require('./csscolors.json');
const cssp = require('./cssprops.json');
const { stringSplitAndTrim, repeatReplaceUntil } = require('./utils');

//-----------------------------------------------------------------------------
class css2less extends stream.Transform {
	constructor (options) {
		options = _.defaults({}, options, {
			filePathway: [],
			encoding: 'utf8',
			vendorPrefixesList: ['moz', 'o', 'ms', 'webkit'],
			indentSymbol: '\t',
			indentSize: 1,
			selectorSeparator: ',\n',
			blockFromNewLine: false,
			blockSeparator: '\n',
			updateColors: true,
			vendorMixins: false,
			nameValueSeparator: ': '
		});

		super({ encoding: options.encoding });

		this.options = options;

		this.vendorPrefixesReg = new RegExp('^-(' + options.vendorPrefixesList.join('|') + ')-', 'gi');
		this.rgbaMatchReg = /(((0|\d{1,}px)\s+?){3})?rgba?\((\d{1,3},\s*?){2}\d{1,3}(,\s*?0?\.\d+?)?\)$/gi;

		this.css = '';
		this.tree = {};
		this.less = [];
		this.vars = {};
		this.vars_index = 0;
		this.vendorMixins = {};
		this.commentsMapper = [];
	}

	_transform (chunk, enc, done) {
		this.css += chunk.toString(this.options.encoding);
		done();
	}

	_flush (done) {
		this.generateTree();
		this.renderLess();
		this.finalize();

		done();
	}

//-----------------------------------------------------------------------------
	getIndent (size) {
		let result = '';
		let max = size || this.options.indentSize;

		for (let n = 0; n < max; n++) {
			result += this.options.indentSymbol;
		}

		return result;
	}

	convertIfVariable (value) {
		if (/(^@var)|(^\d+(\.\d+)?(%|p[ctx]|e[mx]|[cm]m|in)?$)/i.test(value)) {
			return value;
		}

		// find the named value or convert hex triplet e.g. #639 to full hex color...
		value = _.get(cssc, value.toLowerCase()) || value.replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, '#$1$1$2$2$3$3');

		let isColor = false;
		if (/^#[0-9a-f]{6}$/i.test(value)) {
			isColor = true;
			value = value.toLowerCase();
		}

		if (isColor || this.rgbaMatchReg.test(value) ||
			/^url\(([\"'])((?:\\\1|.)+?)\1\)$/i.test(value)) {

			if (!this.vars[value]) {
				this.vars[value] = '@var-' + this.options.filePathway.concat(this.vars_index).join('-');
				this.vars_index++;
			}

			return this.vars[value];
		}

		return value;
	}

	matchVariable (style) {
		let rules = stringSplitAndTrim(style, /\;(?!base64)/gi);
		let result = [];

		rules.forEach((rule, i) => {
			let [ key, value ] = stringSplitAndTrim(rule, /\:(?!image)/gi);
			if (!value) {
				return;
			}

			value = value.replace(this.rgbaMatchReg, match => this.convertIfVariable(match));
			let values = value.split(/\s+/gi).map(v => this.convertIfVariable(v));

			result.push((i ? '\n' : '') + key,
				this.options.nameValueSeparator,
				values.join(' ') + ';');
		}, this);

		return result.join('');
	}

	matchVendorPrefixMixin (style) {
		let normal_rules = {};
		let prefixed_rules = {};
		let rules = stringSplitAndTrim(style, /\;(?!base64)/gi);

		rules.forEach(rule => {
			let [ key, value ] = stringSplitAndTrim(rule, /\:(?!image)/gi);

			if (!value) {
				normal_rules[key] = '';
			}
			else if (this.vendorPrefixesReg.test(key)) {
				let rule_key = key.replace(this.vendorPrefixesReg, '');
				let newValue = value.replace(/\s+/gi, ' ').trim();

				if (prefixed_rules[rule_key] && prefixed_rules[rule_key] != newValue) {
					return style;
				}

				prefixed_rules[rule_key] = newValue;
			}
			else {
				normal_rules[key] = value;
			}
		}, this);

		_.forOwn(prefixed_rules, (value, k) => {
			let v = stringSplitAndTrim(value, /\s+/gi);

			if (!this.vendorMixins[k])
				this.vendorMixins[k] = v.length;

			if (normal_rules[k]) {
				delete normal_rules[k];

				let newKey = `.vp-${k}(${v.join(', ')})`;
				normal_rules[newKey] = '';
			}
		});

		let result = [];
		_.forOwn(normal_rules, (value, rule) => {
			if (value.trim()) {
				rule += this.options.nameValueSeparator + value + ';\n';
			}
			result.push(rule);
		});

		return result.join('');
	}

	addRule (tree, selectors, style) {
		if (!style) {
			return;
		}

		if (!(selectors && selectors.length)) {
			// test if it's not just comment in the rule...
			if (!/^\u2588.+\u2502$/.test(style)) {
				if (this.options.updateColors) {
					style = this.matchVariable(style);
				}
				if (this.options.vendorMixins) {
					style = this.matchVendorPrefixMixin(style);
				}
			}

			tree.style = (tree.style || '') + style;
		}
		else {
			let first = stringSplitAndTrim(selectors[0], /\s*[,]\s*/gi)
									.join(this.options.selectorSeparator);

			if (!tree.children) {
				tree.children = [];
			}

			let node = tree[first];
			if (!node) {
				node = tree[first] = {};
			}

			selectors.splice(0, 1);
			tree.children.push(node);
			this.addRule(node, selectors, style);
		}
	}

	generateTree () {
		const introCommentRegex = /\/\*(?:[^*]|[\r\n]|(?:\*+(?:[^*/]|[\r\n])))*\*+\/\s*/;

		const searchImportFn = (match, q, path) => {
			this.less.push(`@import "${path}";\n`);
			return '';
		};
		const commentKeeperFn = (flags, char, content) => {
			flags.done = true;

			const idx = this.commentsMapper.length || 1;
			const mark = `\u2588${idx}\u2502`;

			this.commentsMapper[idx] = content.trim();

			if (char === ';') {
				return mark + char;
			}

			return char + mark;
		};

		let temp = this.css.trim().replace(introCommentRegex, (match, index) => {
			if (index === 0) {
				this.introComment = match.trim();
				return '';
			}
			return match;
		});

		temp = stringSplitAndTrim(
			repeatReplaceUntil(temp,
				/([}{\u2502]|(?:\u2502?;))\s*\/\*((?:[^*]|[\r\n]|(\*+([^*/]|[\r\n])))*)\*+\/\s*/gi,
				commentKeeperFn
			), /\n/g)
			.join('')
			.replace(/@import\s+(?:url\()?([\"'])((?:\\\1|.)+?)\1[^;]*?;/gi, searchImportFn)
			.replace(/[^\{\}]+\{\s*\}/g, ' ');

		let styleDefs = [];
		let styles = stringSplitAndTrim(temp, /[\{\}]/g);

		styles.forEach((val, i) => {
			if (!(i & 1)) {
				styleDefs.push([val]);
			}
			else {
				styleDefs[styleDefs.length - 1].push(val);
			}
		});

		styleDefs.forEach(style => {
			let rule = style[0].replace(/\s*>\s*/gi, ' &>');
			let props = style[1];

			let rules = [ rule ];
			if (!~rule.indexOf(',')) {
				rules = stringSplitAndTrim(
					rule.replace(/:(?!:?\-)/gi, ' &:'), /\s+/gi)
						.map(it => it.replace(/&>/gi, '& > ')
				);
			}

			this.addRule(this.tree, rules, props);

		}, this);
	}

	buildMixinList (indent) {
		let less = [];

		_.forOwn(this.vendorMixins, (v, k) => {
			let args = [];

			for (let i = 0; i < v; i++) {
				args.push('@p' + i);
			}

			less.push(`.vp-${k}(${args.join(', ')})`);
			less.push(this.options.blockFromNewLine ? '\n' : ' ');

			less.push('{\n');
			this.options.vendorPrefixesList.forEach((vp, i) => {
				less.push(this.getIndent(indent + this.options.indentSize));
				less.push(`-${vp}-${k}${this.options.nameValueSeparator}${args.join(' ')};\n`);
			}, this);

			less.push(this.getIndent(indent + this.options.indentSize));
			less.push(`${k}${this.options.nameValueSeparator}${args.join(' ')};\n`);
			less.push('}\n');
		});

		if (less.length) {
			less.push('\n');
		}

		return less.join('');
	};

	renderLess (tree, indent) {
		indent = indent || 0;

		if (!tree) {
			let colorVariables = [];
			_.forOwn(this.vars, (v, k) => {
				colorVariables.push(`${v}${this.options.nameValueSeparator}${k};\n`);
			});

			if (this.options.variablesPath) {
				fs.appendFile(this.options.variablesPath, colorVariables.join('') + '\n', ()=>{});
				if (this.vars_index > 0) {
					this.less.unshift(`@import (reference) "${path.basename(this.options.variablesPath)}";\n\n`);
					this.less.push('\n');
				}
			}
			else {
				this.less.push.apply(this.less, colorVariables);
				if (this.vars_index > 0) {
					this.less.push('\n');
				}
			}

			if (this.introComment) {
				this.less.unshift(this.introComment + '\n\n');
			}
			if (this.options.vendorMixins) {
				this.less.push(this.buildMixinList(indent));
			}

			tree = this.tree;
		}

		let index = 0;

		for (let i in tree) {
			if (i == 'children') {
				continue;
			}

			let element = tree[i];
			let children = element.children;

			if (i == 'style') {
				let rules = stringSplitAndTrim(element, /\;(?!base64)/gi);
				this.less.push(rules.join(';\n') + '\n');
			}
			else {
				if (index > 0) {
					this.less.push(this.options.blockSeparator);
				}

				if (indent > 0) {
					this.less.push(this.getIndent(indent));
				}
				this.less.push(i);

				if (this.options.blockFromNewLine) {
					this.less.push('\n' + this.getIndent(indent));
				}
				else {
					this.less.push(' ');
				}

				this.less.push('{\n');

				if (element.style) {
					let style = element.style;
					delete element.style;

					let ind = this.getIndent(indent + this.options.indentSize);

					// test if it's just comment in the rule...
					if (/^\u2588.+\u2502$/.test(style)) {
						this.less.push(ind + style);
					}
					else {
						this.less.push(stringSplitAndTrim(style, /\;(?!base64)/gi)
										.map(it => `${ind}${it};`)
										.join('\n') + '\n');
					}

					if (children && children.length) {
						this.less.push(this.options.blockSeparator);
					}
				}

				this.renderLess(element, indent + this.options.indentSize);

				if (indent > 0) {
					this.less.push(this.getIndent(indent));
				}
				this.less.push('}\n');

				index++;
			}
		}
	}

	finalize () {
		let output = this.less.join('');

		if (this.commentsMapper.length > 0) {
			output = repeatReplaceUntil(output,
				/(^[\t ]+)?\u2588(\d+)\u2502((?!\u2588);?)/gm,
				(flags, indent, id, suffix, pos, haystack) => {
					flags.done = true;

					indent = indent || '';

					let comment = this.commentsMapper[+id];
					let commentedPropertyIndent = '';

					// commented css property
					if (cssp.some(rule => comment.indexOf(rule) === 0)) {
						commentedPropertyIndent = indent;
						for (let i = pos - 1; i > 0; --i) {
							if (~'\n\r'.indexOf(haystack[i])) {
								commentedPropertyIndent = haystack.substr(++i, 80).match(/^\s*/)[0];
								break;
							}
						}
					}
					// multiline comment
					else if (~comment.indexOf('\n')) {
						comment = comment.replace(/\n/g, `\n${indent}`)
								.replace(/^(\*\s+)/, `\n${indent} $1`) + '\n';
					}

					comment = `/* ${comment.replace(/^\*\s+/, '')} */`;
					if (suffix === ';') {
						if (commentedPropertyIndent) {
							comment = `;\n${commentedPropertyIndent}${comment}`;
							indent = '';
						}
						else {
							comment = '; ' + comment;
						}
					}
					else {
						comment += `\n${indent}`;
					}

					return indent + comment;
				}
			);
		}

		this.push(output);
	}
};
//-----------------------------------------------------------------------------
module.exports = css2less;
