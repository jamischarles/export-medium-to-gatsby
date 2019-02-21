// Utils related to scraping pages and converting them to markdown

// converts html to markdown
var TurndownService = require('turndown');

var turnDownOptions = {
  // linkReferenceStyle: 'collapsed',
  codeBlockStyle: 'fenced',
};
var turndownService = new TurndownService(turnDownOptions);
// strip <style> and <script> tags and contents
// turndownService.remove(['style', 'script', 'meta', 'img']);
turndownService.remove(['style', 'script', 'meta', 'img']);

// github gist scripts
// turndownService.addRule('script', {
//   filter: ['script'],
//   replacement: function(content, node) {
//     // donwload it?
//     console.log('SCRIP***');
//     var output = `
//     \`\`\`javascript
//     console.log()
//     \`\`\`
//     `;
//     return `\`${content}\``;
//   },
// });

// RULE ORDER MATTERS. Later ones are run first...

// keep figure, figcaption (for images, subtitles) but convert contents to markdown, and remove attributes
turndownService.addRule('figure', {
  filter: ['figure'],
  replacement: function(content) {
    return `<figure>${content}</figure>`;
  },
});

turndownService.addRule('embedded-tweets ', {
  filter: function(node, options) {
    // if a <code> tag has only 1 child, and it's a link..., then call replacement()
    // start at the <figure> node because we want to lose that
    if (
      node.nodeName === 'FIGURE' &&
      node.children[0].nodeName === 'BLOCKQUOTE' &&
      node.children[0].getAttribute('class') === 'twitter-tweet'
    ) {
      return true;
    }
    return false;
  },
  // replace <figcaption><a></figcaption></code> with <a class="fenced-link">
  replacement: function(content, node, options) {
    // space at end needed, so several next to each other don't run together
    return node.children[0].children[0].getAttribute('href') + ' '; // FIXME: use find() with selectors instead...
  },
});

turndownService.addRule('figcaption', {
  filter: ['figcaption'],
  replacement: function(content, node, options) {
    return `<figcaption>${content}</figcaption>`;
  },
});

// turn md links inside <figcaption> tags to <a> tags so gatsby renders them as links, instead of markdown
// FIXME: should I just keep the original htmtl from medium?
turndownService.addRule('figcaption-links', {
  filter: function(node, options) {
    // if a <code> tag has only 1 child, and it's a link..., then call replacement()
    if (node.nodeName === 'A' && node.parentNode.nodeName === 'FIGCAPTION') {
      return true;
    }
    return false;
  },
  // replace <figcaption><a></figcaption></code> with <a class="fenced-link">
  replacement: function(content, node, options) {
    var linkHref = node.getAttribute('href');
    var linkText = node.text;
    return `<a href="${linkHref}" class="figcaption-link">${linkText}</a>`;
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
  return turndownService.turndown(code);
}

module.exports = {
  transformHtmlToMarkdown,
};
