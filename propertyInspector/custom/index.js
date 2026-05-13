const $local = false, $back = false
const $dom = {
  main: document.querySelector('.sdpi-wrapper'),
  input: document.querySelector("#app-input"),
  addBtn: document.querySelector("#add-app"),
  clearBtn: document.querySelector("#clear-list"),
}, $propEvent = {
  didReceiveSettings(data) {
    console.log("✅ Settings received!", data.settings);
    $settings = data.settings;
    if ($settings.volumeStep) {
        const stepInput = document.getElementById("volume-step");
        if (stepInput) stepInput.value = $settings.volumeStep;
    }
    renderWhitelist();
    renderKnobConfig();
    if ($websocket && $websocket.sendToPlugin) {
        $websocket.sendToPlugin({ action: "requestGlobalState" });
        $websocket.sendToPlugin({ action: "getAudioProcesses" });
    }
  },
  sendToPropertyInspector(data) {
    console.log("🔁 Mensaje del plugin:", data);
    onPluginMessage(data);
  }
};

function renderWhitelist() {
    const container = document.getElementById("whitelist-container");
    if (!container) return;
    container.innerHTML = "";

    const list = $settings && Array.isArray($settings.whitelist) ? $settings.whitelist : [];
    if (list.length === 0) return;

    list.forEach(app => {
        const wrapper = document.createElement("div");
        wrapper.className = "sdpi-item";
        
        const span = document.createElement("span");
        span.textContent = app;
        wrapper.appendChild(span);
        
        const actionsDiv = document.createElement("div");
        
        const iconInput = document.createElement("input");
        iconInput.type = "file";
        iconInput.accept = ".png, .jpg, .jpeg, .bmp, .gif";
        iconInput.style.display = "none";
        iconInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                if ($websocket && $websocket.sendToPlugin) {
                    $websocket.sendToPlugin({ action: "setAppIcon", process: app, image: base64 });
                }
                btnIcon.textContent = "✅";
                setTimeout(() => { btnIcon.textContent = "🖼️"; }, 2000);
            };
            reader.readAsDataURL(file);
        };
        
        const btnIcon = document.createElement("button");
        btnIcon.textContent = "🖼️";
        btnIcon.title = "Add custom icon";
        btnIcon.style.marginLeft = "10px";
        btnIcon.style.cursor = "pointer";
        btnIcon.onclick = () => iconInput.click();
        
        const btnClearIcon = document.createElement("button");
        btnClearIcon.textContent = "✖️";
        btnClearIcon.title = "Remove custom icon";
        btnClearIcon.style.marginLeft = "5px";
        btnClearIcon.style.cursor = "pointer";
        btnClearIcon.style.color = "red";
        btnClearIcon.onclick = () => {
            if ($websocket && $websocket.sendToPlugin) {
                $websocket.sendToPlugin({ action: "setAppIcon", process: app, image: "" });
            }
            btnIcon.textContent = "🖼️";
        };
        
        const btn = document.createElement("button");
        btn.textContent = "❌";
        btn.style.marginLeft = "10px";
        btn.style.cursor = "pointer";
        btn.onclick = () => {
            if ($settings && Array.isArray($settings.whitelist)) {
                $settings.whitelist = $settings.whitelist.filter(p => p !== app);
            }
            if ($websocket && $websocket.sendToPlugin) {
                $websocket.sendToPlugin({ action: "removeFromWhitelist", process: app });
            }
            renderWhitelist();
        };
        
        actionsDiv.appendChild(iconInput);
        actionsDiv.appendChild(btnIcon);
        actionsDiv.appendChild(btnClearIcon);
        actionsDiv.appendChild(btn);
        
        wrapper.appendChild(actionsDiv);
        container.appendChild(wrapper);
    });
}

const appInputFile = document.getElementById("app-input-file");
$dom.addBtn?.addEventListener("click", () => {
    if (appInputFile) appInputFile.click();
});

appInputFile?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    let appName = decodeURIComponent(file.name).split('\\').pop().split('/').pop().trim().toLowerCase();
    
    $websocket.sendToPlugin({
        action: "addToWhitelist",
        process: appName
    });

    if (typeof $settings === 'undefined' || !$settings) {
        window.$settings = { whitelist: [] };
    }
    if (!Array.isArray($settings.whitelist)) {
        $settings.whitelist = [];
    }
    if (!$settings.whitelist.includes(appName)) {
        $settings.whitelist.push(appName);
    }
    
    if ($websocket.saveData) {
        $websocket.saveData($settings);
    } else if (typeof setSettings === 'function') {
        try { setSettings($settings); } catch(err){}
    }

    renderWhitelist();
    renderKnobConfig();
    
    e.target.value = "";
});

