   const API = "";

// true = usa dados de exemplo (sem back end)
// false = conversa com a API de verdade
const USAR_DADOS_FALSOS = false;

// ---------- dados de exemplo ----------
const categoriasFalsas = [
    { id: 1, nome: "Alimentos" },
    { id: 2, nome: "Bebidas" },
    { id: 3, nome: "Limpeza" },
    { id: 4, nome: "Higiene" },
];

const produtosFalsos = [
    { id: 1, nome: "Arroz 5kg", unidade_base: "un", categoria_id: 1, preco_venda: 28.9 },
    { id: 2, nome: "Feijão 1kg", unidade_base: "un", categoria_id: 1, preco_venda: 8.5 },
    { id: 3, nome: "Leite integral 1L", unidade_base: "un", categoria_id: 2, preco_venda: 5.2 },
    { id: 4, nome: "Banana", unidade_base: "kg", categoria_id: 1, preco_venda: 6.9 },
    { id: 5, nome: "Detergente", unidade_base: "un", categoria_id: 3, preco_venda: 2.8 },
];

const lotesFalsos = [
    { produto_id: 1, quantidade: 40, validade: "2027-03-10", custo_unitario: 22 },
    { produto_id: 2, quantidade: 25, validade: "2027-02-01", custo_unitario: 6 },
    { produto_id: 3, quantidade: 60, validade: "2026-12-20", custo_unitario: 4 },
    { produto_id: 4, quantidade: 12.5, validade: "2026-11-20", custo_unitario: 4.5 },
    { produto_id: 5, quantidade: 8, validade: "2028-01-01", custo_unitario: 1.9 },
];

// ---------- elementos da página ----------
const telaLogin = document.getElementById("tela-login");
const telaEstoque = document.getElementById("tela-estoque");
const erroLogin = document.getElementById("erro-login");
const mensagem = document.getElementById("mensagem");

// ---------- funções de apoio ----------
function cabecalho(json = false) {
        const h = {
        Authorization: "Bearer " + localStorage.getItem("token"),
        "ngrok-skip-browser-warning": "true",};
    if (json) h["Content-Type"] = "application/json";
    return h;
}

// chama a API e já trata os erros mais comuns
async function pedir(caminho, opcoes = {}) {
    const resposta = await fetch(API + caminho, opcoes);

    if (resposta.status === 401) {
        sair();
        throw new Error("Sessão expirada. Entre de novo.");
    }
    if (resposta.status === 204) return null;

    const json = await resposta.json();
    if (!resposta.ok) {
        const texto = typeof json.detail === "string" ? json.detail : "Confira os dados informados.";
        throw new Error(texto);
    }
    return json;
}

function mostrarMensagem(texto, erro = false) {
    mensagem.textContent = texto;
    mensagem.style.color = erro ? "#c0392b" : "#27ae60";
}

// ---------- acesso aos dados (exemplo ou API) ----------
async function listarCategorias() {
    if (USAR_DADOS_FALSOS) return categoriasFalsas;
    return pedir("/categorias", { headers: cabecalho() });
}

async function listarProdutos() {
    if (USAR_DADOS_FALSOS) return produtosFalsos;
    return pedir("/produtos", { headers: cabecalho() });
}

async function listarLotes(produtoId) {
    if (USAR_DADOS_FALSOS) return lotesFalsos.filter((l) => l.produto_id === produtoId);
    return pedir("/produtos/" + produtoId + "/lotes", { headers: cabecalho() });
}

async function buscarEstoque() {
    if (USAR_DADOS_FALSOS) {
        const resumo = [];
        for (const p of produtosFalsos) {
            const total = lotesFalsos
                .filter((l) => l.produto_id === p.id)
                .reduce((soma, l) => soma + l.quantidade, 0);
            // como na API: produto sem lote não aparece no estoque
            if (total > 0) {
              resumo.push({ produto_id: p.id, produto: p.nome, unidade: p.unidade_base, quantidade_total: total });
            }
        }
        return resumo;
    }
    return pedir("/estoque/resumo", { headers: cabecalho() });
}

