# SIEG Business — directory and annual subscriptions

Added after SIEG Experts in the shared menu, homepage, quick links, footer and enquiry/testimonial choices. Route: `/business`. Sample: `/business?demo=1`.

## Publication and privacy

- An owner selects a saved `addressType: business` entrance from their own SIEG Address register. Every location has its own profile and listing period.
- Address registration and the one-off business address pack do **not** purchase directory visibility.
- Owners explicitly consent to publication of company name, logo, public contacts and entrance coordinates. They may save a private draft without consenting.
- **Publish free for 7 days** starts one trial per saved business entrance, measured from the server clock. No card is required. The trial does not itself authorise automatic charging.
- The listing is visible during that trial or a verified active paid annual term. A request-time check hides expired listings immediately from the list, map, profile and public logo endpoint; no scheduled cleanup job is needed. The private entrance and draft are retained. Re-editing or withdrawing consent does not reset the trial.
- Paid annual renewals need a separate explicit consent at checkout. Owners can stop renewal and retain visibility through the verified paid term. Refunds, disputes, invalid payments and expired terms cannot enable publication. Failed initial checkout does not consume an unexpired trial.
- The map aggregates all matching eligible locations into spatial clusters. Search results paginate 100 at a time; the map shows up to 500 viewport clusters and asks users to zoom/filter if truncated. Logos appear on individual markers from zoom 12 and on company profiles. Sample companies remain separate from live data.
- Directory QR codes and address links use the saved entrance's navigation coordinates, matching SIEG Address. These provisional digital addresses are not official postal addresses or proof of residence.

## Proposed annual price

USD 30 per business location per year (configured default; taxes depend on merchant setup). The seven-day listing is free. This is independent of SIEG Address's existing one-off service fees.

A comparison directory in South Africa lists advanced annual profiles at ZAR 1,599 and premium at ZAR 2,599; USD 30 is a proposed accessible launch price, not a guaranteed customer-acquisition return or a cost-derived price.
https://www.thebusinessdirectory.co.za/compare-listing-packages/

## Enable automated billing

The integration uses Stripe hosted Checkout in `subscription` mode and a one-year recurring Price; card details never enter SIEG storage. Existing PayGate one-off address/report checkout is unchanged.

**Merchant eligibility is a prerequisite:** Eswatini is not currently on Stripe's standard supported merchant-country list. Confirm a legitimately eligible merchant entity/account before enabling this adapter. Do not set a false merchant country. Extended-network availability in another country does not by itself guarantee the Stripe APIs used here. If SIEG will use its Eswatini entity, arrange an eligible recurring-billing provider and implement its equivalent verified adapter before accepting annual subscriptions. PayGate's general PaySubs guide mentions annual billing, but its technical frequency-code documentation currently documents only up to every third month; annual support must be confirmed with the merchant provider rather than inventing a frequency code.

https://stripe.com/global
https://docs.paygate.co.za/paygate-by-network/reference/paysubs-introduction

After merchant approval:
1. Create a **live**, fixed USD 30.00 annual recurring Price, interval `year`, interval count `1`, no trial/discount. Customer directory trials are managed in SIEG, separate from billing.
2. Set private Worker secrets `BUSINESS_STRIPE_SECRET_KEY` and `BUSINESS_STRIPE_WEBHOOK_SECRET`. Never commit or email secret values.
3. Set Worker variables:
   - `BUSINESS_STRIPE_ANNUAL_PRICE_ID=price_...`
   - `BUSINESS_ANNUAL_AMOUNT_CENTS=3000`
   - `BUSINESS_MERCHANT_ELIGIBILITY_CONFIRMED=true`
   - `BUSINESS_SUBSCRIPTIONS_ENABLED=true`
4. Register a **snapshot** HTTPS webhook at `https://www.sieg.ltd/api/business/webhook`. This endpoint must be reachable by Stripe without Cloudflare Access interactive login; protect it with signature verification, not a login wall. Keep owner mutations behind verified identity.
5. Subscribe to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.marked_uncollectible`, `invoice.voided`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `charge.dispute.updated`.
6. Enable Stripe's customer billing portal with payment-method updates and cancellation at the end of the current term. Keep plan switching and discounts disabled for this product. SIEG also provides its own Stop annual renewal button.
7. Enable merchant receipt/failed-payment notifications in the provider dashboard. Complete a provider sandbox acceptance test and a controlled live payment/renewal/cancellation/refund test before advertising checkout as live.

The adapter pins Stripe REST reads to `2024-06-20`, validates the current live annual price, and reconciles current subscription/invoice/charge data from Stripe rather than trusting event arrival order or the browser return. Raw-body HMAC signatures have a five-minute timestamp tolerance; duplicate events reconcile idempotently. Subscriptions bind to the exact owner-created Checkout Session and server-generated attempt. Staging disables charges. Live publication never follows a test-mode payment. No live charge or merchant account setup was performed as part of this code update.

Until configured, owners can save drafts and use their free listing trial; checkout clearly reports that subscriptions are unavailable. The owner-private Sites preview keeps its existing audience. Deploy the updated Cloudflare ZIP to publish the feature at the real custom domain; it is not automatically connected to www.sieg.ltd.

## Storage and deployment

Uses existing D1 `siege_records` kinds `business_profile` and `business_subscription`, and private R2 keys `business/logos/…`. No additional database migration is required. Public responses are explicit field allowlists; raw address/contact records and billing metadata are never returned publicly. Uploaded logos are converted to PNG in the browser, bounded at 2 MB and 2,048 px on the server, and served through entitlement/owner checks with `nosniff` and no-store.

Build: `python3 scripts/build_private_preview.py`. Automated checks: `npm run check`. Directory permission, expiry, payment and signature cases: `cloudflare/business-directory.test.js`.
