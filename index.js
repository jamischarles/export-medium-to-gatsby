/**
 * Module dependencies.
 */
var meow = require('meow');

/**
 * Local libs
 */
var converter = require('./lib/converter.js');

var cli = meow(
  `
	Usage
	  $ medium2gatsby <src_file_or_folder>

	Options
	  --output, -o Destination folder for output files.
	  --help, -h Shows usage instructions

	Examples
	  $ medium2gatsby . -o posts

`,
  {
    flags: {
      output: {
        type: 'string',
        alias: 'o',
      },
    },
  },
);
/*
{
	input: ['unicorns'],
	flags: {rainbow: true},
	...
}
*/

// show help if no args passed
if (cli.input.length < 1) {
  cli.showHelp();
}

var srcPath = cli.input[0];
var destPath = cli.flags.output;
converter.convert(srcPath, destPath);
// foo(cli.input[0], cli.flags);
