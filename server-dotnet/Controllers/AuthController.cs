using AVASurface.Server.Infrastructure;
using AVASurface.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(BillingDbContext db) : ControllerBase
{
    public sealed record LoginRequest(string UserName, string Password);

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UserName) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Username and password are required." });

        var user = await db.AppUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserName == request.UserName.Trim(), cancellationToken);

        if (user is null || !user.IsActive || string.IsNullOrWhiteSpace(user.PasswordHash) || !PasswordHasher.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid username or password." });

        return Ok(new
        {
            user.Id,
            user.UserName,
            user.DisplayName,
            user.Role,
            user.IsActive
        });
    }
}
