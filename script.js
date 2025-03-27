let despesas = [];
let pessoas = [];
let despesaEmEdicao = null;

let mesAtual = new Date().getMonth();
let modoEdicao = false;
let despesaEditando = { tipo: '', index: -1 };
// Variáveis para controle de ordenação
let ordenacaoAtual = { coluna: 'data', ordem: 'desc' }; // Por padrão, ordenar por data descendente (mais recente primeiro)
// Variável para armazenar o salário mensal
let salarioMensal = 0;

// Elementos do DOM
const formDespesa = document.getElementById('formDespesa');
const tabelaDespesas = document.getElementById('tabelaDespesas');
const btnCancelar = document.getElementById('btnCancelar');
const modalPessoa = document.getElementById('modalPessoa');
const formPessoa = document.getElementById('formPessoa');
const btnAdicionarPessoa = document.getElementById('btnAdicionarPessoa');
const btnCancelarPessoa = document.getElementById('btnCancelarPessoa');
const listaPessoas = document.getElementById('listaPessoas');
const selectResponsavel = document.getElementById('responsavel');

function preencherDataAtual() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0'); // Corrigido: mês começa em 0
    const dia = String(agora.getDate()).padStart(2, '0');
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');
    
    const dataAtual = `${ano}-${mes}-${dia}T${hora}:${minuto}`;
    document.getElementById('data').value = dataAtual;
}

function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR') + ' ' + 
           data.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
}

function atualizarTabela() {
    const tbody = tabelaDespesas.querySelector('tbody');
    tbody.innerHTML = '';
    
    despesas.forEach(despesa => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(despesa.data).toLocaleString()}</td>
            <td>${despesa.tipo}</td>
            <td>${despesa.descricao}</td>
            <td>R$ ${despesa.valor.toFixed(2)}</td>
            <td>
                <button onclick="editarDespesa(${despesa.id})" class="btn-editar">Editar</button>
                <button onclick="excluirDespesa(${despesa.id})" class="btn-excluir">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    atualizarIndicadoresOrdenacao();
    atualizarResumo();
}

// Adicionar event listeners quando o documento estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    console.log('Documento carregado'); // Debug
    
    // Event listeners para o modal de pessoa
    const btnAdicionarPessoa = document.getElementById('btnAdicionarPessoa');
    const btnCancelarPessoa = document.getElementById('btnCancelarPessoa');
    const formPessoa = document.getElementById('formPessoa');
    
    if (btnAdicionarPessoa) {
        btnAdicionarPessoa.addEventListener('click', () => {
            console.log('Botão adicionar pessoa clicado'); // Debug
            abrirModalPessoa();
        });
    }
    
    if (btnCancelarPessoa) {
        btnCancelarPessoa.addEventListener('click', () => {
            console.log('Botão cancelar pessoa clicado'); // Debug
            fecharModalPessoa();
        });
    }
    
    if (formPessoa) {
        formPessoa.addEventListener('submit', (e) => {
            console.log('Formulário de pessoa submetido'); // Debug
            adicionarPessoa(e);
        });
    }
    
    // Outros event listeners existentes...
    preencherDataAtual();
    verificarMesAtual();
    carregarDados();
    atualizarTabela();
    atualizarResumo();
    atualizarAnaliseOrcamento();
});

