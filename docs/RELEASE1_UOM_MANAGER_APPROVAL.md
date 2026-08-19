# Release 1 POS — UOM and Manager Approval Rules

## UOM
- Never silently convert entered quantity between boxes and pieces.
- Preserve the selected UOM on the cart line.
- Support fractional quantities such as 2.5 Box and 2.3 Box.
- Support piece quantities such as 13 Pcs/Nos.
- When a product provides UOM-specific prices, use the matching price for the selected UOM.

## Manager approval
- The manager-request control is available on every bill.
- It may be presented as a checkbox/action control.
- The biller does not enter an additional-discount amount when requesting approval.
- Unchecked: the bill follows the normal close/payment flow.
- Checked: the bill is submitted to the manager approval queue.
- The manager reviews the complete bill and decides the additional discount.
- Manager approval/rejection is recorded and the approved bill returns to the billing workflow.
