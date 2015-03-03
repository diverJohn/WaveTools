
// Use window.isPhone to show global var or just use without "window." ...
var isPhone      = false;
var isRegistered = true;

const   MAIN_LOOP_COUNTER_MAX   = 20;


var szBtIconOn              = "<img src='img/bluetooth_on.png' />";
var szBtIconOff             = "<img src='img/bluetooth_off.png' />";
var szRegIconReg            = "<img src='img/reg_yes.png' />";
var szRegIconNotReg         = "<img src='img/reg_no.png' />";                       // With bar
var szMyStatusLine          = "<p id='status_line_id' class='status_line'></p>";
var myModel                 = "MN8";
var mySn                    = "12345678";
var myPlatformUrl           = "https://nextivity-sandbox-connect.axeda.com:443/ammp/";
var myOperatorCode          = "0000";
var myLat                   = 32.987838;             // Nextivity lat
var myLong                  = -117.074195;           // Nextivity long
var currentView             = "main";
var bDisplayBackgroundRing  = false;
var bSentCloud              = false;
var bUniiUp                 = true;
var bNaking                 = false;
var uMainLoopCounter        = 0;
var MainLoopIntervalHandle  = null; 
var isNetworkConnected      = null;
var bGotUserInfoRspFromCloud    = false;
var bPrivacyViewed          = false;
var msgTimer                = null; 

// Determine which messages get sent to the console.  1 normal, 10 verbose.
// Level  1: Flow and errors.
// Level  2: Raw bluetooth Tx data
// Level  3: Raw bluetooth Rx Data partial msgs
// Level  4: Timing loops
// Level 10: Bluetooth processing.
// Level 99: Error, print in red.
var PrintLogLevel = 1;

// PrintLog............................................................................................
function PrintLog(level, txt)
{
    var d = new Date();
    if( level == 99 )
    {
        console.log("**** Error: (" + d.getSeconds() + "." + d.getMilliseconds() + ") " + txt);
//jdo        console.error(txt);            // console.error does not work on phonegap
    }
    else if( level <= PrintLogLevel )
    { 
        console.log("(" + d.getSeconds() + "." + d.getMilliseconds() + ") " + txt);
    }
}

// UpdateStatusLine....................................................................................
function UpdateStatusLine(statusText)
{
	document.getElementById("status_line_id").innerHTML = statusText;
}

// HandleButtonDown............................................................................................
function HandleButtonDown()
{
	// No transparency when pressed...
	$(this).css("opacity","1.0");
}

// HandleButtonUp............................................................................................
function HandleButtonUp()
{
	$(this).css("opacity","0.5");
	$(this).css("outline", "none" );       // Used to remove orange box for android 4+
}


// U8ToHexText............................................................................................
function U8ToHexText(u8)
{
    if( u8 < 0x10 )
    {
        return( "0" + u8.toString(16) );     // Add a leading 0....
    }
    else
    {
        return( u8.toString(16) );     
    }
}

// UpdateRegIcon....................................................................................
function UpdateRegIcon(reg)
{
    if(reg == 1)
    {
//        if( isRegistered == false )
        {
            document.getElementById("reg_icon_id").innerHTML = szRegIconReg;     // reg_yes.png
            $('body').css("background","white url('../www/img/hbackground_reg.png') no-repeat fixed center bottom");
            isRegistered = true;
        }
    }
    else
    {
//        if( isRegistered == true )
        {
            document.getElementById("reg_icon_id").innerHTML = szRegIconNotReg;    // reg_no.png   line across
            $('body').css("background","white url('../www/img/hbackground.png') no-repeat fixed center bottom");
            isRegistered = false;
        }
    }
}

// UpdateRegButton....................................................................................
function UpdateRegButton(reg)
{
    if(reg == 1)
    {
        // Already registered so remove button.
        document.getElementById("reg_button_id").innerHTML = "";
    }
    else
    {
        // Not registered so add button...
        document.getElementById("reg_button_id").innerHTML = "<img src='img/button_Register.png' />";
    }
}




// SendCloudAsset............................................................................................
function SendCloudAsset()
{
    if( isNxtyStatusCurrent && isNxtySnCurrent && isNetworkConnected )
    {
        myModel = "MN" + nxtyRxStatusBuildConfig;
//        myModel = "LNTModel";

        var myAsset    = "{'id': {'mn':'" + myModel + "', 'sn':'" + mySn + "', 'tn': '0' }, 'pingRate': 3600 }";
        var myAssetUrl = myPlatformUrl + "assets/1";
        
        PrintLog( 1, "SendCloudAsset: " + myAssetUrl + "  " + myAsset );
        
        
        $.ajax({
            type       : "POST",
            url        : myAssetUrl,
            contentType: "application/json;charset=utf-8",
            data       : myAsset,
            dataType   : 'json',    // response format
            success    : function(response) 
                        {
                            PrintLog( 1, "Response success: SendCloudAsset()..." + JSON.stringify(response) );
                            if( response != null )
                            {
                                ProcessEgressResponse(response);
                            }
                        },
            error      : function(response) 
                        {
                            PrintLog( 99, "Response error: SendCloudAsset()..." + JSON.stringify(response) );
                        }
        });
        
        
    }
    else
    {
        if(  isNetworkConnected == false )
        {
            PrintLog( 99, "SendCloudAsset: No network connection (WiFi or Cell)." );
        }
        else
        {
            PrintLog( 99, "SendCloudAsset: Model and SN not available yet" );
        }
    }
}

