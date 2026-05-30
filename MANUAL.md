# SGF - Sistema de Gestão de Frotas UNIOESTE (FADEC)
## 🖥️ Manual Operacional e Guia de Homologação (Passo a Passo)

Este documento apresenta o guia passo a passo para testes, validações e operação em tempo real do **Sistema de Gestão de Frotas (SGF)** customizado para a **UNIOESTE**. O sistema incorpora os melhores padrões de UX/UI observados em modernas plataformas SaaS (como Tess, Inner e Adapta), focando em **redução de cliques**, **zero retrabalho**, **barreiras contra erro humano** e **inteligência artificial integrada (Dola Assistente)**.

---

## 🚀 Como Executar o Sistema

O sistema foi preparado como uma aplicação **Full-Stack moderna (Express + React 18 + Vite)**.

1. **Sincronização em Tempo Real**: Na barra superior escura (**Admin-Gateway**), você verá o poller inteligente de telemetria ativo. Ele sincroniza o estado dos veículos a cada 8 segundos em segundo plano de forma não-bloqueante.
2. **Alternância de Perfis**: Para simular as diferentes ações operacionais sem precisar deslogar, basta alterar o **Perfil de Testes** na barra superior escura:
   * **👔 Administrador de Frotas**: foca em autorizações de viagens, relatórios analíticos estratégicos e monitoramento geral de custos.
   * **🚗 Motorista Credenciado**: foca em preencher checklists rápidos e monitorar viagens sob sua custódia.
   * **🛠️ Fiscal de Garagem**: foca em manutenções corretivas, abastecimentos e vistorias detalhadas de veículos na oficina.

---

## 🔮 Roteiro de Testes Passo a Passo (Casos de Uso Reais)

Siga estes 5 cenários para homologar o sistema e entender como cada feature se conecta.

### 🌟 Cenário 1: Monitoramento da Telemetria Ativa (Ao Vivo)
* **Objetivo**: Avaliar a variação em tempo real do status de combustível e odômetro dos carros que estão ativamente na estrada.
* **Passo a Passo**:
  1. Vá para o **Painel Geral (Dashboard)**.
  2. Observe o veículo **Chevrolet Spin (PU-2849)**. Ele possui o status **"Em Viagem"**.
  3. Com a aba de Telemetria ligada (botão `POLLEANDO (LIVE ATIVO)` habilitado na barra superior):
     * A cada 15 segundos, o veículo simula que está trafegando pela rodovia BR-277.
     * Seu odômetro subirá automaticamente de forma incremental e o combustível será gradualmente consumido.
     * Quando o nível de combustível da Spin atingir **≤ 20%**, um **Alerta Vermelho Crítico** piscará imediatamente no sistema e um evento será logged sob a trilha histórica de auditoria de forma assíncrona.
  4. Para pausar este comportamento, clique no botão azul/verde **"POLLEANDO"** para deixá-lo como **"PAUSADO"**.

---

### 🛡️ Cenário 2: Validação Antecipada de Checklist de Retorno (Prevenindo Erros)
* **Objetivo**: Testar o mecanismo inspirado nas melhores heurísticas de usabilidade para impedir que o motorista faça lançamentos errados (ex: digitar quilometragem menor por engano).
* **Passo a Passo**:
  1. No seletor de perfil, mude para **🚗 Motorista Credenciado**.
  2. Vá na aba **Vistoria & Checklist** no menu lateral.
  3. No seletor superior, marque a opção **"Registrar Retorno"**.
  4. **Passo 1 (Carro & Odo)**: Selecione o veículo **Toyota Hilux (PR-3082)**. O sistema informará que o odômetro atual gravado é de `145.210 km`.
  5. No campo de entrada de dados, digite um valor menor de quilometragem, por exemplo, `144.000` km (simulando um erro de digitação do motorista).
  6. Clique em **"Próxima Etapa"**.
  7. **Resultado esperado**: O sistema interceptará o clique imediatamente com uma barreira visual de erro contendo uma mensagem explicativa de negócios: *"Erro de Validação: Quilometragem de entrada não pode ser menor que o registro cadastrado..."*. O motorista é impedido de cometer este erro comum.
  8. Agora, altere para o valor correto: `145.350` km e avance com sucesso.

---

