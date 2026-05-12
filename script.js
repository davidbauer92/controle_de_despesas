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
    apiKey: "AIzaSyAaxjstnE3SBDZwcRfsVcIwbqUTqYCaHxA",
    authDomain: "controlededespesas-9869f.firebaseapp.com",
    projectId: "controlededespesas-9869f",
    storageBucket: "controlededespesas-9869f.firebasestorage.app",
    messagingSenderId: "52274036252",
    appId: "1:52274036252:web:58559e65bd37b38166e9d9",
    measurementId: "G-3B65ZE5ZBM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- ESTADO DA APLICAÇÃO ---
let pessoas = [];
let despesas = [];
let userSettings = { emailPreferencial: '', ultimoMesFechado: '' };
let despesaEmEdicaoId = null;
let pessoaEmEdicaoId = null;
let ordenacaoAtual = { coluna: 'data', ordem: 'desc' };
let currentUserId = null;
let currentUserEmail = '';
let currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
let confirmCallback = null;

// --- SELETORES DO DOM ---
const DOMElements = {
    authContainer: document.getElementById('auth-container'),
    mainContent: document.querySelector('main'),
    formDespesa: document.getElementById('formDespesa'),
    dataInput: document.getElementById('data'),
    categoriaInput: document.getElementById('categoria'),
    btnSalvarDespesa: document.getElementById('btnSalvar'),
    btnCancelarDespesa: document.getElementById('btnCancelar'),
    tabelaDespesasBody: document.getElementById('tabelaDespesas').querySelector('tbody'),
    tabelaHeaders: document.querySelectorAll('#tabelaDespesas th.sortable'),
    listaPessoasContainer: document.getElementById('listaPessoas'),
    btnAdicionarPessoa: document.getElementById('btnAdicionarPessoa'),
    modalPessoa: document.getElementById('modalPessoa'),
    formPessoa: document.getElementById('formPessoa'),
    btnCancelarPessoa: document.getElementById('btnCancelarPessoa'),
    confirmModal: document.getElementById('customConfirmModal'),
    confirmModalMessage: document.getElementById('confirmModalMessage'),
    confirmModalBtnConfirm: document.getElementById('confirmModalBtnConfirm'),
    confirmModalBtnCancel: document.getElementById('confirmModalBtnCancel'),
    modalFechamento: document.getElementById('modalFechamento'),
    fechamentoMensagem: document.getElementById('fechamentoMensagem'),
    btnFechamentoSim: document.getElementById('btnFechamentoSim'),
    btnFechamentoNao: document.getElementById('btnFechamentoNao'),
    totalDespesasSpan: document.getElementById('totalDespesas'),
    valorDisponivelSpan: document.getElementById('valorDisponivel'),
    exibeSalarioSpan: document.getElementById('exibeSalario'),
    barraCompromisso: document.getElementById('barraCompromisso'),
    statusMensagem: document.getElementById('statusMensagem'),
    statusOrcamentoDiv: document.querySelector('.status-orcamento'),
    resumoPorPessoaContainer: document.getElementById('resumoPorPessoa'),
    mesAtualLabel: document.getElementById('mesAtualLabel'),
    btnMesAnterior: document.getElementById('btnMesAnterior'),
    btnMesAtual: document.getElementById('btnMesAtual'),
    btnProximoMes: document.getElementById('btnProximoMes'),
    emailPreferencialInput: document.getElementById('emailPreferencial'),
    btnSalvarEmail: document.getElementById('btnSalvarEmail'),
    btnEnviarResumo: document.getElementById('btnEnviarResumo'),
    toast: document.getElementById('toast')
};

// --- FUNÇÕES AUXILIARES ---
const formatCurrency = (value = 0) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateString) => new Date(dateString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const toggleModal = (modalElement, show) => modalElement?.classList.toggle('active', show);
const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const parseMonthKey = (monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month - 1, 1);
};
const getPreviousMonthKey = (monthKey = getMonthKey(new Date())) => {
    const date = parseMonthKey(monthKey);
    date.setMonth(date.getMonth() - 1);
    return getMonthKey(date);
};
const getMonthName = (monthKey) => parseMonthKey(monthKey).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const addMonths = (monthKey, quantity) => {
    const date = parseMonthKey(monthKey);
    date.setMonth(date.getMonth() + quantity);
    return getMonthKey(date);
};
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