// SendCloudData............................................................................................
function SendCloudData(dataText)
{
    if( (myModel != null) && (mySn != null) && isNetworkConnected )
    {
        var myData    = "{'data':[{'di': {" + dataText + "}}]}";
        var myDataUrl = myPlatformUrl + "data/1/" + myModel + "!" + mySn;
        
        PrintLog( 1, "SendCloudData: " + myDataUrl + "  " + myData );
        
        
        $.ajax({
            type       : "POST",
            url        : myDataUrl,
            contentType: "application/json;charset=utf-8",
            data       : myData,
            dataType   : 'json',    // response format
            success    : function(response) 
                        {
                            PrintLog( 1, "Response success: SendCloudData()..." + JSON.stringify(response)  );
                            if( response != null )
                            {
                                ProcessEgressResponse(response);
                            }
                        },
            error      : function(response) 
                        {
                            PrintLog( 99, "Response error: SendCloudData()..." + JSON.stringify(response) );
                        }
        });


        
    }
    else
    {
        if(  isNetworkConnected == false )
        {
            PrintLog( 99, "SendCloudAsset: No network connection (WiFi or Cell)." );
        }
        else
        {
            PrintLog( 99, "SendCloudAsset: Model and SN not available yet" );
        }
    }
    
}

// SendCloudLocation............................................................................................
function SendCloudLocation(lat, long)
{
    if( (myModel != null) && (mySn != null) && isNetworkConnected )
    {
        var myData    = "{'locations':[{'latitude':" + lat + ", 'longitude':" + long + "}]}";
        var myDataUrl = myPlatformUrl + "data/1/" + myModel + "!" + mySn;
        
        PrintLog( 1, "SendCloudLocation: " + myDataUrl + "  " + myData );
        
        
        $.ajax({
            type       : "POST",
            url        : myDataUrl,
            contentType: "application/json;charset=utf-8",
            data       : myData,
            dataType   : 'json',    // response format
            success    : function(response) 
                        {
                            PrintLog( 1, "Response success: SendCloudLocation()..." + JSON.stringify(response) );
                            if( response != null )
                            {
                                ProcessEgressResponse(response);
                            }
                        },
            error      : function(response) 
                        {
                            PrintLog( 99, "Response error: SendCloudLocation()..." + JSON.stringify(response) );
                        }
        });
        
        
    }
    else
    {
        if(  isNetworkConnected == false )
        {
            PrintLog( 99, "SendCloudAsset: No network connection (WiFi or Cell)." );
        }
        else
        {
            PrintLog( 99, "SendCloudAsset: Model and SN not available yet" );
        }
    }

    
}

// SendCloudPoll............................................................................................
function SendCloudPoll()
{
    if( isNxtyStatusCurrent && isNxtySnCurrent && isNetworkConnected )
    {
        var myAssetUrl = myPlatformUrl + "assets/1/" + myModel + "!" + mySn;
        
        PrintLog( 1, "SendCloudPoll: " + myAssetUrl );
        
        
        $.ajax({
            type       : "POST",
            url        : myAssetUrl,
//            contentType: "application/json;charset=utf-8",
//            data       : myAsset,
            dataType   : 'json',    // response format
            success    : function(response) 
                        {
                            PrintLog( 1, "Response success: SendCloudPoll()..." + JSON.stringify(response) );
                            if( response != null )
                            {
                                ProcessEgressResponse(response);
                            }
                        },
            error      : function(response) 
                        {
                            PrintLog( 99, "Response error: SendCloudPoll()..." + JSON.stringify(response) );
                        }
        });
        
        
    }
    else
    {
        if(  isNetworkConnected == false )
        {
            PrintLog( 99, "SendCloudAsset: No network connection (WiFi or Cell)." );
        }
        else
        {
            PrintLog( 99, "SendCloudAsset: Model and SN not available yet" );
        }
    }
}




