import assert from "node:assert/strict";
import test from "node:test";
import { messages, supportedLocales } from "./messages.js";

test("supported locales define mute and unmute video messages", () => {
  for (const locale of supportedLocales) {
    const localeMessages = messages[locale];
    assert.ok(localeMessages, `messages for ${locale} must exist`);
    assert.ok(typeof localeMessages.muteVideo === "string" && localeMessages.muteVideo.length > 0, `muteVideo for ${locale} must be defined`);
    assert.ok(typeof localeMessages.unmuteVideo === "string" && localeMessages.unmuteVideo.length > 0, `unmuteVideo for ${locale} must be defined`);
  }
});
