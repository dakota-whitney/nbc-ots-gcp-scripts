const doPost = e => {
  const payload = JSON.parse(e.postData.contents);
  Logger.log(payload);
  sendUsage(payload);
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
};

const doGet = e => {
  const output = fetchUsage("html");
  output.setFaviconUrl("https://www.nbc.com/generetic/favicon.ico");
  output.setTitle("MSL4 Ingest Report")
  return output;
};

const dailyUsage = () => {
  let payload = fetchUsage();
  while(!payload) payload = fetchUsage()
  return sendUsage(payload);
};

const fetchUsage = mimeType => {
  try{
    const hook = PropertiesService.getScriptProperties().getProperty("fb_hook");
    const payload = JSON.parse(UrlFetchApp.fetch(hook).getContentText());
    Logger.log(payload);
    if(mimeType === "html") return toHTML(payload)
    else return payload
  }
  catch(e){
    Logger.log(e.message);
    return null;
  }
};

const toHTML = payload => {
  const html = HtmlService.createTemplateFromFile('index').evaluate();
  const rows = payload.map(({cpCode, market, minutes}) => `<tr><td>${cpCode} (${market})</td><td>${minutes} minutes used</td></tr>`).join("")
  const newHTML = html.getContent().replace("<table></table>", `<table>${rows}</table>`);
  return html.setContent(newHTML);
};

const sendUsage = payload => {
  const props = PropertiesService.getScriptProperties().getProperties();
  const htmlBody = toHTML(payload).getContent()
  const textBody = payload.map(({cpCode, market, minutes}) => `${cpCode} (${market}): ${minutes} minutes used`).join("\n");
  const recipients = Object.values(props).filter(val => val.match(/@/)).join(",");

  Logger.log("recipients: %s\ntextBody: %s\nhtml: %s", recipients, textBody, htmlBody);
  return GmailApp.sendEmail(recipients, `MSL4 Daily Ingest Usage - ${new Date().toDateString({hour12: true})}`, textBody, {htmlBody: htmlBody});
};

const include = filename => HtmlService.createHtmlOutputFromFile(filename).getContent();