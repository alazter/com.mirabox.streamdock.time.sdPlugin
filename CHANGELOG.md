# Changelog

All notable changes to this project will be documented in this file.

---

## [v0.2.0] - 2026-07-05

### Added / Adicionado
- **[English]** **Dedicated Games Whitelist:** Introduced a dedicated Games Whitelist alongside the Software Whitelist, allowing users to separate work/media apps (Discord, Spotify, Chrome) from games (League of Legends, CS:GO, GTA).
- **[Português]** **Whitelist Dedicada de Jogos:** Criada uma Whitelist exclusiva para Jogos ao lado da Whitelist de Softwares, permitindo separar o controle de volume de aplicativos de trabalho/mídia (Discord, Spotify, Chrome) dos seus jogos (League of Legends, CS:GO, GTA).
- **[English]** **App Pool Selection:** Added "Games Whitelist" as a selectable option in the Knob's App Pool radio group, giving complete control over which application list each knob rotates or tracks.
- **[Português]** **Seleção de App Pool:** Adicionada a opção "Games Whitelist" no grupo de seleção do App Pool do Knob, permitindo escolher se o botão alterna apenas entre softwares, apenas entre jogos ou por todos os apps.
- **[English]** **Quick Add Buttons:** Enhanced the Detected Audio Processes section with `💻` (Add to Software Whitelist) and `🎮` (Add to Games Whitelist) action buttons.
- **[Português]** **Botões Rápidos de Cadastro:** Atualizada a seção de Processos Detectados com botões diretos para enviar aplicativos para a Whitelist de Software (`💻`) ou para a Whitelist de Jogos (`🎮`).

---

## [v0.1.1] - 2026-07-05

### Fixed / Corrigido
- **[English]** **Icon Cache Failure Loop Fix:** Cached failed icon extractions (`null`) to eliminate continuous synchronous `execSync` process spawning loops every 500ms for apps without extractable icons.
- **[Português]** **Eliminação de Loop no Cache de Ícones:** Adicionado cache de falha (`null`) para evitar que a extração de ícones tente re-executar o `VolumeControl.exe` de forma síncrona a cada 500ms em aplicativos sem ícone.
- **[English]** **Qt Base64 SVG Crash Fix:** Removed nested Base64 SVG image generation on muted state to prevent Qt image rendering crashes in recent Stream Dock updates.
- **[Português]** **Correção de Crash no Renderizador Qt:** Remoção da geração de SVGs com Base64 aninhado para estados mudos, evitando congelamentos do motor de renderização da Qt nas atualizações recentes do Stream Dock.
- **[English]** **WebSocket Event Deduplication:** Throttled and deduplicated `setTitle`, `setImage`, and `setFeedback` WebSocket events, sending updates only when values actually change.
- **[Português]** **Deduplicação de Mensagens WebSocket:** Filtragem e controle de frequência dos eventos `setTitle`, `setImage` e `setFeedback`, reduzindo o tráfego WebSocket e a carga na UI do Stream Dock.
- **[English]** **Focus Tracking Loop Optimization:** Optimized the background active window polling loop (`activeWin`) to execute only when automatic focus tracking is required, spaced at 1000ms intervals.
- **[Português]** **Otimização de Checagem de Foco:** O loop de verificação de janela ativa (`activeWin`) agora é executado apenas quando necessário (knobs em modo automático) e espaçado para 1000ms.

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
