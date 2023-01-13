class FeedReader {
  constructor(rssFeed){
    const channel = XmlService.parse(rssFeed).getRootElement().getChild('channel');

    const [ platform ] = channel.getChildText("title").match(/(\w|\s)+(?=\sstatus)/i);
    this._platform = platform.match(/amazon/i) ? "AWS" : platform;

    this._incidents = channel.getChildren('item').map(item => {
        const title = item.getChildText('title');
        const description = item.getChildText('description');
        const guid = item.getChildText('guid');
        
        return {
          platform: this._platform,
          name: title,
          created_at: item.getChildText('pubDate'),
          message: description,
          status: matchStatus(platform, title, description),
          link: guid,
          id: guid ? guid.split("/").pop() : guid
        };
      })
  }
  get platform(){
    return this._platform;
  }
  get incidents(){
    return this._incidents;
  }
  hoursAgo(hours){
    this._incidents = this.incidents.filter(({name, created_at}) => Math.abs(Date.now() - Date.parse(created_at)) / (60 * 60 * 1000) <= hours && !name.match(/Operational/));
    return this;
  }
  minutesAgo(minutes){
    this._incidents = this.incidents.filter(({name, created_at}) => Math.abs(Date.now() - Date.parse(created_at)) / (60 * 1000) <= minutes && !name.match(/Operational/));
    return this;
  }
  get slack(){
    return this.incidents.map(incident => toSlack(incident))
  };
  toSlack(){
    return this.incidents.map(incident => toSlack(incident))
  }
};

const getAllFeeds = props => {
  const rssUrls = Object.entries(props).filter(([key]) => key.match(/rss/)).map(([key, url]) => {
    return {
      url: url
    }
  });
  return UrlFetchApp.fetchAll(rssUrls).map(response => new FeedReader(response.getContentText()));
};

const matchStatus = (platform, name, message) => {
  switch(platform.toLowerCase()){
    case "github":
      if(!name.match(/actions|pull\srequests/i)) return 0;
    break;
    case "akamai":
      if(!message.match(/media\sservices\slive/i)) return 0;
    break;
    case "new relic":
      if(!name.match(/US/)) return 0;
    break;
    case "automattic":
      if(!name.match(/wordpress|parse\.ly/i)) return 0;
    break;
  };

  let status = 1;
  if(message.match(/identified|monitoring/i)) status = 2;
  if(message.match(/maintenance|informational|paused|scheduled/i)) status = 3;
  if(message.match(/operational|resolved|completed|closed|fixed|normal|mitigated/i)) status = 4;
  return status;
};

const toSlack = incident => {
  let {platform, name, status, message, link} = incident;
  name = link ? `<${link}|${name}>` : name.replace(/\.(com|ly)/, m => " " + m);

  const s = message.search(/<small>/);
  const e = message.search(/<\/p>/);

  if(!platform.match(/automattic|aws/i)) message = message.substring(s,e)
    .replace(/(<([^>]+)>)/gi, "")
    .replace(/^[\w\D]+(UTC|PDT|PST)/, "")
    .replaceAll(/(?<=\.)[A-Z]/g, m => " " + m)
    .replaceAll(/\bhttps?:\/\/\S+/gi, m => `<${m}|here>.`);
  
  const prefix = status == 1 || status == 2 ? ":alerts: <!here|here>" : status == 3 ? ":warning:" : status == 4 ? ":check-green:" : "";

  return {
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
				  "text": `${platform} ${status == 1 || status == 0 ? "Incident" : "Update"}`
        }
      },
      {
			  "type": "section",
			  "text": {
				  "type": "mrkdwn",
				  "text": `${prefix} *${name}:* _${message ? message : "Status Unavailable"}_`
			  }
		  },
      {
			  "type": "divider"
		  }
    ]
  };
};

const logger = () => {
  const ghURL = PropertiesService.getScriptProperties().getProperty("github_rss");
  const response = UrlFetchApp.fetch(ghURL);
  const ghFeed = new FeedReader(response.getContentText());
  Logger.log(ghFeed.minutesAgo(240));
};