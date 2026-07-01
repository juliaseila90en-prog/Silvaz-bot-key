// ============================================
// SILVAZ KEY BOT - VERSÃO FINAL
// ADMIN_API_KEY: sk_admin_jg3607eaWg2z8EBFtvgjNdj9q62NBA0oW4cQbD4J1WBlcQPj
// EXPIRA EM: 30 DIAS (720 HORAS)
// ============================================

const { Client, GatewayIntentBits, EmbedBuilder, Colors } = require('discord.js');
const axios = require('axios');
const express = require('express');

// ============================================
// CONFIGURAÇÃO
// ============================================
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
    console.error('❌ ERRO: Token não configurado!');
    process.exit(1);
}

const SITE_URL = 'https://keyssilvaz.lovable.app';
const ADMIN_API_KEY = 'sk_admin_jg3607eaWg2z8EBFtvgjNdj9q62NBA0oW4cQbD4J1WBlcQPj';

// ⚠️ ATENÇÃO: Esta chave expira em 720 horas (30 dias)!
// Data de expiração: aproximadamente 31/07/2026
// Quando expirar, gere uma nova no Lovable e atualize o código!

console.log('🔑 API Key configurada!');
console.log('⚠️ A chave expira em 30 dias!');

// ============================================
// REQUISIÇÕES COM API KEY
// ============================================
async function apiRequest(method, endpoint, data = null) {
    try {
        console.log(`📡 ${method} ${endpoint}`);
        
        const config = {
            method: method,
            url: `${SITE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'x-admin-key': ADMIN_API_KEY
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
            config.data = data;
        }
        
        const response = await axios(config);
        console.log(`✅ Sucesso em ${endpoint}`);
        return response.data;
    } catch (error) {
        console.error(`❌ Erro em ${endpoint}:`, error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados:', error.response.data);
        }
        throw error;
    }
}

// ============================================
// FUNÇÕES DA API
// ============================================
async function generateKey(type, buyer = null) {
    const data = await apiRequest('POST', '/api/public/generate', {
        type: type,
        buyer: buyer || 'Discord Bot'
    });
    return data;
}

async function listKeys() {
    const data = await apiRequest('GET', '/api/public/keys');
    return data;
}

async function validateKey(key) {
    const data = await apiRequest('POST', '/api/public/validate-key', { key });
    return data;
}

// ============================================
// BOT
// ============================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', async () => {
    console.log(`✅ Bot logado como ${client.user.tag}`);
    console.log(`🌐 Site: ${SITE_URL}`);
    console.log(`🔑 API Key: ${ADMIN_API_KEY.substring(0, 15)}...`);
    console.log(`⚠️ Expira em 30 dias!`);
    
    // Testa conexão com a API
    try {
        await listKeys();
        console.log('✅ Conexão com a API funcionando!');
    } catch (error) {
        console.log('⚠️ Erro ao testar API:', error.message);
    }
    
    await client.application.commands.set([
        {
            name: 'gerar',
            description: 'Gerar uma nova key SILVAZ',
            options: [
                {
                    name: 'tipo',
                    description: 'Tipo de key',
                    type: 3,
                    required: true,
                    choices: [
                        { name: '📅 24 Horas', value: 'daily' },
                        { name: '📅 7 Dias', value: 'weekly' },
                        { name: '📅 30 Dias', value: 'monthly' },
                        { name: '♾️ Vitalícia', value: 'lifetime' }
                    ]
                },
                {
                    name: 'comprador',
                    description: 'Nome do comprador',
                    type: 3,
                    required: false
                }
            ]
        },
        {
            name: 'keys',
            description: 'Listar todas as keys'
        },
        {
            name: 'validar',
            description: 'Validar uma key SILVAZ',
            options: [
                {
                    name: 'key',
                    description: 'Key a ser validada',
                    type: 3,
                    required: true
                }
            ]
        },
        {
            name: 'status',
            description: 'Status da conexão'
        }
    ]);
    
    console.log('📌 Comandos registrados!');
});

// ============================================
// COMANDOS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    
    const { commandName } = interaction;
    
    if (commandName === 'status') {
        const embed = new EmbedBuilder()
            .setTitle('🔌 Status')
            .setColor(Colors.Purple)
            .addFields(
                { name: '🌐 Site', value: SITE_URL, inline: true },
                { name: '🔑 API Key', value: '✅ Configurada', inline: true },
                { name: '⏰ Expira', value: '30 dias', inline: true },
                { name: '🤖 Bot', value: client.user.tag, inline: true }
            )
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }
    
    if (commandName === 'gerar') {
        const tipo = interaction.options.getString('tipo');
        const comprador = interaction.options.getString('comprador') || 'Não informado';
        
        await interaction.reply({ content: '⏳ Gerando key...', ephemeral: true });
        
        try {
            const result = await generateKey(tipo, comprador);
            
            const typeNames = {
                daily: '24 Horas',
                weekly: '7 Dias',
                monthly: '30 Dias',
                lifetime: 'Vitalícia'
            };
            
            const keyValue = result.key || result.key_value || result.code || 'N/A';
            const expiresAt = result.expires_at || result.expiry || 'N/A';
            
            const embed = new EmbedBuilder()
                .setTitle('🔑 Key gerada com sucesso!')
                .setColor(Colors.Purple)
                .setDescription(`\`\`\`${keyValue}\`\`\``)
                .addFields(
                    { name: '📅 Tipo', value: typeNames[tipo] || tipo, inline: true },
                    { name: '👤 Comprador', value: comprador, inline: true },
                    { name: '⏰ Expira', value: expiresAt !== 'N/A' ? new Date(expiresAt).toLocaleString('pt-BR') : 'N/A', inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({ content: null, embeds: [embed] });
        } catch (error) {
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        }
        return;
    }
    
    if (commandName === 'keys') {
        await interaction.reply({ content: '⏳ Carregando keys...', ephemeral: true });
        
        try {
            const data = await listKeys();
            const keys = data.keys || data.data || [];
            
            if (keys.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📋 Lista de Keys')
                    .setDescription('Nenhuma key encontrada.')
                    .setColor(Colors.Orange)
                    .setTimestamp();
                await interaction.editReply({ content: null, embeds: [embed] });
                return;
            }
            
            let description = '';
            const active = keys.filter(k => k.status === 'active' || k.status === 'ativa');
            const expired = keys.filter(k => k.status === 'expired' || k.status === 'expirada');
            const banned = keys.filter(k => k.status === 'banned' || k.status === 'banida');
            
            description += `🟢 Ativas: ${active.length}\n`;
            description += `🟠 Expiradas: ${expired.length}\n`;
            description += `🔴 Banidas: ${banned.length}\n\n`;
            
            const recent = keys.slice(-10).reverse();
            for (const k of recent) {
                const keyVal = k.key || k.key_value || k.code || 'N/A';
                const icon = (k.status === 'active' || k.status === 'ativa') ? '🟢' : 
                            (k.status === 'expired' || k.status === 'expirada') ? '🟠' : '🔴';
                const buyer = k.buyer || k.comprador || 'N/A';
                description += `${icon} \`${keyVal}\` - ${buyer}\n`;
            }
            
            const embed = new EmbedBuilder()
                .setTitle('📋 Lista de Keys')
                .setDescription(description)
                .setColor(Colors.Purple)
                .setFooter({ text: `Total: ${keys.length} keys` })
                .setTimestamp();
            
            await interaction.editReply({ content: null, embeds: [embed] });
        } catch (error) {
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        }
        return;
    }
    
    if (commandName === 'validar') {
        const key = interaction.options.getString('key');
        
        await interaction.reply({ content: `⏳ Validando key...`, ephemeral: true });
        
        try {
            const result = await validateKey(key);
            
            const isValid = result.valid || result.isValid || result.status === 'active';
            const status = result.status || result.message || (isValid ? '✅ Válida' : '❌ Inválida');
            
            const embed = new EmbedBuilder()
                .setTitle(isValid ? '✅ Key Válida!' : '❌ Key Inválida!')
                .setDescription(`Key: \`${key}\``)
                .addFields(
                    { name: '📊 Status', value: status, inline: true },
                    { name: '👤 Comprador', value: result.buyer || result.comprador || 'N/A', inline: true },
                    { name: '⏰ Expira', value: result.expires_at || result.expiry || 'N/A', inline: true }
                )
                .setColor(isValid ? Colors.Green : Colors.Red)
                .setTimestamp();
            
            await interaction.editReply({ content: null, embeds: [embed] });
        } catch (error) {
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        }
        return;
    }
});

// ============================================
// SERVIDOR WEB
// ============================================
const app = express();
app.get('/', (req, res) => res.send('✅ SILVAZ KEY BOT - ONLINE!'));
app.get('/ping', (req, res) => res.send('pong'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Servidor rodando na porta ${PORT}`));

// ============================================
// INICIAR
// ============================================
client.login(TOKEN);
console.log('🚀 SILVAZ KEY BOT - Iniciado!');
console.log('📌 Comandos: /gerar, /keys, /validar, /status');
console.log('⚠️ ADMIN_API_KEY expira em 30 dias!');
