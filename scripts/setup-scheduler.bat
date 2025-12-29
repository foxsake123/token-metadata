@echo off
echo Setting up Windows Task Scheduler for $LIST auto-posting...
echo.

REM Create task to run every hour
schtasks /create /tn "LIST-AutoPost" /tr "C:\Users\shorg\list-token\shorg\scripts\run-auto-post.bat" /sc HOURLY /st 00:00 /f

echo.
echo Task created successfully!
echo.
echo Task Details:
echo   Name: LIST-AutoPost
echo   Schedule: Every hour
echo   Script: scripts\run-auto-post.bat
echo.
echo To view: Open Task Scheduler and look for "LIST-AutoPost"
echo To run now: schtasks /run /tn "LIST-AutoPost"
echo To delete: schtasks /delete /tn "LIST-AutoPost" /f
echo.
pause