document.getElementById("refresh-audio")?.addEventListener("click", () => {
  $websocket.sendToPlugin({ action: "getAudioProcesses" });
});

function onPluginMessage(message) {
    if (message.whitelist) {
        if (typeof $settings === 'undefined' || !$settings) {
            window.$settings = { whitelist: message.whitelist };
        } else {
            $settings.whitelist = message.whitelist;
        }
        renderWhitelist();
    }

    if (message.audioProcesses) {
        renderAudioProcesses(message.audioProcesses);
    }
}

document.getElementById("volume-step")?.addEventListener("change", (e) => {
    const val = parseInt(e.target.value, 10);
    if (val > 0 && val <= 100) {
        if (typeof $settings === 'undefined' || !$settings) window.$settings = {};
        $settings.volumeStep = val;
        if ($websocket.saveData) $websocket.saveData($settings);
        else if (typeof setSettings === 'function') { try { setSettings($settings); } catch(err){} }
        
        $websocket.sendToPlugin({
            action: "setVolumeStep",
            step: val
        });
    }
});

function renderKnobConfig() {
    const knobModeContainer = document.getElementById("controlling-app-container");
    const knobMode = document.getElementById("knob-mode");
    
    const clickMode = $settings?.clickMode || "whitelist";
    // Sempre mostrar o dropdown para feedback visual, desabilitando a interação no modo dinâmico
    if (knobMode) knobMode.disabled = (clickMode === "all");

    if (!knobMode) return;
    
    knobMode.innerHTML = "";
    
    if ($settings?.whitelist && $settings.whitelist.length > 0) {
        $settings.whitelist.forEach(app => {
            const opt = document.createElement("option");
            opt.value = app;
            opt.textContent = app;
            knobMode.appendChild(opt);
        });
        
        // Permitir que apps temporários dinâmicos apareçam no dropdown
        if ($settings.assignedApp && !$settings.whitelist.includes($settings.assignedApp)) {
            const opt = document.createElement("option");
            opt.value = $settings.assignedApp;
            opt.textContent = `🔄 ${$settings.assignedApp}`;
            knobMode.appendChild(opt);
        }
        knobMode.value = $settings.assignedApp;
    }
    
    const radio = document.querySelector(`input[name="clickMode"][value="${clickMode}"]`);
    if (radio) radio.checked = true;

    const knobAction = $settings?.knobAction || "cycle";
    const knobRadio = document.querySelector(`input[name="knobAction"][value="${knobAction}"]`);
    if (knobRadio) knobRadio.checked = true;

    const screenAction = $settings?.screenAction || "cycle";
    const screenRadio = document.querySelector(`input[name="screenAction"][value="${screenAction}"]`);
    if (screenRadio) screenRadio.checked = true;
}

document.getElementById("knob-mode")?.addEventListener("change", (e) => {
    if (typeof $settings === 'undefined' || !$settings) window.$settings = {};
    $settings.assignedApp = e.target.value;
    if ($websocket.saveData) $websocket.saveData($settings);
    else if (typeof setSettings === 'function') { try { setSettings($settings); } catch(err){} }
    
    $websocket.sendToPlugin({ action: "setKnobConfig", assignedApp: $settings.assignedApp, clickMode: $settings.clickMode || "whitelist", knobAction: $settings.knobAction || "cycle", screenAction: $settings.screenAction || "cycle" });
});

document.querySelectorAll('input[name="clickMode"]').forEach(radio => {
    radio.addEventListener("click", (e) => {
        setTimeout(() => {
            if (typeof $settings === 'undefined' || !$settings) window.$settings = {};
            $settings.clickMode = e.target.value;
            if ($websocket.saveData) $websocket.saveData($settings);
            else if (typeof setSettings === 'function') { try { setSettings($settings); } catch(err){} }
            
            $websocket.sendToPlugin({ action: "setKnobConfig", assignedApp: $settings.assignedApp || "", clickMode: $settings.clickMode, knobAction: $settings.knobAction || "cycle", screenAction: $settings.screenAction || "cycle" });
            renderKnobConfig();
        }, 50);
    });
});

document.querySelectorAll('input[name="knobAction"]').forEach(radio => {
    radio.addEventListener("click", (e) => {
        setTimeout(() => {
            if (typeof $settings === 'undefined' || !$settings) window.$settings = {};
            $settings.knobAction = e.target.value;
            if ($websocket.saveData) $websocket.saveData($settings);
            else if (typeof setSettings === 'function') { try { setSettings($settings); } catch(err){} }
            
            $websocket.sendToPlugin({ action: "setKnobConfig", assignedApp: $settings.assignedApp || "", clickMode: $settings.clickMode || "whitelist", knobAction: $settings.knobAction, screenAction: $settings.screenAction || "cycle" });
        }, 50);
    });
});

