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

// handle promise errors
process.on('unhandledRejection', up => {
  throw up;
});

// primary entry point
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

  gatherPostData(content, options)
    .then(function(postData) {
      var imageFolder = path.resolve(options.imageFolder);
      var output = template.render(postData);

      // if true, make folder for each slug, and name it '[slug]/index.md'
      if (options.folderForEachSlug) {
        outputFolder = path.join(outputFolder, postData.titleForSlug);
        imageFolder = path.join(outputFolder, options.imagePath);
        filePath = 'index';
      }

      // make outputFolder if it doesn't exist yet
      mkdirp.sync(outputFolder);

      // save post images to the local image folder
      saveImagesToLocal(imageFolder, postData.images);

      // render post file to folder
      writePostToFile(output, filePath, outputFolder);
    })
    .catch(function(err) {
      console.log('err', err);
    });
}

async function gatherPostData(content, options) {
  var $ = cheerio.load(content);

  inlineGists($);

  // TODO: add no match condition...
  var canonicalLink = $('.p-canonical').attr('href');
  var match = canonicalLink.match(
    /https:\/\/medium\.com\/.+\/(.+)-[a-z0-9]+$/i,
  );

  var titleForSlug = match[1];

  // This will get the image urls, and rewrite the src in the content
  var imagesToSave = getMediumImages($, options.imagePath, titleForSlug);

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

  // embedded tweets:
  // medium returns empty <a> which turndown throws out before we can process it.
  // add dummy link text so turndown won't discard it
  $('blockquote.twitter-tweet a').text('[Embedded tweet]');

  var post = {
    title: title,
    description: description,
    published: $('time').attr('datetime'),
    bodyRaw: $('.section-content').html(),
    titleForSlug: titleForSlug,
    tags: tags,
    images: imagesToSave, // data for images from the medium post
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
// fenced block (```) by turndown
async function inlineGists($) {
  // get all script tags on thet page
  //
  $('script').each(async function(i, item) {
    var src = $(this).attr('src');
    var isGist = src.includes('gist');
    if (isGist) {
      console.log('feching raw gist source for: ', src);
      var rawGist = await getRawGist(src);

      // replace rawGist in markup
      // FIXME: just modify this in turndown?
      var inlineCode = $(`<pre>${rawGist}</pre>`); //this turns into ``` codefence

      // FIXME: guard to ensure <figure> parent is removed
      // Replace the <figure> parent node with code fence
      $(this)
        .parent()
        .replaceWith(inlineCode);
    }
  });
}

// get the raw gist from github
async function getRawGist(gistUrl) {
  var newUrl = gistUrl.replace('github.com', 'githubusercontent.com');

  // remove suffix (like .js) (maybe use it for code fencing later...)
  // FIXME: this is hacky
  var gistID = newUrl.split('/')[4]; // FIXME: guard for error
  if (gistID.includes('.')) {
    var ext = path.extname(gistID);
    newUrl = newUrl.replace(ext, ''); // srip extension (needed for raw fetch to work)
  }

  newUrl += '/raw';

  // make the call
  var resp = await makeRequest({url: newUrl});
  if (resp.statusCode === 200) {
    return resp.body;
  }
}

// returns urls of images to download and re-writes post urls to point locally
function getMediumImages($, imageBasePath, postSlug) {
  var images = [];

  $('img.graf-image').each(async function(i, item) {
    var imageName = $(this).attr('data-image-id');
    var ext = path.extname(imageName);

    // get max resolution of image
    var imgUrl = `https://cdn-images-1.medium.com/max/2600/${imageName}`;

    var localImageName = `${postSlug}-${i}${ext}`; // some-post-name-01.jpg
    var localImagePath = path.join(imageBasePath, localImageName); // full path including folder

    var imgData = {
      mediumUrl: imgUrl,
      localName: localImageName,
      localPath: localImagePath, // local path including filename we'll save it as
    };

    images.push(imgData);

    // rewrite img urls in post
    $(this).attr('src', localImagePath);
  });
  return images;
}

function saveImagesToLocal(imageFolder, images) {
  images.forEach(function(image) {
    var filePath = path.join(imageFolder, image.localName);
    mkdirp(imageFolder); // fs.writeFileSync(p, images[0].binary, 'binary');

    console.log(`Downloading image ${image.mediumUrl} -> ${filePath}`);
    request(image.mediumUrl).pipe(fs.createWriteStream(filePath)); // request image from medium CDN and save locally. TODO: add err handling
  });
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
        var curFile = path.join(srcPath, file);

        if (file.endsWith('.html')) {
          convertMediumFile(curFile, outputFolder, templatePath);
        }
      });
    } else {
      convertMediumFile(path.resolve(srcPath), outputFolder, templatePath);
    }
  },
};
