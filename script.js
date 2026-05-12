import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    setDoc
} from 'firebase/firestore';
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from 'firebase/auth';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    apiKey: 'AIzaSyAaxjstnE3SBDZwcRfsVcIwbqUTqYCaHxA',
    authDomain: 'controlededespesas-9869f.firebaseapp.com',
    projectId: 'controlededespesas-9869f',
    storageBucket: 'controlededespesas-9869f.firebasestorage.app',
    messagingSenderId: '52274036252',
    appId: '1:52274036252:web:58559e65bd37b38166e9d9',
    measurementId: 'G-3B65ZE5ZBM'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- ESTADO DA APLICAÇÃO ---
let pessoas = [];
let despesas = [];
let despesaEmEdicaoId = null;
let pessoaEmEdicaoId = null;
let ordenacaoAtual = { coluna: 'data', ordem: 'desc' };
let currentUserId = null;
let currentUserEmail = '';
let currentMonth = getMonthKey(new Date());
let userSettings = { emailPreferencial: '', ultimoMesFechado: '' };
let confirmCallback = null;

// --- SELETORES DO DOM ---
const DOMElements = {
    mainContent: document.getElementById('app'),
    authContainer: document.getElementById('auth-container'),
    formDespesa: document.getElementById('formDespesa'),
    dataInput: document.getElementById('data'),
    btnSalvarDespesa: document.getElementById('btnSalvar'),
    btnCancelarDespesa: document.getElementById('btnCancelar'),
    tipoInput: document.getElementById('tipo'),
    categoriaInput: document.getElementById('categoria'),
    descricaoInput: document.getElementById('descricao'),
    valorInput: document.getElementById('valor'),
    tabelaDespesasBody: document.getElementById('tabelaDespesas').querySelector('tbody'),
    tabelaHeaders: document.querySelectorAll('#tabelaDespesas th.sortable'),
    listaPessoasContainer: document.getElementById('listaPessoas'),
    btnAdicionarPessoa: document.getElementById('btnAdicionarPessoa'),
    modalPessoa: document.getElementById('modalPessoa'),
    modalPessoaTitulo: document.getElementById('modalPessoaTitulo'),
    formPessoa: document.getElementById('formPessoa'),
    btnCancelarPessoa: document.getElementById('btnCancelarPessoa'),
    confirmModal: document.getElementById('customConfirmModal'),
    confirmModalMessage: document.getElementById('confirmModalMessage'),
    confirmModalBtnConfirm: document.getElementById('confirmModalBtnConfirm'),
    confirmModalBtnCancel: document.getElementById('confirmModalBtnCancel'),
    totalDespesasSpan: document.getElementById('totalDespesas'),
    valorDisponivelSpan: document.getElementById('valorDisponivel'),
    exibeSalarioSpan: document.getElementById('exibeSalario'),
    percentualComprometidoSpan: document.getElementById('percentualComprometido'),
    barraCompromisso: document.getElementById('barraCompromisso'),
    statusMensagem: document.getElementById('statusMensagem'),
    statusOrcamentoDiv: document.querySelector('.status-orcamento'),
    resumoPorPessoaContainer: document.getElementById('resumoPorPessoa'),
    mesAtualLabel: document.getElementById('mesAtualLabel'),
    btnMesAnterior: document.getElementById('btnMesAnterior'),
    btnProximoMes: document.getElementById('btnProximoMes'),
    btnMesAtual: document.getElementById('btnMesAtual'),
    emailPreferencialInput: document.getElementById('emailPreferencial'),
    btnSalvarEmail: document.getElementById('btnSalvarEmail'),
    btnEnviarResumo: document.getElementById('btnEnviarResumo'),
    modalFechamento: document.getElementById('modalFechamento'),
    fechamentoMensagem: document.getElementById('fechamentoMensagem'),
    btnFechamentoSim: document.getElementById('btnFechamentoSim'),
    btnFechamentoNao: document.getElementById('btnFechamentoNao'),
    toast: document.getElementById('toast')
};

