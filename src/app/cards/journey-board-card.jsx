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

  // Definição das fases conforme documento
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
      
      const isDeal = context.crm.objectTypeId === '0-3';
      const isContact = context.crm.objectTypeId === '0-1';
      
      let dealId = null;
      let contactId = null;
      
      if (isDeal) {
        dealId = context.crm.objectId;
      } else if (isContact) {
        contactId = context.crm.objectId;
      }

      // Chamar a função serverless correta
      const result = await runServerless({
        name: 'analyzeJourney',
        parameters: {
          dealId: dealId,
          contactId: contactId
        }
      });

      if (result.response && result.response.body) {
        setJourney(result.response.body);
        sendAlert({
          type: 'success',
          message: 'Jornada analisada com sucesso!'
        });
      } else {
        throw new Error('Resposta inválida da função serverless');
      }
    } catch (err) {
      console.error('Erro ao carregar jornada:', err);
      setError('Erro ao carregar dados da jornada');
      sendAlert({
        type: 'danger',
        message: 'Erro ao analisar jornada: ' + err.message
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
        <Text>⏳ Analisando jornada do cliente...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding="md">
        <Alert title="Erro" variant="danger">
          {error}
        </Alert>
        <Box>
          <Button onClick={loadJourneyData} variant="primary">
            Tentar Novamente
          </Button>
        </Box>
      </Box>
    );
  }

  if (!journey) {
    return (
      <Box padding="md">
        <Alert title="Sem dados" variant="info">
          Nenhuma jornada encontrada para este registro.
        </Alert>
        <Box>
          <Button onClick={loadJourneyData} variant="secondary">
            Analisar Jornada
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box padding="md">
      {/* Header com Score */}
      <Flex direction="row" justify="between" align="start" gap="md">
        <Box>
          <Text format={{ fontWeight: 'bold', fontSize: 'lg' }}>
            📊 Jornada do Cliente
          </Text>
          <Text format={{ fontWeight: 'demibold' }}>
            {journey.stageName} → {journey.substageName}
          </Text>
          <Text>
            {journey.metadata?.contactName || 'Cliente'}
          </Text>
        </Box>
        <Box>
          <Text format={{ fontWeight: 'bold' }}>Score</Text>
          <Text format={{ 
            fontWeight: 'bold', 
            fontSize: 'xl',
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
        <Text format={{ fontWeight: 'demibold' }}>Progresso na Jornada</Text>
        <ProgressBar 
          value={getStageProgress()} 
          showPercentage={true}
          variant="success"
        />
      </Box>

      <Divider distance="md" />

      {/* Tabuleiro Visual estilo Lovable */}
      <Box>
        <Text format={{ fontWeight: 'bold' }}>📋 Board da Jornada</Text>
        
        <Flex direction="row" gap="sm" wrap="wrap">
          {stages.map((stage) => (
            <Box 
              key={stage.id} 
              padding="sm"
              style={{
                border: journey.stage === stage.id ? '2px solid ' + stage.color : '1px solid #E6EAED',
                borderRadius: '8px',
                backgroundColor: journey.stage === stage.id ? stage.color + '20' : '#F7F9FA',
                minWidth: '200px',
                flex: 1
              }}
            >
              <Flex direction="column" gap="xs">
                {/* Nome do Stage */}
                <Flex direction="row" align="center" justify="between">
                  <Text format={{ 
                    fontWeight: 'bold',
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
                <Flex direction="column" gap="xxs">
                  {stage.substages.map((substage) => {
                    const isActive = journey.stage === stage.id && 
                                   journey.substageName === substage;
                    
                    return (
                      <Box
                        key={substage}
                        padding="xxs"
                        style={{
                          backgroundColor: isActive ? stage.color : 'transparent',
                          borderRadius: '4px',
                          color: isActive ? 'white' : '#33475B'
                        }}
                      >
                        <Text format={{ 
                          fontWeight: isActive ? 'bold' : 'regular',
                          fontSize: 'sm'
                        }}>
                          {isActive ? '▶ ' : '• '}{substage}
                        </Text>
                      </Box>
                    );
                  })}
                </Flex>
              </Flex>
            </Box>
          ))}
        </Flex>
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
      <Flex direction="row" justify="between" align="center">
        <Flex direction="column">
          <Text format={{ fontSize: 'sm' }}>
            ⏱ {journey.metadata?.daysInCurrentStage || 0} dias no stage
          </Text>
          <Text format={{ fontSize: 'sm' }}>
            💰 R$ {(journey.metadata?.dealAmount || 0).toLocaleString('pt-BR')}
          </Text>
        </Flex>
        
        <Button onClick={loadJourneyData} variant="secondary">
          🔄 Atualizar
        </Button>
      </Flex>
    </Box>
  );
};

export default JourneyBoardExtension;