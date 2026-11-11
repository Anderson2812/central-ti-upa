'use strict';
/*
 * Central de Chamados TI — UPA Pediátrica
 * Servidor único, sem dependências (Node.js 18 ou superior).
 * Tudo roda na rede interna: se a internet cair, os chamados continuam
 * chegando neste computador. A internet só é usada para avisar o celular
 * (Telegram) e para o alerta de queda dos links (healthchecks.io).
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const RAIZ = __dirname;
const DADOS = path.join(RAIZ, 'dados');
const PUBLICO = path.join(RAIZ, 'public');
const ARQ = {
  config: path.join(RAIZ, 'config.json'),
  chamados: path.join(DADOS, 'chamados.json'),
  eventos: path.join(DADOS, 'eventos.json'),
  fila: path.join(DADOS, 'fila-telegram.json'),
  sessoes: path.join(DADOS, 'sessoes.json'),
  registro: path.join(DADOS, 'registro.log'),
};
fs.mkdirSync(path.join(DADOS, 'backup'), { recursive: true });

// ---------------------------------------------------------------- utilitários
const esperar = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const diaLocal = (d = new Date()) => d.toLocaleDateString('sv-SE');
const fmtDataHora = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function log(...partes) {
  const linha = `${new Date().toLocaleString('pt-BR')} - ${partes.join(' ')}`;
  console.log(linha);
  try {
    if (fs.existsSync(ARQ.registro) && fs.statSync(ARQ.registro).size > 5e6) fs.renameSync(ARQ.registro, ARQ.registro + '.antigo');
    fs.appendFileSync(ARQ.registro, linha + '\n');
  } catch { /* o log em arquivo é só conveniência */ }
}

