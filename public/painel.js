'use strict';
// Lógica do Painel da TI (acessado pelo computador da TI ou celular).
const $ = id => document.getElementById(id);
let dados = null;
let versao = 0;
let filtroStatus = '';
let chamadoParaConcluir = null;

const SUGESTOES = [
  'Resolvido no local.',
  'Cabo de rede reconectado/recrimpado.',
  'Computador reiniciado e sistema restabelecido.',
  'Papel desobstruído e impressora limpa.',
  'Toner substituído.',
  'Bobina de pulseiras reposta.',
  'Bobina de etiquetas reposta.',
  'Usuário do Windows desbloqueado.',
  'Orientado sobre o fluxo correto do sistema.',
];

function criar(tag, props = {}, ...filhos) {
  const el = Object.assign(document.createElement(tag), props);
  filhos.forEach(f => el.append(f));
  return el;
}

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const diaLocal = (d = new Date()) => d.toLocaleDateString('sv-SE');
const fmtData = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function mostrar(id, visivel) { $(id).classList.toggle('oculto', !visivel); }

async function iniciar() {
  const rSessao = await fetch('/api/sessao').then(r => r.json()).catch(() => ({ ok: false }));
  if (rSessao.ok) mostrarApp(); else mostrarLogin();

  $('formLogin').addEventListener('submit', entrar);
  $('sair').addEventListener('click', sair);

  document.querySelectorAll('#abas button[data-aba]').forEach(b => {
    b.addEventListener('click', () => trocarAba(b.dataset.aba));
  });

  document.querySelectorAll('.filtros .chip').forEach(c => {
    c.addEventListener('click', () => {
      filtroStatus = c.dataset.status;
      document.querySelectorAll('.filtros .chip').forEach(x => x.classList.toggle('ativa', x === c));
      renderizarChamados();
    });
  });

  $('busca').addEventListener('input', renderizarChamados);

  const hoje = diaLocal();
  const d30 = diaLocal(new Date(Date.now() - 30 * 864e5));
  $('relDe').value = d30;
  $('relAte').value = hoje;
  $('relDe').addEventListener('change', atualizarRelatorio);
  $('relAte').addEventListener('change', atualizarRelatorio);
  $('btnImprimir').addEventListener('click', () => window.print());

  $('formSolucao').addEventListener('submit', confirmarConclusao);
  $('cancelarSolucao').addEventListener('click', () => $('modalSolucao').close());

  const divSug = $('sugestoesSolucao');
  SUGESTOES.forEach(txt => {
    const b = criar('button', { type: 'button', className: 'chip', textContent: txt });
    b.addEventListener('click', () => { $('txtSolucao').value = txt; });
    divSug.append(b);
  });
}

function mostrarLogin() { mostrar('login', true); mostrar('app', false); $('pin').focus(); }
function mostrarApp() { mostrar('login', false); mostrar('app', true); carregar(); setInterval(carregar, 5000); }

async function entrar(e) {
  e.preventDefault();
  $('erroLogin').classList.add('oculto');
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: $('pin').value }),
  });
  const j = await r.json();
  if (r.ok) { $('pin').value = ''; mostrarApp(); }
  else { $('erroLogin').textContent = j.erro || 'PIN incorreto.'; $('erroLogin').classList.remove('oculto'); }
}

async function sair() {
  await fetch('/api/sair', { method: 'POST' });
  location.reload();
}

function trocarAba(nome) {
  document.querySelectorAll('#abas button[data-aba]').forEach(b => b.classList.toggle('ativa', b.dataset.aba === nome));
  mostrar('aba-chamados', nome === 'chamados');
  mostrar('aba-rede', nome === 'rede');
  mostrar('aba-relatorio', nome === 'relatorio');
  if (nome === 'relatorio') atualizarRelatorio();
}

async function carregar() {
  try {
    const r = await fetch(`/api/painel?versao=${versao}`);
    if (r.status === 401) { mostrarLogin(); return; }
    const j = await r.json();
    if (j.semMudanca) {
      dados.rede = j.rede;
      dados.internet = j.internet;
      renderizarRede();
      return;
    }
    dados = j;
    versao = j.versao;
    $('unidade').textContent = `Painel da TI — ${dados.unidade}`;
    renderizarChamados();
    renderizarRede();
    if (!$('aba-relatorio').classList.contains('oculto')) atualizarRelatorio();
  } catch { /* continua tentando a cada 5s */ }
}

