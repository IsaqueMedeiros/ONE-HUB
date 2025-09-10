# Documentação Técnica - Journey Deal Analyzer

## 📋 Visão Geral

O **Journey Deal Analyzer** é uma aplicação HubSpot que analisa automaticamente a jornada de clientes, posicionando-os em etapas específicas (Prospecção, Onboarding, Relacionamento) com base em regras de negócio predefinidas. A aplicação oferece visualização em tempo real através de um board interativo dentro da interface do HubSpot.

## 🏗️ Arquitetura da Solução

### Diagrama de Arquitetura

```
HubSpot CRM → HubSpot App → Funções Serverless → Card React → Board Visual
     ↓              ↓              ↓               ↓           ↓
  [Deals &      [Auth &        [Análise &      [Interface   [Visualização
  Contacts]     API Access]    Scoring]        Interativa]  Tabuleiro]
```

### Componentes Principais

1. **HubSpot App** (`src/app/app-hsmeta.json`)
   - Autenticação estática
   - Permissões para CRM objects (deals/contacts)
   - Configuração de URLs permitidas

2. **Card React** (`src/app/cards/journey-board-card.jsx`)
   - Interface visual estilo "Lovable Board"
   - Exibição em tempo real do estágio da jornada
   - Integração nativa com HubSpot UI Extensions

3. **Funções Serverless**
   - `analyzeJourney.js` - Lógica principal de análise
   - `getHubSpotData.js` - Integração com HubSpot API

4. **API REST** (`src/api/journey.js`)
   - Endpoint GET /journey/:id
   - Resposta JSON padronizada

## 🔄 Regras de Negócio

### Fluxograma das Regras da Jornada

```
┌─────────────────┐
│    DEAL STAGE   │
└─────┬───────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│ appointmentscheduled | presentationscheduled               │
│ ► PROSPECÇÃO                                               │
│   ├── proposal_sent = true → "Proposta Enviada"           │
│   └── proposal_sent = false → "Contato Inicial"           │
└─────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│ contractsent | closedwon + first_deposit_date != null      │
│ ► ONBOARDING                                               │
│   ├── allocation_done = true → "Implementação"            │
│   └── allocation_done = false → "Contrato Assinado"       │
└─────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│ whatsapp_cadence_active = true + last_meeting_date ≤ 90d  │
│ ► RELACIONAMENTO                                           │
│   └── "Cliente Ativo"                                     │
└─────────────────────────────────────────────────────────────┘
```

### Regra de Desempate

**Prioridade:** Relacionamento > Onboarding > Prospecção

Quando múltiplas condições são verdadeiras, a etapa mais avançada prevalece.

### Tabela de Regras Detalhadas

| Etapa | Condições Principais | Sub-etapa | Condição Sub-etapa |
|-------|---------------------|-----------|-------------------|
| **Prospecção** | `dealstage` ∈ {appointmentscheduled, presentationscheduled} | Contato Inicial | `proposal_sent` = false |
| | | Proposta Enviada | `proposal_sent` = true |
| **Onboarding** | `dealstage` ∈ {contractsent, closedwon} **E** `first_deposit_date` ≠ null | Contrato Assinado | `allocation_done` = false |
| | | Implementação | `allocation_done` = true |
| **Relacionamento** | `whatsapp_cadence_active` = true **E** `last_meeting_date` ≤ 90 dias | Cliente Ativo | Condição padrão |

## 💻 Implementação Técnica

### Função Pura de Análise

```javascript
function analyzeJourney(deal, contact) {
  // Entrada: Objeto Deal + Objeto Contact
  // Saída: { stage, substage, score, recommendations, metadata }
}
```

**Características:**
- ✅ Função pura (sem efeitos colaterais)
- ✅ Entrada determinística produz saída consistente
- ✅ Testável isoladamente
- ✅ Reutilizável em diferentes contextos

### Sistema de Scoring

| Etapa | Score Base | Bônus |
|-------|-----------|-------|
| Prospecção | 20 | +15 (Proposta Enviada) |
| Onboarding | 50 | +20 (Implementação) |
| Relacionamento | 80 | - |
| Indefinido | 10 | - |

### Endpoint API

```http
GET /journey/:id
```

**Resposta:**
```json
{
  "dealId": "123",
  "contactId": "456", 
  "stage": "ONBOARDING",
  "stageName": "Onboarding",
  "substage": "IMPLEMENTATION",
  "substageName": "Implementação",
  "score": 70,
  "indicators": ["Deal de alto valor"],
  "recommendations": ["Acompanhar implementação"],
  "metadata": {
    "analyzedAt": "2024-11-10T10:00:00Z",
    "daysInCurrentStage": 5,
    "dealAmount": 50000,
    "contactName": "João Silva"
  }
}
```

## 🎨 Interface Visual - Board da Jornada

### Design System

A interface segue o padrão **Lovable Board** com:

- **Cards visuais** para cada etapa
- **Cores temáticas** por estágio:
  - 🔍 Prospecção: `#FF7A59` (Laranja)
  - 🚀 Onboarding: `#00A4BD` (Azul)
  - 🤝 Relacionamento: `#00BDA5` (Verde)

- **Elementos interativos:**
  - Progress bar de progresso na jornada
  - Tags de status
  - Indicadores visuais de etapa atual
  - Botão de atualização em tempo real

### Componentes HubSpot UI Extensions

- `Flex`, `Box` - Layout responsivo
- `Text` - Tipografia consistente com HubSpot
- `ProgressBar` - Indicador visual de progresso
- `Tag` - Marcadores de status
- `Alert` - Feedback de erro/sucesso
- `Button` - Ações do usuário

## 🧪 Estratégia de Testes

### Casos de Teste Implementados