### 📋 Cenário 3: Fluxo Inteligente de Vistoria de Saída (Análise Condicional de Falhas)
* **Objetivo**: Entender como o sistema lida com falhas relatadas pelo condutor antes de sair da Unioeste.
* **Passo a Passo**:
  1. Permaneça na aba **Vistoria & Checklist** e escolha **"Liberar Saída"**.
  2. Selecione o veículo **Fiat Uno Mille (AE-9081)**. Digite um odômetro válido (ex: `298.500 km`). Avance de etapa.
  3. **Passo 2 (Filtros de Segurança)**: O sistema exibirá o grid interativo de conformidade mecânica.
  4. Desmarque o item **"Faróis e Lanternas Funcionais"** ou **"Sistema de Freios Operacional"**.
  5. Avance para o **Passo 3 (Assinatura)**. Escreva uma observação (ex: *"Farol esquerdo queimado"*).
  6. Role a página, digite seu nome e assine digitalmente clicando em **"Concluir Inspeção"**.
  7. **Resultado esperado**: Como os faróis ou freios são itens críticos de trânsito regulamentados pela UNIOESTE, o sistema detecta que o carro não tem condições seguras. O checklist é salvo como **"Reprovado"**, o status da Fiat Uno muda automaticamente para **"Manutenção"** na garagem central de Cascavel, e um alerta é enviado para a oficina.

---

### 👔 Cenário 4: Despacho e Aprovação de Nova Viagem
* **Objetivo**: Solicitar e aprovar viagens interagindo com as categorias regulamentares de CNH de Motoristas.
* **Passo a Passo**:
  1. No seletor de perfil, mude para **👔 Administrador de Frotas**.
  2. Vá para a aba **Viagens & Despacho** no menu lateral.
  3. Na listagem de viagens pendentes, você verá uma solicitação para **Foz do Iguaçu (PR) - Parque Tecnológico Itaipu** para a motorista **Ana Paula Lima** usando a **Toyota Hilux**.
  4. O Administrador do setor de transportes analisa a solicitação e as justificativas em um único clique sem sair da página.
  5. Clique no botão verde **"Autorizar Viagem"**.
  6. **Resultado esperado**: O despacho é consolidado na hora. O status da viagem se altera para **"Aprovada"**, a Hilux muda de status instantaneamente para **"Em Viagem"** e a motorista Ana Paula entra em modo cooperativo ativo de telemetria rodoviária.

---

### 🛠️ Cenário 5: Manutenções Corretivas e Entrada de Gastos
* **Objetivo**: Restaurar a integridade de um veículo na oficina e lançar abastecimentos para recompor combustível.
* **Passo a Passo**:
  1. Vá até o **Painel Geral (Dashboard)**.
  2. Sob as **Ações Rápidas de Operação** no Box esquerdo de gerenciamento, clique em **"Acionar Oficina"**.
  3. No modal que abrir, selecione o veículo **Renault Master Shutt Bus (OB-4828)** (que de acordo com a telemetria está paralisado para manutenção da embreagem).
  4. Digite a quilometragem atual (`195.430 km`), configure o Tipo como **"Manutenção"**, digite o Custo (ex: `1.850.00`) e preencha as notas com *"Troca completa do kit de embreagem LUK executada com garantia"*.
  5. Clique em **"Registrar Intervenção"**.
  6. **Resultado esperado**: O veículo Renault Master recupera imediatamente o status **"Disponível"** para uso de docentes e alunos, os alertas pendentes deste carro são expurgados da tela de controle e a próxima revisão preventiva é calculada pelo algoritmo em +10.000 km (`205.430 km`).

---

### 💬 Cenário 6: Assistente Conversacional Ativo (IA Dola)
* **Objetivo**: Extrair insights inteligentes por linguagem natural diretamente com a Assistente de Operações (Dola).
* **Passo a Passo**:
  1. Selecione a aba **Dola Assistente IA** no menu lateral.
  2. Clique em uma das sugestões rápidas abaixo do chat (ex: *"Quais veículos possuem alertas de revisão?"* ou *"Como está o status dos veículos?"*).
  3. Ou então digite sua pergunta personalizada:
     * *"O motorista Carlos Eduardo está apto a dirigir este mês?"*
     * *"A nossa Spin está na reserva de combustível?"*
  4. Clique em **Enviar** (ou clique na tecla Enter).
  5. **Resultado esperado**: A Dola buscará em real-time o estado na memória do nosso servidor integrado da UNIOESTE. Se sua chave `GEMINI_API_KEY` estiver configurada no sistema, ela usará inteligência generativa de profunda correspondência contextual; caso contrário, ela responderá perfeitamente usando o motor heurístico de contingência offline estruturado para prever as necessidades do analista de frota locais.

---
*UNIOESTE - Compromisso com a eficiência do transporte público estadual.*
