namespace Sigil.Application.Interfaces;

/// <summary>
/// Abstraction for signing license tokens.
/// Implementations: EncryptedFileSigner (v1), VaultSigner (v1.5), Pkcs11Signer (enterprise).
/// </summary>
public interface ISigner
{
    /// <summary>
    /// Sign a message (header_b64.payload_b64) with the Ed25519 private key identified by signingKeyId.
    /// </summary>
    Task<byte[]> SignAsync(Guid signingKeyId, ReadOnlyMemory<byte> message, CancellationToken ct = default);

    /// <summary>
    /// Get the public key bytes (32 bytes Ed25519) for the given signing key.
    /// </summary>
    Task<byte[]> GetPublicKeyAsync(Guid signingKeyId, CancellationToken ct = default);

    /// <summary>
    /// Generate a new Ed25519 key pair, encrypt the private key, store it,
    /// and persist only the public key + reference in the database.
    /// </summary>
    Task<(Guid KeyId, byte[] PublicKey)> GenerateKeyPairAsync(Guid templateId, CancellationToken ct = default);
}
