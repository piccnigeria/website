<?

class Agency extends \Lean\Model\Base {

  // protected $table = 'agencies';

  protected $validations = array(
    'create' => array(
      'presence' => 'name acronym description',
      'unique' => 'acronym'       
      ),
    'update' => array(
      'not_null' => 'name acronym',
      'file' => array(
        'logo'=> array(
          'types' => '.png .jpeg .jpg',
          'size' => 2621440 // 2.5mb
          )
        )
      )
    );

  protected $relationships = array(    
    'has_many' => 'cases'
  );
  
  public static function findByAcronym($acronym) {
    return self::find( array ( 'acronym' => $acronym ) );
  }
  
  public static function findByName($name) {
    return self::where( array ( 'name' => $name ) );
  }
  
  protected function beforeCreate(array &$attrs){
    $attrs ['name'] = ucwords( strtolower( $attrs['name'] ) );
    $attrs ['acronym'] = strtoupper($attrs['acronym']);
  }

}