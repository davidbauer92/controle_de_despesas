console.log("Início do carregamento do script.js"); // Linha adicionada para depuração

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
// Importar módulos de autenticação para Google Sign-In
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth'; 

// Configuração do Firebase (use suas credenciais do Firebase)
const firebaseConfig = {
    apiKey: "AIzaSyAaxjstnE3SBDZwcRfsVcIwbqUTqYCaHxA",
    authDomain: "controlededespesas-9869f.firebaseapp.com",
    projectId: "controlededespesas-9869f",
    storageBucket: "controlededespesas-9869f.firebasestorage.app",
    messagingSenderId: "52274036252",
    appId: "1:52274036252:web:58559e65bd37b38166e9d9",
    measurementId: "G-3B65ZE5ZBM"
};

// Inicialize o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // Inicializa o serviço de autenticação

// Arrays para armazenar os dados localmente APÓS carregados do Firestore
let pessoas = [];
let despesas = [];

let despesaEmEdicao = null;

let mesAtual = new Date().getMonth();
let modoEdicao = false;
let despesaEditando = { tipo: '', index: -1 };
// Variáveis para controle de ordenação
let ordenacaoAtual = { coluna: 'data', ordem: 'desc' }; // Por padrão, ordenar por data descendente (mais recente primeiro)

// Variável para controlar o estado de autenticação
let isAuthReady = false;
let currentUserId = null; // Variável para armazenar o UID do usuário atual
let currentUserEmail = null; // Nova variável para armazenar o e-mail do usuário

// Elementos do DOM
const formDespesa = document.getElementById('formDespesa');
const tabelaDespesas = document.getElementById('tabelaDespesas');
const btnCancelar = document.getElementById('btnCancelar');
const modalPessoa = document.getElementById('modalPessoa');
const formPessoa = document.getElementById('formPessoa');
const btnAdicionarPessoa = document.getElementById('btnAdicionarPessoa');
const btnCancelarPessoa = document.getElementById('btnCancelarPessoa');
const listaPessoas = document.getElementById('listaPessoas');

// Novos elementos para UI de autenticação
const authStatusDiv = document.createElement('div');
authStatusDiv.id = 'authStatus';
authStatusDiv.className = 'auth-status';
const loginButton = document.createElement('button');
loginButton.id = 'loginButton';
loginButton.className = 'btn-login';
loginButton.textContent = 'Entrar com Google';
const logoutButton = document.createElement('button');
logoutButton.id = 'logoutButton';
logoutButton.className = 'btn-logout';
logoutButton.textContent = 'Sair';
const userDisplay = document.createElement('span');
userDisplay.id = 'userDisplay';
userDisplay.className = 'user-display';

// Adiciona os elementos de autenticação ao header (ou outro local adequado no seu HTML)
document.querySelector('header').appendChild(authStatusDiv);
authStatusDiv.appendChild(userDisplay);
authStatusDiv.appendChild(loginButton);
authStatusDiv.appendChild(logoutButton);

// Estilos básicos para os botões de login/logout (pode ser movido para style.css)
const authStyle = document.createElement('style');
authStyle.textContent = `
    .auth-status {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: auto; /* Empurra para a direita no header */
        padding-right: 20px;
    }
    .user-display {
        font-weight: 500;
        color: #fff;
    }
    .btn-login, .btn-logout {
        padding: 8px 15px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 0.9em;
        transition: background-color 0.3s ease;
    }
    .btn-login {
        background-color: #4285F4; /* Google Blue */
        color: white;
    }
    .btn-login:hover {
        background-color: #357ae8;
    }
    .btn-logout {
        background-color: #e74c3c; /* Red */
        color: white;
    }
    .btn-logout:hover {
        background-color: #c0392b;
    }
`;
document.head.appendChild(authStyle);


// --- Início: Modal de Confirmação Customizado ---
let confirmCallback = null;
const confirmModal = document.createElement('div');
confirmModal.id = 'customConfirmModal';
confirmModal.className = 'modal';
confirmModal.innerHTML = `
    <div class="modal-content">
        <h3 id="confirmModalMessage"></h3>
        <div class="modal-buttons">
            <button id="confirmModalBtnConfirm">Sim</button>
            <button id="confirmModalBtnCancel">Não</button>
        </div>
    </div>
`;
document.body.appendChild(confirmModal);

