@echo off
rem Instala as dependencias e roda as verificacoes do Cadernin. Resultado em verificacao.log
cd /d "%~dp0"
set LOG=verificacao.log
if not exist .env (
  copy apps\web\.env .env >nul
  (echo.& echo VITE_USE_FIRESTORE_EMULATOR=true)>>.env
  echo .env criado a partir de apps\web\.env
)
echo ===== npm install ===== > %LOG%
echo Rodando npm install...
call npm install --no-audit --no-fund >> %LOG% 2>&1
echo EXIT %ERRORLEVEL% >> %LOG%
echo ===== typecheck ===== >> %LOG%
echo Rodando typecheck...
call npm run typecheck >> %LOG% 2>&1
echo EXIT %ERRORLEVEL% >> %LOG%
echo ===== test ===== >> %LOG%
echo Rodando testes...
call npm test >> %LOG% 2>&1
echo EXIT %ERRORLEVEL% >> %LOG%
echo ===== test:rules ===== >> %LOG%
echo Rodando testes das regras (emulador)...
call npm run test:rules >> %LOG% 2>&1
echo EXIT %ERRORLEVEL% >> %LOG%
echo ===== FIM ===== >> %LOG%
echo.
echo Pronto! Resultado em verificacao.log. Pode fechar esta janela.
pause
