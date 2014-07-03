<?

class Session extends \Lean\Model\Base {

  protected $validations = array(
    'create' => array(
      'presence' => 'email password',
      'email' => 'email'
    )
  );

  public static function set(User $user){
    session_set_cookie_params(0,'/', LEAN_APP_ROOT);

    $_SESSION['token'] = uniqid($user->id);
    $_SESSION['user'] = $user->attrs();
    $_SESSION['is_admin'] = $user->isAdmin();
    $_SESSION['is_verified'] = $user->isActive();

  }

  public static function get($attr = null){
    if (!isset($_SESSION)) return;
    if (!$attr) return $_SESSION;
    if (array_key_exists($attr, $_SESSION)) return $_SESSION[$attr];
  }

  public static function invalidate(){
    session_destroy();
  }

  public static function create(array $attrs) {

    $session = new self ($attrs);

    if ($session->isValid()) {

      $user = User::authenticate($attrs);

      if (!$user) return $session->setValidationError("Invalid email or password");

      if ($user->isBlocked()) return $session->setValidationError("Your account is blocked");

      self::set($user);

    }

    return $session;
  }

  // Override to do nothing
  public function save(array $attrs){}

  public function destroy(){}

}