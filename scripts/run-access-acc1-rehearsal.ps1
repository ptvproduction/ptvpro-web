# Local-only. Reuses the existing DPAPI restore consumer; never reads database credentials.
$ErrorActionPreference='Stop'
$started=$false
try {
 $running=@(& wsl.exe --list --running --quiet)|ForEach-Object{($_ -replace "`0",'').Trim()}|Where-Object{$_}
 if(@($running|Where-Object{$_ -ne 'PTVPRO-DEV155'}).Count){throw 'Another WSL distribution is active; refuse shared swap changes'}
 & wsl.exe -d PTVPRO-DEV155 -u root --exec /bin/sh /mnt/c/Users/zidna/ptvpro/.gemini/scratch/acc1-runtime-start.sh
 if($LASTEXITCODE -ne 0){throw 'Dedicated cached runtime unavailable'}
 $started=$true
 & wsl.exe -d PTVPRO-DEV155 -u root --exec /bin/sh /mnt/c/Users/zidna/ptvpro/.gemini/scratch/dev155-container-prepare.sh
 if($LASTEXITCODE -ne 0){throw 'Isolated clone startup failed'}
 & ./.gemini/scratch/restore155-container.ps1 -Acc1
 if($LASTEXITCODE -ne 0){throw 'Clone rehearsal failed; see sanitized stage'}
} finally {
 if($started){
  & wsl.exe -d PTVPRO-DEV155 -u root --exec /bin/sh /mnt/c/Users/zidna/ptvpro/.gemini/scratch/dev155-cleanup.sh
  if($LASTEXITCODE -eq 0){& wsl.exe --terminate PTVPRO-DEV155}else{Write-Output 'LOCAL_CLEANUP_REQUIRES_ATTENTION'}
 }
}
