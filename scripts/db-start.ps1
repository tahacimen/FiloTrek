# Starts the local portable PostgreSQL 17 instance used for development on this machine
# (installed without admin rights under %USERPROFILE%\pgsql17 because winget's installer
# requires UAC elevation that isn't available in a non-interactive shell).
# See docker-compose.yml for the equivalent containerized setup once Docker is available.

$PGDATA = "$env:USERPROFILE\pgsql17\data"
$bin = "$env:USERPROFILE\pgsql17\pgsql\bin"

& "$bin\pg_ctl.exe" -D $PGDATA -l "$env:USERPROFILE\pgsql17\logfile.txt" -o "-p 5432" start
& "$bin\pg_isready.exe" -p 5432
