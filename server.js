const express = require("express");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;


function formatSlackMessage(payload) {
  const { event_type, campaign_name, bounce_rate, inbox, time } = payload;

  return {
    text: `Smartlead Alert: ${event_type}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `Smartlead Alert: ${event_type}` }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Campaign*: ${campaign_name}` },
          bounce_rate
            ? { type: "mrkdwn", text: `*Bounce rate*: ${bounce_rate} percent` }
            : { type: "mrkdwn", text: "\u200B" },
          inbox
            ? { type: "mrkdwn", text: `*Inbox*: ${inbox}` }
            : { type: "mrkdwn", text: "\u200B" },
          { type: "mrkdwn", text: `*Time*: ${new Date(time).toLocaleString()}` }
        ]
      }
    ]
  };
}

app.post("/smartlead-event", async (req, res) => {
  try {
    const payload = req.body;

    const slackMessage = formatSlackMessage(payload);

    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage)
    });

    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

app.listen(3000, () => {
  console.log("Relay running on http://localhost:3000");
});