document.querySelectorAll('input[name="screenAction"]').forEach(radio => {
    radio.addEventListener("click", (e) => {
        setTimeout(() => {
            if (typeof $settings === 'undefined' || !$settings) window.$settings = {};
            $settings.screenAction = e.target.value;
            if ($websocket.saveData) $websocket.saveData($settings);
            else if (typeof setSettings === 'function') { try { setSettings($settings); } catch(err){} }
            
            $websocket.sendToPlugin({ action: "setKnobConfig", assignedApp: $settings.assignedApp || "", clickMode: $settings.clickMode || "whitelist", knobAction: $settings.knobAction || "cycle", screenAction: $settings.screenAction });
        }, 50);
    });
});

document.getElementById("set-mute-icon")?.addEventListener("click", () => {
    document.getElementById("mute-icon-input")?.click();
});

document.getElementById("mute-icon-input")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result;
        if ($websocket && $websocket.sendToPlugin) {
            $websocket.sendToPlugin({ action: "setMuteIcon", image: base64 });
        }
        document.getElementById("set-mute-icon").textContent = "✅ Saved";
        setTimeout(() => { document.getElementById("set-mute-icon").textContent = "Choose Custom Icon"; }, 2000);
    };
    reader.readAsDataURL(file);
});

document.getElementById("clear-mute-icon")?.addEventListener("click", () => {
    if ($websocket && $websocket.sendToPlugin) {
        $websocket.sendToPlugin({ action: "setMuteIcon", image: "" });
    }
    const btn = document.getElementById("set-mute-icon");
    if(btn) btn.textContent = "Choose Custom Icon";
});

function renderAudioProcesses(processes) {
  const list = document.getElementById("audio-process-list");
  list.innerHTML = "";

  processes.sort().forEach(proc => {
    const div = document.createElement("div");
    div.className = "sdpi-item";
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.alignItems = "center";

    const nameSpan = document.createElement("span");
    const isInWhitelist = $settings?.whitelist?.some(p => p === proc || p + '.exe' === proc || p === proc + '.exe');

    nameSpan.textContent = isInWhitelist ? `✅ ${proc}` : proc;
    div.appendChild(nameSpan);

    const actionsDiv = document.createElement("div");

    const iconInput = document.createElement("input");
    iconInput.type = "file";
    iconInput.accept = ".png, .jpg, .jpeg, .bmp, .gif";
    iconInput.style.display = "none";
    iconInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            if ($websocket && $websocket.sendToPlugin) {
                $websocket.sendToPlugin({ action: "setAppIcon", process: proc, image: base64 });
            }
            btnIcon.textContent = "✅";
            setTimeout(() => { btnIcon.textContent = "🖼️"; }, 2000);
        };
        reader.readAsDataURL(file);
    };

    const btnIcon = document.createElement("button");
    btnIcon.textContent = "🖼️";
    btnIcon.title = "Add custom icon";
    btnIcon.style.marginLeft = "10px";
    btnIcon.style.cursor = "pointer";
    btnIcon.onclick = () => iconInput.click();

    const btnClearIcon = document.createElement("button");
    btnClearIcon.textContent = "✖️";
    btnClearIcon.title = "Remove custom icon";
    btnClearIcon.style.marginLeft = "5px";
    btnClearIcon.style.cursor = "pointer";
    btnClearIcon.style.color = "red";
    btnClearIcon.onclick = () => {
        if ($websocket && $websocket.sendToPlugin) {
            $websocket.sendToPlugin({ action: "setAppIcon", process: proc, image: "" });
        }
        btnIcon.textContent = "🖼️";
    };

    actionsDiv.appendChild(iconInput);
    actionsDiv.appendChild(btnIcon);
    actionsDiv.appendChild(btnClearIcon);

    if (!isInWhitelist) {
      const btn = document.createElement("button");
      btn.textContent = "➕";
      btn.title = "Agregar a whitelist";
      btn.style.marginLeft = "10px";
      btn.style.cursor = "pointer";
      btn.onclick = () => {
        $websocket.sendToPlugin({
          action: "addToWhitelist",
          process: proc
        });
        // Actualizar localmente también
        if (typeof $settings === 'undefined' || !$settings) {
            window.$settings = { whitelist: [] };
        }
        if (!Array.isArray($settings.whitelist)) {
            $settings.whitelist = [];
        }
        if (!$settings.whitelist.includes(proc)) {
            $settings.whitelist.push(proc);
        }
        
        if ($websocket.saveData) {
            $websocket.saveData($settings);
        } else if (typeof setSettings === 'function') {
            try { setSettings($settings); } catch(e){}
        }

        renderWhitelist();
        renderAudioProcesses(processes);
      };

      actionsDiv.appendChild(btn);
    }

    div.appendChild(actionsDiv);
    list.appendChild(div);
  });
}
