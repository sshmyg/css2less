# CSS to LESS
Convert css to less

```shell
npm install -g css2less
```

## Usage:
>+ `$ css2less [options] <input.css...>`

### CLI Options ###
#### --indentSize
Type: `number`
Default value: `1`
Desc: Indent size.

#### --indentSymbol
Type: `string`
Default value: `\t`
Desc: Indent symbol.

#### --selectorSeparator
Type: `string`
Default value: `,\n`
Desc: Selector separator.

#### --blockSeparator
Type: `string`
Default value: `\n`
Desc: Separator between blocks.

#### --blockFromNewLine
Type: `boolean`
Default value: `false`
Desc: Start first '{' from the new line

#### --updateColors
Type: `boolean`
Default value: `true`
Desc: Use variables for colors.

#### --vendorMixins
Type: `boolean`
Default value: `true`
Desc: Create function for vendor styles.

## Pure JavaScript usage example:
```javascript
var css2less = require('css2less');
var lessResult = css2less(inputCSSInString, options);
```
