namespace Sigil.Application.Dtos;

public sealed record LoginRequest(string Email, string Password);

public sealed record AuthUserResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    bool IsOperator);

public sealed record SignupInviteRequest(
    string Token,
    string Password,
    string? DisplayName);
