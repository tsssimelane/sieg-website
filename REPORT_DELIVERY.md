# Report collection and verified card delivery

The Python site builder now includes a common report-delivery dialog. Report and
analysed-data exports in Fields, Eco, Hydrology, Estate and Address offer:

1. Collect at SIEG and pay cash. Save an order to the private print queue and,
   when email is configured, send the attached files to support@sieg.ltd.
   Staff print the report and explicitly mark it ready. No browser action can
   automatically print to an office printer that has not been integrated.
2. Pay online with Visa. Use PayGate PayWeb3 hosted checkout; the site never
   collects card details or exposes a settlement bank account. Only a signed,
   server-to-server transaction query with matching merchant, reference,
   transaction ID, amount and currency may release the client email.

## Introductory prices

These are SIEG's chosen introductory prices, not researched market averages.
These are fixed US dollar prices; no live foreign-exchange conversion is applied. Existing orders keep their original quoted currency and amount.
Prices are per report/export request covering one completed analysis area.
Each separate export request creates its own order; there is no subscription.

| Service | USD | Runtime override (integer minor units) |
| --- | ---: | --- |
| Fields | 21 | REPORT_PRICE_FIELDS |
| Eco | 18 | REPORT_PRICE_ECO |
| Hydrology | 27 | REPORT_PRICE_HYDROLOGY |
| Estate | 9 | REPORT_PRICE_ESTATE |
| Address | 12 | REPORT_PRICE_ADDRESS |

Contact details, fee, consent and method are captured before submission. Prices
are calculated server-side; a stale or changed quote is rejected. Same-request
retries reuse the order reference, and email requests use idempotency keys.
There is a 20 MB total attachment limit. The report files remain browser-generated
decision-support outputs with their existing source and coverage limitations;
this change does not add professional sign-off or make client-side analysis a
tamper-proof commercial product.

## Activation requirements

Configure these using Sites runtime secrets, never source files:

- RESEND_API_KEY: transactional email credential.
- REPORT_FROM_EMAIL: verified sender on the SIEG domain, e.g. SIEG <reports@sieg.ltd>.
- PAYGATE_ID and PAYGATE_KEY: live merchant ID and encryption key.
- PAYGATE_CURRENCY: default USD. Confirm the currency and settlement account with
  the merchant provider. Currency conversion is not implemented; if switching
  currency, update all prices in the new currency's minor units.
- REPORT_CHECKOUT_ENABLED: leave absent/false until merchant onboarding,
  supported Visa/currency settings, email delivery and callbacks have been tested.
  Set to true only after successful end-to-end testing.

The merchant gateway settles funds to the bank account configured in its merchant
portal. An ordinary bank account number cannot receive web card payments by itself.
No bank details are displayed in the UI, reports or requester messages.

### Callback access on a private Site

The Site currently remains owner-private. The platform will block unauthenticated
external gateway webhooks; a callback cannot bypass that platform boundary.
Before enabling live checkout, arrange a publicly reachable authenticated gateway
relay or explicitly choose appropriate public hosting for the payment endpoints.
Do not change the Site audience solely as an implementation workaround.
The return page also queries the gateway after the customer signs back in, and
staff can reconcile pending orders in the queue. Those checks are a recovery
path, not a guarantee of unattended fulfilment if a customer never returns.

PayGate return POSTs redirect to a GET page; their browser-supplied payment status
is ignored. Only verified gateway queries change payment state. Webhook retries
and manual status checks use the same delivery idempotency key. Test first with
the provider's separate test merchant credentials and a verified email sender.

## Staff operation

The existing Resources page has a Reports & collection section visible only to
the existing SIEG administrator. Access is enforced on the server by the trusted
Sites identity. Open the files, print, mark ready, then record cash on collection.
Marking ready emails the client only if email is configured. Online paid reports
are attached to the client email, then their stored file copy is deleted.

Without email configuration, collection orders are still saved durably with an
explicit pending-notification message; nothing claims that a report was emailed,
printed or ready. Visa is unavailable until all activation settings are present.
Staff must monitor/retry queued emails. Order metadata and collection files are
retained until staff remove them using the storage administration process;
define an operational retention policy before public launch. Never retain files
longer than needed. Resend idempotency keys last 24 hours: reconcile uncertain
email outcomes before retrying beyond that period.

The optional old Python SMTP bank-transfer endpoints now return HTTP 410 and do
not send account details. The hosted Worker owns this fulfilment flow.

## Verification

Run `node scripts/test_report_delivery.cjs` for order, price, authentication,
collection, checksum, payment mismatch, cancellation, verified email and retry
tests. No tests make real payments or send live email.

Integration references:
- https://docs.paygate.co.za/paygate-by-network/reference/initiate-request
- https://docs.paygate.co.za/paygate-by-network/reference/security-and-checksum-validation
- https://docs.paygate.co.za/paygate-by-network/reference/query-transaction-status
- https://docs.paygate.co.za/paygate-by-network/reference/notify-url-response
- https://resend.com/docs/api-reference/emails/send-email