async function criarProduto(dados) {
    if (USAR_DADOS_FALSOS) {
        produtosFalsos.push({ id: produtosFalsos.length + 1, ...dados });
        return;
    }
    return pedir("/produtos", {
        method: "POST",
        headers: cabecalho(true),
        body: JSON.stringify(dados),
    });
}

async function excluirProduto(produtoId) {
    if (USAR_DADOS_FALSOS) {
        const idx = produtosFalsos.findIndex((p) => p.id === produtoId);
        if (idx !== -1) produtosFalsos.splice(idx, 1);
        return;
    }
    return pedir("/produtos/" + produtoId, {
        method: "DELETE",
        headers: cabecalho(),
    });
}

async function criarLote(dados) {
    if (USAR_DADOS_FALSOS) {
        const hoje = new Date().toISOString().slice(0, 10);
        if (dados.validade < hoje) {
            throw new Error("Não é possível dar entrada em lote com validade já vencida");
        }
        lotesFalsos.push(dados);
        return;
    }
    return pedir("/lotes", {
        method: "POST",
        headers: cabecalho(true),
        body: JSON.stringify(dados),
    });
}
async function registrarVenda(dados) {
    if (USAR_DADOS_FALSOS) {
        const hoje = new Date().toISOString().slice(0, 10);

        const lotes = lotesFalsos
            .filter((l) => l.produto_id === dados.produto_id && l.quantidade > 0 && l.validade >= hoje)
            .sort((a, b) => a.validade.localeCompare(b.validade));

        const total = lotes.reduce((soma, l) => soma + l.quantidade, 0);
        if (total < dados.quantidade) {
            throw new Error("Estoque insuficiente. Disponível: " + total);
        }

        let falta = dados.quantidade;
        for (const lote of lotes) {
            if (falta === 0) break;
            const retirar = Math.min(falta, lote.quantidade);
            lote.quantidade -= retirar;
            falta -= retirar;
        }
        return;
    }

    return pedir("/vendas", {
        method: "POST",
        headers: cabecalho(true),
        body: JSON.stringify({
            produto_id: dados.produto_id,
            quantidade: dados.quantidade,
            unidade: dados.unidade || "un",
        }),
    });
}

async function buscarVendas() {
    if (USAR_DADOS_FALSOS) return [];
    return pedir("/vendas", { headers: cabecalho() });
}

async function registrarPerda(dados) {
    if (USAR_DADOS_FALSOS) {
        const lote = lotesFalsos.find((l) => l.id === dados.lote_id);
        if (!lote) throw new Error("Lote não encontrado.");
        const retirar = dados.quantidade ?? lote.quantidade;
        if (retirar <= 0 || retirar > lote.quantidade) {
            throw new Error("Quantidade inválida para baixa.");
        }
        lote.quantidade -= retirar;
        return;
    }

    const corpo = {
        lote_id: dados.lote_id,
        motivo: dados.motivo,
    };
    if (dados.quantidade !== null) {
        corpo.quantidade = dados.quantidade;
    }

    return pedir("/perdas", {
        method: "POST",
        headers: cabecalho(true),
        body: JSON.stringify(corpo),
    });
}

async function buscarPerdas() {
    if (USAR_DADOS_FALSOS) return [];
    return pedir("/perdas", { headers: cabecalho() });
}

async function baixarVencidos() {
    if (USAR_DADOS_FALSOS) {
        const hoje = new Date().toISOString().slice(0, 10);
        let lotesBaixados = 0;
        let quantidadeTotal = 0;
        let custoTotal = 0;

        for (const lote of lotesFalsos) {
            if (lote.quantidade > 0 && lote.validade < hoje) {
                lotesBaixados++;
                quantidadeTotal += lote.quantidade;
                custoTotal += lote.quantidade * lote.custo_unitario;
                lote.quantidade = 0;
            }
        }
        return { lotes_baixados: lotesBaixados, quantidade_total: quantidadeTotal, custo_total: custoTotal };
    }

    return pedir("/perdas/vencidos", {
        method: "POST",
        headers: cabecalho(),
    });
}

const DIAS_CRITICO = 7;
const DIAS_ATENCAO = 30;

