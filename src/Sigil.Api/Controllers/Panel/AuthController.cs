using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Sigil.Application.Dtos;
using Sigil.Application.Services;

namespace Sigil.Api.Controllers.Panel;

[ApiController]
[Route("api/v1/panel/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService) => _authService = authService;

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var user = await _authService.LoginAsync(req, ct);
        if (user is null)
            return Unauthorized(new { title = "Invalid credentials", status = 401 });

        await SignInWithCookie(user, ct);
        return Ok(user);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var userIdClaim = User.FindFirst("sub")?.Value
            ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { title = "Not authenticated", status = 401 });

        var user = await _authService.GetUserAsync(userId, ct);
        if (user is null)
            return Unauthorized(new { title = "Not authenticated", status = 401 });

        return Ok(user);
    }

    private async Task SignInWithCookie(AuthUserResponse user, CancellationToken ct)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("sub", user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new("is_operator", user.IsOperator.ToString()),
        };

        if (user.DisplayName is not null)
            claims.Add(new Claim(ClaimTypes.Name, user.DisplayName));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7),
            });
    }
}
