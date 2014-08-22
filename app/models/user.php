<?

class User extends \Lean\Model\Base {

  protected $protected_attrs = 'password_hash salt'; # not accessible outside object
  protected $virtual_attrs = 'password password_confirmation'; # not saved to db

  protected $validations = array(
    'create' => array(
      'presence' => 'name email password password_confirmation',
      'email' => 'email',
      'password' => 'password',
      'unique' => 'email'
    ),
    'update' => array(
      'not_null' => 'name email'
    )
  );

  public static function findByEmail($email) {
    return self::find( array ( 'email' => $email ) );
  }

  protected function beforeCreate(array &$attrs) {
    $attrs ['name'] = ucwords( strtolower( $attrs ['name'] ) );
    $attrs ['email'] = strtolower( $attrs ['email'] );
    $attrs ['salt'] = uniqid ( '', true );
    $attrs ['code'] = mt_rand ( 1000000000, 9999999999 );
    $attrs ['password_hash'] = $this->hash ( $attrs ['password'], $attrs['salt']);
  }

  protected function afterCreate() {
    $this->notifier->notifyOnSignUp ( $this->attrs () );
  }

  public function verify(array $attrs) {

    if ($this->isActive()) {
      $this->setValidationError("You have already verified your email");
      return;
    }

    if (!$this->validator->validatePresence('code', $attrs)) return;

    if ($this->code != $attrs['code']) {
      $this->setValidationError("Code is wrong");
      return;
    }

    if ($this->save ( array ( 'level' => 1 ) )) {
      // update session
      Session::set($this);
      $this->notifier->notifyOnActivation ( $this->attrs () );
      return true;
    }

  }

  public function resendSignupMail() {

    if ($this->isActive()) {
      $this->setValidationError("You have already verified your email");
      return;
    }

    $this->notifier->notifyOnSignUp ( $this->attrs () );
    return true;

  }

  public function sendPasswordResetMail(){

    // Regenerate & save new activation code
    $this->save( array( 'code' => mt_rand ( 1000000000, 9999999999 ) ) );
    // Send to the code to the user
    $this->notifier->notifyOnPasswordResetRequest( $this->attrs() );
    return true;

  }

  public function updatePassword(array $attrs) {

    if (array_key_exists('reset', $attrs)){
      if (!$this->validator->validatePresence('reset_code', $attrs)) return;
      if ($this->code != $attrs ['reset_code'] ) {
        $this->setValidationError("Password reset code is wrong");
        return;
      }
    } else {
      if (!$this->validator->validatePresence('current_password', $attrs)) return;
      if (!$this->matchPassword ( $attrs ['current_password'] )) {
        $this->setValidationError("Current password is wrong");
        return;
      }
    }

    if (!$this->validator->validatePresence('password password_confirmation', $attrs)) return;

    if (!$this->validator->validatePassword($attrs['password'])) return;

    if (!$this->validator->validatePasswords($attrs)) return;

    # Regenerate salt
    $salt = uniqid ( '', true );
    $_attrs = array (
      'password_hash' => $this->hash ( $attrs ['password'], $salt ),
      'salt' => $salt
    );

    return $this->save ( $_attrs );

  }

  public static function authenticate(array $creds) {
    $user = self::findByEmail ( $creds ['email'] );
    if ($user && $user->matchPassword ( $creds ['password'] ))
      return $user;
  }

  private function hash($password, $salt) {
    return sha1 ( $password . $salt . $password );
  }

  private function matchPassword($password) {
    return $this->_attrs ['password_hash'] == $this->hash ( $password, $this->_attrs['salt'] );
  }

  public function isActive() {
    return $this->level > 0;
  }

  public function isAdmin() {
    return $this->level > 1;
  }

  public function isBlocked() {
    return $this->level < 0;
  }

}