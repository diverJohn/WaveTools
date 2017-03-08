//=================================================================================================
//
//  File: bluetoothle.js
//
//  Description:  This file contains all functionality to connect and maintain a connection
//                to a Nextivity bluetoothle device.
//
//
//                External functionality that must be maintained to support the SouthBound IF concept:
//
//                - OpenSouthBoundIf()
//                - ConnectSouthBoundIf()
//                - WriteSouthBoundData()
//                - Response data must call function nxty.ProcessNxtyRxMsg().
//                - CnxAndIdentifySouthBoundDevice()
//                - RefreshSouthBoundIf()
//
//                - Flags
//                  - isSouthBoundIfStarted:    Check is isSouthBoundIfEnabled after isShouthBoundIfStarted is true...
//                  - isSouthBoundIfEnabled:
//                  - isSouthBoundIfListDone:
//                  - isSouthBoundIfCnx:        Set "true" or "false" accordingly.
//                  - bSouthBoundWriteError;    true if write error.
//
//                - Messages
//                  - szSouthBoundIfEnableMsg
//                  - szSouthBoundIfNotCnxMsg
//                  - szSouthBoundIfInfoMsg
//
//=================================================================================================
//
//
//
//  bluetooth LE functions for the Rand Dusing Phonegap Plugin
//
//  Flow:
//
//    OpenSouthBoundIf()     (Called from main...)
//      bluetoothle.initialize(initializeSuccess, initializeError, paramsObj)
//        initializeSuccess()
//          BluetoothLoop()
//
//    BluetoothLoop()         (Called every 5 sec if not cnx, 15 sec if cnx)
//      bluetoothle.isConnected( isConnectedCallback )
//        isConnectedCallback()
//          if connected
//            UpdateBluetoothIcon(true)
//            setTimeout(BluetoothLoop, 15000)
//            if not subscribed
//              DiscoverBluetoothdevice()
//          else
//            UpdateBluetothIcon(false)
//            setTimeout(BluetoothLoop, 5000)
//            StartBluetoothScan()
//          end
//
//    StartBluetoothScan()
//      bluetoothle.startScan(startScanSuccess, startScanError, paramsObj)
//        startScanSuccess()
//          bluetoothle.stopScan(stopScanSuccess, stopScanError)
//          ConnectBluetoothDevice(obj.address)
//
//    ConnectBluetoothDevice(address)
//      bluetoothle.connect(connectSuccess, connectError, paramsObj)
//        connectSuccess()
//          UpdateBluetoothIcon(true)
//          DiscoverBluetoothDevice()
//
//
//    DiscoverBluetoothDevice()
//      if IOS
//        bluetoothle.services(servicesIosSuccess, servicesIosError, paramsObj);
//          servicesIosSuccess()
//            bluetoothle.characteristics(characteristicsIosSuccess, characteristicsIosError, paramsObj);
//              characteristicsIosSuccess()
//                if Tx Characteristic
//                  bluetoothle.descriptors(descriptorsIosTxSuccess, descriptorsIosTxError, paramsObj);
//                else if Rx Characteristic
//                  bluetoothle.descriptors(descriptorsIosRxSuccess, descriptorsIosRxError, paramsObj);
//
//        descriptorsIosTxSuccess()
//          SubscribeBluetoothDevice()
//
//        descriptorsIosRxSuccess()
//          do nothing
//
//      else if Android
//        bluetoothle.discover(discoverSuccess, discoverError)
//          discoverSuccess()
//            SubscribeBluetoothDevice()
//      end
//
//
//    SubscribeBluetoothDevice()
//      bluetoothle.subscribe(subscribeSuccess, subscribeError, paramsObj)
//
//
//    Rx processing............................................
//    subscribeSuccess()
//      ProcessNxtyRxMsg()
//
//
//


const   BOARD_CFG_CABLE_BOX_BIT       = 0x4000;   // Bit 14 means cable box
const   BOARD_CFG_USE_THIS_DEVICE     = 0x0000;   // Set to 0 for non-cable box, or 0x4000 for cable box.  

var guiDeviceFlag           = false;            // Flag:  true:  display device selection 
var guiDeviceAddrList       = [];               // An array of device addresses to select. (Android: MAC, IOS: Mangled MAC)
var guiDeviceRssiList       = [];               // An array of associated BT RSSI values...
var guiDeviceList           = [];               // An array of device IDs, i.e. Serial Numbers, to display for user to select.
                        
// Use the following global variables to determine South Bound IF status.
var isSouthBoundIfStarted   = false;    // Check if isSouthBoundIfEnabled after isShouthBoundIfStarted is true...
var isSouthBoundIfEnabled   = false;
var isSouthBoundIfCnx       = false;
var bSouthBoundWriteError   = false;
var isSouthBoundIfListDone  = false;
var szSouthBoundIfEnableMsg = "Bluetooth Required: Please Enable...";
var szSouthBoundIfNotCnxMsg = "Bluetooth connection lost.";
var szSouthBoundIfInfoMsg   = "Indicates if connected to Cel-Fi device via Bluetooth.\nBlue means connected.\nGray means not connected.\nCurrent status: ";


var addressKey      = "address";
var btAddr          = null;   // Version 2.0.0 requires address for many functions.
var myLastBtAddress = null;
var bBtClosed       = true;


// const   TX_MAX_BYTES_PER_CONN           = 20;
const   TX_MAX_BYTES_PER_BUFFER         = 20;       // Android has 4 Tx buffers, IOS has 6 Tx buffers.
const   BT_CONNECTION_INTERVAL_DEFAULT  = 40;       // Android should agree to 20 mS and IOS should agree to 30 mS
var     btCnxInterval                   = BT_CONNECTION_INTERVAL_DEFAULT;
var     maxPhoneBuffer                  = 7;        // Download message is 132 bytes which takes 7 20-byte buffers or 6 22-byte buffers.

//var bridgeServiceUuid           = "6734";

// 128-bit UUID must include the dashes.
// Power cycle phone when changing from 16-bit to 128-bit UUID to remove any local phone storage.
var bridgeServiceUuid           = "48d60a60-f000-11e3-b42d-0002a5d5c51b";


var bridgeTxCharacteristicUuid  = "6711";       // Tx from the bluetooth device profile, Rx for the phone app.
var bridgeRxCharacteristicUuid  = "6722";       // Rx from our bluetooth device profile, Tx for the phone app.



var scanTimer          = null;
var connectTimer       = null;
var reconnectTimer     = null;
var subscribeTimer     = null;
var bMaxRssiScanning   = false;
var maxRssi            = -200;
var maxRssiAddr        = null;
var bRefreshActive     = false;


var BluetoothCnxTimer = null;

var SCAN_RESULTS_SIZE = 62;     // advertisement data can be up to 31 bytes and scan results data can be up to 31 bytes.
var u8ScanResults     = new Uint8Array(SCAN_RESULTS_SIZE);


var isBluetoothSubscribed   = false;
var bDisconnectCalled       = false;

var u8TxBuff            = new Uint8Array(260);
var uTxBuffIdx          = 0;
var uTxMsgLen           = 0;


var getSnIdx            = 0;
var getSnState          = 0;
var firstFoundIdx       = 0;
var icdDeviceList       = []; 
var boardCfgList        = [];



//.................................................................................................................
function stringifyReplaceToHex(key, value) 
{
    for( var i = 0; i < value.length; i++ )
    {
        if(typeof value[i] === 'undefined')
        {
            value[i] = "undefined";
        }
        else
        {
            value[i] = "0x" + value[i].toString(16);
        }
    }
    return value;
}

// OpenSouthBoundIf...................................................................................
function OpenSouthBoundIf()
{
    PrintLog(1, "BT: Starting bluetooth");


    var paramsObj = { "request": true,  "statusReceiver": true };
    bluetoothle.initialize(initializeSuccess, /*initializeError, */ paramsObj);  // error no longer used with plugin 3.3.0.
}


