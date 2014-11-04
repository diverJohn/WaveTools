
// Software download...
//
//  Flow:
//      User presses "Check for SW" button on main page.
//        - renderDldView()
//          - Send "isUpdateAvailable:false" to the cloud to get ready to look for updates
//          - Set state to DLD_STATE_INIT
//
//  Phase 1: Look for updates...
//      DLD_STATE_INIT  
//        - Send "isUpdateAvailable:true" to the cloud to trigger the look for updates
//      DLD_STATE_CHECK_FOR_UPDATES
//        - Continue polling the cloud, up to 12 times, once per second.    
//        - Egress response will be handled in function ProcessEgressResponse().
//
//  Phase 2: User to select which image to update and press "Update Selected"
//        - handleDldKey()
//        - Set state to DLD_STATE_GET_FROM_CLOUD
//
//  Phase 3: Download from the cloud to the phone's /Download directory 
//      DLD_STATE_GET_FROM_CLOUD
//      DLD_STATE_WAIT_ON_CLOUD
//
//  Phase 4: Download the file from the phone's directory to the Cel-Fi...
//      DLD_STATE_TO_CELFI_INIT
//      DLD_STATE_START_REQ
//      DLD_STATE_START_RSP
//      DLD_STATE_TRANSFER_REQ
//      DLD_STATE_TRANSFER_RSP
//      DLD_STATE_END_REQ
//      DLD_STATE_END_RSP
//


var DldLoopIntervalHandle           = null;
var	DldState                        = null;
var DldTimeoutCount                 = 0;
var DldNakCount                     = 0;


const DLD_STATE_INIT                = 1;
const DLD_STATE_CHECK_FOR_UPDATES   = 2;
const DLD_STATE_GET_FROM_CLOUD      = 3;
const DLD_STATE_WAIT_ON_CLOUD       = 4
const DLD_STATE_TO_CELFI_INIT       = 5;
const DLD_STATE_START_REQ           = 6;
const DLD_STATE_START_RSP           = 7;
const DLD_STATE_TRANSFER_REQ        = 8;
const DLD_STATE_TRANSFER_RSP        = 9;
const DLD_STATE_END_REQ             = 10;
const DLD_STATE_END_RSP             = 11;
const DldStateNames                 = ["N/A", "Init", "Check for Updates", "Get From Cloud", "Wait on Cloud", "To Cel-Fi Init", 
                                        "Start Req", "Start Rsp", "Transfer Req", "Transfer Rsp", "End Req", "End Rsp"];

const DLD_NAK_COUNT_MAX             = 2;
const DLD_TIMEOUT_COUNT_MAX         = 12;

const NU_TYPE                       = 1;
const CU_TYPE                       = 2;
const NU_PIC_TYPE                   = 3;
const CU_PIC_TYPE                   = 4;
const BT_TYPE                       = 5;
const NONE_TYPE                     = 6;


// Fixed file names to search for in the package info...
const myNuCfFileName                = "WuExecutable.sec";        
const myCuCfFileName                = "CuExecutable.sec";  
const myNuPicFileName               = "NuPICFlashImg.bin";  
const myCuPicFileName               = "CuPICFlashImg.bin";
const myBtFileName                  = "BTFlashImg.bin";


const u8AresFlashAddr               = 0xF8100000;
//const u8PicFlashAddr                = 0xF8FE0000;
const u8PicFlashAddr                = 0xF8F00000;
const u8BtFlashAddr                 = 0xF8FC0000;

var startType                       = null;
var startAddr                       = null;
var resumeAddr                      = null;

           
var fileSystemDownloadDir           = null;
var u8FileBuff                      = null;
var actualFileLen                   = 0;
var resumeFileLen                   = 0;
var fileIdx                         = 0;
var completedFileIdx                = 0;

var fileNuCfCldId                   = null;  
var fileCuCfCldId                   = null;  
var fileNuPicCldId                  = null;
var fileCuPicCldId                  = null;
var fileBtCldId                     = null;
var myDownloadFileCldId             = null
var myDownloadFileName              = null;
var myDownloadFileVer               = null;
var bDownloadFromCloudSuccess       = null;

var bGotUpdateAvailableRspFromCloud = false;



