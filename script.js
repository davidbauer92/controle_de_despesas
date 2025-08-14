import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';

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
let despesaEmEdicaoId = null;
let ordenacaoAtual = { coluna: 'data', ordem: 'desc' };
let currentUserId = null;
let confirmCallback = null;

// --- SELETORES DO DOM ---
const DOMElements = {
    // Autenticação
    authContainer: document.getElementById('auth-container'),
    // Formulário de Despesa
    formDespesa: document.getElementById('formDespesa'),
    dataInput: document.getElementById('data'),
    btnSalvarDespesa: document.getElementById('btnSalvar'),
    btnCancelarDespesa: document.getElementById('btnCancelar'),
    // Tabela de Despesas
    tabelaDespesasBody: document.getElementById('tabelaDespesas').querySelector('tbody'),
    tabelaHeaders: document.querySelectorAll('#tabelaDespesas th.sortable'),
    // Seção Pessoas
    listaPessoasContainer: document.getElementById('listaPessoas'),
    btnAdicionarPessoa: document.getElementById('btnAdicionarPessoa'),
    // Modal Pessoa
    modalPessoa: document.getElementById('modalPessoa'),
    formPessoa: document.getElementById('formPessoa'),
    btnCancelarPessoa: document.getElementById('btnCancelarPessoa'),
    // Modal de Confirmação
    confirmModal: document.getElementById('customConfirmModal'),
    confirmModalMessage: document.getElementById('confirmModalMessage'),
    confirmModalBtnConfirm: document.getElementById('confirmModalBtnConfirm'),
    confirmModalBtnCancel: document.getElementById('confirmModalBtnCancel'),
    // Análise de Orçamento
    totalDespesasSpan: document.getElementById('totalDespesas'),
    valorDisponivelSpan: document.getElementById('valorDisponivel'),
    exibeSalarioSpan: document.getElementById('exibeSalario'),
    barraCompromisso: document.getElementById('barraCompromisso'),
    statusMensagem: document.getElementById('statusMensagem'),
    statusOrcamentoDiv: document.querySelector('.status-orcamento'),
    // Resumo por Pessoa
    resumoPorPessoaContainer: document.getElementById('resumoPorPessoa'),
};

