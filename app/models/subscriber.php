<?

class Subscriber extends \Lean\Model\Base {

	protected $order = 'email asc';

	protected $validations = array(
	  'create' => array(
	    'presence' => 'email',
	    'email' => 'email',
	    'unique' => 'email'
	  ),
	  'update' => array(
	    'not_null' => 'email'
	  )
	);

  protected function beforeCreate(array &$attrs) {
    # $attrs ['name'] = ucwords( strtolower( $attrs ['name'] ) );
    $attrs ['email'] = strtolower( $attrs ['email'] );
  }
		
}