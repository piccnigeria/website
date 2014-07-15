#!/bin/bash
clear

echo "Running packaging clientside assets"

echo "|-->  lessc --no-color -x --clean-css public/css/src/style.less public/css/style.css"
/usr/local/bin/lessc --no-color --clean-css public/css/src/frontend/style.less public/css/style.css

# echo "Packing tests scripts"
# echo "|-->  r.js -o public/js/build/tests.js"
# /usr/local/bin/r.js -o public/js/build/tests.js

echo "Packing frontend scripts"
echo "|-->  r.js -o public/js/build/script.js"
/usr/local/bin/r.js -o public/js/build/script.js

# echo "Packing backend scripts"
# echo "|-->  r.js -o public/js/build/admin.js"
# /usr/local/bin/r.js -o public/js/build/admin.js

echo "|-->  copying style.css"
cp public/css/style.css /var/www/picc/public/css/style.css

echo "|-->  copying script.js"
cp public/js/script.js /var/www/picc/public/js/script.js

echo "Assets packaging complete"

echo "|-->  copying all app/* files"
cp -r app/* /var/www/picc/app

cp index.html public/index.html
cp index.html /var/www/picc/index.html
cp index.html /var/www/picc/public/index.html
cp -r public/img/* /var/www/picc/public/img

echo "App updated successfully!"

echo "Adding changes to git..."
git add .
echo "Commiting changes..."
git commit -m "Added blog pages; included revolution-slider"

echo "Deploying to Github - git@github.com:piccnigeria/website.git"
git push origin master

echo "Deploying to Heroku - git@heroku.com:piccnigeria.git"
git push heroku master

echo "Production deployment complete"