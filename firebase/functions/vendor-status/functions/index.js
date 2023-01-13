const functions = require("firebase-functions");
const fetch = require("node-fetch");
const admin = require("firebase-admin");
const { FeedReader } = require("./feed-reader.js");

admin.initializeApp();

exports.processFeeds = functions.runWith({secrets: ["SLACK_SECRET"]}).https.onRequest(async (request, response) => {

    try{
        const rssUrls = Object.entries(process.env).filter(([env]) => env.match(/_RSS/));
        const { query } = request;
        let payload = [];

        for(const [platform, url] of rssUrls){
            const rss = await fetch(url);
            const xml = await rss.text();

            let feed = await new FeedReader(xml, platform, url).init();
            feed = query.unit == "hours" ? feed.hoursAgo(query.time) : feed.minutesAgo(query.time);

            if(feed.incidents.length == 0) continue;

            functions.logger.log(feed.incidents);
            payload = [...payload,...feed.incidents];

            const webhook = process.env.SLACK_WEBHOOK + process.env.SLACK_SECRET;
            functions.logger.log(webhook);

            if(query.alert) for(const msg in feed.toSlack()) await fetch(webhook, {method: "POST", body: JSON.stringify(msg)});
        };

        payload.sort((a,b) => Date.parse(a.created_at) - Date.parse(b.created_at));
        return response.status(200).json(payload);

    } catch(e) {
        functions.logger.error(e.message);
        return response.status(500).send(e.message);
    };
});