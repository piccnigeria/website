<?

class Controller extends \Lean\Controller {

  # Enable magical execution of CRUD methods for RESTful resources
  public $autoCRUD = true;

  protected $user = array();

  protected $resourceMappings = array(
    'Case' => 'CourtCase'
  );

  protected function init(){
    $this->user = Session::get('user');
  }

  protected function extendDataWithSessionUser(){
    if (!isset($this->user['id']))
      return $this->data;
    return array_merge($this->data, array('user_id'=>$this->user['id']));
  }


  /**
   * CRUD: Sessions  
   */
  public function createSession(){
    $model = Session::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = Session::get();
  }
  
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

  /**
   * CRUD: Users (PICC Admins/CSOs)
   */

  /*public function getUser(){
    $model = User::get($this->params['id']);
    if (!$model)
      return $this->err = "No such user";
    return $this->responseData = $model->attrs();
  }

  public function getUsers(){
    return $this->responseData = User::all();
  }

  public function createUser(){
    $model = User::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }
  */

  public function verifyUser(){
    $model = User::get($this->params['id']);
    if (!$model->verify($this->data))
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function sendCode(){
    $model = User::get($this->params['id']);
    if (!$model->resendSignupMail())
      return $this->err = $model->getValidationError();
    return $this->responseData = array('success'=>"Confirmation email has been sent to {$model->email}");
  }

  /*
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
  */

  protected function updatePassword(){
    $model = User::get($this->params['id']);
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

  /*
  public function destroyUser(){
    $model = User::get($this->params['id']);
    if (!$model)
      return $this->err = "No such user";
    $model->destroy();
  }
  */

  /**
   * Create Feedback (Processes the contact us form on the website)
   */
  /*
  public function createFeedback(){
    $model = Feedback::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }
  */

  /**
   * CRUD: Subscribers
   */
  /*
  public function createSubscriber(){
    $model = Subscriber::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }
  
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
  */

  /**
   * Create Message (sends out emails from Admin Console)
   */  
  /*
  public function createMessage(){
    $model = Mail::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }
  */

  /**
   * CRUD: Agencies
   */
  /*
  public function createAgency(){
    $model = Agency::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }
  // wont work, for now. needs an inflection logic in the router
  public function getAgencies(){
    return $this->responseData = Agency::all();
  }

  public function getAgency(){
    $model = Agency::get($this->params['id']);
    if (!$model)
      return $this->err = "No such agency";
    return $this->responseData = $model->attrs();
  }

  public function updateAgency(){
    $model = Agency::get($this->params['id']);
    if (!$model)
      return $this->err = "No such agency";
    if (!$model->save( $this->data ))
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function destroyAgency(){
    $model = Agency::get($this->params['id']);
    if (!$model)
      return $this->err = "No such agency";
    $model->destroy();
  }
  */

  /**
   * CRUD: Cases
   */

  /*
  public function createCase(){
    $model = CourtCase::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }
  
  public function getCases(){
    return $this->responseData = Case::all();
  }

  public function getCase(){
    $model = Case::get($this->params['id']);
    if (!$model)
      return $this->err = "No such case";
    return $this->responseData = $model->attrs();
  }

  public function updateCase(){
    $model = Case::get($this->params['id']);
    if (!$model)
      return $this->err = "No such case";
    if (!$model->save( $this->data ))
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function destroyCase(){
    $model = Case::get($this->params['id']);
    if (!$model)
      return $this->err = "No such case";
    $model->destroy();
  }
  */

  /**
   * CRUD: Offenders
   */
  /*
  public function createOffender(){
    $model = Offender::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function getOffenders(){
    return $this->responseData = Offender::all();
  }

  public function getOffender(){
    $model = Offender::get($this->params['id']);
    if (!$model)
      return $this->err = "No such offender";
    return $this->responseData = $model->attrs();
  }

  public function updateOffender(){
    $model = Offender::get($this->params['id']);
    if (!$model)
      return $this->err = "No such offender";
    if (!$model->save( $this->data ))
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function destroyOffender(){
    $model = Offender::get($this->params['id']);
    if (!$model)
      return $this->err = "No such offender";
    $model->destroy();
  }
  */

  /**
   * CRUD: Courts
   */

  /*
  public function createCourt(){
    $model = Court::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }
  
  public function getCourts(){
    return $this->responseData = Court::all();
  }

  public function getCourt(){
    $model = Court::get($this->params['id']);
    if (!$model)
      return $this->err = "No such court";
    return $this->responseData = $model->attrs();
  }

  public function updateCourt(){
    $model = Court::get($this->params['id']);
    if (!$model)
      return $this->err = "No such court";
    if (!$model->save( $this->data ))
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function destroyCourt(){
    $model = Court::get($this->params['id']);
    if (!$model)
      return $this->err = "No such court";
    $model->destroy();
  }
  */

  /**
   * CRUD: Judges
   */
  /*
  public function createJudge(){
    $model = Judge::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }
  
  public function getJudges(){
    return $this->responseData = Judge::all();
  }

  public function getJudge(){
    $model = Judge::get($this->params['id']);
    if (!$model)
      return $this->err = "No such judge";
    return $this->responseData = $model->attrs();
  }

  public function updateJudge(){
    $model = Judge::get($this->params['id']);
    if (!$model)
      return $this->err = "No such judge";
    if (!$model->save( $this->data ))
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function destroyJudge(){
    $model = Judge::get($this->params['id']);
    if (!$model)
      return $this->err = "No such judge";
    $model->destroy();
  }
  */

  /**
   * CRUD: Trials
   */
  /*
  public function createTrial(){
    $model = Trial::create($this->data);
    if (!$model->isValid())
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function getTrials(){
    return $this->responseData = Trial::all();
  }

  public function getTrial(){
    $model = Trial::get($this->params['id']);
    if (!$model)
      return $this->err = "No such trial";
    return $this->responseData = $model->attrs();
  }

  public function updateTrial(){
    $model = Trial::get($this->params['id']);
    if (!$model)
      return $this->err = "No such trial";
    if (!$model->save( $this->data ))
      return $this->err = $model->getValidationError();
    return $this->responseData = $model->attrs();
  }

  public function destroyTrial(){
    $model = Trial::get($this->params['id']);
    if (!$model)
      return $this->err = "No such trial";
    $model->destroy();
  }
  */
  public function getPosts(){
  	$posts = file_get_contents('http://piccblog.herokuapp.com/api/get_posts/');
    return $this->responseData = json_decode($posts);
  }

  


}
