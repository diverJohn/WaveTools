
var RegLoopIntervalHandle   = null;
var	regState			    = null;

const REG_STATE_INIT                = 1;
const REG_STATE_CELL_INFO_REQ       = 2;
const REG_STATE_CELL_INFO_RSP       = 3;
const REG_STATE_OPER_REG_RSP        = 4;
const REG_STATE_REGISTRATION_RSP    = 5;

const REG_NAK_COUNT_MAX             = 2;
const REG_LOOP_COUNT_MAX            = 12;

// Reg data items shared with cloud..
var myPlmnid                    = "no plmind";
var myRegDataToOp               = "registration data to operator";
var myRegDataFromOp             = null;
var myRegOpForce                = null;

var regTimeoutCount             = 0;
var RegNakCount                 = 0;


// User input....
var szRegFirstName              = "";
var szRegLastName               = "";
var szRegAddr1                  = "";
var szRegAddr2                  = "";
var szRegCity                   = "";
var szRegState                  = "";
var szRegZip                    = "";
var szRegCountry                = "";
var szUserValidation            = "Mandatory Input: Please enter";


var reg = {

	// Handle the Back key
	handleBackKey: function()
	{
	 	PrintLog(1, "Reg: Reg Mode Back key pressed");
	 	clearInterval(RegLoopIntervalHandle);
	 	app.renderHomeView();
	},


    validateUser: function()
    {
        PrintLog(1, "Reg: Reg key pressed");
            
        if( document.inputUser.fName.value == "" )
        {
            showAlert( "First Name", szUserValidation );
        }
        else if( document.inputUser.lName.value == "" )
        {
            showAlert( "Last Name", szUserValidation );
        }
        else if( document.inputUser.addr1.value == "" )
        {
            showAlert( "Address Line 1", szUserValidation );
        }
        else if( document.inputUser.city.value == "" )
        {
            showAlert( "City", szUserValidation );
        }
        else if( document.inputUser.state.value == "" )
        {
            showAlert( "State/Province/Region", szUserValidation );
        }
        else if( document.inputUser.zip.value == "" )
        {
            showAlert( "ZIP/Postal Code", szUserValidation );
        }
        else if( document.inputUser.country.value == "" )
        {
            showAlert( "Country", szUserValidation );
        }
        else
        {  
            // Save the good data...
            szRegFirstName  = document.inputUser.fName.value;
            szRegLastName   = document.inputUser.lName.value;
            szRegAddr1      = document.inputUser.addr1.value;
            szRegAddr2      = document.inputUser.addr2.value;
            szRegCity       = document.inputUser.city.value;
            szRegState      = document.inputUser.state.value;
            szRegZip        = document.inputUser.zip.value;
            szRegCountry    = document.inputUser.country.value;
        
            // Send the mandatory user information to the cloud...
            SendCloudData( "'firstName':'"    + szRegFirstName + 
                           "', 'lastName':'"  + szRegLastName  +
                           "', 'addr_1':'"    + szRegAddr1     +
                           "', 'city':'"      + szRegCity      +
                           "', 'state':'"     + szRegState     +
                           "', 'zip':'"       + szRegZip       +
                           "', 'country':'"   + szRegCountry   + "'" );
            
            // Send optional data if available...                
            if( document.inputUser.addr2.value != "" )
            {
                 SendCloudData( "'addr_2':'" + szRegAddr2 + "'" );
            }
        
            // Start the registration...
            if( isRegistered == false )
            {
                regState = REG_STATE_INIT;
                reg.RegLoop();
            }
            else
            {
                showAlert("No need to re-register.", "Already Registered.");
            }
        
        }
        
        return false;
    },
    
	renderRegView: function() 
	{	
		var myBluetoothIcon = isBluetoothCnx ? "<div id='bt_icon_id' class='bt_icon'>" + szBtIconOn + "</div>" : "<div  id='bt_icon_id' class='bt_icon'>" + szBtIconOff + "</div>";
        var myRegIcon       = (nxtyRxRegLockStatus == 0x00) ? "<div id='reg_icon_id' class='reg_icon'></div>" : isRegistered ? "<div id='reg_icon_id' class='reg_icon'>" + szRegIconReg + "</div>" : "<div id='reg_icon_id' class='reg_icon'>" + szRegIconNotReg + "</div>";
		

		        
		var myHtml = 
			"<img src='img/header_reg.png' width='100%' />" +
			"<button id='back_button_id' type='button' class='back_icon' onclick='reg.handleBackKey()'><img src='img/go_back.png'/></button>"+
			myRegIcon +
            myBluetoothIcon +
            
            "<br><br>" +
            "<div class='userInputContainer'>" +
            "<form name='inputUser' >" +
            "<fieldset><legend>User Information  (* mandatory)</legend>" +
            "<label>*First Name: </label><input type='text' name='fName' value=''>" +
            "<label>*Last Name: </label><input type='text' name='lName' value=''>" +
            "<label>*Address line 1: </label><input type='text' name='addr1' value=''>" +
            "<label>Address line 2: </label><input type='text' name='addr2' value=''>" +
            "<label>*City: </label><input type='text' name='city' value=''>" +
            "<label>*State/Prov/Reg: </label><input type='text' name='state' value=''>" +
            "<label>*ZIP/Postal Code: </label><input type='text' name='zip' value=''>" +
            "<label>*Country: </label><input type='text' name='country' value=''>" +
            "<label></label><input style='position: relative; bottom: 0px; left: 10px; width: 35%; font-size: 20px;' type='button' value='Register' onclick='JavaScript:return reg.validateUser();'></fieldset></form></div>" +
       
            szMyStatusLine;

		$('body').html(myHtml);  
        
        // Fill in from cloud...
        document.inputUser.fName.value = szRegFirstName;
        document.inputUser.lName.value = szRegLastName;
        document.inputUser.addr1.value = szRegAddr1;
        document.inputUser.addr2.value = szRegAddr2;
        document.inputUser.city.value = szRegCity;
        document.inputUser.state.value = szRegState;
        document.inputUser.zip.value = szRegZip;
        document.inputUser.country.value = szRegCountry;
        
                
		UpdateStatusLine("Select 'Register' button to continue");
		
 		
 		document.getElementById("back_button_id").addEventListener('touchstart', HandleButtonDown );
        document.getElementById("back_button_id").addEventListener('touchend',   HandleButtonUp );
        
        if( bGotUserInfoRspFromCloud == false )
        {
            showAlert( "Unable to retrieve User Info from cloud...", "Cloud.");    
        }         
        
        currentView = "registration";
	},


	RegLoop: function() 
	{
		PrintLog(4, "Reg: Reg loop..." );
		
		switch( regState )
		{
		
			case REG_STATE_INIT:
			{
				regState              = REG_STATE_CELL_INFO_REQ;
	 			RegLoopIntervalHandle = setInterval(reg.RegLoop, 2000 );
                regTimeoutCount       = 0;

	 			
	 			// Make sure that the action is false so the watching event will see a false to true transition.
	 			SendCloudData(  "'regAction':'false'" );
	 			
	 			// Fall through to the next state.... 
			}

			case REG_STATE_CELL_INFO_REQ:
			{
                // Send a message to the Cel-Fi unit to gather Cell Info...			
				nxty.SendNxtyMsg(NXTY_CELL_INFO_REQ, null, 0);
				UpdateStatusLine("Requesting Cell Info from Cel-Fi device.");
                navigator.notification.activityStart("Registering...", "Requesting Cell Info...");
				regState    = REG_STATE_CELL_INFO_RSP;
				RegNakCount = 0;
				break;
			}
			
			case REG_STATE_CELL_INFO_RSP:
			{
                // Wait in this state until the Cel-Fi unit responds...
				if( window.msgRxLastCmd == NXTY_CELL_INFO_RSP )
				{
                    // We have received the response from the Cel-Fi unit..
                    // Send the data from the Cel-Fi unit to the cloud...
                    var myText = "'plmnid':'"        + myPlmnid      + "', " +
                                 "'regDataToOp':'"   + myRegDataToOp + "', " +
                                 "'regDataFromOp':'0', "                   +        // Fill return with 0
                                 "'regAction':'true'";                              // Fire the event.
                    
                    SendCloudData( myText );
                        
                    UpdateStatusLine("Sending Operator Registration Request.");
                    navigator.notification.activityStart("Registering...", "Requesting Operator Info...");
                    regState        = REG_STATE_OPER_REG_RSP;
                    regTimeoutCount = 0;
                    RegNakCount     = 0;
                    myRegOpForce    = null;                    
                    myRegDataFromOp = null;
				}
                else if( msgRxLastCmd == NXTY_NAK_RSP )
                {   
                    // Try again if CRC NAK...
                    if( nxtyLastNakType == NXTY_NAK_TYPE_CRC )
                    {
                        regState = REG_STATE_CELL_INFO_REQ;
                        
                        if( RegNakCount++ >= REG_NAK_COUNT_MAX )
                        {
                            clearInterval(RegLoopIntervalHandle);
                            UpdateStatusLine("Failed to receive Authentication response from Cel-Fi device due to CRC error.");
                            showAlert("Failed to receive Authentication response from Cel-Fi device.", "CRC Error Max.");
                        }
                    }
                    else if( nxtyLastNakType == NXTY_NAK_TYPE_UNIT_REDIRECT )
                    {
                        // Try to clear if UART redirect...
                        regState = REG_STATE_CELL_INFO_REQ;
                        cancelUartRedirect();
                                                
                        if( RegNakCount++ >= REG_NAK_COUNT_MAX )
                        {
                            clearInterval(RegLoopIntervalHandle);
                            UpdateStatusLine("Failed to receive Authentication response from Cel-Fi device due to CRC error.");
                            showAlert("Failed to receive Authentication response from Cel-Fi device.", "CRC Error Max.");
                        }
                    }                    
                }
                
                
                
                
			    regTimeoutCount += 1;
			    
			    // Safety exit...
			    if( regTimeoutCount >= REG_LOOP_COUNT_MAX )
			    {
                    // after so many times exit stage left...
                    clearInterval(RegLoopIntervalHandle);
                    navigator.notification.activityStop();
                    UpdateStatusLine("Failed to receive Cell Info from Cel-Fi device.");
                    showAlert("No Cell Info response from Cel-Fi device.", "Timeout.");
			    }
				break;
			}
			
			
			
			case REG_STATE_OPER_REG_RSP:
			{
				// Poll the cloud...
				SendCloudPoll();
				
			
				if( myRegOpForce != null )
				{
                    // Grab the data from the operator...
                    PrintLog(1, "Egress: regOpForce = " + myRegOpForce );
                    
                    if( myRegOpForce == 'true' )
                    {   
                        var temp  = "regOpForce:true";
                        var u8rsp = bluetoothle.stringToBytes(temp);
                    }
                    else
                    {
                        var temp  = "regOpForce:false";
                        var u8rsp = bluetoothle.stringToBytes(temp);      
//                        var u8rsp = bluetoothle.stringToBytes(myRegDataFromOp);
                    } 

                    
				    // Received a response from the cloud... 
                    nxty.SendNxtyMsg(NXTY_REGISTRATION_REQ, u8rsp, u8rsp.length);
                    

                    UpdateStatusLine("Authenticating...");
                    navigator.notification.activityStart("Registering...", "Authenticating...");
                    regState        = REG_STATE_REGISTRATION_RSP;
                    regTimeoutCount = 0;
				}
				else
				{
	                regTimeoutCount += 1;

                    // Safety exit...
                    if( regTimeoutCount >= REG_LOOP_COUNT_MAX )
                    {
                        // after 10 times exit stage left...
                        clearInterval(RegLoopIntervalHandle);
                        navigator.notification.activityStop();
                        UpdateStatusLine("Failed to receive response from Operator.");
                        showAlert("No response from Operator.", "Timeout.");
                    }
				}

				break;
			}

			
			case REG_STATE_REGISTRATION_RSP:
			{
				if( msgRxLastCmd == NXTY_REGISTRATION_RSP )
				{
					// We have received the response from the Cel-Fi unit..
					
					// Stop the rotating wheel...
                	navigator.notification.activityStop();
					
					if( isRegistered )
					{
						UpdateStatusLine("Registration successful...");
					}
					else
					{
						UpdateStatusLine("Registration not successful...");
					}
                    clearInterval(RegLoopIntervalHandle);
					
				}
				else if( msgRxLastCmd == NXTY_NAK_RSP )
                {   
                    // Try again if CRC NAK...
                    if( nxtyLastNakType == NXTY_NAK_TYPE_CRC )
                    {
                        regState = REG_STATE_OPER_REG_RSP;
                        
                        if( RegNakCount++ >= REG_NAK_COUNT_MAX )
                        {
                            clearInterval(RegLoopIntervalHandle);
                            UpdateStatusLine("Failed to receive Authentication response from Cel-Fi device due to CRC error.");
                            showAlert("Failed to receive Authentication response from Cel-Fi device.", "CRC Error Max.");
                        }
                    }
                }
                
                regTimeoutCount += 1;
                
                // Safety exit...
                if( regTimeoutCount >= (REG_LOOP_COUNT_MAX + 5) )
                {
                    // after so many times exit stage left...
                    clearInterval(RegLoopIntervalHandle);
                    navigator.notification.activityStop();
                    UpdateStatusLine("Failed to receive Authentication response from Cel-Fi device.");
                    showAlert("No Authentication response from Cel-Fi device.", "Timeout.");
                }
				break;
			}
			
			
			
			default:
			{
//  		    	clearInterval(RegLoopIntervalHandle);
				break;
			}
		}
		
		

		
	},
};






	
