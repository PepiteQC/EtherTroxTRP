import React, { useEffect, useState } from 'https://esm.sh/react@18';
import { createRoot } from 'https://esm.sh/react-dom@18/client';
import htm from 'https://esm.sh/htm@3.1.1';
import { Canvas } from 'https://esm.sh/@react-three/fiber@8.17.10';
import { OrbitControls, Grid, Html, Stars } from 'https://esm.sh/@react-three/drei@9.112.0';

const html = htm.bind(React.createElement);

const EMPTY = {
  serverTime: Date.now(),
  worldState: {
    mode: 'sandbox',
    playerCount: 0,
    worldEvents: [],
    weather: 'sunny',
    hour: 12
  },
  players: {
    totalPlayers: 0,
    connectedPlayers: 0,
    players: []
  },
  eye: {
    totalObservations: 0,
    totalEvents: 0,
    observations: []
  }
};

function colorForPlayer(player) {
  const job = (player.job || '').toLowerCase();

  if (player.wanted >= 4) return '#ff4d6d';
  if (job.includes('police')) return '#4ea1ff';
  if (job.includes('ems')) return '#4dffb8';
  if (job.includes('mechanic')) return '#ffb84d';
  if (job.includes('gang')) return '#c084fc';

  return '#ffd24d';
}

function PlayerAvatar({ player }) {
  const p = player.position || { x: 0, y: 0, z: 0 };
  const color = colorForPlayer(player);

  return html`
    <group position=${[p.x, 0, p.z]}>
      <mesh position=${[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args=${[1, 1.6, 1]} />
        <meshStandardMaterial color=${color} />
      </mesh>

      ${
        player.vehicle
          ? html`
              <mesh position=${[0, 0.25, -1.25]} castShadow receiveShadow>
                <boxGeometry args=${[1.8, 0.5, 3]} />
                <meshStandardMaterial color=${'#34d399'} />
              </mesh>
            `
          : null
      }

      <${Html} position=${[0, 2.1, 0]} center distanceFactor=${14}>
        <div className="player-label">
          <div><strong>${player.name}</strong></div>
          <div>${player.job} • $${player.money}</div>
          <div>Wanted: ${player.wanted}${player.vehicle ? ` • ${player.vehicle}` : ''}</div>
        </div>
      <//>
    </group>
  `;
}

function Scene({ snapshot }) {
  const players = snapshot.players?.players || [];

  return html`
    <group>
      <color attach="background" args=${['#0b1020']} />
      <fog attach="fog" args=${['#0b1020', 18, 80]} />

      <ambientLight intensity=${1.1} />
      <directionalLight
        position=${[10, 18, 8]}
        intensity=${1.8}
        castShadow=${true}
      />

      <${Stars}
        radius=${90}
        depth=${40}
        count=${2500}
        factor=${4}
        saturation=${0}
        fade=${true}
        speed=${1}
      />

      <mesh rotation=${[-Math.PI / 2, 0, 0]} position=${[0, -0.02, 0]} receiveShadow>
        <planeGeometry args=${[240, 240]} />
        <meshStandardMaterial color=${'#101826'} />
      </mesh>

      <${Grid}
        position=${[0, 0.01, 0]}
        args=${[240, 240]}
        cellSize=${1}
        cellThickness=${0.6}
        cellColor=${'#20365b'}
        sectionSize=${5}
        sectionThickness=${1.2}
        sectionColor=${'#4475c7'}
        fadeDistance=${100}
        fadeStrength=${1}
        infiniteGrid=${true}
      <//>

      <mesh position=${[0, 0.5, 0]}>
        <cylinderGeometry args=${[0.7, 0.7, 1, 24]} />
        <meshStandardMaterial color=${'#ffffff'} emissive=${'#2244aa'} />
      </mesh>

      ${players.map((player) => html`<${PlayerAvatar} key=${player.id} player=${player} />`)}

      <${OrbitControls}
        makeDefault=${true}
        enableDamping=${true}
        maxPolarAngle=${Math.PI / 2.1}
        minDistance=${8}
        maxDistance=${80}
      <//>
    </group>
  `;
}

