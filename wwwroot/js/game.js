window.gameStorage = {
    getHighScores: (key) => {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    },
    setHighScores: (key, scores) => {
        localStorage.setItem(key, JSON.stringify(scores));
    }
};

window.gameSound = (() => {
    let engine = null;

    const createEngine = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const gainNode = ctx.createGain();
            gainNode.gain.value = 0.15;
            gainNode.connect(ctx.destination);
            return { ctx, gainNode, thrustActive: false };
        } catch {
            return null;
        }
    };

    const playThrust = (dtSeconds) => {
        if (!engine || engine.thrustActive) return;
        engine.thrustActive = true;

        const osc = engine.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 80;

        const lfo = engine.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 6;

        const lfoGain = engine.ctx.createGain();
        lfoGain.gain.value = 10;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        lfo.start();
        osc.connect(engine.gainNode);
        osc.start();

        const t = engine.ctx.currentTime;
        engine.gainNode.gain.setValueAtTime(0.15, t);
        engine.gainNode.gain.exponentialRampToValueAtTime(0.01, t + dtSeconds);
        osc.stop(t + dtSeconds);
        lfo.stop(t + dtSeconds);

        setTimeout(() => { engine.thrustActive = false; }, dtSeconds * 1000);
    };

    const playShoot = () => {
        if (!engine) return;
        const { ctx } = engine;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    };

    const playExplosion = (radius) => {
        if (!engine) return;
        const { ctx } = engine;
        const maxRadius = 40;
        const volume = Math.max(0.1, radius / maxRadius);
        const duration = Math.max(0.2, (radius / maxRadius) * 0.5);
        const numOscs = Math.floor(3 + (maxRadius - radius) / 10);

        for (let i = 0; i < numOscs; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const baseFreq = 60 + Math.random() * 120;
            osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
            osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + duration);
            gain.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        }
    };

    const playPlayerHit = () => {
        if (!engine) return;
        const { ctx } = engine;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    };

    const playVictory = () => {
        if (!engine) return;
        const { ctx } = engine;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = ctx.currentTime + i * 0.12;
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.3);
        });
    };

    const playFireworkCrackle = () => {
        if (!engine) return;
        const { ctx } = engine;
        for (let i = 0; i < 5; i++) {
            const delay = Math.random() * 4.5 + 0.2;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = 800 + Math.random() * 2400;
            gain.gain.setValueAtTime(0, ctx.currentTime + delay);
            gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + delay + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.1);
        }
    };

    return {
        play: (effect, param) => {
            if (!engine) engine = createEngine();
            if (!engine) return;

            switch (effect) {
                case 'Thrust': playThrust(param || 0.016); break;
                case 'Shoot': playShoot(); break;
                case 'Explosion': playExplosion(param || 40); break;
                case 'PlayerHit': playPlayerHit(); break;
                case 'Victory': playVictory(); break;
                case 'FireworkCrackle': playFireworkCrackle(); break;
            }
        }
    };
})();

window.gameRenderer = (() => {
    const COLORS = {
        ship: '#7ef9ff',
        shipCore: '#e8fdff',
        laser: '#6ef0ff',
        asteroidLarge: '#c8e8ff',
        asteroidMid: '#9fd4ff',
        asteroidSmall: '#ff9f6e'
    };

    let shakeAmount = 0;
    const trailParticles = [];
    const timeOrigin = performance.now();

    const asteroidColor = (radius) => {
        if (radius >= 35) return COLORS.asteroidLarge;
        if (radius >= 20) return COLORS.asteroidMid;
        return COLORS.asteroidSmall;
    };

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
            hue: 24 + Math.random() * 30
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
            ctx.shadowColor = '#ff8c3a';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2 + alpha * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
    };

    const drawPlayer = (ctx, player, invulnerable, thrusting) => {
        if (invulnerable && Math.floor(Date.now() / 200) % 2 === 0) return;

        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.rotation);

        ctx.shadowBlur = 18;
        ctx.shadowColor = COLORS.ship;
        ctx.strokeStyle = COLORS.ship;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, -10);
        ctx.closePath();
        ctx.stroke();

        ctx.shadowBlur = 8;
        ctx.strokeStyle = COLORS.shipCore;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (thrusting) {
            const flicker = 12 + Math.random() * 14;
            const flame = ctx.createLinearGradient(-10, 0, -10 - flicker, 0);
            flame.addColorStop(0, '#fff2a8');
            flame.addColorStop(0.35, '#ff8a2a');
            flame.addColorStop(1, 'rgba(255, 60, 0, 0)');
            ctx.strokeStyle = flame;
            ctx.lineWidth = 4;
            ctx.shadowBlur = 16;
            ctx.shadowColor = '#ff6a00';
            ctx.beginPath();
            ctx.moveTo(-10, 6);
            ctx.lineTo(-10 - flicker, 0);
            ctx.lineTo(-10, -6);
            ctx.stroke();

            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 4);
            ctx.lineTo(-8 - flicker * 0.6, 0);
            ctx.lineTo(-10, -4);
            ctx.stroke();
        }

        ctx.restore();
    };

    const drawAsteroids = (ctx, asteroids) => {
        for (const a of asteroids) {
            const color = asteroidColor(a.radius);
            ctx.save();
            ctx.translate(a.x, a.y);
            ctx.rotate(a.rotation);

            ctx.shadowBlur = 10 + a.radius * 0.15;
            ctx.shadowColor = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = a.radius >= 35 ? 2.5 : 2;
            ctx.beginPath();
            if (a.points.length > 0) {
                ctx.moveTo(a.points[0].x, a.points[0].y);
                for (let i = 1; i < a.points.length; i++) {
                    ctx.lineTo(a.points[i].x, a.points[i].y);
                }
                ctx.closePath();
            }
            ctx.stroke();

            ctx.globalAlpha = 0.12;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
        }
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
        render: (ctx, frame, deltaMs = 16) => {
            const w = frame.canvasWidth;
            const h = frame.canvasHeight;
            const time = performance.now() - timeOrigin;
            const dt = deltaMs / 1000;

            if (frame.screenShake) {
                shakeAmount = Math.max(shakeAmount, frame.screenShake);
            }
            shakeAmount *= 0.88;

            ctx.save();
            if (shakeAmount > 0.2) {
                const sx = (Math.random() - 0.5) * shakeAmount;
                const sy = (Math.random() - 0.5) * shakeAmount;
                ctx.translate(sx, sy);
            }

            drawBackground(ctx, w, h, frame.stars || [], time);

            if (frame.drawPlayer && frame.player) {
                spawnTrail(frame.player, frame.thrusting);
            }
            drawTrail(ctx, dt);

            if (frame.asteroids) drawAsteroids(ctx, frame.asteroids);
            if (frame.projectiles) drawProjectiles(ctx, frame.projectiles);

            if (frame.drawPlayer && frame.player) {
                drawPlayer(ctx, frame.player, frame.invulnerable, frame.thrusting);
            }

            if (frame.explosions) drawParticles(ctx, frame.explosions, 0.9);
            if (frame.fireworks) drawParticles(ctx, frame.fireworks, 5);

            drawVignette(ctx, w, h);
            ctx.restore();
        }
    };
})();

