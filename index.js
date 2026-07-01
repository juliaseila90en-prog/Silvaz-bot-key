// ============================================
// SILVAZ KEY BOT - SISTEMA DE VENDAS
// COM BOTÃO CONFIRMAR + CARGO + SCRIPT
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

// CONFIGURAVEIS
const ADMIN_IDS = ['1496993217814728855']; // Coloque seu ID
const CARGO_CLIENTE_ID = '1521901747550031973'; // ID do cargo que será dado

// PREÇOS
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
const pendingOrders = new Map(); // { userId: { type, buyer, timestamp, messageId, channelId } }

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
// SCRIPT QUE SERÁ ENVIADO AO CLIENTE
// ============================================
function getScript(key, type) {
    const typeName = TYPE_NAMES[type] || type;
    
    return `
// ============================================
// SILVAZ KEY - SCRIPT DE ATIVAÇÃO
// ============================================

// SUA KEY: ${key}
// TIPO: ${typeName}
// DATA: ${new Date().toLocaleString('pt-BR')}

// COMO USAR:
// 1. Copie a key acima
// 2. Cole no sistema SILVAZ
// 3. Pronto! Aproveite!

console.log('✅ Key ativada com sucesso!');
console.log('📅 Tipo:', '${typeName}');
console.log('🔑 Key:', '${key}');

// ============================================
// FIM DO SCRIPT
// ============================================
`;
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
            name: 'pendentes',
            description: 'Listar pedidos pendentes (ADMIN)',
        },
        {
            name: 'cancelar',
            description: 'Cancelar pedido (ADMIN)',
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
            📱 **Chave:** (coloque sua chave aqui)

            ⏳ Após o pagamento, clique em **"✅ Confirmar Pagamento"** no seu pedido.
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
        
        // HELP PIX
        if (interaction.customId === 'help_pix') {
            const embed = new EmbedBuilder()
                .setTitle('💰 Como pagar?')
                .setDescription(`
                    **Pague via PIX:**

                    📱 **Chave PIX:** (coloque sua chave aqui)
                    👤 **Titular:** (seu nome)

                    ⚠️ **Após o pagamento:**
                    1️⃣ Clique em **"✅ Confirmar Pagamento"**
                    2️⃣ O admin vai confirmar
                    3️⃣ Você recebe sua key no PV!
                `)
                .setColor(Colors.Green)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }
        
        // ========================================
        // BOTÃO: CONFIRMAR PAGAMENTO (CLIENTE)
        // ========================================
        if (interaction.customId === 'confirm_payment') {
            // Verifica se tem pedido pendente
            if (!pendingOrders.has(userId)) {
                await interaction.reply({
                    content: '❌ Você não tem nenhum pedido pendente!',
                    ephemeral: true
                });
                return;
            }
            
            const order = pendingOrders.get(userId);
            
            // Botão de confirmação (só admin vê)
            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`admin_confirm_${userId}`)
                        .setLabel('✅ Confirmar Pagamento')
                        .setStyle(ButtonStyle.Success)
                );
            
            const embed = new EmbedBuilder()
                .setTitle('📩 Pedido Aguardando Confirmação')
                .setDescription(`
                    **Cliente:** ${userName}
                    **Plano:** ${TYPE_NAMES[order.type]}
                    **Valor:** R$${PRICES[order.type].toFixed(2)}
                    
                    ⏳ Aguardando admin confirmar o pagamento.
                `)
                .setColor(Colors.Orange)
                .setTimestamp();
            
            // Notifica o admin
            for (const adminId of ADMIN_IDS) {
                const admin = await client.users.fetch(adminId).catch(() => null);
                if (admin) {
                    await admin.send({
                        content: `🔔 **Pagamento pendente!**\n👤 ${userName}\n📦 ${TYPE_NAMES[order.type]}`,
                        components: [confirmRow]
                    }).catch(() => {});
                }
            }
            
            await interaction.reply({
                content: `✅ **Pagamento confirmado!** Aguarde o admin processar seu pedido.`,
                ephemeral: true
            });
            
            return;
        }
        
        // ========================================
        // BOTÃO: ADMIN CONFIRMAR (VIA PV)
        // ========================================
        if (interaction.customId.startsWith('admin_confirm_')) {
            const buyerId = interaction.customId.replace('admin_confirm_', '');
            
            // Verifica se é admin
            if (!ADMIN_IDS.includes(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Apenas administradores podem confirmar!',
                    ephemeral: true
                });
                return;
            }
            
            // Verifica se o pedido existe
            if (!pendingOrders.has(buyerId)) {
                await interaction.reply({
                    content: '❌ Pedido não encontrado ou já foi processado!',
                    ephemeral: true
                });
                return;
            }
            
            await interaction.reply({ content: '⏳ Processando pedido...', ephemeral: true });
            
            try {
                const order = pendingOrders.get(buyerId);
                const buyer = await client.users.fetch(buyerId).catch(() => null);
                
                if (!buyer) {
                    await interaction.editReply({ content: '❌ Usuário não encontrado!' });
                    return;
                }
                
                // Gera a key
                const result = await generateKey(order.type, order.buyer);
                const keyValue = result.key || result.key_value || result.code || 'N/A';
                const expiresAt = result.expires_at || result.expiry || 'N/A';
                
                // Remove da lista de pendentes
                pendingOrders.delete(buyerId);
                
                // ========================================
                // DAR CARGO DE CLIENTE
                // ========================================
                let cargoAdicionado = false;
                if (CARGO_CLIENTE_ID) {
                    try {
                        // Procura o membro em todos os servidores
                        for (const guild of client.guilds.cache.values()) {
                            try {
                                const member = await guild.members.fetch(buyerId);
                                const cargo = guild.roles.cache.get(CARGO_CLIENTE_ID);
                                if (cargo) {
                                    await member.roles.add(cargo);
                                    cargoAdicionado = true;
                                    console.log(`✅ Cargo dado para ${buyer.username}`);
                                    break;
                                }
                            } catch (e) {}
                        }
                    } catch (error) {
                        console.log('⚠️ Erro ao dar cargo:', error.message);
                    }
                }
                
                // ========================================
                // SCRIPT PARA ENVIAR
                // ========================================
                const script = getScript(keyValue, order.type);
                
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Compra Confirmada!')
                    .setDescription(`
                        **Sua key foi gerada com sucesso!**

                        🔑 **Key:** \`${keyValue}\`
                        📅 **Tipo:** ${TYPE_NAMES[order.type]}
                        👤 **Comprador:** ${order.buyer}
                        ⏰ **Expira:** ${new Date(expiresAt).toLocaleString('pt-BR')}
                        ${cargoAdicionado ? '✅ **Cargo de Cliente adicionado!**' : ''}

                        📜 **Script de ativação abaixo:**
                    `)
                    .setColor(Colors.Green)
                    .setTimestamp();
                
                // Envia PV com Key + Script
                try {
                    await buyer.send({
                        embeds: [embed],
                        files: [{
                            attachment: Buffer.from(script, 'utf-8'),
                            name: `ativar_${keyValue.substring(0, 8)}.js`
                        }]
                    });
                    
                    // Também envia o script como texto
                    await buyer.send({
                        content: `📜 **Script para ativação:**\n\`\`\`javascript\n${script}\n\`\`\``
                    });
                    
                    await interaction.editReply({
                        content: `✅ **Pedido confirmado!** Key e script enviados para ${buyer.username}!`
                    });
                    
                } catch (error) {
                    await interaction.editReply({
                        content: `✅ Key gerada! Mas não consegui enviar PV.\n🔑 Key: \`${keyValue}\`\n📜 Script:\n\`\`\`javascript\n${script}\n\`\`\``
                    });
                }
                
            } catch (error) {
                await interaction.editReply({ content: `❌ Erro: ${error.message}` });
            }
            
            return;
        }
        
        // ========================================
        // COMPRAR (CLICOU NO PLANO)
        // ========================================
        if (interaction.customId.startsWith('buy_')) {
            const type = interaction.customId.replace('buy_', '');
            
            if (pendingOrders.has(userId)) {
                await interaction.reply({
                    content: '❌ Você já tem um pedido pendente!',
                    ephemeral: true
                });
                return;
            }
            
            pendingOrders.set(userId, {
                type: type,
                buyer: userName,
                timestamp: Date.now()
            });
            
            const typeName = TYPE_NAMES[type];
            const price = PRICES[type];
            
            // Botões para o cliente
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_payment')
                        .setLabel('✅ Confirmar Pagamento')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('help_pix')
                        .setLabel('💰 Chave PIX')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            const embed = new EmbedBuilder()
                .setTitle('🛒 Pedido Registrado!')
                .setDescription(`
                    **Plano:** ${typeName}
                    **Valor:** R$${price.toFixed(2)}
                    **Comprador:** ${userName}

                    💰 **Pague via PIX:*12991782675* 

                    ⏳ **Após o pagamento, clique em "✅ Confirmar Pagamento"**
                `)
                .setColor(Colors.Green)
                .setTimestamp();
            
            await interaction.reply({
                content: `📦 **Pedido registrado!**`,
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
            
            // Avisa o admin
            for (const adminId of ADMIN_IDS) {
                const admin = await client.users.fetch(adminId).catch(() => null);
                if (admin) {
                    await admin.send({
                        content: `🔔 **Novo pedido!**\n👤 ${userName}\n📦 ${typeName} - R$${price.toFixed(2)}`
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
    const isAdmin = ADMIN_IDS.includes(interaction.user.id);
    
    // /set_painel
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
    
    // /pendentes
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
            description += `👤 ${userName}\n`;
            description += `📦 ${TYPE_NAMES[order.type] || order.type}\n`;
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
    
    // /cancelar
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
    
    // /keys
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
    
    // /status
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
console.log('📌 Comandos: /set_painel, /pendentes, /cancelar, /keys, /status');
