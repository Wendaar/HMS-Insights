import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/admin/import-game.js";

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}

test("missing preview configuration is 503, not a misleading wrong-secret error", async () => {
  const original = { token: process.env.HMS_API_TOKEN, secret: process.env.HMS_WEBHOOK_SECRET };
  try {
    for (const [token, secret] of [[undefined, undefined], ["token-sentinel", undefined], [undefined, "secret-sentinel"], ["  ", "secret-sentinel"]]) {
      if (token === undefined) delete process.env.HMS_API_TOKEN; else process.env.HMS_API_TOKEN = token;
      if (secret === undefined) delete process.env.HMS_WEBHOOK_SECRET; else process.env.HMS_WEBHOOK_SECRET = secret;
      const res = response();
      await handler({ method: "POST", headers: { authorization: "Bearer supplied-sentinel" } }, res);
      assert.equal(res.code, 503);
      assert.match(res.body.error, /není nakonfigurovaný/);
      assert.doesNotMatch(JSON.stringify(res.body), /sentinel|Nesprávný secret/);
      assert.equal(res.headers["cache-control"], "no-store");
    }
    process.env.HMS_API_TOKEN = "token-sentinel";
    process.env.HMS_WEBHOOK_SECRET = "secret-sentinel";
    const res = response();
    await handler({ method: "POST", headers: { authorization: "Bearer wrong-sentinel" } }, res);
    assert.equal(res.code, 401);
    assert.doesNotMatch(JSON.stringify(res.body), /sentinel/);
  } finally {
    if (original.token === undefined) delete process.env.HMS_API_TOKEN; else process.env.HMS_API_TOKEN = original.token;
    if (original.secret === undefined) delete process.env.HMS_WEBHOOK_SECRET; else process.env.HMS_WEBHOOK_SECRET = original.secret;
  }
});