async function buscarVencimentos() {
    if (USAR_DADOS_FALSOS) {
        const agora = new Date();
        const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        const alertas = [];

        for (const lote of lotesFalsos) {
            if (lote.quantidade <= 0) continue;

            const [ano, mes, dia] = lote.validade.split("-").map(Number);
            const dataValidade = new Date(ano, mes - 1, dia);
            const diasRestantes = Math.round((dataValidade - hoje) / 86400000);

            if (diasRestantes <= DIAS_ATENCAO) {
                const prod = produtosFalsos.find((p) => p.id === lote.produto_id);
                let status = "Atenção";
                let cor = "#f39c12"; // amarelo/laranja claro

                if (diasRestantes < 0) {
                    status = "Vencido";
                    cor = "#c0392b"; // vermelho
                } else if (diasRestantes <= DIAS_CRITICO) {
                    status = "Crítico";
                    cor = "#e67e22"; // laranja forte
                }

                alertas.push({
                    produto: prod ? prod.nome : "Desconhecido",
                    quantidade: lote.quantidade,
                    unidade: prod ? prod.unidade_base : "",
                    validade: lote.validade,
                    dias_restantes: diasRestantes,
                    status,
                    cor,
                });
            }
        }

        // ordena do mais urgente (menor dias_restantes) para o menos urgente
        return alertas.sort((a, b) => a.dias_restantes - b.dias_restantes);
    }

        // ---- versão com a API de verdade ----
    const produtos = await listarProdutos();
    const unidades = {};
    for (const p of produtos) unidades[p.id] = p.unidade_base;

    const lotes = await pedir("/estoque/vencimentos?dias=" + DIAS_ATENCAO, {
        headers: cabecalho(),
    });

    return lotes.map((l) => {
        const dias = l.dias_para_vencer;
        let status = "Atenção";
        let cor = "#f39c12";

        if (dias < 0) {
            status = "Vencido";
            cor = "#c0392b";
        } else if (dias <= DIAS_CRITICO) {
            status = "Crítico";
            cor = "#e67e22";
        }

        return {
            produto: l.produto,
            quantidade: l.quantidade,
            unidade: unidades[l.produto_id] ?? "",
            validade: l.validade,
            dias_restantes: dias,
            status: status,
            cor: cor,
        };
    });
}

// ---------- telas ----------
function mostrarTela() {
    const token = localStorage.getItem("token");
    telaLogin.hidden = Boolean(token);
    telaEstoque.hidden = !token;
    if (token) carregarTudo();
}

