const {execSync} = require('child_process'); console.log(execSync('VolumeControl.exe "brave.exe" 60').toString().trim());
