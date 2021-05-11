const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const serialPort = require('./serialComm');
// const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const DelayBetweenMsgs = 300;


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let rendEvent;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 600,
        icon: "./images/icon.png",
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }))

    // Open the DevTools.
    mainWindow.webContents.openDevTools();
    mainWindow.maximize();

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    })

    setTimeout(function listPorts() {
        if(!serialPort.isOpen()){
            serialPort.initialize()            
            .then(result => {
                console.log('Serial Initialize ok: ' + result);
            }).catch(error => {
                console.log('Serial Initialize error: ' + error);
            });    
        }
        setTimeout(listPorts, 2000);
    }, 2000);

    serialPort.serialEvents.on('msg', (msg) => {
        if(rendEvent){
            rendEvent.reply('serial-response', msg);
        }
    })

};

// This is required to be set to false beginning in Electron v9 otherwise
// the SerialPort module can not be loaded in Renderer processes like we are doing
// in this example. The linked Github issues says this will be deprecated starting in v10,
// however it appears to still be changed and working in v11.2.0
// Relevant discussion: https://github.com/electron/electron/issues/18397
app.allowRendererProcessReuse=false;

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    app.quit();
});

app.on('activate', function() {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


ipcMain.handle('read-file', async (event, file2open) => {
    const result = dialog.showOpenDialogSync(file2open);
    if (result != undefined) {
        return { 'filepath':result[0], 'canceled':false};        
    } else {
        return { 'filepath':"", 'canceled':true};        
    }
})

ipcMain.handle('serial-status', () => {
        return serialPort.isOpen();        
})

/**
 * @param {event} event the event to return
 * @param {string} msg the message to send
 * @param {integer} index the current index
 * @param {string} msg the result to return
 * @param {boolean} err if an error has happened
 */

function sendMsg(event, msg, index, result, err) {
    if(index < msg.data.length){
        serialPort.sendMsg(msg.cmd, msg.data[index], msg.rsp)            
        .then(result => {
            console.log('Msg %d sent ok: ' + result , index+1);
            setTimeout(() => {
                sendMsg(event, msg, ++index, result, false);
            }, DelayBetweenMsgs);            
        }).catch(error => {
            errMsg = 'Msg sent error: ' + error;
            console.log(errMsg);
            sendMsg(event, msg, msg.data.length, errMsg, true);
        });
    } else {
        event.reply('send-reply', { 'err': err, 'msg': result});
        if(!err)
            console.log('All %d commands sent ok!' , index);
    }
}

ipcMain.on('send-msg', (event, msg) => {
    if(serialPort.isOpen()){
        serialPort.setMaxRetries(2);
        sendMsg(event, msg, 0);
    } else {
        errMsg = 'Serial Port not Open';
        console.log(errMsg);
        event.reply('send-reply', { 'err': true, 'msg': errMsg});
    };
})


ipcMain.on('init-event', (event) => {
    rendEvent = event;
})
  


