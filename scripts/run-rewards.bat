@echo off
cd /d C:\Users\shorg\list-token\shorg
echo [%date% %time%] Running weekly rewards payout >> data\rewards.log
call npx ts-node scripts/process-rewards.ts --execute >> data\rewards.log 2>&1
echo [%date% %time%] Payout complete >> data\rewards.log
