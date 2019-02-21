# medium-to-gatsby

 A CLI to convert your medium exported .html files to gatsby .md files.

## Installation 
`$ npm install -g https://github.com/jamischarles/export-medium-to-gatsby` (maybe it'll go on npm eventually)


## Usage 
```
 Usage
    $ medium2gatsby <src_file_or_folder>

  Options
   --output, -o Destination folder for output files. Defaults to './'.
   --template, -t Template used to generate post files. Defaults to 'medium-to-gatsby/templates/default.js'.
   --help, -h Shows usage instructions

  Examples
    $ medium2gatsby . -o posts
    $ medium2gatsby 2018-04-02_Introducing-the-react-testing-library----e3a274307e65.html -o output -t template.js
```

## Features
- Customize output via templates
- Handles embedded tweets
- Inlines github gists 


## Customize via templates
Based on which gatsby theme you're using you may need to generate differen
frontmatter fields.

Here is an example `template.js` you can pass to the CLI via the `-t` flag.

```js
module.exports = {
  render: function(data) {
    var date = new Date(data.published);

    // 2018-04-16
    var prettyDate =
      date.getFullYear() +
      '-' +
      (date.getMonth() + 1).toString().padStart(2, 0) +
      '-' +
      date
        .getDate()
        .toString()
        .padStart(2, 0);

    var template = `\
---
slug: ${data.titleForSlug}
date: ${prettyDate}
title: ${data.title}
description: "${data.description}"
categories: []
keywords: [${data.tags.join(',')}]
banner: './images/banner.jpg'
---

${data.body}
`;

    return template;
  },
  getOptions: function() {
    return {
      folderForEachSlug: false,
    };
  },
};
```
