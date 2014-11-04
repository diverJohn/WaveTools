// Settings...
//
//      Flow.........
//          - User makes antenna selection..
//          - Ok to UART redirect to NU, i.e. 5 second timer expired...
//            - Control Write Cmd 0x0C: Write to Global Flags value to set hardware.  0xF1ACxxxx
//              - Disable all radio buttons.
//            - Control Write Cmd 0x0C: Read from Global Flags until value and 0xFFFFFF00 is 0.   
//            - Read Sys Info Cmd 0x01: Read SelParamReg AntennaStatus.
//              - Enable radio buttons. 
//          - Start 5 second UART redirect timer. 


var StgLoopIntervalHandle       = null;
var	StgState                    = null;
var StgTimeoutCount             = 0;
var antCode                     = 0;
var bOkToRedirectUart           = true;
var uartRedirectTimeout         = null;

const   STG_LOOP_COUNT_MAX      = 15;

const   STG_STATE_SET_ANT               = 1;
const   STG_STATE_VERIFY_FLASH          = 2;
const   STG_STATE_WAIT_FOR_ANT_STATUS   = 3;



// Called at the end of a 5 second timeout to allow the UART to be redirected...
function RedirectUartTimeout()
{
    bOkToRedirectUart = true;
    
PrintLog(1,"bOkToRedirectUart set to true" );    
}


// Start setting the antenna in hardware...
function ant(code)
{
    antCode = 0xF1AC0000 | code;
    antCode >>>= 0; // convert to unsigned since 0xF is MSB
    PrintLog(1, "Set antenna: 0x" + antCode.toString(16) );
    navigator.notification.activityStart("Please wait.", "Setting antenna configuration...");
    UpdateStatusLine("Setting antenna configuration...");
                
    // Disable all radio buttons to keep user from changing while 
    // we are trying to set the hardware...
    for( i = 0; i < 4; i++ )
    {
        document.getElementById("bi_id"+i).disabled = true;
        document.getElementById("be_id"+i).disabled = true;
    }


    StgTimeoutCount = 0;
    
    StgState = STG_STATE_SET_ANT;
    StgLoopIntervalHandle = setInterval(StgLoop, 1000);
}


