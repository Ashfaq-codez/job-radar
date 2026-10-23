import { sendTestMessage } from "./discord.js";

// npm run notify:test → posts one message so you can check the webhook works
if (await sendTestMessage()) console.log("Test message sent. Check your Discord channel.");
