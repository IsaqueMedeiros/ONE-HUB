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

// Mapeamento conforme especificado no documento
const DEAL_STAGE_MAPPING = {
  // Prospecção
  'appointmentscheduled': { stage: 'PROSPECTING', substage: 'INITIAL_CONTACT' },
  'presentationscheduled': { stage: 'PROSPECTING', substage: 'QUALIFICATION' },
  
  // Onboarding  
  'contractsent': { stage: 'ONBOARDING', substage: 'CONTRACT_SIGNED' },
  'closedwon': { stage: 'ONBOARDING', substage: 'SETUP_STARTED' }
};

/**
 * Função pura que recebe Deal + Contact e retorna stage + substage
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
    recommendations: [],
    metadata: {}
  };

  // Aplicar regras do documento
  const dealStage = deal.properties?.dealstage;
  const firstDepositDate = deal.properties?.first_deposit_date;
  const proposalSent = deal.properties?.proposal_sent;
  const allocationDone = deal.properties?.allocation_done;
  const whatsappCadenceActive = contact.properties?.whatsapp_cadence_active;
  const lastMeetingDate = contact.properties?.last_meeting_date;

  // Regra 1: Prospecção
  if (['appointmentscheduled', 'presentationscheduled'].includes(dealStage)) {
    journey.stage = 'PROSPECTING';
    journey.stageName = JOURNEY_STAGES.PROSPECTING.name;
    
    if (proposalSent === 'true' || proposalSent === true) {
      journey.substage = 'PROPOSAL_SENT';
      journey.substageName = 'Proposta Enviada';
    } else {
      journey.substage = 'INITIAL_CONTACT';
      journey.substageName = 'Contato Inicial';
    }
  }

  // Regra 2: Onboarding
  if (['contractsent', 'closedwon'].includes(dealStage) && firstDepositDate) {
    journey.stage = 'ONBOARDING';
    journey.stageName = JOURNEY_STAGES.ONBOARDING.name;
    
    if (allocationDone === 'true' || allocationDone === true) {
      journey.substage = 'IMPLEMENTATION';
      journey.substageName = 'Implementação';
    } else {
      journey.substage = 'CONTRACT_SIGNED';
      journey.substageName = 'Contrato Assinado';
    }
  }

  // Regra 3: Relacionamento
  if (whatsappCadenceActive === 'true' || whatsappCadenceActive === true) {
    const daysSinceLastMeeting = calculateDaysSince(lastMeetingDate);
    if (daysSinceLastMeeting <= 90) {
      journey.stage = 'RELATIONSHIP';
      journey.stageName = JOURNEY_STAGES.RELATIONSHIP.name;
      journey.substage = 'ACTIVE_CLIENT';
      journey.substageName = 'Cliente Ativo';
    }
  }

  // Desempate: mais avançada vence
  // (Relacionamento > Onboarding > Prospecção)
  
  // Calcular score e metadados
  journey.score = calculateScore(journey, deal, contact);
  journey.indicators = generateIndicators(deal, contact);
  journey.recommendations = generateRecommendations(journey, deal, contact);
  journey.metadata = {
    analyzedAt: new Date().toISOString(),
    daysInCurrentStage: calculateDaysInStage(deal.properties?.hs_date_entered_current_stage),
    dealAmount: deal.properties?.amount || 0,
    contactName: `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`.trim()
  };

  return journey;
}

function calculateDaysSince(dateString) {
  if (!dateString) return 999;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calculateDaysInStage(dateEntered) {
  if (!dateEntered) return 0;
  return calculateDaysSince(dateEntered);
}

function calculateScore(journey, deal, contact) {
  let score = 0;
  
  switch(journey.stage) {
    case 'PROSPECTING':
      score = 20;
      if (journey.substage === 'PROPOSAL_SENT') score += 15;
      break;
    case 'ONBOARDING':
      score = 50;
      if (journey.substage === 'IMPLEMENTATION') score += 20;
      break;
    case 'RELATIONSHIP':
      score = 80;
      break;
    default:
      score = 10;
  }
  
  return Math.min(score, 100);
}

function generateIndicators(deal, contact) {
  const indicators = [];
  
  if (deal.properties?.amount > 10000) {
    indicators.push('Deal de alto valor');
  }
  
  if (contact.properties?.hs_email_open_rate > 0.3) {
    indicators.push('Alta taxa de abertura de emails');
  }
  
  return indicators;
}

function generateRecommendations(journey, deal, contact) {
  const recommendations = [];
  
  switch(journey.stage) {
    case 'PROSPECTING':
      recommendations.push('Agendar próxima reunião');
      recommendations.push('Enviar material complementar');
      break;
    case 'ONBOARDING':
      recommendations.push('Acompanhar implementação');
      recommendations.push('Agendar treinamento');
      break;
    case 'RELATIONSHIP':
      recommendations.push('Avaliar oportunidades de upsell');
      recommendations.push('Solicitar feedback');
      break;
  }
  
  return recommendations;
}

/**
 * Handler principal para a função serverless
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

    const hubspotClient = context.hubspotClient;
    
    // Buscar deal com as propriedades específicas do documento
    const deal = await hubspotClient.crm.deals.basicApi.getById(
      dealId,
      [
        'dealstage', 
        'amount', 
        'hs_date_entered_current_stage', 
        'dealname',
        'first_deposit_date',
        'proposal_sent',
        'allocation_done'
      ]
    );

    let contact;
    if (contactId) {
      contact = await hubspotClient.crm.contacts.basicApi.getById(
        contactId,
        [
          'email', 
          'firstname', 
          'lastname', 
          'whatsapp_cadence_active',
          'last_meeting_date',
          'hs_email_open_rate'
        ]
      );
    } else {
      // Buscar contact associado ao deal
      const associations = await hubspotClient.crm.deals.associationsApi.getAll(
        dealId,
        'contacts'
      );
      
      if (associations.results && associations.results.length > 0) {
        const firstContactId = associations.results[0].id;
        contact = await hubspotClient.crm.contacts.basicApi.getById(
          firstContactId,
          [
            'email', 
            'firstname', 
            'lastname', 
            'whatsapp_cadence_active',
            'last_meeting_date',
            'hs_email_open_rate'
          ]
        );
      } else {
        contact = { id: 'no-contact', properties: {} };
      }
    }

    // Aplicar a função pura de análise
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
  calculateScore,
  JOURNEY_STAGES,
  DEAL_STAGE_MAPPING
};