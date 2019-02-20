module.exports = {
  render: function(data) {
    // date is ISO format

    var template = `\
---
title: ${data.title}
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
      folderForEachSlug: false,
    };
  },
};