// --- FUNÇÕES AUXILIARES ---
function formatCurrency(value) {
    const numericValue = Number.isFinite(value) ? value : 0;
    return numericValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value) {
    const numericValue = Number.isFinite(value) ? value : 0;
    return `${numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function getMonthKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function getMonthFromDateString(dateString) {
    if (!dateString) return '';
    return getMonthKey(new Date(dateString));
}

function getMonthName(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function shiftMonth(monthKey, amount) {
    const [year, month] = monthKey.split('-').map(Number);
    return getMonthKey(new Date(year, month - 1 + amount, 1));
}

function getPreviousMonthKey(monthKey) {
    return shiftMonth(monthKey, -1);
}

function toggleModal(modalElement, show) {
    modalElement.classList.toggle('active', show);
}

function showToast(message, type = 'info') {
    DOMElements.toast.textContent = message;
    DOMElements.toast.className = `toast show ${type}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => DOMElements.toast.classList.remove('show'), 3500);
}

function showConfirmModal(message, callback) {
    DOMElements.confirmModalMessage.textContent = message;
    confirmCallback = callback;
    toggleModal(DOMElements.confirmModal, true);
}

function hideConfirmModal() {
    toggleModal(DOMElements.confirmModal, false);
    confirmCallback = null;
}

function getUserSettingsKey() {
    return `divisaoCasa:settings:${currentUserId}`;
}

function salvarConfiguracoesLocais() {
    if (!currentUserId) return;
    localStorage.setItem(getUserSettingsKey(), JSON.stringify(userSettings));
}

function carregarConfiguracoesLocais() {
    if (!currentUserId) return null;
    const raw = localStorage.getItem(getUserSettingsKey());
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error('Erro ao ler configurações locais:', error);
        return null;
    }
}

function atualizarLabelMes() {
    DOMElements.mesAtualLabel.textContent = getMonthName(currentMonth);
}

function preencherDataAtual(monthKey = currentMonth) {
    const agora = new Date();
    const hojeNoMesAtual = getMonthKey(agora) === monthKey;

    let dataBase;
    if (hojeNoMesAtual) {
        dataBase = agora;
    } else {
        const [year, month] = monthKey.split('-').map(Number);
        dataBase = new Date(year, month - 1, 1, 12, 0, 0);
    }

    dataBase.setMinutes(dataBase.getMinutes() - dataBase.getTimezoneOffset());
    DOMElements.dataInput.value = dataBase.toISOString().slice(0, 16);
}

// --- AUTENTICAÇÃO ---
function updateAuthUI(user) {
    DOMElements.authContainer.innerHTML = '';

    if (user) {
        currentUserId = user.uid;
        currentUserEmail = user.email || '';
        DOMElements.mainContent.classList.remove('bloqueado');

        const userDisplay = document.createElement('div');
        userDisplay.className = 'user-display';
        userDisplay.innerHTML = `<span>Conectado</span><strong>${user.displayName || user.email?.split('@')[0] || 'Usuário'}</strong>`;

        const logoutButton = document.createElement('button');
        logoutButton.className = 'btn-logout';
        logoutButton.textContent = 'Sair';
        logoutButton.onclick = () => signOut(auth).catch(() => showToast('Erro ao sair da conta.', 'error'));

        DOMElements.authContainer.append(userDisplay, logoutButton);
        loadInitialData();
    } else {
        currentUserId = null;
        currentUserEmail = '';
        DOMElements.mainContent.classList.add('bloqueado');

        const loginButton = document.createElement('button');
        loginButton.className = 'btn-login';
        loginButton.textContent = 'Entrar com Google';
        loginButton.onclick = async () => {
            try {
                await signInWithPopup(auth, new GoogleAuthProvider());
            } catch (error) {
                console.error('Erro no login com Google:', error);
                showToast('Não foi possível entrar com Google. Tente novamente.', 'error');
            }
        };

        DOMElements.authContainer.appendChild(loginButton);
        clearUserData();
    }
}

async function loadInitialData() {
    if (!currentUserId) return;
    preencherDataAtual();
    atualizarLabelMes();

    await carregarConfiguracoesUsuario();
    await carregarDadosFirestore();
    await verificarFechamentoMensal();
}

function clearUserData() {
    pessoas = [];
    despesas = [];
    userSettings = { emailPreferencial: '', ultimoMesFechado: '' };
    DOMElements.emailPreferencialInput.value = '';
    atualizarListaPessoas();
    atualizarTabela();
    atualizarAnaliseOrcamento();
    atualizarLabelMes();
}

// --- CONFIGURAÇÕES DO USUÁRIO ---
async function carregarConfiguracoesUsuario() {
    const configuracoesSalvas = carregarConfiguracoesLocais();

    userSettings = {
        emailPreferencial: currentUserEmail || '',
        ultimoMesFechado: '',
        ...(configuracoesSalvas || {})
    };

    DOMElements.emailPreferencialInput.value = userSettings.emailPreferencial || currentUserEmail || '';
}

