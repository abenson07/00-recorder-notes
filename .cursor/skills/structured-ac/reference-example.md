# Reference: bucket detail verification (budget-004)

Example of the expected level of detail and phrasing. Adapt routes, labels, and data to the actual feature.

---

Human guide: verify bucket detail (budget-004)

Use this as a step-by-step checklist in the running app (mock data or Supabase after sync).

Before you start

Run the app (`npm run dev`) and open it in the browser.

Open the Dashboard so you see buckets and Account balance / Safe to spend. Note the account balance number (you’ll compare it after transfers).

A. Bucket detail page

On the Dashboard, click a bucket (any card).

Confirm you land on a URL like `/buckets/<uuid>`.

Confirm you see:

Bucket name and balance (big number).

Kind (e.g. Essential / Discretionary / Unassigned) and, for essential buckets, subtype (Bill vs Essential spending) when it applies.

In Rules & dates, confirm Top off and Percentage show values or — if empty.

For a bill essential bucket (e.g. Rent, Utilities in demo data), confirm Due date and Alert date appear.

B. Assigned transactions

On the same bucket page, find Assigned transactions.

If this bucket appears in any transaction splits (or as primary_bucket_id), confirm rows show date, merchant, and amount from this bucket.

Click a merchant name (link). Confirm you go to `/transactions/<id>` and the transaction detail loads.

Pick a bucket that has no allocations; confirm the section says there are no transactions for that bucket (or an empty state message).

C. Transfers (balance math)

Open a bucket with balance > 0 and at least one other bucket exists (otherwise the transfer block is hidden).

Choose a destination bucket and enter a transfer amount smaller than the source balance.

Click Transfer.

Confirm:

Source balance went down by exactly that amount.

Destination balance went up by the same amount (open its bucket page or Dashboard cards).

Return to the Dashboard and confirm Account balance is unchanged from step “Before you start.”

Try a bad transfer: amount larger than source balance (or 0 / empty / negative). Confirm you see an error and balances do not change incorrectly.

D. Editing a bucket

On a bucket detail page, scroll to Edit bucket.

Change Name and Order, click Save changes. Confirm you see Saved. and the header (and Dashboard list order) reflect the change.

Toggle Type (e.g. Essential ↔ Discretionary) and/or Essential subtype (Bill ↔ Essential spending). Save.

For Bill, set Due and Alert dates (required); save and confirm Rules & dates updates.

Set Top off to a number (or clear it) and Percentage as 0–100 (or clear); save and confirm Rules & dates matches.

Return to the Dashboard:

Safe to spend should change if you moved a bucket between discretionary and essential.

Bucket order should match the order values you saved.

E. Optional: Supabase

With `.env.local` configured, use whatever flow you already have to sync / load from Supabase.

Repeat C (transfer) and D (edit), then refresh the page (or reload the app). Confirm values persist (balances after transfer, name/order/type/rules/dates after edit).

Done when

Detail page shows correct identity, balance, rules, and bill dates where applicable.

Transactions table + links work.

Transfers move money between buckets only; account balance on Dashboard stays flat.

Edits show up immediately on detail + Dashboard (safe to spend + ordering).
