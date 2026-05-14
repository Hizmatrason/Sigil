using System.Text.Json;

namespace Sigil.Domain.ValueObjects;

public sealed class LicenseTokenPayload
{
    public Guid LicenseId { get; init; }
    public string LicenseKey { get; init; } = string.Empty;
    public Guid TemplateId { get; init; }
    public Guid CompanyId { get; init; }
    public DateTime ExpiresAt { get; init; }
    public int MaxOfflineDays { get; init; }
    public string? HwFingerprint { get; init; }
    public JsonDocument Config { get; init; } = JsonDocument.Parse("{}");
}