const showToast = (message, type = 'info') => {
    if (!DOMElements.toast) return;
    DOMElements.toast.textContent = message;
    DOMElements.toast.className = `toast show ${type}`;
    setTimeout(() => DOMElements.toast.classList.remove('show'), 3500);
};

const showConfirmModal = (message, callback) => {
    DOMElements.confirmModalMessage.textContent = message;
    confirmCallback = callback;
    toggleModal(DOMElements.confirmModal, true);
};

const hideConfirmModal = () => {
    toggleModal(DOMElements.confirmModal, false);
    confirmCallback = null;
};

const getSettingsDocRef = () => doc(db, 'users', currentUserId, 'configuracoes', 'perfil');

// --- AUTENTICAÇÃO ---
const updateAuthUI = (user) => {
    DOMElements.authContainer.innerHTML = '';

    if (user) {
        currentUserId = user.uid;
        currentUserEmail = user.email || '';
        DOMElements.mainContent.classList.remove('bloqueado');

        const userDisplay = document.createElement('span');
        userDisplay.className = 'user-display';
        userDisplay.textContent = `Olá, ${user.displayName || user.email?.split('@')[0] || 'usuário'}`;

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
};

const loadInitialData = async () => {
    if (!currentUserId) return;
    preencherDataAtual(currentMonth);
    atualizarLabelMes();
    await carregarConfiguracoesUsuario();
    await carregarDadosFirestore();
    await verificarFechamentoMensal();
};

const clearUserData = () => {
    pessoas = [];
    despesas = [];
    userSettings = { emailPreferencial: '', ultimoMesFechado: '' };
    atualizarListaPessoas();
    atualizarTabela();
    atualizarAnaliseOrcamento();
    atualizarLabelMes();
};

// --- CONFIGURAÇÕES DO USUÁRIO ---
const carregarConfiguracoesUsuario = async () => {
    userSettings = { emailPreferencial: currentUserEmail, ultimoMesFechado: '' };

    try {
        const snapshot = await getDoc(getSettingsDocRef());
        if (snapshot.exists()) {
            userSettings = { ...userSettings, ...snapshot.data() };
        } else {
            await setDoc(getSettingsDocRef(), userSettings, { merge: true });
        }
    } catch (error) {
        console.warn('Não foi possível carregar/salvar configurações do perfil:', error);
        showToast('Não consegui carregar as configurações do perfil, mas seus cadastros serão carregados.', 'info');
    }

    DOMElements.emailPreferencialInput.value = userSettings.emailPreferencial || currentUserEmail || '';
};

const salvarEmailPreferencial = async () => {
    const email = DOMElements.emailPreferencialInput.value.trim();
    if (!email || !email.includes('@')) {
        showToast('Informe um e-mail válido.', 'error');
        return;
    }

    userSettings.emailPreferencial = email;

    try {
        await setDoc(getSettingsDocRef(), { emailPreferencial: email }, { merge: true });
        showToast('E-mail preferencial salvo.', 'success');
    } catch (error) {
        console.error('Erro ao salvar e-mail preferencial:', error);
        showToast('Erro ao salvar e-mail. Verifique as regras do Firestore.', 'error');
    }
};

// --- FECHAMENTO MENSAL ---
const verificarFechamentoMensal = async () => {
    const mesAtual = getMonthKey(new Date());
    const mesAnterior = getPreviousMonthKey(mesAtual);

    if (userSettings.ultimoMesFechado === mesAnterior) return;

    const despesasMesAnterior = await buscarDespesasPorMes(mesAnterior);
    if (despesasMesAnterior.length === 0) return;

    DOMElements.fechamentoMensagem.textContent = `O mês ${getMonthName(mesAnterior)} fechou. Seus registros mensais foram todos cadastrados?`;
    DOMElements.btnFechamentoSim.dataset.mes = mesAnterior;
    DOMElements.btnFechamentoNao.dataset.mes = mesAnterior;
    toggleModal(DOMElements.modalFechamento, true);
};

const confirmarFechamentoMensal = async () => {
    const mesFechado = DOMElements.btnFechamentoSim.dataset.mes;
    userSettings.ultimoMesFechado = mesFechado;
    await setDoc(getSettingsDocRef(), { ultimoMesFechado: mesFechado }, { merge: true });
    toggleModal(DOMElements.modalFechamento, false);

    const despesasMesFechado = await buscarDespesasPorMes(mesFechado);
    abrirEmailResumo(mesFechado, despesasMesFechado);
    showToast(`Mês ${getMonthName(mesFechado)} marcado como fechado.`, 'success');
};

const recusarFechamentoMensal = () => {
    const mes = DOMElements.btnFechamentoNao.dataset.mes;
    toggleModal(DOMElements.modalFechamento, false);
    currentMonth = mes;
    atualizarLabelMes();
    carregarDespesasFirestore();
    preencherDataAtual(mes);
    showToast(`Você voltou para ${getMonthName(mes)} para completar os cadastros.`, 'info');
};

// --- PESSOAS ---
const carregarPessoasFirestore = async () => {
    const querySnapshot = await getDocs(collection(db, 'users', currentUserId, 'pessoas'));
    pessoas = querySnapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
    pessoas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    atualizarListaPessoas();
    atualizarAnaliseOrcamento();
};

const atualizarListaPessoas = () => {
    DOMElements.listaPessoasContainer.innerHTML = '';
    if (pessoas.length === 0) {
        DOMElements.listaPessoasContainer.innerHTML = '<p class="empty-state">Nenhuma pessoa cadastrada ainda.</p>';
        return;
    }

    pessoas.forEach((pessoa) => {
        const card = document.createElement('div');
        card.className = 'pessoa-card';
        card.innerHTML = `
            <div class="pessoa-info">
                <p class="pessoa-nome">${escapeHtml(pessoa.nome)}</p>
                <p class="pessoa-salario">${formatCurrency(pessoa.salario)}</p>
            </div>
            <div class="pessoa-acoes">
                <button class="btn-acao editar" data-id="${pessoa.id}">Editar</button>
                <button class="btn-acao excluir" data-id="${pessoa.id}">Excluir</button>
            </div>
        `;
        DOMElements.listaPessoasContainer.appendChild(card);
    });
};

const handlePessoaFormSubmit = async (event) => {
    event.preventDefault();
    if (!currentUserId) return;

    const nome = DOMElements.formPessoa.nomePessoa.value.trim();
    const salario = parseFloat(DOMElements.formPessoa.salarioPessoa.value);

    if (!nome || Number.isNaN(salario) || salario < 0) {
        showToast('Preencha nome e salário corretamente.', 'error');
        return;
    }

    const dadosPessoa = { nome, salario };

    try {
        if (pessoaEmEdicaoId) {
            await updateDoc(doc(db, 'users', currentUserId, 'pessoas', pessoaEmEdicaoId), dadosPessoa);
            showToast('Pessoa atualizada.', 'success');
        } else {
            await addDoc(collection(db, 'users', currentUserId, 'pessoas'), dadosPessoa);
            showToast('Pessoa adicionada.', 'success');
        }

        pessoaEmEdicaoId = null;
        toggleModal(DOMElements.modalPessoa, false);
        DOMElements.formPessoa.reset();
        DOMElements.modalPessoa.querySelector('h3').textContent = 'Adicionar Pessoa';
        await carregarPessoasFirestore();
    } catch (error) {
        console.error('Erro ao salvar pessoa:', error);
        showToast('Erro ao salvar pessoa. Verifique as regras do Firestore.', 'error');
    }
};

const handlePessoaActions = (event) => {
    const target = event.target;
    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('editar')) {
        const pessoa = pessoas.find((p) => p.id === id);
        if (!pessoa) return;
        pessoaEmEdicaoId = id;
        DOMElements.formPessoa.nomePessoa.value = pessoa.nome;
        DOMElements.formPessoa.salarioPessoa.value = pessoa.salario;
        DOMElements.modalPessoa.querySelector('h3').textContent = 'Editar Pessoa';
        toggleModal(DOMElements.modalPessoa, true);
    } else if (target.classList.contains('excluir')) {
        const pessoa = pessoas.find((p) => p.id === id);
        showConfirmModal(`Tem certeza que deseja excluir ${pessoa?.nome || 'esta pessoa'}?`, async (confirmed) => {
            if (confirmed) {
                await deleteDoc(doc(db, 'users', currentUserId, 'pessoas', id));
                await carregarPessoasFirestore();
                showToast('Pessoa excluída.', 'success');
            }
        });
    }
};

