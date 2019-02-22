# medium-to-gatsby

 A CLI to convert your medium exported .html files to gatsby .md files.

## Installation 
`$ npm install -g https://github.com/jamischarles/export-medium-to-gatsby` (maybe it'll go on npm eventually)

## Steps
1. [Download your medium posts as an archcive from medium](https://help.medium.com/hc/en-us/articles/115004745787-Download-your-information).
2. Install this CLI via #Installation step above
3. Save a template file (see template section below) where you'll be running
   your export command.
4. Customize the template.js file you downloaded to match the [frontmatter](https://jekyllrb.com/docs/front-matter/) fields your gatsby blog requires. Here you also define what folder in your blog medium images should be downloaded to.
5. Run the CLI and either output it directly to your `content/posts` folder, or
   copy it there after generating the files.
6. Verify that the generated files are correct and looks good.
7. Make any CSS and styling adjustments as needed.
8. Do a happy dance.

## CLI Usage 
```
 Usage
    $ medium2gatsby <src_file_or_folder>

  Options
   --output, -o Destination folder for output files. Defaults to './'.
   --template, -t Template used to generate post files.
   --help, -h Shows usage instructions

  Examples
    $ medium2gatsby . -o posts -t template.js
    $ medium2gatsby 2018-04-02_Introducing-the-react-testing-library----e3a274307e65.html -o output -t template.js
```

## Features
- Customize output via templates
- Downloads post images from medium and saves locally
- Handles embedded tweets
- Inlines github gists 
- Allows default language for code blocks. 

## Recommended styling
**Images and subtitles**
Images and subtitles will been converted to
`<figure><img><figcaption>Subtitle</figcaption>` same as medium used.

Gatsby injects a `<p>` in there. To fix spacing I suggest you add the following to your template's
CSS:`figure > p {margin-bottom:0px !important;}`.

You can use `figure figcaption {}` to style image subtitles.

** Fenced Links**
If you used fenced links on medium to make links stand out, those links will now
have show up as `<a href="some-link" class="fenced-link">some text</a>.` This
CSS should approximate the medium fenced link style:
```css
.fenced-link {
  background-color:#0000000d;
  font-family:monospace;  
  text-decoration:underline;
  padding:2px;
}
```



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

## TODO and Help needed
I'm about ready to move on from this, but would love help with the following if
anybody feels inclined:
- [ ] Adding tests (prefer something dead simple like mocha). Currently there
    are zero tests.
- [ ] More generator targets. This repo could fairly easily be forked and expanded to include other targets like jekyll, or
    other static site generators. (low priority)
