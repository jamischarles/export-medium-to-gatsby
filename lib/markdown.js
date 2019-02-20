// Utils related to scraping a jobs page and converting it to / from markdown
//
//

// var request = require('request');
var fakeUa = require('fake-useragent');

// strips html tags
var striptags = require('striptags');

// converts markdown to html
var showdown = require('showdown');
showdown.setFlavor('github');
var showdownConverter = new showdown.Converter({
  // smartIndentationFix: true, // no effect?
  // simpleLineBreaks: true, // no effect?
  openLinksInNewWindow: true, // do we want this?
});

// converts html to markdown
var TurndownService = require('turndown');

var turnDownOptions = {
  linkReferenceStyle: 'collapsed',
};
var turndownService = new TurndownService(turnDownOptions);
// strip <style> and <script> tags and contents
// turndownService.remove(['style', 'script', 'meta', 'img']);
turndownService.remove(['style', 'meta', 'img']);
//
//
// turndownService.keep(['script']);

// github gist scripts
turndownService.addRule('script', {
  filter: ['script'],
  replacement: function(content, node) {
    // donwload it?
    console.log('SCRIP***');
    console.log('argumeentst', arguments);
    var output = `
    \`\`\`javascript
    console.log()
    \`\`\`
    `;
    return `\`${content}\``;
  },
});

// keep figure, figcaption (for images, subtitles) but convert contents to markdown, and remove attributes
turndownService.addRule('figure', {
  filter: ['figure'],
  replacement: function(content) {
    return `<figure>${content}</figure>`;
  },
});

turndownService.addRule('figcaption', {
  filter: ['figcaption'],
  replacement: function(content) {
    return `<figcaption>${content}</figcaption>`;
  },
});

// single line code items...
turndownService.addRule('pre', {
  filter: ['pre'],
  replacement: function(content) {
    return `\`${content}\``;
  },
});

// multi line code items...
turndownService.addRule('code', {
  filter: ['code'],
  replacement: function(content) {
    return `
\`\`\`
    ${content}
\`\`\`
    `;
  },
});

// strip links but keep content
// turndownService.addRule('link', {
//   filter: ['a'],
//   replacement: function(content) {
//     return content;
//   },
// });

// TODO: later we could consider doing the fetching part on the client-side to distr the load...

// gets the markup for the page. No scrubbing no nothing. Just a curl that seems like a browser...
function scrapeJobDetailsPage(url, cb) {
  // TODO: check for URL, and abort with 4xx error if no url
  // var url = 'http://www.google.com';

  console.log('fakeUa()', fakeUa());

  var headers = {
    'User-Agent': fakeUa(),
  };

  request.get({url: url, headers: headers}, function(error, response, body) {
    console.log('error:', error); // Print the error if one occurred
    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    // console.log('body:', body); // Print the HTML for the Google homepage.

    cb(null, body);
  });
}

// takes the code from the jobs page and turns it into markdown so we can show it on the posting page
// TODO: keep headings, lists, etc... everything else should be stripped
// No buttons, no links, no images...
function transformHtmlToMarkdown(code) {
  // var sanitized = sanitizeHTML(code);
  // console.log('sanitized', sanitized);
  return turndownService.turndown(code);
}

// reduce line breaks etc in the code... THis is a real problem with some SO posts...
// FIXME: Q: Do we even use this? Not using it currently...
function sanitizeHTML(html) {
  // TODO: A UL should NOT have linebreaks next to the <li> tags

  // don't allow multiple <br> next to each other...
  var clean = html
    .replace(/(\<br\>\s?)+/g, '<br>') //matches multiple <br> with optional space in between
    .replace(/(\<br\s?\/\>\s?)+/g, '<br/>'); // matches multiple <br /><br/> with optioal space in between them. And reduces to 1
  return clean;
}

/*******************************
 * PUBLIC fn
 **********************************/

// FIXME: consider moving all the markdown utils into a markdown file?
// genrates string for the permalink. Won't use the ID though...
// Sr. UI Designer, Netflix -> Sr-UI-Designer-Netflix (this is really for vanity, since it's not needed)
function generatePermalink(title, company) {
  var title = title.toLowerCase();
  var company = company.toLowerCase();
  var perma = title.replace(/\W|\s/gi, '-'); // NOT a word, OR a space
  perma += '-' + company.replace(/\W|\s/gi, '-');
  // anything that's not a letter needs to be replaced
  // lowercase, replace spaces, dots with dashes. Replace anything else with ''
  return perma.replace(/(-)+/g, '-'); // only single dashes next to each other
}

// before saving the post details to our DB
// TODO: strip out unallowed stuff
function transformMarkdownToHTML(markdown) {
  // console.log('markdown', markdown);
  return showdownConverter.makeHtml(markdown);
}

// TODO: if anything goes wrong, just bail, and show the error message to the user. Couldn't get the listing details...
function getMarkdownFromJobPage(url, cb) {
  scrapeJobDetailsPage(url, (err, jobPageHtml) => {
    var markdown = transformHtmlToMarkdown(jobPageHtml);
    // FIXME: how do I throw if there's an error with processing?

    // manually scrub for any html tags that aren't caught via turndown :|
    // FIXME: This is a bug with turndown? Can we just fix that instead of needing 2 libs?
    // scrub out <meta/> tags (causes refresh on FB pages) (iframe buster)
    markdown = striptags(markdown);

    console.log('markdown', markdown);
    cb(null, markdown);
  });
}

module.exports = {
  // transformMarkupToMarkdown: transformMarkupToMarkdown,
  // scrapeJobDetailsPage: scrapeJobDetailsPage,
  getMarkdownFromJobPage: getMarkdownFromJobPage,
  transformMarkdownToHTML: transformMarkdownToHTML,
  transformHtmlToMarkdown,
  generatePermalink: generatePermalink,
};