// Estilos básicos para o modal de confirmação (pode ser movido para style.css)
const modalStyle = document.createElement('style');
modalStyle.textContent = `
    #customConfirmModal {
        display: none; /* Hidden by default */
        position: fixed; /* Stay in place */
        z-index: 1000; /* Sit on top */
        left: 0;
        top: 0;
        width: 100%; /* Full width */
        height: 100%; /* Full height */
        overflow: auto; /* Enable scroll if needed */
        background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
        padding-top: 60px;
    }
    #customConfirmModal .modal-content {
        background-color: #fefefe;
        margin: 5% auto; /* 5% from the top and centered */
        padding: 20px;
        border: 1px solid #888;
        width: 80%; /* Could be more responsive */
        max-width: 500px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        text-align: center;
    }
    #customConfirmModal .modal-buttons button {
        padding: 10px 20px;
        margin: 10px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 1em;
    }
    #customConfirmModal #confirmModalBtnConfirm {
        background-color: #e74c3c; /* Red for delete */
        color: white;
    }
    #customConfirmModal #confirmModalBtnCancel {
        background-color: #bdc3c7; /* Gray for cancel */
        color: #333;
    }
`;
document.head.appendChild(modalStyle);

function showConfirmModal(message, callback) {
    document.getElementById('confirmModalMessage').textContent = message;
    confirmCallback = callback;
    confirmModal.style.display = 'block';
}

function hideConfirmModal() {
    confirmModal.style.display = 'none';
    confirmCallback = null;
}

// Event listeners para os botões do modal de confirmação customizado
document.getElementById('confirmModalBtnConfirm').addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback(true);
    }
    hideConfirmModal();
});

document.getElementById('confirmModalBtnCancel').addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback(false);
    }
    hideConfirmModal();
});
// --- Fim: Modal de Confirmação Customizado ---


function preencherDataAtual() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');

    const dataAtual = `${ano}-${mes}-${dia}T${hora}:${minuto}`;
    document.getElementById('data').value = dataAtual;
}

function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR') + ' ' +
        data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Função para atualizar a tabela de despesas (agora usando dados do Firestore por usuário)
function atualizarTabela() {
    if (!isAuthReady || !currentUserId) { // Verifica se o usuário está autenticado e o UID está disponível
        console.log("Autenticação ou UID não prontos. Não carregando despesas.");
        return;
    }

    const tabela = document.getElementById('tabelaDespesas');
    const tbody = tabela.querySelector('tbody');
    tbody.innerHTML = ''; // Limpar a tabela antes de adicionar novos dados

    // Acessa a subcoleção 'despesas' do usuário atual
    getDocs(collection(db, 'users', currentUserId, 'despesas'))
        .then((querySnapshot) => {
            despesas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Ordenar as despesas antes de exibir
            const despesasOrdenadas = [...despesas].sort((a, b) => {
                let valA, valB;
                if (ordenacaoAtual.coluna === 'data') {
                    valA = new Date(a.data).getTime();
                    valB = new Date(b.data).getTime();
                } else if (ordenacaoAtual.coluna === 'valor') {
                    valA = a.valor;
                    valB = b.valor;
                } else { // tipo, descricao
                    valA = a[ordenacaoAtual.coluna].toLowerCase();
                    valB = b[ordenacaoAtual.coluna].toLowerCase();
                }

                if (valA < valB) return ordenacaoAtual.ordem === 'asc' ? -1 : 1;
                if (valA > valB) return ordenacaoAtual.ordem === 'asc' ? 1 : -1;
                return 0;
            });

            despesasOrdenadas.forEach((despesa) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(despesa.data).toLocaleString()}</td>
                    <td>${despesa.tipo}</td>
                    <td>${despesa.descricao}</td>
                    <td>R$ ${despesa.valor.toFixed(2)}</td>
                    <td>
                        <button onclick="window.editarDespesa('${despesa.id}')" class="btn-editar">Editar</button>
                        <button onclick="window.excluirDespesa('${despesa.id}')" class="btn-excluir">Excluir</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            atualizarIndicadoresOrdenacao();
            atualizarAnaliseOrcamento(); // Chamar aqui para garantir que o resumo seja atualizado
        })
        .catch((error) => {
            console.error("Erro ao carregar despesas do Firestore (por usuário): ", error);
            // Poderia mostrar um modal de erro aqui
        });
}

