using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using NSec.Cryptography;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Domain.Enums;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Signing;

/// <summary>
/// Signs license tokens using Ed25519 keys stored as AES-256-GCM encrypted files.
/// Master key comes from SIGIL_MASTER_KEY env var (64-char hex = 32 bytes).
/// </summary>
public sealed class EncryptedFileSigner : ISigner
{
    private readonly SigilDbContext _db;
    private readonly string _keysDirectory;
    private readonly byte[] _masterKey;

    public EncryptedFileSigner(SigilDbContext db)
    {
        _db = db;

        var masterKeyHex = Environment.GetEnvironmentVariable("SIGIL_MASTER_KEY")
            ?? throw new InvalidOperationException(
                "SIGIL_MASTER_KEY env var is required (64-char hex string for AES-256-GCM).");

        if (masterKeyHex.Length != 64)
            throw new InvalidOperationException(
                "SIGIL_MASTER_KEY must be exactly 64 hex characters (32 bytes).");

        _masterKey = Convert.FromHexString(masterKeyHex);

        _keysDirectory = Environment.GetEnvironmentVariable("SIGIL_KEYS_DIR")
            ?? Path.Combine("/var", "lib", "sigil", "keys");

        Directory.CreateDirectory(_keysDirectory);
    }

    /// <inheritdoc />
    public async Task<byte[]> SignAsync(Guid signingKeyId, ReadOnlyMemory<byte> message, CancellationToken ct = default)
    {
        var signingKey = await _db.SigningKeys.FindAsync([signingKeyId], ct)
            ?? throw new KeyNotFoundException($"SigningKey {signingKeyId} not found.");

        if (signingKey.Status != SigningKeyStatus.Active)
            throw new InvalidOperationException($"SigningKey {signingKeyId} is not active (status={signingKey.Status}).");

        if (signingKey.NotBefore > DateTimeOffset.UtcNow)
            throw new InvalidOperationException($"SigningKey {signingKeyId} is not yet valid (notBefore={signingKey.NotBefore}).");

        if (signingKey.NotAfter.HasValue && signingKey.NotAfter < DateTimeOffset.UtcNow)
            throw new InvalidOperationException($"SigningKey {signingKeyId} has expired (notAfter={signingKey.NotAfter}).");

        var encryptedFilePath = GetEncryptedFilePath(signingKey.PrivateKeyRef);

        var privateKeyBytes = DecryptPrivateKey(await File.ReadAllBytesAsync(encryptedFilePath, ct), _masterKey);

        try
        {
            var alg = new NSec.Cryptography.Ed25519();
            var privateKey = Key.Import(alg, privateKeyBytes, KeyBlobFormat.RawPrivateKey);
            var signature = alg.Sign(privateKey, message.Span);
            return signature;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(privateKeyBytes);
        }
    }

    /// <inheritdoc />
    public async Task<byte[]> GetPublicKeyAsync(Guid signingKeyId, CancellationToken ct = default)
    {
        var signingKey = await _db.SigningKeys.FindAsync([signingKeyId], ct)
            ?? throw new KeyNotFoundException($"SigningKey {signingKeyId} not found.");

        return signingKey.PublicKey;
    }

    /// <inheritdoc />
    public async Task<(Guid KeyId, byte[] PublicKey)> GenerateKeyPairAsync(Guid templateId, CancellationToken ct = default)
    {
        // Generate Ed25519 key pair
        var (privateKeyBytes, publicKeyBytes) = GenerateEd25519KeyPair();

        var keyId = Guid.NewGuid();
        var privateKeyRef = $"{keyId}.enc";
        var encryptedFilePath = GetEncryptedFilePath(privateKeyRef);

        // Encrypt and write private key
        var encryptedData = EncryptPrivateKey(privateKeyBytes, _masterKey);
        await File.WriteAllBytesAsync(encryptedFilePath, encryptedData, ct);

        // Zero private key from memory
        CryptographicOperations.ZeroMemory(privateKeyBytes);

        // Persist public key + reference in DB
        var signingKey = new SigningKey
        {
            Id = keyId,
            TemplateId = templateId,
            PublicKey = publicKeyBytes,
            PrivateKeyRef = privateKeyRef,
            Algorithm = "ed25519",
            Status = SigningKeyStatus.Active,
            NotBefore = DateTimeOffset.UtcNow,
        };

        _db.SigningKeys.Add(signingKey);
        await _db.SaveChangesAsync(ct);

        return (keyId, publicKeyBytes);
    }

    /// <summary>
    /// Generates a new Ed25519 key pair using NSec.
    /// Returns (32-byte seed/private key, 32-byte public key).
    /// </summary>
    private static (byte[] PrivateKey, byte[] PublicKey) GenerateEd25519KeyPair()
    {
        var alg = new NSec.Cryptography.Ed25519();

        var creationParams = new KeyCreationParameters
        {
            ExportPolicy = KeyExportPolicies.AllowPlaintextExport,
        };

        using var key = Key.Create(alg, creationParams);
        var publicKeyBytes = key.PublicKey.Export(KeyBlobFormat.RawPublicKey);
        var privateKeyBytes = key.Export(KeyBlobFormat.RawPrivateKey);

        return (privateKeyBytes, publicKeyBytes);
    }

    /// <summary>
    /// Encrypts private key bytes with AES-256-GCM using the master key.
    /// Format: [12-byte nonce][ciphertext][16-byte tag].
    /// </summary>
    private static byte[] EncryptPrivateKey(ReadOnlySpan<byte> plaintext, ReadOnlySpan<byte> masterKey)
    {
        var nonce = new byte[AesGcm.NonceByteSizes.MaxSize]; // 12 bytes
        RandomNumberGenerator.Fill(nonce);

        var tagSize = AesGcm.TagByteSizes.MaxSize; // 16 bytes
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[tagSize];

        using var aes = new AesGcm(masterKey, tagSize);
        aes.Encrypt(nonce, plaintext, ciphertext, tag);

        // Result: [nonce][ciphertext][tag]
        var result = new byte[nonce.Length + ciphertext.Length + tag.Length];
        Buffer.BlockCopy(nonce, 0, result, 0, nonce.Length);
        Buffer.BlockCopy(ciphertext, 0, result, nonce.Length, ciphertext.Length);
        Buffer.BlockCopy(tag, 0, result, nonce.Length + ciphertext.Length, tag.Length);

        return result;
    }

    /// <summary>
    /// Decrypts AES-256-GCM encrypted private key.
    /// Expected format: [12-byte nonce][ciphertext][16-byte tag].
    /// </summary>
    private static byte[] DecryptPrivateKey(ReadOnlySpan<byte> encryptedData, ReadOnlySpan<byte> masterKey)
    {
        var nonceSize = AesGcm.NonceByteSizes.MaxSize; // 12 bytes
        var tagSize = AesGcm.TagByteSizes.MaxSize; // 16 bytes

        if (encryptedData.Length < nonceSize + tagSize)
            throw new InvalidOperationException("Encrypted key data is too short.");

        var ciphertextSize = encryptedData.Length - nonceSize - tagSize;

        var nonce = encryptedData[..nonceSize];
        var ciphertext = encryptedData.Slice(nonceSize, ciphertextSize);
        var tag = encryptedData.Slice(nonceSize + ciphertextSize, tagSize);

        var plaintext = new byte[ciphertextSize];

        using var aes = new AesGcm(masterKey, tagSize);
        aes.Decrypt(nonce, ciphertext, tag, plaintext);

        return plaintext;
    }

    private string GetEncryptedFilePath(string privateKeyRef) =>
        Path.Combine(_keysDirectory, privateKeyRef);
}
