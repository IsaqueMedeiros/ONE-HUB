/**
 * Journey Analyzer - Analisa a jornada do cliente
 * Fases: Prospecção → Onboarding → Relacionamento
 */

// Definição das fases e subfases
const JOURNEY_STAGES = {
  PROSPECTING: {
    name: 'Prospecção',
    substages: {
      INITIAL_CONTACT: 'Contato Inicial',
      QUALIFICATION: 'Qualificação',
      PROPOSAL_SENT: 'Proposta Enviada',
      NEGOTIATION: 'Negociação'
    }
  },
  ONBOARDING: {
    name: 'Onboarding',
    substages: {
      CONTRACT_SIGNED: 'Contrato Assinado',
      SETUP_STARTED: 'Setup Iniciado',
      TRAINING_IN_PROGRESS: 'Treinamento em Andamento',
      IMPLEMENTATION: 'Implementação'
    }
  },
  RELATIONSHIP: {
    name: 'Relacionamento',
    substages: {
      ACTIVE_CLIENT: 'Cliente Ativo',
      EXPANSION_OPPORTUNITY: 'Oportunidade de Expansão',
      RENEWAL_DISCUSSION: 'Discussão de Renovação',
      ADVOCATE: 'Advogado da Marca'
    }
  }
};

// Mapeamento de deal stages do HubSpot para nossa jornada
const DEAL_STAGE_MAPPING = {
  // Prospecção
  'appointmentscheduled': { stage: 'PROSPECTING', substage: 'INITIAL_CONTACT' },
  'qualifiedtobuy': { stage: 'PROSPECTING', substage: 'QUALIFICATION' },
  'presentationscheduled': { stage: 'PROSPECTING', substage: 'PROPOSAL_SENT' },
  'decisionmakerboughtin': { stage: 'PROSPECTING', substage: 'NEGOTIATION' },
  
  // Onboarding
  'contractsent': { stage: 'ONBOARDING', substage: 'CONTRACT_SIGNED' },
  'closedwon': { stage: 'ONBOARDING', substage: 'SETUP_STARTED' },
  
  // Relacionamento
  'customer': { stage: 'RELATIONSHIP', substage: 'ACTIVE_CLIENT' }
};

/**
 * Analisa a jornada baseado no Deal e Contact
 */
function analyzeJourney(deal, contact) {
  const journey = {
    dealId: deal.id,
    contactId: contact.id,
    stage: null,
    substage: null,
    stageName: null,
    substageName: null,
    score: 0,
    indicators: [],
    recommendations: []
  };

  // 1. Determinar stage baseado no deal stage
  const dealStage = deal.properties?.dealstage;
  if (dealStage && DEAL_STAGE_MAPPING[dealStage]) {
    const mapping = DEAL_STAGE_MAPPING[dealStage];
    journey.stage = mapping.stage;
    journey.substage = mapping.substage;
    journey.stageName = JOURNEY_STAGES[mapping.stage].name;
    journey.substageName = JOURNEY_STAGES[mapping.stage].substages[mapping.substage];
  }

  // 2. Análise adicional baseada em propriedades do contact
  const contactProperties = contact.properties || {};
  
  // Verificar engajamento
  if (contactProperties.num_contacted_notes > 5) {
    journey.indicators.push('Alto engajamento');
    journey.score += 10;
  }
  
  if (contactProperties.hs_email_open_rate > 0.3) {
    journey.indicators.push('Boa taxa de abertura de emails');
    journey.score += 5;
  }

  // 3. Análise de tempo no stage atual
  const daysInStage = calculateDaysInStage(deal.properties?.hs_date_entered_current_stage);
  
  if (daysInStage > 30 && journey.stage === 'PROSPECTING') {
    journey.recommendations.push('Deal parado há muito tempo na prospecção - considere follow-up');
  }
  
  if (daysInStage > 14 && journey.stage === 'ONBOARDING') {
    journey.recommendations.push('Onboarding demorado - verificar possíveis bloqueios');
  }

  // 4. Calcular score final
  journey.score += calculateStageScore(journey.stage, daysInStage);
  
  // 5. Adicionar metadados
  journey.metadata = {
    analyzedAt: new Date().toISOString(),
    daysInCurrentStage: daysInStage,
    dealAmount: deal.properties?.amount || 0,
    contactEmail: contactProperties.email,
    contactName: `${contactProperties.firstname || ''} ${contactProperties.lastname || ''}`.trim()
  };

  return journey;
}