// Adicionar event listeners quando o documento estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    console.log('Documento carregado');

    // Event listener para o botão de login
    loginButton.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            console.log("Login com Google realizado com sucesso!");
        } catch (error) {
            console.error("Erro no login com Google:", error);
            // Tratar erro de login, talvez exibir uma mensagem para o usuário
        }
    });

    // Event listener para o botão de logout
    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            console.log("Logout realizado com sucesso!");
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    });

    // Listener para o estado de autenticação
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuário está logado
            currentUserId = user.uid; // Armazena o UID do usuário
            currentUserEmail = user.email; // Armazena o e-mail do usuário
            console.log("Estado de autenticação alterado: Usuário logado", currentUserId, currentUserEmail);
            isAuthReady = true; // Define que a autenticação está pronta

            userDisplay.textContent = `Logado como: ${currentUserEmail || 'Anônimo'}`;
            loginButton.style.display = 'none'; // Esconde o botão de login
            logoutButton.style.display = 'inline-block'; // Mostra o botão de logout

            // Agora que a autenticação está pronta, podemos carregar os dados
            preencherDataAtual();
            verificarMesAtual();
            atualizarTabela(); // Carrega despesas do Firestore (agora por usuário)
            carregarPessoasFirestore(); // Carrega pessoas do Firestore (agora também por usuário)
        } else {
            // Usuário está deslogado
            console.log("Estado de autenticação alterado: Usuário deslogado");
            isAuthReady = false;
            currentUserId = null; // Limpa o UID
            currentUserEmail = null; // Limpa o e-mail

            userDisplay.textContent = 'Não logado';
            loginButton.style.display = 'inline-block'; // Mostra o botão de login
            logoutButton.style.display = 'none'; // Esconde o botão de logout

            // Limpar dados ou exibir mensagem de login
            pessoas = [];
            despesas = [];
            atualizarListaPessoas();
            atualizarTabela(); // Limpa a tabela
            atualizarAnaliseOrcamento();
        }
    });


    // Event listeners para o modal de pessoa
    const btnAdicionarPessoa = document.getElementById('btnAdicionarPessoa');
    const btnCancelarPessoa = document.getElementById('btnCancelarPessoa');
    const formPessoa = document.getElementById('formPessoa');

    if (btnAdicionarPessoa) {
        btnAdicionarPessoa.addEventListener('click', () => {
            console.log('Botão adicionar pessoa clicado');
            abrirModalPessoa();
        });
    }

    if (btnCancelarPessoa) {
        btnCancelarPessoa.addEventListener('click', () => {
            console.log('Botão cancelar pessoa clicado');
            fecharModalPessoa();
        });
    }

    if (formPessoa) {
        formPessoa.addEventListener('submit', (e) => {
            console.log('Formulário de pessoa submetido');
            adicionarPessoa(e);
        });
    }
});

