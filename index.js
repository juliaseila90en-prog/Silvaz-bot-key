// ============================================
// SILVAZ KEY BOT - COMPLETO E CORRIGIDO
// ============================================

const { Client, GatewayIntentBits, EmbedBuilder, Colors } = require('discord.js');
const axios = require('axios');
const express = require('express');

// ============================================
// CONFIGURAÇÃO - VARIÁVEIS DE AMBIENTE
// ============================================
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
    console.error('❌ ERRO: Token não configurado!');
    console.log('Adicione TOKEN nas variáveis de ambiente do Render');
    process.exit(1);
}

const SITE_URL = 'https://keyssilvaz.lovable.app';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'rafaelaferraz2102@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '23816bBb';

// ============================================
// COOKIE DE SESSÃO
// ============================================
let sessionCookie = null;
let sessionExpiry = null;

// ============================================
// FUNÇÃO PARA FAZER LOGIN NO SITE
// ============================================
async function loginSite() {
    try {
        console.log('🔐 Fazendo login no site...');
        const response = await axios.post(`${SITE_URL}/api/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.success) {
            const cookies = response.headers['set-cookie'];
            if (cookies) {
                sessionCookie = cookies.join('; ');
                sessionExpiry = Date.now() + (3600 * 1000);
                console.log('✅ Login no site realizado com sucesso!');
                return true;
            }
        }
        console.log('❌ Falha no login:', response.data);
        return false;
    } catch (error) {
        console.error('❌ Erro ao fazer login no site:', error.message);
        return false;
    }
}

// ============================================
// FUNÇÃO PARA VERIFICAR SESSÃO
// ============================================
async function ensureSession() {
    if (!sessionCookie || Date.now() > sessionExpiry) {
        return await loginSite();
    }
    return true;
}

// ============================================
// FUNÇÃO PARA FAZER REQUISIÇÕES AUTENTICADAS
// ============================================
async function authenticatedRequest(method, endpoint, data = null) {
    await ensureSession();
    
    try {
        const config = {
            method: method,
            url: `${SITE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'Cookie': sessionCookie || ''
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
            config.data = data;
        }
        
        const response = await axios(config);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            await loginSite();
            return authenticatedRequest(method, endpoint, data);
        }
        throw error;
    }
}

// ============================================
// FUNÇÕES DE API
// ============================================
async function generateKey(type, buyer = null) {
    const data = await authenticatedRequest('POST', '/api/generate', {
        type: type,
        buyer: buyer || 'Discord Bot'
    });
    return data;
}

async function listKeys() {
    const data = await authenticatedRequest('GET', '/api/keys');
    return data;
}

async function banKey(key) {
    const data = await authenticatedRequest('POST', '/api/ban', { key });
    return data;
}

async function removeKey(key) {
    const data = await authenticatedRequest('DELETE', '/api/remove', { key });
    return data;
}

// ============================================
// INICIALIZAR BOT
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
    console.log(`🌐 Conectando ao site: ${SITE_URL}`);
    
    await loginSite();
    
    client.application.commands.set([
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
                    description: 'Nome do comprador (opcional)',
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
            name: 'banir',
            description: 'Banir uma key',
            options: [
                {
                    name: 'key',
                    description: 'Key a ser banida',
                    type: 3,
                    required: true
                }
            ]
        },
        {
            name: 'remover',
            description: 'Remover uma key permanentemente',
            options: [
                {
                    name: 'key',
                    description: 'Key a ser removida',
                    type: 3,
                    required: true
                }
            ]
        },
        {
            name: 'status',
            description: 'Verificar status da conexão com o site'
        }
    ]);
});

// ============================================
// COMANDOS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    
    const { commandName } = interaction;
    
    if (commandName === 'status') {
        const embed = new EmbedBuilder()
            .setTitle('🔌 Status da Conexão')
            .setColor(Colors.Purple)
            .addFields(
                { name: '🌐 Site', value: SITE_URL, inline: true },
                { name: '📡 Sessão', value: sessionCookie ? '✅ Ativa' : '❌ Inativa', inline: true },
                { name: '👤 Admin', value: ADMIN_EMAIL, inline: true }
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
            
            const embed = new EmbedBuilder()
                .setTitle('🔑 Key gerada com sucesso!')
                .setColor(Colors.Purple)
                .setDescription(`\`\`\`${result.key}\`\`\``)
                .addFields(
                    { name: '📅 Tipo', value: typeNames[tipo], inline: true },
                    { name: '👤 Comprador', value: comprador, inline: true },
                    { name: '⏰ Expira', value: new Date(result.expires_at).toLocaleString(), inline: true },
                    { name: '📊 Status', value: '🟢 Ativa', inline: true }
                )
                .setFooter({ text: 'SILVAZ KEY GENERATOR' })
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
            const keys = data.keys || [];
            
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
            const activeKeys = keys.filter(k => k.status === 'active');
            const expiredKeys = keys.filter(k => k.status === 'expired');
            const bannedKeys = keys.filter(k => k.status === 'banned');
            
            description += `📊 **Resumo:**\n`;
            description += `🟢 Ativas: ${activeKeys.length}\n`;
            description += `🟠 Expiradas: ${expiredKeys.length}\n`;
            description += `🔴 Banidas: ${bannedKeys.length}\n\n`;
            
            description += `📌 **Últimas 10 Keys:**\n`;
            const recentKeys = keys.slice(-10).reverse();
            for (const k of recentKeys) {
                const statusIcon = k.status === 'active' ? '🟢' : k.status === 'expired' ? '🟠' : '🔴';
                const buyer = k.buyer || 'N/A';
                description += `${statusIcon} \`${k.key_value}\` - ${buyer} (${k.type})\n`;
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
    
    if (commandName === 'banir') {
        const key = interaction.options.getString('key');
        
        await interaction.reply({ content: `⏳ Banindo key ${key}...`, ephemeral: true });
        
        try {
            await banKey(key);
            
            const embed = new EmbedBuilder()
                .setTitle('🚫 Key banida com sucesso!')
                .setDescription(`Key: \`${key}\``)
                .setColor(Colors.Red)
                .setTimestamp();
            
            await interaction.editReply({ content: null, embeds: [embed] });
        } catch (error) {
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        }
        return;
    }
    
    if (commandName === 'remover') {
        const key = interaction.options.getString('key');
        
        await interaction.reply({ content: `⏳ Removendo key ${key}...`, ephemeral: true });
        
        try {
            await removeKey(key);
            
            const embed = new EmbedBuilder()
                .setTitle('🗑️ Key removida permanentemente!')
                .setDescription(`Key: \`${key}\``)
                .setColor(Colors.Orange)
                .setTimestamp();
            
            await interaction.editReply({ content: null, embeds: [embed] });
        } catch (error) {
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        }
        return;
    }
});

// ============================================
// MANTER SESSÃO ATIVA
// ============================================
setInterval(async () => {
    if (sessionCookie && Date.now() > sessionExpiry) {
        console.log('🔄 Renovando sessão...');
        await loginSite();
    }
}, 300000);

// ============================================
// SERVIDOR WEB PARA MANTER ONLINE
// ============================================
const app = express();
app.get('/', (req, res) => {
    res.send('✅ SILVAZ KEY BOT - ONLINE!');
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor web rodando na porta ${PORT}`);
});

// ============================================
// INICIAR BOT
// ============================================
client.login(TOKEN);

console.log('🚀 SILVAZ KEY BOT - Iniciado!');
console.log('📌 Comandos: /gerar, /keys, /banir, /remover, /status');
