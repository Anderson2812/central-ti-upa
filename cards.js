'use strict';
// Renderiza os 20 cards em alta resolução (1080x1080) usando Canvas HTML5 nativo, sem bibliotecas.

const CARDS = [
  // Bloco 1: Educadas & Dia a Dia
  {
    id: 1,
    categoria: 'Geral',
    badgeClass: 'b-geral',
    titulo: 'SUPORTE DE TI — UPA PEDIÁTRICA',
    chamada: 'Agilidade e organização no atendimento.',
    mensagem: 'Para que seu pedido seja atendido com rapidez e não se perca na correria do plantão, abra pelo ícone 🆘 Chamar TI na Área de Trabalho do seu computador!',
    rodape: 'Seu chamado entra direto na fila prioritária • Equipe de TI',
    corFundo: '#0f172a',
    corDestaque: '#0284c7'
  },
  {
    id: 2,
    categoria: 'Geral',
    badgeClass: 'b-geral',
    titulo: 'TI EM ATENDIMENTO NO MOMENTO',
    chamada: 'Estamos em atendimento assistencial em outro setor.',
    mensagem: 'Por favor, registre sua solicitação pelo atalho 🆘 Chamar TI na tela do seu computador. Assim que liberarmos a sala atual, seu caso é o próximo!',
    rodape: 'Fila de atendimento por ordem de chamado • UPA Pediátrica',
    corFundo: '#0f172a',
    corDestaque: '#0ea5e9'
  },
  {
    id: 3,
    categoria: 'Geral',
    badgeClass: 'b-geral',
    titulo: 'FILA DE SUPORTE PADRONIZADA',
    chamada: 'Garantindo o atendimento justo para toda a unidade.',
    mensagem: 'Para que ninguém fique esperando ou tenha o pedido esquecido no WhatsApp, todas as demandas agora passam pelo ícone oficial Chamar TI na tela do PC.',
    rodape: 'Obrigado pela colaboração e parceria! • TI UPA',
    corFundo: '#0f172a',
    corDestaque: '#38bdf8'
  },

  // Bloco 2: Médicos & Consultórios
  {
    id: 4,
    categoria: 'Médicos',
    badgeClass: 'b-medico',
    titulo: 'SUPORTE TÉCNICO AOS CONSULTÓRIOS',
    chamada: 'Prioridade e rastreabilidade no atendimento médico.',
    mensagem: 'Prezado(a) Dr(a)., para garantir a prioridade imediata do seu consultório e agilidade na prescrição, registre pelo ícone 🆘 Chamar TI na área de trabalho da máquina.',
    rodape: 'Atendimento prioritário às salas de consulta • TI UPA',
    corFundo: '#042f2e',
    corDestaque: '#0d9488'
  },
  {
    id: 5,
    categoria: 'Médicos',
    badgeClass: 'b-medico',
    titulo: 'PADRÃO DE QUALIDADE HOSPITALAR',
    chamada: 'Redução do tempo de espera nos consultórios.',
    mensagem: 'Estamos padronizando as solicitações de impressoras e computadores pelo sistema de chamados da tela para diminuir o tempo de resposta médica.',
    rodape: 'Compromisso com o atendimento ao paciente • TI UPA Pediátrica',
    corFundo: '#042f2e',
    corDestaque: '#14b8a6'
  },
  {
    id: 6,
    categoria: 'Coordenação',
    badgeClass: 'b-medico',
    titulo: 'COMUNICADO INSTITUCIONAL DE TI',
    chamada: 'Auditoria e histórico formal de demandas.',
    mensagem: 'Para fins de conformidade, histórico técnico e auditoria interna da UPA, todas as solicitações devem ser registradas pelo atalho Chamar TI disponível nas estações.',
    rodape: 'Gestão técnica e governança de TI • UPA Pediátrica',
    corFundo: '#0f172a',
    corDestaque: '#0284c7'
  },

  // Bloco 3: Fora de Horário & Plantão Noturno
  {
    id: 7,
    categoria: 'Noite',
    badgeClass: 'b-noite',
    titulo: 'TI UPA — PLANTÃO NOTURNO',
    chamada: 'Atendimento presencial comercial encerrado.',
    mensagem: 'Nosso expediente encerrou por hoje. Deixe seu chamado registrado pelo ícone 🆘 Chamar TI na tela do computador para ser atendido logo cedo no próximo plantão!',
    rodape: 'Em caso de parada assistencial crítica, consulte a supervisão.',
    corFundo: '#1e1b4b',
    corDestaque: '#6366f1'
  },
  {
    id: 8,
    categoria: 'Fim de Semana',
    badgeClass: 'b-noite',
    titulo: 'SUPORTE DE TI — FINAIS DE SEMANA',
    chamada: 'Horário de atendimento comercial da TI.',
    mensagem: 'A equipe de TI atende de segunda a sexta, das 08h às 17h. Registre sua solicitação pelo atalho na tela do PC para atendimento na abertura do expediente.',
    rodape: 'Chamados gravados e priorizados para segunda-feira cedo.',
    corFundo: '#1e1b4b',
    corDestaque: '#818cf8'
  },
  {
    id: 9,
    categoria: 'Manhã',
    badgeClass: 'b-noite',
    titulo: 'EXPEDIENTE DE TI INICIADO',
    chamada: 'Bom dia! Assumindo os atendimentos do dia.',
    mensagem: 'Estamos assumindo o plantão de TI neste momento e já priorizando todos os chamados abertos no sistema durante a noite.',
    rodape: 'TI UPA Pediátrica • Tenham todos um excelente plantão!',
    corFundo: '#064e3b',
    corDestaque: '#10b981'
  },

  // Bloco 4: Desvios de Função (CELK, EPA e Raio-X)
  {
    id: 10,
    categoria: 'Sistemas',
    badgeClass: 'b-sistema',
    titulo: 'SISTEMA CELK — USUÁRIOS E SENHAS',
    chamada: 'Acesso e desbloqueio de senhas do CELK.',
    mensagem: 'Por segurança e protocolo da empresa, a redefinição de senhas do CELK é realizada EXCLUSIVAMENTE pelo suporte técnico oficial da CELK. A TI da UPA não tem acesso à base.',
    rodape: 'Favor acionar os canais diretos da empresa CELK Saúde.',
    corFundo: '#451a03',
    corDestaque: '#f59e0b'
  },
  {
    id: 11,
    categoria: 'Sistemas',
    badgeClass: 'b-sistema',
    titulo: 'SISTEMA CELK — DÚVIDAS E TELAS',
    chamada: 'Erros de prontuário e fluxo assistencial.',
    mensagem: 'Como a TI não possui acesso ao módulo clínico do CELK, inconsistências de tela e dúvidas devem ser abertas diretamente com o suporte da CELK pelo profissional logado.',
    rodape: 'Anote a mensagem de erro ou capture a tela para agilizar.',
    corFundo: '#451a03',
    corDestaque: '#fbbf24'
  },
  {
    id: 12,
    categoria: 'Sistemas',
    badgeClass: 'b-sistema',
    titulo: 'SISTEMA EPA — USUÁRIO E SENHA',
    chamada: 'Liberação de novos acessos ao EPA.',
    mensagem: 'A criação e o desbloqueio de usuários para o sistema próprio EPA são de responsabilidade EXCLUSIVA do setor de Recursos Humanos (RH) da UPA. Procure o RH da unidade!',
    rodape: 'Gestão de acessos EPA: Setor de Recursos Humanos.',
    corFundo: '#3b0764',
    corDestaque: '#a855f7'
  },
  {
    id: 13,
    categoria: 'Sistemas',
    badgeClass: 'b-sistema',
    titulo: 'EQUIPAMENTOS DO RAIO-X',
    chamada: 'Manutenção da digitalizadora e impressora de Raio-X.',
    mensagem: 'A manutenção do equipamento de Raio-X é realizada pela empresa terceirizada contratada. Comunique o Supervisor Administrativo para que seja feito o acionamento!',
    rodape: 'Escopo técnico terceirizado • Supervisão Administrativa.',
    corFundo: '#1e293b',
    corDestaque: '#64748b'
  },

  // Bloco 5: Controle de Insumos
  {
    id: 14,
    categoria: 'Insumos',
    badgeClass: 'b-insumo',
    titulo: 'CONTROLE DE RECEITUÁRIOS A5',
    chamada: 'Distribuição e reposição de papel A5.',
    mensagem: 'O abastecimento dos maços de papel A5 nos consultórios é realizado pela equipe da RECEPÇÃO no início de cada turno. Por favor, solicite a reposição com a liderança da Recepção!',
    rodape: 'Papel A5 com consumo auditado por lote e plantão.',
    corFundo: '#064e3b',
    corDestaque: '#059669'
  },
  {
    id: 15,
    categoria: 'Insumos',
    badgeClass: 'b-insumo',
    titulo: 'BOBINAS TÉRMICAS E PULSEIRAS',
    chamada: 'Gestão de insumos hospitalares críticos.',
    mensagem: 'Para controle de estoque e auditoria da UPA, a liberação de pulseiras e etiquetas é feita mediante chamado no sistema. Selecione a opção "Pedir Insumo" no atalho Chamar TI!',
    rodape: 'Pulseiras restritas à Recepção • TI UPA Pediátrica',
    corFundo: '#064e3b',
    corDestaque: '#10b981'
  },

  // Bloco 6: Curtas & Rápidas
  {
    id: 16,
    categoria: 'Curta',
    badgeClass: 'b-curta',
    titulo: 'CHAMADO RÁPIDO DE CORREDOR',
    chamada: 'Atendimento em andamento.',
    mensagem: 'Estou em atendimento no momento! Dê 2 cliques no ícone 🆘 Chamar TI na tela do seu computador que já assumo seu chamado em seguida!',
    rodape: 'TI UPA Pediátrica • Atendimento em 15 segundos',
    corFundo: '#1e293b',
    corDestaque: '#ec4899'
  },
  {
    id: 17,
    categoria: 'Curta',
    badgeClass: 'b-curta',
    titulo: 'REGISTRO DE CHAMADO',
    chamada: 'Garantindo a sua prioridade.',
    mensagem: 'Por favor, registre pelo atalho Chamar TI na Área de Trabalho para entrar na fila prioritária de hoje!',
    rodape: 'Obrigado pela colaboração! • TI UPA',
    corFundo: '#1e293b',
    corDestaque: '#f43f5e'
  },
  {
    id: 18,
    categoria: 'Curta',
    badgeClass: 'b-curta',
    titulo: 'ORDEM DE CHEGADA',
    chamada: 'Chamado recebido com sucesso.',
    mensagem: 'Chamado anotado mentalmente, mas precisa estar no sistema! 😉 Dê 2 cliques no Chamar TI para que eu registre a solução certinho. Valeu!',
    rodape: 'Sempre ao lado da equipe assistencial • TI UPA',
    corFundo: '#1e293b',
    corDestaque: '#3b82f6'
  },
  {
    id: 19,
    categoria: 'Rede',
    badgeClass: 'b-geral',
    titulo: 'INSTABILIDADE DE REDE / CABO',
    chamada: 'Verificação física de conexões.',
    mensagem: 'Se o computador perdeu a conexão com a rede, verifique se a luz verde atrás do cabo de rede está acesa e abra o chamado pela máquina ao lado para irmos aí recrimpar!',
    rodape: 'Suporte de cabeamento e rede • TI UPA',
    corFundo: '#0f172a',
    corDestaque: '#0284c7'
  },
  {
    id: 20,
    categoria: 'Geral',
    badgeClass: 'b-geral',
    titulo: 'PARCERIA TI & ENFERMAGEM',
    chamada: 'Juntos pelo melhor atendimento às crianças.',
    mensagem: 'Nosso objetivo com a Central de Chamados é dar total prioridade e agilidade a quem está na ponta cuidando dos nossos pequenos pacientes. Muito obrigado pelo apoio de todos!',
    rodape: 'TI UPA Pediátrica • Trabalhando em equipe',
    corFundo: '#0f172a',
    corDestaque: '#10b981'
  }
];

