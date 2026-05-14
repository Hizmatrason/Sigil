using Microsoft.EntityFrameworkCore;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Repositories;

public sealed class UserRepository : IUserRepository
{
    private readonly SigilDbContext _db;

    public UserRepository(SigilDbContext db) => _db = db;

    public Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
        => _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => _db.Users.FindAsync([id], ct).AsTask();

    public async Task AddAsync(User user, CancellationToken ct = default)
        => await _db.Users.AddAsync(user, ct);

    public Task SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);

    public Task<bool> AnyAsync(CancellationToken ct = default)
        => _db.Users.AnyAsync(ct);
}
