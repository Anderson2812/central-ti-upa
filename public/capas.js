'use strict';
// Gera as capas prontas para impressão no formato A4 com linha de dobra central.
const $ = id => document.getElementById(id);

function dataHoje() {
  return new Date().toLocaleDateString('pt-BR');
}

function gerar() {
  const setor = $('selSetor').value;
  const qtd = Math.min(100, Math.max(1, parseInt($('qtd').value, 10) || 1));
  const loteIni = parseInt($('loteIni').value, 10) || 101;
  const container = $('folhas');
  container.replaceChildren();

  for (let i = 0; i < qtd; i++) {
    const lote = loteIni + i;
    const folha = document.createElement('div');
    folha.className = 'pagina-a4';
    folha.innerHTML = `
      <div class="metade-verso">
        <div>
          <b>Controle de entrega e devolução</b>
          <p style="margin:4px 0 0;">Esta capa protege o maço de 100 folhas de receituário A5. Mantenha as folhas dentro desta capa até o uso final.</p>
        </div>
        <div style="font-size:11px; line-height:1.6;">
          Recebido por: ____________________________________ Data: ___/___/______<br>
          Devolvido / descartado por: ________________________ Data: ___/___/______
        </div>
      </div>

      <div class="linha-dobra">
        <span>Dobre aqui ao meio para fechar o maço de A5</span>
      </div>

      <div class="metade-frente">
        <div class="cab">
          <h1>UPA Pediátrica — Controle de Receituários</h1>
          <p>Papel A5 de uso restrito a prescrições, receitas e atendimentos da unidade</p>
        </div>

        <div class="quadro-lote">
          <div>
            <b>Número do lote</b>
            <span>#A5-${String(lote).padStart(4, '0')}</span>
          </div>
          <div>
            <b>Destino</b>
            <span>${setor}</span>
          </div>
          <div>
            <b>Conteúdo</b>
            <span>100 folhas A5 (75g)</span>
          </div>
          <div>
            <b>Data de liberação</b>
            <span>${dataHoje()}</span>
          </div>
        </div>

        <div class="aviso-legal">
          <b>ATENÇÃO:</b> É expressamente proibida a utilização deste papel e das impressoras da unidade para fins particulares ou alheios ao atendimento assistencial. O consumo é auditado por lote, setor e plantão médico.
        </div>

        <div class="rodape-frente">
          <span>TI / Almoxarifado — UPA Pediátrica</span>
          <span>Preservar esta capa com o lote</span>
        </div>
      </div>
    `;
    container.append(folha);
  }
}

$('btnGerar').addEventListener('click', gerar);
gerar();