/**
 * Calcula dias no stage atual
 */
function calculateDaysInStage(dateEntered) {
  if (!dateEntered) return 0;
  const entered = new Date(dateEntered);
  const now = new Date();
  const diffTime = Math.abs(now - entered);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calcula score baseado no stage e tempo
 */
function calculateStageScore(stage, daysInStage) {
  let score = 0;
  
  switch(stage) {
    case 'PROSPECTING':
      score = daysInStage < 7 ? 20 : daysInStage < 30 ? 10 : 5;
      break;
    case 'ONBOARDING':
      score = daysInStage < 14 ? 30 : daysInStage < 30 ? 20 : 10;
      break;
    case 'RELATIONSHIP':
      score = 40 + (daysInStage > 90 ? 10 : 0);
      break;
  }
  
  return score;
}

/**
 * Handler principal para a função
 */
exports.main = async (context, sendResponse) => {
  try {
    const { dealId, contactId } = context.parameters || {};
    
    if (!dealId) {
      return sendResponse({
        statusCode: 400,
        body: { 
          error: 'dealId é obrigatório',
          message: 'Forneça o ID do deal para análise'
        }
      });
    }

    // Buscar dados usando o cliente HubSpot
    const hubspotClient = context.hubspotClient;
    
    let deal, contact;
    
    // Buscar deal
    try {
      deal = await hubspotClient.crm.deals.basicApi.getById(
        dealId,
        ['dealstage', 'amount', 'hs_date_entered_current_stage', 'dealname']
      );
    } catch (error) {
      return sendResponse({
        statusCode: 404,
        body: { 
          error: 'Deal não encontrado',
          dealId: dealId
        }
      });
    }

    // Buscar contact se fornecido
    if (contactId) {
      try {
        contact = await hubspotClient.crm.contacts.basicApi.getById(
          contactId,
          ['email', 'firstname', 'lastname', 'num_contacted_notes', 'hs_email_open_rate']
        );
      } catch (error) {
        // Contact não encontrado, usar vazio
        contact = { id: contactId, properties: {} };
      }
    } else {
      // Buscar contact associado ao deal
      try {
        const associations = await hubspotClient.crm.deals.associationsApi.getAll(
          dealId,
          'contacts'
        );
        
        if (associations.results && associations.results.length > 0) {
          const firstContactId = associations.results[0].id;
          contact = await hubspotClient.crm.contacts.basicApi.getById(
            firstContactId,
            ['email', 'firstname', 'lastname', 'num_contacted_notes', 'hs_email_open_rate']
          );
        } else {
          contact = { id: 'no-contact', properties: {} };
        }
      } catch (error) {
        contact = { id: 'no-contact', properties: {} };
      }
    }

    // Analisar a jornada
    const journey = analyzeJourney(deal, contact);

    sendResponse({
      statusCode: 200,
      body: journey
    });
    
  } catch (error) {
    console.error('Erro na análise de jornada:', error);
    sendResponse({
      statusCode: 500,
      body: { 
        error: 'Erro interno do servidor',
        message: error.message
      }
    });
  }
};

// Exportar para testes
module.exports = {
  main: exports.main,
  analyzeJourney,
  calculateDaysInStage,
  calculateStageScore,
  JOURNEY_STAGES,
  DEAL_STAGE_MAPPING
};