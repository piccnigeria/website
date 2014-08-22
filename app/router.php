<?

class Router extends \Lean\Router {

  protected function init() {
    // non-RESTful routes => Controller method mapping
    $this->routes = array(
      'GET users/:id/actions/resend-code'  => 'sendCode',
      'PATCH users/:id/actions/verify'     => 'verifyUser',
      'PATCH users/:id/actions/change-password'   => 'updatePassword',
      'POST passwords'                     => 'resetPassword'
    );
  }

}