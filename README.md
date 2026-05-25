# Mirabox Stream Dock Time Plugin (Modified)
*Leia em Português abaixo*

This repository contains a modified and enhanced version of the native Time (Clock) plugin for the Mirabox Stream Dock.

## 🚀 Features and Improvements

- **Universal Knob Click Fix**: Solved a hardware/software bug on the **Stream Dock N4 Pro** where knob clicks would fail due to missing `dialUp` release events. The plugin now triggers actions instantly on `dialDown` (press), resulting in 100% reliable click responses and faster response times across all devices (N4 Standard & N4 Pro).
- **Customized Audio Blacklist (New!)**: Added a customized blacklist feature to ignore unwanted background audio processes (like system sounds or notification daemons). Features an interactive UI in the Property Inspector with a `🛑` button that turns to `🚫` on click, and a dedicated **Blacklisted Apps** section where apps can be removed at any time with a single `❌` click.
- **High-Performance Native C# Backend**: Integrated a native C# backend (`VolumeControl.exe` / `VolumeControl.cs`) to replace slow and heavy PowerShell processes for resolving paths and extracting PNG icons directly in Base64. Operation latency has been reduced from ~1.5s to 10-20ms, offering instantaneous feedback.
- **Smart Real-Time Volume & Mute Sync**: An intelligent background loop synchronizes dial displays instantly if application volumes or mute states are altered externally (e.g., via Windows Volume Mixer, Spotify, or media keys). Includes a safety guard to prevent display flickers during active knob rotation.
- **Robust Argument Parsing**: Re-engineered CLI argument reconstruction in `server.js` to safely parse complex, spaced, or quote-stripped JSON parameters (like `-info`) sent by the Stream Dock bootstrap runner.
- **Full N4 Pro Compatibility**: Added event mappings for both standard dials and the newer Mirabox N4 Pro dial/encoder press/rotation events (`dialRotate`, `encoderRotate`, etc.).

## 📦 How to Install and Use

1. Download or clone this repository.
2. Ensure the folder is named `com.mirabox.streamdock.time.sdPlugin`.
3. Copy the folder to your Stream Dock plugins directory.
4. Restart the Stream Dock application. The enhanced plugin will appear in the list of available plugins.

## 📄 License
This project is licensed under the GNU GPLv3 License - see the [LICENSE](LICENSE) file for details.

---
*Note: This is an independently modified project.*

---

# Mirabox Stream Dock Time Plugin (Modificado)

Este repositório contém uma versão modificada e aprimorada do plugin nativo de Tempo (Relógio) para o Mirabox Stream Dock.

## 🚀 Novidades e Melhorias

- **Correção Universal de Clique do Knob**: Corrigido um bug de hardware/software no **Stream Dock N4 Pro** onde os cliques no botão giratório falhavam devido à ausência do sinal de liberação (`dialUp`). O plugin agora responde instantaneamente no evento `dialDown` (pressionamento), garantindo 100% de confiabilidade e maior responsividade nos cliques para todos os aparelhos (N4 Padrão e N4 Pro).
- **Blacklist de Áudio Personalizada (Novo!)**: Adicionado recurso de lista negra (blacklist) para ignorar e ocultar processos de áudio indesejados de segundo plano (como sons do sistema, notificações ou navegadores secundários). Conta com uma interface rica e interativa no Property Inspector com o botão `🛑` que muda para `🚫` ao ser adicionado, e uma nova seção dedicada **Blacklisted Apps** para gerenciar e remover itens facilmente com um clique no `❌`.
- **Backend Nativo de Alta Performance em C#**: Integração do utilitário nativo em C# (`VolumeControl.exe` / `VolumeControl.cs`) para substituir chamadas pesadas do PowerShell. A descoberta de caminhos de processos e extração direta de ícones em Base64 PNG agora leva apenas ~10ms (em vez de ~1.5s).
- **Sincronização Inteligente em Tempo Real**: Loop inteligente em segundo plano atualiza automaticamente a tela do botão se o volume ou o estado de mudo do aplicativo for alterado externamente (teclado, Mixer do Windows, Spotify, etc.). Inclui um sistema de proteção contra oscilações (flickers) enquanto você gira o botão físico.
- **Análise de Argumentos Robusta**: Nova análise de linha de comando no `server.js` que reconstrói e agrupa argumentos JSON (como o `-info`) que contenham espaços ou tenham aspas removidas pelo executor do Stream Dock.
- **Compatibilidade Completa com N4 Pro**: Mapeamento completo e suporte aos novos eventos de giro e clique dos encoders do Mirabox N4 Pro (`dialRotate`, `encoderRotate`, etc.).

## 📦 Como Instalar e Usar

1. Faça o download ou clone este repositório.
2. Certifique-se de que a pasta se chama `com.mirabox.streamdock.time.sdPlugin`.
3. Copie a pasta para o diretório de plugins do seu Stream Dock.
4. Reinicie o aplicativo do Stream Dock. O plugin aprimorado aparecerá na lista de plugins disponíveis.

## 📄 Licença
Este projeto está licenciado sob a Licença GNU GPLv3 - consulte o arquivo [LICENSE](LICENSE) para obter detalhes.

---
*Nota: Este é um projeto modificado de forma independente.*