// Geolocation Callbacks
// HandleConfirmLocation.......................................................................................
// process the confirmation dialog result
function HandleConfirmLocation(buttonIndex) 
{
    // buttonIndex = 0 if dialog dismissed, i.e. back button pressed.
    // buttonIndex = 1 if 'Yes' to use location information.
    // buttonIndex = 2 if 'No'
    if( buttonIndex == 1 )
    {
        // Request location...
        navigator.geolocation.getCurrentPosition(geoSuccess, geoError, {timeout:10000});

    }
}



// This method accepts a Position object, which contains the
// current GPS coordinates
//
function geoSuccess(position) 
{
    SendCloudLocation( position.coords.latitude, position.coords.longitude );
/*    
    alert('Latitude: '          + position.coords.latitude          + '\n' +
          'Longitude: '         + position.coords.longitude         + '\n' +
          'Altitude: '          + position.coords.altitude          + '\n' +
          'Accuracy: '          + position.coords.accuracy          + '\n' +
          'Altitude Accuracy: ' + position.coords.altitudeAccuracy  + '\n' +
          'Heading: '           + position.coords.heading           + '\n' +
          'Speed: '             + position.coords.speed             + '\n' +
          'Timestamp: '         + position.timestamp                + '\n');
*/          
}

// geoError Callback receives a PositionError object
//
function geoError(error) 
{
    // Send in the default...
    SendCloudLocation( myLat, myLong );
/* 
silent...

    alert('code: '    + error.code    + '\n' +
          'message: ' + error.message + '\n');
*/          
}


// HandlePrivacyConfirmation.......................................................................................
function HandlePrivacyConfirmation(buttonIndex) 
{
    // buttonIndex = 0 if dialog dismissed, i.e. back button pressed.
    // buttonIndex = 1 if 'Ok'
    if( buttonIndex == 1 )
    {
        // Ok...
        bPrivacyViewed = true;
        
// jdo:  Save to non-vol after first hit.
                
    }
}

// HandleUniiRetry.......................................................................................
// process the confirmation dialog result
function HandleUniiRetry(buttonIndex) 
{
    // buttonIndex = 0 if dialog dismissed, i.e. back button pressed.
    // buttonIndex = 1 if 'Retry' try again.
    // buttonIndex = 2 if 'End'
    if( buttonIndex == 1 )
    {
        // Retry...
        navigator.notification.activityStart( "Please wait", "Retrying..." );
        MainLoopIntervalHandle = setInterval(app.mainLoop, 1000 ); 
        nxtySwVerNuCf          = null;
        bUniiUp                = true;
    }
}

// HandleCloudRetry.......................................................................................
// process the confirmation dialog result
function HandleCloudRetry(buttonIndex) 
{
    // buttonIndex = 0 if dialog dismissed, i.e. back button pressed.
    // buttonIndex = 1 if 'Retry' try again.
    // buttonIndex = 2 if 'End'
    if( buttonIndex == 1 )
    {
        // Retry...
        navigator.notification.activityStart( "Please wait", "Retrying..." );
        MainLoopIntervalHandle = setInterval(app.mainLoop, 1000 );
                    
        // See if we have a network connection, i.e. WiFi or Cell.
        isNetworkConnected = (navigator.connection.type == Connection.NONE)?false:true;         
    }
}

function showAlert(message, title) 
{
  if(window.isPhone) 
  {
    navigator.notification.alert(message, null, title, 'ok');
  } 
  else 
  {
    alert(title ? (title + ": " + message) : message);
  }
}