// --- DESPESAS ---
const normalizarDespesaLegada = async (despesa) => {
    if (despesa.mesReferencia || !despesa.data || !currentUserId) return despesa;

    const mesReferencia = getMonthKey(new Date(despesa.data));
    const despesaAtualizada = { ...despesa, mesReferencia };

    try {
        await updateDoc(doc(db, 'users', currentUserId, 'despesas', despesa.id), { mesReferencia });
    } catch (error) {
        console.warn('Não foi possível atualizar despesa antiga com mesReferencia:', error);
    }

    return despesaAtualizada;
};

const despesaPertenceAoMes = (despesa, monthKey) => {
    if (despesa.mesReferencia) return despesa.mesReferencia === monthKey;
    if (!despesa.data) return false;
    return getMonthKey(new Date(despesa.data)) === monthKey;
};

const buscarDespesasPorMes = async (monthKey) => {
    const querySnapshot = await getDocs(collection(db, 'users', currentUserId, 'despesas'));
    const todasDespesas = await Promise.all(
        querySnapshot.docs.map((documento) => normalizarDespesaLegada({ id: documento.id, ...documento.data() }))
    );

    return todasDespesas.filter((despesa) => despesaPertenceAoMes(despesa, monthKey));
};

const carregarDespesasFirestore = async () => {
    despesas = await buscarDespesasPorMes(currentMonth);
    atualizarTabela();
    atualizarAnaliseOrcamento();
};

