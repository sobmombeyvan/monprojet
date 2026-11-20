# Résultats des tests — génération du 17/11/2026

## Base de données (PostgreSQL 16)
```
✓ T01 available slots generated: 2026-11-18 09:00:00+01 2026-11-18 09:45:00+01
✓ T02 anon search, filters, ranking & privacy
✓ T03 hold created GLB-261117-0C69A5 price 10000.00
✓ T04 double booking prevented, bookings isolated between clients
✓ T05 frontend cannot confirm bookings nor forge payments
✓ T06 consultants only see their assigned bookings
✓ T07 no privilege escalation (verification, commission, roles)
✓ T08 payment confirmed: processed → replay: already_processed
✓ T09 webhook idempotency & payment state machine
✓ T10 amount mismatch → amount_mismatch
✓ T11 released 1 expired hold; slot re-booked by client2
✓ T12 late payment handled → refund_required
✓ T13 late client cancellation accepted, refund = false
✓ T14 verified reviews, rating aggregation, consultant reply cannot change rating
✓ T15 admin metrics revenue= {"XAF": 20000.00} commissions= {"XAF": 4000.00} (clients denied)
✓ T16 storage isolation
✓ T17 document upload → verification queue
══ ALL DATABASE TESTS PASSED ══
```

## Unitaires (node:test)
```
ok 1 - markdown: headings, lists, emphasis, links
ok 2 - markdown: HTML and javascript: links are neutralised (XSS)
ok 3 - minor units: XAF is zero-decimal, EUR/USD use cents
ok 4 - timestamped signature: valid, tampered body, wrong secret, replay
ok 5 - sandbox provider is disabled in production
ok 6 - webhook: valid event confirms payment exactly once (idempotency)
ok 7 - webhook: forged signature is rejected and logged as invalid
ok 8 - webhook: amount mismatch from provider never confirms
ok 9 - webhook: failed payment goes to failPayment, not confirm
ok 10 - webhook: transient error returns 500 and the retry is processed
ok 11 - stripe: signed checkout.session.completed maps to a verified event
ok 12 - cinetpay: x-token is an HMAC over the documented field order
# tests 12
# pass 12
# fail 0
```
