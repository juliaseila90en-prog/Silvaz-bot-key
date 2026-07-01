// ============================================
// SILVAZ KEY BOT - SISTEMA COM CANAIS
// ============================================

const { Client, GatewayIntentBits, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
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
const ADMIN_IDS = ['1496993217814728855']; // Coloque seu ID

// IDs dos canais/categorias (você vai preencher depois)
const CATEGORY_ID = '1521898005341405324'; // Categoria onde os canais serão criados
const LOG_CHANNEL_ID = '1521898005341405326'; // Canal para logs

// Preços
const PRICES = {
    daily: 0.50,
    weekly: 1.00,
    monthly: 5.00,
    lifetime: 10.00
};

const TYPE_NAMES = {
    daily: '24 Horas',
    weekly: '7 Dias',
    monthly: '30 Dias',
    lifetime: 'Vitalícia'
};

// ============================================
// PEDIDOS PENDENTES
// ============================================
const pendingOrders = new Map(); // { userId: { type, buyer, timestamp, channelId } }

// ============================================
// REQUISIÇÕES API
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
    
    try {
        await listKeys();
        console.log('✅ Conexão com a API funcionando!');
    } catch (error) {
        console.log('⚠️ Erro ao testar API:', error.message);
    }
    
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
// PAINEL
// ============================================
function createPanel() {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('buy_daily')
                .setLabel('📅 24H - R$0,50')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('buy_weekly')
                .setLabel('📅 7D - R$1,00')
                .setStyle(ButtonStyle.Primary)
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('buy_monthly')
                .setLabel('📅 30D - R$5,00')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('buy_lifetime')
                .setLabel('♾️ Vitalícia - R$10,00')
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
            **Escolha seu plano:**

            📅 **24 Horas** - R$0,50
            📅 **7 Dias** - R$1,00
            📅 **30 Dias** - R$5,00
            ♾️ **Vitalícia** - R$10,00

            💳 **Pagamento:** PIX

            ⏳ Após o pagamento, um canal será criado para te atender.
        `)
        .setColor(Colors.Purple)
        .setFooter({ text: 'SILVAZ KEY STORE' })
        .setTimestamp();
    
    return { embeds: [embed], components: [row1, row2, row3] };
}

// ============================================
// CRIAR CANAL DE ATENDIMENTO
// ============================================
async function createTicketChannel(interaction, type, userName, userId) {
    const guild = interaction.guild;
    const category = guild.channels.cache.get(CATEGORY_ID);
    
    const channelName = `ticket-${userName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category || undefined,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: userId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
            },
            {
                id: interaction.client.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
            },
            ...ADMIN_IDS.map(adminId => ({
                id: adminId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
            }))
        ]
    });
    
    const price = PRICES[type] || 0;
    const typeName = TYPE_NAMES[type] || type;
    
    const embed = new EmbedBuilder()
        .setTitle('🎫 Ticket de Atendimento')
        .setDescription(`
            **Bem-vindo ao seu atendimento!** 👋

            **Plano:** ${typeName}
            **Valor:** R$${price.toFixed(2)}
            **Comprador:** ${userName}

            📤 **Envie o comprovante do pagamento aqui.**
            ⏳ Aguarde o admin confirmar.

            💰 **Chave PIX:** (coloque sua chave aqui)
        `)
        .setColor(Colors.Green)
        .setTimestamp();
    
    await channel.send({
        content: `<@${userId}> | ${ADMIN_IDS.map(id => `<@${id}>`).join(' ')}`,
        embeds: [embed]
    });
    
    return channel;
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
        
        // HELP PIX
        if (interaction.customId === 'help_pix') {
            const embed = new EmbedBuilder()
                .setTitle('💰 Como pagar?')
                .setDescription(`
                    **Pague via PIX:**

                    📱 **Chave PIX:** (coloque sua chave aqui)
                    👤 **Titular:** (seu nome)

                    ⚠️ **Após o pagamento:**
                    1️⃣ Um canal será criado para você
                    2️⃣ Envie o comprovante no canal
                    3️⃣ O admin vai confirmar
                    4️⃣ Você recebe sua key no PV!
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
            
            await interaction.reply({ content: '⏳ Criando seu canal de atendimento...', ephemeral: true });
            
            try {
                // Cria canal de atendimento
                const channel = await createTicketChannel(interaction, type, userName, userId);
                
                // Salva pedido
                pendingOrders.set(userId, {
                    type: type,
                    buyer: userName,
                    timestamp: Date.now(),
                    channelId: channel.id
                });
                
                const typeName = TYPE_NAMES[type];
                const price = PRICES[type];
                
                await interaction.editReply({
                    content: `✅ Canal criado! Acesse: ${channel}\n📦 Plano: ${typeName} - R$${price.toFixed(2)}`
                });
                
                // Log
                if (LOG_CHANNEL_ID) {
                    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
                    if (logChannel) {
                        await logChannel.send({
                            content: `🔔 **NOVO TICKET**\n👤 ${userName}\n📦 ${typeName}\n📌 ${channel}`
                        });
                    }
                }
                
            } catch (error) {
                console.error('Erro ao criar canal:', error);
                await interaction.editReply({ content: `❌ Erro ao criar canal: ${error.message}` });
            }
            return;
        }
    }
    
    // ========================================
    // COMANDOS SLASH
    // ========================================
    if (!interaction.isCommand()) return;
    
    const { commandName } = interaction;
    const isAdmin = ADMIN_IDS.includes(interaction.user.id);
    
    // ========================================
    // /set_painel
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
    // /confirmar
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
            
            // Fecha o canal
            if (order.channelId) {
                const channel = interaction.guild.channels.cache.get(order.channelId);
                if (channel) {
                    await channel.send({
                        content: `✅ **Pedido confirmado!** Key enviada no PV de ${usuario.username}.`
                    });
                    setTimeout(async () => {
                        try {
                            await channel.delete();
                            console.log(`🗑️ Canal ${channel.name} deletado.`);
                        } catch (e) {
                            console.log('Erro ao deletar canal:', e);
                        }
                    }, 5000);
                }
            }
            
            pendingOrders.delete(userId);
            
            const typeName = TYPE_NAMES[order.type] || order.type;
            
            const embed = new EmbedBuilder()
                .setTitle('🎉 Sua Key foi gerada!')
                .setDescription(`\`\`\`${keyValue}\`\`\``)
                .setColor(Colors.Purple)
                .addFields(
                    { name: '📅 Tipo', value: typeName, inline: true },
                    { name: '👤 Comprador', value: order.buyer, inline: true },
                    { name: '⏰ Expira', value: new Date(expiresAt).toLocaleString('pt-BR'), inline: true }
                )
                .setFooter({ text: 'SILVAZ KEY STORE' })
                .setTimestamp();
            
            try {
                await usuario.send({ embeds: [embed] });
                await interaction.editReply({ content: `✅ Key enviada para ${usuario.username}!` });
            } catch (error) {
                await interaction.editReply({ 
                    content: `✅ Key gerada! Mas não consegui enviar PV.\nKey: \`${keyValue}\`` 
                });
            }
            
            // Log
            if (LOG_CHANNEL_ID) {
                const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send({
                        content: `✅ **PAGAMENTO CONFIRMADO**\n👤 ${usuario.username}\n📦 ${typeName}\n🔑 \`${keyValue}\``
                    });
                }
            }
            
        } catch (error) {
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        }
        return;
    }
    
    // ========================================
    // /cancelar
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
        
        const order = pendingOrders.get(userId);
        
        // Fecha o canal
        if (order.channelId) {
            const channel = interaction.guild.channels.cache.get(order.channelId);
            if (channel) {
                await channel.send({
                    content: `❌ **Pedido cancelado!**`
                });
                setTimeout(async () => {
                    try {
                        await channel.delete();
                    } catch (e) {}
                }, 3000);
            }
        }
        
        pendingOrders.delete(userId);
        await interaction.reply({
            content: `✅ Pedido de ${usuario.username} cancelado!`,
            ephemeral: true
        });
        return;
    }
    
    // ========================================
    // /pendentes
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
            const typeName = TYPE_NAMES[order.type] || order.type;
            description += `👤 ${userName}\n`;
            description += `📦 ${typeName}\n`;
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
    // /keys
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
