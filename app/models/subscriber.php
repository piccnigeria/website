<?

class Subscriber extends \Lean\Model\Base {

	use \Lean\Model\Traits;

	protected $order = 'name asc';

	protected $validations = array(
  	  'create' => array(
  	    'presence' => 'name email',
  	    'email' => 'email',
  	    'unique' => 'email'
  	  ),
  	  'update' => array(
  	    'not_null' => 'name email'
  	  )
  	);

  protected function beforeCreate(array &$attrs) {
    $attrs ['name'] = ucwords( strtolower( $attrs ['name'] ) );
    $attrs ['email'] = strtolower( $attrs ['email'] );
  }
		
}