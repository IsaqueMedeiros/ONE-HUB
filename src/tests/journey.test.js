/**
 * Testes unitários para a análise de jornada
 * Mínimo 3 casos de borda conforme documento
 */

const { analyzeJourney, calculateDaysInStage } = require('../app/functions/analyzeJourney');

describe('Journey Analysis Tests', () => {
  
  // Caso 1: Deal em Prospecção com proposta enviada
  test('Deve classificar como Prospecção com Proposta Enviada', () => {
    const deal = {
      id: 'deal-1',
      properties: {
        dealstage: 'appointmentscheduled',
        proposal_sent: true,
        amount: 10000
      }
    };
    
    const contact = {
      id: 'contact-1',
      properties: {
        firstname: 'Test',
        lastname: 'User'
      }
    };
    
    const result = analyzeJourney(deal, contact);
    
    expect(result.stage).toBe('PROSPECTING');
    expect(result.substageName).toBe('Proposta Enviada');
    expect(result.score).toBeGreaterThan(20);
  });

  // Caso 2: Deal em Onboarding com primeiro depósito
  test('Deve classificar como Onboarding quando há primeiro depósito', () => {
    const deal = {
      id: 'deal-2',
      properties: {
        dealstage: 'closedwon',
        first_deposit_date: '2024-11-01T10:00:00Z',
        allocation_done: false,
        amount: 50000
      }
    };
    
    const contact = {
      id: 'contact-2',
      properties: {
        firstname: 'Cliente',
        lastname: 'Onboarding'
      }
    };
    
    const result = analyzeJourney(deal, contact);
    
    expect(result.stage).toBe('ONBOARDING');
    expect(result.stageName).toBe('Onboarding');
    expect(result.score).toBeGreaterThan(40);
  });

  // Caso 3: Cliente em Relacionamento com WhatsApp ativo
  test('Deve classificar como Relacionamento quando WhatsApp ativo e reunião recente', () => {
    const deal = {
      id: 'deal-3',
      properties: {
        dealstage: 'closedwon',
        amount: 75000
      }
    };
    
    const contact = {
      id: 'contact-3',
      properties: {
        firstname: 'Cliente',
        lastname: 'Ativo',
        whatsapp_cadence_active: true,
        last_meeting_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 dias atrás
      }
    };
    
    const result = analyzeJourney(deal, contact);
    
    expect(result.stage).toBe('RELATIONSHIP');
    expect(result.stageName).toBe('Relacionamento');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  // Caso 4: Teste de borda - Sem stage definido
  test('Deve lidar com deal sem stage válido', () => {
    const deal = {
      id: 'deal-4',
      properties: {
        dealstage: 'invalid_stage',
        amount: 5000
      }
    };
    
    const contact = {
      id: 'contact-4',
      properties: {}
    };
    
    const result = analyzeJourney(deal, contact);
    
    expect(result.dealId).toBe('deal-4');
    expect(result.contactId).toBe('contact-4');
    expect(result.score).toBeDefined();
  });

  // Caso 5: Teste da função calculateDaysInStage
  test('Deve calcular dias no stage corretamente', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const days = calculateDaysInStage(oneDayAgo);
    
    expect(days).toBe(1);
  });

  // Caso 6: Teste com dados vazios
  test('Deve lidar com propriedades vazias sem falhar', () => {
    const deal = { id: 'deal-empty', properties: {} };
    const contact = { id: 'contact-empty', properties: {} };
    
    const result = analyzeJourney(deal, contact);
    
    expect(result).toBeDefined();
    expect(result.dealId).toBe('deal-empty');
    expect(result.contactId).toBe('contact-empty');
  });
});