const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const { PrismaClient } = require('./generated/prisma'); // Importa o PrismaClient gerado
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

// Configuração do Express
app.use(cors());
app.use(express.json()); // Para parsear o corpo das requisições JSON

// Configuração do Cliente MQTT
const mqttClient = mqtt.connect(process.env.HIVEMQ_URL, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  connectTimeout: 10000,
  clean: true
}); // URL do HiveMQ do seu .env

mqttClient.on('connect', () => {
  console.log('Conectado ao HiveMQ');
  // Se inscreva no tópico para receber dados dos sensores do ESP32
  mqttClient.subscribe('coolingSystem/sensores', (err) => {
    if (err) {
      console.error('Falha ao se inscrever no tópico de sensores:', err);
    } else {
      console.log('Inscrito no tópico: coolingSystem/sensores');
    }
  });
});

mqttClient.on('message', async (topic, message) => {
  if (topic === 'coolingSystem/sensores') {
    try {
      const sensorData = JSON.parse(message.toString());
      console.log('Dados do sensor recebidos:', sensorData);

      // Salvar os dados do sensor no banco de dados usando Prisma
      const newSensorData = await prisma.sensorData.create({
        data: {
          humidity: sensorData.umidade,
          temperature: sensorData.temperatura,
        },
      });
      console.log('Dados do sensor salvos no DB:', newSensorData);
    } catch (error) {
      console.error('Erro ao processar mensagem do sensor:', error);
    }
  }
});

mqttClient.on('error', (err) => {
  console.error('Erro no cliente MQTT:', err);
});

// Rotas da API

// Rota GET para pegar os últimos dados do sensor
app.get('/api/sensordata/latest', async (req, res) => {
  try {
    const latestSensorData = await prisma.sensorData.findFirst({
      orderBy: {
        timestamp: 'desc',
      },
    });
    res.json(latestSensorData);
  } catch (error) {
    console.error('Erro ao buscar os últimos dados do sensor:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota GET para pegar todos os dados do sensor (opcional, pode ser paginado para grandes volumes)
app.get('/api/sensordata', async (req, res) => {
  try {
    const allSensorData = await prisma.sensorData.findMany({
      orderBy: {
        timestamp: 'desc',
      },
      take: 100, // Limita a 100 resultados para evitar sobrecarga
    });
    res.json(allSensorData);
  } catch (error) {
    console.error('Erro ao buscar todos os dados do sensor:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Variável para armazenar o último comando de controle enviado
let lastControlCommand = {
  mode: 'MANUAL',
  ventilador: false,
  aspersor: false,
};

// Rota POST para enviar comandos de controle para o ESP32 via MQTT
app.post('/api/controls', async (req, res) => {
  try {
    const { modo, ventilador, aspersor } = req.body;

    // Validação básica dos dados
    if (!['automatico', 'manual'].includes(modo) || typeof ventilador !== 'boolean' || typeof aspersor !== 'boolean') {
      return res.status(400).json({ error: 'Dados de controle inválidos. Esperado { modo: "automatico" | "manual", ventilador: boolean, aspersor: boolean }' });
    }

    const controlCommand = {
      mode: modo.toUpperCase(), // Converte para maiúsculas para corresponder ao ENUM do Prisma
      ventilador: ventilador,
      aspersor: aspersor,
    };

    // Publica o comando no tópico MQTT para o ESP32
    mqttClient.publish('coolingSystem/controles', JSON.stringify(controlCommand), (err) => {
      if (err) {
        console.error('Falha ao publicar comando MQTT:', err);
        return res.status(500).json({ error: 'Falha ao enviar comando MQTT' });
      }
      console.log('Comando de controle publicado no tópico coolingSystem/controles:', controlCommand);
      // Atualiza o último comando enviado
      lastControlCommand = controlCommand;
    });

    // Salva o comando de controle no banco de dados
    const newControlCommand = await prisma.controlCommand.create({
      data: controlCommand,
    });
    console.log('Comando de controle salvo no DB:', newControlCommand);

    res.status(200).json({ message: 'Comando de controle enviado e salvo com sucesso!', command: newControlCommand });
  } catch (error) {
    console.error('Erro ao enviar comando de controle:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota GET para pegar o último comando de controle enviado (do banco de dados)
app.get('/api/controls/latest', async (req, res) => {
  try {
    const latestControl = await prisma.controlCommand.findFirst({
      orderBy: {
        timestamp: 'desc',
      },
    });
    res.json(latestControl);
  } catch (error) {
    console.error('Erro ao buscar o último comando de controle:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Inicia o servidor Express
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});