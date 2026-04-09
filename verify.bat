@echo off
setlocal
pushd "%~dp0"
call npm.cmd run verify
set EXITCODE=%ERRORLEVEL%
popd
if not "%EXITCODE%"=="0" pause
exit /b %EXITCODE%
