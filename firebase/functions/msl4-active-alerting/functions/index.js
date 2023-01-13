const functions = require("firebase-functions");
const EdgeGrid = require("akamai-edgegrid");
const fetch = require("node-fetch");
const admin = require("firebase-admin");
admin.initializeApp();

const reqMinutes = (edgeGrid, cpCode, query) => new Promise((res, rej) => {
    const today = new Date();
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1);

    const start = query.from ? query.from : yesterday.toLocaleDateString();
    const end = query.to ? query.to : today.toLocaleDateString();

    edgeGrid.auth({
        path: `/media-reports/v1/media-services-live/http-ingest/data?cpcodes=${cpCode}&dimensions=5002&metrics=5003&endDate=${encodeURIComponent(end)}&startDate=${encodeURIComponent(start)}&offset=0&limit=30`,
        method: 'GET',
        headers:{}
    });

    edgeGrid.send((error, response, body) => {
        if(error || !body || response.status >= 400) return rej(error ? error.message : "Request failed");

        const { aggregate: minutes } = JSON.parse(body).columns[1];
        functions.logger.log(query.market ? query.market : cpCode, minutes);

        const payload = {
            cpCode: cpCode,
            minutes: minutes
        };
        if(query.market) payload.market = query.market;

        return res(payload);
    });
});

exports.getIngestUsage = functions.region("us-east4").runWith({secrets: ["EG_CLIENT_SECRET"]}).https.onRequest(async (request, response) => {
   try{
        //const { EG_CLIENT_TOKEN, EG_CLIENT_SECRET, EG_ACCESS_TOKEN, EG_BASE_URI, APPS_SCRIPT } = process.env;
        const edgeGrid = new EdgeGrid(
            process.env.EG_CLIENT_TOKEN,
            process.env.EG_CLIENT_SECRET,
            process.env.EG_ACCESS_TOKEN,
            process.env.EG_BASE_URI
        );
        const { query, method, originalUrl } = request;
        let payload;

        functions.logger.log(`Received ${method} request: ${originalUrl}`);

        if(!query.cpCode){
            const egReqs = Object.entries(process.env).filter(([key]) => key.match(/_CP/)).map(([market, cpCode]) => {
                market = market.split("_").slice(0, -1).map(w => w[0] + w.substring(1).toLowerCase()).join(" ");
                return reqMinutes(edgeGrid, cpCode, {market: market});
            });
            const results = await Promise.allSettled(egReqs);
            payload = results.filter(r => r.value).map(({value}) => value).sort((a,b) => b.minutes - a.minutes);
            functions.logger.log("Markets returned: " + payload.length);
        }
        else payload = await reqMinutes(edgeGrid, query.cpCode);

        functions.logger.log(payload);

        if(query.send) await fetch(process.env.APPS_SCRIPT, {method: "POST", body: JSON.stringify(payload)});

        return response.status(200).json(payload);
    }
    catch(e) {
        functions.logger.error(e.message);
        return response.status(500).send(e.message);
    };
});