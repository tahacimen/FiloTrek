# Stops the local portable PostgreSQL 17 instance started by db-start.ps1

$PGDATA = "$env:USERPROFILE\pgsql17\data"
$bin = "$env:USERPROFILE\pgsql17\pgsql\bin"

& "$bin\pg_ctl.exe" -D $PGDATA stop
