/*Dashboard Functions*/
const doGet = e => {
  const output = HtmlService.createTemplateFromFile('index').evaluate()
  output.setTitle('Ops Status Dashboard');
  output.setFaviconUrl("https://www.nbc.com/generetic/favicon.ico");
  return output;
};

const include = filename => HtmlService.createHtmlOutputFromFile(filename).getContent();

const fetchFeeds = () => {
  const props = PropertiesService.getScriptProperties().getProperties();
  const feeds = getAllFeeds(props).map(feed => feed.incidents);
  return mergeFeeds(feeds);
};

const mergeFeeds = feeds => feeds.flat(1).sort(({created_at: a}, {created_at: b}) => Date.parse(a) - Date.parse(b));