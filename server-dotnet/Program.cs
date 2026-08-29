using AVASurface.Server.Controllers;
using AVASurface.Server.Filters;
using AVASurface.Server.Infrastructure;
using AVASurface.Server.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseWindowsService(options =>
{
    options.ServiceName = "Vero Billing System";
});

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 50 * 1024 * 1024;
    options.Limits.MinRequestBodyDataRate = null;
});

builder.Services.AddControllers(options =>
    {
        options.Filters.Add<GlobalSalespersonDiscountFilter>();
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.MaxDepth = 32;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.CustomSchemaIds(type => type.FullName?.Replace('+', '.') ?? type.Name);

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header. Enter: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});
builder.Services.AddDbContext<BillingDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<MonthlyInvoicePartitionService>();
builder.Services.AddScoped<CategoryPricingService>();
builder.Services.AddScoped<BillingDiscountSettingsService>();
builder.Services.AddScoped<GlobalSalespersonDiscountFilter>();
builder.Services.AddScoped<BillingMasterSeedService>();
builder.Services.AddScoped<InitialUserPasswordSeeder>();
builder.Services.Configure<GstVerificationOptions>(builder.Configuration.GetSection("GstVerification"));
builder.Services.AddHttpClient("GstVerification", client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("AVASurface-Billing/1.0");
});

var jwtSecret = builder.Configuration["Authentication:JwtSecret"];
if (string.IsNullOrWhiteSpace(jwtSecret) || Encoding.UTF8.GetByteCount(jwtSecret) < 32)
    throw new InvalidOperationException("Authentication:JwtSecret must contain at least 32 bytes. Configure it via environment variables or a secret store.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "AVASurface",
            ValidAudience = "AVASurface.LocalBilling",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.Name,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("InventoryWrite", policy =>
        policy.RequireAuthenticatedUser()
            .RequireAssertion(context => context.User.Claims.Any(claim =>
                (claim.Type == ClaimTypes.Role || claim.Type == "role") &&
                (string.Equals(claim.Value, "ADMIN", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(claim.Value, "MANAGER", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(claim.Value, "BRANCH_MANAGER", StringComparison.OrdinalIgnoreCase)))));
});

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();

if (allowedOrigins.Length > 0)
{
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("Frontend", policy =>
            policy.WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod());
    });
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseDefaultFiles();
app.UseStaticFiles();

if (allowedOrigins.Length > 0)
    app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    if (HttpMethods.IsPost(context.Request.Method) &&
        context.Request.Path.Equals("/api/invoices", StringComparison.OrdinalIgnoreCase))
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        var role = context.User.FindFirst(ClaimTypes.Role)?.Value;
        if (!string.Equals(role, "CASHIER", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, "BILLING_USER", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { message = "Only Cashier or Billing users can create invoices." });
            return;
        }
    }

    await next();
});

app.MapGet("/api/health", async (BillingDbContext db) =>
{
    var canConnect = await db.Database.CanConnectAsync();
    return Results.Ok(new
    {
        status = canConnect ? "ok" : "database_unavailable",
        database = db.Database.GetDbConnection().Database,
        timestamp = DateTime.UtcNow
    });
});

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BillingDbContext>();

    if (app.Environment.IsDevelopment())
        await db.Database.MigrateAsync();

    var discountSettings = scope.ServiceProvider.GetRequiredService<BillingDiscountSettingsService>();
    await discountSettings.EnsureSchemaAsync();

    var partitionService = scope.ServiceProvider.GetRequiredService<MonthlyInvoicePartitionService>();
    await partitionService.EnsureCurrentMonthAsync();

    var billingMasterSeed = scope.ServiceProvider.GetRequiredService<BillingMasterSeedService>();
    await billingMasterSeed.SeedAsync();

    var passwordSeeder = scope.ServiceProvider.GetRequiredService<InitialUserPasswordSeeder>();
    await passwordSeeder.SeedAsync();
}

app.MapControllers();
app.MapFallbackToFile("index.html");

await app.RunAsync();