async function salvarEmailPreferencial() {
    const email = DOMElements.emailPreferencialInput.value.trim();
    if (!email || !email.includes('@')) {
        showToast('Informe um e-mail válido.', 'error');
        return;
    }

    userSettings.emailPreferencial = email;
    salvarConfiguracoesLocais();
    showToast('E-mail preferencial salvo neste navegador.', 'success');
}

// --- FECHAMENTO MENSAL ---
async function verificarFechamentoMensal() {
    const mesAtual = getMonthKey(new Date());
    const mesAnterior = getPreviousMonthKey(mesAtual);

    if (userSettings.ultimoMesFechado === mesAnterior) return;

    const despesasMesAnterior = await buscarDespesasPorMes(mesAnterior);
    if (despesasMesAnterior.length === 0) return;

    DOMElements.fechamentoMensagem.textContent = `O mês ${getMonthName(mesAnterior)} fechou. Seus registros mensais foram todos cadastrados?`;
    DOMElements.btnFechamentoSim.dataset.mes = mesAnterior;
    DOMElements.btnFechamentoNao.dataset.mes = mesAnterior;
    toggleModal(DOMElements.modalFechamento, true);
}

async function confirmarFechamentoMensal() {
    const mesFechado = DOMElements.btnFechamentoSim.dataset.mes;
    if (!mesFechado) return;

    try {
        userSettings.ultimoMesFechado = mesFechado;
        salvarConfiguracoesLocais();
        toggleModal(DOMElements.modalFechamento, false);

        const despesasMesFechado = await buscarDespesasPorMes(mesFechado);
        gerarRelatorioPdf(mesFechado, despesasMesFechado);
        showToast(`Mês ${getMonthName(mesFechado)} marcado como fechado.`, 'success');
    } catch (error) {
        console.error('Erro ao fechar mês:', error);
        showToast('Não foi possível marcar o mês como fechado.', 'error');
    }
}

function recusarFechamentoMensal() {
    const mes = DOMElements.btnFechamentoNao.dataset.mes;
    if (!mes) return;

    toggleModal(DOMElements.modalFechamento, false);
    currentMonth = mes;
    atualizarLabelMes();
    preencherDataAtual(mes);
    carregarDespesasFirestore();
    showToast(`Você voltou para ${getMonthName(mes)} para completar os cadastros.`, 'info');
}

// --- PESSOAS ---
async function carregarPessoasFirestore() {
    try {
        const querySnapshot = await getDocs(collection(db, 'users', currentUserId, 'pessoas'));
        pessoas = querySnapshot.docs
            .map(documento => ({ id: documento.id, ...documento.data() }))
            .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

        atualizarListaPessoas();
    } catch (error) {
        console.error('Erro ao carregar pessoas:', error);
        showToast('Não foi possível carregar as pessoas cadastradas.', 'error');
    }
}

function atualizarListaPessoas() {
    DOMElements.listaPessoasContainer.innerHTML = '';

    if (pessoas.length === 0) {
        DOMElements.listaPessoasContainer.innerHTML = '<p class="empty-state">Cadastre as pessoas e suas rendas para calcular o rateio.</p>';
        return;
    }

    const totalSalarios = pessoas.reduce((acc, pessoa) => acc + Number(pessoa.salario || 0), 0);

    pessoas.forEach(pessoa => {
        const participacao = totalSalarios > 0 ? (Number(pessoa.salario || 0) / totalSalarios) * 100 : 0;
        const card = document.createElement('div');
        card.className = 'pessoa-card';
        card.innerHTML = `
            <div class="pessoa-info">
                <p class="pessoa-nome">${pessoa.nome}</p>
                <p class="pessoa-salario">${formatCurrency(Number(pessoa.salario || 0))}</p>
                <span class="pill">${formatPercent(participacao)} da renda</span>
            </div>
            <div class="pessoa-acoes">
                <button class="btn-acao editar" data-id="${pessoa.id}">Editar</button>
                <button class="btn-acao excluir" data-id="${pessoa.id}">Excluir</button>
            </div>
        `;
        DOMElements.listaPessoasContainer.appendChild(card);
    });
}

