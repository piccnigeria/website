<?

class Notifier extends \Lean\Notifier {

  // Sends activation mail to user
  public function notifyOnSignUp(array $user){
    $this->sender = array('admin@picc.com.ng', 'PICC Nigeria');
    $this->recipient = array($user['email']=>$user['name']);
    $this->subject = "Confirm your email";
    $this->message = "Dear {$user['name']},
    
	    Kindly enter the following code to confirm your email: <b>{$user['code']}</b>
      Should you have closed the page before confirming your email, simply sign in with your email and password, and you should see a link to verify your account.
	  
	    Thank you.

	    The Team @ PICC";
    $this->send();
  }

  // Sends welcome mail to user
  public function notifyOnActivation(array $user){
    $this->recipient = array($user['email']=>$user['name']);
    $this->subject = "Welcome to PICC";
    $this->message = "Dear {$user['name']},
    
	    We are glad to have you registered on the PICC website. Your account is now fully set up and active.
	  
	    Thank you for signing up.
	   
      The Team @ PICC";
    $this->send();
  }

  // Sends enquiry to editor
  public function notifyOnFeedback(array $feedback){
    $this->acknowledgeFeedback($feedback);
    $this->sender = array($feedback['email'] , $feedback['name']);
    $this->subject = "Enquiry@PICC Nigeria";
    $this->message = "{$feedback['message']}
      --
      {$feedback['name']}
      Email: {$feedback['email']}";
    $this->send();
  }

  // Sends enquiry acknowledgement to the user
  private function acknowledgeFeedback(array $feedback){
    $this->recipient = array($feedback['email']=>$feedback['name']);
    $this->subject = "Re: Enquiry@PICC Nigeria";
    $this->message = "Dear {$feedback['name']},
    
      This is to acknowledge your message. We will respond to your enquiry shortly.
      
      Thanks. 
    
      The Team @ PICC";
    $this->send();
  }

  public function notifyOnPasswordResetRequest(array $user){
    $this->sender = array('admin@picc.com.ng', 'PICC Nigeria');
    $this->recipient = array($user['email']=>$user['name']);
    $this->subject = "Reset Password";
    $this->message = "Please enter the following code to continue with this process of resetting your account password:
      <b>{$user['code']}</b>

      If you did not request a reset of your account password, simply disregard this email.";
    $this->send();
  }

  public function notifyOnCreateMessage(array $mail){
    $this->sender = $mail['send_from'];
    $this->recipient = $mail['send_to'];
    $this->subject = $mail['subject'];
    $this->message = $mail['message'];
    $this->send();
  }

}