// Listener para o formulário de despesa
document.getElementById('formDespesa').addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('Formulário de despesa submetido');

    if (!isAuthReady || !currentUserId) { // Verifica se o usuário está autenticado e o UID está disponível
        console.warn("Autenticação ou UID não prontos. Não é possível adicionar/atualizar despesa.");
        // alert("Por favor, aguarde a autenticação para adicionar despesas."); // Ou um modal customizado
        return;
    }

    const data = document.getElementById('data').value;
    const tipo = document.getElementById('tipo').value;
    const descricao = document.getElementById('descricao').value;
    const valor = parseFloat(document.getElementById('valor').value);

    if (!data || !tipo || !descricao || isNaN(valor) || valor <= 0) {
        console.warn('Por favor, preencha todos os campos da despesa corretamente.');
        return;
    }

    console.log('Dados da despesa:', { data, tipo, descricao, valor });

    if (despesaEmEdicao) {
        // Atualizar despesa existente no Firestore (por usuário)
        updateDoc(doc(db, 'users', currentUserId, 'despesas', despesaEmEdicao.id), {
            data,
            tipo,
            descricao,
            valor
        })
            .then(() => {
                console.log('Despesa atualizada no Firestore (por usuário)');
                atualizarTabela(); // Recarrega a tabela do Firestore
                // Resetar o formulário e botão
                document.getElementById('descricao').value = '';
                document.getElementById('valor').value = '';
                preencherDataAtual();
                despesaEmEdicao = null;
                btnCancelar.style.display = 'none';
                document.getElementById('btnSalvar').textContent = "Adicionar Despesa"; // Restaurar texto do botão
            })
            .catch((error) => {
                console.error('Erro ao atualizar despesa no Firestore (por usuário):', error);
                // Poderia mostrar um modal de erro aqui
            });
    } else {
        // Adicionar nova despesa ao Firestore (por usuário)
        addDoc(collection(db, 'users', currentUserId, 'despesas'), {
            data,
            tipo,
            descricao,
            valor
        })
            .then(() => {
                console.log('Nova despesa adicionada ao Firestore (por usuário)');
                atualizarTabela(); // Recarrega a tabela do Firestore
                // Limpar o formulário após adicionar
                document.getElementById('descricao').value = '';
                document.getElementById('valor').value = '';
                preencherDataAtual();
            })
            .catch((error) => {
                console.error('Erro ao adicionar despesa ao Firestore (por usuário):', error);
                // Poderia mostrar um modal de erro aqui
            });
    }
});

function verificarMesAtual() {
    const mesAgora = new Date().getMonth();
    if (mesAgora !== mesAtual) {
        console.log('Estamos em um novo mês');
    } else {
        console.log('Ainda estamos no mês atual');
    }
}

// Tornar a função editarDespesa globalmente acessível
window.editarDespesa = function (id) {
    if (!isAuthReady || !currentUserId) { // Verifica se o usuário está autenticado e o UID está disponível
        console.warn("Autenticação ou UID não prontos. Não é possível editar despesa.");
        return;
    }
    // Acessa o documento da despesa do usuário atual
    getDoc(doc(db, 'users', currentUserId, 'despesas', id))
        .then((docSnapshot) => {
            if (docSnapshot.exists()) {
                const despesa = docSnapshot.data();

                // Preencher os campos com os dados da despesa
                document.getElementById('tipo').value = despesa.tipo;
                document.getElementById('descricao').value = despesa.descricao;
                document.getElementById('valor').value = despesa.valor;
                document.getElementById('data').value = despesa.data;

                // Alterar o texto do botão para "Salvar Edição"
                document.getElementById('btnSalvar').textContent = "Salvar Edição";

                // Armazenar o ID da despesa em edição
                despesaEmEdicao = { id: docSnapshot.id };
                btnCancelar.style.display = 'inline-block'; // Mostrar botão cancelar
            } else {
                console.warn("Despesa não encontrada para edição no Firestore (por usuário):", id);
            }
        })
        .catch((error) => {
            console.error("Erro ao carregar despesa para edição do Firestore (por usuário): ", error);
            // Poderia mostrar um modal de erro aqui
        });
};

// Tornar a função excluirDespesa globalmente acessível
window.excluirDespesa = function (id) {
    if (!isAuthReady || !currentUserId) { // Verifica se o usuário está autenticado e o UID está disponível
        console.warn("Autenticação ou UID não prontos. Não é possível excluir despesa.");
        return;
    }
    showConfirmModal('Tem certeza de que deseja excluir esta despesa?', (confirmed) => {
        if (confirmed) {
            // Exclui o documento da despesa do usuário atual
            deleteDoc(doc(db, 'users', currentUserId, 'despesas', id))
                .then(() => {
                    console.log("Despesa excluída com sucesso do Firestore (por usuário)!");
                    atualizarTabela(); // Recarrega a tabela do Firestore
                })
                .catch((error) => {
                    console.error(`Erro ao excluir despesa do Firestore (por usuário):`, error);
                });
        }
    });
};

