# Manager Discount POS Integration

## Current implementation status

The feature branch already contains:
- Cashier additional-discount request view.
- Manager/Branch Manager approval navigation.
- Backend invoice fields for branch-manager discount metadata.

## Required POS integration

The POS screen must expose a `Request Manager Discount` action in the existing billing flow. The cashier must not enter an unauthorized manager discount percentage directly.

Flow:

1. Cashier creates the bill in POS.
2. Cashier selects `Request Manager Discount` when additional discount approval is needed.
3. The current bill is submitted to the existing invoice workflow.
4. The request is created through `POST /api/invoice-workflow/{invoiceId}/request-manager-discount`.
5. Branch Manager/Manager reviews the request in the existing approval view.
6. On approval, the approved manager discount metadata is applied to the invoice.
7. On rejection, the cashier sees the manager remarks and the bill remains without the unauthorized manager discount.

The existing navigation role split remains unchanged: CASHIER/BILLING_USER request discounts; MANAGER/BRANCH_MANAGER approve them.
