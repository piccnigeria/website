<?

class Subscription extends \Lean\Model\Base {

  protected $validations = array(
    'create' => array(
      'presence' => 'case_id subscriber_id',
      'unique_together' => 'case_id subscriber_id'
      )     
    );

  public static function findByCaseId($case_id) {
    return self::where( array ( 'case_id' => $case_id ) );
  }
}