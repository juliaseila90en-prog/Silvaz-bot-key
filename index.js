// ============================================
// SILVAZ KEY BOT - SISTEMA DE CARRINHO
// ============================================

const { Client, GatewayIntentBits, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
const ADMIN_IDS = ['1496993217814728855']; // Coloque seu ID aqui

// ============================================
// CARRINHO - PEDIDOS PENDENTES
// ============================================
const pendingOrders = new Map(); // { userId: { type, buyer, timestamp, messageId } }

// ============================================
// REQUISIÇÕES COM API KEY
// ============================================
async function apiRequest(method, endpoint, data = null) {
    try {
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
        return response.data;
    } catch (error) {
        console.error(`❌ Erro em ${endpoint}:`, error.message);
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
    console.log(`🔑 API Key configurada!`);
    
    // Testa API
    try {
        await listKeys();
        console.log('✅ Conexão com a API funcionando!');
    } catch (error) {
        console.log('⚠️ Erro ao testar API:', error.message);
    }
    
    // Comandos
    await client.application.commands.set([
        {
            name: 'set_painel',
            description: 'Criar painel de vendas (ADMIN)',
        },
        {
            name: 'confirmar',
            description: 'Confirmar pagamento e gerar key (ADMIN)',
            options: [
                {
                    name: 'usuario',
                    description: '@usuario que comprou',
                    type: 6,
                    required: true
                }
            ]
        },
        {
            name: 'cancelar',
            description: 'Cancelar pedido pendente (ADMIN)',
            options: [
                {
                    name: 'usuario',
                    description: '@usuario da compra',
                    type: 6,
                    required: true
                }
            ]
        },
        {
            name: 'pendentes',
            description: 'Listar pedidos pendentes (ADMIN)',
        },
        {
            name: 'keys',
            description: 'Listar todas as keys (ADMIN)',
        },
        {
            name: 'status',
            description: 'Status do bot',
        }
    ]);
    
    console.log('📌 Comandos registrados!');
});

// ============================================
// PAINEL - BOTÕES
// ============================================
function createPanel() {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('buy_daily')
                .setLabel('📅 24 Horas - R$5')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('buy_weekly')
                .setLabel('📅 7 Dias - R$15')
                .setStyle(ButtonStyle.Primary)
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('buy_monthly')
                .setLabel('📅 30 Dias - R$40')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('buy_lifetime')
                .setLabel('♾️ Vitalícia - R$100')
                .setStyle(ButtonStyle.Primary)
        );
    
    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('help_pix')
                .setLabel('💰 Como pagar?')
                .setStyle(ButtonStyle.Success)
        );
    
    const embed = new EmbedBuilder()
        .setTitle('🛒 SILVAZ KEY STORE')
        .setDescription(`
            **Escolha seu plano abaixo:**

            📅 **24 Horas** - R$5
            📅 **7 Dias** - R$15  
            📅 **30 Dias** - R$40
            ♾️ **Vitalícia** - R$100

            💳 **Pagamento:** PIX

            ⏳ Após o pagamento, aguarde a confirmação do admin.
        `)
        .setColor(Colors.Purple)
        .setFooter({ text: 'SILVAZ KEY STORE' })
        .setTimestamp();
    
    return { embeds: [embed], components: [row1, row2, row3] };
}

