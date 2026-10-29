# Ride For You Sales

Owner dashboard for individual bike inventory, branded PDF invoices and after-sales service. The database is independent from the rental app. Uses the Ride For You EV logo supplied by the client, stored at public/logo.png.

Separate battery inventory/sales and printable bike quotations are included. See [ARCHITECTURE.md](ARCHITECTURE.md) for the module structure, shared business rules and upgrade process.

## Start

Requires Node.js 24+. Run npm ci, then npm start in this sales directory. Open http://127.0.0.1:3050 and sign in with your approved WhatsApp number.

The private .env holds Way2Chats credentials, OTP_ALLOWED_PHONES and a persistent random OTP_HASH_SECRET. See .env.example. Missing configuration fails closed. There is no password, fixed OTP, console OTP or development bypass. The provider template is otp in English. Provider acceptance does not prove handset delivery.

Codes expire after five minutes, allow five incorrect attempts and work once. Resending requires 60 seconds. Per-phone and per-IP hourly limits constrain requests. Code hashes use secret HMAC and session tokens are hashed in SQLite. Old password sessions are invalidated without changing business records.

## Workflow

1. Review Business settings: legal dealership name, GSTIN, registered state/address, contact, prefix, next number and terms. The supplied Ride For You company details are prefilled for a new/default workspace. Other existing seller identities are not replaced.
2. Add bikes individually, or select Bike inventory > Bulk upload.
3. Download the CSV template. Required columns: brand,model,vin,cost,price. Optional: color,battery,motor,controller,charger,notes,hsn. Replace the example row with your actual inventory. Component serials are separate fields and checked for duplicates per component type. The HSN default is 871160 for complete electric two-wheelers; confirm the actual classification and choose a more specific subtype where appropriate.
4. Export Excel/Google Sheets to CSV. Use unique chassis numbers and rupee amounts without currency symbols or thousands separators. Preserve leading zeroes in chassis fields as text in the spreadsheet.
5. Preview up to 500 rows / 800 KB. Correct all errors. Import saves all rows or none. Existing/duplicate chassis and invalid amounts are rejected. Imported bikes start Available.
6. Create an invoice with buyer billing state, optional buyer GSTIN, delivery address and actual place of supply. Explicitly choose GST-inclusive or exclusive prices. Complete EV GST is fixed at 5%; the server calculates 2.5% CGST plus 2.5% SGST/UTGST for same-state supplies, or 5% IGST for interstate supplies. It allocates discounts proportionally in paise and shows rounding adjustments explicitly.
7. Select the actual chassis and enter or confirm separate battery, motor, controller and charger numbers on each invoice line. Add the vehicle/component warranties, provider, start date and coverage/exclusions promised by the seller. Missing serials show Not recorded; no identifiers or warranty periods are invented. Common warranty terms apply to every bike on that invoice; issue separately if warranties differ.
8. Review the on-screen tax invoice or download a clearly marked draft PDF. Drafts do not consume invoice numbers or change stock. Review shows the proposed PREFIX/FY/00001 number; compare it with invoices issued outside the app.
9. Confirm the classification, tax basis, place of supply and numbering, then issue. Posting atomically captures immutable invoice/warranty details, increments the financial-year sequence and marks bikes Sold. A review hash rejects changed seller/bike/numbering details; request hashes reject changed retries. Download recipient, transporter or supplier PDFs and obtain the seller's authorised signature.

All invoice PDFs use one printable A4 portrait page, including warranty and signatures. Layout is measured before output, using body text no smaller than 7.5 points. Overlong drafts are rejected with a clear message before stock or numbers change; use fewer bikes or concise terms. Content is never silently truncated or pushed onto another page. Existing invoices are reflowed without altering their stored amounts, tax treatment or terms.

Lists export CSV; invoices filter by month. Data is in data/sales.sqlite. Back up the entire data directory while stopped, including SQLite WAL files, and protect .env. No test sales/inventory are inserted into the real workspace.

## Scope

Single shared owner workspace: all allowed numbers have full access. Regular domestic sales of complete electric two-wheelers and separately tracked batteries are supported. Separate chargers/other spare parts, exempt/nil-rated bill-of-supply, cess, exports, SEZ and reverse-charge sales are excluded from this tax-invoice workflow. No customer app, technician login, rental integration, payroll, online payments, cancellation/refunds of invoices, post-invoice payment editing, GST returns or IRP integration. Sale invoice balances reflect payments recorded at issue; service receipts have their own balance ledger.

## Batteries and quotations

