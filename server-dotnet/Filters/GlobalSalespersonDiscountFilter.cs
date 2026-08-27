using AVASurface.Server.Controllers;
using AVASurface.Server.Services;
using Microsoft.AspNetCore.Mvc.Filters;

namespace AVASurface.Server.Filters;

public sealed class GlobalSalespersonDiscountFilter(BillingDiscountSettingsService settingsService) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var request = context.ActionArguments.Values
            .OfType<InvoicesController.InvoiceRequest>()
            .FirstOrDefault();

        if (request is not null)
        {
            var settings = await settingsService.GetOrCreateAsync(request.CompanyId, context.HttpContext.RequestAborted);
            var invalid = request.Lines.FirstOrDefault(x => x.DiscountPercent < 0 || x.DiscountPercent > settings.MaxSalespersonDiscountPercent);
            if (invalid is not null)
            {
                context.Result = new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new
                {
                    message = $"Salesperson discount cannot exceed the configured maximum of {settings.MaxSalespersonDiscountPercent:0.##}%.",
                    maxSalespersonDiscountPercent = settings.MaxSalespersonDiscountPercent
                });
                return;
            }
        }

        await next();
    }
}
