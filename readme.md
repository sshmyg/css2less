#CSS to LESS
Convert css to less

```shell
npm install css2less --save-dev
```

###Options:
#### options.indentSize
Type: `Number`  
Default value: `1`  
Desc: Indent size.

#### options.vendorPrefixesList
Type: `Array`  
Default value: `["-moz", "-o", "-ms", "-webkit"]`  
Desc: List of vendor prefixes.

#### options.indentSymbol
Type: `String`  
Default value: `\t`  
Desc: Indent symbol.

#### options.selectorSeparator
Type: `String`  
Default value: `,\n`  
Desc: Selector separator.

#### options.blockFromNewLine
Type: `Bolean`  
Default value: `false`  
Desc: Start first '{' from the new line

#### options.blockSeparator
Type: `String`  
Default value: `\n`  
Desc: Separator between blocks.

#### options.updateColors
Type: `Bolean`  
Default value: `false`  
Desc: Use variables for colors.

#### options.vendorMixins
Type: `Boolean`  
Default value: `true`  
Desc: Create function for vendor styles.

##Example
```javascript
var css2less = require('css2less'),
	cssString = 'a {color:green; text-decoration:none; } a:hover {color:lime; } a:active {text-decoration:underline; }',
	options = {},
	result;

result = css2less(cssString, options);
console.log(result);
```

<!-- Author [css2less](http://www.miyconst.com/Blog/View/14/conver-css-to-less-with-css2less-js) -->