document.getElementById('formDespesa').addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('Formulário submetido'); // Debug
    
    const data = document.getElementById('data').value;
    const tipo = document.getElementById('tipo').value;
    const descricao = document.getElementById('descricao').value;
    const valor = parseFloat(document.getElementById('valor').value);

    console.log('Dados da despesa:', { data, tipo, descricao, valor }); // Debug

    if (despesaEmEdicao) {
        // Atualizar despesa existente
        const index = despesas.findIndex(d => d.id === despesaEmEdicao.id);
        if (index !== -1) {
            despesas[index] = {
                id: despesaEmEdicao.id,
                data,
                tipo,
                descricao,
                valor
            };
            console.log('Despesa atualizada:', despesas[index]); // Debug
        }
    } else {
        // Adicionar nova despesa
        const novaDespesa = {
            id: Date.now(),
            data,
            tipo,
            descricao,
            valor
        };
        despesas.push(novaDespesa);
        console.log('Nova despesa adicionada:', novaDespesa); // Debug
    }
    
    salvarDados();
    atualizarTabela();
    atualizarAnaliseOrcamento();
    
    // Limpar o formulário após adicionar/editar
    document.getElementById('descricao').value = '';
    document.getElementById('valor').value = '';
    preencherDataAtual();
    
    // Resetar o modo de edição
    despesaEmEdicao = null;
    btnCancelar.style.display = 'none';
});

function verificarMesAtual() {
    const mesAgora = new Date().getMonth();
    if (mesAgora !== mesAtual) {
        console.log('Estamos em um novo mês');
    } else {
        console.log('Ainda estamos no mês atual');
    }
}

function salvarDados() {
    localStorage.setItem('dadosDespesas', JSON.stringify(despesas));
    localStorage.setItem('pessoas', JSON.stringify(pessoas));
}

function carregarDados() {
    console.log('Carregando dados...'); // Debug
    const dadosSalvos = localStorage.getItem('dadosDespesas');
    const pessoasSalvas = localStorage.getItem('pessoas');
    
    if (dadosSalvos) {
        despesas = JSON.parse(dadosSalvos);
        console.log('Despesas carregadas:', despesas); // Debug
    }
    
    if (pessoasSalvas) {
        pessoas = JSON.parse(pessoasSalvas);
        console.log('Pessoas carregadas:', pessoas); // Debug
    }
    
    // Atualizar todas as partes da interface
    atualizarListaPessoas();
    atualizarTabela();
    atualizarAnaliseOrcamento();
    atualizarResumo();
}

function editarDespesa(id) {
    const despesa = despesas.find(d => d.id === id);
    if (despesa) {
        document.getElementById('data').value = despesa.data.slice(0, 16);
        document.getElementById('tipo').value = despesa.tipo;
        document.getElementById('descricao').value = despesa.descricao;
        document.getElementById('valor').value = despesa.valor;
        document.getElementById('responsavel').value = despesa.responsavelId;
        
        despesaEmEdicao = despesa;
        btnCancelar.style.display = 'inline-block';
    }
}

function excluirDespesa(id) {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
        despesas = despesas.filter(d => d.id !== id);
        salvarDados();
        atualizarTabela();
        atualizarAnaliseOrcamento();
    }
}

function atualizarResumo() {
    const totalDespesas = despesas.reduce((total, despesa) => total + despesa.valor, 0);
    document.getElementById('totalGeral').textContent = `R$ ${totalDespesas.toFixed(2)}`;
}

function cancelarEdicao() {
    // Resetar o modo de edição
    modoEdicao = false;
    despesaEditando = { tipo: '', index: -1 };
    
    // Restaurar o texto do botão
    const btnSubmit = document.querySelector('#formDespesa button[type="submit"]');
    btnSubmit.textContent = 'Adicionar Despesa';
    btnSubmit.classList.remove('modo-edicao');
    
    // Esconder o botão cancelar
    document.getElementById('btnCancelar').style.display = 'none';
    
    // Limpar formulário
    document.getElementById('descricao').value = '';
    document.getElementById('valor').value = '';
    preencherDataAtual();
}