function initializeSuccess(obj)
{
  if (obj.status == "enabled")
  {
      // If we initialize successfully, start a loop to maintain a connection...
      PrintLog(1, "BT: Initialization successful, starting periodic bluetooth maintenance loop...");
      isSouthBoundIfEnabled = true;
      searchAnimationFlag = false;
      BluetoothLoop();
  }
  else
  {
      PrintLog(99, "BT: Unexpected initialize status: " + obj.status);
      
      Spinnerstop()
      showAlert( obj.status, "Bluetooth Error" );
  }

  isSouthBoundIfStarted = true;
}

function initializeError(obj)
{
  PrintLog(99, "BT: Initialize error: " + obj.error + " - " + obj.message);
  isSouthBoundIfEnabled = false;
  isSouthBoundIfStarted = true;
  showAlert( "This app requires Bluetooth to be enabled.", "Bluetooth Required" );
}
 



// BluetoothLoop...................................................................................
// Check every 5 seconds if not connected and subscribed and every 15 seconds if already connected...
function BluetoothLoop()
{
    var paramsObj = {"address":btAddr};
    bluetoothle.isConnected( isConnectedCallback, isConnectedCallback, paramsObj );

}

function isConnectedCallback(obj)
{
    if(obj.isConnected)
    {
        PrintLog(10, "BT: bluetooth cnx callback: Cnx" );
        UpdateBluetoothIcon( true );

        // Check again in 10 seconds since we are connected...
        BluetoothCnxTimer = setTimeout(BluetoothLoop, 10000);

        if( isBluetoothSubscribed == false )
        {
          // Run Discover and if successful then subscribe to the Tx of our device
          DiscoverBluetoothDevice();
        }
    }
    else
    {
        PrintLog(10, "BT: bluetooth cnx callback: Not Cnx" );
        UpdateBluetoothIcon( false );

        // Check again in 5 seconds...
        BluetoothCnxTimer = setTimeout(BluetoothLoop, 5000);

        StartBluetoothScan();
    }
}



// StartScan.....................................................................................
function StartBluetoothScan()
{
    checkPermission(); 
    PrintLog(1, "BT: Starting scan for Cel-Fi devices.");
    
    if( (window.device.platform == androidPlatform) && (parseFloat(window.device.version) < 5.0) )
    {    
        var paramsObj = {
//          "services":[bridgeServiceUuid],                         // Some Android 4.4.x versions had issues filtering...
          allowDuplicates: true,
          scanMode: bluetoothle.SCAN_MODE_LOW_LATENCY,
          callbackType: bluetoothle.CALLBACK_TYPE_ALL_MATCHES,
          matchNum: bluetoothle.MATCH_NUM_MAX_ADVERTISEMENT,
          matchMode: bluetoothle.MATCH_MODE_AGGRESSIVE,
        };
    }
    else
    {
        var paramsObj = {
          "services":[bridgeServiceUuid],
          allowDuplicates: true,
          scanMode: bluetoothle.SCAN_MODE_LOW_LATENCY,
          callbackType: bluetoothle.CALLBACK_TYPE_ALL_MATCHES,
          matchNum: bluetoothle.MATCH_NUM_MAX_ADVERTISEMENT,
          matchMode: bluetoothle.MATCH_MODE_AGGRESSIVE,
        };
    }
    

    bMaxRssiScanning = true;
    connectTimer     = null;
//    setTimeout(scanMaxRssiTimeout, 1000 );
    bluetoothle.startScan(startScanSuccess, startScanError, paramsObj);
}

function scanMaxRssiTimeout()
{
    bMaxRssiScanning = false;
    PrintLog(1, "BT: Set bMaxRssiScanning to false.  bMaxRssiScanning="  + bMaxRssiScanning );
}

function checkPermission() {
  bluetoothle.hasPermission(function(obj) {
    if (obj.hasPermission) {
      //Already has permissions
      return;
    }

    //TODO Permission not granted, show permissions explanantion popup

    bluetoothle.requestPermission(function(obj) {
      if (obj.requestPermission) {
        //Permission granted
        return;
      }

      //TODO Permission denied, show another message?
    });
  });
}


