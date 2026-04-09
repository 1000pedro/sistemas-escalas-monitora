$installer = 'C:\Users\Almeida\OneDrive\Anexos\jstreinao\treinao1\heroku-installer.exe'
Write-Host "Installer: $installer"
if (-Not (Test-Path $installer)) {
  Write-Error "Installer not found"
  exit 1
}
$proc = Start-Process -FilePath $installer -ArgumentList '/S' -Wait -PassThru
Write-Host "ExitCode: $($proc.ExitCode)"
exit $proc.ExitCode