// File System callbacks.  Get a file system that points to the download directory................................
function onFSSuccessCB(fs) 
{
    fileSystemDownloadDir = fs;
    PrintLog(1, "Got filesystem on directory: " + fileSystemDownloadDir.name );
} 

function onFSErrorCB(e) 
{
    PrintLog(99, e.toString() );
} 
// End of File System callbacks.  Get a file system that points to the download directory................................



// Download from Cloud File transfer callbacks..................................................................
function onFileTransferSuccessCB(successFile)
{
    PrintLog(1, "Download from cloud successfully complete: " + successFile.toURL());
    bDownloadFromCloudSuccess = true;
}

function onFileTransferFailCB(error)
{
    PrintLog(99, "Download from cloud: source: " + error.source + " Target: " + error.target + " Error code: " + error.code);
    bDownloadFromCloudSuccess = false;
}
// End of Download from Cloud File transfer callbacks..................................................................




function onGetFileErrorCB(e) 
{
    PrintLog(99, "Unable to open file: " + myDownloadFileName + "  Error:" + e.toString() );
    showAlert("Unable to open file: " + myDownloadFileName, "File Open Error");
}




// Read file call backs...................................................................
function gotFileEntryCB(fileEntry) 
{
    PrintLog(1, "gotFileEntryCB()");
    fileEntry.file(gotFileCB, onFileEntryErrorCB);
}

function gotFileCB(file)
{
    PrintLog(1, "gotFileCB()");
    readAsArrayBuffer(file);
}

// error handler
function onFileEntryErrorCB(e) 
{
    PrintLog(99, e.toString() );
}




function readAsArrayBuffer(file) 
{
    var reader     = new FileReader();
    reader.onload  = ReadFileOnLoadCB;       // Called when the read has successfully completed.
    reader.onerror = ReadFileOnErrorCB;      // Called when the read has failed.
      
    reader.readAsArrayBuffer(file);
}

function ReadFileOnLoadCB(evt)
{
    PrintLog(1, "Read has completed successfully");
//    PrintLog(1, evt.target.result);

    // Make an array of UINT8 type.  evt.target.result holds the contents of the file.
    u8FileBuff = new Uint8Array(evt.target.result);
    
    actualFileLen = u8FileBuff.length;
    resumeFileLen = u8FileBuff.length;
    PrintLog(1, "Length of array, i.e. file is: " + actualFileLen ); 
    
    // Start the actual download process to Cel-Fi
    DldState = DLD_STATE_TO_CELFI_INIT;
    DldLoop();
    
}

function ReadFileOnErrorCB(evt)
{
    PrintLog(1, "Unable to read file: " + myDownloadFileName );
    showAlert("Unable to read file: " + myDownloadFileName, "File Read Error");
}
// End of Read File call backs....................................................................................