function renderizarChamados() {
  if (!dados) return;
  const lista = dados.chamados || [];
  const hoje = diaLocal();
  const abertos = lista.filter(c => c.status === 'Aberto');
  const emAtend = lista.filter(c => c.status === 'Em atendimento');
  const hojeTotal = lista.filter(c => diaLocal(new Date(c.criadoEm)) === hoje);
  const concluidos = lista.filter(c => c.status === 'Concluído');

  $('kpiAbertos').textContent = abertos.length;
  $('kpiAtend').textContent = emAtend.length;
  $('kpiHoje').textContent = hojeTotal.length;
  $('kpiResolvidos').textContent = lista.length ? `${Math.round((concluidos.length / lista.length) * 100)}%` : '0%';

  const tempos = concluidos.map(c => (new Date(c.concluidoEm) - new Date(c.criadoEm)) / 60000).filter(t => t > 0);
  $('kpiTempo').textContent = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : '-';

  $('cntTodos').textContent = lista.length;
  $('cntAberto').textContent = abertos.length;
  $('cntAtend').textContent = emAtend.length;
  $('cntOk').textContent = concluidos.length;
  $('cntEnc').textContent = lista.filter(c => c.status === 'Encaminhado').length;

  const termo = $('busca').value.toLowerCase().trim();
  const visiveis = lista
    .filter(c => !filtroStatus || c.status === filtroStatus)
    .filter(c => !termo || [c.id, c.setor, c.solicitante, c.categoriaRotulo, c.detalhe, c.descricao, c.solucao].join(' ').toLowerCase().includes(termo))
    .slice()
    .sort((a, b) => {
      // Prioridade: Aberto > Em atendimento > mais recente
      const peso = s => ({ 'Aberto': 3, 'Em atendimento': 2, 'Encaminhado': 1, 'Concluído': 0 }[s] || 0);
      return (peso(b.status) - peso(a.status)) || (new Date(b.criadoEm) - new Date(a.criadoEm));
    });

  const container = $('listaChamados');
  container.replaceChildren();

  if (!visiveis.length) {
    container.append(criar('div', { className: 'card suave', textContent: 'Nenhum chamado encontrado.' }));
    return;
  }

  visiveis.forEach(c => {
    const el = criar('div', { className: `chamado ${c.urgencia === 'Urgente' ? 'urgente' : ''} st-${{ 'Aberto': 'aberto', 'Em atendimento': 'atend', 'Concluído': 'ok', 'Encaminhado': 'enc' }[c.status] || ''}` });

    const badgeStatus = {
      'Aberto': 'badge b-aberto',
      'Em atendimento': 'badge b-atend',
      'Concluído': 'badge b-ok',
      'Encaminhado': 'badge b-enc',
    }[c.status] || 'badge b-cinza';

    const badges = [
      criar('span', { className: 'badge b-cinza', textContent: `#${c.id}` }),
      criar('span', { className: badgeStatus, textContent: c.status }),
    ];
    if (c.urgencia === 'Urgente') badges.push(criar('span', { className: 'badge b-urg', textContent: '🔴 Urgente' }));
    if (c.foraDoHorario) badges.push(criar('span', { className: 'badge b-cinza', textContent: '🕒 Fora do expediente' }));

    const cab = criar('div', { className: 'cab' },
      criar('div', {}, ...badges),
      criar('span', { className: 'suave', textContent: fmtData(c.criadoEm) })
    );

    const corpo = criar('div', { style: 'margin-top:6px;' },
      criar('div', { style: 'font-weight:700; font-size:16px;' }, `${c.setor}${c.maquina ? ' — ' + c.maquina : ''}`),
      criar('div', {}, `${c.categoriaRotulo}${c.detalhe ? ' — ' + c.detalhe : ''}`),
      criar('div', { className: 'suave' }, `Solicitante: ${c.solicitante}`)
    );
    if (c.descricao) corpo.append(criar('div', { style: 'margin-top:4px; font-style:italic;' }, `"${c.descricao}"`));
    if (c.solucao) corpo.append(criar('div', { className: 'aviso verde', style: 'margin:6px 0 0;' }, `💡 Solução: ${c.solucao}`));
    if (c.orientacao) corpo.append(criar('div', { className: 'aviso azul', style: 'margin:6px 0 0;' }, `ℹ️ ${c.orientacao}`));

    const acoes = criar('div', { className: 'acoes' });
    if (c.status === 'Aberto') {
      const bAtender = criar('button', { className: 'btn peq azul', type: 'button', textContent: '▶️ Iniciar atendimento' });
      bAtender.addEventListener('click', () => mudarStatus(c.id, 'Em atendimento'));
      acoes.append(bAtender);
    }
    if (c.status === 'Aberto' || c.status === 'Em atendimento') {
      const bConcluir = criar('button', { className: 'btn peq', type: 'button', textContent: '✅ Concluir chamado' });
      bConcluir.addEventListener('click', () => abrirModalConclusao(c));
      acoes.append(bConcluir);
    }
    if (c.status === 'Concluído') {
      const bReabrir = criar('button', { className: 'btn peq sec', type: 'button', textContent: '↩️ Reabrir' });
      bReabrir.addEventListener('click', () => mudarStatus(c.id, 'Aberto', ''));
      acoes.append(bReabrir);
    }

    el.append(cab, corpo, acoes);
    container.append(el);
  });
}

