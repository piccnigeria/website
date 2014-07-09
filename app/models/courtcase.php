<?

class CourtCase extends \Lean\Model\Base {

  protected $table = 'cases';

  protected $validations = array(
    'create' => array(
      'presence' => 'offender_id court_id judge_id agency_id'
      ),
    'update' => array(
      'not_null' => 'offender_id court_id judge_id agency_id'
      )
    );

  protected $relationships = array(
    'belongs_to_one'  => 'court judge offender agency',    
    'has_many' => 'trials subscriptions recovered_assets'
  );

}