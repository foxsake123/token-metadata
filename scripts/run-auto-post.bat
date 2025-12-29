@echo off
cd /d C:\Users\shorg\list-token\shorg
call npx ts-node scripts/auto-post.ts >> data\auto-post.log 2>&1
