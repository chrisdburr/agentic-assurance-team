#!/usr/bin/env bun
import { handleToolCall } from "./src/tools.js";

// Set Alice as the agent
process.env.AGENT_ID = "alice";

// Check unread messages in team channel
console.log("=== Checking team channel for unread messages ===");
const teamResult = await handleToolCall("channel_read", {
  channel: "team",
  unread_only: true,
});
console.log(JSON.stringify(teamResult, null, 2));

// Also check if there are any direct messages
console.log("\n=== Checking direct messages ===");
const messagesResult = await handleToolCall("message_list", {
  unread_only: true,
});
console.log(JSON.stringify(messagesResult, null, 2));
