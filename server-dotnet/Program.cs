using AVASurface.Server.Infrastructure;
using AVASurface.Server.Services;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// The existing AVASurface frontend performs a one-time catalog synchronization.
// Allow large local development payloads to arrive without Kestrel's default
// minimum request-body data-rate terminating the migration request.
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 50 * 1024 * 1024;
    options.Limits.MinRequestBodyDataRate = null;
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<BillingDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"), sql =>
        sql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)));
builder.Services.AddScoped<MonthlyInvoicePartitionService>();
builder.Services.AddScoped<BillingMasterSeedService>();
builder.Services.AddScoped<InitialUserPasswordSeeder>();
builder.Services.Configure<GstVerificationOptions>(builder.Configuration.GetSection("GstVerification"));
builder.Services.AddHttpClient("GstVerification", client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("AVASurface-Billing/1.0");
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.MapGet("/api/health", async (BillingDbContext db) =>
{
    var canConnect = await db.Database.CanConnectAsync();
    return Results.Ok(new
    {
        status = canConnect ? "ok" : "database_unavailable",
        database = "MSSQL Express",
        timestamp = DateTime.UtcNow
    });
});

using (var scope = app.Services.CreateScope())
{
    var partitionService = scope.ServiceProvider.GetRequiredService<MonthlyInvoicePartitionService>();
    await partitionService.EnsureCurrentMonthAsync();

    var billingMasterSeed = scope.ServiceProvider.GetRequiredService<BillingMasterSeedService>();
    await billingMasterSeed.SeedAsync();

    var passwordSeeder = scope.ServiceProvider.GetRequiredService<InitialUserPasswordSeeder>();
    await passwordSeeder.SeedAsync();
}

app.MapControllers();

app.Run();
