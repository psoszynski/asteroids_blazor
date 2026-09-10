export function createCanvasRenderer() {
    const COLORS = {
        laser: '#6ef0ff'
    };

    let shakeAmount = 0;
    const trailParticles = [];
    let elapsed = 0;
    let canvas, ctx;

    const drawBackground = (ctx, w, h, stars, time) => {
        const pulse = Math.sin(time * 0.0004) * 0.5 + 0.5;
        const bg = ctx.createRadialGradient(w * 0.35, h * 0.25, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
        bg.addColorStop(0, '#0a1030');
        bg.addColorStop(0.35, '#060b1c');
        bg.addColorStop(0.7, '#03060f');
        bg.addColorStop(1, '#010208');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        const nebula = ctx.createRadialGradient(w * 0.72, h * 0.28, 0, w * 0.72, h * 0.28, w * 0.45);
        nebula.addColorStop(0, `rgba(120, 70, 255, ${0.07 + pulse * 0.04})`);
        nebula.addColorStop(0.45, `rgba(40, 120, 255, ${0.04 + pulse * 0.02})`);
        nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebula;
        ctx.fillRect(0, 0, w, h);

        const nebula2 = ctx.createRadialGradient(w * 0.15, h * 0.75, 0, w * 0.15, h * 0.75, w * 0.35);
        nebula2.addColorStop(0, `rgba(255, 90, 120, ${0.035 + pulse * 0.02})`);
        nebula2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebula2;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        const pr = Math.min(w, h) * 0.19;
        ctx.translate(w * 0.81, h * 0.24);
        const atmosphere = ctx.createRadialGradient(0, 0, pr * 0.97, 0, 0, pr * 1.13);
        atmosphere.addColorStop(0, 'rgba(85,166,220,0.22)');
        atmosphere.addColorStop(1, 'rgba(40,100,180,0)');
        ctx.fillStyle = atmosphere;
        ctx.beginPath();
        ctx.arc(0, 0, pr * 1.13, 0, Math.PI * 2);
        ctx.fill();
        const planet = ctx.createRadialGradient(-pr*0.52, -pr*0.48, 0, pr*0.15, pr*0.18, pr*1.1);
        planet.addColorStop(0, '#294458');
        planet.addColorStop(0.4, '#192e42');
        planet.addColorStop(0.7, '#0b172b');
        planet.addColorStop(1, '#040a17');
        ctx.fillStyle = planet;
        ctx.beginPath();
        ctx.arc(0, 0, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.clip();
        ctx.rotate(-0.35);
        for (let i = -4; i <= 4; i++) {
            ctx.strokeStyle = `rgba(120,164,184,${0.025 + (i%2===0 ? 0.025 : 0)})`;
            ctx.lineWidth = pr * 0.06;
            ctx.beginPath();
            ctx.ellipse(-pr*0.2, i*pr*0.22, pr*1.3, pr*0.15, 0, 0, Math.PI);
            ctx.stroke();
        }
        ctx.restore();

        for (const star of stars) {
            const twinkle = 0.55 + 0.45 * Math.sin(time * 0.0025 + (star.twinklePhase || 0));
            const layer = star.layer ?? 1;
            const parallax = layer === 0 ? 0.15 : layer === 1 ? 0.4 : 0.75;
            const tint = layer === 2 ? '#dff6ff' : layer === 1 ? '#b8d9ff' : '#8aa4c7';

            ctx.globalAlpha = (star.opacity || 0.5) * twinkle * parallax;
            ctx.fillStyle = tint;
            ctx.shadowBlur = layer === 2 ? 6 : 0;
            ctx.shadowColor = '#9fdcff';
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        const mw = ctx.createLinearGradient(0, h * 0.15, w, h * 0.85);
        mw.addColorStop(0, 'rgba(255, 255, 255, 0)');
        mw.addColorStop(0.5, 'rgba(170, 200, 255, 0.06)');
        mw.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = mw;
        ctx.fillRect(0, 0, w, h);
    };

    const drawVignette = (ctx, w, h) => {
        const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
    };

    const spawnTrail = (player, thrusting) => {
        if (!player || !thrusting) return;
        trailParticles.push({
            x: player.x - Math.cos(player.rotation) * 14,
            y: player.y - Math.sin(player.rotation) * 14,
            vx: -Math.cos(player.rotation) * 40 + (Math.random() - 0.5) * 20,
            vy: -Math.sin(player.rotation) * 40 + (Math.random() - 0.5) * 20,
            life: 0.35 + Math.random() * 0.25,
            hue: 190 + Math.random() * 30
        });
        if (trailParticles.length > 80) trailParticles.shift();
    };

    const drawTrail = (ctx, dt) => {
        for (let i = trailParticles.length - 1; i >= 0; i--) {
            const p = trailParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                trailParticles.splice(i, 1);
                continue;
            }
            const alpha = p.life / 0.6;
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${alpha})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#4cbcff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2 + alpha * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
    };

    // Polygon surfaces share a fixed light source above and to the left.
    const surface = (ctx, points, fill, stroke) => {
        ctx.beginPath();
        points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 0.65;
            ctx.stroke();
        }
    };

    const drawPlayer = (ctx, player, invulnerable, thrusting) => {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.rotation);
        if (invulnerable) ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(elapsed * 0.012));

        if (thrusting) {
            const length = 25 + Math.sin(elapsed * 0.06) * 6;
            const flame = ctx.createLinearGradient(-8, 0, -length - 12, 0);
            flame.addColorStop(0, '#ffffff');
            flame.addColorStop(0.2, '#a2f5ff');
            flame.addColorStop(0.5, '#368bff');
            flame.addColorStop(1, 'rgba(40, 90, 255, 0)');
            ctx.shadowBlur = 18;
            ctx.shadowColor = '#39bdff';
            surface(ctx, [[-9,-4],[-length-12,0],[-9,4]], flame);
            ctx.shadowBlur = 0;
        }

        const light = Math.cos(player.rotation + Math.PI / 4);
        const hull = ctx.createLinearGradient(-5, -12, 5, 12);
        hull.addColorStop(0, '#e2f0f6');
        hull.addColorStop(0.45, '#8faec2');
        hull.addColorStop(0.5, '#4b657d');
        hull.addColorStop(1, '#182638');
        surface(ctx, [[21,0],[-13,-12],[-9,-3],[-9,3],[-13,12]], '#101c2d', '#7190a4');
        surface(ctx, [[19,0],[-12,-11],[-6,0],[-12,11]], hull, '#abc3d1');
        surface(ctx, [[20,0],[-7,-4],[-10,-10]], `hsl(205, 24%, ${62 + light * 15}%)`);
        surface(ctx, [[20,0],[-7,4],[-10,10]], `hsl(212, 28%, ${32 - light * 12}%)`);
        surface(ctx, [[21,0],[-5,-3],[-9,0],[-5,3]], '#b3c8d3');
        const glass = ctx.createLinearGradient(0,-3,3,4);
        glass.addColorStop(0, '#ecffff');
        glass.addColorStop(0.3, '#54d9f2');
        glass.addColorStop(1, '#12344e');
        surface(ctx, [[10,0],[-2,-3],[-5,0],[-2,3]], glass, '#132c42');
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#58e5ff';
        surface(ctx, [[-10,-10],[-5,-8],[-6,-7],[-11,-9]], '#72edff');
        surface(ctx, [[-10,10],[-5,8],[-6,7],[-11,9]], '#72edff');
        ctx.fillStyle = '#e6ffff';
        ctx.fillRect(-10,-2,2,4);
        ctx.restore();
    };

    const drawAsteroids = (ctx, asteroids) => {
        for (const a of asteroids) {
            if (!a.points.length) continue;
            const r = a.radius;
            // Transform the world light into local space so tumbling changes the lighting.
            const lx = Math.cos(-2.35 - a.rotation);
            const ly = Math.sin(-2.35 - a.rotation);
            const warm = r < 20;
            ctx.save();
            ctx.translate(a.x, a.y);
            ctx.rotate(a.rotation);
            const rock = ctx.createRadialGradient(lx*r*0.5, ly*r*0.5, 0, 0, 0, r*1.15);
            rock.addColorStop(0, warm ? '#bfa18a' : '#9caebd');
            rock.addColorStop(0.45, warm ? '#79665a' : '#586879');
            rock.addColorStop(0.8, warm ? '#393137' : '#293340');
            rock.addColorStop(1, '#101724');
            surface(ctx, a.points.map(p => [p.x,p.y]), rock, '#647486');
            ctx.save();
            ctx.clip();
            // Stable geometry-derived facets: no random texture flicker between frames.
            for (let i=0; i<a.points.length; i++) {
                const p = a.points[i], q = a.points[(i+1)%a.points.length];
                const light = ((p.x+q.x)*lx + (p.y+q.y)*ly) / (r*2);
                surface(ctx, [[p.x,p.y],[q.x,q.y],[p.x*0.31-q.y*0.12,p.y*0.31+q.x*0.12]],
                    light > 0 ? `rgba(215,232,248,${0.05+light*0.16})` : `rgba(3,9,19,${0.08-light*0.22})`);
            }
            for (let i=0; i<5; i++) {
                const seed = a.points[i % a.points.length];
                const angle = i*2.399 + seed.x;
                const distance = r*(0.18+(i%3)*0.18);
                const x = Math.cos(angle)*distance, y = Math.sin(angle)*distance;
                const cr = r*(0.10+(Math.abs(seed.y)%7)*0.012);
                ctx.beginPath();
                ctx.arc(x,y,cr,0,Math.PI*2);
                const crater = ctx.createRadialGradient(x-lx*cr*0.4,y-ly*cr*0.4,0,x,y,cr);
                crater.addColorStop(0,'#17212d');
                crater.addColorStop(0.65,'rgba(24,31,41,0.8)');
                crater.addColorStop(0.85,'rgba(148,160,171,0.3)');
                crater.addColorStop(1,'rgba(22,30,41,0)');
                ctx.fillStyle = crater;
                ctx.fill();
            }
            ctx.restore();
            ctx.restore();
        }
    };

    const POWERUP_COLORS = {
        0: { fill: '#5ce8ff', glow: '#2ab8ff', label: 'S' },
        1: { fill: '#ffb347', glow: '#ff6a00', label: 'R' },
        2: { fill: '#d98cff', glow: '#b44dff', label: 'T' }
    };

    const drawPowerUps = (ctx, powerUps, time) => {
        for (const powerUp of powerUps) {
            const style = POWERUP_COLORS[powerUp.type] || POWERUP_COLORS[0];
            const pulse = 0.75 + 0.25 * Math.sin(time * 0.008 + powerUp.x * 0.02);
            const radius = 10 + pulse * 2;

            ctx.save();
            ctx.translate(powerUp.x, powerUp.y);
            const orb = ctx.createRadialGradient(-4, -5, 0, 0, 0, radius);
            orb.addColorStop(0, '#f2fcff');
            orb.addColorStop(0.25, style.fill);
            orb.addColorStop(0.7, '#25384e');
            orb.addColorStop(1, '#080f21');
            ctx.fillStyle = orb;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 18;
            ctx.shadowColor = style.glow;
            ctx.strokeStyle = style.fill;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 3;
            ctx.shadowColor = '#000000';
            ctx.font = 'bold 11px Share Tech Mono, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(style.label, 0, 1);
            ctx.restore();
        }
    };

    const drawShieldRing = (ctx, player, time) => {
        const pulse = 0.85 + 0.15 * Math.sin(time * 0.01);
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.strokeStyle = `rgba(92, 232, 255, ${0.55 + pulse * 0.25})`;
        const bubble = ctx.createRadialGradient(-8, -9, 1, 0, 0, 24 * pulse);
        bubble.addColorStop(0, 'rgba(206,252,255,0.25)');
        bubble.addColorStop(0.35, 'rgba(70,190,255,0.025)');
        bubble.addColorStop(0.82, 'rgba(70,190,255,0.06)');
        bubble.addColorStop(1, 'rgba(100,225,255,0.32)');
        ctx.fillStyle = bubble;
        ctx.beginPath();
        ctx.arc(0, 0, 24 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#5ce8ff';
        ctx.beginPath();
        ctx.arc(0, 0, 24 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    };

    const drawProjectiles = (ctx, projectiles) => {
        for (const p of projectiles) {
            const speed = Math.hypot(p.velocityX || 0, p.velocityY || 0);
            const tail = Math.min(18, speed * 0.03);
            const angle = Math.atan2(p.velocityY || 0, p.velocityX || 0);

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(angle);

            const beam = ctx.createLinearGradient(-tail, 0, 4, 0);
            beam.addColorStop(0, 'rgba(110, 240, 255, 0)');
            beam.addColorStop(0.6, 'rgba(110, 240, 255, 0.85)');
            beam.addColorStop(1, '#ffffff');
            ctx.strokeStyle = beam;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 14;
            ctx.shadowColor = COLORS.laser;
            ctx.beginPath();
            ctx.moveTo(-tail, 0);
            ctx.lineTo(4, 0);
            ctx.stroke();
            ctx.restore();
        }
    };

    const drawParticles = (ctx, particles, maxLife) => {
        for (const p of particles) {
            const alpha = Math.max(0, p.life / maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2 + alpha * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    };

    return {
        kind: 'canvas',
        async init(element) {
            canvas = element;
            ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas 2D is unavailable');
        },
        resize({ width, height, pixelRatio }) {
            canvas.width = Math.round(width * pixelRatio);
            canvas.height = Math.round(height * pixelRatio);
        },
        reset() { elapsed = 0; shakeAmount = 0; trailParticles.length = 0; },
        dispose() { trailParticles.length = 0; canvas = null; ctx = null; },
        render(frame, deltaMs = 16) {
            const w = frame.canvasWidth;
            const h = frame.canvasHeight;
            if (!frame.isPaused && !frame.reducedEffects) elapsed += Math.min(deltaMs, 50);
            const time = elapsed;
            const dt = frame.isPaused ? 0 : Math.min(deltaMs / 1000, 0.05);

            if (frame.screenShake) {
                shakeAmount = Math.max(shakeAmount, frame.screenShake);
            }
            shakeAmount *= 0.88;
            if (frame.reducedEffects) { shakeAmount = 0; trailParticles.length = 0; }

            ctx.save();
            const scaleFactor = (w && w > 0) ? (ctx.canvas.width / w) : 1.0;
            ctx.scale(scaleFactor, ctx.canvas.height / h);

            if (shakeAmount > 0.2) {
                const sx = (Math.random() - 0.5) * shakeAmount;
                const sy = (Math.random() - 0.5) * shakeAmount;
                ctx.translate(sx, sy);
            }

            drawBackground(ctx, w, h, frame.stars || [], time);

            if (frame.drawPlayer && frame.player) {
                spawnTrail(frame.player, frame.thrusting && !frame.isPaused && !frame.reducedEffects);
            }
            drawTrail(ctx, dt);

            if (frame.asteroids) drawAsteroids(ctx, frame.asteroids);
            if (frame.powerUps) drawPowerUps(ctx, frame.powerUps, time);
            if (frame.projectiles) drawProjectiles(ctx, frame.projectiles);

            if (frame.drawPlayer && frame.player) {
                if (frame.hasShield) drawShieldRing(ctx, frame.player, time);
                drawPlayer(ctx, frame.player, frame.invulnerable, frame.thrusting);
            }

            if (frame.explosions && !frame.reducedEffects) drawParticles(ctx, frame.explosions, 0.9);
            if (frame.fireworks && !frame.reducedEffects) drawParticles(ctx, frame.fireworks, 5);

            drawVignette(ctx, w, h);
            ctx.restore();
        }
    };
}
