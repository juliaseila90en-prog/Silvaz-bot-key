// ============================================
// SILVAZ KEY BOT - SISTEMA DE GERENCIAMENTO
// COMANDOS: /add_admin, /rem_admin, /admins, /set_pix
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

// CONFIGURÁVEIS (podem ser alteradas pelos comandos)
let ADMIN_IDS = ['1496993217814728855']; // ID do dono
let CARGO_CLIENTE_ID = 'ID_DO_CARGO_CLIENTE_AQUI';
let CATEGORIA_CARRINHOS_ID = 'ID_DA_CATEGORIA_AQUI';
let CHAVE_PIX = 'coloque_sua_chave_pix_aqui';
let TITULAR_PIX = 'Seu Nome Aqui';

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
const pendingOrders = new Map();

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
// SCRIPT
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
        Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', async () => {
    console.log(`✅ Bot logado como ${client.user.tag}`);
    console.log(`🌐 Site: ${SITE_URL}`);
    console.log(`🔑 API Key configurada!`);
    console.log(`👑 Dono: <@${ADMIN_IDS[0]}>`);
    console.log(`💰 Chave PIX: ${CHAVE_PIX}`);
    
    try {
        await listKeys();
        console.log('✅ Conexão com a API funcionando!');
    } catch (error) {
        console.log('⚠️ Erro ao testar API:', error.message);
    }
    
    await client.application.commands.set([
        // Comandos de Vendas
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
        },
        
        // ========================================
        // COMANDOS DE GERENCIAMENTO
        // ========================================
        {
            name: 'add_admin',
            description: 'Adicionar um novo administrador (DONO)',
            options: [
                {
                    name: 'usuario',
                    description: '@usuario para adicionar',
                    type: 6,
                    required: true
                }
            ]
        },
        {
            name: 'rem_admin',
            description: 'Remover um administrador (DONO)',
            options: [
                {
                    name: 'usuario',
                    description: '@usuario para remover',
                    type: 6,
                    required: true
                }
            ]
        },
        {
            name: 'admins',
            description: 'Listar todos os administradores',
        },
        {
            name: 'set_pix',
            description: 'Alterar a chave PIX (ADMIN)',
            options: [
                {
                    name: 'chave',
                    description: 'Nova chave PIX',
                    type: 3,
                    required: true
                }
            ]
        },
        {
            name: 'set_titular',
            description: 'Alterar o titular do PIX (ADMIN)',
            options: [
                {
                    name: 'nome',
                    description: 'Nome do titular',
                    type: 3,
                    required: true
                }
            ]
        },
        {
            name: 'config',
            description: 'Ver configurações atuais (ADMIN)',
        }
    ]);
    
    console.log('📌 Comandos registrados!');
});