async function handlePessoaFormSubmit(event) {
    event.preventDefault();
    const nome = DOMElements.formPessoa.nomePessoa.value.trim();
    const salario = parseFloat(DOMElements.formPessoa.salarioPessoa.value);

    if (!nome || !Number.isFinite(salario) || salario < 0) {
        showToast('Informe nome e renda válidos.', 'error');
        return;
    }

    try {
        if (pessoaEmEdicaoId) {
            await updateDoc(doc(db, 'users', currentUserId, 'pessoas', pessoaEmEdicaoId), { nome, salario });
        } else {
            await addDoc(collection(db, 'users', currentUserId, 'pessoas'), { nome, salario });
        }

        toggleModal(DOMElements.modalPessoa, false);
        resetarFormularioPessoa();
        await carregarPessoasFirestore();
        atualizarAnaliseOrcamento();
        showToast('Pessoa salva com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao salvar pessoa:', error);
        showToast('Não foi possível salvar a pessoa.', 'error');
    }
}

function resetarFormularioPessoa() {
    pessoaEmEdicaoId = null;
    DOMElements.modalPessoaTitulo.textContent = 'Adicionar pessoa';
    DOMElements.formPessoa.reset();
}

function handlePessoaActions(event) {
    const target = event.target;
    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('editar')) {
        const pessoa = pessoas.find(p => p.id === id);
        if (!pessoa) return;

        pessoaEmEdicaoId = id;
        DOMElements.modalPessoaTitulo.textContent = 'Editar pessoa';
        DOMElements.formPessoa.nomePessoa.value = pessoa.nome;
        DOMElements.formPessoa.salarioPessoa.value = pessoa.salario;
        toggleModal(DOMElements.modalPessoa, true);
    } else if (target.classList.contains('excluir')) {
        const pessoa = pessoas.find(p => p.id === id);
        showConfirmModal(`Excluir ${pessoa?.nome || 'esta pessoa'}?`, async (confirmed) => {
            if (!confirmed) return;
            try {
                await deleteDoc(doc(db, 'users', currentUserId, 'pessoas', id));
                await carregarPessoasFirestore();
                atualizarAnaliseOrcamento();
                showToast('Pessoa excluída.', 'success');
            } catch (error) {
                console.error('Erro ao excluir pessoa:', error);
                showToast('Não foi possível excluir a pessoa.', 'error');
            }
        });
    }
}

// --- DESPESAS ---
async function carregarDespesasFirestore() {
    try {
        const todas = await buscarTodasDespesas();
        const despesasDoMes = [];

        for (const despesa of todas) {
            const mesDaDespesa = despesa.mesReferencia || getMonthFromDateString(despesa.data);

            if (!despesa.mesReferencia && mesDaDespesa) {
                updateDoc(doc(db, 'users', currentUserId, 'despesas', despesa.id), { mesReferencia: mesDaDespesa }).catch(() => {});
            }

            if (mesDaDespesa === currentMonth) {
                despesasDoMes.push({ ...despesa, mesReferencia: mesDaDespesa });
            }
        }

        despesas = despesasDoMes;
        atualizarTabela();
    } catch (error) {
        console.error('Erro ao carregar despesas:', error);
        showToast('Não foi possível carregar as despesas.', 'error');
    }
}

async function buscarTodasDespesas() {
    const querySnapshot = await getDocs(collection(db, 'users', currentUserId, 'despesas'));
    return querySnapshot.docs.map(documento => ({ id: documento.id, ...documento.data() }));
}

async function buscarDespesasPorMes(monthKey) {
    const todas = await buscarTodasDespesas();
    return todas.filter(despesa => (despesa.mesReferencia || getMonthFromDateString(despesa.data)) === monthKey);
}

