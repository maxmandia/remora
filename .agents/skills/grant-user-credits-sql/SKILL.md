---
name: grant-user-credits-sql
description: Generate safe, auditable PostgreSQL for granting, gifting, adding, or issuing free credits to a Remora user. Use when an operator wants SQL for a positive admin credit grant and can provide the immutable user ID and USD amount. Generate SQL only; never connect to or mutate a database.
---

# Grant User Credits SQL

## Workflow

1. Collect the immutable Remora user ID and positive USD amount. If either is missing, ask for all missing values in one question. Do not ask again for supplied values.
2. Run the bundled generator without a grant ID so it creates a fresh, fixed UUID:

   ```bash
   node .agents/skills/grant-user-credits-sql/scripts/generate-sql.mjs \
     --user-id '<user-id>' \
     --amount-usd '<amount>'
   ```

3. Return the generator output verbatim in a `sql` code block. State the USD-to-micros conversion and remind the operator that the recipient may need to refresh or reopen the app because direct SQL bypasses realtime publication.

## Guardrails

- Generate positive grants only. Do not offer debits, reversals, refunds, or balance replacement.
- Accept USD amounts with at most two decimal places. Let the generator perform exact integer conversion and validation.
- Never hand-edit the generated SQL. Regenerate it when an input changes.
- Never invoke Railway, inspect production data, connect to a database, or execute the SQL.
- Keep the generated grant ID unchanged so rerunning the same SQL cannot apply the grant twice.
- Treat generator errors as blocking validation failures and report them directly.
