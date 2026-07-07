import assert from "node:assert/strict";
import test from "node:test";

import {
  createAppServer,
  deliverFeedback,
  feedbackEmailHtml,
  replyToEmail,
  sanitizeFeedbackPayload,
} from "../server.mjs";

test("feedback payloads are sanitized without exposing a recipient", () => {
  const sanitized = sanitizeFeedbackPayload({
    name: "  Alice   Analyst  ",
    contact: " alice@example.test ",
    message: "  <script>alert(1)</script>\nKeep map notes.  ",
    page: " https://example.test/map ",
    version: "0.13.0",
  });

  assert.equal(sanitized.name, "Alice Analyst");
  assert.equal(sanitized.contact, "alice@example.test");
  assert.equal(sanitized.message, "<script>alert(1)</script>\nKeep map notes.");
  assert.equal(sanitized.page, "https://example.test/map");
  assert.equal(replyToEmail("alice@example.test"), "alice@example.test");
  assert.equal(replyToEmail("@handle"), undefined);

  const html = feedbackEmailHtml(sanitized);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /FEEDBACK_TO_EMAIL/);
});

test("feedback endpoint fails closed when mail is not configured", async () => {
  const server = createAppServer({});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "A useful suggestion." }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.error, "Feedback mail is not configured.");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("feedback delivery posts to Resend with recipient kept server-side", async () => {
  const previousFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  };

  try {
    const result = await deliverFeedback(
      {
        name: "Analyst",
        contact: "analyst@example.test",
        message: "Please add feedback.",
        page: "https://example.test/",
        version: "0.13.0",
      },
      {
        FEEDBACK_TO_EMAIL: "private@example.test",
        FEEDBACK_FROM_EMAIL: "tool@example.test",
        RESEND_API_KEY: "secret_key",
      }
    );

    assert.deepEqual(result, { ok: true });
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.options.headers.Authorization, "Bearer secret_key");
    const payload = JSON.parse(request.options.body);
    assert.deepEqual(payload.to, ["private@example.test"]);
    assert.equal(payload.reply_to, "analyst@example.test");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