1. **Teste de Prospecção com Proposta**
   ```javascript
   // Deal: appointmentscheduled + proposal_sent = true
   // Esperado: PROSPECTING/Proposta Enviada
   ```

2. **Teste de Onboarding com Depósito**
   ```javascript
   // Deal: closedwon + first_deposit_date válida
   // Esperado: ONBOARDING/Contrato Assinado
   ```

3. **Teste de Relacionamento Ativo**
   ```javascript
   // Contact: whatsapp_cadence_active = true + meeting < 90d
   // Esperado: RELATIONSHIP/Cliente Ativo
   ```

4. **Casos de Borda:**
   - Deal com stage inválido
   - Propriedades vazias/undefined
   - Cálculo de dias no stage

### Cobertura de Testes

- ✅ Função pura `analyzeJourney`
- ✅ Cálculo de dias entre datas
- ✅ Mapeamento de stages
- ✅ Tratamento de dados inválidos

## 🔌 Integração HubSpot

### Autenticação

```json
{
  "auth": {
    "type": "static",
    "requiredScopes": [
      "crm.objects.contacts.read",
      "crm.objects.contacts.write", 
      "crm.objects.deals.read",
      "crm.objects.deals.write"
    ]
  }
}
```

### Propriedades HubSpot Utilizadas

**Deals:**
- `dealstage` - Stage padrão do HubSpot
- `amount` - Valor do negócio
- `first_deposit_date` - Data do primeiro depósito (customizada)
- `proposal_sent` - Flag de proposta enviada (customizada)
- `allocation_done` - Flag de alocação concluída (customizada)

**Contacts:**
- `firstname`, `lastname` - Nome do contato
- `email` - Email principal
- `whatsapp_cadence_active` - Status da cadência WhatsApp (customizada)
- `last_meeting_date` - Data da última reunião (customizada)
- `hs_email_open_rate` - Taxa de abertura de emails

### APIs HubSpot Utilizadas

```javascript
// Buscar deal específico
hubspotClient.crm.deals.basicApi.getById(dealId, properties)

// Buscar contact específico  
hubspotClient.crm.contacts.basicApi.getById(contactId, properties)

// Buscar associações deal-contact
hubspotClient.crm.deals.associationsApi.getAll(dealId, 'contacts')
```

## 📊 Visão de Valor

### Para Assessores/Usuários

**Como os assessores enxergariam isso:**

1. **Dashboard Centralizado** - Visão única da jornada de cada cliente dentro do próprio HubSpot
2. **Automação de Classificação** - Eliminação do processo manual de categorização de clientes
3. **Indicadores Acionáveis** - Recomendações automáticas de próximos passos
4. **Visibilidade de Progresso** - Acompanhamento visual do avanço na jornada

### Benefícios Esperados

#### 🚀 Operacionais
- **Redução de 70% no tempo** de classificação manual de clientes
- **Padronização** do processo de acompanhamento de jornada
- **Visibilidade** em tempo real do pipeline de clientes
- **Automação** de recomendações de próximos passos

#### 📈 Estratégicos  
- **Melhoria na conversão** através de acompanhamento estruturado
- **Identificação precoce** de oportunidades de upsell/cross-sell
- **Redução de churn** através de monitoramento ativo
- **Dados consistentes** para análise e reporting

#### 💰 Financeiros
- **ROI positivo** através da melhoria de conversão
- **Redução de custos** operacionais de gestão manual
- **Aumento de eficiência** da equipe de vendas
- **Melhoria na previsibilidade** de receita

### Riscos e Limitações Identificados

#### ⚠️ Técnicos
- **Dependência de dados** - Qualidade da análise depende da consistência dos dados no HubSpot
- **Propriedades customizadas** - Necessita configuração de campos específicos
- **Performance** - Pode haver latência em análises de grandes volumes
- **Manutenção** - Regras de negócio podem precisar de ajustes periódicos

#### 🔒 Negócio
- **Adoção de usuários** - Necessita treinamento da equipe
- **Resistência à mudança** - Usuários podem preferir processos manuais conhecidos
- **Validação de regras** - Lógica de classificação precisa de validação contínua
- **Escalabilidade** - Pode necessitar ajustes para empresas com grandes volumes

#### 🛡️ Compliance
- **Privacidade de dados** - Processamento de informações sensíveis de clientes
- **Auditoria** - Necessidade de logs para rastreabilidade de decisões
- **Backup** - Dependência da infraestrutura HubSpot

## 🚀 Instalação e Configuração

### Pré-requisitos

1. **Conta HubSpot** com acesso a Developer Projects
2. **HubSpot CLI** instalado
3. **Propriedades customizadas** configuradas:
   - `first_deposit_date` (Deal)
   - `proposal_sent` (Deal)  
   - `allocation_done` (Deal)
   - `whatsapp_cadence_active` (Contact)
   - `last_meeting_date` (Contact)

### Comandos de Deploy

```bash
# Autenticar com HubSpot
hs auth

# Inicializar projeto
hs init

# Deploy da aplicação
hs project deploy

# Desenvolvimento local
hs project dev
```

### Configuração de Ambiente

1. **Criar propriedades customizadas** no HubSpot
2. **Configurar permissões** do app
3. **Instalar o card** nos objetos Deal/Contact
4. **Testar regras** com dados reais

## 📝 Conclusão

O **Journey Deal Analyzer** representa uma solução completa para automação da gestão de jornada de clientes, integrando-se nativamente ao HubSpot e oferecendo valor imediato através de:

- ✅ **Automação** de processos manuais
- ✅ **Visibilidade** em tempo real  
- ✅ **Padronização** de critérios
- ✅ **Escalabilidade** para diferentes volumes

A aplicação está pronta para produção e pode ser facilmente customizada para diferentes regras de negócio e necessidades específicas da organização.
