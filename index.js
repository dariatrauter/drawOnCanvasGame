'use strict';

// Express
const express = require('express');
let expressServer = express();
expressServer.use(express.static('public'));

// HTTP-SERVER
const http = require('http');
let httpServer = http.Server(expressServer);

// Socket
const socketIo = require('socket.io');
let io = socketIo(httpServer);

// Weitere module
const fs = require('fs');

// CONSTANTEN
const roundTime = 30000;
const inactiveTime = 1000;
const delTime = 5000;
const tasksFileName = 'daten/aufgaben.json';

// VARIABLEN
let aufgaben = [];
let spieler = [];
let spieler1 = false;
let spieler2 = false;
let task1 = '';
let task2 = '';
let isLevelOn = false;
let levelPath = [];
let levelTimeOut;
let isAnswered = 0;

// KLASSEN
class Spieler {
    constructor(id) {
        this.active = true;
        this.id = id;
        this.score = 0;
        this.role = false;
        this.aufgabe = '' // Role = Zuschauer
    }
}

// FUNCTIONEN

// Datei laden
const loadData = dataname => {
    return new Promise((resolve, reject) => {
        fs.readFile(dataname, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data.toString());
            }
        })
    })
}

// Server am Starten mit nötigen Dateien initialisieren
const getAllData = () => {
    loadData(tasksFileName).then(
        antwort => {
            aufgaben.push(...JSON.parse(antwort).aufgaben);
        },
        err => console.log(err)
    );
}

// Zufallzahlerzeugen
const zufall = (min, max) => Math.floor(Math.random() * (max - min) + min);

// 2 verschiedene Zufallzahlen erzeugen , oder ein Zufallzahl, falss ein schon vorgegeben ist.
const get2DifRandom = (min, max, has) => {
    let i, i1;
    if (has !== false) {
        i = has;
    }
    else i = zufall(min, max);
    do {
        i1 = zufall(min, max)
    } while (i1 == i)
    return [i, i1];
}

// Spieler im Array finden über id
const findPlayer = (arr, id) => {
    let player = null;
    arr.forEach(el => {
        if (el.id == id) {
            player = el;
        }
    })
    return player;
}

// Spielrunde starten
const startLevel = () => {
    io.emit('startLevel', JSON.stringify([task1, task2]));
    spieler.forEach(el => {
        if (el.role == true) {
            io.to(`${el.id}`).emit('setLevelPlayer', JSON.stringify(el.aufgabe));
        }
    })
    isLevelOn = true;
    isAnswered = 0;
    console.log('StartLevel');
    levelTimeOut = setTimeout(() => {
        setNewLevel(false, false);
    }, roundTime);

}

// Spielrunde enden und neu vorbereiten
const setNewLevel = (newPlayer1Id, newPlayer2Id) => {
    let ind1, ind2, player, r1, r2;
    let activePlayer = [];

    // Runde enden
    isLevelOn = false;
    io.emit('stopLevel');
    spieler.forEach(el => {
        el.aufgabe = '';
        el.role = false;
    });
    levelPath.length = 0;

    // alle aktiven Spieler finden
    activePlayer = spieler.filter(el => {
        return el.active == true;
    });

    // wenn es genug Spieler gibt
    if (activePlayer.length >= 3) {

        // 2 verschidenen Aufgaben erzeugen
        [ind1, ind2] = get2DifRandom(0, aufgaben.length, false);
        task1 = aufgaben[ind1];
        task2 = aufgaben[ind2];

        // 2 Spieler zuweisen
        ind1 = activePlayer.indexOf(findPlayer(activePlayer, newPlayer2Id));
        spieler1 = findPlayer(activePlayer, newPlayer1Id) ? newPlayer1Id : activePlayer[get2DifRandom(0, activePlayer.length, ind1)[1]].id;
        ind2 = activePlayer.indexOf(findPlayer(activePlayer, spieler1));
        spieler2 = findPlayer(activePlayer, newPlayer2Id) ? newPlayer2Id : activePlayer[get2DifRandom(0, activePlayer.length, ind2)[1]].id;
        player = findPlayer(spieler, spieler1);
        player.aufgabe = task1;
        player.role = true;
        player = findPlayer(spieler, spieler2);
        player.aufgabe = task2;
        player.role = true;
        console.log('Spieler1 :', spieler1, ' hat Aufgabe: ', findPlayer(spieler, spieler1).aufgabe);
        console.log('Spieler2 :', spieler2, ' hat Aufgabe: ', findPlayer(spieler, spieler2).aufgabe);

        // Runde starten
        startLevel();
    } else {
        // wenn es micht genug aktiven Spieler gibt, allen Klienten mitteilen
        io.emit('showMessageOnCanvas', JSON.stringify('Nicht genug Spieler'));
    }
}

