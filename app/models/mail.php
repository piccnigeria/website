<?

class Mail extends \Lean\Model\Base {

  protected $no_backend = true;
  protected $no_cache = true;

  private $regexps = array(
    'send_to' => '/^([a-z\- ]+) <([a-z0-9\+_\-]+(\.[a-z0-9\+_\-]+)*@([a-z0-9\-]+\.)+[a-z]{2,6})>$/i',
  );

	protected $validations = array(
  	  'create' => array(
  	    'presence' => 'send_to send_from subject message'
  	  )
  	);

  protected function beforeCreate(array &$attrs){

    if (!preg_match($this->regexps['send_to'], $attrs['send_to'], $matches)){
      $this->setValidationError("Recipient's address is invalid. Please enter name and email address");
      throw new \Lean\Model\Exception("Invalid recipient's address");
    }

    $attrs = $this->clean( $attrs );

    $this->attrs = array(
      'send_to' => array($matches[2] => $matches[1]),
      'send_from' => array( getenv('default_from_email'), getenv('default_from_name') ),
      'message' => $attrs ['message'],
      'subject' => $attrs ['subject']
    );
  }

  protected function afterCreate() {
  	$this->notifier->notifyOnCreateMessage( $this->attrs );
    $this->attrs ['id'] = uniqid();
  }

}