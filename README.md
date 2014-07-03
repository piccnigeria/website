PICC Official Website
=====================

The source code for the official website of the [Public Interest in Corruption Cases](http://picc.com.ng) (PICC)

### Getting Started

Make sure the following requirements are met:

* PHP `(>=5.4.14)`
* MySQL
* Apache/Nginx Server
* Composer.phar (for managing dependencies)
* Bower (for managing javascript libraries dependencies)
* r.js (for building/compiling clientside js assets)

#### Installing and running on a development machine

First, you need to have composer installed.

Next, clone this repository into your local environment

    git clone git@github.com:piccnigeria/website.git picc
    cd picc
    mv app/config-sample.yaml app/config.yaml

Then install project dependencies by running

    composer install

or

    php composer.phar install

This should install all dependencies to `vendor/` directory

For clientside development, you need to have `bower` and `r.js` installed.

Then run

    bower install

This installs all javascript libraries used on the clientside to `public/js/src/libs`

### Server Implementation

The server app is built on [Ultractiv/Lean](github.com/ultractiv/lean) RESTful API framework. The application files can be
seen in the `app/` directory. The configuration file for database and others can be found in `app/config.yaml`

### Client Implementation

The client app is built with `Bootstrap` (for styling) and structured with `Backbone.js`. Javascript libraries are managed with `bower`

### TODO:

[] Front end app implementation
[] Admin Backend Implementation
[] Search Engine Optimization

### Credits

+ [Yemi Agbetunsin](github.com/temiyemi)
+ [Segun Abisagbo](github.com/segebee)
+ [Joseph Agunbiade](github.com/josephagunbiade)