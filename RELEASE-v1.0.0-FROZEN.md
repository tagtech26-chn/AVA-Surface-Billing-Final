# AVASurface Billing v1.0.0 — Frozen Baseline

Application baseline validated on 2026-08-22.

## Frozen application commit

`164f0476630cc26ad890974824e74174a4d65e95`

Commit: `fix: hydrate warehouse vehicle number and delivered status`

## Workflow baseline

- Billing creates quotation/payment-pending records.
- Manager / Branch Manager reviews quotations and can approve additional discount or credit note.
- Accounts confirms payment.
- Payment confirmation generates the final invoice number.
- Warehouse records Loaded By, Verified By, Vehicle Number and Remarks.
- Warehouse completion changes workflow to `COMPLETED` and delivery status to `DELIVERED`.
- Vehicle number is hydrated from `WarehouseVehicleNumber` and displayed/printed.
- Promotions are loaded from SQL Server through `/api/promotions`.
- Billing does not show the Manager Approval button.
- Audit logs are stored through the SQL Server audit endpoint.
- Held/Draft bills use the SQL Server draft API.
- Business data is not intended to persist through localStorage.

## Release rule

Do not modify application behavior on this branch. Start the next development work from a new branch based on this frozen release.