function atualizarTabela() {
    DOMElements.tabelaDespesasBody.innerHTML = '';

    if (despesas.length === 0) {
        DOMElements.tabelaDespesasBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table">Nenhuma despesa cadastrada para este mês.</td>
            </tr>
        `;
        atualizarIndicadoresOrdenacao();
        return;
    }

    const despesasOrdenadas = [...despesas].sort((a, b) => {
        const { coluna, ordem } = ordenacaoAtual;
        const valA = coluna === 'valor' ? Number(a[coluna] || 0) : String(a[coluna] || '').toLowerCase();
        const valB = coluna === 'valor' ? Number(b[coluna] || 0) : String(b[coluna] || '').toLowerCase();

        if (valA < valB) return ordem === 'asc' ? -1 : 1;
        if (valA > valB) return ordem === 'asc' ? 1 : -1;
        return 0;
    });

    despesasOrdenadas.forEach(despesa => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Data">${formatDate(despesa.data)}</td>
            <td data-label="Tipo">${despesa.tipo || '-'}</td>
            <td data-label="Categoria">${despesa.categoria || '-'}</td>
            <td data-label="Descrição">${despesa.descricao || '-'}</td>
            <td data-label="Valor">${formatCurrency(Number(despesa.valor || 0))}</td>
            <td data-label="Ações">
                <button class="btn-acao editar" data-id="${despesa.id}">Editar</button>
                <button class="btn-acao excluir" data-id="${despesa.id}">Excluir</button>
            </td>
        `;
        DOMElements.tabelaDespesasBody.appendChild(tr);
    });

    atualizarIndicadoresOrdenacao();
}

async function handleDespesaFormSubmit(event) {
    event.preventDefault();

    const data = DOMElements.dataInput.value;
    const valor = parseFloat(DOMElements.valorInput.value);

    if (!data || !Number.isFinite(valor) || valor < 0) {
        showToast('Informe data e valor válidos.', 'error');
        return;
    }

    const despesa = {
        data,
        mesReferencia: getMonthFromDateString(data),
        tipo: DOMElements.tipoInput.value,
        categoria: DOMElements.categoriaInput.value.trim(),
        descricao: DOMElements.descricaoInput.value.trim(),
        valor
    };

    if (!despesa.descricao) {
        showToast('Informe a descrição da despesa.', 'error');
        return;
    }

    try {
        if (despesaEmEdicaoId) {
            await updateDoc(doc(db, 'users', currentUserId, 'despesas', despesaEmEdicaoId), despesa);
        } else {
            await addDoc(collection(db, 'users', currentUserId, 'despesas'), despesa);
        }

        currentMonth = despesa.mesReferencia;
        atualizarLabelMes();
        resetarFormularioDespesa();
        await carregarDespesasFirestore();
        atualizarAnaliseOrcamento();
        showToast('Despesa salva com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao salvar despesa:', error);
        showToast('Não foi possível salvar a despesa.', 'error');
    }
}

function handleDespesaActions(event) {
    const target = event.target;
    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('editar')) {
        const despesa = despesas.find(d => d.id === id);
        if (!despesa) return;

        DOMElements.dataInput.value = despesa.data;
        DOMElements.tipoInput.value = despesa.tipo || 'Fixa';
        DOMElements.categoriaInput.value = despesa.categoria || '';
        DOMElements.descricaoInput.value = despesa.descricao || '';
        DOMElements.valorInput.value = despesa.valor;

        despesaEmEdicaoId = id;
        DOMElements.btnSalvarDespesa.textContent = 'Salvar edição';
        DOMElements.btnSalvarDespesa.classList.add('modo-edicao');
        DOMElements.btnCancelarDespesa.classList.remove('hidden');
        DOMElements.formDespesa.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (target.classList.contains('excluir')) {
        showConfirmModal('Excluir esta despesa?', async (confirmed) => {
            if (!confirmed) return;
            try {
                await deleteDoc(doc(db, 'users', currentUserId, 'despesas', id));
                await carregarDespesasFirestore();
                atualizarAnaliseOrcamento();
                showToast('Despesa excluída.', 'success');
            } catch (error) {
                console.error('Erro ao excluir despesa:', error);
                showToast('Não foi possível excluir a despesa.', 'error');
            }
        });
    }
}

function resetarFormularioDespesa() {
    DOMElements.formDespesa.reset();
    preencherDataAtual(currentMonth);
    despesaEmEdicaoId = null;
    DOMElements.btnSalvarDespesa.textContent = 'Adicionar despesa';
    DOMElements.btnSalvarDespesa.classList.remove('modo-edicao');
    DOMElements.btnCancelarDespesa.classList.add('hidden');
}

// --- ORDENAÇÃO E ANÁLISE ---
function ordenarTabela(coluna) {
    const novaOrdem = ordenacaoAtual.coluna === coluna && ordenacaoAtual.ordem === 'asc' ? 'desc' : 'asc';
    ordenacaoAtual = { coluna, ordem: novaOrdem };
    atualizarTabela();
}

function atualizarIndicadoresOrdenacao() {
    DOMElements.tabelaHeaders.forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.coluna === ordenacaoAtual.coluna) {
            th.classList.add(ordenacaoAtual.ordem);
        }
    });
}

