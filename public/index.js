'use strict';
// Tela "Chamar TI": usada por qualquer profissional, em qualquer computador, sem login.
const $ = id => document.getElementById(id);
let dados = null;
let categoria = null;
let subopcao = null;
let urgencia = 'Normal';

function criar(tag, props = {}, ...filhos) {
  const el = Object.assign(document.createElement(tag), props);
  filhos.forEach(f => el.append(f));
  return el;
}

function mostrar(id, visivel) { $(id).classList.toggle('oculto', !visivel); }

function erro(msg) {
  $('erro').textContent = msg;
  mostrar('erro', Boolean(msg));
}

async function iniciar() {
  try {
    const r = await fetch('/api/publico');
    dados = await r.json();
  } catch {
    erro('Não consegui falar com a Central. Atualize a página (F5). Se continuar, avise a TI pessoalmente.');
    return;
  }

  $('unidade').textContent = dados.unidade;
  document.title = `Chamar TI — ${dados.unidade}`;

  const select = $('setor');
  select.append(criar('option', { value: '', textContent: 'Selecione o setor...' }));
  for (const [grupo, setores] of Object.entries(dados.setores)) {
    const grupoEl = criar('optgroup', { label: grupo });
    setores.forEach(s => grupoEl.append(criar('option', { value: s, textContent: s })));
    select.append(grupoEl);
  }

  // 1. Prioridade máxima: parâmetro na URL do atalho (?setor=...&pc=...)
  // Isso resolve 100% dos casos de IP automático (DHCP), pois o atalho já carrega o setor do PC!
  const urlParams = new URLSearchParams(window.location.search);
  const setorParam = urlParams.get('setor');
  const pcParam = urlParams.get('pc');

  // 2. Segunda prioridade: memória do navegador neste computador (localStorage)
  const setorSalvo = localStorage.getItem('upa_setor_pc');
  const pcSalvo = localStorage.getItem('upa_nome_pc');

  // 3. Terceira prioridade: detecção automática pelo IP (se o IP for fixo no maquinas.csv)
  const setorDetectado = setorParam || setorSalvo || dados.detectado?.setor;
  const pcNome = pcParam || pcSalvo || dados.detectado?.maquina;

  if (setorDetectado) {
    select.value = setorDetectado;
    localStorage.setItem('upa_setor_pc', setorDetectado);
    if (pcNome) localStorage.setItem('upa_nome_pc', pcNome);

    $('detectado').textContent = `✔ Computador configurado: ${pcNome ? pcNome + ' (' + setorDetectado + ')' : setorDetectado}. Se você estiver em outro setor, basta trocar abaixo.`;
    mostrar('detectado', true);
  }

  select.addEventListener('change', () => {
    localStorage.setItem('upa_setor_pc', select.value);
    atualizarInsumos();
  });

  if (!dados.dentroDoHorario) {
    const h = dados.horario || {};
    $('foraHorario').textContent = `🕒 A TI atende nos dias úteis, das ${h.inicio || '08:00'} às ${h.fim || '17:00'}. ${dados.avisoForaDoHorario}`;
    mostrar('foraHorario', true);
  }

  dados.categorias.forEach(c => {
    const botao = criar('button', { type: 'button', className: 'opcao' },
      criar('span', { className: 'ico', textContent: c.icone || '•' }),
      criar('span', { textContent: c.rotulo }));
    botao.addEventListener('click', () => escolherCategoria(c, botao));
    $('categorias').append(botao);
  });

  document.querySelectorAll('[data-urgencia]').forEach(botao => {
    botao.addEventListener('click', () => {
      urgencia = botao.dataset.urgencia;
      document.querySelectorAll('[data-urgencia]').forEach(b => b.classList.toggle('ativa', b === botao));
    });
  });

  $('formulario').addEventListener('submit', enviar);
  $('novo').addEventListener('click', () => location.reload());
  $('btnAcompanhar').addEventListener('click', acompanhar);
}