async function carregarTudo() {
    try {
        
        await preencherSelects();
        await carregarEstoque();
        await carregarVencimentos();
        await atualizarDisponivelVenda();
        await carregarPerdas();
        await carregarVendas();
        await carregarVencimentos();
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
}



async function preencherSelects() {
    const categorias = await listarCategorias();
    const produtos = await listarProdutos();

    document.getElementById("prod-categoria").innerHTML = categorias
        .map((c) => `<option value="${c.id}">${c.nome}</option>`)
        .join("");

    document.getElementById("lote-produto").innerHTML = produtos
        .map((p) => `<option value="${p.id}">${p.nome}</option>`)
        .join("");

    document.getElementById("venda-produto").innerHTML = produtos
        .map((p) => `<option value="${p.id}">${p.nome}</option>`)
        .join("");

    document.getElementById("perda-produto").innerHTML = produtos
        .map((p) => `<option value="${p.id}">${p.nome}</option>`)
        .join("");

        await preencherLotesPerda();
}

async function preencherLotesPerda() {
    const produtoId = Number(document.getElementById("perda-produto").value);
    const select = document.getElementById("perda-lote");

    if (!produtoId) {
        select.innerHTML = "";
        atualizarMaxPerda();
        return;
    }

    const lotes = await listarLotes(produtoId);

    if (lotes.length === 0) {
        select.innerHTML = '<option value="">Sem lotes com estoque</option>';
        atualizarMaxPerda();
        return;
    }

    select.innerHTML = lotes
        .map((l) => `<option value="${l.id}" data-qtd="${l.quantidade}">Validade ${l.validade.split("-").reverse().join("/")} · ${Number(l.quantidade).toLocaleString("pt-BR")} un.</option>`)
        .join("");

    atualizarMaxPerda();
}

function atualizarMaxPerda() {
    const select = document.getElementById("perda-lote");
    const input = document.getElementById("perda-quantidade");
    const opcao = select.options[select.selectedIndex];

    if (opcao && opcao.dataset.qtd) {
        input.max = opcao.dataset.qtd;
    } else {
        input.removeAttribute("max");
    }
}

let estoqueAtual = [];

async function carregarEstoque() {
    estoqueAtual = await buscarEstoque();
    renderizarEstoque();
const cardProd = document.getElementById("card-produtos");
    if (cardProd) cardProd.textContent = estoqueAtual.length;

}

function renderizarEstoque() {
    const termo = (document.getElementById("busca-estoque")?.value || "").toLowerCase();
    const tbody = document.getElementById("lista-estoque");
    tbody.innerHTML = "";

    const filtrados = estoqueAtual.filter((item) =>
        item.produto.toLowerCase().includes(termo)
    );

    for (const item of filtrados) {
        tbody.innerHTML += `
            <tr>
                <td>${item.produto}</td>
                <td>${item.unidade}</td>
                <td>${Number(item.quantidade_total)}</td>
            </tr>`;
    }
}

async function carregarVencimentos() {
    const alertas = await buscarVencimentos();
    const cardAlertas = document.getElementById("card-alertas");
    if (cardAlertas) cardAlertas.textContent = alertas.length;

    const tbody = document.getElementById("lista-vencimentos");
    if (!tbody) return;
    tbody.innerHTML = "";

    for (const item of alertas) {
        const textoDias = item.dias_restantes < 0
            ? `Vencido há ${Math.abs(item.dias_restantes)} dia(s)`
            : item.dias_restantes === 0
                ? "Vence hoje"
                : `${item.dias_restantes} dia(s)`;

        tbody.innerHTML += `
            <tr style="color: ${item.cor}; font-weight: bold;">
                <td>${item.produto}</td>
                <td>${Number(item.quantidade)} ${item.unidade}</td>
                <td>${item.validade}</td>
                <td>${textoDias} (${item.status})</td>
            </tr>`;
    }
}


async function carregarPerdas() {
    const todasPerdas = await buscarPerdas();
    const corte = localStorage.getItem("corte_perdas");

    const btnRestaurar = document.getElementById("btn-restaurar-perdas");
    if (btnRestaurar) btnRestaurar.hidden = !corte;

    const perdas = corte
        ? todasPerdas.filter((item) => new Date(item.criado_em) > new Date(corte))
        : todasPerdas;

    const tbody = document.getElementById("lista-perdas");
    const resumo = document.getElementById("total-perdas");
    if (!tbody) return;
    tbody.innerHTML = "";

    let totalPrejuizo = 0;

    for (const item of perdas) {
        totalPrejuizo += Number(item.custo_total);

        const dataFormatada = new Date(item.criado_em).toLocaleDateString("pt-BR");
        const custoFormatado = Number(item.custo_total).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });

        tbody.innerHTML += `
            <tr>
                <td>${dataFormatada}</td>
                <td>${item.produto}</td>
                <td>${Number(item.quantidade)} ${item.unidade}</td>
                <td>${item.motivo || "-"}</td>
                <td>${custoFormatado}</td>
            </tr>`;
    }

    if (resumo) {
        resumo.textContent = "Prejuízo acumulado: " + totalPrejuizo.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });
    }

    const cardPrejuizo = document.getElementById("card-prejuizo");
    if (cardPrejuizo) {
        cardPrejuizo.textContent = totalPrejuizo.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });
    }
}

let vendasAtuais = [];

async function carregarVendas() {
    vendasAtuais = await buscarVendas();
    preencherAnosVendas();
    renderizarVendas();
}