function startScanSuccess(obj)
{
  var i;
  if (obj.status == "scanResult")
  {
    var scanStr = JSON.stringify(obj);
    PrintLog(10, "BT: Scan result: " + scanStr );


    //if( scanStr.search("advertisement") != -1 )
    if (obj.advertisement)
    {
        var bytes = null;
        if (window.device.platform == iOSPlatform) {
          bytes = bluetoothle.encodedStringToBytes(obj.advertisement.manufacturerData)
        } else {
          bytes = bluetoothle.encodedStringToBytes(obj.advertisement)
        }
        var bDeviceFound = false;

        // Save the Scan Results data...
        if( bytes.length != 0 )
        {
            for( i = 0; i < SCAN_RESULTS_SIZE; i++ )
            {
                if( i < bytes.length )
                {
                    u8ScanResults[i] = bytes[i];
                }
            }
        }

        var outText = u8ScanResults[0].toString(16);    // Convert to hex output...
        for( i = 1; i < u8ScanResults.length; i++ )
        {
            outText = outText + " " + u8ScanResults[i].toString(16);
        }
        PrintLog(10,  "BT: Msg Advertise: " + outText );


        // Neither Android nor IOS filters based on the 128-bit UUID so we have to determine if
        // this device is ours.
        // Android:  Compare 128-bit UUID.
        // IOS:      Compare name since 128-bit UUID not provided to app.
        if( window.device.platform == iOSPlatform )
        {

            // The returned bytes for IOS are...                                IOS returns only manufacturer specific data...
            //                                                                  [0]
            // "2 1 6 11 6 1b c5 d5 a5 02 00 2d b4 e3 11 00 F0 60 0A D6 48 07 ff 0 1 xx yy 25 29 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
            //  |    advertise data                                                            | |             scan results                    |
            //                                                                     ^ ^  ^  ^  ^
            //                                                                     | SW Ver|  Rx Handle
            //                                                                     |       Tx Handle
            //                                                                    ICD

            if( obj.name == "Nextivity Bridge" )
            {
                PrintLog(10, "BT: IOS: Cel-Fi device found based on name: Nextivity Bridge" );
                bDeviceFound = true;
            }
            else
            {
                // The phone has not pulled the name so match as much data as possible.
                if( (u8ScanResults[0] == 0x00) && (u8ScanResults[4] == 0x25) && (u8ScanResults[5] == 0x29) )
                {
                    PrintLog(10, "BT: IOS: Cel-Fi device found based on advertised data: [4]=0x25 and [5]=0x29" );
                    bDeviceFound = true;
                }
            }
        }
        else
        {
            // Non IOS: Android and Win.
            var nxty128Uuid = new Uint8Array([0x02, 0x01, 0x06, 0x11, 0x06, 0x1b, 0xc5, 0xd5, 0xa5, 0x02, 0x00, 0x2d, 0xb4, 0xe3, 0x11, 0x00, 0xF0, 0x60, 0x0A, 0xD6, 0x48]);

            // The returned bytes are...
            // [0]         [5]                                                    [24]                       [28]
            // "2 1 6 11 6 1b c5 d5 a5 02 00 2d b4 e3 11 00 F0 60 0A D6 48 07 ff 0 1 xx yy 25 29 7 9 43 65 6c 2d 46 69 3 2 34 67 5 ff 0 1 xx yy
            //  |    advertise data                                                            | |             scan results                   |
            //                                                                     ^ ^  ^  ^  ^                                         ^ ^  ^
            //                                                                     | SW Ver|  Rx Handle                                 | |  |
            //                                                                     |       Tx Handle                                    | SW Version
            //                                                                    ICD                                                  ICD

            // See if we can match the 128-bit, 16 byte, UUID.  128-bit UUID starts at offset [5].
            for( i = 5; i < nxty128Uuid.length; i++ )
            {
                if( u8ScanResults[i] != nxty128Uuid[i] )
                {
                    break;
                }
            }


            if( i == nxty128Uuid.length )
            {
                PrintLog(10, "BT: Android: Cel-Fi device found based on 128-bit UUID" );
                if( obj.address == "05:04:03:02:01:00" )
                {
                    bDeviceFound = true;
                }
            }
            else if( obj.name == "Nextivity Bridge" )
            {
                PrintLog(10, "BT: Android: Cel-Fi device found based on name: Nextivity Bridge" );
                bDeviceFound = true;
            }
        }

        //Clearing the device search timeout, based on bDeviceFound flag
        if(bDeviceFound){
          deviceFoundUIFlag = true;
        }

        PrintLog(10, "BT: bDeviceFound=" + bDeviceFound + " myLastBtAddress=" + myLastBtAddress + " bMaxRssiScanning=" + bMaxRssiScanning );

        // See if we need to continue scanning to look for max RSSI, only if we have not connected before...
        if( bDeviceFound && (myLastBtAddress == null) )
        {
            if( bMaxRssiScanning )
            {
                PrintLog(10, "BT: Max RSSI scanning, addr: " + obj.address + " RSSI: " + obj.rssi + " max RSSI so far:" + maxRssi );

                if( obj.rssi > maxRssi )
                {
                    maxRssi      = obj.rssi;
                    maxRssiAddr  = obj.address
                    PrintLog(10, "BT: This Cel-Fi address: " + maxRssiAddr + " has max RSSI so far: " + maxRssi );

                    if( window.device.platform == iOSPlatform )
                    {
                        uIcd         = u8ScanResults[1];
                        swVerBtScan  = U8ToHexText(u8ScanResults[2]) + "." + U8ToHexText(u8ScanResults[3]);
                    }
                    else
                    {
                        uIcd        = u8ScanResults[24];
                        swVerBtScan = U8ToHexText(u8ScanResults[25]) + "." + U8ToHexText(u8ScanResults[26]);
                    }
                }


                // Fill the BT address list...
                for( i = 0; i < (guiDeviceAddrList.length + 1); i++ )
                {
                    if(typeof guiDeviceAddrList[i] === 'undefined')
                    {
                        guiDeviceAddrList.push(obj.address);
                        guiDeviceRssiList.push(obj.rssi);
                        PrintLog(1, "BT: Add to list: " + obj.address + " RSSI: " + obj.rssi + " max RSSI so far:" + maxRssi);
                        break;
                    }
                    else if( guiDeviceAddrList[i] == obj.address )
                    {
                        guiDeviceRssiList[i] = obj.rssi;
                        break;
                    }
                }


                // If we are still scanning for the max then do not proceed below...
                bDeviceFound = false;
            }
        }


        if( bDeviceFound )
        {
          // If we have connected before then we must match last address...
            if( myLastBtAddress != null )
            {
                if( myLastBtAddress != obj.address )
                {
                    PrintLog(1, "BT: This Cel-Fi address: " + obj.address + " does not match the last connected Cel-Fi address: " + myLastBtAddress + ".  Restart app to reconnect to a different Cel-Fi." );
                    bDeviceFound = false;
                }
                else
                {
                    PrintLog(1, "BT: This Cel-Fi address: " + obj.address + " matches the last connected Cel-Fi address: " + myLastBtAddress + ".  Reconnecting..." );
                    bluetoothle.stopScan(stopScanSuccess, stopScanError);
                    clearScanTimeout();
                    ConnectBluetoothDevice(myLastBtAddress);
                }
            }
        }

        if( bDeviceFound && (scanTimer != null) && (connectTimer == null) && (guiDeviceFlag == false) )
        {
            clearScanTimeout();
            bluetoothle.stopScan(stopScanSuccess, stopScanError);

            // Store the address on the phone...not used
//            window.localStorage.setItem(addressKey, obj.address);

            tryConnect();
        }

    }  // if we have found "advertisement"


  }
  else if (obj.status == "scanStarted")
  {
    PrintLog(1, "BT: Scan was started successfully, stopping in 4 sec.");
    scanTimer = setTimeout(scanTimeout, 4000);
  }
  else
  {
    PrintLog(99, "BT: Unexpected start scan status: " + obj.status);
  }
}



function startScanError(obj)
{
  PrintLog(99, "BT: Start scan error: " + obj.error + " - " + obj.message);
}

function scanTimeout()
{
  PrintLog(1, "BT: Scanning time out, stopping");
  bluetoothle.stopScan(stopScanSuccess, stopScanError);

  if( (connectTimer == null) && (guiDeviceFlag == false) && (guiDeviceAddrList.length != 0) )
  {
    tryConnect();
  }

}

