#!/usr/bin/env sh

npm install
cd source
npx prisma generate
npx prisma migrate deploy
npm run dev 