// ..................................................................................
var app = {
     
    // deviceready Event Handler
    //
  	// PhoneGap is now loaded and it is now safe to make calls using PhoneGap
    //
    onDeviceReady: function() {
    	PrintLog(10,  "device ready" );
    	
    	isNxtyStatusCurrent = false;
    	isNxtySnCurrent     = false;
    	
    	
    	// Only start bluetooth if on a phone...
    	if( window.isPhone )
    	{
            StartBluetooth();
        }
        

		// Register the event listener if the back button is pressed...
        document.addEventListener("backbutton", app.onBackKeyDown, false);
        
        
        app.renderHomeView();
    },   
       
       

    // Handle the back button
    //
    onBackKeyDown: function() 
    {
        
        if( currentView == "main" )
        {
            // Kill the app...
            DisconnectBluetoothDevice();
            navigator.app.exitApp();
        }
        else if( currentView == "registration" )
        {
            reg.handleBackKey();
        }
        else if( currentView == "tech" )
        {
            tech.handleBackKey();
        }
        else if( currentView == "settings" )
        {
            Stg.handleBackKey();
        }
        else if( currentView == "download" )
        {
            Dld.handleBackKey();
        }
        else
        {
            showAlert("Back to where?", "Back...");
        }
        
    },




	// Handle the Register key
	handleRegKey: function()
	{
	 	PrintLog(1, "Un register key pressed");
	 	
	 	if( isBluetoothCnx )
	 	{
	 	    // Unregister...
//            showAlert("Just sent command to unregister...", "Unregister.");
            
            var u8Buff  = new Uint8Array(20);
            u8Buff[0] = 0x81;                               // Redirect to NU on entry and exit...   
            u8Buff[1] = (NXTY_PCCTRL_GLOBALFLAGS >> 24);    // Note that javascript converts var to INT32 for shift operations.
            u8Buff[2] = (NXTY_PCCTRL_GLOBALFLAGS >> 16);
            u8Buff[3] = (NXTY_PCCTRL_GLOBALFLAGS >> 8);
            u8Buff[4] = NXTY_PCCTRL_GLOBALFLAGS;
            u8Buff[5] = 0xF1;                    // Note that javascript converts var to INT32 for shift operations.
            u8Buff[6] = 0xAC;
            u8Buff[7] = 0x00;
            u8Buff[8] = 0x01;
            
            nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);
            
            // Start the spinner..
            bUniiUp = true;
            navigator.notification.activityStart( "Unregister command sent to NU", "Waiting for Response" );
	 	    msgTimer = setTimeout(app.handleRegKeyRespnose, 5000);
	 	
	 	}
	 	else
	 	{
            if( ImRunningOnBrowser )
            {
//                reg.renderRegView();
            }
            else
            {
                showAlert("Un-Register not allowed...", "Bluetooth not connected.");
            }
	 	}
	},
	
	
    // Handle the Register key response
    handleRegKeyRespnose: function()
    {
        // Stop the spinner...
        navigator.notification.activityStop();
        
        if( window.msgRxLastCmd == NXTY_CONTROL_WRITE_RSP )
        {   
            showAlert("Unit should now be unregistered...", "Success");
        }
        else if( window.msgRxLastCmd == NXTY_NAK_RSP )
        {   
            if( nxtyLastNakType == NXTY_NAK_TYPE_CRC )
            {
                // CRC error
                showAlert("CRC error.", "Msg Error");
            }
            else if( nxtyLastNakType == NXTY_NAK_TYPE_UNII_NOT_UP )
            {
                // Unii not up
                showAlert("Fix UNII link and retry...", "UNII link down.");
            }
            else if( nxtyLastNakType == NXTY_NAK_TYPE_UNIT_REDIRECT )
            {
                // Unii up but UART redirect error
                showAlert("Redirect to NU failed.", "UNII link up.");
            }
            else if( nxtyLastNakType == NXTY_NAK_TYPE_TIMEOUT )
            {
                // Command timeout...
                showAlert("Timeout.  Make sure USB cable is not plugged in.", "Msg Error");                    
            } 
            else
            {
                showAlert("Unknown NAK error.  NAK=" + nxtyLastNakType, "Msg Error");
            }
        }
        else
        {
            showAlert("Unknown error.  Make sure USB cable is not plugged in.", "Msg Error");
        }
        
    },

	renderHomeView: function() 
	{
		var myBluetoothIcon = isBluetoothCnx ? "<div id='bt_icon_id' class='bt_icon'>" + szBtIconOn + "</div>" : "<div  id='bt_icon_id' class='bt_icon'>" + szBtIconOff + "</div>";
		
		var myHtml = 
			"<img src='img/header_main.png' width='100%' />" +
			
   			myBluetoothIcon +
  			"<button id='reg_button_id' type='button' class='mybutton' onclick='app.handleRegKey()'><img src='img/button_Register.png' /> </button>" +
  			szMyStatusLine;
  			

		$('body').html(myHtml); 
		
	    
	    // Make the buttons change when touched...    
 		document.getElementById("reg_button_id").addEventListener('touchstart', HandleButtonDown );
 		document.getElementById("reg_button_id").addEventListener('touchend',   HandleButtonUp );
		
		uMainLoopCounter = 0;
			
			
        			
        // Start the handler to be called every second...
//        MainLoopIntervalHandle = setInterval(app.mainLoop, 1000 ); 

               
        UpdateStatusLine( "Wavetools ver:  00.01.00");
                        
        currentView = "main";
	},


	initialize: function() 
	{
		if( ImRunningOnBrowser )
		{
			PrintLog(10, "running on browser");
	
	
	        // Browser...
	        window.isPhone = false;
	        isRegistered   = false;
	        this.onDeviceReady();
	    }
	    else
	    {
		 	PrintLog(10, "running on phone");
		 	
	        // On a phone....
	        window.isPhone = true;
		 		        
	        // Call onDeviceReady when PhoneGap is loaded.
	        //
	        // At this point, the document has loaded but phonegap-1.0.0.js has not.
	        // When PhoneGap is loaded and talking with the native device,
	        // it will call the event `deviceready`.
	        // 
	        document.addEventListener('deviceready', this.onDeviceReady, false);
        }

	},



};






	
