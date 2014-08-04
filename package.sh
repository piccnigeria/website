#!/bin/bash
clear

# LOCAL = `cwd`
www_root=/var/www/picc/
normal="optimize=none preserveLicenseComments=true generateSourceMaps=false"

# /usr/local/bin/lessc --no-color --clean-css public/css/src/frontend/style.less public/css/style.min.css
# cp public/css/* ${www_root}public/css

# /usr/local/bin/r.js -o public/js/build/script.js optimize=none out=public/js/script.js preserveLicenseComments=true generateSourceMaps=false
# /usr/local/bin/r.js -o public/js/build/script.js ${normal} out=public/js/script.js

# /usr/local/bin/r.js -o public/js/build/script.js
# cp public/js/script.* ${www_root}public/js

# /usr/local/bin/r.js -o public/js/build/admin.js
# cp public/js/admin/script.* ${www_root}public/js/admin

echo "Running packaging frontend clientside assets"
echo "|-->  lessc --no-color -x --clean-css public/css/src/frontend/style.less public/css/style.css"
/usr/local/bin/lessc public/css/src/frontend/style.less public/css/style.css
/usr/local/bin/lessc --no-color --clean-css public/css/src/frontend/style.less public/css/style.min.css

echo "Running packaging admin clientside assets"
echo "|-->  lessc --no-color -x --clean-css public/css/src/admin/style.less public/css/admin/style.css"
/usr/local/bin/lessc public/css/src/admin/style.less public/css/admin/style.css
/usr/local/bin/lessc --no-color --clean-css public/css/src/admin/style.less public/css/admin/style.min.css

# echo "Packing tests scripts"
# echo "|--> r.js -o public/js/build/tests.js"
# /usr/local/bin/r.js -o public/js/build/tests.js

echo "Packing frontend javascripts"
echo "|-->  r.js -o public/js/build/script.js"
/usr/local/bin/r.js -o public/js/build/script.js ${normal} out=public/js/script.js
/usr/local/bin/r.js -o public/js/build/script.js

echo "Packing admin javascripts"
echo "|-->  r.js -o public/js/build/admin.js"
/usr/local/bin/r.js -o public/js/build/admin.js ${normal} out=public/js/admin/script.js
/usr/local/bin/r.js -o public/js/build/admin.js

echo "Copying static files for frontend to $www_root"
echo "|-->  copying stylesheets"
cp public/css/* ${www_root}public/css
echo "|-->  copying js scripts"
cp public/js/* ${www_root}public/js

echo "Copying static files for admin to $www_root"
echo "|-->  copying admin stylesheets"
cp public/css/admin/* ${www_root}public/css/admin
echo "|-->  copying admin js scripts"
cp public/js/admin/* ${www_root}public/js/admin

echo "Assets packaging complete"

echo "|-->  copying all app/* files"
cp -r app/* ${www_root}app

cp index.html public/index.html
cp index.html ${www_root}index.html
cp index.html ${www_root}public/index.html
cp -r public/img/* ${www_root}public/img

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