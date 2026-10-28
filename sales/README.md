# Ride For You Sales

Owner dashboard for individual bike inventory and branded PDF invoices. The database is independent from the rental app. Uses the mobile logo from ride-for-you/mobile/assets/icon.png.

## Start

Requires Node.js 24+. Run npm ci, then npm start in this sales directory. Open http://127.0.0.1:3050 and sign in with your approved WhatsApp number.

The private .env holds Way2Chats credentials, OTP_ALLOWED_PHONES and a persistent random OTP_HASH_SECRET. See .env.example. Missing configuration fails closed. There is no password, fixed OTP, console OTP or development bypass. The provider template is otp in English. Provider acceptance does not prove handset delivery.

Codes expire after five minutes, allow five incorrect attempts and work once. Resending requires 60 seconds. Per-phone and per-IP hourly limits constrain requests. Code hashes use secret HMAC and session tokens are hashed in SQLite. Old password sessions are invalidated without changing business records.

## Workflow

1. Review Business settings: legal dealership name, GSTIN, registered state/address, contact, prefix, next number and terms. The supplied Ride For You company details are prefilled for a new/default workspace. Other existing seller identities are not replaced.
2. Add bikes individually, or select Bike inventory > Bulk upload.
3. Download the CSV template. Required columns: brand,model,vin,cost,price. Optional: color,battery,notes,hsn. Replace the example row with your actual inventory. The HSN default is 871160 for complete electric two-wheelers; confirm the actual classification and choose a more specific subtype where appropriate.
4. Export Excel/Google Sheets to CSV. Use unique chassis numbers and rupee amounts without currency symbols or thousands separators. Preserve leading zeroes in chassis fields as text in the spreadsheet.
5. Preview up to 500 rows / 800 KB. Correct all errors. Import saves all rows or none. Existing/duplicate chassis and invalid amounts are rejected. Imported bikes start Available.
6. Create an invoice with buyer billing state, optional buyer GSTIN, delivery address and actual place of supply. Explicitly choose GST-inclusive or exclusive prices. Complete EV GST is fixed at 5%; the server calculates 2.5% CGST plus 2.5% SGST/UTGST for same-state supplies, or 5% IGST for interstate supplies. It allocates discounts proportionally in paise and shows rounding adjustments explicitly.
7. Add the vehicle, battery, motor and charger warranty, provider, start date and coverage/exclusions promised by the seller. No warranty periods are assumed. Common terms apply to every bike on that invoice; issue separately if warranties differ.
8. Review the on-screen tax invoice or download a clearly marked draft PDF. Drafts do not consume invoice numbers or change stock. Review shows the proposed PREFIX/FY/00001 number; compare it with invoices issued outside the app.
9. Confirm the classification, tax basis, place of supply and numbering, then issue. Posting atomically captures immutable invoice/warranty details, increments the financial-year sequence and marks bikes Sold. A review hash rejects changed seller/bike/numbering details; request hashes reject changed retries. Download recipient, transporter or supplier PDFs and obtain the seller's authorised signature.

Lists export CSV; invoices filter by month. Data is in data/sales.sqlite. Back up the entire data directory while stopped, including SQLite WAL files, and protect .env. No test sales/inventory are inserted into the real workspace.

## Scope

Single shared owner workspace: all allowed numbers have full access. Regular domestic sales of complete electric two-wheelers only. Separate batteries, chargers, spare parts, exports, SEZ and reverse-charge sales are excluded. No customer app, rental integration, payroll, online payments, cancellation/refunds, post-invoice payment editing, GST returns or IRP integration. Outstanding amounts reflect payments recorded at issue.

B2C invoices are supported. For GST-registered buyers, the owner must confirm B2B e-invoicing applicability with their accountant in Business settings. If an IRN is required, posting is blocked until an appropriate IRP workflow is available; the software does not invent an IRN or signature. Check GSTINs, actual HSN classification, numbering and tax treatment with the accountant. GSTIN checksum validation does not verify live registration status.

Default local binding is loopback only. PDF fonts are Bitstream Vera; the redistribution license is included in assets/font-license.txt.

## Production at /sales

The rental backend proxies only /sales to SALES_SERVICE_URL. Run this directory as a separate Node 24 service with its own persistent /data volume. Do not share the rental PostgreSQL database or copy local test inventory into production.

Railway sales service settings:

- Root directory: /sales; Dockerfile: Dockerfile; watch pattern: /sales/**.
- Health check: /health. Use one replica with this SQLite volume.
- NODE_ENV=production, HOST=::, PORT=3050, BASE_PATH=/sales, DATA_DIR=/data.
- PUBLIC_ORIGIN must be the exact HTTPS origin of the rental domain, without /sales.
- ADDITIONAL_PUBLIC_ORIGINS is an optional comma-separated list of other exact approved origins. The custom website rideforyouev.com proxies /sales to the public rental backend, so its origin must be explicitly listed here. Wildcard origins are not accepted.
- Configure the WhatsApp variables and approved numbers privately, as described above.
- On the rental backend, set SALES_SERVICE_URL=http://ride-for-you-sales.railway.internal:3050.

The public entry point is https://YOUR-RENTAL-DOMAIN/sales/. Session cookies are secure and scoped to /sales/. Keep the sales service private. Its startup creates empty business tables and does not seed bikes or invoices. Back up the volume and verify restores before relying on it for business records.

Before the first production GST schema upgrade, the service saves a consistent SQLite snapshot under /data/backups/ using VACUUM INTO. The schema/profile upgrade runs in a transaction. Existing issued invoice JSON is not rewritten; legacy invoices retain their old layout and amounts. Keep separate ongoing backups and verify restores.

Classification and rate references: [DGCI&S Chapter 87](https://www.dgciskol.gov.in/writereaddata/Downloads/20170601190103CHP_87.pdf), [2024 Gazette adding the pedal-assisted subtype](https://egazette.gov.in/WriteReadData/2024/256436.pdf), [PIB EV tax guidance](https://www.pib.gov.in/PressNoteDetails.aspx?ModuleId=3&NoteId=159436&lang=1&reg=3), and [GST invoice particulars](https://tutorial.gst.gov.in/downloads/news/welcome_kit_for_new_taxpyers.pdf). The 871160 preset is an existing classification, not a newly generated per-bike number.

## Verification

npm test creates disposable SQLite databases and a mock WhatsApp endpoint. It covers auth, CSV atomicity/retries, inclusive/exclusive GST, 500 discount/rounding scenarios, state and GSTIN validation, FY boundaries, migration snapshots, stock locks, numbering, stale reviews, idempotency, warranty snapshots, B2B IRN guards and PDFs. Automated tests do not send real messages or insert demo records into production.
