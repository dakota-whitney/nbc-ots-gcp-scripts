const { parseStringPromise } = require('xml2js');
const { logger } = require("firebase-functions");

exports.FeedReader = class FeedReader {
    constructor(xml, platform, source){
      this._incidents = xml;
      this._source = new URL(source);
      this._platform = platform.split("_").slice(0,-1).map(w => w[0] + w.substring(1).toLowerCase()).join(" ");
    }
    async init(){
      const {rss: {channel: [{item: incidents}]}} = await parseStringPromise(this.incidents);

      this._incidents = incidents.map(incident => {
        const {title:[title], pubDate:[pubDate], description:[description]} = incident;
        const guid = incident.guid ? this.platform.match(/aws/) ? incident.guid._ : incident.guid[0] : null;

        return {
          platform: this.platform,
          name: title,
          created_at: new Date(pubDate).toLocaleString({hour12: true}),
          status: matchStatus(this.platform, title, description),
          link: guid ? guid : this.source.origin,
          id: guid ? guid.split("/").pop() : guid
        };
      });

      return this;
    }
    static async init(...feeds){
      feeds = [...feeds];
      for(const feed of feeds) await feed.init();
      return feeds;
    }
    get platform(){
      return this._platform;
    }
    get incidents(){
      return this._incidents;
    }
    get source(){
      return this._source;
    }
    hoursAgo(hours){
      this._incidents = this.incidents.filter(({name, created_at}) => Math.abs(Date.now() - Date.parse(created_at)) / (60 * 60 * 1000) <= hours && !name.match(/Operational/));
      return this;
    }
    minutesAgo(minutes){
      this._incidents = this.incidents.filter(({name, created_at}) => Math.abs(Date.now() - Date.parse(created_at)) / (60 * 1000) <= minutes && !name.match(/Operational/));
      return this;
    }
    toSlack(){
      return this.incidents.map(incident => toSlack(incident))
    }
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
      if(!name.match(/us\sregion/i)) return 0;
    break;
    case "automattic":
      if(!name.match(/wordpress|parse\.ly/i)) return 0;
    break;
  };

  if(message.match(/identified|monitoring/i)) return 2;
  else if(message.match(/maintenance|informational|paused|scheduled/i)) return 3;
  else if(message.match(/operational|resolved|completed|closed|fixed|normal|mitigated/i)) return 4;
  else return 1;
};

const toSlack = incident => {
  let {platform, name, status, message, link} = incident;

  name = link ? `<${link}|${name}>` : name.replace(/\.(com|ly)/, m => " " + m);

  const s = message.search(/<small>/);
  const e = message.search(/<\/p>/);

  if(platform.match(/aws/i)) message = message.replace(/(?<=<!\[CDATA\[).+(?=\]\])/, m => m);
  else if(!platform.match(/automattic/i)) message = message.substring(s,e)
    .replace(/(<([^>]+)>)/gi, "")
    .replace(/^[\w\D]+(UTC|PDT)/, "")
    .replaceAll(/(?<=\.)[A-Z]/g, m => " " + m);

  return {
    "blocks": [
      {
        "type": "section",
        "text": `*${platform} Incident:* _${name}` + (status == 1 || status == 2) ? " <!here|here>_" : "_"
      },
      {
        "type": "section",
        "text": `*Status*: _${message ? message : "Unavailable"}_`
      }
    ]
  };
};