// ============================================
// INTERAÇÕES
// ============================================
client.on('interactionCreate', async (interaction) => {
    // ========================================
    // BOTÕES
    // ========================================
    if (interaction.isButton()) {
        const userId = interaction.user.id;
        const userName = interaction.user.username;
        
        // AJUDA PIX
        if (interaction.customId === 'help_pix') {
            const embed = new EmbedBuilder()
                .setTitle('💰 Como pagar?')
                .setDescription(`
                    **Pague via PIX:**

                    📱 **Chave PIX:** (coloque sua chave aqui)
                    🏦 **Banco:** (nome do banco)
                    👤 **Titular:** (seu nome)

                    ⚠️ **Após o pagamento:**
                    1️⃣ Envie o comprovante no chat
                    2️⃣ O admin vai confirmar
                    3️⃣ Você recebe sua key no PV!
                `)
                .setColor(Colors.Green)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }
        
        // COMPRAR
        if (interaction.customId.startsWith('buy_')) {
            const type = interaction.customId.replace('buy_', '');
            
            // Verifica se já tem pedido pendente
            if (pendingOrders.has(userId)) {
                await interaction.reply({
                    content: '❌ Você já tem um pedido pendente! Aguarde o admin confirmar.',
                    ephemeral: true
                });
                return;
            }
            
            // Salva pedido
            pendingOrders.set(userId, {
                type: type,
                buyer: userName,
                timestamp: Date.now()
            });
            
            const typeNames = {
                daily: '24 Horas - R$5',
                weekly: '7 Dias - R$15',
                monthly: '30 Dias - R$40',
                lifetime: 'Vitalícia - R$100'
            };
            
            const embed = new EmbedBuilder()
                .setTitle('🛒 Pedido Registrado!')
                .setDescription(`
                    **Tipo:** ${typeNames[type]}
                    **Comprador:** ${userName}
                    
                    📤 **Envie o comprovante de pagamento aqui no chat**
                    ⏳ Aguarde o admin confirmar
                `)
                .setColor(Colors.Green)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
            // Avisa os admins
            for (const adminId of ADMIN_IDS) {
                const admin = await client.users.fetch(adminId).catch(() => null);
                if (admin) {
                    await admin.send({
                        content: `🔔 **NOVO PEDIDO!**
                        Usuário: ${userName} (<@${userId}>)
                        Tipo: ${typeNames[type]}

                        Use: /confirmar @${userName}`
                    }).catch(() => {});
                }
            }
            return;
        }
    }
    
    // ========================================
    // COMANDOS SLASH
    // ========================================
    if (!interaction.isCommand()) return;
    
    const { commandName } = interaction;
    
    // VERIFICA ADMIN
    const isAdmin = ADMIN_IDS.includes(interaction.user.id);
    
    // ========================================
    // /set_painel - ADMIN
    // ========================================
    if (commandName === 'set_painel') {
        if (!isAdmin) {
            await interaction.reply({ content: '❌ Apenas administradores!', ephemeral: true });
            return;
        }
        
        const panel = createPanel();
        await interaction.reply(panel);
        console.log('📊 Painel criado!');
        return;
    }
    
    // ========================================
    // /confirmar - ADMIN
    // ========================================
    if (commandName === 'confirmar') {
        if (!isAdmin) {
            await interaction.reply({ content: '❌ Apenas administradores!', ephemeral: true });
            return;
        }
        
        const usuario = interaction.options.getUser('usuario');
        const userId = usuario.id;
        
        if (!pendingOrders.has(userId)) {
            await interaction.reply({
                content: `❌ ${usuario.username} não tem pedido pendente!`,
                ephemeral: true
            });
            return;
        }
        
        await interaction.reply({ content: `⏳ Gerando key para ${usuario.username}...`, ephemeral: true });
        
        try {
            const order = pendingOrders.get(userId);
            const result = await generateKey(order.type, order.buyer);
            const keyValue = result.key || result.key_value || result.code || 'N/A';
            const expiresAt = result.expires_at || result.expiry || 'N/A';
            
            pendingOrders.delete(userId);
            
            const typeNames = {
                daily: '24 Horas',
                weekly: '7 Dias',
                monthly: '30 Dias',
                lifetime: 'Vitalícia'
            };
            
            const embed = new EmbedBuilder()
                .setTitle('🎉 Sua Key foi gerada!')
                .setDescription(`\`\`\`${keyValue}\`\`\``)
                .setColor(Colors.Purple)
                .addFields(
                    { name: '📅 Tipo', value: typeNames[order.type] || order.type, inline: true },
                    { name: '👤 Comprador', value: order.buyer, inline: true },
                    { name: '⏰ Expira', value: new Date(expiresAt).toLocaleString('pt-BR'), inline: true }
                )
                .setFooter({ text: 'SILVAZ KEY STORE' })
                .setTimestamp();
            
            // Envia PV
            try {
                await usuario.send({ embeds: [embed] });
                await interaction.editReply({ content: `✅ Key enviada para ${usuario.username}!` });
            } catch (error) {
                await interaction.editReply({ 
                    content: `✅ Key gerada! Mas não consegui enviar PV.\nKey: \`${keyValue}\`` 
                });
            }
            
        } catch (error) {
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        }
        return;
    }
    
    // ========================================
    // /cancelar - ADMIN
    // ========================================
    if (commandName === 'cancelar') {
        if (!isAdmin) {
            await interaction.reply({ content: '❌ Apenas administradores!', ephemeral: true });
            return;
        }
        
        const usuario = interaction.options.getUser('usuario');
        const userId = usuario.id;
        
        if (!pendingOrders.has(userId)) {
            await interaction.reply({
                content: `❌ ${usuario.username} não tem pedido pendente!`,
                ephemeral: true
            });
            return;
        }
        
        pendingOrders.delete(userId);
        await interaction.reply({
            content: `✅ Pedido de ${usuario.username} cancelado!`,
            ephemeral: true
        });
        return;
    }
    
    // ========================================
    // /pendentes - ADMIN
    // ========================================
    if (commandName === 'pendentes') {
        if (!isAdmin) {
            await interaction.reply({ content: '❌ Apenas administradores!', ephemeral: true });
            return;
        }
        
        if (pendingOrders.size === 0) {
            await interaction.reply({ content: '📋 Nenhum pedido pendente!', ephemeral: true });
            return;
        }
        
        let description = '📋 **Pedidos Pendentes:**\n\n';
        for (const [userId, order] of pendingOrders) {
            const user = await client.users.fetch(userId).catch(() => null);
            const userName = user ? user.username : 'Desconhecido';
            const typeNames = {
                daily: '24 Horas',
                weekly: '7 Dias',
                monthly: '30 Dias',
                lifetime: 'Vitalícia'
            };
            description += `👤 ${userName}\n`;
            description += `📦 ${typeNames[order.type] || order.type}\n`;
            description += `⏰ ${new Date(order.timestamp).toLocaleString('pt-BR')}\n\n`;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Pedidos Pendentes')
            .setDescription(description)
            .setColor(Colors.Orange)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }
    
    // ========================================
    // /keys - ADMIN
    // ========================================
    if (commandName === 'keys') {
        if (!isAdmin) {
            await interaction.reply({ content: '❌ Apenas administradores!', ephemeral: true });
            return;
        }
        
        await interaction.reply({ content: '⏳ Carregando...', ephemeral: true });
        
        try {
            const data = await listKeys();
            const keys = data.keys || data.data || [];
            
            if (keys.length === 0) {
                await interaction.editReply({ content: '📋 Nenhuma key encontrada.' });
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
    
    // ========================================
    // /status
    // ========================================
    if (commandName === 'status') {
        const embed = new EmbedBuilder()
            .setTitle('🔌 Status')
            .setColor(Colors.Purple)
            .addFields(
                { name: '🌐 Site', value: SITE_URL, inline: true },
                { name: '🤖 Bot', value: client.user.tag, inline: true },
                { name: '📦 Pendentes', value: `${pendingOrders.size}`, inline: true },
                { name: '🔑 API Key', value: '✅ Configurada', inline: true }
            )
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
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
console.log('📌 Comandos: /set_painel, /confirmar, /cancelar, /pendentes, /keys, /status');
