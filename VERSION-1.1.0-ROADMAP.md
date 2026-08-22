# AVASurface Billing v1.1.0

Base: `release/v1.0.0-frozen`
Branch: `feature/v1.1.0-enterprise-management`

## Scope
1. Invoice Cancellation
2. User / Role Management
3. Inventory Edit / Deactivate
4. Customer Categories
5. Category-wise Pricing
6. Customer-specific Pricing
7. Discount / Pricing Engine integration
8. Sales Reports
9. Purchase Reports
10. Salesperson Reports
11. Management Dashboard

## Rules
- SQL Server remains authoritative for business/master/transaction/report data.
- Invoice cancellation is non-destructive and fully auditable.
- Existing quotation -> manager -> accounts -> warehouse workflow remains unchanged.
- Pricing precedence: customer-specific > customer-category > standard product price > promotion/discount rules according to the pricing engine.
- Reports are database-derived; browser state is presentation only.
- v1.0.0 remains untouched as the rollback baseline.
