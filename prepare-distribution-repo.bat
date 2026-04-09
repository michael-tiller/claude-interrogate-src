@echo off
setlocal
pushd "%~dp0"
call npm.cmd run prepare:distribution-repo
set EXITCODE=%ERRORLEVEL%
popd
pause
exit /b %EXITCODE%
