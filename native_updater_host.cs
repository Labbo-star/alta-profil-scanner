using System;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

class Program
{
    const string RepoZip = "https://github.com/Labbo-star/alta-profil-scanner/archive/refs/heads/main.zip";
    const string RemoteManifest = "https://raw.githubusercontent.com/Labbo-star/alta-profil-scanner/main/manifest.json";

    static void Main()
    {
        try
        {
            var message = ReadMessage();
            if (message == null) return;

            if (message.IndexOf("\"action\":\"check\"", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                var version = GetRemoteVersion();
                WriteMessage("{\"ok\":true,\"remoteVersion\":\"" + Escape(version) + "\"}");
                return;
            }

            if (message.IndexOf("\"action\":\"update\"", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                var version = UpdateExtension();
                WriteMessage("{\"ok\":true,\"updated\":true,\"remoteVersion\":\"" + Escape(version) + "\"}");
                return;
            }

            WriteMessage("{\"ok\":false,\"error\":\"Unknown action\"}");
        }
        catch (Exception ex)
        {
            WriteMessage("{\"ok\":false,\"error\":\"" + Escape(ex.Message) + "\"}");
        }
    }

    static string GetExtensionPath()
    {
        var cfg = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.txt");
        if (!File.Exists(cfg)) throw new Exception("Updater config.txt not found");
        var path = File.ReadAllText(cfg, Encoding.UTF8).Trim();
        if (String.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
            throw new Exception("Extension folder not found: " + path);
        return path;
    }

    static WebClient NewClient()
    {
        var wc = new WebClient();
        wc.Headers[HttpRequestHeader.UserAgent] = "Alta-Profil-Scanner-Updater";
        wc.Encoding = Encoding.UTF8;
        return wc;
    }

    static string GetRemoteVersion()
    {
        using (var wc = NewClient())
        {
            var json = wc.DownloadString(RemoteManifest);
            var m = Regex.Match(json, "\\\"version\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
            if (!m.Success) throw new Exception("Cannot read remote version");
            return m.Groups[1].Value;
        }
    }

    static string UpdateExtension()
    {
        var extensionPath = GetExtensionPath();
        var version = GetRemoteVersion();
        var tempRoot = Path.Combine(Path.GetTempPath(), "alta-profil-scanner-native-update-" + Guid.NewGuid().ToString("N"));
        var zip = Path.Combine(tempRoot, "repo.zip");
        var extract = Path.Combine(tempRoot, "extract");

        Directory.CreateDirectory(tempRoot);
        Directory.CreateDirectory(extract);

        try
        {
            using (var wc = NewClient()) wc.DownloadFile(RepoZip, zip);
            ZipFile.ExtractToDirectory(zip, extract);

            var dirs = Directory.GetDirectories(extract);
            if (dirs.Length == 0) throw new Exception("Downloaded archive is empty");
            var source = dirs[0];

            CopyDirectory(source, extensionPath);
            return version;
        }
        finally
        {
            try { if (Directory.Exists(tempRoot)) Directory.Delete(tempRoot, true); } catch { }
        }
    }

    static void CopyDirectory(string source, string target)
    {
        foreach (var dir in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
        {
            var rel = dir.Substring(source.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            Directory.CreateDirectory(Path.Combine(target, rel));
        }

        foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            var rel = file.Substring(source.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (rel.StartsWith(".git", StringComparison.OrdinalIgnoreCase)) continue;
            var dst = Path.Combine(target, rel);
            Directory.CreateDirectory(Path.GetDirectoryName(dst));
            File.Copy(file, dst, true);
        }
    }

    static string ReadMessage()
    {
        var input = Console.OpenStandardInput();
        var lenBytes = ReadExact(input, 4);
        if (lenBytes == null) return null;
        var len = BitConverter.ToInt32(lenBytes, 0);
        if (len <= 0 || len > 1024 * 1024) throw new Exception("Invalid native message length");
        var data = ReadExact(input, len);
        if (data == null) throw new Exception("Native message truncated");
        return Encoding.UTF8.GetString(data);
    }

    static byte[] ReadExact(Stream s, int count)
    {
        var buf = new byte[count];
        int off = 0;
        while (off < count)
        {
            int n = s.Read(buf, off, count - off);
            if (n <= 0) return off == 0 ? null : buf;
            off += n;
        }
        return buf;
    }

    static void WriteMessage(string json)
    {
        var data = Encoding.UTF8.GetBytes(json);
        var len = BitConverter.GetBytes(data.Length);
        var output = Console.OpenStandardOutput();
        output.Write(len, 0, len.Length);
        output.Write(data, 0, data.Length);
        output.Flush();
    }

    static string Escape(string s)
    {
        return (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", " ");
    }
}
