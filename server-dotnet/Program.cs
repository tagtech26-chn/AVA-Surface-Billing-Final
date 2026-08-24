using AVASurface.Server.Controllers;
using AVASurface.Server.Infrastructure;
using AVASurface.Server.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 50 * 1024 * 1024;
    options.Limits.MinRequestBodyDataRate = null;
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.MaxDepth = 32;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<BillingDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<MonthlyInvoicePartitionService>();
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
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();

if (allowedOrigins.Length == 0)
    throw new InvalidOperationException("Cors:AllowedOrigins must contain at least one trusted frontend origin.");

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

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

        var role = context.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
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

    // Development convenience only: bring the local SQL schema up to the current v1.1
    // migration before the UI starts. Production deployments should apply migrations
    // explicitly and never auto-migrate business data.
    if (app.Environment.IsDevelopment())
        await db.Database.MigrateAsync();

    var partitionService = scope.ServiceProvider.GetRequiredService<MonthlyInvoicePartitionService>();
    await partitionService.EnsureCurrentMonthAsync();

    var billingMasterSeed = scope.ServiceProvider.GetRequiredService<BillingMasterSeedService>();
    await billingMasterSeed.SeedAsync();

    var passwordSeeder = scope.ServiceProvider.GetRequiredService<InitialUserPasswordSeeder>();
    await passwordSeeder.SeedAsync();
}

app.MapControllers();
await app.RunAsync();