// ============================================
// CRIAR CARRINHO
// ============================================
async function criarCarrinho(interaction, type, userName, userId) {
    const guild = interaction.guild;
    const categoria = guild.channels.cache.get(CATEGORIA_CARRINHOS_ID);
    
    const nomeCanal = `carrinho-${userName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    const canal = await guild.channels.create({
        name: nomeCanal,
        type: ChannelType.GuildText,
        parent: categoria || undefined,
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
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`admin_confirm_${userId}`)
                .setLabel('✅ Confirmar Pagamento')
                .setStyle(ButtonStyle.Success)
        );
    
    const embed = new EmbedBuilder()
        .setTitle('🛒 CARRINHO DE COMPRAS')
        .setDescription(`
            **Cliente:** ${userName}
            **Plano:** ${TYPE_NAMES[type]}
            **Valor:** R$${PRICES[type].toFixed(2)}

            💰 **Chave PIX:** ${CHAVE_PIX}
            👤 **Titular:** ${TITULAR_PIX}

            📤 **Envie o comprovante aqui.**
            ⏳ Aguarde o admin confirmar.
        `)
        .setColor(Colors.Green)
        .setTimestamp();
    
    await canal.send({
        content: `👋 ${userName} | ${ADMIN_IDS.map(id => `<@${id}>`).join(' ')}`,
        embeds: [embed],
        components: [row]
    });
    
    return canal;
}

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
    
    const embed = new EmbedBuilder()
        .setTitle('🛒 SILVAZ KEY STORE')
        .setDescription(`
            **Escolha seu plano:**

            📅 **24 Horas** - R$0,50
            📅 **7 Dias** - R$1,00
            📅 **30 Dias** - R$5,00
            ♾️ **Vitalícia** - R$10,00

            💳 **Pagamento:** PIX
            📱 **Chave:** ${CHAVE_PIX}

            ⏳ Após clicar, um **carrinho privado** será criado para você.
        `)
        .setColor(Colors.Purple)
        .setFooter({ text: 'SILVAZ KEY STORE' })
        .setTimestamp();
    
    return { embeds: [embed], components: [row1, row2] };
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
        
        if (interaction.customId.startsWith('buy_')) {
            const type = interaction.customId.replace('buy_', '');
            
            if (pendingOrders.has(userId)) {
                await interaction.reply({
                    content: '❌ Você já tem um carrinho aberto!',
                    ephemeral: true
                });
                return;
            }
            
            await interaction.reply({ content: '⏳ Criando seu carrinho...', ephemeral: true });
            
            try {
                const canal = await criarCarrinho(interaction, type, userName, userId);
                
                pendingOrders.set(userId, {
                    type: type,
                    buyer: userName,
                    timestamp: Date.now(),
                    channelId: canal.id
                });
                
                await interaction.editReply({
                    content: `✅ **Carrinho criado!** Acesse: ${canal}`
                });
                
            } catch (error) {
                console.error('Erro ao criar carrinho:', error);
                await interaction.editReply({ content: `❌ Erro: ${error.message}` });
            }
            return;
        }
        
        if (interaction.customId.startsWith('admin_confirm_')) {
            const buyerId = interaction.customId.replace('admin_confirm_', '');
            
            if (!ADMIN_IDS.includes(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Apenas administradores podem confirmar!',
                    ephemeral: true
                });
                return;
            }
            
            if (!pendingOrders.has(buyerId)) {
                await interaction.reply({
                    content: '❌ Pedido não encontrado!',
                    ephemeral: true
                });
                return;
            }
            
            await interaction.reply({ content: '⏳ Processando...', ephemeral: true });
            
            try {
                const order = pendingOrders.get(buyerId);
                const buyer = await client.users.fetch(buyerId).catch(() => null);
                
                if (!buyer) {
                    await interaction.editReply({ content: '❌ Usuário não encontrado!' });
                    return;
                }
                
                const result = await generateKey(order.type, order.buyer);
                const keyValue = result.key || result.key_value || result.code || 'N/A';
                const expiresAt = result.expires_at || result.expiry || 'N/A';
                
                pendingOrders.delete(buyerId);
                
                if (order.channelId) {
                    const canal = interaction.guild.channels.cache.get(order.channelId);
                    if (canal) {
                        await canal.send({ content: `✅ **Pagamento confirmado!** Key enviada no PV.` });
                        setTimeout(async () => {
                            try {
                                await canal.delete();
                            } catch (e) {}
                        }, 3000);
                    }
                }
                
                let cargoAdicionado = false;
                if (CARGO_CLIENTE_ID) {
                    try {
                        for (const guild of client.guilds.cache.values()) {
                            try {
                                const member = await guild.members.fetch(buyerId);
                                const cargo = guild.roles.cache.get(CARGO_CLIENTE_ID);
                                if (cargo) {
                                    await member.roles.add(cargo);
                                    cargoAdicionado = true;
                                    break;
                                }
                            } catch (e) {}
                        }
                    } catch (error) {}
                }
                
                const script = getScript(keyValue, order.type);
                
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Compra Confirmada!')
                    .setDescription(`
                        🔑 **Key:** \`${keyValue}\`
                        📅 **Tipo:** ${TYPE_NAMES[order.type]}
                        👤 **Comprador:** ${order.buyer}
                        ⏰ **Expira:** ${new Date(expiresAt).toLocaleString('pt-BR')}
                        ${cargoAdicionado ? '✅ **Cargo de Cliente adicionado!**' : ''}
                    `)
                    .setColor(Colors.Green)
                    .setTimestamp();
                
                try {
                    await buyer.send({
                        embeds: [embed],
                        files: [{
                            attachment: Buffer.from(script, 'utf-8'),
                            name: `ativar_${keyValue.substring(0, 8)}.js`
                        }]
                    });
                    
                    await buyer.send({
                        content: `📜 **Script:**\n\`\`\`javascript\n${script}\n\`\`\``
                    });
                    
                    await interaction.editReply({
                        content: `✅ **Pedido confirmado!** Key enviada para ${buyer.username}!`
                    });
                    
                } catch (error) {
                    await interaction.editReply({
                        content: `✅ Key gerada! Mas não consegui enviar PV.\n🔑 Key: \`${keyValue}\``
                    });
                }
                
            } catch (error) {
                await interaction.editReply({ content: `❌ Erro: ${error.message}` });
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
    const isOwner = ADMIN_IDS[0] === interaction.user.id;
    
    // ========================================
    // COMANDOS DE GERENCIAMENTO (SÓ O DONO)
    // ========================================
    
    // /add_admin
    if (commandName === 'add_admin') {
        if (!isOwner) {
            await interaction.reply({ content: '❌ Apenas o DONO pode adicionar admins!', ephemeral: true });
            return;
        }
        
        const usuario = interaction.options.getUser('usuario');
        const userId = usuario.id;
        
        if (ADMIN_IDS.includes(userId)) {
            await interaction.reply({ content: `❌ ${usuario.username} já é admin!`, ephemeral: true });
            return;
        }
        
        ADMIN_IDS.push(userId);
        await interaction.reply({ 
            content: `✅ ${usuario.username} adicionado como administrador!`,
            ephemeral: true 
        });
        console.log(`👑 Novo admin: ${usuario.username} (${userId})`);
        return;
    }
    
    // /rem_admin
    if (commandName === 'rem_admin') {
        if (!isOwner) {
            await interaction.reply({ content: '❌ Apenas o DONO pode remover admins!', ephemeral: true });
            return;
        }
        
        const usuario = interaction.options.getUser('usuario');
        const userId = usuario.id;
        
        if (userId === ADMIN_IDS[0]) {
            await interaction.reply({ content: '❌ Você não pode remover o dono!', ephemeral: true });
            return;
        }
        
        if (!ADMIN_IDS.includes(userId)) {
            await interaction.reply({ content: `❌ ${usuario.username} não é admin!`, ephemeral: true });
            return;
        }
        
        ADMIN_IDS = ADMIN_IDS.filter(id => id !== userId);
        await interaction.reply({ 
            content: `✅ ${usuario.username} removido dos administradores!`,
            ephemeral: true 
        });
        console.log(`👑 Admin removido: ${usuario.username} (${userId})`);
        return;
    }
    
    // /admins
    if (commandName === 'admins') {
        let desc = '👑 **Administradores:**\n\n';
        for (const id of ADMIN_IDS) {
            const user = await client.users.fetch(id).catch(() => null);
            const name = user ? user.username : 'Desconhecido';
            const isOwnerText = id === ADMIN_IDS[0] ? ' 👑 (Dono)' : '';
            desc += `✅ ${name} (${id})${isOwnerText}\n`;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('👑 Lista de Administradores')
            .setDescription(desc)
            .setColor(Colors.Purple)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }
    
    // /set_pix
    if (commandName === 'set_pix') {
        if (!isAdmin) {
            await interaction.reply({ content: '❌ Apenas administradores!', ephemeral: true });
            return;
        }
        
        const chave = interaction.options.getString('chave');
        CHAVE_PIX = chave;
        await interaction.reply({ 
            content: `✅ Chave PIX alterada para: \`${chave}\``,
            ephemeral: true 
        });
        console.log(`💰 Chave PIX alterada: ${chave}`);
        return;
    }
    
    // /set_titular
    if (commandName === 'set_titular') {
        if (!isAdmin) {
            await interaction.reply({ content: '❌ Apenas administradores!', ephemeral: true });
            return;
        }
        
        const nome = interaction.options.getString('nome');
        TITULAR_PIX = nome;
        await interaction.reply({ 
            content: `✅ Titular PIX alterado para: ${nome}`,
            ephemeral: true 
        });
        return;
    }
    
    // /config
    if (commandName === 'config') {
        if (!isAdmin) {
            await interaction.reply({ content: '❌ Apenas administradores!', ephemeral: true });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Configurações')
            .setColor(Colors.Purple)
            .addFields(
                { name: '👑 Dono', value: `<@${ADMIN_IDS[0]}>`, inline: true },
                { name: '👥 Admins', value: `${ADMIN_IDS.length - 1}`, inline: true },
                { name: '💰 Chave PIX', value: CHAVE_PIX, inline: false },
                { name: '👤 Titular', value: TITULAR_PIX, inline: false },
                { name: '🎖️ Cargo Cliente', value: CARGO_CLIENTE_ID ? `<@&${CARGO_CLIENTE_ID}>` : 'Não configurado', inline: true },
                { name: '📂 Categoria', value: CATEGORIA_CARRINHOS_ID ? `✅ Configurada` : '❌ Não configurada', inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }
    
    // ========================================
    // COMANDOS DE VENDAS (ADMIN)
    // ========================================
    
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
        
        const order = pendingOrders.get(userId);
        
        if (order.channelId) {
            const canal = interaction.guild.channels.cache.get(order.channelId);
            if (canal) {
                await canal.send({ content: `❌ **Pedido cancelado!**` });
                setTimeout(async () => {
                    try {
                        await canal.delete();
                    } catch (e) {}
                }, 2000);
            }
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
                { name: '👥 Admins', value: `${ADMIN_IDS.length}`, inline: true },
                { name: '💰 Chave PIX', value: CHAVE_PIX, inline: true },
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
console.log('📌 Comandos:');
console.log('   ✅ /set_painel - Criar painel');
console.log('   ✅ /pendentes - Listar pedidos');
console.log('   ✅ /cancelar - Cancelar pedido');
console.log('   ✅ /keys - Listar keys');
console.log('   ✅ /status - Status do bot');
console.log('   ✅ /admins - Listar admins');
console.log('   ✅ /add_admin - Adicionar admin (DONO)');
console.log('   ✅ /rem_admin - Remover admin (DONO)');
console.log('   ✅ /set_pix - Alterar chave PIX');
console.log('   ✅ /set_titular - Alterar titular PIX');
console.log('   ✅ /config - Ver configurações');
