namespace AVASurface.Server.Services;

public sealed record BillingLineInput(
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal GstRate);

public sealed record BillingPromotionInput(
    string Code,
    decimal DiscountPercent,
    bool IsActive);

public sealed record BillingCalculationResult(
    decimal SubTotal,
    decimal LineDiscountAmount,
    decimal PromoDiscountAmount,
    decimal BranchManagerDiscountAmount,
    decimal TaxableAmount,
    decimal CgstAmount,
    decimal SgstAmount,
    decimal IgstAmount,
    decimal RoundOffAmount,
    decimal GrandTotal);

public static class BillingCalculator
{
    public static BillingCalculationResult Calculate(
        IReadOnlyList<BillingLineInput> lines,
        IReadOnlyList<BillingPromotionInput> promotions,
        decimal branchManagerDiscountPercent,
        bool interState,
        decimal roundTo)
    {
        if (lines.Count == 0)
            throw new ArgumentException("At least one invoice line is required.");

        if (branchManagerDiscountPercent < 0m || branchManagerDiscountPercent > 100m)
            throw new ArgumentException("Branch Manager discount must be between 0% and 100%.");

        var subtotal = Math.Round(lines.Sum(x => x.Quantity * x.UnitPrice), 2, MidpointRounding.AwayFromZero);
        var lineDiscount = Math.Round(lines.Sum(x => x.Quantity * x.UnitPrice * x.DiscountPercent / 100m), 2, MidpointRounding.AwayFromZero);
        var afterLineDiscount = Math.Max(0m, subtotal - lineDiscount);

        var promoPercent = Math.Min(100m, Math.Max(0m, promotions.Where(x => x.IsActive).Sum(x => x.DiscountPercent)));
        var promoDiscount = Math.Round(afterLineDiscount * promoPercent / 100m, 2, MidpointRounding.AwayFromZero);
        var afterPromo = Math.Max(0m, afterLineDiscount - promoDiscount);

        var branchManagerDiscount = Math.Round(afterPromo * branchManagerDiscountPercent / 100m, 2, MidpointRounding.AwayFromZero);
        var taxableAmount = Math.Max(0m, afterPromo - branchManagerDiscount);

        decimal cgst = 0m;
        decimal sgst = 0m;
        decimal igst = 0m;

        if (taxableAmount > 0m)
        {
            var weightedGstRate = subtotal <= 0m
                ? 0m
                : lines.Sum(x => x.Quantity * x.UnitPrice * x.GstRate) / subtotal;

            var tax = Math.Round(taxableAmount * weightedGstRate / 100m, 2, MidpointRounding.AwayFromZero);
            if (interState)
                igst = tax;
            else
            {
                cgst = Math.Round(tax / 2m, 2, MidpointRounding.AwayFromZero);
                sgst = Math.Round(tax - cgst, 2, MidpointRounding.AwayFromZero);
            }
        }

        var preRoundTotal = Math.Round(taxableAmount + cgst + sgst + igst, 2, MidpointRounding.AwayFromZero);
        var normalizedRoundTo = roundTo <= 0m ? 5m : roundTo;
        var roundedGrandTotal = Math.Round(preRoundTotal / normalizedRoundTo, 0, MidpointRounding.AwayFromZero) * normalizedRoundTo;
        var roundOff = Math.Round(roundedGrandTotal - preRoundTotal, 2, MidpointRounding.AwayFromZero);

        return new BillingCalculationResult(
            subtotal,
            lineDiscount,
            promoDiscount,
            branchManagerDiscount,
            taxableAmount,
            cgst,
            sgst,
            igst,
            roundOff,
            roundedGrandTotal);
    }
}
