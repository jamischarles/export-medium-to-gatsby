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
      --template, -t Template used to generate post files.
      --drafts, -d set flag to export drafts along with other posts. Default, false.
	  --help, -h Shows usage instructions

	Examples
	  $ medium2gatsby . -o posts -t template.js
      $ medium2gatsby 2018-04-02_Introducing-the-react-testing-library----e3a274307e65.html -o output -t template.js

`,
  {
    flags: {
      drafts: {
        type: 'boolean',
        alias: 'd',
        default: false
      },
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
var export_drafts = cli.flags.drafts;
converter.convert(srcPath, destPath, templatePath, export_drafts);
// foo(cli.input[0], cli.flags);