// Função para ordenar as despesas
function ordenarDespesas(despesas, coluna, ordem) {
    return despesas.sort((a, b) => {
        let valorA, valorB;
        
        // Extrair os valores a serem comparados com base na coluna
        switch(coluna) {
            case 'data':
                valorA = new Date(a.data);
                valorB = new Date(b.data);
                break;
            case 'tipo':
                valorA = a.tipo;
                valorB = b.tipo;
                break;
            case 'descricao':
                valorA = a.descricao.toLowerCase();
                valorB = b.descricao.toLowerCase();
                break;
            case 'valor':
                valorA = a.valor;
                valorB = b.valor;
                break;
            default:
                valorA = a.data;
                valorB = b.data;
        }
        
        // Determinar a direção da ordenação
        let resultado = 0;
        if (valorA < valorB) resultado = -1;
        if (valorA > valorB) resultado = 1;
        
        // Inverter para ordem descendente
        return ordem === 'asc' ? resultado : -resultado;
    });
}

// Função para ordenar a tabela
function ordenarTabela(coluna) {
    // Se clicar na mesma coluna, inverter a ordem
    if (ordenacaoAtual.coluna === coluna) {
        ordenacaoAtual.ordem = ordenacaoAtual.ordem === 'asc' ? 'desc' : 'asc';
    } else {
        // Nova coluna, começar com ordem descendente
        ordenacaoAtual.coluna = coluna;
        ordenacaoAtual.ordem = 'desc';
    }
    
    // Atualizar a tabela com a nova ordenação
    atualizarTabela();
}

// Função para atualizar os indicadores visuais de ordenação
function atualizarIndicadoresOrdenacao() {
    // Remover classes de todos os cabeçalhos
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
    });
    
    // Adicionar classe ao cabeçalho atual
    const thAtual = document.querySelector(`th.sortable[data-coluna="${ordenacaoAtual.coluna}"]`);
    if (thAtual) {
        thAtual.classList.add(ordenacaoAtual.ordem);
    }
}

function salvarSalario() {
    const salarioInput = document.getElementById('salarioMensal').value;
    
    if (!salarioInput || isNaN(salarioInput) || parseFloat(salarioInput) <= 0) {
        alert('Por favor, informe um valor válido para o salário.');
        return;
    }
    
    salarioMensal = parseFloat(salarioInput);
    localStorage.setItem('salarioMensal', salarioMensal.toString());
    
    atualizarAnaliseOrcamento();
}

function carregarSalario() {
    const salarioSalvo = localStorage.getItem('salarioMensal');
    if (salarioSalvo) {
        salarioMensal = parseFloat(salarioSalvo);
        document.getElementById('salarioMensal').value = salarioMensal;
    }
}

function atualizarAnaliseOrcamento() {
    console.log('Atualizando análise de orçamento...'); // Debug
    console.log('Pessoas:', pessoas); // Debug
    console.log('Despesas:', despesas); // Debug
    
    const totalSalarios = pessoas.reduce((total, pessoa) => total + pessoa.salario, 0);
    const totalDespesas = despesas.reduce((total, despesa) => total + despesa.valor, 0);
    const valorDisponivel = totalSalarios - totalDespesas;
    
    // Atualizar valores gerais
    document.getElementById('exibeSalario').textContent = `R$ ${totalSalarios.toFixed(2)}`;
    document.getElementById('totalDespesas').textContent = `R$ ${totalDespesas.toFixed(2)}`;
    document.getElementById('valorDisponivel').textContent = `R$ ${valorDisponivel.toFixed(2)}`;
    
    // Atualizar barra de progresso
    const percentualCompromisso = totalSalarios > 0 ? (totalDespesas / totalSalarios) * 100 : 0;
    document.getElementById('barraCompromisso').style.width = `${Math.min(percentualCompromisso, 100)}%`;
    
    // Atualizar status
    let statusMensagem = '';
    if (pessoas.length === 0) {
        statusMensagem = 'Adicione pessoas para ver análises';
        document.getElementById('statusMensagem').className = '';
    } else if (percentualCompromisso < 50) {
        statusMensagem = 'Orçamento saudável!';
        document.getElementById('statusMensagem').className = 'status-bom';
    } else if (percentualCompromisso < 80) {
        statusMensagem = 'Atenção: Orçamento comprometido!';
        document.getElementById('statusMensagem').className = 'status-atencao';
    } else {
        statusMensagem = 'Alerta: Orçamento crítico!';
        document.getElementById('statusMensagem').className = 'status-perigo';
    }
    document.getElementById('statusMensagem').textContent = statusMensagem;
    
    // Atualizar resumo por pessoa
    const resumoPorPessoa = document.getElementById('resumoPorPessoa');
    resumoPorPessoa.innerHTML = '';
    
    if (pessoas.length === 0) {
        resumoPorPessoa.innerHTML = '<p>Nenhuma pessoa cadastrada</p>';
        return;
    }
    
    pessoas.forEach(pessoa => {
        const proporcaoSalario = pessoa.salario / totalSalarios;
        const contribuicaoPessoa = totalDespesas * proporcaoSalario;
        const percentualPessoa = (contribuicaoPessoa / pessoa.salario) * 100;
        const valorDisponivelPessoa = pessoa.salario - contribuicaoPessoa;
        
        const resumo = document.createElement('div');
        resumo.className = 'resumo-pessoa';
        resumo.innerHTML = `
            <div class="resumo-pessoa-header">
                <span class="resumo-pessoa-nome">${pessoa.nome}</span>
                <span>${percentualPessoa.toFixed(1)}% do salário</span>
            </div>
            <div class="resumo-pessoa-valores">
                <p>Salário: R$ ${pessoa.salario.toFixed(2)}</p>
                <p>Contribuição: R$ ${contribuicaoPessoa.toFixed(2)}</p>
                <p>Disponível: R$ ${valorDisponivelPessoa.toFixed(2)}</p>
            </div>
        `;
        resumoPorPessoa.appendChild(resumo);
    });
}

