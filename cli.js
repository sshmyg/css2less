#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var url = require('url');

var existsSync = fs.existsSync || path.existsSync;

var css2less;
try {
    css2less = require('css2less');
} catch(err) {
    css2less = require('./index');
}

var html2jade;
try {
    html2jade = require('html2jade');
} catch(err) {
    html2jade = require('./lib/html2jade');
}

function parsePath(arg) {
  if (typeof arg !== 'string') {
    console.error('invalid input: ' + arg);
  } else if (path.resolve('/',arg) === arg) {
    // already absolute path
    return arg;
  } else if (arg.length >= 2 && arg.substring(0, 2) === '~/') {
    // home path
    return path.join(process.env['HOME'], arg.substring(2));
  } else {
    // relative to current path
    return path.join(process.cwd(), arg);
  }
}

function convert(input, output, options) {
  if (input) {
    try {
      if(options.inputType === "file")
          input = fs.readFileSync(arg, "utf8");
      var result = css2less(input, options);
      if (!result) {
        console.error('parser errors: ' + errors);
      }
      output.write(result);
    } catch (err) {
      console.error(err);
      throw err;
    }
  } else {
    console.error('invalid input: ' + input);
  }
}

var program = require('commander');
var version = require('./package').version;

program
  .version(version)

program.parse(process.argv);

// if outdir is provided, check existance (sorry no mkdir support yet)
if (program.outdir && !existsSync(program.outdir)) {
  console.error("output directory '" + program.outdir + "' doesn't exist");
  process.exit(1);
}

// process each arguments
var args = program.args;
if (!args || args.length === 0) {
  args = ['-'];
  // console.error("input argument(s) missing");
  // process.exit(1);
}

for (var i = 0; i < args.length; i++) {
  var arg = args[i], inputUrl, inputPath;

  // handle stdin to stdout
  if (arg === '-') {
    var input = '';
    process.stdin.resume();
    process.stdin.on('data', function (chunk){
      input += chunk;
    });
    process.stdin.on('end', function (){
      program.inputType = "css";
      convert(input, undefined, program);
    });
    continue;
  }

  if (typeof arg === 'string' && !existsSync(arg)) {
    try { inputUrl = url.parse(arg); } catch (err) {}
  }
  if (inputUrl && inputUrl.protocol) {
    // URL input, use stdout
    program.inputType = "url";
    convert(arg, undefined, program);
  } else {
    // path or glob
    inputPath = parsePath(arg);
    if (existsSync(inputPath)) {
      var inputStats = fs.statSync(inputPath);
      if (inputStats.isFile()) {
        var outdir = program.outdir || path.dirname(arg);
        var outputPath = path.join(outdir, path.basename(inputPath, path.extname(inputPath)) + '.less');
        // console.log("converting '" + arg + "' to '" + outputPath + "'");
        var outputStream = fs.createWriteStream(outputPath, {
          flags: 'w',
          encoding: 'utf8',
        });
        program.inputType = "file";
        convert(inputPath, new html2jade.StreamOutput(outputStream), program);
      }
    } else {
      console.error("input file doesn't exist: " + arg);
    }
  }
}
