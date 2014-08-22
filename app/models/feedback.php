<?

class Feedback extends \Lean\Model\Base {

  protected $no_backend = true;
  protected $no_cache = true;

	protected $validations = array(
  	  'create' => array(
  	    'presence' => 'name email message',
  	    'email' => 'email'
  	  )
  	);

  protected function afterCreate() {
  	$this->notifier->notifyOnFeedback( $this->clean( $this->attrs ) );
    $this->attrs['id'] = uniqid();
  }

}