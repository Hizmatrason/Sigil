using System.Security.Cryptography;
using System.Text;
using Sigil.Application.Dtos;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;

namespace Sigil.Application.Services;

public sealed class AuthService
{
    private readonly IUserRepository _userRepo;

    public AuthService(IUserRepository userRepo) => _userRepo = userRepo;

    /// <summary>
    /// Authenticate user with email + password. Returns user DTO on success, null on failure.
    /// </summary>
    public async Task<AuthUserResponse?> LoginAsync(LoginRequest req, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByEmailAsync(req.Email, ct);
        if (user is null || !VerifyPassword(req.Password, user.PasswordHash))
            return null;

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await _userRepo.SaveChangesAsync(ct);

        return Map(user);
    }

    /// <summary>
    /// Get user by ID.
    /// </summary>
    public async Task<AuthUserResponse?> GetUserAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByIdAsync(userId, ct);
        return user is null ? null : Map(user);
    }

    /// <summary>
    /// Create a new user with hashed password (for seeding / invite flow).
    /// </summary>
    public async Task<AuthUserResponse> CreateUserAsync(string email, string password, string? displayName, bool isOperator, CancellationToken ct = default)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = HashPassword(password),
            DisplayName = displayName,
            IsOperator = isOperator,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };

        await _userRepo.AddAsync(user, ct);
        await _userRepo.SaveChangesAsync(ct);

        return Map(user);
    }

    /// <summary>
    /// Seed initial operator user if no users exist.
    /// </summary>
    public async Task SeedOperatorAsync(string email, string password, CancellationToken ct = default)
    {
        if (await _userRepo.AnyAsync(ct))
            return;

        await CreateUserAsync(email, password, "Operator", isOperator: true, ct);
    }

    // --- Password hashing (PBKDF2) ---

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            iterations: 600_000,
            HashAlgorithmName.SHA256,
            outputLength: 32);

        return $"pbkdf2-sha256${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string password, string? storedHash)
    {
        if (string.IsNullOrEmpty(storedHash))
            return false;

        var parts = storedHash.Split('$');
        if (parts.Length != 3 || parts[0] != "pbkdf2-sha256")
            return false;

        var salt = Convert.FromBase64String(parts[1]);
        var expectedHash = Convert.FromBase64String(parts[2]);

        var actualHash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            iterations: 600_000,
            HashAlgorithmName.SHA256,
            outputLength: 32);

        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    private static AuthUserResponse Map(User u)
        => new(u.Id, u.Email, u.DisplayName, u.IsOperator);
}
