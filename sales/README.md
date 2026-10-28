# Ride For You Sales

Owner dashboard for individual bike inventory and branded PDF invoices. The database is independent from the rental app. Uses the mobile logo from ride-for-you/mobile/assets/icon.png.

## Start

Requires Node.js 24+. Run npm ci, then npm start in this sales directory. Open http://127.0.0.1:3050 and sign in with your approved WhatsApp number.

The private .env holds Way2Chats credentials, OTP_ALLOWED_PHONES and a persistent random OTP_HASH_SECRET. See .env.example. Missing configuration fails closed. There is no password, fixed OTP, console OTP or development bypass. The provider template is otp in English. Provider acceptance does not prove handset delivery.

Codes expire after five minutes, allow five incorrect attempts and work once. Resending requires 60 seconds. Per-phone and per-IP hourly limits constrain requests. Code hashes use secret HMAC and session tokens are hashed in SQLite. Old password sessions are invalidated without changing business records.

## Workflow

1. Complete Business settings: dealership name, address, contact, prefix and terms.
2. Add bikes individually, or select Bike inventory > Bulk upload.
3. Download the CSV template. Required columns: brand,model,vin,cost,price. Optional: color,battery,notes. Replace the example row with your actual inventory.
4. Export Excel/Google Sheets to CSV. Use unique chassis numbers and rupee amounts without currency symbols or thousands separators. Preserve leading zeroes in chassis fields as text in the spreadsheet.
5. Preview up to 500 rows / 800 KB. Correct all errors. Import saves all rows or none. Existing/duplicate chassis and invalid amounts are rejected. Imported bikes start Available.
6. Create an invoice with customer and selected bikes. Review prices, discount, manually entered tax and amount received before issuing.
7. Issuing marks bikes Sold and captures immutable details. Download the PDF with customer, chassis, payment, total, received and balance sections. Existing amounts and seller snapshots remain unchanged.

Lists export CSV; invoices filter by month. Data is in data/sales.sqlite. Back up the entire data directory while stopped, including SQLite WAL files, and protect .env. No test sales/inventory are inserted into the real workspace.

## Scope

Single shared owner workspace: all allowed numbers have full access. No customer app, rental integration, payroll, online payments, cancellation/refunds, post-invoice payment editing, GST filing or e-invoice integration. Outstanding amounts reflect payments recorded at issue. Verify manually entered tax/invoice details with your accountant.

Default local binding is loopback only. PDF fonts are Bitstream Vera; the redistribution license is included in assets/font-license.txt.

## Production at /sales

The rental backend proxies only /sales to SALES_SERVICE_URL. Run this directory as a separate Node 24 service with its own persistent /data volume. Do not share the rental PostgreSQL database or copy local test inventory into production.

Railway sales service settings:

- Root directory: /sales; Dockerfile: Dockerfile; watch pattern: /sales/**.
- Health check: /health. Use one replica with this SQLite volume.
- NODE_ENV=production, HOST=::, PORT=3050, BASE_PATH=/sales, DATA_DIR=/data.
- PUBLIC_ORIGIN must be the exact HTTPS origin of the rental domain, without /sales.
- Configure the WhatsApp variables and approved numbers privately, as described above.
- On the rental backend, set SALES_SERVICE_URL=http://ride-for-you-sales.railway.internal:3050.

The public entry point is https://YOUR-RENTAL-DOMAIN/sales/. Session cookies are secure and scoped to /sales/. Keep the sales service private. Its startup creates empty business tables and does not seed bikes or invoices. Back up the volume and verify restores before relying on it for business records.

GST registration details alone do not make the current invoice a GST tax invoice. HSN, place of supply, tax-inclusive/exclusive pricing, tax breakups and applicable statutory requirements still need a separate implementation and accountant review.

## Verification

npm test creates a disposable SQLite database and mock WhatsApp endpoint. It checks allowlisting, disabled password routes, OTP replay/lockout/resend limits, provider failures, atomic CSV import/retries, sales posting, totals and PDF generation. Automated tests do not send real messages.