function preencherAnosVendas() {
    const selectAno = document.getElementById("filtro-ano-vendas");
    if (!selectAno) return;

    const anoAtual = new Date().getFullYear();
    const anos = new Set([anoAtual, anoAtual + 1]);

    for (const item of vendasAtuais) {
        if (item.criado_em) {
            anos.add(Number(item.criado_em.slice(0, 4)));
        }
    }

    const listaAnos = Array.from(anos).sort((a, b) => b - a);
    const valorAnterior = selectAno.value;

    selectAno.innerHTML =
        '<option value="">Todos os anos</option>' +
        listaAnos.map((ano) => `<option value="${ano}">${ano}</option>`).join("");

    if (valorAnterior && listaAnos.includes(Number(valorAnterior))) {
        selectAno.value = valorAnterior;
    }
}

function renderizarVendas() {
    const mes = document.getElementById("filtro-mes-vendas")?.value || "";
    const ano = document.getElementById("filtro-ano-vendas")?.value || "";
    const tbody = document.getElementById("lista-vendas");
    const resumo = document.getElementById("total-vendas");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filtradas = vendasAtuais.filter((item) => {
        const anoItem = item.criado_em.slice(0, 4);
        const mesItem = item.criado_em.slice(5, 7);
        if (ano && anoItem !== ano) return false;
        if (mes && mesItem !== mes) return false;
        return true;
    });

    let faturamentoTotal = 0;

    for (const item of filtradas) {
        faturamentoTotal += Number(item.valor_total);

        const dataFormatada = new Date(item.criado_em).toLocaleDateString("pt-BR");
        const valorFormatado = Number(item.valor_total).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });

        tbody.innerHTML += `
            <tr>
                <td>${dataFormatada}</td>
                <td>${item.produto}</td>
                <td>${Number(item.quantidade)} ${item.unidade}</td>
                <td>${valorFormatado}</td>
            </tr>`;
    }

    if (resumo) {
        const prefixo = mes || ano ? "Faturamento do período: " : "Faturamento acumulado: ";
        resumo.textContent = prefixo + faturamentoTotal.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });
    }
}

async function atualizarDisponivelVenda() {
    const select = document.getElementById("venda-produto");
    const span = document.getElementById("venda-disponivel");
    const idSelecionado = Number(select.value);

    if (!idSelecionado) {
        span.textContent = "";
        return;
    }

    const itens = await buscarEstoque();
    const item = itens.find((i) => (i.produto_id || i.id) === idSelecionado);

    if (item) {
        span.textContent = `Disponível: ${Number(item.quantidade_total)} ${item.unidade}`;
    } else {
        span.textContent = "Disponível: 0";
    }
}

function sair() {
    localStorage.removeItem("token");
    mostrarTela();
}

// ---------- eventos ---------
document.getElementById("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    erroLogin.textContent = "";

    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;

    if (USAR_DADOS_FALSOS) {
        // qualquer e-mail e senha entram
        localStorage.setItem("token", "token-de-exemplo");
        mostrarTela();
        return;
    }

    // a API espera "username" (que é o e-mail) e "password"
    const dados = new URLSearchParams();
    dados.append("username", email);
    dados.append("password", senha);

    try {
        const resposta = await fetch(API + "/auth/login", {
            method: "POST",
            headers: { "ngrok-skip-browser-warning": "true" },
            body: dados,
        });
        const json = await resposta.json();

        if (!resposta.ok) {
            erroLogin.textContent = json.detail;
            return;
        }
        localStorage.setItem("token", json.access_token);
        mostrarTela();
    } catch (erro) {
        erroLogin.textContent = "Não foi possível conectar ao servidor.";
    }
});

document.getElementById("form-produto").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        await criarProduto({
            nome: document.getElementById("prod-nome").value,
            categoria_id: Number(document.getElementById("prod-categoria").value),
            unidade_base: document.getElementById("prod-unidade").value,
            preco_venda: Number(document.getElementById("prod-preco").value),
        });
        e.target.reset();
        await preencherSelects();
        mostrarMensagem("Produto cadastrado. Agora dê entrada no estoque dele.");
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
});

document.getElementById("form-lote").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        await criarLote({
            produto_id: Number(document.getElementById("lote-produto").value),
            quantidade: Number(document.getElementById("lote-quantidade").value),
            validade: document.getElementById("lote-validade").value,
            custo_unitario: Number(document.getElementById("lote-custo").value),
        });
        e.target.reset();
        await carregarEstoque();
        await carregarVencimentos();
        await atualizarDisponivelVenda();
        mostrarMensagem("Entrada registrada.");
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
});

