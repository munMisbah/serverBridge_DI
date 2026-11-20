import React, { useEffect } from 'react';
import { useIsland } from '../../context/IslandContext';
import { setNamedHitRects } from '../../lib/hitTest';
import { FloatingServerCard } from './FloatingServerCard';

export const FloatingServersLayer: React.FC = () => {
  const { floatingServers, servers, updateFloatingServer } = useIsland();

  // Keep cards clamped inside the viewport on resize
  useEffect(() => {
    const clampAll = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      floatingServers.forEach((win) => {
        const x = Math.max(8, Math.min(win.x, vw - win.width - 8));
        const y = Math.max(8, Math.min(win.y, vh - win.height - 8));
        if (x !== win.x || y !== win.y) {
          updateFloatingServer(win.serverId, { x, y });
        }
      });
    };
    window.addEventListener('resize', clampAll);
    return () => window.removeEventListener('resize', clampAll);
  }, [floatingServers, updateFloatingServer]);

  // Register floating server rects so desktop outside remains click-through
  useEffect(() => {
    setNamedHitRects(
      'servers',
      floatingServers.map((w) => ({
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
      }))
    );
    return () => setNamedHitRects('servers', []);
  }, [floatingServers]);

  if (floatingServers.length === 0) return null;

  return (
    <div
      data-floating-servers-layer
      className="pointer-events-none fixed inset-0 z-[65] overflow-hidden"
    >
      {floatingServers.map((win) => {
        const server = servers.find((s) => s.id === win.serverId);
        if (!server) return null;
        return <FloatingServerCard key={win.serverId} win={win} server={server} />;
      })}
    </div>
  );
};
