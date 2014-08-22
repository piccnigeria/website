<?

require 'api.php';

$cases = CourtCase::all();

var_dump(array_splice($cases, -2));

exit();


//new DateTime("2010-07-05T06:00:00Z", new DateTimeZone("Europe/Amsterdam"));

$agencies = array(
  'EFCC' => 'Economic and Financial Crimes Comission', 
  'ICPC' => 'Independent Corrupt Practices and Other Related Offences Commission' 
);

$unknown_judge = Judge::findOrCreate(array('name' => 'Not available'));

$filename = 'docs/EFCC_2013_Convictions.csv';

if(!file_exists($filename) || !is_readable($filename)) return FALSE;

$header = NULL;
$data = array();
// open the csv 
if (($handle = fopen($filename, 'r')) !== FALSE)
{
  // read the csv line by line
  while (($row = fgetcsv($handle, 1024, ',')) !== FALSE)
  {
    if(!$header)
      $header = $row;
    else
      $data[] = array_combine($header, $row);
  }
  fclose($handle);
}

// var_dump( $data );
// print count( $data );

// for each line of data
foreach ($data as $entry) {  
  // findOrCreate and then save the following models - agency, user, judge, court, case
  $agency = Agency::findOrCreate( array('acronym' => $entry['agency'], 'name'=> $agencies[ $entry['agency'] ] ) );
  $offender = Offender::findOrCreate( array('name' => $entry['offender_name']) );  
  $court = Court::findOrCreate( array('name' => $entry['court_name'], 'state'=> $entry['court_state'] ) );

  if ($entry['judge_name']) {
    $judge = Judge::findOrCreate( array('name' => $entry['judge_name'] ) );
  } else {
    $judge = $unknown_judge;
  }

  try {

    $case = CourtCase::create(
      array(
        'agency_id' => $agency->id,
        'offender_id' => $offender->id,
        'court_id' => $court->id,
        'judge_id' => $judge->id,
        
        // other fields
        'title' => $entry['case_title'],
        'charge_number' => $entry['charge_no'],
        'charge_date' => DateTime::createFromFormat('d/m/Y', $entry['charge_date']),
        'charges' => $entry['charges'],        
        'judgment' => $entry['judgment'],
        'judgment_date' => DateTime::createFromFormat('d/m/Y', $entry['judgment_date'])
      )
    );  
  }
  catch (Exception $e) {
    print "not creating record for case: ". $entry['case_title'] . "\n";
    print $e . "\n";
  }
}