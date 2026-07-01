// ============================================
// SILVAZ KEY BOT - VERSÃO CORRIGIDA
// ROTA: /auth (NÃO /auth/login)
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
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'rafaelaferraz2102@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '23816bBb';

let sessionCookie = null;
let sessionExpiry = null;

// ============================================
// LOGIN - ROTA /auth (sem /login)
// ============================================
async function loginSite() {
    try {
        console.log('🔐 Fazendo login no site via /auth...');
        console.log(`📧 Email: ${ADMIN_EMAIL}`);

        const response = await axios.post(`${SITE_URL}/auth`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('📡 Resposta completa:', JSON.stringify(response.data, null, 2));

        // Verifica se deu certo
        if (response.data && response.data.success === true) {
            if (response.headers['set-cookie']) {
                sessionCookie = response.headers['set-cookie'].join('; ');
                sessionExpiry = Date.now() + (3600 * 1000);
                console.log('✅ Login realizado com sucesso!');
                return true;
            }
            if (response.data.token) {
                sessionCookie = `token=${response.data.token}`;
                sessionExpiry = Date.now() + (3600 * 1000);
                console.log('✅ Login realizado com token!');
                return true;
            }
            console.log('⚠️ Login OK mas sem cookie/token');
            return true;
        }

        console.log('❌ Falha no login:', response.data);
        return false;
    } catch (error) {
        console.error('❌ Erro no login:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados:', error.response.data);
        }
        return false;
    }
}

// ============================================
// REQUISIÇÕES AUTENTICADAS
// ============================================
async function ensureSession() {
    if (!sessionCookie || Date.now() > sessionExpiry) {
        return await loginSite();
    }
    return true;
}

async function authenticatedRequest(method, endpoint, data = null) {
    await ensureSession();
    
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (sessionCookie) {
            if (sessionCookie.startsWith('token=')) {
                headers['Authorization'] = `Bearer ${sessionCookie.replace('token=', '')}`;
            } else {
                headers['Cookie'] = sessionCookie;
            }
        }

        const config = {
            method: method,
            url: `${SITE_URL}${endpoint}`,
            headers: headers
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
// FUNÇÕES DA API
// ============================================
async function generateKey(type, buyer = null) {
    const data = await authenticatedRequest('POST', '/admin/generate', {
        type: type,
        buyer: buyer || 'Discord Bot'
    });
    return data;
}

async function listKeys() {
    const data = await authenticatedRequest('GET', '/admin/keys');
    return data;
}

async function banKey(key) {
    const data = await authenticatedRequest('POST', '/admin/ban', { key });
    return data;
}

async function removeKey(key) {
    const data = await authenticatedRequest('DELETE', '/admin/remove', { key });
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
    
    await loginSite();
    
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
            description: 'Remover uma key',
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
                { name: '📡 Sessão', value: sessionCookie ? '✅' : '❌', inline: true },
                { name: '🤖 Bot', value: client.user.tag, inline: true }
            )
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }
    
    if (commandName === 'gerar') {
        const tipo = interaction.options.getString('tipo');
        const comprador = interaction.options.getString('comprador') || 'Não informado';
        
        await interaction.reply({ content: '⏳ Gerando...', ephemeral: true });
        
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
                .setTitle('🔑 Key gerada!')
                .setColor(Colors.Purple)
                .setDescription(`\`\`\`${keyValue}\`\`\``)
                .addFields(
                    { name: '📅 Tipo', value: typeNames[tipo] || tipo, inline: true },
                    { name: '👤 Comprador', value: comprador, inline: true },
                    { name: '⏰ Expira', value: new Date(expiresAt).toLocaleString('pt-BR'), inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({ content: null, embeds: [embed] });
        } catch (error) {
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        }
        return;
    }
    
    if (commandName === 'keys') {
        await interaction.reply({ content: '⏳ Carregando...', ephemeral: true });
        
        try {
            const data = await listKeys();
            const keys = data.keys || data.data || [];
            
            if (keys.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📋 Lista')
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
                .setTitle('📋 Keys')
                .setDescription(description)
                .setColor(Colors.Purple)
                .setFooter({ text: `Total: ${keys.length}` })
                .setTimestamp();
            
            await interaction.editReply({ content: null, embeds: [embed] });
        } catch (error) {
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        }
        return;
    }
    
    if (commandName === 'banir') {
        const key = interaction.options.getString('key');
        await interaction.reply({ content: `⏳ Banindo...`, ephemeral: true });
        try {
            await banKey(key);
            const embed = new EmbedBuilder()
                .setTitle('🚫 Banida!')
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
        await interaction.reply({ content: `⏳ Removendo...`, ephemeral: true });
        try {
            await removeKey(key);
            const embed = new EmbedBuilder()
                .setTitle('🗑️ Removida!')
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
// MANTER SESSÃO
// ============================================
setInterval(async () => {
    if (sessionCookie && Date.now() > sessionExpiry) {
        await loginSite();
    }
}, 300000);

// ============================================
// SERVIDOR WEB
// ============================================
const app = express();
app.get('/', (req, res) => res.send('✅ ONLINE!'));
app.get('/ping', (req, res) => res.send('pong'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Servidor na porta ${PORT}`));

// ============================================
// INICIAR
// ============================================
client.login(TOKEN);
console.log('🚀 SILVAZ KEY BOT - Iniciado!');
