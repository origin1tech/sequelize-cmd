@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\sequelize\bin\sequelize" %*
) ELSE (
  node  "%~dp0\..\sequelize\bin\sequelize" %*
)