var
  handlebars = require('handlebars'),
  jsonfile = require('jsonfile'),
  marked = require('marked'),
  fs = require('fs-extra'),
  del = require('del'),
  writefile = require('writefile'),
  striptags = require('striptags'),
  sass = require('node-sass'),
  read = require('read-file');
//
var SRC = 'src/';
var POSTS = 'posts/';
var PAGES = 'pages/';
var INCLUDES = 'includes/';
var IMAGES = 'images/';
var MEDIA = 'media/';
var STYLE = 'style/';
var LAYOUTS = 'layouts/';
var APP = 'app.json';
var DIST;
var DATA = {
  site: null,
  pages: [],
  posts: [],
  includes: {}
};

buildData();

function buildData() {
  jsonfile.readFile(SRC + APP, function(err, obj) {
    DATA.site = obj.site;
    DIST = obj.site.destination;
    DATA.site.posts.forEach(processPost);
    DATA.site.pages.forEach(processPage);
    DATA.site.includes.forEach(processInclude);
    processHome(DATA.site.home);
    process404(DATA.site['404']);
    renderData();
  });
}

function renderData() {
  del([DIST + '/*']).then(function() {
    copyAssets();
    renderSass();
    renderFiles();
  });
}

function copyAssets() {
  fs.copy(SRC + IMAGES, DIST + '/' + IMAGES, function(err) { console.error(err); });
  fs.copy(SRC + MEDIA, DIST + '/' + MEDIA, function(err) { console.error(err); });
  fs.copy(SRC + 'favicon.png', DIST + '/favicon.png', function(err) { console.error(err); });
  writefile(DIST + '/CNAME', 'blog.jakealbaugh.com', function(err) {
    if (err) return console.log(err);
    console.log('Wrote CNAME');
  });
}

function renderSass() {
  sass.render({
    file: SRC + STYLE + DATA.site.style,
    outputStyle: 'compressed'
  }, function(err, result) {
    fs.writeFile(DIST + '/style.css', result.css, function(err) {
      if (!err) console.log('Wrote style.css');
    });
  });
}

function renderFiles() {
  var page_template = read.sync(SRC + LAYOUTS + 'default.html', 'utf8');
  var post_template = read.sync(SRC + LAYOUTS + 'post.html', 'utf8');
  page_template = handlebars.compile(page_template);
  post_template = handlebars.compile(post_template);
  DATA.pages.forEach(function(item) { renderItem(item, page_template) });
  DATA.posts.forEach(function(item) { renderItem(item, post_template) });
}

function renderItem(item, page_template) {
  var data = {}
  Object.keys(DATA.includes).forEach(function(include) {
    var template = handlebars.compile(DATA.includes[include]);
    data[include] = template({ page: item, site: DATA.site })
  });
  data.page = item;
  var content = page_template(data);

  var path = __dirname + '/' + DIST + '/'
  path += item.url.match(/\.html/) ? item.url : item.url + 'index.html';
  writefile(path, content, function(err) {
    if (err) return console.log(err);
    console.log('Wrote ' + item.url);
  });
}

function processPost(post) {
  var contents = read.sync(SRC + POSTS + post, 'utf8');
  var interpretted = interpretMatterizedMarkdown(contents);
  var date = interpretted.matter.match(/date: (.+)/)[1];
  var title = interpretted.matter.match(/title: "?(.+)"| |\n/)[1];
  var image = interpretted.matter.match(/image: (.+)/);
  image = image ? image[1] : null;
  var tweets = eval(interpretted.matter.match(/tweets: (.+)/)[1]);
  var path = date.replace(/-/g, '/');
  var slug = post.match(/\d{4}-\d{2}-\d{2}-(.+)\.md/)[1];
  var data = {
    url: path + '/' + slug + '/',
    title: title,
    slug: slug,
    date: date,
    image: image,
    minutes: Math.round(interpretted.content.split(' ').length / 180) || 1,
    pretty_date: prettyDate(date),
    tweets: tweets,
    summary: interpretted.summary,
    content: interpretted.content
  };
  DATA.posts.push(data);
}

function processPage(page) {
  var contents = read.sync(SRC + PAGES + page, 'utf8');
  var interpretted = interpretMatterizedMarkdown(contents);
  var slug = page.match(/(.+)\.md/)[1];
  var matter = interpretted.matter;
  var title = matter ? matter.match(/title: "?(.+)"?/)[1] : DATA.site.title;
  var data = {
    url: slug + '/',
    title: title,
    slug: slug,
    summary: interpretted.summary,
    content: interpretted.content
  };
  DATA.pages.push(data);
}

function processHome(home) {
  var source = read.sync(SRC + PAGES + home, 'utf8');
  var template = handlebars.compile(source);
  var content = template(DATA);
  var data = {
    url: '',
    slug: 'home',
    summary: DATA.site.description,
    content: content
  };
  DATA.pages.push(data);
}

function process404(page) {
  var source = read.sync(SRC + PAGES + page, 'utf8');
  var data = {
    url: '404.html',
    slug: '404',
    summary: DATA.site.description,
    content: source
  };
  DATA.pages.push(data);
}

function processInclude(include) {
  var slug = include.replace(/\.html/, '');
  var template = read.sync(SRC + INCLUDES + include, 'utf8');
  DATA.includes[slug] = template;
}

function interpretMatterizedMarkdown(contents) {
  var object = {}
  var matter = contents.match(/---\n([\w\W]+)\n---/);
  var content = matter ? contents.replace(matter[0], '') : contents;
  var summary = content.match(/[^\n]+/);
  summary = summary ? striptags(markdown(summary[0])) : DATA.site.description;
  if (!summary) summary = DATA.site.description;

  object.content = markdown(content)
  object.summary = summary;
  object.matter = matter ? matter[1] : null;
  return object;
}

function prettyDate(date_string) {
  var date = new Date(date_string)
  var month_names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  var pretty = [
    month_names[date.getUTCMonth()],
    date.getUTCDate() + ',',
    date.getUTCFullYear()
  ].join(' ');
  return pretty;
}

function markdown(content) {
  return marked(content).replace(/\n/g, '');
}