// Tornar a função cancelarEdicao globalmente acessível
window.cancelarEdicao = function () {
    // Resetar o modo de edição
    modoEdicao = false;
    despesaEditando = { tipo: '', index: -1 };

    // Restaurar o texto do botão
    const btnSubmit = document.querySelector('#formDespesa button[type="submit"]');
    btnSubmit.textContent = 'Adicionar Despesa';

    // Esconder o botão cancelar
    document.getElementById('btnCancelar').style.display = 'none';

    // Limpar formulário
    document.getElementById('descricao').value = '';
    document.getElementById('valor').value = '';
    preencherDataAtual();
    despesaEmEdicao = null; // Limpar despesa em edição
};

// Tornar a função ordenarTabela globalmente acessível
window.ordenarTabela = function (coluna) {
    // Se clicar na mesma coluna, inverter a ordem
    if (ordenacaoAtual.coluna === coluna) {
        ordenacaoAtual.ordem = ordenacaoAtual.ordem === 'asc' ? 'desc' : 'asc';
    } else {
        // Nova coluna, começar com ordem descendente
        ordenacaoAtual.coluna = coluna;
        ordenacaoAtual.ordem = 'desc';
    }
    atualizarTabela(); // Recarrega e aplica indicadores visuais e a nova ordenação
};

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

