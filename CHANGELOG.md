# Changelog

All notable changes to this project will be documented in this file.

---

## [v0.1.0] - 2026-07-04

### Added / Adicionado
- **[English]** **Standalone Namespace Transition:** Decoupled the plugin identifier from the official Mirabox Clock plugin (`com.mirabox.streamdock.time.sdPlugin`) to our independent namespace `com.alazter.mirabox.volume.sdPlugin` to prevent Stream Dock app updates from overwriting custom configurations.
- **[Português]** **Transição para Namespace Standalone:** Desconexão total do identificador de plugin oficial da Mirabox (`com.mirabox.streamdock.time.sdPlugin`) para o namespace exclusivo `com.alazter.mirabox.volume.sdPlugin`, protegendo o plugin personalizado contra substituições automáticas durante atualizações do software Stream Dock.
- **[English]** **Automatic Configuration Migration:** Integrated a migration check that automatically copies previous user configurations (whitelist, blacklist, and custom icons) from the old AppData folder to the new standalone storage path on startup.
- **[Português]** **Migração Automática de Configuração:** Adicionado mecanismo de importação transparente que copia as whitelists, blacklists e ícones customizados do diretório antigo do AppData para o novo armazenamento independente na primeira inicialização.
- **[English]** **Clean Translations:** Overhauled `es.json` and `ja.json` files to remove obsolete clock/timer entries and add clean Japanese/Spanish translations for the standalone Volume Controller.
- **[Português]** **Localizações Limpas:** Reestruturação completa das traduções nos arquivos `es.json` e `ja.json` para expurgar referências antigas do relógio original e fornecer localizações corretas para o volume de aplicativos em espanhol e japonês.

---

## [v1.1.1] - 2026-06-04

### Fixed / Corrigido
- **[English]** **Custom Icon Resize:** Resized custom application and mute overlay icons to a native 144x144 pixels resolution at the Property Inspector source to prevent massive Base64 payloads from crashing the Stream Dock WebSocket buffer and terminating the plugin backend.
- **[Português]** **Redimensionamento de Ícones Customizados:** Redimensionamento automático de ícones de aplicativos e de mute para a resolução nativa de 144x144 pixels diretamente no Property Inspector, evitando payloads imensos em Base64 que causavam travamento no buffer do WebSocket e derrubavam o backend do plugin.

---

## [v1.1.0] - 2026-06-01

### Added / Adicionado
- **[English]** **AppData Persistence:** Migrated `profiles.json` and custom Base64 app icons to the global `%APPDATA%` directory to shield them from Git rollbacks, cleans, and Stream Dock plugin updates.
- **[Português]** **Persistência no AppData:** Migração do `profiles.json` e ícones em Base64 para a pasta global `%APPDATA%`, protegendo as configurações do usuário contra limpezas do Git, rollbacks ou atualizações de software do Stream Dock.
- **[English]** **Auto-Migration:** Implemented seamless auto-migration of old local profiles to `%APPDATA%` upon plugin startup.
- **[Português]** **Migração Automática:** Importação automatizada das preferências locais anteriores na primeira execução após a atualização.
- **[English]** **Custom Process Blacklist:** Added an interactive blacklist feature to exclude specific background processes from being controlled or displayed on the dials.
- **[Português]** **Blacklist de Aplicativos:** Adição de filtro interativo no painel de configurações para banir aplicativos específicos de segundo plano do visor e rotação física.
- **[English]** **Auto-Shutdown Logic:** Added a listener to gracefully shut down the Node.js process (`process.exit(0)`) whenever the Mirabox Stream Dock application or WebSocket connection is closed.
- **[Português]** **Encerramento Automático:** Fechamento automático e limpo do processo do Node.js ao detectar a desconexão ou fechamento do software Mirabox Stream Dock (eliminando processos órfãos).

### Optimized / Otimizado
- **[English]** **Subprocess Debouncing (CPU Saver):** Segmented background window polling (500ms) from passive volume checks (2000ms), reducing C# subprocess spawns by **75%** while keeping knobs responsive.
- **[Português]** **Sincronização Inteligente (Economia de CPU):** Divisão do loop de janelas (500ms) e checagem de volume (2000ms), reduzindo as inicializações de subprocessos C# em **75%** e diminuindo a CPU residual a quase zero.
- **[English]** **Non-blocking Disk I/O:** Switched profile saving from blocking synchronous `writeFileSync` to non-blocking asynchronous `fs.writeFile` to avoid UI micro-stutters during rotation.
- **[Português]** **I/O Não-Bloqueante (Disco):** Substituição do método síncrono `writeFileSync` pelo método assíncrono `fs.writeFile` para eliminar qualquer latência durante a rotação física dos knobs.
- **[English]** **Logging Clean-up:** Disabled disk logging (`debug.log` and user Desktop logs) entirely to optimize system I/O resources and disk space.
- **[Português]** **Remoção de Gravação de Logs:** Desativação completa da escrita de logs locais e na Área de Trabalho para economizar escritas em disco e otimizar velocidade.

### Fixed / Corrigido
- **[English]** **N4 Pro Dial Click:** Resolved the missing click feedback on Stream Dock N4 Pro devices (which fail to send consistent `dialUp` events) by triggering on `dialDown` events.
- **[Português]** **Clique do Knob no N4 Pro:** Resolução do bug de clique no visor físico nos modelos N4 Pro (que não enviam o evento `dialUp` de forma consistente) alterando o gatilho para o evento `dialDown`.
- **[English]** **CLI Argument Parsing:** Fixed crashes caused by JSON parameters (like `-info`) containing spaces being split by the Windows batch runner.
- **[Português]** **Parse de Parâmetros CLI:** Correção de falhas de inicialização do WebSocket devido a espaços ou aspas ausentes nos argumentos CLI analisados na inicialização do servidor.

---

## [v1.0.0] - 2026-05-12

### Added / Adicionado
- **[English]** Initial release of the modified and enhanced Time and Volume plugin.
- **[Português]** Lançamento inicial da versão modificada e aprimorada do plugin de Tempo e Volume.
