
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

// ProcessEgressResponse......................................................................................
function ProcessEgressResponse(eg)
{
    var i;
    var egStr;
    
    //  Set items loook like....    
    // {set:[
    //          {items:{firstName:"John"},priority:0},
    //          {items:{lastName:"Doe"},priority:0},
    //          {items:{city:"San Clemente"},priority:0},
    //          {items:{getUserInfoAction:"true"},priority:0},
    //      ]  
    //  } ;
    
    egStr = JSON.stringify(eg);
    if( egStr.search("set") != -1 )
    {
        PrintLog(1, "Egress: Number of set items equals " + eg.set.length );
    
        for( i = 0; i < eg.set.length; i++ )
        {
            egStr = JSON.stringify(eg.set[i].items);
            
            // Search for strings associated with getUserInfoAction (search() returns -1 if no match found)
            //   getUserInfoAction returns false if there is no information but set bGotUserInfoRspFromCloud
            //   just to know that the cloud has returned nothing or something.
            if(      egStr.search("getUserInfoAction") != -1 )   bGotUserInfoRspFromCloud   = true;        
            else if( egStr.search("firstName")         != -1 )   szRegFirstName             = eg.set[i].items.firstName;        
            else if( egStr.search("lastName")          != -1 )   szRegLastName              = eg.set[i].items.lastName;        
            else if( egStr.search("addr_1")            != -1 )   szRegAddr1                 = eg.set[i].items.addr_1;        
            else if( egStr.search("addr_2")            != -1 )   szRegAddr2                 = eg.set[i].items.addr_2;
            else if( egStr.search("city")              != -1 )   szRegCity                  = eg.set[i].items.city;
            else if( egStr.search("state")             != -1 )   szRegState                 = eg.set[i].items.state;
            else if( egStr.search("zip")               != -1 )   szRegZip                   = eg.set[i].items.zip;
            else if( egStr.search("country")           != -1 )   szRegCountry               = eg.set[i].items.country;
                    
            // Search for strings associated with Registration egress...
            else if( egStr.search("regOpForce")        != -1 )   myRegOpForce               = eg.set[i].items.regOpForce;       // true to force
            else if( egStr.search("regDataFromOp")     != -1 )   myRegDataFromOp            = eg.set[i].items.regDataFromOp;
    
            
            // Search for strings associated with Software Download egress...
            else if( egStr.search("isUpdateAvailable") != -1 )   bGotUpdateAvailableRspFromCloud  = true;
            else if( egStr.search("SwVerNU_CF_CldVer") != -1 )   nxtySwVerNuCfCld                 = eg.set[i].items.SwVerNU_CF_CldVer;
            else if( egStr.search("SwVerCU_CF_CldVer") != -1 )   nxtySwVerCuCfCld                 = eg.set[i].items.SwVerCU_CF_CldVer;
            else if( egStr.search("SwVerNU_PIC_CldVer") != -1 )  nxtySwVerNuPicCld                = eg.set[i].items.SwVerNU_PIC_CldVer;
            else if( egStr.search("SwVerCU_PIC_CldVer") != -1 )  nxtySwVerCuPicCld                = eg.set[i].items.SwVerCU_PIC_CldVer;
            else if( egStr.search("SwVer_BT_CldVer")    != -1 )  nxtySwVerBtCld                   = eg.set[i].items.SwVer_BT_CldVer;
        }
    }


    // packages look like...
    // {packages:[
    //                  {id:641, instructions:[
    //                      {@type:down, id:921, fn:"WuExecutable.sec", fp:"."}], priority:0, time:1414810929705},
    //                  {id:642, instructions:[
    //                      {@type:down, id:922, fn:"BTFlashImg.bin", fp:"."}], priority:0, time:1414810929705}
    //               ]

    egStr = JSON.stringify(eg);
    if( egStr.search("packages") != -1 )
    {
        PrintLog(1, "Egress: Number of package instructions equals " + eg.packages.length );
        
        
        // Find the fixed file names and save the file ID numbers.   Note that the first ID is the package ID.
        //  File name "PICFlashImg.bin" is used for both the NU and CU PICs.
        //  Future proof in case there are different PIC images: "NuPICFlashImg.bin" and "CuPICFlashImg.bin"
        for( i = 0; i < eg.packages.length; i++ )
        {
            egStr = JSON.stringify(eg.packages[i].instructions);
            
            // Search for strings associated with software download (search() returns -1 if no match found)
            if(      egStr.search(myNuCfFileName)   != -1 )   fileNuCfCldId   = eg.packages[i].instructions[0].id;        
            else if( egStr.search(myCuCfFileName)   != -1 )   fileCuCfCldId   = eg.packages[i].instructions[0].id;  
            else if( egStr.search("PICFlashImg")    != -1 )   fileNuPicCldId  = fileCuPicCldId = eg.packages[i].instructions[0].id;  
            else if( egStr.search(myNuPicFileName)  != -1 )   fileNuPicCldId  = eg.packages[i].instructions[0].id;                     // Future proof  
            else if( egStr.search(myCuPicFileName)  != -1 )   fileCuPicCldId  = eg.packages[i].instructions[0].id;                     // Future proof
            else if( egStr.search(myBtFileName)     != -1 )   fileBtCldId     = eg.packages[i].instructions[0].id;
        }
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



	// Handle the Check for SW Update key
	handleSwUpdateKey: function(id)
	{
	 	PrintLog(1, "SW Update key pressed");
        clearInterval(MainLoopIntervalHandle);	
 	
 	
	 	if( isBluetoothCnx )
	 	{
            Dld.renderDldView();  
	 	}
        else
        {
            if( ImRunningOnBrowser )
            {
                // Allow the browser to go into
//                Dld.renderDldView();
            }
            else
            {       
                showAlert("SW Update mode not allowed...", "Bluetooth not connected.");
            }
        }
        
        

// Try various things...


/*
if( isRegistered )
{
    // Unregister...
    showAlert("Just sent command to unregister...", "Unregister.");
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
}
else
{
    // Register and clear Loc Lock
    showAlert("Just sent command to register and clear loc lock...", "Register.");
    var u8Buff  = new Uint8Array(20);
    u8Buff[0] = 0x01;                               // Redirect to NU on entry...   
    u8Buff[1] = (NXTY_PCCTRL_GLOBALFLAGS >> 24);    // Note that javascript converts var to INT32 for shift operations.
    u8Buff[2] = (NXTY_PCCTRL_GLOBALFLAGS >> 16);
    u8Buff[3] = (NXTY_PCCTRL_GLOBALFLAGS >> 8);
    u8Buff[4] = NXTY_PCCTRL_GLOBALFLAGS;
    u8Buff[5] = 0xF1;                    // Note that javascript converts var to INT32 for shift operations.
    u8Buff[6] = 0xAC;
    u8Buff[7] = 0x01;
    u8Buff[8] = 0x00;
    nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);
    
    
    
    u8Buff[0] = 0x80;                               // Redirect to CU on exit...   
    u8Buff[1] = 0xF0;   // CellIdTime
    u8Buff[2] = 0x00;
    u8Buff[3] = 0x00;
    u8Buff[4] = 0x2C;
    u8Buff[5] = 0xDA;   // LOC_LOCK_RESET_VAL     
    u8Buff[6] = 0xBA;
    u8Buff[7] = 0xDA;
    u8Buff[8] = 0xBA;
    
    nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);
    
}
*/

/*
var rsp = {set:[
    {items:{firstName:"John"},priority:0},
    {items:{lastName:"Doe"},priority:0},
    {items:{city:"San Clemente"},priority:0},
    {items:{getUserInfoAction:"true"},priority:0},
    ]} ;
*/

/*
var rsp = {packages:[
            {id:641, instructions:[{"@type":"down", id:921, fn:"WuExecutable.sec", fp:"."}],priority:0,time:1414810929705},
            {id:642, instructions:[{"@type":"down", id:922, fn:"BTFlashImg.bin", fp:"."}], priority:0,time:1414810929705}
            ],
            
          set:[
            {items:{getUserInfoAction:true},priority:0},
            {items:{firstName:"John"},priority:0},
            {items:{lastName:"Doe"},priority:0},
            {items:{addr_1:"12345 Cell Rd"},priority:0},
            {items:{addr_2:"whitefield"},priority:0},
            {items:{city:"NewYorkCity"},priority:0},
            {items:{state:"Hello"},priority:0},
            {items:{zip:"56789"},priority:0},
            {items:{SwVer_BT_CldVer:"00.04"},priority:0},
            {items:{country:"USA"},priority:0}]};
                  

PrintLog( 1, "Rsp..." + JSON.stringify(rsp) );
ProcessEgressResponse(rsp);
*/    



/*
var x  = "regOpForce:true";
var u8 = new Uint8Array(30);

for( var i = 0; i < x.length; i++ )
{
    u8[i] = x.charCodeAt(i); 
}

nxty.SendNxtyMsg(NXTY_REGISTRATION_REQ, u8, x.length ); 
*/
        
        
        
	},


	// Handle the Tech Mode key
	handleTechModeKey: function()
	{
	 	PrintLog(1, "Tech Mode key pressed");
        clearInterval(MainLoopIntervalHandle); 
            	 	
	 	if( isBluetoothCnx )
	 	{
 	 		tech.renderTechView();
	 	}
	 	else
	 	{
            if( ImRunningOnBrowser )
            {
                // Allow the browser to go into Tech mode
                tech.renderTechView();
            }
            else
            {	 	
	            showAlert("Tech mode not allowed...", "Bluetooth not connected.");
	        }
	 	}
	},

    // Handle the Settings key
    handleSettingsKey: function()
    {
        PrintLog(1, "Settings key pressed");
        clearInterval(MainLoopIntervalHandle);  
       
        if( isBluetoothCnx )
        {
            Stg.renderSettingsView();
        }
        else
        {
            if( ImRunningOnBrowser )
            {
                // Allow the browser to go into Settings mode
                Stg.renderSettingsView();
            }
            else
            {       
                showAlert("Settings mode not allowed...", "Bluetooth not connected.");
            }
        }
    },

	// Handle the Register key
	handleRegKey: function()
	{
	 	PrintLog(1, "Un reg key pressed");
	 	
	 	if( isBluetoothCnx )
	 	{
	 	    // Unregister...
            showAlert("Just sent command to unregister...", "Unregister.");
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




	mainLoop: function() 
	{
        var u8TempBuff = new Uint8Array(5);  
		PrintLog(4, "App: Main loop..." );
		
		if( bPrivacyViewed == false )
		{
		  return;
		}
		
        if( isBluetoothCnx && (bNaking == false) )
        {
            if( isNxtyStatusCurrent == false )
            {
                if( uMainLoopCounter == 0 )
                {
                    // See if we have a network connection, i.e. WiFi or Cell.
                    isNetworkConnected = (navigator.connection.type == Connection.NONE)?false:true;
                    
                    // Start the spinner..
                    navigator.notification.activityStart( "Please wait", "Syncing data..." );
                }
                
                // Get the status...returns build config which is used as model number
                nxty.SendNxtyMsg(NXTY_STATUS_REQ, null, 0);
                UpdateStatusLine("Retrieving model number...");
            } 
            else if( isNxtySnCurrent == false )
            {

                // Get the CU serial number...used by the platform 
                nxtyCurrentReq  = NXTY_SEL_PARAM_REG_SN_TYPE;
                u8TempBuff[0]   = NXTY_SW_CF_CU_TYPE;     // Select CU
                u8TempBuff[1]   = 9;                      // System SN MSD
                u8TempBuff[2]   = 8;                      // System SN LSD  
                nxty.SendNxtyMsg(NXTY_SYS_INFO_REQ, u8TempBuff, 3);
                UpdateStatusLine("Retrieving serial number...");
                
                bSentCloud = false;
            }
            else if( nxtySwVerNuCf == null )
            {
                UpdateStatusLine("Retrieving NU SW version...");

                if( bSentCloud == false )
                {
                    // We now have both the status and SN so notify the cloud that we are here...
                    SendCloudAsset();
                
                    navigator.notification.confirm(
                        'Provide location information?',    // message
                        HandleConfirmLocation,              // callback to invoke with index of button pressed
                        'Location',                         // title
                        ['Yes', 'No'] );                    // buttonLabels
                    

        
                    // Since this message is going to the NU, allow 3 seconds to receive the response..
                    clearInterval(MainLoopIntervalHandle);
                    MainLoopIntervalHandle = setInterval(app.mainLoop, 3000 );
                    
                    bSentCloud = true;
                }
                else
                {
                    // Since this message is going to the NU and we did not recieve it the first time, allow 6 seconds
                    // before sending again to allow the NU redirect to time out in 5..
                    clearInterval(MainLoopIntervalHandle);
                    MainLoopIntervalHandle = setInterval(app.mainLoop, 6000 );
                } 
    
                if( bUniiUp )  // up by default...
                {
                    if( (msgRxLastCmd == NXTY_NAK_RSP) && (nxtyLastNakType == NXTY_NAK_TYPE_UNIT_REDIRECT) )
                    {
                        // Bypass getting NU Sw Ver which we need for the reg info.
                        nxtySwVerNuCf = "88.88.88";
                        
                        // Cancel and wait at least 5 seconds.
                        cancelUartRedirect();
                    }
                    else
                    {
                        // Get the Cell Fi software version from the NU...
                        nxtyCurrentReq    = NXTY_SW_CF_NU_TYPE;
                        u8TempBuff[0]     = nxtyCurrentReq;
                        nxty.SendNxtyMsg(NXTY_SW_VERSION_REQ, u8TempBuff, 1);
                    }
                }
                else
                {
                    // Bypass getting NU Sw Ver which we need for the reg info.
                    nxtySwVerNuCf = "99.99.99";
                }
            }
            else if( nxtySwVerCuCf == null )
            {
                // We now have the NU SW Ver message response which has the register/lock information...
                
                // We now have the Cel-Fi SW version so send the data to the cloud
                SendCloudData( "'SwVerNU_CF':'" + nxtySwVerNuCf + "', 'BuildId_CF':'"  + nxtySwBuildIdNu + "'" );

                // Get ready to receive user information for populating the registration info page
                SendCloudData( "'getUserInfoAction':'false'" );


                // Crank it up since we are no longer talking to the NU...
                clearInterval(MainLoopIntervalHandle);
                MainLoopIntervalHandle = setInterval(app.mainLoop, 1000 );
                            
            
                // Get the CU software version...
                nxtyCurrentReq    = NXTY_SW_CF_CU_TYPE;
                u8TempBuff[0]     = nxtyCurrentReq;
                nxty.SendNxtyMsg(NXTY_SW_VERSION_REQ, u8TempBuff, 1);                
                UpdateStatusLine("Retrieving CU SW version...");
            }            
            else if( nxtySwVerCuPic == null )
            {
            
                // We now have the CU SW version so send the data to the cloud
                SendCloudData( "'SwVerCU_CF':'" + nxtySwVerCuCf + "'" );
                    
                // Request user information...
                SendCloudData( "'getUserInfoAction':'true'" );
                                    
                // Get the CU PIC software version...
                nxtyCurrentReq    = NXTY_SW_CU_PIC_TYPE;
                u8TempBuff[0]     = nxtyCurrentReq;
                nxty.SendNxtyMsg(NXTY_SW_VERSION_REQ, u8TempBuff, 1);                
                UpdateStatusLine("Retrieving CU PIC SW version...");
            }
            else if( nxtySwVerNuPic == null )
            {
                // We now have the CU PIC SW version so send the data to the cloud
                SendCloudData( "'SwVerCU_PIC':'" + nxtySwVerCuPic + "'" );
                            
                // Get the NU PIC software version...
                nxtyCurrentReq    = NXTY_SW_NU_PIC_TYPE;
                u8TempBuff[0]     = nxtyCurrentReq;
                nxty.SendNxtyMsg(NXTY_SW_VERSION_REQ, u8TempBuff, 1);   
                UpdateStatusLine("Retrieving NU PIC SW version...");                             
            }
            else if( nxtySwVerBt == null )
            {
                // We now have the NU PIC SW version so send the data to the cloud
                SendCloudData( "'SwVerNU_PIC':'" + nxtySwVerNuPic + "'" );
                            
                // Get the BT software version...
                nxtyCurrentReq    = NXTY_SW_BT_TYPE;
                u8TempBuff[0]     = nxtyCurrentReq;
                nxty.SendNxtyMsg(NXTY_SW_VERSION_REQ, u8TempBuff, 1);                
                UpdateStatusLine("Retrieving Bluetooth SW version...");                             
            }
            else if( nxtyUniqueId == null )
            {
                // We now have the BT SW version so send the data to the cloud
                SendCloudData( "'SwVer_BT':'" + nxtySwVerBt + "', 'OperatorCode':'" + myOperatorCode + "'"  );

                                
                // Get the Unique ID...
                nxtyCurrentReq  = NXTY_SEL_PARAM_REG_UID_TYPE;
                u8TempBuff[0]   = NXTY_SW_CF_CU_TYPE;
                u8TempBuff[1]   = 2;                      // Unique ID MSD
                u8TempBuff[2]   = 1;                      // Unique ID LSD  
                nxty.SendNxtyMsg(NXTY_SYS_INFO_REQ, u8TempBuff, 3);
                UpdateStatusLine("Syncing User Info from platform...");     
                uMainLoopCounter = 0;                        
            }
            else if( (bGotUserInfoRspFromCloud == false) && (uMainLoopCounter < (MAIN_LOOP_COUNTER_MAX - 5)) )
            {
                SendCloudPoll();
            }
            else 
            {
                if( msgRxLastCmd == NXTY_SYS_INFO_RSP )
                {
                    // We we just received the Unique ID send the data to the cloud
                    SendCloudData( "'UniqueId':'" + nxtyUniqueId + "'" );
                }
                

                // Clear the loop timer to stop the loop...
                clearInterval(MainLoopIntervalHandle);
                navigator.notification.activityStop();
                uMainLoopCounter = 0;
                    
                if( bUniiUp == false )
                {   
                    var eText = "Wireless link between Cel-Fi units is not working.  Registration status unknown.";
                    UpdateStatusLine( eText );            
                    navigator.notification.confirm(
                        eText,    // message
                        HandleUniiRetry,                    // callback to invoke with index of button pressed
                        'UNII Link Down',                   // title
                        ['Retry', 'End'] );                 // buttonLabels                                     
                }
                else if( isNetworkConnected == false )
                {
                    var eText = "Unable to connect to cloud, no WiFi or Cell available.";
                    showAlert( eText, "Network Status.");
                    UpdateStatusLine( eText );
                    navigator.notification.confirm(
                        eText,    // message
                        HandleCloudRetry,                    // callback to invoke with index of button pressed
                        'No WiFi or Cell',                   // title
                        ['Retry', 'End'] );                 // buttonLabels                                     
                                                 
                }
                else if( nxtyRxRegLockStatus == 0x01 )     // State 2:  Only Loc Lock bit set.
                {
                    var eText = "Please call your service provider. (Reg State 2)";
                    showAlert( eText, "Location Lock Set.");
                    UpdateStatusLine( eText );                             
                }  
                else
                {
                    // No critical alerts so post the buttons....
                    document.getElementById("sw_button_id").innerHTML = "<img src='img/button_SwUpdate.png' />";
                    document.getElementById("tk_button_id").innerHTML = "<img src='img/button_TechMode.png' />";
                    document.getElementById("st_button_id").innerHTML = "<img src='img/button_Settings.png' />";

                    UpdateStatusLine( "Select button..." );                             

                    if( (nxtyRxRegLockStatus == 0x0B) || (nxtyRxRegLockStatus == 0x07) )     // State 8 (0x0B) or 12 (0x07)
                    {
                        UpdateRegButton(0);     // Add the reg button.
                        UpdateRegIcon(0);       // Set reg ICON to not registered...
                        showAlert("Please re-register your device by selecting the register button.", "Registration Required.");
                    }                            
                    else if( (nxtyRxRegLockStatus == 0x08) || (nxtyRxRegLockStatus == 0x09) ||    // State 5 (0x08) or 6  (0x09)
                             (nxtyRxRegLockStatus == 0x04) || (nxtyRxRegLockStatus == 0x05) )     // State 9 (0x04) or 10 (0x05)
                    {
                        UpdateRegButton(0);     // Add the reg button.
                        UpdateRegIcon(0);       // Set reg ICON to not registered...
                        showAlert("Please register your device by selecting the register button.", "Registration Required.");
                    }
                    else
                    {
                        if( nxtyRxRegLockStatus & 0x02 )
                        {
                            UpdateRegIcon(1);       // Set reg ICON to Registered...
                        }
                        
                    }
                                                            
                    
                    // Look at the registered status to update the cloud.   Must wait until after the nxtyRxRegLockStatus check above
                    // so the logic will update the isRegistered variable.
                    if( isRegistered == true )
                    {
                        SendCloudData( "'Registered':" + 1 );
                    }
                    else
                    {
                        SendCloudData( "'Registered':" + 0 );
                    }
                
                } 
            }  // End of else
            


            
/*            
Used to poll with status message to show life...
            else
            {
                // stop the timer if no status poll...
                clearInterval(MainLoopIntervalHandle);



            
                // Live here and poll for the status message every 2 seconds ...
                if( msgRxLastCmd == NXTY_STATUS_RSP )
                {
                    if( bDisplayBackgroundRing )
                    {
                        bDisplayBackgroundRing = false;
                        if( isRegistered == true )
                        {
                            $('body').css("background","white url('../www/img/mbackground_reg.png') no-repeat fixed center bottom");
                        }
                        else
                        {
                            $('body').css("background","white url('../www/img/mbackground.png') no-repeat fixed center bottom");
                        }
                    }
                    else
                    {
                        bDisplayBackgroundRing = true;
                        if( isRegistered == true )
                        {
                            $('body').css("background","white url('../www/img/mbackground_reg_ring.png') no-repeat fixed center bottom");
                        }
                        else
                        {
                            $('body').css("background","white url('../www/img/mbackground_ring.png') no-repeat fixed center bottom");
                        }
                    }
                }
                
                nxty.SendNxtyMsg(NXTY_STATUS_REQ, null, 0);
                
            }
*/ 


          
            uMainLoopCounter++;
            
            if( uMainLoopCounter > MAIN_LOOP_COUNTER_MAX )
            {
                // Clear the loop timer to stop the loop...
                clearInterval(MainLoopIntervalHandle);
                navigator.notification.activityStop();
                showAlert("Unable to sync data...", "Timeout");
                UpdateStatusLine( "Timeout: Unable to sync data..." );
            }

        }   // End if( isBluetoothCnx )
		
	}, // End of MainLoop()



};






	