var Dld = {

	// Handle the Back key
	handleBackKey: function()
	{
	 	PrintLog(1, "Sw: SW Mode Back key pressed");
	 	clearInterval(DldLoopIntervalHandle);
	 	app.renderHomeView();
	},

	// Handle the Sw Key functionality...
	handleDldKey: function()
	{
        var bOkToDownload = false;
        
        PrintLog(1, "Update Selected Key pressed");

        
        // See if the NU was selected 
        if( document.getElementById("s0").innerHTML != "" )
        {
            if( document.getElementById("ckbx_nu_id").checked )
            {
                PrintLog(1, "NU selected for download." );

                // Fill in the information necessary to transfer from the cloud to the phone                
                myDownloadFileCldId = fileNuCfCldId;
                myDownloadFileName  = myNuCfFileName;
                myDownloadFileVer   = nxtySwVerNuCfCld;

                // Fill in the information necessary to open the file on the phone and download to Cel-Fi
                startType           = NU_TYPE
                startAddr           = u8AresFlashAddr;
                resumeAddr          = startAddr;
                bOkToDownload       = true;                
            }
        }
        
        if( (document.getElementById("s1").innerHTML != "") && (bOkToDownload == false) )
        {
            if( document.getElementById("ckbx_cu_id").checked )
            {
                PrintLog(1, "CU selected for download." );
                
                // Fill in the information necessary to transfer from the cloud to the phone                
                myDownloadFileCldId = fileCuCfCldId;
                myDownloadFileName  = myCuCfFileName;
                myDownloadFileVer   = nxtySwVerCuCfCld;

                // Fill in the information necessary to open the file on the phone and download to Cel-Fi
                startType           = CU_TYPE
                startAddr           = u8AresFlashAddr;
                resumeAddr          = startAddr;
                bOkToDownload       = true;                
            }
        }
        
        if( (document.getElementById("s2").innerHTML != "") && (bOkToDownload == false) )
        {
            if( document.getElementById("ckbx_nupic_id").checked )
            {
                PrintLog(1, "NU PIC selected for download." );
                
                // Fill in the information necessary to transfer from the cloud to the phone
                myDownloadFileCldId = fileNuPicCldId;
                myDownloadFileName  = myNuPicFileName;
                myDownloadFileVer   = nxtySwVerNuPicCld;

                // Fill in the information necessary to open the file on the phone and download to Cel-Fi
                startType           = NU_PIC_TYPE
                startAddr           = u8PicFlashAddr;
                resumeAddr          = startAddr;
                bOkToDownload       = true;                
            }
        }
        
        if( (document.getElementById("s3").innerHTML != "") && (bOkToDownload == false) )
        {
            if( document.getElementById("ckbx_cupic_id").checked )
            {
                PrintLog(1, "CU PIC selected for download." );
                
                // Fill in the information necessary to transfer from the cloud to the phone
                myDownloadFileCldId = fileCuPicCldId;
                myDownloadFileName  = myCuPicFileName;
                myDownloadFileVer   = nxtySwVerCuPicCld;

                // Fill in the information necessary to open the file on the phone and download to Cel-Fi
                startType           = CU_PIC_TYPE
                startAddr           = u8PicFlashAddr;
                resumeAddr          = startAddr;
                bOkToDownload       = true;

            }
        }
         
        
        if( (document.getElementById("s4").innerHTML != "") && (bOkToDownload == false) )
        {   
            if( document.getElementById("ckbx_cubt_id").checked )
            {
                PrintLog(1, "CU BT selected for download." );
                
                // Fill in the information necessary to transfer from the cloud to the phone
                myDownloadFileCldId = fileBtCldId;
                myDownloadFileName  = myBtFileName;
                myDownloadFileVer   = nxtySwVerBtCld;

                // Fill in the information necessary to open the file on the phone and download to Cel-Fi
                startType           = BT_TYPE
                startAddr           = u8BtFlashAddr;
                resumeAddr          = startAddr;
                bOkToDownload       = true;                
            }        
        }


        if( bOkToDownload )
        {
            if( fileSystemDownloadDir != null )
            {
                var infoText = "Downloading file: " + myDownloadFileName + " Ver: " + myDownloadFileVer + " from cloud."
                DldState              = DLD_STATE_GET_FROM_CLOUD;
                
                
// jdo test - bypass getting file from cloud
DldState = DLD_STATE_WAIT_ON_CLOUD;
bDownloadFromCloudSuccess = true;
// end of test                 
                                
                DldTimeoutCount       = 0;
                DldLoopIntervalHandle = setInterval(DldLoop, 1000);
                
                // Add version to end of file name...
                myDownloadFileName += ("_" + myDownloadFileVer);
                navigator.notification.activityStart( "Please wait", infoText );
                UpdateStatusLine(infoText);
            }
            else
            {
                PrintLog(99, "Unable to open file system on phone." );
            }
        }
        

	    
	},

    
    
	renderDldView: function() 
	{	
		var myBluetoothIcon = isBluetoothCnx ? "<div id='bt_icon_id' class='bt_icon'>" + szBtIconOn + "</div>" : "<div  id='bt_icon_id' class='bt_icon'>" + szBtIconOff + "</div>";
        var myRegIcon       = (nxtyRxRegLockStatus == 0x00) ? "<div id='reg_icon_id' class='reg_icon'></div>" : isRegistered ? "<div id='reg_icon_id' class='reg_icon'>" + szRegIconReg + "</div>" : "<div id='reg_icon_id' class='reg_icon'>" + szRegIconNotReg + "</div>";

		        
		var myHtml = 
			"<img src='img/header_dld.png' width='100%' />" +
			"<button id='back_button_id' type='button' class='back_icon' onclick='Dld.handleBackKey()'><img src='img/go_back.png'/></button>"+
			myRegIcon +
            myBluetoothIcon +
            
            
            "<br><br><br><br>" +
            "<div class='downloadSelectContainer'>" +
            
            
            "<table id='dldTable' align='center'>" +
            "<tr> <th style='padding: 10px;' colspan='4'>Update Software Menu</th></tr>" + 
            "<tr> <th>Image</th>  <th>Ver</th> <th>Cloud</th> <th>Select</th> </tr>" +
            "<tr> <td><br>NU</td>     <td id='v0'></td>  <td id='c0'></td> <td id='s0'>  </td> </tr>" +
            "<tr> <td><br>CU</td>     <td id='v1'></td>  <td id='c1'></td> <td id='s1'>  </td> </tr>" +
            "<tr> <td><br>NU PIC</td> <td id='v2'></td>  <td id='c2'></td> <td id='s2'>  </td> </tr>" +
            "<tr> <td><br>CU PIC</td> <td id='v3'></td>  <td id='c3'></td> <td id='s3'>  </td> </tr>" +
            "<tr> <td><br>CU BT</td>  <td id='v4'></td>  <td id='c4'></td> <td id='s4'>  </td> </tr>" +
            "<tr> <td style='padding: 20px;' colspan='4'><input style='font-size: 24px;' type='button' value='Update Selected' onclick='Dld.handleDldKey()'></input> </td> </tr>" +
            "</table> </div>" +            
     
            

            szMyStatusLine;

		$('body').html(myHtml);  
        
        // Version info from the hardware...
        document.getElementById("v0").innerHTML = nxtySwVerNuCf;
        document.getElementById("v1").innerHTML = nxtySwVerCuCf;
        document.getElementById("v2").innerHTML = nxtySwVerNuPic;
        document.getElementById("v3").innerHTML = nxtySwVerNuPic;
        document.getElementById("v4").innerHTML = nxtySwVerBt;
        



        
 		document.getElementById("back_button_id").addEventListener('touchstart', HandleButtonDown );
        document.getElementById("back_button_id").addEventListener('touchend',   HandleButtonUp );
        
        

    
        // This gets a file system pointing to the Download directory on Android....
        // Store into     
        window.resolveLocalFileSystemURL( "file:///storage/emulated/0/Download/", onFSSuccessCB, onFSErrorCB);
        
        
        UpdateStatusLine("Checking for updates...");
        navigator.notification.activityStart( "Please wait", "Checking for updates..." );
        
        // Pre fill with a known value before requesting from cloud...
        nxtySwVerNuCfCld    = swVerNoCldText;
        nxtySwVerCuCfCld    = swVerNoCldText;
        nxtySwVerNuPicCld   = swVerNoCldText;
        nxtySwVerCuPicCld   = swVerNoCldText;
        nxtySwVerBtCld      = swVerNoCldText;
        bGotUpdateAvailableRspFromCloud = false;
        
        SendCloudData(  "'isUpdateAvailable':'false'" );
        
        // Start the ball rolling...this allows the false above to go out about 1 second before the true.
        DldState = DLD_STATE_INIT;
        DldLoopIntervalHandle = setInterval(DldLoop, 1000);
        
        currentView = "download";
	},
};


	
function DldLoop() 
{
    var i;
    var u8Buff  = new Uint8Array(20);

    PrintLog(1, "Download loop...DldState=" + DldStateNames[DldState] );
    DldTimeoutCount++; 
        
    switch( DldState )
    {
    
        //---------------------------------------------------------------------------------------
        // Phase 1: Look for updates...
        case DLD_STATE_INIT:
        {
            // Send a request to the cloud to send updates...
            SendCloudData(  "'isUpdateAvailable':'true'" );
            DldState              = DLD_STATE_CHECK_FOR_UPDATES;
            DldTimeoutCount       = 0;
            break; 
        }
            
        case DLD_STATE_CHECK_FOR_UPDATES:
        {
        
            if( bGotUpdateAvailableRspFromCloud == true )
            {
                // Received response and handled in ProcessEgressResponse
                
                // Version info from the cloud...
                document.getElementById("c0").innerHTML = nxtySwVerNuCfCld;
                document.getElementById("c1").innerHTML = nxtySwVerCuCfCld;
                document.getElementById("c2").innerHTML = nxtySwVerNuPicCld;
                document.getElementById("c3").innerHTML = nxtySwVerCuPicCld;
                document.getElementById("c4").innerHTML = nxtySwVerBtCld;
        
                // Add radio buttons...
                //  type: used by browser to display a radio button
                //  name: used by browser to know that only one button of this name can be pressed at any time.
                //  id:   used by code to determine which button has been selected.
                //  class: used by css code to define the format of the button.
                document.getElementById("s0").innerHTML = (nxtySwVerNuCfCld  == swVerNoCldText)?"":"<input type='radio' name='dld' id='ckbx_nu_id'    class='myRdBtn'>";
                document.getElementById("s1").innerHTML = (nxtySwVerCuCfCld  == swVerNoCldText)?"":"<input type='radio' name='dld' id='ckbx_cu_id'    class='myRdBtn'>";
                document.getElementById("s2").innerHTML = (nxtySwVerNuPicCld == swVerNoCldText)?"":"<input type='radio' name='dld' id='ckbx_nupic_id' class='myRdBtn'>";
                document.getElementById("s3").innerHTML = (nxtySwVerCuPicCld == swVerNoCldText)?"":"<input type='radio' name='dld' id='ckbx_cupic_id' class='myRdBtn'>";
                document.getElementById("s4").innerHTML = (nxtySwVerBtCld    == swVerNoCldText)?"":"<input type='radio' name='dld' id='ckbx_cubt_id'  class='myRdBtn'>";
                
                
                clearInterval(DldLoopIntervalHandle);
                navigator.notification.activityStop();
                UpdateStatusLine("Update status acquired.");
            }
            else
            {
                // Send the poll command to look for updates...
                SendCloudPoll();
            }
            
            if( DldTimeoutCount >= DLD_TIMEOUT_COUNT_MAX )
            {
                // after 10 times exit stage left...
                clearInterval(DldLoopIntervalHandle);
                navigator.notification.activityStop();
                UpdateStatusLine("Update status not available.");
                showAlert("Update status not available.", "Timeout.");
            }
     

// jdo Test...            
if( DldTimeoutCount >= 2 )
{

    // Note that the 1062 must be changed to match the actual file ID.
    var rsp = {packages:[
                            {id:642, instructions:[{"@type":"down", id:1062, fn:"WuExecutable.sec", fp:"."}], priority:0,time:1414810929705},
                            {id:642, instructions:[{"@type":"down", id:1062, fn:"CuExecutable.sec", fp:"."}], priority:0,time:1414810929705},
                            {id:642, instructions:[{"@type":"down", id:1062, fn:"PICFlashImg.bin", fp:"."}], priority:0,time:1414810929705},
                            {id:642, instructions:[{"@type":"down", id:1062, fn:"PICFlashImg.bin", fp:"."}], priority:0,time:1414810929705},
                            {id:642, instructions:[{"@type":"down", id:1062, fn:"BTFlashImg.bin", fp:"."}], priority:0,time:1414810929705},
                        ],
                
              set:[
                    {items:{SwVerNU_CF_CldVer:"01.04.00"},priority:0},
                    {items:{SwVerCU_CF_CldVer:"02.04.00"},priority:0},
                    {items:{SwVerNU_PIC_CldVer:"03.04"},priority:0},
                    {items:{SwVerCU_PIC_CldVer:"04.04"},priority:0},
                    {items:{SwVer_BT_CldVer:"05.04"},priority:0},
                    {items:{isUpdateAvailable:true},priority:0},
                ]};
                      
    
    PrintLog( 1, "Rsp..." + JSON.stringify(rsp) );
    ProcessEgressResponse(rsp);
}

            
            break; 
        }

        //---------------------------------------------------------------------------------------
        // Phase 3: Download from the cloud to the phone's /Download directory 
        case DLD_STATE_GET_FROM_CLOUD:
        {
            // Perform a file transfer from the platform to the destination directory...        
            var fileTransfer = new FileTransfer();         

            // URL looks like: "https://nextivity-sandbox-connect.axeda.com/ammp/packages/1/files/MN8!900425000022/323",
            var myDownloadUrl = myPlatformUrl + "packages/1/files/" + myModel + "!" + mySn + "/" + myDownloadFileCldId;
            
            // Path:   "file:///storage/emulated/0/Download/PicFromCloud.bin",
            var myPhoneFilePath = "file:///storage/emulated/0/Download/" + myDownloadFileName;
            
            bDownloadFromCloudSuccess   = null;
            DldState                    = DLD_STATE_WAIT_ON_CLOUD;
            DldTimeoutCount             = 0;
            
            fileTransfer.download(
                   myDownloadUrl,
                   myPhoneFilePath,
                   onFileTransferSuccessCB,
                   onFileTransferFailCB );

            break;
        }
        
        case DLD_STATE_WAIT_ON_CLOUD:
        {
            if( bDownloadFromCloudSuccess != null )
            {
                if( bDownloadFromCloudSuccess == true )
                {
                    // File is now on the phone, download from phone to Cel-Fi
                    var infoText = "Downloading file: " + myDownloadFileName + " from phone to Cel-Fi."
                    navigator.notification.activityStart( "Please wait", infoText );
                    UpdateStatusLine(infoText);
                    clearInterval(DldLoopIntervalHandle);

                    // Get the file... The success call back will set the state to CELFI_INIT   
                    fileSystemDownloadDir.getFile( myDownloadFileName, {create:false}, gotFileEntryCB, onGetFileErrorCB );                  
                }
            }
            
            if( (DldTimeoutCount >= DLD_TIMEOUT_COUNT_MAX) || (bDownloadFromCloudSuccess == false) )
            {
                // after so many times exit stage left...
                clearInterval(DldLoopIntervalHandle);
                navigator.notification.activityStop();
                UpdateStatusLine("Unable to download file from platform.");
                showAlert("Unable to download file from platform.", "Timeout.");
            }
            
            break;
        }       



        //---------------------------------------------------------------------------------------
        // Phase 4: Download the file from the phone's directory to the Cel-Fi...
        case DLD_STATE_TO_CELFI_INIT:
        {
            DldState              = DLD_STATE_START_REQ;
            DldLoopIntervalHandle = setInterval(DldLoop, 500);
            DldTimeoutCount       = 0;
            fileIdx               = 0;
            completedFileIdx      = 0;
            
            // Fall through to the next state.... 
        }

        case DLD_STATE_START_REQ:
        {
            // Send a message to the Cel-Fi unit to start downloading...
            u8Buff[0] = startType;   
            u8Buff[1] = (resumeAddr >> 24);        // Note that javascript converts var to INT32 for shift operations.
            u8Buff[2] = (resumeAddr >> 16);
            u8Buff[3] = (resumeAddr >> 8);
            u8Buff[4] = resumeAddr;
            u8Buff[5] = (resumeFileLen >> 24);     // Note that javascript converts var to INT32 for shift operations.
            u8Buff[6] = (resumeFileLen >> 16);
            u8Buff[7] = (resumeFileLen >> 8);
            u8Buff[8] = (resumeFileLen >> 0);
            
            nxty.SendNxtyMsg(NXTY_DOWNLOAD_START_REQ, u8Buff, 9);
            DldState = DLD_STATE_START_RSP;
            break;
        }
            

            
        case DLD_STATE_START_RSP:
        {
            // Wait in this state until the Cel-Fi unit responds...
            if( window.msgRxLastCmd == NXTY_DOWNLOAD_START_RSP )
            {
                if( nxtySwDldStartRspAddr != resumeAddr )
                {
                    resumeAddr       = nxtySwDldStartRspAddr;
                    resumeFileLen    = actualFileLen - (startAddr - resumeAddr);
                    completedFileIdx = actualFileLen - resumeFileLen;
                }
                
                // Move on to next state...
                DldState        = DLD_STATE_TRANSFER_REQ;
                DldNakCount     = 0;
                DldTimeoutCount = 0;   
                
                // Crank it up so that we can respond as fast as possible.
                clearInterval(DldLoopIntervalHandle);
                DldLoopIntervalHandle = setInterval(DldLoop, 50);             
            }
            else if( window.msgRxLastCmd == NXTY_NAK_RSP )
            {   
                // Try again if CRC NAK...
                if( nxtyLastNakType == NXTY_NAK_TYPE_CRC )
                {
                    DldState = DLD_STATE_START_REQ;
                    
                    if( DldNakCount++ >= DLD_NAK_COUNT_MAX )
                    {
                        clearInterval(DldLoopIntervalHandle);
                        navigator.notification.activityStop();
                        UpdateStatusLine("Failed to receive SW Download Start Response Msg from Cel-Fi device due to CRC error.");
                        showAlert("SW Download Start Response Msg error from Cel-Fi device.", "CRC Error Max.");
                    }
                }
            }
            else
            {   
                if( DldTimeoutCount >= DLD_TIMEOUT_COUNT_MAX )
                {
                    // after so many times exit stage left...
                    clearInterval(DldLoopIntervalHandle);
                    navigator.notification.activityStop();
                    UpdateStatusLine("Failed to receive SW Download Start Response Msg from Cel-Fi device.");
                    showAlert("No SW Download Start Response Msg from Cel-Fi device.", "Timeout.");
                }
            }
            break;
        }

                    
        case DLD_STATE_TRANSFER_REQ:
        {
            DldTransferReq();
            break;
        }
            
        case DLD_STATE_TRANSFER_RSP:
        {
            // Wait in this state until the Cel-Fi unit responds...
            if( window.msgRxLastCmd == NXTY_DOWNLOAD_TRANSFER_RSP )
            {
                // See if the Continue flag was set to 1, if so then continue...
                if( nxtySwDldXferRspCont == 1 )
                {
                    completedFileIdx = fileIdx;
                    UpdateStatusLine(myDownloadFileName + "..." + Math.round(fileIdx/actualFileLen * 100) + "%" ); 
                
                    if( completedFileIdx >= actualFileLen )
                    { 
                        // end transfer
                        DldState = DLD_STATE_END_REQ;
                    }
                    else
                    {
                        // transfer some more...
                        DldTransferReq();
                    }
                    DldTimeoutCount = 0;
                    DldNakCount     = 0;
                }
                else
                {
                    // Continue was set to 0 which means to re calculate the start...
                    startType       = NONE_TYPE;
                    resumeAddr      = startAddr + completedFileIdx;
                    resumeFileLen   = actualFileLen - (startAddr - resumeAddr);
                    
                    DldState = DLD_STATE_START_REQ;
                }     
            }
            else if( window.msgRxLastCmd == NXTY_NAK_RSP )
            {   
                // Try again if CRC NAK...
                if( nxtyLastNakType == NXTY_NAK_TYPE_CRC )
                {
                    DldState = DLD_STATE_TRANSFER_REQ;
                    
                    if( DldNakCount++ >= DLD_NAK_COUNT_MAX )
                    {
                        clearInterval(DldLoopIntervalHandle);
                        navigator.notification.activityStop();
                        UpdateStatusLine("Failed to receive SW Download Transfer Response Msg from Cel-Fi device due to CRC error.");
                        showAlert("SW Download Transfer Msg error from Cel-Fi device.", "CRC Error Max.");
                    }
                }
            }            
            else
            {   
                if( DldTimeoutCount >= (DLD_TIMEOUT_COUNT_MAX * 10) )   // Multiply by 10 since the time interval is divided by 10 (500/10=50)
                {
                    // after so many times exit stage left...
                    clearInterval(DldLoopIntervalHandle);
                    navigator.notification.activityStop();
                    UpdateStatusLine("Failed to receive SW Download Transfer Response Msg from Cel-Fi device.");
                    showAlert("No SW Download Transfer Response Msg from Cel-Fi device.", "Timeout.");
                }
            }
            break;
        }            
            
            
        case DLD_STATE_END_REQ:
        {
            u8Buff[0] = 0;  // No reset 
            nxty.SendNxtyMsg(NXTY_DOWNLOAD_END_REQ, u8Buff, 1);
            DldState = DLD_STATE_END_RSP; 
            
            // Slow it down again...
            clearInterval(DldLoopIntervalHandle);
            DldLoopIntervalHandle = setInterval(DldLoop, 500); 
            break;
        }

        case DLD_STATE_END_RSP:
        {
            // Wait in this state until the Cel-Fi unit responds...
            if( window.msgRxLastCmd == NXTY_DOWNLOAD_END_RSP )
            {
                UpdateStatusLine("Download Complete... " ); 
                clearInterval(DldLoopIntervalHandle);
                navigator.notification.activityStop();
            }
            else if( window.msgRxLastCmd == NXTY_NAK_RSP )
            {   
                // Try again if CRC NAK...
                if( nxtyLastNakType == NXTY_NAK_TYPE_CRC )
                {
                    DldState = DLD_STATE_END_REQ;
                    
                    if( DldNakCount++ >= DLD_NAK_COUNT_MAX )
                    {
                        clearInterval(DldLoopIntervalHandle);
                        navigator.notification.activityStop();
                        UpdateStatusLine("Failed to receive SW Download End Response Msg from Cel-Fi device due to CRC error.");
                        showAlert("SW Download End Msg error from Cel-Fi device.", "CRC Error Max.");
                    }
                }
            }             
            else
            {   
                if( DldTimeoutCount >= DLD_TIMEOUT_COUNT_MAX )
                {
                    // after 10 times exit stage left...
                    clearInterval(DldLoopIntervalHandle);
                    navigator.notification.activityStop();
                    UpdateStatusLine("Failed to receive SW Download End Response Msg from Cel-Fi device.");
                    showAlert("No SW Download End Response Msg from Cel-Fi device.", "Timeout.");
                }
            }
            break;
        }

        default:
        {
            clearInterval(DldLoopIntervalHandle);
            UpdateStatusLine("Invalid Download State.");
            break;
        }
        
    }   // end switch
}
	
	
function DldTransferReq() 
{
    var chunkSize;
    var u8Buff  = new Uint8Array(NXTY_MED_MSG_SIZE);
    
    chunkSize = NXTY_DOWNLOAD_MAX_SIZE;
    fileIdx   = completedFileIdx;
    
    // See if we can push out a full load...        
    if( (fileIdx + NXTY_DOWNLOAD_MAX_SIZE) > actualFileLen )
    {
        chunkSize = actualFileLen - fileIdx;
    }
    
    u8Buff[0] = chunkSize;
    // Start with 1 to account for u8Buff[0] set to chunkSize
    for( i = 1; i <= chunkSize; i++ )
    {
        u8Buff[i] = u8FileBuff[fileIdx++];
    }
    
    // Send a message to the Cel-Fi unit with data...
    nxty.SendNxtyMsg(NXTY_DOWNLOAD_TRANSFER_REQ, u8Buff, chunkSize);
    DldState = DLD_STATE_TRANSFER_RSP;
}

