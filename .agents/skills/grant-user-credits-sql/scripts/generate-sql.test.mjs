import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createDollarQuoteTag,
  createSqlStringLiteral,
  generateSql,
  parseAmountUsd,
  parseCliArgs,
  parseGrantId,
  parseUserId,
} from "./generate-sql.mjs";

const grantId = "123e4567-e89b-42d3-a456-426614174000";

describe("parseAmountUsd", () => {
  it("parses supported whole-dollar inputs exactly", () => {
    assert.deepEqual(parseAmountUsd("25"), {
      amountCents: 2_500n,
      amountUsdMicros: 25_000_000n,
      formattedAmountUsd: "$25.00",
    });
    assert.deepEqual(parseAmountUsd("$25"), parseAmountUsd("25.00"));
  });

  it("converts cents without floating-point arithmetic", () => {
    assert.deepEqual(parseAmountUsd("$12.34"), {
      amountCents: 1_234n,
      amountUsdMicros: 12_340_000n,
      formattedAmountUsd: "$12.34",
    });
  });

  it("rejects invalid and unsafe amounts", () => {
    for (const amount of [
      "",
      "0",
      "0.00",
      "-1",
      "12.345",
      "abc",
      "$ 25",
      "9007199254.75",
    ]) {
      assert.throws(() => parseAmountUsd(amount));
    }
  });

  it("accepts the largest whole-cent value in the safe range", () => {
    assert.equal(
      parseAmountUsd("9007199254.74").amountUsdMicros,
      9_007_199_254_740_000n,
    );
  });
});

describe("input validation", () => {
  it("reports all missing required CLI options", () => {
    assert.throws(() => parseCliArgs([]), /--user-id, --amount-usd/);
    assert.throws(() => parseCliArgs(["--user-id", "user_1"]), /--amount-usd/);
  });

  it("rejects malformed grant IDs", () => {
    assert.throws(() => parseGrantId("not-a-uuid"), /canonical UUID/);
  });

  it("rejects empty, padded, or control-character user IDs", () => {
    for (const userId of ["", " user_1", "user_1 ", "user\n1"]) {
      assert.throws(() => parseUserId(userId));
    }
  });

  it("escapes SQL string literals", () => {
    assert.equal(createSqlStringLiteral("user'o"), "'user''o'");
  });

  it("selects a dollar-quote tag that does not collide with input", () => {
    const baseTag = `$grant_user_credits_${grantId.replaceAll("-", "")}$`;

    assert.equal(
      createDollarQuoteTag([`user${baseTag}`], grantId),
      `$grant_user_credits_${grantId.replaceAll("-", "")}_1$`,
    );
  });
});

describe("generateSql", () => {
  it("generates deterministic, auditable grant SQL", () => {
    const sql = generateSql({
      userId: "user_1",
      amountUsd: "$25",
      grantId,
    });

    for (const fragment of [
      "BEGIN;",
      "FOR UPDATE;",
      "FROM billing_profile",
      "FROM credit_auto_top_up_settings",
      "maximum_safe_integer",
      "UPDATE user_balance",
      "INSERT INTO credit_ledger_entry",
      "'admin_credit_adjustment'",
      "'manual_admin_credit_grant'",
      "'generated_by', 'grant-user-credits-sql'",
      "'admin:credit-adjustment:' || grant_id",
      `'${grantId}'`,
      "25000000",
      "COMMIT;",
      "Direct SQL bypasses realtime balance publication",
    ]) {
      assert.ok(sql.includes(fragment), `expected SQL to include: ${fragment}`);
    }
  });

  it("safely embeds unusual user IDs", () => {
    const sql = generateSql({
      userId: "user'o",
      amountUsd: "12.34",
      grantId,
    });

    assert.match(sql, /grant_user_id CONSTANT text := 'user''o';/);
    assert.match(sql, /12340000 USD micros/);
  });
});
