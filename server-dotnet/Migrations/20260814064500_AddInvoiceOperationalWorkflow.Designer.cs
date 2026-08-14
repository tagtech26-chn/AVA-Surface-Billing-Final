using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AVASurface.Server.Migrations;

[DbContext(typeof(AVASurface.Server.Infrastructure.BillingDbContext))]
[Migration("20260814064500_AddInvoiceOperationalWorkflow")]
partial class AddInvoiceOperationalWorkflow
{
}
