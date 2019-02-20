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
      --output, -o Destination folder for output files. Defaults to './'.
      --template, -t Template used to generate post files. Defaults to 'medium-to-gatsby/templates/default.js'.
	  --help, -h Shows usage instructions

	Examples
	  $ medium2gatsby . -o posts
      $ medium2gatsby 2018-04-02_Introducing-the-react-testing-library----e3a274307e65.html -o output -t template.js

`,
  {
    flags: {
      output: {
        type: 'string',
        alias: 'o',
      },
      template: {
        type: 'string',
        alias: 't',
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
var templatePath = cli.flags.template;
converter.convert(srcPath, destPath, templatePath);
// foo(cli.input[0], cli.flags);
