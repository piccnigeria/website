#!/bin/bash
clear

cp index.html public/index.html
cp index.html /var/www/picc/index.html
cp index.html /var/www/picc/public/index.html
cp -r public/img/* /var/www/picc/public/img

echo "Adding changes to git..."
git add .

echo "Committing changes to git..."
git commit -m "Updated with new PICC logo."

echo "Pushing changes to Github - git@github.com:piccnigeria/website.git"
git push origin master

echo "Pushing changes to Heroku - git@heroku.com:piccnigeria.git"
git push heroku master

exit

echo "Running packaging frontend clientside assets"
echo "|-->  lessc --no-color -x --clean-css public/css/src/frontend/style.less public/css/style.css"
/usr/local/bin/lessc public/css/src/frontend/style.less public/css/style.css
/usr/local/bin/lessc --no-color --clean-css public/css/src/frontend/style.less public/css/style.min.css

echo "Running packaging admin clientside assets"
echo "|-->  lessc --no-color -x --clean-css public/css/src/admin/style.less public/css/admin/style.css"
/usr/local/bin/lessc public/css/src/admin/style.less public/css/admin/style.css
/usr/local/bin/lessc --no-color --clean-css public/css/src/admin/style.less public/css/admin/style.min.css

# echo "Packing tests scripts"
# echo "|-->  r.js -o public/js/build/tests.js"
# /usr/local/bin/r.js -o public/js/build/tests.js

echo "Packing frontend javascripts"
echo "|-->  r.js -o public/js/build/script.js"
/usr/local/bin/r.js -o public/js/build/script.js optimize=none out=public/js/script.js preserveLicenseComments=true generateSourceMaps=false
/usr/local/bin/r.js -o public/js/build/script.js

echo "Packing admin javascripts"
echo "|-->  r.js -o public/js/build/admin.js"
/usr/local/bin/r.js -o public/js/build/admin.js optimize=none out=public/js/admin/script.js preserveLicenseComments=true generateSourceMaps=false
/usr/local/bin/r.js -o public/js/build/admin.js

exit

echo "Copying static files for frontend to /var/www/picc"
echo "|-->  copying stylesheets"
cp public/css/style.* /var/www/picc/public/css
echo "|-->  copying js scripts"
cp public/js/script.* /var/www/picc/public/js

echo "Copying static files for admin to /var/www/picc"
echo "|-->  copying admin stylesheets"
cp public/css/admin/style.* /var/www/picc/public/css/admin
echo "|-->  copying admin js scripts"
cp public/js/admin/script.* /var/www/picc/public/js/admin

echo "Assets packaging complete"
echo "|-->  copying all app/* files"
cp -r app/* /var/www/picc/app

cp index.html public/index.html
cp index.html /var/www/picc/index.html
cp index.html /var/www/picc/public/index.html
cp -r public/img/* /var/www/picc/public/img

echo "App updated successfully!"

exit

echo "Adding changes to git..."
git add .

echo "Committing changes to git..."
git commit -m "Updated twitter widget id"

echo "Pushing changes to Github - git@github.com:piccnigeria/website.git"
git push origin master

echo "Pushing changes to Heroku - git@heroku.com:piccnigeria.git"
git push heroku master

echo "Packaging executed successfully!"