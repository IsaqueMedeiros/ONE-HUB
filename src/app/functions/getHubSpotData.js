// src/app/functions/getHubSpotData.js
/**
 * Função serverless para buscar dados do HubSpot sem necessidade de API Key externa
 * Usa a autenticação do próprio app HubSpot
 */

/**
 * Busca todos os deals com suas propriedades
 */
async function getAllDeals(hubspotClient, limit = 100) {
  try {
    const dealsResponse = await hubspotClient.crm.deals.basicApi.getPage(
      limit,
      undefined, // after
      [
        'dealstage',
        'amount', 
        'dealname',
        'hs_date_entered_current_stage',
        'first_deposit_date',
        'proposal_sent',
        'allocation_done',
        'createdate',
        'closedate'
      ]
    );
    
    return dealsResponse.results || [];
  } catch (error) {
    console.error('Erro ao buscar deals:', error);
    throw error;
  }
}

/**
 * Busca todos os contacts com suas propriedades
 */
async function getAllContacts(hubspotClient, limit = 100) {
  try {
    const contactsResponse = await hubspotClient.crm.contacts.basicApi.getPage(
      limit,
      undefined, // after
      [
        'email',
        'firstname', 
        'lastname',
        'whatsapp_cadence_active',
        'last_meeting_date',
        'hs_email_open_rate',
        'createdate',
        'phone'
      ]
    );
    
    return contactsResponse.results || [];
  } catch (error) {
    console.error('Erro ao buscar contacts:', error);
    throw error;
  }
}

/**
 * Busca associações entre deals e contacts
 */
async function getDealContactAssociations(hubspotClient, dealId) {
  try {
    const associations = await hubspotClient.crm.deals.associationsApi.getAll(
      dealId,
      'contacts'
    );
    
    return associations.results || [];
  } catch (error) {
    console.error('Erro ao buscar associações:', error);
    return [];
  }
}

/**
 * Handler principal - retorna dados completos para o HTML
 */
exports.main = async (context, sendResponse) => {
  try {
    const { action, dealId, contactId } = context.parameters || {};
    const hubspotClient = context.hubspotClient;

    switch (action) {
      case 'getAllData':
        // Buscar todos os dados para popular o HTML
        const [deals, contacts] = await Promise.all([
          getAllDeals(hubspotClient),
          getAllContacts(hubspotClient)
        ]);

        // Buscar associações para cada deal
        const dealsWithContacts = await Promise.all(
          deals.map(async (deal) => {
            const associations = await getDealContactAssociations(hubspotClient, deal.id);
            const associatedContactIds = associations.map(assoc => assoc.id);
            const associatedContacts = contacts.filter(contact => 
              associatedContactIds.includes(contact.id)
            );
            
            return {
              ...deal,
              associatedContacts
            };
          })
        );

        sendResponse({
          statusCode: 200,
          body: {
            deals: dealsWithContacts,
            contacts,
            total: {
              deals: deals.length,
              contacts: contacts.length
            },
            timestamp: new Date().toISOString()
          }
        });
        break;

      case 'getJourneyAnalysis':
        // Análise específica de um deal
        if (!dealId) {
          return sendResponse({
            statusCode: 400,
            body: { error: 'dealId é obrigatório para análise' }
          });
        }

        const deal = await hubspotClient.crm.deals.basicApi.getById(
          dealId,
          [
            'dealstage', 'amount', 'hs_date_entered_current_stage', 'dealname',
            'first_deposit_date', 'proposal_sent', 'allocation_done'
          ]
        );

        let contact = { id: 'no-contact', properties: {} };
        
        if (contactId) {
          contact = await hubspotClient.crm.contacts.basicApi.getById(
            contactId,
            [
              'email', 'firstname', 'lastname', 'whatsapp_cadence_active',
              'last_meeting_date', 'hs_email_open_rate'
            ]
          );
        } else {
          // Buscar primeiro contact associado
          const associations = await getDealContactAssociations(hubspotClient, dealId);
          if (associations.length > 0) {
            contact = await hubspotClient.crm.contacts.basicApi.getById(
              associations[0].id,
              [
                'email', 'firstname', 'lastname', 'whatsapp_cadence_active',
                'last_meeting_date', 'hs_email_open_rate'
              ]
            );
          }
        }

        // Importar e usar a função de análise
        const { analyzeJourney } = require('./analyzeJourney');
        const journey = analyzeJourney(deal, contact);

        sendResponse({
          statusCode: 200,
          body: journey
        });
        break;

      default:
        sendResponse({
          statusCode: 400,
          body: { error: 'Ação não reconhecida. Use: getAllData ou getJourneyAnalysis' }
        });
    }
    
  } catch (error) {
    console.error('Erro na função getHubSpotData:', error);
    sendResponse({
      statusCode: 500,
      body: { 
        error: 'Erro interno do servidor',
        message: error.message
      }
    });
  }
};

module.exports = {
  main: exports.main,
  getAllDeals,
  getAllContacts,
  getDealContactAssociations
};