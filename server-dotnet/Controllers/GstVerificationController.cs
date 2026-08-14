using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/gst")]
public sealed class GstVerificationController(IHttpClientFactory httpClientFactory, IOptions<GstVerificationOptions> options) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly GstVerificationOptions _options = options.Value;

    [HttpGet("verify")]
    public async Task<IActionResult> Verify(string gstin, CancellationToken cancellationToken)
    {
        gstin = (gstin ?? string.Empty).Trim().ToUpperInvariant();

        if (!System.Text.RegularExpressions.Regex.IsMatch(gstin, "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$"))
        {
            return BadRequest(new { gstin, status = "INVALID", isValid = false, message = "Invalid GSTIN format." });
        }

        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                gstin,
                status = "UNVERIFIED",
                isValid = false,
                message = "GST online verification provider is not configured. Configure GstVerification:BaseUrl and credentials before enabling B2B customer creation."
            });
        }

        try
        {
            var client = httpClientFactory.CreateClient("GstVerification");
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{_options.BaseUrl.TrimEnd('/')}/{Uri.EscapeDataString(gstin)}");

            if (!string.IsNullOrWhiteSpace(_options.ApiToken))
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiToken);
            if (!string.IsNullOrWhiteSpace(_options.ClientId))
                request.Headers.TryAddWithoutValidation("client-id", _options.ClientId);
            if (!string.IsNullOrWhiteSpace(_options.ClientSecret))
                request.Headers.TryAddWithoutValidation("client-secret", _options.ClientSecret);
            if (!string.IsNullOrWhiteSpace(_options.RequesterGstin))
                request.Headers.TryAddWithoutValidation("gstin", _options.RequesterGstin);
            if (!string.IsNullOrWhiteSpace(_options.AuthToken))
                request.Headers.TryAddWithoutValidation("authtoken", _options.AuthToken);

            using var response = await client.SendAsync(request, cancellationToken);
            var raw = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new
                {
                    gstin,
                    status = "UNVERIFIED",
                    isValid = false,
                    message = $"GST provider returned HTTP {(int)response.StatusCode}.",
                    providerResponse = SafeJson(raw)
                });
            }

            using var document = JsonDocument.Parse(raw);
            var root = document.RootElement;
            var data = FindData(root);

            var status = ReadString(data, "status", "Status", "gstinStatus", "GstinStatus", "registrationStatus")
                .Trim().ToUpperInvariant();
            var normalizedStatus = status switch
            {
                "ACTIVE" or "ACT" => "ACTIVE",
                "SUSPENDED" or "SUSP" => "SUSPENDED",
                "CANCELLED" or "CANCELED" or "CAN" => "INACTIVE",
                "INACTIVE" => "INACTIVE",
                "" => "INVALID",
                _ => status
            };

            var legalName = ReadString(data, "legalName", "LegalName", "lgnm", "Lgnm");
            var tradeName = ReadString(data, "tradeName", "TradeName", "tradeNam", "TradeNam");
            var address = ReadString(data, "address", "Address", "pradr", "Pradr", "principalAddress");
            var stateCode = ReadString(data, "stateCode", "StateCode", "stcd", "Stcd");
            var stateName = ReadString(data, "stateName", "StateName", "state", "State");
            var registrationDate = ReadString(data, "registrationDate", "RegistrationDate", "rgdt", "Rgdt");
            var taxpayerType = ReadString(data, "taxpayerType", "TaxpayerType", "dty", "Dty");

            return Ok(new
            {
                gstin,
                isValid = normalizedStatus == "ACTIVE",
                status = normalizedStatus,
                legalName,
                tradeName,
                address,
                stateCode,
                stateName,
                taxpayerType = string.IsNullOrWhiteSpace(taxpayerType) ? "Unknown" : taxpayerType,
                registrationDate,
                message = normalizedStatus == "ACTIVE"
                    ? "GSTIN verified successfully."
                    : $"GSTIN verification returned status: {normalizedStatus}.",
                verifiedAtUtc = DateTime.UtcNow
            });
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                gstin,
                status = "UNVERIFIED",
                isValid = false,
                message = "GST online verification could not be completed.",
                detail = ex.Message
            });
        }
    }

    private static JsonElement FindData(JsonElement root)
    {
        if (root.TryGetProperty("Data", out var data)) return data;
        if (root.TryGetProperty("data", out data)) return data;
        return root;
    }

    private static string ReadString(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (!element.TryGetProperty(name, out var value)) continue;
            if (value.ValueKind == JsonValueKind.String) return value.GetString() ?? string.Empty;
            if (value.ValueKind == JsonValueKind.Object && name is "pradr" or "Pradr")
            {
                foreach (var nested in new[] { "addr", "Address" })
                    if (value.TryGetProperty(nested, out var address) && address.ValueKind == JsonValueKind.String)
                        return address.GetString() ?? string.Empty;
            }
        }
        return string.Empty;
    }

    private static object SafeJson(string raw)
        => string.IsNullOrWhiteSpace(raw) ? new { } : raw.Length <= 4000 ? raw : raw[..4000];
}

public sealed class GstVerificationOptions
{
    public string BaseUrl { get; set; } = string.Empty;
    public string ApiToken { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RequesterGstin { get; set; } = string.Empty;
    public string AuthToken { get; set; } = string.Empty;
}
