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
        },
        resume: () => {
            if (!engine) engine = createEngine();
            if (engine && engine.ctx && engine.ctx.state === 'suspended') {
                engine.ctx.resume().then(() => {
                    console.log('AudioContext resumed successfully');
                }).catch(err => {
                    console.error('Failed to resume AudioContext:', err);
                });
            }
        }
    };
})();

const SOUND_NAMES = ['Thrust', 'Shoot', 'Explosion', 'PlayerHit', 'Victory', 'FireworkCrackle'];

window.gameLoop = (() => {
    let current = null;
    let generation = 0;
    let draining = Promise.resolve();
    const emptyInput = () => ({ up: false, down: false, left: false, right: false, space: false });
    const dimensions = () => {
        const width = window.innerWidth, height = window.innerHeight;
        const scale = Math.min(1, width / (width < height ? 800 : 1100));
        return { width, height, pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
            logicalWidth: Math.round(width / scale), logicalHeight: Math.round(height / scale) };
    };
    const isCurrent = s => current === s;
    const clearInput = s => {
        s.input = emptyInput(); s.touch = emptyInput(); s.pausePulse = false;
        s.releaseTouches?.forEach(release => release());
        document.querySelectorAll('.touch-zone.active').forEach(el => el.classList.remove('active'));
    };
    const keyMap = {
        ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
        ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
        ' ': 'space', Spacebar: 'space'
    };
    const bindInput = s => {
        const signal = s.listeners.signal;
        const onKey = pressed => event => {
            if (s.graphicsLost) return;
            const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
                || document.activeElement?.isContentEditable;
            const key = keyMap[event.key];
            // A release must clear held input even if focus moved to a text field.
            if (!pressed && key) s.input[key] = false;
            if (typing) return;
            if (pressed && event.key.toLowerCase() === 'p') {
                if (!event.repeat) s.pausePulse = true;
                event.preventDefault(); return;
            }
            if (!key) return;
            s.input[key] = pressed;
            event.preventDefault();
        };
        window.addEventListener('keydown', onKey(true), { signal });
        window.addEventListener('keyup', onKey(false), { signal });
        window.addEventListener('blur', () => clearInput(s), { signal });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) clearInput(s);
        }, { signal });
        const zones = { 'touch-left': 'left', 'touch-right': 'right', 'touch-thrust': 'up', 'touch-fire': 'space' };
        for (const [id, key] of Object.entries(zones)) {
            const element = document.getElementById(id);
            if (!element) continue;
            const pointers = new Set();
            (s.releaseTouches ??= []).push(() => pointers.clear());
            element.addEventListener('pointerdown', event => {
                if (s.graphicsLost) return;
                pointers.add(event.pointerId);
                element.setPointerCapture(event.pointerId);
                s.touch[key] = true; element.classList.add('active'); event.preventDefault();
            }, { signal });
            const release = event => {
                pointers.delete(event.pointerId);
                s.touch[key] = pointers.size > 0;
                element.classList.toggle('active', s.touch[key]);
            };
            for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
                element.addEventListener(name, release, { signal });
            }
        }
        window.addEventListener('resize', () => {
            s.size = dimensions();
            s.renderer?.resize(s.size);
            // OnResize is serialized after any outstanding frame by animate().
            s.resizePending = true;
        }, { signal });
    };
    const playFrameSounds = frame => {
        for (const sound of frame.sounds || []) {
            const name = typeof sound === 'number' ? SOUND_NAMES[sound] : sound;
            const param = name === 'Thrust' ? frame.thrustDuration : name === 'Explosion' ? frame.explosionRadius : 0;
            window.gameSound.play(name, param);
        }
    };
    const createRenderer = async (s, kind) => {
        if (!s.module) {
            try {
                s.module = await import(new URL('js/dist/rendering.js', document.baseURI));
            } catch (error) {
                console.warn('Renderer bundle unavailable; loading the canvas fallback.', error);
                s.module = await import(new URL('js/rendering/renderer-host.js', document.baseURI));
                kind = 'canvas';
            }
        }
        if (!isCurrent(s)) return;
        s.renderer?.dispose();
        s.renderer = s.module.createRendererHost(s.host, {
            renderer: kind, debug: s.debug, onContextLost: () => loseGraphics(s)
        });
        await s.renderer.init();
        if (!isCurrent(s)) return;
        s.renderer.resize(s.size);
    };
    const recover = async s => {
        if (!isCurrent(s) || s.recovering) return;
        s.recovering = true;
        try {
            await s.suspension;
            if (!isCurrent(s)) return;
            await createRenderer(s, 'canvas');
            if (!isCurrent(s)) return;
            if (s.lastFrame) s.renderer.render(s.lastFrame, 0);
            await s.ref.invokeMethodAsync('SetRendererSuspended', false);
            if (!isCurrent(s)) return;
            s.graphicsLost = false; s.prevTime = null;
            s.notice?.remove(); s.notice = null;
        } catch (error) {
            console.error('Graphics recovery failed:', error);
            if (s.notice) s.notice.querySelector('p').textContent = 'Graphics could not restart. Please try again.';
        } finally { s.recovering = false; }
    };
    const loseGraphics = s => {
        if (!isCurrent(s) || s.graphicsLost) return;
        s.graphicsLost = true;
        clearInput(s);
        // Wait for the sole pending update before freezing the engine clock.
        s.suspension = (s.pending || Promise.resolve()).then(async () => {
            if (isCurrent(s)) await s.ref.invokeMethodAsync('SetRendererSuspended', true);
        });
        s.suspension.catch(error => console.error('Could not suspend game:', error));
        s.notice = document.createElement('div');
        s.notice.className = 'graphics-recovery';
        s.notice.setAttribute('role', 'alert');
        const message = document.createElement('p');
        message.textContent = 'Graphics interrupted. Your game is held while graphics recover.';
        const button = document.createElement('button');
        button.textContent = 'Continue with compatible graphics';
        button.addEventListener('click', () => { s.recovery = recover(s); }, { signal: s.listeners.signal });
        s.notice.append(message, button); s.host.append(s.notice); button.focus();
    };
    const animate = (s, time) => {
        if (!isCurrent(s)) return;
        s.animationId = requestAnimationFrame(next => animate(s, next));
        if (s.graphicsLost || s.pending) return;
        if (s.prevTime === null) { s.prevTime = time; return; }
        const delta = time - s.prevTime;
        s.prevTime = time;
        const input = Object.fromEntries(Object.keys(s.input).map(key => [key, s.input[key] || s.touch[key]]));
        input.pause = s.pausePulse; s.pausePulse = false;
        s.pending = (async () => {
            if (s.resizePending) {
                s.resizePending = false;
                await s.ref.invokeMethodAsync('OnResize', s.size.logicalWidth, s.size.logicalHeight);
                if (!isCurrent(s) || s.graphicsLost) return;
            }
            const frameStarted = performance.now();
            const frame = await s.ref.invokeMethodAsync('OnFrame', delta, input);
            const simulationDone = performance.now();
            if (!isCurrent(s) || !frame) return;
            s.lastFrame = frame;
            if (!s.graphicsLost) {
                s.renderer.render(frame, delta);
                playFrameSounds(frame);
            }
            if (s.profile && !frame.isPaused) {
                s.profile.push({ intervalMs: delta, interopMs: simulationDone - frameStarted,
                    renderSubmissionMs: performance.now() - simulationDone, asteroids: frame.asteroids?.length || 0,
                    gameOver: !!frame.isGameOver });
                if (s.profile.length > 1200) s.profile.shift();
            }
            if (frame.shouldReset || frame.pendingScores?.length) {
                // Leaderboard/network work must not hold up simulation frames.
                s.events = (s.events || Promise.resolve()).then(async () => {
                    if (isCurrent(s)) await s.ref.invokeMethodAsync('HandleFrameEvents', !!frame.shouldReset, frame.pendingScores || []);
                }).catch(error => console.error('Game event error:', error));
            }
        })().catch(error => {
            if (isCurrent(s)) { console.error('Game frame error:', error); loseGraphics(s); }
        }).finally(() => { s.pending = null; });
    };
    const stop = () => {
        generation++;
        const s = current; current = null;
        if (s) {
            cancelAnimationFrame(s.animationId);
            s.listeners.abort(); clearInput(s);
            s.renderer?.dispose(); s.notice?.remove();
        }
        // Every new start waits for all retired sessions, including concurrent stops.
        draining = draining.catch(() => {}).then(async () => {
            if (!s) return;
            await Promise.allSettled([s.startup, s.pending, s.suspension, s.recovery, s.events]);
            if (s.clockHeld || s.graphicsLost) await s.ref.invokeMethodAsync('SetRendererSuspended', false);
        });
        return draining;
    };
    return {
        getViewportWidth: () => dimensions().logicalWidth,
        getViewportHeight: () => dimensions().logicalHeight,
        togglePause: () => { if (current && !current.graphicsLost) current.pausePulse = true; },
        getGraphics: () => current?.renderer?.getGraphics(),
        getGraphicsDiagnostics: () => current?.renderer?.getDiagnostics(),
        getFrameMeasurements: () => current?.profile?.map(sample => ({ ...sample })) || [],
        setGraphics: value => current?.renderer?.setGraphics(value),
        async start(host, ref) {
            const drain = stop(), token = generation;
            await drain;
            if (token !== generation) return;
            const params = new URLSearchParams(location.search);
            const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
            const s = { host, ref, size: dimensions(), listeners: new AbortController(),
                input: emptyInput(), touch: emptyInput(), pausePulse: false,
                prevTime: null, pending: null, graphicsLost: false, debug: local && params.has('collisions') };
            s.profile = local && params.has('profile') ? [] : null;
            current = s;
            try {
                s.clockHeld = true;
                s.startup = (async () => {
                    await ref.invokeMethodAsync('SetRendererSuspended', true);
                    if (!isCurrent(s)) return;
                    await createRenderer(s, params.get('renderer') === 'webgl' ? 'webgl' : 'canvas');
                    if (!isCurrent(s)) return;
                    await ref.invokeMethodAsync('SetRendererSuspended', false);
                    s.clockHeld = false;
                    if (!isCurrent(s)) return;
                    // The viewport may have changed while the bundle was loading.
                    const latestSize = dimensions();
                    s.resizePending = latestSize.logicalWidth !== s.size.logicalWidth || latestSize.logicalHeight !== s.size.logicalHeight;
                    s.size = latestSize;
                    s.renderer.resize(s.size);
                    bindInput(s);
                    host.closest('.game-container')?.classList.toggle('is-touch',
                        navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches);
                    s.animationId = requestAnimationFrame(time => animate(s, time));
                })();
                await s.startup;
            } catch (error) {
                if (!isCurrent(s)) return;
                console.error('Renderer startup failed:', error);
                loseGraphics(s);
                bindInput(s);
                s.animationId = requestAnimationFrame(time => animate(s, time));
            }
        },
        stop
    };
})();

// Global gesture listener to unlock Web Audio on iOS Safari / Mobile browsers
const handleUserGestureAudio = () => {
    if (window.gameSound && typeof window.gameSound.resume === 'function') {
        window.gameSound.resume();
        window.removeEventListener('touchstart', handleUserGestureAudio);
        window.removeEventListener('click', handleUserGestureAudio);
    }
};
window.addEventListener('touchstart', handleUserGestureAudio, { passive: true });
window.addEventListener('click', handleUserGestureAudio, { passive: true });