function atualizarAnaliseOrcamento() {
    const totalSalarios = pessoas.reduce((acc, pessoa) => acc + Number(pessoa.salario || 0), 0);
    const totalDespesas = despesas.reduce((acc, despesa) => acc + Number(despesa.valor || 0), 0);
    const disponivel = totalSalarios - totalDespesas;
    const percentualComprometido = totalSalarios > 0 ? (totalDespesas / totalSalarios) * 100 : 0;

    DOMElements.totalDespesasSpan.textContent = formatCurrency(totalDespesas);
    DOMElements.valorDisponivelSpan.textContent = formatCurrency(disponivel);
    DOMElements.exibeSalarioSpan.textContent = formatCurrency(totalSalarios);
    DOMElements.percentualComprometidoSpan.textContent = formatPercent(percentualComprometido);
    DOMElements.barraCompromisso.style.width = `${Math.min(percentualComprometido, 100)}%`;

    const { statusOrcamentoDiv, statusMensagem } = DOMElements;
    statusOrcamentoDiv.className = 'status-orcamento';

    if (totalSalarios === 0) {
        statusMensagem.textContent = 'Adicione pessoas e salários para começar.';
    } else if (percentualComprometido <= 70) {
        statusMensagem.textContent = 'Orçamento em faixa confortável.';
        statusOrcamentoDiv.classList.add('status-bom');
    } else if (percentualComprometido <= 95) {
        statusMensagem.textContent = 'Atenção: orçamento próximo do limite.';
        statusOrcamentoDiv.classList.add('status-atencao');
    } else {
        statusMensagem.textContent = 'Orçamento acima do recomendado para a renda cadastrada.';
        statusOrcamentoDiv.classList.add('status-perigo');
    }

    atualizarResumoPorPessoa(totalDespesas, totalSalarios);
    atualizarListaPessoas();
}

function atualizarResumoPorPessoa(totalDespesas, totalSalarios) {
    DOMElements.resumoPorPessoaContainer.innerHTML = '';

    if (pessoas.length === 0 || totalSalarios === 0) {
        DOMElements.resumoPorPessoaContainer.innerHTML = '<p class="empty-state">O rateio aparece aqui após o cadastro das rendas.</p>';
        return;
    }

    pessoas.forEach(pessoa => {
        const salario = Number(pessoa.salario || 0);
        const proporcaoSalario = salario / totalSalarios;
        const percentual = proporcaoSalario * 100;
        const despesaProporcional = totalDespesas * proporcaoSalario;
        const saldo = salario - despesaProporcional;

        const resumoDiv = document.createElement('div');
        resumoDiv.className = 'resumo-pessoa';
        resumoDiv.innerHTML = `
            <div class="resumo-header">
                <p class="resumo-pessoa-nome">${pessoa.nome}</p>
                <span class="pill">${formatPercent(percentual)}</span>
            </div>
            <div class="resumo-pessoa-valores">
                <p><span>Renda</span> <strong>${formatCurrency(salario)}</strong></p>
                <p><span>Parte das despesas</span> <strong>${formatCurrency(despesaProporcional)}</strong></p>
                <p><span>Saldo estimado</span> <strong>${formatCurrency(saldo)}</strong></p>
            </div>
        `;
        DOMElements.resumoPorPessoaContainer.appendChild(resumoDiv);
    });
}

async function carregarDadosFirestore() {
    if (!currentUserId) return;
    await Promise.all([carregarPessoasFirestore(), carregarDespesasFirestore()]);
    atualizarAnaliseOrcamento();
}