const atualizarTabela = () => {
    DOMElements.tabelaDespesasBody.innerHTML = '';

    if (despesas.length === 0) {
        DOMElements.tabelaDespesasBody.innerHTML = '<tr><td colspan="5" class="empty-state tabela-vazia">Nenhuma despesa cadastrada neste mês.</td></tr>';
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

    despesasOrdenadas.forEach((despesa) => {
        const categoriaTexto = despesa.categoria ? ` • ${escapeHtml(despesa.categoria)}` : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Data">${formatDate(despesa.data)}</td>
            <td data-label="Tipo">${escapeHtml(despesa.tipo)}${categoriaTexto}</td>
            <td data-label="Descrição">${escapeHtml(despesa.descricao)}</td>
            <td data-label="Valor">${formatCurrency(despesa.valor)}</td>
            <td data-label="Ações">
                <button class="btn-acao editar" data-id="${despesa.id}">Editar</button>
                <button class="btn-acao excluir" data-id="${despesa.id}">Excluir</button>
            </td>
        `;
        DOMElements.tabelaDespesasBody.appendChild(tr);
    });
    atualizarIndicadoresOrdenacao();
};

const handleDespesaFormSubmit = async (event) => {
    event.preventDefault();
    if (!currentUserId) return;

    const data = DOMElements.dataInput.value;
    const valor = parseFloat(DOMElements.formDespesa.valor.value);

    if (!data || !DOMElements.formDespesa.descricao.value.trim() || Number.isNaN(valor) || valor <= 0) {
        showToast('Preencha data, descrição e valor corretamente.', 'error');
        return;
    }

    const despesa = {
        data,
        tipo: DOMElements.formDespesa.tipo.value,
        categoria: DOMElements.categoriaInput.value.trim(),
        descricao: DOMElements.formDespesa.descricao.value.trim(),
        valor,
        mesReferencia: getMonthKey(new Date(data))
    };

    try {
        if (despesaEmEdicaoId) {
            await updateDoc(doc(db, 'users', currentUserId, 'despesas', despesaEmEdicaoId), despesa);
            showToast('Despesa atualizada.', 'success');
        } else {
            await addDoc(collection(db, 'users', currentUserId, 'despesas'), despesa);
            showToast('Despesa adicionada.', 'success');
        }
        currentMonth = despesa.mesReferencia;
        atualizarLabelMes();
        resetarFormularioDespesa();
        await carregarDespesasFirestore();
    } catch (error) {
        console.error('Erro ao salvar despesa:', error);
        showToast('Erro ao salvar despesa. Verifique as regras do Firestore.', 'error');
    }
};

const handleDespesaActions = (event) => {
    const target = event.target;
    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('editar')) {
        const despesa = despesas.find((d) => d.id === id);
        if (!despesa) return;
        DOMElements.dataInput.value = despesa.data;
        DOMElements.formDespesa.tipo.value = despesa.tipo;
        DOMElements.categoriaInput.value = despesa.categoria || '';
        DOMElements.formDespesa.descricao.value = despesa.descricao;
        DOMElements.formDespesa.valor.value = despesa.valor;

        despesaEmEdicaoId = id;
        DOMElements.btnSalvarDespesa.textContent = 'Salvar Edição';
        DOMElements.btnSalvarDespesa.classList.add('modo-edicao');
        DOMElements.btnCancelarDespesa.classList.remove('hidden');
    } else if (target.classList.contains('excluir')) {
        showConfirmModal('Tem certeza que deseja excluir esta despesa?', async (confirmed) => {
            if (confirmed) {
                await deleteDoc(doc(db, 'users', currentUserId, 'despesas', id));
                await carregarDespesasFirestore();
                showToast('Despesa excluída.', 'success');
            }
        });
    }
};

const resetarFormularioDespesa = () => {
    DOMElements.formDespesa.reset();
    preencherDataAtual(currentMonth);
    despesaEmEdicaoId = null;
    DOMElements.btnSalvarDespesa.textContent = 'Adicionar Despesa';
    DOMElements.btnSalvarDespesa.classList.remove('modo-edicao');
    DOMElements.btnCancelarDespesa.classList.add('hidden');
};

const preencherDataAtual = (monthKey = getMonthKey(new Date())) => {
    const agora = new Date();
    const selectedMonth = parseMonthKey(monthKey);

    if (getMonthKey(agora) === monthKey) {
        agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
        DOMElements.dataInput.value = agora.toISOString().slice(0, 16);
        return;
    }

    selectedMonth.setHours(12, 0, 0, 0);
    selectedMonth.setMinutes(selectedMonth.getMinutes() - selectedMonth.getTimezoneOffset());
    DOMElements.dataInput.value = selectedMonth.toISOString().slice(0, 16);
};

// --- MÊS, ORDENAÇÃO E ANÁLISE ---
const atualizarLabelMes = () => {
    DOMElements.mesAtualLabel.textContent = getMonthName(currentMonth);
};

const trocarMes = async (quantity) => {
    currentMonth = quantity === 0 ? getMonthKey(new Date()) : addMonths(currentMonth, quantity);
    atualizarLabelMes();
    preencherDataAtual(currentMonth);
    await carregarDespesasFirestore();
};

const ordenarTabela = (coluna) => {
    const novaOrdem = ordenacaoAtual.coluna === coluna && ordenacaoAtual.ordem === 'asc' ? 'desc' : 'asc';
    ordenacaoAtual = { coluna, ordem: novaOrdem };
    atualizarTabela();
};

const atualizarIndicadoresOrdenacao = () => {
    DOMElements.tabelaHeaders.forEach((th) => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.coluna === ordenacaoAtual.coluna) {
            th.classList.add(ordenacaoAtual.ordem);
        }
    });
};

const calcularResumoProporcional = (despesasBase = despesas) => {
    const totalSalarios = pessoas.reduce((acc, p) => acc + Number(p.salario || 0), 0);
    const totalDespesas = despesasBase.reduce((acc, d) => acc + Number(d.valor || 0), 0);

    return pessoas.map((pessoa) => {
        const salario = Number(pessoa.salario || 0);
        const participacao = totalSalarios > 0 ? salario / totalSalarios : 0;
        const despesaProporcional = totalDespesas * participacao;
        const saldo = salario - despesaProporcional;

        return {
            ...pessoa,
            salario,
            participacao,
            despesaProporcional,
            saldo
        };
    });
};

const atualizarAnaliseOrcamento = () => {
    const totalSalarios = pessoas.reduce((acc, p) => acc + Number(p.salario || 0), 0);
    const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor || 0), 0);
    const disponivel = totalSalarios - totalDespesas;
    const percentualComprometido = totalSalarios > 0 ? (totalDespesas / totalSalarios) * 100 : 0;

    DOMElements.totalDespesasSpan.textContent = formatCurrency(totalDespesas);
    DOMElements.valorDisponivelSpan.textContent = formatCurrency(disponivel);
    DOMElements.exibeSalarioSpan.textContent = formatCurrency(totalSalarios);
    DOMElements.barraCompromisso.style.width = `${Math.min(percentualComprometido, 100)}%`;

    const { statusOrcamentoDiv, statusMensagem } = DOMElements;
    statusOrcamentoDiv.className = 'status-orcamento';

    if (totalSalarios === 0) {
        statusMensagem.textContent = 'Adicione pessoas e salários para começar.';
    } else if (percentualComprometido <= 70) {
        statusMensagem.textContent = 'Orçamento saudável! ✅';
        statusOrcamentoDiv.classList.add('status-bom');
    } else if (percentualComprometido <= 95) {
        statusMensagem.textContent = 'Atenção! Orçamento apertado. ⚠️';
        statusOrcamentoDiv.classList.add('status-atencao');
    } else {
        statusMensagem.textContent = 'Perigo! Você gastou mais que o orçamento. ❌';
        statusOrcamentoDiv.classList.add('status-perigo');
    }

    atualizarResumoPorPessoa();
};

const atualizarResumoPorPessoa = () => {
    DOMElements.resumoPorPessoaContainer.innerHTML = '';
    if (pessoas.length === 0) {
        DOMElements.resumoPorPessoaContainer.innerHTML = '<p class="empty-state">Cadastre uma pessoa para ver o resumo proporcional.</p>';
        return;
    }

    const totalSalarios = pessoas.reduce((acc, p) => acc + Number(p.salario || 0), 0);
    const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor || 0), 0);

    if (totalSalarios <= 0) {
        DOMElements.resumoPorPessoaContainer.innerHTML = '<p class="empty-state">Informe pelo menos um salário maior que zero.</p>';
        return;
    }

    calcularResumoProporcional().forEach((pessoa) => {
        const resumoDiv = document.createElement('div');
        resumoDiv.className = 'resumo-pessoa';
        resumoDiv.innerHTML = `
            <p class="resumo-pessoa-nome">${escapeHtml(pessoa.nome)}</p>
            <div class="resumo-pessoa-valores">
                <p><span>Salário:</span> <span>${formatCurrency(pessoa.salario)}</span></p>
                <p><span>Participação na renda:</span> <span>${(pessoa.participacao * 100).toFixed(2)}%</span></p>
                <p><span>Parte das despesas:</span> <span>${formatCurrency(pessoa.despesaProporcional)}</span></p>
                <p><strong>Saldo estimado:</strong> <strong>${formatCurrency(pessoa.saldo)}</strong></p>
            </div>
        `;
        DOMElements.resumoPorPessoaContainer.appendChild(resumoDiv);
    });

};

const carregarDadosFirestore = async () => {
    if (!currentUserId) return;
    await carregarPessoasFirestore();
    await carregarDespesasFirestore();
};

// --- RESUMO POR E-MAIL ---
const gerarResumoMensal = (monthKey, despesasBase = despesas) => {
    const totalSalarios = pessoas.reduce((acc, pessoa) => acc + Number(pessoa.salario || 0), 0);
    const totalDespesas = despesasBase.reduce((acc, despesa) => acc + Number(despesa.valor || 0), 0);
    const linhas = [
        `Resumo financeiro de ${getMonthName(monthKey)}`,
        '',
        `Total familiar: ${formatCurrency(totalSalarios)}`,
        `Total de despesas: ${formatCurrency(totalDespesas)}`,
        `Saldo familiar estimado: ${formatCurrency(totalSalarios - totalDespesas)}`,
        '',
        'Rateio proporcional por renda:',
        ''
    ];

    calcularResumoProporcional(despesasBase).forEach((pessoa) => {
        linhas.push(`${pessoa.nome}:`);
        linhas.push(`- Salário: ${formatCurrency(pessoa.salario)}`);
        linhas.push(`- Participação na renda: ${(pessoa.participacao * 100).toFixed(2)}%`);
        linhas.push(`- Parte proporcional das despesas: ${formatCurrency(pessoa.despesaProporcional)}`);
        linhas.push(`- Saldo estimado: ${formatCurrency(pessoa.saldo)}`);
        linhas.push('');
    });

    linhas.push('Despesas cadastradas:');
    if (despesasBase.length === 0) {
        linhas.push('- Nenhuma despesa cadastrada neste mês.');
    } else {
        despesasBase
            .sort((a, b) => String(a.data).localeCompare(String(b.data)))
            .forEach((despesa) => {
                linhas.push(`- ${formatDate(despesa.data)} | ${despesa.tipo} | ${despesa.categoria || 'Sem categoria'} | ${despesa.descricao} | ${formatCurrency(despesa.valor)}`);
            });
    }

    return linhas.join('\n');
};

const abrirEmailResumo = (monthKey = currentMonth, despesasBase = despesas) => {
    const email = userSettings.emailPreferencial || currentUserEmail;
    if (!email) {
        showToast('Cadastre um e-mail preferencial antes de enviar.', 'error');
        return;
    }

    const subject = `Resumo financeiro - ${getMonthName(monthKey)}`;
    const body = gerarResumoMensal(monthKey, despesasBase);
    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
};

// --- EVENT LISTENERS ---
const initializeEventListeners = () => {
    DOMElements.formDespesa.addEventListener('submit', handleDespesaFormSubmit);
    DOMElements.btnCancelarDespesa.addEventListener('click', resetarFormularioDespesa);

    DOMElements.btnAdicionarPessoa.addEventListener('click', () => {
        pessoaEmEdicaoId = null;
        DOMElements.formPessoa.reset();
        DOMElements.modalPessoa.querySelector('h3').textContent = 'Adicionar Pessoa';
        toggleModal(DOMElements.modalPessoa, true);
    });
    DOMElements.btnCancelarPessoa.addEventListener('click', () => toggleModal(DOMElements.modalPessoa, false));
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

    DOMElements.tabelaHeaders.forEach((th) => th.addEventListener('click', () => ordenarTabela(th.dataset.coluna)));

    DOMElements.btnMesAnterior.addEventListener('click', () => trocarMes(-1));
    DOMElements.btnMesAtual.addEventListener('click', () => trocarMes(0));
    DOMElements.btnProximoMes.addEventListener('click', () => trocarMes(1));
    DOMElements.btnSalvarEmail.addEventListener('click', salvarEmailPreferencial);
    DOMElements.btnEnviarResumo.addEventListener('click', () => abrirEmailResumo(currentMonth, despesas));
    DOMElements.btnFechamentoSim.addEventListener('click', confirmarFechamentoMensal);
    DOMElements.btnFechamentoNao.addEventListener('click', recusarFechamentoMensal);

    onAuthStateChanged(auth, updateAuthUI);
};

document.addEventListener('DOMContentLoaded', initializeEventListeners);
