// FIXME: add file description...
var fakeUa = require('fake-useragent');
var request = require('request');
var fs = require('fs');
var path = require('path');
var cheerio = require('cheerio');
var util = require('util');
var mkdirp = require('mkdirp');

var markdownUtils = require('./utils/markdown');

var makeRequest = util.promisify(request.get);

// FIXME: add validation around this...
var filePath = process.argv[2];

// FIXME: use a CLI and use -o flag for this...
var outputFolder = path.resolve(process.argv[3] || '.');

// make outputFolder if it doesn't exist yet
mkdirp.sync(outputFolder);

var isDir = fs.lstatSync(filePath).isDirectory();
var isFile = fs.lstatSync(filePath).isFile();

if (isDir) {
  fs.readdirSync(filePath).forEach(file => {
    if (file.endsWith('.html')) {
      convertMediumFile(path.resolve(file));
    }
  });
} else {
  convertMediumFile(path.resolve(filePath));
}

// handle promise errors
process.on('unhandledRejection', up => {
  throw up;
});
// console.log('title:', $('h1').text());

// FIXME: move this to utils file?
// var schemaTags = $('script[type="application/ld+json"]');

// var metaData = JSON.parse(schemaTags[0].children[0].data);

// console.log('metaData', metaData);

// "datePublished":"2018-07-14T20:02:35.133Z"
// "headline":"What is a Test in JavaScript?"
// "keywords":["Tag:JavaScript","Tag:"]
// "url":"https://medium.com/@jamischarles/what-is-a-test-in-javascript-3d52cc3cd1a6"
// desc: meta tag desc
//
//category (blank)
// bodyRaw: $('.section-content')
//

//
//
//
// try to get as much from the markup as possible...
// Anythting we can't get, we'll scrape from the article page...
// var metaData = {
//   title: $('h1').text(),
//   //description: $('meta[name=description]').attr('content'), // from page...
//   published: $('time').attr('datetime'),
//   bodyRaw: $('.section-content').html(),
//   titleForSlug: match[1], // FIXME: use better var name...
//   // tags: tags, // from page...
//   body: convertHtmlToMarkdown($('.section-content').html()),
// };
//
//

//
//
// var tags = getTags(metaData.keywords);
//

// console.log('post.bodyRaw', post.bodyRaw);
//
function convertMediumFile(filePath) {
  // don't process drafts
  var filename = path.basename(filePath, '.html');
  if (filename.startsWith('draft')) {
    return;
  }

  console.log('processing: ', filePath);
  var content = fs.readFileSync(filePath);

  gatherPostData(content)
    .then(function(post) {
      var output = renderPost(post);

      // render file to folder
      writePostToFile(output, filePath);
    })
    .catch(function(err) {
      console.log('err', err);
    });
}

async function gatherPostData(content) {
  var $ = cheerio.load(content);

  inlineGists($);

  // TODO: add no match condition...
  var canonicalLink = $('.p-canonical').attr('href');
  var match = canonicalLink.match(
    /https:\/\/medium\.com\/.+\/(.+)-[a-z0-9]+$/i,
  );

  var titleForSlug = match[1];

  // $2 is for the post on medium instead of the local file...
  var postBody = await scrapeMetaDetailsFromPost(canonicalLink);

  // check if standalone post or reply
  var isReplyPost = postBody.match(/inResponseToPostId":"[0-9a-z]+"/); // this is in markup for reply posts

  if (isReplyPost)
    throw new Error('reply post. Skip over this one: ' + titleForSlug);

  var $2 = cheerio.load(postBody);
  var description = $2('meta[name=description]').attr('content'); // from page...

  var schemaTags = $2('script[type="application/ld+json"]');

  var metaData = JSON.parse(schemaTags[0].children[0].data);

  var tags = getTags(metaData.keywords);

  var title = $('h1').text();

  // FIXME: put this in fn
  // REMOVE h1 and avatar section
  $('h1')
    .next()
    .remove(); // remove div avatar domEl right after h1
  $('h1').remove();

  var post = {
    title: title,
    description: description,
    published: $('time').attr('datetime'),
    bodyRaw: $('.section-content').html(),
    titleForSlug: titleForSlug,
    tags: tags,
    body: convertHtmlToMarkdown($('.section-content').html()),
  };

  return post;
}

// FIXME: Is this where we provide a template?
function renderPost(post) {
  var template = `\
---
title: ${post.title}
date: ${post.published}
template: "post"
draft: false
slug: "/posts/${post.titleForSlug}/"
category: ""
tags: [${post.tags.join(',')}]
description: "${post.description}"
---

${post.body}
`;

  return template;
}

// takes array of strings
function getTags(arr) {
  var tags = [];

  // only take format of 'Tag:JavaScript', and keep latter portion
  arr.forEach(item => {
    if (item.startsWith('Tag:')) {
      tags.push(item.split(':')[1]);
    }
  });

  return tags;
}

var suffix = /\.html$/i;

// FIXME: get name from date + slug
function writePostToFile(content, oldFilePath) {
  var fileName = path.basename(oldFilePath, '.html');

  var newPath = path.resolve(path.join(outputFolder, fileName) + '.md');

  // console.log('newPath', newPath);
  fs.writeFileSync(newPath, content);
}

// convert the post body
function convertHtmlToMarkdown(html) {
  return markdownUtils.transformHtmlToMarkdown(html);
}

async function scrapeMetaDetailsFromPost(url) {
  var headers = {
    'User-Agent': fakeUa(),
  };

  // FIXME: add error handling conditions...
  var resp = await makeRequest({url: url, headers: headers});
  return resp.body;
}

// attempts to take gist script tags, then downloads the raw content, and places in <pre> tag which will be converted to
// fenced block by turndown
async function inlineGists($) {
  // get all script tags on thet page
  //
  //
  //
  var tags = $('script'); // reutrns obj
  // console.log('tags', tags);
  for (key in tags) {
    var item = tags[key];

    // FIXME: make this more stable...
    // only traverse the key indices
    if (!Number.isInteger(parseInt(key, 10))) return;

    var src = $(item).attr('src');
    if (src && src.includes('gist')) {
      console.log('feching raw gist source for: ', src);
      var rawGist = await getRawGist(src);

      // replace rawGist in markup
      // FIXME: just modify this in turndown?
      var inlineCode = $(`<code>${rawGist}</code>`); //this weird combo turns into ``` codefence
      $(item).replaceWith(inlineCode);
    }
  }
}

// get the raw gist from github
async function getRawGist(gistUrl) {
  var newUrl = gistUrl.replace('github.com', 'githubusercontent.com');

  // remove suffix (like .js) (maybe use it for code fencing later...)
  // FIXME: this is hacky
  var gistID = newUrl.split('/')[4]; // FIXME: guard for error
  if (gistID.includes('.')) {
    var ext = '.' + gistID.split('.')[1];
    newUrl = newUrl.replace(ext, ''); // srip extension (needed for raw fetch to work)
  }

  newUrl += '/raw';

  // make the call
  var resp = await makeRequest({url: newUrl});
  if (resp.statusCode === 200) {
    return resp.body;
  }
}

// writePostFile(metaTemplate);
