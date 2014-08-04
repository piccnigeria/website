<?

  if (!getenv('MANDRILL_APIKEY')) putenv('MANDRILL_APIKEY=AZs8WPkHdHuYYkpCf73AVg');
  if (!getenv('DATABASE_USER')) putenv('DATABASE_USER=maurice');
  if (!getenv('DATABASE_NAME')) putenv('DATABASE_NAME=annals');
  if (!getenv('DATABASE_PASSWORD')) putenv('DATABASE_PASSWORD=IKjWFfRS');
  if (!getenv('DATABASE_HOST')) putenv('DATABASE_HOST=tunnel.pagodabox.com');
  if (!getenv('MEMCACHED_HOST')) putenv('MEMCACHED_HOST=tunnel.pagodabox.com');

  $config = array(
    'database' => array(
      'user' => '%DATABASE_USER%',
      'password' => '%DATABASE_PASSWORD%',
      'name' => '%DATABASE_NAME%',
      'host' => '%DATABASE_HOST%'
      ),
    'memcached' => array(
      'host' => '%MEMCACHED_HOST%'
      ),
    'mailer' => array(
      'api_key' => '%MANDRILL_APIKEY%'
      )
    );

  $patterns = array(
  	'env_var' => '#^%([a-zA-Z_]+)%$#i',
    'host_url' => '#(localhost|127.0.0.1)#i',
    'mysqldb_url' => '#^mysql://(?<user>.+):(?<password>.+)@(?<host>.+)/(?<name>.+)\?(.*)?$#i',
    'mongodb_url' => '#^mongodb://(?<host>.+)/(?<name>.+)$#i'
  );

  function read($var){
    $pattern = '#^%([a-zA-Z_]+)%$#i';
    if ( !preg_match($pattern, $var, $match) ) return $var;
    return getenv($match[1]);
  }

  foreach ($config as $key => $value) {
    if (is_array($value)) {
      foreach ($value as $k => $v) {
        print( "{$key}.{$k} = ". read($v) ."\n" );
      }
    }
    else if (is_string($value)) {
      print( "{$key} = " . read($value) . "\n" );
    }
  }
  
  # $mysql_url = 'mysql://b92df5693b8dab:be8c6ce0@us-cdbr-east-06.cleardb.net/heroku_144bf0697f72587?reconnect=true';
  # preg_match($patterns['mysqldb_url'], $mysql_url, $mysql);
  # var_dump($mysql);

  # $mongo_url = 'mongodb://localhost/gift';
  # preg_match($patterns['mongodb_url'], $mongo_url, $mongo);
  # var_dump($mongo);