// End of operational code...
/////////////////////////////////////////////////////////////////////////////////////////////////////////////








// Extra functions showing file manipulation...
/*
function gotFiles(entries) 
{
    var s = "";
    for(var i=0,len=entries.length; i<len; i++) {
        //entry objects include: isFile, isDirectory, name, fullPath
        s+= entries[i].fullPath;
        if (entries[i].isFile) {
            s += " [F]";
        }
        else {
            s += " [D]";
        }
        s += "\n";
        
    }
    PrintLog(1, s);
}

function doDirectoryListing(e) {
    //get a directory reader from our FS
    var dirReader = fileSystemDownloadDir.createReader();
//    var dirReader = fileSystemDownloadDir.root.createReader();

    dirReader.readEntries(gotFiles,onError);        
}
*/


/*
//generic content logger - writes to text window on screen...
function logit(s) {
    document.querySelector("#dbg_window_id").innerHTML += (s + "\n");
}

function doDeleteFile(e) {
    fileSystemDownloadDir.root.getFile("test.txt", {create:true}, function(f) {
        f.remove(function() {
            logit("File removed<p/>"); 
        });
    }, onError);
}

function metadataFile(m) {
    logit("File was last modified "+m.modificationTime+"<p/>");    
}

function doMetadataFile(e) {
    fileSystemDownloadDir.root.getFile("test.txt", {create:true}, function(f) {
        f.getMetadata(metadataFile,onError);
    }, onError);
}
*/

	