// --- RESUMO POR E-MAIL ---
function montarResumoTexto(monthKey, despesasBase = despesas) {
    const totalSalarios = pessoas.reduce((acc, pessoa) => acc + Number(pessoa.salario || 0), 0);
    const totalDespesas = despesasBase.reduce((acc, despesa) => acc + Number(despesa.valor || 0), 0);
    const disponivel = totalSalarios - totalDespesas;

    const linhasPessoas = pessoas.map(pessoa => {
        const salario = Number(pessoa.salario || 0);
        const proporcao = totalSalarios > 0 ? salario / totalSalarios : 0;
        return `${pessoa.nome}: renda ${formatCurrency(salario)} | participação ${formatPercent(proporcao * 100)} | parte das despesas ${formatCurrency(totalDespesas * proporcao)} | saldo estimado ${formatCurrency(salario - (totalDespesas * proporcao))}`;
    });

    const linhasDespesas = despesasBase
        .sort((a, b) => String(a.data).localeCompare(String(b.data)))
        .map(despesa => `- ${formatDate(despesa.data)} | ${despesa.categoria || despesa.tipo || 'Sem categoria'} | ${despesa.descricao || '-'} | ${formatCurrency(Number(despesa.valor || 0))}`);

    return [
        `Resumo financeiro - ${getMonthName(monthKey)}`,
        '',
        `Renda total: ${formatCurrency(totalSalarios)}`,
        `Despesas totais: ${formatCurrency(totalDespesas)}`,
        `Saldo disponível: ${formatCurrency(disponivel)}`,
        '',
        'Rateio proporcional:',
        ...(linhasPessoas.length ? linhasPessoas : ['Nenhuma pessoa cadastrada.']),
        '',
        'Lançamentos:',
        ...(linhasDespesas.length ? linhasDespesas : ['Nenhuma despesa cadastrada.'])
    ].join('\n');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('\"', '&quot;')
        .replaceAll("'", '&#039;');
}

