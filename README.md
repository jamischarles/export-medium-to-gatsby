# medium-to-gatsby

 A CLI to convert your medium exported .html files to gatsby .md files.
 
 ## Features
- Converts medium .html files and outputs gatsby .md files.
- Customize output via templates
- Downloads post images from medium and saves locally
- Handles embedded tweets
- Inlines github gists 
- Allows default language for code blocks. 

## Installation 
`$ npm install -g https://github.com/jamischarles/export-medium-to-gatsby` (maybe it'll go on npm eventually)

## Steps
1. [Download your medium posts as an archive from medium](https://help.medium.com/hc/en-us/articles/115004745787-Download-your-information).
2. Install this CLI via #Installation step above
3. Save a template file (see template section below) where you'll be running
   your export command.
4. Customize the template.js file you downloaded to match the [frontmatter](https://jekyllrb.com/docs/front-matter/) fields your gatsby blog requires. Here you also define what folder in your blog medium images should be downloaded to.
5. Run the CLI and use the `medium-export/posts` folder as the input, and for output either directly output to your `content/posts` folder, or copy it there after generating the files.
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
    $ medium2gatsby ~/Downloads/medium-export/posts -o . -t template.js 
```

## Recommended styling
### Images and subtitles
Images and subtitles will been converted to
`<figure><img><figcaption>Subtitle</figcaption>` same as medium used.

Gatsby injects a `<p>` in there. To fix spacing I suggest you add the following to your template's
CSS:`figure > p {margin-bottom:0px !important;}`.

You can use `figure figcaption {}` to style image subtitles.

### Fenced Links
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
Based on which gatsby theme you're using you may need to generate different
frontmatter fields.

Here are some example `template.js` you can save and pass to the CLI via the `-t` flag.

### Template ex1: Different folder for each post 
- specifies `2018-04-16` date format in frontmatter `date` field
- generates a separate folder for each post ie: `content/posts/introducing-react/index.md
- saves post images to `/images2` (relative to the post folder)
- defauls all code fences to use `'js'`

```js
module.exports = {
  render: function(data) {
    // data.published is Date ISO format: 2018-04-16T14:48:00.000Z
    var date = new Date(data.published);
    var prettyDate =
      date.getFullYear() +
      '-' +
      (date.getMonth() + 1).toString().padStart(2, 0) +
      '-' +
      date
        .getDate()
        .toString()
        .padStart(2, 0); //2018-04-16
    
    var template = `\
---
slug: ${data.titleForSlug}
date: ${prettyDate}
title: "${data.title}"
draft: false
description: "${data.description}"
categories: []
keywords: [${data.tags.join(',')}]
---

${data.body}
`;

    return template;
  },
  getOptions: function() {
    return {
      folderForEachSlug: true, // separate folder for each blog post, where index.md and post images will live
      imagePath: '/images2', // <img src="/images2/[filename]" >. Used in the markdown files.
      defaultCodeBlockLanguage: 'js', // code fenced by default will be ``` with no lang. If most of your code blocks are in a specific lang, set this here.
    };
  },
};

```

### Template ex2: Same folder for all posts
- specifies `2018-04-16T14:48:00.000Z` date format (ISO, which is default) in frontmatter `date` field
- saves all generated posts to same folder defined in `-o` options for CLI. Files are named via slug name from medium.
- saves post images to `/Users/jacharles/dev/blog/content/posts/introducing-the-react-testing-library/images`
- defauls all code fences to use `''` (no language).

```js
module.exports = {
  render: function(data) {
    var template = `\
---
slug: ${data.titleForSlug}
date: ${data.published}
title: "${data.title}"
draft: false
description: "${data.description}"
category: ""
tags: [${data.tags.join(',')}]
---

${data.body}
`;

    return template;
  },
  getOptions: function() {
    return {
      folderForEachSlug: false, // same folder for all posts
      imagePath: '/media', // <img src="/media/[filename]" >. Used in the markdown files.
      // This field is ignored when folderForEachSlug:true. Should be absolute. Location where medium images will be saved.
      imageFolder:
        '/Users/jacharles/dev/blog/static/media', 
      defaultCodeBlockLanguage: '', // code fenced by default will be ``` with no lang. If most of your code blocks are in a specific lang, set this here.
    };
  },
};

```

## TODO and Help needed
I'm about ready to move on from this, but would love help with the following if
anybody feels inclined:
- [ ] Error handling is very lacking in many places. Could / should be improved to be more robust especially around downloading posts / images from medium.
- [ ] Adding tests (prefer something dead simple like mocha). Currently there
    are zero tests.
- [ ] More generator targets. This repo could fairly easily be forked and expanded to include other targets like jekyll, or
    other static site generators. (low priority)