function tempoDesde(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dia(s)`;
}

function lerJSON(arq, padrao) {
  try { return JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^\uFEFF/, '')); } catch { return padrao; }
}

function gravarJSON(arq, dados) {
  const conteudo = JSON.stringify(dados, null, 2);
  const tmp = arq + '.tmp';
  try {
    // Grava num temporário e troca, para não corromper o arquivo se faltar energia no meio.
    fs.writeFileSync(tmp, conteudo);
    fs.renameSync(tmp, arq);
  } catch {
    // Antivírus no Windows às vezes trava o rename; nesse caso grava direto.
    fs.writeFileSync(arq, conteudo);
  }
}

function lerCSV(nome) {
  let buf;
  try { buf = fs.readFileSync(path.join(RAIZ, nome)); } catch { return []; }
  let txt = buf.toString('utf8');
  // O Excel em português costuma salvar CSV em ANSI; aí os acentos chegam quebrados no UTF-8.
  if (txt.includes('\uFFFD')) txt = buf.toString('latin1');
  const linhas = txt.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.replace(/;/g, '').trim() && !l.trim().startsWith('#'));
  if (!linhas.length) return [];
  const limpar = v => String(v || '').trim().replace(/^"(.*)"$/, '$1').trim();
  const cab = linhas.shift().split(';').map(c => norm(limpar(c)));
  return linhas.map(l => {
    const v = l.split(';');
    const o = {};
    cab.forEach((c, i) => { o[c] = limpar(v[i]); });
    return o;
  });
}

// ---------------------------------------------------------------- configuração
const config = lerJSON(ARQ.config, null);
if (!config) {
  console.error('Não consegui ler o config.json. Confira se o arquivo existe e se não sobrou vírgula ou aspas.');
  process.exit(1);
}
config.telegram = config.telegram || {};
if (!config.pinTI) {
  config.pinTI = String(crypto.randomInt(100000, 1000000));
  gravarJSON(ARQ.config, config);
  log(`PIN do painel da TI criado: ${config.pinTI} (fica salvo no config.json, campo "pinTI").`);
}

const listaSetores = () => (Array.isArray(config.setores) ? config.setores : Object.values(config.setores || {}).flat());
const setoresAgrupados = () => (Array.isArray(config.setores) ? { Setores: config.setores } : config.setores);

function carregarMaquinas() {
  return lerCSV('maquinas.csv')
    .filter(m => m.nome)
    .map(m => ({
      setor: m.setor || 'Sem setor',
      nome: m.nome,
      ip: /^[\w.-]+$/.test(m.ip || '') ? m.ip : '',
      critico: /^s/i.test(m.critico || ''),
    }));
}

function carregarInsumos() {
  return lerCSV('insumos.csv')
    .filter(i => i.item)
    .map(i => ({ item: i.item, setores: String(i.setores || '').split('|').map(s => s.trim()).filter(Boolean) }));
}

function insumosDoSetor(setor) {
  return carregarInsumos()
    .filter(i => i.setores.some(s => s === '*' || norm(s) === norm(setor)))
    .map(i => i.item);
}

function dentroDoHorario(d = new Date()) {
  const h = config.horarioComercial || {};
  const dias = h.dias || [1, 2, 3, 4, 5];
  if (!dias.includes(d.getDay())) return false;
  const paraMin = t => { const [hh, mm] = String(t).split(':').map(Number); return hh * 60 + (mm || 0); };
  const agora = d.getHours() * 60 + d.getMinutes();
  return agora >= paraMin(h.inicio || '08:00') && agora < paraMin(h.fim || '17:00');
}

// ---------------------------------------------------------------- dados
let chamados = lerJSON(ARQ.chamados, []);
let eventos = lerJSON(ARQ.eventos, []);
let fila = lerJSON(ARQ.fila, []);
const sessoes = new Map(Object.entries(lerJSON(ARQ.sessoes, {})).filter(([, exp]) => exp > Date.now()));
let versao = 1;

function salvarChamados() { versao++; gravarJSON(ARQ.chamados, chamados); }
function salvarEventos() { versao++; eventos = eventos.slice(-2000); gravarJSON(ARQ.eventos, eventos); }
function salvarSessoes() { gravarJSON(ARQ.sessoes, Object.fromEntries(sessoes)); }

function backupDiario() {
  const dir = path.join(DADOS, 'backup');
  const arq = path.join(dir, `chamados-${diaLocal()}.json`);
  if (!fs.existsSync(arq)) gravarJSON(arq, chamados);
  fs.readdirSync(dir).filter(f => f.startsWith('chamados-')).sort().slice(0, -60)
    .forEach(f => fs.unlinkSync(path.join(dir, f)));
}

function abrirEvento(tipo, alvo, setor) {
  eventos.push({ tipo, alvo, setor, inicio: new Date().toISOString(), fim: null });
  salvarEventos();
}

// Devolve quantos minutos o problema durou, ou null se não havia evento aberto.
function fecharEvento(tipo, alvo) {
  const ev = [...eventos].reverse().find(e => e.tipo === tipo && e.alvo === alvo && !e.fim);
  if (!ev) return null;
  ev.fim = new Date().toISOString();
  salvarEventos();
  return Math.max(1, Math.round((new Date(ev.fim) - new Date(ev.inicio)) / 60000));
}

const STATUS = ['Aberto', 'Em atendimento', 'Concluído', 'Encaminhado'];

function mudarStatus(c, status, solucao, por) {
  if (!STATUS.includes(status)) return false;
  const agora = new Date().toISOString();
  c.status = status;
  if (solucao != null) c.solucao = String(solucao).replace(/\s+/g, ' ').trim().slice(0, 300);
  if (status === 'Em atendimento' && !c.atendidoEm) c.atendidoEm = agora;
  if (status === 'Concluído') { c.concluidoEm = agora; if (!c.atendidoEm) c.atendidoEm = agora; }
  if (status === 'Aberto') c.concluidoEm = null;
  c.historico.push({ em: agora, acao: status, por });
  salvarChamados();
  atualizarMensagemTelegram(c).catch(() => {});
  return true;
}

// ---------------------------------------------------------------- Telegram
const tg = config.telegram;
const tgAtivo = () => Boolean(tg.token && tg.chatId);

async function tgApi(metodo, corpo) {
  const r = await fetch(`https://api.telegram.org/bot${tg.token}/${metodo}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(metodo === 'getUpdates' ? 40000 : 10000),
  });
  const j = await r.json();
  if (!j.ok) { const e = new Error(j.description || 'erro do Telegram'); e.telegram = true; throw e; }
  return j.result;
}

