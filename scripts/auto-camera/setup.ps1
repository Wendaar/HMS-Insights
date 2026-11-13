param([string]$Python='python')
$ErrorActionPreference='Stop'
$repo=Resolve-Path (Join-Path $PSScriptRoot '../..')
$venv=Join-Path $repo '.auto-camera-venv'
& $Python -m venv $venv
if($LASTEXITCODE -ne 0){throw 'Python 3.12 venv creation failed'}
$exe=Join-Path $venv 'Scripts/python.exe'
& $exe -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
if($LASTEXITCODE -ne 0){throw 'Dependency installation failed'}
$models=Join-Path $repo 'artifacts/auto-camera-models'
New-Item -ItemType Directory -Force -Path $models | Out-Null
$model=Join-Path $models 'yolox_nano.onnx'
if(!(Test-Path -LiteralPath $model)){
 Invoke-WebRequest -Uri 'https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx' -OutFile $model
}
if((Get-FileHash -LiteralPath $model -Algorithm SHA256).Hash -ne 'C789161ED43C8269FCD4E67C67EEEB4E80C622DA2EB296A20BC6007BD18A0B7D'){throw 'Unexpected model SHA256'}
& $exe -c "import supervision as sv, cv2; assert hasattr(sv,'ByteTrack'); print('Ready:',sv.__version__,cv2.__version__)"
if($LASTEXITCODE -ne 0){throw 'Runtime verification failed'}
Write-Output "Ready: $exe"
