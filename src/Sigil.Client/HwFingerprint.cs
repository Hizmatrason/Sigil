using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace Sigil.Client;

/// <summary>
/// Computes a stable hardware fingerprint for the current machine.
/// Uses a combination of OS-level identifiers, hashed to a 64-char hex string.
/// </summary>
public static class HwFingerprint
{
    private static string? _cached;

    /// <summary>
    /// Returns the hardware fingerprint for this machine.
    /// The value is computed once and cached for the process lifetime.
    /// </summary>
    public static string Get()
    {
        if (_cached is not null) return _cached;

        var raw = new StringBuilder();

        // Machine name (stable on domain-joined machines)
        raw.Append(Environment.MachineName);
        raw.Append('|');

        // OS platform
        raw.Append(RuntimeInformation.OSDescription);
        raw.Append('|');

        // First stable MAC address (excludes loopback and virtual adapters)
        var mac = GetStableMac();
        raw.Append(mac ?? "no-mac");

        // Platform-specific: machine GUID (Windows) or machine-id (Linux/macOS)
        var platformId = GetPlatformMachineId();
        if (platformId is not null)
        {
            raw.Append('|');
            raw.Append(platformId);
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw.ToString()));
        _cached = Convert.ToHexString(hash).ToLowerInvariant();
        return _cached;
    }

    private static string? GetStableMac()
    {
        try
        {
            var macs = NetworkInterface.GetAllNetworkInterfaces()
                .Where(n => n.NetworkInterfaceType != NetworkInterfaceType.Loopback
                         && n.OperationalStatus == OperationalStatus.Up)
                .Select(n => n.GetPhysicalAddress().ToString())
                .Where(m => m.Length > 0)
                .OrderBy(m => m)
                .ToList();

            return macs.FirstOrDefault();
        }
        catch { return null; }
    }

    private static string? GetPlatformMachineId()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return OperatingSystem.IsWindows() ? GetWindowsMachineGuid() : null;

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            return TryReadFile("/etc/machine-id")
                ?? TryReadFile("/var/lib/dbus/machine-id");

        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            return GetMacPlatformSerialNumber();

        return null;
    }

    [System.Runtime.Versioning.SupportedOSPlatform("windows")]
    private static string? GetWindowsMachineGuid()
    {
        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine
                .OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
            return key?.GetValue("MachineGuid")?.ToString();
        }
        catch { return null; }
    }

    private static string? TryReadFile(string path)
    {
        try
        {
            return File.Exists(path) ? File.ReadAllText(path).Trim() : null;
        }
        catch { return null; }
    }

    private static string? GetMacPlatformSerialNumber()
    {
        try
        {
            // ioreg -l | grep IOPlatformSerialNumber
            var psi = new System.Diagnostics.ProcessStartInfo("ioreg", "-l")
            {
                RedirectStandardOutput = true,
                UseShellExecute = false,
            };
            using var proc = System.Diagnostics.Process.Start(psi);
            var output = proc?.StandardOutput.ReadToEnd() ?? string.Empty;
            var line = output.Split('\n')
                .FirstOrDefault(l => l.Contains("IOPlatformSerialNumber"));
            if (line is null) return null;
            var idx = line.IndexOf('"', line.IndexOf('=') + 1);
            var end = line.IndexOf('"', idx + 1);
            return idx >= 0 && end > idx ? line[(idx + 1)..end] : null;
        }
        catch { return null; }
    }
}
