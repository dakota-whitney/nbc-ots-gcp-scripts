const checkFeeds = () => {
  try{
      const props = PropertiesService.getScriptProperties().getProperties();

      const recent = getAllFeeds(props).map(feed => feed.minutesAgo(5));
      if(recent.every(feed => feed.incidents.length === 0)) return;

      for(feed of recent){
        if(feed.incidents.length === 0) continue;
        Logger.log(feed.incidents);
        const webhook = "https://hooks.slack.com/services/" + props.slack_secret;
        feed.slack.forEach(msg => UrlFetchApp.fetch(webhook, {"method": "post", "payload": JSON.stringify(msg)}))
      };
    }
    catch(e){
      Logger.log(new Error(e.message));
      throw new Error(e.message);
    };
};

const dailyReport = () => {
  try{
    const props = PropertiesService.getScriptProperties().getProperties();

    const last24 = getAllFeeds(props).map(feed => feed.hoursAgo(24));
    if(last24.every(feed => feed.incidents.length === 0)) return;

    const now = new Date();

    const thStyle = `style="border:1px solid lightgray;padding:5px;font-weight:bolder;font-size:20px;"`;
    let htmlBody = `<h1>Vendor Incident Report</h1><h2>${now.toDateString()}</h2><table><tr><th ${thStyle}>Platform</th><th ${thStyle}>Incident</th><th ${thStyle}>Reported</th><th ${thStyle}>Timeline</th></tr>`;

    let textBody = `Vendor Incident Report\n${now.toDateString()}\n`;

    for(feed of last24){
      if(feed.incidents.length === 0) continue;

      htmlBody += feed.incidents.map(({name, created_at, message, link}) => {
        message = message.replaceAll(/\bhttps?:\/\/\S+/gi, m => `<a href="${m}">here</a>.`);
        created_at = new Date(created_at).toLocaleString({hoir12: true});
        const tdStyle = `style="border:1px solid lightgray;padding:5px;"`;
        return `<tr><td ${tdStyle}>${feed.platform}</td><td ${tdStyle}><a href="${link}">${name}</a></td><td ${tdStyle}>${created_at}</td><td ${tdStyle}>${message}</td></tr>`
      }).join("")

      textBody += feed.incidents.map(({name, created_at, message}) => `${feed.platform}\n${name}\n${created_at}\n${message}`).join("\n\n")
  };

    const recipients = Object.values(props).filter(val => val.match(/@/)).join(",");
    const subject = `Vendor Incident Report: ${now.toDateString()}`;
    GmailApp.sendEmail(recipients, subject, textBody, {htmlBody: htmlBody})
  }
  catch(e){
    Logger.log(e.message);
    throw new Error(e.message);
  };
};