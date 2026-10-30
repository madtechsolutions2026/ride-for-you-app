# Sales workspace architecture

This is a modular Node.js application with one SQLite database. The existing Ride For You backend forwards `/sales` to this private service. Browser modules are served by Express without a separate frontend build.

```text
sales/
  server.mjs                    HTTP security, authentication and route composition
  core/
    validation.mjs              Input, money, date and canonical value helpers
    transactions.mjs            Synchronous atomic SQLite transactions
    documents.mjs               Seller/customer checks and shared invoice ledger
  db/
    database.mjs                Database connection and upgrade ordering
    migrations/003-commerce.mjs Versioned battery and quotation schema upgrade
    migrations/004-invoice-deletion.mjs Retained invoice deletion audit schema
  modules/
    batteries/routes.mjs        Serialized battery stock and read-only sold history
    batteries/invoices.mjs      Review and issue separate battery invoices
    batteries/stock.mjs         Stock movement events and service consumption
    quotations/routes.mjs       Immutable quotations, status and conversion guards
    invoices/deletion.mjs       Reviewed deletion, stock release and immutable audit
  public/
    app.js                     Navigation, authentication and existing bike screens
    domain/tax-metadata.mjs     Existing EV policy, states and GSTIN validation
    domain/totals.mjs           Shared integer-paise product tax calculations
    shared/ui.mjs              Form controls, formatting and customer fields
    modules/batteries/ui.mjs    Battery inventory, history and sale screens
    modules/quotations/ui.mjs   Quotation creation, review, printing and conversion
    modules/documents/view.mjs  Shared battery/quotation document preview
  tests/
    domain.test.mjs            Generic tax and migration checks
    commerce-checks.mjs        Authenticated battery/quotation integration checks
```

Existing bike invoicing (`gst-invoices.mjs`), bike CSV import, authentication, service modules and PDF layout remain at their established paths. They are compatibility boundaries for live data and existing URLs. New product areas belong under `modules/`; shared rules belong under `core/` or `public/domain/`, rather than duplicating arithmetic or authentication.

## Data rules

- Each bike and battery is a physical serialized unit. `invoice_bikes` and `invoice_batteries` prevent duplicate sale links.
- Bike and separate battery invoices share `invoices` and the seller's existing financial-year invoice sequence. An invoice and stock change commit together. Repeated requests with the same request key return the same record; changed retries fail.
- Quotes have an independent `QUO/FY/00001` sequence. Their saved customer, product, price, warranty and terms are immutable snapshots. Saving or accepting a quote never sells or reserves stock. Cancellation and expiry block conversion.
- Converting a quote prepopulates the existing bike invoice form. The owner reviews it again. Stock availability, seller details, tax and numbering are revalidated on issue. The quotation is linked and marked converted in the same transaction as the invoice.
- Battery HSN and GST are entered by the owner. Incomplete tax details may exist in inventory but cannot issue a battery invoice. The EV bike policy stays fixed separately. Domestic GST calculations use integer paise and support inclusive/exclusive prices and different entered product rates. Nil/exempt bill-of-supply, cess, IRP integration, exports and reverse charge are outside this invoice workflow.
- Battery numbers cannot be duplicated across stock and tracked bike components. Selecting a stock battery in a service job preserves its stock identity. Successful handover consumes it as installed, records the bike/job and updates current component numbers atomically. A sold/installed pack cannot be sold as available stock. If availability changes before handover, the owner must choose another available pack.
- Original issued invoices and closed service visits stay unchanged. Component replacement history retains old and new serials. Service costs/receipts remain operational job records rather than spare-parts GST invoices.
- Owner invoice deletion retains the original `invoices` row and adds `invoice_deletions` with reason, time, actor fingerprint, idempotency key and released stock snapshot. Only active sale links are removed; stock release and audit creation are atomic. Active state and exports exclude deleted invoices, and an archived-record view keeps originals accessible without offering an active PDF. Numbering is never reduced. Any service history or mismatched stock blocks deletion. Converted quotation links stay intact and cannot be reused. Repeated issue requests for deleted invoices fail instead of recreating sales. This is an operational correction for invoices created in error, not a refund, credit note, IRN cancellation or GST-return adjustment workflow.

## Deployment and changes

Production uses `/data/sales.sqlite` on the existing persistent Railway volume, with one active instance. Local and automated-test databases are separate. Secrets stay in private environment configuration.

Before the first commerce upgrade, `VACUUM INTO` saves a consistent snapshot under `/data/backups`. New tables are created in a transaction and an `app_meta` marker makes the migration repeatable. Upgrades do not seed inventory or rewrite existing invoices. Regular independent backups and restore testing remain operational responsibilities.

Run `npm test` from this directory. The suite uses a mock WhatsApp provider and disposable databases. Set `COMMERCE_PDF_DIR` only when producing local sample PDFs. Do not create fake invoices in production for smoke testing; use public assets, authentication guards and deployment health instead.
