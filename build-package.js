const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLUGIN_NAME = 'com.mirabox.streamdock.time.sdPlugin';
const TEMP_DIR = path.join(__dirname, 'temp_build');
const TARGET_DIR = path.join(TEMP_DIR, PLUGIN_NAME);
const ZIP_PATH = path.join(__dirname, `${PLUGIN_NAME}.zip`);
const PACKAGE_PATH = path.join(__dirname, `${PLUGIN_NAME}.SDPlugin`);

console.log("🚀 Iniciando empacotamento do plugin...");

// 1. Limpar diretórios temporários e empacotamento anterior
if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
if (fs.existsSync(ZIP_PATH)) {
    fs.rmSync(ZIP_PATH, { force: true });
}
if (fs.existsSync(PACKAGE_PATH)) {
    fs.rmSync(PACKAGE_PATH, { force: true });
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

console.log("🤐 Compactando em arquivo temporário ZIP...");

try {
    // 1. Compactar como .zip primeiro (exigido pelo PowerShell Compress-Archive)
    execSync(`powershell -Command "Compress-Archive -Path '${TARGET_DIR}' -DestinationPath '${ZIP_PATH}' -Force"`);
    
    // 2. Renomear o .zip para o arquivo final .SDPlugin
    if (fs.existsSync(PACKAGE_PATH)) {
        fs.rmSync(PACKAGE_PATH, { force: true });
    }
    fs.renameSync(ZIP_PATH, PACKAGE_PATH);
    console.log(`✨ Arquivo .SDPlugin gerado com sucesso: ${PACKAGE_PATH}`);
    
    // ---- COPIAR E INSTALAR LOCALMENTE NO STREAM DOCK ----
    console.log("🚚 Verificando diretório de plugins local do Stream Dock...");
    const appData = process.env.APPDATA;
    if (appData) {
        const streamDockPluginsDir = path.join(appData, 'HotSpot', 'StreamDock', 'plugins');
        if (fs.existsSync(streamDockPluginsDir)) {
            const deployDir = path.join(streamDockPluginsDir, PLUGIN_NAME);
            console.log(`Copiando e instalando plugin limpo em: ${deployDir}`);
            
            // Tentar remover instalação antiga e copiar o build limpo
            try {
                if (fs.existsSync(deployDir)) {
                    fs.rmSync(deployDir, { recursive: true, force: true });
                }
                fs.cpSync(TARGET_DIR, deployDir, { recursive: true });
                console.log("✅ Plugin copiado e instalado com sucesso no Stream Dock local!");
            } catch (deployErr) {
                console.log("⚠️ Não foi possível substituir a instalação local do Stream Dock.");
                console.log("   Isso geralmente ocorre porque o software Stream Dock está aberto e bloqueando os arquivos.");
                console.log("   Para atualizar a instalação local, feche o software Stream Dock e execute o comando novamente.");
            }
        } else {
            console.log("ℹ️ Pasta de plugins do Stream Dock não encontrada no AppData (desconsiderado).");
        }
    }
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
