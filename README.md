# Central de Chamados TI — UPA Pediátrica

Sistema autônomo e ultraleve para gestão de atendimentos de TI, controle de insumos e monitor de rede da UPA Pediátrica.

## O que ele resolve
1. **Atendimento sem burocracia**: Qualquer profissional abre chamado em 15 segundos da sua máquina, sem login e sem e-mail corporativo.
2. **Fim das interrupções fora de escopo**: Encaminha automaticamente chamados de senha do CELK (para o suporte da CELK), do EPA (para o RH) e da digitalizadora/impressora do Raio-X (para o Supervisor Administrativo).
3. **Controle de insumos auditado**: Só libera pedidos de pulseiras para a Recepção e etiquetas para os setores autorizados. Gera capas impressas de papel A5 em formato livreto para inibir uso indevido pelos médicos.
4. **Painel da TI na tela e no celular**: Acesso protegido por PIN, controle de status em 1 clique, histórico de soluções e gráficos automáticos.
5. **Relatório formal para a Diretoria**: Botão de impressão com cabeçalho oficial, métricas, lista de chamados e campos de assinatura técnica e administrativa.
6. **Monitor de rede em tempo real**: Pings silenciosos em todas as máquinas da UPA, com destaque especial no servidor XAMPP da Triagem 1 (senhas).
7. **Alerta de queda de internet no 4G**: Monitoramento "heartbeat" via healthchecks.io que notifica o seu celular caso os dois links da unidade caiam.
8. **Funcionamento 100% offline**: Se a internet cair, a rede interna continua recebendo e gravando todos os chamados normalmente.

---

## Estrutura da pasta

```
central-ti-upa/
├── server.js                     # Servidor Node.js puro (sem npm install, sem dependências)
├── config.json                   # Configuração da UPA, horários, PIN e integrações
├── maquinas.csv                  # Inventário de máquinas e IPs para o monitor de rede
├── insumos.csv                   # Regras de liberação de insumos por setor
├── iniciar-central.bat           # Inicia o servidor com 2 cliques no Windows da TI
├── instalar-atalho-pendrive.bat  # Cria o atalho na Área de Trabalho Pública de qualquer máquina
├── dados/                        # Dados gerados automaticamente (JSONs e backups)
└── public/                       # Telas web (HTML, CSS e JS locais, sem internet)
    ├── index.html / index.js     # Tela "Chamar TI" para os funcionários
    ├── painel.html / painel.js   # Painel da TI e Auditoria (protegido por PIN)
    ├── capas.html / capas.js     # Gerador de capas de papel A5 (livreto)
    └── estilo.css                # Estilo compartilhado
```

---

## Como colocar para rodar no computador da TI (ADM 3)

1. Tenha o **Node.js** instalado (versão 18 ou superior, baixada em https://nodejs.org/).
2. Copie a pasta `central-ti-upa` para o computador da TI (ex.: `C:\TI\central-ti-upa`).
3. Dê dois cliques em **`iniciar-central.bat`**.
4. A janela preta vai abrir e mostrar o IP da máquina e a porta (ex.: `http://192.168.1.50:8080`).
5. No navegador desse mesmo computador, abra `http://localhost:8080/painel` para ver o Painel da TI.
   - O PIN inicial fica gravado no campo `pinTI` do arquivo `config.json`. Você pode trocá-lo pelo número que quiser.

---

## Como instalar o atalho nos outros computadores da UPA

1. Abra o arquivo `instalar-atalho-pendrive.bat` no Bloco de Notas.
2. Troque `IP_DO_COMPUTADOR_DA_TI` pelo IP fixo da máquina da TI (ex.: `192.168.1.50`). Salve.
3. Coloque esse arquivo num pendrive.
4. Em cada computador da UPA, plugue o pendrive, clique com o **botão direito** no arquivo e escolha **"Executar como administrador"**.
5. O atalho **"Chamar TI"** será criado na pasta `C:\Users\Public\Desktop` e ficará visível na Área de Trabalho de **todos** os usuários que logarem naquela máquina.

---

## Como ativar os avisos de novos chamados no celular (Telegram)

1. No seu celular, abra o Telegram e procure por `@BotFather`.
2. Mande a mensagem `/newbot`, escolha um nome (ex.: `TI UPA Pediátrica`) e um usuário (ex.: `ti_upapediatrica_bot`).
3. O BotFather vai te devolver um **token** comprido. Copie e cole dentro do `config.json`, no campo `telegram.token`.
4. Abra uma conversa com o seu novo bot no Telegram e envie `/start`.
5. Abra o navegador da TI em `http://localhost:8080` (o servidor já vai identificar seu chatId automaticamente) ou use o bot `@userinfobot` para ver seu ID numérico.
6. Cole o seu número no campo `telegram.chatId` do `config.json`.
7. Feche e abra o `iniciar-central.bat`. A partir daí, cada chamado novo apita no seu Telegram com botões **▶️ Atender** e **✅ Concluir**!

---

## Como ativar o alerta de queda dos 2 links de internet no celular

1. No celular ou computador, acesse https://healthchecks.io (gratuito) e crie uma conta.
2. Clique em **Add Check**.
3. Dê o nome de `Internet UPA Pediátrica`, configure o período para **3 minutos** e o tempo de tolerância para **2 minutos**.
4. Conecte o canal de aviso ao seu Telegram ou e-mail.
5. Ele vai te dar uma URL única (ex.: `https://hc-ping.com/seu-codigo-aqui`).
6. Cole essa URL no campo `healthcheckUrl` do `config.json`.
7. **Como funciona**: Enquanto houver internet na UPA, o servidor envia um "estou vivo" a cada minuto para essa URL. Se os dois links caírem e o sinal parar de chegar por mais de 5 minutos, o próprio healthchecks.io envia um alerta direto no seu Telegram: *"Internet UPA Pediátrica is DOWN"*.