// --- FUNÇÕES AUXILIARES ---
const formatCurrency = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateString) => new Date(dateString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const toggleModal = (modalElement, show) => modalElement.classList.toggle('active', show);

const showConfirmModal = (message, callback) => {
    DOMElements.confirmModalMessage.textContent = message;
    confirmCallback = callback;
    toggleModal(DOMElements.confirmModal, true);
};

const hideConfirmModal = () => {
    toggleModal(DOMElements.confirmModal, false);
    confirmCallback = null;
};

// --- LÓGICA DE AUTENTICAÇÃO ---
const updateAuthUI = (user) => {
    DOMElements.authContainer.innerHTML = ''; // Limpa o container
    if (user) {
        currentUserId = user.uid;
        const userDisplay = document.createElement('span');
        userDisplay.className = 'user-display';
        userDisplay.textContent = `Olá, ${user.displayName || user.email.split('@')[0]}`;
        
        const logoutButton = document.createElement('button');
        logoutButton.className = 'btn-logout';
        logoutButton.textContent = 'Sair';
        logoutButton.onclick = () => signOut(auth).catch(err => console.error("Erro no logout:", err));
        
        DOMElements.authContainer.append(userDisplay, logoutButton);
        loadInitialData();
    } else {
        currentUserId = null;
        const loginButton = document.createElement('button');
        loginButton.className = 'btn-login';
        loginButton.textContent = 'Entrar com Google';
        loginButton.onclick = async () => {
            try {
                await signInWithPopup(auth, new GoogleAuthProvider());
            } catch (error) {
                console.error("Erro no login com Google:", error);
            }
        };
        DOMElements.authContainer.appendChild(loginButton);
        clearUserData();
    }
};

const loadInitialData = () => {
    if (!currentUserId) return;
    preencherDataAtual();
    carregarDadosFirestore();
};

const clearUserData = () => {
    pessoas = [];
    despesas = [];
    atualizarListaPessoas();
    atualizarTabela();
    atualizarAnaliseOrcamento();
};

// --- LÓGICA DE PESSOAS ---
const carregarPessoasFirestore = async () => {
    const querySnapshot = await getDocs(collection(db, 'users', currentUserId, 'pessoas'));
    pessoas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    atualizarListaPessoas();
    atualizarAnaliseOrcamento();
};

const atualizarListaPessoas = () => {
    DOMElements.listaPessoasContainer.innerHTML = '';
    pessoas.forEach(pessoa => {
        const card = document.createElement('div');
        card.className = 'pessoa-card';
        card.innerHTML = `
            <div class="pessoa-info">
                <p class="pessoa-nome">${pessoa.nome}</p>
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
    const nome = DOMElements.formPessoa.nomePessoa.value.trim();
    const salario = parseFloat(DOMElements.formPessoa.salarioPessoa.value);
    
    if (nome && salario >= 0) {
        await setDoc(doc(db, 'users', currentUserId, 'pessoas', nome), { nome, salario });
        toggleModal(DOMElements.modalPessoa, false);
        DOMElements.formPessoa.reset();
        carregarPessoasFirestore();
    }
};

const handlePessoaActions = (event) => {
    const target = event.target;
    const id = target.dataset.id;
    if (!id) return;
    
    if (target.classList.contains('editar')) {
        const pessoa = pessoas.find(p => p.id === id);
        DOMElements.formPessoa.nomePessoa.value = pessoa.nome;
        DOMElements.formPessoa.salarioPessoa.value = pessoa.salario;
        toggleModal(DOMElements.modalPessoa, true);
    } else if (target.classList.contains('excluir')) {
        showConfirmModal(`Tem certeza que deseja excluir ${id}?`, async (confirmed) => {
            if (confirmed) {
                await deleteDoc(doc(db, 'users', currentUserId, 'pessoas', id));
                carregarPessoasFirestore();
            }
        });
    }
};

// --- LÓGICA DE DESPESAS ---
const carregarDespesasFirestore = async () => {
    const querySnapshot = await getDocs(collection(db, 'users', currentUserId, 'despesas'));
    despesas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    atualizarTabela();
    atualizarAnaliseOrcamento();
};

const atualizarTabela = () => {
    DOMElements.tabelaDespesasBody.innerHTML = '';
    
    const despesasOrdenadas = [...despesas].sort((a, b) => {
        const { coluna, ordem } = ordenacaoAtual;
        const valA = coluna === 'valor' ? a[coluna] : String(a[coluna]).toLowerCase();
        const valB = coluna === 'valor' ? b[coluna] : String(b[coluna]).toLowerCase();
        
        if (valA < valB) return ordem === 'asc' ? -1 : 1;
        if (valA > valB) return ordem === 'asc' ? 1 : -1;
        return 0;
    });
    
    despesasOrdenadas.forEach(despesa => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Data">${formatDate(despesa.data)}</td>
            <td data-label="Tipo">${despesa.tipo}</td>
            <td data-label="Descrição">${despesa.descricao}</td>
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
    const despesa = {
        data: DOMElements.dataInput.value,
        tipo: DOMElements.formDespesa.tipo.value,
        descricao: DOMElements.formDespesa.descricao.value.trim(),
        valor: parseFloat(DOMElements.formDespesa.valor.value),
    };
    
    try {
        if (despesaEmEdicaoId) {
            await updateDoc(doc(db, 'users', currentUserId, 'despesas', despesaEmEdicaoId), despesa);
        } else {
            await addDoc(collection(db, 'users', currentUserId, 'despesas'), despesa);
        }
        resetarFormularioDespesa();
        carregarDespesasFirestore();
    } catch (error) {
        console.error("Erro ao salvar despesa:", error);
    }
};

const handleDespesaActions = (event) => {
    const target = event.target;
    const id = target.dataset.id;
    if (!id) return;
    
    if (target.classList.contains('editar')) {
        const despesa = despesas.find(d => d.id === id);
        DOMElements.dataInput.value = despesa.data;
        DOMElements.formDespesa.tipo.value = despesa.tipo;
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
                carregarDespesasFirestore();
            }
        });
    }
};

const resetarFormularioDespesa = () => {
    DOMElements.formDespesa.reset();
    preencherDataAtual();
    despesaEmEdicaoId = null;
    DOMElements.btnSalvarDespesa.textContent = 'Adicionar Despesa';
    DOMElements.btnSalvarDespesa.classList.remove('modo-edicao');
    DOMElements.btnCancelarDespesa.classList.add('hidden');
};

const preencherDataAtual = () => {
    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    DOMElements.dataInput.value = agora.toISOString().slice(0, 16);
};

// --- ORDENAÇÃO E ANÁLISE ---
const ordenarTabela = (coluna) => {
    const novaOrdem = ordenacaoAtual.coluna === coluna && ordenacaoAtual.ordem === 'asc' ? 'desc' : 'asc';
    ordenacaoAtual = { coluna, ordem: novaOrdem };
    atualizarTabela();
};

const atualizarIndicadoresOrdenacao = () => {
    DOMElements.tabelaHeaders.forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.coluna === ordenacaoAtual.coluna) {
            th.classList.add(ordenacaoAtual.ordem);
        }
    });
};

const atualizarAnaliseOrcamento = () => {
    const totalSalarios = pessoas.reduce((acc, p) => acc + p.salario, 0);
    const totalDespesas = despesas.reduce((acc, d) => acc + d.valor, 0);
    const disponivel = totalSalarios - totalDespesas;
    const percentualComprometido = totalSalarios > 0 ? (totalDespesas / totalSalarios) * 100 : 0;
    
    DOMElements.totalDespesasSpan.textContent = formatCurrency(totalDespesas);
    DOMElements.valorDisponivelSpan.textContent = formatCurrency(disponivel);
    DOMElements.exibeSalarioSpan.textContent = formatCurrency(totalSalarios);
    DOMElements.barraCompromisso.style.width = `${Math.min(percentualComprometido, 100)}%`;
    
    // Atualiza status
    const { statusOrcamentoDiv, statusMensagem } = DOMElements;
    statusOrcamentoDiv.className = 'status-orcamento'; // Reseta classes
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

    // Atualiza resumo por pessoa
    atualizarResumoPorPessoa(totalDespesas, totalSalarios);
};

const atualizarResumoPorPessoa = (totalDespesas, totalSalarios) => {
    DOMElements.resumoPorPessoaContainer.innerHTML = '';
    if (pessoas.length === 0 || totalSalarios === 0) return;
    
    pessoas.forEach(pessoa => {
        const proporcaoSalario = pessoa.salario / totalSalarios;
        const despesaProporcional = totalDespesas * proporcaoSalario;
        const saldo = pessoa.salario - despesaProporcional;

        const resumoDiv = document.createElement('div');
        resumoDiv.className = 'resumo-pessoa';
        resumoDiv.innerHTML = `
            <p class="resumo-pessoa-nome">${pessoa.nome}</p>
            <div class="resumo-pessoa-valores">
                <p><span>Salário:</span> <span>${formatCurrency(pessoa.salario)}</span></p>
                <p><span>Despesa Proporcional:</span> <span>${formatCurrency(despesaProporcional)}</span></p>
                <p><strong>Saldo Estimado:</strong> <strong>${formatCurrency(saldo)}</strong></p>
            </div>
        `;
        DOMElements.resumoPorPessoaContainer.appendChild(resumoDiv);
    });
};

const carregarDadosFirestore = async () => {
    if (!currentUserId) return;
    await Promise.all([carregarPessoasFirestore(), carregarDespesasFirestore()]);
    atualizarAnaliseOrcamento();
};

// --- INICIALIZAÇÃO E EVENT LISTENERS ---
const initializeEventListeners = () => {
    DOMElements.formDespesa.addEventListener('submit', handleDespesaFormSubmit);
    DOMElements.btnCancelarDespesa.addEventListener('click', resetarFormularioDespesa);

    DOMElements.btnAdicionarPessoa.addEventListener('click', () => {
        DOMElements.formPessoa.reset();
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

    DOMElements.tabelaHeaders.forEach(th => {
        th.addEventListener('click', () => ordenarTabela(th.dataset.coluna));
    });

    onAuthStateChanged(auth, updateAuthUI);
};

// Inicia a aplicação
document.addEventListener('DOMContentLoaded', initializeEventListeners);