var Stg = {

	// Handle the Back key
	handleBackKey: function()
	{
	 	PrintLog(1, "Settings: Back key pressed");
	 	clearInterval(StgLoopIntervalHandle);
	 	app.renderHomeView();
	},


    
    
	renderSettingsView: function() 
	{	
	    var u8Buff  = new Uint8Array(10);
	    
		var myBluetoothIcon = isBluetoothCnx ? "<div id='bt_icon_id' class='bt_icon'>" + szBtIconOn + "</div>" : "<div  id='bt_icon_id' class='bt_icon'>" + szBtIconOff + "</div>";
        var myRegIcon       = (nxtyRxRegLockStatus == 0x00) ? "<div id='reg_icon_id' class='reg_icon'></div>" : isRegistered ? "<div id='reg_icon_id' class='reg_icon'>" + szRegIconReg + "</div>" : "<div id='reg_icon_id' class='reg_icon'>" + szRegIconNotReg + "</div>";

		        
		var myHtml = 
			"<img src='img/header_settings.png' width='100%' />" +
			"<button id='back_button_id' type='button' class='back_icon' onclick='reg.handleBackKey()'><img src='img/go_back.png'/></button>"+
			myRegIcon +
            myBluetoothIcon +
            
            
            "<br><br><br><br>" +
            "<div class='settingsSelectContainer'>" +
            
            
            
            "<table id='stgTable' align='center'>" +
            "<tr> <th style='padding: 10px;' colspan='4'>Antenna Selection</th></tr>" + 
            "<tr> <th></th>  <th>Band</th> <th>Internal</th> <th>External</th> </tr>" +
            "<tr> <td style='padding: 10px;'>A</td> <td id='b0'>Band: </td>  <td id='i0'><input type='radio' id='bi_id0' name='bandA' class='myRdBtn' onclick='ant(0x0002)'></td> <td id='e0'><input type='radio' id='be_id0' name='bandA' class='myRdBtn' onclick='ant(0x0200)'></td> </tr>" +
            "<tr> <td style='padding: 10px;'>B</td> <td id='b1'>Band: </td>  <td id='i1'><input type='radio' id='bi_id1' name='bandB' class='myRdBtn' onclick='ant(0x0004)'></td> <td id='e1'><input type='radio' id='be_id1' name='bandB' class='myRdBtn' onclick='ant(0x0400)'></td> </tr>" +
            "<tr> <td style='padding: 10px;'>C</td> <td id='b2'>Band: </td>  <td id='i2'><input type='radio' id='bi_id2' name='bandC' class='myRdBtn' onclick='ant(0x0008)'></td> <td id='e2'><input type='radio' id='be_id2' name='bandC' class='myRdBtn' onclick='ant(0x0800)'></td> </tr>" +
            "<tr> <td style='padding: 10px;'>D</td> <td id='b3'>Band: </td>  <td id='i3'><input type='radio' id='bi_id3' name='bandD' class='myRdBtn' onclick='ant(0x0010)'></td> <td id='e3'><input type='radio' id='be_id3' name='bandD' class='myRdBtn' onclick='ant(0x1000)'></td> </tr>" +
            "</table> </div>" +            
     
            szMyStatusLine;

		$('body').html(myHtml);  
        
		
 		
 		document.getElementById("back_button_id").addEventListener('touchstart', HandleButtonDown );
        document.getElementById("back_button_id").addEventListener('touchend',   HandleButtonUp );
        
        
        // Start the ball rolling...
        nxtyCurrentReq  = NXTY_SEL_PARAM_ANT_STATUS;
        u8Buff[0] = 0x01;                       // Redirect to NU...   
        u8Buff[1] = NXTY_SEL_PARAM_ANT_STATUS;  // SelParamReg 1: AntennaStatus
        u8Buff[2] = 0;                          // SelParamReg 2: NA
        nxty.SendNxtyMsg(NXTY_SYS_INFO_REQ, u8Buff, 3);
          
        StgTimeoutCount = 0;
        StgState        = STG_STATE_WAIT_FOR_ANT_STATUS;
        StgLoopIntervalHandle = setInterval(StgLoop, 100);
        navigator.notification.activityStart("Please wait.", "Getting current antenna status...");
        
        currentView = "settings";
	},
};


	
function StgLoop() 
{
    var i;
    var bIntAnt;
    var uBand;
    var u8Buff  = new Uint8Array(20);

    PrintLog(1, "Settings loop...StgState=" + StgState );
    StgTimeoutCount++; 
        
    if( StgTimeoutCount > STG_LOOP_COUNT_MAX )
    {
        UpdateStatusLine("Unable to set antenna configuration...");
        showAlert("Unable to set antenna configuration.", "Timeout.");
        
        // Reset to last known Ant configuration
        StgState = STG_STATE_WAIT_FOR_ANT_STATUS;
        window.msgRxLastCmd = NXTY_SYS_INFO_RSP;
    }
    
        
    switch( StgState )
    {
        case STG_STATE_SET_ANT:
        {
            // Must wait here until 5 seconds after the last NU access
            // for the UART redirect to time out.
            if( bOkToRedirectUart )
            {
                // Send the actual antenna selection message...
                u8Buff[0] = 0x01;                               // Redirect to NU on entry...   
                u8Buff[1] = (NXTY_PCCTRL_GLOBALFLAGS >> 24);    // Note that javascript converts var to INT32 for shift operations.
                u8Buff[2] = (NXTY_PCCTRL_GLOBALFLAGS >> 16);
                u8Buff[3] = (NXTY_PCCTRL_GLOBALFLAGS >> 8);
                u8Buff[4] = NXTY_PCCTRL_GLOBALFLAGS;
                u8Buff[5] = (antCode >> 24);                    // Note that javascript converts var to INT32 for shift operations.
                u8Buff[6] = (antCode >> 16);
                u8Buff[7] = (antCode >> 8);
                u8Buff[8] = (antCode >> 0);
            
                nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);
                UpdateStatusLine("Verifying antenna flash write...");
                StgState = STG_STATE_VERIFY_FLASH;
            }
            break;
        }
    
        case STG_STATE_VERIFY_FLASH:
        {
            if( window.msgRxLastCmd == NXTY_CONTROL_WRITE_RSP )
            {
                // Read global flags and see if data has been written...
                if( (nxtyCtrlWriteRsp & 0xFFFFFF00) == 0 )
                {
                    // Data has been written successfully. 
                    UpdateStatusLine("Reading antenna configuration...");
                    StgState = STG_STATE_WAIT_FOR_ANT_STATUS;
                    
                    nxtyCurrentReq  = NXTY_SEL_PARAM_ANT_STATUS;
                    u8Buff[0] = 0x02;                       // Should already be redirected...code for CU   
                    u8Buff[1] = NXTY_SEL_PARAM_ANT_STATUS;  // SelParamReg 1: AntennaStatus
                    u8Buff[2] = 0;                          // SelParamReg 2: NA
                
                    nxty.SendNxtyMsg(NXTY_SYS_INFO_REQ, u8Buff, 3);                    
                }
                else
                {
                    u8Buff[0] = 0x00;                               // Should already be redirected...   
                    u8Buff[1] = (NXTY_PCCTRL_GLOBALFLAGS >> 24);    // Note that javascript converts var to INT32 for shift operations.
                    u8Buff[2] = (NXTY_PCCTRL_GLOBALFLAGS >> 16);
                    u8Buff[3] = (NXTY_PCCTRL_GLOBALFLAGS >> 8);
                    u8Buff[4] = NXTY_PCCTRL_GLOBALFLAGS;
                    u8Buff[5] = 0xDE;                               // Set value to 0xDEADBEEF to read register
                    u8Buff[6] = 0xAD;
                    u8Buff[7] = 0xBE;
                    u8Buff[8] = 0xEF;
                
                    nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);
                }
            }
            break;
        }
    

    
    
        case STG_STATE_WAIT_FOR_ANT_STATUS:
        {
            var uTemp;
            
            // Wait in this state until the Cel-Fi unit responds...
            if( window.msgRxLastCmd == NXTY_SYS_INFO_RSP )
            {
                uTemp = nxtyAntStatus;
                
                for( i = 0; i < 4; i++ )
                {   
                    bIntAnt = false;
                    uBand = uTemp & 0xFF;
                    
                    // Check bit 7 which contains ant info.  0=ext, 1=int
                    if( uBand )
                    {
                        // Make sure the radio buttons are enabled...
                        document.getElementById("bi_id"+i).disabled = false;
                        document.getElementById("be_id"+i).disabled = false;
                        
                        if( uBand & 0x80 )
                        {
                            bIntAnt = true;
                            uBand   &= 0x7F;
                        }
                    
                        document.getElementById("b"+i).innerHTML = "Band: " + uBand;
                        
                        if( bIntAnt )
                        {
                            document.getElementById("bi_id"+i).checked = true;
                        }
                        else
                        {
                            document.getElementById("be_id"+i).checked = true;
                        }
                    }
                    else
                    {
                        document.getElementById("b"+i).innerHTML = "Unused";
                        document.getElementById("bi_id"+i).disabled = true;
                        document.getElementById("be_id"+i).disabled = true;
                    }
                    
                    // Move to the next band...
                    uTemp >>= 8;
                    
                }
            
            
                clearInterval(StgLoopIntervalHandle);
                navigator.notification.activityStop();
    
                if( StgTimeoutCount <= STG_LOOP_COUNT_MAX )
                {
                    UpdateStatusLine("Current antenna status...");
                }
                
                // Send an unnecessary message just to cancel UART redirect...
                u8Buff[0] = 0x80;                               // Cancel: Should already be redirected...   
                u8Buff[1] = (NXTY_PCCTRL_GLOBALFLAGS >> 24);    // Note that javascript converts var to INT32 for shift operations.
                u8Buff[2] = (NXTY_PCCTRL_GLOBALFLAGS >> 16);
                u8Buff[3] = (NXTY_PCCTRL_GLOBALFLAGS >> 8);
                u8Buff[4] = NXTY_PCCTRL_GLOBALFLAGS;
                u8Buff[5] = 0xDE;                               // Set value to 0xDEADBEEF to read register
                u8Buff[6] = 0xAD;
                u8Buff[7] = 0xBE;
                u8Buff[8] = 0xEF;
                nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);                
                
                // Do not allow communication to the NU for another 5 seconds....                
                bOkToRedirectUart = false;
                uartRedirectTimeout = setTimeout(RedirectUartTimeout, 5000);
            }
            else
            {
                // Since we got here using the 100 mS timer reset to something more reasonable...
                clearInterval(StgLoopIntervalHandle);
                StgLoopIntervalHandle = setInterval(StgLoop, 1000);
            }
            break; 
        }

        default:
        {
            clearInterval(DldLoopIntervalHandle);
            UpdateStatusLine("Invalid State.");
            break;
        }
        
    }   // end switch
}
