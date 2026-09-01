$ngrok = "C:\Program Files\WindowsApps\ngrok.ngrok_3.39.9.0_x64__1g87z0zv29zzc\ngrok.exe"

Write-Host "Starting ngrok HTTPS tunnel..."
Write-Host "Backend: http://localhost:5000"

& $ngrok http 5000