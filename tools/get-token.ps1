param([string]$Target = 'gh:github.com:BaChongYingovo')

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class Credman {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags;
    public int Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public long LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
  }

  [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredReadW(string target, int type, int flags, out IntPtr credential);

  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr buffer);

  public static byte[] GetBlob(string target) {
    IntPtr p;
    if (!CredReadW(target, 1, 0, out p)) return null;
    try {
      CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
      byte[] b = new byte[c.CredentialBlobSize];
      Marshal.Copy(c.CredentialBlob, b, 0, c.CredentialBlobSize);
      return b;
    } finally {
      CredFree(p);
    }
  }
}
'@

$bytes = [Credman]::GetBlob($Target)
if (-not $bytes) { Write-Error "credential not found: $Target"; exit 1 }

$utf8 = [System.Text.Encoding]::UTF8.GetString($bytes).Trim([char]0)
if ($utf8 -match '^(gho_|ghp_|github_pat_)') { Write-Output $utf8; exit 0 }

$uni = [System.Text.Encoding]::Unicode.GetString($bytes).Trim([char]0)
if ($uni -match '^(gho_|ghp_|github_pat_)') { Write-Output $uni; exit 0 }

Write-Error "unrecognized credential blob (len=$($bytes.Length))"
exit 1