// Socket Events
io.on('connection', socket => {

    console.log('Connected', socket.id);

    // sessionStorage Daten von Klient anfragen
    socket.emit('sendSession');

    // Prüfen mit Hilfe von sessionStorage Daten, ob der Spieler schon exestiert
    socket.on('checkIfPlayer', id => {
        id = JSON.parse(id);
        let score = 0;
        let player = findPlayer(spieler, id);
        // wenn der Spieler schon exestiert, neues id zuweisen und Klient aktualisieren
        if (player) {
            player.id = socket.id;
            player.active = true;
            socket.emit('duBistSpieler',
                JSON.stringify({
                    id: player.id,
                    score: player.score,
                    levelPath: levelPath,
                    tasks: [task1, task2],
                    levelStatus: { status: isLevelOn }
                }));
            if (player.role == true) {
                socket.emit('setLevelPlayer', JSON.stringify(player.aufgabe));
                spieler1 = spieler1 == id ? player.id : spieler1;
                spieler2 = spieler2 == id ? player.id : spieler2;
            }
        } else {
            // wenn der Spieler nicht exestiert ihn zu den Spielern zuzufügen, Klient aktualisieren
            spieler.push(new Spieler(socket.id));
            socket.emit('duBistSpieler',
                JSON.stringify({
                    id: socket.id,
                    score: 0,
                    levelPath: levelPath,
                    tasks: [task1, task2],
                    levelStatus: { status: isLevelOn }
                }));
            if (!isLevelOn) {
                clearTimeout(levelTimeOut);
                setNewLevel(spieler1, spieler2);
            }
        }
    })

    // Falls vom Klient Zeichenstep bekommen wird, an alle Kliente ihn senden
    socket.on('saveCurrentStep', (drawingStep) => {
        if (isLevelOn) {
            io.emit('renderStep', drawingStep);
            levelPath.push(JSON.parse(drawingStep));
        }
    })

    // Klient hat richtige Antwort gegeben
    socket.on('hasAnswer', answer => {
        isAnswered++;
        let sp1, sp2;
        if (isAnswered == 1) {
            answer = JSON.parse(answer);
            spieler1 = (answer.toLowerCase() == task1.toLowerCase()) ? spieler1 : socket.id;
            spieler2 = (answer.toLowerCase() == task2.toLowerCase()) ? spieler2 : socket.id;
            sp1 = findPlayer(spieler, spieler1);
            sp2 = findPlayer(spieler, spieler2);
            sp1.score++;
            sp2.score++;
            io.to(`${spieler1}`).emit('actualiseScore', JSON.stringify(sp1.score));
            io.to(`${spieler2}`).emit('actualiseScore', JSON.stringify(sp2.score));
            clearTimeout(levelTimeOut);
            setNewLevel(spieler1, spieler2);
        }
    })

    // Die Verbindung zum Klient ist getrennt
    socket.on('disconnect', reason => {
        let player = findPlayer(spieler, socket.id);
        let ind, id = socket.id, playerId, activePlayer;

        console.log('disconnected', socket.id, ' Reason: ', reason);
        if (player) {
            // Status des Klientes als inaktiv merken
            player.active = false;
            // Falls der Klient Zeichenspieler war nach einen Zeitinterval prüfen, ob der wieder aktiv ist, wenn nicht neue Runde starten
            setTimeout(() => {
                
                if (player.active == false) {
                    if (player.role == true) {
                        spieler1 = player.id == spieler1 ? false : spieler1;
                        spieler2 = player.id == spieler2 ? false : spieler2;
                        clearTimeout(levelTimeOut);
                        setNewLevel(spieler1, spieler2);
                    } else {
                        activePlayer = spieler.filter(el => {
                            return el.active == true;
                        });
                        if (activePlayer.length < 3) {
                            clearTimeout(levelTimeOut);
                            setNewLevel(spieler1, spieler2);
                        }
                    }
                    // Falls der Klient nch einen Zeitinterval immer noch nicht aktiv ist, ihn löschen
                    setTimeout(() => {
                        if (player.active == false) {
                            ind = spieler.indexOf(player);
                            player = spieler.splice(ind, 1);
                            console.log('Spieler removed', player);
                        }
                    }, delTime);
                }
            }, inactiveTime);
        }
    })
})

httpServer.listen(8080, err => {
    if (err) console.log(err);
    else {
        console.log('Server laüft');
        getAllData();
    }
});