function textoChamado(c) {
  const icone = { 'Concluído': '✅', 'Em atendimento': '🔧', 'Encaminhado': '↪️' }[c.status] || '🆕';
  const linhas = [
    `${icone} <b>Chamado #${c.id}</b>${c.urgencia === 'Urgente' ? ' 🔴 URGENTE' : ''}`,
    `📍 ${esc(c.setor)}${c.maquina ? ' — ' + esc(c.maquina) : ''}`,
    `${esc(c.categoriaRotulo)}${c.detalhe ? ' — ' + esc(c.detalhe) : ''}`,
    `👤 ${esc(c.solicitante)}`,
  ];
  if (c.descricao) linhas.push(`💬 ${esc(c.descricao)}`);
  linhas.push(`🕒 ${fmtDataHora(c.criadoEm)} · <i>${c.status}</i>`);
  if (c.solucao) linhas.push(`💡 ${esc(c.solucao)}`);
  return linhas.join('\n');
}

function botoesChamado(c) {
  const atender = { text: '▶️ Atender', callback_data: `at:${c.id}` };
  const concluir = { text: '✅ Concluir', callback_data: `ok:${c.id}` };
  if (c.status === 'Aberto') return [[atender, concluir]];
  if (c.status === 'Em atendimento') return [[concluir]];
  return [];
}

function enviarTelegram(texto, opcoes = {}) {
  if (!tgAtivo()) return;
  const silencioso = opcoes.silencioso ?? (config.silenciarForaDoHorario !== false && !dentroDoHorario());
  fila.push({ texto, botoes: opcoes.botoes, chamadoId: opcoes.chamadoId, silencioso, criadoEm: Date.now() });
  gravarJSON(ARQ.fila, fila);
  processarFila();
}

let enviandoFila = false;
async function processarFila() {
  if (enviandoFila || !tgAtivo() || !fila.length) return;
  enviandoFila = true;
  try {
    while (fila.length) {
      const m = fila[0];
      let texto = m.texto;
      if (Date.now() - m.criadoEm > 120000) texto += '\n<i>(aviso atrasado: a internet da unidade estava fora)</i>';
      const corpo = { chat_id: tg.chatId, text: texto, parse_mode: 'HTML', disable_notification: Boolean(m.silencioso) };
      if (m.botoes?.length) corpo.reply_markup = { inline_keyboard: m.botoes };
      try {
        const enviada = await tgApi('sendMessage', corpo);
        const c = m.chamadoId && chamados.find(x => x.id === m.chamadoId);
        if (c) { c.tgMsgId = enviada.message_id; salvarChamados(); }
      } catch (e) {
        if (!e.telegram) break; // sem internet: tenta de novo depois
        log('Telegram recusou a mensagem:', e.message);
      }
      fila.shift();
      gravarJSON(ARQ.fila, fila);
    }
  } finally {
    enviandoFila = false;
  }
}

async function atualizarMensagemTelegram(c) {
  if (!tgAtivo() || !c.tgMsgId) return;
  await tgApi('editMessageText', {
    chat_id: tg.chatId, message_id: c.tgMsgId, text: textoChamado(c), parse_mode: 'HTML',
    reply_markup: { inline_keyboard: botoesChamado(c) },
  });
}

const AJUDA_TELEGRAM = [
  '<b>Central de Chamados TI</b>',
  'Toque em ▶️ Atender ou ✅ Concluir nos avisos.',
  'Para registrar o que foi feito, <b>responda</b> à mensagem do chamado com a solução (ele já é concluído).',
  '',
  '/abertos — chamados pendentes',
  '/rede — internet e equipamentos fora do ar',
  '/resumo — números de hoje',
].join('\n');