- Batteries > Add battery records one physical pack with its serial, specification, cost, price and warranty. Enter HSN and GST manually from the actual product classification. These may be left incomplete in inventory, but must be filled and explicitly confirmed before issuing a separate battery invoice. A battery invoice preserves the chosen tax, serial and warranty details and uses the same legal invoice sequence as bike sales.
- Battery history shows available, sold or installed stock, the sale customer/invoice or installed bike, and stock events. Bike service parts can select an available stock battery; handover consumes it as installed. Used stock cannot be sold again.
- Quotations > Create quotation selects one available bike, customer details, price basis, discount, validity, warranty and terms. Review, generate, then print or download its one-page PDF. Quotations are clearly marked as price offers, not tax invoices. They do not reserve stock or consume sales invoice numbers.
- A valid issued/accepted quotation can prepare a bike invoice. Customer, price, warranty and terms are prefilled, then reviewed again before issue. Conversion rechecks availability and links the quotation atomically. Cancelled, expired and converted quotes cannot be reused for another invoice.

## After-sales service

1. Add technicians in Technicians. The owner assigns and manages their work. Deactivation preserves history and prevents further assignment.
2. Open a sold bike through Inventory > History & service, or from its original invoice. The vehicle passport shows the original sale, warranty, currently installed component numbers and all service visits.
3. Service desk > Register complaint starts one visit for a bike with an issued invoice. Search by chassis/model/component number. Enter the customer's complaint, odometer, due date and technician. Intake does not ask for completed work or charges; the API rejects those details on new complaints. Missing component numbers can be filled at intake; existing numbers cannot be silently overwritten.
4. Open the job card and select Start service. The normal path is Complaint registered > Under service > Service completed > Handed over. An active technician is required to start. Services carried out, parts and charges appear after service begins. Record the actual work, one service per line, then select Complete service. Inspection notes are optional. Completed work is required; the original complaint is preserved once work starts. Existing inspection/waiting-for-parts states remain supported. Closed visits remain read-only.
5. Record parts, internal cost, customer charge and labour separately. For a serialized replacement choose the component type, quantity one and actual new number. Warranty/goodwill jobs have zero customer charge while retaining internal costs; coverage is reviewed by the owner against original terms. Completing service records its timestamp and technician name.
6. Record actual service receipts using Cash, UPI or Bank transfer. Overpayments and reducing charges below recorded receipts are rejected. Delivery requires full service payment or explicit owner approval of an outstanding balance. Later receipts may settle that balance.
7. Select Hand over bike after payment, or explicitly approve the outstanding balance. At handover, replacements update the bike's current numbers atomically and preserve removed serials and a before/after event. The original sale invoice is never rewritten. Another visit starts a new complaint. Each bike's history shows every visit with the complaint, services carried out, technician, parts, charges and receipts together. A component number cannot move silently to another bike.

Service charges/receipts are operational job records, not GST service tax invoices. No EV sales tax rate is applied to labour or repairs. Dedicated GST service billing, spare-parts stock deduction, refunds and customer notifications are outside this version. Parts here are a job usage/cost record, not a spare-parts stock ledger.

Each update requires the latest job revision to prevent stale overwrites. Job and receipt creation have idempotency keys and request hashes. One open job per bike is enforced in SQLite. Service events preserve work changes and assignments. Before the first production service upgrade a consistent snapshot is saved under /data/backups; existing invoice bodies, stock and seller settings are preserved. Unknown historic component numbers remain blank.

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

Before the first production GST schema upgrade, the service saves a consistent SQLite snapshot under /data/backups/ using VACUUM INTO. The schema/profile upgrade runs in a transaction. Existing issued invoice JSON is not rewritten; legacy invoices retain their saved tax treatment and amounts in the compact print layout. Keep separate ongoing backups and verify restores.

Classification and rate references: [DGCI&S Chapter 87](https://www.dgciskol.gov.in/writereaddata/Downloads/20170601190103CHP_87.pdf), [2024 Gazette adding the pedal-assisted subtype](https://egazette.gov.in/WriteReadData/2024/256436.pdf), [PIB EV tax guidance](https://www.pib.gov.in/PressNoteDetails.aspx?ModuleId=3&NoteId=159436&lang=1&reg=3), and [GST invoice particulars](https://tutorial.gst.gov.in/downloads/news/welcome_kit_for_new_taxpyers.pdf). The 871160 preset is an existing classification, not a newly generated per-bike number.

## Verification

npm test creates disposable SQLite databases and a mock WhatsApp endpoint. It covers auth, CSV atomicity/retries, inclusive/exclusive GST, 500 discount/rounding scenarios, state and GSTIN validation, FY boundaries, migration snapshots, stock locks, numbering, stale reviews, idempotency, warranty snapshots, B2B IRN guards and PDFs. Automated tests do not send real messages or insert demo records into production.

The service checks also cover assignments, permitted transitions, optimistic locking, paid/warranty visits, idempotent receipts, overpayment guards, delivery balances, tracked replacement history, duplicate component prevention and original-invoice immutability. Browser QA uses a separate disposable database and mock provider.
