<?

class Judge extends \Lean\Model\Base {

  protected $validations = array(
    'create' => array(
      'presence' => 'name'        
      ),
    'update' => array(
      'not_null' => 'name',
      'file' => array(
        'photo'=> array(
          'types' => '.jpg .jpeg .png',
          'size' => 2621440 // 2.5mb
          )
        )
      )
    );

  protected $relationships = array(    
    'has_many' => 'cases'
  );
  
  public static function findByName($name) {
    return self::where( array ( 'name' => $name ) );
  }
    
}