async function tratarUpdate(u) {
  if (u.callback_query) {
    const q = u.callback_query;
    if (String(q.message?.chat?.id) !== String(tg.chatId)) return;
    const [acao, idTxt] = String(q.data || '').split(':');
    const c = chamados.find(x => x.id === Number(idTxt));
    if (!c) return tgApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Chamado não encontrado.' });
    if (acao === 'at' && c.status === 'Aberto') mudarStatus(c, 'Em atendimento', null, 'celular');
    if (acao === 'ok' && c.status !== 'Concluído') mudarStatus(c, 'Concluído', c.solucao || 'Resolvido (registrado pelo celular)', 'celular');
    return tgApi('answerCallbackQuery', { callback_query_id: q.id, text: `#${c.id}: ${c.status}` });
  }

  const m = u.message;
  if (!m?.text) return;
  const responder = texto => tgApi('sendMessage', { chat_id: m.chat.id, text: texto, parse_mode: 'HTML' });

  if (String(m.chat.id) !== String(tg.chatId)) {
    // Só responde o código do chat, para ajudar na configuração. Nenhum dado da unidade sai daqui.
    if (m.text.startsWith('/start')) {
      await responder(`Seu código (chatId) é: <code>${m.chat.id}</code>\nCopie esse número para o campo "chatId" do config.json da Central e reinicie o programa.`);
    }
    return;
  }

  if (m.reply_to_message) {
    const c = chamados.find(x => x.tgMsgId === m.reply_to_message.message_id);
    if (c) {
      mudarStatus(c, 'Concluído', m.text, 'celular');
      return responder(`✅ Chamado #${c.id} concluído com a solução registrada.`);
    }
  }

  const comando = m.text.split(/[\s@]/)[0].toLowerCase();
  if (comando === '/abertos') {
    const pend = chamados.filter(c => c.status === 'Aberto' || c.status === 'Em atendimento');
    if (!pend.length) return responder('Nenhum chamado pendente. 🎉');
    return responder(pend.slice(-25).map(c =>
      `#${c.id} ${c.urgencia === 'Urgente' ? '🔴 ' : ''}${esc(c.setor)} — ${esc(c.categoriaRotulo)} (${c.status}, ${tempoDesde(c.criadoEm)})`).join('\n'));
  }
  if (comando === '/rede') {
    const fora = listaRede().filter(x => x.online === false);
    const net = internet.online === false ? '🔴 Internet FORA' : internet.online ? '🟢 Internet funcionando' : '⏳ Internet: verificando';
    return responder(`${net}\n${fora.length ? fora.map(x => `🔴 ${esc(x.nome)} (${esc(x.setor)})`).join('\n') : 'Todos os equipamentos monitorados respondendo.'}`);
  }
  if (comando === '/resumo') {
    const hoje = chamados.filter(c => diaLocal(new Date(c.criadoEm)) === diaLocal());
    const conta = s => hoje.filter(c => c.status === s).length;
    return responder(`<b>Hoje</b>: ${hoje.length} chamado(s)\n✅ Concluídos: ${conta('Concluído')}\n🔧 Em atendimento: ${conta('Em atendimento')}\n🆕 Abertos: ${conta('Aberto')}\n↪️ Encaminhados (fora da TI): ${conta('Encaminhado')}`);
  }
  return responder(AJUDA_TELEGRAM);
}

async function loopTelegram() {
  if (!tg.token) return;
  let offset = 0;
  log('Telegram ligado.', tg.chatId ? '' : 'Falta o chatId: mande /start para o seu bot.');
  for (;;) {
    try {
      const updates = await tgApi('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        await tratarUpdate(u).catch(e => log('Erro ao tratar mensagem do Telegram:', e.message));
      }
    } catch (e) {
      if (e.telegram) log('Telegram:', e.message);
      await esperar(15000);
    }
  }
}

// ---------------------------------------------------------------- monitor de rede
const estadoRede = {}; // ip -> { online, desde, falhas, verificadoEm }
let internet = { online: null, desde: Date.now(), falhas: 0 };

function pingar(ip) {
  return new Promise(resolve => {
    const windows = process.platform === 'win32';
    const args = windows ? ['-n', '1', '-w', '1500', ip] : ['-c', '1', '-W', '2', ip];
    execFile('ping', args, { timeout: 6000, windowsHide: true }, (erro, saida) => {
      // No Windows, "Host de destino inacessível" volta com código 0; por isso conferimos o TTL na resposta.
      resolve(!erro && /ttl=/i.test(String(saida)));
    });
  });
}

