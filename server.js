const express = require("express");

// fetch for CommonJS
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Slack tokens
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SMARTLEAD_API_KEY = process.env.SMARTLEAD_API_KEY || "mock-mode";

// Builds Slack message with dropdown
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

  if (campaign_name) fields.push({ type: "mrkdwn", text: `*Campaign*: ${campaign_name}` });
  if (bounce_rate) fields.push({ type: "mrkdwn", text: `*Bounce rate*: ${bounce_rate} percent` });
  if (inbox) fields.push({ type: "mrkdwn", text: `*Inbox*: ${inbox}` });
  if (domain) fields.push({ type: "mrkdwn", text: `*Domain*: ${domain}` });

  const eventTime = time ? new Date(time).toLocaleString() : new Date().toLocaleString();
  fields.push({ type: "mrkdwn", text: `*Time*: ${eventTime}` });

  const blocks = [
    { type: "header", text: { type: "plain_text", text: title } },
    { type: "section", fields }
  ];

  if (campaign_id) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: "campaign_action_select",
          placeholder: { type: "plain_text", text: "Select action" },
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

  return { blocks };
}

// Smartlead event → Slack alert
app.post("/smartlead-event", async (req, res) => {
  try {
    const payload = req.body;
    const message = formatSlackMessage(payload);

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify({
        channel: "smartlead-alerts",
        ...message
      })
    });

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Error sending Slack message", err);
    res.status(500).json({ error: "Failed" });
  }
});

// Slack dropdown action handler
app.post("/slack-action", async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload);
    const action = payload.actions[0];
    const [command, campaignId] = action.selected_option.value.split(":");

    console.log("Slack action:", command, "for campaign", campaignId);

    const responseUrl = payload.response_url;

    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${command} requested for campaign ${campaignId}`,
        response_type: "ephemeral"
      })
    });

    res.status(200).send();
  } catch (err) {
    console.error("Slack action error", err);
    res.status(500).send();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay running on port ${PORT}`));
