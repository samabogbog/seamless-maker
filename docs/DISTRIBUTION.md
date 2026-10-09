# Signed Windows release

Use `dist/SeamlessMaker-1.1.8-Windows-Signed.zip` for distribution. Extract completely, close Illustrator, run Install.cmd, then open Window > Extensions (Legacy) > Seamless Maker. Alternatively install the included ZXP with a CEP-compatible ZXP installer. Do not install into UXP directories. Uninstall.cmd removes the current user's CEP installation. The automatic old-install backup in TEMP can be retained until acceptance, then deleted.

Release target: Windows, Illustrator 2022/2023 (26.x/27.x), CEP 11. Older and newer versions are excluded until separately tested. No macOS release has been signed or validated. The runtime has no external dependencies, absolute machine paths, localhost server or symlinks.

The package is signed with Adobe ZXPSignCmd 4.1.3 on Windows, using a self-signed local publisher certificate and a DigiCert timestamp. A self-signed certificate is not an OS-trusted commercial identity; it is supported for CEP signing. Both the ZXP and extracted payload must pass `ZXPSignCmd -verify`. A timestamp extends signature validity beyond certificate expiry; editing signed files invalidates the signature.

## Rebuild

Download ZXPSignCmd from Adobe's official CEP-Resources repository. Keep your certificate and password outside the release. The current local certificate is under ignored `artifacts/private-signing`; the password is encrypted with Windows DPAPI for this user. Back up the certificate and recoverable password securely for future releases. Never send that directory to users.

Set `SEAMLESS_SIGN_PASSWORD` privately in the process environment, then run:

```powershell
./scripts/sign-release.ps1 -SigningTool <path-to-ZXPSignCmd.exe> -Certificate <private-p12-path>
```

Clear the environment variable afterwards. Signing tools receive the password as a command-line argument, so use a trusted build machine. The script rejects symlinks and private key files, requires timestamp success, and verifies both representations before packaging. It copies only runtime files into the signed payload. The unsigned `scripts/package.ps1` is for development.

## Acceptance still required

On each target Illustrator version, test with CSXS.11 PlayerDebugMode absent or disabled: install, open the panel, select a symbol, preview RGB/CMYK artwork, use both repeat modes and all layouts, Create, restart and reopen, then uninstall. Record host version, OS, CEP logs and smoke-test report. Automated mocks and successful signature verification do not prove host functionality. Existing duplicate installations under app-specific CEP or UXP locations should be reviewed before removal; the installer changes only the user CEP folder.

Sources: [Adobe packaging guide](https://github.com/Adobe-CEP/Getting-Started-guides/tree/master/Package%20Distribute%20Install), [Adobe signing tools](https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD), [Adobe cross-platform signing note](https://github.com/Adobe-CEP/CEP-Resources/blob/master/ZXPSignCMD/KnownIssue2024.md).


