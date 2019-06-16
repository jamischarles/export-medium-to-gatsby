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

// global state. FIXME: consider localizing this more...
var report = {
  posts: {
    attempted: [],
    succeeded: [],
    failed: [],
    drafts: [],
    replies: [],
  },
  gists: {
    attempted: [],
    succeeded: [],
    failed: [],
  },
  images: {
    attempted: [],
    succeeded: [],
    failed: [],
  },
};

// handle promise errors
process.on('unhandledRejection', up => {
  console.log('err', up);
  // throw up;
});

function convertToSlug(Text)
{
    return Text
        .toLowerCase()
        .replace(/ /g,'-')
        .replace(/[^\w-]+/g,'')
        ;
}

// primary entry point
async function convertMediumFile(filePath, outputFolder, templatePath, export_drafts) {
  var template = require(templatePath);
  var options = template.getOptions();

  //don't process drafts
  if (!export_drafts) {
   // console.log('Skipping over draft file ', filePath);
    report.posts.drafts.push(filePath);
    // throw 'draft file'; // equivalent of promise.reject
    return;
  }

  report.posts.attempted.push(filePath);

  var srcFilepath = filePath;
  var content = fs.readFileSync(filePath);

  try {
    var postData = await gatherPostData(content, options, srcFilepath);
    var imageFolder = path.resolve(options.imageFolder);
    var output = template.render(postData);

    // if true, make folder for each slug, and name it '[slug]/index.md'
    if (options.folderForEachSlug) {
      outputFolder = path.join(outputFolder, postData.titleForSlug);
      // imageFolder = path.join(outputFolder, options.imagePath);
      filePath = 'index';
    }

    // make outputFolder if it doesn't exist yet
    mkdirp.sync(outputFolder);

    // console.log(
    //   `processing: ${srcFilepath} -> ${path.join(outputFolder, filePath)}.md`,
    // );

    // save post images to the local image folder
    await saveImagesToLocal(imageFolder, postData.images);

    // render post file to folder
    writePostToFile(output, filePath, outputFolder);

    report.posts.succeeded.push(filePath);
  } catch (err) {
    console.log(err)
    // reject(err);
    // re-throw if you want it to bubble up
    if (err.type != 'silent') throw err;
  }
  // });
}

async function gatherPostData(content, options, filePath) {
  var $ = cheerio.load(content);

  await inlineGists($);
  var filename = path.basename(filePath, '.html');
  var is_draft = filename.startsWith('draft')
  // TODO: add no match condition...
  var canonicalLink = $('.p-canonical').attr('href');
  if (!is_draft){
    
    var match = canonicalLink.match(
      /https:\/\/medium\.com\/.+\/(.+)-[a-z0-9]+$/i,
    );
    var titleForSlug = match[1];
  }
  else {
    // construct a canonical link
    var canonicalLink = $('footer > p > a').attr('href');
    var blogTitle = $(".graf--leading").text()
    var titleForSlug = convertToSlug(blogTitle)
  }

  // This will get the image urls, and rewrite the src in the content
  var imgData = getMediumImages($, options.imagePath, titleForSlug);
  var imagesToSave = imgData[0]
  var featuredImgPath = imgData[1]
  var subtitle = $('section.p-summary').text();

  // $2 is for the post on medium instead of the local file...
  var postBody = await scrapeMetaDetailsFromPost(canonicalLink);

  // check if standalone post or reply
  var isReplyPost = postBody.match(/inResponseToPostId":"[0-9a-z]+"/); // this is in markup for reply posts

  if (isReplyPost) {
    report.posts.replies.push(filePath);
    // FIXME: consider setting type of err and then ignoring it at the higher level
    // throw new SilentError('reply post. Skip over this one: ' + titleForSlug);
  }

  var $2 = cheerio.load(postBody);
  var description = $2('meta[name=description]').attr('content'); // from page...
  var title = $('h1').text();
  try{
    var schemaTags = $2('script[type="application/ld+json"]');
    var metaData = JSON.parse(schemaTags[0].children[0].data);
    var tags = getTags(metaData.keywords);

  }
  catch (e){
    var tags = []
  }
 

  

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
    subtitle: subtitle,
    published: $('time').attr('datetime'),
    bodyRaw: $('.section-content').html(),
    titleForSlug: titleForSlug,
    tags: tags,
    draft: is_draft,
    images: imagesToSave, // data for images from the medium post
    body: convertHtmlToMarkdown($('.section-content').html(), options),
    featuredImgPath: featuredImgPath

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
function convertHtmlToMarkdown(html, templateOptions) {
  return markdownUtils.transformHtmlToMarkdown(html, templateOptions);
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
  // FIXME: can do away with promises here entirely?
  var promises = [];

  $('script').each(async function(i, item) {
    var prom = new Promise(async (resolve, reject) => {
      var src = $(this).attr('src');
      var isGist = src.includes('gist');
      if (isGist) {
        try {
          // console.log('feching raw gist source for: ', src);
          report.gists.attempted.push(src);
          var rawGist = await getRawGist(src);
          report.gists.succeeded.push(src);

          // replace rawGist in markup
          // FIXME: just modify this in turndown?
          var inlineCode = $(`<pre>${rawGist}</pre>`); //this turns into ``` codefence

          // FIXME: guard to ensure <figure> parent is removed
          // Replace the <figure> parent node with code fence
          $(this)
            .parent()
            .replaceWith(inlineCode);

          resolve();
        } catch (e) {
          report.gists.failed.push(src);
          reject(e);
        }
      }
    });
    promises.push(prom);
  });

  return await Promise.all(promises);
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
    var ext = path.extname(imageName) || ".png";

    // get max resolution of image
    var imgUrl = `https://cdn-images-1.medium.com/max/2600/${imageName}`;

    if($(this).attr('data-is-featured')){
      var localImageName = `${postSlug}-featured${ext}`
    }
    else{
      var localImageName = `${postSlug}-${i}${ext}`
    }
    var localImagePath = path.join(imageBasePath, localImageName); // full path including folder
    if($(this).attr('data-is-featured')){
      featuredImgPath = localImagePath
    }
    var imgData = {
      mediumUrl: imgUrl,
      localName: localImageName,
      localPath: localImagePath, // local path including filename we'll save it as
    };

    images.push(imgData);

    // rewrite img urls in post
    $(this).attr('src', localImagePath);
  });
  return [images, featuredImgPath];
}

