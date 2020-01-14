'use strict';

// Socket.io
let socket = io.connect();

// CONSTANTEN 
const drawingColor = '#50514f';
const erasingColor = '#ffe997';
const textColor = '#da1b60';
const drawingSize = 7;
const erasingSize = 20;

//VARIABLEN 
let isLevelPlayer = false;
let currentTask = '';
let isDrawing = false;
let intervalId;
let isLevelOn = false;
let levelTasks = { task1: '', task2: '' };

let drawingStep = {
    lastPos: { x: null, y: null },
    currentPos: { x: null, y: null },
    color: '',
    size: null
}

// DOM
let btnSendAntwort = document.querySelector('#btnSendAntwort');
let inputAntwort = document.querySelector('#inputAntwort');
let antwortWrap = document.querySelector('#antwortWrap');
let playerScore = document.querySelector('#playerScore');

// Canvas
let c = document.querySelector('#spielCanvas');
let ctx = c.getContext('2d');
ctx.fillStyle = erasingColor;
ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
ctx.lineJoin = ctx.lineCap = 'round';

// FUNKTIONEN
const showMessageOnCanvas = message => {
    ctx.fillStyle = textColor;
    ctx.font = "50px Arial";
    ctx.fillText(message, 10, 50);
}

function middlePoint(p1, p2) {
    return {
        x: p1.x + (p2.x - p1.x) / 2,
        y: p1.y + (p2.y - p1.y) / 2
    };
}

const renderStep = mydrawingStep => {
    ctx.strokeStyle = mydrawingStep.color;
    ctx.lineWidth = mydrawingStep.size;
    ctx.beginPath();
    ctx.moveTo(mydrawingStep.lastPos.x, mydrawingStep.lastPos.y);
    let midPoint = middlePoint(mydrawingStep.lastPos, mydrawingStep.currentPos);
    ctx.quadraticCurveTo(mydrawingStep.lastPos.x, mydrawingStep.lastPos.y, midPoint.x, midPoint.y);
    ctx.lineTo(mydrawingStep.currentPos.x, mydrawingStep.currentPos.y);
    ctx.stroke();
}

const renderLevelPath = levelPath => {
    ctx.fillStyle = erasingColor;
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    levelPath.forEach(el => {
        renderStep(el);
    });
}

const updateServer = () => {
    if(isLevelPlayer && isDrawing)
        socket.emit('saveCurrentStep', JSON.stringify(drawingStep));
}

// Socket-EVENTLISTENER
socket.on('sendSession', () => {
    socket.emit('checkIfPlayer', JSON.stringify(sessionStorage.playerId));
})

socket.on('setLevelPlayer', task => {
    isLevelPlayer = true;
    currentTask = JSON.parse(task);   
    antwortWrap.style.visibility = 'hidden';
    showMessageOnCanvas(currentTask);

})

socket.on('startLevel', tasks => {
    [levelTasks.task1, levelTasks.task2] = JSON.parse(tasks);
    isLevelOn = true;
    intervalId = setInterval(() => {
        updateServer();
    }, 10);
    ctx.fillStyle = erasingColor;
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
})

socket.on('actualiseScore', score => {
    playerScore.innerHTML = JSON.parse(score);
})

socket.on('stopLevel', () => {
    clearInterval(intervalId);
    isLevelOn = false;
    isLevelPlayer = false;
    isDrawing = false;
    ctx.fillStyle = erasingColor;
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    antwortWrap.style.visibility = 'visible';
})

socket.on('renderStep', mydrawingStep => {
    if(isLevelOn)
        renderStep(JSON.parse(mydrawingStep));
});

socket.on('duBistSpieler', daten => {
    daten = JSON.parse(daten);
    let {id, score, levelPath, tasks, levelStatus} = daten;
    console.log('My new id is :', id);
    isLevelOn = levelStatus.status;
    clearInterval(intervalId);
    if(isLevelOn){
        intervalId = setInterval(() => {
            updateServer();
        }, 10);
    }
    [levelTasks.task1, levelTasks.task2] = tasks;
    sessionStorage.playerId = id;
    renderLevelPath(levelPath);
    playerScore.innerHTML = score;
    antwortWrap.style.visibility = 'visible';
})

socket.on('showMessageOnCanvas', message => {
    showMessageOnCanvas(JSON.parse(message));
})

socket.on('disconnect', () => {
    ctx.fillStyle = erasingColor;
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    showMessageOnCanvas('Server is disconnected');
})

// DOM-Eventslistener
c.onmousedown = evt => {
    if (isLevelPlayer && isLevelOn) {
        isDrawing = true;
        if (evt.button == 0) {
            drawingStep.color = drawingColor;
            drawingStep.size = drawingSize;
        } else if (evt.button == 2) {
            drawingStep.color = erasingColor;
            drawingStep.size = erasingSize;
        }
        drawingStep.lastPos.x = drawingStep.currentPos.x = evt.offsetX;
        drawingStep.lastPos.y = drawingStep.currentPos.y = evt.offsetY;
       
    }
}

c.onmousemove = evt => {
    if (isLevelPlayer && isLevelOn) {
        if (isDrawing) {
            drawingStep.lastPos.x = drawingStep.currentPos.x;
            drawingStep.lastPos.y = drawingStep.currentPos.y;
            drawingStep.currentPos.x = evt.offsetX;
            drawingStep.currentPos.y = evt.offsetY;
        }
    }
}

c.onmouseup = evt => {
    if (isLevelPlayer && isLevelOn) {
        isDrawing = false;
    }
}

document.querySelector('body').onmouseup = evt => {
    if (isLevelPlayer && isLevelOn) {
        isDrawing = false;
    }

}

btnSendAntwort.onclick = evt => {
    if (isLevelOn) {
        if ((inputAntwort.value.toLowerCase() == levelTasks.task1.toLowerCase()) || (inputAntwort.value.toLowerCase() == levelTasks.task2.toLowerCase())){
            socket.emit('hasAnswer', JSON.stringify(inputAntwort.value));
        }else {
            setTimeout(()=> {
                inputAntwort.classList.remove('falseAnswer');
            },500);
            inputAntwort.classList.add('falseAnswer');
        }
        inputAntwort.value = '';
    }

}

inputAntwort.onkeydown = evt => {
    if (evt.key == "Enter") {
        if (isLevelOn) {
            if ((inputAntwort.value.toLowerCase() == levelTasks.task1.toLowerCase()) || (inputAntwort.value.toLowerCase() == levelTasks.task2.toLowerCase())){
                socket.emit('hasAnswer', JSON.stringify(inputAntwort.value));
            }else {
                setTimeout(()=> {
                    inputAntwort.classList.remove('falseAnswer');
                },500);
                inputAntwort.classList.add('falseAnswer');
            }
            inputAntwort.value = '';
        }
    }
}