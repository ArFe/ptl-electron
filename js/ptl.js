const { ipcRenderer } = require('electron');
const csv = require('csv-parser');
const fs = require('fs');
const cmd="CMD0002";
const rsp="RSP0002";
const yellow = "#ffc107";
const red = "red";
const green = "green";
let qty = 1;
let serialPort;
let data = [];



function openFile() {
    const results = [];

    const file2open = {filters: [{ name: 'CSV', extensions: ['csv'] }], properties: ['openFile']};      
    ipcRenderer.invoke('read-file', file2open)
    .then(result => {
        if(!result.canceled){
            fs.createReadStream(result.filepath)
            .pipe(csv({ separator: '\t' , mapHeaders: ({ header, index }) => header.toLowerCase()}))
            .on('data', (data) => results.push(data))
            .on('end', () => {
                console.log(results);
                if(results.length > 0){
                    qty = results.length + 1;
                    setTable(true);
                    results.forEach((line, index) => {
                        let i = index + 1;
                        getElem("id"+i).value = line.id;
                        getElem("value"+i).value = line.qty;
                    });
                    setCSV();
                    if(getElem("load-and-send").checked){
                        ipcRenderer.invoke('serial-status')
                        .then(serialPortOpen => {
                            if (serialPortOpen){
                                sendMsg();
                            }
                        });
                    }
                        
                }
            });                
        } else {
            console.log('Open File canceled by the user');
        }
    })
    .catch(err => {
        console.log('Error: ' + err);
    })
}

function sendMsg() {
    let msg = { 'data': data,
                'cmd': cmd,
                'rsp': rsp};
 
    console.log('ptl.sendMsg');
    ipcRenderer.send('send-msg', msg);
}

ipcRenderer.on('send-reply', (event, rsp) => {
    console.log(rsp);
    if(rsp.err){
        onScreenLog(rsp.msg);
    } else{
        onScreenLog("");
    }
})

function submit(event) {
    sendMsg();
    event.preventDefault();
    scrollTo(0, 0);
}

function setTable(clear){
    let table = document.querySelector("#tableid");
    let col1;
    let col2;
    let col3;
    let col4;
    let input1;
    let input2;

    if (clear) {
        table.innerHTML = "";
    }

    if(table != null){
        for (let index = 1; index <= qty; index++) {
            try {
                getElem("id" + index);                    
            } catch (error) {                  
                col1 = document.createElement("div");
                col2 = document.createElement("div");
                col3 = document.createElement("div");
                col4 = document.createElement("div");
                col1.innerHTML = "Pick " + index;
                input1 = document.createElement("input");
                input2 = document.createElement("input");
                input1.id = "id" + index;
                input2.id = "value" + index;
                input1.placeholder = "Id";
                input2.placeholder = "Value";
                input1.type = "number";
                input2.type = "number";
                input1.className = "form-control";
                input2.className = "form-control";
                col1.className = "col-1 themed-grid-col align-middle";
                col2.className = "col-2 themed-grid-col";
                col3.className = "col-2 themed-grid-col";
                col4.className = "col-1 themed-grid-col";
                col2.appendChild(input1);
                col3.appendChild(input2);
                input1.oninput = setCSV;
                input2.oninput = setCSV;
                table.appendChild(col1);
                table.appendChild(col2);
                table.appendChild(col3);
                table.appendChild(col4);
            }
        }
    }
}

function initialize() {
    getElem("ptl").onsubmit = submit;
    getElem("file").onclick = openFile;
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

    ipcRenderer.send('init-event');

    setTable();
    setCSV();
}


function setDisplayNumbers(){
    getElem("text-input").value = "6210,1,0,0,0,0";
    getElem("cmd").value = "CMD0004";
    getElem("rsp").value = "RSP0004";
}

function setCSV(){
    // (6)Run Host List = 1, (7)Stop Operation = 1
    let text = "6,5,0,0,0,1,1";
    let itemId, itemValue;
    // Start at 1 to add the 2 last 0's after the pick Sequence
    let cnt = 1; 
    let pickSequence = "";
    data = [];

    // (7)Stop Operation = 1
    // data.push("7,1,0,0,0,1");

    if (getElem("id" + qty).value){
        qty++;
        setTable();
    }

    // (8) run-list-once
    if (getInput("run-list-once").checked) 
        text += ",1";
    else
        text += ",0";

    // (9)MB/EIP = 0 and (10) ListID = 0
    text += ",0,0";
    data.push(text);
    text ="";

    for (let index = 1; index <= qty; index++) {
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
    text += "11," + 2*cnt + ",0,0,0" + pickSequence + ",0,0";
    data.push(text);
    text ="";

    if (getInput("opMode-pick").checked) 
        text += "5,3,0,0,0,2,1,0";
    else if (getInput("opMode-batch").checked) 
        text += "5,3,0,0,0,3,1,0";

    data.push(text);

    ipcRenderer.invoke('serial-status')
    .then(serialPortOpen => {
        if (cnt == 1 || !serialPortOpen){
            getElem("submit").disabled = true;
        } else{
            getElem("submit").disabled = false;
        }
    });
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

ipcRenderer.on('serial-response', (event, rsp) => {
    console.log(rsp.msg);
    try{
        let jsonMsg = JSON.parse(rsp.msg);
        if(jsonMsg.expected || jsonMsg.actuated) {
            getElem("results").hidden = false;
            getElem("expected").value = jsonMsg.expected;
            getElem("actuated").value = jsonMsg.actuated;

            if(jsonMsg.expected == jsonMsg.actuated) {
                getElem("actuated").style.border = "3px solid "+ green;
            } else if (jsonMsg.actuated !== "") {
                getElem("actuated").style.border = "3px solid "+ red;
            }

        }
    } catch(err){
        if(rsp.msg.includes("Running Sequence")) {
            getElem("logs").style.border = "3px solid "+ green;
        } else if(rsp.msg.includes("error")) {
            getElem("logs").style.border = "3px solid "+ red;
        }
        
        if(!(rsp.msg.includes("\r")||rsp.msg.includes("Display"))){
            onScreenLog(rsp.msg, true);
        }
        if(rsp.msg.includes("End")){
            getElem("expected").value = "";
            getElem("actuated").value = "";
            getElem("actuated").style = "";
        }
    }
})


/**
 * @param {string} msg The date
 * @param {boolean} append If it should append or clear the On Screen Log
 */
 function onScreenLog(msg, append){
    if(append){
        getElem("logs").value = msg + "\n" + getElem("logs").value;
    } else {
        getElem("logs").value = msg;
    }

};


initialize();