// Funções para gerenciar pessoas
function abrirModalPessoa() {
    console.log('Abrindo modal...'); // Debug
    modalPessoa.style.display = 'block';
    formPessoa.reset();
}

function fecharModalPessoa() {
    console.log('Fechando modal...'); // Debug
    modalPessoa.style.display = 'none';
    formPessoa.reset();
}

function adicionarPessoa(event) {
    event.preventDefault();
    console.log('Adicionando pessoa...'); // Debug
    
    const nome = document.getElementById('nomePessoa').value;
    const salario = parseFloat(document.getElementById('salarioPessoa').value);
    
    if (!nome || !salario || salario <= 0) {
        alert('Por favor, preencha todos os campos corretamente.');
        return;
    }
    
    pessoas.push({ id: Date.now(), nome, salario });
    salvarDados();
    atualizarListaPessoas();
    atualizarAnaliseOrcamento();
    atualizarResumo();
    
    // Fechar o modal e limpar o formulário
    fecharModalPessoa();
    formPessoa.reset();
}

function removerPessoa(id) {
    if (confirm('Tem certeza que deseja remover esta pessoa?')) {
        pessoas = pessoas.filter(p => p.id !== id);
        salvarDados();
        atualizarListaPessoas();
        atualizarAnaliseOrcamento();
        atualizarResumo();
    }
}

function atualizarListaPessoas() {
    listaPessoas.innerHTML = '';
    pessoas.forEach(pessoa => {
        const card = document.createElement('div');
        card.className = 'pessoa-card';
        card.innerHTML = `
            <div class="pessoa-info">
                <div class="pessoa-nome">${pessoa.nome}</div>
                <div class="pessoa-salario">R$ ${pessoa.salario.toFixed(2)}</div>
            </div>
            <div class="pessoa-acoes">
                <button onclick="removerPessoa(${pessoa.id})" class="btn-excluir">Remover</button>
            </div>
        `;
        listaPessoas.appendChild(card);
    });
}

function atualizarSelectResponsavel() {
    selectResponsavel.innerHTML = '<option value="">Selecione o responsável</option>';
    pessoas.forEach(pessoa => {
        const option = document.createElement('option');
        option.value = pessoa.id;
        option.textContent = pessoa.nome;
        selectResponsavel.appendChild(option);
    });
}