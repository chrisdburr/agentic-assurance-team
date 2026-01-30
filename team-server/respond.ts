#!/usr/bin/env bun
import { handleToolCall } from "./src/tools.js";

// Set Alice as the agent
process.env.AGENT_ID = "alice";

// Respond to the user's message about the new codename
const response = await handleToolCall("message_send", {
  to: "user",
  content: "Confirmed. I've updated my codename to \"Olive Oil\". The previous codename \"caterpillar\" is now retired. Ready for new assignments. —Alice",
  thread_id: "U-_7g2f93y2oWn2YhHluz",
});

console.log("Response sent:");
console.log(JSON.stringify(response, null, 2));

// Mark the message as read
const markRead = await handleToolCall("message_mark_read", {
  message_id: "U-_7g2f93y2oWn2YhHluz",
});

console.log("\nMessage marked as read:");
console.log(JSON.stringify(markRead, null, 2));
