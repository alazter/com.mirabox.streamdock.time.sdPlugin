const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const activeWin = require('active-win');

// Argumentos do Stream Dock
const args = process.argv.slice(2);
const cliParams = {};
for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('-')) {
        cliParams[args[i].substring(1)] = args[i + 1];
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
let profiles = {};
let iconCache = {};
let processPathCache = {};

function getPathFromProcessName(processName) {
    if (processPathCache[processName]) {
        return processPathCache[processName] === 'NOT_FOUND' ? null : processPathCache[processName];
    }
    try {
        let psScript = `(Get-CimInstance Win32_Process -Filter "Name='${processName}'" | Select-Object -First 1).ExecutablePath`;
        let pathStr = execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (pathStr) {
            processPathCache[processName] = pathStr;
            return pathStr;
        }

        const nameWithoutExt = processName.replace('.exe', '');
        psScript = `(Get-Process -Name '${nameWithoutExt}' -ErrorAction SilentlyContinue | Select-Object -First 1).Path`;
        pathStr = execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (pathStr) {
            processPathCache[processName] = pathStr;
            return pathStr;
        }
        
        if (processName === 'steam.exe' || processName === 'steamwebhelper.exe') {
             pathStr = "C:\\Program Files (x86)\\Steam\\steam.exe";
             if (fs.existsSync(pathStr)) {
                 processPathCache[processName] = pathStr;
                 return pathStr;
             }
        }
    } catch(e) {}
    
    processPathCache[processName] = 'NOT_FOUND';
    return null;
}

function logDebug(msg) {
    try { fs.appendFileSync(path.join(__dirname, 'debug.log'), new Date().toISOString() + ' ' + msg + '\n'); } catch(e){}
}

const PROFILES_PATH = path.join(__dirname, 'profiles.json');
const VOL_CTRL_CMD = path.join(__dirname, 'VolumeControl.exe');

// Carregar perfis e whitelist
function loadData() {
    try {
        if (fs.existsSync(PROFILES_PATH)) {
            const data = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
            if (data.profiles || data.whitelist) {
                profiles = data.profiles || {};
                whitelist = data.whitelist || [];
            } else {
                profiles = data;
                whitelist = [];
            }
        } else {
            fs.writeFileSync(PROFILES_PATH, JSON.stringify({profiles: {}, whitelist: []}));
        }
    } catch(e) {
        console.error("Erro lendo profiles:", e);
    }
}

function saveData() {
    try {
        fs.writeFileSync(PROFILES_PATH, JSON.stringify({profiles, whitelist}, null, 2));
    } catch(e) {
        console.error("Erro salvando profiles:", e);
    }
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
                saveData();
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
    if (iconCache[exePath]) return iconCache[exePath];

    const psScript = `
        Add-Type -AssemblyName System.Drawing
        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon("${exePath}")
        $ms = New-Object System.IO.MemoryStream
        $icon.ToBitmap().Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $bytes = $ms.ToArray()
        [Convert]::ToBase64String($bytes)
    `;
    try {
        const base64 = execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        const fullBase64 = "data:image/png;base64," + base64;
        iconCache[exePath] = fullBase64;
        return fullBase64;
    } catch (e) {
        return null;
    }
}

function sendToSD(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

function updateButton(context, processName, volumeInfo, exePath) {
    if (!context) return;
    
    if (!processName) {
        sendToSD({ event: "setTitle", context: context, payload: { title: "", target: 0 } });
        sendToSD({ event: "setFeedback", context: context, payload: { title: "No App", value: "", indicator: 0, icon: "" } });
        return;
    }

    let image = null;
    let prof = profiles[processName] || profiles[processName.endsWith('.exe') ? processName.replace('.exe', '') : processName + '.exe'];
    
    if (prof && prof.image) {
        image = prof.image;
        if (!image.startsWith("data:")) {
            // Read local file and convert to base64
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

    let knob = activeKnobs[context];
    let imageChanged = false;
    let volume = volumeInfo && typeof volumeInfo === 'object' && volumeInfo.volume !== undefined ? volumeInfo.volume : volumeInfo;
    let muted = volumeInfo && typeof volumeInfo === 'object' && volumeInfo.muted !== undefined ? volumeInfo.muted : false;

    let displayVol = volume >= 0 ? volume.toString() + "%" : "--";

    if (image && muted) {
        let muteIcon = profiles.muteIcon || "";
        if (!muteIcon) {
            displayVol = "--";
        } else {
            let overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="144">
                <image xlink:href="${image}" x="0" y="0" width="144" height="144"/>
                <image xlink:href="${muteIcon}" x="0" y="0" width="144" height="144"/>
            </svg>`;
            image = "data:image/svg+xml;base64," + Buffer.from(overlaySvg).toString('base64');
        }
    }

    if (image) {
        if (!knob || knob.lastImage !== image) {
            imageChanged = true;
            if (knob) knob.lastImage = image;
            sendToSD({
                event: "setImage",
                context: context,
                payload: {
                    image: image,
                    target: 0
                }
            });
        }
    }

    sendToSD({
        event: "setTitle",
        context: context,
        payload: {
            title: displayVol,
            target: 0
        }
    });

    let feedbackPayload = {
        title: processName,
        value: displayVol,
        indicator: volume >= 0 ? volume : 0
    };
    if (imageChanged) {
        feedbackPayload.icon = image;
    }

    sendToSD({
        event: "setFeedback",
        context: context,
        payload: feedbackPayload
    });
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
        try { fs.appendFileSync('c:\\Users\\alazt\\Desktop\\plugin_debug.log', dataStr + '\\n'); } catch(e){}
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
                pendingVolume: null
            };
            if (settings.whitelist && Array.isArray(settings.whitelist)) {
                whitelist = settings.whitelist;
                saveData();
                logDebug("Loaded whitelist from willAppear: " + JSON.stringify(whitelist));
            }
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
        }

        // Eventos via Property Inspector
        if (event === "sendToPlugin") {
            const uiMsg = msg.payload || {};
            if (uiMsg.action === "addToWhitelist") {
                const proc = uiMsg.process.toLowerCase();
                if (!whitelist.includes(proc)) whitelist.push(proc);
                console.log("Adicionado", proc);
                saveData();
                sendToSD({
                    event: "sendToPropertyInspector",
                    context: context,
                    payload: { whitelist: whitelist }
                });
                sendToSD({
                    event: "setSettings",
                    context: context,
                    payload: { whitelist: whitelist }
                });
            } else if (uiMsg.action === "removeFromWhitelist") {
                const proc = uiMsg.process.toLowerCase();
                whitelist = whitelist.filter(p => p !== proc);
                saveData();
                sendToSD({
                    event: "sendToPropertyInspector",
                    context: context,
                    payload: { whitelist: whitelist }
                });
                sendToSD({
                    event: "setSettings",
                    context: context,
                    payload: { whitelist: whitelist }
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

                    sendToSD({
                        event: "sendToPropertyInspector",
                        context: context,
                        payload: { audioProcesses: processList, whitelist: whitelist }
                    });
                } catch(e) {
                    console.error("Erro ao listar processos de audio: ", e);
                }
            } else if (uiMsg.action === "requestGlobalState") {
                sendToSD({
                    event: "sendToPropertyInspector",
                    context: context,
                    payload: { whitelist: whitelist }
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
                            whitelist: whitelist
                        }
                    });
                }
            }
        }

        if (event === "dialRotate") {
            const ticks = msg.payload.ticks || 0;
            const knob = activeKnobs[context];
            if (knob && ticks !== 0 && knob.currentActiveProcess) {
                if (knob.clickMode !== "all" && !whitelist.includes(knob.currentActiveProcess.name)) return;
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

        if (event === "dialUp" || event === "touchTap" || event === "keyUp") {
            const knob = activeKnobs[context];
            if (knob) {
                let action = (event === "dialUp") ? knob.knobAction : knob.screenAction;
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
                            cyclePool = processList.filter(p => whitelist.includes(p));
                            if (cyclePool.length === 0) cyclePool = whitelist;
                        } else {
                            cyclePool = [...processList];
                            const win = activeWin.sync();
                            if (win && win.owner) {
                                const focusedProcessName = (win.owner.path ? path.basename(win.owner.path) : win.owner.name).toLowerCase();
                                if (focusedProcessName.endsWith('.exe') && !cyclePool.includes(focusedProcessName)) {
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
                            
                            sendToSD({ event: "setSettings", context: context, payload: { assignedApp: nextApp, clickMode: knob.clickMode, knobAction: knob.knobAction, screenAction: knob.screenAction, whitelist: whitelist } });
                            sendToSD({ event: "sendToPropertyInspector", context: context, payload: { assignedApp: nextApp } });
                        }
                    } catch(e) {}
                }
            }
        }
    });
}

// Background loop para checar foco da janela
setInterval(async () => {
    if (Object.keys(activeKnobs).length === 0) return;
    try {
        const win = activeWin.sync();
        const focusedProcessName = win && win.owner ? (win.owner.path ? path.basename(win.owner.path) : win.owner.name).toLowerCase() : null;
        const focusedPath = win && win.owner ? win.owner.path : null;
        
        for (const context of Object.keys(activeKnobs)) {
            const knob = activeKnobs[context];
            let targetProcessName = knob.assignedApp;
            let targetPath = null;
            
            if (!targetProcessName) {
                if (focusedProcessName && whitelist.includes(focusedProcessName)) {
                    targetProcessName = focusedProcessName;
                    targetPath = focusedPath;
                } else if (knob.currentActiveProcess && whitelist.includes(knob.currentActiveProcess.name)) {
                    targetProcessName = knob.currentActiveProcess.name;
                    targetPath = knob.currentActiveProcess.path;
                }
            } else {
                if (knob.currentActiveProcess && knob.currentActiveProcess.name === targetProcessName) {
                    targetPath = knob.currentActiveProcess.path;
                }
            }
            
            if (targetProcessName) {
                if (!knob.currentActiveProcess || knob.currentActiveProcess.name !== targetProcessName) {
                    knob.currentActiveProcess = { name: targetProcessName, path: targetPath };
                    let volInfo = getVolume(targetProcessName);
                    knob.currentActiveVolume = volInfo.volume;
                    knob.currentMuted = volInfo.muted;
                    updateButton(context, targetProcessName, volInfo, targetPath);
                }
            } else {
                if (knob.currentActiveProcess) {
                     knob.currentActiveProcess = null;
                     updateButton(context, "", -1, null);
                }
            }
        }
    } catch(e) {}
}, 500);

setInterval(() => {
    logDebug("ALIVE");
}, 5000);

connect();
