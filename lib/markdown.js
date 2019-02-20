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
  // linkReferenceStyle: 'collapsed',
  codeBlockStyle: 'fenced',
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
// THIS ALSO applies for multi line code snippets with ``` on medium...
turndownService.addRule('pre', {
  filter: ['pre'],
  replacement: function(content) {
    return `
\`\`\`
${content}
\`\`\`
`;
  },
});

// Handle fenced links
// <code><a></a></code>
turndownService.addRule('fenced-link', {
  filter: function(node, options) {
    // if a <code> tag has only 1 child, and it's a link..., then call replacement()
    if (
      node.nodeName === 'CODE' &&
      node.children.length === 1 &&
      node.children[0].nodeName === 'A'
    ) {
      return true;
    }
    return false;
  },
  // replace <code><a></a></code> with <a class="fenced-link">
  replacement: function(content, node, options) {
    var linkHref = node.children[0].getAttribute('href');
    var linkText = node.children[0].text;
    return `<a href="${linkHref}" class="fenced-link">${linkText}</a>`;
  },
});

// medium does <code></code> for single line snippet
// and <pre><code></code></pre> for multi-line
// this holds true for their site.
// But their export uses <pre /> for multiline, and <code /> for single line

// multi line code items...
// turndownService.addRule('code', {
//   filter: ['code'],
//   replacement: function(content) {
//     return `\`${content}\``;
//   },
// });

// strip links but keep content
// turndownService.addRule('link', {
//   filter: ['a'],
//   replacement: function(content) {
//     return content;
//   },
// });

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

// before saving the post details to our DB
// TODO: strip out unallowed stuff
function transformMarkdownToHTML(markdown) {
  // console.log('markdown', markdown);
  return showdownConverter.makeHtml(markdown);
}

module.exports = {
  transformMarkdownToHTML: transformMarkdownToHTML,
  transformHtmlToMarkdown,
};