async function saveImagesToLocal(imageFolder, images) {
  var imagePromises = images.map(function(image) {
    return new Promise(function(resolve, reject) {
      var filePath = path.join(imageFolder, image.localName);
      mkdirp.sync(imageFolder); // fs.writeFileSync(p, images[0].binary, 'binary');

      // console.log(`Downloading image ${image.mediumUrl} -> ${filePath}`);
      report.images.attempted.push(image.mediumUrl);
      // request(image.mediumUrl).pipe(fs.createWriteStream(filePath)); // request image from medium CDN and save locally. TODO: add err handling

      var writer = fs.createWriteStream(filePath);

      request
        .get(image.mediumUrl)
        .on('complete', function(response) {
          // FIXME: how do we measure success / failure here?
          report.images.succeeded.push(`${image.mediumUrl}->${filePath}`);
          resolve(response);
        })
        .on('error', function(err) {
          console.log(err);
          report.images.failed.push(`${image.mediumUrl}->${filePath}`);
          reject(err);
        })
        .pipe(writer);
    });
  });

  return await Promise.all(imagePromises);
}

// using this allows us to stop flow execution, but not throw all the way up the chain...
class SilentError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, SilentError);
    this.type = 'silent';
  }
}

function printPrettyReport() {
  var postsAttempted = report.posts.attempted.length;
  var postsSucceeded = report.posts.succeeded.length;
  var postsFailed = report.posts.failed.length;
  var postsFailedDetail = report.posts.failed;
  var postDrafts = report.posts.drafts.length;
  var postReplies = report.posts.replies.length;

  var imagesAttempted = report.images.attempted.length;
  var imagesSucceeded = report.images.succeeded.length;
  var imagesFailed = report.images.failed.length;
  var imagesFailedDetail = report.images.failed;

  var gistAttempted = report.gists.attempted.length;
  var gistSucceeded = report.gists.succeeded.length;
  var gistFailed = report.gists.failed.length;
  var gistFailedDetail = report.gists.failed;

  console.log('##############################################################');
  console.log('CONVERSION METRICS');
  console.log('posts attempted', postsAttempted);
  console.log('posts succeeded', postsSucceeded);
  console.log('posts replies that were ignored:', postReplies);
  console.log('posts drafts that were not attempted:', postDrafts);
  console.log('posts failed', postsFailed);
  console.log('Failed posts:', postsFailedDetail);
  console.log('');

  console.log('medium images attempted', imagesAttempted);
  console.log('images succeeded', imagesSucceeded);
  console.log('images failed', imagesFailed);
  console.log('Failed images:', imagesFailedDetail);
  console.log('');

  console.log('gists inlining attempted', gistAttempted);
  console.log('gists succeeded', gistSucceeded);
  console.log('gists failed', gistFailed);
  console.log('Failed gists:', gistFailedDetail);

  console.log('##############################################################');
}

function saveReportToFile(outputFolder) {
  fs.writeFileSync(
    path.join(outputFolder, 'conversion_report.json'),
    JSON.stringify(report),
  );
}

// writePostFile(metaTemplate);
module.exports = {
  convert: async function(srcPath, outputFolder = '.', templatePathStr, export_drafts) {
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

    var promises = [];

    if (isDir) {
      // folder was passed in, so get all html files for folders
      fs.readdirSync(srcPath).forEach(file => {
        var curFile = path.join(srcPath, file);

        if (file.endsWith('.html')) {
          promises.push(convertMediumFile(curFile, outputFolder, templatePath, export_drafts));
          // } else {
          // promises.push(Promise.resolve('not html file')); // FIXME: is this needed?
        }
      });
    } else {
      var promises = [
        convertMediumFile(path.resolve(srcPath), outputFolder, templatePath, export_drafts),
      ];
    }

    try {
      var result = await Promise.all(promises);
      console.log('ALL DONE', report);
      printPrettyReport();
      saveReportToFile(outputFolder);
      console.log(
        `Medium files from "${path.resolve(
          srcPath,
        )}" have finished converting to "${path.resolve(
          outputFolder,
        )}" using the "${templatePathStr}" template.`,
      );
      console.log(
        `Detailed output report named "conversion_report.json" can be found in the output folder.`,
      );
    } catch (e) {
      console.log('Error during conversion!', e);
    }
  },
};