function desenharCard(card, canvas) {
  const ctx = canvas.getContext('2d');
  const W = 1080;
  const H = 1080;
  canvas.width = W;
  canvas.height = H;

  // Fundo
  ctx.fillStyle = card.corFundo;
  ctx.fillRect(0, 0, W, H);

  // Barra superior de destaque
  ctx.fillStyle = card.corDestaque;
  ctx.fillRect(0, 0, W, 24);

  // Moldura interna elegante
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 60, W - 80, H - 120);

  // Badge da categoria
  ctx.fillStyle = card.corDestaque;
  ctx.beginPath();
  ctx.roundRect(80, 100, 240, 48, 8);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(card.categoria.toUpperCase(), 200, 133);

  // Título Principal
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(card.titulo, 80, 230);

  // Linha divisória
  ctx.fillStyle = card.corDestaque;
  ctx.fillRect(80, 260, 180, 6);

  // Subtítulo / Chamada
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 32px "Segoe UI", Arial, sans-serif';
  ctx.fillText(card.chamada, 80, 330);

  // Caixa da Mensagem Principal
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 390, W - 160, 480, 16);
  ctx.fill();
  ctx.stroke();

  // Texto da Mensagem (com quebra automática de linha)
  ctx.fillStyle = '#f8fafc';
  ctx.font = '400 38px "Segoe UI", Arial, sans-serif';
  wrapText(ctx, card.mensagem, 130, 480, W - 260, 62);

  // Rodapé Institucional
  ctx.fillStyle = '#64748b';
  ctx.font = '600 24px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(card.rodape, W / 2, 980);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function baixarCard(canvas, nome) {
  const link = document.createElement('a');
  link.download = `${nome}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function iniciar() {
  const galeria = document.getElementById('galeria');
  galeria.replaceChildren();

  CARDS.forEach(card => {
    const item = document.createElement('div');
    item.className = 'item-card';

    const info = document.createElement('div');
    info.className = 'card-info';
    info.innerHTML = `
      <b>#${card.id} — ${card.titulo}</b>
      <span class="badge ${card.badgeClass}">${card.categoria}</span>
    `;

    const canvas = document.createElement('canvas');
    canvas.className = 'preview-canvas';
    desenharCard(card, canvas);

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.type = 'button';
    btn.innerHTML = '⬇️ Baixar Imagem (PNG 1080x1080)';
    btn.addEventListener('click', () => baixarCard(canvas, `card-ti-upa-${card.id}-${card.categoria.toLowerCase()}`));

    item.append(info, canvas, btn);
    galeria.append(item);
  });

  document.getElementById('btnBaixarTodos').addEventListener('click', () => {
    const canvases = document.querySelectorAll('.preview-canvas');
    canvases.forEach((c, idx) => {
      setTimeout(() => {
        baixarCard(c, `card-ti-upa-${CARDS[idx].id}-${CARDS[idx].categoria.toLowerCase()}`);
      }, idx * 300);
    });
  });
}

iniciar();