function clearScanTimeout()
{
  PrintLog(1, "BT: Clearing scanning timeout");
  if (scanTimer != null)
  {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
}

function stopScanSuccess(obj)
{
  if (obj.status == "scanStopped")
  {
    PrintLog(1, "BT: Scan was stopped successfully");
  }
  else
  {
    PrintLog(1, "BT: Unexpected stop scan status: " + obj.status);
  }
}

function stopScanError(obj)
{
  PrintLog(99, "BT: Stop scan error: " + obj.error + " - " + obj.message);
}



// UpdateBluetoothIcon....................................................................................
function UpdateBluetoothIcon(cnx)
{
    if(cnx)
    {
       
        if( isSouthBoundIfCnx == false )
        {
            PrintLog(1, "BT: UpdateBluetoothIcon(): Set isSouthBoundIfCnx to true" );
        }
        
        if( isSouthBoundIfListDone )
        {
            if( document.getElementById("bt_icon_id").innerHTML != szSbIfIconOn )
            {
                document.getElementById("bt_icon_id").innerHTML = szSbIfIconOn;
            }
            
            if(bWaveTest)
            {
                if( document.getElementById("bt_main_id").innerHTML != szSbIfMainOn )
                {
                    document.getElementById("bt_main_id").innerHTML = szSbIfMainOn;
                }
            }
            
        }
        
        isSouthBoundIfCnx     = true;
    }
    else
    {
        if( isSouthBoundIfCnx == true )
        {
            PrintLog(1, "BT: UpdateBluetoothIcon(): Set isSouthBoundIfCnx to false" );
        }
        
        if( document.getElementById("bt_icon_id").innerHTML != szSbIfIconOff )
        {
            document.getElementById("bt_icon_id").innerHTML = szSbIfIconOff;
        }

        if(bWaveTest)
        {
            if( document.getElementById("bt_main_id").innerHTML != szSbIfMainOff )
            {
                document.getElementById("bt_main_id").innerHTML = szSbIfMainOff;
            }
        }
        
        isSouthBoundIfCnx     = false;
        isBluetoothSubscribed = false;
        u8ScanResults[0]      = 0;
    }
}



// ConnectBluetoothDevice...................................................................................
// Per plugin: Connect to a Bluetooth LE device. The Phonegap app should use a timer to limit the
// connecting time in case connecting is never successful. Once a device is connected, it may
// disconnect without user intervention. The original connection callback will be called again
// and receive an object with status => disconnected. To reconnect to the device, use the reconnect method.
// Before connecting to a new device, the current device must be disconnected and closed.
// If a timeout occurs, the connection attempt should be canceled using disconnect().
function ConnectBluetoothDevice(address)
{
  PrintLog(1, "BT: ConnectBluetoothDevice(" + address + ")" );

  bBtClosed = false;

  var paramsObj = {"address":address};
  bluetoothle.connect(connectSuccess, connectError, paramsObj);
    btAddr        = address;
  connectTimer = setTimeout(connectTimeout, 5000);
}

function connectSuccess(obj)
{
  if (obj.status == "connected")
  {
    PrintLog(1, "BT: Connected to : " + obj.name + " - " + obj.address);

    // Save the address...
    myLastBtAddress = obj.address;

    // Update the bluetooth icon...
//    UpdateBluetoothIcon( true );

    clearConnectTimeout();

    // Must run Discover before subscribing...
    DiscoverBluetoothDevice();

  }
  else
  {
    PrintLog(99, "BT: Unexpected connect status: " + obj.status);

    if( obj.status == "disconnected" )
    {
        CloseBluetoothDevice();
        maxRssiAddr = null;
//        DisconnectBluetoothDevice();        // Disconnect and close
    }
    clearConnectTimeout();
  }
}

function connectError(obj)
{
  PrintLog(99, "BT: Connect error: " + obj.error + " - " + obj.message);
  clearConnectTimeout();
  CloseBluetoothDevice();
}

function connectTimeout()
{
  PrintLog(1, "BT: Connection timed out");
  DisconnectBluetoothDevice();
}

function clearConnectTimeout()
{

  if (connectTimer != null)
  {
    PrintLog(1, "BT: Clearing connect timeout");
    clearTimeout(connectTimer);
  }
}



// DisconnectBluetoothDevice...................................................................................
function DisconnectBluetoothDevice()
{
    PrintLog(1, "BT: DisconnectBluetoothDevice (disconnect and close)");
    bDisconnectCalled = true;

    var paramsObj = {"address":btAddr};
    bluetoothle.disconnect(disconnectSuccess, disconnectError, paramsObj);
}

function disconnectSuccess(obj)
{
    if (obj.status == "disconnected")
    {
        PrintLog(1, "BT: Disconnect device success");

        // Update the bluetooth icon...
        UpdateBluetoothIcon( false );

        CloseBluetoothDevice();
    }
    else
    {
      PrintLog(99, "BT: Unexpected disconnect status: " + obj.status);
    }
}

function disconnectError(obj)
{
  PrintLog(99, "BT: Disconnect error: " + obj.error + " - " + obj.message);
}


// CloseBluetoothDevice...................................................................................
function CloseBluetoothDevice()
{

    PrintLog(1, "BT: CloseBluetoothDevice()");

    // First check to see if disconnected before closing...
    var paramsObj = {"address":btAddr};
    bluetoothle.isConnected(isConnectedSuccess, isConnectedSuccess, paramsObj);
}

function isConnectedSuccess(obj)
{
    if (obj.isConnected)
    {
        DisconnectBluetoothDevice();    // Disconnect and close
    }
    else
    {
        var paramsObj = {"address":btAddr};
        bluetoothle.close(closeSuccess, closeError, paramsObj);
    }

}

function closeSuccess(obj)
{
    if (obj.status == "closed")
    {
        PrintLog(1, "BT Closed device");
        
        bBtClosed = true;

        if( bRefreshActive )
        {
            ConnectBluetoothDevice(myLastBtAddress);
            bRefreshActive = false;
        }

        UpdateBluetoothIcon( false );
    }
    else
    {
        PrintLog(99, "BT: Unexpected close status: " + obj.status);
    }
}

function closeError(obj)
{
    PrintLog(99, "BT: Close error: " + obj.error + " - " + obj.message);
    bRefreshActive = false;
}




// DiscoverBluetoothDevice........................................................................
function DiscoverBluetoothDevice()
{
    if( window.device.platform == iOSPlatform )
    {
        PrintLog(1, "BT:  IOS platform.  Begin search for bridge service");
        var paramsObj = {"address":btAddr, "services":[bridgeServiceUuid]};
        bluetoothle.services(servicesIosSuccess, servicesIosError, paramsObj);
    }
    else if( window.device.platform == androidPlatform )
    {
        var paramsObj = {"address":btAddr};
        PrintLog(1, "BT:  Android platform.  Beginning discovery");
        bluetoothle.discover(discoverSuccess, discoverError, paramsObj);
    }
}



// IOS only ...................................................................................................
function servicesIosSuccess(obj)
{
//    if( obj.status == "discoveredServices" )          // v1.0.6
    if( obj.status == "services" )                      // v2.0.0
    {
        PrintLog(1, "BT: IOS Service discovered: " + JSON.stringify(obj));
        var services = obj.services;
        for( var i = 0; i < services.length; i++ )
        {
            var service = services[i];

            if( service == bridgeServiceUuid )
            {
              PrintLog(1, "BT:  IOS platform.  Finding bridge characteristics...");
              var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristics":[bridgeTxCharacteristicUuid, bridgeRxCharacteristicUuid]};
              bluetoothle.characteristics(characteristicsIosSuccess, characteristicsIosError, paramsObj);
              return;
            }
        }

        PrintLog(99, "Bridge service not found");
    }
    else
    {
        PrintLog(99, "Unexpected services bridge status: " + JSON.stringify(obj));
    }

    DisconnectBluetoothDevice();
}

function servicesIosError(obj)
{
    PrintLog(99, "Services bridge error: " + obj.error + " - " + obj.message);
    DisconnectBluetoothDevice();
}



function characteristicsIosSuccess(obj)
{

//    if( obj.status == "discoveredCharacteristics" )       // v1.0.6
    if( obj.status == "characteristics" )                   // v2.0.0
    {
        PrintLog(1, "BT: IOS Characteristics discovered: " + JSON.stringify(obj));
        var characteristics = obj.characteristics;
        for( var i = 0; i < characteristics.length; i++ )
        {
            var characteristicUuid = characteristics[i].uuid;

            if( characteristicUuid == bridgeRxCharacteristicUuid )
            {
                var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristic":bridgeRxCharacteristicUuid};
                bluetoothle.descriptors(descriptorsIosRxSuccess, descriptorsIosRxError, paramsObj);
                return;
            }

        }
    }
    else
    {
        PrintLog(99, "Unexpected characteristics bridge status: " + obj.status);
    }

    PrintLog(99, "BT: IOS No Rx Characteristic found: " + JSON.stringify(obj));
    DisconnectBluetoothDevice();
}

function characteristicsIosError(obj)
{
    PrintLog(99, "Characteristics bridge error: " + obj.error + " - " + obj.message);
    DisconnectBluetoothDevice();
}


function descriptorsIosRxSuccess(obj)
{
//    if (obj.status == "discoveredDescriptors")    // v1.0.6
    if (obj.status == "descriptors")                // v2.0.0
    {
        PrintLog(1, "BT: Rx Discovery completed.  Name: " + obj.name + " add: " + obj.address + "stringify: " + JSON.stringify(obj));
        var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristic":bridgeTxCharacteristicUuid};
        bluetoothle.descriptors(descriptorsIosTxSuccess, descriptorsIosTxError, paramsObj);
    }
    else
    {
        PrintLog(99, "Unexpected Rx descriptors bridge status: " + obj.status);
        DisconnectBluetoothDevice();
    }
}


function descriptorsIosRxError(obj)
{
    PrintLog(99, "Descriptors Rx Bridge error: " + obj.error + " - " + obj.message);
    DisconnectBluetoothDevice();
}



function descriptorsIosTxSuccess(obj)
{
    if (obj.status == "descriptors")
    {
        PrintLog(1, "BT: Tx Discovery completed, now subscribe.  Name: " + obj.name + " add: " + obj.address + "stringify: " + JSON.stringify(obj));

        // Now subscribe to the bluetooth tx characteristic...
        SubscribeBluetoothDevice();
    }
    else
    {
        PrintLog(99, "Unexpected Tx descriptors bridge status: " + obj.status);
        DisconnectBluetoothDevice();
    }
}


function descriptorsIosTxError(obj)
{
    PrintLog(99, "Descriptors Tx Bridge error: " + obj.error + " - " + obj.message);
    DisconnectBluetoothDevice();
}
// End IOS only ...............................................................................................


// Android only ...............................................................................................
function discoverSuccess(obj)
{
    if (obj.status == "discovered")
    {
        PrintLog(1, "BT: Discovery completed.  Name: " + obj.name + " add: " + obj.address + "stringify: " + JSON.stringify(obj));

        // Now subscribe to the bluetooth tx characteristic...
        SubscribeBluetoothDevice();

        // Start subscribing for the notifications in 1 second to allow any connection changes
        // to take place.
//        subscribeTimer = setTimeout(SubscribeBluetoothDevice, 1000);
        if( window.device.platform == androidPlatform ) {
            requestConnectionPriority("high"); //Request a higher connection on Android (lowers connection interval?)
        }
    }
      else
      {
        PrintLog(99, "BT: Unexpected discover status: " + obj.status);
        DisconnectBluetoothDevice();
      }
}

function discoverError(obj)
{
  PrintLog(99, "Discover error: " + obj.error + " - " + obj.message);
  DisconnectBluetoothDevice();
}
// End Android only ...............................................................................................


function requestConnectionPriority(connectionPriority) {
  //console.error("Request Connection Priority");
  var paramsObj = {address:btAddr, connectionPriority:connectionPriority};
  bluetoothle.requestConnectionPriority(function(obj) {
    //console.error("RCP Success:" + JSON.stringify(obj));
  }, function(obj) {
    //console.error("RCP Error:" + JSON.stringify(obj));
  }, paramsObj);
}

// SubscribeBluetoothDevice........................................................................
//  Subscribe means to listen on this UUID, i.e. channel, from the BLE device.
function SubscribeBluetoothDevice()
{
    // Version 1.0.2 of the plugin
    var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristic":bridgeTxCharacteristicUuid, "isNotification":true};

    bluetoothle.subscribe(subscribeSuccess, subscribeError, paramsObj);
}


function subscribeSuccess(obj)
{
    if (obj.status == "subscribedResult")
    {
        PrintLog(10, "BT: Subscription data received");

        var bytes = bluetoothle.encodedStringToBytes(obj.value);

        nxty.ProcessNxtyRxMsg( bytes, bytes.length );

    }
    else if (obj.status == "subscribed")
    {
        PrintLog(1, "BT: Subscription started - BT now able to receive Rx msgs.");
        ClearNxtyMsgPending();              // Make sure not stuck waiting for a response...
        isBluetoothSubscribed = true;
        
        if( isSouthBoundIfListDone )
        {
            UpdateBluetoothIcon( true );        // Wait until here before saying isSouthBoundIfCnx
        }

        isSouthBoundIfCnx     = true;           // Always indicate connected if subscribed.
        bDisconnectCalled = false;
    }
    else
    {
        PrintLog(99, "BT: Unexpected subscribe status: " + obj.status);
        DisconnectBluetoothDevice();
    }
}

function subscribeError(msg)
{
    if( bDisconnectCalled == false )
    {
        PrintLog(99, "BT: Subscribe error: " + msg.error + " - " + msg.message);
    }
}

function unsubscribeDevice()
{
  PrintLog(1, "BT: Unsubscribing bridge service");
  var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristi":bridgeTxCharacteristicUuid};
  bluetoothle.unsubscribe(unsubscribeSuccess, unsubscribeError, paramsObj);
}

function unsubscribeSuccess(obj)
{
    if (obj.status == "unsubscribed")
    {
        PrintLog(1, "BT: Unsubscribed device");
        isBluetoothSubscribed = false;
    }
    else
    {
      PrintLog(99, "BT: Unexpected unsubscribe status: " + obj.status);
      DisconnectBluetoothDevice();
    }
}

function unsubscribeError(obj)
{
  PrintLog(99, "BT: Unsubscribe error: " + obj.error + " - " + obj.message);
  DisconnectBluetoothDevice();
}

// WriteSouthBoundData........................................................................
function WriteSouthBoundData( u8 )
{

    if( PrintLogLevel >= 2 )
    {
        var outText = u8[0].toString(16);    // Convert to hex output...
        for( var i = 1; i < u8.length; i++ )
        {
            if( !(i%44) )
            {
                PrintLog(2,  "Msg Tx: " + outText );
                outText = u8[i].toString(16);
            }
            else
            {
                outText = outText + " " + u8[i].toString(16);
            }
        }
        
        if( outText.length > 0 )
        {
            PrintLog(2,  "Msg Tx: " + outText );
        }
    }

    var paramsObj = {"address":btAddr, "value":bluetoothle.bytesToEncodedString(u8), "service":bridgeServiceUuid, "characteristic":bridgeRxCharacteristicUuid, "type":"noResponse"};
    bluetoothle.writeQ(writeSuccess, writeError, paramsObj);

    return;

    var i;

    // Check msg length...
    if( u8.length > u8TxBuff.length )
    {
        PrintLog(99, "BT: WriteSouthBoundData(len=" + u8.length + "): More than " + NXTY_BIG_MSG_SIZE + " bytes." );
        return;
    }

    uTxMsgLen  = u8.length;
    uTxBuffIdx = 0;

    // Transfer the complete message to our working buffer...
    for( i = 0; i < uTxMsgLen; i++ )
    {
        u8TxBuff[i] = u8[i];
    }

    if( (window.device.platform == iOSPlatform) &&  (swVerBtScan.localeCompare("01.00") == 0) )
    {
        // For version 1.00 on the BT board for IOS we have to slow it way down and use one buffer.
        maxPhoneBuffer = 1;
    }

// Note for LNT: Here is where I would like to call writeQ and not call WriteBluetoothDeviceEx().
// bluetoothle.writeQ(writeSuccess, writeError, paramsObj[j]);


    // Do it....
    WriteBluetoothDeviceEx();
}


// This is the actual work horse that gets called repeatedly to send the data out ..........................................
function WriteBluetoothDeviceEx()
{
    var i;
    var j;
    var paramsObj = [];
    var myRtnTimer;
    var numBuffersOut = 0;

    // Come back next BT connection interval if more to output...
    myRtnTimer = setTimeout( function(){ WriteBluetoothDeviceEx(); }, btCnxInterval );  // Call myself...

    var ds  = new Date();
    var sMs = ds.getMilliseconds();


    for( j = 0; j < maxPhoneBuffer; j++ )
    {
        // See if we have more to output...
        if( uTxBuffIdx < uTxMsgLen )
        {

            var uTxBuffIdxEnd = uTxBuffIdx + TX_MAX_BYTES_PER_BUFFER;
            if( uTxBuffIdxEnd > uTxMsgLen )
            {
                uTxBuffIdxEnd = uTxMsgLen;
            }

            var u8Sub  = u8TxBuff.subarray(uTxBuffIdx, uTxBuffIdxEnd);
            var u64    = bluetoothle.bytesToEncodedString(u8Sub);

            if( PrintLogLevel >= 2 )
            {
                var outText = u8Sub[0].toString(16);    // Convert to hex output...
                for( i = 1; i < (uTxBuffIdxEnd - uTxBuffIdx); i++ )
                {
                    outText = outText + " " + u8Sub[i].toString(16);
                }
                PrintLog(2,  "Msg Tx: " + outText );
            }

            if( (window.device.platform == iOSPlatform) &&  (swVerBtScan.localeCompare("01.00") == 0) )
            {
                // If bluetooth version is 01.00 then use Response, otherwise we can use the faster no response.
                // Problem is that in version 01.00 of the bluetooth code I did not set the WRITE-NO-RESPONSE bit.
                // Version 01.00: Use WRITE with response, slower
                paramsObj[j] = {"address":btAddr, "value":u64, "service":bridgeServiceUuid, "characteristic":bridgeRxCharacteristicUuid};

                // Don't use the timer to come back, use the Succes function.
                clearTimeout(myRtnTimer);
            }
            else
            {
                // Normal operation for android.
                // Normal operation for IOS when BT version > 1.00.
                paramsObj[j] = {"address":btAddr, "value":u64, "service":bridgeServiceUuid, "characteristic":bridgeRxCharacteristicUuid, "type":"noResponse"};
            }

            // Each call to the write takes 5 to 10 mS on my Android phone.
            bluetoothle.write(writeSuccess, writeError, paramsObj[j]);
            numBuffersOut++;

            uTxBuffIdx = uTxBuffIdxEnd;

            if( window.device.platform == iOSPlatform )
            {
                // Exit the loop if 6 buffers have been written in under 30 mS.
                // IOS has a max of 6 buffers and our connection interval should be 30 mS.
//                if( j == 5 )
                if( j == 3 )                            // Since we need 7 buffers total for the 132 bytes, just exit at 4 to be same as Android.
                {
                    var de  = new Date();
                    var eMs = de.getMilliseconds();
                    var deltsMs;

                    if( eMs > sMs )
                    {
                        deltaMs = eMs - sMs;
                    }
                    else
                    {
                        deltaMs = 1000 - sMs + eMs;
                    }

                    // Less than 30 mS?
                    if( deltaMs < 30 )
                    {
//                        PrintLog(1, "Msg Tx loop exit after 6 buffers.  Time: " + deltaMs + " < 30 mS");
                        break;
                    }
                }

            }
            else
            {
                // Exit the loop if 4 buffers have been written in under 20 mS.
                // Android has a max of 4 buffers and our connection interval should be 20 mS.
                if( j == 3 )
                {
                    var de  = new Date();
                    var eMs = de.getMilliseconds();
                    var deltsMs;

                    if( eMs > sMs )
                    {
                        deltaMs = eMs - sMs;
                    }
                    else
                    {
                        deltaMs = 1000 - sMs + eMs;
                    }

                    // Less than 20 mS?
                    if( deltaMs < 20 )
                    {
//                        PrintLog(1, "Msg Tx loop exit after 4 buffers.  Time: " + deltaMs + " < 20 mS");
                        break;
                    }
                }
            }

        }
        else
        {
            break;
        }
    }

    if( uTxBuffIdx >= uTxMsgLen )
    {
        // Kill the come back timer if no more data...
        clearTimeout(myRtnTimer);
    }

    PrintLog(1,  "BT Tx: buffersLoaded=" + numBuffersOut + " msgBytes=" + uTxBuffIdx );
}


function writeSuccess(obj)
{
    // {"status":"written","service":"180F","characteristic":"2A19","value":""};
    if( obj.status == "written" )
    {
        if( (window.device.platform == iOSPlatform) &&  (swVerBtScan.localeCompare("01.00") == 0) )
        {
            setTimeout( function(){ WriteBluetoothDeviceEx(); }, 5 );  // Write some more in 5 mS.
        }
    }
    else
    {
        PrintLog(99, "BT: Unexpected write status: " + obj.status);
    }
}




function writeError(msg)
{
    PrintLog(99, "BT: Write error: " + msg.error + " - " + msg.message);

    bSouthBoundWriteError = true;

    if( window.device.platform == androidPlatform )
    {
        // Drop the number of buffers down to a min of 2...starts at 7
        if( maxPhoneBuffer > 4 )
        {
            SetBluetoothTxTimer(BT_CONNECTION_INTERVAL_DEFAULT);
            SetMaxTxPhoneBuffers(4);
        }
        else if( maxPhoneBuffer == 4 )
        {
            SetMaxTxPhoneBuffers(3);
        }
        else if( maxPhoneBuffer == 3 )
        {
            SetMaxTxPhoneBuffers(2);
        }
        else if( maxPhoneBuffer == 2 )
        {
            SetBluetoothTxTimer(BT_CONNECTION_INTERVAL_DEFAULT/2);
            SetMaxTxPhoneBuffers(1);
        }
    }
    else
    {
        // Set the connection interval timer back to 40 mS.
        SetBluetoothTxTimer(BT_CONNECTION_INTERVAL_DEFAULT);
    }

}

// SetBluetoothTxTimer...................................................................................
function SetBluetoothTxTimer(cnxTimeMs)
{
    btCnxInterval = cnxTimeMs;
    PrintLog(1, "BT: Setting Tx timer to " + btCnxInterval + " mS" );
}


// SetMaxTxPhoneBuffers...................................................................................
function SetMaxTxPhoneBuffers(numBuffers)
{
    maxPhoneBuffer = numBuffers;
    PrintLog(1, "BT: SetMaxTxPhoneBuffers: " + maxPhoneBuffer );
}



// ConnectSouthBoundIf........................................................................
function ConnectSouthBoundIf(myIdx)
{
    PrintLog(1, "BT: ConnectSouthBoundIf(" + myIdx + ") addr: " + guiDeviceAddrList[myIdx] );
    ConnectBluetoothDevice( guiDeviceAddrList[myIdx] );

    // Start the saftey check...
    BluetoothCnxTimer = setTimeout(BluetoothLoop, 5000);
}


// RefreshSouthBoundIf........................................................................
function RefreshSouthBoundIf()
{
    PrintLog(1, "BT: RefreshSouthBoundIf() i.e. disconnect and reconnect" );
    bRefreshActive = true;
    DisconnectBluetoothDevice();

}



// DisconnectAndStopSouthBoundIf........................................................................
function DisconnectAndStopSouthBoundIf()
{
    PrintLog(1, "BT: DisconnectAndStopSouthBoundIf()..." );
    
    clearTimeout(BluetoothCnxTimer);
    BluetoothCnxTimer = null;    
    DisconnectBluetoothDevice();
}

// RestartSouthBoundIf........................................................................
function RestartSouthBoundIf(bClean)
{
    if( bClean )
    {
        PrintLog(1, "BT: RestartSouthBoundIf( CLEAN )..." );
        
        // Clear any history...
        myLastBtAddress   = null;
        guiDeviceAddrList = [];               
        guiDeviceRssiList = [];               
        guiDeviceList     = [];
        icdDeviceList     = []; 
        boardCfgList      = [];
        
        BluetoothLoop();
    }
    else
    {
        PrintLog(1, "BT: RestartSouthBoundIf(" + myLastBtAddress + ")..." );
        
        if( isSouthBoundIfCnx == false )
        {
            ConnectBluetoothDevice(myLastBtAddress);
        }
            
        // Start the loop again...
        if( BluetoothCnxTimer == null )
        {
            BluetoothCnxTimer = setTimeout(BluetoothLoop, 5000);
        }
    }
    
}


/*

// GetBluetoothRssi........................................................................
function GetBluetoothRssi()
{
    var paramsObj = {"address":myLastBtAddress};

    bluetoothle.rssi(rssiSuccess, rssiError, paramsObj);
}


function rssiSuccess(obj)
{
    if (obj.status == "rssi")
    {
//        PrintLog(10, "BT: RSSI data received" + obj.rssi );
        UpdateRssiLine( obj.rssi );
    }
}

function rssiError(msg)
{
    PrintLog(99, "BT: GetRssi error: " + msg.error + " - " + msg.message);
}

*/





//----------------------------------------------------------------------------------------
var numDevFound      = 0;
function tryConnect()
{
    // Use guiDeviceList.length as a flag to indicate that we have already been this way just in case
    // called multile times while searching for guiDeviceAddrList[].
    if( guiDeviceList.length == 0 )
    {
        PrintLog(1, "BT: List of BT devices complete.  Number of BT MAC Addresses found = " + guiDeviceAddrList.length );

/*
jdo: no longer connect automatically if only 1 BT since we now need to read the board config first.

        // Automatically connect if only 1 BT in the area...
        if( guiDeviceAddrList.length == 1 )
        {
            PrintLog(1, "BT: FindMyCelfi() will not be called since only one BT device found and we do not have ICD version yet." );
            
            if( maxRssiAddr == null )
            {
                ConnectBluetoothDevice(guiDeviceAddrList[0]);
            }
            else
            {
                ConnectBluetoothDevice(maxRssiAddr);
            }
            
            isSouthBoundIfListDone = true;      // Main app loop must be placed on hold until true.
        }
        else if(guiDeviceAddrList.length > 1)
*/
        
        {

            // Sort the list based on RSSI power...
            var tempAddr;
            var tempRssi;
            for( var i = 0; i < guiDeviceAddrList.length; i++ )
            {
                for( var j = 1; j < guiDeviceAddrList.length; j++ )
                {
                    if( guiDeviceRssiList[j] > guiDeviceRssiList[j-1] )
                    {
                        // Reverse...
                        tempAddr = guiDeviceAddrList[j-1];
                        tempRssi = guiDeviceRssiList[j-1];
                        guiDeviceAddrList[j-1] = guiDeviceAddrList[j];
                        guiDeviceRssiList[j-1] = guiDeviceRssiList[j];
                        guiDeviceAddrList[j]   = tempAddr;
                        guiDeviceRssiList[j]   = tempRssi;
                    }
                }
            }

            // As a default throw the text "None" in the device list which will eventually contain SNs...
            for( var i = 0; i < guiDeviceAddrList.length; i++ )
            {
                guiDeviceList.push("None");
                icdDeviceList.push(0);
                boardCfgList.push(0);
            }


    //        guiDeviceFlag = true;
            clearTimeout(BluetoothCnxTimer);
            BluetoothCnxTimer = null;

            PrintLog(1, "guiDeviceAddrList      = " + JSON.stringify(guiDeviceAddrList) ); // An array of device BT addresses to select.
            PrintLog(1, "guiDeviceRssiList      = " + JSON.stringify(guiDeviceRssiList) ); // An array of RSSI values.
            PrintLog(1, "guiDeviceList          = " + JSON.stringify(guiDeviceList) );     // An array of Serial Numbers.

            // Get the Serial Numbers for all detected BT devices...
            getSnIdx    = 0;
            getSnState  = 0;
            numDevFound = 0;
            setTimeout( GetDeviceSerialNumbersLoop, 100 );
        }
    }
}


// GetDeviceSerialNumbersLoop........................................................................
var getSnLoopCounter = 0;
function GetDeviceSerialNumbersLoop()
{

    PrintLog(10, "BT: GetDeviceSerialNumbersLoop()... idx=" + getSnIdx + " state=" + getSnState + " Counter=" + getSnLoopCounter + " len=" + guiDeviceList.length );

    // Find the SNs and place in guiDeviceAddrList[] up to a max of 5.
    if( (getSnIdx < guiDeviceAddrList.length) && (numDevFound < 5)  )
    {
        if( guiDeviceRssiList[getSnIdx] < -95 )
        {
            PrintLog(1, "BT: Skip BT device " +  guiDeviceAddrList[getSnIdx] + "  RSSI below -95.  RSSI = " + guiDeviceRssiList[getSnIdx] );
            getSnIdx++;
        }
        else
        {
            switch(getSnState)
            {
                // Connect to BT device
                case 0:
                {
                    myLastBtAddress = null;             // Make sure no memory of previous connections.
                    if( isSouthBoundIfCnx == false )
                    {
                        getSnLoopCounter = 0;
                        ConnectBluetoothDevice(guiDeviceAddrList[getSnIdx]);
                        getSnState = 1;
                    }
                    break;
                }
    
                // Wait until device connected then try to get ICD version...
                case 1:
                {
                    if( isSouthBoundIfCnx )
                    {
                        isNxtyStatusCurrent = false;
    
                        // Get the ICD version by getting the status message...
                        var u8TempBuff  = new Uint8Array(2);
                        u8TempBuff[0] = NXTY_PHONE_ICD_VER;
                        nxty.SendNxtyMsg(NXTY_STATUS_REQ, u8TempBuff, 1);
                        getSnState = 2;
                    }
                    break;
                }
    
                // Wait until ICD version known and then get Serial Number...
                case 2:
                {
                    if( isNxtyStatusCurrent )
                    {
                        icdDeviceList[getSnIdx] = nxtyRxStatusIcd;
                        if( nxtyRxStatusIcd <= V1_ICD )
                        {
                            // Board config is returned in V1 status message.
                            boardCfgList[getSnIdx] = nxtyRxStatusBoardConfig;
                            
                            if( (boardCfgList[getSnIdx] & BOARD_CFG_CABLE_BOX_BIT) == BOARD_CFG_USE_THIS_DEVICE )
                            {
                                // Old ICD...do not update automatically...
                                // When this BT logic was added the v1 protocol had been removed.
                                //   V1 protocol was later added but SN was never added for V1.  
                                guiDeviceList[getSnIdx] = "Connect to Update";
                                numDevFound++;
        
                                if( numDevFound == 1 )
                                {
                                    // Save the index just in case this is the only one found...
                                    firstFoundIdx = getSnIdx;
                                }
                                    
                                if( bPrivacyViewed == true )
                                {
                                    var outText = "Found " + numDevFound + " ";
                                    if( numDevFound == 1 )
                                    {
                                        outText += "CelFiDevice";
                                    }
                                    else
                                    {
                                        outText += "CelFiDevices";
                                    }

                                    document.getElementById("searchMessageBox").innerHTML = outText;
                                    UpdateStatusLine( outText );
                                }
                            }
                            
                            // Disconnect from BT...
                            DisconnectBluetoothDevice();
                            getSnState = 0;
                            getSnIdx++;
                        }
                        else
                        {
                            PrintLog(1, "BT: Calling GetBoardConfig()" );
                        
                            GetBoardConfig();   // Get the board config to see if cable box, bit 14 set, or not.
                            getSnState = 3;
                        }
                    }
                    else
                    {
                        if( getSnLoopCounter == 10 )
                        {
                            // Try sending again...
                            getSnState = 1;
                        }
                    }
                    break;
                }
    
                // Wait until Board Config has been returned and then get SN if using this device...
                case 3:
                {
                
                    if( bNxtySuperMsgRsp == true )
                    {
                        if( iNxtySuperMsgRspStatus == NXTY_SUPER_MSG_STATUS_SUCCESS )
                        {                    
                            boardCfgList[getSnIdx] = nxtyRxStatusBoardConfig;
                            
                            if( ((boardCfgList[getSnIdx] & BOARD_CFG_CABLE_BOX_BIT) == BOARD_CFG_USE_THIS_DEVICE)   ||
                                (bWaveTest == true)   )                                                                     // For test we don't care about type.
                            {
                                // Get the SN since this device meets our needs...
                                GetNxtySuperMsgParamSelect( NXTY_SEL_PARAM_REG_SN_MSD_TYPE, NXTY_SEL_PARAM_REG_SN_LSD_TYPE );
                                getSnState = 4;
                            }
                            else
                            {
                                // Disconnect from BT...
                                DisconnectBluetoothDevice();
                                getSnState = 0;
                                getSnIdx++;
                            }
                        }
                        else
                        {
                            // Do not retry since unit may be marginally out of range...
                            DisconnectBluetoothDevice();
                            getSnState = 0;
                            getSnIdx++;
                        }
                        
                    }
    
                    break;
                }
                
                // Wait until SN has been returned and then disconnect...
                case 4:
                {
                    if( bNxtySuperMsgRsp == true )
                    {
                        if( iNxtySuperMsgRspStatus == NXTY_SUPER_MSG_STATUS_SUCCESS )
                        {                    
                            var tempSn = "";
                            for( i = 0; i < 6; i++ )
                            {
                                if( i < 2 )
                                {
                                    tempSn += U8ToHexText(u8RxBuff[9+i]);
                                }
                                else
                                {
                                    tempSn += U8ToHexText(u8RxBuff[12+i]);    // [14] but i is already 2 so 14-2=12
                                }
                            }
        
                            guiDeviceList[getSnIdx] = "SN:" + tempSn;
                            numDevFound++;
        
                            if( numDevFound == 1 )
                            {
                                // Save the index just in case this is the only one found...
                                firstFoundIdx = getSnIdx;
                            }
                                    
                            if( bPrivacyViewed == true )
                            {
                                var outText = "Found " + numDevFound + " ";
                                if( numDevFound == 1 )
                                {
                                    outText += "CelFiDevice";
                                }
                                else
                                {
                                    outText += "CelFiDevices";
                                }
                            
                                document.getElementById("searchMessageBox").innerHTML = outText;
                                UpdateStatusLine( outText );
                            }
                        }    
    
    
                        // Disconnect from BT...
                        DisconnectBluetoothDevice();
                        getSnState = 0;
                        getSnIdx++;
                    }
    
                    break;
                }
                
                
            }
        }

        getSnLoopCounter++;

        // Safety exit...
        if( ((bBtClosed == true) && (getSnLoopCounter > 10)) ||          // No sense to wait around if BT errors out. 
             (getSnLoopCounter > 40) )                                  // Never go more than 40
        {
            if( isSouthBoundIfCnx )
            {
                DisconnectBluetoothDevice();
            }

            getSnState = 0;
            getSnIdx++;
        }


        // Come back in 150 mS
        setTimeout( GetDeviceSerialNumbersLoop, 150 );
    }
    else
    {
//        StopWaitPopUpMsg();
        SpinnerStop();  // jdo added to stop spinner

        PrintLog(1, "guiDeviceAddrList      = " + JSON.stringify(guiDeviceAddrList) ); // An array of device BT addresses to select.
        PrintLog(1, "guiDeviceRssiList      = " + JSON.stringify(guiDeviceRssiList) ); // An array of RSSI values.
        PrintLog(1, "guiDeviceList          = " + JSON.stringify(guiDeviceList) );     // An array of Serial Numbers.
        PrintLog(1, "icdDeviceList          = " + JSON.stringify(icdDeviceList, stringifyReplaceToHex) );     // An array of ICD versions.
        PrintLog(1, "boardCfgList           = " + JSON.stringify(boardCfgList, stringifyReplaceToHex) + " if bit 14 set, 0x4000, then cable box"  );
        PrintLog(1, "Number devices found   = " + numDevFound );
        
        

        if( isSouthBoundIfCnx )
        {
            DisconnectBluetoothDevice();
        }

        // Indicate that we are done...
        isSouthBoundIfCnx      = false;

        // Bug 1518.   If not able to get SN from list of MAC addresses then show error...
        if( numDevFound >= 1 )
        {
            var outText = "";
        
            if( boardCfgList[firstFoundIdx] & BOARD_CFG_CABLE_BOX_BIT )
            {
                // Quatra type found...
                if( boardCfgList[firstFoundIdx] & IM_A_CU_MASK )
                {
                    outText =  "Q-CU: ";
                }
                else
                {
                    outText =  "Q-NU: ";
                }
                outText += guiDeviceList[firstFoundIdx];
                UpdateStatusLine( outText  );
            }
            else
            {
                if( boardCfgList[firstFoundIdx] & IM_A_CU_MASK )
                {
                    outText =  "CU: ";
                }
                else
                {
                    outText =  "NU: ";
                }
                outText += guiDeviceList[firstFoundIdx];
                UpdateStatusLine( outText  );
            }

            PrintLog(1, "BT: firstFoundIdx=" + firstFoundIdx + "  " + outText );
                    
            guiDeviceFlag   = false;
            myLastBtAddress = guiDeviceAddrList[firstFoundIdx];
            ConnectBluetoothDevice(guiDeviceAddrList[firstFoundIdx]);
            isSouthBoundIfListDone = true;      // Main app loop must be placed on hold until true.
            
            
            
            // Start the saftey check...
            if( BluetoothCnxTimer == null )
            {
                BluetoothCnxTimer = setTimeout(BluetoothLoop, 5000);
            }
        }
        else
        {
            navigator.notification.confirm(
                'Unable to retrieve data from the booster. Please move closer.',    // message
                    HandleBtConfirmation,                   // callback to invoke with index of button pressed
                    'Bluetooth Range Issue',                // title
                    ['Retry'] );                               // buttonLabels
        
            guiDeviceFlag = false;
        }

        // Clean up...
        isNxtyStatusCurrent = false;
    }
}



// CnxAndIdentifySouthBoundDevice........................................................................
var cnxIdState       = 0;
var cnxIdIdx         = -1;
var cnxIdLoopCounter = 0;
function CnxAndIdentifySouthBoundDevice(devIdx)
{
    nxtyRxStatusIcd = icdDeviceList[devIdx];    
    PrintLog(1, "BT: CnxAndIdentifySouthBoundDevice("+ devIdx + ") = " + guiDeviceList[devIdx] + " ICD ver=0x" + nxtyRxStatusIcd.toString(16) );
    
    if( devIdx == cnxIdIdx )
    {
        // If we are already connected to the correct device then flash...
        FindMyCelfi();
    }
    else
    {
        // Start the disconnect and reconnect loop...
        cnxIdState       = 0;
        cnxIdIdx         = devIdx;
        cnxIdLoopCounter = 0;
        setTimeout( CnxId, 100 );

        if( BluetoothCnxTimer != null )
        {
            clearTimeout(BluetoothCnxTimer);
            BluetoothCnxTimer = null;
        }

    }
}


// CnxId........................................................................
function CnxId()
{
    PrintLog(10, "BT: CnxId()... idx=" + cnxIdIdx + " state=" + cnxIdState + " Counter=" + cnxIdLoopCounter );

    switch(cnxIdState)
    {
        // Disconnect if connected
        case 0:
        {
            if( isSouthBoundIfCnx == true )
            {
                DisconnectBluetoothDevice();
            }

            cnxIdState = 1;
            break;
        }


        // Connect to BT device
        case 1:
        {
            if( isSouthBoundIfCnx == false )
            {
                nxtyRxBtCnx = 0;
                ConnectBluetoothDevice(guiDeviceAddrList[cnxIdIdx]);
                BluetoothCnxTimer = setTimeout(BluetoothLoop, 5000);
                cnxIdState = 2;
            }
            break;
        }


        // Bug 1581: Delay FindMyCelfi().
        // Tx cnx msg is sent by BT chip to PIC when connected so PIC will toss any messages sent immediately from the Wave App.
        case 2:
        case 3:
        case 4:
        {
            if( isSouthBoundIfCnx )
            {
                cnxIdState++;

                if( nxtyRxBtCnx == 1 )
                {
                    // Jump immediately...
                    cnxIdState = 5;
                }
            }
            break;
        }


        // Wait until device connected then send flash command...
        case 5:
        {
            FindMyCelfi();
            return;             // Exit stage left
            break;
        }

    }


    cnxIdLoopCounter++;

    // Safety exit...
    if( cnxIdLoopCounter < 40 )
    {
        // Come back in 250 mS
        setTimeout( CnxId, 250 );
    }
}


// HandleBtConfirmation.......................................................................................
function HandleBtConfirmation(buttonIndex) 
{
    // buttonIndex = 0 if dialog dismissed, i.e. back button pressed.
    // buttonIndex = 1 if 'Retry'
    if( buttonIndex == 1 )
    {
        SpinnerStart( "", "Searching harder for Cel-Fi Devices..." );
        RestartSouthBoundIf(true);
    }
}



