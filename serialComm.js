const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const EventEmitter = require('events');
const serialLC = new EventEmitter();

let serialPort;

serialInit = (ports) => {
    console.log('ports: ', ports);
    if (ports.length === 0) {
        serialLC.emit('error', 'Error: No ports discovered');
    } else {
        let dxmPorts = [];
        ports.forEach(element => {
            if(element.manufacturer.includes("Banner") && element.serialNumber.includes("DXM"))
                dxmPorts.push(element.path);
        });
        if (dxmPorts.length === 0) {
            serialLC.emit('error', 'No Banner DXM discovered');
        } else {
            serialPort = new SerialPort(dxmPorts[0], {baudRate: 115200}, serialOpen);
        }
    }
}

serialOpen = (err) => {
    if (err) {
        console.log('Error: ', err.message);
        serialLC.emit('error', 'Error Opening Port: ' + err.message);
    } else{ 
        console.log('serial port opened');
        serialLC.emit('connected', 'Connected to DXM on port ' + serialPort.path);

        // get data from connected device via serial port
        const parser = serialPort.pipe(new Readline({ delimiter: '\n' }))
        parser.on('data', function(data) {
           console.log(data);
            // receivedMsg(data);
        });

        serialPort.on('error', function(data) {
            console.log('Error: ' + data);
        }) 
    }
};

function writeAndDrain (data, callback) {
    // flush data received but not read
    serialPort.flush();

    // write/send data to serial port
    serialPort.write(data, function (error) {
        console.log(data);
        if(error){console.log(error);}
        else{
            // waits until all output data has been transmitted to the serial port.
            serialPort.drain(callback);      
        }
    });
}

module.exports = {
    initialize : () => {
        return new Promise(function(resolve, reject){
            serialLC.removeAllListeners(['listed']);
            serialLC.removeAllListeners(['error']);
            serialLC.removeAllListeners(['connected']);
            SerialPort.list().then((ports, err) => { 
                if(err) {
                    serialLC.emit('listed', "Error listing serial ports: " + err);
                } else {
                    serialLC.emit('listed', ports);
                }
            });
            serialLC.on('listed', serialInit);
            serialLC.on('error', (error) => {
                // console.log('Initialize Error: ' + error);
                reject(error);
            })
            serialLC.on('connected', (msg) => {
                // console.log('Initialize:' + msg);
                resolve(msg);
            })
        });
    },

    open : () => {
        SerialPort.list().then((ports, err) => { 
            if(err) {
                serialLC.emit('listed', "Error listing serial ports: " + err);
            } else {
                serialLC.emit('listed', ports);
            }
        });
    },

    readline : () => {

    },

    write : (data) => {
        return new Promise(function(resolve, reject){
            if(serialPort && serialPort.isOpen){
                writeAndDrain(data);
            } else {
                reject("Serial not Open");
            }
        });
    },

    isOpen : () => {return (serialPort && serialPort.isOpen);},
};
    

