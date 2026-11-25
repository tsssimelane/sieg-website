# SIEG Address capture billing

The application automatically creates a random browser token in an HttpOnly,
Secure, SameSite=Lax cookie. D1 stores only its hash. The displayed SIEG-DV ID
is public and is not a capture credential. It is associated with the signed-in
account. Each registered browser receives three free new entrance registrations;
existing cards remain available. Historical registrations are retained unchanged.
Clearing cookies or using a different browser can create a new browser ID/free
allowance. This is a browser-level convenience limit, not hardware attestation.
Purchased credits stay with their original browser; cookies must be retained.

## Purchase flow

Request SIEG Addresses automatically fills registered browser IDs; additional
registered browsers under the same account are selected from a list. Each device
has a positive estimated address count; the total is priced at USD 0.25 per
address. Up to ten browsers and 100,000 total addresses are supported per order.
An SMS-verified mobile number is required before a new order can be created.
Verification lasts 30 minutes; OTP codes are handled by Twilio, never stored
locally. Sending is limited to five requests per account per UTC day, one per
minute, with five check attempts per challenge. Configure Twilio Verify Fraud
Guard, geographic permissions and account spend limits in the provider account.

## Production connections still required

The deployed environment currently lacks SMS/payment credentials. No SMS can be
sent and paid checkout remains disabled until these are set as runtime secrets:

- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_VERIFY_SERVICE_SID (a configured Twilio Verify SMS service)
- PAYGATE_ID
- PAYGATE_KEY
- REPORT_CHECKOUT_ENABLED=true
- PAYGATE_CURRENCY=USD (optional; defaults to USD)

Do not add credentials to source or send them to the browser. Configure your
merchant account to accept USD and verify its pricing/minimum transaction size.
A return to the site is never payment proof. PayGate query responses must match
merchant, request, reference, currency and exact server-calculated amount and
have a valid protocol checksum. Only a verified successful payment grants credits.
An address-capture purchase does not require Resend/report email configuration.

The existing PayGate notify callback is used. It needs public ingress or an
approved authenticated relay to reach an owner-private Site. Owner-private
hosting also supports signed-in payment status checks on the return page.
Use a genuine provider sandbox transaction before accepting real customer funds.

## Storage and accounting

Migration 0002 creates browser, mobile-verification and grant tables. Every
capture inserts the address and debits one free/paid credit in one D1 batch
transaction. Duplicate locations and idempotent retries consume no extra credits.
Free credits are used first. Grant rows keyed by order and browser protect against
repeated/concurrent callback/status delivery. The server validates that target
browser IDs belong to the buyer, and calculates quantity x 25 cents itself.
No device fingerprinting, IMEI or phone hardware serial number is collected.