function registrarPing(m, ok) {
  const e = estadoRede[m.ip] || (estadoRede[m.ip] = { online: null, desde: Date.now(), falhas: 0 });
  e.verificadoEm = Date.now();
  if (ok) {
    e.falhas = 0;
    if (e.online !== true) {
      const minutos = m.critico ? fecharEvento('maquina', m.nome) : null;
      if (minutos != null) enviarTelegram(`✅ <b>${esc(m.nome)}</b> voltou a responder (${esc(m.setor)}). Ficou fora cerca de ${minutos} min.`);
      e.online = true;
      e.desde = Date.now();
    }
    return;
  }
  e.falhas++;
  // Duas falhas seguidas evitam alarme falso por um pacote perdido.
  if (e.falhas >= 2 && e.online !== false) {
    e.online = false;
    e.desde = Date.now();
    if (m.critico) {
      abrirEvento('maquina', m.nome, m.setor);
      enviarTelegram(`⚠️ <b>${esc(m.nome)}</b> parou de responder na rede (${esc(m.setor)}).`);
    }
  }
}

async function verificarInternet() {
  let ok = false;
  try {
    const r = await fetch(config.urlTesteInternet || 'https://www.google.com/generate_204', { method: 'HEAD', signal: AbortSignal.timeout(6000) });
    ok = r.status < 500;
  } catch { ok = false; }

  if (ok) {
    internet.falhas = 0;
    if (internet.online !== true) {
      const minutos = fecharEvento('internet', 'Internet da unidade');
      if (minutos != null) {
        log(`Internet voltou após ${minutos} min.`);
        enviarTelegram(`🌐 A internet da unidade voltou. Ficou fora por cerca de ${minutos} min.`);
      }
      internet = { online: true, desde: Date.now(), falhas: 0 };
      processarFila();
    }
    // "Estou vivo" para o healthchecks.io; se isso parar de chegar, ele avisa o celular.
    if (config.healthcheckUrl) fetch(config.healthcheckUrl, { signal: AbortSignal.timeout(8000) }).catch(() => {});
    return;
  }
  internet.falhas++;
  if (internet.falhas >= 2 && internet.online !== false) {
    internet.online = false;
    internet.desde = Date.now();
    abrirEvento('internet', 'Internet da unidade', 'Coordenação Geral');
    log('Internet da unidade fora do ar.');
  }
}

let cicloRodando = false;
async function cicloRede() {
  if (cicloRodando) return;
  cicloRodando = true;
  try {
    const pendentes = carregarMaquinas().filter(m => m.ip);
    // Até 8 pings ao mesmo tempo: rápido sem sobrecarregar a rede.
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (pendentes.length) {
        const m = pendentes.shift();
        registrarPing(m, await pingar(m.ip));
      }
    }));
    await verificarInternet();
  } catch (e) {
    log('Erro no monitor de rede:', e.message);
  } finally {
    cicloRodando = false;
  }
}

function listaRede() {
  return carregarMaquinas().map(m => ({ ...m, ...(m.ip ? estadoRede[m.ip] : {}) }));
}

// ---------------------------------------------------------------- HTTP
const ARQUIVOS = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/painel': ['painel.html', 'text/html; charset=utf-8'],
  '/capas': ['capas.html', 'text/html; charset=utf-8'],
  '/etiquetas': ['etiquetas.html', 'text/html; charset=utf-8'],
  '/cards': ['cards.html', 'text/html; charset=utf-8'],
  '/cards.js': ['cards.js', 'text/javascript; charset=utf-8'],
  '/estilo.css': ['estilo.css', 'text/css; charset=utf-8'],
  '/index.js': ['index.js', 'text/javascript; charset=utf-8'],
  '/painel.js': ['painel.js', 'text/javascript; charset=utf-8'],
  '/capas.js': ['capas.js', 'text/javascript; charset=utf-8'],
};

const CABECALHOS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
};