function escolherCategoria(c, botao) {
  categoria = c;
  subopcao = null;
  document.querySelectorAll('#categorias .opcao').forEach(b => b.classList.toggle('ativa', b === botao));

  const lista = $('subopcoes');
  lista.replaceChildren();
  (c.subopcoes || []).forEach(s => {
    const b = criar('button', { type: 'button', className: 'opcao', textContent: s.rotulo });
    b.addEventListener('click', () => {
      subopcao = s;
      lista.querySelectorAll('.opcao').forEach(x => x.classList.toggle('ativa', x === b));
      atualizarOrientacao();
    });
    lista.append(b);
  });
  mostrar('blocoSub', Boolean(c.subopcoes?.length));

  const ehInsumo = c.tipo === 'insumo';
  mostrar('blocoInsumo', ehInsumo);
  mostrar('blocoUrgencia', !ehInsumo);
  atualizarInsumos();
  atualizarOrientacao();
  erro('');
}

function atualizarOrientacao() {
  const texto = subopcao?.orientacao || categoria?.orientacao || '';
  $('orientacao').textContent = texto ? `ℹ️ Atenção: ${texto}` : '';
  mostrar('orientacao', Boolean(texto));
  $('enviar').textContent = texto ? 'Registrar e seguir a orientação' : 'Enviar para a TI';
}

function atualizarInsumos() {
  if (categoria?.tipo !== 'insumo') return;
  const setor = $('setor').value;
  const itens = (setor && dados.insumosPorSetor[setor]) || [];
  $('insumo').replaceChildren(...itens.map(i => criar('option', { value: i, textContent: i })));
  const aviso = !setor ? 'Escolha primeiro o setor onde você está.'
    : !itens.length ? 'Este setor não pede insumos pela TI. Solicite à Recepção.' : '';
  $('semInsumo').textContent = aviso;
  mostrar('semInsumo', Boolean(aviso));
}

async function enviar(evento) {
  evento.preventDefault();
  erro('');
  const urlParams = new URLSearchParams(window.location.search);
  const pcParam = urlParams.get('pc') || localStorage.getItem('upa_nome_pc') || '';

  const corpo = {
    setor: $('setor').value,
    maquinaManual: pcParam,
    categoria: categoria?.id,
    subopcao: subopcao?.id,
    insumo: $('insumo').value,
    quantidade: $('quantidade').value,
    urgencia,
    solicitante: $('solicitante').value,
    descricao: $('descricao').value,
  };
  if (!corpo.setor) return erro('Escolha o setor onde você está.');
  if (!categoria) return erro('Escolha o que está acontecendo.');
  if (categoria.subopcoes?.length && !subopcao) return erro('Escolha uma das opções do problema.');
  if (categoria.tipo === 'insumo' && !corpo.insumo) return erro('Este setor não tem insumo liberado para pedir pela TI.');
  if (corpo.solicitante.trim().length < 2) return erro('Informe seu nome.');

  $('enviar').disabled = true;
  try {
    const r = await fetch('/api/chamados', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro || 'Não foi possível registrar.');

    $('numero').textContent = `#${j.id}`;
    let msg = 'A TI já recebeu o aviso.';
    if (j.status === 'Encaminhado') msg = `Este assunto não é resolvido pela TI.\n${j.orientacao}`;
    else if (!j.dentroDoHorario) msg = 'Registrado! A TI está fora do horário agora; o chamado será atendido no próximo expediente.';
    $('msgSucesso').textContent = msg;
    $('msgSucesso').className = `aviso ${j.status === 'Encaminhado' ? 'azul' : 'verde'}`;
    mostrar('formulario', false);
    mostrar('foraHorario', false);
    mostrar('sucesso', true);
    window.scrollTo(0, 0);
  } catch (e) {
    erro(e.message === 'Failed to fetch' ? 'Sem conexão com a Central. Tente de novo em instantes.' : e.message);
  } finally {
    $('enviar').disabled = false;
  }
}

async function acompanhar() {
  const n = parseInt($('numAcompanhar').value, 10);
  if (!n) return;
  try {
    const r = await fetch(`/api/chamados/${n}/situacao`);
    const j = await r.json();
    $('resAcompanhar').textContent = r.ok
      ? `Chamado #${j.id} — ${j.setor} — ${j.tipo}: ${j.status} (aberto em ${new Date(j.criadoEm).toLocaleString('pt-BR')}).`
      : j.erro;
  } catch {
    $('resAcompanhar').textContent = 'Sem conexão com a Central.';
  }
}

iniciar();
