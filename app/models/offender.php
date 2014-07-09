<?

class Offender extends \Lean\Model\Base {

  protected $validations = array(
    'create' => array(
      'presence' => 'name title office'       
    ),
    'update' => array(
      'not_null' => 'title name office',
      'file' => array(
        'photo'=> array(          
          'types' => '.jpeg .jpg .png',
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
  
  public function uploadPhoto(array &$attrs){
    if ($this->upload ( $attrs['files_to_upload']['photo'], getenv('offenders_upload_dir') )){
      $attrs ['photo'] = $this->_temp ['filename'] . $this->_temp ['filetype'];
      empty($this->_temp);
    }
  }

  protected function beforeCreate(array &$attrs){    
    $attrs ['name'] = ucwords( strtolower( $attrs['name'] ) );
    $attrs ['title'] = ucfirst( strtolower( $attrs['title'] ) );
  }
  
  protected function beforeDestroy(){
    // delete cases if this offender has any
    CourtCase::deleteWhere(array('offender_id'=>$this->id));
      // delete the actual file from disk
    // if (is_file($this->photo) unlink($this->photo) ;
  }

}