function responder(res, status, corpo, tipo) {
  res.writeHead(status, { ...CABECALHOS, 'Content-Type': tipo });
  res.end(corpo);
}
const json = (res, status, obj) => responder(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', parte => {
      dados += parte;
      if (dados.length > 20000) { reject(new Error('corpo grande demais')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(dados ? JSON.parse(dados) : {}); } catch { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}

function ipCliente(req) {
  const ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  return ip === '::1' ? '127.0.0.1' : ip;
}

function autenticado(req) {
  const cookie = String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('sessao='));
  const token = cookie?.slice(7);
  const expira = token && sessoes.get(token);
  return Boolean(expira && expira > Date.now());
}

const envios = new Map(); // ip -> horários dos últimos chamados
function limiteExcedido(ip) {
  const agora = Date.now();
  const recentes = (envios.get(ip) || []).filter(t => agora - t < 600000);
  recentes.push(agora);
  envios.set(ip, recentes);
  return recentes.length > 8;
}

function dadosPublicos(ip) {
  const maq = carregarMaquinas().find(m => m.ip && m.ip === ip);
  const setorDetectado = maq && listaSetores().find(s => norm(s) === norm(maq.setor));
  const insumosPorSetor = {};
  for (const s of listaSetores()) insumosPorSetor[s] = insumosDoSetor(s);
  return {
    unidade: config.nomeUnidade || 'UPA',
    setores: setoresAgrupados(),
    categorias: config.categorias || [],
    insumosPorSetor,
    detectado: setorDetectado ? { setor: setorDetectado, maquina: maq.nome } : null,
    dentroDoHorario: dentroDoHorario(),
    horario: config.horarioComercial,
    avisoForaDoHorario: config.avisoForaDoHorario || '',
  };
}

async function criarChamado(req, res, ip) {
  if (limiteExcedido(ip)) return json(res, 429, { erro: 'Muitos chamados seguidos deste computador. Aguarde alguns minutos.' });
  let b;
  try { b = await lerCorpo(req); } catch { return json(res, 400, { erro: 'Dados inválidos.' }); }
  const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

  const setor = listaSetores().find(s => s === b.setor);
  const cat = (config.categorias || []).find(c => c.id === b.categoria);
  const solicitante = txt(b.solicitante, 60);
  if (!setor) return json(res, 400, { erro: 'Escolha o setor onde você está.' });
  if (!cat) return json(res, 400, { erro: 'Escolha o tipo de problema.' });
  if (solicitante.length < 2) return json(res, 400, { erro: 'Informe seu nome.' });

  let detalhe = '';
  let orientacao = cat.orientacao || '';
  let insumo = null;
  let quantidade = null;
  if (cat.subopcoes?.length) {
    const sub = cat.subopcoes.find(s => s.id === b.subopcao);
    if (!sub) return json(res, 400, { erro: 'Escolha uma das opções do problema.' });
    detalhe = sub.rotulo;
    orientacao = sub.orientacao || orientacao;
  }
  if (cat.tipo === 'insumo') {
    insumo = insumosDoSetor(setor).find(i => i === b.insumo);
    if (!insumo) return json(res, 400, { erro: 'Este insumo não está liberado para o setor escolhido.' });
    quantidade = Math.min(20, Math.max(1, parseInt(b.quantidade, 10) || 1));
    detalhe = `${insumo} × ${quantidade}`;
  }

  const maq = carregarMaquinas().find(m => m.ip && m.ip === ip);
  const agora = new Date().toISOString();
  const c = {
    id: chamados.reduce((maior, x) => Math.max(maior, x.id), 0) + 1,
    criadoEm: agora,
    setor,
    maquina: maq?.nome || '',
    ip,
    categoria: cat.id,
    categoriaRotulo: `${cat.icone || ''} ${cat.rotulo}`.trim(),
    detalhe,
    insumo,
    quantidade,
    urgencia: b.urgencia === 'Urgente' && cat.tipo !== 'insumo' ? 'Urgente' : 'Normal',
    solicitante,
    descricao: txt(b.descricao, 300),
    status: orientacao ? 'Encaminhado' : 'Aberto',
    orientacao,
    solucao: orientacao ? 'Orientado a seguir o fluxo do responsável (fora do escopo da TI).' : '',
    foraDoHorario: !dentroDoHorario(),
    atendidoEm: null,
    concluidoEm: orientacao ? agora : null,
    historico: [{ em: agora, acao: orientacao ? 'Encaminhado automaticamente' : 'Aberto', por: solicitante }],
  };
  chamados.push(c);
  salvarChamados();
  log(`Chamado #${c.id} (${c.status}) - ${c.setor} - ${c.categoriaRotulo} ${c.detalhe}`);
  if (c.status === 'Aberto') enviarTelegram(textoChamado(c), { botoes: botoesChamado(c), chamadoId: c.id });
  json(res, 201, { id: c.id, status: c.status, orientacao, dentroDoHorario: !c.foraDoHorario });
}

const tentativas = new Map(); // ip -> { erros, bloqueadoAte }
async function login(req, res, ip) {
  const t = tentativas.get(ip) || { erros: 0, bloqueadoAte: 0 };
  if (t.bloqueadoAte > Date.now()) return json(res, 429, { erro: 'Muitas tentativas erradas. Aguarde 5 minutos.' });
  let b;
  try { b = await lerCorpo(req); } catch { b = {}; }
  const digitado = Buffer.from(String(b.pin || ''));
  const certo = Buffer.from(String(config.pinTI));
  const ok = digitado.length === certo.length && crypto.timingSafeEqual(digitado, certo);
  if (!ok) {
    t.erros++;
    if (t.erros >= 5) { t.erros = 0; t.bloqueadoAte = Date.now() + 300000; }
    tentativas.set(ip, t);
    return json(res, 401, { erro: 'PIN incorreto.' });
  }
  tentativas.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessoes.set(token, Date.now() + 30 * 864e5);
  salvarSessoes();
  res.setHeader('Set-Cookie', `sessao=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 86400}`);
  json(res, 200, { ok: true });
}

function rotaPainel(res, url) {
  const dias = Math.min(99999, Math.max(1, Number(url.searchParams.get('dias')) || 90));
  const base = {
    versao,
    rede: listaRede(),
    internet,
    telegram: tgAtivo(),
    healthcheck: Boolean(config.healthcheckUrl),
    horario: config.horarioComercial,
    unidade: config.nomeUnidade,
  };
  if (Number(url.searchParams.get('versao')) === versao) return json(res, 200, { ...base, semMudanca: true });
  const limite = Date.now() - dias * 864e5;
  const lista = chamados.filter(c => new Date(c.criadoEm).getTime() >= limite || c.status === 'Aberto' || c.status === 'Em atendimento');
  json(res, 200, { ...base, chamados: lista, eventos: eventos.slice(-300) });
}

async function atualizarChamado(req, res, id) {
  const c = chamados.find(x => x.id === id);
  if (!c) return json(res, 404, { erro: 'Chamado não encontrado.' });
  let b;
  try { b = await lerCorpo(req); } catch { return json(res, 400, { erro: 'Dados inválidos.' }); }
  if (!mudarStatus(c, b.status, b.solucao ?? null, 'painel')) return json(res, 400, { erro: 'Situação inválida.' });
  json(res, 200, c);
}

function exportarCSV(res, url) {
  const de = url.searchParams.get('de') || '0000-00-00';
  const ate = url.searchParams.get('ate') || '9999-99-99';
  // O apóstrofo impede que o Excel execute fórmulas digitadas no chamado (=, +, -, @).
  const cel = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const dt = iso => (iso ? new Date(iso).toLocaleString('pt-BR') : '');
  const linhas = [['Nº', 'Aberto em', 'Setor', 'Computador', 'Tipo', 'Detalhe', 'Urgência', 'Solicitante', 'Descrição', 'Situação', 'Fora do horário da TI', 'Atendido em', 'Concluído em', 'Minutos até concluir', 'Solução']];
  chamados
    .filter(c => { const d = diaLocal(new Date(c.criadoEm)); return d >= de && d <= ate; })
    .forEach(c => linhas.push([
      c.id, dt(c.criadoEm), c.setor, c.maquina, c.categoriaRotulo, c.detalhe, c.urgencia, c.solicitante, c.descricao, c.status,
      c.foraDoHorario ? 'Sim' : 'Não', dt(c.atendidoEm), dt(c.concluidoEm),
      c.concluidoEm ? Math.round((new Date(c.concluidoEm) - new Date(c.criadoEm)) / 60000) : '', c.solucao,
    ]));
  res.writeHead(200, {
    ...CABECALHOS,
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="chamados-ti-${de}-a-${ate}.csv"`,
  });
  res.end('\uFEFF' + linhas.map(l => l.map(cel).join(';')).join('\r\n'));
}

function atalhoBat(req, res) {
  const host = /^[\w.:-]+$/.test(req.headers.host || '') ? req.headers.host : `localhost:${config.porta || 8080}`;
  const bat = [
    '@echo off',
    'rem Cria o atalho "Chamar TI" na Area de Trabalho de TODOS os usuarios deste computador.',
    'rem Execute com o botao direito > Executar como administrador.',
    'set "ARQ=%PUBLIC%\\Desktop\\Chamar TI.url"',
    '(',
    'echo [InternetShortcut]',
    `echo URL=http://${host}/`,
    'echo IconFile=%SystemRoot%\\System32\\shell32.dll',
    'echo IconIndex=23',
    ') > "%ARQ%"',
    'if exist "%ARQ%" (echo Atalho "Chamar TI" criado com sucesso.) else (echo Nao consegui criar. Execute como administrador.)',
    'pause',
  ].join('\r\n');
  res.writeHead(200, { ...CABECALHOS, 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="instalar-atalho-chamar-ti.bat"' });
  res.end(bat);
}

async function rotear(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const rota = url.pathname.replace(/\/+$/, '') || '/';
  const ip = ipCliente(req);
  let m;

  if (req.method === 'GET' && ARQUIVOS[rota]) {
    const [arquivo, tipo] = ARQUIVOS[rota];
    return responder(res, 200, fs.readFileSync(path.join(PUBLICO, arquivo)), tipo);
  }
  if (req.method === 'GET' && rota === '/instalar-atalho.bat') return atalhoBat(req, res);
  if (req.method === 'GET' && rota === '/api/publico') return json(res, 200, dadosPublicos(ip));
  if (req.method === 'POST' && rota === '/api/chamados') return criarChamado(req, res, ip);
  if (req.method === 'GET' && (m = rota.match(/^\/api\/chamados\/(\d+)\/situacao$/))) {
    const c = chamados.find(x => x.id === Number(m[1]));
    if (!c) return json(res, 404, { erro: 'Chamado não encontrado.' });
    return json(res, 200, { id: c.id, setor: c.setor, tipo: c.categoriaRotulo, status: c.status, criadoEm: c.criadoEm, orientacao: c.orientacao });
  }
  if (req.method === 'POST' && rota === '/api/login') return login(req, res, ip);
  if (req.method === 'GET' && rota === '/api/sessao') return json(res, 200, { ok: autenticado(req) });
  if (req.method === 'POST' && rota === '/api/sair') {
    res.setHeader('Set-Cookie', 'sessao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return json(res, 200, { ok: true });
  }

  if (rota.startsWith('/api/')) {
    if (!autenticado(req)) return json(res, 401, { erro: 'Entre com o PIN da TI.' });
    if (req.method === 'GET' && rota === '/api/painel') return rotaPainel(res, url);
    if (req.method === 'PATCH' && (m = rota.match(/^\/api\/chamados\/(\d+)$/))) return atualizarChamado(req, res, Number(m[1]));
    if (req.method === 'GET' && rota === '/api/exportar.csv') return exportarCSV(res, url);
  }
  json(res, 404, { erro: 'Página não encontrada.' });
}

// ---------------------------------------------------------------- inicialização
const porta = Number(config.porta) || 8080;
const servidor = http.createServer((req, res) => {
  rotear(req, res).catch(e => {
    log('Erro inesperado:', e.message);
    if (!res.headersSent) json(res, 500, { erro: 'Erro interno. Tente de novo.' });
  });
});

servidor.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`A porta ${porta} já está em uso. A Central já está aberta em outra janela?`);
  else console.error(e);
  process.exit(1);
});

servidor.listen(porta, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  log(`Central de Chamados no ar na porta ${porta}.`);
  ips.forEach(ip => log(`  Abrir chamado: http://${ip}:${porta}/   |   Painel da TI: http://${ip}:${porta}/painel`));
  if (!tgAtivo()) log('Aviso: Telegram não configurado (sem avisos no celular).');
  if (!config.healthcheckUrl) log('Aviso: healthcheckUrl não configurado (sem alerta de queda de internet no celular).');
});

backupDiario();
setInterval(backupDiario, 3600e3);
cicloRede();
setInterval(cicloRede, (Number(config.intervaloPingSegundos) || 60) * 1000);
setInterval(processarFila, 30000);
loopTelegram();
