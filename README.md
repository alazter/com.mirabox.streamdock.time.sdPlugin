# Mirabox Stream Dock Time Plugin (Modified)
*Leia em Português abaixo*

This repository contains a modified and enhanced version of the native Time (Clock) plugin for the Mirabox Stream Dock.

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
