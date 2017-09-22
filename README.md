# CSS to LESS
Convert css to less

```shell
npm install -g css2less
```

## Usage:
>+ `$ css2less [options] <input.css...>`

### CLI Options ###
#### --indent-size
Type: `number`
Default value: `1`
Desc: Indent size.

#### --indent-symbol
Type: `string`
Default value: `\t`
Desc: Indent symbol.

#### --selector-separator
Type: `string`
Default value: `,\n`
Desc: Selector separator.

#### --block-separator
Type: `string`
Default value: `\n`
Desc: Separator between blocks.

#### --block-on-newline
Type: `boolean`
Default value: `false`
Desc: Start first '{' from the new line

#### --update-colors
Type: `boolean`
Default value: `true`
Desc: Use variables for colors.

#### --vendor-mixins
Type: `boolean`
Default value: `true`
Desc: Create function for vendor styles.

#### --variables-path
Type: `string`
Desc: Path to 'variables.less' file where will be all colors stored.
      Defaultly was colors stored on the top of each file, but with this given path will be generated with name prepended by relative path where 'variables.less' was stored.

## Pure JavaScript usage example:
```javascript
var fs = require('fs');
var css2less = require('css2less');

fs.createReadStream(cssFilePath)
	.pipe(new css2less(options))
	.pipe(fs.createWriteStream(lessFilePath));
```
