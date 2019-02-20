// FIXME: add file description...
var fakeUa = require('fake-useragent');
var request = require('request');
var fs = require('fs');
var path = require('path');
var cheerio = require('cheerio');
var util = require('util');
var mkdirp = require('mkdirp');

var markdownUtils = require('./markdown');

var makeRequest = util.promisify(request.get);

// FIXME: add validation around this...
// var filePath = process.argv[2];

// FIXME: use a CLI and use -o flag for this...
// var outputFolder = path.resolve(process.argv[3] || '.');

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
function convertMediumFile(filePath, outputFolder, templatePath) {
  var template = require(templatePath);
  var options = template.getOptions();

  // don't process drafts
  var filename = path.basename(filePath, '.html');
  if (filename.startsWith('draft')) {
    return;
  }

  console.log('processing: ', filePath);
  var content = fs.readFileSync(filePath);

  gatherPostData(content)
    .then(function(postData) {
      var output = template.render(postData);

      // if true, make folder for each slug, and name it '[slug]/index.md'
      if (options.folderForEachSlug) {
        outputFolder = path.join(outputFolder, postData.titleForSlug);
        filePath = 'index';
      }

      // make outputFolder if it doesn't exist yet
      mkdirp.sync(outputFolder);

      // render file to folder
      writePostToFile(output, filePath, outputFolder);
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

  // process code blocks
  // medium exports inline code block as <code></code> and multi-line as <pre></pre>
  // We need to wrap the content of the <pre> with <code> tags so turndown parser won't escape the codeblock content
  $('pre').map(function(i, el) {
    var codeBlockContent = $(this).html();
    codeBlockContent = `<code>${codeBlockContent}</code>`;

    var newEl = $(this).html(codeBlockContent);
    return newEl;
  });

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
function writePostToFile(content, oldFilePath, outputFolder) {
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
module.exports = {
  convert: function(srcPath, outputFolder = '.', templatePathStr) {
    var isDir = fs.lstatSync(srcPath).isDirectory();
    var isFile = fs.lstatSync(srcPath).isFile();

    var defaultTemplate = path.resolve(
      path.join(__dirname, '../templates/default.js'),
    );

    var templatePath = defaultTemplate;
    // if template passed in, load that instead of default
    if (templatePathStr) {
      templatePath = path.resolve(templatePathStr);
    }

    if (isDir) {
      // folder was passed in, so get all html files for folders
      fs.readdirSync(srcPath).forEach(file => {
        if (file.endsWith('.html')) {
          convertMediumFile(path.resolve(file), outputFolder, templatePath);
        }
      });
    } else {
      convertMediumFile(path.resolve(srcPath), outputFolder, templatePath);
    }
  },
};
