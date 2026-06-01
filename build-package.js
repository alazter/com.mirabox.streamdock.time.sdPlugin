const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLUGIN_NAME = 'com.mirabox.streamdock.time.sdPlugin';
const TEMP_DIR = path.join(__dirname, 'temp_build');
const TARGET_DIR = path.join(TEMP_DIR, PLUGIN_NAME);
const ZIP_PATH = path.join(__dirname, `${PLUGIN_NAME}.zip`);

console.log("🚀 Iniciando empacotamento do plugin...");

// 1. Limpar diretórios temporários e ZIP anterior
if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
if (fs.existsSync(ZIP_PATH)) {
    fs.rmSync(ZIP_PATH, { force: true });
}

// Criar estrutura de pastas
fs.mkdirSync(TARGET_DIR, { recursive: true });

// Lista de arquivos/pastas permitidos para distribuição
const ALLOWED_ENTRIES = [
    'manifest.json',
    'server.js',
    'VolumeControl.exe',
    'run.bat',
    'index.html',
    'en.json',
    'es.json',
    'ja.json',
    'zh_CN.json',
    'package.json',
    'package-lock.json',
    'node_modules',
    'propertyInspector',
    'static',
    'images',
    'fonts',
    'assets'
];

console.log("📂 Copiando arquivos necessários...");

for (const entry of ALLOWED_ENTRIES) {
    const srcPath = path.join(__dirname, entry);
    const destPath = path.join(TARGET_DIR, entry);
    
    if (fs.existsSync(srcPath)) {
        fs.cpSync(srcPath, destPath, { 
            recursive: true,
            filter: (src) => {
                const basename = path.basename(src);
                // Filtrar arquivos temporários ou backups dentro de pastas copiadas
                if (basename.endsWith('.log') || basename.endsWith('.bak') || basename.endsWith('.backup')) {
                    return false;
                }
                return true;
            }
        });
    }
}

console.log("🤐 Compactando em arquivo ZIP...");

try {
    // Usar PowerShell Compress-Archive de forma nativa no Windows
    execSync(`powershell -Command "Compress-Archive -Path '${TARGET_DIR}' -DestinationPath '${ZIP_PATH}' -Force"`);
    console.log(`✨ ZIP gerado com sucesso: ${ZIP_PATH}`);
} catch (error) {
    console.error("❌ Erro ao compactar arquivos:", error);
} finally {
    // Limpar pasta temporária
    console.log("🧹 Limpando arquivos temporários...");
    if (fs.existsSync(TEMP_DIR)) {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
}

console.log("🎉 Concluído!");
