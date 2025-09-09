import React, { useState, useEffect } from 'react';
import {
  Text,
  Flex,
  Box,
  Button,
  Alert,
  Divider,
  Tag,
  ProgressBar,
  hubspot
} from '@hubspot/ui-extensions';

// Hook customizado para o contexto
hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <JourneyBoardExtension
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
  />
));

const JourneyBoardExtension = ({ context, runServerless, sendAlert }) => {
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Definição das fases
  const stages = [
    {
      id: 'PROSPECTING',
      name: '🔍 Prospecção',
      color: '#FF7A59',
      substages: ['Contato Inicial', 'Qualificação', 'Proposta Enviada', 'Negociação']
    },
    {
      id: 'ONBOARDING',
      name: '🚀 Onboarding',
      color: '#00A4BD',
      substages: ['Contrato Assinado', 'Setup Iniciado', 'Treinamento', 'Implementação']
    },
    {
      id: 'RELATIONSHIP',
      name: '🤝 Relacionamento',
      color: '#00BDA5',
      substages: ['Cliente Ativo', 'Expansão', 'Renovação', 'Advogado']
    }
  ];

  useEffect(() => {
    if (context.crm.objectId) {
      loadJourneyData();
    }
  }, [context.crm.objectId]);

  const loadJourneyData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Determinar se estamos em um Deal ou Contact
      const isDeal = context.crm.objectTypeId === '0-3';
      const isContact = context.crm.objectTypeId === '0-1';
      
      let dealId = null;
      let contactId = null;
      
      if (isDeal) {
        dealId = context.crm.objectId;
      } else if (isContact) {
        contactId = context.crm.objectId;
      }

      // Chamar a função serverless
      const result = await runServerless({
        name: 'analyzeJourney',
        parameters: {
          dealId: dealId,
          contactId: contactId
        }
      });

      if (result.response && result.response.body) {
        setJourney(result.response.body);
      } else {
        // Dados mockados para desenvolvimento
        setJourney({
          dealId: dealId || 'mock-deal',
          contactId: contactId || 'mock-contact',
          stage: 'PROSPECTING',
          substage: 'QUALIFICATION',
          stageName: 'Prospecção',
          substageName: 'Qualificação',
          score: 35,
          indicators: ['Alto engajamento', 'Boa taxa de abertura'],
          recommendations: ['Agendar apresentação', 'Enviar case de sucesso'],
          metadata: {
            daysInCurrentStage: 5,
            dealAmount: 50000,
            contactName: 'Cliente Exemplo'
          }
        });
      }
    } catch (err) {
      console.error('Erro ao carregar jornada:', err);
      setError('Erro ao carregar dados da jornada');
      
      // Usar dados mock em caso de erro
      setJourney({
        stage: 'PROSPECTING',
        substage: 'INITIAL_CONTACT',
        stageName: 'Prospecção',
        substageName: 'Contato Inicial',
        score: 20,
        indicators: [],
        recommendations: ['Iniciar contato'],
        metadata: {
          daysInCurrentStage: 1,
          dealAmount: 0,
          contactName: 'Novo Lead'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const getStageProgress = () => {
    if (!journey) return 0;
    const stageIndex = stages.findIndex(s => s.id === journey.stage);
    return ((stageIndex + 1) / stages.length) * 100;
  };

  const getScoreColor = (score) => {
    if (score >= 60) return '#00BDA5';
    if (score >= 30) return '#FF7A59';
    return '#F23232';
  };

  const getScoreLabel = (score) => {
    if (score >= 60) return '✅ Excelente';
    if (score >= 30) return '⚠️ Médio';
    return '🔴 Atenção';
  };

  if (loading) {
    return (
      <Box padding="md">
        <Text>Carregando jornada do cliente...</Text>
      </Box>
    );
  }

  if (!journey) {
    return (
      <Box padding="md">
        <Alert title="Sem dados" variant="info">
          Nenhuma jornada encontrada para este registro.
        </Alert>
      </Box>
    );
  }

  return (
    <Box padding="md">
      {/* Header com Score */}
      <Flex direction="row" justify="between" align="start" gap="md">
        <Box>
          <Text format={{ fontWeight: 'bold' }}>
            Jornada: {journey.metadata?.contactName || 'Cliente'}
          </Text>
          <Text format={{ fontWeight: 'demibold' }}>
            {journey.stageName} → {journey.substageName}
          </Text>
        </Box>
        <Box>
          <Text format={{ fontWeight: 'bold' }}>Score</Text>
          <Text format={{ 
            fontWeight: 'bold', 
            fontColor: getScoreColor(journey.score) 
          }}>
            {journey.score}/100
          </Text>
          <Text>{getScoreLabel(journey.score)}</Text>
        </Box>
      </Flex>

      <Divider distance="md" />

      {/* Progress Bar */}
      <Box>
        <Text format={{ fontWeight: 'demibold' }}>Progresso Geral</Text>
        <ProgressBar 
          value={getStageProgress()} 
          showPercentage={true}
          variant="success"
        />
      </Box>

      <Divider distance="md" />

      {/* Tabuleiro Visual */}
      <Box>
        <Text format={{ fontWeight: 'bold' }}>📋 Tabuleiro de Fases</Text>
        
        {stages.map((stage) => (
          <Box key={stage.id} padding="xs">
            <Flex direction="column" gap="xs">
              {/* Nome do Stage */}
              <Flex direction="row" align="center" gap="xs">
                <Text format={{ 
                  fontWeight: journey.stage === stage.id ? 'bold' : 'demibold',
                  fontColor: journey.stage === stage.id ? stage.color : '#33475B'
                }}>
                  {stage.name}
                </Text>
                {journey.stage === stage.id && (
                  <Tag variant="warning">
                    ATUAL
                  </Tag>
                )}
              </Flex>
              
              {/* Substages */}
              <Flex direction="row" gap="xs" wrap="wrap">
                {stage.substages.map((substage) => {
                  const isActive = journey.stage === stage.id && 
                                 journey.substageName === substage;
                  
                  return (
                    <Tag
                      key={substage}
                      variant={isActive ? 'warning' : 'default'}
                    >
                      {isActive ? '▶ ' : ''}{substage}
                    </Tag>
                  );
                })}
              </Flex>
            </Flex>
          </Box>
        ))}
      </Box>

      {/* Indicadores */}
      {journey.indicators && journey.indicators.length > 0 && (
        <>
          <Divider distance="md" />
          <Box>
            <Text format={{ fontWeight: 'demibold' }}>📊 Indicadores</Text>
            <Flex direction="row" gap="xs" wrap="wrap">
              {journey.indicators.map((indicator, idx) => (
                <Tag key={idx} variant="info">
                  {indicator}
                </Tag>
              ))}
            </Flex>
          </Box>
        </>
      )}

      {/* Recomendações */}
      {journey.recommendations && journey.recommendations.length > 0 && (
        <>
          <Divider distance="md" />
          <Box>
            <Text format={{ fontWeight: 'demibold' }}>💡 Próximos Passos</Text>
            {journey.recommendations.map((rec, idx) => (
              <Text key={idx}>• {rec}</Text>
            ))}
          </Box>
        </>
      )}

      {/* Metadados */}
      <Divider distance="md" />
      <Flex direction="row" justify="between">
        <Text>
          ⏱ {journey.metadata?.daysInCurrentStage || 0} dias no stage
        </Text>
        <Text>
          💰 R$ {(journey.metadata?.dealAmount || 0).toLocaleString('pt-BR')}
        </Text>
      </Flex>

      {/* Botão de Atualização */}
      <Box>
        <Button onClick={loadJourneyData} variant="secondary">
          Atualizar Análise
        </Button>
      </Box>

      {error && (
        <Alert title="Aviso" variant="warning">
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default JourneyBoardExtension;