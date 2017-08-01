'use strict';

const _ = require('lodash');
const cssc = require('./csscolors.json');
const stream = require('stream');

const stringSplitAndTrim = (str, del) => _.compact(str.split(del).map((item) => item.trim()));

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

		options.vendorPrefixesReg = new RegExp('^-(' + options.vendorPrefixesList.join('|') + ')-', 'gi');
		this.options = options;

		this.css = '';
		this.tree = {};
		this.less = [];
		this.colors = {};
		this.colors_index = 0;
		this.vendorMixins = {};
	}

	_transform (chunk, enc, done) {
		this.css += chunk.toString(this.options.encoding);
		done();
	}

	_flush (done) {
		this.generateTree();
		this.renderLess();

		this.push(this.less.join(''));
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

	convertIfColor (value) {
		if (cssc.indexOf(value) >= 0 ||
			/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/gi.test(value) ||
			/(rgba?)\(.*\)/gi.test(value)) {

			if (!this.colors[value]) {
				this.colors[value] = '@cl-' + this.options.filePathway.concat(this.colors_index).join('-');
				this.colors_index++;
			}

			return this.colors[value];
		}

		return value;
	}

	matchColor (style) {
		let rules = stringSplitAndTrim(style, /\;(?!base64)/gi);
		let result = [];

		rules.forEach(function (rule, i) {
			let [ key, value ] = stringSplitAndTrim(rule, /\:(?!image)/gi);
			if (!value) {
				return;
			}

			let values = value.split(/\s+/gi)
				.map((v) => this.convertIfColor(v));

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

		rules.forEach(function (rule) {
			let [ key, value ] = stringSplitAndTrim(rule, /\:(?!image)/gi);

			if (!value) {
				normal_rules[key] = '';
			}
			else if (this.options.vendorPrefixesReg.test(key)) {
				let rule_key = key.replace(this.options.vendorPrefixesReg, '');
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

		_.forOwn(prefixed_rules, (function (value, k) {
			let v = stringSplitAndTrim(value, /\s+/gi);

			if (!this.vendorMixins[k])
				this.vendorMixins[k] = v.length;

			if (normal_rules[k]) {
				delete normal_rules[k];

				let newKey = '.vp-' + k + '(' + v.join(', ') + ')';
				normal_rules[newKey] = '';
			}
		}).bind(this));

		let result = [];
		_.forOwn(normal_rules, (function (value, rule) {
			if (value.trim()) {
				rule += this.options.nameValueSeparator + value + ';\n';
			}
			result.push(rule);
		}).bind(this));

		return result.join('');
	}

	addRule (tree, selectors, style) {
		if (!style) {
			return;
		}

		if (!selectors || !selectors.length) {
			if (this.options.updateColors) {
				style = this.matchColor(style);
			}
			if (this.options.vendorMixins) {
				style = this.matchVendorPrefixMixin(style);
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
		let temp = stringSplitAndTrim(this.css, /\n/g)
					.join('')
					.replace(/\/\*+[^\*]*\*+\//g, '')
					.replace(/[^\{\}]+\{\s*\}/g, ' ');

		let styles = stringSplitAndTrim(temp, /[\{\}]/g);
		let styleDefs = [];

		styles.forEach(function (val, i) {
			if (!(i & 1)) {
				styleDefs.push([val]);
			}
			else {
				styleDefs[styleDefs.length - 1].push(val);
			}
		});

		styleDefs.forEach(function (style) {
			let rule = style[0].replace(/\s*>\s*/gi, ' &>');

			if (~rule.indexOf('@import')) {
				let import_rule = rule.match(/@import.*;/gi)[0];
				rule = rule.replace(/@import.*;/gi, '');
				this.addRule(this.tree, [], import_rule);
			}

			if (~rule.indexOf(',')) {
				this.addRule(this.tree, [rule], style[1]);
			}
			else {
				let rules_split = stringSplitAndTrim(rule.replace(/[:]/gi, ' &:'), /\s+/gi).map(function (it) {
					return it.replace(/[&][>]/gi, '& > ');
				});

				this.addRule(this.tree, rules_split, style[1]);
			}
		}, this);
	}

	buildMixinList (indent) {
		let less = [];

		_.forOwn(this.vendorMixins, (function (v, k) {
			let args = [];

			for (let i = 0; i < v; i++) {
				args.push('@p' + i);
			}

			less.push('.vp-', k, '(', args.join(', '), ')');
			less.push(this.options.blockFromNewLine ? '\n' : ' ');

			less.push('{\n');
			this.options.vendorPrefixesList.forEach(function (vp, i) {
				less.push(this.getIndent(indent + this.options.indentSize));
				less.push('-', vp, '-', k, this.options.nameValueSeparator, args.join(' '), ';\n');
			}, this);

			less.push(this.getIndent(indent + this.options.indentSize), k, this.options.nameValueSeparator, args.join(' '), ';\n');
			less.push('}\n');
		}).bind(this));

		if (less.length) {
			less.push('\n');
		}

		return less.join('');
	};

	renderLess (tree, indent) {
		indent = indent || 0;

		if (!tree) {
			_.forOwn(this.colors, (function (v, k) {
				this.less.push(v, this.options.nameValueSeparator, k, ';\n');
			}).bind(this));

			if (this.colors_index > 0) {
				this.less.push('\n');
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
				this.less.push(rules.join(';\n'), '\n');
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

				let style = element.style;
				delete element.style;

				if (style) {
					let temp = stringSplitAndTrim(style, /\;(?!base64)/gi);
					let indented = temp.map(it => this.getIndent(indent + this.options.indentSize) + it + ';').join('\n');

					this.less.push(indented, '\n');

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
};
//-----------------------------------------------------------------------------
module.exports = css2less;
