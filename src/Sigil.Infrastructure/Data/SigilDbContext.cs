using Microsoft.EntityFrameworkCore;
using Sigil.Domain.Entities;

namespace Sigil.Infrastructure.Data;

public sealed class SigilDbContext : DbContext
{
    public SigilDbContext(DbContextOptions<SigilDbContext> options) : base(options) { }

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RoleAssignment> RoleAssignments => Set<RoleAssignment>();
    public DbSet<LicenseTemplate> LicenseTemplates => Set<LicenseTemplate>();
    public DbSet<TemplateVersion> TemplateVersions => Set<TemplateVersion>();
    public DbSet<SigningKey> SigningKeys => Set<SigningKey>();
    public DbSet<License> Licenses => Set<License>();
    public DbSet<LicenseVersion> LicenseVersions => Set<LicenseVersion>();
    public DbSet<Activation> Activations => Set<Activation>();
    public DbSet<Heartbeat> Heartbeats => Set<Heartbeat>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<WebhookEndpoint> WebhookEndpoints => Set<WebhookEndpoint>();
    public DbSet<WebhookDelivery> WebhookDeliveries => Set<WebhookDelivery>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Company ───────────────────────────────────────────────────────────
        modelBuilder.Entity<Company>(e =>
        {
            e.HasKey(c => c.Id);
            e.HasIndex(c => new { c.ParentId, c.Slug }).IsUnique();
            e.HasOne(c => c.Parent)
             .WithMany(c => c.Children)
             .HasForeignKey(c => c.ParentId)
             .OnDelete(DeleteBehavior.Restrict);
            // Company.Users is navigated through RoleAssignment — not a direct EF relation
            e.Ignore(c => c.Users);
        });

        // ── User ──────────────────────────────────────────────────────────────
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.HasIndex(u => u.Email).IsUnique();
        });

        // ── Role ──────────────────────────────────────────────────────────────
        modelBuilder.Entity<Role>(e =>
        {
            e.HasKey(r => r.Id);
            e.HasIndex(r => r.Code).IsUnique();
            e.HasData(
                new Role { Id = 1, Code = "owner" },
                new Role { Id = 2, Code = "admin" },
                new Role { Id = 3, Code = "billing" },
                new Role { Id = 4, Code = "viewer" });
        });

        // ── RoleAssignment ────────────────────────────────────────────────────
        modelBuilder.Entity<RoleAssignment>(e =>
        {
            e.HasKey(ra => new { ra.UserId, ra.CompanyId, ra.RoleId });
            e.HasOne(ra => ra.User)
             .WithMany(u => u.RoleAssignments)
             .HasForeignKey(ra => ra.UserId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(ra => ra.Company)
             .WithMany()
             .HasForeignKey(ra => ra.CompanyId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(ra => ra.Role)
             .WithMany(r => r.RoleAssignments)
             .HasForeignKey(ra => ra.RoleId);
        });

        // ── LicenseTemplate ───────────────────────────────────────────────────
        modelBuilder.Entity<LicenseTemplate>(e =>
        {
            e.HasKey(t => t.Id);
            e.HasIndex(t => t.ProductCode).IsUnique();
            e.HasMany(t => t.Versions)
             .WithOne(v => v.Template)
             .HasForeignKey(v => v.TemplateId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(t => t.SigningKeys)
             .WithOne(k => k.Template)
             .HasForeignKey(k => k.TemplateId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── TemplateVersion ───────────────────────────────────────────────────
        modelBuilder.Entity<TemplateVersion>(e =>
        {
            e.HasKey(v => v.Id);
            e.HasIndex(v => new { v.TemplateId, v.Version }).IsUnique();
            e.HasOne(v => v.SigningKey)
             .WithMany(k => k.TemplateVersions)
             .HasForeignKey(v => v.SigningKeyId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── SigningKey ────────────────────────────────────────────────────────
        modelBuilder.Entity<SigningKey>(e =>
        {
            e.HasKey(k => k.Id);
            e.HasIndex(k => k.TemplateId);
            e.Property(k => k.PublicKey).HasColumnType("bytea");
        });

        // ── License ───────────────────────────────────────────────────────────
        modelBuilder.Entity<License>(e =>
        {
            e.HasKey(l => l.Id);
            e.HasIndex(l => l.LicenseKey).IsUnique();
            e.HasIndex(l => l.CompanyId);
            e.HasIndex(l => l.TemplateId);
            e.HasIndex(l => l.Status);
            e.HasIndex(l => l.ExpiresAt);
            e.HasOne(l => l.Company)
             .WithMany(c => c.Licenses)
             .HasForeignKey(l => l.CompanyId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(l => l.Template)
             .WithMany(t => t.Licenses)
             .HasForeignKey(l => l.TemplateId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(l => l.TemplateVersion)
             .WithMany(v => v.Licenses)
             .HasForeignKey(l => l.TemplateVersionId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── LicenseVersion ────────────────────────────────────────────────────
        modelBuilder.Entity<LicenseVersion>(e =>
        {
            e.HasKey(v => v.Id);
            e.HasIndex(v => new { v.LicenseId, v.Version }).IsUnique();
            e.HasOne(v => v.License)
             .WithMany(l => l.Versions)
             .HasForeignKey(v => v.LicenseId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Activation ────────────────────────────────────────────────────────
        modelBuilder.Entity<Activation>(e =>
        {
            e.HasKey(a => a.Id);
            e.HasIndex(a => a.LicenseId);
            e.HasOne(a => a.License)
             .WithMany(l => l.Activations)
             .HasForeignKey(a => a.LicenseId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Heartbeat ─────────────────────────────────────────────────────────
        modelBuilder.Entity<Heartbeat>(e =>
        {
            e.HasKey(h => h.Id);
            e.HasIndex(h => new { h.LicenseId, h.CreatedAt });
            e.HasOne(h => h.License)
             .WithMany(l => l.Heartbeats)
             .HasForeignKey(h => h.LicenseId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(h => h.Activation)
             .WithMany(a => a.Heartbeats)
             .HasForeignKey(h => h.ActivationId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── AuditLog ──────────────────────────────────────────────────────────
        modelBuilder.Entity<AuditLog>(e =>
        {
            e.HasKey(a => a.Id);
            e.HasIndex(a => new { a.EntityType, a.EntityId });
            e.HasIndex(a => a.CreatedAt);
        });

        // ── WebhookEndpoint ───────────────────────────────────────────────────
        modelBuilder.Entity<WebhookEndpoint>(e =>
        {
            e.HasKey(ep => ep.Id);
            // string[] maps to PostgreSQL text[] via Npgsql
            e.Property(ep => ep.Events).HasColumnType("text[]");
        });

        // ── WebhookDelivery ───────────────────────────────────────────────────
        modelBuilder.Entity<WebhookDelivery>(e =>
        {
            e.HasKey(d => d.Id);
            e.HasIndex(d => new { d.Status, d.NextAttemptAt });
            e.HasOne(d => d.Endpoint)
             .WithMany(ep => ep.Deliveries)
             .HasForeignKey(d => d.EndpointId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