async function mudarStatus(id, status, solucao) {
  const corpo = { status };
  if (solucao !== undefined) corpo.solucao = solucao;
  await fetch(`/api/chamados/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  carregar();
}

function abrirModalConclusao(c) {
  chamadoParaConcluir = c;
  $('modalChamadoInfo').textContent = `#${c.id} — ${c.setor} — ${c.categoriaRotulo}`;
  $('txtSolucao').value = c.solucao || '';
  $('modalSolucao').showModal();
}

async function confirmarConclusao(e) {
  e.preventDefault();
  if (!chamadoParaConcluir) return;
  const sol = $('txtSolucao').value.trim() || 'Atendimento concluído.';
  $('modalSolucao').close();
  await mudarStatus(chamadoParaConcluir.id, 'Concluído', sol);
  chamadoParaConcluir = null;
}

// ---------------------------------------------------------------- monitor de rede
function renderizarRede() {
  if (!dados) return;
  const net = dados.internet || {};
  const statusEl = $('statusInternet');
  if (net.online === true) {
    statusEl.className = 'aviso verde';
    statusEl.textContent = '🟢 Internet funcionando nos dois links (redundância ativa).';
  } else if (net.online === false) {
    statusEl.className = 'aviso vermelho';
    statusEl.textContent = '🔴 Internet da unidade FORA DO AR. Os dois links caíram.';
  } else {
    statusEl.className = 'aviso amarelo';
    statusEl.textContent = '⏳ Verificando internet...';
  }

  const avisos = [];
  if (dados.telegram) avisos.push('✔ Avisos no Telegram ativados.');
  else avisos.push('⚠ Telegram não configurado no config.json (você não recebe avisos no celular).');
  if (dados.healthcheck) avisos.push('✔ Alerta de queda de internet ativado via healthchecks.io.');
  else avisos.push('⚠ healthcheckUrl não configurado (sem alerta no celular se a internet cair).');
  $('infoInternet').innerHTML = avisos.join('<br>');

  const maqs = dados.rede || [];
  $('totalMaqs').textContent = maqs.length;
  $('cntOn').textContent = maqs.filter(m => m.online === true).length;
  $('cntOff').textContent = maqs.filter(m => m.online === false).length;
  $('cntSemIp').textContent = maqs.filter(m => !m.ip).length;

  // Agrupa por setor
  const porSetor = {};
  maqs.forEach(m => { (porSetor[m.setor] = porSetor[m.setor] || []).push(m); });

  const container = $('gradeRede');
  container.replaceChildren();

  for (const [setor, lista] of Object.entries(porSetor)) {
    const bloco = criar('div', { className: 'setor-rede' }, criar('h3', { textContent: setor }));
    const grade = criar('div', { className: 'maqs' });
    lista.forEach(m => {
      let cls = 'maq sem';
      let statusTxt = 'Sem IP';
      if (m.ip) {
        if (m.online === true) { cls = 'maq on'; statusTxt = '🟢 Online'; }
        else if (m.online === false) { cls = 'maq off'; statusTxt = '🔴 FORA DA REDE'; }
        else { statusTxt = '⏳ Testando...'; }
      }
      if (m.critico) cls += ' critico';
      const el = criar('div', { className: cls },
        criar('b', {}, m.nome),
        criar('div', { className: 'suave' }, `${m.ip || 'Configure o IP'} · ${statusTxt}`)
      );
      grade.append(el);
    });
    bloco.append(grade);
    container.append(bloco);
  }

  // Eventos de queda
  const evs = (dados.eventos || []).slice().reverse().slice(0, 15);
  const containerEv = $('historicoEventos');
  containerEv.replaceChildren();
  if (!evs.length) {
    containerEv.append(criar('p', { className: 'suave', textContent: 'Nenhuma queda registrada até o momento.' }));
  } else {
    evs.forEach(e => {
      const duracao = e.fim ? `${Math.round((new Date(e.fim) - new Date(e.inicio)) / 60000)} min` : 'em aberto';
      containerEv.append(criar('div', { className: 'barra' },
        criar('div', { className: 'legenda' },
          criar('span', {}, `${e.tipo === 'internet' ? '🌐' : '🖥️'} ${e.alvo} (${e.setor || ''})`),
          criar('span', { className: 'suave' }, `${fmtData(e.inicio)} · ${duracao}`)
        )
      ));
    });
  }
}

// ---------------------------------------------------------------- relatório
function atualizarRelatorio() {
  if (!dados) return;
  const de = $('relDe').value || '0000-00-00';
  const ate = $('relAte').value || '9999-99-99';
  $('btnCsv').href = `/api/exportar.csv?de=${de}&ate=${ate}`;

  const lista = (dados.chamados || []).filter(c => {
    const d = diaLocal(new Date(c.criadoEm));
    return d >= de && d <= ate;
  });

  $('relTitulo').textContent = `${dados.unidade} — Relatório de Atendimentos de TI`;
  $('relSubtitulo').textContent = `Período: ${fmtData(de + 'T00:00:00').slice(0, 10)} até ${fmtData(ate + 'T23:59:59').slice(0, 10)} — Emitido em: ${new Date().toLocaleString('pt-BR')}`;

  const concluidos = lista.filter(c => c.status === 'Concluído');
  const encaminhados = lista.filter(c => c.status === 'Encaminhado');
  const foraHorario = lista.filter(c => c.foraDoHorario);
  $('relTotal').textContent = lista.length;
  $('relResolvidos').textContent = concluidos.length;
  $('relEncaminhados').textContent = encaminhados.length;
  $('relForaHorario').textContent = foraHorario.length;

  const tempos = concluidos.map(c => (new Date(c.concluidoEm) - new Date(c.criadoEm)) / 60000).filter(t => t > 0);
  $('relTempoMedio').textContent = tempos.length ? `${Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)} min` : '-';

  // Barras: categorias
  const porCat = {};
  lista.forEach(c => { porCat[c.categoriaRotulo] = (porCat[c.categoriaRotulo] || 0) + 1; });
  desenharBarras('graficoCategorias', porCat, lista.length);

  // Barras: setores
  const porSetor = {};
  lista.forEach(c => { porSetor[c.setor] = (porSetor[c.setor] || 0) + 1; });
  desenharBarras('graficoSetores', porSetor, lista.length);

  // Tabela
  const tbody = $('tabelaChamados');
  tbody.replaceChildren();
  lista.forEach(c => {
    const tr = criar('tr', {},
      criar('td', {}, `#${c.id}`),
      criar('td', {}, fmtData(c.criadoEm)),
      criar('td', {}, c.setor),
      criar('td', {}, `${c.categoriaRotulo}${c.detalhe ? ' (' + c.detalhe + ')' : ''}`),
      criar('td', {}, c.solicitante),
      criar('td', {}, c.status),
      criar('td', {}, c.solucao || c.orientacao || '-')
    );
    tbody.append(tr);
  });

  // Quedas no período
  const evs = (dados.eventos || []).filter(e => {
    const d = diaLocal(new Date(e.inicio));
    return d >= de && d <= ate;
  });
  const containerEv = $('tabelaEventosRel');
  containerEv.replaceChildren();
  if (!evs.length) {
    containerEv.append(criar('p', { className: 'suave', textContent: 'Nenhuma queda registrada no período.' }));
  } else {
    evs.forEach(e => {
      const dur = e.fim ? `${Math.round((new Date(e.fim) - new Date(e.inicio)) / 60000)} min` : 'em aberto';
      containerEv.append(criar('div', { className: 'barra' },
        criar('div', { className: 'legenda' },
          criar('b', {}, `${e.tipo === 'internet' ? '🌐' : '🖥️'} ${e.alvo} (${e.setor || ''})`),
          criar('span', {}, `${fmtData(e.inicio)} · Duração: ${dur}`)
        )
      ));
    });
  }
}

function desenharBarras(id, mapa, total) {
  const container = $(id);
  container.replaceChildren();
  const itens = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  if (!itens.length) {
    container.append(criar('p', { className: 'suave', textContent: 'Sem dados no período.' }));
    return;
  }
  itens.forEach(([rotulo, qtd]) => {
    const pct = total ? Math.round((qtd / total) * 100) : 0;
    const bar = criar('div', { className: 'barra' },
      criar('div', { className: 'legenda' },
        criar('span', {}, rotulo),
        criar('b', {}, `${qtd} (${pct}%)`)
      ),
      criar('div', { className: 'trilho' },
        criar('div', { className: 'cheio', style: `width:${pct}%;` })
      )
    );
    container.append(bar);
  });
}

iniciar();
