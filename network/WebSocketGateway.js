// server/network/WebSocketGateway.js
const ThirdEye = require('../core/ThirdEye');

class WebSocketGateway {
    constructor(wss, intellectus, thirdEye) {
        this.wss = wss;
        this.intellectus = intellectus;
        this.thirdEye = thirdEye;
        this.clients = new Map(); // Suivi des joueurs connectés

        this.wss.on('connection', (ws, req) => {
            const clientId = req.socket.remoteAddress;
            this.clients.set(ws, { id: clientId, authenticated: false });
            
            this.thirdEye.observe('NETWORK', `Connexion entrante: ${clientId}`, 'INFO');

            ws.on('message', (data) => {
                try {
                    const packet = JSON.parse(data);
                    // Ici, on déléguera au PacketHandler plus tard
                    this.handlePacket(ws, packet);
                } catch (err) {
                    this.thirdEye.alert('ERROR', `Paquet invalide de ${clientId}`);
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                this.thirdEye.observe('NETWORK', `Déconnexion: ${clientId}`, 'INFO');
            });
        });
    }

    handlePacket(ws, packet) {
        // Validation basique (Ether-Guard prématuré)
        if (!packet.type) {
            this.thirdEye.alert('WARNING', 'Paquet sans type reçu');
            return;
        }

        // Broadcast pour l'instant (Echo pour test)
        // Dans la phase suivante, Intellectus distribuera aux Systems
        this.intellectus.emit('network:packet', { ws, packet });
        
        // Acknowledgement simple
        ws.send(JSON.stringify({ type: 'ACK', id: packet.id }));
    }

    broadcast(type, data) {
        const message = JSON.stringify({ type, data });
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

module.exports = WebSocketGateway;