function HUD({ snapshot, wsStatus, sendCommand, lastEvent }) {
  const [cmd, setCmd] = useState('/weather storm');

  const players = snapshot.players?.players || [];
  const world = snapshot.worldState || {};
  const recentEvents = (world.worldEvents || []).slice(-6).reverse();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cmd.trim()) return;
    await sendCommand(cmd);
  };

  return html`
    <div className="hud">
      <div className="left">
        <div className="panel">
          <div className="title">TroxT Sandbox Viewer</div>
          <div className="subtitle">React + Three.js + WebSocket live</div>
          <div className="status ${wsStatus === 'connecté' ? 'ok' : 'warn'}">
            WebSocket: ${wsStatus}
          </div>
        </div>

        <div className="panel">
          <div><strong>Command Console</strong></div>
          <form onSubmit=${handleSubmit}>
            <input
              value=${cmd}
              onInput=${(e) => setCmd(e.target.value)}
              placeholder="/spawn cube"
            />
            <button type="submit">Envoyer</button>
          </form>

          <div className="quick">
            <button type="button" onClick=${() => sendCommand('/weather storm')}>Storm</button>
            <button type="button" onClick=${() => sendCommand('/weather sunny')}>Sunny</button>
            <button type="button" onClick=${() => sendCommand('/time 22')}>22h</button>
            <button type="button" onClick=${() => sendCommand('/time 8')}>08h</button>
            <button type="button" onClick=${() => sendCommand('/spawn cube')}>Spawn Cube</button>
            <button type="button" onClick=${() => sendCommand('/scan Player101')}>Scan P101</button>
          </div>

          <div className="mini" style=${{ marginTop: '10px', color: '#cbd5e1' }}>
            Dernier événement: ${lastEvent || 'aucun'}
          </div>
        </div>

        <div className="panel mini">
          <div><strong>Monde</strong></div>
          <div>Mode: ${world.mode || 'sandbox'}</div>
          <div>Météo: ${world.weather || 'sunny'}</div>
          <div>Heure: ${world.hour ?? 12}h</div>
          <div>Joueurs connectés: ${snapshot.players?.connectedPlayers || 0}</div>
          <div>Observations: ${snapshot.eye?.totalObservations || 0}</div>
          <div>Events monde: ${(world.worldEvents || []).length}</div>
        </div>
      </div>

      <div className="right">
        <div className="panel">
          <div><strong>Joueurs</strong></div>
          <div className="feed">
            ${
              players.length
                ? players.map(
                    (p) =>
                      `👤 ${p.name} | ${p.job} | $${p.money} | Wanted ${p.wanted} | (${p.position?.x ?? 0}, ${p.position?.z ?? 0})`
                  ).join('\n')
                : 'Aucun joueur'
            }
          </div>
        </div>

        <div className="panel">
          <div><strong>Activité récente</strong></div>
          <div className="feed">
            ${
              recentEvents.length
                ? recentEvents.map(
                    (e) => `• ${e.rule} → ${e.result}`
                  ).join('\n')
                : 'Aucun event'
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function App() {
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [wsStatus, setWsStatus] = useState('connexion...');
  const [lastEvent, setLastEvent] = useState('');

  async function fetchSnapshot() {
    try {
      const res = await fetch('/api/snapshot');
      const data = await res.json();
      setSnapshot(data);
    } catch {}
  }

  async function sendCommand(cmd) {
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd, player: 'ViewerAdmin' })
      });

      const data = await res.json();
      setLastEvent(data.result || JSON.stringify(data));
    } catch (e) {
      setLastEvent(`Erreur commande: ${e.message}`);
    }
  }

  useEffect(() => {
    fetchSnapshot();

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}`);

    ws.onopen = () => {
      setWsStatus('connecté');
    };

    ws.onclose = () => {
      setWsStatus('déconnecté');
    };

    ws.onerror = () => {
      setWsStatus('erreur');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'welcome' && msg.snapshot) {
          setSnapshot(msg.snapshot);
        }

        if (msg.type === 'snapshot' && msg.snapshot) {
          setSnapshot(msg.snapshot);
        }

        if (msg.type === 'command_event' && msg.result) {
          setLastEvent(`${msg.result.player}: ${msg.result.result}`);
        }
      } catch {}
    };

    const poll = setInterval(fetchSnapshot, 4000);

    return () => {
      clearInterval(poll);
      ws.close();
    };
  }, []);

  return html`
    <div className="app-shell">
      <${Canvas}
        shadows=${true}
        camera=${{ position: [18, 16, 18], fov: 55 }}
      >
        <${Scene} snapshot=${snapshot} />
      <//>

      <${HUD}
        snapshot=${snapshot}
        wsStatus=${wsStatus}
        sendCommand=${sendCommand}
        lastEvent=${lastEvent}
      />
    </div>
  `;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);