function montarRelatorioHtml(monthKey = currentMonth, despesasBase = despesas) {
    const totalSalarios = pessoas.reduce((acc, pessoa) => acc + Number(pessoa.salario || 0), 0);
    const totalDespesas = despesasBase.reduce((acc, despesa) => acc + Number(despesa.valor || 0), 0);
    const disponivel = totalSalarios - totalDespesas;
    const email = (DOMElements.emailPreferencialInput.value || currentUserEmail || '').trim();

    const linhasPessoas = pessoas.map(pessoa => {
        const salario = Number(pessoa.salario || 0);
        const proporcao = totalSalarios > 0 ? salario / totalSalarios : 0;
        const parte = totalDespesas * proporcao;
        const saldo = salario - parte;

        return `
            <tr>
                <td>${escapeHtml(pessoa.nome)}</td>
                <td>${formatCurrency(salario)}</td>
                <td>${formatPercent(proporcao * 100)}</td>
                <td>${formatCurrency(parte)}</td>
                <td>${formatCurrency(saldo)}</td>
            </tr>
        `;
    }).join('');

    const linhasDespesas = [...despesasBase]
        .sort((a, b) => String(a.data).localeCompare(String(b.data)))
        .map(despesa => `
            <tr>
                <td>${formatDate(despesa.data)}</td>
                <td>${escapeHtml(despesa.tipo || '-')}</td>
                <td>${escapeHtml(despesa.categoria || '-')}</td>
                <td>${escapeHtml(despesa.descricao || '-')}</td>
                <td>${formatCurrency(Number(despesa.valor || 0))}</td>
            </tr>
        `).join('');

    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<title>Resumo financeiro - ${escapeHtml(getMonthName(monthKey))}</title>
<style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1f2933; margin: 0; background: #fff; }
    .toolbar { position: sticky; top: 0; background: #0f766e; color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .toolbar button { background: #fff; color: #0f766e; border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    main { padding: 28px; }
    h1 { margin: 0 0 4px; font-size: 26px; }
    h2 { margin: 28px 0 10px; font-size: 18px; color: #0f766e; }
    .muted { color: #667085; margin: 0 0 20px; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 22px 0; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; background: #f8fafc; }
    .card span { display: block; color: #667085; font-size: 12px; margin-bottom: 6px; }
    .card strong { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 8px; vertical-align: top; }
    th { background: #f1f5f9; color: #334155; }
    td:last-child, th:last-child { text-align: right; }
    .assinatura { margin-top: 28px; color: #667085; font-size: 12px; }
    @media print { .toolbar { display: none; } main { padding: 0; } body { background: #fff; } }
</style>
</head>
<body>
<div class="toolbar">
    <span>Relatório pronto. Na janela de impressão, escolha "Salvar como PDF".</span>
    <button onclick="window.print()">Imprimir / Salvar PDF</button>
</div>
<main>
    <h1>Resumo financeiro - ${escapeHtml(getMonthName(monthKey))}</h1>
    <p class="muted">Divisão proporcional de despesas pela renda familiar${email ? ` - ${escapeHtml(email)}` : ''}</p>

    <section class="cards">
        <div class="card"><span>Renda total</span><strong>${formatCurrency(totalSalarios)}</strong></div>
        <div class="card"><span>Despesas totais</span><strong>${formatCurrency(totalDespesas)}</strong></div>
        <div class="card"><span>Saldo disponível</span><strong>${formatCurrency(disponivel)}</strong></div>
    </section>

    <h2>Divisão proporcional</h2>
    <table>
        <thead><tr><th>Pessoa</th><th>Renda</th><th>Participação</th><th>Parte das despesas</th><th>Saldo estimado</th></tr></thead>
        <tbody>${linhasPessoas || '<tr><td colspan="5">Nenhuma pessoa cadastrada.</td></tr>'}</tbody>
    </table>

    <h2>Lançamentos do mês</h2>
    <table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead>
        <tbody>${linhasDespesas || '<tr><td colspan="5">Nenhuma despesa cadastrada.</td></tr>'}</tbody>
    </table>

    <p class="assinatura">Gerado pelo Divisão da Casa em ${new Date().toLocaleString('pt-BR')}.</p>
</main>
<script>setTimeout(() => window.print(), 600);</script>
</body>
</html>`;
}

function gerarRelatorioPdf(monthKey = currentMonth, despesasBase = despesas) {
    const email = (DOMElements.emailPreferencialInput.value || currentUserEmail || '').trim();
    if (!email || !email.includes('@')) {
        showToast('Informe e salve um e-mail válido antes de gerar o relatório.', 'error');
        return;
    }

    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
        showToast('Permita pop-ups para gerar o relatório em PDF.', 'error');
        return;
    }

    reportWindow.document.open();
    reportWindow.document.write(montarRelatorioHtml(monthKey, despesasBase));
    reportWindow.document.close();
    showToast('Relatório aberto. Escolha salvar como PDF na tela de impressão.', 'success');
}

// --- NAVEGAÇÃO DE MÊS ---
function mudarMes(amount) {
    currentMonth = shiftMonth(currentMonth, amount);
    atualizarLabelMes();
    preencherDataAtual(currentMonth);
    carregarDespesasFirestore().then(atualizarAnaliseOrcamento);
}

function voltarMesAtual() {
    currentMonth = getMonthKey(new Date());
    atualizarLabelMes();
    preencherDataAtual(currentMonth);
    carregarDespesasFirestore().then(atualizarAnaliseOrcamento);
}

// --- INICIALIZAÇÃO E EVENT LISTENERS ---
function initializeEventListeners() {
    DOMElements.formDespesa.addEventListener('submit', handleDespesaFormSubmit);
    DOMElements.btnCancelarDespesa.addEventListener('click', resetarFormularioDespesa);

    DOMElements.btnAdicionarPessoa.addEventListener('click', () => {
        resetarFormularioPessoa();
        toggleModal(DOMElements.modalPessoa, true);
    });

    DOMElements.btnCancelarPessoa.addEventListener('click', () => {
        resetarFormularioPessoa();
        toggleModal(DOMElements.modalPessoa, false);
    });

    DOMElements.formPessoa.addEventListener('submit', handlePessoaFormSubmit);
    DOMElements.listaPessoasContainer.addEventListener('click', handlePessoaActions);
    DOMElements.tabelaDespesasBody.addEventListener('click', handleDespesaActions);

    DOMElements.confirmModalBtnConfirm.addEventListener('click', () => {
        if (confirmCallback) confirmCallback(true);
        hideConfirmModal();
    });

    DOMElements.confirmModalBtnCancel.addEventListener('click', () => {
        if (confirmCallback) confirmCallback(false);
        hideConfirmModal();
    });

    DOMElements.tabelaHeaders.forEach(th => {
        th.addEventListener('click', () => ordenarTabela(th.dataset.coluna));
    });

    DOMElements.btnMesAnterior.addEventListener('click', () => mudarMes(-1));
    DOMElements.btnProximoMes.addEventListener('click', () => mudarMes(1));
    DOMElements.btnMesAtual.addEventListener('click', voltarMesAtual);
    DOMElements.btnSalvarEmail.addEventListener('click', salvarEmailPreferencial);
    DOMElements.btnEnviarResumo.addEventListener('click', () => gerarRelatorioPdf(currentMonth, despesas));
    DOMElements.btnFechamentoSim.addEventListener('click', confirmarFechamentoMensal);
    DOMElements.btnFechamentoNao.addEventListener('click', recusarFechamentoMensal);

    onAuthStateChanged(auth, updateAuthUI);
}

document.addEventListener('DOMContentLoaded', initializeEventListeners);
