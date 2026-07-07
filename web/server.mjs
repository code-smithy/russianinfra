import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname);
const runtimeProcess = globalThis.process;
const defaultEnv = runtimeProcess?.env || {};
const port = Number(defaultEnv.PORT || 8000);
const host = defaultEnv.HOST || "127.0.0.1";
const MAX_FEEDBACK_BYTES = 20_000;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
};

function filePathFor(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const target = resolve(join(root, clean === "" ? "index.html" : clean));
  if (!target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  return null;
}

function jsonResponse(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sanitizeText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeFeedbackPayload(payload) {
  return {
    name: sanitizeText(payload?.name, 120),
    contact: sanitizeText(payload?.contact, 180),
    message: String(payload?.message || "").trim().slice(0, 4000),
    page: sanitizeText(payload?.page, 500),
    version: sanitizeText(payload?.version, 40),
  };
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_FEEDBACK_BYTES) {
        rejectBody(new Error("Feedback payload is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolveBody(JSON.parse(body || "{}"));
      } catch {
        rejectBody(new Error("Feedback payload must be valid JSON."));
      }
    });
    req.on("error", rejectBody);
  });
}

function feedbackEmailHtml(feedback) {
  const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
  return `
    <h2>Infrastructure Explorer feedback</h2>
    <p><strong>Name:</strong> ${escape(feedback.name || "Not provided")}</p>
    <p><strong>Reply contact:</strong> ${escape(feedback.contact || "Not provided")}</p>
    <p><strong>Version:</strong> ${escape(feedback.version || "Unknown")}</p>
    <p><strong>Page:</strong> ${escape(feedback.page || "Unknown")}</p>
    <hr>
    <p>${escape(feedback.message).replace(/\n/g, "<br>")}</p>
  `;
}

function replyToEmail(contact) {
  const value = String(contact || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : undefined;
}

async function deliverFeedback(feedback, env = defaultEnv) {
  if (!env.FEEDBACK_TO_EMAIL) {
    return { ok: false, status: 503, error: "Feedback mail is not configured." };
  }
  if (!env.RESEND_API_KEY || !env.FEEDBACK_FROM_EMAIL) {
    return { ok: false, status: 503, error: "Feedback delivery provider is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FEEDBACK_FROM_EMAIL,
      to: [env.FEEDBACK_TO_EMAIL],
      subject: "Infrastructure Explorer feedback",
      html: feedbackEmailHtml(feedback),
      reply_to: replyToEmail(feedback.contact),
    }),
  });

  if (!response.ok) {
    return { ok: false, status: 502, error: "Feedback delivery failed." };
  }
  return { ok: true };
}

async function handleFeedbackRequest(req, res, env = defaultEnv) {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "Method not allowed." });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    jsonResponse(res, 400, { error: error.message });
    return;
  }

  const feedback = sanitizeFeedbackPayload(payload);
  if (!feedback.message) {
    jsonResponse(res, 400, { error: "Feedback message is required." });
    return;
  }

  try {
    const result = await deliverFeedback(feedback, env);
    if (!result.ok) {
      jsonResponse(res, result.status || 502, { error: result.error || "Feedback delivery failed." });
      return;
    }
    jsonResponse(res, 200, { ok: true });
  } catch {
    jsonResponse(res, 502, { error: "Feedback delivery failed." });
  }
}

function createAppServer(env = defaultEnv) {
  return createServer((req, res) => {
    if ((req.url || "").split("?")[0] === "/api/feedback") {
      handleFeedbackRequest(req, res, env);
      return;
    }

    const filePath = filePathFor(req.url || "/");
    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(filePath).pipe(res);
  });
}

if (runtimeProcess?.argv?.[1] && fileURLToPath(import.meta.url) === resolve(runtimeProcess.argv[1])) {
  createAppServer().listen(port, host, () => {
    console.log(`Infrastructure Explorer running at http://${host}:${port}/`);
  });
}

export {
  createAppServer,
  deliverFeedback,
  feedbackEmailHtml,
  handleFeedbackRequest,
  replyToEmail,
  sanitizeFeedbackPayload,
};
