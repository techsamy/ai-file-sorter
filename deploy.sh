#!/usr/bin/env bash
set -e

echo "🚀 1/3 Building production bundle..."
npm run build

echo "📤 2/3 Syncing files to aaPanel server (sorter.samytech.site)..."
rsync -avz --delete dist/ papl:/www/wwwroot/sorter.samytech.site/

echo "🔒 3/3 Fixing file permissions on server..."
ssh papl "chown -R www:www /www/wwwroot/sorter.samytech.site"

echo ""
echo "🎉 DEPLOY COMPLETE! Live at: https://sorter.samytech.site/"
