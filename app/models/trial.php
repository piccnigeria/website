<?

class Trial extends \Lean\Model\Base {

  protected $validations = array(
    'create' => array(
      'presence' => 'case_id trial_date',
      'unique_together' => 'case_id trial_date'
      )     
    );

  protected $relationships = array(
    'belongs_to_one'  => 'case'
    );
  
  public static function findByCaseId($case_id) {
    return self::where( array ( 'case_id' => $case_id ) );
  }
  
}