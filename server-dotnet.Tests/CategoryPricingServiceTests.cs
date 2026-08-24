using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using AVASurface.Server.Services;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Tests;

public sealed class CategoryPricingServiceTests
{
    [Fact]
    public async Task CustomerGetsPriceFromMappedBillingCategory_NotFromB2BOrB2CType()
    {
        await using var db = CreateDb();
        var company = new Company { Code = "TEST", LegalName = "Test Company" };
        var product = new Product { CompanyId = company.Id, Sku = "T-001", Name = "Test Tile", SellingPrice = 100m, GstRate = 18m };
        var b2bCustomer = new Customer { CompanyId = company.Id, Code = "B2B-01", Name = "B2B Customer", CustomerType = "B2B" };
        var b2cCustomer = new Customer { CompanyId = company.Id, Code = "B2C-01", Name = "B2C Customer", CustomerType = "B2C" };
        var retail = new CustomerCategory { Code = "RETAIL", Name = "Retail Sale" };
        var wholesale = new CustomerCategory { Code = "WHOLESALE", Name = "Wholesale" };

        db.Companies.Add(company);
        db.Products.Add(product);
        db.Customers.AddRange(b2bCustomer, b2cCustomer);
        db.CustomerCategories.AddRange(retail, wholesale);
        db.CustomerCategoryAssignments.AddRange(
            new CustomerCategoryAssignment { CustomerId = b2bCustomer.Id, CategoryId = wholesale.Id },
            new CustomerCategoryAssignment { CustomerId = b2cCustomer.Id, CategoryId = retail.Id });
        db.CategoryPriceRules.AddRange(
            new CategoryPriceRule { CategoryId = wholesale.Id, ProductId = product.Id, FixedPrice = 80m },
            new CategoryPriceRule { CategoryId = retail.Id, ProductId = product.Id, FixedPrice = 95m });
        await db.SaveChangesAsync();

        var service = new CategoryPricingService(db);
        var b2bPrice = await service.GetEffectivePriceAsync(b2bCustomer.Id, product.Id, product.SellingPrice, DateTime.UtcNow, CancellationToken.None);
        var b2cPrice = await service.GetEffectivePriceAsync(b2cCustomer.Id, product.Id, product.SellingPrice, DateTime.UtcNow, CancellationToken.None);

        Assert.Equal(80m, b2bPrice);
        Assert.Equal(95m, b2cPrice);
    }

    [Fact]
    public async Task ProductSpecificCategoryPriceOverridesCategoryWideRule()
    {
        await using var db = CreateDb();
        var category = new CustomerCategory { Code = "PROJECTS", Name = "Projects" };
        var product = new Product { CompanyId = Guid.NewGuid(), Sku = "T-002", Name = "Project Tile", SellingPrice = 100m };
        var customer = new Customer { CompanyId = product.CompanyId, Code = "P-01", Name = "Project Customer", CustomerType = "B2B" };
        db.CustomerCategories.Add(category);
        db.Products.Add(product);
        db.Customers.Add(customer);
        db.CustomerCategoryAssignments.Add(new CustomerCategoryAssignment { CustomerId = customer.Id, CategoryId = category.Id });
        db.CategoryPriceRules.AddRange(
            new CategoryPriceRule { CategoryId = category.Id, ProductId = null, DiscountPercent = 10m, Priority = 1 },
            new CategoryPriceRule { CategoryId = category.Id, ProductId = product.Id, FixedPrice = 72m, Priority = 0 });
        await db.SaveChangesAsync();

        var service = new CategoryPricingService(db);
        var price = await service.GetEffectivePriceAsync(customer.Id, product.Id, product.SellingPrice, DateTime.UtcNow, CancellationToken.None);

        Assert.Equal(72m, price);
    }

    [Fact]
    public async Task UnmappedCustomerUsesStandardProductPrice()
    {
        await using var db = CreateDb();
        var product = new Product { CompanyId = Guid.NewGuid(), Sku = "T-003", Name = "Standard Tile", SellingPrice = 125m };
        var customer = new Customer { CompanyId = product.CompanyId, Code = "U-01", Name = "Unmapped Customer", CustomerType = "B2C" };
        db.Products.Add(product);
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = new CategoryPricingService(db);
        var price = await service.GetEffectivePriceAsync(customer.Id, product.Id, product.SellingPrice, DateTime.UtcNow, CancellationToken.None);

        Assert.Equal(125m, price);
    }

    private static BillingDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<BillingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new BillingDbContext(options);
    }
}
