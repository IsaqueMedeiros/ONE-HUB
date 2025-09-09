/**
 * API Endpoint simples: GET /journey/:id
 * Parte A do teste técnico
 */

const { analyzeJourney, JOURNEY_STAGES } = require('../app/functions/analyzeJourney');

// Simulação de dados para desenvolvimento (usar quando não há HubSpot real)
const mockDeal = {
  id: 'mock-deal-123',
  properties: {
    dealstage: 'appointmentscheduled',
    amount: 25000,
    first_deposit_date: null,
    proposal_sent: false,
    allocation_done: false,
    hs_date_entered_current_stage: '2024-11-01T10:00:00Z'
  }
};

const mockContact = {
  id: 'mock-contact-456', 
  properties: {
    firstname: 'João',
    lastname: 'Silva',
    email: 'joao.silva@exemplo.com',
    whatsapp_cadence_active: false,
    last_meeting_date: '2024-10-15T14:30:00Z',
    hs_email_open_rate: 0.45
  }
};

/**
 * Handler para GET /journey/:id
 */
function getJourney(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        error: 'ID é obrigatório',
        message: 'Forneça o ID do deal ou contact'
      });
    }

    // Para este endpoint simples, usar dados mock
    // Em produção, conectaria com HubSpot API
    const journey = analyzeJourney(mockDeal, mockContact);
    
    // Adicionar informações do endpoint
    journey.endpoint = {
      method: 'GET',
      path: `/journey/${id}`,
      timestamp: new Date().toISOString()
    };

    res.json(journey);
    
  } catch (error) {
    console.error('Erro no endpoint journey:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
}

module.exports = {
  getJourney,
  analyzeJourney // Exportar função pura para testes
};