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

  public static function all(){
    $instance = new static;
    return $instance->findAll (
      array(
        'offenders' => 'offender_id',
        'courts' => 'court_id',
        'judges' => 'judge_id',
        'agencies' => 'agency_id'
      ),
      array(
        "offenders.id as offender_id", 
        "offenders.name as offender_name",
        "courts.id as court_id", 
        "courts.name as court_name", 
        "courts.location as court_location",
        "courts.state as court_state",
        "agencies.id as agency_id", 
        "agencies.acronym as agency_acronym",
        "agencies.name as agency_name",
        "judges.id as judge_id", 
        "judges.name as judge_name"
      )      
    );
  }

}