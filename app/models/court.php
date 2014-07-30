<?

class Court extends \Lean\Model\Base {

  protected $order = 'state asc';

	protected $validations = array(
  	  'create' => array(
  	    'presence' => 'name state',
  	    'unique_together' => 'name state'
  	  ),
  	  'update' => array(
  	    'not_null' => 'name location state'
  	  )
  	);

  protected $relationships = array(    
    'has_many' => 'cases'
  );
		
}