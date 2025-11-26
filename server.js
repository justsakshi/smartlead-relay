const express = require("express");

// fetch helper for CommonJS
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json());
// Slack interactive payloads are urlencoded
app.use(express.urlencoded({ extended: true }));

// Environment variables
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SMARTLEAD_API_KEY = process.env.SMARTLEAD_API_KEY || "mock-mode";

// Helper to build Slack alert with dropdown
function formatSlackMessage(payload) {
  const {
    event_type,
    campaign_id,
    campaign_name,
    bounce_rate,
    inbox,
    domain,
    time
  } = payload;

  const title = `Smartlead Alert: ${event_type}`;

  const fields = [];

  if (campaign_name) {
    fields.push({ type: "mrkdwn", text: `*Campaign*: ${campaign_name}` });
  }

  if (bounce_rate !== undefined && bounce_rate !== null) {
    fields.push({
      type: "mrkdwn",
      text: `*Bounce rate*: ${bounce_rate} percent`
    });
  }

  if (inbox) {
    fields.push({ type: "mrkdwn", text: `*Inbox*: ${inbox}` });
  }

  if (domain) {
    fields.push({ type: "mrkdwn", text: `*Domain*: ${domain}` });
  }

  const eventTime = time ? new Date(time).toLocaleString() : new Date().toLocaleString();
  fields.push({ type: "mrkdwn", text: `*Time*: ${eventTime}` });

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: title }
    },
    {
      type: "section",
      fields
    }
  ];

  // Add dropdown only if we have a campaign id
  if (campaign_id) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: "campaign_action_select",
          placeholder: {
            type: "plain_text",
            text: "Select campaign action"
          },
          options: [
            {
              text: { type: "plain_text", text: "Resume campaign" },
              value: `resume:${campaign_id}`
            },
            {
              text: { type: "plain_text", text: "Pause campaign" },
              value: `pause:${campaign_id}`
            },
            {
              text: { type: "plain_text", text: "Restart campaign" },
              value: `restart:${campaign_id}`
            }
          ]
        }
      ]
    });
  }

  return {
    text: title,
    blocks
  };
}

// Smartlead event endpoint (already working)
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
    console.error("Error in /smartlead-event", err);
    res.status(500).json({ error: "Failed" });
  }
});

// New endpoint for Slack interactive actions
app.post("/slack-action", async (req, res) => {
  try {
    // Slack sends payload as urlencoded with a "payload" field
    const payload = JSON.parse(req.body.payload);
    const action = payload.actions[0];

    const value = action.selected_option.value; 
    const [command, campaignId] = value.split(":");

    console.log("Slack action received:", command, campaignId);

    let resultMessage;

    if (command === "resume") {
      await mockSmartleadCall("resume", campaignId);
      resultMessage = `Resume requested for campaign ${campaignId}`;
    } else if (command === "pause") {
      await mockSmartleadCall("pause", campaignId);
      resultMessage = `Pause requested for campaign ${campaignId}`;
    } else if (command === "restart") {
      await mockSmartleadCall("restart", campaignId);
      resultMessage = `Restart requested for campaign ${campaignId}`;
    }

    const responseUrl = payload.response_url;
    if (responseUrl) {
      await fetch(responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: resultMessage,
          response_type: "ephemeral",
          replace_original: false
        })
      });
    }

    res.status(200).send(""); 
  } catch (err) {
    console.error("Error in /slack-action", err);
    res.status(500).send("");
  }
});

// MOCK for now
async function mockSmartleadCall(action, campaignId) {
  console.log(`[MOCK] Would call Smartlead API to ${action} campaign ${campaignId}`);
  return;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Relay running on port ${PORT}`);
});
