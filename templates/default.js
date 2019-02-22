module.exports = {
  render: function(data) {
    // date is ISO format

    var template = `\
---
title: "${data.title}"
date: ${data.published}
template: "post"
draft: false
slug: "/posts/${data.titleForSlug}/"
category: ""
tags: [${data.tags.join(',')}]
description: "${data.description}"
---

${data.body}
`;

    // FIXME: list example of output here...
    return template;
  },
  getOptions: function() {
    return {
      folderForEachSlug: false, // same folder for all posts
      imagePath: '/media', // <img src="/media/[filename]" >. Used in the markdown files.
      // This field is ignored when folderForEachSlug:true. Should be absolute. Location where medium images will be saved.
      imageFolder: '/Users/jacharles/dev/blog/static/media',
      defaultCodeBlockLanguage: '', // code fenced by default will be ``` with no lang. If most of your code blocks are in a specific lang, set this here.

    };
  },
};
