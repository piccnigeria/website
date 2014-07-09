<?

class Court extends \Lean\Model\Base {

  protected $order = 'state asc';

	protected $validations = array(
  	  'create' => array(
  	    'presence' => 'type location state',
  	    'unique_together' => 'type location'
  	  ),
  	  'update' => array(
  	    'not_null' => 'type location state'
  	  )
  	);

  protected $relationships = array(    
    'has_many' => 'cases'
  );
		
}