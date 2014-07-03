<?

class Controller extends \Lean\Controller {

  protected $user = array();

  protected function init(){
    $this->user = Session::get('user');
  }

  protected function extendDataWithSessionUser(){
    if (!isset($this->user['id']))
      return $this->data;
    return array_merge($this->data, array('user_id'=>$this->user['id']));
  }


  /* Session Controllers
   * createSession
   * @path POST /sessions
   * @params $email & $password
   * @return new Session || Session::validationError
   */
  public function createSession(){
    $model = Session::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = Session::get();
  }

  /* Session Controllers
   * getSession
   * @path POST /sessions
   * @params $id
   * @return Session::instance || error
   */
  public function getSession(){
    if ($this->params['id'] != Session::get('token')) {
      Session::invalidate();
      return $this->err = "Please sign in again";
    }
    return $this->responseData = Session::get();
  }

  public function destroySession(){
    Session::invalidate();
  }

  public function getUser(){
    $model = User::get($this->params['id']);
    if (!$model)
      return $this->err = "No such user";
    return $this->responseData = $model->attrs();
  }

  // Probably an admin route
  public function getUsers(){
    return $this->responseData = User::all();
  }

  public function createUser(){
    $model = User::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function verifyUser(){
    $model = User::get($this->params['id']);
    if (!$model)
      return $this->err = "No such user";
    if (!$model->verify($this->data))
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function sendCode(){
    $model = User::get($this->params['id']);
    if (!$model)
      return $this->err = "No such user";
    if (!$model->resendSignupMail())
      return $this->err = $model->getValidationError();
    return $this->responseData = array('success'=>"Confirmation email has been sent to {$model->email}");
  }

  public function updateUser(){
    $model = User::get($this->params['id']);
    if (!$model)
      return $this->err = "No such user";
    if (! $model->save($this->data) )
      return $this->err = $model->getValidationError();
    // update session
    Session::set($model);
    return $this->responseData = $model->attrs();
  }

  protected function updatePassword(){
    $model = User::get($this->params['id']);
    if (!$model)
      return $this->err = "No such user";
    if (!$model->updatePassword($this->data))
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function resetPassword(){
    $model = User::findByEmail($this->data['email']);
    if (!$model)
      return $this->err = "No account found with email {$this->data['email']}";
    $model->sendPasswordResetMail();
    return $this->responseData = $model->attrs();
  }

  public function destroyUser(){
    $model = User::get($this->params['id']);
    if (!$model)
      return $this->err = "No such user";
    $model->destroy();
  }

  public function createFeedback(){
    $model = Feedback::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function createSubscriber(){
    $model = Subscriber::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  // Probably and admin route
  public function getSubscribers(){
    return $this->responseData = Subscriber::all();
  }

  public function getSubscriber(){
    $model = Subscriber::get($this->params['id']);
    if (!$model)
      return $this->err = "No such subscriber";
    return $this->responseData = $model->attrs();
  }

  public function updateSubscriber(){
    $model = Subscriber::get($this->params['id']);
    if (!$model)
      return $this->err = "No such subscriber";
    if (!$model->save( $this->data ))
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function destroySubscriber(){
    $model = Subscriber::get($this->params['id']);
    if (!$model)
      return $this->err = "No such subscriber";
    $model->destroy();
  }

  public function createMessage(){
    $model = Mail::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

}
