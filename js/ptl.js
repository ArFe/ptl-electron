"use strict";

var app;

const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline')
let serialPort;

(function (app) {

    async function listSerialPorts() {
        await SerialPort.list().then((ports, err) => {
          let dxmPort;
          if(err) {
            getElem('logs').value = err.message
            return
          } else {
            getElem('logs').value = ''
          }
          console.log('ports', ports);
      
          if (ports.length === 0) {
            getElem('logs').value = 'No ports discovered';
          } else {
              ports.forEach(element => {
                  if(element.manufacturer.includes("Banner") && element.serialNumber.includes("DXM"))
                      dxmPort = element.path;
              });
              if (!dxmPort) {
                getElem('logs').value = 'No Banner DXM discovered';
              } else {
                  serialPort = new SerialPort(dxmPort, {baudRate: 115200}, function (err) {
                      if (err) {
                      return console.log('Error: ', err.message)
                      } else{ 
                          console.log('serial port opened');
                          getElem('logs').value = 'Connected to DXM on port ' + dxmPort;
                          // serialport_opened = true;
              
                          // get data from connected device via serial port
                          const parser = serialPort.pipe(new Readline({ delimiter: '\n' }))
                          parser.on('data', function(data) {
                            //   console.log(data);
                              receivedMsg(data);
                          });
              
                          serialPort.on('error', function(data) {
                              console.log('Error: ' + data);
                          }) 
                      }
                  })
              } 
          }
        })
      }

    function receivedMsg(msg){
        console.log(msg);
        try{
            let jsonMsg = JSON.parse(msg);
            if(jsonMsg.expected) {
                getElem("results").hidden = false;
                // getElem("logs").value = msg + "\n" + getElem("logs").value;
                getElem("expected").value = jsonMsg.expected;
                getElem("actuated").value = jsonMsg.actuated;

                if(jsonMsg.expected == jsonMsg.actuated)
                    getElem("logs").style = "height:5em;border:3px solid green;";
                else
                    getElem("logs").style = "height:5em;border:3px solid red;";
    
            }
        } catch(err){
            if(msg.includes("RSP"))
                getElem("logs").style = "height:5em;border:3px solid #ffc107;";
            else if(msg.includes("Running Sequence"))
                getElem("logs").style = "height:5em;border:3px solid green;";
            else if(msg.includes("error"))
                getElem("logs").style = "height:5em;border:3px solid red;";
            
            if(!(msg.includes("\r")||msg.includes("Display")))
                getElem("logs").value = msg + "\n" + getElem("logs").value;

            getElem("results").hidden = false;
            getElem("logs").hidden = false;
        }
    }

    function writeAndDrain (data, callback) {
        if(serialPort && serialPort.isOpen){
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
        } else {
            getElem("logs").value = "Serial Port is Closed";
            console.log('Serial Port is Closed');
            getElem("submit").disabled = true;
        }
    }
   
    function submit(event) {
        let values = getElem("text-input").value.replace(/\n/g, "\\\\n");
        let msg = '{"values":"' + values + '",';
        msg += '"dxmid":"' + getElem("dxmid").value + '",';
        msg += '"cmd":"' + getElem("cmd").value + '",';
        msg += '"rsp":"' + getElem("rsp").value + '"}';

        try {
            msg = JSON.parse(msg);
            if(msg.values != ""){
              const values = msg.values.split("\\n");
              const cmd = msg.cmd + " ";
              const rsp = msg.rsp;
    
              values.forEach(element => {
                writeAndDrain(cmd+element+"\n\r", null);                  
              });
            }
                
            getElem("logs").value = "";
            getElem("logs").style = "height:5em;";
        } catch (error) {
            getElem("logs").value = "Error: " + error;
            getElem("logs").style = "height:5em;";               
        }

        event.preventDefault();
        scrollTo(0, 0);
    }

    function setTable(){
        let table = document.querySelector("#tableid");
        let row;
        let col1;
        let col2;
        let col3;
        let input1;
        let input2;
        let numItems = getElem("qty").value;
        if (isNaN(numItems))
            numItems = 1

        if(table != null){
            for (let index = 1; index <= numItems; index++) {
                try {
                    getElem("id" + index);                    
                } catch (error) {                  
                    row = document.createElement("div");
                    col1 = document.createElement("div");
                    col2 = document.createElement("div");
                    col3 = document.createElement("div");
                    col1.innerHTML = "Pick " + index;
                    input1 = document.createElement("input");
                    input2 = document.createElement("input");
                    input1.id = "id" + index;
                    input2.id = "value" + index;
                    input1.placeholder = "Pick " + index + " id";
                    input2.placeholder = "Pick " + index + " value";
                    input1.type = "number";
                    input2.type = "number";
                    input1.className = "form-control";
                    input2.className = "form-control";
                    col1.className = "col-sm-2 themed-grid-col";
                    col2.className = "col-sm-5 themed-grid-col";
                    col3.className = "col-sm-5 themed-grid-col";
                    col2.appendChild(input1);
                    col3.appendChild(input2);
                    input1.oninput = setCSV;
                    input2.oninput = setCSV;
                    row.className = "row mb-3";
                    row.appendChild(col1);
                    row.appendChild(col2);
                    row.appendChild(col3);
                    table.appendChild(row);
                }
            }
        }
    }

    function initialize() {
        getElem("ptl").onsubmit = submit;
        let elems = document.querySelectorAll("input[type=number], textarea");
        for (let el of elems) {
            if (el.id.indexOf("version-") != 0){
                if(el.id == "qty")
                    el.oninput = setTable;
                else
                    el.oninput = setCSV;
            }
        }
        elems = document.querySelectorAll("input[type=radio], input[type=checkbox]");
        for (let el of elems)
            el.onchange = setCSV;

        setTable();
        setCSV();

        setTimeout(function listPorts() {
            if(!serialPort || !serialPort.isOpen){
                listSerialPorts();
                getElem("submit").disabled = true;
            } else if(getElem("text-input").value != ""){
                getElem("submit").disabled = false;
            }
            setTimeout(listPorts, 2000);
          }, 2000);
    }
    

    function setDisplayNumbers(){
        getElem("text-input").value = "6210,1,0,0,0,0";
        getElem("cmd").value = "CMD0004";
        getElem("rsp").value = "RSP0004";
    }

    function setCSV(){
        // Run Host List
        const cmd = "CMD0002";
        const rsp = "RSP0002";
        let text = "6,5,0,0,0,1,0";
        let itemId, itemValue;
        // Start at 1 to add the 2 last 0's after the pick Sequence
        let cnt = 1; 
        let pickSequence = "";
        let numItems = getElem("qty").value;
        if (isNaN(numItems))
            numItems = 1

        if (getElem("id" + numItems).value){
            getElem("qty").value = ++numItems;
            setTable();
        }

        // register 8 run-list-once
        if (getInput("run-list-once").checked) 
            text += ",1";
        else
            text += ",0";

        // registers 9 and 10 (pick list)
        text += ",0,0\n";
    
        for (let index = 1; index <= numItems; index++) {
            itemId = getElem("id" + index).value;
            itemValue = getElem("value" + index).value;

            if (itemId){
                pickSequence += "," +  itemId;
                cnt++;
            } else
                break;

            if (itemValue){
                pickSequence += "," + itemValue;
            } else
                pickSequence += ",0";
        }
        // add ",0,0\n" to garantee the end of the sequence
        text += "11," + 2*cnt + ",0,0,0" + pickSequence + ",0,0\n";

        if (getInput("opMode-pick").checked) 
            text += "5,1,0,0,0,2";
        else if (getInput("opMode-batch").checked) 
            text += "5,1,0,0,0,3";

        if (cnt == 1 || !serialPort || !serialPort.isOpen){
            text = "";
            getElem("submit").disabled = true;
        } else{
            getElem("submit").disabled = false;
        }

        getElem("text-input").value = text;
        getElem("cmd").value = cmd;
        getElem("rsp").value = rsp;
    } 

    function getElem(id) {
        const result = document.getElementById(id);
        if (result instanceof HTMLElement)
            return result;
        throw "Assertion error";
    }
    function getInput(id) {
        const result = getElem(id);
        if (result instanceof HTMLInputElement)
            return result;
        throw "Assertion error";
    }
    initialize();
})(app || (app = {}));