document.getElementById("form-venda").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        await registrarVenda({
            produto_id: Number(document.getElementById("venda-produto").value),
            quantidade: Number(document.getElementById("venda-quantidade").value),
        });
        e.target.reset();
        await carregarEstoque();
        await carregarVendas();
        await carregarVencimentos();
        await atualizarDisponivelVenda();
        mostrarMensagem("Venda registrada.");
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
});

document.getElementById("form-perda").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        const loteId = Number(document.getElementById("perda-lote").value);
        if (!loteId) {
            throw new Error("Selecione um lote válido.");
        }

        const qtdTexto = document.getElementById("perda-quantidade").value.trim();
        const quantidade = qtdTexto === "" ? null : Number(qtdTexto);

        await registrarPerda({
            lote_id: loteId,
            quantidade: quantidade,
            motivo: document.getElementById("perda-motivo").value,
        });

        e.target.reset();
        await preencherLotesPerda();
        await carregarEstoque();
        await carregarVencimentos();
        await carregarPerdas();
        await atualizarDisponivelVenda();
        mostrarMensagem("Perda registrada.");
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
});

document.getElementById("btn-limpar-perdas")?.addEventListener("click", async () => {
    if (!confirm("Deseja limpar a lista atual para abrir espaço para novas perdas?")) return;
    localStorage.setItem("corte_perdas", new Date().toISOString());
    await carregarPerdas();
    mostrarMensagem("Histórico de perdas limpo na tela.");
});

document.getElementById("btn-restaurar-perdas")?.addEventListener("click", async () => {
    localStorage.removeItem("corte_perdas");
    await carregarPerdas();
    mostrarMensagem("Histórico completo restaurado.");
});

document.getElementById("filtro-mes-vendas")?.addEventListener("change", renderizarVendas);
document.getElementById("btn-todas-vendas")?.addEventListener("click", () => {
    const inputMes = document.getElementById("filtro-mes-vendas");
    if (inputMes) inputMes.value = "";
    renderizarVendas();
});
document.getElementById("filtro-mes-vendas")?.addEventListener("change", renderizarVendas);
document.getElementById("filtro-ano-vendas")?.addEventListener("change", renderizarVendas);
document.getElementById("busca-estoque")?.addEventListener("input", renderizarEstoque);
document.getElementById("perda-lote")?.addEventListener("change", atualizarMaxPerda);
document.getElementById("perda-produto")?.addEventListener("change", preencherLotesPerda);
document.getElementById("venda-produto")?.addEventListener("change", atualizarDisponivelVenda);
document.getElementById("btn-sair")?.addEventListener("click", sair);

document.getElementById("btn-baixar-vencidos")?.addEventListener("click", async () => {
    if (!confirm("Deseja dar baixa como perda em todos os lotes já vencidos?")) return;

    try {
        const resumo = await baixarVencidos();
        if (resumo.lotes_baixados === 0) {
            mostrarMensagem("Nenhum lote vencido para baixar.");
            return;
        }

        await preencherLotesPerda();
        await carregarEstoque();
        await carregarVencimentos();
        await carregarPerdas();
        await atualizarDisponivelVenda();
        mostrarMensagem(`${resumo.lotes_baixados} lote(s) vencido(s) baixado(s).`);
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }

});
    document.getElementById("btn-excluir-produto")?.addEventListener("click", async () => {
    const select = document.getElementById("lote-produto");
    const produtoId = Number(select.value);
    const nome = select.options[select.selectedIndex]?.text || "este produto";

    if (!produtoId) return;
    if (!confirm(`Deseja excluir o produto "${nome}"?`)) return;

    try {
        await excluirProduto(produtoId);
        await preencherSelects();
        await carregarEstoque();
        await carregarVencimentos();
        await atualizarDisponivelVenda();
        mostrarMensagem(`Produto "${nome}" excluído.`);
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
});


mostrarTela();