const SOUND_NAMES = ['Thrust', 'Shoot', 'Explosion', 'PlayerHit', 'Victory', 'FireworkCrackle'];

window.gameLoop = (() => {
    let animationId = null;
    let prevTime = null;
    let dotNetRef = null;
    let canvas = null;
    let ctx = null;
    let input = { up: false, down: false, left: false, right: false, space: false };

    const keyMap = {
        ArrowUp: 'up', w: 'up', W: 'up',
        ArrowDown: 'down', s: 'down', S: 'down',
        ArrowLeft: 'left', a: 'left', A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right',
        ' ': 'space', Spacebar: 'space'
    };

    const onKey = (pressed) => (e) => {
        const key = keyMap[e.key];
        if (!key) return;
        input[key] = pressed;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
    };

    const resize = () => {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (dotNetRef) {
            dotNetRef.invokeMethod('OnResize', canvas.width, canvas.height);
        }
    };

    const playFrameSounds = (frame) => {
        for (const sound of frame.sounds || []) {
            const name = typeof sound === 'number' ? SOUND_NAMES[sound] : sound;
            const param = name === 'Thrust'
                ? frame.thrustDuration
                : name === 'Explosion'
                    ? frame.explosionRadius
                    : 0;
            window.gameSound.play(name, param);
        }
    };

    const handleFrameEvents = (frame) => {
        const hasScores = frame.pendingScores && frame.pendingScores.length > 0;
        if (!frame.victoryJustAchieved && !frame.shouldReset && !hasScores) return;

        dotNetRef.invokeMethodAsync(
            'HandleFrameEvents',
            !!frame.victoryJustAchieved,
            !!frame.shouldReset,
            frame.pendingScores || []
        );
    };

    let framePending = false;

    const animate = (time) => {
        animationId = requestAnimationFrame(animate);

        if (prevTime === null || !dotNetRef || !ctx) {
            prevTime = time;
            return;
        }

        if (framePending) return;

        const delta = time - prevTime;
        prevTime = time;
        framePending = true;

        dotNetRef.invokeMethodAsync('OnFrame', delta, input)
            .then((frame) => {
                if (!frame) return;
                window.gameRenderer.render(ctx, frame, delta);
                playFrameSounds(frame);
                handleFrameEvents(frame);
            })
            .catch((err) => console.error('Game frame error:', err))
            .finally(() => {
                framePending = false;
            });
    };

    return {
        getViewportWidth: () => window.innerWidth,
        getViewportHeight: () => window.innerHeight,
        start: (canvasEl, ref) => {
            canvas = canvasEl instanceof HTMLCanvasElement
                ? canvasEl
                : document.querySelector('.game-canvas');
            if (!canvas) {
                console.error('Game canvas element not found');
                return;
            }
            ctx = canvas.getContext('2d');
            dotNetRef = ref;

            window.addEventListener('keydown', onKey(true));
            window.addEventListener('keyup', onKey(false));
            window.addEventListener('resize', resize);

            resize();
            prevTime = null;
            animationId = requestAnimationFrame(animate);
        },
        stop: () => {
            if (animationId) cancelAnimationFrame(animationId);
            window.removeEventListener('keydown', onKey(true));
            window.removeEventListener('keyup', onKey(false));
            window.removeEventListener('resize', resize);
            animationId = null;
            prevTime = null;
            dotNetRef = null;
        }
    };
})();