const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const activeWin = require('active-win');

// Argumentos do Stream Dock
const args = process.argv.slice(2);
const cliParams = {};
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('-')) {
        const key = args[i].substring(1);
        const valParts = [];
        let j = i + 1;
        while (j < args.length && !args[j].startsWith('-')) {
            valParts.push(args[j]);
            j++;
        }
        cliParams[key] = valParts.join(' ');
        i = j - 1;
    }
}

const port = cliParams.port;
const pluginUUID = cliParams.pluginUUID;
const registerEvent = cliParams.registerEvent;
let info = {};
try {
    info = cliParams.info ? JSON.parse(cliParams.info) : {};
} catch (e) {
    console.error("Info parse error:", e);
}

let ws;
let activeKnobs = {}; // context -> { assignedApp, clickMode, currentActiveProcess: { name, path }, currentActiveVolume, isSettingVolume, pendingVolume }
let whitelist = [];
let gamesWhitelist = [];
let blacklist = [];
let profiles = {};
let iconCache = {};
let processPathCache = {};

function getPathFromProcessName(processName) {
    if (processPathCache[processName]) {
        return processPathCache[processName] === 'NOT_FOUND' ? null : processPathCache[processName];
    }
    try {
        let pathStr = execSync(`"${VOL_CTRL_CMD}" path "${processName}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (pathStr && fs.existsSync(pathStr)) {
            processPathCache[processName] = pathStr;
            return pathStr;
        }
    } catch(e) {}
    
    processPathCache[processName] = 'NOT_FOUND';
    return null;
}

function logDebug(msg) {
    // Logging desativado conforme solicitado pelo usuário
}

// Localizar a pasta AppData para armazenar perfis de forma segura e persistente
const appDataDir = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Preferences') : path.join(process.env.HOME, '.config'));
const PLUGIN_DATA_DIR = path.join(appDataDir, 'com.alazter.mirabox.volume.sdPlugin');
const PROFILES_PATH = path.join(PLUGIN_DATA_DIR, 'profiles.json');
const OLD_PLUGIN_DATA_DIR = path.join(appDataDir, 'com.mirabox.streamdock.time.sdPlugin');
const OLD_PROFILES_PATH = path.join(OLD_PLUGIN_DATA_DIR, 'profiles.json');
const LOCAL_PROFILES_PATH = path.join(__dirname, 'profiles.json');
const VOL_CTRL_CMD = path.join(__dirname, 'VolumeControl.exe');

// Carregar perfis, whitelist, gamesWhitelist e blacklist de forma persistente com migração automatizada
function loadData() {
    try {
        if (!fs.existsSync(PLUGIN_DATA_DIR)) {
            fs.mkdirSync(PLUGIN_DATA_DIR, { recursive: true });
        }
        
        let rawData = null;
        
        if (fs.existsSync(PROFILES_PATH)) {
            rawData = fs.readFileSync(PROFILES_PATH, 'utf8');
            logDebug("Profiles carregados da pasta persistente AppData.");
        } else if (fs.existsSync(OLD_PROFILES_PATH)) {
            rawData = fs.readFileSync(OLD_PROFILES_PATH, 'utf8');
            try {
                fs.writeFileSync(PROFILES_PATH, rawData, 'utf8');
                logDebug("Profiles antigos migrados do AppData da Mirabox.");
            } catch (err) {
                console.error("Erro migrando profiles do AppData antigo:", err);
            }
        } else if (fs.existsSync(LOCAL_PROFILES_PATH)) {
            rawData = fs.readFileSync(LOCAL_PROFILES_PATH, 'utf8');
            try {
                fs.writeFileSync(PROFILES_PATH, rawData, 'utf8');
                logDebug("Profiles locais migrados para a pasta persistente AppData.");
            } catch (err) {
                console.error("Erro migrando profiles para AppData:", err);
            }
        }
        
        if (rawData) {
            const data = JSON.parse(rawData);
            profiles = data.profiles || {};
            whitelist = data.whitelist || [];
            gamesWhitelist = data.gamesWhitelist || [];
            blacklist = data.blacklist || [];
        } else {
            const defaultData = { profiles: {}, whitelist: [], gamesWhitelist: [], blacklist: [] };
            fs.writeFileSync(PROFILES_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
            profiles = defaultData.profiles;
            whitelist = defaultData.whitelist;
            gamesWhitelist = defaultData.gamesWhitelist;
            blacklist = defaultData.blacklist;
            logDebug("Nenhum profile encontrado. Inicializado novo em AppData.");
        }
    } catch(e) {
        console.error("Erro lendo profiles:", e);
        logDebug("Erro lendo profiles: " + e.message);
    }
}

function saveData() {
    try {
        if (!fs.existsSync(PLUGIN_DATA_DIR)) {
            fs.mkdirSync(PLUGIN_DATA_DIR, { recursive: true });
        }
    } catch(e) {}
    fs.writeFile(PROFILES_PATH, JSON.stringify({profiles, whitelist, gamesWhitelist, blacklist}, null, 2), 'utf8', (err) => {
        if (err) console.error("Erro salvando profiles:", err);
    });
}

let saveTimeout = null;
function saveDataDebounced() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveData();
        saveTimeout = null;
    }, 1000);
}

function getVolume(pid) {
    try {
        const out = execSync(`"${VOL_CTRL_CMD}" "${pid}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        const parts = out.split('|');
        return { volume: parseInt(parts[0], 10), muted: parts.length > 1 ? parseInt(parts[1], 10) === 1 : false };
    } catch (e) {
        return { volume: -1, muted: false };
    }
}

function applyVolume(context) {
    const knob = activeKnobs[context];
    if (!knob || knob.isSettingVolume || knob.pendingVolume === null || !knob.currentActiveProcess) return;
    
    let volToSet = knob.pendingVolume;
    knob.pendingVolume = null;
    knob.isSettingVolume = true;
    
    exec(`"${VOL_CTRL_CMD}" "${knob.currentActiveProcess.name}" ${volToSet}`, (error, stdout, stderr) => {
        if (activeKnobs[context]) activeKnobs[context].isSettingVolume = false;
        
        if (!error) {
            let parts = stdout.toString().trim().split('|');
            let finalVol = parseInt(parts[0], 10);
            if (!isNaN(finalVol) && finalVol >= 0) {
                if (!profiles[knob.currentActiveProcess.name]) profiles[knob.currentActiveProcess.name] = {};
                profiles[knob.currentActiveProcess.name].lastVolume = finalVol;
                saveDataDebounced(); // Usar a gravação debouçada para performance extrema no giro
                if (activeKnobs[context]) {
                    activeKnobs[context].currentMuted = (parts.length > 1 && parseInt(parts[1], 10) === 1);
                }
            }
        }
        if (activeKnobs[context] && activeKnobs[context].pendingVolume !== null) {
            applyVolume(context);
        }
    });
}

// Extrair icone usando powershell com cache
function getIconBase64(exePath) {
    if (!exePath) return null;
    if (iconCache[exePath] !== undefined) return iconCache[exePath];
    try {
        const base64Data = execSync(`"${VOL_CTRL_CMD}" icon "${exePath}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (base64Data && base64Data.startsWith("data:image/png;base64,")) {
            iconCache[exePath] = base64Data;
            return base64Data;
        }
    } catch (e) {}
    iconCache[exePath] = null; // Cache null on failure to prevent calling execSync repeatedly
    return null;
}

function sendToSD(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

function updateButton(context, processName, volumeInfo, exePath) {
    if (!context) return;
    const knob = activeKnobs[context];
    if (!knob) return;
    
    if (!processName) {
        if (knob.lastProcessName !== "") {
            knob.lastProcessName = "";
            knob.lastTitle = "";
            knob.lastImage = "";
            knob.lastFeedbackValue = "";
            knob.lastIndicator = 0;
            sendToSD({ event: "setTitle", context: context, payload: { title: "", target: 0 } });
            sendToSD({ event: "setFeedback", context: context, payload: { title: "No App", value: "", indicator: 0, icon: "" } });
        }
        return;
    }

    let volume = volumeInfo && typeof volumeInfo === 'object' && volumeInfo.volume !== undefined ? volumeInfo.volume : volumeInfo;
    let muted = volumeInfo && typeof volumeInfo === 'object' && volumeInfo.muted !== undefined ? volumeInfo.muted : false;

    let displayVol = muted ? "--" : (volume >= 0 ? volume.toString() : "--");

    let image = null;
    if (muted && profiles.muteIcon) {
        image = profiles.muteIcon;
    } else {
        let prof = profiles[processName] || profiles[processName.endsWith('.exe') ? processName.replace('.exe', '') : processName + '.exe'];
        if (prof && prof.image) {
            image = prof.image;
            if (!image.startsWith("data:")) {
                try {
                    const ext = path.extname(image).toLowerCase();
                    const mime = ext === '.gif' ? 'image/gif' : 'image/png';
                    const fileData = fs.readFileSync(path.join(__dirname, image));
                    image = `data:${mime};base64,` + fileData.toString('base64');
                } catch (e) {
                    console.error("Erro lendo imagem customizada:", e);
                }
            }
        } else {
            if (!exePath) {
                exePath = getPathFromProcessName(processName);
            }
            if (exePath) {
                image = getIconBase64(exePath);
            }
        }
    }

    let imageChanged = false;
    if (image && knob.lastImage !== image) {
        imageChanged = true;
        knob.lastImage = image;
        sendToSD({
            event: "setImage",
            context: context,
            payload: {
                image: image,
                target: 0
            }
        });
    }

    if (knob.lastTitle !== displayVol) {
        knob.lastTitle = displayVol;
        sendToSD({
            event: "setTitle",
            context: context,
            payload: {
                title: displayVol,
                target: 0
            }
        });
    }

    let indicatorVal = volume >= 0 ? volume : 0;
    if (knob.lastProcessName !== processName || knob.lastFeedbackValue !== displayVol || knob.lastIndicator !== indicatorVal || imageChanged) {
        knob.lastProcessName = processName;
        knob.lastFeedbackValue = displayVol;
        knob.lastIndicator = indicatorVal;

        let feedbackPayload = {
            title: processName,
            value: displayVol,
            indicator: indicatorVal
        };
        if (image) {
            feedbackPayload.icon = image;
        }
        sendToSD({
            event: "setFeedback",
            context: context,
            payload: feedbackPayload
        });
    }
}

function connect() {
    loadData();
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    
    ws.on('error', (e) => {
        console.error("WebSocket Error:", e);
        logDebug("WS ERROR: " + e.message);
    });

    ws.on('close', () => {
        logDebug("WS CLOSED");
        process.exit(0);
    });

    ws.on('open', () => {
        console.log("Conectado ao Stream Dock WebSocket!");
        sendToSD({
            event: registerEvent,
            uuid: pluginUUID
        });
    });

    ws.on('message', (data) => {
        const dataStr = data.toString();
        logDebug("RECV: " + dataStr);
        let msg = {};
        try {
            msg = JSON.parse(dataStr);
        } catch(e) {
            logDebug("Parse error on message: " + e.message);
            return;
        }
        const event = msg.event;
        const context = msg.context;
        
        if (event === "willAppear") {
            const settings = msg.payload && msg.payload.settings ? msg.payload.settings : {};
            activeKnobs[context] = {
                assignedApp: settings.assignedApp || "",
                clickMode: settings.clickMode || "whitelist",
                knobAction: settings.knobAction || "cycle",
                screenAction: settings.screenAction || "cycle",
                currentActiveProcess: null,
                currentActiveVolume: -1,
                currentMuted: false,
                isSettingVolume: false,
                pendingVolume: null,
                lastImage: null,
                lastTitle: null,
                lastProcessName: null,
                lastFeedbackValue: null,
                lastIndicator: null
            };
            if (settings.whitelist && Array.isArray(settings.whitelist)) {
                whitelist = settings.whitelist;
            }
            if (settings.blacklist && Array.isArray(settings.blacklist)) {
                blacklist = settings.blacklist;
            }
            saveData();
            logDebug("Loaded willAppear settings. Whitelist: " + JSON.stringify(whitelist) + ", Blacklist: " + JSON.stringify(blacklist));
        }

        if (event === "willDisappear") {
            delete activeKnobs[context];
        }

        if (event === "didReceiveSettings") {
            const settings = msg.payload && msg.payload.settings ? msg.payload.settings : {};
            if (activeKnobs[context]) {
                activeKnobs[context].assignedApp = settings.assignedApp || "";
                activeKnobs[context].clickMode = settings.clickMode || "whitelist";
                activeKnobs[context].knobAction = settings.knobAction || "cycle";
                activeKnobs[context].screenAction = settings.screenAction || "cycle";
                activeKnobs[context].currentActiveProcess = null; // força reavaliação
            }
            if (settings.whitelist && Array.isArray(settings.whitelist)) {
                whitelist = settings.whitelist;
            }
            if (settings.blacklist && Array.isArray(settings.blacklist)) {
                blacklist = settings.blacklist;
            }
            saveData();
        }

        // Eventos via Property Inspector
        if (event === "sendToPlugin") {
            const uiMsg = msg.payload || {};
            if (uiMsg.action === "addToWhitelist") {
                const proc = uiMsg.process.toLowerCase();
                if (!whitelist.includes(proc)) whitelist.push(proc);
                gamesWhitelist = gamesWhitelist.filter(p => p !== proc);
                blacklist = blacklist.filter(p => p !== proc); // Exclusividade mútua
                console.log("Adicionado à Software Whitelist:", proc);
                saveData();
                sendToSD({
                    event: "sendToPropertyInspector",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
                sendToSD({
                    event: "setSettings",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
            } else if (uiMsg.action === "removeFromWhitelist") {
                const proc = uiMsg.process.toLowerCase();
                whitelist = whitelist.filter(p => p !== proc);
                saveData();
                sendToSD({
                    event: "sendToPropertyInspector",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
                sendToSD({
                    event: "setSettings",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
            } else if (uiMsg.action === "addToGamesWhitelist") {
                const proc = uiMsg.process.toLowerCase();
                if (!gamesWhitelist.includes(proc)) gamesWhitelist.push(proc);
                whitelist = whitelist.filter(p => p !== proc);
                blacklist = blacklist.filter(p => p !== proc); // Exclusividade mútua
                console.log("Adicionado à Games Whitelist:", proc);
                saveData();
                sendToSD({
                    event: "sendToPropertyInspector",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
                sendToSD({
                    event: "setSettings",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
            } else if (uiMsg.action === "removeFromGamesWhitelist") {
                const proc = uiMsg.process.toLowerCase();
                gamesWhitelist = gamesWhitelist.filter(p => p !== proc);
                saveData();
                sendToSD({
                    event: "sendToPropertyInspector",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
                sendToSD({
                    event: "setSettings",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
            } else if (uiMsg.action === "addToBlacklist") {
                const proc = uiMsg.process.toLowerCase();
                if (!blacklist.includes(proc)) blacklist.push(proc);
                whitelist = whitelist.filter(p => p !== proc); // Exclusividade mútua
                gamesWhitelist = gamesWhitelist.filter(p => p !== proc);
                console.log("Adicionado à Blacklist:", proc);
                
                // Desassociar o aplicativo caso ele estivesse ativamente associado a algum knob
                for (const ctx of Object.keys(activeKnobs)) {
                    const k = activeKnobs[ctx];
                    if (k.assignedApp === proc || k.assignedApp === proc + '.exe' || k.assignedApp.replace('.exe', '') === proc) {
                        k.assignedApp = "";
                        k.currentActiveProcess = null;
                        updateButton(ctx, "", -1, null);
                    }
                }
                
                saveData();
                sendToSD({
                    event: "sendToPropertyInspector",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
                sendToSD({
                    event: "setSettings",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
            } else if (uiMsg.action === "removeFromBlacklist") {
                const proc = uiMsg.process.toLowerCase();
                blacklist = blacklist.filter(p => p !== proc);
                console.log("Removido da Blacklist:", proc);
                saveData();
                sendToSD({
                    event: "sendToPropertyInspector",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
                sendToSD({
                    event: "setSettings",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
            } else if (uiMsg.action === "setAppIcon") {
                const proc = uiMsg.process.toLowerCase();
                if (!profiles[proc]) profiles[proc] = {};
                profiles[proc].image = uiMsg.image;
                saveData();
                console.log("Custom icon saved for", proc);
                
                // Força atualizar na tela caso o app modificado seja o que está ativo
                for (const ctx of Object.keys(activeKnobs)) {
                    const k = activeKnobs[ctx];
                    if (k.currentActiveProcess && (k.currentActiveProcess.name === proc || k.currentActiveProcess.name === proc + '.exe' || k.currentActiveProcess.name.replace('.exe', '') === proc)) {
                        k.lastImage = null; // força reenviar
                        updateButton(ctx, k.currentActiveProcess.name, k.currentActiveVolume, k.currentActiveProcess.path);
                    }
                }
            } else if (uiMsg.action === "setVolumeStep") {
                profiles.volumeStep = uiMsg.step;
                saveData();
                console.log("Volume step updated to", profiles.volumeStep);
            } else if (uiMsg.action === "setMuteIcon") {
                profiles.muteIcon = uiMsg.image;
                saveData();
                console.log("Custom mute icon saved");
                for (const ctx of Object.keys(activeKnobs)) {
                    const k = activeKnobs[ctx];
                    if (k.currentActiveProcess && k.currentMuted) {
                        k.lastImage = null; // force resend
                        updateButton(ctx, k.currentActiveProcess.name, { volume: k.currentActiveVolume, muted: k.currentMuted }, k.currentActiveProcess.path);
                    }
                }
            } else if (uiMsg.action === "getAudioProcesses") {
                try {
                    const processesRaw = execSync(`"${VOL_CTRL_CMD}" list`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
                    let processList = [];
                    if (processesRaw.length > 0) processList = processesRaw.split(',').map(p => p.toLowerCase());
 
                    // Garantir que streamdock.exe sempre apareça na lista de detectados para poder ser bloqueado
                    if (!processList.includes("streamdock.exe")) {
                        processList.push("streamdock.exe");
                    }

                    // Filtrar fora processos na blacklist para que não apareçam nos processos detectados
                    const filteredProcessList = processList.filter(p => !blacklist.includes(p));

                    sendToSD({
                        event: "sendToPropertyInspector",
                        context: context,
                        payload: { audioProcesses: filteredProcessList, whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                    });
                } catch(e) {
                    console.error("Erro ao listar processos de audio: ", e);
                }
            } else if (uiMsg.action === "requestGlobalState") {
                sendToSD({
                    event: "sendToPropertyInspector",
                    context: context,
                    payload: { whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist }
                });
            } else if (uiMsg.action === "setKnobConfig") {
                if (activeKnobs[context]) {
                    activeKnobs[context].assignedApp = uiMsg.assignedApp || "";
                    activeKnobs[context].clickMode = uiMsg.clickMode || "whitelist";
                    activeKnobs[context].knobAction = uiMsg.knobAction || "cycle";
                    activeKnobs[context].screenAction = uiMsg.screenAction || "cycle";
                    activeKnobs[context].currentActiveProcess = null; // força reavaliação
                    
                    sendToSD({
                        event: "setSettings",
                        context: context,
                        payload: {
                            assignedApp: activeKnobs[context].assignedApp,
                            clickMode: activeKnobs[context].clickMode,
                            knobAction: activeKnobs[context].knobAction,
                            screenAction: activeKnobs[context].screenAction,
                            whitelist: whitelist,
                            gamesWhitelist: gamesWhitelist,
                            blacklist: blacklist
                        }
                    });
                }
            }
        }

        if (event === "dialRotate" || event === "encoderRotate") {
            const ticks = msg.payload.ticks || 0;
            const knob = activeKnobs[context];
            if (knob && ticks !== 0 && knob.currentActiveProcess) {
                if (knob.clickMode === "whitelist" && !whitelist.includes(knob.currentActiveProcess.name)) return;
                if (knob.clickMode === "games" && !gamesWhitelist.includes(knob.currentActiveProcess.name)) return;
                let currentVol = knob.currentActiveVolume;
                if (currentVol >= 0) {
                    let step = profiles.volumeStep || 5;
                    let newVol = currentVol + (ticks * step);
                    newVol = Math.max(0, Math.min(100, newVol));
                    
                    knob.currentActiveVolume = newVol;
                    updateButton(context, knob.currentActiveProcess.name, { volume: newVol, muted: knob.currentMuted }, knob.currentActiveProcess.path);
                    
                    knob.pendingVolume = newVol;
                    applyVolume(context);
                }
            }
        }

        if (event === "dialDown" || event === "touchTap" || event === "keyUp" || event === "encoderPress" || event === "encoderUp" || event === "encoderDown") {
            const knob = activeKnobs[context];
            if (knob) {
                let isKnobPress = (event === "dialDown" || event === "encoderPress" || event === "encoderUp" || event === "encoderDown");
                let action = isKnobPress ? knob.knobAction : knob.screenAction;
                if (!action) action = "cycle";

                if (action === "mute") {
                    if (knob.currentActiveProcess) {
                        try {
                            const out = execSync(`"${VOL_CTRL_CMD}" "${knob.currentActiveProcess.name}" toggle_mute`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
                            const parts = out.split('|');
                            if (parts.length > 1) {
                                knob.currentMuted = (parseInt(parts[1], 10) === 1);
                                knob.lastImage = null; // Force refresh image overlay
                                updateButton(context, knob.currentActiveProcess.name, { volume: knob.currentActiveVolume, muted: knob.currentMuted }, knob.currentActiveProcess.path);
                            }
                        } catch(e) { console.error("Error toggling mute", e); }
                    }
                } else if (action === "cycle") {
                    try {
                        const processesRaw = execSync(`"${VOL_CTRL_CMD}" list`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
                        let processList = processesRaw.length > 0 ? processesRaw.split(',').map(p => p.toLowerCase()) : [];
                        
                        let cyclePool = [];
                        if (knob.clickMode === "whitelist") {
                            cyclePool = processList.filter(p => whitelist.includes(p) && !blacklist.includes(p));
                            if (cyclePool.length === 0) cyclePool = whitelist.filter(p => !blacklist.includes(p));
                        } else if (knob.clickMode === "games") {
                            cyclePool = processList.filter(p => gamesWhitelist.includes(p) && !blacklist.includes(p));
                            if (cyclePool.length === 0) cyclePool = gamesWhitelist.filter(p => !blacklist.includes(p));
                        } else {
                            cyclePool = processList.filter(p => !blacklist.includes(p));
                            const win = activeWin.sync();
                            if (win && win.owner) {
                                const focusedProcessName = (win.owner.path ? path.basename(win.owner.path) : win.owner.name).toLowerCase();
                                if (focusedProcessName.endsWith('.exe') && !blacklist.includes(focusedProcessName) && !cyclePool.includes(focusedProcessName)) {
                                    cyclePool.push(focusedProcessName);
                                }
                            }
                        }
                        
                        if (cyclePool.length > 0) {
                            let currentIndex = knob.currentActiveProcess ? cyclePool.indexOf(knob.currentActiveProcess.name) : -1;
                            let nextIndex = (currentIndex + 1) % cyclePool.length;
                            let nextApp = cyclePool[nextIndex];
                            
                            knob.assignedApp = nextApp;
                            knob.currentActiveProcess = null; // force update
                            
                            sendToSD({ event: "setSettings", context: context, payload: { assignedApp: nextApp, clickMode: knob.clickMode, knobAction: knob.knobAction, screenAction: knob.screenAction, whitelist: whitelist, gamesWhitelist: gamesWhitelist, blacklist: blacklist } });
                            sendToSD({ event: "sendToPropertyInspector", context: context, payload: { assignedApp: nextApp } });
                        }
                    } catch(e) {}
                }
            }
        }
    });
}

// Background loop para checar foco da janela e sincronizar volume de forma eficiente
let volumeCheckCounter = 0;
setInterval(async () => {
    const knobContexts = Object.keys(activeKnobs);
    if (knobContexts.length === 0) return;
    
    try {
        const needsFocusTracking = knobContexts.some(ctx => !activeKnobs[ctx].assignedApp);
        let focusedProcessName = null;
        let focusedPath = null;

        if (needsFocusTracking) {
            const win = activeWin.sync();
            focusedProcessName = win && win.owner ? (win.owner.path ? path.basename(win.owner.path) : win.owner.name).toLowerCase() : null;
            focusedPath = win && win.owner ? win.owner.path : null;
        }
        
        volumeCheckCounter++;
        const shouldSyncVolume = (volumeCheckCounter % 2 === 0); // Sincroniza passivamente a cada 2 ciclos (2000ms)
        
        for (const context of knobContexts) {
            const knob = activeKnobs[context];
            let targetProcessName = knob.assignedApp;
            let targetPath = null;
            
            if (targetProcessName && blacklist.includes(targetProcessName)) {
                targetProcessName = "";
            }
            
            if (!targetProcessName) {
                let targetList = [];
                if (knob.clickMode === "games") targetList = gamesWhitelist;
                else if (knob.clickMode === "whitelist") targetList = whitelist;

                if (knob.clickMode === "all") {
                    if (focusedProcessName && !blacklist.includes(focusedProcessName)) {
                        targetProcessName = focusedProcessName;
                        targetPath = focusedPath;
                    }
                } else {
                    if (focusedProcessName && targetList.includes(focusedProcessName) && !blacklist.includes(focusedProcessName)) {
                        targetProcessName = focusedProcessName;
                        targetPath = focusedPath;
                    } else if (knob.currentActiveProcess && targetList.includes(knob.currentActiveProcess.name) && !blacklist.includes(knob.currentActiveProcess.name)) {
                        targetProcessName = knob.currentActiveProcess.name;
                        targetPath = knob.currentActiveProcess.path;
                    }
                }
            } else {
                if (knob.currentActiveProcess && knob.currentActiveProcess.name === targetProcessName) {
                    targetPath = knob.currentActiveProcess.path;
                }
            }
            
            if (targetProcessName) {
                if (!knob.currentActiveProcess || knob.currentActiveProcess.name !== targetProcessName) {
                    // Sincronização imediata ao mudar de janela/aplicativo para feedback visual instantâneo!
                    knob.currentActiveProcess = { name: targetProcessName, path: targetPath };
                    let volInfo = getVolume(targetProcessName);
                    knob.currentActiveVolume = volInfo.volume;
                    knob.currentMuted = volInfo.muted;
                    updateButton(context, targetProcessName, volInfo, targetPath);
                } else {
                    // Sincronização inteligente de volume/mudo passiva apenas se o app não mudou e no ciclo correto (a cada 2s)
                    if (!knob.isSettingVolume && knob.pendingVolume === null && shouldSyncVolume) {
                        let volInfo = getVolume(targetProcessName);
                        if (volInfo.volume >= 0 && (volInfo.volume !== knob.currentActiveVolume || volInfo.muted !== knob.currentMuted)) {
                            knob.currentActiveVolume = volInfo.volume;
                            knob.currentMuted = volInfo.muted;
                            updateButton(context, targetProcessName, volInfo, targetPath);
                        }
                    }
                }
            } else {
                if (knob.currentActiveProcess) {
                     knob.currentActiveProcess = null;
                     updateButton(context, "", -1, null);
                }
            }
        }
    } catch(e) {}
}, 1000);

setInterval(() => {
    logDebug("ALIVE");
}, 5000);

connect();