// Função para atualizar a análise de orçamento (agora usando dados do Firestore por usuário para despesas e pessoas)
function atualizarAnaliseOrcamento() {
    if (!isAuthReady || !currentUserId) { // Verifica se o usuário está autenticado e o UID está disponível
        console.log("Autenticação ou UID não prontos. Não atualizando análise de orçamento.");
        return;
    }
    console.log('Atualizando análise de orçamento...');
    console.log('Pessoas:', pessoas); // Pessoas agora são do array local por enquanto

    // Buscar despesas do Firestore para o cálculo (do usuário atual)
    getDocs(collection(db, 'users', currentUserId, 'despesas'))
        .then((querySnapshotDespesas) => {
            const despesasFirestore = querySnapshotDespesas.docs.map(doc => doc.data());

            // Buscar pessoas do Firestore para o cálculo (do usuário atual)
            getDocs(collection(db, 'users', currentUserId, 'pessoas')) 
                .then((querySnapshotPessoas) => {
                    pessoas = querySnapshotPessoas.docs.map(doc => ({
                        id: doc.id,
                        nome: doc.data().nome,
                        salario: doc.data().salario
                    }));

                    const totalSalarios = pessoas.reduce((total, pessoa) => total + pessoa.salario, 0);
                    const totalDespesas = despesasFirestore.reduce((total, despesa) => total + despesa.valor, 0);
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
                        resumoPorPessoa.innerHTML = '<p class="no-data-message">Nenhuma pessoa cadastrada.</p>';
                        return;
                    }

                    pessoas.forEach(pessoa => {
                        const proporcaoSalario = totalSalarios > 0 ? (pessoa.salario / totalSalarios) : 0;
                        const contribuicaoPessoa = totalDespesas * proporcaoSalario;
                        const percentualPessoa = pessoa.salario > 0 ? (contribuicaoPessoa / pessoa.salario) * 100 : 0;
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
                })
                .catch((error) => {
                    console.error("Erro ao carregar pessoas para análise de orçamento do Firestore (por usuário):", error);
                });
        })
        .catch((error) => {
            console.error("Erro ao carregar despesas para análise de orçamento do Firestore (por usuário):", error);
        });
}

// Funções para gerenciar pessoas (agora usando Firestore por usuário)
function abrirModalPessoa() {
    console.log('Abrindo modal...');
    modalPessoa.style.display = 'block';
    formPessoa.reset();
}

function fecharModalPessoa() {
    console.log('Fechando modal...');
    modalPessoa.style.display = 'none';
    formPessoa.reset();
}

function adicionarPessoa(event) {
    event.preventDefault();
    console.log('Adicionando pessoa...');

    if (!isAuthReady || !currentUserId) {
        console.warn("Autenticação ou UID não prontos. Não é possível adicionar pessoa.");
        // alert("Por favor, aguarde a autenticação para adicionar pessoas."); // Ou um modal customizado
        return;
    }

    const nome = document.getElementById('nomePessoa').value;
    const salario = parseFloat(document.getElementById('salarioPessoa').value);

    if (!nome || !salario || salario <= 0) {
        console.warn('Por favor, preencha todos os campos corretamente.');
        return;
    }

    // Adicionar nova pessoa ao Firestore (coleção 'pessoas' do usuário)
    addDoc(collection(db, 'users', currentUserId, 'pessoas'), { nome, salario }) 
        .then((docRef) => {
            console.log(`Pessoa ${nome} salva no Firestore com ID: ${docRef.id}`);
            // Recarregar pessoas do Firestore para atualizar a UI
            carregarPessoasFirestore();
            // Fechar o modal e limpar o formulário
            fecharModalPessoa();
            formPessoa.reset();
        })
        .catch(error => {
            console.error(`Erro ao salvar pessoa ${nome} no Firestore (por usuário):`, error);
            // Em caso de erro, também fechar o modal e resetar o formulário para evitar que o usuário fique preso
            fecharModalPessoa();
            formPessoa.reset();
        });
}

// Tornar a função removerPessoa globalmente acessível
window.removerPessoa = function (id) {
    if (!isAuthReady || !currentUserId) {
        console.warn("Autenticação ou UID não prontos. Não é possível remover pessoa.");
        return;
    }
    showConfirmModal('Tem certeza que deseja remover esta pessoa?', (confirmed) => {
        if (confirmed) {
            // Exclui o documento da pessoa (coleção 'pessoas' do usuário)
            deleteDoc(doc(db, 'users', currentUserId, 'pessoas', id)) 
                .then(() => {
                    console.log(`Pessoa com ID ${id} removida do Firestore (por usuário).`);
                    carregarPessoasFirestore(); // Recarrega pessoas do Firestore
                })
                .catch(error => {
                    console.error(`Erro ao remover pessoa do Firestore (por usuário):`, error);
                });
        }
    });
};

function atualizarListaPessoas() {
    listaPessoas.innerHTML = '';
    if (pessoas.length === 0) {
        listaPessoas.innerHTML = '<p class="no-data-message">Nenhuma pessoa cadastrada.</p>';
        return;
    }
    pessoas.forEach(pessoa => {
        const card = document.createElement('div');
        card.className = 'pessoa-card';
        card.innerHTML = `
            <div class="pessoa-info">
                <div class="pessoa-nome">${pessoa.nome}</div>
                <div class="pessoa-salario">R$ ${pessoa.salario.toFixed(2)}</div>
            </div>
            <div class="pessoa-acoes">
                <button onclick="window.removerPessoa('${pessoa.id}')" class="btn-excluir">Remover</button>
            </div>
        `;
        listaPessoas.appendChild(card);
    });
}

// Função para carregar pessoas do Firestore (agora por usuário)
function carregarPessoasFirestore() {
    if (!isAuthReady || !currentUserId) {
        console.log("Autenticação não pronta ou UID não disponível. Não carregando pessoas.");
        return;
    }
    // Carrega pessoas da coleção 'pessoas' do usuário atual
    getDocs(collection(db, 'users', currentUserId, 'pessoas')) 
        .then(querySnapshot => {
            pessoas = querySnapshot.docs.map(doc => ({
                id: doc.id, // Usar o ID do documento Firestore
                nome: doc.data().nome,
                salario: doc.data().salario
            }));
            atualizarListaPessoas();
            atualizarAnaliseOrcamento();
        })
        .catch(error => console.error("Erro ao carregar pessoas do Firestore (por usuário):", error));
}