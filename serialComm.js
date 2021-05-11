const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const EventEmitter = require('events');
const serialEvents = new EventEmitter();

let serialPort;
let timeout = 2;
let maxRetries = 3;

serialInit = (ports) => {
    console.log('ports: ', ports);
    if (ports.length === 0) {
        let errMsg = 'Error: No ports discovered';
        serialEvents.emit('status',  { 'err': true, 'msg': errMsg});
    } else {
        let dxmPorts = [];
        ports.forEach(element => {
            if(element.manufacturer.includes("Banner") && element.serialNumber.includes("DXM"))
                dxmPorts.push(element.path);
        });
        if (dxmPorts.length === 0) {
            let errMsg = 'No Banner DXM discovered';
            serialEvents.emit('status',  { 'err': true, 'msg': errMsg});
            } else {
            serialPort = new SerialPort(dxmPorts[0], {baudRate: 115200}, serialOpen);
        }
    }
}

serialOpen = (err) => {
    if (err) {
        console.log('Error: ', err.message);
        serialEvents.emit('status',  { 'err': true, 'msg': err.message});
        
    } else{ 
        console.log('serial port opened');
        let msg = 'Connected to DXM on port ' + serialPort.path;
        serialEvents.emit('status',  { 'err': false, 'msg': msg});

        // get data from connected device via serial port
        const parser = serialPort.pipe(new Readline({ delimiter: '\n' }))
        parser.on('data', function(data) {
            console.log(data);
            serialEvents.emit('read',  data);
            serialEvents.emit('msg',  {'msg': data});

        });

        serialPort.on('error', function(data) {
            console.log('Error: ' + data);
        }) 
    }
};


function writeAndDrain (data) {
    // flush data received but not read
    serialPort.flush();

    // write/send data to serial port
    serialPort.write(data, function (error) {
        console.log(data);
        if(error){
            console.log(error);
            serialEvents.emit('write',  { 'err': true, 'msg': error});
        }
        else{
            // waits until all output data has been transmitted to the serial port.
            serialPort.drain();
            serialEvents.emit('write',  { 'err': false});
        }
    });
}

module.exports = {
    initialize : () => {
        return new Promise(function(resolve, reject){
            SerialPort.list().then((ports, err) => { 
                if(err) {
                    let msg = "Error listing serial ports: " + err;
                    serialEvents.emit('status',  { 'err': true, 'msg': msg});
                } else {
                    serialInit(ports);
                }
            });
            serialEvents.once('status', (rsp) => {
                if(rsp.err){
                    // console.log('Initialize Error: ' + error);
                    reject(rsp.msg);
                } else {
                    // console.log('Initialize:' + msg);
                    serialEvents.emit('msg',  {'msg': rsp.msg});
                    resolve(rsp.msg);
                }
            })
        });
    },

    sendMsg : (command, data, response) => {
        return new Promise(function(resolve, reject){
            let retries = 0
            if(serialPort && serialPort.isOpen){
                const tout = setTimeout(function msgTimeout(){ 
                    if (++retries >= maxRetries) {
                        serialEvents.removeAllListeners('write');
                        serialEvents.removeAllListeners('read');
                        reject('Retried... ' + retries + ' times.\n Timeout!'); 
                    } else {
                        console.log('Retrying ... ' + retries);
                        setTimeout(msgTimeout, timeout*1000);                    
                        writeAndDrain(command + " " + data + "\n\r") ;
                    }
                }, timeout*1000);
                writeAndDrain(command + " " + data + "\n\r") ;
    
                serialEvents.on('write', (rsp) => {
                    if(rsp.err){
                        serialEvents.emit('msg',  { 'war': true, 'msg': rsp.msg});
                    }
                })
                serialEvents.on('read', (rsp) => {
                    if(rsp.includes(response)){
                        serialEvents.removeAllListeners('write');
                        serialEvents.removeAllListeners('read');
                        clearTimeout(tout);                                    
                        resolve(rsp);
                    } else {
                        let msg = "Wrong Reponse received: " + rsp + " | Expected: " + response;
                        serialEvents.emit('msg',  { 'war': true, 'msg': msg});
                    }
                })


            } else {
                reject("Serial not Open");
            }
        });    
    },

    isOpen : () => {return (serialPort && serialPort.isOpen);},

    setTimeout: (tout) => {timeout = tout;},
    setMaxRetries: (maxRet) => {maxRetries = maxRet;},

    serialEvents : serialEvents,
};
    

